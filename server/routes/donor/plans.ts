import { Router, type Request } from 'express'
import { z } from 'zod'
import { FREQUENCIES, FREQUENCY_KEYS, type Frequency } from '../../../shared/domain'
import { formatMoney } from '../../../shared/money'
import { planChangedEmail } from '../../emails/templates'
import { paymentsSimulated } from '../../env'
import { audit } from '../../lib/audit'
import { sendEmail } from '../../lib/email'
import { advance } from '../../lib/giving'
import { HttpError, isId, notFound, out, parse, zCents } from '../../lib/http'
import { brandOf, cardUpdateSession } from '../../lib/payments'
import { chargePlan } from '../../lib/plans'
import { refreshDonor } from '../../lib/stats'
import { Gift, Plan, type PlanDoc } from '../../models'
import { donorName, giftOut, me, planOut } from './util'

/* ---------------------------------------------------------------------------
   /api/me/plans — regular gifts, managed by the donor, any hour.

   The proposal promised a donor could pause, change the amount, switch card
   or cancel without ringing the office. Each change here:
     - is confirmed to the donor by email (planChangedEmail), so a change they
       did not make is noticed;
     - is written to the action log as the donor's own doing, so staff reading
       the plan's history can tell "she cancelled it" from "we cancelled it".

   Dates: a regular gift keeps its day of the month (lib/giving advance()), so
   resuming after a pause lands on the next occurrence of the original day
   rather than "today", which is what a donor who set it up for payday wants.

   Switching card has two paths. With Stripe connected the card never touches
   this server: we hand back a Stripe Checkout (setup mode) URL. In simulated
   mode the portal collects test card details itself, and this route checks
   them the way Stripe would (Luhn, expiry) and keeps only brand, last four
   and expiry. A plan that was failing is charged straight away with the new
   card, and the donor is told on the spot whether it went through.
--------------------------------------------------------------------------- */

const r = Router()

const LIVE = ['active', 'paused', 'past_due']

async function ownPlan(req: Request): Promise<PlanDoc> {
  const id = String(req.params.id)
  if (!isId(id)) throw notFound('That regular gift')
  const p = await Plan.findOne({ _id: id, donor: me(req)._id })
  if (!p) throw notFound('That regular gift')
  return p
}

function requireLive(p: PlanDoc) {
  if (!LIVE.includes(p.status)) {
    throw new HttpError(400, p.status === 'completed' ? 'This gift has been paid in full, so there is nothing left to change.' : 'This regular gift has been cancelled. You can start a new one from the Give page.')
  }
}

/** The first due date after `after`, stepping from the plan's own schedule. */
function nextDateAfter(p: PlanDoc, after: Date): Date {
  const anchor = new Date(p.startDate).getDate()
  /* from the last payment actually taken, not the stored next date: that may
     already have been pushed out by an earlier pause */
  let d = new Date(p.lastChargeAt ?? p.startDate)
  let guard = 0
  while (d <= after && guard++ < 1000) d = advance(d, p.frequency as Frequency, anchor)
  return d
}

const describe = (p: PlanDoc) => `${formatMoney(p.amount)} ${FREQUENCIES[p.frequency as Frequency].label.toLowerCase()} gift ${p.number}${p.appealTitle ? ` to ${p.appealTitle}` : ''}`

async function confirmByEmail(req: Request, p: PlanDoc, what: string) {
  const donor = me(req)
  await sendEmail(
    donor.email,
    planChangedEmail(
      {
        amount: p.amount,
        frequency: p.frequency as Frequency,
        appealTitle: p.appealTitle,
        nextChargeAt: p.status === 'cancelled' ? null : p.nextChargeAt,
        payment: p.payment,
        kind: p.kind,
        instalments: p.instalments,
      },
      donor.firstName,
      what,
    ),
    { donor: donor._id },
  )
}

const planJson = (p: PlanDoc) => out(planOut(p.toObject()))

/* ---------- reading ---------- */
r.get('/', async (req, res) => {
  const plans = await Plan.find({ donor: me(req)._id }).sort({ createdAt: -1 }).lean()
  const order = { past_due: 0, active: 1, paused: 2, completed: 3, cancelled: 4 } as Record<string, number>
  plans.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))
  res.json({ items: plans.map((p) => out(planOut(p))), simulated: paymentsSimulated })
})

