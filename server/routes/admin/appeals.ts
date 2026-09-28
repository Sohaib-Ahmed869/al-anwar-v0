import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { Types } from 'mongoose'
import { z } from 'zod'
import { APPEAL_STATUSES, COUNTRIES, DESIGNATIONS, type AppealStatus } from '../../../shared/domain'
import { Appeal, Fundraiser, Gift } from '../../models'
import { audit } from '../../lib/audit'
import { requireStaff, requireStaffAny, staffCan } from '../../lib/auth'
import { badRequest, HttpError, notFound, out, paging, parse, searchRegex, sorting, zDate } from '../../lib/http'
import { newKey, putFile } from '../../lib/storage'

/* ---------------------------------------------------------------------------
   /api/admin/appeals — the appeals the website shows and gifts count towards.

   `raised` and `donorCount` on an appeal are kept current by lib/stats.ts
   from the gifts themselves; this file never writes them. Closing an appeal
   only stops NEW gifts — the page stays up with its total and its updates,
   and every gift already given keeps pointing at it, because the proposal
   says "closing keeps page & history".

   The list is also what the shared AppealSelect (and the gift, plan and bank
   screens that use it) reads, as `?status=open&pageSize=200`, so it has to
   stay cheap: the 30-day figure is one aggregation over the page's ids.
   Because gifts, plans, bank import and reports all pick an appeal, the
   list alone is open to those roles too — but without appeals.manage it
   returns only what a picker needs (id, title, slug, status, country).
   Everything else here needs appeals.manage.
--------------------------------------------------------------------------- */

const r = Router()
const manage = requireStaff('appeals.manage')

const STATUSES = Object.keys(APPEAL_STATUSES) as [AppealStatus, ...AppealStatus[]]
const DAY = 86_400_000

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'appeal'

async function uniqueSlug(base: string, except?: Types.ObjectId) {
  let slug = base
  for (let n = 2; await Appeal.exists({ slug, ...(except ? { _id: { $ne: except } } : {}) }); n++) slug = `${base}-${n}`
  return slug
}

const label = (a: { title: string }) => a.title

/* ---------- list ---------- */
const PICK = ['appeals.manage', 'gifts.read', 'gifts.create', 'plans.manage', 'bank.import', 'reports.read'] as const

r.get('/', requireStaffAny(...PICK), async (req, res) => {
  const { page, pageSize, skip } = paging(req.query, { pageSize: 24, max: 200 })
  const filter: Record<string, unknown> = {}
  const status = String(req.query.status ?? '')
  if ((STATUSES as string[]).includes(status)) filter.status = status
  const rx = searchRegex(req.query.q)
  if (rx) filter.$or = [{ title: rx }, { slug: rx }, { where: rx }, { country: rx }]
  const sort = sorting(req.query, ['createdAt', 'title', 'raised', 'target', 'closesAt', 'donorCount'], { featured: -1, createdAt: -1 })
  const full = staffCan(req, 'appeals.manage')

  const [items, total, counts] = await Promise.all([
    Appeal.find(filter).select(full ? '-story -updates' : 'title slug status country').sort(sort).skip(skip).limit(pageSize).lean(),
    Appeal.countDocuments(filter),
    Appeal.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ])
  if (!full) return void res.json({ items: out(items), total, page, pageSize, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) })
  const recent = await Gift.aggregate<{ _id: Types.ObjectId; total: number }>([
    { $match: { appeal: { $in: items.map((a) => a._id) }, status: 'succeeded', date: { $gte: new Date(Date.now() - 30 * DAY) } } },
    { $group: { _id: '$appeal', total: { $sum: '$amount' } } },
  ])
  const last30 = new Map(recent.map((x) => [String(x._id), x.total]))
  res.json({
    items: out<Record<string, unknown>[]>(items).map((a) => ({ ...a, updates: [], story: '', raisedLast30: last30.get(String(a.id)) ?? 0 })),
    total,
    page,
    pageSize,
    counts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
  })
})

