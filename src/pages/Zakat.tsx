import ZakatHero from '../sections/ZakatHero'
import ZakatCalc from '../sections/ZakatCalc'
import ZakatPolicy from '../sections/ZakatPolicy'
import ZakatFitr from '../sections/ZakatFitr'
import ZakatFaq from '../sections/ZakatFaq'
import Divider from '../components/Divider'

/* ---------------------------------------------------------------------------
   Zakat, in five parts. Like Home and Give, this file is a table of contents
   and nothing else. Every word and figure is in components/zakat-data.ts.

   1. The hero .................. ZakatHero    script eyebrow, a plain title, the
                                               verse (Ar-Rum 30:39) under it
   2. What do you owe? .......... ZakatCalc    #calculator, and #nisab on the
                                               three facts at its top
   3. What we do with it ........ ZakatPolicy  #policy. The three rules, where it
                                               goes, and the eight of 9:60
   4. Zakat al-Fitr ............. ZakatFitr    #fitr. Per head, with a stepper
   5. Questions ................. ZakatFaq     #faq. Where scholars differ, the
                                               answer says so and does not pick

   REVAMPED 16 SEPTEMBER 2026, at the user's request, to match the home and give
   pages. It was eight sections on alternating grounds (ink, paper, sand). The
   nisab section folded into the calculator, "Where your zakat goes" into the
   policy, and the closing "Ready to pay?" band came off, since the calculator
   and the hero both carry the pay button.

   One ground the whole way down, as on Home, with every head set by
   SectionHead's rules and SECTION_Y between bands. One seam, the small mark,
   at the page's turn from your money to what we do with it. Gold is on the pay
   buttons and nowhere else.
--------------------------------------------------------------------------- */
export default function Zakat() {
  return (
    <>
      <ZakatHero />
      <ZakatCalc />
      <Divider variant="mark" small />
      <ZakatPolicy />
      <ZakatFitr />
      <ZakatFaq />
    </>
  )
}
