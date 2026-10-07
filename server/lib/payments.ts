import type Stripe from 'stripe'
import { env } from '../env'

/* ---------------------------------------------------------------------------
   Talking to the payment providers.

   The money always settles into Al-Anwaar's own Stripe and PayPal accounts;
   this code only ever asks them to take a payment and hears back. No card
   number touches this server: one-off gifts go through Stripe Checkout or
   PayPal's hosted page, and regular gifts charge a card Stripe already holds.

   SIMULATED MODE — no STRIPE_SECRET_KEY
   Everything still works end to end so the portals can be built and demoed,
   and nothing pretends to be real money: every screen shows a "simulated"
   chip while this is on. Cards follow Stripe's own test numbers — a card
   ending 0002 is declined, 9995 has insufficient funds, 0069 is expired, and
   anything else goes through. A simulated charge id is "sim_pi_" plus the
   idempotency key, so each plan's payment for each date and attempt has its
   own — the same as Stripe, which hands back one PaymentIntent per key — and
   the unique index on a gift's external.stripe never mistakes two plans
   charged on the same day for one payment.

   CHECKS ON WHAT COMES BACK. A hosted card page takes cards only (no delayed
   methods such as BECS, which would report "completed" before the money
   arrives — finding M5), and a PayPal capture is believed only when the
   capture itself is COMPLETED for the right amount in AUD (finding M6).
--------------------------------------------------------------------------- */

let stripeClient: Stripe | null = null
export async function stripe(): Promise<Stripe | null> {
  if (!env.stripe) return null
  if (!stripeClient) {
    const { default: StripeCtor } = await import('stripe')
    stripeClient = new StripeCtor(env.stripe.key)
  }
  return stripeClient
}

/* What a charge on a saved card came to. Only `declined` is the card's fault
   and moves a regular donation to its next attempt; `retry` (Stripe could not
   be reached, timed out, answered 5xx, or something unexpected) and
   `processing` (Stripe has it but has not settled it) mean "we don't know
   yet": the same idempotency key is tried again, so a charge that did go
   through is found and recorded, never taken a second time with a new key. */
export type ChargeResult =
  | { ok: true; id: string }
  | { ok: false; kind: 'declined'; error: string; code?: string }
  | { ok: false; kind: 'retry'; error: string; code?: string }
  | { ok: false; kind: 'processing'; error: string; id: string }

const SIMULATED_DECLINES: Record<string, string> = {
  '0002': 'Your card was declined.',
  '9995': 'Your card has insufficient funds.',
  '0069': 'Your card has expired.',
  '0119': 'An error occurred while processing your card.',
}

export function simulatedDecline(last4?: string | null): string | null {
  return (last4 && SIMULATED_DECLINES[last4]) || null
}

/** What a PaymentIntent's status means for a regular payment. */
function outcomeOf(pi: Stripe.PaymentIntent): ChargeResult {
  if (pi.status === 'succeeded') return { ok: true, id: pi.id }
  if (pi.status === 'processing') return { ok: false, kind: 'processing', id: pi.id, error: 'The payment is still being processed.' }
  /* the card was refused, or the bank wants the cardholder present: either
     way only the donor can put it right */
  if (pi.status === 'requires_payment_method' || pi.status === 'requires_action' || pi.status === 'canceled') {
    const e = pi.last_payment_error
    return {
      ok: false,
      kind: 'declined',
      error: e?.message ?? (pi.status === 'requires_action' ? 'Your bank asked to confirm this payment.' : 'The card was declined.'),
      code: e?.decline_code ?? e?.code ?? undefined,
    }
  }
  return { ok: false, kind: 'retry', error: `Payment ${pi.status}` }
}

/* A card error is the bank's answer about the card. An invalid request on a
   regular payment is almost always the card itself (detached, deleted): the
   donor has to give a new one either way. Anything else — no connection, a
   timeout, Stripe's own 5xx, a rate limit — says nothing about the card. */
const DECLINE_TYPES = new Set(['StripeCardError', 'card_error', 'StripeInvalidRequestError', 'invalid_request_error'])

