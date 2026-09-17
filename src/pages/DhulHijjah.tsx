import SeasonHero from '../sections/SeasonHero'
import SeasonWays from '../sections/SeasonWays'
import SeasonDays from '../sections/SeasonDays'
import SeasonAppeals from '../sections/SeasonAppeals'
import SeasonFaq from '../sections/SeasonFaq'
import Divider from '../components/Divider'
import { DHUL_HIJJAH } from '../components/season-data'

/* ---------------------------------------------------------------------------
   Dhul Hijjah and Qurbani, in five parts. A table of contents and nothing
   else: every word, date and amount is DHUL_HIJJAH in
   components/season-data.ts, and the sections are shared with /ramadan.

   1. The hero ............ SeasonHero     eyebrow, title, the open or expected
                                           line, Al-Hajj 22:37 on the right
   2. Ways to give ........ SeasonWays     #ways. Qurbani in teal, then
                                           sadaqah, food, water, emergency
   3. The days ............ SeasonDays     #days. The ten, Arafah, Eid,
                                           tashreeq
   4. Open appeals ........ SeasonAppeals  three tiles
   5. Questions ........... SeasonFaq      #faq

   Built 17 September 2026. Switched on and off with DHUL_HIJJAH.live; while
   it is off the Qurbani card shows when booking opens instead of a button.
--------------------------------------------------------------------------- */
export default function DhulHijjah() {
  return (
    <>
      <SeasonHero season={DHUL_HIJJAH} />
      <SeasonWays season={DHUL_HIJJAH} />
      <Divider variant="mark" small />
      <SeasonDays season={DHUL_HIJJAH} />
      <SeasonAppeals season={DHUL_HIJJAH} />
      <SeasonFaq season={DHUL_HIJJAH} />
    </>
  )
}
