import type { Types } from 'mongoose'
import { env } from '../env'
import { Campaign, Donor } from '../models'
import { auditSystem } from '../lib/audit'
import { newToken } from '../lib/auth'
import { sendEmail } from '../lib/email'
import { startSending } from '../lib/segments'
import { campaignEmail } from '../emails/templates'
import type { Segment } from '../../shared/domain'

/* ---------------------------------------------------------------------------
   Sending email campaigns, in batches — called every minute by the scheduler.

   1. A scheduled campaign whose time has come snapshots its audience and
      becomes `sending` (lib/segments.ts startSending).
   2. Each sending campaign takes up to BATCH donor ids off the front of its
      queue and emails them. The ids are pulled off BEFORE sending, so if the
      process dies mid-batch those donors miss one email rather than get two.
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
      await auditSystem('campaign.send', `Started sending the scheduled campaign “${c.name}” to ${n} donors`, { type: 'campaign', id: c._id, label: c.name })
    }

    const sending = await Campaign.find({ status: 'sending' }).select('+queue name subject preheader body').lean()
    for (const c of sending) await sendBatch(c)
  } catch (err) {
    console.error('[campaigns]', err)
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
  queue?: Types.ObjectId[]
}

async function sendBatch(c: SendingCampaign) {
  const ids = (c.queue ?? []).slice(0, BATCH)
  if (!ids.length) return finish(c)
  await Campaign.updateOne({ _id: c._id }, { $pullAll: { queue: ids } })

  const donors = await Donor.find({ _id: { $in: ids } }).select('firstName lastName email status preferences unsubscribeToken')
  let sent = 0
  let failed = 0
  let skipped = ids.length - donors.length
  for (const d of donors) {
    if (d.status !== 'active' || !d.preferences?.emailOptIn) {
      skipped++
      continue
    }
    if (!d.unsubscribeToken) {
      d.unsubscribeToken = newToken()
      await d.save()
    }
    const unsubscribe = `${env.appUrl}/api/public/unsubscribe?t=${d.unsubscribeToken}`
    const email = campaignEmail({ subject: c.subject ?? '', preheader: c.preheader, body: c.body ?? '' }, { firstName: d.firstName, lastName: d.lastName ?? '' }, unsubscribe)
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
  if ((c.queue?.length ?? 0) <= BATCH) await finish(c)
}

async function finish(c: SendingCampaign) {
  const r = await Campaign.updateOne({ _id: c._id, status: 'sending' }, { $set: { status: 'sent', sentAt: new Date() } })
  if (!r.modifiedCount) return
  const done = await Campaign.findById(c._id).select('stats').lean()
  await auditSystem(
    'campaign.sent',
    `Finished sending “${c.name}”: ${done?.stats?.sent ?? 0} sent, ${done?.stats?.failed ?? 0} failed`,
    { type: 'campaign', id: c._id, label: c.name },
  )
}
