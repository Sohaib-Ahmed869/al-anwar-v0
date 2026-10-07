import type { Types } from 'mongoose'
import { Campaign, Donor } from '../models'
import { auditSystem } from '../lib/audit'
import { newToken } from '../lib/auth'
import { alert } from '../lib/alert'
import { sendEmail } from '../lib/email'
import { startSending } from '../lib/segments'
import { campaignEmail } from '../emails/templates'
import { unsubscribeLinks } from '../routes/unsubscribe'
import { isStopping } from './lifecycle'
import type { Segment } from '../../shared/domain'

/* ---------------------------------------------------------------------------
   Sending email campaigns, in batches — called every minute by the scheduler.

   1. A scheduled campaign whose time has come snapshots its audience and
      becomes `sending` (lib/segments.ts startSending).
   2. Each sending campaign takes up to BATCH donor ids off the front of its
      queue and emails them. The ids are taken off BEFORE sending, so if the
      process dies mid-batch those donors miss one email rather than get two.
      Taking them is one atomic update that returns what it removed, so two
      processes (or a "Send now" click during a tick) each get a different
      batch — never the same one twice. On a clean shutdown the batch stops
      between emails and puts back the ids it had not reached.
   3. An empty queue means done: `sent`, with the time.

   Somebody who unsubscribed after the snapshot is skipped and taken out of
   the recipient count, so sent + failed always adds up to recipients.
   `running` stops two ticks overlapping when a batch is slow over SMTP.
--------------------------------------------------------------------------- */

const BATCH = 50
let running = false

export async function processCampaignQueue(): Promise<void> {
  if (running) return
  running = true
  try {
    const due = await Campaign.find({ status: 'scheduled', scheduledAt: { $lte: new Date() } }).select('name segment').lean()
    for (const c of due) {
      const n = await startSending(c._id, (c.segment ?? {}) as Segment)
      /* somebody else started it first */
      if (n === null) continue
      await auditSystem('campaign.send', `Started sending the scheduled campaign “${c.name}” to ${n} donors`, { type: 'campaign', id: c._id, label: c.name })
    }

    const sending = await Campaign.find({ status: 'sending' }).select('name subject preheader body').lean()
    for (const c of sending) {
      if (isStopping()) break
      await sendBatch(c)
    }
  } catch (err) {
    alert('job', 'campaigns failed', err)
  } finally {
    running = false
  }
}

type SendingCampaign = {
  _id: Types.ObjectId
  name: string
  subject?: string | null
  preheader?: string | null
  body?: string | null
}

/** Take the next batch off the queue, atomically: the update leaves the queue
 *  without its first BATCH ids, and returns the document as it was before,
 *  projected to just those ids. Returns null when the campaign has stopped
 *  sending, and how many are left behind the batch. */
export async function claimBatch(id: Types.ObjectId) {
  const before = await Campaign.findOneAndUpdate(
    { _id: id, status: 'sending' },
    [{ $set: { queue: { $slice: ['$queue', BATCH, { $max: [1, { $size: '$queue' }] }] } } }],
    { returnDocument: 'before', updatePipeline: true, projection: { queue: { $slice: BATCH }, queueLength: { $size: '$queue' } } },
  ).lean<{ queue?: Types.ObjectId[]; queueLength?: number }>()
  if (!before) return null
  const ids = before.queue ?? []
  return { ids, left: Math.max(0, (before.queueLength ?? ids.length) - ids.length) }
}

async function sendBatch(c: SendingCampaign) {
  const batch = await claimBatch(c._id)
  if (!batch) return
  const { ids, left } = batch
  if (!ids.length) return finish(c)

  const donors = await Donor.find({ _id: { $in: ids } }).select('firstName lastName email status preferences unsubscribeToken')
  let sent = 0
  let failed = 0
  let skipped = ids.length - donors.length
  const byId = new Map(donors.map((d) => [String(d._id), d]))
  for (const [i, id] of ids.entries()) {
    if (isStopping()) {
      /* put back who this batch had not reached, at the front, for the next
         process. Another process may have found the queue empty meanwhile and
         marked the campaign sent; putting people back reopens it, so they are
         still sent to rather than stranded in a finished campaign's queue. */
      const rest = ids.slice(i)
      await Campaign.updateOne(
        { _id: c._id, status: { $in: ['sending', 'sent'] } },
        { $push: { queue: { $each: rest, $position: 0 } }, $set: { status: 'sending' }, $unset: { sentAt: 1 } },
      )
      skipped -= rest.filter((x) => !byId.has(String(x))).length
      break
    }
    const d = byId.get(String(id))
    if (!d) continue
    if (d.status !== 'active' || !d.preferences?.emailOptIn) {
      skipped++
      continue
    }
    if (!d.unsubscribeToken) {
      d.unsubscribeToken = newToken()
      await d.save()
    }
    const email = campaignEmail(
      { subject: c.subject ?? '', preheader: c.preheader, body: c.body ?? '' },
      { firstName: d.firstName, lastName: d.lastName ?? '' },
      unsubscribeLinks(d.unsubscribeToken),
    )
    try {
      const r = await sendEmail(d.email, email, { donor: d._id, campaign: c._id })
      if (r.ok) sent++
      else failed++
    } catch {
      failed++
    }
  }
  await Campaign.updateOne({ _id: c._id }, { $inc: { 'stats.sent': sent, 'stats.failed': failed, 'stats.recipients': -skipped } })
  /* the last batch: finish now rather than a minute from now */
  if (!left && !isStopping()) await finish(c)
}

async function finish(c: SendingCampaign) {
  /* only an empty queue is finished: a batch put back by a process shutting
     down must not be closed over */
  const r = await Campaign.updateOne(
    { _id: c._id, status: 'sending', queue: { $size: 0 } },
    { $set: { status: 'sent', sentAt: new Date() } },
  )
  if (!r.modifiedCount) return
  const done = await Campaign.findById(c._id).select('stats').lean()
  await auditSystem(
    'campaign.sent',
    `Finished sending “${c.name}”: ${done?.stats?.sent ?? 0} sent, ${done?.stats?.failed ?? 0} failed`,
    { type: 'campaign', id: c._id, label: c.name },
  )
}