/** Take a regular payment from a card on file. `key` is the idempotency key,
 *  and goes on the PaymentIntent too (metadata.chargeKey) so a payment whose
 *  answer was lost can be found again; `meta` says which plan and date. */
export async function chargeSavedCard(p: {
  amount: number
  description: string
  last4?: string | null
  stripeCustomer?: string | null
  stripePaymentMethod?: string | null
  idempotencyKey: string
  meta?: Record<string, string>
  /** an earlier attempt with this key got no clear answer at this time: if it
   *  was long enough ago that Stripe may have forgotten the key (24 hours),
   *  look for the payment it made before making a new one */
  firstTriedAt?: Date | null
}): Promise<ChargeResult> {
  const s = await stripe()
  if (!s) {
    const declined = simulatedDecline(p.last4)
    if (declined) return { ok: false, kind: 'declined', error: declined, code: 'card_declined' }
    return { ok: true, id: `sim_pi_${p.idempotencyKey}` }
  }
  if (!p.stripeCustomer || !p.stripePaymentMethod) return { ok: false, kind: 'declined', error: 'No card on file.' }
  try {
    if (p.firstTriedAt && Date.now() - p.firstTriedAt.getTime() > 20 * 3_600_000) {
      const since = Math.floor(p.firstTriedAt.getTime() / 1000) - 3600
      const recent = await s.paymentIntents.list({ customer: p.stripeCustomer, created: { gte: since }, limit: 100 })
      const made = recent.data.find((x) => x.metadata?.chargeKey === p.idempotencyKey)
      if (made) return outcomeOf(made)
    }
    const pi = await s.paymentIntents.create(
      {
        amount: p.amount,
        currency: 'aud',
        customer: p.stripeCustomer,
        payment_method: p.stripePaymentMethod,
        off_session: true,
        confirm: true,
        description: p.description,
        metadata: { ...p.meta, chargeKey: p.idempotencyKey },
      },
      { idempotencyKey: p.idempotencyKey },
    )
    return outcomeOf(pi)
  } catch (err) {
    const e = err as { message?: string; code?: string; type?: string; payment_intent?: Stripe.PaymentIntent }
    if (e.type && DECLINE_TYPES.has(e.type)) {
      return { ok: false, kind: 'declined', error: e.message ?? 'The card was declined.', code: e.code }
    }
    return { ok: false, kind: 'retry', error: e.message ?? 'Stripe could not be reached.', code: e.code }
  }
}

/** Stripe Checkout in setup mode, for a donor replacing the card on a plan.
 *  Returns null in simulated mode — the portal takes test card details itself. */
export async function cardUpdateSession(p: { customer?: string | null; email: string; planId: string; returnPath: string }) {
  const s = await stripe()
  if (!s) return null
  const session = await s.checkout.sessions.create({
    mode: 'setup',
    currency: 'aud',
    customer: p.customer ?? undefined,
    customer_email: p.customer ? undefined : p.email,
    payment_method_types: ['card'],
    metadata: { planId: p.planId, purpose: 'card-update' },
    success_url: `${env.appUrl}${p.returnPath}?card=updated&session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.appUrl}${p.returnPath}`,
  })
  return session.url
}

/** A hosted payment page for a gift from the website. Regular gifts save the
 *  card for later (setup_future_usage) and the scheduler charges it after. */
export async function checkoutSession(p: {
  giftId: string
  /** the gift's publicToken: the thank-you page shows the gift by it */
  token: string
  amount: number
  label: string
  email: string
  recurring: boolean
}) {
  const s = await stripe()
  if (!s) return null
  const session = await s.checkout.sessions.create({
    mode: 'payment',
    customer_email: p.email,
    customer_creation: 'always',
    payment_method_types: ['card'],
    line_items: [{ quantity: 1, price_data: { currency: 'aud', unit_amount: p.amount, product_data: { name: p.label } } }],
    payment_intent_data: p.recurring ? { setup_future_usage: 'off_session' } : undefined,
    metadata: { giftId: p.giftId },
    success_url: `${env.appUrl}/thank-you?gift=${p.giftId}&t=${encodeURIComponent(p.token)}`,
    cancel_url: `${env.appUrl}/give?cancelled=1`,
  })
  return session.url
}

