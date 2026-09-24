import { Router } from 'express'
import { z } from 'zod'
import { FUNDRAISER_STATUSES, type FundraiserStatus } from '../../../shared/domain'
import { Donor, Fundraiser, Gift } from '../../models'
import { audit } from '../../lib/audit'
import { requireStaff } from '../../lib/auth'
import { sendEmail } from '../../lib/email'
import { badRequest, notFound, out, paging, parse, searchRegex } from '../../lib/http'
import { fundraiserReviewedEmail } from '../../emails/templates'

/* ---------------------------------------------------------------------------
   /api/admin/fundraisers — supporter fundraising pages and their approval
   queue.

   A donor's page (a wedding, a walk, a birthday) is never public until a
   person here has read it: it starts `pending`, and a review moves it to
   `live`, `changes` (the owner edits and it comes back as pending) or
   `rejected`. Every review emails the owner, with the reviewer's note in it
   — so the note is written TO the supporter and the UI says so.

   The unfiltered list puts pending pages first, oldest first, because that is
   the order someone should work through them in.
--------------------------------------------------------------------------- */

const r = Router()
r.use(requireStaff('fundraisers.approve'))

const STATUSES = Object.keys(FUNDRAISER_STATUSES) as FundraiserStatus[]

r.get('/', async (req, res) => {
  const { page, pageSize, skip } = paging(req.query)
  const match: Record<string, unknown> = {}
  const status = String(req.query.status ?? '')
  if ((STATUSES as string[]).includes(status)) match.status = status
  const rx = searchRegex(req.query.q)
  if (rx) match.$or = [{ title: rx }, { ownerName: rx }, { appealTitle: rx }, { slug: rx }]

  const [items, total, counts] = await Promise.all([
    Fundraiser.aggregate([
      { $match: match },
      { $addFields: { _rank: { $cond: [{ $eq: ['$status', 'pending'] }, 0, 1] }, _pendingAge: { $cond: [{ $eq: ['$status', 'pending'] }, '$createdAt', null] } } },
      /* pending: oldest first (first come, first served); everything else newest first */
      { $sort: { _rank: 1, _pendingAge: 1, createdAt: -1 } },
      { $skip: skip },
      { $limit: pageSize },
      { $project: { _rank: 0, _pendingAge: 0 } },
    ]),
    Fundraiser.countDocuments(match),
    Fundraiser.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ])
  res.json({ items: out(items), total, page, pageSize, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) })
})

r.get('/:id', async (req, res) => {
  const f = await Fundraiser.findById(req.params.id).lean()
  if (!f) throw notFound('That fundraiser')
  const [owner, gifts, pagesByOwner] = await Promise.all([
    Donor.findById(f.owner).select('number firstName lastName email totalGiven giftCount firstGiftAt lastGiftAt hasActivePlan createdAt').lean(),
    Gift.find({ fundraiser: f._id, status: 'succeeded' })
      .sort({ date: -1 })
      .limit(20)
      .select('number donor donorName amount designation date anonymous message')
      .lean(),
    Fundraiser.countDocuments({ owner: f.owner }),
  ])
  res.json({ fundraiser: out(f), owner: owner ? { ...out<object>(owner), pages: pagesByOwner } : null, gifts: out(gifts) })
})

r.post('/:id/review', async (req, res) => {
  const body = parse(
    z
      .object({ decision: z.enum(['live', 'changes', 'rejected']), note: z.string().trim().max(2000).optional() })
      .refine((v) => v.decision === 'live' || (v.note && v.note.length >= 5), { message: 'Tell them what to change, or why', path: ['note'] }),
    req.body,
  )
  const f = await Fundraiser.findById(req.params.id)
  if (!f) throw notFound('That fundraiser')
  if (f.status === 'ended') throw badRequest('This fundraiser has ended, so there is nothing to review.')
  if (f.status === body.decision) throw badRequest('That is already its status.')

  f.status = body.decision
  f.review = { by: req.staff!.name, at: new Date(), note: body.note || undefined }
  await f.save()

  const owner = await Donor.findById(f.owner).select('firstName email').lean()
  if (owner?.email) {
    await sendEmail(owner.email, fundraiserReviewedEmail({ title: f.title, slug: f.slug }, owner.firstName, body.decision, body.note), { donor: owner._id })
  }
  const verb = body.decision === 'live' ? 'Approved' : body.decision === 'changes' ? 'Asked for changes to' : 'Declined'
  await audit(
    req,
    `fundraiser.${body.decision === 'live' ? 'approve' : body.decision === 'changes' ? 'changes' : 'reject'}`,
    `${verb} “${f.title}”, ${f.ownerName}'s fundraiser for ${f.appealTitle}`,
    { type: 'fundraiser', id: f._id, label: f.title },
    body.note ? { note: body.note } : undefined,
  )
  res.json(out(f.toObject()))
})

r.post('/:id/end', async (req, res) => {
  const f = await Fundraiser.findById(req.params.id)
  if (!f) throw notFound('That fundraiser')
  if (f.status === 'ended') return void res.json(out(f.toObject()))
  f.status = 'ended'
  if (!f.endsAt || f.endsAt > new Date()) f.endsAt = new Date()
  await f.save()
  await audit(req, 'fundraiser.end', `Ended “${f.title}”, ${f.ownerName}'s fundraiser`, { type: 'fundraiser', id: f._id, label: f.title })
  res.json(out(f.toObject()))
})

export default r
