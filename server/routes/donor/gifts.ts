import { Router } from 'express'
import { z } from 'zod'
import { DESIGNATION_KEYS, DESIGNATIONS, fyLabel, fyOf, fyRange, METHOD_KEYS, type Designation } from '../../../shared/domain'
import { formatMoney } from '../../../shared/money'
import { rangeStatementEmail, taxStatementEmail } from '../../emails/templates'
import { audit } from '../../lib/audit'
import { sendEmail } from '../../lib/email'
import { issueReceipt } from '../../lib/giving'
import { HttpError, isId, notFound, out, paging, parse, searchRegex, sorting } from '../../lib/http'
import { Gift, getSettings, type GiftDoc } from '../../models'
import { donorName, giftOut, me, statementYears, withAppealLinks } from './util'

/* ---------------------------------------------------------------------------
   /api/me/gifts — one giving history, however the money arrived.

   Card, PayPal, a bank transfer matched from a statement, cash handed over at
   an event: all of them are Gift rows, so they all appear here. Failed card
   payments and bank pledges still waiting for the money are listed too,
   clearly marked, because a donor who sees a gift missing assumes it was
   lost — better to show "Awaiting transfer" than nothing.

   Receipts and tax statements only ever count succeeded gifts.

   Route order matters: the fixed paths (/statements, /statement/range,
   /statement/:fy, /receipt/:id) sit above /:id.

   Besides the financial-year statement a donor can ask for one covering any
   dates they choose (last 12 months, a calendar year, everything). Dates
   arrive as plain YYYY-MM-DD days, inclusive at both ends, and are read as
   local midnight so they agree with fyRange() about where a day starts. The
   span is capped at 30 years (and never before 2000) so a typo cannot ask
   the database for a century of gifts.
--------------------------------------------------------------------------- */

const r = Router()

const RESEND_COOLDOWN_MS = 60_000

/** A gift of the signed-in donor's, or a 404 — never "that's someone else's". */
async function ownGift(req: Parameters<typeof me>[0], id: string): Promise<GiftDoc> {
  if (!isId(id)) throw notFound('That gift')
  const g = await Gift.findOne({ _id: id, donor: me(req)._id })
  if (!g) throw notFound('That gift')
  return g
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const MAX_SPAN_YEARS = 30

/** "2026-07-01" to local midnight on that day, or null if it is not a real date. */
function dayOf(v: string): Date | null {
  const m = DAY.exec(v)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null
}

const day = z.string().trim().refine((v) => dayOf(v) !== null, 'Enter a date like 2026-07-01.')
  .refine((v) => { const d = dayOf(v); return !d || (d.getFullYear() >= 2000 && d.getFullYear() < 2100) }, 'Choose a date from 2000 onwards.')

const rangeSchema = z
  .object({ from: day, to: day })
  /* zod still runs these when a field above failed, so a bad day is let through here to keep its own message */
  .refine((r) => { const f = dayOf(r.from), t = dayOf(r.to); return !f || !t || f <= t }, { path: ['to'], message: 'The end date is before the start date.' })
  .refine((r) => { const f = dayOf(r.from), t = dayOf(r.to); return !f || !t || t.getFullYear() - f.getFullYear() <= MAX_SPAN_YEARS }, {
    path: ['from'],
    message: `A statement can cover up to ${MAX_SPAN_YEARS} years.`,
  })

/** The validated range as [from, to) — "to" is the midnight after the last day. */
function rangeOf(input: unknown) {
  const r = parse(rangeSchema, input)
  const from = dayOf(r.from)!
  const last = dayOf(r.to)!
  const to = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1)
  return { from, to, fromDay: r.from, toDay: r.to }
}

const list = (v: unknown) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean)

