import { Router } from 'express'
import type Stripe from 'stripe'
import type { Designation, Frequency } from '../../shared/domain'
import { formatMoney } from '../../shared/money'
import { env, isLiveStripeKey } from '../env'
import { alert } from '../lib/alert'
import { auditSystem } from '../lib/audit'
import { HttpError, isId } from '../lib/http'
import { issueReceipt, refundGift } from '../lib/giving'
import { paypalCaptureState, paypalVerifyWebhook, stripe } from '../lib/payments'
import { settlePaypalOrder } from '../lib/paypal'
import { chargePlan, settlePlanFailure, settlePlanPayment } from '../lib/plans'
import { refreshForGift } from '../lib/stats'
import { startPlan } from '../jobs/recurring'
import { Appeal, Donor, Gift, Plan, type GiftDoc } from '../models'

/* ---------------------------------------------------------------------------
   /api/webhooks — Stripe telling us a payment happened.

   This is the ONLY place a Stripe card gift becomes `succeeded`. The thank-you
   page never does it: a donor can land on /thank-you without paying (the back
   button, a shared link), so the receipt waits for Stripe's signed word.

     checkout.session.completed, mode payment   the gift in metadata.giftId is
        paid — if Stripe says payment_status 'paid'. Then: receipt it, refresh
        the totals, and for a regular gift read the saved card off the
        PaymentIntent and start the plan the scheduler charges from now on.
     checkout.session.async_payment_succeeded   the same, for a payment that
        settled after the page closed (no such method is offered today — the
        page is card only — but Stripe's dashboard can switch one on)
     checkout.session.async_payment_failed      pending → failed
     checkout.session.expired                   the donor walked away: pending
                                                → failed, "Checkout abandoned"
     checkout.session.completed, mode setup,    a donor replaced the card on a
        metadata.purpose 'card-update'          plan; a failing plan is tried
                                                again straight away
     charge.refunded                            refunded in Stripe: the same
                                                change as the admin's Refund
     charge.dispute.created                     a chargeback: flagged on the
                                                gift and written to the log
     charge.dispute.closed                      lost: the donation stops
                                                counting, like a refund; won:
                                                the flag says so
     payment_intent.succeeded, metadata.planId  a regular payment that settled
                                                late: recorded and the plan
                                                moved on, once (lib/plans.ts)
     payment_intent.payment_failed,             a regular payment the plan was
        metadata.planId                         still waiting on (processing,
                                                or no answer) failed: recorded
                                                as a decline, once; a decline
                                                the card gave on the spot was
                                                recorded by the run already

   CHECKED BEFORE BELIEVED (finding M5). An event from the wrong mode (a test
   event reaching the live server, or the reverse) is ignored, and a gift is
   marked paid only when Stripe's amount and currency are exactly what the
   gift asked for.

   EVERY STEP CAN RUN AGAIN (finding H6). Stripe delivers at least once, and
   retries whatever got a 5xx. The pending → succeeded change is one
   conditional update, but the follow-ups no longer hang off "whoever made
   that change": each is idempotent and is attempted on every delivery for a
   paid gift — the receipt number (issued once, lib/giving.ts), the plan
   (claimed on the gift, unique on Plan.firstGift), the receipt email (only
   if it has not gone). So when starting the plan fails, the handler answers
   500, Stripe redelivers, and the redelivery finishes the job instead of
   finding nothing pending and stopping. Everything that writes to the
   database happens before we answer; only the receipt email waits until
   after the 200, so Stripe is never kept waiting on an SMTP server — and if
   the process dies in that moment, the sweep in lib/sweeps.ts sends it.

   The raw body comes from app.ts, which mounts this router before the JSON
   parser — the signature is over the exact bytes Stripe sent.
--------------------------------------------------------------------------- */

const r = Router()

type Later = () => Promise<unknown>