/* ---------- one appeal, with how it is doing ---------- */
r.get('/:id', manage, async (req, res) => {
  const a = await Appeal.findById(req.params.id).lean()
  if (!a) throw notFound('That appeal')
  /* days are Sydney days, whatever timezone the server runs in */
  const sydney = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  const since = new Date(Date.now() - 90 * DAY)
  const [daily, recentGifts, designations, fundraisers, last30] = await Promise.all([
    Gift.aggregate<{ _id: string; total: number; count: number }>([
      { $match: { appeal: a._id, status: 'succeeded', date: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Australia/Sydney' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Gift.find({ appeal: a._id, status: 'succeeded' })
      .sort({ date: -1 })
      .limit(10)
      .select('number donor donorName amount designation method date anonymous fundraiserTitle')
      .lean(),
    Gift.aggregate<{ _id: string; total: number; count: number }>([
      { $match: { appeal: a._id, status: 'succeeded' } },
      { $group: { _id: '$designation', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    Fundraiser.find({ appeal: a._id }).sort({ raised: -1 }).select('title slug ownerName status raised target donorCount').lean(),
    Gift.aggregate<{ total: number; count: number }>([
      { $match: { appeal: a._id, status: 'succeeded', date: { $gte: new Date(Date.now() - 30 * DAY) } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ])
  const byDay = new Map(daily.map((d) => [d._id, d]))
  const series = Array.from({ length: 90 }, (_, i) => {
    const key = sydney(new Date(Date.now() - (89 - i) * DAY))
    return { date: key, total: byDay.get(key)?.total ?? 0, count: byDay.get(key)?.count ?? 0 }
  })
  res.json({
    appeal: { ...out<Record<string, unknown>>(a), raisedLast30: last30[0]?.total ?? 0 },
    daily: series,
    giftsLast30: last30[0]?.count ?? 0,
    recentGifts: out(recentGifts),
    designations: designations.map((d) => ({
      designation: d._id,
      label: DESIGNATIONS[d._id as keyof typeof DESIGNATIONS]?.label ?? d._id,
      total: d.total,
      count: d.count,
    })),
    fundraisers: out(fundraisers),
  })
})

/* ---------- create and edit ---------- */
const zSlug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'At least two characters')
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lower-case letters, numbers and single hyphens only')

const zAppeal = z.object({
  title: z.string().trim().min(3, 'Give the appeal a title').max(120),
  slug: zSlug.optional(),
  summary: z.string().trim().max(400, 'Keep the summary under 400 characters').optional(),
  story: z.string().max(20_000).optional(),
  country: z.string({ error: 'Choose a country' }).refine((c) => c in COUNTRIES, 'Choose a country'),
  where: z.string().trim().max(120).optional().nullable(),
  causes: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  zakatEligible: z.boolean().optional(),
  target: z.number().int('Whole cents').min(0).max(1_000_000_000).optional(),
  opensAt: zDate.nullable().optional(),
  closesAt: zDate.nullable().optional(),
  featured: z.boolean().optional(),
  suggested: z
    .array(z.object({ amount: z.number().int().positive('Must be more than zero').max(100_000_000), label: z.string().trim().max(60).optional() }))
    .max(8, 'Up to eight suggested amounts')
    .optional(),
  unit: z
    .object({
      name: z.string().trim().min(1, 'Name the unit').max(40),
      plural: z.string().trim().min(1, 'And its plural').max(40),
      price: z.number().int().positive('Must be more than zero'),
    })
    .nullable()
    .optional(),
})

function checkDates(v: { opensAt?: Date | null; closesAt?: Date | null }) {
  if (v.opensAt && v.closesAt && v.closesAt <= v.opensAt) throw badRequest('The closing date is before it opens.', { closesAt: 'Must be after the opening date' })
}

r.post('/', manage, async (req, res) => {
  const body = parse(zAppeal, req.body)
  checkDates(body)
  const slug = await uniqueSlug(body.slug || slugify(body.title))
  const a = await Appeal.create({ ...body, slug, unit: body.unit ?? undefined, status: 'draft' })
  await audit(req, 'appeal.create', `Created the appeal “${a.title}” as a draft`, { type: 'appeal', id: a._id, label: label(a) })
  res.status(201).json(out(a.toObject()))
})

r.patch('/:id', manage, async (req, res) => {
  const a = await Appeal.findById(req.params.id)
  if (!a) throw notFound('That appeal')
  const body = parse(zAppeal.partial(), req.body)
  checkDates({ opensAt: body.opensAt === undefined ? a.opensAt : body.opensAt, closesAt: body.closesAt === undefined ? a.closesAt : body.closesAt })
  if (body.slug && body.slug !== a.slug && (await Appeal.exists({ slug: body.slug, _id: { $ne: a._id } }))) {
    throw badRequest('That web address is taken.', { slug: 'Another appeal already uses this address' })
  }
  const before = a.toObject()
  const changed: string[] = []
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue
    const prev = (before as Record<string, unknown>)[k]
    if (JSON.stringify(prev ?? null) === JSON.stringify(v ?? null)) continue
    changed.push(k)
    a.set(k, v === null ? undefined : v)
  }
  if (changed.length) {
    await a.save()
    await audit(req, 'appeal.update', `Edited the appeal “${a.title}” (${changed.join(', ')})`, { type: 'appeal', id: a._id, label: label(a) }, { changed })
  }
  res.json(out(a.toObject()))
})

r.post('/:id/status', manage, async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(STATUSES) }), req.body)
  const a = await Appeal.findById(req.params.id)
  if (!a) throw notFound('That appeal')
  if (a.status === status) return void res.json(out(a.toObject()))
  const was = a.status
  a.status = status
  if (status === 'open' && !a.opensAt) a.opensAt = new Date()
  if (status === 'closed' && (!a.closesAt || a.closesAt > new Date())) a.closesAt = new Date()
  if (status === 'open' && a.closesAt && a.closesAt <= new Date()) a.closesAt = undefined
  await a.save()
  const verb = status === 'open' ? (was === 'closed' ? 'Reopened' : 'Opened') : status === 'closed' ? 'Closed' : 'Moved back to draft'
  await audit(
    req,
    `appeal.${status === 'open' ? 'open' : status === 'closed' ? 'close' : 'draft'}`,
    `${verb} the appeal “${a.title}”${status === 'closed' ? ' — no new donations; the page and its history stay' : ''}`,
    { type: 'appeal', id: a._id, label: label(a) },
  )
  res.json(out(a.toObject()))
})

/* ---------- updates on the appeal page ---------- */
r.post('/:id/updates', manage, async (req, res) => {
  const body = parse(
    z.object({
      title: z.string().trim().min(3, 'Give the update a title').max(120),
      body: z.string().trim().min(10, 'Say a little more').max(5000),
      date: zDate.optional(),
    }),
    req.body,
  )
  const a = await Appeal.findById(req.params.id)
  if (!a) throw notFound('That appeal')
  a.updates.unshift({ title: body.title, body: body.body, date: body.date ?? new Date() })
  a.updates.sort((x, y) => new Date(y.date ?? 0).getTime() - new Date(x.date ?? 0).getTime())
  await a.save()
  await audit(req, 'appeal.update', `Posted the update “${body.title}” on “${a.title}”`, { type: 'appeal', id: a._id, label: label(a) })
  res.status(201).json(out(a.toObject()))
})

r.delete('/:id/updates/:uid', manage, async (req, res) => {
  const a = await Appeal.findById(req.params.id)
  if (!a) throw notFound('That appeal')
  const u = a.updates.find((x) => String(x._id) === req.params.uid)
  if (!u) throw notFound('That update')
  a.updates.pull(u._id)
  await a.save()
  await audit(req, 'appeal.update', `Removed the update “${u.title}” from “${a.title}”`, { type: 'appeal', id: a._id, label: label(a) })
  res.json(out(a.toObject()))
})

/* ---------- the photograph ---------- */
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } }).single('file')

/* multer reports a too-big file as its own error type; turn it into the
   400 with words the uploader shows */
const receive = (req: Request, res: Response) =>
  new Promise<void>((resolve, reject) =>
    upload(req, res, (err: unknown) => {
      if (!err) return resolve()
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return reject(badRequest('That photo is over 8 MB. Export a smaller copy and try again.'))
      reject(err instanceof multer.MulterError ? badRequest('That upload did not work. Try again with one photo.') : err)
    }),
  )

r.post('/:id/image', manage, async (req, res) => {
  const a = await Appeal.findById(req.params.id)
  if (!a) throw notFound('That appeal')
  await receive(req, res)
  const f = req.file
  if (!f) throw badRequest('Choose a photo to upload.')
  const ext = IMAGE_TYPES[f.mimetype]
  if (!ext) throw new HttpError(415, 'Use a JPG, PNG or WebP photo.')
  const key = newKey('images', `photo${ext}`)
  await putFile(key, f.buffer, f.mimetype)
  a.image = `/api/files/${key}`
  await a.save()
  await audit(req, 'appeal.image', `Changed the photo on “${a.title}”`, { type: 'appeal', id: a._id, label: label(a) })
  res.json(out(a.toObject()))
})

export default r