/* ---------- PayPal, over its REST API, no SDK ---------- */
async function paypalToken() {
  const pp = env.paypal!
  const r = await fetch(`${pp.api}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${pp.id}:${pp.secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!r.ok) throw new Error('PayPal refused the credentials')
  return ((await r.json()) as { access_token: string }).access_token
}

export async function paypalOrder(p: { giftId: string; amount: number; label: string }) {
  if (!env.paypal) return null
  const token = await paypalToken()
  const r = await fetch(`${env.paypal.api}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{ custom_id: p.giftId, description: p.label.slice(0, 127), amount: { currency_code: 'AUD', value: (p.amount / 100).toFixed(2) } }],
      application_context: {
        brand_name: 'Al-Anwaar',
        user_action: 'PAY_NOW',
        return_url: `${env.appUrl}/api/public/paypal/return?gift=${p.giftId}`,
        cancel_url: `${env.appUrl}/give?cancelled=1`,
      },
    }),
  })
  const order = (await r.json()) as { id: string; links: { rel: string; href: string }[] }
  return { id: order.id, url: order.links.find((l) => l.rel === 'approve')?.href ?? null }
}

type PaypalOrderBody = {
  status?: string
  message?: string
  name?: string
  details?: { issue?: string }[]
  purchase_units?: { payments?: { captures?: { id: string; status: string; amount?: { currency_code: string; value: string } }[] } }[]
}

/* What a PayPal capture came to. Only `declined` means the money is not
   coming: a refused card or account, a payer who never approved, an order
   that expired. `pending` is a capture PayPal has taken but is holding (for
   review, or a currency conversion) — the money usually arrives, so the gift
   waits. `unknown` (a timeout, an error we can't read, already captured by a
   request we can't see) also waits: the gift stays pending and is checked
   again, because recording "nothing was charged" for money that arrived is
   the worse mistake (findings M6). */
export type CaptureResult =
  | { ok: true; captureId: string; amountCents: number; currency: string }
  | { ok: false; kind: 'pending'; captureId: string; error: string }
  | { ok: false; kind: 'declined'; error: string }
  /** `already`: PayPal says this order was captured before (a second load of
   *  the return URL); the caller reads the order to see what was taken */
  | { ok: false; kind: 'unknown'; error: string; already?: boolean }

/** PayPal's issue codes that mean this order will not be paid. */
const PAYPAL_DECLINES = new Set([
  'INSTRUMENT_DECLINED', 'TRANSACTION_REFUSED', 'PAYER_CANNOT_PAY', 'PAYER_ACTION_REQUIRED',
  'ORDER_NOT_APPROVED', 'ORDER_EXPIRED', 'ORDER_CANNOT_BE_CAPTURED', 'MAX_NUMBER_OF_PAYMENT_ATTEMPTS_EXCEEDED',
])

/** The capture on an order, read for what it says about the money. */
function captureOf(body: PaypalOrderBody): CaptureResult | null {
  const captures = body.purchase_units?.[0]?.payments?.captures ?? []
  const done = captures.find((c) => c.status === 'COMPLETED')
  if (done?.amount) {
    return { ok: true, captureId: done.id, amountCents: Math.round(Number(done.amount.value) * 100), currency: done.amount.currency_code }
  }
  const held = captures.find((c) => c.status === 'PENDING')
  if (held) return { ok: false, kind: 'pending', captureId: held.id, error: 'PayPal is holding the payment for review' }
  if (captures.some((c) => c.status === 'DECLINED' || c.status === 'FAILED')) return { ok: false, kind: 'declined', error: 'PayPal declined the payment' }
  if (body.status === 'VOIDED') return { ok: false, kind: 'declined', error: 'The PayPal order was cancelled' }
  return null
}

