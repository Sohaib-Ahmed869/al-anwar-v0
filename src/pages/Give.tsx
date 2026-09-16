import GiveHero from '../sections/GiveHero'
import GiveForm from '../sections/GiveForm'
import GiveFaq from '../sections/GiveFaq'

/* ---------------------------------------------------------------------------
   Give, in three parts. Like every other page, this file is a table of contents
   and nothing else. Copy and figures are in components/give-data.ts; how a
   gift is checked and paid is in services/give.ts and api/checkout.ts.

   1. Give with purpose .......... GiveHero    one screen: the film, an ayah,
                                               and one button down to the form
   2. The form ................... GiveForm    For · Amount · Details · Pay, the
                                               summary beside it, and every link
                                               into the page pre-filling it
   3. Before you give ............ GiveFaq     #faq

   16 September 2026, at the user's request, after looking at alihsan.org.au
   and other charities' donate pages: the hero is about two thirds of a screen
   so the form shows under it, the form asks fund, frequency and amount on one
   step (three steps, not four), and the "Why you can give with confidence"
   band is gone — its four facts moved into the form's summary panel, beside
   the button, where a hesitating donor is actually looking. Later the same day
   "Other ways to give" (GiveOther) was removed too; the pay step now shows
   the bank details itself while online payment is not switched on.

   Decided with the client on 15 September 2026: Stripe and PayPal as the two
   ways to pay, and the bank details from the Tarim flyer on the page. Two calls
   from that day were reversed on 16 September — the compact top band became the
   hero above, and one-time-only became one-time or monthly. The notes are in
   GiveHero.tsx and give-data.ts.

   THIS PAGE HOLDS NO STATE, AND THAT IS THE POINT
   For a few hours on 16 September it did: the hero carried an amount card, then
   a row of fund pills, and Give.tsx owned the handover between that and the
   form. Both are gone at the client's request, and with them the prop that
   joined them. A gift is decided in exactly one place on this page — the form —
   which already picks up a fund, an amount and a donor from the link that
   brought the reader here. The hero shortens the path to it and does nothing
   else, so there is nothing for this file to co-ordinate.
--------------------------------------------------------------------------- */
export default function Give() {
  return (
    <>
      <GiveHero />
      <GiveForm />
      <GiveFaq />
    </>
  )
}
