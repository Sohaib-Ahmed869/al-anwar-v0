import { Router } from 'express'
import { DOCUMENT_CATEGORIES, OBLIGATION_CATEGORIES } from '../../../shared/domain'
import { REGISTERS, registerByKey, riskBand, riskScore, STANDARDS } from '../../../shared/registers'
import { escapeRegex } from '../../lib/http'
import { AuditEvent, LibraryDocument, Obligation, RegisterEntry } from '../../models'
import { eventView } from './audit'
import { DUE_SOON_DAYS, obligationView } from './obligations'
import { entryTitle, isReviewDue, startOfToday, todayStr } from './registers'

/* ---------------------------------------------------------------------------
   /api/compliance/overview — the front page of the compliance portal, the
   nav badges and the command palette's search.

   THE HEALTH SCORE is deliberately simple enough to explain in one breath,
   and the response carries its workings (`scoreParts`) so the page can show
   them. It starts at 100 and loses:
     15 for each overdue calendar item                  (at most 45)
      2 for each register entry past its review date   (at most 15)
      8 for each standard with a gap in its evidence,
      2 for each standard that needs attention          (at most 15)
      2 for each item due in the next 7 days            (at most 10)
   It is a prompt to look, not a rating — nothing here is audit advice.

   THE STANDARDS MAP reads each standard's evidence keys from
   shared/registers.ts: a register key ("risks"), a document category
   ("documents:agreement") or a calendar category ("calendar:ato"). Each is
   evidenced, needs attention (something is overdue or past review) or is a
   gap (nothing recorded at all), and a standard is as good as its weakest.
--------------------------------------------------------------------------- */

const r = Router()

type Status = 'evidenced' | 'attention' | 'gap'
const RANK: Record<Status, number> = { evidenced: 0, attention: 1, gap: 2 }

type Entry = { _id: unknown; register: string; fields: Record<string, string | number | boolean | null>; archived?: boolean }
type Ob = { _id: unknown; title: string; category: string; status: string; dueDate: Date }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

async function toReadFor(staffId: string) {
  const docs = await LibraryDocument.find({ requiresAck: true, archived: { $ne: true } }, { title: 1, versions: { $slice: -1 }, acks: 1, category: 1, updatedAt: 1 }).lean()
  return docs.filter((d) => {
    const n = d.versions[0]?.n
    return n && !d.acks.some((a) => String(a.staff) === staffId && a.version === n)
  })
}

async function overdueCount() {
  return Obligation.countDocuments({ status: 'upcoming', dueDate: { $lt: startOfToday() } })
}

r.get('/badges', async (req, res) => {
  const [overdue, toRead] = await Promise.all([overdueCount(), toReadFor(String(req.staff!._id))])
  res.json({ overdue, toRead: toRead.length })
})

