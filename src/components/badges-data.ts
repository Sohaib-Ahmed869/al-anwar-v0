/* ---------------------------------------------------------------------------
   The two trust badges shown at checkout (28 September 2026, client
   feedback): the ACNC "Registered Charity" tick and "DGR – Tax deductible".
   They replace the text headings "Registered with the ACNC" and "Tax
   deductible" that used to open the trust list on the give form.

   Both are round seals of the same size so they sit as a pair.
   acnc-registered.png is the official ACNC "Registered Charity" logo the
   client supplied (docs/acnc-registered-charity-logo_rgb.png), trimmed and
   squared but otherwise untouched, as the ACNC's logo terms require. The ATO
   publishes no DGR logo, so dgr-tax-deductible.svg is our own seal in the
   charity's green, and its .png is the same seal rendered for email (Gmail
   and Outlook do not show SVG). The server's receipt email points at the
   .png files by the same paths; see server/emails/templates.ts.

   REPLACES lists the TRUST titles in give-data.ts that the badges stand in
   for, so GiveForm can leave them out of its list without that file changing.
--------------------------------------------------------------------------- */

export const BADGES = [
  {
    src: '/assets/badges/acnc-registered.png',
    alt: 'Registered charity with the ACNC',
    to: '/where-it-goes#accounts',
  },
  {
    src: '/assets/badges/dgr-tax-deductible.svg',
    alt: 'Deductible gift recipient: donations are tax deductible',
  },
] as { src: string; alt: string; to?: string }[]

export const BADGE_FINE_PRINT = 'Donations of $2 or more are tax deductible in Australia.'

export const BADGE_REPLACES = ['Registered with the ACNC', 'Tax deductible']
