import type { Request } from 'express'
import type { Types } from 'mongoose'
import { PRE_CHARGE_NOTICE_DAYS, RETRY_SCHEDULE_DAYS, sydneyDay, type Designation, type Frequency } from '../../shared/domain'
import { formatMoney } from '../../shared/money'
import { preChargeEmail } from '../emails/templates'
import { audit, auditSystem } from '../lib/audit'
import { sendEmail } from '../lib/email'
import { advance } from '../lib/giving'
import { chargePlan } from '../lib/plans'
import { refreshDonor } from '../lib/stats'
import { Donor, Plan, nextPlanNumber, type DonorDoc, type GiftDoc, type PlanDoc } from '../models'
import { isStopping } from './lifecycle'

/* ---------------------------------------------------------------------------
   The recurring-gift engine: what the scheduler runs every few minutes.

   chargePlan() in lib/plans.ts takes one payment and knows everything about
   success, decline, retry and the emails that go with them. This file only
   decides WHICH plans are due, and in what state:

     active     nextChargeAt has come              → charge
     past_due   failure.nextRetryAt has come, and  → charge (a retry)
                retries are not used up
     paused     pausedUntil has passed             → resume, next date in the
                                                     future, no back-charge

   NO CATCHING UP. If the server was down for a fortnight, a weekly plan is
   charged once when it comes back, not three times in a row: after a
   successful charge the next date is moved forward past today. A donor who
   gives $20 a week expects $20, not $60 on one morning because of our outage.

   Each plan is charged inside its own try/catch, so one bad record (a donor
   deleted by hand, a card the provider chokes on) never stops the rest of
   the run.

   SAFE WITH MORE THAN ONE RUNNER. The scheduler holds a lease so only one
   process runs this at a time (scheduler.ts), but a click in the portal can
   still land in the middle of a run. So every change here is conditional on
   the state it was decided from: a pause is ended only if the plan is still
   paused, a notice is claimed before it is sent, and chargePlan() claims the
   plan before it takes a payment (lib/plans.ts). Between plans the run checks
   whether the process is shutting down, and stops there rather than mid-charge.

   startPlan() is the other half: how a regular gift begins, from the website
   (simulated checkout) or from the Stripe webhook once the first payment has
   landed. It lives here because it is the engine's front door.
--------------------------------------------------------------------------- */

/** The first date on or after `from` that is still in the future. */
function nextFuture(from: Date, frequency: Frequency, anchorDay: number, now = new Date()) {
  let d = new Date(from)
  for (let i = 0; d <= now && i < 1000; i++) d = advance(d, frequency, anchorDay)
  return d
}

const anchorOf = (plan: PlanDoc) => new Date(plan.startDate).getDate()

export type RunSummary = { charged: number; failed: number; resumed: number; errors: number }

export async function processDuePlans(now = new Date()): Promise<RunSummary> {
  const summary: RunSummary = { charged: 0, failed: 0, resumed: 0, errors: 0 }

  /* 1. paused plans whose pause has run out */
  const waking = await Plan.find({ status: 'paused', pausedUntil: { $lte: now } })
  for (const plan of waking) {
    if (isStopping()) return summary
    try {
      const next = nextFuture(plan.nextChargeAt ?? now, plan.frequency as Frequency, anchorOf(plan), now)
      const woke = await Plan.updateOne(
        { _id: plan._id, status: 'paused', pausedUntil: plan.pausedUntil },
        { $set: { status: 'active', nextChargeAt: next }, $unset: { pausedUntil: 1 } },
      )
      if (!woke.modifiedCount) continue
      plan.nextChargeAt = next
      summary.resumed++
      await auditSystem(
        'plan.resume',
        `Resumed ${plan.number} for ${plan.donorName} after its pause ended; next payment ${sydneyDay(plan.nextChargeAt)}`,
        { type: 'plan', id: plan._id, label: plan.number },
      )
    } catch (err) {
      summary.errors++
      console.error('[jobs] could not resume', plan.number, err)
    }
  }

  /* 2. payments due, and retries due */
  const due = await Plan.find({
    $or: [
      { status: 'active', nextChargeAt: { $lte: now } },
      {
        status: 'past_due',
        'failure.nextRetryAt': { $lte: now },
        'failure.count': { $lte: RETRY_SCHEDULE_DAYS.length },
      },
    ],
  }).sort({ nextChargeAt: 1 })

  for (const plan of due) {
    if (isStopping()) return summary
    try {
      const r = await chargePlan(plan)
      if (r.ok) {
        summary.charged++
        /* no catching up — see the note at the top. Read back what the charge
           left, and move the date only if nobody has moved it since. */
        const fresh = await Plan.findById(plan._id).select('status nextChargeAt frequency startDate')
        if (fresh && fresh.status === 'active' && fresh.nextChargeAt && fresh.nextChargeAt <= now) {
          await Plan.updateOne(
            { _id: fresh._id, status: 'active', nextChargeAt: fresh.nextChargeAt },
            { $set: { nextChargeAt: nextFuture(fresh.nextChargeAt, fresh.frequency as Frequency, anchorOf(fresh), now) } },
          )
        }
      } else if (!(r as { busy?: boolean }).busy) {
        /* "busy" is not a decline: something else charged or claimed this plan
           since the list was read (a card update, a retry, another runner) */
        summary.failed++
      }
    } catch (err) {
      summary.errors++
      console.error('[jobs] could not charge', plan.number, err)
    }
  }
  return summary
}