r.get('/', async (req, res) => {
  const today = startOfToday()
  const todayS = todayStr()
  const day = 86_400_000
  const [entries, obligations, docs, toRead, recent] = await Promise.all([
    RegisterEntry.find({ archived: { $ne: true } }).lean<Entry[]>(),
    Obligation.find({}, { title: 1, category: 1, status: 1, dueDate: 1, ownerName: 1, recurrence: 1, reminderDays: 1, remindersSent: 1, evidence: 1 }).sort({ dueDate: 1 }).lean(),
    LibraryDocument.find({ archived: { $ne: true } }, { title: 1, category: 1 }).lean(),
    toReadFor(String(req.staff!._id)),
    AuditEvent.find({ action: /^(register|obligation|document)\./ }).sort({ at: -1 }).limit(8).lean(),
  ])

  /* ---- the counts ---- */
  const open = (obligations as Ob[]).filter((o) => o.status !== 'done')
  const overdue = open.filter((o) => o.dueDate < today)
  const dueSoon = open.filter((o) => o.dueDate >= today && o.dueDate < new Date(today.getTime() + (DUE_SOON_DAYS + 1) * day))
  const dueThisWeek = open.filter((o) => o.dueDate >= today && o.dueDate < new Date(today.getTime() + 8 * day))
  const reviewsDue = entries.filter((e) => {
    const def = registerByKey(e.register)
    return def ? isReviewDue(def, e, todayS) : false
  })

  /* ---- the standards ---- */
  function evidence(key: string): { label: string; to: string; status: Status; reason: string } {
    const [kind, arg] = key.includes(':') ? (key.split(':') as [string, string]) : ['register', key]
    if (kind === 'register') {
      const def = registerByKey(arg)!
      const mine = entries.filter((e) => e.register === arg)
      const due = mine.filter((e) => isReviewDue(def, e, todayS))
      const to = `/compliance/registers/${arg}`
      if (!mine.length) return { label: def.label, to, status: 'gap', reason: `Nothing recorded in the ${def.label.toLowerCase()} register yet.` }
      if (due.length)
        return { label: def.label, to: `${to}?reviewDue=1`, status: 'attention', reason: `${plural(due.length, 'entry', 'entries')} in ${def.label.toLowerCase()} past the review date.` }
      return { label: def.label, to, status: 'evidenced', reason: `${plural(mine.length, 'current entry', 'current entries')} in ${def.label.toLowerCase()}.` }
    }
    if (kind === 'documents') {
      const label = DOCUMENT_CATEGORIES[arg as keyof typeof DOCUMENT_CATEGORIES] ?? arg
      const n = docs.filter((d) => d.category === arg).length
      const to = `/compliance/documents?category=${arg}`
      if (!n) return { label: `${label} documents`, to, status: 'gap', reason: `No ${label.toLowerCase()} documents in the library.` }
      return { label: `${label} documents`, to, status: 'evidenced', reason: `${plural(n, `${label.toLowerCase()} document`)} in the library.` }
    }
    const label = OBLIGATION_CATEGORIES[arg as keyof typeof OBLIGATION_CATEGORIES]?.label ?? arg
    const mine = (obligations as Ob[]).filter((o) => o.category === arg)
    const late = mine.filter((o) => o.status !== 'done' && o.dueDate < today)
    const to = `/compliance/calendar?category=${arg}`
    if (!mine.length) return { label: `${label} calendar`, to, status: 'gap', reason: `No ${label} items on the statutory calendar.` }
    if (late.length) return { label: `${label} calendar`, to, status: 'attention', reason: `${late[0]!.title} is overdue.` }
    const done = mine.filter((o) => o.status === 'done').length
    return { label: `${label} calendar`, to, status: 'evidenced', reason: `${plural(mine.length - done, `open ${label} item`)} on track, ${done} done.` }
  }

  const standards = STANDARDS.map((s) => {
    const links = s.evidence.map(evidence)
    const worst = links.reduce((w, l) => (RANK[l.status] > RANK[w.status] ? l : w), links[0]!)
    const reason = worst.status === 'evidenced' ? `Evidence recorded in ${links.map((l) => l.label.toLowerCase()).join(', ')}.` : worst.reason
    return { code: s.code, title: s.title, ask: s.ask, status: worst.status, reason, links }
  })

  /* ---- the risk matrix: open risks by likelihood (rows) and impact (columns) ---- */
  const riskMatrix = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0))
  const openRisks = entries.filter((e) => e.register === 'risks' && e.fields.status !== 'closed')
  for (const e of openRisks) {
    const l = Number(e.fields.likelihood)
    const i = Number(e.fields.impact)
    if (l >= 1 && l <= 5 && i >= 1 && i <= 5) riskMatrix[l - 1]![i - 1]!++
  }
  const topRisks = openRisks
    .map((e) => ({ id: String(e._id), title: entryTitle(registerByKey('risks')!, e.fields), score: riskScore(e.fields) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3)
    .map((x) => ({ ...x, band: riskBand(x.score) }))

  /* ---- the score, with its workings ---- */
  const gaps = standards.filter((s) => s.status === 'gap').length
  const attention = standards.filter((s) => s.status === 'attention').length
  const scoreParts = [
    { label: plural(overdue.length, 'overdue calendar item'), points: -Math.min(45, overdue.length * 15) },
    { label: plural(reviewsDue.length, 'register review') + ' past due', points: -Math.min(15, reviewsDue.length * 2) },
    { label: `${plural(gaps, 'standard')} with a gap, ${attention} needing attention`, points: -Math.min(15, gaps * 8 + attention * 2) },
    { label: `${plural(dueThisWeek.length, 'item')} due in the next 7 days`, points: -Math.min(10, dueThisWeek.length * 2) },
  ]
  const score = Math.max(0, 100 + scoreParts.reduce((s, p) => s + p.points, 0))

  const upcoming = open.slice(0, 6).map((o) => obligationView(o as unknown as Record<string, unknown> & { dueDate: Date }))

  res.json({
    health: {
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      reviewsDue: reviewsDue.length,
      docsToRead: toRead.length,
      score,
      scoreParts,
      lastActivityAt: recent[0]?.at ?? null,
      generatedAt: new Date(),
    },
    reviewsDue: reviewsDue.slice(0, 8).map((e) => {
      const def = registerByKey(e.register)!
      return { id: String(e._id), register: e.register, registerLabel: def.label, title: entryTitle(def, e.fields), date: e.fields[def.reviewField!] }
    }),
    standards,
    upcoming,
    riskMatrix,
    openRisks: openRisks.length,
    topRisks,
    toRead: toRead.map((d) => ({ id: String(d._id), title: d.title, category: d.category, version: d.versions[0]?.n, updatedAt: d.updatedAt })),
    recent: recent.map((e) => eventView(e as never)),
    registers: REGISTERS.map((d) => ({ key: d.key, label: d.label, count: entries.filter((e) => e.register === d.key).length })),
  })
})

