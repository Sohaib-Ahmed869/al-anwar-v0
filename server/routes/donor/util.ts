import type { Request } from 'express'
import type { Types } from 'mongoose'
import { fyOf } from '../../../shared/domain'
import { Appeal, Gift, type DonorDoc } from '../../models'

/* ---------------------------------------------------------------------------
   What a donor is allowed to see of their own records.

   The admin portal and the donor portal read the same documents, but some of
   what staff write on a record is for staff: notes, tags, the payer names the
   bank matcher has learnt, Stripe ids. These shapers are the one place that
   decides what leaves /api/me, so a new staff-only field added to a model
   stays private unless someone chooses to add it here.
--------------------------------------------------------------------------- */

type AnyRec = Record<string, unknown>

/** The signed-in donor. Throws nothing: requireDonor already ran. */
export const me = (req: Request) => req.donor!

export function donorOut(d: DonorDoc) {
  const j = d.toJSON() as AnyRec & { oauth?: { google?: string; facebook?: string } }
  return {
    id: j.id,
    number: j.number,
    firstName: j.firstName,
    lastName: j.lastName,
    email: j.email,
    altEmails: j.altEmails ?? [],
    phone: j.phone,
    address: j.address,
    preferences: j.preferences,
    totalGiven: j.totalGiven,
    giftCount: j.giftCount,
    firstGiftAt: j.firstGiftAt,
    lastGiftAt: j.lastGiftAt,
    hasActivePlan: j.hasActivePlan,
    createdAt: j.createdAt,
    /* which sign-in methods are linked, never the provider ids themselves */
    linked: { google: Boolean(j.oauth?.google), facebook: Boolean(j.oauth?.facebook) },
  }
}

/** A lean gift, minus the office's notes, who typed it in and provider ids. */
export function giftOut<T extends AnyRec>(g: T) {
  const { notes: _n, enteredBy: _e, enteredByName: _en, external: _x, bankImport: _b, donorName: _dn, ...rest } = g
  void _n; void _e; void _en; void _x; void _b; void _dn
  return rest
}

/** A lean plan, minus the Stripe customer and payment-method ids. */
export function planOut<T extends AnyRec & { payment?: AnyRec | null }>(p: T) {
  const { noticeSentFor: _ns, donorName: _dn, ...rest } = p
  void _ns; void _dn
  const pay = p.payment ?? {}
  const { stripeCustomer: _c, stripePaymentMethod: _m, ...payment } = pay as AnyRec
  void _c; void _m
  return { ...rest, payment }
}

export const donorName = (d: { firstName: string; lastName?: string | null }) => `${d.firstName} ${d.lastName ?? ''}`.trim()

/** Every financial year the donor gave in, newest first, with the total a
 *  tax statement for it would show (gifts plus any fees they covered, which
 *  were given too). Worked out in JS with fyOf() rather than in Mongo so it
 *  can never disagree with the statement itself about a gift made late on
 *  30 June. */
export async function statementYears(donor: Types.ObjectId) {
  const gifts = await Gift.find({ donor, status: 'succeeded' }).select('date amount fee').lean()
  const m = new Map<number, { fy: number; total: number; count: number }>()
  for (const g of gifts) {
    const fy = fyOf(g.date)
    const row = m.get(fy) ?? { fy, total: 0, count: 0 }
    row.total += g.amount + (g.fee ?? 0)
    row.count += 1
    m.set(fy, row)
  }
  return [...m.values()].sort((a, b) => b.fy - a.fy)
}

/** Adds each gift's appeal slug and whether it is still open, which the
 *  portal's "Give again" needs to build its link. One query for the page. */
export async function withAppealLinks<T extends { appeal?: unknown }>(gifts: T[]) {
  const ids = [...new Set(gifts.map((g) => (g.appeal ? String(g.appeal) : '')).filter(Boolean))]
  const appeals = ids.length ? await Appeal.find({ _id: { $in: ids } }).select('slug status').lean() : []
  const m = new Map(appeals.map((a) => [String(a._id), a]))
  return gifts.map((g) => {
    const a = g.appeal ? m.get(String(g.appeal)) : undefined
    return { ...g, appealSlug: a?.slug, appealOpen: a?.status === 'open' }
  })
}
