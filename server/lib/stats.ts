import { Types } from 'mongoose'
import { Appeal, Donor, Fundraiser, Gift, Plan } from '../models'

/* ---------------------------------------------------------------------------
   The denormalised totals — a donor's lifetime giving, an appeal's raised
   figure, a fundraiser's progress — recomputed from the gifts themselves
   rather than incremented. Slower by a query, and never wrong: a refund, a
   merge or a bank line re-matched to someone else all come out right without
   anybody having to remember to decrement something.

   Call after anything that creates, moves or changes the status of a gift.
--------------------------------------------------------------------------- */

type Id = Types.ObjectId | string | null | undefined

export async function refreshDonor(id: Id) {
  if (!id) return
  const [agg] = await Gift.aggregate<{ total: number; count: number; first: Date; last: Date }>([
    { $match: { donor: typeof id === 'string' ? new Types.ObjectId(id) : id, status: 'succeeded' } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 }, first: { $min: '$date' }, last: { $max: '$date' } } },
  ])
  const hasActivePlan = Boolean(await Plan.exists({ donor: id, status: { $in: ['active', 'paused', 'past_due'] } }))
  await Donor.updateOne(
    { _id: id },
    {
      $set: {
        totalGiven: agg?.total ?? 0,
        giftCount: agg?.count ?? 0,
        firstGiftAt: agg?.first ?? null,
        lastGiftAt: agg?.last ?? null,
        hasActivePlan,
      },
    },
  )
}

export async function refreshAppeal(id: Id) {
  if (!id) return
  const oid = typeof id === 'string' ? new Types.ObjectId(id) : id
  const [agg] = await Gift.aggregate<{ total: number; donors: unknown[] }>([
    { $match: { appeal: oid, status: 'succeeded' } },
    { $group: { _id: null, total: { $sum: '$amount' }, donors: { $addToSet: '$donor' } } },
  ])
  await Appeal.updateOne({ _id: oid }, { $set: { raised: agg?.total ?? 0, donorCount: agg?.donors.length ?? 0 } })
}

export async function refreshFundraiser(id: Id) {
  if (!id) return
  const oid = typeof id === 'string' ? new Types.ObjectId(id) : id
  const [agg] = await Gift.aggregate<{ total: number; donors: unknown[] }>([
    { $match: { fundraiser: oid, status: 'succeeded' } },
    { $group: { _id: null, total: { $sum: '$amount' }, donors: { $addToSet: '$donor' } } },
  ])
  await Fundraiser.updateOne({ _id: oid }, { $set: { raised: agg?.total ?? 0, donorCount: agg?.donors.length ?? 0 } })
}

/** Everything a gift touches. */
export async function refreshForGift(g: { donor?: Id; appeal?: Id; fundraiser?: Id }) {
  await Promise.all([refreshDonor(g.donor), refreshAppeal(g.appeal), refreshFundraiser(g.fundraiser)])
}
