import Divider from '../components/Divider'
import WhereHero from '../sections/WhereHero'
import WhereAccounts from '../sections/WhereAccounts'
import WherePlaces from '../sections/WherePlaces'
import WhereLog from '../sections/WhereLog'
import WhereAsk from '../sections/WhereAsk'

/* ---------------------------------------------------------------------------
   The accountability page, in five parts. Like Home, Zakat, About and
   Contact, this file is a table of contents and nothing else. Every word and
   figure is in components/where-data.ts, including the reasoning for each set
   of them — which is worth more here than anywhere else on the site, because
   the argument this page makes is that its numbers can be checked.

   REBUILT 17 SEPTEMBER 2026 at the user's request on the home / appeals
   pattern: one ground, SectionHead on every section, teal panels. Removed:
   the ink PageBand, the sand close, the six-column table and its paragraphs,
   and the five unconfirmed "indicative" place figures with their fences.

   1. The hero ................. WhereHero      photo, filed figures in teal
   2. Every year we filed ...... WhereAccounts  #accounts. A bar per year
   3. Five places .............. WherePlaces    #places, and #gaza #yemen
                                                 #lebanon #syria #gambia on
                                                 the cards
   4. Every distribution ....... WhereLog       #log. A timeline; renders
                                                 nothing below six entries
   5. The ask .................. WhereAsk       teal close panel

   THE ANCHORS ARE A CONTRACT WITH THE HEADER
   components/nav-data.ts links the "Where it goes" panel straight at the five
   place ids. If a section goes, its link goes in the same commit.

   CUT 17 SEPTEMBER 2026, at the user's request: "Who delivers it"
   (WherePartners, #partners), "What we file" (WhereReports, #reports) and
   "Registration" (WhereRegistration, #registration), with their menu column,
   their footer links and the give page's trust link to #registration. The
   partner data (PARTNERS, ROUTINE) stays in where-data.ts because
   partners-data.ts still reads it.

   Gold appears on the give buttons only (the hero panel and the close).
--------------------------------------------------------------------------- */
export default function WhereItGoes() {
  return (
    <>
      <WhereHero />
      <WhereAccounts />
      <Divider variant="mark" small />
      <WherePlaces />
      <WhereLog />
      <WhereAsk />
    </>
  )
}
