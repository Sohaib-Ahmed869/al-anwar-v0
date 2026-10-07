import type { Request } from 'express'
import { RETRY_SCHEDULE_DAYS, type Designation, type Frequency } from '../../shared/domain'
import { formatMoney } from '../../shared/money'
import { paymentFailedEmail } from '../emails/templates'
import { env } from '../env'
import { Donor, Gift, Plan, getSettings, type GiftDoc, type PlanDoc } from '../models'
import { alert } from './alert'
import { audit, auditSystem } from './audit'
import { sendEmail } from './email'
import { advance, recordGift } from './giving'
import { chargeSavedCard } from './payments'
import { refreshDonor } from './stats'

/* ---------------------------------------------------------------------------
   Taking one regular payment.

   On success: a gift is recorded (receipt, appeal total, log), the plan moves
   to its next date, and an instalment plan that has taken its last payment
   completes itself.

   On a decline the plan does not quietly die. It goes `past_due`, the donor
   is emailed a link to fix the card, the office sees it on the dashboard, and
   the card is tried again on the RETRY_SCHEDULE_DAYS. After the last retry
   the plan stops being charged and the donor is told that too — it stays
   `past_due` rather than `cancelled`, because the donor never cancelled it
   and updating the card brings it straight back.

   ONLY A DECLINE IS A DECLINE. Stripe answering "card declined" is the card;
   Stripe not answering (a timeout, a dropped connection, its own 5xx), or a
   payment still `processing`, says nothing about the card — and the charge
   may well have gone through. Those leave the attempt where it was, so the
   next run sends the SAME idempotency key and Stripe hands back the payment
   it already made rather than taking a second one. The donor is not told
   their card failed, and the plan is not moved on, until there is an answer.
   An answer that never comes within Stripe's 24-hour memory of a key is
   looked up by the key itself, which every payment carries in its metadata
   (lib/payments.ts). The PaymentIntent also says which plan and date it was
   for, so the webhook can record a payment that settles later
   (settlePlanPayment below).

   ONE PAYMENT AT A TIME, AND ONLY WHEN DUE. Four things can ask for a payment
   on the same plan: the scheduler, an admin's "Retry now", a donor's new
   card, and Stripe's card-update webhook. Before charging, chargePlan()
   claims the plan with a single conditional update (chargingAt) — and the
   claim also requires the plan to still be due: an active plan whose date
   has come, or a failing one whose retry date has come. So the scheduler,
   working down a list it read a moment ago, cannot charge a plan that a card
   update has just charged and moved to next month (that would take next
   month's payment today, under a new key). The two deliberate "now" paths —
   a new card, or staff pressing Retry on a failing plan — pass retryNow,
   which lets a failing plan be charged before its retry date; an active plan
   is still only ever charged when due. A claim is released when the charge is
   settled; one older than ten minutes is treated as abandoned (a crash
   mid-charge), so a plan can never be locked for good (finding M7).

   EVERY STEP OF A PAID CHARGE COUNTS ONCE. The gift is unique on its Stripe
   payment id; the plan's collected total and instalment count are added to
   once per gift (countedGifts); and the plan is moved on only if it is still
   waiting on that same date and still active or failing. A run that died
   after recording the gift, a webhook and the scheduler settling the same
   payment, or a donor cancelling while the charge was in flight therefore
   neither counts it twice, skips a count, nor brings a cancelled plan back.
--------------------------------------------------------------------------- */

const CLAIM_STALE_MS = 10 * 60_000

export type ChargePlanResult =
  | { ok: true }
  | { ok: false; error: string; final?: boolean; busy?: boolean; pending?: boolean }

export type ChargeOptions = {
  /** charge a failing plan now, before its retry date: the donor has just
   *  given a new card, or staff pressed Retry. Never makes an active plan due. */
  retryNow?: boolean
}

