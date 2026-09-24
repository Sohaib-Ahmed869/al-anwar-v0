import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { extname } from 'node:path'
import { DOCUMENT_CATEGORIES } from '../../../shared/domain'
import { requireStaff } from '../../lib/auth'
import { audit } from '../../lib/audit'
import { badRequest, escapeRegex, HttpError, isId, notFound, out, paging, parse } from '../../lib/http'
import { getFile, newKey, putFile } from '../../lib/storage'
import { LibraryDocument, Staff, type LibraryDocumentDoc } from '../../models'

/* ---------------------------------------------------------------------------
   /api/compliance/documents — the document library.

   A document is a title with a stack of versions; uploading a new version
   never replaces the old file, so the library can always show what the
   policy said on the day someone read it.

   "Who has read what" is kept as acknowledgements against a version number.
   A new version therefore makes the document unread for everybody without
   touching anyone's history: their ack for v2 still says they read v2.

   Files stream back through here (not a public URL) so the library's
   permissions apply to every download, and every download is logged.
--------------------------------------------------------------------------- */

const r = Router()

const MAX_BYTES = 20 * 1024 * 1024
const ALLOWED = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.rtf', '.odt', '.ods', '.ppt', '.pptx', '.png', '.jpg', '.jpeg', '.webp', '.md'])

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.txt': 'text/plain', '.md': 'text/plain', '.csv': 'text/csv',
}

/* multer's own errors ("File too large") become the portal's plain-English 400s */
function single(req: Request, res: Response, next: NextFunction) {
  multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } }).single('file')(req, res, (err: unknown) => {
    if (!err) return next()
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE')
      return next(new HttpError(413, 'That file is larger than 20 MB.', { file: 'Files can be up to 20 MB.' }))
    next(new HttpError(400, 'The file could not be read. Please try again.', { file: 'Please choose the file again.' }))
  })
}

function takeFile(req: Request) {
  const f = req.file
  if (!f) throw badRequest('Choose a file to upload.', { file: 'Choose a file to upload.' })
  const ext = extname(f.originalname).toLowerCase()
  if (!ALLOWED.has(ext)) throw badRequest('That kind of file cannot go in the library.', { file: 'PDF, Word, Excel, PowerPoint, text or image files only.' })
  /* the browser's idea of the type is kept, unless it is missing or vague */
  const mime = f.mimetype && f.mimetype !== 'application/octet-stream' ? f.mimetype : (MIME[ext] ?? 'application/octet-stream')
  return { buffer: f.buffer, name: f.originalname.replace(/[\\/]/g, '_').slice(0, 200), size: f.size, mime }
}

const bool = z.preprocess((v) => v === true || v === 'true' || v === '1' || v === 'on', z.boolean())
const zCategory = z.enum(Object.keys(DOCUMENT_CATEGORIES) as [string, ...string[]])

async function activeStaffCount() {
  return Staff.countDocuments({ active: true })
}

type DocLean = {
  _id: unknown
  versions: { n: number; fileKey?: string; [k: string]: unknown }[]
  acks: { staff?: unknown; version?: number | null; [k: string]: unknown }[]
  requiresAck?: boolean | null
  [k: string]: unknown
}

/** A list row: the latest version's facts, whether I have read it, and how
 *  many people have read the latest version. File keys never leave here. */
function summary(d: DocLean, me: string, staffCount: number) {
  const latest = d.versions[d.versions.length - 1]
  const n = latest?.n ?? 0
  const mine = d.acks.filter((a) => String(a.staff) === me).reduce((m, a) => Math.max(m, a.version ?? 0), 0)
  const readers = new Set(d.acks.filter((a) => a.version === n).map((a) => String(a.staff)))
  const { versions, acks, ...rest } = d
  void acks
  const strip = (v: DocLean['versions'][number]) => {
    const { fileKey, ...x } = v
    void fileKey
    return x
  }
  return {
    ...out<Record<string, unknown>>(rest),
    latest: latest ? out(strip(latest)) : null,
    versionCount: versions.length,
    myAckVersion: mine || null,
    ackedByMe: mine === n && n > 0,
    toRead: Boolean(d.requiresAck) && n > 0 && mine !== n,
    ackCount: readers.size,
    staffCount,
  }
}

