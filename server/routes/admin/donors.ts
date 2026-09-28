import { Router, type Request } from 'express'
import { Types } from 'mongoose'
import { z } from 'zod'
import { DESIGNATIONS, EMAIL_TOPICS, FREQUENCIES, fyOf, fyRange, type Designation, type Frequency } from '../../../shared/domain'
import { centsToDecimal } from '../../../shared/money'
import type { Donor as DonorDTO } from '../../../shared/types'
import { audit } from '../../lib/audit'
import { requireStaff } from '../../lib/auth'
import { fullName } from '../../lib/giving'
import {
  badRequest, HttpError, isId, notFound, oid, out, paging, parse, searchRegex, sorting, escapeRegex, zEmail, zId,
} from '../../lib/http'
import { refreshDonor } from '../../lib/stats'
import {
  AuditEvent, Donor, EmailMessage, Enquiry, Fundraiser, Gift, nextDonorNumber, Plan,
} from '../../models'

/* ---------------------------------------------------------------------------
   /api/admin/donors — the donor list, one donor's whole record, and the
   duplicate finder that keeps it one record per person.

   Filters that depend on gifts (gave with a designation, gave to a country)
   are answered by asking the gifts for their donor ids first and then
   filtering donors by those ids: two cheap indexed queries instead of a
   $lookup across every gift.

   Duplicates are found by bucketing, not by comparing every donor with every
   other: each donor is dropped into buckets keyed by normalised name, phone
   digits, email local part and address, and only donors sharing a bucket are
   scored. Linear in the number of donors, so it stays quick at 50k records.
   A shared name alone is NOT enough to suggest a merge — two Mohammed Khans
   in Western Sydney are usually two people — so a pair needs a name plus a
   second signal, or two hard signals (phone, email) on their own.
--------------------------------------------------------------------------- */

const r = Router()

/* ---------- shared bits ---------- */

/** What never leaves the server: unsubscribe and OAuth identifiers. */
const PRIVATE = '-unsubscribeToken -oauth -notDuplicateOf'

const MAJOR_CENTS = 500_000
const DAY = 86_400_000

