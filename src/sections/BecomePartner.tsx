import { useId, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import Reveal, { useInView } from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { BrandGlyph } from '../components/Ornament'
import { ArrowRight, Box, Building, Check, Globe, Mail, Phone } from '../components/icons'
import { BECOME, PARTNER_TYPES } from '../components/partners-data'
import { ORG } from '../components/org-data'
import { PHONE } from '../components/nav-data'
import {
  emptyEnquiry,
  submitEnquiry,
  validateEnquiry,
  type Enquiry,
  type EnquiryErrors,
} from '../services/partner'

/* ---------------------------------------------------------------------------
   /become-a-partner, all four sections. Words in partners-data.ts (BECOME).

   1. BecomeHero .... Contact's teal duotone hero, with the reference's own
                      photo (licence in partners-data.ts); "Start your
                      enquiry" scrolls to the form.
   2. BecomeExpect .. four outlined numerals: what a partnership looks like.
   3. BecomeTrade ... what you bring (ruled panel) against what you get back
                      (teal panel), the Get involved partnership pairing.
   4. BecomeForm .... #enquiry. The partnership type as four picture-less
                      cards (?type= from /partners chooses one), the fields,
                      and a teal panel of the facts a partner checks first.
                      No server: Send opens the sender's email and says so.
--------------------------------------------------------------------------- */

const ICONS: Record<string, (p: { className?: string }) => ReactNode> = {
  masjid: BrandGlyph,
  building: Building,
  box: Box,
  globe: Globe,
}

const LABEL = 'block text-[11px] font-semibold tracking-[0.13em] text-text-3 uppercase'
const FIELD =
  'peer block w-full border-b border-line bg-transparent py-2 text-[15.5px] text-text placeholder:text-text-3 transition-colors duration-200 focus:outline-none focus-visible:outline-none'

const SCREEN = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.22) 0.6px, transparent 0.9px)',
  backgroundSize: '3px 3px',
}

const rise = (ms: number) => ({ animation: `hero-soft 1000ms var(--ease-reveal) ${ms}ms both` })