async function load(raw: unknown) {
  const id = String(raw)
  if (!isId(id)) throw notFound('That document')
  const d = await LibraryDocument.findById(id)
  if (!d) throw notFound('That document')
  return d
}

/* ---------- reads ---------- */
r.get('/', async (req, res) => {
  const { page, pageSize, skip } = paging(req.query, { pageSize: 100, max: 200 })
  const filter: Record<string, unknown> = { archived: req.query.archived === '1' ? true : { $ne: true } }
  const cats = String(req.query.category ?? '').split(',').filter(Boolean)
  if (cats.length) filter.category = { $in: cats }
  const s = String(req.query.q ?? '').trim()
  if (s) {
    const re = new RegExp(escapeRegex(s), 'i')
    filter.$or = [{ title: re }, { description: re }, { 'versions.fileName': re }]
  }
  if (req.query.requiresAck === '1') filter.requiresAck = true
  const sort: Record<string, 1 | -1> = req.query.sort === 'title' ? { title: 1 } : { updatedAt: -1 }
  const me = String(req.staff!._id)
  const [rows, total, staffCount] = await Promise.all([
    LibraryDocument.find(filter).sort(sort).skip(skip).limit(pageSize).lean<DocLean[]>(),
    LibraryDocument.countDocuments(filter),
    activeStaffCount(),
  ])
  let items = rows.map((d) => summary(d, me, staffCount))
  if (req.query.toRead === '1') items = items.filter((d) => d.toRead)
  res.json({ items, total, page, pageSize })
})

r.get('/:id', async (req, res) => {
  const d = await load(req.params.id)
  const lean = d.toObject() as unknown as DocLean
  const staff = await Staff.find({ active: true }, { name: 1, role: 1 }).sort({ name: 1 }).lean()
  const n = d.versions[d.versions.length - 1]?.n ?? 0
  const readers = staff.map((s) => {
    const mine = d.acks.filter((a) => String(a.staff) === String(s._id))
    const best = mine.reduce<(typeof mine)[number] | null>((m, a) => (!m || (a.version ?? 0) > (m.version ?? 0) ? a : m), null)
    return {
      id: String(s._id),
      name: s.name,
      role: s.role,
      version: best?.version ?? null,
      at: best?.at ?? null,
      current: Boolean(best && best.version === n),
    }
  })
  res.json({
    ...summary(lean, String(req.staff!._id), staff.length),
    versions: out(d.versions.map((v) => ({ n: v.n, fileName: v.fileName, size: v.size, mime: v.mime, uploadedByName: v.uploadedByName, uploadedAt: v.uploadedAt, note: v.note })).reverse()),
    acks: out([...(lean.acks as { at?: Date }[])].sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))),
    readers: out(readers),
  })
})

r.get('/:id/file', async (req, res) => {
  const d = await load(req.params.id)
  const want = Number(req.query.v) || d.versions[d.versions.length - 1]?.n
  const v = d.versions.find((x) => x.n === want)
  if (!v) throw notFound('That version')
  let body: Buffer
  try {
    body = await getFile(v.fileKey)
  } catch {
    throw new HttpError(404, 'The file for this version is missing from storage.')
  }
  await audit(req, 'document.download', `Opened ${d.title} v${v.n}`, { type: 'document', id: d._id, label: d.title }, { version: v.n })
  const disposition = req.query.download === '1' ? 'attachment' : 'inline'
  const ascii = v.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'")
  res.setHeader('Content-Type', v.mime || 'application/octet-stream')
  res.setHeader('Content-Length', String(body.length))
  res.setHeader('Content-Disposition', `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(v.fileName)}`)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'private, no-store')
  res.send(body)
})

