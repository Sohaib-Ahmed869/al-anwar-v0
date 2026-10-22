import type { ReactNode } from 'react'

import Reveal, { useInView } from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { BookOpen, Box, Calendar, HandHeart, Users, Van } from '../components/icons'
import { ROLES, STEPS, WHY } from '../components/volunteer-data'

/* ---------------------------------------------------------------------------
   /volunteer, sections 2 to 4: why volunteer, the roles, and how it goes.

   WHY: three of About's ruled cards with a script label, filling with the
   logo teal from the foot under a pointer (not links here, so no arrow).
   ROLES: four cards, each with an icon, a script label and two facts on a
   hairline at the foot (how long, what you need). The first two are the
   warehouse; the second two sit on a teal ground with the masjid watermark,
   because they are the rarer ask.
   HOW IT GOES: four outlined numerals that fill teal as the row scrolls in,
   the same as the Get involved volunteer steps.
--------------------------------------------------------------------------- */

const ICONS: Record<string, (p: { className?: string }) => ReactNode> = {
  heart: HandHeart,
  calendar: Calendar,
  users: Users,
  box: Box,
  van: Van,
  book: BookOpen,
}

export function VolunteerWhy() {
  return (
    <section aria-labelledby="why-head" className={SECTION_Y}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead id="why-head" eyebrow={WHY.eyebrow} title={WHY.title} lede={WHY.lede} />
        <ul className={`mt-s4 grid gap-s2 md:grid-cols-3 lg:mt-s5 ${BREAKOUT}`}>
          {WHY.items.map((item, i) => {
            const Icon = ICONS[item.icon]
            return (
              <li key={item.title} className="h-full">
                <Reveal variant="clip" delay={i * 90} className="h-full">
                  <article className="group relative isolate flex h-full flex-col overflow-hidden rounded-2xl border border-line p-s3 transition-[border-color,transform,box-shadow] duration-300 ease-brand hover:-translate-y-1 hover:border-teal hover:shadow-card sm:p-s4">
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 -z-10 origin-bottom scale-y-0 bg-teal transition-transform duration-500 ease-brand group-hover:scale-y-100"
                    />
                    <span
                      aria-hidden="true"
                      className="flex size-14 items-center justify-center rounded-full bg-teal/[0.08] text-teal transition-colors duration-300 group-hover:bg-paper/15 group-hover:text-gold-pale"
                    >
                      <Icon className="size-7" />
                    </span>
                    <p className="mt-s4 font-script text-[clamp(24px,2vw,30px)] leading-none text-green transition-colors duration-300 group-hover:text-gold-pale">
                      {item.kind}
                    </p>
                    <h3 className="mt-2 font-display text-[clamp(20px,1.8vw,24px)] leading-[1.18] tracking-[-0.018em] text-balance transition-colors duration-300 group-hover:text-paper">
                      {item.title}
                    </h3>
                    <p className="mt-s2 text-[15px] leading-relaxed text-text-2 transition-colors duration-300 group-hover:text-paper/80">
                      {item.body}
                    </p>
                  </article>
                </Reveal>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export function VolunteerRoles() {
  return (
    <section id="roles" aria-labelledby="roles-head" className={`scroll-mt-[calc(var(--header-h)+24px)] ${SECTION_Y}`}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead id="roles-head" eyebrow={ROLES.eyebrow} title={ROLES.title} lede={ROLES.lede} />
        <ul className={`mt-s4 grid gap-s2 sm:grid-cols-2 lg:mt-s5 lg:grid-cols-4 ${BREAKOUT}`}>
          {ROLES.items.map((role, i) => {
            const Icon = ICONS[role.icon]
            const skill = i >= 2
            return (
              <li key={role.id} className="h-full">
                <Reveal variant="clip" delay={i * 80} className="h-full">
                  <article
                    className={`relative isolate flex h-full flex-col overflow-hidden rounded-2xl p-s3 ${
                      skill ? 'bg-grad-lagoon-x text-paper' : 'border border-line'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex size-12 items-center justify-center rounded-full ${
                        skill ? 'bg-paper/15 text-gold-pale' : 'bg-teal/[0.08] text-teal'
                      }`}
                    >
                      <Icon className="size-6" />
                    </span>
                    <p
                      className={`mt-s3 font-script text-[clamp(21px,1.7vw,25px)] leading-none ${
                        skill ? 'text-gold-pale' : 'text-green'
                      }`}
                    >
                      {role.kind}
                    </p>
                    <h3 className="mt-2 font-display text-[clamp(21px,1.8vw,25px)] leading-tight tracking-[-0.018em]">
                      {role.title}
                    </h3>
                    <p className={`mt-s2 mb-s3 text-[14.5px] leading-relaxed ${skill ? 'text-paper/85' : 'text-text-2'}`}>
                      {role.body}
                    </p>
                    <dl
                      className={`mt-auto grid gap-2 border-t pt-s2 text-[13.5px] ${
                        skill ? 'border-paper/15' : 'border-line'
                      }`}
                    >
                      <div className="flex gap-2">
                        <dt className={`w-12 shrink-0 font-semibold ${skill ? 'text-paper/65' : 'text-text-3'}`}>Time</dt>
                        <dd>{role.time}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className={`w-12 shrink-0 font-semibold ${skill ? 'text-paper/65' : 'text-text-3'}`}>Needs</dt>
                        <dd>{role.needs}</dd>
                      </div>
                    </dl>
                  </article>
                </Reveal>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export function VolunteerSteps() {
  const [ref, shown] = useInView<HTMLOListElement>()
  return (
    <section aria-labelledby="steps-head" className={SECTION_Y}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead id="steps-head" eyebrow={STEPS.eyebrow} title={STEPS.title} />
        <ol ref={ref} className={`mt-s4 grid gap-s3 sm:grid-cols-2 lg:mt-s5 lg:grid-cols-4 lg:gap-s2 ${BREAKOUT}`}>
          {STEPS.items.map((step, i) => (
            <li key={step.title} className="border-t border-line pt-s3">
              <Reveal delay={i * 120}>
                <span
                  aria-hidden="true"
                  className={`nums block font-display text-[clamp(52px,4.6vw,72px)] leading-[0.8] font-semibold tracking-[-0.05em] transition-colors duration-700 ease-brand [-webkit-text-stroke:1.5px_var(--color-teal)] ${
                    shown ? 'text-teal' : 'text-transparent'
                  }`}
                  style={{ transitionDelay: `${400 + i * 350}ms` }}
                >
                  0{i + 1}
                </span>
                <p className="mt-s3 font-display text-[19px] leading-snug tracking-[-0.014em]">
                  {step.title}
                </p>
                <p className="mt-1.5 max-w-[30ch] text-[15px] leading-relaxed text-text-2">{step.body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
