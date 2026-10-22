import { Link } from 'react-router-dom'

import FundraiserCard from '../components/FundraiserCard'
import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { ArrowRight } from '../components/icons'
import { FUNDRAISE } from '../components/involved-data'
import { useFundraisers } from '../services/fundraisers'
import { FundraiseSteps } from './FundraisersHow'

/* ---------------------------------------------------------------------------
   Get involved, section 3 of 5: start a fundraiser.

   17 September 2026, second pass: the four idea cards came off because they
   read as suggestions, not something genuine. In their place, the community
   fundraisers themselves (three cards from fundraiser-data.ts, each raising
   for a real appeal) so a reader sees what a fundraiser actually is, with
   "Start a fundraiser" going to /fundraisers/start and "See all" to
   /fundraisers. The timeline under them is the shared FundraiseSteps.
--------------------------------------------------------------------------- */

export default function InvolvedFundraise() {
  const live = useFundraisers().list.slice(0, 3)

  return (
    <section
      id="fundraise"
      aria-labelledby="fundraise-head"
      className={`scroll-mt-[calc(var(--header-h)+24px)] ${SECTION_Y}`}
    >
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="fundraise-head"
          eyebrow={FUNDRAISE.eyebrow}
          title={FUNDRAISE.title}
          lede={FUNDRAISE.lede}
          action={
            <Link
              to="/fundraisers/start"
              className="group inline-flex min-h-[50px] items-center gap-2 rounded-[10px] bg-teal px-6 text-[15.5px] font-semibold text-paper transition duration-200 ease-brand hover:-translate-y-px hover:bg-ink"
            >
              {FUNDRAISE.cta}
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
            </Link>
          }
        />

        {live.length > 0 && (
          <>
            <ul className={`mt-s4 grid gap-s2 sm:grid-cols-2 lg:mt-s5 lg:grid-cols-3 ${BREAKOUT}`}>
              {live.map((f, i) => (
                <li key={f.slug} className="h-full">
                  <Reveal variant="clip" delay={i * 80} className="h-full">
                    <FundraiserCard fundraiser={f} />
                  </Reveal>
                </li>
              ))}
            </ul>
            <Reveal delay={120}>
              <Link
                to="/fundraisers"
                className={`group mt-s3 inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-green transition-colors duration-200 ease-brand hover:text-ink ${BREAKOUT}`}
              >
                {FUNDRAISE.all}
                <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
          </>
        )}

        <div className={`mt-s5 rounded-2xl border border-line p-s3 sm:p-s4 lg:mt-s6 lg:p-[clamp(32px,3.2vw,52px)] ${BREAKOUT}`}>
          <Reveal variant="soft">
            <p className="font-script text-[clamp(24px,2.2vw,30px)] leading-none text-green">
              {FUNDRAISE.stepsEyebrow}
            </p>
            <h3 className="mt-2 font-display text-[clamp(22px,2vw,28px)] leading-tight tracking-[-0.02em]">
              {FUNDRAISE.stepsTitle}
            </h3>
          </Reveal>
          <FundraiseSteps className="mt-s4" />
        </div>
      </div>
    </section>
  )
}
