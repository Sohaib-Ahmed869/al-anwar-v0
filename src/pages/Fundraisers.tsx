import FundraisersHero from '../sections/FundraisersHero'
import FundraisersList from '../sections/FundraisersList'
import FundraisersHow from '../sections/FundraisersHow'

/* ---------------------------------------------------------------------------
   /fundraisers: community fundraisers, in three parts. Every word and every
   (sample) fundraiser is in components/fundraiser-data.ts.

   1. The hero ........ FundraisersHero   teal photo, start or browse, totals
   2. The list ........ FundraisersList   #browse. Reason chips and cards
   3. How it works .... FundraisersHow    the four steps and a teal close

   Added 17 September 2026 at the user's request, after a peer-to-peer
   campaigns page they named. The one rule that makes it genuine: every
   fundraiser raises for one of our real appeals.
--------------------------------------------------------------------------- */
export default function Fundraisers() {
  return (
    <>
      <FundraisersHero />
      <FundraisersList />
      <FundraisersHow />
    </>
  )
}
