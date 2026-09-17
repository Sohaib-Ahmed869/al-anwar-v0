import { useId, useState, type ReactNode } from 'react'

import FaqList from '../components/FaqList'
import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { MasjidMark } from '../components/Ornament'
import { ArrowRight, Check, Mail, Phone } from '../components/icons'
import { APPLY, FAQ, ROLES } from '../components/volunteer-data'
import { ORG } from '../components/org-data'
import { PHONE } from '../components/nav-data'
import {
  EMPTY_APPLICATION,
  submitApplication,
  validateApplication,
  type Application,
  type ApplicationErrors,
} from '../services/volunteer'

/* ---------------------------------------------------------------------------
   /volunteer, sections 5 and 6: the application, and the questions.

   THE APPLICATION (#apply) is the Contact form section's layout: a ruled
   paper card with the form, and beside it the teal panel with the masjid
   watermark saying what happens next and how to ask first. Fields are the
   Contact form's underlined ones; the roles and the times are chips.

   It goes nowhere on its own (services/volunteer.ts): Send opens the
   applicant's email with the application written out, and the card is
   replaced by a note saying exactly that, never a tick that implies it
   arrived. "Edit my application" brings the form back with everything kept.

   THE QUESTIONS are the shared FaqList beside a SectionHead.
--------------------------------------------------------------------------- */