/** Pending → succeeded, once. Returns the gift only to the caller that
 *  actually made the change; everyone else gets null.
 *
 *  `revive` is for a payment the provider has just verified (paid, right
 *  amount, right currency): it may also turn a FAILED gift into a paid one.
 *  The abandoned-checkout sweep, or a capture that looked like it failed,
 *  can mark a gift failed before the provider's word arrives — Stripe keeps
 *  retrying a webhook for three days — and money that arrived must never be
 *  left recorded as "nothing was charged". */
export async function markOnlineGiftPaid(giftId: string, ext: { stripe?: string; paypal?: string }, opts: { revive?: boolean } = {}) {
  if (!isId(giftId)) return null
  const set: Record<string, unknown> = { status: 'succeeded', date: new Date() }
  if (ext.stripe) set['external.stripe'] = ext.stripe
  if (ext.paypal) set['external.paypal'] = ext.paypal
  const gift = await Gift.findOneAndUpdate(
    { _id: giftId, status: opts.revive ? { $in: ['pending', 'failed'] } : 'pending', method: { $in: ['card', 'paypal'] } },
    { $set: set, $unset: { failureReason: 1, paypalCapture: 1 } },
    { returnDocument: 'before' },
  )
  if (!gift) return null
  if (gift.status === 'failed') {
    alert('webhook', `donation ${gift.number} was recorded as failed (${gift.failureReason ?? 'no reason'}) but the payment provider has now confirmed it was paid; it is marked paid`)
    await auditSystem(
      'gift.revived',
      `Donation ${gift.number} from ${gift.donorName} had been marked failed (${gift.failureReason ?? 'no reason given'}), but the payment provider confirmed the money arrived, so it is now recorded as paid`,
      { type: 'gift', id: gift._id, label: gift.number },
    )
  }
  return Gift.findById(gift._id)
}

/** The receipt, the totals and the log line for a gift that just got paid. */
export async function afterOnlineGiftPaid(gift: GiftDoc, by: 'Stripe' | 'PayPal') {
  await issueReceipt(gift, { email: true })
  await refreshForGift(gift)
  await auditSystem(
    'gift.online',
    `${by} confirmed ${formatMoney(gift.amount + (gift.fee ?? 0))} for donation ${gift.number} from ${gift.donorName}${gift.appealTitle ? ` to ${gift.appealTitle}` : ''}`,
    { type: 'gift', id: gift._id, label: gift.number },
  )
}

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === 'string' ? v : v?.id)

const BRANDS: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', discover: 'Discover', jcb: 'JCB', unionpay: 'UnionPay', diners: 'Diners' }
const brandName = (b?: string | null) => (b ? (BRANDS[b] ?? b.charAt(0).toUpperCase() + b.slice(1)) : 'Card')

function cardOf(pm: Stripe.PaymentMethod | null, customer: string | undefined) {
  return {
    method: 'card' as const,
    brand: brandName(pm?.card?.brand),
    last4: pm?.card?.last4 ?? undefined,
    expMonth: pm?.card?.exp_month ?? undefined,
    expYear: pm?.card?.exp_year ?? undefined,
    stripeCustomer: customer,
    stripePaymentMethod: pm?.id,
  }
}

const PLAN_CLAIM_STALE_MS = 10 * 60_000

