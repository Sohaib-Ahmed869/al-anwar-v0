import type { Designation } from './domain'
import { isOperatingCosts } from './operating-costs'

/* ---------------------------------------------------------------------------
   The giving rules, written once for the site and the server.

   The /give form runs validateGift() before it posts (src/sections/
   GiveForm.tsx), and POST /api/public/checkout runs it again on whatever
   arrives (server/routes/public.ts), so a hand-built request gets exactly the
   answer the form would have given. Until 7 October 2026 the server reached
   into src/ for this by file path at runtime; that typed as `any`, so nothing
   checked the two sides agreed, and it would have broken under any bundler.
   Now both import it from here, and the server's type-check covers it.

   Plain data and pure functions only: no React, no window, no assets.

   FUNDS is the list of what a gift can be for. The site's CAUSES (src/
   components/give-data.ts) adds the photographs, rungs and wording for each,
   keyed by the same ids; the `monthly` flag lives here because it is a rule,
   not presentation — which funds may be given as a standing order at all.
--------------------------------------------------------------------------- */

export type Fund = {
  id: string
  label: string
  /** may be given monthly: the voluntary funds only. The four obligations
   *  (zakat, zakat ul fitr, kaffarah, fidyah) and qurbani are owed once, for
   *  a particular reason, and a standing order is the wrong shape for them. */
  monthly: boolean
}

export const FUNDS: Fund[] = [
  { id: 'sadaqah', label: 'Sadaqah', monthly: true },
  { id: 'zakat', label: 'Zakat ul Maal', monthly: false },
  { id: 'education', label: 'Education Project', monthly: true },
  { id: 'water', label: 'Water Project', monthly: true },
  { id: 'food', label: 'Food Project', monthly: true },
  { id: 'zakat-fitr', label: 'Zakat ul Fitr', monthly: false },
  { id: 'emergency', label: 'Emergency Project', monthly: true },
  { id: 'kaffarah', label: 'Kaffarah', monthly: false },
  { id: 'fidyah', label: 'Fidyah', monthly: false },
  { id: 'qurbani', label: 'Qurbani', monthly: false },
]

export const fundById = (id: string) => FUNDS.find((f) => f.id === id)

/** Can this fund be given monthly at all? */
export const takesMonthly = (fundId: string) => Boolean(fundById(fundId)?.monthly)

/** The smallest gift the form takes: the smallest that can carry a deductible
 *  receipt, per /terms. Dollars, as the form works in dollars. */
export const MIN_GIFT = 2

/** The designation every gift from a fund carries. The four obligations keep
 *  their own; the causes (water, food, education, emergency, qurbani) are
 *  voluntary charity, so sadaqah. A client cannot choose a different one: the
 *  designation decides which rules apply (monthly, zakat eligibility), so it
 *  follows the fund and nothing else. */
export const FUND_DESIGNATION: Record<string, Designation> = {
  zakat: 'zakat',
  'zakat-fitr': 'zakat_fitr',
  kaffarah: 'kaffarah',
  fidyah: 'fidyah',
  sadaqah: 'sadaqah',
}
export const designationOf = (fundId: string): Designation => FUND_DESIGNATION[fundId] ?? 'sadaqah'

/** Designations that are owed rather than given freely: never monthly. */
export const OWED_DESIGNATIONS: ReadonlySet<Designation> = new Set<Designation>(['zakat', 'zakat_fitr', 'kaffarah', 'fidyah'])

/** Designations that may only go to an appeal marked zakat-eligible. */
export const ZAKAT_DESIGNATIONS: ReadonlySet<Designation> = new Set<Designation>(['zakat', 'zakat_fitr'])

export type GiftProvider = 'stripe' | 'paypal'

export type GiftPayload = {
  /** a fund id from FUNDS */
  fund: string
  /** 'once' unless the donor chose Monthly. Only the voluntary funds take it,
   *  and only Stripe can charge it. */
  frequency: 'once' | 'monthly'
  /** a place or appeal the donor came from, e.g. "Gaza"; display only */
  appeal?: string
  /** the donation itself, in dollars, before any operating costs */
  amount: number
  /** the optional contribution to operating costs, in dollars */
  operatingCosts: number
  provider: GiftProvider
  first: string
  last: string
  email: string
  /** empty unless the gift is made in someone else's name */
  behalfName: string
  updates: boolean
}

export const EMAIL_LOOKS_RIGHT = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** What a name may contain: letters in any script, combining marks, spaces,
 *  apostrophes, full stops and hyphens. A donor's name is printed on receipts
 *  and merged into campaign emails, so it must never be able to carry a link,
 *  markup or a formula (finding M10). */
export const NAME_LOOKS_RIGHT = /^[\p{L}\p{M}' .\-’]{1,80}$/u

/** Every reason this gift cannot be taken, keyed by field. Empty means valid. */
export function validateGift(p: GiftPayload): Record<string, string> {
  const bad: Record<string, string> = {}
  const fund = fundById(p.fund)
  if (!fund) bad.fund = 'Choose what this donation is for.'
  if (!Number.isFinite(p.amount) || p.amount < MIN_GIFT) bad.amount = `The smallest donation we can take is $${MIN_GIFT}.`
  else if (p.amount > 1_000_000) bad.amount = 'For a donation this size, please call us.'
  /* Only the listed amounts, so a hand-built POST cannot add $3.17 or $10,000
     to the charge under a label that promises a small fixed sum. */
  if (!Number.isFinite(p.operatingCosts ?? 0) || !isOperatingCosts(Math.round((p.operatingCosts ?? 0) * 100)))
    bad.operatingCosts = 'Choose $2, $5, $10 or no contribution to operating costs.'
  const first = (p.first ?? '').trim()
  const last = (p.last ?? '').trim()
  if (!first) bad.first = 'We would like to know who to thank.'
  else if (!NAME_LOOKS_RIGHT.test(first)) bad.first = 'Use letters only in your name.'
  if (!last) bad.last = 'And the rest of it.'
  else if (!NAME_LOOKS_RIGHT.test(last)) bad.last = 'Use letters only in your name.'
  if (!EMAIL_LOOKS_RIGHT.test((p.email ?? '').trim()) || (p.email ?? '').length > 200) bad.email = 'The receipt needs a working address.'
  if (p.provider !== 'stripe' && p.provider !== 'paypal') bad.provider = 'Choose how to pay.'

  /* --- the two ways a monthly gift can be wrong ---------------------------
     Checked here rather than only in the interface, because this is what the
     server runs: a hand-built POST asking for a monthly zakat, or a monthly
     gift through PayPal, must be refused and not quietly charged once. */
  if (p.frequency !== 'once' && p.frequency !== 'monthly') bad.frequency = 'Choose how often to give.'
  else if (p.frequency === 'monthly') {
    if (fund && !fund.monthly) bad.frequency = `${fund.label} is owed once, not monthly. Give it as a one-time donation.`
    else if (p.provider === 'paypal') bad.provider = 'Monthly donations are by card. PayPal can only take a one-time donation.'
  }
  return bad
}
