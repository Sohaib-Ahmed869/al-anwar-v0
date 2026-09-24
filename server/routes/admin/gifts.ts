import { Router, type Request } from 'express'
import { z } from 'zod'
import { DESIGNATIONS, DESIGNATION_KEYS, GIFT_STATUSES, METHODS, type Designation } from '../../../shared/domain'
import { centsToDecimal, formatMoney } from '../../../shared/money'
import { Appeal, AuditEvent, Donor, Gift, Plan, nextDonorNumber } from '../../models'
import { audit } from '../../lib/audit'
import { requireStaff, requireStaffAny, staffCan } from '../../lib/auth'
import { findOrCreateDonor, fullName, issueReceipt, recordGift } from '../../lib/giving'
import { badRequest, isId, notFound, oid, out, paging, parse, searchRegex, sorting, zCents, zId } from '../../lib/http'
import { refreshForGift } from '../../lib/stats'

/* ---------------------------------------------------------------------------
   /api/admin/gifts — the one list of money in, and the door for gifts that
   did not come through the website (cash, cheques, event tables, transfers).

   WHO SEES WHAT
   gifts.read sees everything. A role that can only ENTER gifts (a volunteer)
   sees only the gifts they entered themselves in the last 30 days — enough to
   check tonight's event table, never enough to browse the donor base. That
   scope is applied here, on every read, not by the page hiding things.

   NO-EMAIL DONORS
   Someone who hands over cash at an event often gives a name and nothing
   else. They still get a donor record (and a receipt number, which is what
   matters for their tax return) under a placeholder on the reserved .invalid
   domain; lib/email.ts refuses to send to it and records why. When somebody
   later adds a real address, "Resend receipt" works as normal.

   Refunds only RECORD that money went back: payments are returned in Stripe
   or the bank, and the page says so before anyone presses the button.
--------------------------------------------------------------------------- */

const r = Router()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Filter = Record<string, any>

const VOLUNTEER_WINDOW_DAYS = 30
const PLACEHOLDER_DOMAIN = 'donors.alanwaar.invalid'
const isPlaceholder = (email?: string | null) => Boolean(email?.toLowerCase().endsWith('.invalid'))

const list = (v: unknown) =>
  String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

/** yyyy-mm-dd as local midnight, so "the 3rd" is the 3rd wherever the server runs. */
function localDay(s: unknown): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ''))
  if (!m) return undefined
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** The filter the list, the totals and the export all share. */
function giftFilter(req: Request): Filter {
  const q = req.query
  const f: Filter = {}
  const from = localDay(q.from)
  const to = localDay(q.to)
  if (from || to) f.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lt: to } : {}) }
  const methods = list(q.method).filter((m) => m in METHODS)
  if (methods.length) f.method = { $in: methods }
  const des = list(q.designation).filter((d) => d in DESIGNATIONS)
  if (des.length) f.designation = { $in: des }
  const st = list(q.status).filter((s) => s in GIFT_STATUSES)
  if (st.length) f.status = { $in: st }
  const appeals = list(q.appeal).filter(isId)
  if (appeals.length) f.appeal = { $in: appeals.map(oid) }
  const sources = list(q.source).filter((s) => ['online', 'offline', 'bank', 'recurring'].includes(s))
  if (sources.length) f.source = { $in: sources }
  if (isId(q.donor)) f.donor = oid(q.donor)
  if (isId(q.plan)) f.plan = oid(q.plan)
  const rx = searchRegex(q.q)
  if (rx) f.$or = [{ donorName: rx }, { number: rx }, { 'receipt.number': rx }, { reference: rx }]

  if (!staffCan(req, 'gifts.read')) {
    f.enteredBy = req.staff!._id
    f.createdAt = { $gte: new Date(Date.now() - VOLUNTEER_WINDOW_DAYS * 86_400_000) }
  }
  return f
}

