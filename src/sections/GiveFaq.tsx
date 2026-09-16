import FaqList from '../components/FaqList'
import Reveal, { Words } from '../components/Reveal'
import { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { GIVE_FAQ } from '../components/give-data'

/* ---------------------------------------------------------------------------
   /give, section 3 of 3: questions. #faq.

   The five things people ask before or just after paying, on paper, in the
   same split and the same accordion as the Zakat page's questions, under a
   head set the way the home page's are (components/SectionHead.tsx)
   (components/FaqList.tsx). Copy is in give-data.ts.
--------------------------------------------------------------------------- */

export default function GiveFaq() {
  return (
    <section id="faq" aria-labelledby="give-faq-head" className={`scroll-mt-[var(--header-h)] ${SECTION_Y}`}>
      <div className="gutter mx-auto max-w-page">
        <div className={`grid gap-x-s5 gap-y-s4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] ${BREAKOUT}`}>
          {/* Arrives as the home page's heads do (SectionHead). */}
          <div>
            <Reveal variant="soft">
              <p className="font-script text-[clamp(21px,1.9vw,27px)] leading-none text-green">Questions</p>
            </Reveal>
            <h2
              id="give-faq-head"
              className="mt-s2 max-w-[12ch] font-display text-[clamp(31px,4.2vw,54px)] leading-[1.05] tracking-[-0.022em] text-balance"
            >
              <Words text="Before you give." delay={120} />
            </h2>
            <Reveal variant="soft" delay={300}>
              <p className="mt-s2 max-w-[40ch] text-[clamp(15.5px,1.2vw,17px)] leading-[1.55] text-text-2">
                The questions we are asked most. Anything else, write to us and a person will answer.
              </p>
            </Reveal>
          </div>

          <Reveal variant="soft" delay={260}>
            <FaqList items={GIVE_FAQ} />
          </Reveal>
        </div>
      </div>
    </section>
  )
}
