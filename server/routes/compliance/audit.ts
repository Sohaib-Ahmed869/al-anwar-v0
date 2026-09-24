import { Router, type Request } from 'express'
import { requireStaff } from '../../lib/auth'
import { audit } from '../../lib/audit'
import { escapeRegex, isId, oid, out, paging } from '../../lib/http'
import { AuditEvent } from '../../models'
import { sendCsv, todayStr } from './registers'

/* ---------------------------------------------------------------------------
   /api/compliance/audit — the action log, read-only, for audit.read.

   Every row carries an `href` worked out here, so the trail can link a
   register change to the entry and a calendar change to the item without the
   portal knowing how each kind of record is addressed.

   Exporting the log is itself logged: an auditor asking "who took a copy of
   this, and when" gets an answer from the log.
--------------------------------------------------------------------------- */

const r = Router()
r.use(requireStaff('audit.read'))

function filterFrom(q: Request['query']) {
  const and: Record<string, unknown>[] = []
  const s = String(q.q ?? '').trim()
  if (s) {
    const re = new RegExp(escapeRegex(s), 'i')
    and.push({ $or: [{ summary: re }, { 'entity.label': re }, { 'actor.name': re }] })
  }
  const actor = String(q.actor ?? '')
  if (actor === 'system') and.push({ 'actor.kind': 'system' })
  else if (actor === 'donor') and.push({ 'actor.kind': 'donor' })
  else if (isId(actor)) and.push({ 'actor.id': oid(actor) })
  /* ?area=register,document → actions starting "register." or "document." */
  const areas = String(q.area ?? q.action ?? '').split(',').map((a) => a.trim().replace(/\.$/, '')).filter(Boolean)
  if (areas.length) and.push({ action: { $regex: `^(${areas.map(escapeRegex).join('|')})\\.` } })
  const range: Record<string, Date> = {}
  if (q.from) range.$gte = new Date(`${q.from}T00:00:00`)
  if (q.to) range.$lt = new Date(`${q.to}T00:00:00`)
  if (range.$gte && Number.isNaN(range.$gte.getTime())) delete range.$gte
  if (range.$lt && Number.isNaN(range.$lt.getTime())) delete range.$lt
  if (Object.keys(range).length) and.push({ at: range })
  const type = String(q.entity ?? '')
  if (type) and.push({ 'entity.type': type })
  return and.length ? { $and: and } : {}
}

type EventLean = {
  _id: unknown
  at: Date
  action: string
  entity?: { type?: string; id?: unknown; label?: string }
  meta?: Record<string, unknown>
  [k: string]: unknown
}

/** Where a person goes to see the thing an event is about. */
export function eventHref(e: EventLean): string | null {
  const id = e.entity?.id ? String(e.entity.id) : null
  switch (e.entity?.type) {
    case 'register-entry':
      return id && e.meta?.register ? `/compliance/registers/${e.meta.register}?id=${id}` : null
    case 'register':
      return e.meta?.register ? `/compliance/registers/${e.meta.register}` : null
    case 'obligation':
      return id ? `/compliance/calendar?item=${id}` : null
    case 'document':
      return id ? `/compliance/documents/${id}` : null
    case 'donor':
      return id ? `/admin/donors/${id}` : null
    default:
      return null
  }
}

export function eventView(e: EventLean) {
  const { meta, ...rest } = e
  const changes = Array.isArray(meta?.changes) ? meta.changes : undefined
  return { ...out<Record<string, unknown>>(rest), href: eventHref(e), ...(changes ? { changes } : {}) }
}

r.get('/', async (req, res) => {
  const { page, pageSize, skip } = paging(req.query, { pageSize: 50, max: 200 })
  const filter = filterFrom(req.query)
  const [rows, total, actors, actions] = await Promise.all([
    AuditEvent.find(filter).sort({ at: -1, _id: -1 }).skip(skip).limit(pageSize).lean<EventLean[]>(),
    AuditEvent.countDocuments(filter),
    AuditEvent.aggregate<{ _id: unknown; name: string; kind: string; n: number }>([
      { $match: { 'actor.kind': 'staff' } },
      { $group: { _id: '$actor.id', name: { $last: '$actor.name' }, kind: { $first: '$actor.kind' }, n: { $sum: 1 } } },
      { $sort: { name: 1 } },
      { $limit: 200 },
    ]),
    AuditEvent.distinct('action'),
  ])
  const areas = [...new Set((actions as string[]).map((a) => a.split('.')[0]!))].sort()
  res.json({
    items: rows.map(eventView),
    total,
    page,
    pageSize,
    actors: actors.map((a) => ({ id: String(a._id), name: a.name, count: a.n })),
    areas,
  })
})

r.get('/export', async (req, res) => {
  const filter = filterFrom(req.query)
  const rows = await AuditEvent.find(filter).sort({ at: -1 }).limit(50_000).lean<EventLean[]>()
  const lines = rows.map((e) => {
    const x = e as EventLean & { actor?: { name?: string; kind?: string }; summary?: string; ip?: string }
    return [
      e.at.toISOString(),
      x.actor?.name ?? '',
      e.action,
      e.entity ? [e.entity.type, e.entity.label].filter(Boolean).join(': ') : '',
      x.summary ?? '',
      x.ip ?? '',
    ]
  })
  const described = Object.keys(req.query).filter((k) => req.query[k]).length ? 'filtered ' : ''
  await audit(req, 'audit.export', `Exported the ${described}audit trail (${rows.length} events)`, { type: 'audit' }, { filters: req.query })
  sendCsv(res, `audit-trail-${todayStr()}.csv`, [['At', 'Actor', 'Action', 'Entity', 'Summary', 'IP'], ...lines])
})

export default r
