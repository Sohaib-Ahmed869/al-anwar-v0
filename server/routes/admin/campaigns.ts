import { Router } from 'express'
import { z } from 'zod'
import { CAMPAIGN_STATUSES, type CampaignStatus, type Segment } from '../../../shared/domain'
import { Campaign, Donor } from '../../models'
import { audit } from '../../lib/audit'
import { requireStaff } from '../../lib/auth'
import { sendEmail } from '../../lib/email'
import { badRequest, notFound, out, paging, parse, searchRegex, sorting, zDate, zEmail } from '../../lib/http'
import { segmentFilter, startSending, zSegment } from '../../lib/segments'
import { campaignEmail } from '../../emails/templates'
import { url } from '../../emails/layout'
import { processCampaignQueue } from '../../jobs/campaigns'

/* ---------------------------------------------------------------------------
   /api/admin/campaigns — writing and sending email to a chosen group.

   A campaign is edited while it is a draft (or scheduled: the schedule stays).
   Once it starts sending it is frozen, because some people already have it.
   "Send now" snapshots the audience into the campaign's queue and the job in
   jobs/campaigns.ts drains it in batches; the route kicks the job once so
   the first batch goes straight away instead of on the next minute.

   The preview routes render exactly what a donor gets, through the same
   campaignEmail() the job uses, so the composer's preview cannot drift from
   the real thing.
--------------------------------------------------------------------------- */

const r = Router()
r.use(requireStaff('campaigns.manage'))

const STATUSES = Object.keys(CAMPAIGN_STATUSES) as CampaignStatus[]
const SAMPLE = { firstName: 'Amina', lastName: 'Rahman' }

const zCampaign = z.object({
  name: z.string().trim().min(2, 'Give the campaign a name only the team sees').max(120),
  subject: z.string().trim().max(160, 'Keep the subject under 160 characters').optional(),
  preheader: z.string().trim().max(200).optional().nullable(),
  body: z.string().max(50_000).optional(),
  segment: zSegment.optional(),
})

/* ---------- list ---------- */
r.get('/', async (req, res) => {
  const { page, pageSize, skip } = paging(req.query)
  const filter: Record<string, unknown> = {}
  const status = String(req.query.status ?? '')
  if ((STATUSES as string[]).includes(status)) filter.status = status
  const rx = searchRegex(req.query.q)
  if (rx) filter.$or = [{ name: rx }, { subject: rx }]
  const sort = sorting(req.query, ['createdAt', 'updatedAt', 'sentAt', 'name'], { updatedAt: -1 })
  const [items, total, counts] = await Promise.all([
    Campaign.find(filter).select('-body').sort(sort).skip(skip).limit(pageSize).lean(),
    Campaign.countDocuments(filter),
    Campaign.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ])
  res.json({ items: out(items), total, page, pageSize, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) })
})

/* ---------- audience and preview (before :id routes) ---------- */
r.post('/preview-segment', async (req, res) => {
  const { segment } = parse(z.object({ segment: zSegment }), req.body)
  const filter = await segmentFilter(segment as Segment)
  const [count, sample] = await Promise.all([
    Donor.countDocuments(filter),
    Donor.find(filter).sort({ lastGiftAt: -1 }).limit(5).select('firstName lastName').lean(),
  ])
  res.json({ count, sample: sample.map((d) => `${d.firstName} ${d.lastName ?? ''}`.trim()) })
})

r.post('/preview', async (req, res) => {
  const body = parse(z.object({ subject: z.string().max(300).default(''), preheader: z.string().max(300).optional().nullable(), body: z.string().max(50_000).default('') }), req.body)
  const email = campaignEmail(
    { subject: body.subject || 'Your subject line', preheader: body.preheader, body: body.body || '_Start writing and your email appears here._' },
    SAMPLE,
    url('/unsubscribe-preview'),
  )
  res.json({ html: email.html, subject: email.subject })
})

r.post('/', async (req, res) => {
  const body = parse(zCampaign, req.body)
  const c = await Campaign.create({
    ...body,
    segment: body.segment ?? {},
    status: 'draft',
    createdBy: req.staff!._id,
    createdByName: req.staff!.name,
  })
  await audit(req, 'campaign.create', `Started the email campaign “${c.name}”`, { type: 'campaign', id: c._id, label: c.name })
  res.status(201).json(out(c.toObject()))
})

/* ---------- one campaign ---------- */
async function load(id: string) {
  const c = await Campaign.findById(id)
  if (!c) throw notFound('That campaign')
  return c
}
const frozen = (s: string) => s === 'sending' || s === 'sent'

r.get('/:id', async (req, res) => {
  const c = await Campaign.findById(req.params.id).lean()
  if (!c) throw notFound('That campaign')
  const remaining = c.status === 'sending' ? Math.max(0, (c.stats?.recipients ?? 0) - (c.stats?.sent ?? 0) - (c.stats?.failed ?? 0)) : 0
  res.json({ ...out<object>(c), remaining })
})