r.get('/:id', async (req, res) => {
  const p = await ownPlan(req)
  const gifts = await Gift.find({ donor: me(req)._id, plan: p._id }).sort({ date: -1 }).limit(60).lean()
  res.json({ plan: planJson(p), gifts: gifts.map((g) => out(giftOut(g))), simulated: paymentsSimulated })
})

/* ---------- changing ---------- */
r.patch('/:id', async (req, res) => {
  const body = parse(
    z.object({
      amount: zCents.min(100, 'The smallest regular gift is $1').max(10_000_00, 'For a regular gift over $10,000, please get in touch').optional(),
      frequency: z.enum(FREQUENCY_KEYS as [Frequency, ...Frequency[]]).optional(),
    }),
    req.body,
  )
  const p = await ownPlan(req)
  requireLive(p)
  if (p.kind === 'instalment') {
    throw new HttpError(400, 'Instalments are fixed so the whole gift is paid on schedule. To change one, send us a message and we will sort it out.')
  }
  const before = describe(p)
  const changes: string[] = []
  if (body.amount != null && body.amount !== p.amount) {
    changes.push(`amount ${formatMoney(p.amount)} → ${formatMoney(body.amount)}`)
    p.amount = body.amount
  }
  if (body.frequency && body.frequency !== p.frequency) {
    changes.push(`${FREQUENCIES[p.frequency as Frequency].label.toLowerCase()} → ${FREQUENCIES[body.frequency].label.toLowerCase()}`)
    /* the next payment keeps its date; the new rhythm starts from there */
    p.frequency = body.frequency
  }
  if (!changes.length) {
    res.json({ plan: planJson(p), changed: false })
    return
  }
  /* a new amount deserves a fresh heads-up email before it is taken */
  p.set('noticeSentFor', undefined)
  await p.save()
  await confirmByEmail(req, p, body.amount != null && changes.length === 1 && changes[0].startsWith('amount') ? 'Your new amount is set' : 'Your regular gift has been updated')
  await audit(req, 'plan.update', `${donorName(me(req))} changed their ${before} themselves: ${changes.join(', ')}`, { type: 'plan', id: p._id, label: p.number })
  res.json({ plan: planJson(p), changed: true })
})

r.post('/:id/pause', async (req, res) => {
  const { until } = parse(
    z.object({ until: z.coerce.date().nullable().optional() }),
    req.body,
  )
  const p = await ownPlan(req)
  requireLive(p)
  if (p.status === 'past_due') throw new HttpError(400, 'The last payment on this gift did not go through. Update the card first, then you can pause it.')
  if (until && until.getTime() < Date.now() + 86_400_000) throw new HttpError(400, 'Choose a date at least a day from now.', { until: 'Too soon' })
  if (until && until.getTime() > Date.now() + 366 * 86_400_000) throw new HttpError(400, 'A pause can last up to a year.', { until: 'Too far ahead' })
  p.status = 'paused'
  p.set('pausedUntil', until ?? undefined)
  /* with an end date, the next payment is the first one after it; paused
     indefinitely, there is no next payment until they resume */
  p.set('nextChargeAt', until ? nextDateAfter(p, until) : undefined)
  await p.save()
  await refreshDonor(p.donor)
  const when = until ? until.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : null
  await confirmByEmail(req, p, when ? `Paused until ${when}` : 'Your regular gift is paused')
  await audit(req, 'plan.pause', `${donorName(me(req))} paused their ${describe(p)} themselves${when ? ` until ${when}` : ' until they resume it'}`, { type: 'plan', id: p._id, label: p.number })
  res.json({ plan: planJson(p) })
})

