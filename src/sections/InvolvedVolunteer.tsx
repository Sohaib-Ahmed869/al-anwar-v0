import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import { ArrowRight } from '../components/icons'
import { VOLUNTEER, VOLUNTEER_COUNT } from '../components/involved-data'

/* ---------------------------------------------------------------------------
   Get involved, section 2 of 7: volunteer with us.

   THE HEADLINE IS THE SMALL NUMBER, AND IT IS A FILED ONE
   Five people volunteered in the most recent year we lodged a statement for.
   It is read live out of where-data.ts rather than typed here, so it cannot
   disagree with the table on the accountability page and it updates itself the
   year a new statement lands. Every other charity page of this kind opens by
   implying a movement. Opening on a number this small is the stronger move and
   the honest one: somebody who turns up is not a rounding error in an
   operation, they are a sixth of it, and the sentence under the heading says
   so without asking for pity about it.

   TWO ROLES, NOT EIGHT — see involved-data.ts. The warehouse needs packers and
   it needs drivers, and a list of eight roles it cannot fill would read as a
   wishlist. They are set as two wide rows rather than a grid of cards, because
   two cards side by side look like the first two of four that did not load.

   WHAT A DAY IS, as a numbered list. The third step is the one these pages
   almost always leave out — being told where the run went — and it is the
   reason somebody comes back a second time, so it is not buried.
--------------------------------------------------------------------------- */

export default function InvolvedVolunteer() {
  return (
    <section
      id="volunteer"
      aria-labelledby="volunteer-head"
      className="scroll-mt-[calc(var(--header-h)+24px)] bg-paper py-s5 lg:py-s6"
    >
      <div className="gutter mx-auto max-w-page">
        <div className="grid gap-s4 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-s5">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+40px)] lg:self-start">
            <p className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.16em] text-green uppercase">
              <span aria-hidden="true" className="h-px w-6 bg-green/40" />
              {VOLUNTEER.eyebrow}
            </p>
            <h2
              id="volunteer-head"
              className="mt-s1 max-w-[15ch] font-display text-[clamp(28px,3.4vw,42px)] leading-[1.08] tracking-[-0.02em] text-balance"
            >
              Last year there were{' '}
              <span className="nums">{VOLUNTEER_COUNT}</span> of us
            </h2>
            <p className="mt-s2 max-w-measure text-[15.5px] leading-relaxed text-text-2">
              {VOLUNTEER.body}
            </p>
            <Link
              to="/where-it-goes#accounts"
              className="group mt-s2 inline-flex items-center gap-2 text-[14px] font-semibold text-green transition-colors duration-200 ease-brand hover:text-ink"
            >
              That number, and every other one we file
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 ease-brand group-hover:translate-x-1" />
            </Link>
          </div>

          <div>
            {VOLUNTEER.roles.map((role, i) => (
              <Reveal key={role.kind} delay={i * 70}>
                <article className="border-t border-line py-s3">
                  <p className="text-[11px] font-semibold tracking-[0.13em] text-text-3 uppercase">
                    {role.kind}
                  </p>
                  <h3 className="mt-1.5 font-display text-[clamp(20px,1.9vw,25px)] leading-tight tracking-[-0.018em]">
                    {role.title}
                  </h3>
                  <p className="mt-s1 max-w-measure text-[15px] leading-relaxed text-text-2">
                    {role.body}
                  </p>
                </article>
              </Reveal>
            ))}

            {/* What actually happens, so nobody arrives not knowing. */}
            <Reveal delay={140}>
              <div className="mt-s3 rounded-2xl border border-line bg-paper-2 p-s3 sm:p-s4">
                <h3 className="text-[11px] font-semibold tracking-[0.13em] text-text-3 uppercase">
                  How it goes
                </h3>
                <ol className="mt-s2 grid gap-s2">
                  {VOLUNTEER.day.map((step, i) => (
                    <li key={step} className="flex gap-s2">
                      <span
                        aria-hidden="true"
                        className="nums mt-[3px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green/10 text-[12px] font-semibold text-green"
                      >
                        {i + 1}
                      </span>
                      <p className="max-w-measure text-[15px] leading-relaxed text-text-2">{step}</p>
                    </li>
                  ))}
                </ol>

                <Link
                  to="/contact?topic=Volunteering"
                  className="group mt-s3 inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-[12px] border border-ink/15 bg-paper px-6 text-[15px] font-semibold text-text transition-[border-color,background-color] duration-200 ease-brand hover:border-ink hover:bg-paper"
                >
                  {VOLUNTEER.cta}
                  <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}
