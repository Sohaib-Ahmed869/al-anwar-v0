import WhereHero from '../sections/WhereHero'
import WhereAccounts from '../sections/WhereAccounts'
import WherePlaces from '../sections/WherePlaces'
import WhereLog from '../sections/WhereLog'
import WherePartners from '../sections/WherePartners'
import WhereReports from '../sections/WhereReports'
import WhereRegistration from '../sections/WhereRegistration'
import WhereAsk from '../sections/WhereAsk'

/* ---------------------------------------------------------------------------
   The accountability page, in eight parts. Like Home, Zakat, About and
   Contact, this file is a table of contents and nothing else. Every word and
   figure is in components/where-data.ts, including the reasoning for each set
   of them — which is worth more here than anywhere else on the site, because
   the argument this page makes is that its numbers can be checked.

   1. The band ................. WhereHero          ink. The shared compact
                                                     band, not a photograph:
                                                     nobody arrives here to
                                                     look at something
   2. Every year we filed ...... WhereAccounts      #accounts. Four years of
                                                     AIS figures, and the line
                                                     that says "audited" does
                                                     not apply to us
   3. Five places .............. WherePlaces        #gaza #yemen #lebanon
                                                     #syria #gambia. A ledger,
                                                     no photographs — see the
                                                     file. Carries the only
                                                     unconfirmed figures on the
                                                     page, chipped and fenced
   4. Every distribution ....... WhereLog           #log. Dated record with a
                                                     source per line. Renders
                                                     NOTHING below six entries
   5. Who delivers it .......... WherePartners      #partners. Sand. One named
                                                     partner, four admitted
                                                     gaps, and the routine
   6. What we file ............. WhereReports       #reports. There are no
                                                     annual reports, so it
                                                     hands over the sources
                                                     and the figures as a CSV
   7. Registration ............. WhereRegistration  #registration. ABN, ACNC,
                                                     DGR, as sentences
   8. The ask .................. WhereAsk           sand. Ask anyway, having
                                                     shown the gaps

   THE ANCHORS ARE A CONTRACT WITH THE HEADER
   components/nav-data.ts links the "Where it goes" panel straight at seven of
   these ids, and the footer links at #registration. Renaming or dropping one
   is a dead scroll from the menu, which is how five of them sat before this
   page was finished. If a section goes, its link goes in the same commit.

   The grounds alternate down the page — ink, paper, paper-2, paper, sand,
   paper, paper-2, sand — and the two sand bands are the two that are not
   accounting: who delivers the work, and the ask at the foot. Gold appears
   once, on the give button in section 8, and nowhere else.
--------------------------------------------------------------------------- */
export default function WhereItGoes() {
  return (
    <>
      <WhereHero />
      <WhereAccounts />
      <WherePlaces />
      <WhereLog />
      <WherePartners />
      <WhereReports />
      <WhereRegistration />
      <WhereAsk />
    </>
  )
}