async function onGiftPaid(s: Stripe, session: Stripe.Checkout.Session, later: Later[]) {
  const giftId = session.metadata?.giftId ?? ''
  if (!isId(giftId)) return
  /* paid means paid: a delayed method reports "completed" while the money is
     still on its way, and is finished by async_payment_succeeded */
  if (session.payment_status !== 'paid') return

  const asked = await Gift.findById(giftId).select('amount fee number status method')
  if (!asked) return
  if (session.currency !== 'aud' || session.amount_total !== asked.amount + (asked.fee ?? 0)) {
    await auditSystem(
      'gift.mismatch',
      `Stripe reported ${session.amount_total ?? '?'} ${String(session.currency ?? '?').toUpperCase()} (cents) for donation ${asked.number}, which asked for ${asked.amount + (asked.fee ?? 0)} AUD; it was not marked paid. Check it in Stripe.`,
      { type: 'gift', id: asked._id, label: asked.number },
    )
    return
  }

  const piId = idOf(session.payment_intent)
  /* amount, currency and payment status are verified above, so a gift the
     sweep gave up on (a webhook that arrived late) is paid all the same */
  const fresh = await markOnlineGiftPaid(giftId, { stripe: piId }, { revive: true })
  /* a redelivery, or the delivery after one that failed half-way: the gift is
     already paid, and whatever is left of the follow-ups still gets done */
  const gift = fresh ?? (await Gift.findOne({ _id: giftId, status: 'succeeded', method: 'card' }))
  if (!gift) return

  await issueReceipt(gift, { email: false })
  if (fresh) {
    await refreshForGift(gift)
    await auditSystem(
      'gift.online',
      `Stripe confirmed ${formatMoney(gift.amount + (gift.fee ?? 0))} for donation ${gift.number} from ${gift.donorName}${gift.appealTitle ? ` to ${gift.appealTitle}` : ''}`,
      { type: 'gift', id: gift._id, label: gift.number },
    )
  }

  const c = gift.checkout
  let planError: unknown = null
  if (c?.frequency && c.frequency !== 'once' && piId && !gift.plan) {
    await startPlanOnce(s, session, gift, piId).catch((err: unknown) => {
      planError = err
    })
  }

  /* the receipt email: by the delivery that marked it paid, or by a later one
     when an earlier attempt never got as far as sending it. A duplicate that
     arrives in the same moment as the first leaves it to the first, so the
     donor gets one email, not two. When starting the plan failed, this
     delivery is about to answer 500 and its after-the-200 work will never
     run, so the receipt goes now: the donor has paid, whatever happens to the
     plan, and the redelivery that finishes the plan will find it sent. */
  const issued = gift.receipt?.issuedAt ? new Date(gift.receipt.issuedAt).getTime() : 0
  if (!gift.receipt?.emailedAt && (fresh || Date.now() - issued > RESEND_AFTER_MS)) {
    if (planError) await issueReceipt(gift, { email: true }).catch((err) => console.error('[webhook] receipt', gift.number, err))
    else later.push(() => issueReceipt(gift, { email: true }))
  }
  if (planError) throw planError
}

/** How long a redelivery waits before it assumes the receipt email of the
 *  delivery that issued the number is not coming. */
const RESEND_AFTER_MS = 2 * 60_000

/** Start the regular gift a paid checkout asked for — once, however many
 *  deliveries arrive. The gift is claimed first (checkout.planClaimedAt) so
 *  two deliveries at the same moment cannot both start one; a failure gives
 *  the claim back and rethrows, so the delivery answers 500 and Stripe's retry
 *  tries again. A claim older than ten minutes is a crashed attempt. */
