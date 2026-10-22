import { Link } from 'react-router-dom'

import Reveal, { useInView } from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { ArrowRight, Box, Van } from '../components/icons'
import { VOLUNTEER, VOLUNTEER_COUNT } from '../components/involved-data'

/* ---------------------------------------------------------------------------
   Get involved, section 2 of 5: volunteer with us.

   Rebuilt 17 September 2026 on the home pattern. The user chose a warm
   headline over "Last year there were five of us", so the filed count now sits
   in the teal panel as a fact rather than as the hook. It is still read live
   from where-data.ts and still links to where it was filed.

   Beside the panel, the two roles as ruled cards with an icon. Under them,
   how a day goes: three steps with large outlined numerals, the same as
   About's values, that fill teal once the row scrolls in.
--------------------------------------------------------------------------- */

const ICONS = { box: Box, van: Van } as const

export default function InvolvedVolunteer() {
  const [dayRef, dayShown] = useInView<HTMLOListElement>()

  return (
    <section
      id="volunteer"
      aria-labelledby="volunteer-head"
      className={`scroll-mt-[calc(var(--header-h)+24px)] ${SECTION_Y}`}
    >
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="volunteer-head"
          eyebrow={VOLUNTEER.eyebrow}
          title={VOLUNTEER.title}
          lede={VOLUNTEER.lede}
          action={
            <Link
              to="/volunteer"
              className="group inline-flex min-h-[50px] items-center gap-2 rounded-[10px] bg-teal px-6 text-[15.5px] font-semibold text-paper transition duration-200 ease-brand hover:-translate-y-px hover:bg-ink"
            >
              {VOLUNTEER.cta}
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
            </Link>
          }
        />

        <div
          className={`mt-s4 grid gap-s2 lg:mt-s5 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] ${BREAKOUT}`}
        >
          {/* The filed count, as a fact in the logo teal. */}
          <Reveal variant="clip" className="h-full">
            <div className="flex h-full flex-col justify-between gap-s4 rounded-2xl bg-teal p-s3 text-paper sm:p-s4 lg:p-[clamp(32px,3.2vw,48px)]">
              <p className="font-script text-[clamp(24px,2.2vw,32px)] leading-none text-gold-pale">
                Small, and real
              </p>
              <div>
                <p className="nums font-display text-[clamp(72px,8vw,120px)] leading-[0.85] tracking-[-0.05em]">
                  {VOLUNTEER_COUNT}
                </p>
                <p className="mt-s2 max-w-[28ch] text-[15.5px] leading-[1.5] text-paper/85">
                  {VOLUNTEER.countLabel}
                </p>
                <Link
                  to="/where-it-goes#accounts"
                  className="group mt-s2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-gold-pale underline decoration-gold-pale/35 underline-offset-4 transition-colors duration-200 hover:decoration-gold-pale"
                >
                  Where that number is filed
                  <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </Reveal>

          <div className="grid gap-s2 md:grid-cols-2">
            {VOLUNTEER.roles.map((role, i) => {
              const Icon = ICONS[role.icon as keyof typeof ICONS]
              return (
                <Reveal key={role.kind} variant="clip" delay={90 + i * 90} className="h-full">
                  <article className="flex h-full flex-col rounded-2xl border border-line p-s3 sm:p-s4">
                    <span
                      aria-hidden="true"
                      className="flex size-14 items-center justify-center rounded-full bg-teal/[0.08] text-teal"
                    >
                      <Icon className="size-7" />
                    </span>
                    <p className="mt-s4 font-script text-[clamp(24px,2vw,30px)] leading-none text-green">
                      {role.kind}
                    </p>
                    <h3 className="mt-2 font-display text-[clamp(22px,2vw,28px)] leading-[1.15] tracking-[-0.02em] text-balance">
                      {role.title}
                    </h3>
                    <p className="mt-s2 text-[15px] leading-relaxed text-text-2">{role.body}</p>
                  </article>
                </Reveal>
              )
            })}
          </div>
        </div>

        {/* How a day goes. */}
        <div className={`mt-s5 lg:mt-s6 ${BREAKOUT}`}>
          <Reveal variant="soft">
            <h3 className="font-display text-[clamp(22px,2vw,28px)] leading-tight tracking-[-0.02em]">
              {VOLUNTEER.dayTitle}
            </h3>
          </Reveal>
          <ol ref={dayRef} className="mt-s3 grid gap-s3 md:grid-cols-3 md:gap-s2">
            {VOLUNTEER.day.map((step, i) => (
              <li key={step.title} className="border-t border-line pt-s3">
                <Reveal delay={i * 120}>
                  <span
                    aria-hidden="true"
                    className={`nums block font-display text-[clamp(52px,4.6vw,72px)] leading-[0.8] font-semibold tracking-[-0.05em] transition-colors duration-700 ease-brand [-webkit-text-stroke:1.5px_var(--color-teal)] ${
                      dayShown ? 'text-teal' : 'text-transparent'
                    }`}
                    style={{ transitionDelay: `${400 + i * 350}ms` }}
                  >
                    0{i + 1}
                  </span>
                  <p className="mt-s3 font-display text-[19px] leading-snug tracking-[-0.014em]">
                    {step.title}
                  </p>
                  <p className="mt-1.5 max-w-[34ch] text-[15px] leading-relaxed text-text-2">
                    {step.body}
                  </p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
