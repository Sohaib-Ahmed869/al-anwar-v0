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
   anything else goes through.
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

export type ChargeResult = { ok: true; id: string } | { ok: false; error: string; code?: string }

const SIMULATED_DECLINES: Record<string, string> = {
  '0002': 'Your card was declined.',
  '9995': 'Your card has insufficient funds.',
  '0069': 'Your card has expired.',
  '0119': 'An error occurred while processing your card.',
}

export function simulatedDecline(last4?: string | null): string | null {
  return (last4 && SIMULATED_DECLINES[last4]) || null
}

/** Take a regular payment from a card on file. */
export async function chargeSavedCard(p: {
  amount: number
  description: string
  last4?: string | null
  stripeCustomer?: string | null
  stripePaymentMethod?: string | null
  idempotencyKey: string
}): Promise<ChargeResult> {
  const s = await stripe()
  if (!s) {
    const declined = simulatedDecline(p.last4)
    if (declined) return { ok: false, error: declined, code: 'card_declined' }
    return { ok: true, id: `sim_pi_${p.idempotencyKey.slice(-12)}` }
  }
  if (!p.stripeCustomer || !p.stripePaymentMethod) return { ok: false, error: 'No card on file.' }
  try {
    const pi = await s.paymentIntents.create(
      {
        amount: p.amount,
        currency: 'aud',
        customer: p.stripeCustomer,
        payment_method: p.stripePaymentMethod,
        off_session: true,
        confirm: true,
        description: p.description,
      },
      { idempotencyKey: p.idempotencyKey },
    )
    return pi.status === 'succeeded' ? { ok: true, id: pi.id } : { ok: false, error: `Payment ${pi.status}` }
  } catch (err) {
    const e = err as { message?: string; code?: string }
    return { ok: false, error: e.message ?? 'The card was declined.', code: e.code }
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
    line_items: [{ quantity: 1, price_data: { currency: 'aud', unit_amount: p.amount, product_data: { name: p.label } } }],
    payment_intent_data: p.recurring ? { setup_future_usage: 'off_session' } : undefined,
    metadata: { giftId: p.giftId },
    success_url: `${env.appUrl}/thank-you?gift=${p.giftId}`,
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

export async function paypalCapture(orderId: string): Promise<ChargeResult> {
  if (!env.paypal) return { ok: false, error: 'PayPal is not connected.' }
  const token = await paypalToken()
  const r = await fetch(`${env.paypal.api}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  const body = (await r.json()) as { status?: string; message?: string }
  return body.status === 'COMPLETED' ? { ok: true, id: orderId } : { ok: false, error: body.message ?? 'PayPal did not complete the payment.' }
}

/** Card brand from a number, for simulated mode's test cards. */
export function brandOf(num: string) {
  const n = num.replace(/\D/g, '')
  if (/^4/.test(n)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard'
  if (/^3[47]/.test(n)) return 'Amex'
  return 'Card'
}
