import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import { BREAKOUT } from '../components/SectionHead'
import { ArrowRight, HandHeart } from '../components/icons'

/* ---------------------------------------------------------------------------
   Where it goes, section 5 of 5: the ask.

   Rebuilt 17 September 2026 as the teal close panel the other rebuilt pages
   end on (masjid watermark), replacing the sand band. Gold on the give button
   only; the second way out is a question to a person, for the reader who got
   to the bottom of this page with one.
--------------------------------------------------------------------------- */

export default function WhereAsk() {
  return (
    <section aria-labelledby="where-ask-head" className="pb-[clamp(56px,6.5vw,96px)]">
      <div className="gutter mx-auto max-w-page">
        <Reveal variant="clip" className={`block ${BREAKOUT}`}>
          <div className="relative isolate flex flex-col gap-s4 overflow-hidden rounded-2xl bg-grad-lagoon-x p-s3 text-paper sm:p-s4 md:flex-row md:items-center md:justify-between lg:p-[clamp(40px,4vw,64px)]">
            <div>
              <p className="font-script text-[clamp(24px,2.2vw,32px)] leading-none text-gold-pale">Seen enough?</p>
              <h2
                id="where-ask-head"
                className="mt-2 font-display text-[clamp(28px,3.2vw,44px)] leading-[1.08] tracking-[-0.025em] text-balance"
              >
                Give knowing where it goes.
              </h2>
              <p className="mt-s2 max-w-[50ch] text-[15.5px] leading-[1.55] text-paper/85">
                If anything here does not add up for you,{' '}
                <Link to="/contact" className="font-semibold text-paper underline decoration-paper/40 underline-offset-4 hover:text-gold-pale">
                  ask us about it
                </Link>{' '}
                before you give.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <Link
                to="/give"
                className="group inline-flex min-h-[52px] items-center gap-2 rounded-[10px] bg-gold px-6 text-[15.5px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-gold-dark hover:text-ink"
              >
                <HandHeart className="h-[18px] w-[18px]" />
                Make a donation
              </Link>
              <Link
                to="/appeals"
                className="group inline-flex min-h-[52px] items-center gap-2 rounded-[10px] bg-paper px-6 text-[15.5px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-green-pale"
              >
                See the appeals
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
