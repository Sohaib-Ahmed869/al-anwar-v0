import { CAUSES, MIN_GIFT, takesMonthly } from '../components/give-data'

/* ---------------------------------------------------------------------------
   What a gift is, whether it is valid, and how it gets paid.

   Two consumers, the same way services/contact.ts has two:
     - the form in sections/GiveForm.tsx, in the browser
     - server/routes/public.ts, which turns a gift into a Stripe or PayPal
       payment page (it loads this file by path; api/checkout.ts, the
       earlier stand-alone handler, is no longer what serves the site)

   so the rules are written once and imported by both. Nothing at the top level
   of this module touches `window`; keep it that way, or the server cannot
   import it.

   ── How paying works ────────────────────────────────────────────────────
   The donor never types a card number into this site. The form posts the gift
   to CHECKOUT_ENDPOINT, the server asks Stripe (card, Apple Pay, Google Pay)
   or PayPal for a hosted payment page for exactly that amount, and the browser
   is sent there. Both send the donor back to /thank-you when it is done. That
   keeps the site out of PCI scope entirely and needs no payment library in the
   bundle.

   CHECKOUT_ENDPOINT is the platform API's /api/public/checkout (server/
   routes/public.ts), which runs validateGift below on every gift before it
   does anything else. It answers one of three ways:
     { kind: 'redirect', url }   Stripe's or PayPal's page — or, while the
                                 platform has no Stripe keys, /thank-you for
                                 a gift recorded in SIMULATED mode, which the
                                 thank-you page says in so many words
     { kind: 'bank', url, … }    a transfer pledge with its own reference;
                                 /thank-you shows the details to pay to
     an error                    shown under the button, nothing charged
   If CHECKOUT_ENDPOINT is ever emptied again, `startCheckout` returns
   `not-connected` and the form says, in words, that online payment is not
   switched on and points at the bank details. It must never pretend a
   payment went through.

   ── Monthly ─────────────────────────────────────────────────────────────
   A gift carries a `frequency`. A monthly one takes the first payment through
   Stripe with the card saved, and the platform's scheduler charges that card
   each month after (server/jobs/recurring.ts). PayPal cannot take one here:
   recurring PayPal needs a billing plan set up against a product in advance,
   which nothing in this repo creates, so `validateGift` refuses the
   combination outright instead of letting a monthly gift through as a single
   charge.
--------------------------------------------------------------------------- */

/** The platform API. Empty it to switch online giving off (see above). */
export const CHECKOUT_ENDPOINT = '/api/public/checkout'

/** What the card processor takes, asked for in dollars on the form. */
export const FEE_RATE = 0.026

export type Provider = 'stripe' | 'paypal'

/** One gift, or the same gift on the same date every month. Added 16 September
 *  2026 with the hero's Monthly tab; before that every gift was 'once' and the
 *  field did not exist. */
export type Frequency = 'once' | 'monthly'

export type GiftPayload = {
  /** a fund id from CAUSES */
  fund: string
  /** 'once' unless the donor chose Monthly. Only the voluntary funds take it,
   *  and only Stripe can charge it — see validateGift. */
  frequency: Frequency
  /** a place or appeal the donor came from, e.g. "Gaza"; display only */
  appeal?: string
  /** the appeal's slug when the gift came from one (/appeals/<slug>, or a
   *  fundraiser's appeal), so the server can count it towards that appeal */
  appealSlug?: string
  /** the fundraiser's slug when the gift came through one */
  fundraiser?: string
  /** the gift itself, in dollars, before any fee */
  amount: number
  coverFee: boolean
  provider: Provider
  first: string
  last: string
  email: string
  /** empty unless the gift is made in someone else's name */
  behalfName: string
  updates: boolean
}

const cents = (v: number) => Math.round(v * 100) / 100

export const feeOf = (amount: number) => cents(amount * FEE_RATE)

export const totalOf = (p: Pick<GiftPayload, 'amount' | 'coverFee'>) =>
  cents(p.amount + (p.coverFee ? feeOf(p.amount) : 0))

const EMAIL_LOOKS_RIGHT = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Every reason this gift cannot be taken, keyed by field. Empty means valid.
 *  The server runs exactly this, so a hand-built POST gets the same answer the
 *  form would have. */
