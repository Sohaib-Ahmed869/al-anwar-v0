import { Router, type Request } from 'express'
import { addMonths, format } from 'date-fns'
import { z } from 'zod'
import { COUNTRIES, DESIGNATIONS, DESIGNATION_KEYS, METHODS, METHOD_KEYS, fyOf, fyRange, type Designation, type Method } from '../../../shared/domain'
import { centsToDecimal, formatMoney } from '../../../shared/money'
import { Donor, Gift, SettingsModel } from '../../models'
import { audit } from '../../lib/audit'
import { requireStaff } from '../../lib/auth'
import { sendCsv, type CsvRow } from '../../lib/csv'
import { badRequest, out, paging, parse } from '../../lib/http'

/* ---------------------------------------------------------------------------
   /api/admin/reports — income, receipts, donor retention and the Xero file.

   Everything is aggregated here, not in the browser: a financial year is
   thousands of gifts, and the screen only ever needs the totals. Only
   succeeded gifts count as income; a pending bank pledge is a promise, not
   money, and a refunded gift is not income either.

   Dates: `from` is inclusive and `to` exclusive (yyyy-mm-dd), the same
   convention as the DateRangePicker. With neither, the report covers this
   financial year (July to June) so far. Months are Sydney months, so a gift
   at 9am on 1 July lands in July.

   Xero: the export is Xero's "precoded" bank statement CSV. The bookkeeper
   imports it against the bank account and every line arrives already coded
   to an income account by designation (zakat, sadaqah… kept apart as the
   law and the donors expect) and tracked by appeal. The account codes are the
   charity's own chart of accounts, so they are a setting, not code.
--------------------------------------------------------------------------- */

const r = Router()
r.use(requireStaff('reports.read'))
const exporting = requireStaff('reports.export')

const TZ = 'Australia/Sydney'

/* A gift taken while payments were simulated (staging, development) moved no
   money: it is not income, its receipt is not a tax receipt, and it must never
   reach the bookkeeper's Xero file. Every report and export below leaves it
   out. `$ne: true` also matches gifts saved before the field existed. */
const REAL = { simulated: { $ne: true } }

function range(q: Request['query']) {
  const parseDay = (v: unknown) => {
    const s = String(v ?? '')
    if (!s) return null
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw badRequest('Dates are written yyyy-mm-dd.')
    return new Date(`${s}T00:00:00`)
  }
  const now = new Date()
  const from = parseDay(q.from) ?? fyRange(fyOf(now)).from
  const to = parseDay(q.to) ?? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  if (from >= to) throw badRequest('The start date must be before the end date.')
  return { from, to }
}

const monthKey = { $dateToString: { format: '%Y-%m', date: '$date', timezone: TZ } }
const monthLabel = (k: string) => format(new Date(`${k}-01T12:00:00`), 'MMM yyyy')
const lastDay = (to: Date) => format(new Date(to.getTime() - 86_400_000), 'yyyy-MM-dd')
const rangeLabel = (from: Date, to: Date) => `${format(from, 'd MMM yyyy')} – ${format(new Date(to.getTime() - 86_400_000), 'd MMM yyyy')}`

/** Every month the range touches, so a chart has no missing columns. */
function monthsIn(from: Date, to: Date): string[] {
  const out: string[] = []
  let d = new Date(from.getFullYear(), from.getMonth(), 1)
  while (d < to) {
    out.push(format(d, 'yyyy-MM'))
    d = addMonths(d, 1)
  }
  return out
}

/* ======================= income ======================= */

const GROUPS = ['appeal', 'designation', 'country', 'method', 'month', 'source'] as const
type Group = (typeof GROUPS)[number]

const SOURCE_LABELS: Record<string, string> = {
  online: 'Website',
  recurring: 'Regular giving',
  bank: 'Bank statement import',
  offline: 'Entered by staff (cash, cheque, events)',
}

function label(group: Group, key: string | null, title?: string | null) {
  if (group === 'appeal') return key ? (title ?? 'Appeal') : 'Where most needed (no appeal)'
  if (group === 'designation') return DESIGNATIONS[key as Designation]?.label ?? 'General'
  if (group === 'country') return key ? (COUNTRIES[key] ?? key) : 'No country (general fund)'
  if (group === 'method') return METHODS[key as Method]?.label ?? String(key)
  if (group === 'month') return key ? monthLabel(key) : '—'
  return SOURCE_LABELS[key ?? ''] ?? String(key)
}

