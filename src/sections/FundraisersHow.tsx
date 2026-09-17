import { Link } from 'react-router-dom'

import Reveal, { useInView } from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { MasjidMark } from '../components/Ornament'
import { LISTING } from '../components/fundraiser-data'
import { ArrowRight } from '../components/icons'

/* ---------------------------------------------------------------------------
   How starting a fundraiser works, and the ask to start one.

   Used at the foot of /fundraisers, and the steps half is also used by the Get
   involved page's #fundraise section (`steps` only). The timeline is the one
   that section had before: numbered dots on a hairline that draws across once
   the row scrolls in, upright on a phone. The close is About's teal panel with
   a paper button, because starting a fundraiser is not itself a gift.
--------------------------------------------------------------------------- */

export function FundraiseSteps({ className = '' }: { className?: string }) {
  const [ref, shown] = useInView<HTMLOListElement>()
  return (
    <ol ref={ref} className={`relative grid gap-s3 md:grid-cols-4 md:gap-s2 ${className}`}>
      <span
        aria-hidden="true"
        className={`absolute top-5 right-[12.5%] left-[12.5%] hidden h-px origin-left bg-teal/40 transition-transform duration-[1400ms] ease-brand md:block ${
          shown ? 'scale-x-100' : 'scale-x-0'
        }`}
      />
      <span
        aria-hidden="true"
        className={`absolute top-5 bottom-5 left-5 w-px origin-top bg-teal/40 transition-transform duration-[1400ms] ease-brand md:hidden ${
          shown ? 'scale-y-100' : 'scale-y-0'
        }`}
      />
      {LISTING.how.steps.map((step, i) => (
        <li key={step.title} className="relative flex gap-s2 md:flex-col md:items-center md:text-center">
          <span
            aria-hidden="true"
            className={`nums relative flex size-10 shrink-0 items-center justify-center rounded-full border text-[15px] font-semibold transition-[background-color,color,border-color] duration-500 ease-brand ${
              shown ? 'border-teal bg-teal text-paper' : 'border-line bg-ground text-text-3'
            }`}
            style={{ transitionDelay: `${200 + i * 300}ms` }}
          >
            {i + 1}
          </span>
          <div className="md:mt-s2">
            <p className="font-display text-[18px] leading-snug font-semibold tracking-[-0.012em]">
              {step.title}
            </p>
            <p className="mt-1 max-w-[30ch] text-[14.5px] leading-relaxed text-text-2">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function FundraisersHow() {
  return (
    <section aria-labelledby="how-head" className={`pt-0 ${SECTION_Y.replace('py-', 'pb-')}`}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead id="how-head" eyebrow={LISTING.how.eyebrow} title={LISTING.how.title} />
        <FundraiseSteps className={`mt-s4 lg:mt-s5 ${BREAKOUT}`} />

        <Reveal variant="clip" className={`mt-s5 block lg:mt-s6 ${BREAKOUT}`}>
          <div className="relative isolate flex flex-col gap-s4 overflow-hidden rounded-2xl bg-teal p-s3 text-paper sm:p-s4 md:flex-row md:items-center md:justify-between lg:p-[clamp(40px,4vw,64px)]">
            <MasjidMark className="pointer-events-none absolute -right-[4%] -bottom-[18%] -z-10 size-[clamp(200px,22vw,320px)] text-paper/[0.07]" />
            <div>
              <p className="font-script text-[clamp(24px,2.2vw,32px)] leading-none text-gold-pale">
                {LISTING.close.eyebrow}
              </p>
              <h2 className="mt-2 font-display text-[clamp(28px,3.2vw,44px)] leading-[1.08] font-semibold tracking-[-0.025em] text-balance">
                {LISTING.close.title}
              </h2>
              <p className="mt-s2 max-w-[52ch] text-[15.5px] leading-[1.55] text-paper/85">
                {LISTING.close.body}
              </p>
            </div>
            <Link
              to="/fundraisers/start"
              className="group inline-flex min-h-[52px] shrink-0 items-center gap-2 self-start rounded-[10px] bg-paper px-6 text-[15.5px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-gold-pale md:self-auto"
            >
              {LISTING.hero.start}
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
