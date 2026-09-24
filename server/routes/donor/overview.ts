import { Router } from 'express'
import { fyOf, fyRange } from '../../../shared/domain'
import { out } from '../../lib/http'
import { Appeal, Fundraiser, Gift, Plan } from '../../models'
import { donorOut, giftOut, me, planOut, statementYears } from './util'

/* ---------------------------------------------------------------------------
   GET /api/me/overview — the donor's home screen in one request.

   A donor opens their account a handful of times a year, usually on a phone,
   usually for one thing. So the first screen answers the likely questions
   without a second round trip: how much this financial year (the tax
   question), is anything wrong (a failing card), what is coming out next,
   and what did it do (impact). Everything is aggregated here, so the phone
   downloads a summary and not the donor's whole history.

   Impact comes from appeals that sell in units — food packs, water wells —
   as floor(given to that appeal / unit price). It is an honest round-down,
   never "up to".

   Totals include any card fees the donor chose to cover: that money was given
   too, and it is what their tax statement adds up to.
--------------------------------------------------------------------------- */

const r = Router()

r.get('/', async (req, res) => {
  const donor = me(req)
  const id = donor._id
  const fy = fyOf(new Date())
  const thisFy = fyRange(fy)
  const lastFy = fyRange(fy - 1)

  const [totals, byAppeal, byFy, plans, recent, fundraisers] = await Promise.all([
    Gift.aggregate<{
      lifetime: number; count: number; thisFy: number; lastFy: number; appeals: unknown[]; countries: (string | null)[]
    }>([
      { $match: { donor: id, status: 'succeeded' } },
      {
        $group: {
          _id: null,
          lifetime: { $sum: { $add: ['$amount', { $ifNull: ['$fee', 0] }] } },
          count: { $sum: 1 },
          thisFy: { $sum: { $cond: [{ $and: [{ $gte: ['$date', thisFy.from] }, { $lt: ['$date', thisFy.to] }] }, { $add: ['$amount', { $ifNull: ['$fee', 0] }] }, 0] } },
          lastFy: { $sum: { $cond: [{ $and: [{ $gte: ['$date', lastFy.from] }, { $lt: ['$date', lastFy.to] }] }, { $add: ['$amount', { $ifNull: ['$fee', 0] }] }, 0] } },
          appeals: { $addToSet: '$appeal' },
          countries: { $addToSet: '$country' },
        },
      },
    ]),
    Gift.aggregate<{ _id: unknown; total: number }>([
      { $match: { donor: id, status: 'succeeded', appeal: { $ne: null } } },
      { $group: { _id: '$appeal', total: { $sum: '$amount' } } },
    ]),
    statementYears(id),
    Plan.find({ donor: id, status: { $in: ['active', 'paused', 'past_due'] } }).sort({ status: 1, nextChargeAt: 1 }).lean(),
    Gift.find({ donor: id }).sort({ date: -1 }).limit(5).lean(),
    Fundraiser.find({ owner: id }).sort({ createdAt: -1 }).lean(),
  ])

  /* impact tiles, and the slugs "Give again" needs */
  const appealIds = [...new Set([...byAppeal.map((a) => String(a._id)), ...recent.map((g) => String(g.appeal ?? ''))].filter(Boolean))]
  const appeals = await Appeal.find({ _id: { $in: appealIds } }).select('title slug unit status image').lean()
  const appealById = new Map(appeals.map((a) => [String(a._id), a]))
  const impact = byAppeal
    .map((b) => {
      const a = appealById.get(String(b._id))
      if (!a?.unit?.price || !a.unit.name) return null
      const n = Math.floor(b.total / a.unit.price)
      if (n < 1) return null
      return { count: n, label: `${n.toLocaleString('en-AU')} ${n === 1 ? a.unit.name : a.unit.plural || `${a.unit.name}s`}`, appealTitle: a.title, appealSlug: a.slug }
    })
    .filter(Boolean)
    .sort((a, b) => b!.count - a!.count)
    .slice(0, 4)

  const t = totals[0]
  const live = fundraisers.filter((f) => f.status === 'live')
  res.json({
    donor: donorOut(donor),
    fy,
    totals: {
      lifetime: t?.lifetime ?? 0,
      thisFy: t?.thisFy ?? 0,
      lastFy: t?.lastFy ?? 0,
      giftCount: t?.count ?? 0,
      appealsSupported: (t?.appeals ?? []).filter(Boolean).length,
      countries: (t?.countries ?? []).filter((c): c is string => Boolean(c)).sort(),
    },
    impact,
    plans: plans.map((p) => out(planOut(p))),
    failing: plans.filter((p) => p.status === 'past_due').map((p) => out(planOut(p))),
    recentGifts: recent.map((g) => ({
      ...out<Record<string, unknown>>(giftOut(g)),
      appealSlug: g.appeal ? appealById.get(String(g.appeal))?.slug : undefined,
      appealOpen: g.appeal ? appealById.get(String(g.appeal))?.status === 'open' : false,
    })),
    statements: byFy,
    fundraisers: {
      count: fundraisers.length,
      live: live.length,
      raised: fundraisers.reduce((s, f) => s + (f.raised ?? 0), 0),
      featured: out(fundraisers.find((f) => f.status === 'live') ?? fundraisers.find((f) => f.status === 'pending') ?? fundraisers[0] ?? null),
    },
  })
})

export default r