export function validateGift(p: GiftPayload): Record<string, string> {
  const bad: Record<string, string> = {}
  const cause = CAUSES.find((c) => c.id === p.fund)
  if (!cause) bad.fund = 'Choose what this gift is for.'
  if (!Number.isFinite(p.amount) || p.amount < MIN_GIFT)
    bad.amount = `The smallest gift we can take is $${MIN_GIFT}.`
  else if (p.amount > 1_000_000) bad.amount = 'For a gift this size, please call us.'
  if (!p.first.trim()) bad.first = 'We would like to know who to thank.'
  if (!p.last.trim()) bad.last = 'And the rest of it.'
  if (!EMAIL_LOOKS_RIGHT.test(p.email.trim())) bad.email = 'The receipt needs a working address.'
  if (p.provider !== 'stripe' && p.provider !== 'paypal') bad.provider = 'Choose how to pay.'

  /* --- the two ways a monthly gift can be wrong ---------------------------
     Both are checked here rather than only in the interface, because this
     function is what the server runs: a hand-built POST asking for a monthly
     zakat, or a monthly gift through PayPal, must be refused and not quietly
     charged once. A gift booked as monthly and taken once is a real-money bug,
     which is the whole reason `frequency` exists on the payload at all. */
  if (p.frequency !== 'once' && p.frequency !== 'monthly') bad.frequency = 'Choose how often to give.'
  else if (p.frequency === 'monthly') {
    if (cause && !takesMonthly(cause))
      bad.frequency = `${cause.label} is owed once, not monthly. Give it as a one-time gift.`
    else if (p.provider === 'paypal')
      bad.provider = 'Monthly gifts are by card. PayPal can only take a one-time gift.'
  }
  return bad
}

export type CheckoutResult =
  | { kind: 'redirect'; url: string }
  | { kind: 'not-connected' }
  | { kind: 'failed'; message: string }

type CheckoutReply = {
  kind?: 'redirect' | 'bank'
  url?: string
  error?: { message?: string; fields?: Record<string, string> }
}

/** Ask the server for a payment page, and hand back where to send the donor.
 *  A bank-transfer pledge comes back with a url as well: the thank-you page,
 *  which shows the reference and the account to pay into. */
export async function startCheckout(p: GiftPayload): Promise<CheckoutResult> {
  if (!CHECKOUT_ENDPOINT) return { kind: 'not-connected' }

  try {
    const res = await fetch(CHECKOUT_ENDPOINT, {
      method: 'POST',
      /* the platform refuses a state change without this header — it is the
         half of its CSRF defence a cross-site form cannot fake */
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'aa' },
      body: JSON.stringify(p),
    })
    const body = (await res.json().catch(() => ({}))) as CheckoutReply
    if (res.ok && body.url) return { kind: 'redirect', url: body.url }
    /* the first field the server objected to says more than the headline */
    const field = body.error?.fields && Object.values(body.error.fields)[0]
    return { kind: 'failed', message: field ?? body.error?.message ?? 'We could not start the payment.' }
  } catch {
    return { kind: 'failed', message: 'We could not reach the payment service. Check your connection.' }
  }
}

/* ---------------------------------------------------------------------------
   What the thank-you page reads back: the gift as the server has it, so the
   page shows what actually happened rather than what the form hoped for.
   Money is in CENTS here, as everywhere on the platform API.
--------------------------------------------------------------------------- */

export type GiftStatus = {
  id: string
  number: string
  status: 'succeeded' | 'pending' | 'failed' | 'refunded'
  amount: number
  fee: number
  designation: string
  method: 'card' | 'paypal' | 'bank' | 'cash' | 'cheque' | 'event'
  appealTitle: string | null
  fundraiserTitle: string | null
  date: string
  receiptNumber: string | null
  receiptEmailed: boolean
  reference: string | null
  firstName: string | null
  frequency: 'once' | 'weekly' | 'fortnightly' | 'monthly'
  instalments: number | null
  nextChargeAt: string | null
  bank: { accountName: string; bsb: string; accountNumber: string } | null
  failureReason: string | null
  /** no payment provider is connected; nothing real was charged */
  simulated: boolean
}

export async function giftStatus(id: string): Promise<GiftStatus | null> {
  try {
    const res = await fetch(`/api/public/gifts/${encodeURIComponent(id)}/status`)
    return res.ok ? ((await res.json()) as GiftStatus) : null
  } catch {
    return null
  }
}
