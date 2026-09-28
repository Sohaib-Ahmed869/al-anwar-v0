import { Router, type Request } from 'express'
import { can, type Permission, type Role } from '../../../shared/access'
import { FREQUENCIES, fyOf, fyRange, type Frequency } from '../../../shared/domain'
import { formatMoney } from '../../../shared/money'
import { requireStaff } from '../../lib/auth'
import { out } from '../../lib/http'
import { Appeal, BankImport, Donor, Enquiry, Fundraiser, Gift, Obligation, Plan } from '../../models'
import { findDuplicates } from './donors'

/* ---------------------------------------------------------------------------
   /api/admin/dashboard — the numbers the office opens the day with, and the
   short list of things waiting on someone.

   Comparisons are always like for like: "this month" is measured against the
   same number of days of last month, and the financial year to date against
   last year to the same date, so the 3rd of the month never looks like a
   collapse.

   Month buckets are computed by MongoDB in the server's own time zone, which
   is the zone fyOf() and fyRange() use, so a gift at 11pm on 30 June lands in
   the same year on the chart as on the tax statement.

   The "needs attention" list only carries what the signed-in role can act on:
   a fundraising officer is not shown bank lines they cannot open.
--------------------------------------------------------------------------- */

const r = Router()

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone
const DAY = 86_400_000

const roleCan = (req: Request, p: Permission) => can(req.staff!.role as Role, p)

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

async function sumGifts(from: Date, to: Date) {
  const [row] = await Gift.aggregate<{ total: number; count: number; donors: unknown[] }>([
    { $match: { status: 'succeeded', date: { $gte: from, $lt: to } } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 }, donors: { $addToSet: '$donor' } } },
  ])
  return { total: row?.total ?? 0, count: row?.count ?? 0, donors: row?.donors.length ?? 0 }
}

const delta = (now: number, before: number) => (before > 0 ? (now - before) / before : null)

function names(list: string[], total: number) {
  if (!list.length) return undefined
  const more = total - list.length
  return more > 0 ? `${list.join(', ')} and ${more} more` : list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0]
}

/* ---------- the shell's badges: cheap counts, polled every minute ---------- */

async function bankReviewCount() {
  const [row] = await BankImport.aggregate<{ n: number }>([
    { $match: { status: 'review' } },
    { $unwind: '$lines' },
    { $match: { 'lines.status': { $in: ['review', 'unmatched'] } } },
    { $count: 'n' },
  ])
  return row?.n ?? 0
}

r.get('/badges', async (req, res) => {
  const tasks: Record<string, Promise<number>> = {}
  if (roleCan(req, 'donors.merge')) tasks.duplicates = findDuplicates().then((p) => p.length)
  if (roleCan(req, 'plans.manage')) tasks.failedPlans = Plan.countDocuments({ status: 'past_due' })
  if (roleCan(req, 'enquiries.manage')) tasks.enquiries = Enquiry.countDocuments({ status: 'new' })
  if (roleCan(req, 'fundraisers.approve')) tasks.fundraisers = Fundraiser.countDocuments({ status: 'pending' })
  if (roleCan(req, 'bank.import')) tasks.bank = bankReviewCount()
  const keys = Object.keys(tasks)
  const values = await Promise.all(Object.values(tasks))
  res.json(Object.fromEntries(keys.map((k, i) => [k, values[i]])))
})

/* ---------- the dashboard ---------- */