/* ---------- writes ---------- */
r.post('/', requireStaff('compliance.write'), single, async (req, res) => {
  const b = parse(
    z.object({
      title: z.string().trim().min(2, 'Give the document a title').max(200),
      category: zCategory,
      description: z.string().trim().max(2000).optional(),
      requiresAck: bool.optional(),
    }),
    req.body,
  )
  const f = takeFile(req)
  const key = newKey('documents', f.name)
  await putFile(key, f.buffer, f.mime)
  const d = await LibraryDocument.create({
    title: b.title,
    category: b.category,
    description: b.description || undefined,
    requiresAck: b.requiresAck ?? false,
    versions: [{ n: 1, fileKey: key, fileName: f.name, size: f.size, mime: f.mime, uploadedBy: req.staff!._id, uploadedByName: req.staff!.name, uploadedAt: new Date() }],
  })
  await audit(req, 'document.create', `Uploaded ${d.title} to the document library (${DOCUMENT_CATEGORIES[b.category as keyof typeof DOCUMENT_CATEGORIES]})`, {
    type: 'document', id: d._id, label: d.title,
  })
  res.status(201).json({ id: String(d._id) })
})

r.post('/:id/versions', requireStaff('compliance.write'), single, async (req, res) => {
  const d = await load(req.params.id)
  const b = parse(z.object({ note: z.string().trim().max(1000).optional() }), req.body)
  const f = takeFile(req)
  const key = newKey('documents', f.name)
  await putFile(key, f.buffer, f.mime)
  const n = (d.versions[d.versions.length - 1]?.n ?? 0) + 1
  d.versions.push({ n, fileKey: key, fileName: f.name, size: f.size, mime: f.mime, uploadedBy: req.staff!._id, uploadedByName: req.staff!.name, uploadedAt: new Date(), note: b.note || undefined })
  await d.save()
  await audit(req, 'document.version', `Uploaded version ${n} of ${d.title}${b.note ? `: ${b.note}` : ''}`, { type: 'document', id: d._id, label: d.title }, { version: n })
  res.status(201).json({ n })
})

r.post('/:id/ack', async (req, res) => {
  const d = await load(req.params.id)
  const n = d.versions[d.versions.length - 1]?.n
  if (!n) throw badRequest('This document has no file yet.')
  if (d.archived) throw badRequest('This document is archived.')
  const me = req.staff!
  if (!d.acks.some((a) => String(a.staff) === String(me._id) && a.version === n)) {
    d.acks.push({ staff: me._id, name: me.name, version: n, at: new Date() })
    await d.save()
    await audit(req, 'document.ack', `Confirmed reading ${d.title} v${n}`, { type: 'document', id: d._id, label: d.title }, { version: n })
  }
  res.json({ ok: true, version: n })
})

r.patch('/:id', requireStaff('compliance.write'), async (req, res) => {
  const d = await load(req.params.id)
  const b = parse(
    z.object({
      title: z.string().trim().min(2, 'Give the document a title').max(200).optional(),
      category: zCategory.optional(),
      description: z.string().trim().max(2000).optional().nullable(),
      requiresAck: z.boolean().optional(),
    }),
    req.body,
  )
  const changed: string[] = []
  const was = d.title
  if (b.title !== undefined && b.title !== d.title) (d.title = b.title), changed.push(`title (was ${was})`)
  if (b.category !== undefined && b.category !== d.category) (d.category = b.category), changed.push('category')
  if (b.description !== undefined && (b.description ?? '') !== (d.description ?? '')) (d.description = b.description || undefined), changed.push('description')
  if (b.requiresAck !== undefined && b.requiresAck !== d.requiresAck) {
    d.requiresAck = b.requiresAck
    changed.push(b.requiresAck ? 'now needs everyone to confirm reading it' : 'no longer needs confirming')
  }
  if (changed.length) {
    await d.save()
    await audit(req, 'document.update', `Updated ${d.title}: ${changed.join(', ')}`, { type: 'document', id: d._id, label: d.title })
  }
  res.json({ ok: true })
})

async function setArchived(req: Request, d: LibraryDocumentDoc, archived: boolean) {
  if (d.archived === archived) return
  d.archived = archived
  await d.save()
  await audit(req, archived ? 'document.archive' : 'document.restore', archived ? `Archived ${d.title}` : `Restored ${d.title} to the library`, {
    type: 'document', id: d._id, label: d.title,
  })
}
r.post('/:id/archive', requireStaff('compliance.write'), async (req, res) => {
  await setArchived(req, await load(req.params.id), true)
  res.json({ ok: true })
})
r.post('/:id/restore', requireStaff('compliance.write'), async (req, res) => {
  await setArchived(req, await load(req.params.id), false)
  res.json({ ok: true })
})

export default r
