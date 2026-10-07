import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { REGISTERS, registerByKey, riskBand, riskScore, type RegisterDef } from '../../../shared/registers'
import { sydneyDay } from '../../../shared/domain'
import { requireStaff } from '../../lib/auth'
import { audit } from '../../lib/audit'
import { sendCsv as sendCsvFile, type CsvRow } from '../../lib/csv'
import { escapeRegex, HttpError, isId, notFound, out, paging, parse } from '../../lib/http'
import { AuditEvent, RegisterEntry } from '../../models'

/* ---------------------------------------------------------------------------
   /api/compliance/registers — the five ACNC registers, one set of routes.

   Everything about a register comes from its RegisterDef in
   shared/registers.ts: which fields exist, which are required, what a select
   may hold. The server checks every write against it and drops any key the
   definition does not name, so a register can never grow a column the portal
   does not know how to show or export.

   Dates in a register are stored as the plain `yyyy-mm-dd` the person typed,
   not as instants: "appointed 30 July 2020" is a day, not a moment, and a
   string compares correctly with today's date without timezone surprises.

   The small helpers at the bottom (today's date, CSV) are exported for the
   other compliance routes, which is why they live here and not in a lib file.
--------------------------------------------------------------------------- */

const r = Router()

type Fields = Record<string, string | number | boolean | null>
type EntryLean = { _id: unknown; register: string; fields: Fields; archived: boolean; updatedAt?: Date; createdAt?: Date }

function defOr404(raw: unknown): RegisterDef {
  const key = String(raw)
  const def = registerByKey(key)
  if (!def) throw notFound('That register')
  return def
}

/** An entry whose review date has passed — unless it is archived, or the
 *  thing it describes has ended (a director who has ceased, a closed risk). */
export function isReviewDue(def: RegisterDef, e: { fields: Fields; archived?: boolean }, today = todayStr()) {
  if (!def.reviewField || e.archived) return false
  if (e.fields.ceased) return false
  if (def.key === 'risks' && e.fields.status === 'closed') return false
  const v = e.fields[def.reviewField]
  return typeof v === 'string' && v !== '' && v < today
}

export const entryTitle = (def: RegisterDef, fields: Fields) => String(fields[def.titleField] ?? 'Untitled')

/** What the portal gets for an entry: the stored record plus the facts it
 *  would otherwise have to work out itself. */
export function entryView(def: RegisterDef, e: EntryLean) {
  const score = def.key === 'risks' ? riskScore(e.fields) : null
  return {
    ...out<Record<string, unknown>>(e),
    title: entryTitle(def, e.fields),
    reviewDue: isReviewDue(def, e),
    ...(def.key === 'risks' ? { riskScore: score, riskBand: riskBand(score) } : {}),
  }
}

/* ---------- validation against the definition ---------- */
const DATE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(def: RegisterDef, input: Record<string, unknown>): Fields {
  const clean: Fields = {}
  const errors: Record<string, string> = {}
  for (const f of def.fields) {
    let v = input[f.key]
    if (typeof v === 'string') v = v.trim()
    if (v === undefined || v === null || v === '') {
      if (f.required) errors[f.key] = `${f.label} is required.`
      clean[f.key] = null
      continue
    }
    switch (f.type) {
      case 'text':
      case 'textarea':
        if (typeof v !== 'string' && typeof v !== 'number') errors[f.key] = 'Must be text.'
        else if (String(v).length > (f.type === 'text' ? 300 : 5000)) errors[f.key] = 'That is too long.'
        else clean[f.key] = String(v)
        break
      case 'email':
        if (typeof v !== 'string' || !EMAIL.test(v)) errors[f.key] = 'That email address does not look right.'
        else clean[f.key] = v.toLowerCase()
        break
      case 'date': {
        const s = String(v)
        const d = new Date(`${s}T00:00:00Z`)
        if (!DATE.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) errors[f.key] = 'Use a real date.'
        else clean[f.key] = s
        break
      }
      case 'select': {
        const s = String(v)
        if (!f.options || !(s in f.options)) errors[f.key] = `Choose one of the ${f.label.toLowerCase()} options.`
        else clean[f.key] = s
        break
      }
      case 'number':
      case 'money': {
        const n = typeof v === 'number' ? v : Number(v)
        if (!Number.isFinite(n)) errors[f.key] = 'Must be a number.'
        else clean[f.key] = f.type === 'money' ? Math.round(n) : n
        break
      }
      case 'boolean':
        clean[f.key] = v === true || v === 'true'
        break
    }
  }
  if (Object.keys(errors).length) throw new HttpError(400, 'Some details need another look.', errors)
  return clean
}

