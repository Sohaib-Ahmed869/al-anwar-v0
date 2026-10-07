import { expect } from 'vitest'
import type { Api } from './server'
import { OPEN_APPEAL, freshEmail } from './fixtures'

/* ---------------------------------------------------------------------------
   Giving through the public checkout, as the site's give form does it
   (src/services/give.ts → POST /api/public/checkout). Amounts are dollars on
   this side of the API, as on the form.

   With no payment provider connected (the tests never set one), a card gift
   is recorded as paid straight away and the reply sends the donor to the
   thank-you page. That URL carries the gift id, and possibly a token the
   status route wants back; giftStatus() passes on whatever the URL carried,
   so these helpers don't care which.
--------------------------------------------------------------------------- */

export type CheckoutInput = {
  fund?: string
  frequency?: 'once' | 'weekly' | 'fortnightly' | 'monthly'
  amount?: number
  operatingCosts?: number
  provider?: 'stripe' | 'paypal' | 'bank'
  first?: string
  last?: string
  email?: string
  appealSlug?: string
  updates?: boolean
}

export function checkoutBody(i: CheckoutInput = {}) {
  return {
    fund: i.fund ?? 'sadaqah',
    frequency: i.frequency ?? 'once',
    amount: i.amount ?? 50,
    operatingCosts: i.operatingCosts ?? 0,
    provider: i.provider ?? 'stripe',
    first: i.first ?? 'Test',
    last: i.last ?? 'Donor',
    email: i.email ?? freshEmail(),
    behalfName: '',
    updates: i.updates ?? false,
    appealSlug: i.appealSlug ?? OPEN_APPEAL,
  }
}

/** POST a checkout and return what came back, plus the gift id and the
 *  thank-you URL's query (with any token in it). Fails the test on a non-200. */
export async function checkout(api: Api, i: CheckoutInput = {}) {
  const body = checkoutBody(i)
  const res = await api.client().post('/api/public/checkout', body)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const url = new URL(res.body.url, 'http://x')
  const giftId = url.searchParams.get('gift') ?? res.body.giftId
  expect(giftId, `no gift id in ${res.body.url}`).toBeTruthy()
  return { ...res.body, giftId: giftId as string, query: url.searchParams, email: body.email }
}

/** the thank-you page's poll, with whatever token the URL carried */
export async function giftStatus(api: Api, giftId: string, query?: URLSearchParams) {
  const q = new URLSearchParams()
  for (const [k, v] of query ?? []) if (k !== 'gift' && k !== 'simulated') q.set(k, v)
  const s = q.toString()
  return api.client().get(`/api/public/gifts/${giftId}/status${s ? `?${s}` : ''}`)
}