async function startPlanOnce(s: Stripe, session: Stripe.Checkout.Session, gift: GiftDoc, piId: string) {
  const now = new Date()
  const claimed = await Gift.findOneAndUpdate(
    {
      _id: gift._id,
      plan: null,
      $or: [{ 'checkout.planClaimedAt': null }, { 'checkout.planClaimedAt': { $lt: new Date(now.getTime() - PLAN_CLAIM_STALE_MS) } }],
    },
    { $set: { 'checkout.planClaimedAt': now } },
  )
  if (!claimed) return
  try {
    const existing = await Plan.findOne({ firstGift: gift._id }).select('_id')
    if (existing) {
      await Gift.updateOne({ _id: gift._id }, { $set: { plan: existing._id } })
      return
    }
    const c = gift.checkout!
    const pi = await s.paymentIntents.retrieve(piId, { expand: ['payment_method'] })
    const pm = typeof pi.payment_method === 'object' ? pi.payment_method : null
    const donor = await Donor.findById(gift.donor)
    if (!donor) throw new Error(`donor ${String(gift.donor)} of ${gift.number} not found`)
    const appeal = gift.appeal ? await Appeal.findById(gift.appeal).select('title') : null
    await startPlan({
      donor,
      amount: gift.amount,
      /* each later payment adds what the first one did: the operating-costs
         contribution, or for a checkout begun before it existed, the card fee
         that first payment carried */
      operatingCosts: c.operatingCosts ?? gift.fee ?? 0,
      designation: gift.designation as Designation,
      frequency: c.frequency as Frequency,
      instalments: c.instalments,
      appeal,
      payment: cardOf(pm, idOf(pi.customer) ?? idOf(session.customer)),
      firstGift: gift,
    })
  } catch (err) {
    /* another delivery created the plan first: the unique index on
       Plan.firstGift refused this one, so link the gift to that plan */
    if ((err as { code?: number }).code === 11000) {
      const existing = await Plan.findOne({ firstGift: gift._id }).select('_id')
      if (existing) {
        await Gift.updateOne({ _id: gift._id }, { $set: { plan: existing._id } })
        return
      }
    }
    await Gift.updateOne({ _id: gift._id, 'checkout.planClaimedAt': now }, { $unset: { 'checkout.planClaimedAt': 1 } })
    throw err
  }
}

/** A checkout that will not be paid: the donor left, or the delayed payment
 *  failed. Only a gift still pending changes. */
async function onGiftNotPaid(session: Stripe.Checkout.Session, reason: string) {
  const giftId = session.metadata?.giftId ?? ''
  if (!isId(giftId)) return
  const gift = await Gift.findOneAndUpdate(
    { _id: giftId, status: 'pending', method: 'card' },
    { $set: { status: 'failed', failureReason: reason } },
    { returnDocument: 'after' },
  )
  if (gift) {
    await auditSystem('gift.failed', `Stripe: donation ${gift.number} from ${gift.donorName} was not paid (${reason.toLowerCase()})`, {
      type: 'gift', id: gift._id, label: gift.number,
    })
  }
}

async function onCardUpdated(s: Stripe, session: Stripe.Checkout.Session, later: Later[]) {
  const plan = await Plan.findById(session.metadata?.planId)
  const siId = idOf(session.setup_intent)
  if (!plan || !siId) return
  const si = await s.setupIntents.retrieve(siId, { expand: ['payment_method'] })
  const pm = typeof si.payment_method === 'object' ? si.payment_method : null
  if (!pm) return
  /* a redelivery of the same card change: already on the plan */
  if (plan.payment?.stripePaymentMethod === pm.id) return

  /* Claimed before anything is done in Stripe: the same event delivered
     twice at the same moment both get past the check above, and only the
     delivery whose write moves the plan onto this card goes on — one
     customer, one log line, one retry. If what follows fails, the claim is
     put back, so Stripe's redelivery can finish the job. */
  const before = plan.toObject().payment
  const claimed = await Plan.updateOne(
    { _id: plan._id, 'payment.stripePaymentMethod': { $ne: pm.id } },
    { $set: { 'payment.stripePaymentMethod': pm.id } },
  )
  if (!claimed.modifiedCount) return

  let card: ReturnType<typeof cardOf>
  try {
    /* the card has to belong to a customer to be charged off-session */
    let customer = idOf(session.customer) ?? idOf(si.customer) ?? plan.payment?.stripeCustomer ?? undefined
    if (!customer) {
      const donor = await Donor.findById(plan.donor).select('email firstName lastName')
      const c = await s.customers.create({ email: donor?.email, name: donor ? `${donor.firstName} ${donor.lastName ?? ''}`.trim() : undefined, payment_method: pm.id })
      customer = c.id
    } else if (!pm.customer) {
      await s.paymentMethods.attach(pm.id, { customer })
    }
    card = cardOf(pm, customer)
    await Plan.updateOne({ _id: plan._id }, { $set: { payment: card } })
  } catch (err) {
    await Plan.updateOne(
      { _id: plan._id, 'payment.stripePaymentMethod': pm.id },
      before ? { $set: { payment: before } } : { $unset: { payment: 1 } },
    )
    throw err
  }
  await auditSystem(
    'plan.card',
    `${plan.donorName} replaced the card on ${plan.number} with ${card.brand} ending ${card.last4 ?? '····'}`,
    { type: 'plan', id: plan._id, label: plan.number },
  )
  /* chargePlan claims the plan itself, so this can never overlap a
     scheduler run or an admin retry on the same plan */
  if (plan.status === 'past_due') later.push(async () => chargePlan((await Plan.findById(plan._id))!, null, { retryNow: true }))
}