export async function chargePlan(input: PlanDoc, req?: Request | null, opts: ChargeOptions = {}): Promise<ChargePlanResult> {
  const claimedAt = new Date()
  const dueNow = [
    { status: 'active', nextChargeAt: { $lte: claimedAt } },
    opts.retryNow ? { status: 'past_due' } : { status: 'past_due', 'failure.nextRetryAt': { $lte: claimedAt } },
  ]
  const free = [{ chargingAt: null }, { chargingAt: { $lt: new Date(claimedAt.getTime() - CLAIM_STALE_MS) } }]
  const plan = await Plan.findOneAndUpdate(
    { _id: input._id, $and: [{ $or: dueNow }, { $or: free }] },
    { $set: { chargingAt: claimedAt } },
    { returnDocument: 'after' },
  )
  if (!plan) {
    return { ok: false, busy: true, error: 'This regular donation is not due for a payment just now, or one is already being taken.' }
  }
  try {
    return await chargeClaimed(plan, req)
  } finally {
    /* only our own claim: a stale one taken over by someone else is theirs */
    await Plan.updateOne({ _id: plan._id, chargingAt: claimedAt }, { $unset: { chargingAt: 1 } })
  }
}

/** What the donor pays on top of the gift each time. The operating-costs
 *  contribution they chose; a plan started before 28 September 2026 has none
 *  stored and keeps the percentage fee it was agreed on, so nobody's regular
 *  donation changes under them. */
async function feeOf(plan: PlanDoc) {
  if (plan.operatingCosts != null) return plan.operatingCosts
  const s = await getSettings()
  return plan.coverFee ? Math.round(plan.amount * s.payments.feeRate) : 0
}

async function chargeClaimed(plan: PlanDoc, req?: Request | null): Promise<ChargePlanResult> {
  const donor = await Donor.findById(plan.donor)
  if (!donor) return { ok: false as const, error: 'Donor not found' }
  const fee = await feeOf(plan)
  const due = plan.nextChargeAt ?? new Date()
  const attempt = plan.failure?.count ?? 0
  /* one key per plan, date, attempt and sum: the same request again (after a
     lost answer) is the same payment; a changed amount is a new request */
  const key = `${plan.id}-${due.toISOString().slice(0, 10)}-${attempt}-${plan.amount + fee}`
  const waiting = plan.pendingCharge?.key === key ? plan.pendingCharge : null

  const result = await chargeSavedCard({
    amount: plan.amount + fee,
    description: `${plan.appealTitle ?? 'Al-Anwaar'} — regular donation ${plan.number}`,
    last4: plan.payment?.last4,
    stripeCustomer: plan.payment?.stripeCustomer,
    stripePaymentMethod: plan.payment?.stripePaymentMethod,
    idempotencyKey: key,
    meta: { planId: plan.id, due: due.toISOString() },
    firstTriedAt: waiting?.since ?? null,
  })

  if (result.ok) {
    await settlePaid(plan, { paymentId: result.id, due, dueAsStored: plan.nextChargeAt ?? null, fee }, req)
    return { ok: true as const }
  }

  if (result.kind === 'retry' || result.kind === 'processing') {
    /* no answer about the card yet: remember the key and when it was first
       tried, and leave everything else exactly as it was */
    await Plan.updateOne(
      { _id: plan._id },
      waiting
        ? { $set: { 'pendingCharge.lastError': result.error } }
        : { $set: { pendingCharge: { key, since: new Date(), lastError: result.error } } },
    )
    if (result.kind === 'retry') alert('job', `payment on ${plan.number} got no answer from Stripe; it will be tried again with the same key`, result.error)
    await audit(
      req ?? null,
      'plan.charge_pending',
      result.kind === 'processing'
        ? `The ${formatMoney(plan.amount + fee)} payment on ${plan.number} is still being processed by the bank; it will be checked again`
        : `The ${formatMoney(plan.amount + fee)} payment on ${plan.number} could not be confirmed with Stripe (${result.error}); it will be tried again and charged at most once`,
      { type: 'plan', id: plan._id, label: plan.number },
    )
    return {
      ok: false as const,
      pending: true,
      error: result.kind === 'processing'
        ? 'The payment is still being processed by the bank. It will be checked again shortly.'
        : 'The card payment service could not be reached. The payment will be tried again automatically.',
    }
  }

  /* null: a webhook recorded this same decline a moment ago */
  const final = await recordDecline(plan, attempt, result.error, req)
  return { ok: false as const, error: result.error, final: final ?? false }
}

