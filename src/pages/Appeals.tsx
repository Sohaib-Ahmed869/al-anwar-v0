import AppealsHero from '../sections/AppealsHero'
import AppealsList from '../sections/AppealsList'
import AppealsNotSure from '../sections/AppealsNotSure'

/* ---------------------------------------------------------------------------
   Appeals, in three parts. A table of contents and nothing else; every appeal
   is in components/appeals-data.ts.

   1. Where your gift is needed .. AppealsHero     a photograph at about 70% of
                                                   the screen, the page's words,
                                                   and the live appeal in teal
   2. Every open appeal .......... AppealsList     filters in the URL, the
                                                   photograph tiles, and the
                                                   empty state
   3. Not sure where to give? .... AppealsNotSure  sadaqah or zakat

   REBUILT ON THE HOME PAGE'S PATTERN, 16 September 2026, at the client's
   request: a photograph hero instead of the compact PageBand, the live appeal
   folded into it (AppealsUrgent, the white featured card, is gone), the shared
   SectionHead on every band, one ground with no sand band, and no progress
   bars anywhere on the page. The single appeal pages follow in a second pass.
--------------------------------------------------------------------------- */
export default function Appeals() {
  return (
    <>
      <AppealsHero />
      <AppealsList />
      <AppealsNotSure />
    </>
  )
}
