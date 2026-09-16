import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import { ArrowRight } from '../components/icons'
import { CORPORATE } from '../components/involved-data'

/* ---------------------------------------------------------------------------
   Get involved, section 5 of 7: corporate & workplace giving.

   WE ARE NOT A WORKPLACE GIVING PROVIDER, AND THE SECTION IS BUILT NOT TO
   IMPLY THAT WE ARE
   Payroll giving and matched giving are run by the employer. We do not
   administer either, we are not on anybody's approved provider list, and a
   section written in the usual corporate-partnership language would suggest
   all three. So the shape is inverted: instead of asking a company for
   something, it hands the reader the three facts their own finance team will
   ask us for, phrased so the whole section can be forwarded in an email.

   All three are verifiable on a public register, which is the point — the
   reasoning lives in involved-data.ts, along with the requirement that the ABN
   and the endorsement here agree with org-data.ts.

   THE THIRD FACT IS THE PERSUASIVE ONE and it is placed last for that reason:
   employee expenses have been zero in every year filed. It is the kind of
   claim that is normally made as a slogan; here it links to the statements it
   came off, because on this site it is not a slogan, it is a row in a table.

   TODO — the team packing morning at the foot has never happened. It is
   plausible, it is within our means, and it is not confirmed. See
   involved-data.ts before this goes live.
--------------------------------------------------------------------------- */

export default function InvolvedCorporate() {
  return (
    <section
      id="corporate"
      aria-labelledby="corporate-head"
      className="scroll-mt-[calc(var(--header-h)+24px)] bg-paper py-s5 lg:py-s6"
    >
      <div className="gutter mx-auto max-w-page">
        <div className="grid gap-s4 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-s5">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+40px)] lg:self-start">
            <p className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.16em] text-green uppercase">
              <span aria-hidden="true" className="h-px w-6 bg-green/40" />
              {CORPORATE.eyebrow}
            </p>
            <h2
              id="corporate-head"
              className="mt-s1 max-w-[16ch] font-display text-[clamp(28px,3.4vw,42px)] leading-[1.08] tracking-[-0.02em] text-balance"
            >
              {CORPORATE.title}
            </h2>
            <p className="mt-s2 max-w-measure text-[15.5px] leading-relaxed text-text-2">
              {CORPORATE.body}
            </p>
          </div>

          <div>
            {/* Written to be forwarded. Three facts, each one checkable. */}
            <dl>
              {CORPORATE.facts.map((fact, i) => (
                <Reveal key={fact.title} delay={i * 70}>
                  <div className="border-t border-line py-s3">
                    <dt className="font-display text-[clamp(19px,1.8vw,23px)] leading-snug tracking-[-0.014em]">
                      {fact.title}
                    </dt>
                    <dd className="mt-1.5 max-w-measure text-[15px] leading-relaxed text-text-2">
                      {fact.body}
                    </dd>
                  </div>
                </Reveal>
              ))}
            </dl>

            <Reveal delay={210}>
              <div className="flex flex-wrap items-center gap-s2 border-t border-line pt-s3">
                <Link
                  to="/contact?topic=Partnership%20or%20media"
                  className="group inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-[12px] border border-ink/15 px-6 text-[15px] font-semibold text-text transition-[border-color,background-color] duration-200 ease-brand hover:border-ink hover:bg-paper-2"
                >
                  {CORPORATE.cta}
                  <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                </Link>

                <Link
                  to="/where-it-goes#accounts"
                  className="text-[14px] font-semibold text-green underline decoration-green/30 underline-offset-4 transition-colors duration-200 ease-brand hover:text-ink hover:decoration-ink/40"
                >
                  The statements those facts come off
                </Link>
              </div>
            </Reveal>

            {/* The one thing we would ask a company for that is not money. */}
            <Reveal delay={260}>
              <div className="mt-s4 rounded-2xl border border-line bg-paper-2 p-s3 sm:p-s4">
                <h3 className="font-display text-[clamp(19px,1.8vw,23px)] leading-snug tracking-[-0.014em]">
                  {CORPORATE.team.title}
                </h3>
                <p className="mt-1.5 max-w-measure text-[15px] leading-relaxed text-text-2">
                  {CORPORATE.team.body}
                </p>
                <a
                  href="#volunteer"
                  className="group mt-s2 inline-flex items-center gap-2 text-[14px] font-semibold text-green transition-colors duration-200 ease-brand hover:text-ink"
                >
                  What a packing morning is
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 ease-brand group-hover:translate-x-1" />
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}