/** A declined attempt: count it, record the failed gift, tell the donor —
 *  once. The webhook (a payment that was still processing and then failed)
 *  and a scheduler run retrying the same key can both learn of the same
 *  decline; the first to move failure.count on from `attempt` records it, and
 *  the other finds it done. Returns whether that was the last retry, or null
 *  when someone else had already recorded it. */
async function recordDecline(plan: PlanDoc, attempt: number, error: string, req?: Request | null): Promise<boolean | null> {
  const donor = await Donor.findById(plan.donor)
  if (!donor) return null
  const count = attempt + 1
  const final = count > RETRY_SCHEDULE_DAYS.length
  const nextRetry = final ? undefined : new Date(Date.now() + RETRY_SCHEDULE_DAYS[count - 1] * 86_400_000)
  const claimed = await Plan.updateOne(
    { _id: plan._id, 'failure.count': attempt === 0 ? { $in: [0, null] } : attempt },
    {
      $set: { failure: { count, lastError: error, firstFailedAt: plan.failure?.firstFailedAt ?? new Date(), nextRetryAt: nextRetry } },
      $unset: { pendingCharge: 1 },
    },
  )
  if (!claimed.modifiedCount) return null
  /* a plan cancelled or paused while the card was being tried stays as the
     person left it: the failed attempt is still recorded, but nobody is told
     to fix a card for a donation that has stopped */
  const marked = await Plan.updateOne({ _id: plan._id, status: { $in: ['active', 'past_due'] } }, { $set: { status: 'past_due' } })
  await recordGift(
    {
      donor,
      amount: plan.amount,
      designation: plan.designation as Designation,
      method: 'card',
      status: 'failed',
      appealId: plan.appeal,
      planId: plan._id,
      source: 'recurring',
      failureReason: error,
      simulated: !env.stripe,
    },
    req,
  )
  if (marked.matchedCount) {
    await sendEmail(
      donor.email,
      paymentFailedEmail(
        {
          amount: plan.amount,
          frequency: plan.frequency as Frequency,
          appealTitle: plan.appealTitle,
          payment: plan.payment,
        },
        donor.firstName,
        error,
        final,
        plan.id,
      ),
      { donor: donor._id },
    )
  }
  await audit(
    req ?? null,
    'plan.failed',
    `${formatMoney(plan.amount)} payment on ${plan.number} for ${plan.donorName} declined (attempt ${count}): ${error}`,
    { type: 'plan', id: plan._id, label: plan.number },
  )
  await refreshDonor(plan.donor)
  return final
}

/** Stripe's payment_intent.payment_failed for a regular payment. Stripe sends
 *  one for every decline, and a decline the card gave on the spot was already
 *  recorded by the run that tried it — so this acts only on the payment the
 *  plan is still waiting on (pendingCharge: it was "processing", or Stripe
 *  never answered), which would otherwise only be found when the next run
 *  retried the same key. */
export async function settlePlanFailure(pi: {
  id: string
  metadata?: Record<string, string> | null
  last_payment_error?: { message?: string | null } | null
}): Promise<boolean> {
  const planId = pi.metadata?.planId
  const key = pi.metadata?.chargeKey
  if (!planId || !key) return false
  const plan = await Plan.findById(planId)
  if (!plan || plan.pendingCharge?.key !== key) return false
  const error = pi.last_payment_error?.message || 'The bank did not complete the payment.'
  const final = await recordDecline(plan, plan.failure?.count ?? 0, error)
  return final !== null
}

/** Record a payment that went through, count it on the plan, and move the
 *  plan on — each exactly once, however many callers settle the same
 *  payment and in whatever order. */
