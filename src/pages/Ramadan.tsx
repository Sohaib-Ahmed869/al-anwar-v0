import SeasonHero from '../sections/SeasonHero'
import SeasonWays from '../sections/SeasonWays'
import SeasonDays from '../sections/SeasonDays'
import SeasonAppeals from '../sections/SeasonAppeals'
import SeasonFaq from '../sections/SeasonFaq'
import Divider from '../components/Divider'
import { RAMADAN } from '../components/season-data'

/* ---------------------------------------------------------------------------
   Ramadan, in five parts. A table of contents and nothing else: every word,
   date and amount is RAMADAN in components/season-data.ts, and the sections
   are shared with /dhul-hijjah.

   1. The hero ............ SeasonHero     eyebrow, title, the open or expected
                                           line, Al-Qadr 97:3 on the right
   2. Ways to give ........ SeasonWays     #ways. Zakat, zakat al-Fitr, food,
                                           fidyah, kaffarah, sadaqah
   3. The days ............ SeasonDays     #days. First night, last ten, fitr,
                                           Eid
   4. Open appeals ........ SeasonAppeals  three tiles
   5. Questions ........... SeasonFaq      #faq

   Built 17 September 2026. Switched on and off with RAMADAN.live.
--------------------------------------------------------------------------- */
export default function Ramadan() {
  return (
    <>
      <SeasonHero season={RAMADAN} />
      <SeasonWays season={RAMADAN} />
      <Divider variant="mark" small />
      <SeasonDays season={RAMADAN} />
      <SeasonAppeals season={RAMADAN} />
      <SeasonFaq season={RAMADAN} />
    </>
  )
}