/* ---------- the command palette ---------- */
r.get('/search', async (req, res) => {
  const s = String(req.query.q ?? '').trim()
  if (s.length < 2) {
    res.json({ groups: [] })
    return
  }
  const re = new RegExp(escapeRegex(s), 'i')
  const [entries, docs, obs] = await Promise.all([
    RegisterEntry.find({ archived: { $ne: true }, $or: REGISTERS.map((d) => ({ register: d.key, [`fields.${d.titleField}`]: re })) }).limit(8).lean<Entry[]>(),
    LibraryDocument.find({ archived: { $ne: true }, $or: [{ title: re }, { description: re }] }, { title: 1, category: 1, versions: { $slice: -1 } }).limit(5).lean(),
    Obligation.find({ title: re }, { title: 1, dueDate: 1, status: 1 }).sort({ dueDate: -1 }).limit(5).lean(),
  ])
  const groups = [
    {
      label: 'Registers',
      items: entries.map((e) => {
        const def = registerByKey(e.register)!
        return { id: String(e._id), title: entryTitle(def, e.fields), subtitle: def.label, to: `/compliance/registers/${def.key}?id=${e._id}` }
      }),
    },
    {
      label: 'Documents',
      items: docs.map((d) => ({
        id: String(d._id),
        title: d.title,
        subtitle: `${DOCUMENT_CATEGORIES[d.category as keyof typeof DOCUMENT_CATEGORIES] ?? d.category} · v${d.versions[0]?.n ?? 1}`,
        to: `/compliance/documents/${d._id}`,
      })),
    },
    {
      label: 'Statutory calendar',
      items: obs.map((o) => ({
        id: String(o._id),
        title: o.title,
        subtitle: `${o.status === 'done' ? 'Done' : 'Due'} ${o.dueDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`,
        to: `/compliance/calendar?item=${o._id}`,
      })),
    },
  ].filter((g) => g.items.length)
  res.json({ groups })
})

export default r