/** How a value reads to a person: the select's label, not its key. */
export function displayValue(def: RegisterDef, key: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  const f = def.fields.find((x) => x.key === key)
  if (f?.type === 'select') return f.options?.[String(v)] ?? String(v)
  if (f?.type === 'boolean') return v ? 'Yes' : 'No'
  if (f?.type === 'money') return (Number(v) / 100).toFixed(2)
  return String(v)
}

const zBody = z.object({ fields: z.record(z.string(), z.unknown()) })

/* ---------- list ---------- */
function listFilter(def: RegisterDef, q: Request['query']) {
  const filter: Record<string, unknown> = { register: def.key }
  if (q.archived !== '1') filter.archived = { $ne: true }
  const s = String(q.q ?? '').trim()
  if (s) {
    const re = new RegExp(escapeRegex(s), 'i')
    filter.$or = def.fields.filter((f) => ['text', 'textarea', 'email'].includes(f.type)).map((f) => ({ [`fields.${f.key}`]: re }))
  }
  /* any select field can be filtered by name: ?status=open&likelihood=4 */
  for (const f of def.fields) {
    if (f.type !== 'select') continue
    const v = q[f.key]
    if (typeof v === 'string' && v) filter[`fields.${f.key}`] = { $in: v.split(',') }
  }
  return filter
}

r.get('/', async (_req, res) => {
  const counts = await RegisterEntry.aggregate<{ _id: string; n: number }>([
    { $match: { archived: { $ne: true } } },
    { $group: { _id: '$register', n: { $sum: 1 } } },
  ])
  res.json(REGISTERS.map((d) => ({ key: d.key, label: d.label, count: counts.find((c) => c._id === d.key)?.n ?? 0 })))
})

r.get('/:key', async (req, res) => {
  const def = defOr404(req.params.key)
  const { page, pageSize, skip } = paging(req.query, { pageSize: 100, max: 500 })
  const sortKey = String(req.query.sort ?? '').replace(/^-/, '')
  const dir = String(req.query.sort ?? '').startsWith('-') ? -1 : 1
  const sort: Record<string, 1 | -1> =
    sortKey === 'updatedAt' ? { updatedAt: dir } : def.fields.some((f) => f.key === sortKey) ? { [`fields.${sortKey}`]: dir } : { [`fields.${def.titleField}`]: 1 }
  const filter = listFilter(def, req.query)
  const [rows, total, archived] = await Promise.all([
    RegisterEntry.find(filter).sort(sort).skip(skip).limit(pageSize).lean<EntryLean[]>(),
    RegisterEntry.countDocuments(filter),
    RegisterEntry.countDocuments({ register: def.key, archived: true }),
  ])
  let items = rows.map((e) => entryView(def, e))
  /* ?reviewDue=1 is computed, so it filters after the query; registers are small */
  if (req.query.reviewDue === '1') items = items.filter((e) => e.reviewDue)
  res.json({ items, total: req.query.reviewDue === '1' ? items.length : total, page, pageSize, archived })
})

r.get('/:key/export', async (req, res) => {
  const def = defOr404(req.params.key)
  const rows = await RegisterEntry.find(listFilter(def, req.query)).sort({ [`fields.${def.titleField}`]: 1 }).lean<EntryLean[]>()
  const header = [...def.fields.map((f) => f.label), ...(def.key === 'risks' ? ['Risk score'] : []), 'Review due', 'Archived', 'Last updated']
  const lines = rows.map((e) => [
    ...def.fields.map((f) => displayValue(def, f.key, e.fields[f.key])),
    ...(def.key === 'risks' ? [String(riskScore(e.fields) ?? '')] : []),
    isReviewDue(def, e) ? 'Yes' : '',
    e.archived ? 'Yes' : '',
    e.updatedAt ? sydneyDay(e.updatedAt) : '',
  ])
  await audit(req, 'register.export', `Exported the ${def.label} register (${rows.length} entries)`, { type: 'register', label: def.label }, { register: def.key })
  sendCsv(res, `${def.key}-${todayStr()}.csv`, [header, ...lines])
})

