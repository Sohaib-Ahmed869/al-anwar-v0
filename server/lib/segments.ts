import { Types } from 'mongoose'
import { z } from 'zod'
import { DESIGNATION_KEYS, EMAIL_TOPICS, type EmailTopic, type Segment } from '../../shared/domain'
import { Campaign, Donor, Gift } from '../models'

/* ---------------------------------------------------------------------------
   Who an email campaign goes to.

   A Segment (shared/domain.ts) is a handful of optional rules that AND
   together. segmentFilter() turns one into a Mongo filter on Donor, and the
   floor under every segment is the same three things, whatever the rules say:
   an active (not merged) record, a donor who has said yes to email, and an
   address that can actually receive it (the seed and the bank matcher use
   `.invalid` addresses for people we only know by name).

   The gift rules — countries, appeals, designations — look for ONE succeeded
   gift that meets all of them at once, so "zakat to Syria" means a zakat gift
   to Syria, not someone who once gave zakat and once gave to Syria.

   Recipients are snapshotted into the campaign's queue at the moment it
   starts sending, not when it is scheduled, so somebody who unsubscribes on
   the Tuesday is not emailed by a campaign scheduled on the Monday.
--------------------------------------------------------------------------- */

export const zSegment = z
  .object({
    regular: z.boolean().optional(),
    countries: z.array(z.string().max(40)).max(20).optional(),
    appeals: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(50).optional(),
    designations: z.array(z.enum(DESIGNATION_KEYS as [string, ...string[]])).optional(),
    lapsedMonths: z.number().int().min(1).max(120).optional(),
    activeMonths: z.number().int().min(1).max(120).optional(),
    /** cents */
    minTotal: z.number().int().min(0).optional(),
    topic: z.enum(Object.keys(EMAIL_TOPICS) as [EmailTopic, ...EmailTopic[]]).optional(),
  })
  .strip()

const monthsAgo = (n: number) => {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DonorFilter = Record<string, any>

export async function segmentFilter(segment: Segment): Promise<DonorFilter> {
  const and: Record<string, unknown>[] = [
    { status: 'active' },
    { 'preferences.emailOptIn': true },
    { email: { $not: /\.invalid$/i } },
  ]
  if (segment.regular) and.push({ hasActivePlan: true })

  const gift: Record<string, unknown> = {}
  if (segment.countries?.length) gift.country = { $in: segment.countries }
  if (segment.appeals?.length) gift.appeal = { $in: segment.appeals.map((a) => new Types.ObjectId(a)) }
  if (segment.designations?.length) gift.designation = { $in: segment.designations }
  if (Object.keys(gift).length) {
    const donors = await Gift.distinct('donor', { status: 'succeeded', ...gift })
    and.push({ _id: { $in: donors } })
  }

  if (segment.lapsedMonths) and.push({ lastGiftAt: { $lt: monthsAgo(segment.lapsedMonths) } })
  if (segment.activeMonths) and.push({ lastGiftAt: { $gte: monthsAgo(segment.activeMonths) } })
  if (segment.minTotal) and.push({ totalGiven: { $gte: segment.minTotal } })
  if (segment.topic) and.push({ 'preferences.topics': segment.topic })
  return { $and: and } as DonorFilter
}

/** Copy the matching donor ids into the campaign's queue and mark it sending.
 *  Returns null when the campaign was already sending or sent: the update only
 *  matches a draft or scheduled campaign, so two callers at once (the
 *  scheduler on two processes, or a click on "Send now" as the scheduled time
 *  arrives) can never both start it and reset each other's queue. */
export async function startSending(campaignId: Types.ObjectId | string, segment: Segment): Promise<number | null> {
  const ids = (await Donor.find(await segmentFilter(segment)).select('_id').lean()).map((d) => d._id)
  const claimed = await Campaign.updateOne(
    { _id: campaignId, status: { $in: ['draft', 'scheduled'] } },
    {
      $set: {
        queue: ids,
        status: 'sending',
        'stats.recipients': ids.length,
        'stats.sent': 0,
        'stats.failed': 0,
      },
    },
  )
  return claimed.modifiedCount ? ids.length : null
}
