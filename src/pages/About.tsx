import AboutHero from '../sections/AboutHero'
import AboutMission from '../sections/AboutMission'
import AboutStory from '../sections/AboutStory'
import AboutTeam from '../sections/AboutTeam'
import AboutWork from '../sections/AboutWork'
import Divider from '../components/Divider'

/* ---------------------------------------------------------------------------
   About, in five parts. Like Home and Contact, this file is a table of contents
   and nothing else — every section of it is one file in src/sections/.

   1. Who you are giving to ..... AboutHero     light, no photograph, no shape
                                                 behind it (17 Sep 2026): a very
                                                 large title and a turning
                                                 place (the ribbon is gone)
   2. What we stand for ......... AboutMission  the mission carried across word
                                                 for word from the old site in
                                                 a teal panel, the vision, and
                                                 the three values as ruled cards,
                                                 and the hadith the old homepage
                                                 closed on
   3. How it started ............ AboutStory    six years as a dated ledger,
                                                 with a rule down the side that
                                                 fills as you read it
   4. Who decides ............... AboutTeam     the board, one seat at a time,
                                                 each opening what its office
                                                 is responsible for
   5. Volunteer with us ......... AboutWork     an afternoon, a skill or a
                                                 room, and the no-vacancies
                                                 line demoted under them

   ONE GROUND (17 September 2026): every section now sits on the page's single
   ground with the shared SectionHead and SECTION_Y spacing, as Home and
   Appeals do. No section sets a background of its own; the sand bands and the
   ink hadith strip are gone.

   The order is an argument, the same way the home page is: who we are, what we
   promised, what we have actually done, who is accountable for it, and how to
   join in. The two sections the mega menu links straight into — #team and
   #work — carry their own scroll-mt so a hash landing clears the sticky header.

   THERE WAS A SIXTH, and it was "What we don't do": four rules the charity set
   for itself — no zakat spent on admin, no work in a country without a partner,
   nothing published that cannot be evidenced, no chasing donors for money —
   each with a link to where a stranger could check it had been kept. It was
   removed at the client's request. It is the only place the site set out what
   it refuses to do, so the page now argues entirely from what we have done and
   never from what we have turned away. If it comes back, it goes between the
   board and the roles, where the refusals answered the accountability the board
   section raises.

   CONTENT PROVENANCE — worth knowing before anyone edits the words
   The mission, the three values and the hadith are the previous site's own,
   taken from alanwaar.group as it stood and kept verbatim. The registration
   date, the ABN, the public-benevolent-institution status and the board of
   three are from the ACNC register. The dates in the story are read off our own
   photographs. Everything that is none of those things is marked on the page as
   a draft or "to confirm", and the section files list what has to be settled.
--------------------------------------------------------------------------- */
export default function About() {
  return (
    <>
      <AboutHero />
      <AboutMission />
      {/* One seam, as on the home page: the turn from what we promise to what
          we have done. Small, with no padding of its own. */}
      <Divider variant="mark" small />
      <AboutStory />
      <AboutTeam />
      <AboutWork />
    </>
  )
}