async function onRefunded(charge: Stripe.Charge) {
  const piId = idOf(charge.payment_intent)
  if (!piId) return
  const gift = await Gift.findOne({ 'external.stripe': piId }).select('_id number status amount fee')
  if (!gift) return
  /* only a full refund un-gives the donation; a partial one is for a person
     to look at, so it goes in the log */
  if (!charge.refunded || charge.amount_refunded < charge.amount) {
    await auditSystem(
      'gift.refund_partial',
      `Stripe refunded ${formatMoney(charge.amount_refunded)} of ${formatMoney(charge.amount)} on donation ${gift.number}. A partial refund is not recorded automatically; check the gift.`,
      { type: 'gift', id: gift._id, label: gift.number },
    )
    return
  }
  await refundGift(gift._id, { reason: 'Refunded in Stripe', by: 'Stripe' })
}

async function onDispute(dispute: Stripe.Dispute) {
  const piId = idOf(dispute.payment_intent)
  if (!piId) return
  const gift = await Gift.findOneAndUpdate(
    { 'external.stripe': piId, 'dispute.id': { $ne: dispute.id } },
    { $set: { dispute: { at: new Date(), reason: dispute.reason, id: dispute.id } } },
    { returnDocument: 'after' },
  )
  if (!gift) return
  await auditSystem(
    'gift.dispute',
    `The donor's bank disputed donation ${gift.number} from ${gift.donorName} (${formatMoney(dispute.amount)}, reason: ${dispute.reason}). Respond in Stripe before the deadline.`,
    { type: 'gift', id: gift._id, label: gift.number },
  )
}

/* A chargeback decided. Lost: the bank took the money back, so the donation
   stops counting — out of the totals, the exports and the donor's statement,
   with a plan's collected sum put right — the same change as a refund, but
   without the "we've refunded you" email (the donor's bank did it). Won: the
   money stays, and the flag says how it ended. Once each, by outcome. */
async function onDisputeClosed(dispute: Stripe.Dispute) {
  const piId = idOf(dispute.payment_intent)
  if (!piId) return
  const outcome = dispute.status === 'lost' ? 'lost' : dispute.status === 'won' ? 'won' : null
  if (!outcome) return
  const gift = await Gift.findOneAndUpdate(
    { 'external.stripe': piId, 'dispute.outcome': { $ne: outcome } },
    { $set: { 'dispute.id': dispute.id, 'dispute.outcome': outcome, 'dispute.closedAt': new Date() } },
    { returnDocument: 'after' },
  )
  if (!gift) return
  if (outcome === 'lost') {
    await refundGift(gift._id, { reason: `Chargeback lost (${dispute.reason})`, by: 'Stripe', notify: false })
    alert('webhook', `chargeback lost on donation ${gift.number}: it no longer counts, and its receipt should be treated as void`)
  }
  await auditSystem(
    `gift.dispute_${outcome}`,
    outcome === 'lost'
      ? `The chargeback on donation ${gift.number} from ${gift.donorName} was lost: ${formatMoney(dispute.amount)} went back to the donor's bank, so the donation no longer counts and its receipt is void`
      : `The chargeback on donation ${gift.number} from ${gift.donorName} was won; the donation stands`,
    { type: 'gift', id: gift._id, label: gift.number },
  )
}

