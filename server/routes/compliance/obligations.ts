import { Router, type Request } from 'express'
import { z } from 'zod'
import { addMonths, differenceInCalendarDays } from 'date-fns'
import { OBLIGATION_CATEGORIES, RECURRENCES, type Recurrence } from '../../../shared/domain'
import { requireStaff } from '../../lib/auth'
import { audit } from '../../lib/audit'
import { badRequest, isId, notFound, oid, out, paging, parse, zId } from '../../lib/http'
import { LibraryDocument, Obligation, Staff, type ObligationDoc } from '../../models'
import { startOfToday } from './registers'

/* ---------------------------------------------------------------------------
   /api/compliance/obligations — the statutory calendar.

   An obligation is `upcoming` or `done` in the database; everything else a
   person sees (overdue, due soon) is worked out from the due date on every
   read, so nothing has to run at midnight for the calendar to be right.

   Completing a recurring item creates the next one straight away — the AIS
   done this year puts next year's AIS on the calendar with the same owner —
   so the calendar never quietly runs out. A year in the title moves on with
   it ("AIS 2026" → "AIS 2027").

   Due dates cross the wire as yyyy-mm-dd and are stored at 9am local, so a
   date never slips a day either side of midnight UTC.
--------------------------------------------------------------------------- */

const r = Router()

export const DUE_SOON_DAYS = 30

export type ObligationState = 'overdue' | 'due-soon' | 'upcoming' | 'done'

export function obligationState(o: { status?: string | null; dueDate: Date }): ObligationState {
  if (o.status === 'done') return 'done'
  const d = differenceInCalendarDays(o.dueDate, new Date())
  if (d < 0) return 'overdue'
  if (d <= DUE_SOON_DAYS) return 'due-soon'
  return 'upcoming'
}

/** The obligation as the portal wants it: state and days left worked out. */
export function obligationView(o: Record<string, unknown> & { status?: string | null; dueDate: Date }) {
  return {
    ...out<Record<string, unknown>>(o),
    state: obligationState(o),
    daysLeft: differenceInCalendarDays(o.dueDate, new Date()),
  }
}

const dayToDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, m! - 1, d!, 9)
}

const zDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date').refine((s) => !Number.isNaN(dayToDate(s).getTime()), 'Choose a real date')
const zReminders = z.array(z.number().int().min(0, 'Not before the due date').max(365, 'At most a year ahead')).max(6, 'Six reminders at most')

const zObligation = z.object({
  title: z.string().trim().min(2, 'Give it a name').max(200),
  category: z.enum(Object.keys(OBLIGATION_CATEGORIES) as [string, ...string[]]),
  description: z.string().trim().max(4000).optional().nullable(),
  dueDate: zDay,
  recurrence: z.enum(Object.keys(RECURRENCES) as [string, ...string[]]),
  owner: zId.optional().nullable(),
  reminderDays: zReminders,
  notes: z.string().trim().max(4000).optional().nullable(),
})

const zPatch = zObligation.partial().extend({ evidence: z.array(zId).max(30).optional() })

async function ownerFor(id: string | null | undefined) {
  if (!id) return { owner: null, ownerName: null }
  const s = await Staff.findOne({ _id: id, active: true }).lean()
  if (!s) throw badRequest('That person is not an active member of staff.', { owner: 'Choose someone from the list.' })
  return { owner: s._id, ownerName: s.name }
}

async function evidenceFor(ids: string[]) {
  if (!ids.length) return []
  const docs = await LibraryDocument.find({ _id: { $in: ids.map(oid) } }, { title: 1 }).lean()
  return ids.map((id) => docs.find((d) => String(d._id) === id)).filter(Boolean).map((d) => ({ document: d!._id, title: d!.title }))
}

async function load(raw: unknown) {
  const id = String(raw)
  if (!isId(id)) throw notFound('That calendar item')
  const o = await Obligation.findById(id)
  if (!o) throw notFound('That calendar item')
  return o
}

const reminderSentence = (days: number[]) =>
  days.length ? [...days].sort((a, b) => b - a).map((d) => (d === 0 ? 'on the day' : `${d} day${d === 1 ? '' : 's'}`)).join(', ') : 'none'