export function BecomeHero() {
  const H = BECOME.hero
  const toForm = () =>
    document.getElementById('enquiry')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })

  return (
    <section
      data-overlay-hero=""
      aria-labelledby="become-title"
      className="relative isolate mt-[calc(var(--header-h)*-1)] overflow-hidden bg-grad-deep-x"
    >
      <div aria-hidden="true" className="absolute inset-0">
        <img
          src="/assets/images/hero-partners-2400.jpg"
          srcSet="/assets/images/hero-partners-1200.jpg 1200w, /assets/images/hero-partners-2400.jpg 2400w"
          sizes="100vw"
          alt=""
          width={2400}
          height={1600}
          decoding="sync"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover grayscale brightness-[0.9] contrast-[1.1]"
          style={{ objectPosition: '50% 40%', animation: 'hero-zoom 24s linear both' }}
        />
        <div className="absolute inset-0 bg-teal/[0.7]" />
        <div className="absolute inset-y-0 left-0 hidden w-[42%] border-r border-paper/15 bg-paper/[0.06] md:block" />
        <div className="absolute inset-0 opacity-70" style={SCREEN} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(8,38,42,0.45)_100%)]" />
      </div>

      <div className="relative gutter mx-auto flex min-h-[clamp(520px,78svh,800px)] max-w-page flex-col justify-end pt-[calc(var(--header-h)+40px)] pb-[clamp(36px,6vh,64px)]">
        <div className="flex flex-col gap-s4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-script text-[clamp(24px,2.2vw,32px)] leading-none text-gold-pale" style={rise(60)}>
              {H.eyebrow}
            </p>
            <h1
              id="become-title"
              className="mt-s2 font-display text-[clamp(40px,5.6vw,84px)] leading-[0.98] tracking-[-0.04em] text-paper [text-shadow:0_2px_30px_rgba(8,38,42,0.35)]"
              style={rise(140)}
            >
              <span className="block">{H.titleLead}</span>
              <span className="block text-gold-pale">{H.titleMark}</span>
            </h1>
            <p
              className="mt-s3 max-w-[50ch] text-[clamp(15.5px,1.25vw,18px)] leading-[1.55] text-pretty text-paper/90"
              style={rise(320)}
            >
              {H.intro}
            </p>
          </div>
          <div className="shrink-0" style={rise(480)}>
            <button
              type="button"
              onClick={toForm}
              className="group inline-flex min-h-[44px] items-center gap-3 font-display text-[clamp(18px,1.5vw,22px)] tracking-[-0.015em] text-paper transition-colors duration-200 ease-brand hover:text-gold-pale"
            >
              {H.start}
              <span
                aria-hidden="true"
                className="flex size-10 items-center justify-center rounded-full border border-paper/40 transition-[border-color,background-color,color] duration-300 ease-brand group-hover:border-gold-pale group-hover:bg-gold-pale group-hover:text-ink"
              >
                <ArrowRight className="h-3.5 w-3.5 rotate-90 transition-transform duration-300 ease-brand group-hover:translate-y-0.5" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export function BecomeExpect() {
  const [ref, shown] = useInView<HTMLOListElement>()
  const E = BECOME.expect
  return (
    <section aria-labelledby="expect-head" className={SECTION_Y}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead id="expect-head" eyebrow={E.eyebrow} title={E.title} />
        <ol ref={ref} className={`mt-s4 grid gap-s3 sm:grid-cols-2 lg:mt-s5 lg:grid-cols-4 lg:gap-s2 ${BREAKOUT}`}>
          {E.items.map((step, i) => (
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
                <p className="mt-s3 font-display text-[19px] leading-snug tracking-[-0.014em]">{step.title}</p>
                <p className="mt-1.5 max-w-[30ch] text-[15px] leading-relaxed text-text-2">{step.body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function BecomeTrade() {
  const G = BECOME.give
  return (
    <section aria-label={G.eyebrow} className={`pt-0 ${SECTION_Y.replace('py-', 'pb-')}`}>
      <div className={`gutter mx-auto grid max-w-page gap-s2 md:grid-cols-2`}>
        <Reveal variant="clip" className={`h-full lg:-ml-[min(72px,max(0px,calc((100vw_-_100%)/2_-_24px)))]`}>
          <div className="flex h-full flex-col rounded-2xl border border-line p-s3 sm:p-s4 lg:p-[clamp(32px,3.2vw,52px)]">
            <p className="font-script text-[clamp(26px,2.4vw,34px)] leading-none text-green">{G.eyebrow}</p>
            <h2 className="mt-2 font-display text-[clamp(24px,2.3vw,32px)] leading-[1.1] tracking-[-0.02em]">{G.giveTitle}</h2>
            <ul className="mt-s4 grid gap-s2">
              {G.give.map((item, i) => (
                <li key={item} className="flex gap-s2 border-t border-line pt-s2">
                  <span aria-hidden="true" className="nums mt-px w-6 shrink-0 font-display text-[15px] text-teal">
                    0{i + 1}
                  </span>
                  <p className="text-[15.5px] leading-relaxed text-text-2">{item}</p>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal variant="clip" delay={90} className="h-full lg:-mr-[min(72px,max(0px,calc((100vw_-_100%)/2_-_24px)))]">
          <div className="relative isolate flex h-full flex-col overflow-hidden rounded-2xl bg-grad-lagoon-x p-s3 text-paper sm:p-s4 lg:p-[clamp(32px,3.2vw,52px)]">
            <p className="font-script text-[clamp(26px,2.4vw,34px)] leading-none text-gold-pale">In return</p>
            <h2 className="mt-2 font-display text-[clamp(24px,2.3vw,32px)] leading-[1.1] tracking-[-0.02em]">{G.getTitle}</h2>
            <ul className="mt-s4 grid gap-s2">
              {G.get.map((item) => (
                <li key={item} className="flex gap-s2 border-t border-paper/15 pt-s2">
                  <span aria-hidden="true" className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-gold-pale text-ink">
                    <Check className="size-3.5" />
                  </span>
                  <p className="text-[15.5px] leading-relaxed text-paper/90">{item}</p>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div data-bad={!!error}>
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
      {error && <p className="mt-1 text-[13px] text-alert">{error}</p>}
    </div>
  )
}

export function BecomeForm() {
  const uid = useId()
  const [params] = useSearchParams()
  const F = BECOME.form
  const [e, setE] = useState<Enquiry>(() => emptyEnquiry(params.get('type') ?? ''))
  const [errors, setErrors] = useState<EnquiryErrors>({})
  const [sent, setSent] = useState<'no' | 'mail' | 'endpoint'>('no')
  const [failed, setFailed] = useState(false)

  const set = <K extends keyof Enquiry>(k: K, v: Enquiry[K]) => {
    setE((prev) => ({ ...prev, [k]: v }))
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }))
  }

  const send = async () => {
    const bad = validateEnquiry(e)
    if (Object.keys(bad).length) {
      setErrors(bad)
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('#enquiry [data-bad="true"]')?.scrollIntoView({ block: 'center' }),
      )
      return
    }
    const result = await submitEnquiry(e)
    if (result === 'failed') setFailed(true)
    else setSent(result)
  }

  const text = (k: keyof EnquiryErrors, label: string, props: Record<string, string> = {}) => (
    <Field id={`${uid}-${k}`} label={label} error={errors[k]}>
      <input
        id={`${uid}-${k}`}
        type="text"
        value={e[k] as string}
        onChange={(ev) => set(k, ev.target.value as never)}
        aria-invalid={errors[k] ? 'true' : undefined}
        className={`${FIELD} ${errors[k] ? 'border-alert' : ''}`}
        {...props}
      />
    </Field>
  )

  return (
    <section id="enquiry" aria-labelledby="enquiry-head" className={`scroll-mt-[calc(var(--header-h)+24px)] pt-0 ${SECTION_Y.replace('py-', 'pb-')}`}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead id="enquiry-head" eyebrow={F.eyebrow} title={F.title} lede={F.lede} />

        <div className={`mt-s4 grid gap-s2 lg:mt-s5 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] ${BREAKOUT}`}>
          <Reveal variant="clip" className="h-full">
            <div className="h-full rounded-2xl border border-line bg-paper p-s3 sm:p-s4 lg:p-[clamp(32px,3.2vw,52px)]">
              {sent !== 'no' ? (
                <div role="status" style={{ animation: 'hero-rise 620ms var(--ease-brand) both' }}>
                  <span className="inline-flex size-12 items-center justify-center rounded-full bg-teal text-paper">
                    <Mail className="h-5 w-5" />
                  </span>
                  <p className="mt-s3 font-display text-[clamp(24px,2.2vw,30px)] leading-snug tracking-[-0.02em]">
                    {F.handedOff.title}
                  </p>
                  <p className="mt-s2 max-w-[56ch] text-[15.5px] leading-relaxed text-text-2">
                    {F.handedOff.body}{' '}
                    <a href={`mailto:${ORG.email}`} className="text-green underline underline-offset-4">
                      {ORG.email}
                    </a>
                    .
                  </p>
                  <button
                    type="button"
                    onClick={() => setSent('no')}
                    className="mt-s4 inline-flex min-h-[48px] items-center rounded-[10px] border border-ink/15 px-5 text-[15px] font-semibold transition-colors duration-200 ease-brand hover:border-ink"
                  >
                    {F.handedOff.again}
                  </button>
                </div>
              ) : (
                <form
                  noValidate
                  onSubmit={(ev) => {
                    ev.preventDefault()
                    send()
                  }}
                  className="grid gap-s4"
                >
                  <fieldset data-bad={!!errors.type}>
                    <legend className={LABEL}>{F.type}</legend>
                    <div className="mt-s2 grid gap-2 sm:grid-cols-2">
                      {PARTNER_TYPES.map((t) => {
                        const Icon = ICONS[t.icon]
                        const on = e.type === t.id
                        return (
                          <label
                            key={t.id}
                            className={`flex cursor-pointer items-center gap-s2 rounded-xl border p-s2 transition-[border-color,background-color] duration-200 ease-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold ${
                              on ? 'border-teal bg-teal/[0.06]' : 'border-line hover:border-teal/50'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`${uid}-type`}
                              className="sr-only"
                              checked={on}
                              onChange={() => set('type', t.id)}
                            />
                            <span
                              aria-hidden="true"
                              className={`flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
                                on ? 'bg-teal text-paper' : 'bg-teal/[0.08] text-teal'
                              }`}
                            >
                              <Icon className="size-5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[12.5px] text-text-3">{t.kind}</span>
                              <span className="block font-semibold leading-snug">{t.title}</span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                    {errors.type && <p className="mt-1.5 text-[13px] text-alert">{errors.type}</p>}
                  </fieldset>

                  <div className="grid gap-s4 sm:grid-cols-2">
                    <div className="sm:col-span-2">{text('org', F.org, { autoComplete: 'organization' })}</div>
                    {text('name', F.name, { autoComplete: 'name' })}
                    {text('role', F.role, { autoComplete: 'organization-title' })}
                    {text('email', F.email, { type: 'email', autoComplete: 'email' })}
                    {text('phone', F.phone, { type: 'tel', inputMode: 'tel', autoComplete: 'tel' })}
                    {text('website', F.website, { type: 'url', inputMode: 'url', placeholder: 'www.' })}
                    {text('location', F.location, { autoComplete: 'address-level2' })}
                  </div>

                  <Field id={`${uid}-message`} label={F.message} error={errors.message}>
                    <textarea
                      id={`${uid}-message`}
                      rows={5}
                      value={e.message}
                      placeholder={F.messagePlaceholder}
                      onChange={(ev) => set('message', ev.target.value)}
                      aria-invalid={errors.message ? 'true' : undefined}
                      className={`${FIELD} resize-y leading-relaxed ${errors.message ? 'border-alert' : ''}`}
                    />
                  </Field>

                  <div data-bad={!!errors.consent}>
                    <label className="flex cursor-pointer items-start gap-s1 text-[14.5px] leading-relaxed text-text-2">
                      <input
                        type="checkbox"
                        checked={e.consent}
                        onChange={(ev) => set('consent', ev.target.checked)}
                        aria-invalid={errors.consent ? 'true' : undefined}
                        className="mt-[3px] h-[17px] w-[17px] shrink-0 accent-teal"
                      />
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

          <Reveal variant="clip" delay={90} className="h-full">
            <aside className="relative isolate flex h-full flex-col overflow-hidden rounded-2xl bg-grad-lagoon-x p-s3 text-paper sm:p-s4 lg:p-[clamp(32px,3.2vw,48px)]">
              <p className="font-script text-[clamp(24px,2.2vw,30px)] leading-none text-gold-pale">{F.panel.eyebrow}</p>
              <h3 className="mt-2 font-display text-[clamp(22px,2vw,28px)] leading-[1.15] tracking-[-0.02em]">
                {F.panel.title}
              </h3>
              <ul className="mt-s3 grid gap-s2">
                {F.panel.points.map((p) => (
                  <li key={p} className="flex gap-s2 border-t border-paper/15 pt-s2 text-[15px] leading-snug text-paper/90">
                    <span aria-hidden="true" className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gold-pale text-ink">
                      <Check className="size-3" />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
              <Link
                to="/where-it-goes"
                className="group mt-s3 inline-flex items-center gap-1.5 self-start text-[14.5px] font-semibold text-gold-pale underline decoration-gold-pale/35 underline-offset-4 hover:decoration-gold-pale"
              >
                {F.panel.records}
                <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
              </Link>
              <div className="mt-s4 border-t border-paper/15 pt-s3 lg:mt-auto">
                <a href={`mailto:${ORG.email}`} className="flex items-center gap-2 text-[15px] font-semibold hover:text-gold-pale">
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