r.post('/stripe', async (req, res) => {
  const s = await stripe()
  if (!s || !env.stripe?.webhookSecret) throw new HttpError(404, 'Stripe is not connected.')

  let event: Stripe.Event
  try {
    event = s.webhooks.constructEvent(req.body as Buffer, req.get('stripe-signature') ?? '', env.stripe.webhookSecret)
  } catch {
    throw new HttpError(400, 'The signature did not check out.')
  }

  /* a test-mode event at a live key, or the reverse, is not ours to act on */
  if (event.livemode !== isLiveStripeKey(env.stripe.key)) {
    console.warn('[webhook] ignored an event from the other Stripe mode', event.id, event.type)
    res.json({ received: true, ignored: 'mode' })
    return
  }

  const later: Later[] = []
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      if (session.mode === 'payment' && session.metadata?.giftId) await onGiftPaid(s, session, later)
      else if (session.mode === 'setup' && session.metadata?.purpose === 'card-update') await onCardUpdated(s, session, later)
      break
    }
    case 'checkout.session.async_payment_succeeded':
      if (event.data.object.metadata?.giftId) await onGiftPaid(s, event.data.object, later)
      break
    case 'checkout.session.async_payment_failed':
      await onGiftNotPaid(event.data.object, 'The payment did not go through')
      break
    case 'checkout.session.expired':
      if (event.data.object.mode === 'payment') await onGiftNotPaid(event.data.object, 'Checkout abandoned')
      break
    case 'charge.refunded':
      await onRefunded(event.data.object)
      break
    case 'charge.dispute.created':
      await onDispute(event.data.object)
      break
    case 'charge.dispute.closed':
      await onDisputeClosed(event.data.object)
      break
    case 'payment_intent.succeeded':
      /* a regular payment that settled after the run asking for it stopped
         waiting (lib/plans.ts); website checkouts are handled above */
      if (event.data.object.metadata?.planId) await settlePlanPayment(event.data.object)
      break
    case 'payment_intent.payment_failed':
      if (event.data.object.metadata?.planId) await settlePlanFailure(event.data.object)
      break
  }

  res.json({ received: true })
  for (const job of later) {
    await job().catch((err) => console.error('[webhook] follow-up failed', event.id, err))
  }
})

/* ---------------------------------------------------------------------------
   /api/webhooks/paypal — PayPal telling us a payment changed (finding M6).

   Until this, a PayPal payment was settled only on the return page and by
   the sweep's re-reading; a refund or reversal made in PayPal never reached
   the books. Now:

     PAYMENT.CAPTURE.COMPLETED / PENDING / DENIED / DECLINED
        the order is settled by lib/paypal.ts, the same rules as the return
        page: paid once (and receipted) only for exactly the AUD asked, a held
        capture waits, only a definite decline fails
     PAYMENT.CAPTURE.REFUNDED     fully refunded in PayPal: the same change as
                                  the admin's Refund; a partial one is logged
                                  for a person to look at
     PAYMENT.CAPTURE.REVERSED     the payer's bank or PayPal took it back: the
                                  donation stops counting, like a lost
                                  chargeback

   BELIEVED ONLY AS FAR AS PAYPAL CONFIRMS IT. The event is first sent back to
   PayPal's verify-webhook-signature with our PAYPAL_WEBHOOK_ID; one PayPal
   doesn't vouch for gets a 400. Even then the event's own figures are not
   used: the order or capture is read from PayPal and that is what counts.
   Every step is idempotent, so a redelivery changes nothing; anything that
   fails answers 5xx and PayPal tries again.
--------------------------------------------------------------------------- */

type PaypalEvent = {
  id?: string
  event_type?: string
  resource?: {
    id?: string
    status?: string
    supplementary_data?: { related_ids?: { order_id?: string } }
    links?: { rel?: string; href?: string }[]
  }
}

