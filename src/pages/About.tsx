import AboutHero from '../sections/AboutHero'
import AboutMission from '../sections/AboutMission'
import AboutStory from '../sections/AboutStory'
import AboutTeam from '../sections/AboutTeam'
import AboutWork from '../sections/AboutWork'

/* ---------------------------------------------------------------------------
   About, in five parts. Like Home and Contact, this file is a table of contents
   and nothing else — every section of it is one file in src/sections/.

   1. Who you are giving to ..... AboutHero     the band, the registration, and
                                                 the one hero on the site that
                                                 is our own photograph
   2. What we are for ........... AboutMission  the mission carried across word
                                                 for word from the old site, the
                                                 vision it is working towards,
                                                 the three values written out as
                                                 commitments, and the hadith the
                                                 old homepage closed on
   3. How it started ............ AboutStory    six years as a dated ledger,
                                                 with a rule down the side that
                                                 fills as you read it
   4. Who decides ............... AboutTeam     the board, one seat at a time,
                                                 each opening what its office
                                                 is responsible for
   5. Volunteer with us ......... AboutWork     an afternoon, a skill or a
                                                 room, and the no-vacancies
                                                 line demoted under them

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
      <AboutStory />
      <AboutTeam />
      <AboutWork />
    </>
  )
}
