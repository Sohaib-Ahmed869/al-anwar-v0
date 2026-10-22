import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { ArrowRight, Check } from '../components/icons'
import { PARTNERS } from '../components/involved-data'

/* ---------------------------------------------------------------------------
   Get involved, section 4 of 5: mosque & school partnerships.

   Rebuilt 17 September 2026 on the AppealsNotSure pairing: what a mosque or
   school gives sits in a plain ruled panel, what it gets back sits in the
   logo teal with the masjid watermark. The two are the same width, because
   it is an exchange between equals; the teal is what makes the second one
   the side the eye lands on, and the report back is its last line.

   No count of partners appears, because nobody has a list.
--------------------------------------------------------------------------- */

export default function InvolvedPartners() {
  return (
    <section
      id="partners"
      aria-labelledby="partners-head"
      className={`scroll-mt-[calc(var(--header-h)+24px)] ${SECTION_Y}`}
    >
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="partners-head"
          eyebrow={PARTNERS.eyebrow}
          title={PARTNERS.title}
          lede={PARTNERS.lede}
        />

        <div className={`mt-s4 grid gap-s2 lg:mt-s5 md:grid-cols-2 ${BREAKOUT}`}>
          <Reveal variant="clip" className="h-full">
            <div className="flex h-full flex-col rounded-2xl border border-line p-s3 sm:p-s4 lg:p-[clamp(32px,3.2vw,52px)]">
              <p className="font-script text-[clamp(26px,2.4vw,36px)] leading-none text-green">
                {PARTNERS.give.kind}
              </p>
              <h3 className="mt-2 font-display text-[clamp(24px,2.3vw,32px)] leading-[1.1] tracking-[-0.02em] text-balance">
                {PARTNERS.give.title}
              </h3>
              <ul className="mt-s4 grid gap-s2">
                {PARTNERS.give.items.map((item, i) => (
                  <li key={item} className="flex gap-s2 border-t border-line pt-s2">
                    <span
                      aria-hidden="true"
                      className="nums mt-px w-6 shrink-0 font-display text-[15px] text-teal"
                    >
                      0{i + 1}
                    </span>
                    <p className="text-[15.5px] leading-relaxed text-text-2">{item}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal variant="clip" delay={90} className="h-full">
            <div className="relative isolate flex h-full flex-col overflow-hidden rounded-2xl bg-grad-lagoon-x p-s3 text-paper sm:p-s4 lg:p-[clamp(32px,3.2vw,52px)]">
              <p className="font-script text-[clamp(26px,2.4vw,36px)] leading-none text-gold-pale">
                {PARTNERS.get.kind}
              </p>
              <h3 className="mt-2 font-display text-[clamp(24px,2.3vw,32px)] leading-[1.1] tracking-[-0.02em] text-balance">
                {PARTNERS.get.title}
              </h3>
              <ul className="mt-s4 grid gap-s2">
                {PARTNERS.get.items.map((item) => (
                  <li key={item} className="flex gap-s2 border-t border-paper/15 pt-s2">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-gold-pale text-ink"
                    >
                      <Check className="size-3.5" />
                    </span>
                    <p className="text-[15.5px] leading-relaxed text-paper/90">{item}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <Reveal delay={140}>
          <div className={`mt-s3 flex flex-wrap items-center gap-x-s3 gap-y-s2 ${BREAKOUT}`}>
            <Link
              to="/become-a-partner?type=community"
              className="group inline-flex min-h-[50px] items-center gap-2 rounded-[10px] bg-teal px-6 text-[15.5px] font-semibold text-paper transition duration-200 ease-brand hover:-translate-y-px hover:bg-ink"
            >
              {PARTNERS.cta}
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/partners"
              className="text-[14.5px] font-semibold text-green underline decoration-green/30 underline-offset-4 transition-colors duration-200 ease-brand hover:text-ink hover:decoration-ink/40"
            >
              {PARTNERS.proof}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
