import { Router, type Request } from 'express'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { FUNDRAISER_OCCASIONS, FUNDRAISER_STATUSES, type FundraiserOccasion } from '../../../shared/domain'
import { formatMoney } from '../../../shared/money'
import { audit } from '../../lib/audit'
import { HttpError, isId, notFound, out, parse, zCents } from '../../lib/http'
import { Appeal, Fundraiser, Gift, type FundraiserDoc } from '../../models'
import { donorName, me } from './util'

/* ---------------------------------------------------------------------------
   /api/me/fundraisers — a supporter's own fundraising pages.

   A page counts towards one appeal: gifts made on it carry Gift.fundraiser
   AND the appeal, so the appeal's total and the page's total both move.

   Nothing a supporter writes goes public unchecked. A new page starts
   'pending' and waits in the admin approval queue. Once live, editing the
   words people read (title, story) sends it back to 'pending' for another
   look — the portal says so before they save. Numbers (target, end date) are
   the supporter's own business and change on a live page straight away.
--------------------------------------------------------------------------- */

const r = Router()

const OCCASIONS = Object.keys(FUNDRAISER_OCCASIONS) as [FundraiserOccasion, ...FundraiserOccasion[]]

async function ownPage(req: Request): Promise<FundraiserDoc> {
  const id = String(req.params.id)
  if (!isId(id)) throw notFound('That fundraiser')
  const f = await Fundraiser.findOne({ _id: id, owner: me(req)._id })
  if (!f) throw notFound('That fundraiser')
  return f
}

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '')
  /* a short random tail so two "Ramadan challenge" pages never collide and a
     slug cannot be guessed before the page is approved */
  const tail = randomBytes(3).toString('hex').slice(0, 5)
  return `${base || 'fundraiser'}-${tail}`
}

const endsAtSchema = z
  .union([z.null(), z.coerce.date()])
  .optional()
  .refine((d) => !d || d.getTime() > Date.now(), 'Choose a date in the future')

const createSchema = z.object({
  appeal: z.string().regex(/^[a-f\d]{24}$/i, 'Choose the appeal your page supports'),
  occasion: z.enum(OCCASIONS),
  title: z.string().trim().min(6, 'Give your page a title of at least a few words').max(90, 'Keep the title under 90 characters'),
  story: z.string().trim().min(40, 'Tell people a little more — a few sentences at least').max(5000, 'Keep the story under 5,000 characters'),
  target: zCents.min(100_00, 'Set a target of at least $100').max(10_000_000_00, 'That target is higher than we can take online'),
  endsAt: endsAtSchema,
})

const withRaised = async (ids: unknown[]) => {
  /* the page's figures are denormalised by lib/stats; count gifts still
     awaiting a bank transfer separately so the owner sees them coming */
  const pending = await Gift.aggregate<{ _id: unknown; total: number }>([
    { $match: { fundraiser: { $in: ids }, status: 'pending' } },
    { $group: { _id: '$fundraiser', total: { $sum: '$amount' } } },
  ])
  return new Map(pending.map((p) => [String(p._id), p.total]))
}

r.get('/', async (req, res) => {
  const items = await Fundraiser.find({ owner: me(req)._id }).sort({ createdAt: -1 }).lean()
  const pending = await withRaised(items.map((f) => f._id))
  res.json({ items: items.map((f) => ({ ...out<Record<string, unknown>>(f), pendingAmount: pending.get(String(f._id)) ?? 0 })) })
})

/** Open appeals a page can support, for the first step of the form. */
r.get('/appeals', async (_req, res) => {
  const appeals = await Appeal.find({ status: 'open' }).sort({ featured: -1, title: 1 }).select('title slug summary country image target raised').lean()
  res.json({ items: appeals.map((a) => out(a)) })
})

r.get('/:id', async (req, res) => {
  const f = await ownPage(req)
  const recent = await Gift.find({ fundraiser: f._id, status: 'succeeded' }).sort({ date: -1 }).limit(10)
    .select('amount date donorName anonymous message').lean()
  res.json({
    fundraiser: out(f.toObject()),
    /* supporters who gave, as the public page shows them: anonymous stays anonymous */
    recent: recent.map((g) => ({ id: String(g._id), amount: g.amount, date: g.date, name: g.anonymous ? 'Anonymous' : g.donorName.split(' ')[0], message: g.message })),
  })
})

