/* ---------------------------------------------------------------------------
   The two trust badges shown at checkout (28 September 2026, client
   feedback): the ACNC "Registered Charity" tick and "DGR – Tax deductible".
   They replace the text headings "Registered with the ACNC" and "Tax
   deductible" that used to open the trust list on the give form.

   The artwork in public/assets/badges/ is a PLACEHOLDER drawn by us. When the
   official ACNC badge (from the ACNC Charity Portal) or a designed DGR badge
   arrives, overwrite the .svg (for the site) and the .png (for email, where
   SVG does not display in Gmail or Outlook) under the same names. Nothing
   else needs to change. The server's receipt email points at the .png files
   by the same paths; see server/emails/templates.ts.

   REPLACES lists the TRUST titles in give-data.ts that the badges stand in
   for, so GiveForm can leave them out of its list without that file changing.
--------------------------------------------------------------------------- */

export const BADGES = [
  {
    src: '/assets/badges/acnc-registered.svg',
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
