/* ---------------------------------------------------------------------------
   The organisation, as data — the facts a legal document has to state exactly
   the same way every time it states them.

   The legal pages and the About page read this. Footer.tsx and WhereItGoes.tsx
   still carry their own copies; when one of these numbers becomes real, they
   should be pointed here too.

   The ABN and the registration date are no longer placeholders. They are taken
   from the ACNC's published charity register, where AL ANWAAR CHARITY GROUP LTD
   is listed against this website, registered on 30 July 2020 as a public
   benevolent institution. Both are verifiable by anyone at acnc.gov.au, which
   is the whole point of printing them.

   TODO, two things the register does NOT agree with the site about:
     - the address here is the warehouse in Silverwater, which is where post
       should go. The register's business address is 70 Oxford St, Guildford
       NSW 2161. Whichever is current, they should not stay different.
     - the register lists operating countries as Australia, Bangladesh and
       Yemen. The site says Gaza, Yemen, Lebanon, Syria and The Gambia. That
       gap is now wide enough to matter — Gaza especially, which a regulator
       and a bank both take an interest in — and it is corrected through the
       ACNC Annual Information Statement.
--------------------------------------------------------------------------- */

import { FACEBOOK, INSTAGRAM } from './social-data'

export const ORG = {
  name: 'Al-Anwaar Charity Group Ltd',
  short: 'Al-Anwaar',
  abn: '16 643 085 152',
  /** The day the company was formed and the day it was registered — the same
   *  day, which is unusual enough to be worth saying on the About page. */
  registered: '30 July 2020',
  email: 'info@alanwaar.group',
  street: '11 Egerton St',
  suburb: 'Silverwater NSW 2128',
  /** The state whose law governs the terms, and whose courts hear a dispute. */
  jurisdiction: 'New South Wales',
}

/** Where we are on other people's platforms, in the order the contact page
 *  shows them: the first one CONTACT.social.feature names takes the banner and
 *  the rest fall into the row under it.
 *
 *  FACEBOOK AND INSTAGRAM ARE REAL and are spread in from social-data.ts,
 *  which is now the only place their URLs are written down — Footer.tsx reads
 *  the same two, so the footer and this page can no longer disagree about
 *  where the charity is. The client gave both on 16 September 2026 and both
 *  were checked the same day.
 *
 *  TODO — WHATSAPP AND YOUTUBE ARE STILL PLACEHOLDERS and neither link goes
 *  anywhere real. They were invented on 8 September 2026 to build the contact
 *  page's social section against. Before launch either put the real URLs in,
 *  or delete these two rows. A contact page that offers a channel the
 *  organisation has not opened is worse than one that offers nothing — and it
 *  is worse now than it was, because the two accounts beside them are genuine
 *  and lend them credibility they have not got.
 *
 *  WhatsApp stays first because CONTACT.social.feature names it as the banner.
 *  If those two rows come off, that field has to name Instagram or Facebook
 *  instead or the banner falls back to whatever is first. */
export const SOCIALS = [
  { label: 'WhatsApp', href: 'https://whatsapp.com/channel/alanwaar' },
  { label: INSTAGRAM.label, href: INSTAGRAM.href },
  { label: FACEBOOK.label, href: FACEBOOK.href },
  { label: 'YouTube', href: 'https://youtube.com/@alanwaar' },
]

/** The date printed at the top of both legal pages.
 *  TODO: set this to the day the documents are signed off, not the day they
 *  were drafted. */
export const LEGAL_UPDATED = '8 September 2026'
