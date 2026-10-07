import { OPERATING_COSTS_CENTS } from '../../shared/operating-costs'
import { validateGift as validateShared, type GiftPayload as SharedPayload } from '../../shared/giving'

/* ---------------------------------------------------------------------------
   What a gift is, whether it is valid, and how it gets paid.

   The rules themselves (validateGift, which funds take monthly, the smallest
   gift) live in shared/giving.ts, because the server runs them too: the form
   calls validateGift before it posts, and POST /api/public/checkout calls the
   same function on whatever arrives. This file is the browser's side: the
   payload the form builds, and the calls that send it.

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

   ── Operating costs (28 September 2026) ─────────────────────────────────
   The percentage "cover the card fee" tick box is gone. Al-Anwaar takes a 0%
   admin fee on donations, and the Pay step says so; under that the donor may
   add $2, $5 or $10 towards operating costs, or nothing (the default). The
   allowed amounts live in shared/operating-costs.ts, in cents, so the server
   checks the same list after it converts. The payload carries dollars, like
   `amount`, because this form works in dollars. On a monthly donation the
   contribution is added to every payment, exactly as the card fee was.
--------------------------------------------------------------------------- */

/** The platform API. Empty it to switch online giving off (see above). */
export const CHECKOUT_ENDPOINT = '/api/public/checkout'

/** The operating-cost choices in dollars, for the form: 0, 2, 5, 10. */
export const OPERATING_COSTS: number[] = OPERATING_COSTS_CENTS.map((c) => c / 100)

export type Provider = 'stripe' | 'paypal'

/** One gift, or the same gift on the same date every month. Added 16 September
 *  2026 with the hero's Monthly tab; before that every gift was 'once' and the
 *  field did not exist. */
export type Frequency = 'once' | 'monthly'

export type GiftPayload = SharedPayload & {
  /** the appeal's slug when the gift came from one (/appeals/<slug>, or a
   *  fundraiser's appeal), so the server can count it towards that appeal */
  appealSlug?: string
  /** the fundraiser's slug when the gift came through one */
  fundraiser?: string
  /** true keeps the donor's name off the site's recent-gifts feed and the
   *  fundraiser supporter lists; the server stores it on the gift */
  anonymous?: boolean
}

const cents = (v: number) => Math.round(v * 100) / 100

export const totalOf = (p: Pick<GiftPayload, 'amount' | 'operatingCosts'>) =>
  cents(p.amount + (p.operatingCosts || 0))

/** Every reason this gift cannot be taken, keyed by field. Empty means valid.
 *  The server runs exactly this (shared/giving.ts), so a hand-built POST gets
 *  the same answer the form would have. */
export const validateGift = (p: GiftPayload): Record<string, string> => validateShared(p)

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
  /** taken with no payment provider connected: nothing real was charged,
   *  and the receipt is a test (SIM- number), not a tax receipt */
  simulated: boolean
  /** PayPal took the payment and is holding it for review: it stays pending
   *  until PayPal releases it, usually within a day or two */
  held?: boolean
}

/** The gift's status, by its id and the token the payment page's return
 *  link carries; without the token the server answers "not found". */
export async function giftStatus(id: string, token: string): Promise<GiftStatus | null> {
  try {
    const res = await fetch(`/api/public/gifts/${encodeURIComponent(id)}/status?t=${encodeURIComponent(token)}`)
    return res.ok ? ((await res.json()) as GiftStatus) : null
  } catch {
    return null
  }
}