/** the capture a refund belongs to: its "up" link ends /captures/{id} */
const captureOfRefund = (res: PaypalEvent['resource']) =>
  res?.links?.find((l) => l.rel === 'up')?.href?.match(/\/captures\/([^/?#]+)/)?.[1]

async function onPaypalCapture(res: NonNullable<PaypalEvent['resource']>) {
  const captureId = res.id
  const orderId = res.supplementary_data?.related_ids?.order_id
  if (!captureId && !orderId) return
  const gift = await Gift.findOne({
    method: 'paypal',
    $or: [
      ...(orderId ? [{ 'external.paypal': orderId }] : []),
      ...(captureId ? [{ 'external.paypal': captureId }, { 'paypalCapture.id': captureId }] : []),
    ],
  }).select('_id')
  if (!gift) return
  const order = orderId ?? (captureId ? (await paypalCaptureState(captureId))?.orderId : undefined)
  if (!order) return
  await settlePaypalOrder(gift.id, order, { capture: false })
}

async function onPaypalMoneyBack(captureId: string | undefined, how: 'refunded' | 'reversed') {
  if (!captureId) return
  const gift = await Gift.findOne({ method: 'paypal', 'external.paypal': captureId }).select('_id number status donorName')
  if (!gift) return
  const now = await paypalCaptureState(captureId)
  if (!now) return
  if (how === 'refunded') {
    if (now.status === 'PARTIALLY_REFUNDED') {
      await auditSystem(
        'gift.refund_partial',
        `PayPal refunded part of donation ${gift.number}. A partial refund is not recorded automatically; check the gift.`,
        { type: 'gift', id: gift._id, label: gift.number },
      )
      return
    }
    if (now.status === 'REFUNDED') await refundGift(gift._id, { reason: 'Refunded in PayPal', by: 'PayPal' })
    return
  }
  /* reversed: only when PayPal no longer shows the money as ours */
  if (now.status === 'COMPLETED') return
  const done = await refundGift(gift._id, { reason: `Reversed in PayPal (${now.status.toLowerCase()})`, by: 'PayPal', notify: false })
  if (done) {
    alert('webhook', `PayPal payment for donation ${gift.number} was reversed: it no longer counts, and its receipt should be treated as void`)
    await auditSystem(
      'gift.reversed',
      `PayPal reversed the payment for donation ${gift.number} from ${gift.donorName}; the donation no longer counts and its receipt is void`,
      { type: 'gift', id: gift._id, label: gift.number },
    )
  }
}

r.post('/paypal', async (req, res) => {
  if (!env.paypal?.webhookId) throw new HttpError(404, 'PayPal is not connected.')
  let event: PaypalEvent
  try {
    event = JSON.parse((req.body as Buffer).toString('utf8')) as PaypalEvent
  } catch {
    throw new HttpError(400, 'That is not a PayPal event.')
  }
  const verified = await paypalVerifyWebhook(
    {
      authAlgo: req.get('paypal-auth-algo'),
      certUrl: req.get('paypal-cert-url'),
      transmissionId: req.get('paypal-transmission-id'),
      transmissionSig: req.get('paypal-transmission-sig'),
      transmissionTime: req.get('paypal-transmission-time'),
    },
    event,
  )
  if (!verified) throw new HttpError(400, 'PayPal did not vouch for this event.')

  switch (event.event_type) {
    case 'PAYMENT.CAPTURE.COMPLETED':
    case 'PAYMENT.CAPTURE.PENDING':
    case 'PAYMENT.CAPTURE.DENIED':
    case 'PAYMENT.CAPTURE.DECLINED':
      if (event.resource) await onPaypalCapture(event.resource)
      break
    case 'PAYMENT.CAPTURE.REFUNDED':
      await onPaypalMoneyBack(captureOfRefund(event.resource), 'refunded')
      break
    case 'PAYMENT.CAPTURE.REVERSED':
      await onPaypalMoneyBack(event.resource?.id, 'reversed')
      break
  }
  res.json({ received: true })
})

export default r
