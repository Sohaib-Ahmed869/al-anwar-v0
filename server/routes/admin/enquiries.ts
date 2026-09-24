import { Router, type Request } from 'express'
import { z } from 'zod'
import { can, type Role } from '../../../shared/access'
import { ENQUIRY_STATUSES, ENQUIRY_TYPES, type EnquiryStatus } from '../../../shared/domain'
import { enquiryReplyEmail } from '../../emails/templates'
import { Donor, Enquiry, Staff, type EnquiryDoc } from '../../models'
import { audit } from '../../lib/audit'
import { requireStaff } from '../../lib/auth'
import { sendEmail } from '../../lib/email'
import { findOrCreateDonor, fullName } from '../../lib/giving'
import { badRequest, notFound, out, paging, parse, searchRegex, zId } from '../../lib/http'
import { donorSummary } from './gifts'

/* ---------------------------------------------------------------------------
   /api/admin/enquiries — the inbox for everything the website's forms send:
   messages, volunteer and partner offers, event sign-ups, fundraising ideas.

   Each enquiry keeps one timeline (`notes`): internal notes, the replies that
   were emailed, and a line for every status or assignee change, so whoever
   picks it up next reads the whole story in order without the action log.

   An enquiry belongs on a donor's record when it came from one. The detail
   suggests the match by email but never links on its own — two people can
   share a family address, and a wrong link puts a stranger's message on
   someone's record.

   Replying to a new enquiry moves it to "in progress" and, if nobody had it,
   gives it to the person who replied: they are now the one the enquirer is
   talking to.
--------------------------------------------------------------------------- */

const r = Router()
r.use(requireStaff('enquiries.manage'))

const TYPE_KEYS = Object.keys(ENQUIRY_TYPES)
const STATUS_KEYS = Object.keys(ENQUIRY_STATUSES) as EnquiryStatus[]

const list = (v: unknown) =>
  String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

