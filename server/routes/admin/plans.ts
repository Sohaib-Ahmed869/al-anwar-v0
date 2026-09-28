import { Router, type Request } from 'express'
import { z } from 'zod'
import { FREQUENCIES, FREQUENCY_KEYS, PLAN_STATUSES, RETRY_SCHEDULE_DAYS, type Frequency, type PlanStatus } from '../../../shared/domain'
import { formatMoney } from '../../../shared/money'
import { paymentFailedEmail } from '../../emails/templates'
import { AuditEvent, Donor, Gift, Plan, type PlanDoc } from '../../models'
import { audit } from '../../lib/audit'
import { requireStaff } from '../../lib/auth'
import { sendEmail } from '../../lib/email'
import { badRequest, isId, notFound, oid, out, paging, parse, searchRegex, sorting } from '../../lib/http'
import { advance } from '../../lib/giving'
import { chargePlan } from '../../lib/plans'
import { refreshDonor } from '../../lib/stats'
import { donorSummary } from './gifts'

/* ---------------------------------------------------------------------------
   /api/admin/plans — regular giving, from the office's side.

   Everything here is something a donor can also do for themselves in their
   account; staff do it when a donor rings or emails. So every change is
   logged as done "on behalf of" the donor by name — an auditor reading the
   log can tell a donor's own pause from one the office made for them.

   Staff changes do not send the donor the self-service "you changed your
   gift" email (its wording is for the donor's own change); the one email
   sent from here is the failed-payment reminder, on request.

   "Recovered this month" has no field of its own: it is read from the gifts
   — a plan whose card was declined and which has since taken a payment
   this month is a plan the fix-link process saved.
--------------------------------------------------------------------------- */

const r = Router()
r.use(requireStaff('plans.manage'))

const STATUS_KEYS = Object.keys(PLAN_STATUSES) as PlanStatus[]
const DAY = 86_400_000
const fmtDay = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

/** The first payment date on the plan's own schedule (same weekday, or same
 *  day of the month) on or after `from` — as the donor's own pause does, so a
 *  pause never shifts the day they are used to being charged. */
function nextOnSchedule(p: PlanDoc, from: Date): Date {
  let d = new Date(p.startDate)
  const anchor = d.getDate()
  for (let i = 0; i < 5000 && d.getTime() < from.getTime(); i++) d = advance(d, p.frequency as Frequency, anchor)
  return d
}

function localDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 9)
}

/* ---------- list ---------- */
r.get('/', async (req, res) => {
  const q = req.query
  const { page, pageSize, skip } = paging(q)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base: Record<string, any> = {}
  if (q.kind === 'instalment' || q.kind === 'recurring') base.kind = q.kind
  if (FREQUENCY_KEYS.includes(q.frequency as Frequency)) base.frequency = q.frequency
  const rx = searchRegex(q.q)
  if (rx) base.$or = [{ donorName: rx }, { number: rx }, { appealTitle: rx }]
  if (isId(q.donor)) base.donor = oid(q.donor)

  const f = { ...base }
  if (STATUS_KEYS.includes(q.status as PlanStatus)) f.status = q.status

  /* failing plans read best soonest-retry first; everything else by next charge */
  const fallback: Record<string, 1 | -1> = f.status === 'past_due' ? { 'failure.nextRetryAt': 1 } : f.status === 'cancelled' ? { cancelledAt: -1 } : { nextChargeAt: 1 }
  const sort = sorting(q, ['nextChargeAt', 'amount', 'createdAt'], fallback)

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [items, total, counts, active, recovered] = await Promise.all([
    Plan.find(f).sort({ ...sort, _id: 1 }).skip(skip).limit(pageSize).select('-payment.stripeCustomer -payment.stripePaymentMethod').lean(),
    Plan.countDocuments(f),
    Plan.aggregate<{ _id: string; n: number }>([{ $match: base }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Plan.find({ status: 'active' }).select('amount frequency').lean(),
    recoveredThisMonth(monthStart),
  ])
  const byStatus = Object.fromEntries(STATUS_KEYS.map((s) => [s, counts.find((c) => c._id === s)?.n ?? 0])) as Record<PlanStatus, number>
  const all = await Plan.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }])
  const total_ = (s: PlanStatus) => all.find((c) => c._id === s)?.n ?? 0

  res.json({
    items: out(items),
    total,
    page,
    pageSize,
    counts: byStatus,
    summary: {
      /* what the active plans bring in, as a monthly figure */
      monthlyValue: Math.round(active.reduce((sum, p) => sum + (p.amount * FREQUENCIES[p.frequency as Frequency].perYear) / 12, 0)),
      active: total_('active'),
      failing: total_('past_due'),
      pausedCount: total_('paused'),
      recoveredThisMonth: recovered,
    },
  })
})