async function settlePaid(
  plan: PlanDoc,
  p: { paymentId: string; due: Date; dueAsStored: Date | null; fee: number },
  req?: Request | null,
): Promise<GiftDoc> {
  let gift = await Gift.findOne({ 'external.stripe': p.paymentId })
  if (gift) {
    await audit(req ?? null, 'plan.replayed', `The payment for ${plan.number} due ${p.due.toLocaleDateString('en-AU')} was already taken and recorded, so it was not recorded again`, {
      type: 'plan', id: plan._id, label: plan.number,
    })
  } else {
    const donor = await Donor.findById(plan.donor)
    if (!donor) throw new Error(`donor of ${plan.number} not found`)
    try {
      gift = await recordGift(
        {
          donor,
          amount: plan.amount,
          fee: p.fee,
          designation: plan.designation as Designation,
          method: plan.payment?.method === 'paypal' ? 'paypal' : 'card',
          appealId: plan.appeal,
          planId: plan._id,
          source: 'recurring',
          external: { stripe: p.paymentId },
          simulated: !env.stripe,
        },
        req,
      )
    } catch (err) {
      /* the webhook and a run settling the same payment at the same moment:
         the unique payment id let one gift through, and this is the other */
      if ((err as { code?: number }).code !== 11000) throw err
      gift = await Gift.findOne({ 'external.stripe': p.paymentId })
      if (!gift) throw err
    }
  }

  const instalment = plan.kind === 'instalment' && Boolean(plan.instalments?.total)
  const counted = await Plan.findOneAndUpdate(
    { _id: plan._id, countedGifts: { $ne: gift._id } },
    {
      $inc: { collected: plan.amount, ...(instalment ? { 'instalments.paid': 1 } : {}) },
      $push: { countedGifts: { $each: [gift._id], $slice: -50 } },
    },
    { returnDocument: 'after' },
  )
  const now = counted ?? (await Plan.findById(plan._id))
  if (!now) return gift

  const completed = instalment && (now.instalments?.paid ?? 0) >= (now.instalments?.total ?? Infinity)
  const moved = await Plan.updateOne(
    { _id: plan._id, status: { $in: ['active', 'past_due'] }, nextChargeAt: p.dueAsStored },
    completed
      ? { $set: { status: 'completed', lastChargeAt: new Date(), failure: { count: 0 } }, $unset: { nextChargeAt: 1, pendingCharge: 1 } }
      : {
          $set: {
            status: 'active',
            lastChargeAt: new Date(),
            failure: { count: 0 },
            nextChargeAt: advance(p.due, plan.frequency as Frequency, new Date(plan.startDate).getDate()),
          },
          $unset: { pendingCharge: 1 },
        },
  )
  if (!moved.matchedCount && !['active', 'past_due'].includes(now.status)) {
    /* the donor or the office stopped the plan while this payment was being
       taken: the money moved, so it is recorded, and the plan stays stopped */
    await Plan.updateOne({ _id: plan._id }, { $set: { lastChargeAt: new Date() }, $unset: { pendingCharge: 1 } })
    alert('job', `a payment on ${plan.number} went through while the plan was being ${now.status}`)
    await audit(
      req ?? null,
      'plan.charged_while_stopped',
      `A ${formatMoney(plan.amount)} payment on ${plan.number} for ${plan.donorName} went through while the regular donation was being ${now.status}. It is recorded as ${gift.number}; the regular donation stays ${now.status}. Refund it if the donor asked to stop.`,
      { type: 'plan', id: plan._id, label: plan.number },
    )
  }
  await refreshDonor(plan.donor)
  return gift
}

/** A regular payment Stripe reports as succeeded (payment_intent.succeeded),
 *  for one that settled after the run that asked for it had stopped waiting
 *  (it was still processing, or the answer was lost). Records and counts it
 *  if nothing else has; moves the plan on only if it is still waiting on that
 *  date. Idempotent, like everything a webhook calls. */
export async function settlePlanPayment(pi: { id: string; amount: number; metadata?: Record<string, string> | null }): Promise<void> {
  const planId = pi.metadata?.planId
  const dueIso = pi.metadata?.due
  if (!planId || !dueIso) return
  const plan = await Plan.findById(planId)
  if (!plan) return
  const due = new Date(dueIso)
  if (Number.isNaN(due.getTime())) return
  const known = await Gift.exists({ 'external.stripe': pi.id })
  /* settled even when the gift is known: a run that died after recording it
     has not counted it or moved the plan on yet */
  const gift = await settlePaid(plan, { paymentId: pi.id, due, dueAsStored: due, fee: Math.max(0, pi.amount - plan.amount) })
  if (!known) {
    await auditSystem('plan.settled', `Stripe confirmed the ${formatMoney(pi.amount)} payment on ${plan.number} (${gift.number})`, {
      type: 'plan', id: plan._id, label: plan.number,
    })
  }
}