r.get('/', requireStaff('dashboard.view'), async (req, res) => {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  /* the same stretch of last month, clamped: 31 March compares with all of February */
  const prevSame = new Date(Math.min(prevStart.getTime() + (now.getTime() - monthStart.getTime()), monthStart.getTime()))
  const fy = fyOf(now)
  const fyFrom = fyRange(fy).from
  const lastFyFrom = fyRange(fy - 1).from
  const lastFySame = new Date(now)
  lastFySame.setFullYear(now.getFullYear() - 1)
  const seriesFrom = new Date(now.getFullYear(), now.getMonth() - 23, 1)
  const yearAgo = new Date(now.getTime() - 365 * DAY)

  const [thisMonth, lastMonth, fyToDate, lastFyToDate, activePlans, newThis, newPrev, lapsed, monthly, newByMonth, regularByMonth] = await Promise.all([
    sumGifts(monthStart, new Date(now.getTime() + 1)),
    sumGifts(prevStart, prevSame),
    sumGifts(fyFrom, new Date(now.getTime() + 1)),
    sumGifts(lastFyFrom, lastFySame),
    Plan.find({ status: 'active' }).select('amount frequency').lean(),
    Donor.countDocuments({ status: { $ne: 'merged' }, firstGiftAt: { $gte: monthStart } }),
    Donor.countDocuments({ status: { $ne: 'merged' }, firstGiftAt: { $gte: prevStart, $lt: prevSame } }),
    Donor.countDocuments({ status: { $ne: 'merged' }, giftCount: { $gt: 0 }, lastGiftAt: { $lt: yearAgo } }),
    Gift.aggregate<{ _id: { m: string; method: string; designation: string }; total: number; count: number }>([
      { $match: { status: 'succeeded', date: { $gte: seriesFrom } } },
      {
        $group: {
          _id: { m: { $dateToString: { format: '%Y-%m', date: '$date', timezone: TZ } }, method: '$method', designation: '$designation' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]),
    Donor.aggregate<{ _id: string; n: number }>([
      { $match: { status: { $ne: 'merged' }, firstGiftAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$firstGiftAt', timezone: TZ } }, n: { $sum: 1 } } },
    ]),
    Gift.aggregate<{ _id: string; total: number }>([
      { $match: { status: 'succeeded', source: 'recurring', date: { $gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date', timezone: TZ } }, total: { $sum: '$amount' } } },
    ]),
  ])

  /* 24 months, zero-filled, oldest first */
  const months: { month: string; total: number; count: number; byMethod: Record<string, number>; byDesignation: Record<string, number> }[] = []
  for (let i = 23; i >= 0; i--) {
    months.push({ month: monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)), total: 0, count: 0, byMethod: {}, byDesignation: {} })
  }
  const byMonth = new Map(months.map((m) => [m.month, m]))
  for (const row of monthly) {
    const m = byMonth.get(row._id.m)
    if (!m) continue
    m.total += row.total
    m.count += row.count
    m.byMethod[row._id.method] = (m.byMethod[row._id.method] ?? 0) + row.total
    m.byDesignation[row._id.designation] = (m.byDesignation[row._id.designation] ?? 0) + row.total
  }
  const last12 = months.slice(-12)
  const newMap = new Map(newByMonth.map((x) => [x._id, x.n]))
  const regMap = new Map(regularByMonth.map((x) => [x._id, x.total]))

  const regularMonthly = activePlans.reduce((s, p) => s + Math.round((p.amount * FREQUENCIES[p.frequency as Frequency].perYear) / 12), 0)
  const returning = Math.max(0, thisMonth.donors - newThis)
  const avg = thisMonth.count ? Math.round(thisMonth.total / thisMonth.count) : 0
  const avgPrev = lastMonth.count ? Math.round(lastMonth.total / lastMonth.count) : 0

  /* ---------- appeals, designations, recent gifts ---------- */
  const [openAppeals, appealRecent, designationFy, recent] = await Promise.all([
    Appeal.find({ status: 'open' }).select('title slug target raised donorCount closesAt country').sort({ raised: -1 }).lean(),
    Gift.aggregate<{ _id: unknown; total: number }>([
      { $match: { status: 'succeeded', date: { $gte: new Date(now.getTime() - 30 * DAY) }, appeal: { $ne: null } } },
      { $group: { _id: '$appeal', total: { $sum: '$amount' } } },
    ]),
    Gift.aggregate<{ _id: string; total: number; count: number }>([
      { $match: { status: 'succeeded', date: { $gte: fyFrom } } },
      { $group: { _id: '$designation', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    roleCan(req, 'gifts.read')
      ? Gift.find({ status: 'succeeded', date: { $lte: now } })
          .sort({ date: -1, _id: -1 })
          .limit(8)
          .select('number donor donorName amount designation method date appealTitle anonymous source')
          .lean()
      : Promise.resolve([]),
  ])
  const recentByAppeal = new Map(appealRecent.map((x) => [String(x._id), x.total]))

  res.json({
    generatedAt: now.toISOString(),
    fy,
    kpis: {
      raisedThisMonth: { value: thisMonth.total, previous: lastMonth.total, delta: delta(thisMonth.total, lastMonth.total), gifts: thisMonth.count },
      fyToDate: { value: fyToDate.total, previous: lastFyToDate.total, delta: delta(fyToDate.total, lastFyToDate.total) },
      regular: { monthly: regularMonthly, active: activePlans.length },
      newDonors: { value: newThis, previous: newPrev, delta: delta(newThis, newPrev) },
      returningDonors: { value: returning },
      lapsedDonors: { value: lapsed },
      averageGift: { value: avg, previous: avgPrev, delta: delta(avg, avgPrev) },
    },
    sparks: {
      raised: last12.map((m) => m.total),
      newDonors: last12.map((m) => newMap.get(m.month) ?? 0),
      regular: last12.map((m) => regMap.get(m.month) ?? 0),
      averageGift: last12.map((m) => (m.count ? Math.round(m.total / m.count) : 0)),
    },
    series: months,
    appeals: openAppeals.map((a) => ({
      id: String(a._id),
      title: a.title,
      country: a.country,
      target: a.target ?? 0,
      raised: a.raised ?? 0,
      donorCount: a.donorCount ?? 0,
      closesAt: a.closesAt ? a.closesAt.toISOString() : null,
      last30: recentByAppeal.get(String(a._id)) ?? 0,
    })),
    designations: designationFy.map((d) => ({ designation: d._id, total: d.total, count: d.count })),
    recentGifts: out(recent),
    attention: await attention(req, now),
  })
})

type AttentionItem = {
  key: string
  tone: 'red' | 'amber' | 'teal' | 'neutral'
  count: number
  title: string
  detail?: string
  to: string
  action: string
}

async function attention(req: Request, now: Date): Promise<AttentionItem[]> {
  const items: Promise<AttentionItem | null>[] = []

  if (roleCan(req, 'plans.manage')) {
    items.push(
      (async () => {
        const filter = { status: 'past_due' as const }
        const [count, some] = await Promise.all([
          Plan.countDocuments(filter),
          Plan.find(filter).sort({ 'failure.firstFailedAt': 1 }).limit(3).select('donorName amount').lean(),
        ])
        if (!count) return null
        return {
          key: 'failedPlans', tone: 'red', count,
          title: count === 1 ? 'A regular donation has a failed payment' : `${count} regular donations have failed payments`,
          detail: names(some.map((p) => p.donorName), count),
          to: '/admin/plans?status=past_due', action: 'Review',
        }
      })(),
    )
  }

  if (roleCan(req, 'bank.import')) {
    items.push(
      (async () => {
        const imports = await BankImport.aggregate<{ _id: unknown; filename: string; n: number; total: number }>([
          { $match: { status: 'review' } },
          { $unwind: '$lines' },
          { $match: { 'lines.status': { $in: ['review', 'unmatched'] } } },
          { $group: { _id: '$_id', filename: { $first: '$filename' }, n: { $sum: 1 }, total: { $sum: '$lines.amount' } } },
          { $sort: { n: -1 } },
        ])
        const count = imports.reduce((s, i) => s + i.n, 0)
        if (!count) return null
        const total = imports.reduce((s, i) => s + i.total, 0)
        return {
          key: 'bank', tone: 'amber', count,
          title: count === 1 ? 'A bank line needs matching' : `${count} bank lines need matching`,
          detail: `${formatMoney(total)} waiting in ${imports.length === 1 ? imports[0]!.filename : `${imports.length} statements`}`,
          to: imports.length === 1 ? `/admin/bank/${String(imports[0]!._id)}` : '/admin/bank', action: 'Match',
        }
      })(),
    )
    items.push(
      (async () => {
        /* transfers promised more than a fortnight ago that no statement has paid */
        const filter = { status: 'pending' as const, method: 'bank' as const, date: { $lt: new Date(now.getTime() - 14 * DAY) } }
        const [count, sum] = await Promise.all([
          Gift.countDocuments(filter),
          Gift.aggregate<{ total: number }>([{ $match: filter }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
        ])
        if (!count) return null
        return {
          key: 'pledges', tone: 'neutral', count,
          title: count === 1 ? 'A bank transfer promised over two weeks ago has not arrived' : `${count} bank transfers promised over two weeks ago have not arrived`,
          detail: `${formatMoney(sum[0]?.total ?? 0)} outstanding`,
          to: '/admin/gifts?status=pending&method=bank', action: 'Follow up',
        }
      })(),
    )
  }

  if (roleCan(req, 'fundraisers.approve')) {
    items.push(
      (async () => {
        const [count, some] = await Promise.all([
          Fundraiser.countDocuments({ status: 'pending' }),
          Fundraiser.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(2).select('title ownerName').lean(),
        ])
        if (!count) return null
        return {
          key: 'fundraisers', tone: 'amber', count,
          title: count === 1 ? 'A supporter page is waiting for approval' : `${count} supporter pages are waiting for approval`,
          detail: names(some.map((f) => `“${f.title}”`), count),
          to: '/admin/fundraisers?status=pending', action: 'Approve',
        }
      })(),
    )
  }

  if (roleCan(req, 'enquiries.manage')) {
    items.push(
      (async () => {
        const [count, oldest] = await Promise.all([
          Enquiry.countDocuments({ status: 'new' }),
          Enquiry.findOne({ status: 'new' }).sort({ createdAt: 1 }).select('createdAt name').lean(),
        ])
        if (!count) return null
        const days = oldest ? Math.floor((now.getTime() - oldest.createdAt.getTime()) / DAY) : 0
        return {
          key: 'enquiries', tone: days >= 3 ? 'amber' : 'teal', count,
          title: count === 1 ? 'A new enquiry has not been answered' : `${count} new enquiries have not been answered`,
          detail: days >= 1 ? `The oldest, from ${oldest!.name}, came in ${days === 1 ? 'yesterday' : `${days} days ago`}` : 'All came in today',
          to: '/admin/enquiries?status=new', action: 'Reply',
        }
      })(),
    )
  }

  if (roleCan(req, 'compliance.write')) {
    items.push(
      (async () => {
        const list = await Obligation.find({ status: 'upcoming', dueDate: { $lt: new Date(now.getTime() + 7 * DAY) } })
          .sort({ dueDate: 1 })
          .select('title dueDate')
          .lean()
        const overdue = list.filter((o) => o.dueDate < now)
        if (!overdue.length) return null
        return {
          key: 'overdue', tone: 'red', count: overdue.length,
          title: overdue.length === 1 ? 'A compliance obligation is overdue' : `${overdue.length} compliance obligations are overdue`,
          detail: names(overdue.slice(0, 2).map((o) => o.title), overdue.length),
          to: '/compliance/calendar', action: 'Open calendar',
        }
      })(),
    )
    items.push(
      (async () => {
        const soon = await Obligation.find({ status: 'upcoming', dueDate: { $gte: now, $lt: new Date(now.getTime() + 7 * DAY) } })
          .sort({ dueDate: 1 })
          .select('title dueDate')
          .lean()
        if (!soon.length) return null
        return {
          key: 'dueSoon', tone: 'amber', count: soon.length,
          title: soon.length === 1 ? 'A compliance obligation is due this week' : `${soon.length} compliance obligations are due this week`,
          detail: names(soon.slice(0, 2).map((o) => o.title), soon.length),
          to: '/compliance/calendar', action: 'Open calendar',
        }
      })(),
    )
  }

  if (roleCan(req, 'donors.merge')) {
    items.push(
      (async () => {
        const pairs = await findDuplicates()
        const likely = pairs.filter((p) => p.score >= 0.75).length
        if (!pairs.length) return null
        return {
          key: 'duplicates', tone: 'neutral', count: pairs.length,
          title: pairs.length === 1 ? 'A donor may be on file twice' : `${pairs.length} donors may be on file twice`,
          detail: likely ? `${likely} ${likely === 1 ? 'looks' : 'look'} almost certain` : 'Worth a quick look',
          to: '/admin/donors/duplicates', action: 'Compare',
        }
      })(),
    )
  }

  const order = { red: 0, amber: 1, teal: 2, neutral: 3 }
  return (await Promise.all(items)).filter((x): x is AttentionItem => Boolean(x)).sort((a, b) => order[a.tone] - order[b.tone])
}

export default r