r.patch('/:id', async (req, res) => {
  const c = await load(String(req.params.id))
  if (frozen(c.status)) throw badRequest('This campaign has already gone out, so it can no longer be changed.')
  const body = parse(zCampaign.partial(), req.body)
  const changed = Object.keys(body).filter((k) => body[k as keyof typeof body] !== undefined)
  c.set(body)
  if (body.segment) c.markModified('segment')
  await c.save()
  if (changed.length) {
    await audit(req, 'campaign.update', `Edited the email campaign “${c.name}” (${changed.join(', ')})`, { type: 'campaign', id: c._id, label: c.name }, { changed })
  }
  res.json(out(c.toObject()))
})

r.post('/:id/test', async (req, res) => {
  const { to } = parse(z.object({ to: zEmail.optional() }), req.body)
  const c = await load(String(req.params.id))
  const staff = req.staff!
  const [first, ...rest] = staff.name.split(/\s+/)
  const email = campaignEmail({ subject: c.subject || c.name, preheader: c.preheader, body: c.body }, { firstName: first ?? staff.name, lastName: rest.join(' ') }, url('/unsubscribe-preview'))
  const recipient = to ?? staff.email
  const r2 = await sendEmail(recipient, { ...email, subject: `[Test] ${email.subject}`, template: 'campaign.test' })
  if (!r2.ok) throw badRequest(`The test could not be sent: ${r2.error}`)
  await audit(req, 'campaign.test', `Sent a test of “${c.name}” to ${recipient}`, { type: 'campaign', id: c._id, label: c.name })
  res.json({ ok: true, to: recipient })
})

function ready(c: { subject?: string | null; body?: string | null }) {
  const fields: Record<string, string> = {}
  if (!c.subject?.trim()) fields.subject = 'Add a subject line before sending'
  if (!c.body?.trim() || c.body.trim().length < 20) fields.body = 'The email needs a little more in it'
  if (Object.keys(fields).length) throw badRequest('This campaign is not ready to send yet.', fields)
}

r.post('/:id/send', async (req, res) => {
  const c = await load(String(req.params.id))
  if (frozen(c.status)) throw badRequest('This campaign has already gone out.')
  ready(c)
  if (!(await Donor.countDocuments(await segmentFilter((c.segment ?? {}) as Segment)))) {
    throw badRequest('Nobody in this audience can be emailed right now, so nothing was sent.')
  }
  const n = await startSending(c._id, (c.segment ?? {}) as Segment)
  if (n === null) throw badRequest('This campaign has already gone out.')
  await Campaign.updateOne({ _id: c._id }, { $unset: { scheduledAt: 1 } })
  await audit(req, 'campaign.send', `Started sending “${c.name}” to ${n} donors`, { type: 'campaign', id: c._id, label: c.name }, { recipients: n })
  void processCampaignQueue()
  res.json({ ...out<object>((await Campaign.findById(c._id).lean())!), remaining: n })
})

r.post('/:id/schedule', async (req, res) => {
  const { at } = parse(z.object({ at: zDate }), req.body)
  if (at.getTime() < Date.now() + 60_000) throw badRequest('Pick a time in the future.', { at: 'That time has already passed' })
  const c = await load(String(req.params.id))
  if (frozen(c.status)) throw badRequest('This campaign has already gone out.')
  ready(c)
  c.status = 'scheduled'
  c.scheduledAt = at
  await c.save()
  await audit(
    req,
    'campaign.schedule',
    `Scheduled “${c.name}” for ${at.toLocaleString('en-AU', { timeZone: 'Australia/Sydney', dateStyle: 'medium', timeStyle: 'short' })}`,
    { type: 'campaign', id: c._id, label: c.name },
  )
  res.json(out(c.toObject()))
})

r.post('/:id/unschedule', async (req, res) => {
  const c = await load(String(req.params.id))
  if (c.status !== 'scheduled') throw badRequest('This campaign is not scheduled.')
  c.status = 'draft'
  c.scheduledAt = undefined
  await c.save()
  await audit(req, 'campaign.unschedule', `Took “${c.name}” off the schedule; it is a draft again`, { type: 'campaign', id: c._id, label: c.name })
  res.json(out(c.toObject()))
})

r.post('/:id/duplicate', async (req, res) => {
  const c = await load(String(req.params.id))
  const copy = await Campaign.create({
    name: `${c.name} (copy)`,
    subject: c.subject,
    preheader: c.preheader,
    body: c.body,
    segment: c.segment ?? {},
    status: 'draft',
    createdBy: req.staff!._id,
    createdByName: req.staff!.name,
  })
  await audit(req, 'campaign.create', `Copied “${c.name}” into a new draft`, { type: 'campaign', id: copy._id, label: copy.name })
  res.status(201).json(out(copy.toObject()))
})

r.delete('/:id', async (req, res) => {
  const c = await load(String(req.params.id))
  if (c.status !== 'draft') throw badRequest('Only a draft can be deleted. Take it off the schedule first.')
  await c.deleteOne()
  await audit(req, 'campaign.delete', `Deleted the draft campaign “${c.name}”`, { type: 'campaign', id: c._id, label: c.name })
  res.status(204).end()
})

export default r