/** A volunteer may open only a gift they entered, inside the same window. */
function assertCanSee(req: Request, g: { enteredBy?: unknown; createdAt?: Date | null }) {
  if (staffCan(req, 'gifts.read')) return
  const mine = String(g.enteredBy ?? '') === String(req.staff!._id)
  const recent = g.createdAt && Date.now() - new Date(g.createdAt).getTime() < VOLUNTEER_WINDOW_DAYS * 86_400_000
  if (!mine || !recent) throw notFound('That gift')
}

type DonorLike = {
  _id: unknown
  number: string
  firstName: string
  lastName?: string | null
  email: string
  phone?: string | null
  totalGiven?: number | null
  giftCount?: number | null
  firstGiftAt?: Date | null
  lastGiftAt?: Date | null
  hasActivePlan?: boolean | null
}

export const donorSummary = (x: DonorLike | null | undefined) => {
  if (!x) return null
  return {
    id: String(x._id),
    number: x.number,
    name: fullName(x),
    firstName: x.firstName,
    lastName: x.lastName ?? '',
    email: isPlaceholder(x.email) ? '' : x.email,
    hasEmail: !isPlaceholder(x.email),
    phone: x.phone,
    totalGiven: x.totalGiven ?? 0,
    giftCount: x.giftCount ?? 0,
    firstGiftAt: x.firstGiftAt?.toISOString(),
    lastGiftAt: x.lastGiftAt?.toISOString(),
    hasActivePlan: Boolean(x.hasActivePlan),
  }
}

