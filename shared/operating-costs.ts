/* ---------------------------------------------------------------------------
   The optional contribution to operating costs, offered at checkout.

   Why it exists (28 September 2026, client feedback): Al-Anwaar takes no
   admin fee out of donations, and says so at checkout. The old "add 2.6% to
   cover the card fee" tick box is gone; in its place the donor may add a
   small fixed sum towards running the charity, or nothing, which is the
   default.

   Why the amounts live here: the give form in the browser offers them,
   validateGift() in src/services/give.ts checks them, and the checkout route
   on the server checks them again after turning dollars into cents. Three
   readers, one list, so the form can never offer a figure the server refuses.

   Where it is stored: on the gift's existing `fee` field (integer cents),
   which already travels separately from `amount` through recordGift(),
   receipts, reports, the CSV and the Xero export. Gifts from before this
   change carry a percentage card fee in the same field; the portals label
   both as the operating costs contribution because both were money the donor
   chose to add on top of the donation.
--------------------------------------------------------------------------- */

/** The choices, in cents. 0 is "no thanks" and is the default. */
export const OPERATING_COSTS_CENTS = [0, 200, 500, 1000] as const

export type OperatingCostsCents = (typeof OPERATING_COSTS_CENTS)[number]

export const isOperatingCosts = (cents: unknown): cents is OperatingCostsCents =>
  typeof cents === 'number' && (OPERATING_COSTS_CENTS as readonly number[]).includes(cents)

/** What receipts, the portals and exports call it. */
export const OPERATING_COSTS_LABEL = 'Operating costs contribution'