async function income(q: Request['query']) {
  const { from, to } = range(q)
  const group = (GROUPS as readonly string[]).includes(String(q.group)) ? (q.group as Group) : 'appeal'
  const match = { status: 'succeeded', ...REAL, date: { $gte: from, $lt: to } }
  const groupKey = group === 'month' ? monthKey : `$${group}`
  const [rows, [totals], series] = await Promise.all([
    Gift.aggregate<{ _id: string | null; title?: string; amount: number; fees: number; count: number; donors: number }>([
      { $match: match },
      { $group: { _id: groupKey, title: { $first: '$appealTitle' }, amount: { $sum: '$amount' }, fees: { $sum: '$fee' }, count: { $sum: 1 }, donors: { $addToSet: '$donor' } } },
      { $project: { title: 1, amount: 1, fees: 1, count: 1, donors: { $size: '$donors' } } },
    ]),
    Gift.aggregate<{ amount: number; fees: number; count: number; donors: number }>([
      { $match: match },
      { $group: { _id: null, amount: { $sum: '$amount' }, fees: { $sum: '$fee' }, count: { $sum: 1 }, donors: { $addToSet: '$donor' } } },
      { $project: { amount: 1, fees: 1, count: 1, donors: { $size: '$donors' } } },
    ]),
    Gift.aggregate<{ _id: string; amount: number; count: number }>([
      { $match: match },
      { $group: { _id: monthKey, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ])
  const byMonth = new Map(series.map((s) => [s._id, s]))
  const list = rows
    .map((x) => ({ key: x._id == null ? 'none' : String(x._id), label: label(group, x._id == null ? null : String(x._id), x.title), amount: x.amount, fees: x.fees, count: x.count, donors: x.donors }))
    .sort((a, b) => (group === 'month' ? a.key.localeCompare(b.key) : b.amount - a.amount))
  return {
    from: format(from, 'yyyy-MM-dd'),
    to: format(to, 'yyyy-MM-dd'),
    group,
    rows: list,
    totals: { amount: totals?.amount ?? 0, fees: totals?.fees ?? 0, count: totals?.count ?? 0, donors: totals?.donors ?? 0 },
    series: monthsIn(from, to).map((m) => ({ month: m, label: format(new Date(`${m}-01T12:00:00`), 'MMM yy'), amount: byMonth.get(m)?.amount ?? 0, count: byMonth.get(m)?.count ?? 0 })),
  }
}

r.get('/income', async (req, res) => {
  res.json(await income(req.query))
})

const GROUP_HEADINGS: Record<Group, string> = {
  appeal: 'Appeal', designation: 'Designation', country: 'Country', method: 'Payment method', month: 'Month', source: 'How it came in',
}

r.get('/income.csv', exporting, async (req, res) => {
  const rep = await income(req.query)
  const { from, to } = range(req.query)
  const rows: CsvRow[] = [
    [GROUP_HEADINGS[rep.group], 'Amount (AUD)', 'Operating costs contributions (AUD)', 'Donations', 'Donors'],
    ...rep.rows.map((x) => [x.label, centsToDecimal(x.amount), centsToDecimal(x.fees), x.count, x.donors]),
    ['Total', centsToDecimal(rep.totals.amount), centsToDecimal(rep.totals.fees), rep.totals.count, rep.totals.donors],
  ]
  await audit(req, 'report.export', `Exported income by ${GROUP_HEADINGS[rep.group].toLowerCase()} for ${rangeLabel(from, to)} (${formatMoney(rep.totals.amount)})`, { type: 'report', label: 'income' })
  sendCsv(res, `income-by-${rep.group}-${rep.from}-to-${lastDay(to)}.csv`, rows)
})

/* ======================= receipts issued ======================= */

async function receipts(q: Request['query'], all = false) {
  const { from, to } = range(q)
  const match = { 'receipt.number': { $exists: true, $ne: null }, ...REAL, 'receipt.issuedAt': { $gte: from, $lt: to } }
  const { page, pageSize, skip } = paging(q, { pageSize: 25, max: 100 })
  const [[sum], byMonth, items, total] = await Promise.all([
    Gift.aggregate<{ count: number; total: number; emailed: number; resent: number; refunded: number }>([
      { $match: match },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          total: { $sum: '$amount' },
          emailed: { $sum: { $cond: [{ $ifNull: ['$receipt.emailedAt', false] }, 1, 0] } },
          resent: { $sum: { $ifNull: ['$receipt.resent', 0] } },
          refunded: { $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, 1, 0] } },
        },
      },
    ]),
    Gift.aggregate<{ _id: string; count: number; amount: number }>([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$receipt.issuedAt', timezone: TZ } }, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
    Gift.find(match)
      .sort({ 'receipt.issuedAt': -1, _id: -1 })
      .skip(all ? 0 : skip)
      .limit(all ? 100_000 : pageSize)
      .select('number donor donorName amount fee designation method status date receipt appealTitle')
      .lean(),
    Gift.countDocuments(match),
  ])
  const m = new Map(byMonth.map((x) => [x._id, x]))
  return {
    from, to,
    count: sum?.count ?? 0,
    total: sum?.total ?? 0,
    emailed: sum?.emailed ?? 0,
    resent: sum?.resent ?? 0,
    refunded: sum?.refunded ?? 0,
    byMonth: monthsIn(from, to).map((k) => ({ month: k, label: format(new Date(`${k}-01T12:00:00`), 'MMM yy'), count: m.get(k)?.count ?? 0, amount: m.get(k)?.amount ?? 0 })),
    items: { items: out<Record<string, unknown>[]>(items), total, page, pageSize },
  }
}

r.get('/receipts', async (req, res) => {
  const rep = await receipts(req.query)
  res.json({ ...rep, from: format(rep.from, 'yyyy-MM-dd'), to: format(rep.to, 'yyyy-MM-dd') })
})

r.get('/receipts.csv', exporting, async (req, res) => {
  const rep = await receipts(req.query, true)
  type Row = { number: string; donorName: string; amount: number; designation: Designation; method: Method; status: string; date: string; appealTitle?: string; receipt: { number: string; issuedAt: string; emailedAt?: string; resent?: number } }
  const rows: CsvRow[] = [
    ['Receipt number', 'Issued', 'Donation', 'Donation date', 'Donor', 'Amount (AUD)', 'Designation', 'Appeal', 'Method', 'Status', 'Emailed', 'Times re-sent'],
    ...(rep.items.items as unknown as Row[]).map((g) => [
      g.receipt.number,
      format(new Date(g.receipt.issuedAt), 'dd/MM/yyyy'),
      g.number,
      format(new Date(g.date), 'dd/MM/yyyy'),
      g.donorName,
      centsToDecimal(g.amount),
      DESIGNATIONS[g.designation]?.label ?? g.designation,
      g.appealTitle ?? '',
      METHODS[g.method]?.label ?? g.method,
      g.status === 'refunded' ? 'Refunded' : 'Paid',
      g.receipt.emailedAt ? format(new Date(g.receipt.emailedAt), 'dd/MM/yyyy') : '',
      g.receipt.resent ?? 0,
    ]),
  ]
  await audit(req, 'report.export', `Exported ${rep.count} receipts issued ${rangeLabel(rep.from, rep.to)} (${formatMoney(rep.total)})`, { type: 'report', label: 'receipts' })
  sendCsv(res, `receipts-${format(rep.from, 'yyyy-MM-dd')}-to-${lastDay(rep.to)}.csv`, rows)
})

/* ======================= donors: new, returning, lapsed =======================
   Per month in the range, counting each donor once a month:
     new          their first gift ever was this month
     returning    gave this month, and also in the 12 months before
     reactivated  gave this month after more than 12 months without giving
     lapsed       their last gift was 12 months ago and nothing since —
                  the month a regular supporter quietly stops
   Worked out from every donor's giving months in one aggregation. */

r.get('/donors', async (req, res) => {
  const { from, to } = range(req.query)
  const months = monthsIn(from, to)
  const idx = (k: string) => Number(k.slice(0, 4)) * 12 + Number(k.slice(5, 7)) - 1
  const first = idx(months[0]!)
  const last = idx(months[months.length - 1]!)
  const nowIdx = idx(format(new Date(), 'yyyy-MM'))
  const blank = () => ({ new: 0, returning: 0, reactivated: 0, lapsed: 0 })
  const per = new Map(months.map((m) => [idx(m), blank()]))

  const [giving, byStateRaw] = await Promise.all([
    Gift.aggregate<{ _id: unknown; months: string[] }>([
      { $match: { status: 'succeeded', ...REAL, date: { $lt: to } } },
      { $group: { _id: '$donor', months: { $addToSet: monthKey } } },
    ]),
    Gift.aggregate<{ _id: string | null; donors: number; amount: number }>([
      { $match: { status: 'succeeded', ...REAL, date: { $gte: from, $lt: to } } },
      { $group: { _id: '$donor', amount: { $sum: '$amount' } } },
      { $lookup: { from: Donor.collection.name, localField: '_id', foreignField: '_id', as: 'd', pipeline: [{ $project: { 'address.state': 1 } }] } },
      { $group: { _id: { $first: '$d.address.state' }, donors: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
  ])

  let active = 0
  for (const g of giving) {
    const ms = g.months.map(idx).sort((a, b) => a - b)
    let counted = false
    ms.forEach((m, i) => {
      const prev = ms[i - 1]
      const next = ms[i + 1]
      if (m >= first && m <= last) {
        const row = per.get(m)!
        if (prev === undefined) row.new++
        else if (m - prev > 12) row.reactivated++
        else row.returning++
        counted = true
      }
      const lapse = m + 13
      if ((next === undefined || next >= lapse) && lapse >= first && lapse <= last && lapse <= nowIdx) per.get(lapse)!.lapsed++
    })
    if (counted) active++
  }

  const monthsOut = months.map((k) => ({ month: k, label: format(new Date(`${k}-01T12:00:00`), 'MMM yy'), ...per.get(idx(k))! }))
  const totals = monthsOut.reduce((t, m) => ({ new: t.new + m.new, returning: t.returning + m.returning, reactivated: t.reactivated + m.reactivated, lapsed: t.lapsed + m.lapsed }), blank())
  const STATES: Record<string, string> = { NSW: 'New South Wales', VIC: 'Victoria', QLD: 'Queensland', WA: 'Western Australia', SA: 'South Australia', TAS: 'Tasmania', ACT: 'Australian Capital Territory', NT: 'Northern Territory' }
  res.json({
    from: format(from, 'yyyy-MM-dd'),
    to: format(to, 'yyyy-MM-dd'),
    active,
    totals,
    months: monthsOut,
    byState: byStateRaw
      .map((s) => ({ key: s._id ?? 'none', label: s._id ? (STATES[s._id] ?? s._id) : 'No address recorded', donors: s.donors, amount: s.amount }))
      .sort((a, b) => b.amount - a.amount),
  })
})

/* ======================= Xero ======================= */

type XeroSettings = { accounts: Record<Designation, string>; feesAccount: string; trackingName: string; taxType: string }
const XERO_DEFAULTS: XeroSettings = {
  accounts: { general: '200', sadaqah: '201', zakat: '202', zakat_fitr: '203', lillah: '204', kaffarah: '205', fidyah: '206' },
  feesAccount: '404',
  trackingName: 'Appeal',
  taxType: 'GST Free Income',
}

async function xeroSettings(): Promise<XeroSettings> {
  const row = await SettingsModel.findById('xero').lean()
  const d = (row?.data ?? {}) as Partial<XeroSettings>
  return { ...XERO_DEFAULTS, ...d, accounts: { ...XERO_DEFAULTS.accounts, ...(d.accounts ?? {}) } }
}

r.get('/xero-settings', async (_req, res) => {
  res.json(await xeroSettings())
})

const zCode = z.string().trim().max(20, 'Keep account codes short').regex(/^[\w.-]*$/, 'Letters, numbers, dots and dashes only')
const zXero = z.object({
  accounts: z.object(Object.fromEntries(DESIGNATION_KEYS.map((k) => [k, zCode.min(1, 'Enter an account code')])) as Record<Designation, typeof zCode>),
  feesAccount: zCode.min(1, 'Enter an account code'),
  trackingName: z.string().trim().max(40).default('Appeal'),
})

r.put('/xero-settings', exporting, async (req, res) => {
  const body = parse(zXero, req.body)
  const next = { ...(await xeroSettings()), ...body }
  await SettingsModel.updateOne({ _id: 'xero' }, { $set: { data: next } }, { upsert: true })
  await audit(req, 'settings.xero', `Changed the Xero account codes (${DESIGNATION_KEYS.map((k) => `${DESIGNATIONS[k].short} ${next.accounts[k]}`).join(', ')}; fees ${next.feesAccount})`, { type: 'settings', label: 'xero' })
  res.json(next)
})

const XERO_HEADER = ['*Date', '*Amount', 'Payee', 'Description', 'Reference', 'Check Number', 'Account Code', 'Tax Type', 'Tracking Name 1', 'Tracking Option 1']

async function xeroRows(q: Request['query'], limit?: number) {
  const { from, to } = range(q)
  const s = await xeroSettings()
  const methods = String(q.methods ?? '')
    .split(',')
    .filter((m): m is Method => (METHOD_KEYS as string[]).includes(m))
  const match: Record<string, unknown> = { status: 'succeeded', ...REAL, date: { $gte: from, $lt: to } }
  if (methods.length) match.method = { $in: methods }
  const [gifts, [sum], byAccount] = await Promise.all([
    Gift.find(match)
      .sort({ date: 1, _id: 1 })
      .limit(limit ?? 200_000)
      .select('number donorName amount fee designation method date reference receipt appealTitle')
      .lean(),
    Gift.aggregate<{ gifts: number; amount: number; fees: number; feeLines: number }>([
      { $match: match },
      { $group: { _id: null, gifts: { $sum: 1 }, amount: { $sum: '$amount' }, fees: { $sum: '$fee' }, feeLines: { $sum: { $cond: [{ $gt: ['$fee', 0] }, 1, 0] } } } },
    ]),
    Gift.aggregate<{ _id: Designation; amount: number; count: number }>([
      { $match: match },
      { $group: { _id: '$designation', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ])
  const rows: CsvRow[] = []
  for (const g of gifts) {
    const des = (g.designation ?? 'general') as Designation
    const date = format(g.date, 'dd/MM/yyyy')
    const ref = g.receipt?.number ?? g.number
    const tracking = g.appealTitle ?? 'General fund'
    rows.push([date, centsToDecimal(g.amount), g.donorName, `${DESIGNATIONS[des].label} - ${tracking} - ${g.number} (${METHODS[g.method as Method]?.label ?? g.method})`, ref, '', s.accounts[des], s.taxType, s.trackingName, tracking])
    /* the operating-costs contribution a donor added (a covered card fee, before
       28 September 2026) arrived with the gift; it is coded to the
       operating-costs account, apart from the donation's fund */
    if ((g.fee ?? 0) > 0) rows.push([date, centsToDecimal(g.fee!), g.donorName, `Operating costs contribution - ${g.number}`, ref, '', s.feesAccount, s.taxType, s.trackingName, tracking])
  }
  return {
    from, to, rows,
    totals: { gifts: sum?.gifts ?? 0, lines: (sum?.gifts ?? 0) + (sum?.feeLines ?? 0), amount: sum?.amount ?? 0, fees: sum?.fees ?? 0 },
    byAccount: DESIGNATION_KEYS.map((k) => {
      const x = byAccount.find((b) => b._id === k)
      return { designation: k, label: DESIGNATIONS[k].label, code: s.accounts[k], amount: x?.amount ?? 0, count: x?.count ?? 0 }
    }).filter((x) => x.count > 0),
  }
}

r.get('/xero/preview', async (req, res) => {
  const x = await xeroRows(req.query, 10)
  res.json({
    from: format(x.from, 'yyyy-MM-dd'),
    to: format(x.to, 'yyyy-MM-dd'),
    header: XERO_HEADER,
    rows: x.rows.slice(0, 10),
    totals: x.totals,
    byAccount: x.byAccount,
  })
})

r.get('/xero', exporting, async (req, res) => {
  const x = await xeroRows(req.query)
  if (!x.rows.length) throw badRequest('There are no paid donations in those dates, so there is nothing to export.')
  await audit(req, 'report.export', `Exported the Xero bank file for ${rangeLabel(x.from, x.to)}: ${x.totals.gifts} donations, ${formatMoney(x.totals.amount)}`, { type: 'report', label: 'xero' })
  sendCsv(res, `xero-${format(x.from, 'yyyy-MM-dd')}-to-${lastDay(x.to)}.csv`, [XERO_HEADER, ...x.rows], { bom: false })
})

export default r