r.post('/', async (req, res) => {
  const body = parse(createSchema, req.body)
  const appeal = await Appeal.findById(body.appeal)
  if (!appeal || appeal.status !== 'open') throw new HttpError(400, 'That appeal is not taking gifts right now. Choose another.', { appeal: 'Not open' })
  const donor = me(req)
  const f = await Fundraiser.create({
    slug: slugify(body.title),
    owner: donor._id,
    ownerName: donorName(donor),
    appeal: appeal._id,
    appealTitle: appeal.title,
    title: body.title,
    story: body.story,
    occasion: body.occasion,
    target: body.target,
    endsAt: body.endsAt ?? undefined,
    status: 'pending',
  })
  await audit(req, 'fundraiser.create', `${donorName(donor)} created the fundraiser “${f.title}” for ${appeal.title} (target ${formatMoney(f.target)}), sent for approval`, {
    type: 'fundraiser', id: f._id, label: f.title,
  })
  res.status(201).json({ fundraiser: out(f.toObject()) })
})

r.patch('/:id', async (req, res) => {
  const body = parse(createSchema.omit({ appeal: true }).partial(), req.body)
  const f = await ownPage(req)
  if (f.status === 'ended' || f.status === 'rejected') {
    throw new HttpError(400, f.status === 'ended' ? 'This page has ended, so it can no longer be changed.' : 'This page was not approved. Start a new one, or reply to our email and we can talk it through.')
  }
  const wordsChanged = (body.title != null && body.title !== f.title) || (body.story != null && body.story !== f.story)
  const changed: string[] = []
  if (body.title != null && body.title !== f.title) changed.push('title')
  if (body.story != null && body.story !== f.story) changed.push('story')
  if (body.occasion && body.occasion !== f.occasion) changed.push('occasion')
  if (body.target != null && body.target !== f.target) changed.push(`target ${formatMoney(f.target)} → ${formatMoney(body.target)}`)
  if (body.endsAt !== undefined && String(body.endsAt ?? '') !== String(f.endsAt ?? '')) changed.push('end date')
  if (!changed.length) {
    res.json({ fundraiser: out(f.toObject()), resubmitted: false })
    return
  }

  if (body.title != null) f.title = body.title
  if (body.story != null) f.story = body.story
  if (body.occasion) f.occasion = body.occasion
  if (body.target != null) f.target = body.target
  if (body.endsAt !== undefined) f.set('endsAt', body.endsAt ?? undefined)
  /* the words are what the team checks: a live page whose words changed, or
     a page the team asked to change, goes (back) into the approval queue */
  const resubmitted = (wordsChanged && f.status === 'live') || f.status === 'changes'
  const was = f.status
  if (resubmitted) f.status = 'pending'
  await f.save()
  await audit(
    req,
    'fundraiser.update',
    `${donorName(me(req))} edited their fundraiser “${f.title}” (${changed.join(', ')})${resubmitted ? `; it went from ${FUNDRAISER_STATUSES[was as keyof typeof FUNDRAISER_STATUSES].label.toLowerCase()} back to awaiting approval` : ''}`,
    { type: 'fundraiser', id: f._id, label: f.title },
  )
  res.json({ fundraiser: out(f.toObject()), resubmitted })
})

r.post('/:id/end', async (req, res) => {
  const f = await ownPage(req)
  if (f.status === 'ended') throw new HttpError(400, 'This page has already ended.')
  if (f.status === 'rejected') throw new HttpError(400, 'This page was not approved, so there is nothing to end.')
  const was = f.status
  f.status = 'ended'
  if (!f.endsAt || f.endsAt > new Date()) f.endsAt = new Date()
  await f.save()
  await audit(req, 'fundraiser.end', `${donorName(me(req))} ended their fundraiser “${f.title}” (was ${was}; ${formatMoney(f.raised ?? 0)} raised)`, {
    type: 'fundraiser', id: f._id, label: f.title,
  })
  res.json({ fundraiser: out(f.toObject()) })
})

export default r