r.get('/', async (req, res) => {
  const donor = me(req)
  const { page, pageSize, skip } = paging(req.query, { pageSize: 20, max: 100 })
  const q: Record<string, unknown> = { donor: donor._id }
  const fy = Number(req.query.fy)
  if (req.query.from || req.query.to) {
    const { from, to } = rangeOf({ from: req.query.from, to: req.query.to })
    q.date = { $gte: from, $lt: to }
  } else if (fy > 2000 && fy < 2100) {
    const { from, to } = fyRange(fy)
    q.date = { $gte: from, $lt: to }
  }
  const des = list(req.query.designation).filter((d) => (DESIGNATION_KEYS as string[]).includes(d))
  if (des.length) q.designation = { $in: des }
  const methods = list(req.query.method).filter((m) => (METHOD_KEYS as string[]).includes(m))
  if (methods.length) q.method = { $in: methods }
  const status = list(req.query.status)
  if (status.length) q.status = { $in: status }
  const rx = searchRegex(req.query.q)
  if (rx) q.$or = [{ appealTitle: rx }, { 'receipt.number': rx }, { number: rx }, { fundraiserTitle: rx }]

  const sort = sorting(req.query, ['date', 'amount'], { date: -1 })
  const [items, total, sum] = await Promise.all([
    Gift.find(q).sort({ ...sort, _id: -1 }).skip(skip).limit(pageSize).lean(),
    Gift.countDocuments(q),
    Gift.aggregate<{ total: number; count: number }>([
      { $match: { ...q, status: 'succeeded' } },
      { $group: { _id: null, total: { $sum: { $add: ['$amount', { $ifNull: ['$fee', 0] }] } }, count: { $sum: 1 } } },
    ]),
  ])
  res.json({
    items: (await withAppealLinks(items)).map((g) => out(giftOut(g))),
    total,
    page,
    pageSize,
    /* what the filtered view adds up to, succeeded gifts only */
    sum: sum[0]?.total ?? 0,
    sumCount: sum[0]?.count ?? 0,
  })
})

r.get('/statements', async (req, res) => {
  const years = await statementYears(me(req)._id)
  const current = fyOf(new Date())
  res.json({ items: years.map((y) => ({ ...y, label: fyLabel(y.fy), complete: y.fy < current })), current })
})

/** Everything a printable tax statement for one financial year needs. */
async function statementFor(req: Parameters<typeof me>[0], fy: number) {
  if (!(fy > 2000 && fy < 2100)) throw notFound('That statement')
  const { from, to } = fyRange(fy)
  return { ...(await statementBetween(req, from, to, fyLabel(fy), fy < fyOf(new Date()))), fy }
}

const fmtDay = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

/** A statement for any dates the donor picks. Complete once the last day has passed. */
async function statementForRange(req: Parameters<typeof me>[0], input: unknown) {
  const { from, to, fromDay, toDay } = rangeOf(input)
  const label = `${fmtDay(from)} – ${fmtDay(new Date(to.getTime() - 1))}`
  return { ...(await statementBetween(req, from, to, label, to.getTime() <= Date.now())), fy: null, range: { from: fromDay, to: toDay } }
}

/** The gifts, totals and letterhead for [from, to). */
async function statementBetween(req: Parameters<typeof me>[0], from: Date, to: Date, label: string, complete: boolean) {
  const donor = me(req)
  const [gifts, settings] = await Promise.all([
    Gift.find({ donor: donor._id, status: 'succeeded', date: { $gte: from, $lt: to } }).sort({ date: 1 }).lean(),
    getSettings(),
  ])
  /* an older gift that somehow has no receipt number gets one now, so the
     statement never prints a blank where the number goes */
  for (const g of gifts) {
    if (!g.receipt?.number) {
      const doc = await Gift.findById(g._id)
      if (doc) {
        await issueReceipt(doc, { email: false })
        g.receipt = doc.toObject().receipt
      }
    }
  }
  const byDesignation = new Map<Designation, { designation: Designation; label: string; total: number; count: number }>()
  let amount = 0
  let fees = 0
  for (const g of gifts) {
    const d = g.designation as Designation
    const row = byDesignation.get(d) ?? { designation: d, label: DESIGNATIONS[d].label, total: 0, count: 0 }
    row.total += g.amount + (g.fee ?? 0)
    row.count += 1
    byDesignation.set(d, row)
    amount += g.amount
    fees += g.fee ?? 0
  }
  return {
    label,
    period: { from: from.toISOString(), to: new Date(to.getTime() - 1).toISOString() },
    complete,
    issuedAt: new Date().toISOString(),
    org: settings.org,
    receipts: settings.receipts,
    donor: { name: donorName(donor), number: donor.number, email: donor.email, address: donor.address ?? null },
    gifts: gifts.map((g) => {
      const o = out<Record<string, unknown>>(giftOut(g))
      return {
        id: o.id, date: o.date, number: o.number, receiptNumber: g.receipt?.number ?? '', appealTitle: o.appealTitle,
        fundraiserTitle: o.fundraiserTitle, designation: o.designation, method: o.method, amount: g.amount, fee: g.fee ?? 0,
      }
    }),
    byDesignation: [...byDesignation.values()].sort((a, b) => b.total - a.total),
    totals: { amount, fees, total: amount + fees, count: gifts.length },
  }
}

