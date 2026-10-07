import type { Types } from 'mongoose'
import { Donor, EmailMessage, Enquiry, Fundraiser, Gift, Plan } from '../models'
import { alert } from './alert'
import { deleteFile } from './storage'
import { auditSystem } from './audit'
import { issueReceipt } from './giving'
import { settlePaypalOrder } from './paypal'

/* ---------------------------------------------------------------------------
   Periodic clean-ups for gifts and fundraisers, run by the scheduler
   (server/jobs/scheduler.ts). Each one is idempotent — running it twice, or
   on two processes, changes nothing the second time — and returns how many
   records it changed.

     sweepPaidWithoutReceipt   a paid website or regular gift whose receipt
                               never went: the process restarted between the
                               webhook's 200 and the email, or the mail server
                               was down (finding H6). Tried once more.
     sweepAbandonedCheckouts   a card or PayPal checkout still pending four days
                               on: the donor closed the page. Marked failed,
                               "Checkout abandoned", so it leaves the pending
                               lists and can never be "received" (L12, M9).
                               PayPal orders are asked about first, and a
                               capture PayPal is holding is followed until it
                               settles.
     endExpiredFundraisers     a live fundraiser past its end date stops taking
                               gifts and shows as ended (L10).
     deleteUnconfirmedFundraisers
                               a page started on the public site whose
                               organiser never confirmed the email address,
                               7 days on: deleted, since nobody has said it is
                               theirs (M10). It was never public or reviewed.
                               Its photo goes too, and so does the donor record
                               the start created for an address we had never
                               seen — but only if that person has done nothing
                               else with us since (no gift, plan, other page,
                               enquiry, sign-in, subscription, staff note or
                               merge): anyone else's record is left alone.
--------------------------------------------------------------------------- */

const HOUR = 3_600_000

/** succeeded online gifts whose receipt was never issued or emailed (H6) */
export async function sweepPaidWithoutReceipt(now = new Date()): Promise<number> {
  /* old enough that the normal path has had its chance, young enough to be
     worth a receipt email still, and not tried by a sweep before */
  /* only card and PayPal payments — the ones a webhook or the scheduler
     receipts on its own. A bank transfer is receipted by the person who marks
     it received, and one they chose not to email (receipt.suppressed) is
     never sent from here. */
  const gifts = await Gift.find({
    status: 'succeeded',
    source: { $in: ['online', 'recurring'] },
    method: { $in: ['card', 'paypal'] },
    updatedAt: { $lt: new Date(now.getTime() - 0.25 * HOUR) },
    createdAt: { $gt: new Date(now.getTime() - 30 * 24 * HOUR) },
    'receipt.sweptAt': null,
    'receipt.suppressed': { $ne: true },
    $or: [{ 'receipt.number': null }, { 'receipt.emailedAt': null }],
  }).limit(200)
  let n = 0
  for (const gift of gifts) {
    /* claim it first, so a second sweep running at the same moment skips it */
    const claimed = await Gift.updateOne({ _id: gift._id, 'receipt.sweptAt': null }, { $set: { 'receipt.sweptAt': now } })
    if (!claimed.modifiedCount) continue
    try {
      await issueReceipt(gift, { email: true })
      n++
    } catch (err) {
      console.error('[sweeps] receipt for', gift.number, err)
    }
  }
  if (n) await auditSystem('gift.receipt_swept', `Finished the receipts of ${n} paid donation${n === 1 ? '' : 's'} whose receipt had not gone out`)
  return n
}

/** Card and PayPal checkouts left pending long after the donor walked away
 *  (L12). Four days, not two: Stripe keeps retrying a webhook for three, and
 *  a payment confirmed late must find its gift still waiting (a late one that
 *  finds it failed is still marked paid — webhooks.ts — but should not have
 *  to). A PayPal webhook may never come, so a PayPal order is asked about first:
 *  one PayPal is holding for review, or has quietly completed, is settled
 *  rather than abandoned (lib/paypal.ts). */
