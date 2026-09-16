import FaqList from '../components/FaqList'
import Reveal, { Words } from '../components/Reveal'
import { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { FAQ } from '../components/zakat-data'

/* ---------------------------------------------------------------------------
   Zakat, section 5 of 5: questions. #faq, from the mega menu.

   The same split, head and accordion as GiveFaq (16 September 2026): the head
   set the way SectionHead sets it, in a narrow column on the left from lg up,
   and components/FaqList.tsx on the right. Open as many as you like, so a
   reader comparing the jewellery answer with the superannuation one keeps both.
--------------------------------------------------------------------------- */

export default function ZakatFaq() {
  return (
    <section id="faq" aria-labelledby="faq-head" className={`scroll-mt-[var(--header-h)] ${SECTION_Y}`}>
      <div className="gutter mx-auto max-w-page">
        <div className={`grid gap-x-s5 gap-y-s4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] ${BREAKOUT}`}>
          <div>
            <Reveal variant="soft">
              <p className="font-script text-[clamp(21px,1.9vw,27px)] leading-none text-green">Questions</p>
            </Reveal>
            <h2
              id="faq-head"
              className="mt-s2 max-w-[12ch] font-display text-[clamp(31px,4.2vw,54px)] leading-[1.05] tracking-[-0.022em] text-balance"
            >
              <Words text="What people ask us." delay={120} />
            </h2>
            <Reveal variant="soft" delay={300}>
              <p className="mt-s2 max-w-[40ch] text-[clamp(15.5px,1.2vw,17px)] leading-[1.55] text-text-2">
                Where scholars differ, we say so. For your own situation, ask a scholar you trust.
              </p>
            </Reveal>
          </div>

          <Reveal variant="soft" delay={260}>
            <FaqList items={FAQ} />
          </Reveal>
        </div>
      </div>
    </section>
  )
}
