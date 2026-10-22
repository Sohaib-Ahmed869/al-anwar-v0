import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { money } from '../components/appeal-view'
import { CAUSES } from '../components/give-data'
import { ArrowRight } from '../components/icons'

/* ---------------------------------------------------------------------------
   /appeals, section 3 of 3: not sure where to give?

   For the reader who has looked at every tile and cannot choose. Two ways in:
   sadaqah, which goes wherever the need is shortest, and zakat, which is owed
   and has its own page.

   Rebuilt on the home page's pattern on 16 September 2026: the shared
   SectionHead, the page's one ground instead of a sand band, and sadaqah in
   the home banner's teal panel with its "from" price, because it is the side
   that takes money. Zakat sits beside it as a plain ruled panel with a link,
   since that page works the figure out first. Gold only on the sadaqah side.
--------------------------------------------------------------------------- */

const SADAQAH_FROM = CAUSES.find((c) => c.id === 'sadaqah')?.amounts[0]?.value ?? 25

export default function AppealsNotSure() {
  return (
    <section aria-labelledby="unsure-head" className={SECTION_Y}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="unsure-head"
          eyebrow="Still deciding?"
          title="Not sure where to give?"
          lede="Leave the choice with us, or work out the zakat you owe first."
        />

        <div
          className={`mt-s4 grid gap-s2 lg:mt-s5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] ${BREAKOUT}`}
        >
          <Reveal variant="clip" className="h-full">
            <div className="flex h-full flex-col rounded-2xl bg-teal p-s3 text-paper sm:p-s4 lg:p-[clamp(32px,3.2vw,52px)]">
              <p className="font-script text-[clamp(26px,2.4vw,36px)] leading-none text-gold-pale">
                Sadaqah
              </p>
              <h3 className="mt-2 font-display text-[clamp(26px,2.5vw,36px)] leading-[1.1] tracking-[-0.02em] text-balance">
                Where it&rsquo;s needed most
              </h3>
              <p className="mt-s2 max-w-[44ch] text-[15.5px] leading-[1.55] text-paper/85">
                We send it to whichever appeal is shortest of what it needs that week. Any amount,
                at any time.
              </p>

              <div className="mt-s4 flex flex-wrap items-end justify-between gap-x-s3 gap-y-s2 lg:mt-auto lg:pt-s4">
                <div>
                  <p className="text-[13px] font-semibold">Give from</p>
                  <p className="nums mt-1 font-display text-[clamp(44px,4.2vw,66px)] leading-none tracking-[-0.03em]">
                    {money(SADAQAH_FROM)}
                  </p>
                </div>
                <Link
                  to="/give?designation=sadaqah"
                  className="group inline-flex min-h-[50px] items-center gap-2 rounded-[10px] bg-gold px-6 text-[16px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-gold-dark hover:text-ink"
                >
                  Give sadaqah
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal variant="clip" delay={90} className="h-full">
            <div className="flex h-full flex-col rounded-2xl border border-line p-s3 sm:p-s4 lg:p-[clamp(32px,3.2vw,52px)]">
              <p className="font-script text-[clamp(26px,2.4vw,36px)] leading-none text-green">
                Zakat
              </p>
              <h3 className="mt-2 font-display text-[clamp(26px,2.5vw,36px)] leading-[1.1] tracking-[-0.02em] text-balance">
                Passed on whole
              </h3>
              <p className="mt-s2 max-w-[40ch] text-[15.5px] leading-[1.55] text-text-2">
                Work out what you owe, and it goes only to the people zakat is for. None of it runs
                the charity.
              </p>
              <Link
                to="/zakat"
                className="group mt-s4 inline-flex min-h-[50px] items-center gap-2 self-start rounded-[10px] border border-ink/15 px-6 text-[15.5px] font-semibold text-text transition-[border-color,background-color] duration-200 ease-brand hover:border-ink hover:bg-paper lg:mt-auto"
              >
                Work out your zakat
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