r.post('/:id/resume', async (req, res) => {
  const p = await ownPlan(req)
  requireLive(p)
  if (p.status !== 'paused') throw new HttpError(400, 'This gift is not paused.')
  p.status = 'active'
  p.set('pausedUntil', undefined)
  p.nextChargeAt = nextDateAfter(p, new Date())
  await p.save()
  await refreshDonor(p.donor)
  await confirmByEmail(req, p, 'Your regular gift has resumed')
  await audit(req, 'plan.resume', `${donorName(me(req))} resumed their ${describe(p)} themselves`, { type: 'plan', id: p._id, label: p.number })
  res.json({ plan: planJson(p) })
})

r.post('/:id/cancel', async (req, res) => {
  const { reason } = parse(z.object({ reason: z.string().trim().max(500).optional() }), req.body)
  const p = await ownPlan(req)
  requireLive(p)
  p.status = 'cancelled'
  p.cancelledAt = new Date()
  p.set('cancelReason', reason || undefined)
  p.set('nextChargeAt', undefined)
  p.set('pausedUntil', undefined)
  await p.save()
  await refreshDonor(p.donor)
  await confirmByEmail(req, p, 'Your regular gift is cancelled')
  await audit(req, 'plan.cancel', `${donorName(me(req))} cancelled their ${describe(p)} themselves${reason ? ` — “${reason}”` : ''}`, { type: 'plan', id: p._id, label: p.number })
  res.json({ plan: planJson(p) })
})

/* ---------- switching card ---------- */
function luhn(num: string) {
  let sum = 0
  let dbl = false
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i])
    if (dbl) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    dbl = !dbl
  }
  return sum % 10 === 0
}

r.post('/:id/card', async (req, res) => {
  const p = await ownPlan(req)
  requireLive(p)
  const donor = me(req)

  if (!paymentsSimulated) {
    const url = await cardUpdateSession({ customer: p.payment?.stripeCustomer, email: donor.email, planId: p.id, returnPath: '/account/plans' })
    if (!url) throw new HttpError(502, 'We could not open the secure card page just now. Please try again.')
    res.json({ url })
    return
  }

  const body = parse(
    z.object({
      number: z.string().transform((s) => s.replace(/[\s-]/g, '')).pipe(z.string().regex(/^\d{13,19}$/, 'Enter the long number on the front of the card')),
      expMonth: z.coerce.number().int().min(1, 'Month is 1 to 12').max(12, 'Month is 1 to 12'),
      expYear: z.coerce.number().int().transform((y) => (y < 100 ? 2000 + y : y)),
      name: z.string().trim().min(2, 'Enter the name on the card').max(80),
    }),
    req.body,
  )
  if (!luhn(body.number)) throw new HttpError(400, 'That card number does not look right.', { number: 'Check the number — a digit may be off' })
  const now = new Date()
  const expired = body.expYear < now.getFullYear() || (body.expYear === now.getFullYear() && body.expMonth < now.getMonth() + 1)
  if (expired) throw new HttpError(400, 'That card has expired.', { expYear: 'This card has expired' })
  if (body.expYear > now.getFullYear() + 20) throw new HttpError(400, 'Check the expiry year.', { expYear: 'Check the year' })

  const wasFailing = p.status === 'past_due'
  const brand = brandOf(body.number)
  const last4 = body.number.slice(-4)
  p.set('payment', { ...(p.toObject().payment ?? {}), method: 'card', brand, last4, expMonth: body.expMonth, expYear: body.expYear })
  await p.save()
  await audit(req, 'plan.card', `${donorName(donor)} switched the card on their ${describe(p)} themselves, to ${brand} ending ${last4}`, { type: 'plan', id: p._id, label: p.number })

  let charge: { ok: boolean; error?: string } | null = null
  if (wasFailing) {
    /* take the missed payment now with the new card; on success chargePlan
       moves the plan back to active and on to its next date */
    p.set('failure', { count: 0 })
    p.nextChargeAt = new Date()
    await p.save()
    const result = await chargePlan(p, req)
    charge = result.ok ? { ok: true } : { ok: false, error: result.error }
  }
  const fresh = (await Plan.findById(p._id))!
  /* a declined retry has already emailed the donor (chargePlan); one email is enough */
  if (!charge || charge.ok) await confirmByEmail(req, fresh, charge?.ok ? 'Your card is updated and your gift went through' : 'Your card is updated')
  res.json({ plan: planJson(fresh), charge })
})

export default r
