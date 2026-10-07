import { alert } from '../lib/alert'
import { auditSystem } from '../lib/audit'
import { Donor, EmailMessage, Enquiry, Gift, Plan } from '../models'

/* ---------------------------------------------------------------------------
   Keeping personal information only as long as there is a reason to. Run
   daily by the scheduler. What the privacy policy (src/pages/Privacy.tsx,
   "How long we keep it") promises is what this does — change them together.

     EMAIL LOG     90 days of full content. After that a message keeps who it
                   went to, when, which template and whether it arrived — what
                   staff need to answer "did my receipt go?" — and its body is
                   removed. The body is a copy: a receipt can always be
                   produced again from the gift itself.
     ENQUIRIES     deleted two years after they were closed.
     DONORS        NOT changed automatically. Gift records must be kept seven
                   years for the ATO; after that a donor with no recent gift,
                   no regular donation and no fundraiser could be anonymised.
                   Whether and how is the charity's decision, not a timer's, so
                   for now the job only counts them and says so in the log.
--------------------------------------------------------------------------- */

const DAY = 86_400_000
export const EMAIL_CONTENT_DAYS = 90
export const ENQUIRY_KEEP_DAYS = 2 * 365
export const DONOR_KEEP_YEARS = 7

export const REMOVED_HTML = '<p>The content of this email was removed after 90 days. Who it went to, when, and whether it arrived are kept.</p>'

export type RetentionSummary = { emailsTrimmed: number; enquiriesDeleted: number; donorsPastRetention: number }

export async function runRetention(now = new Date()): Promise<RetentionSummary> {
  const emailCutoff = new Date(now.getTime() - EMAIL_CONTENT_DAYS * DAY)
  const trimmed = await EmailMessage.updateMany(
    { createdAt: { $lt: emailCutoff }, contentRemovedAt: { $exists: false } },
    { $set: { html: REMOVED_HTML, contentRemovedAt: now }, $unset: { text: 1 } },
  )

  const enquiryCutoff = new Date(now.getTime() - ENQUIRY_KEEP_DAYS * DAY)
  const deleted = await Enquiry.deleteMany({ status: 'closed', updatedAt: { $lt: enquiryCutoff } })
  if (deleted.deletedCount) {
    await auditSystem('retention.enquiries', `Deleted ${deleted.deletedCount} enquiries closed more than two years ago, as the privacy policy says`)
  }

  const donorCutoff = new Date(now)
  donorCutoff.setFullYear(donorCutoff.getFullYear() - DONOR_KEEP_YEARS)
  const recent = await Gift.distinct('donor', { date: { $gte: donorCutoff } })
  const planned = await Plan.distinct('donor', { status: { $in: ['active', 'past_due', 'paused'] } })
  const donorsPastRetention = await Donor.countDocuments({
    status: 'active',
    createdAt: { $lt: donorCutoff },
    _id: { $nin: [...recent, ...planned] },
  })
  if (donorsPastRetention) {
    alert('retention', `${donorsPastRetention} donors have no gift in ${DONOR_KEEP_YEARS} years; anonymising them needs a decision from the charity`)
  }

  return { emailsTrimmed: trimmed.modifiedCount, enquiriesDeleted: deleted.deletedCount, donorsPastRetention }
}