r.get('/statement/range', async (req, res) => {
  res.json(await statementForRange(req, { from: req.query.from, to: req.query.to }))
})

r.post('/statement/range/email', async (req, res) => {
  const donor = me(req)
  const s = await statementForRange(req, req.body ?? {})
  if (!s.totals.count) throw new HttpError(400, `There are no gifts from ${s.label} to put on a statement.`)
  const sent = await sendEmail(donor.email, rangeStatementEmail(donor.firstName, s.range, s.label, s.totals.total, s.totals.count), { donor: donor._id })
  if (!sent.ok) throw new HttpError(502, 'The email could not be sent just now. Please try again in a few minutes.')
  await audit(req, 'donor.statement', `${donorName(donor)} emailed themselves a giving statement for ${s.label} (${formatMoney(s.totals.total)})`, {
    type: 'donor', id: donor._id, label: donor.number,
  })
  res.json({ ok: true, to: donor.email })
})

r.get('/statement/:fy', async (req, res) => {
  res.json(await statementFor(req, Number(req.params.fy)))
})

r.post('/statement/:fy/email', async (req, res) => {
  const donor = me(req)
  const s = await statementFor(req, Number(req.params.fy))
  if (!s.totals.count) throw new HttpError(400, `There are no gifts in ${s.label} to put on a statement.`)
  const sent = await sendEmail(donor.email, taxStatementEmail(donor.firstName, s.fy, s.totals.total, s.totals.count), { donor: donor._id })
  if (!sent.ok) throw new HttpError(502, 'The email could not be sent just now. Please try again in a few minutes.')
  await audit(req, 'donor.statement', `${donorName(donor)} emailed themselves their ${s.label} tax statement (${formatMoney(s.totals.total)})`, {
    type: 'donor', id: donor._id, label: donor.number,
  })
  res.json({ ok: true, to: donor.email })
})

r.get('/receipt/:id', async (req, res) => {
  const g = await ownGift(req, String(req.params.id))
  if (g.status !== 'succeeded') throw new HttpError(400, 'A receipt is issued once a gift has been received.')
  if (!g.receipt?.number) await issueReceipt(g, { email: false })
  const donor = me(req)
  const settings = await getSettings()
  res.json({
    gift: out(giftOut(g.toObject())),
    donor: { name: donorName(donor), number: donor.number, email: donor.email, address: donor.address ?? null },
    org: settings.org,
    receipts: settings.receipts,
  })
})

r.get('/:id', async (req, res) => {
  const g = await ownGift(req, String(req.params.id))
  const [withLinks] = await withAppealLinks([g.toObject()])
  res.json(out(giftOut(withLinks)))
})

r.post('/:id/resend', async (req, res) => {
  parse(z.object({}).passthrough(), req.body ?? {})
  const g = await ownGift(req, String(req.params.id))
  if (g.status !== 'succeeded') throw new HttpError(400, 'Only a gift that has been received has a receipt to send.')
  const last = g.receipt?.emailedAt ? new Date(g.receipt.emailedAt).getTime() : 0
  if (Date.now() - last < RESEND_COOLDOWN_MS) {
    throw new HttpError(429, 'We sent that receipt a moment ago. Check your inbox (and junk folder) — you can ask again in a minute.')
  }
  await issueReceipt(g, { email: true, resend: true })
  const donor = me(req)
  await audit(req, 'gift.resend', `${donorName(donor)} asked for receipt ${g.receipt?.number} (${g.number}) to be emailed again`, {
    type: 'gift', id: g._id, label: g.number,
  })
  res.json({ ok: true, to: donor.email, receipt: out(g.toObject().receipt) })
})

export default r