export async function sweepAbandonedCheckouts(now = new Date()): Promise<number> {
  /* PayPal: held captures every run (they settle within days), and any order
     about to be abandoned, once */
  const paypal = await Gift.find({
    status: 'pending',
    source: 'online',
    method: 'paypal',
    'external.paypal': { $type: 'string' },
    $or: [{ 'paypalCapture.status': 'PENDING' }, { createdAt: { $lt: new Date(now.getTime() - ABANDON_AFTER_MS) } }],
  })
    .select('_id external.paypal')
    .limit(100)
  for (const g of paypal) {
    await settlePaypalOrder(g.id, g.external!.paypal!, { capture: false }).catch((err) => console.error('[sweeps] PayPal check for', g.id, err))
  }

  const r = await Gift.updateMany(
    {
      status: 'pending',
      source: 'online',
      method: { $in: ['card', 'paypal'] },
      createdAt: { $lt: new Date(now.getTime() - ABANDON_AFTER_MS) },
      /* PayPal has the money and is holding it: not abandoned, just slow */
      'paypalCapture.status': { $ne: 'PENDING' },
    },
    { $set: { status: 'failed', failureReason: 'Checkout abandoned' } },
  )
  const n = r.modifiedCount
  if (n) await auditSystem('gift.abandoned', `Marked ${n} unpaid card or PayPal checkout${n === 1 ? '' : 's'} older than four days as abandoned`)
  return n
}

/** beyond Stripe's three days of webhook retries */
const ABANDON_AFTER_MS = 4 * 24 * HOUR

/** live fundraisers past their end date (L10) */
export async function endExpiredFundraisers(now = new Date()): Promise<number> {
  const ending = await Fundraiser.find({ status: 'live', endsAt: { $lte: now } }).select('_id title')
  let n = 0
  for (const f of ending) {
    const r = await Fundraiser.updateOne({ _id: f._id, status: 'live' }, { $set: { status: 'ended' } })
    if (!r.modifiedCount) continue
    n++
    await auditSystem('fundraiser.ended', `The fundraiser “${f.title}” reached its end date and stopped taking donations`, {
      type: 'fundraiser', id: f._id, label: f.title,
    })
  }
  return n
}

/** pages started on the public site and never confirmed by email (M10) */
export async function deleteUnconfirmedFundraisers(now = new Date()): Promise<number> {
  const stale = await Fundraiser.find({ status: 'unverified', createdAt: { $lt: new Date(now.getTime() - 7 * 24 * HOUR) } })
    .select('owner image verify.createdDonor')
    .limit(500)
    .lean()
  let n = 0
  let photos = 0
  let donors = 0
  for (const f of stale) {
    /* deleted only while still unconfirmed: a click on the link a moment ago wins */
    const gone = await Fundraiser.deleteOne({ _id: f._id, status: 'unverified' })
    if (!gone.deletedCount) continue
    n++
    const key = f.image?.startsWith('/api/files/') ? f.image.slice('/api/files/'.length) : null
    if (key) {
      try {
        await deleteFile(key)
        photos++
      } catch (err) {
        alert('job', `could not delete the photo of an unconfirmed fundraiser (${key})`, err)
      }
    }
    if (f.verify?.createdDonor && (await removableDonor(f.owner))) {
      const d = await Donor.deleteOne({ _id: f.owner, status: 'active', lastLoginAt: null })
      if (d.deletedCount) {
        donors++
        /* the confirmation email stays in the log as a record that it went;
           it no longer points at a donor that isn't there */
        await EmailMessage.updateMany({ donor: f.owner }, { $unset: { donor: 1 } })
      }
    }
  }
  if (n) {
    await auditSystem(
      'fundraiser.unconfirmed_deleted',
      `Deleted ${n} fundraiser${n === 1 ? '' : 's'} started on the website whose organiser never confirmed their email address within 7 days` +
        (photos ? `, with ${photos} photo${photos === 1 ? '' : 's'}` : '') +
        (donors ? `, and ${donors} supporter record${donors === 1 ? '' : 's'} created by ${donors === 1 ? 'it' : 'them'} and never used` : ''),
    )
  }
  return n
}

/** A donor record nothing else relies on: no gift, plan, other fundraiser or
 *  enquiry, never signed in, never subscribed, no staff note, tag or bank
 *  alias, and not the survivor of a merge. */
async function removableDonor(id: Types.ObjectId): Promise<boolean> {
  const d = await Donor.findOne({
    _id: id,
    status: 'active',
    lastLoginAt: null,
    'preferences.emailOptIn': { $ne: true },
    $and: [
      { $or: [{ notes: null }, { notes: '' }] },
      { $or: [{ tags: { $size: 0 } }, { tags: null }] },
      { $or: [{ bankAliases: { $size: 0 } }, { bankAliases: null }] },
    ],
  })
    .select('_id')
    .lean()
  if (!d) return false
  const [gift, plan, fundraiser, enquiry, merged] = await Promise.all([
    Gift.exists({ donor: id }),
    Plan.exists({ donor: id }),
    Fundraiser.exists({ owner: id }),
    Enquiry.exists({ donor: id }),
    Donor.exists({ mergedInto: id }),
  ])
  return !gift && !plan && !fundraiser && !enquiry && !merged
}
