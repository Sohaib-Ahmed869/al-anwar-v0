import { Router } from 'express'
import type Stripe from 'stripe'
import type { Designation, Frequency } from '../../shared/domain'
import { formatMoney } from '../../shared/money'
import { env } from '../env'
import { auditSystem } from '../lib/audit'
import { HttpError, isId } from '../lib/http'
import { issueReceipt } from '../lib/giving'
import { stripe } from '../lib/payments'
import { chargePlan } from '../lib/plans'
import { refreshForGift } from '../lib/stats'
import { startPlan } from '../jobs/recurring'
import { Appeal, Donor, Gift, Plan, type GiftDoc } from '../models'

/* ---------------------------------------------------------------------------
   /api/webhooks — Stripe telling us a payment happened.

   This is the ONLY place a Stripe card gift becomes `succeeded`. The thank-you
   page never does it: a donor can land on /thank-you without paying (the back
   button, a shared link), so the receipt waits for Stripe's signed word.

     checkout.session.completed, mode payment   the gift in metadata.giftId
        is paid: mark it, receipt it, refresh the totals; and if the donor
        asked for a regular gift, read the saved card off the PaymentIntent
        and start the plan the scheduler will charge from now on.
     checkout.session.completed, mode setup,    a donor replaced the card on
        metadata.purpose 'card-update'          a plan from their account; a
        plan that was failing is tried again straight away.

   IDEMPOTENT. Stripe delivers at least once and sometimes twice at the same
   moment, so the pending → succeeded change is a single conditional update:
   whichever delivery wins does the work, and the other finds nothing pending
   and stops. The state change happens before we answer (so a failure there is
   a 500 and Stripe retries); the receipt email and the slower follow-ups run
   just after the 200, so Stripe is never kept waiting on an SMTP server.

   The raw body comes from app.ts, which mounts this router before the JSON
   parser — the signature is over the exact bytes Stripe sent.
--------------------------------------------------------------------------- */

const r = Router()

type Later = () => Promise<unknown>

/** Pending → succeeded, once. Returns the gift only to the caller that
 *  actually made the change; everyone else gets null. */
export async function markOnlineGiftPaid(giftId: string, ext: { stripe?: string; paypal?: string }) {
  if (!isId(giftId)) return null
  const set: Record<string, unknown> = { status: 'succeeded', date: new Date() }
  if (ext.stripe) set['external.stripe'] = ext.stripe
  if (ext.paypal) set['external.paypal'] = ext.paypal
  return Gift.findOneAndUpdate(
    { _id: giftId, status: 'pending', method: { $in: ['card', 'paypal'] } },
    { $set: set, $unset: { failureReason: 1 } },
    { returnDocument: 'after' },
  )
}

/** The receipt, the totals and the log line for a gift that just got paid. */
export async function afterOnlineGiftPaid(gift: GiftDoc, by: 'Stripe' | 'PayPal') {
  await issueReceipt(gift, { email: true })
  await refreshForGift(gift)
  await auditSystem(
    'gift.online',
    `${by} confirmed ${formatMoney(gift.amount + (gift.fee ?? 0))} for gift ${gift.number} from ${gift.donorName}${gift.appealTitle ? ` to ${gift.appealTitle}` : ''}`,
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

async function onGiftPaid(s: Stripe, session: Stripe.Checkout.Session, later: Later[]) {
  const piId = idOf(session.payment_intent)
  const gift = await markOnlineGiftPaid(session.metadata?.giftId ?? '', { stripe: piId })
  if (!gift) return
  later.push(() => afterOnlineGiftPaid(gift, 'Stripe'))

  const c = gift.checkout
  if (!c?.frequency || c.frequency === 'once' || !piId) return
  const pi = await s.paymentIntents.retrieve(piId, { expand: ['payment_method'] })
  const pm = typeof pi.payment_method === 'object' ? pi.payment_method : null
  const donor = await Donor.findById(gift.donor)
  if (!donor) return
  const appeal = gift.appeal ? await Appeal.findById(gift.appeal).select('title') : null
  await startPlan({
    donor,
    amount: gift.amount,
    coverFee: Boolean(c.coverFee),
    designation: gift.designation as Designation,
    frequency: c.frequency as Frequency,
    instalments: c.instalments,
    appeal,
    payment: cardOf(pm, idOf(pi.customer) ?? idOf(session.customer)),
    firstGift: gift,
  })
}

async function onCardUpdated(s: Stripe, session: Stripe.Checkout.Session, later: Later[]) {
  const plan = await Plan.findById(session.metadata?.planId)
  const siId = idOf(session.setup_intent)
  if (!plan || !siId) return
  const si = await s.setupIntents.retrieve(siId, { expand: ['payment_method'] })
  const pm = typeof si.payment_method === 'object' ? si.payment_method : null
  if (!pm) return

  /* the card has to belong to a customer to be charged off-session */
  let customer = idOf(session.customer) ?? idOf(si.customer) ?? plan.payment?.stripeCustomer ?? undefined
  if (!customer) {
    const donor = await Donor.findById(plan.donor).select('email firstName lastName')
    const c = await s.customers.create({ email: donor?.email, name: donor ? `${donor.firstName} ${donor.lastName ?? ''}`.trim() : undefined, payment_method: pm.id })
    customer = c.id
  } else if (!pm.customer) {
    await s.paymentMethods.attach(pm.id, { customer })
  }

  const card = cardOf(pm, customer)
  plan.set('payment', card)
  await plan.save()
  await auditSystem(
    'plan.card',
    `${plan.donorName} replaced the card on ${plan.number} with ${card.brand} ending ${card.last4 ?? '····'}`,
    { type: 'plan', id: plan._id, label: plan.number },
  )
  if (plan.status === 'past_due') later.push(() => chargePlan(plan))
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

  const later: Later[] = []
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    if (session.mode === 'payment' && session.metadata?.giftId) await onGiftPaid(s, session, later)
    else if (session.mode === 'setup' && session.metadata?.purpose === 'card-update') await onCardUpdated(s, session, later)
  }

  res.json({ received: true })
  for (const job of later) {
    await job().catch((err) => console.error('[webhook] follow-up failed', event.id, err))
  }
})

export default r
