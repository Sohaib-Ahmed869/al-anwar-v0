import { Router, type Request } from 'express'
import { sydneyDay } from '../../../shared/domain'
import { AuditEvent } from '../../models'
import { requireStaff } from '../../lib/auth'
import { audit } from '../../lib/audit'
import { sendCsv, type CsvRow } from '../../lib/csv'
import { escapeRegex, isId, oid, out, paging, searchRegex } from '../../lib/http'

/* ---------------------------------------------------------------------------
   /api/admin/activity — the action log, read-only (there is no route that
   could change it; see models/AuditEvent.ts).

   Filters: `q` (the summary, the actor's name or the thing it was done to),
   `actor` (a staff id, or "system" / "donor"), `area` (one or more action
   prefixes, comma-separated: "gift,donor" matches gift.* and donor.*), and
   `from`/`to` (to exclusive, as every date range in the API).

   The CSV export takes the same filters and writes every matching row, with
   the date in Sydney time, because it is read by auditors, not machines.
--------------------------------------------------------------------------- */

const r = Router()
r.use(requireStaff('audit.read'))

function filterOf(req: Request) {
  const f: Record<string, unknown> = {}
  const rx = searchRegex(req.query.q)
  if (rx) f.$or = [{ summary: rx }, { 'actor.name': rx }, { 'entity.label': rx }, { action: rx }]
  const actor = String(req.query.actor ?? '')
  if (isId(actor)) f['actor.id'] = oid(actor)
  else if (actor === 'system' || actor === 'donor') f['actor.kind'] = actor
  const areas = String(req.query.area ?? '')
    .split(',')
    .map((a) => a.trim().replace(/\.$/, ''))
    .filter((a) => /^[a-z_]+$/.test(a))
  if (areas.length) f.action = { $regex: `^(${areas.map(escapeRegex).join('|')})\\.` }
  const at: Record<string, Date> = {}
  const from = req.query.from ? new Date(String(req.query.from)) : null
  const to = req.query.to ? new Date(String(req.query.to)) : null
  if (from && !isNaN(+from)) at.$gte = from
  if (to && !isNaN(+to)) at.$lt = to
  if (Object.keys(at).length) f.at = at
  return f
}

r.get('/', async (req, res) => {
  const { page, pageSize, skip } = paging(req.query, { pageSize: 50, max: 200 })
  const f = filterOf(req)
  const [items, total] = await Promise.all([
    AuditEvent.find(f).sort({ at: -1, _id: -1 }).skip(skip).limit(pageSize).select('-meta').lean(),
    AuditEvent.countDocuments(f),
  ])
  res.json({ items: out(items), total, page, pageSize })
})

/** Everyone who appears in the log, for the actor filter — the log's readers
 *  (compliance) cannot necessarily list staff. */
r.get('/actors', async (_req, res) => {
  const rows = await AuditEvent.aggregate<{ _id: unknown; name: string; kind: string; n: number }>([
    { $match: { 'actor.kind': 'staff' } },
    { $group: { _id: '$actor.id', name: { $last: '$actor.name' }, kind: { $first: '$actor.kind' }, n: { $sum: 1 } } },
    { $sort: { name: 1 } },
  ])
  res.json(rows.filter((r) => r._id).map((r) => ({ id: String(r._id), name: r.name, count: r.n })))
})

/* The export is itself written to the log, as the compliance portal's copy
   is: up to 100,000 events with IP addresses and donor names leaving the
   building is exactly the kind of thing an auditor asks "who did that?" of.
   Cells go through lib/csv.ts, because a summary quotes names and titles a
   donor typed, and "=HYPERLINK(…)" is a valid first name on the website. */
r.get('/export', async (req, res) => {
  const rows = await AuditEvent.find(filterOf(req)).sort({ at: -1 }).limit(100_000).lean()
  const fmt = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const lines: CsvRow[] = [
    ['When (Sydney)', 'Who', 'Kind', 'Action', 'Summary', 'Record type', 'Record', 'IP address'],
    ...rows.map((e) => [fmt.format(e.at), e.actor?.name, e.actor?.kind, e.action, e.summary, e.entity?.type, e.entity?.label, e.ip]),
  ]
  await audit(req, 'audit.export', `Exported ${rows.length.toLocaleString('en-AU')} action-log event${rows.length === 1 ? '' : 's'} to CSV`, { type: 'audit', label: 'export' }, {
    query: req.query,
  })
  sendCsv(res, `al-anwaar-activity-${sydneyDay(new Date())}.csv`, lines)
})

export default r
