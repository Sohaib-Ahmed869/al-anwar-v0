import InvolvedHero from '../sections/InvolvedHero'
import InvolvedVolunteer from '../sections/InvolvedVolunteer'
import InvolvedFundraise from '../sections/InvolvedFundraise'
import InvolvedPartners from '../sections/InvolvedPartners'
import InvolvedCorporate from '../sections/InvolvedCorporate'
import InvolvedSocial from '../sections/InvolvedSocial'
import InvolvedAsk from '../sections/InvolvedAsk'

/* ---------------------------------------------------------------------------
   Get involved, in seven parts. Like Home, Zakat, About, Contact and Where it
   goes, this file is a table of contents and nothing else. Every word is in
   components/involved-data.ts.

   1. The band ............... InvolvedHero       ink, then the four-way index
                                                   strip. No photograph — the
                                                   only volunteer frames we
                                                   have are stock bought for
                                                   the events diary
   2. Volunteer with us ...... InvolvedVolunteer  #volunteer. Opens on the
                                                   filed volunteer count, which
                                                   is five and is not rounded up
   3. Start a fundraiser ..... InvolvedFundraise  #fundraise. Four ordinary
                                                   ideas and the real process,
                                                   because there is no platform
   4. Partnerships ........... InvolvedPartners   #partners. Sand. Written as a
                                                   trade — what you give, what
                                                   you get back
   5. Corporate giving ....... InvolvedCorporate  #corporate. The three facts a
                                                   finance team asks us for,
                                                   written to be forwarded
   6. What we post ........... InvolvedSocial     #social. The Facebook
                                                   timeline and the Instagram
                                                   posts, neither of which
                                                   loads until asked for
   7. The close .............. InvolvedAsk        sand. Says why there is no
                                                   sign-up form on the page

   THE ANCHORS ARE A CONTRACT WITH THE HEADER
   components/nav-data.ts links the "Get involved" panel at all four section
   ids, and AboutWork.tsx links at #volunteer and #partners. If a section goes,
   its links go in the same commit.

   NOTHING ON THIS PAGE COLLECTS A NAME, and that is the page's argument rather
   than an omission — the reasoning is at the top of involved-data.ts and it is
   the rule services/contact.ts and services/letter.ts already state. Four of
   the five calls to action deep-link into the contact form with the subject
   already chosen, which is why ContactForm now reads `?topic=`.

   THE EVENTS DIARY WAS SECTION 6 AND IS GONE — removed from the whole site on
   16 September 2026 along with /events, /events/:slug, the home page's
   next-event band and event-data.ts. The band asked for attention rather than
   money and the social section does the same job in the same slot.

   The grounds alternate — ink, paper-2 (the index), paper, paper-2, sand,
   paper, paper-2, sand — and no gold appears anywhere on the page. This page
   does not ask for money; the Donate button at the top of every page is there
   for anyone who came here and changed their mind.
--------------------------------------------------------------------------- */
export default function GetInvolved() {
  return (
    <>
      <InvolvedHero />
      <InvolvedVolunteer />
      <InvolvedFundraise />
      <InvolvedPartners />
      <InvolvedCorporate />
      <InvolvedSocial />
      <InvolvedAsk />
    </>
  )
}