/** Take the money on an approved order. */
export async function paypalCapture(orderId: string): Promise<CaptureResult> {
  if (!env.paypal) return { ok: false, kind: 'unknown', error: 'PayPal is not connected.' }
  const token = await paypalToken()
  const r = await fetch(`${env.paypal.api}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  const body = (await r.json().catch(() => ({}))) as PaypalOrderBody
  const read = captureOf(body)
  if (read) return read
  const issue = body.details?.[0]?.issue
  if (issue === 'ORDER_ALREADY_CAPTURED') return { ok: false, kind: 'unknown', error: 'Already captured', already: true }
  if (issue && PAYPAL_DECLINES.has(issue)) return { ok: false, kind: 'declined', error: body.message ?? issue }
  return { ok: false, kind: 'unknown', error: body.message ?? issue ?? `PayPal answered ${body.status ?? r.status}` }
}

/** What PayPal holds for an order now: used after a capture call failed or
 *  timed out, because the money may have been taken all the same. */
export async function paypalOrderCapture(orderId: string): Promise<CaptureResult> {
  if (!env.paypal) return { ok: false, kind: 'unknown', error: 'PayPal is not connected.' }
  const token = await paypalToken()
  const r = await fetch(`${env.paypal.api}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (r.status === 404) return { ok: false, kind: 'declined', error: 'PayPal has no such order' }
  const body = (await r.json().catch(() => ({}))) as PaypalOrderBody
  return captureOf(body) ?? { ok: false, kind: 'unknown', error: `The PayPal order is ${body.status ?? 'unknown'}` }
}

/** PayPal's own check of a webhook: the event goes back to PayPal with the
 *  transmission headers it came with and our webhook id, and PayPal says
 *  whether it sent it. True or false is PayPal's answer; a network failure
 *  throws, so the delivery gets a 5xx and PayPal tries again. */
export async function paypalVerifyWebhook(
  h: { authAlgo?: string; certUrl?: string; transmissionId?: string; transmissionSig?: string; transmissionTime?: string },
  event: unknown,
): Promise<boolean> {
  if (!env.paypal?.webhookId) return false
  if (!h.authAlgo || !h.certUrl || !h.transmissionId || !h.transmissionSig || !h.transmissionTime) return false
  const token = await paypalToken()
  const r = await fetch(`${env.paypal.api}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo: h.authAlgo,
      cert_url: h.certUrl,
      transmission_id: h.transmissionId,
      transmission_sig: h.transmissionSig,
      transmission_time: h.transmissionTime,
      webhook_id: env.paypal.webhookId,
      webhook_event: event,
    }),
  })
  if (!r.ok) throw new Error(`PayPal could not verify the webhook (HTTP ${r.status})`)
  return ((await r.json()) as { verification_status?: string }).verification_status === 'SUCCESS'
}

/** What PayPal says a capture is now (COMPLETED, PENDING, REFUNDED,
 *  PARTIALLY_REFUNDED, REVERSED, DECLINED…), with its order. Null when PayPal
 *  has no such capture. */
export async function paypalCaptureState(
  captureId: string,
): Promise<{ status: string; amountCents: number; currency: string; orderId?: string } | null> {
  if (!env.paypal) return null
  const token = await paypalToken()
  const r = await fetch(`${env.paypal.api}/v2/payments/captures/${encodeURIComponent(captureId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`PayPal could not read capture ${captureId} (HTTP ${r.status})`)
  const c = (await r.json()) as {
    status: string
    amount?: { currency_code: string; value: string }
    supplementary_data?: { related_ids?: { order_id?: string } }
  }
  return {
    status: c.status,
    amountCents: Math.round(Number(c.amount?.value ?? 0) * 100),
    currency: c.amount?.currency_code ?? '',
    orderId: c.supplementary_data?.related_ids?.order_id,
  }
}

/** Card brand from a number, for simulated mode's test cards. */
export function brandOf(num: string) {
  const n = num.replace(/\D/g, '')
  if (/^4/.test(n)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard'
  if (/^3[47]/.test(n)) return 'Amex'
  return 'Card'
}