r.get('/:key/:id', async (req, res) => {
  const def = defOr404(req.params.key)
  if (!isId(req.params.id)) throw notFound('That entry')
  const e = await RegisterEntry.findOne({ _id: String(req.params.id), register: def.key }).lean<EntryLean>()
  if (!e) throw notFound('That entry')
  const history = await AuditEvent.find({ 'entity.type': 'register-entry', 'entity.id': e._id as never }).sort({ at: -1 }).limit(100).lean()
  res.json({ ...entryView(def, e), history: out(history) })
})

/* ---------- writes ---------- */
r.post('/:key', requireStaff('compliance.write'), async (req, res) => {
  const def = defOr404(req.params.key)
  const { fields } = parse(zBody, req.body)
  const clean = validate(def, fields)
  const e = await RegisterEntry.create({ register: def.key, fields: clean, updatedBy: req.staff!._id, updatedByName: req.staff!.name })
  const title = entryTitle(def, clean)
  await audit(req, 'register.create', `Added ${title} to the ${def.label} register`, { type: 'register-entry', id: e._id, label: title }, { register: def.key })
  res.status(201).json(entryView(def, e.toObject() as EntryLean))
})

r.patch('/:key/:id', requireStaff('compliance.write'), async (req, res) => {
  const def = defOr404(req.params.key)
  if (!isId(req.params.id)) throw notFound('That entry')
  const e = await RegisterEntry.findOne({ _id: String(req.params.id), register: def.key })
  if (!e) throw notFound('That entry')
  const { fields } = parse(zBody, req.body)
  const before = (e.fields ?? {}) as Fields
  /* a PATCH may send only what changed; the rest stays as it was */
  const clean = validate(def, { ...before, ...fields })
  const changes = def.fields
    .filter((f) => (before[f.key] ?? null) !== (clean[f.key] ?? null))
    .map((f) => ({ field: f.key, label: f.label, from: displayValue(def, f.key, before[f.key]), to: displayValue(def, f.key, clean[f.key]) }))
  if (!changes.length) {
    res.json(entryView(def, e.toObject() as EntryLean))
    return
  }
  e.fields = clean
  e.markModified('fields')
  e.updatedBy = req.staff!._id
  e.updatedByName = req.staff!.name
  await e.save()
  const title = entryTitle(def, clean)
  await audit(
    req,
    'register.update',
    `Updated ${title} in the ${def.label} register: ${changes.map((c) => c.label.toLowerCase()).join(', ')}`,
    { type: 'register-entry', id: e._id, label: title },
    { register: def.key, changes },
  )
  res.json(entryView(def, e.toObject() as EntryLean))
})

for (const [verb, archived] of [['archive', true], ['restore', false]] as const) {
  r.post(`/:key/:id/${verb}`, requireStaff('compliance.write'), async (req, res) => {
    const def = defOr404(req.params.key as string)
    if (!isId(req.params.id)) throw notFound('That entry')
    const e = await RegisterEntry.findOne({ _id: String(req.params.id), register: def.key })
    if (!e) throw notFound('That entry')
    if (e.archived !== archived) {
      e.archived = archived
      e.updatedBy = req.staff!._id
      e.updatedByName = req.staff!.name
      await e.save()
      const title = entryTitle(def, e.fields as Fields)
      await audit(
        req,
        `register.${verb}`,
        archived ? `Archived ${title} in the ${def.label} register` : `Restored ${title} to the ${def.label} register`,
        { type: 'register-entry', id: e._id, label: title },
        { register: def.key },
      )
    }
    res.json(entryView(def, e.toObject() as EntryLean))
  })
}

export default r

/* ---------- helpers the other compliance routes share ---------- */

/** Today as yyyy-mm-dd in the server's local time. */
export function todayStr(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function startOfToday() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** The registers and the audit trail export through lib/csv.ts like every
 *  other file, so one rule decides what Excel could run as a formula (this
 *  file used to keep its own copy, which let "-1+…" through). With a BOM, so
 *  Excel opens it as UTF-8 and names keep their accents. */
export function sendCsv(res: Response, filename: string, rows: unknown[][]) {
  sendCsvFile(res, filename, rows as CsvRow[])
}