/* ---------- list ---------- */
r.get('/', requireStaffAny('gifts.read', 'gifts.create'), async (req, res) => {
  const { page, pageSize, skip } = paging(req.query)
  const sort = sorting(req.query, ['date', 'amount', 'createdAt'], { date: -1 })
  const f = giftFilter(req)
  const [items, total, agg] = await Promise.all([
    Gift.find(f).sort({ ...sort, _id: -1 }).skip(skip).limit(pageSize).select('-external').lean(),
    Gift.countDocuments(f),
    Gift.aggregate<{ amount: number }>([
      { $match: { $and: [f, { status: 'succeeded' }] } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]),
  ])
  res.json({
    items: out(items),
    total,
    page,
    pageSize,
    /* `amount` counts only money actually received, so a refunded or failed
       gift in the filter never inflates the figure beside the count */
    totals: { amount: agg[0]?.amount ?? 0, count: total },
    scope: staffCan(req, 'gifts.read') ? 'all' : 'mine',
  })
})

/* ---------- CSV of the current filter ---------- */
const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

r.get('/export', requireStaff('gifts.read', 'reports.export'), async (req, res) => {
  const f = giftFilter(req)
  const gifts = await Gift.find(f).sort({ date: -1 }).select('-external').lean()
  const donors = await Donor.find({ _id: { $in: [...new Set(gifts.map((g) => String(g.donor)))].map(oid) } })
    .select('number email')
    .lean()
  const byId = new Map(donors.map((d) => [String(d._id), d]))
  const header = [
    'Gift', 'Date', 'Donor number', 'Donor', 'Email', 'Amount', 'Fee covered', 'Designation', 'Method', 'Status',
    'Appeal', 'Country', 'Receipt', 'Reference', 'Source', 'Entered by', 'Anonymous', 'Notes',
  ]
  const rows = gifts.map((g) => {
    const d = byId.get(String(g.donor))
    return [
      g.number,
      ymd(new Date(g.date)),
      d?.number ?? '',
      g.donorName,
      d && !isPlaceholder(d.email) ? d.email : '',
      centsToDecimal(g.amount),
      centsToDecimal(g.fee ?? 0),
      DESIGNATIONS[g.designation as Designation]?.label ?? g.designation,
      METHODS[g.method as keyof typeof METHODS]?.label ?? g.method,
      GIFT_STATUSES[g.status as keyof typeof GIFT_STATUSES]?.label ?? g.status,
      g.appealTitle ?? '',
      g.country ?? '',
      g.receipt?.number ?? '',
      g.reference ?? '',
      g.source,
      g.enteredByName ?? '',
      g.anonymous ? 'Yes' : 'No',
      g.notes ?? '',
    ]
  })
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  await audit(req, 'gift.export', `Exported ${gifts.length.toLocaleString('en-AU')} gifts to CSV`, { type: 'gift', label: 'CSV export' })
  const stamp = ymd(new Date())
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="gifts-${stamp}.csv"`)
  res.send('﻿' + csv)
})

/* ---------- a donor, for "record a gift for this person" links ----------
   The record dialog opens preselected from a donor's page; this answers with
   just the summary it needs, under the same permission as entering a gift. */
r.get('/donor/:id', requireStaff('gifts.create'), async (req, res) => {
  let d = isId(req.params.id) ? await Donor.findById(req.params.id).lean() : null
  while (d?.status === 'merged' && d.mergedInto) d = await Donor.findById(d.mergedInto).lean()
  if (!d) throw notFound('That donor')
  res.json({ donor: donorSummary(d) })
})

/* ---------- one gift ---------- */
r.get('/:id', requireStaffAny('gifts.read', 'gifts.create'), async (req, res) => {
  const g = await Gift.findById(req.params.id).select('-external').lean()
  if (!g) throw notFound('That gift')
  assertCanSee(req, g)
  const [donor, plan, events] = await Promise.all([
    Donor.findById(g.donor).lean(),
    g.plan ? Plan.findById(g.plan).select('number status amount frequency kind nextChargeAt payment.brand payment.last4').lean() : null,
    AuditEvent.find({ 'entity.type': 'gift', 'entity.id': g._id }).sort({ at: -1 }).limit(50).lean(),
  ])
  res.json({ gift: out(g), donor: donorSummary(donor), plan: plan ? out(plan) : null, events: out(events) })
})

/* ---------- record a cash, cheque, event or transfer gift ---------- */
const OfflineBody = z
  .object({
    donorId: zId.optional(),
    newDonor: z
      .object({
        firstName: z.string().trim().min(1, 'Add a first name').max(80),
        lastName: z.string().trim().max(80).optional().default(''),
        email: z.union([z.literal(''), z.string().trim().toLowerCase().email('That email address does not look right')]).optional(),
        phone: z.string().trim().max(40).optional(),
      })
      .optional(),
    amount: zCents.max(100_000_000, 'That is more than one gift can be'),
    method: z.enum(['cash', 'cheque', 'event', 'bank']),
    designation: z.enum(DESIGNATION_KEYS as [Designation, ...Designation[]]),
    appealId: z.union([zId, z.literal(''), z.null()]).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
    reference: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(2000).optional(),
    anonymous: z.boolean().optional(),
    sendReceipt: z.boolean().optional().default(true),
  })
  .refine((b) => Boolean(b.donorId) !== Boolean(b.newDonor), { message: 'Choose a donor, or add a new one', path: ['donor'] })

r.post('/offline', requireStaff('gifts.create'), async (req, res) => {
  const b = parse(OfflineBody, req.body)

  const day = localDay(b.date)!
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (day.getTime() > today.getTime()) throw badRequest('Some details need another look.', { date: 'A gift cannot be dated in the future' })
  /* today's gift keeps the time it was typed in, so a night's entries sort in
     the order they were taken; an earlier date sits at midday, clear of any
     timezone edge */
  const date = day.getTime() === today.getTime() ? new Date() : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12)

  let donorCreated = false
  let donor
  if (b.donorId) {
    donor = await Donor.findById(b.donorId)
    while (donor?.status === 'merged' && donor.mergedInto) donor = await Donor.findById(donor.mergedInto)
    if (!donor) throw badRequest('Some details need another look.', { donor: 'That donor could not be found' })
  } else {
    const n = b.newDonor!
    if (n.email) {
      const found = await findOrCreateDonor({ email: n.email, firstName: n.firstName, lastName: n.lastName, phone: n.phone, source: 'offline' })
      donor = found.donor
      donorCreated = found.created
    } else {
      const number = await nextDonorNumber()
      donor = await Donor.create({
        number,
        firstName: n.firstName,
        lastName: n.lastName ?? '',
        email: `noemail+${number.toLowerCase()}@${PLACEHOLDER_DOMAIN}`,
        phone: n.phone || undefined,
        source: 'offline',
        preferences: { emailOptIn: false, topics: [], anonymous: false },
      })
      donorCreated = true
    }
    if (donorCreated) {
      await audit(req, 'donor.create', `Added donor ${fullName(donor)} (${donor.number}) while recording a gift`, {
        type: 'donor', id: donor._id, label: donor.number,
      })
    }
  }

  const noEmail = isPlaceholder(donor.email)
  const gift = await recordGift(
    {
      donor,
      amount: b.amount,
      designation: b.designation,
      method: b.method,
      date,
      appealId: b.appealId || null,
      reference: b.reference || undefined,
      notes: b.notes || undefined,
      anonymous: b.anonymous,
      source: 'offline',
      /* for a no-email donor this still 'sends', and lib/email.ts records it as
         failed with the reason, so their record shows why no receipt went */
      sendReceipt: b.sendReceipt,
    },
    req,
  )
  res.status(201).json({
    gift: out(gift.toObject()),
    donor: donorSummary(await Donor.findById(donor._id).lean()),
    donorCreated,
    receiptEmailed: Boolean(gift.receipt?.emailedAt),
    receiptSkipped: noEmail ? 'no-email' : b.sendReceipt ? null : 'declined',
  })
})

/* ---------- resend a receipt ---------- */
r.post('/:id/resend-receipt', requireStaff('gifts.read'), async (req, res) => {
  const gift = await Gift.findById(req.params.id)
  if (!gift) throw notFound('That gift')
  if (gift.status !== 'succeeded') throw badRequest('Only a paid gift has a receipt to send.')
  const donor = await Donor.findById(gift.donor).select('email firstName lastName number')
  if (!donor || isPlaceholder(donor.email)) {
    throw badRequest('There is no email address on this donor’s record. Add one to their record, then send the receipt.')
  }
  const before = gift.receipt?.emailedAt
  await issueReceipt(gift, { email: true, resend: Boolean(gift.receipt?.number && before) })
  const emailed = Boolean(gift.receipt?.emailedAt && gift.receipt.emailedAt !== before)
  if (!emailed) throw badRequest('The receipt could not be emailed just now. It is in the Email log with the reason.')
  await audit(req, 'gift.receipt_resent', `Emailed receipt ${gift.receipt?.number} for ${gift.number} to ${fullName(donor)} (${donor.email})`, {
    type: 'gift', id: gift._id, label: gift.number,
  })
  res.json({ gift: out(gift.toObject()), to: donor.email })
})

/* ---------- correct a gift ---------- */
const PatchBody = z.object({
  designation: z.enum(DESIGNATION_KEYS as [Designation, ...Designation[]]).optional(),
  appealId: z.union([zId, z.literal(''), z.null()]).optional(),
  notes: z.string().trim().max(2000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date').optional(),
})

r.patch('/:id', requireStaff('gifts.manage'), async (req, res) => {
  const b = parse(PatchBody, req.body)
  const gift = await Gift.findById(req.params.id)
  if (!gift) throw notFound('That gift')
  const changes: string[] = []
  const oldAppeal = gift.appeal

  if (b.designation && b.designation !== gift.designation) {
    changes.push(`designation ${DESIGNATIONS[gift.designation as Designation].label} → ${DESIGNATIONS[b.designation].label}`)
    gift.designation = b.designation
  }
  if (b.appealId !== undefined && String(b.appealId || '') !== String(gift.appeal ?? '')) {
    const appeal = b.appealId ? await Appeal.findById(b.appealId).select('title country') : null
    if (b.appealId && !appeal) throw badRequest('Some details need another look.', { appealId: 'That appeal could not be found' })
    changes.push(`appeal ${gift.appealTitle ?? 'Where most needed'} → ${appeal?.title ?? 'Where most needed'}`)
    gift.set('appeal', appeal?._id ?? undefined)
    gift.set('appealTitle', appeal?.title ?? undefined)
    gift.set('country', appeal?.country ?? undefined)
  }
  if (b.date) {
    const d = localDay(b.date)!
    const cur = new Date(gift.date)
    if (d.toDateString() !== cur.toDateString()) {
      if (d.getTime() > Date.now()) throw badRequest('Some details need another look.', { date: 'A gift cannot be dated in the future' })
      changes.push(`date ${cur.toLocaleDateString('en-AU')} → ${d.toLocaleDateString('en-AU')}`)
      gift.date = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12)
    }
  }
  if (b.notes !== undefined && b.notes !== (gift.notes ?? '')) {
    changes.push('notes updated')
    gift.notes = b.notes || undefined
  }
  if (!changes.length) return void res.json({ gift: out(gift.toObject()), changed: false })

  await gift.save()
  await refreshForGift(gift)
  if (oldAppeal && String(oldAppeal) !== String(gift.appeal ?? '')) await refreshForGift({ appeal: oldAppeal })
  await audit(req, 'gift.update', `Corrected ${gift.number} from ${gift.donorName}: ${changes.join('; ')}`, {
    type: 'gift', id: gift._id, label: gift.number,
  })
  res.json({ gift: out(gift.toObject()), changed: true })
})

/* ---------- refund ---------- */
r.post('/:id/refund', requireStaff('gifts.manage'), async (req, res) => {
  const { reason } = parse(z.object({ reason: z.string().trim().min(3, 'Say briefly why, for the record').max(500) }), req.body)
  const gift = await Gift.findById(req.params.id)
  if (!gift) throw notFound('That gift')
  if (gift.status !== 'succeeded') throw badRequest('Only a paid gift can be refunded.')
  gift.status = 'refunded'
  const stamp = new Date().toLocaleDateString('en-AU')
  gift.notes = [gift.notes, `Refunded ${stamp} by ${req.staff!.name}: ${reason}`].filter(Boolean).join('\n')
  await gift.save()
  await refreshForGift(gift)
  await audit(req, 'gift.refund', `Refunded ${formatMoney(gift.amount)} gift ${gift.number} from ${gift.donorName}: ${reason}`, {
    type: 'gift', id: gift._id, label: gift.number,
  })
  res.json({ gift: out(gift.toObject()) })
})

/* ---------- a pending bank pledge that arrived, marked by hand ---------- */
r.post('/:id/received', requireStaff('gifts.manage'), async (req, res) => {
  const b = parse(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), sendReceipt: z.boolean().optional().default(true) }), req.body)
  const gift = await Gift.findById(req.params.id)
  if (!gift) throw notFound('That gift')
  if (gift.status !== 'pending') throw badRequest('Only a gift awaiting its transfer can be marked as received.')
  const d = b.date ? localDay(b.date)! : new Date()
  if (d.getTime() > Date.now()) throw badRequest('Some details need another look.', { date: 'The money cannot arrive in the future' })
  gift.status = 'succeeded'
  gift.date = b.date ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12) : d
  await gift.save()
  const donor = await Donor.findById(gift.donor).select('email')
  await issueReceipt(gift, { email: b.sendReceipt && !isPlaceholder(donor?.email) })
  await refreshForGift(gift)
  await audit(
    req,
    'gift.received',
    `Marked ${formatMoney(gift.amount)} bank transfer ${gift.number} from ${gift.donorName} as received${gift.reference ? ` (ref ${gift.reference})` : ''}`,
    { type: 'gift', id: gift._id, label: gift.number },
  )
  res.json({ gift: out(gift.toObject()), receiptEmailed: Boolean(gift.receipt?.emailedAt) })
})

export default r