const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '')
const normName = (s?: string | null) =>
  (s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()
const emailLocal = (e?: string | null) => (e ?? '').toLowerCase().split('@')[0] ?? ''
/** "ahmed.khan82" → "ahmedkhan", so dots and birth years do not hide a match */
const localCore = (e?: string | null) => emailLocal(e).replace(/[^a-z]/g, '')

type ListQuery = Request['query']

/** The donor filter shared by the list, its counts and the CSV export. */
async function donorFilter(q: ListQuery, opts: { segment?: boolean } = { segment: true }) {
  const and: Record<string, unknown>[] = [{ status: { $ne: 'merged' } }]
  const text = String(q.q ?? '').trim()
  if (text) {
    /* every word must match somewhere: "khan lakemba" style searches, and
       "Amina Rahman" finds the person rather than every Amina */
    for (const word of text.split(/\s+/).slice(0, 5)) {
      const rx = searchRegex(word)!
      const ors: Record<string, unknown>[] = [
        { firstName: rx }, { lastName: rx }, { email: rx }, { altEmails: rx }, { number: rx }, { 'address.suburb': rx },
      ]
      const d = digits(word)
      if (d.length >= 3) ors.push({ phone: new RegExp(d.split('').map(escapeRegex).join('\\D*')) })
      and.push({ $or: ors })
    }
  }
  const segment = String(q.segment ?? '')
  if (opts.segment && segment) and.push(segmentFilter(segment))
  if (q.designation && typeof q.designation === 'string') {
    const list = q.designation.split(',').filter((x): x is Designation => x in DESIGNATIONS)
    if (list.length) and.push({ _id: { $in: await Gift.distinct('donor', { designation: { $in: list }, status: 'succeeded' }) } })
  }
  if (q.country && typeof q.country === 'string') {
    const list = q.country.split(',').filter(Boolean)
    if (list.length) and.push({ _id: { $in: await Gift.distinct('donor', { country: { $in: list }, status: 'succeeded' }) } })
  }
  if (q.state && typeof q.state === 'string') and.push({ 'address.state': { $in: q.state.split(',').filter(Boolean) } })
  if (q.tag && typeof q.tag === 'string') and.push({ tags: { $in: q.tag.split(',').filter(Boolean) } })
  if (q.ids && typeof q.ids === 'string') and.push({ _id: { $in: q.ids.split(',').filter(isId).map(oid) } })
  return { $and: and }
}

export const SEGMENTS = ['regular', 'lapsed', 'major', 'new', 'never'] as const
function segmentFilter(segment: string): Record<string, unknown> {
  const now = Date.now()
  switch (segment) {
    case 'regular':
      return { hasActivePlan: true }
    case 'lapsed':
      return { giftCount: { $gt: 0 }, lastGiftAt: { $lt: new Date(now - 365 * DAY) } }
    case 'major':
      return { $or: [{ tags: 'major donor' }, { totalGiven: { $gte: MAJOR_CENTS } }] }
    case 'new':
      return { firstGiftAt: { $gte: new Date(now - 90 * DAY) } }
    case 'never':
      return { giftCount: 0 }
    default:
      return {}
  }
}

/* ---------- the list ---------- */

r.get('/', requireStaff('donors.read'), async (req, res) => {
  const { page, pageSize, skip } = paging(req.query)
  const filter = await donorFilter(req.query)
  const sort = sorting(req.query, ['lastGiftAt', 'totalGiven', 'createdAt', 'lastName', 'giftCount'], { lastGiftAt: -1 })
  const [items, total] = await Promise.all([
    Donor.find(filter).select(PRIVATE).sort({ ...sort, _id: 1 }).skip(skip).limit(pageSize).lean(),
    Donor.countDocuments(filter),
  ])
  res.json({ items: out(items), total, page, pageSize })
})

/** How many donors each segment chip would show, with the other filters applied. */
r.get('/counts', requireStaff('donors.read'), async (req, res) => {
  const base = await donorFilter(req.query, { segment: false })
  const [all, ...rest] = await Promise.all([
    Donor.countDocuments(base),
    ...SEGMENTS.map((s) => Donor.countDocuments({ $and: [...base.$and, segmentFilter(s)] })),
  ])
  res.json({ all, ...Object.fromEntries(SEGMENTS.map((s, i) => [s, rest[i]])) })
})

/** The filter options that come from the data: tags in use and states on file. */
r.get('/facets', requireStaff('donors.read'), async (_req, res) => {
  const [tags, states] = await Promise.all([
    Donor.distinct('tags', { status: { $ne: 'merged' } }),
    Donor.distinct('address.state', { status: { $ne: 'merged' } }),
  ])
  res.json({ tags: (tags as string[]).filter(Boolean).sort(), states: (states as string[]).filter(Boolean).sort() })
})

/* ---------- export ---------- */

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  /* a leading = + - @ would run as a formula when the file is opened in Excel */
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
const isoDay = (d?: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '')

r.get('/export', requireStaff('donors.export'), async (req, res) => {
  const filter = await donorFilter(req.query)
  const sort = sorting(req.query, ['lastGiftAt', 'totalGiven', 'createdAt', 'lastName'], { lastName: 1 })
  const rows = await Donor.find(filter).select(PRIVATE).sort(sort).lean()
  const header = [
    'Donor number', 'First name', 'Last name', 'Email', 'Other emails', 'Phone', 'Address', 'Suburb', 'State', 'Postcode', 'Country',
    'Lifetime giving', 'Donations', 'First donation', 'Last donation', 'Regular giver', 'Email opt-in', 'Anonymous', 'Tags', 'Created',
  ]
  const lines = [header.join(',')]
  for (const d of rows) {
    lines.push(
      [
        d.number, d.firstName, d.lastName, d.email, (d.altEmails ?? []).join('; '), d.phone,
        [d.address?.line1, d.address?.line2].filter(Boolean).join(', '), d.address?.suburb, d.address?.state, d.address?.postcode, d.address?.country,
        centsToDecimal(d.totalGiven ?? 0), d.giftCount ?? 0, isoDay(d.firstGiftAt), isoDay(d.lastGiftAt),
        d.hasActivePlan ? 'Yes' : 'No', d.preferences?.emailOptIn === false ? 'No' : 'Yes', d.preferences?.anonymous ? 'Yes' : 'No',
        (d.tags ?? []).join('; '), isoDay(d.createdAt),
      ]
        .map(csvCell)
        .join(','),
    )
  }
  await audit(req, 'donor.export', `Exported ${rows.length.toLocaleString('en-AU')} donor${rows.length === 1 ? '' : 's'} to CSV`, { type: 'donor', label: 'export' }, {
    query: req.query,
  })
  const stamp = new Date().toISOString().slice(0, 10)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="donors-${stamp}.csv"`)
  res.send('﻿' + lines.join('\r\n'))
})

/* ---------- bulk ---------- */

const zTag = z.string().trim().toLowerCase().min(1, 'Type a tag').max(40, 'Keep tags short')

r.post('/bulk/tag', requireStaff('donors.write'), async (req, res) => {
  const body = parse(z.object({ ids: z.array(zId).min(1, 'Choose some donors').max(1000), tag: zTag, remove: z.boolean().optional() }), req.body)
  const ids = body.ids.map(oid)
  const result = body.remove
    ? await Donor.updateMany({ _id: { $in: ids } }, { $pull: { tags: body.tag } })
    : await Donor.updateMany({ _id: { $in: ids } }, { $addToSet: { tags: body.tag } })
  await audit(
    req,
    body.remove ? 'donor.untag' : 'donor.tag',
    `${body.remove ? 'Removed' : 'Added'} the tag “${body.tag}” ${body.remove ? 'from' : 'to'} ${result.modifiedCount} donor${result.modifiedCount === 1 ? '' : 's'}`,
    { type: 'donor', label: body.tag },
  )
  res.json({ updated: result.modifiedCount })
})

/* ---------- duplicates ---------- */

type DupDonor = {
  _id: Types.ObjectId
  number: string
  firstName: string
  lastName: string
  email: string
  altEmails?: string[]
  phone?: string | null
  address?: { line1?: string | null; suburb?: string | null; state?: string | null; postcode?: string | null } | null
  totalGiven?: number
  giftCount?: number
  lastGiftAt?: Date | null
  firstGiftAt?: Date | null
  hasActivePlan?: boolean
  createdAt?: Date
  notDuplicateOf?: Types.ObjectId[]
}

export type DuplicatePair = { a: DupDonor; b: DupDonor; score: number; reasons: string[] }

const maskPhone = (p: string) => {
  const d = digits(p)
  return d.length > 4 ? `${d.slice(0, 4)}…` : d
}

function scorePair(a: DupDonor, b: DupDonor): { score: number; reasons: string[] } | null {
  const reasons: string[] = []
  let score = 0
  let hard = 0
  const nameA = normName(`${a.firstName} ${a.lastName}`)
  const nameB = normName(`${b.firstName} ${b.lastName}`)
  const sameName = nameA.length > 2 && nameA === nameB
  const flipped = !sameName && normName(`${a.lastName} ${a.firstName}`) === nameB && nameA.length > 2
  if (sameName) {
    score += 0.45
    reasons.push('Same name')
  } else if (flipped) {
    score += 0.35
    reasons.push('Same name, first and last swapped')
  } else if (normName(a.lastName) && normName(a.lastName) === normName(b.lastName) && normName(a.firstName)[0] === normName(b.firstName)[0]) {
    score += 0.15
    reasons.push('Similar name')
  }
  const emailsA = [a.email, ...(a.altEmails ?? [])].map((e) => e.toLowerCase())
  const emailsB = [b.email, ...(b.altEmails ?? [])].map((e) => e.toLowerCase())
  if (emailsA.some((e) => emailsB.includes(e))) {
    score += 0.6
    hard++
    reasons.push('Same email address')
  } else {
    const ca = emailsA.map(localCore).filter((x) => x.length >= 4)
    const cb = emailsB.map(localCore).filter((x) => x.length >= 4)
    if (ca.some((x) => cb.some((y) => x === y || (Math.min(x.length, y.length) >= 5 && (x.includes(y) || y.includes(x)))))) {
      /* weak on its own: many people pick firstname.lastname */
      score += 0.1
      reasons.push('Similar email')
    }
  }
  const pa = digits(a.phone)
  if (pa.length >= 8 && pa === digits(b.phone)) {
    score += 0.35
    hard++
    reasons.push(`Same phone ${maskPhone(a.phone!)}`)
  }
  const addrA = addressKey(a)
  if (addrA && addrA === addressKey(b)) {
    score += 0.3
    reasons.push('Same address')
  }
  /* a name alone never qualifies; a name plus anything, or two hard signals, does */
  const qualifies = ((sameName || flipped) && reasons.length >= 2) || hard >= 1
  if (!qualifies) return null
  return { score: Math.min(1, Math.round(score * 100) / 100), reasons }
}

function addressKey(d: DupDonor) {
  const line = normName(d.address?.line1).replace(/\b(street|st|road|rd|avenue|ave|parade|pde|drive|dr)\b/g, '').replace(/\s+/g, '')
  const pc = digits(d.address?.postcode)
  return line && pc ? `${line}|${pc}` : ''
}

let dupCache: { at: number; pairs: DuplicatePair[] } | null = null
export const clearDuplicateCache = () => {
  dupCache = null
}

/** Every candidate pair, best first. Cached for a minute: the badge polls it. */
export async function findDuplicates(): Promise<DuplicatePair[]> {
  if (dupCache && Date.now() - dupCache.at < 60_000) return dupCache.pairs
  const donors = (await Donor.find({ status: { $ne: 'merged' } })
    .select('number firstName lastName email altEmails phone address totalGiven giftCount lastGiftAt firstGiftAt hasActivePlan createdAt notDuplicateOf')
    .lean()) as unknown as DupDonor[]
  const buckets = new Map<string, number[]>()
  const put = (key: string, i: number) => {
    const b = buckets.get(key)
    if (b) {
      if (b[b.length - 1] !== i) b.push(i)
    }
    else buckets.set(key, [i])
  }
  donors.forEach((d, i) => {
    const n = normName(`${d.firstName} ${d.lastName}`)
    if (n.length > 2) {
      put(`n:${n}`, i)
      put(`n:${normName(`${d.lastName} ${d.firstName}`)}`, i)
    }
    const p = digits(d.phone)
    if (p.length >= 8) put(`p:${p}`, i)
    for (const e of [d.email, ...(d.altEmails ?? [])]) put(`e:${e.toLowerCase()}`, i)
    const a = addressKey(d)
    if (a) put(`a:${a}`, i)
  })
  const seen = new Set<string>()
  const pairs: DuplicatePair[] = []
  for (const idx of buckets.values()) {
    if (idx.length < 2 || idx.length > 25) continue // a bucket of 25 is a shared office number, not one person
    for (let x = 0; x < idx.length; x++) {
      for (let y = x + 1; y < idx.length; y++) {
        const a = donors[idx[x]!]!
        const b = donors[idx[y]!]!
        if (a._id.equals(b._id)) continue
        const key = [String(a._id), String(b._id)].sort().join(':')
        if (seen.has(key)) continue
        seen.add(key)
        if (a.notDuplicateOf?.some((id) => id.equals(b._id)) || b.notDuplicateOf?.some((id) => id.equals(a._id))) continue
        const s = scorePair(a, b)
        if (!s) continue
        /* the record with more history (then the older one) is the natural survivor */
        const aFirst = (a.giftCount ?? 0) !== (b.giftCount ?? 0) ? (a.giftCount ?? 0) > (b.giftCount ?? 0) : (a.createdAt ?? 0) <= (b.createdAt ?? 0)
        pairs.push({ a: aFirst ? a : b, b: aFirst ? b : a, ...s })
      }
    }
  }
  pairs.sort((p, q) => q.score - p.score || (q.a.totalGiven ?? 0) + (q.b.totalGiven ?? 0) - ((p.a.totalGiven ?? 0) + (p.b.totalGiven ?? 0)))
  dupCache = { at: Date.now(), pairs }
  return pairs
}

const stripDup = ({ notDuplicateOf: _n, ...d }: DupDonor) => d

r.get('/duplicates', requireStaff('donors.merge'), async (_req, res) => {
  const pairs = await findDuplicates()
  res.json({
    items: pairs.map((p) => ({ id: `${p.a._id}:${p.b._id}`, score: p.score, reasons: p.reasons, a: out(stripDup(p.a)), b: out(stripDup(p.b)) })),
    total: pairs.length,
  })
})

/** Both records in full, with what each would bring to a merge. */
r.get('/duplicates/compare', requireStaff('donors.merge'), async (req, res) => {
  const a = parse(zId, req.query.a)
  const b = parse(zId, req.query.b)
  const [da, db] = await Promise.all([Donor.findById(a).select(PRIVATE).lean(), Donor.findById(b).select(PRIVATE).lean()])
  if (!da || !db) throw notFound('One of those donors')
  const bring = async (d: typeof da) => {
    const emails = [d.email, ...(d.altEmails ?? [])]
    const [plans, activePlans, enquiries, fundraisers, emailsSent, recent] = await Promise.all([
      Plan.countDocuments({ donor: d._id }),
      Plan.countDocuments({ donor: d._id, status: { $in: ['active', 'paused', 'past_due'] } }),
      Enquiry.countDocuments({ $or: [{ donor: d._id }, { email: { $in: emails } }] }),
      Fundraiser.countDocuments({ owner: d._id }),
      EmailMessage.countDocuments({ donor: d._id }),
      Gift.find({ donor: d._id }).sort({ date: -1 }).limit(3).select('number amount date appealTitle designation status').lean(),
    ])
    return { donor: out<DonorDTO>(d), counts: { gifts: d.giftCount ?? 0, lifetime: d.totalGiven ?? 0, plans, activePlans, enquiries, fundraisers, emails: emailsSent }, recentGifts: out(recent) }
  }
  const pair = (await findDuplicates()).find((p) => (String(p.a._id) === a && String(p.b._id) === b) || (String(p.a._id) === b && String(p.b._id) === a))
  res.json({ a: await bring(da), b: await bring(db), score: pair?.score ?? null, reasons: pair?.reasons ?? [] })
})

r.post('/duplicates/dismiss', requireStaff('donors.merge'), async (req, res) => {
  const { a, b } = parse(z.object({ a: zId, b: zId }), req.body)
  if (a === b) throw badRequest('Those are the same record.')
  const [da, db] = await Promise.all([Donor.findById(a), Donor.findById(b)])
  if (!da || !db) throw notFound('One of those donors')
  await Promise.all([
    Donor.updateOne({ _id: da._id }, { $addToSet: { notDuplicateOf: db._id } }),
    Donor.updateOne({ _id: db._id }, { $addToSet: { notDuplicateOf: da._id } }),
  ])
  clearDuplicateCache()
  await audit(req, 'donor.not_duplicate', `Marked ${fullName(da)} (${da.number}) and ${fullName(db)} (${db.number}) as different people`, {
    type: 'donor', id: da._id, label: da.number,
  }, { other: db._id })
  res.json({ ok: true })
})

const zPick = z.enum(['primary', 'secondary']).optional()

r.post('/merge', requireStaff('donors.merge'), async (req, res) => {
  const body = parse(
    z.object({
      primary: zId,
      secondary: zId,
      fields: z.object({ firstName: zPick, lastName: zPick, phone: zPick, address: zPick }).partial().optional(),
    }),
    req.body,
  )
  if (body.primary === body.secondary) throw badRequest('Choose two different records to merge.')
  const [p, s] = await Promise.all([Donor.findById(body.primary), Donor.findById(body.secondary)])
  if (!p || !s) throw notFound('One of those donors')
  if (p.status === 'merged' || s.status === 'merged') throw new HttpError(409, 'One of these records has already been merged. Refresh and try again.')

  const pName = fullName(p)
  const sName = fullName(s)
  const f = body.fields ?? {}
  if (f.firstName === 'secondary' && s.firstName) p.firstName = s.firstName
  if (f.lastName === 'secondary') p.lastName = s.lastName ?? ''
  if (f.phone === 'secondary' && s.phone) p.phone = s.phone
  if (!p.phone && s.phone) p.phone = s.phone
  if (f.address === 'secondary' && s.address?.line1) p.set('address', s.toObject().address)
  if (!p.address?.line1 && s.address?.line1) p.set('address', s.toObject().address)

  const lower = (x: string) => x.toLowerCase()
  const alt = new Set([...(p.altEmails ?? []), s.email, ...(s.altEmails ?? [])].map(lower))
  alt.delete(lower(p.email))
  p.altEmails = [...alt]
  p.tags = [...new Set([...(p.tags ?? []), ...(s.tags ?? [])])]
  p.bankAliases = [...new Set([...(p.bankAliases ?? []), ...(s.bankAliases ?? [])])]
  if (s.notes?.trim()) p.notes = [p.notes?.trim(), `From ${s.number}: ${s.notes.trim()}`].filter(Boolean).join('\n\n')
  if (!p.oauth?.google && s.oauth?.google) p.set('oauth.google', s.oauth.google)
  if (!p.oauth?.facebook && s.oauth?.facebook) p.set('oauth.facebook', s.oauth.facebook)
  /* the stricter privacy choice wins: someone who opted out on either record stays opted out */
  if (s.preferences?.emailOptIn === false) p.set('preferences.emailOptIn', false)
  if (s.preferences?.anonymous) p.set('preferences.anonymous', true)
  p.notDuplicateOf = (p.notDuplicateOf ?? []).filter((id) => !id.equals(s._id))
  await p.save()

  const newName = fullName(p)
  const [gifts, plans, enquiries, fundraisers, emails] = await Promise.all([
    Gift.updateMany({ donor: s._id }, { $set: { donor: p._id, donorName: newName } }),
    Plan.updateMany({ donor: s._id }, { $set: { donor: p._id, donorName: newName } }),
    Enquiry.updateMany({ donor: s._id }, { $set: { donor: p._id } }),
    Fundraiser.updateMany({ owner: s._id }, { $set: { owner: p._id, ownerName: newName } }),
    EmailMessage.updateMany({ donor: s._id }, { $set: { donor: p._id } }),
  ])
  /* the survivor's own gifts carry its (possibly new) name too */
  if (newName !== pName) {
    await Promise.all([
      Gift.updateMany({ donor: p._id }, { $set: { donorName: newName } }),
      Plan.updateMany({ donor: p._id }, { $set: { donorName: newName } }),
    ])
  }
  s.status = 'merged'
  s.mergedInto = p._id
  await s.save()
  await Promise.all([refreshDonor(p._id), refreshDonor(s._id)])
  clearDuplicateCache()

  await audit(
    req,
    'donor.merge',
    `Merged ${sName} (${s.number}) into ${pName} (${p.number}) — ${gifts.modifiedCount} donation${gifts.modifiedCount === 1 ? '' : 's'}, ${plans.modifiedCount} regular donation${plans.modifiedCount === 1 ? '' : 's'} moved`,
    { type: 'donor', id: p._id, label: p.number },
    { secondary: s._id, secondaryNumber: s.number, moved: { gifts: gifts.modifiedCount, plans: plans.modifiedCount, enquiries: enquiries.modifiedCount, fundraisers: fundraisers.modifiedCount, emails: emails.modifiedCount } },
  )
  res.json({
    id: String(p._id),
    moved: { gifts: gifts.modifiedCount, plans: plans.modifiedCount, enquiries: enquiries.modifiedCount, fundraisers: fundraisers.modifiedCount, emails: emails.modifiedCount },
  })
})

/* ---------- create ---------- */

const zAddress = z
  .object({
    line1: z.string().trim().max(120).optional(),
    line2: z.string().trim().max(120).optional(),
    suburb: z.string().trim().max(60).optional(),
    state: z.string().trim().max(40).optional(),
    postcode: z.string().trim().max(12).optional(),
    country: z.string().trim().max(60).optional(),
  })
  .partial()

const zPrefs = z
  .object({
    emailOptIn: z.boolean(),
    topics: z.array(z.enum(Object.keys(EMAIL_TOPICS) as [string, ...string[]])),
    anonymous: z.boolean(),
  })
  .partial()

const zPhone = z
  .string()
  .trim()
  .max(30)
  .refine((v) => !v || digits(v).length >= 8, 'That phone number looks too short')

async function emailOwner(email: string, except?: Types.ObjectId) {
  return Donor.findOne({
    $or: [{ email }, { altEmails: email }],
    status: { $ne: 'merged' },
    ...(except ? { _id: { $ne: except } } : {}),
  }).select('number firstName lastName')
}

r.post('/', requireStaff('donors.write'), async (req, res) => {
  const body = parse(
    z.object({
      firstName: z.string().trim().min(1, 'Add a first name').max(60),
      lastName: z.string().trim().max(60).default(''),
      email: zEmail,
      phone: zPhone.optional(),
      address: zAddress.optional(),
      tags: z.array(zTag).max(20).optional(),
      notes: z.string().max(5000).optional(),
      preferences: zPrefs.optional(),
    }),
    req.body,
  )
  const existing = await emailOwner(body.email)
  if (existing) {
    throw new HttpError(409, `${fullName(existing)} (${existing.number}) already uses that email address.`, {
      email: `Already on ${fullName(existing)}’s record (${existing.number}).`,
      existingId: String(existing._id),
    })
  }
  const donor = await Donor.create({
    number: await nextDonorNumber(),
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    phone: body.phone || undefined,
    address: body.address,
    tags: body.tags ?? [],
    notes: body.notes,
    preferences: { emailOptIn: true, topics: ['appeals', 'reports'], anonymous: false, ...body.preferences },
    source: 'offline',
  })
  clearDuplicateCache()
  await audit(req, 'donor.create', `Added ${fullName(donor)} (${donor.number}) as a donor`, { type: 'donor', id: donor._id, label: donor.number })
  const lean = await Donor.findById(donor._id).select(PRIVATE).lean()
  res.status(201).json(out(lean))
})

/* ---------- one donor ---------- */

async function loadDonor(id: string) {
  if (!isId(id)) throw notFound('That donor')
  const d = await Donor.findById(id)
  if (!d) throw notFound('That donor')
  return d
}

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone

r.get('/:id', requireStaff('donors.read'), async (req, res) => {
  const d = await Donor.findById(parse(zId, req.params.id)).select(PRIVATE).lean()
  if (!d) throw notFound('That donor')
  const emails = [d.email, ...(d.altEmails ?? [])]
  const fy = fyOf(new Date())
  const { from } = fyRange(fy)
  const [byDesignation, byYearRaw, plans, recentGifts, enquiries, fundraisers, emailsCount, thisFy, mergedFrom, byMethod] = await Promise.all([
    Gift.aggregate<{ _id: Designation; total: number; count: number }>([
      { $match: { donor: d._id, status: 'succeeded' } },
      { $group: { _id: '$designation', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    Gift.aggregate<{ _id: { y: number; m: number }; total: number; count: number }>([
      { $match: { donor: d._id, status: 'succeeded' } },
      { $group: { _id: { y: { $year: { date: '$date', timezone: TZ } }, m: { $month: { date: '$date', timezone: TZ } } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Plan.find({ donor: d._id }).sort({ status: 1, createdAt: -1 }).lean(),
    Gift.find({ donor: d._id }).sort({ date: -1 }).limit(6).lean(),
    Enquiry.find({ $or: [{ donor: d._id }, { email: { $in: emails } }] }).sort({ createdAt: -1 }).limit(30).lean(),
    Fundraiser.find({ owner: d._id }).sort({ createdAt: -1 }).lean(),
    EmailMessage.countDocuments({ $or: [{ donor: d._id }, { to: { $in: emails } }] }),
    Gift.aggregate<{ total: number; count: number }>([
      { $match: { donor: d._id, status: 'succeeded', date: { $gte: from } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Donor.find({ mergedInto: d._id }).select('number firstName lastName email updatedAt').lean(),
    Gift.aggregate<{ _id: string; total: number; count: number }>([
      { $match: { donor: d._id, status: 'succeeded' } },
      { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
  ])
  const years = new Map<number, { total: number; count: number }>()
  for (const row of byYearRaw) {
    const k = row._id.m >= 7 ? row._id.y + 1 : row._id.y
    const cur = years.get(k) ?? { total: 0, count: 0 }
    years.set(k, { total: cur.total + row.total, count: cur.count + row.count })
  }
  /* every year from their first gift to now, zeros included, so the chart has no gaps */
  const firstFy = d.firstGiftAt ? fyOf(d.firstGiftAt) : fy
  const byYear = []
  for (let y = Math.min(firstFy, fy); y <= fy; y++) byYear.push({ fy: y, total: years.get(y)?.total ?? 0, count: years.get(y)?.count ?? 0 })
  const monthly = plans
    .filter((p) => p.status === 'active')
    .reduce((s, p) => s + Math.round((p.amount * FREQUENCIES[p.frequency as Frequency].perYear) / 12), 0)

  res.json({
    donor: out(d),
    summary: {
      thisFy: { fy, total: thisFy[0]?.total ?? 0, count: thisFy[0]?.count ?? 0 },
      byDesignation: byDesignation.map((x) => ({ designation: x._id, total: x.total, count: x.count })),
      byMethod: byMethod.map((x) => ({ method: x._id, total: x.total, count: x.count })),
      byYear,
      plans: out(plans),
      regularMonthly: monthly,
      recentGifts: out(recentGifts),
      enquiries: out(enquiries),
      fundraisers: out(fundraisers),
      emailsCount,
      mergedFrom: out(mergedFrom),
    },
  })
})

r.patch('/:id', requireStaff('donors.write'), async (req, res) => {
  const d = await loadDonor(String(req.params.id))
  const body = parse(
    z
      .object({
        firstName: z.string().trim().min(1, 'Add a first name').max(60),
        lastName: z.string().trim().max(60),
        email: zEmail,
        altEmails: z.array(zEmail).max(20),
        phone: zPhone,
        address: zAddress,
        tags: z.array(zTag).max(30),
        notes: z.string().max(10_000),
        preferences: zPrefs,
        bankAliases: z.array(z.string().trim().min(1).max(120)).max(50),
      })
      .partial(),
    req.body,
  )
  if (d.status === 'merged') throw new HttpError(409, 'This record was merged into another one. Edit that record instead.')
  const oldName = fullName(d)
  if (body.email && body.email !== d.email) {
    const other = await emailOwner(body.email, d._id)
    if (other) throw new HttpError(409, 'Another donor already uses that email address.', { email: `Already on ${fullName(other)}’s record (${other.number}).`, existingId: String(other._id) })
  }
  const changed: string[] = []
  const LABELS: Record<string, string> = {
    firstName: 'first name', lastName: 'last name', email: 'email', altEmails: 'other emails', phone: 'phone', address: 'address',
    tags: 'tags', notes: 'notes', preferences: 'preferences', bankAliases: 'bank payer names',
  }
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue
    if (k === 'preferences') {
      for (const [pk, pv] of Object.entries(v as object)) d.set(`preferences.${pk}`, pv)
    } else if (k === 'address') {
      d.set('address', { ...(d.toObject().address ?? {}), ...(v as object) })
    } else if (k === 'phone') {
      d.set('phone', (v as string) || undefined)
    } else {
      d.set(k, v)
    }
    if (d.isModified(k)) changed.push(LABELS[k] ?? k)
  }
  if (body.email) {
    /* the old address stays findable: receipts and statements were sent there */
    d.altEmails = (d.altEmails ?? []).filter((e) => e !== body.email)
  }
  if (!changed.length) {
    res.json(out(await Donor.findById(d._id).select(PRIVATE).lean()))
    return
  }
  await d.save()
  if (body.firstName !== undefined || body.lastName !== undefined) {
    const name = fullName(d)
    await Promise.all([
      Gift.updateMany({ donor: d._id }, { $set: { donorName: name } }),
      Plan.updateMany({ donor: d._id }, { $set: { donorName: name } }),
    ])
  }
  if (['first name', 'last name', 'email', 'phone', 'address'].some((c) => changed.includes(c))) clearDuplicateCache()
  await audit(req, 'donor.update', `Updated ${changed.join(', ')} for ${oldName} (${d.number})`, { type: 'donor', id: d._id, label: d.number })
  res.json(out(await Donor.findById(d._id).select(PRIVATE).lean()))
})

r.get('/:id/gifts', requireStaff('donors.read'), async (req, res) => {
  const id = parse(zId, req.params.id)
  const { page, pageSize, skip } = paging(req.query)
  const filter: Record<string, unknown> = { donor: oid(id) }
  if (typeof req.query.status === 'string' && req.query.status) filter.status = req.query.status
  const sort = sorting(req.query, ['date', 'amount'], { date: -1 })
  const [items, total] = await Promise.all([Gift.find(filter).sort({ ...sort, _id: -1 }).skip(skip).limit(pageSize).lean(), Gift.countDocuments(filter)])
  res.json({ items: out(items), total, page, pageSize })
})

r.get('/:id/emails', requireStaff('donors.read'), async (req, res) => {
  const d = await loadDonor(String(req.params.id))
  const { page, pageSize, skip } = paging(req.query)
  const filter = { $or: [{ donor: d._id }, { to: { $in: [d.email, ...(d.altEmails ?? [])] } }] }
  const [items, total] = await Promise.all([
    EmailMessage.find(filter).select('-html -text').sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    EmailMessage.countDocuments(filter),
  ])
  res.json({ items: out(items), total, page, pageSize })
})

r.get('/:id/emails/:emailId', requireStaff('donors.read'), async (req, res) => {
  const d = await loadDonor(String(req.params.id))
  const m = await EmailMessage.findOne({
    _id: parse(zId, req.params.emailId),
    $or: [{ donor: d._id }, { to: { $in: [d.email, ...(d.altEmails ?? [])] } }],
  }).lean()
  if (!m) throw notFound('That email')
  res.json(out(m))
})

r.get('/:id/activity', requireStaff('donors.read'), async (req, res) => {
  const d = await loadDonor(String(req.params.id))
  const { page, pageSize, skip } = paging(req.query, { pageSize: 30, max: 100 })
  const merged = await Donor.find({ mergedInto: d._id }).distinct('_id')
  const [giftIds, planIds] = await Promise.all([Gift.find({ donor: d._id }).distinct('_id'), Plan.find({ donor: d._id }).distinct('_id')])
  const filter: Record<string, unknown> = {
    $or: [
      { 'entity.type': 'donor', 'entity.id': { $in: [d._id, ...merged] } },
      { 'entity.type': 'gift', 'entity.id': { $in: giftIds } },
      { 'entity.type': 'plan', 'entity.id': { $in: planIds } },
      { 'actor.kind': 'donor', 'actor.id': d._id },
    ],
  }
  const [items, total] = await Promise.all([
    AuditEvent.find(filter).select('-meta -ip').sort({ at: -1 }).skip(skip).limit(pageSize).lean(),
    AuditEvent.countDocuments(filter),
  ])
  res.json({ items: out(items), total, page, pageSize })
})

export default r