/* ---------- inbox ---------- */
r.get('/', async (req, res) => {
  const q = req.query
  const { page, pageSize, skip } = paging(q, { pageSize: 30, max: 100 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base: Record<string, any> = {}
  const types = list(q.type).filter((t) => TYPE_KEYS.includes(t))
  if (types.length) base.type = { $in: types }
  if (q.assigned === 'me') base.assignedTo = req.staff!._id
  else if (q.assigned === 'unassigned') base.assignedTo = null
  const rx = searchRegex(q.q)
  if (rx) base.$or = [{ name: rx }, { email: rx }, { subject: rx }, { message: rx }]

  const f = { ...base }
  if (STATUS_KEYS.includes(q.status as EnquiryStatus)) f.status = q.status
  /* "open" in the inbox means anything not closed */
  else if (q.status === 'active') f.status = { $in: ['new', 'open'] }

  const [items, total, counts] = await Promise.all([
    Enquiry.find(f).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(pageSize).lean(),
    Enquiry.countDocuments(f),
    Enquiry.aggregate<{ _id: string; n: number }>([{ $match: base }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
  ])
  const byStatus = Object.fromEntries(STATUS_KEYS.map((s) => [s, counts.find((c) => c._id === s)?.n ?? 0]))
  res.json({
    /* the list needs a preview, not the whole thread */
    items: out(
      items.map(({ notes, ...e }) => ({
        ...e,
        message: e.message.length > 240 ? `${e.message.slice(0, 240)}…` : e.message,
        noteCount: notes?.length ?? 0,
        lastActivityAt: notes?.length ? notes[notes.length - 1].at : e.createdAt,
      })),
    ),
    total,
    page,
    pageSize,
    counts: { ...byStatus, active: (byStatus.new ?? 0) + (byStatus.open ?? 0) },
  })
})

/** Staff who can be given an enquiry: anyone active whose role handles them. */
r.get('/assignees', async (_req, res) => {
  const staff = await Staff.find({ active: true }).select('name email role').sort({ name: 1 }).lean()
  res.json({ items: out(staff.filter((s) => can(s.role as Role, 'enquiries.manage'))) })
})

/* ---------- one enquiry ---------- */
async function load(id: string) {
  const e = await Enquiry.findById(id)
  if (!e) throw notFound('That enquiry')
  return e
}

async function detail(e: EnquiryDoc) {
  const donor = e.donor ? await Donor.findById(e.donor).lean() : null
  const suggestion = !donor
    ? await Donor.findOne({ $or: [{ email: e.email }, { altEmails: e.email }], status: 'active' }).lean()
    : null
  return { enquiry: out(e.toObject()), donor: donorSummary(donor), suggestion: donorSummary(suggestion) }
}

r.get('/:id', async (req, res) => {
  res.json(await detail(await load(req.params.id)))
})

const label = (e: EnquiryDoc) => `${ENQUIRY_TYPES[e.type as keyof typeof ENQUIRY_TYPES].label.toLowerCase()} from ${e.name}`
const log = (req: Request, e: EnquiryDoc, verb: string, summary: string) =>
  audit(req, `enquiry.${verb}`, summary, { type: 'enquiry', id: e._id, label: e.subject ?? e.name })

function addNote(e: EnquiryDoc, req: Request, kind: 'note' | 'reply' | 'status', body: string) {
  e.notes.push({ by: req.staff!.name, at: new Date(), body, kind })
}

/* ---------- status and assignee ---------- */
r.patch('/:id', async (req, res) => {
  const b = parse(
    z.object({
      status: z.enum(STATUS_KEYS as [EnquiryStatus, ...EnquiryStatus[]]).optional(),
      assignedTo: z.union([zId, z.null()]).optional(),
    }),
    req.body,
  )
  const e = await load(req.params.id)
  const lines: string[] = []
  if (b.status && b.status !== e.status) {
    lines.push(`Marked ${ENQUIRY_STATUSES[b.status].label.toLowerCase()}`)
    e.status = b.status
  }
  if (b.assignedTo !== undefined && String(b.assignedTo ?? '') !== String(e.assignedTo ?? '')) {
    if (b.assignedTo) {
      const s = await Staff.findById(b.assignedTo).select('name active role')
      if (!s || !s.active) throw badRequest('Some details need another look.', { assignedTo: 'That person is not an active member of staff' })
      e.assignedTo = s._id
      e.assignedName = s.name
      lines.push(String(s._id) === String(req.staff!._id) ? 'Took this on' : `Assigned to ${s.name}`)
    } else {
      e.set('assignedTo', undefined)
      e.set('assignedName', undefined)
      lines.push('Unassigned')
    }
  }
  if (!lines.length) return void res.json(await detail(e))
  addNote(e, req, 'status', lines.join(' · '))
  await e.save()
  await log(req, e, 'update', `${lines.join('; ')} — ${label(e)}`)
  res.json(await detail(e))
})

/* ---------- internal note ---------- */
r.post('/:id/notes', async (req, res) => {
  const { body } = parse(z.object({ body: z.string().trim().min(1, 'Write a note first').max(5000) }), req.body)
  const e = await load(req.params.id)
  addNote(e, req, 'note', body)
  await e.save()
  await log(req, e, 'note', `Added a note to the ${label(e)}`)
  res.status(201).json(await detail(e))
})

/* ---------- reply by email ---------- */
r.post('/:id/reply', async (req, res) => {
  const { body } = parse(z.object({ body: z.string().trim().min(2, 'Write your reply first').max(10000) }), req.body)
  const e = await load(req.params.id)
  const first = e.name.trim().split(/\s+/)[0] || e.name
  const sent = await sendEmail(e.email, enquiryReplyEmail(first, e.subject || 'Your message to Al-Anwaar', body, req.staff!.name), {
    donor: e.donor ?? undefined,
  })
  if (!sent.ok) throw badRequest('The reply could not be sent just now. It is in the Email log with the reason; please try again.')
  addNote(e, req, 'reply', body)
  const extra: string[] = []
  if (e.status === 'new') {
    e.status = 'open'
    extra.push('Marked in progress')
  }
  if (!e.assignedTo) {
    e.assignedTo = req.staff!._id
    e.assignedName = req.staff!.name
    extra.push('Took this on')
  }
  if (extra.length) addNote(e, req, 'status', extra.join(' · '))
  await e.save()
  await log(req, e, 'reply', `Emailed a reply to ${e.name} (${e.email}) about “${e.subject ?? 'their message'}”`)
  res.status(201).json(await detail(e))
})

/* ---------- attach to a donor ---------- */
r.post('/:id/link', async (req, res) => {
  const { donorId } = parse(z.object({ donorId: zId.nullable() }), req.body)
  const e = await load(req.params.id)
  if (!donorId) {
    if (!e.donor) return void res.json(await detail(e))
    e.set('donor', undefined)
    addNote(e, req, 'status', 'Unlinked from the donor record')
    await e.save()
    await log(req, e, 'unlink', `Unlinked the ${label(e)} from its donor record`)
    return void res.json(await detail(e))
  }
  let d = await Donor.findById(donorId)
  while (d?.status === 'merged' && d.mergedInto) d = await Donor.findById(d.mergedInto)
  if (!d) throw badRequest('Some details need another look.', { donorId: 'That donor could not be found' })
  e.donor = d._id
  addNote(e, req, 'status', `Linked to ${fullName(d)} (${d.number})`)
  await e.save()
  await log(req, e, 'link', `Linked the ${label(e)} to donor ${fullName(d)} (${d.number})`)
  res.json(await detail(e))
})

r.post('/:id/create-donor', async (req, res) => {
  const e = await load(req.params.id)
  if (e.donor) throw badRequest('This enquiry is already on a donor record.')
  const [firstName, ...rest] = e.name.trim().split(/\s+/)
  const { donor, created } = await findOrCreateDonor({
    email: e.email,
    firstName: firstName ?? e.name,
    lastName: rest.join(' '),
    phone: e.phone ?? undefined,
    source: 'web',
  })
  if (created) {
    await audit(req, 'donor.create', `Added donor ${fullName(donor)} (${donor.number}) from an enquiry`, { type: 'donor', id: donor._id, label: donor.number })
  }
  e.donor = donor._id
  addNote(e, req, 'status', created ? `Created donor record ${donor.number}` : `Linked to ${fullName(donor)} (${donor.number})`)
  await e.save()
  await log(req, e, 'link', `${created ? 'Created and linked' : 'Linked'} donor ${fullName(donor)} (${donor.number}) for the ${label(e)}`)
  res.status(created ? 201 : 200).json({ ...(await detail(e)), created })
})

export default r