const LABEL = 'block text-[11px] font-semibold tracking-[0.13em] text-text-3 uppercase'
const FIELD =
  'peer block w-full border-b border-line bg-transparent py-2 text-[15.5px] text-text placeholder:text-text-3 transition-colors duration-200 focus:outline-none focus-visible:outline-none'

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="relative">
        {children}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left transition-transform duration-300 ease-brand ${
            error ? 'scale-x-100 bg-alert' : 'scale-x-0 bg-teal peer-focus:scale-x-100'
          }`}
        />
      </div>
      {hint && !error && <p className="mt-1 text-[13px] text-text-3">{hint}</p>}
      {error && <p className="mt-1 text-[13px] text-alert">{error}</p>}
    </div>
  )
}

export function VolunteerApply() {
  const uid = useId()
  const F = APPLY.form
  const [a, setA] = useState<Application>(EMPTY_APPLICATION)
  const [errors, setErrors] = useState<ApplicationErrors>({})
  const [sent, setSent] = useState<'no' | 'mail' | 'endpoint'>('no')
  const [failed, setFailed] = useState(false)

  const set = <K extends keyof Application>(k: K, v: Application[K]) => {
    setA((prev) => ({ ...prev, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const toggle = (k: 'roles' | 'when', v: string) =>
    set(k, a[k].includes(v) ? a[k].filter((x) => x !== v) : [...a[k], v])

  const send = async () => {
    const bad = validateApplication(a)
    if (Object.keys(bad).length) {
      setErrors(bad)
      document.querySelector<HTMLElement>(`[data-bad="true"]`)?.scrollIntoView({ block: 'center' })
      return
    }
    const result = await submitApplication(a)
    if (result === 'failed') setFailed(true)
    else setSent(result)
  }

  const chip = (on: boolean) =>
    `inline-flex min-h-[42px] items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold transition-colors duration-200 ease-brand ${
      on ? 'bg-teal text-paper' : 'border border-line text-text-2 hover:border-teal hover:text-teal'
    }`

  const input = (k: keyof ApplicationErrors) => `${FIELD} ${errors[k] ? 'border-alert' : ''}`

  return (
    <section id="apply" aria-labelledby="apply-head" className={`scroll-mt-[calc(var(--header-h)+24px)] ${SECTION_Y}`}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead id="apply-head" eyebrow={APPLY.eyebrow} title={APPLY.title} lede={APPLY.lede} />

        <div className={`mt-s4 grid gap-s2 lg:mt-s5 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] ${BREAKOUT}`}>
          {/* --- the form, or what happened to it --- */}
          <Reveal variant="clip" className="h-full">
            <div className="h-full rounded-2xl border border-line bg-paper p-s3 sm:p-s4 lg:p-[clamp(32px,3.2vw,52px)]">
              {sent !== 'no' ? (
                <div role="status" style={{ animation: 'hero-rise 620ms var(--ease-brand) both' }}>
                  <span className="inline-flex size-12 items-center justify-center rounded-full bg-teal text-paper">
                    <Mail className="h-5 w-5" />
                  </span>
                  <p className="mt-s3 font-display text-[clamp(24px,2.2vw,30px)] leading-snug font-semibold tracking-[-0.02em]">
                    {APPLY.handedOff.title}
                  </p>
                  <p className="mt-s2 max-w-[56ch] text-[15.5px] leading-relaxed text-text-2">
                    {APPLY.handedOff.body}{' '}
                    <a href={`mailto:${ORG.email}`} className="text-green underline underline-offset-4">
                      {ORG.email}
                    </a>
                    .
                  </p>
                  <button
                    type="button"
                    onClick={() => setSent('no')}
                    className="group mt-s4 inline-flex min-h-[48px] items-center gap-2 rounded-[10px] border border-ink/15 px-5 text-[15px] font-semibold transition-colors duration-200 ease-brand hover:border-ink"
                  >
                    {APPLY.handedOff.again}
                  </button>
                </div>
              ) : (
                <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault()
                    send()
                  }}
                  className="grid gap-s4"
                >
                  <div className="grid gap-s4 sm:grid-cols-2">
                    <div data-bad={!!errors.first}>
                      <Field id={`${uid}-first`} label={F.first} error={errors.first}>
                        <input id={`${uid}-first`} type="text" autoComplete="given-name" value={a.first} onChange={(e) => set('first', e.target.value)} aria-invalid={errors.first ? 'true' : undefined} className={input('first')} />
                      </Field>
                    </div>
                    <div data-bad={!!errors.last}>
                      <Field id={`${uid}-last`} label={F.last} error={errors.last}>
                        <input id={`${uid}-last`} type="text" autoComplete="family-name" value={a.last} onChange={(e) => set('last', e.target.value)} aria-invalid={errors.last ? 'true' : undefined} className={input('last')} />
                      </Field>
                    </div>
                    <div data-bad={!!errors.email}>
                      <Field id={`${uid}-email`} label={F.email} error={errors.email}>
                        <input id={`${uid}-email`} type="email" autoComplete="email" value={a.email} onChange={(e) => set('email', e.target.value)} aria-invalid={errors.email ? 'true' : undefined} className={input('email')} />
                      </Field>
                    </div>
                    <div data-bad={!!errors.phone}>
                      <Field id={`${uid}-phone`} label={F.phone} hint={F.phoneHint} error={errors.phone}>
                        <input id={`${uid}-phone`} type="tel" inputMode="tel" autoComplete="tel" value={a.phone} onChange={(e) => set('phone', e.target.value)} aria-invalid={errors.phone ? 'true' : undefined} className={input('phone')} />
                      </Field>
                    </div>
                    <div className="sm:col-span-2 sm:max-w-[50%] sm:pr-s2">
                      <Field id={`${uid}-suburb`} label={F.suburb}>
                        <input id={`${uid}-suburb`} type="text" autoComplete="address-level2" value={a.suburb} onChange={(e) => set('suburb', e.target.value)} className={FIELD} />
                      </Field>
                    </div>
                  </div>

                  <fieldset data-bad={!!errors.roles}>
                    <legend className={LABEL}>{F.roles}</legend>
                    <p className="mt-1 text-[13px] text-text-3">{F.rolesHint}</p>
                    <div className="mt-s2 flex flex-wrap gap-2">
                      {ROLES.items.map((r) => {
                        const on = a.roles.includes(r.id)
                        return (
                          <button key={r.id} type="button" aria-pressed={on} onClick={() => toggle('roles', r.id)} className={chip(on)}>
                            {on && <Check className="h-3.5 w-3.5" />}
                            {r.title}
                          </button>
                        )
                      })}
                    </div>
                    {errors.roles && <p className="mt-1.5 text-[13px] text-alert">{errors.roles}</p>}
                  </fieldset>

                  <fieldset data-bad={!!errors.when}>
                    <legend className={LABEL}>{F.when}</legend>
                    <div className="mt-s2 flex flex-wrap gap-2">
                      {F.whenOptions.map((w) => {
                        const on = a.when.includes(w)
                        return (
                          <button key={w} type="button" aria-pressed={on} onClick={() => toggle('when', w)} className={chip(on)}>
                            {on && <Check className="h-3.5 w-3.5" />}
                            {w}
                          </button>
                        )
                      })}
                    </div>
                    {errors.when && <p className="mt-1.5 text-[13px] text-alert">{errors.when}</p>}
                  </fieldset>

                  <Field id={`${uid}-note`} label={F.note}>
                    <textarea id={`${uid}-note`} rows={4} value={a.note} placeholder={F.notePlaceholder} onChange={(e) => set('note', e.target.value)} className={`${FIELD} resize-y leading-relaxed`} />
                  </Field>

                  <div data-bad={!!errors.consent}>
                    <label className="flex cursor-pointer items-start gap-s1 text-[14.5px] leading-relaxed text-text-2">
                      <input type="checkbox" checked={a.consent} onChange={(e) => set('consent', e.target.checked)} aria-invalid={errors.consent ? 'true' : undefined} className="mt-[3px] h-[17px] w-[17px] shrink-0 accent-teal" />
                      <span>{F.consent}</span>
                    </label>
                    {errors.consent && <p className="mt-1 text-[13px] text-alert">{errors.consent}</p>}
                  </div>

                  {failed && (
                    <p role="alert" className="rounded-xl bg-alert/10 p-s2 text-[14.5px] text-alert">
                      That did not go through. Please try again, or write to {ORG.email}.
                    </p>
                  )}

                  <div className="border-t border-line pt-s3">
                    <button
                      type="submit"
                      className="group inline-flex min-h-[52px] items-center gap-2.5 rounded-[10px] bg-teal px-s3 text-[15.5px] font-semibold text-paper transition duration-200 ease-brand hover:-translate-y-px hover:bg-ink"
                    >
                      {F.submit}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </form>
              )}
            </div>
          </Reveal>

          {/* --- what happens next --- */}
          <Reveal variant="clip" delay={90} className="h-full">
            <aside className="relative isolate flex h-full flex-col overflow-hidden rounded-2xl bg-teal p-s3 text-paper sm:p-s4 lg:p-[clamp(32px,3.2vw,48px)]">
              <MasjidMark className="pointer-events-none absolute -right-[6%] -bottom-[8%] -z-10 size-[clamp(200px,22vw,320px)] text-paper/[0.07]" />
              <p className="font-script text-[clamp(24px,2.2vw,30px)] leading-none text-gold-pale">{APPLY.panel.eyebrow}</p>
              <h3 className="mt-2 font-display text-[clamp(22px,2vw,28px)] leading-[1.15] font-semibold tracking-[-0.02em]">
                {APPLY.panel.title}
              </h3>
              <ul className="mt-s3 grid gap-s2">
                {APPLY.panel.points.map((p) => (
                  <li key={p} className="flex gap-s2 border-t border-paper/15 pt-s2 text-[15px] leading-snug text-paper/90">
                    <span aria-hidden="true" className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gold-pale text-ink">
                      <Check className="size-3" />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>

              <div className="mt-s4 border-t border-paper/15 pt-s3 lg:mt-auto">
                <p className="text-[13px] font-semibold text-paper/70">{APPLY.panel.ask}</p>
                <a href={`mailto:${ORG.email}`} className="mt-2 flex items-center gap-2 text-[15px] font-semibold hover:text-gold-pale">
                  <Mail className="h-4 w-4" />
                  {ORG.email}
                </a>
                <a href={PHONE.href} className="nums mt-2 flex items-center gap-2 text-[15px] font-semibold hover:text-gold-pale">
                  <Phone className="h-4 w-4" />
                  {PHONE.label}
                </a>
              </div>
            </aside>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

export function VolunteerFaq() {
  return (
    <section aria-labelledby="faq-head" className={`pt-0 ${SECTION_Y.replace('py-', 'pb-')}`}>
      <div className="gutter mx-auto max-w-page">
        <div className={`grid gap-s4 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-s5 ${BREAKOUT}`}>
          <div className="[&>div]:mx-0">
            <SectionHead id="faq-head" eyebrow={FAQ.eyebrow} title={FAQ.title} className="lg:!mx-0" />
          </div>
          <Reveal>
            <FaqList items={FAQ.items} />
          </Reveal>
        </div>
      </div>
    </section>
  )
}