/** The heads-up email, PRE_CHARGE_NOTICE_DAYS before each payment, once per
 *  payment date (noticeSentFor remembers which date it was sent for). */
export async function sendPreChargeNotices(now = new Date()): Promise<number> {
  const horizon = new Date(now.getTime() + PRE_CHARGE_NOTICE_DAYS * 86_400_000)
  const plans = await Plan.find({ status: 'active', nextChargeAt: { $gt: now, $lte: horizon } })
  let sent = 0
  for (const plan of plans) {
    if (isStopping()) break
    if (!plan.nextChargeAt) continue
    if (plan.noticeSentFor && plan.noticeSentFor.getTime() === plan.nextChargeAt.getTime()) continue
    /* claim this date's notice before sending it, so two runners can't both send it */
    const claimed = await Plan.updateOne(
      { _id: plan._id, status: 'active', nextChargeAt: plan.nextChargeAt, noticeSentFor: { $ne: plan.nextChargeAt } },
      { $set: { noticeSentFor: plan.nextChargeAt } },
    )
    if (!claimed.modifiedCount) continue
    try {
      const donor = await Donor.findById(plan.donor)
      if (!donor) continue
      await sendEmail(
        donor.email,
        preChargeEmail(
          {
            amount: plan.amount,
            frequency: plan.frequency as Frequency,
            appealTitle: plan.appealTitle,
            nextChargeAt: plan.nextChargeAt,
            payment: plan.payment,
            kind: plan.kind,
            instalments: plan.instalments,
          },
          donor.firstName,
        ),
        { donor: donor._id },
      )
      sent++
    } catch (err) {
      /* give the claim back, so the next run tries again */
      await Plan.updateOne({ _id: plan._id, noticeSentFor: plan.nextChargeAt }, { $unset: { noticeSentFor: 1 } })
      console.error('[jobs] could not send notice for', plan.number, err)
    }
  }
  return sent
}

/* ---------- how a regular gift begins ---------- */

export type PlanPayment = {
  method: 'card' | 'paypal'
  brand?: string
  last4?: string
  expMonth?: number
  expYear?: number
  stripeCustomer?: string
  stripePaymentMethod?: string
}

/** Start a regular gift whose first payment has already been taken (and
 *  recorded as `firstGift`, if it exists yet). Links that gift to the plan. */
export async function startPlan(
  p: {
    donor: DonorDoc
    amount: number
    /** cents added to every payment towards operating costs (0, 200, 500 or
     *  1000). Replaces the old coverFee flag, which startPlan no longer sets. */
    operatingCosts: number
    designation: Designation
    frequency: Frequency
    instalments?: number | null
    appeal?: { _id: Types.ObjectId; title: string } | null
    payment: PlanPayment
    firstGift?: GiftDoc | null
    start?: Date
  },
  req?: Request | null,
): Promise<PlanDoc> {
  const start = p.start ?? new Date()
  const instalment = Boolean(p.instalments && p.instalments > 1)
  const plan = await Plan.create({
    number: await nextPlanNumber(),
    donor: p.donor._id,
    donorName: `${p.donor.firstName} ${p.donor.lastName ?? ''}`.trim(),
    appeal: p.appeal?._id,
    appealTitle: p.appeal?.title,
    designation: p.designation,
    amount: p.amount,
    operatingCosts: p.operatingCosts,
    frequency: p.frequency,
    kind: instalment ? 'instalment' : 'recurring',
    instalments: instalment ? { total: p.instalments, paid: 1 } : undefined,
    status: 'active',
    startDate: start,
    nextChargeAt: advance(start, p.frequency, start.getDate()),
    lastChargeAt: start,
    failure: { count: 0 },
    payment: p.payment,
    collected: p.firstGift ? p.amount : 0,
    /* set in the same write that creates the plan, so the unique index on
       Plan.firstGift refuses a second plan for one payment outright */
    firstGift: p.firstGift?._id,
  })
  if (p.firstGift) {
    p.firstGift.plan = plan._id
    await p.firstGift.save()
  }
  await refreshDonor(p.donor._id)
  const what = instalment
    ? `${p.instalments} ${p.frequency} instalments of ${formatMoney(p.amount)}`
    : `a ${p.frequency} donation of ${formatMoney(p.amount)}`
  await audit(
    req ?? null,
    'plan.create',
    `Started ${plan.number}: ${what} from ${plan.donorName}${plan.appealTitle ? ` to ${plan.appealTitle}` : ''}`,
    { type: 'plan', id: plan._id, label: plan.number },
  )
  return plan
}
