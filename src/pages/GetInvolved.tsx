import Divider from '../components/Divider'
import InvolvedHero from '../sections/InvolvedHero'
import InvolvedVolunteer from '../sections/InvolvedVolunteer'
import InvolvedFundraise from '../sections/InvolvedFundraise'
import InvolvedPartners from '../sections/InvolvedPartners'
import InvolvedAsk from '../sections/InvolvedAsk'

/* ---------------------------------------------------------------------------
   Get involved, in five parts. Like Home, Zakat, About and Contact, this file
   is a table of contents and nothing else. Every word is in
   components/involved-data.ts.

   REBUILT 17 SEPTEMBER 2026 on the Home / About / Contact pattern: one ground
   the whole way down, SectionHead on every section, teal panels and ruled
   panels, one small masjid divider. The four-way card row under the hero
   came off the same day at the user's request, and so did the corporate &
   workplace giving section (and its menu link). The ink band, the sand and paper-2 bands
   and the social feeds are gone (the user's choices are at the top of
   involved-data.ts).

   1. The hero ............... InvolvedHero       Contact's teal duotone photo
   2. Volunteer with us ...... InvolvedVolunteer  #volunteer. Filed count in a
                                                   teal panel, two roles, the day
   3. Start a fundraiser ..... InvolvedFundraise  #fundraise. Idea cards and a
                                                   timeline
   4. Partnerships ........... InvolvedPartners   #partners. Give (ruled) and
                                                   get back (teal)
   5. The close .............. InvolvedAsk        teal email panel

   THE ANCHORS ARE A CONTRACT WITH THE HEADER
   components/nav-data.ts links the "Get involved" panel at all three section
   ids, and AboutWork.tsx links at #volunteer and #partners. If a section goes,
   its links go in the same commit.

   NOTHING ON THIS PAGE COLLECTS A NAME and no gold appears on it. Every call
   to action deep-links into the contact form with the subject chosen, or opens
   an email.
--------------------------------------------------------------------------- */
export default function GetInvolved() {
  return (
    <>
      <InvolvedHero />
      <InvolvedVolunteer />
      <Divider variant="mark" small />
      <InvolvedFundraise />
      <InvolvedPartners />
      <InvolvedAsk />
    </>
  )
}