/** Plans with a declined payment in the last 60 days that have since been
 *  paid, where the payment came this month. */
async function recoveredThisMonth(monthStart: Date) {
  const rows = await Gift.aggregate<{ _id: unknown; firstFail: Date | null; lastPaid: Date | null }>([
    { $match: { plan: { $exists: true, $ne: null }, source: 'recurring', date: { $gte: new Date(monthStart.getTime() - 60 * DAY) } } },
    {
      $group: {
        _id: '$plan',
        firstFail: { $min: { $cond: [{ $eq: ['$status', 'failed'] }, '$date', null] } },
        lastPaid: { $max: { $cond: [{ $eq: ['$status', 'succeeded'] }, '$date', null] } },
      },
    },
    { $match: { firstFail: { $ne: null }, lastPaid: { $gte: monthStart } } },
  ])
  return rows.filter((x) => x.firstFail && x.lastPaid && x.lastPaid > x.firstFail).length
}

/* ---------- one plan ---------- */
async function load(id: string) {
  const plan = await Plan.findById(id)
  if (!plan) throw notFound('That regular donation')
  return plan
}

const view = (p: PlanDoc) => {
  const o = out<Record<string, unknown>>(p.toObject())
  const pay = o.payment as Record<string, unknown> | undefined
  if (pay) {
    delete pay.stripeCustomer
    delete pay.stripePaymentMethod
  }
  return o
}

r.get('/:id', async (req, res) => {
  const plan = await load(req.params.id)
  const [gifts, events, donor] = await Promise.all([
    Gift.find({ plan: plan._id }).sort({ date: -1 }).limit(60).select('number amount fee status date failureReason receipt method').lean(),
    AuditEvent.find({ 'entity.type': 'plan', 'entity.id': plan._id }).sort({ at: -1 }).limit(50).lean(),
    Donor.findById(plan.donor).lean(),
  ])
  res.json({ plan: view(plan), gifts: out(gifts), events: out(events), donor: donorSummary(donor) })
})

const onBehalf = (p: PlanDoc) => `on behalf of ${p.donorName}`
const log = (req: Request, p: PlanDoc, verb: string, summary: string) =>
  audit(req, `plan.${verb}`, summary, { type: 'plan', id: p._id, label: p.number })

/* ---------- take the payment now ---------- */
r.post('/:id/retry', async (req, res) => {
  const plan = await load(req.params.id)
  if (!['past_due', 'active'].includes(plan.status)) throw badRequest('Only an active or failing regular donation can be charged.')
  const result = await chargePlan(plan, req)
  await log(
    req,
    plan,
    'retry',
    `Retried the ${formatMoney(plan.amount)} payment on ${plan.number} ${onBehalf(plan)}: ${result.ok ? 'it went through' : `declined (${result.error})`}`,
  )
  const fresh = await load(req.params.id)
  res.json({ ok: result.ok, error: result.ok ? undefined : result.error, final: result.ok ? false : result.final, plan: view(fresh) })
})

