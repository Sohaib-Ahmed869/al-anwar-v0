import { CAUSES } from '../src/components/give-data'
import { totalOf, validateGift, type GiftPayload } from '../src/services/give'

/* ---------------------------------------------------------------------------
   POST /api/checkout

   ⚠ NOT WIRED UP YET — same situation as api/contact.ts. The site builds to a
   static bundle and nothing runs this until it is deployed somewhere with
   functions (Vercel, Netlify, Cloudflare). Written against the Web
   Request/Response signature so that host can be any of them.

   Takes a gift, checks it with the same rules the form uses, and asks Stripe
   or PayPal for a hosted payment page for exactly that total. Returns
   { url } and the browser goes there. No card details ever touch this site.

   No SDKs: both providers are called over their plain REST APIs with fetch, so
   package.json does not grow.

   TO SWITCH IT ON
     1. Environment variables on the host:
          STRIPE_SECRET_KEY      sk_live_… (sk_test_… first)
          PAYPAL_CLIENT_ID       from the PayPal developer dashboard
          PAYPAL_CLIENT_SECRET
          PAYPAL_API             https://api-m.sandbox.paypal.com while testing,
                                 https://api-m.paypal.com when live
     2. Set CHECKOUT_ENDPOINT in src/services/give.ts to '/api/checkout'.

   MONTHLY GIFTS
   A gift with frequency 'monthly' is a Stripe subscription: the same inline
   price with a month interval, mode 'subscription'. PayPal is refused for it,
   here and in validateGift, because recurring PayPal needs a billing plan
   created against a product in advance and nothing here creates one. Do not
   "fix" that by letting it through as a single capture.

   STILL TO BUILD BEFORE IT TAKES REAL MONEY
     - A Stripe webhook (checkout.session.completed) that records the gift and
       sends the tax receipt. The receipt must not be sent from /thank-you — a
       donor can land there without paying.
     - For monthly, invoice.paid as well: a subscription renews without ever
       touching checkout.session.completed again, so a receipt-on-session-only
       webhook silently stops receipting from month two. customer.subscription
       .deleted is what records a cancellation.
     - A way for a donor to stop a monthly gift. Until the Stripe billing portal
       is switched on, /give's FAQ says to write to us, and somebody has to
       actually action that.
     - A PayPal capture: PayPal returns the donor to /thank-you?token=… with the
       order APPROVED but not paid. Something server-side has to call
       POST /v2/checkout/orders/{id}/capture, then record and receipt it.
     - Enable Apple Pay and Google Pay in the Stripe dashboard (and verify the
       domain for Apple Pay). Checkout offers them by itself once they are on.
--------------------------------------------------------------------------- */

type Env = Record<string, string | undefined>
const env: Env = (globalThis as { process?: { env: Env } }).process?.env ?? {}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const describe = (p: GiftPayload) => {
  const fund = CAUSES.find((c) => c.id === p.fund)?.label ?? p.fund
  return `Gift to ${fund}${p.appeal ? ` (${p.appeal})` : ''}${p.behalfName ? `, on behalf of ${p.behalfName}` : ''}`
}

async function stripeSession(p: GiftPayload, origin: string): Promise<string> {
  const key = env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')

  /* A monthly gift is a subscription, not a payment: same inline price, plus a
     `recurring` interval, and the session's mode changes with it. Stripe bills
     it on the same date each month until it is cancelled.

     `metadata` does not survive onto the invoices of a subscription the way it
     does on a one-off session, so the same fields go on subscription_data as
     well — that is what the webhook reads on every renewal after the first. */
  const monthly = p.frequency === 'monthly'

  const facts: Record<string, string> = {
    fund: p.fund,
    appeal: p.appeal ?? '',
    gift: String(p.amount),
    frequency: p.frequency,
    cover_fee: String(p.coverFee),
    behalf: p.behalfName,
    name: `${p.first} ${p.last}`,
    updates: String(p.updates),
  }

  const form = new URLSearchParams({
    mode: monthly ? 'subscription' : 'payment',
    customer_email: p.email,
    success_url: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/give?designation=${p.fund}&amount=${p.amount}${monthly ? '&frequency=monthly' : ''}`,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'aud',
    'line_items[0][price_data][unit_amount]': String(Math.round(totalOf(p) * 100)),
    'line_items[0][price_data][product_data][name]': describe(p),
    ...(monthly ? { 'line_items[0][price_data][recurring][interval]': 'month' } : { submit_type: 'donate' }),
  })

  for (const [k, v] of Object.entries(facts)) {
    form.set(`metadata[${k}]`, v)
    if (monthly) form.set(`subscription_data[metadata][${k}]`, v)
  }

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  })
  const body = (await res.json()) as { url?: string; error?: { message?: string } }
  if (!res.ok || !body.url) throw new Error(body.error?.message ?? `Stripe answered ${res.status}`)
  return body.url
}

async function paypalOrder(p: GiftPayload, origin: string): Promise<string> {
  /* Belt and braces: validateGift already refuses this combination, and a
     monthly gift must never fall through to a single capture. */
  if (p.frequency === 'monthly') throw new Error('PayPal cannot take a monthly gift here')

  const id = env.PAYPAL_CLIENT_ID
  const secret = env.PAYPAL_CLIENT_SECRET
  const api = env.PAYPAL_API ?? 'https://api-m.sandbox.paypal.com'
  if (!id || !secret) throw new Error('PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set')

  const tokenRes = await fetch(`${api}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const token = ((await tokenRes.json()) as { access_token?: string }).access_token
  if (!token) throw new Error(`PayPal token request answered ${tokenRes.status}`)

  const orderRes = await fetch(`${api}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          description: describe(p).slice(0, 127),
          custom_id: p.fund,
          amount: { currency_code: 'AUD', value: totalOf(p).toFixed(2) },
        },
      ],
      payment_source: {
        paypal: {
          email_address: p.email,
          experience_context: {
            brand_name: 'Al-Anwaar Charity Group',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
            return_url: `${origin}/thank-you`,
            cancel_url: `${origin}/give?designation=${p.fund}&amount=${p.amount}`,
          },
        },
      },
    }),
  })
  const order = (await orderRes.json()) as { links?: { rel: string; href: string }[] }
  const url = order.links?.find((l) => l.rel === 'payer-action')?.href
  if (!orderRes.ok || !url) throw new Error(`PayPal order request answered ${orderRes.status}`)
  return url
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ message: 'Use POST.' }, 405)

  let p: GiftPayload
  try {
    const b = (await request.json()) as Partial<GiftPayload>
    p = {
      fund: String(b.fund ?? ''),
      appeal: b.appeal ? String(b.appeal) : undefined,
      frequency: b.frequency === 'monthly' ? 'monthly' : 'once',
      amount: Number(b.amount),
      coverFee: b.coverFee === true,
      provider: b.provider === 'paypal' ? 'paypal' : 'stripe',
      first: String(b.first ?? ''),
      last: String(b.last ?? ''),
      email: String(b.email ?? ''),
      behalfName: String(b.behalfName ?? ''),
      updates: b.updates === true,
    }
  } catch {
    return json({ message: 'That was not JSON.' }, 400)
  }

  const errors = validateGift(p)
  if (Object.keys(errors).length) return json({ errors, message: Object.values(errors)[0] }, 422)

  const origin = new URL(request.url).origin
  try {
    const url = p.provider === 'paypal' ? await paypalOrder(p, origin) : await stripeSession(p, origin)
    return json({ url })
  } catch (err) {
    console.error('[checkout]', err)
    return json({ message: 'We could not start the payment. Please try again.' }, 502)
  }
}
