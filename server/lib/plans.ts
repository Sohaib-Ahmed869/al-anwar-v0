import type { Request } from 'express'
import { RETRY_SCHEDULE_DAYS, type Designation, type Frequency } from '../../shared/domain'
import { formatMoney } from '../../shared/money'
import { paymentFailedEmail } from '../emails/templates'
import { Donor, getSettings, type PlanDoc } from '../models'
import { audit } from './audit'
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
--------------------------------------------------------------------------- */

export async function chargePlan(plan: PlanDoc, req?: Request | null) {
  const donor = await Donor.findById(plan.donor)
  if (!donor) return { ok: false as const, error: 'Donor not found' }
  const s = await getSettings()
  /* The operating-costs contribution the donor chose, added to every payment
     exactly as the card fee used to be. A plan started before 28 September
     2026 has none stored and keeps the percentage fee it was agreed on, so
     nobody's regular donation changes under them. */
  const fee = plan.operatingCosts != null
    ? plan.operatingCosts
    : plan.coverFee ? Math.round(plan.amount * s.payments.feeRate) : 0
  const due = plan.nextChargeAt ?? new Date()
  const attempt = plan.failure?.count ?? 0

  const result = await chargeSavedCard({
    amount: plan.amount + fee,
    description: `${plan.appealTitle ?? 'Al-Anwaar'} — regular donation ${plan.number}`,
    last4: plan.payment?.last4,
    stripeCustomer: plan.payment?.stripeCustomer,
    stripePaymentMethod: plan.payment?.stripePaymentMethod,
    idempotencyKey: `${plan.id}-${due.toISOString().slice(0, 10)}-${attempt}`,
  })

  if (result.ok) {
    await recordGift(
      {
        donor,
        amount: plan.amount,
        fee,
        designation: plan.designation as Designation,
        method: plan.payment?.method === 'paypal' ? 'paypal' : 'card',
        appealId: plan.appeal,
        planId: plan._id,
        source: 'recurring',
        external: { stripe: result.id },
      },
      req,
    )
    plan.lastChargeAt = new Date()
    plan.collected = (plan.collected ?? 0) + plan.amount
    plan.set('failure', { count: 0 })
    if (plan.kind === 'instalment' && plan.instalments?.total) {
      const paid = (plan.instalments.paid ?? 0) + 1
      plan.set('instalments.paid', paid)
      if (paid >= plan.instalments.total) {
        plan.status = 'completed'
        plan.nextChargeAt = undefined
      }
    }
    if (plan.status !== 'completed') {
      plan.status = 'active'
      plan.nextChargeAt = advance(due, plan.frequency as Frequency, new Date(plan.startDate).getDate())
    }
    await plan.save()
    await refreshDonor(plan.donor)
    return { ok: true as const }
  }

  /* declined */
  const count = attempt + 1
  const final = count > RETRY_SCHEDULE_DAYS.length
  const nextRetry = final ? undefined : new Date(Date.now() + RETRY_SCHEDULE_DAYS[count - 1] * 86_400_000)
  plan.status = 'past_due'
  plan.set('failure', {
    count,
    lastError: result.error,
    firstFailedAt: plan.failure?.firstFailedAt ?? new Date(),
    nextRetryAt: nextRetry,
  })
  await plan.save()
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
      failureReason: result.error,
    },
    req,
  )
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
      result.error,
      final,
      plan.id,
    ),
    { donor: donor._id },
  )
  await audit(
    req ?? null,
    'plan.failed',
    `${formatMoney(plan.amount)} payment on ${plan.number} for ${plan.donorName} declined (attempt ${count}): ${result.error}`,
    { type: 'plan', id: plan._id, label: plan.number },
  )
  await refreshDonor(plan.donor)
  return { ok: false as const, error: result.error, final }
}