/* ---------- pause / resume / cancel ---------- */
r.post('/:id/pause', async (req, res) => {
  const b = parse(z.object({ until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date').optional().or(z.literal('')) }), req.body)
  const plan = await load(req.params.id)
  if (!['active', 'past_due'].includes(plan.status)) throw badRequest('Only an active or failing regular donation can be paused.')
  const until = b.until ? localDay(b.until) : undefined
  if (until && until.getTime() < Date.now()) throw badRequest('Some details need another look.', { until: 'Choose a date after today' })
  plan.status = 'paused'
  plan.pausedUntil = until
  /* with an end date it carries on at the first payment after it; paused
     indefinitely, there is no next payment until someone resumes it */
  plan.set('nextChargeAt', until ? nextOnSchedule(plan, until) : undefined)
  await plan.save()
  await refreshDonor(plan.donor)
  await log(req, plan, 'pause', `Paused ${plan.number} (${formatMoney(plan.amount)} ${FREQUENCIES[plan.frequency as Frequency].per}) ${onBehalf(plan)}${until ? ` until ${fmtDay(until)}` : ' until further notice'}`)
  res.json({ plan: view(plan) })
})

r.post('/:id/resume', async (req, res) => {
  const plan = await load(req.params.id)
  if (plan.status !== 'paused') throw badRequest('This regular donation is not paused.')
  plan.status = 'active'
  plan.set('pausedUntil', undefined)
  plan.nextChargeAt = nextOnSchedule(plan, new Date(Date.now() + DAY / 2))
  await plan.save()
  await refreshDonor(plan.donor)
  await log(req, plan, 'resume', `Resumed ${plan.number} ${onBehalf(plan)}; next payment ${fmtDay(plan.nextChargeAt!)}`)
  res.json({ plan: view(plan) })
})

r.post('/:id/cancel', async (req, res) => {
  const b = parse(z.object({ reason: z.string().trim().min(3, 'Say briefly why, for the record').max(500) }), req.body)
  const plan = await load(req.params.id)
  if (['cancelled', 'completed'].includes(plan.status)) throw badRequest('This regular donation has already ended.')
  plan.status = 'cancelled'
  plan.cancelledAt = new Date()
  plan.cancelReason = b.reason
  plan.nextChargeAt = undefined
  plan.pausedUntil = undefined
  await plan.save()
  await refreshDonor(plan.donor)
  await log(req, plan, 'cancel', `Cancelled ${plan.number} (${formatMoney(plan.amount)} ${FREQUENCIES[plan.frequency as Frequency].per}) ${onBehalf(plan)}: ${b.reason}`)
  res.json({ plan: view(plan) })
})

/* ---------- change amount, frequency or next date ---------- */
const PatchBody = z.object({
  amount: z.number().int().min(100, 'The smallest regular donation is $1').max(10_000_000).optional(),
  frequency: z.enum(FREQUENCY_KEYS as [Frequency, ...Frequency[]]).optional(),
  nextChargeAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date').optional(),
})

r.patch('/:id', async (req, res) => {
  const b = parse(PatchBody, req.body)
  const plan = await load(req.params.id)
  if (['cancelled', 'completed'].includes(plan.status)) throw badRequest('This regular donation has ended and cannot be changed.')
  const changes: string[] = []
  if (b.amount != null && b.amount !== plan.amount) {
    changes.push(`amount ${formatMoney(plan.amount)} → ${formatMoney(b.amount)}`)
    plan.amount = b.amount
  }
  if (b.frequency && b.frequency !== plan.frequency) {
    changes.push(`frequency ${FREQUENCIES[plan.frequency as Frequency].label.toLowerCase()} → ${FREQUENCIES[b.frequency].label.toLowerCase()}`)
    plan.frequency = b.frequency
  }
  if (b.nextChargeAt) {
    const d = localDay(b.nextChargeAt)
    if (d.getTime() < Date.now() - DAY / 2) throw badRequest('Some details need another look.', { nextChargeAt: 'Choose today or a later date' })
    if (!plan.nextChargeAt || d.toDateString() !== plan.nextChargeAt.toDateString()) {
      changes.push(`next payment ${plan.nextChargeAt ? fmtDay(plan.nextChargeAt) : 'none'} → ${fmtDay(d)}`)
      plan.nextChargeAt = d
      /* a failing plan's retry follows the new date */
      if (plan.status === 'past_due' && plan.failure) plan.set('failure.nextRetryAt', d)
    }
  }
  if (!changes.length) return void res.json({ plan: view(plan), changed: false })
  await plan.save()
  await log(req, plan, 'update', `Changed ${plan.number} ${onBehalf(plan)}: ${changes.join('; ')}`)
  res.json({ plan: view(plan), changed: true })
})

/* ---------- send the fix-your-card email again ---------- */
r.post('/:id/remind', async (req, res) => {
  const plan = await load(req.params.id)
  if (plan.status !== 'past_due') throw badRequest('Only a regular donation whose payment failed needs a fix link.')
  const donor = await Donor.findById(plan.donor)
  if (!donor || donor.email.endsWith('.invalid')) throw badRequest('There is no email address on this donor’s record.')
  const final = !plan.failure?.nextRetryAt && (plan.failure?.count ?? 0) > RETRY_SCHEDULE_DAYS.length
  const sent = await sendEmail(
    donor.email,
    paymentFailedEmail(
      { amount: plan.amount, frequency: plan.frequency as Frequency, appealTitle: plan.appealTitle, payment: plan.payment },
      donor.firstName,
      plan.failure?.lastError ?? 'The payment was declined.',
      final,
      plan.id,
    ),
    { donor: donor._id },
  )
  if (!sent.ok) throw badRequest('The email could not be sent just now. It is in the Email log with the reason.')
  await log(req, plan, 'remind', `Emailed ${plan.donorName} (${donor.email}) a link to update the card on ${plan.number}`)
  res.json({ to: donor.email })
})

export default r