/* ---------- reads ---------- */
function listFilter(q: Request['query'], staffId: string) {
  const and: Record<string, unknown>[] = []
  const today = startOfToday()
  const soon = new Date(today.getTime() + (DUE_SOON_DAYS + 1) * 86_400_000)
  if (q.from || q.to) {
    const range: Record<string, Date> = {}
    if (q.from) range.$gte = new Date(`${q.from}T00:00:00`)
    if (q.to) range.$lt = new Date(`${q.to}T00:00:00`)
    and.push({ dueDate: range })
  }
  const states = String(q.status ?? '').split(',').filter(Boolean)
  if (states.length) {
    const or: Record<string, unknown>[] = []
    if (states.includes('done')) or.push({ status: 'done' })
    if (states.includes('overdue')) or.push({ status: 'upcoming', dueDate: { $lt: today } })
    if (states.includes('due-soon')) or.push({ status: 'upcoming', dueDate: { $gte: today, $lt: soon } })
    if (states.includes('upcoming')) or.push({ status: 'upcoming', dueDate: { $gte: soon } })
    if (states.includes('open')) or.push({ status: 'upcoming' })
    if (or.length) and.push({ $or: or })
  }
  const cats = String(q.category ?? '').split(',').filter(Boolean)
  if (cats.length) and.push({ category: { $in: cats } })
  const owner = String(q.owner ?? '')
  if (owner === 'me') and.push({ owner: oid(staffId) })
  else if (owner === 'none') and.push({ owner: null })
  else if (isId(owner)) and.push({ owner: oid(owner) })
  const s = String(q.q ?? '').trim()
  if (s) and.push({ title: new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
  return and.length ? { $and: and } : {}
}

r.get('/', async (req, res) => {
  const { page, pageSize, skip } = paging(req.query, { pageSize: 500, max: 1000 })
  const filter = listFilter(req.query, String(req.staff!._id))
  const [rows, total] = await Promise.all([
    Obligation.find(filter).sort({ dueDate: 1 }).skip(skip).limit(pageSize).lean(),
    Obligation.countDocuments(filter),
  ])
  res.json({ items: rows.map(obligationView), total, page, pageSize })
})

r.get('/owners', async (_req, res) => {
  const staff = await Staff.find({ active: true }, { name: 1, role: 1 }).sort({ name: 1 }).lean()
  res.json(staff.map((s) => ({ id: String(s._id), name: s.name, role: s.role })))
})

r.get('/:id', async (req, res) => {
  const o = await load(req.params.id)
  res.json(obligationView(o.toObject()))
})

/* ---------- writes ---------- */
r.post('/', requireStaff('compliance.write'), async (req, res) => {
  const b = parse(zObligation, req.body)
  const o = await Obligation.create({
    ...b,
    ...(await ownerFor(b.owner)),
    dueDate: dayToDate(b.dueDate),
    reminderDays: [...new Set(b.reminderDays)].sort((x, y) => y - x),
    remindersSent: [],
    status: 'upcoming',
  })
  await audit(req, 'obligation.create', `Added ${o.title} to the statutory calendar, due ${b.dueDate}${o.ownerName ? `, owned by ${o.ownerName}` : ''}`, {
    type: 'obligation', id: o._id, label: o.title,
  })
  res.status(201).json(obligationView(o.toObject()))
})

r.patch('/:id', requireStaff('compliance.write'), async (req, res) => {
  const o = await load(req.params.id)
  const b = parse(zPatch, req.body)
  const changed: string[] = []
  if (b.title !== undefined && b.title !== o.title) (o.title = b.title), changed.push('name')
  if (b.category !== undefined && b.category !== o.category) (o.category = b.category), changed.push('category')
  if (b.description !== undefined && (b.description ?? '') !== (o.description ?? '')) (o.description = b.description ?? undefined), changed.push('description')
  if (b.notes !== undefined && (b.notes ?? '') !== (o.notes ?? '')) (o.notes = b.notes ?? undefined), changed.push('notes')
  if (b.recurrence !== undefined && b.recurrence !== o.recurrence) (o.recurrence = b.recurrence), changed.push('repeat')
  if (b.dueDate !== undefined && dayToDate(b.dueDate).getTime() !== o.dueDate.getTime()) {
    o.dueDate = dayToDate(b.dueDate)
    o.remindersSent = []
    changed.push(`due date (now ${b.dueDate})`)
  }
  if (b.reminderDays !== undefined) {
    const next = [...new Set(b.reminderDays)].sort((x, y) => y - x)
    if (next.join() !== o.reminderDays.join()) {
      o.reminderDays = next
      o.remindersSent = o.remindersSent.filter((d) => d < 0)
      changed.push(`reminders (${reminderSentence(next)})`)
    }
  }
  if (b.owner !== undefined && String(b.owner ?? '') !== String(o.owner ?? '')) {
    const w = await ownerFor(b.owner)
    o.owner = w.owner
    o.ownerName = w.ownerName
    changed.push(`owner (now ${w.ownerName ?? 'nobody'})`)
  }
  if (b.evidence !== undefined) {
    const next = await evidenceFor(b.evidence)
    if (next.map((e) => String(e.document)).join() !== o.evidence.map((e) => String(e.document)).join()) {
      o.set('evidence', next)
      changed.push('evidence')
    }
  }
  if (changed.length) {
    await o.save()
    await audit(req, 'obligation.update', `Updated ${o.title} on the statutory calendar: ${changed.join(', ')}`, { type: 'obligation', id: o._id, label: o.title })
  }
  res.json(obligationView(o.toObject()))
})

r.delete('/:id', requireStaff('compliance.write'), async (req, res) => {
  const o = await load(req.params.id)
  if (o.status === 'done') throw badRequest('A completed item is part of the record and cannot be deleted. Reopen it first if it was marked done by mistake.')
  await o.deleteOne()
  await audit(req, 'obligation.delete', `Deleted ${o.title} (due ${o.dueDate.toISOString().slice(0, 10)}) from the statutory calendar`, {
    type: 'obligation', id: o._id, label: o.title,
  })
  res.status(204).end()
})

const STEP: Record<Exclude<Recurrence, 'none'>, number> = { monthly: 1, quarterly: 3, annual: 12 }

async function scheduleNext(o: ObligationDoc) {
  const rec = o.recurrence as Recurrence
  if (rec === 'none') return null
  const due = addMonths(o.dueDate, STEP[rec])
  const title = rec === 'annual' ? o.title.replace(/\b(20\d\d)\b/g, (y) => String(Number(y) + 1)) : o.title
  /* reopening and completing again must not put a second copy on the calendar */
  const exists = await Obligation.findOne({ title, dueDate: due })
  if (exists) return exists
  return Obligation.create({
    title,
    category: o.category,
    description: o.description,
    dueDate: due,
    recurrence: o.recurrence,
    owner: o.owner,
    ownerName: o.ownerName,
    reminderDays: o.reminderDays,
    remindersSent: [],
    status: 'upcoming',
  })
}

r.post('/:id/complete', requireStaff('compliance.write'), async (req, res) => {
  const o = await load(req.params.id)
  const b = parse(z.object({ note: z.string().trim().max(4000).optional(), evidence: z.array(zId).max(30).optional() }), req.body)
  if (o.status === 'done') throw badRequest('This is already marked as done.')
  if (b.evidence?.length) {
    const have = new Set(o.evidence.map((e) => String(e.document)))
    const add = (await evidenceFor(b.evidence)).filter((e) => !have.has(String(e.document)))
    o.set('evidence', [...o.evidence, ...add])
  }
  o.status = 'done'
  o.completedAt = new Date()
  o.completedByName = req.staff!.name
  o.completionNote = b.note || undefined
  await o.save()
  const next = await scheduleNext(o)
  await audit(
    req,
    'obligation.complete',
    `Marked ${o.title} as done${o.evidence.length ? ` with ${o.evidence.length} evidence document${o.evidence.length === 1 ? '' : 's'}` : ''}${
      next ? `; the next one is due ${next.dueDate.toISOString().slice(0, 10)}` : ''
    }`,
    { type: 'obligation', id: o._id, label: o.title },
  )
  res.json({ ...obligationView(o.toObject()), next: next ? obligationView(next.toObject()) : null })
})

r.post('/:id/reopen', requireStaff('compliance.write'), async (req, res) => {
  const o = await load(req.params.id)
  if (o.status !== 'done') throw badRequest('This item is still open.')
  o.status = 'upcoming'
  o.completedAt = undefined
  o.completedByName = undefined
  o.completionNote = undefined
  o.remindersSent = []
  await o.save()
  await audit(req, 'obligation.reopen', `Reopened ${o.title} on the statutory calendar`, { type: 'obligation', id: o._id, label: o.title })
  res.json(obligationView(o.toObject()))
})

export default r
