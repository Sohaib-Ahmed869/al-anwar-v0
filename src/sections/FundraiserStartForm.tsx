import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import FundraiserCard from '../components/FundraiserCard'
import { BREAKOUT } from '../components/SectionHead'
import { REASONS, START } from '../components/fundraiser-data'
import { PLACES, appealBySlug } from '../components/appeals-data'

import { appealView } from '../components/appeal-view'
import { ArrowRight, BookOpen, Box, Check, Droplet, HandHeart, LifeBuoy } from '../components/icons'
import { MasjidMark } from '../components/Ornament'
import {
  checkStep,
  appealsFor,
  draftToFundraiser,
  saveLocal,
  shrinkPhoto,
  type Draft,
} from '../services/fundraisers'

/* ---------------------------------------------------------------------------
   /fundraisers/start: the form, in four steps, with the page taking shape
   beside it.

   Added 17 September 2026 after the user's reference. The steps are the ones
   that make a fundraiser genuine rather than a blank page:
     1. Reason ........ what the money is for (emergency relief, food, clean
                        water, education, sadaqah jariyah, a loved one's memory)
     2. Appeal ........ which of our real appeals it goes to, offering only the
                        appeals that fit the reason, so nobody can raise for
                        something we do not run
     3. Your page ..... title (suggested from 1 and 2), their reason, a goal,
                        an end date, and a photo if they want one
     4. About you ..... name and email, and a tick that they understand every
                        gift goes to the appeal
   On the right, from lg up, the fundraiser card as it will appear, redrawn on
   every keystroke. On a phone it sits under the form.

   CREATING IT saves to this browser only (services/fundraisers.ts) and opens
   the new page, which says plainly that it is a preview and offers to email
   it to the office. If the browser will not store it (private mode, or a
   photo too big) it tries again without the photo, then says so.
--------------------------------------------------------------------------- */

const LABEL = 'block text-[11px] font-semibold tracking-[0.13em] text-text-3 uppercase'
const FIELD =
  'peer block w-full border-b border-line bg-transparent py-2 text-[15.5px] text-text placeholder:text-text-3 transition-colors duration-200 focus:outline-none focus-visible:outline-none'

const REASON_ICON: Record<string, (p: { className?: string }) => ReactNode> = {
  emergency: LifeBuoy,
  food: Box,
  water: Droplet,
  education: BookOpen,
  jariyah: MasjidMark,
  memory: HandHeart,
}

const GOALS = [500, 1000, 2500, 5000]

const inDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const EMPTY: Draft = {
  reason: null,
  appeal: null,
  title: '',
  story: '',
  goal: '1000',
  ends: inDays(30),
  photo: '',
  first: '',
  last: '',
  email: '',
  group: '',
  agree: false,
}

function Underline({ bad }: { bad?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left transition-transform duration-300 ease-brand ${
        bad ? 'scale-x-100 bg-alert' : 'scale-x-0 bg-teal peer-focus:scale-x-100'
      }`}
    />
  )
}

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
        <Underline bad={!!error} />
      </div>
      {hint && !error && <p className="mt-1 text-[13px] text-text-3">{hint}</p>}
      {error && (
        <p id={`${id}-bad`} className="mt-1 text-[13px] text-alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default function FundraiserStartForm() {
  const uid = useId()
  const navigate = useNavigate()
  const top = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState(0)
  const [d, setD] = useState<Draft>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [titleTouched, setTitleTouched] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [saveError, setSaveError] = useState('')

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((prev) => ({ ...prev, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }))
  }

  /* Suggest a title from the reason and the appeal until they write their own. */
  useEffect(() => {
    if (titleTouched) return
    const reason = REASONS.find((r) => r.id === d.reason)
    const appeal = appealBySlug(d.appeal)
    if (reason && appeal)
      setD((prev) => ({ ...prev, title: `${reason.title} ${PLACES[appeal.country]}` }))
  }, [d.reason, d.appeal, titleTouched])

  const go = (to: number) => {
    setStep(to)
    setErrors({})
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const next = () => {
    const e = checkStep(step, d)
    if (Object.keys(e).length) {
      setErrors(e)
      return
    }
    if (step < 3) return go(step + 1)

    const f = draftToFundraiser(d)
    if (saveLocal(f)) return navigate(`/fundraisers/${f.slug}`)
    const bare = { ...f, photo: undefined }
    if (saveLocal(bare)) return navigate(`/fundraisers/${f.slug}`)
    setSaveError(
      'Your browser would not save this page (it may be in private mode). Try again in a normal window, or write to us and we will set it up.',
    )
  }

  const onPhoto = async (file: File | undefined) => {
    setPhotoError('')
    if (!file) return
    try {
      set('photo', await shrinkPhoto(file))
    } catch {
      setPhotoError('That file could not be read as a photo. Try a JPG or PNG.')
    }
  }

  /* The card on the right, from whatever has been filled in so far. */
  const preview = {
    ...draftToFundraiser({
      ...d,
      title: d.title || 'Your fundraiser title',
      /* no appeal line, and a neutral photo, until one is chosen */
      appeal: d.appeal ?? '',
      first: d.first || 'Your',
      last: d.last || 'Name',
      goal: d.goal || '1000',
    }),
    /* no reason chip until one is chosen */
    reason: (d.reason ?? '') as Draft['reason'] & string,
    local: false,
  }

  return (
    <section aria-labelledby="start-title" className="pt-[clamp(32px,5vw,64px)] pb-[clamp(56px,6.5vw,96px)]">
      <div ref={top} className="gutter mx-auto max-w-page scroll-mt-[calc(var(--header-h)+16px)]">
        <div className={BREAKOUT}>
          <Link
            to="/fundraisers"
            className="group inline-flex items-center gap-2 text-[13.5px] font-medium text-text-3 transition-colors duration-200 ease-brand hover:text-text"
          >
            <ArrowRight className="h-3 w-3 rotate-180 transition-transform duration-300 ease-brand group-hover:-translate-x-0.5" />
            All fundraisers
          </Link>
          <p className="mt-s3 font-script text-[clamp(21px,1.9vw,27px)] leading-none text-green">{START.eyebrow}</p>
          <h1
            id="start-title"
            className="mt-s2 font-display text-[clamp(34px,4.4vw,58px)] leading-[1.04] font-semibold tracking-[-0.025em]"
          >
            {START.title}
          </h1>
          <p className="mt-s2 max-w-[54ch] text-[clamp(15.5px,1.2vw,17px)] leading-[1.55] text-text-2">{START.lede}</p>

          {/* --- the stepper --- */}
          <ol className="mt-s4 grid grid-cols-4 gap-2">
            {START.steps.map((label, i) => {
              const done = i < step
              const current = i === step
              return (
                <li key={label}>
                  <button
                    type="button"
                    disabled={i > step}
                    onClick={() => go(i)}
                    aria-current={current ? 'step' : undefined}
                    className="group w-full text-left disabled:cursor-default"
                  >
                    <span
                      className={`block h-1.5 rounded-full transition-colors duration-500 ease-brand ${
                        done || current ? 'bg-teal' : 'bg-line'
                      }`}
                    />
                    <span
                      className={`mt-2 flex items-center gap-1.5 text-[13px] font-semibold ${
                        current ? 'text-teal' : done ? 'text-text' : 'text-text-3'
                      }`}
                    >
                      {done && <Check className="h-3 w-3" />}
                      <span className="hidden sm:inline">
                        {i + 1}. {label}
                      </span>
                      <span className="sm:hidden">{i + 1}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>

        <div className={`mt-s5 grid gap-s5 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] ${BREAKOUT}`}>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              next()
            }}
          >
            {/* --- 1. reason --- */}
            {step === 0 && (
              <fieldset>
                <legend className="font-display text-[clamp(22px,2vw,28px)] font-semibold tracking-[-0.02em]">
                  {START.reason.title}
                </legend>
                <p className="mt-1 text-[15px] text-text-2">{START.reason.hint}</p>
                <div className="mt-s3 grid gap-s2 sm:grid-cols-2">
                  {REASONS.filter((r) => appealsFor(r.id).length > 0).map((o) => {
                    const Icon = REASON_ICON[o.id]
                    const on = d.reason === o.id
                    return (
                      <label
                        key={o.id}
                        className={`flex cursor-pointer gap-s2 rounded-2xl border p-s3 transition-[border-color,background-color] duration-200 ease-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold ${
                          on ? 'border-teal bg-teal/[0.06]' : 'border-line hover:border-teal/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`${uid}-reason`}
                          className="sr-only"
                          checked={on}
                          onChange={() => {
                            /* keep the appeal only if it fits; preselect the only one */
                            const fits = appealsFor(o.id)
                            set('reason', o.id)
                            if (!fits.some((a) => a.slug === d.appeal))
                              set('appeal', fits.length === 1 ? fits[0].slug : null)
                          }}
                        />
                        <span
                          aria-hidden="true"
                          className={`flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
                            on ? 'bg-teal text-paper' : 'bg-teal/[0.08] text-teal'
                          }`}
                        >
                          <Icon className="size-5" />
                        </span>
                        <span>
                          <span className="block font-semibold">{o.label}</span>
                          <span className="mt-0.5 block text-[14px] leading-snug text-text-2">{o.hint}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                {errors.reason && <p className="mt-s2 text-[13.5px] text-alert">{errors.reason}</p>}
              </fieldset>
            )}

            {/* --- 2. appeal --- */}
            {step === 1 && (
              <fieldset>
                <legend className="font-display text-[clamp(22px,2vw,28px)] font-semibold tracking-[-0.02em]">
                  {START.appeal.title}
                </legend>
                <p className="mt-1 text-[15px] text-text-2">{START.appeal.hint}</p>
                <div className="mt-s3 grid gap-s2 sm:grid-cols-2">
                  {appealsFor(d.reason).map((appeal) => {
                    const a = appealView(appeal)
                    const on = d.appeal === appeal.slug
                    return (
                      <label
                        key={appeal.slug}
                        className={`group relative flex cursor-pointer overflow-hidden rounded-2xl border transition-[border-color,box-shadow] duration-200 ease-brand has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold ${
                          on ? 'border-teal shadow-card' : 'border-line hover:border-teal/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`${uid}-appeal`}
                          className="sr-only"
                          checked={on}
                          onChange={() => set('appeal', appeal.slug)}
                        />
                        <img
                          src={a.image}
                          alt=""
                          loading="lazy"
                          className="h-auto w-[34%] shrink-0 object-cover"
                        />
                        <span className="flex min-w-0 flex-1 flex-col p-s2">
                          <span className="text-[12.5px] text-text-3">
                            {a.cause} · {PLACES[appeal.country]}
                          </span>
                          <span className="mt-0.5 font-semibold leading-snug">{appeal.title}</span>
                          <span className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-text-2">{appeal.blurb}</span>
                        </span>
                        {on && (
                          <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-teal text-paper">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
                {errors.appeal && <p className="mt-s2 text-[13.5px] text-alert">{errors.appeal}</p>}
              </fieldset>
            )}

            {/* --- 3. the page --- */}
            {step === 2 && (
              <div>
                <h2 className="font-display text-[clamp(22px,2vw,28px)] font-semibold tracking-[-0.02em]">
                  {START.page.title}
                </h2>
                <div className="mt-s4 grid gap-s4">
                  <Field id={`${uid}-title`} label={START.page.titleLabel} error={errors.title}>
                    <input
                      id={`${uid}-title`}
                      type="text"
                      maxLength={80}
                      value={d.title}
                      onChange={(e) => {
                        setTitleTouched(true)
                        set('title', e.target.value)
                      }}
                      aria-invalid={errors.title ? 'true' : undefined}
                      className={`${FIELD} ${errors.title ? 'border-alert' : ''}`}
                    />
                  </Field>

                  <Field id={`${uid}-story`} label={START.page.storyLabel} hint={START.page.storyHint} error={errors.story}>
                    <textarea
                      id={`${uid}-story`}
                      rows={6}
                      value={d.story}
                      onChange={(e) => set('story', e.target.value)}
                      aria-invalid={errors.story ? 'true' : undefined}
                      className={`${FIELD} resize-y leading-relaxed ${errors.story ? 'border-alert' : ''}`}
                    />
                  </Field>

                  <div>
                    <p className={LABEL}>{START.page.goalLabel}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {GOALS.map((g) => {
                        const on = d.goal === String(g)
                        return (
                          <button
                            key={g}
                            type="button"
                            aria-pressed={on}
                            onClick={() => set('goal', String(g))}
                            className={`nums min-h-[44px] rounded-full px-4 text-[14.5px] font-semibold transition-colors duration-200 ease-brand ${
                              on ? 'bg-teal text-paper' : 'border border-line text-text-2 hover:border-teal hover:text-teal'
                            }`}
                          >
                            ${g.toLocaleString('en-AU')}
                          </button>
                        )
                      })}
                    </div>
                    <div className="mt-s2 max-w-[220px]">
                      <Field id={`${uid}-goal`} label="Or your own goal" error={errors.goal}>
                        <input
                          id={`${uid}-goal`}
                          type="text"
                          inputMode="numeric"
                          value={d.goal}
                          onChange={(e) => set('goal', e.target.value.replace(/[^\d]/g, ''))}
                          aria-invalid={errors.goal ? 'true' : undefined}
                          className={`${FIELD} nums ${errors.goal ? 'border-alert' : ''}`}
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="max-w-[260px]">
                    <Field id={`${uid}-ends`} label={START.page.endsLabel} error={errors.ends}>
                      <input
                        id={`${uid}-ends`}
                        type="date"
                        min={inDays(1)}
                        value={d.ends}
                        onChange={(e) => set('ends', e.target.value)}
                        aria-invalid={errors.ends ? 'true' : undefined}
                        className={`${FIELD} ${errors.ends ? 'border-alert' : ''}`}
                      />
                    </Field>
                  </div>

                  <div>
                    <p className={LABEL}>{START.page.photoLabel}</p>
                    <p className="mt-1 text-[13px] text-text-3">{START.page.photoHint}</p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      aria-label={START.page.photoAction}
                      onChange={(e) => onPhoto(e.target.files?.[0])}
                    />
                    <div className="mt-s2 flex flex-wrap items-center gap-s2">
                      {d.photo && (
                        <img src={d.photo} alt="" className="h-16 w-24 rounded-lg object-cover ring-1 ring-line" />
                      )}
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="inline-flex min-h-[44px] items-center rounded-[10px] border border-line px-4 text-[14px] font-semibold transition-colors duration-200 ease-brand hover:border-teal hover:text-teal"
                      >
                        {START.page.photoAction}
                      </button>
                      {d.photo && (
                        <button
                          type="button"
                          onClick={() => {
                            set('photo', '')
                            if (fileRef.current) fileRef.current.value = ''
                          }}
                          className="text-[14px] font-semibold text-text-3 underline underline-offset-4 hover:text-alert"
                        >
                          {START.page.photoRemove}
                        </button>
                      )}
                    </div>
                    {photoError && <p className="mt-1 text-[13px] text-alert">{photoError}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* --- 4. about you --- */}
            {step === 3 && (
              <div>
                <h2 className="font-display text-[clamp(22px,2vw,28px)] font-semibold tracking-[-0.02em]">
                  {START.you.title}
                </h2>
                <p className="mt-1 text-[15px] text-text-2">{START.you.hint}</p>
                <div className="mt-s4 grid gap-s4 sm:grid-cols-2">
                  <Field id={`${uid}-first`} label={START.you.first} error={errors.first}>
                    <input
                      id={`${uid}-first`}
                      type="text"
                      autoComplete="given-name"
                      value={d.first}
                      onChange={(e) => set('first', e.target.value)}
                      aria-invalid={errors.first ? 'true' : undefined}
                      className={`${FIELD} ${errors.first ? 'border-alert' : ''}`}
                    />
                  </Field>
                  <Field id={`${uid}-last`} label={START.you.last} error={errors.last}>
                    <input
                      id={`${uid}-last`}
                      type="text"
                      autoComplete="family-name"
                      value={d.last}
                      onChange={(e) => set('last', e.target.value)}
                      aria-invalid={errors.last ? 'true' : undefined}
                      className={`${FIELD} ${errors.last ? 'border-alert' : ''}`}
                    />
                  </Field>
                  <Field id={`${uid}-email`} label={START.you.email} error={errors.email}>
                    <input
                      id={`${uid}-email`}
                      type="email"
                      autoComplete="email"
                      value={d.email}
                      onChange={(e) => set('email', e.target.value)}
                      aria-invalid={errors.email ? 'true' : undefined}
                      className={`${FIELD} ${errors.email ? 'border-alert' : ''}`}
                    />
                  </Field>
                  <Field id={`${uid}-group`} label={START.you.group} hint={START.you.groupHint}>
                    <input
                      id={`${uid}-group`}
                      type="text"
                      value={d.group}
                      onChange={(e) => set('group', e.target.value)}
                      className={FIELD}
                    />
                  </Field>
                </div>
                <label className="mt-s4 flex cursor-pointer items-start gap-s1 text-[14.5px] leading-relaxed text-text-2">
                  <input
                    type="checkbox"
                    checked={d.agree}
                    onChange={(e) => set('agree', e.target.checked)}
                    aria-invalid={errors.agree ? 'true' : undefined}
                    className="mt-[3px] h-[17px] w-[17px] shrink-0 accent-teal"
                  />
                  <span>{START.you.agree}</span>
                </label>
                {errors.agree && <p className="mt-1 text-[13px] text-alert">{errors.agree}</p>}
              </div>
            )}

            {saveError && (
              <p role="alert" className="mt-s3 rounded-xl bg-alert/10 p-s2 text-[14.5px] text-alert">
                {saveError}
              </p>
            )}

            {/* --- back and next --- */}
            <div className="mt-s5 flex items-center justify-between gap-s2 border-t border-line pt-s3">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => go(step - 1)}
                  className="group inline-flex min-h-[48px] items-center gap-2 text-[15px] font-semibold text-text-2 hover:text-text"
                >
                  <ArrowRight className="h-3 w-3 rotate-180 transition-transform duration-300 ease-brand group-hover:-translate-x-0.5" />
                  {START.back}
                </button>
              ) : (
                <span />
              )}
              <button
                type="submit"
                className="group inline-flex min-h-[52px] items-center gap-2 rounded-[10px] bg-teal px-6 text-[15.5px] font-semibold text-paper transition duration-200 ease-brand hover:-translate-y-px hover:bg-ink"
              >
                {step < 3 ? START.next : START.create}
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
              </button>
            </div>
          </form>

          {/* --- the page so far --- */}
          <aside aria-label={START.previewLabel} className="lg:sticky lg:top-[calc(var(--header-h)+32px)] lg:self-start">
            <p className="mb-s2 font-script text-[clamp(21px,1.8vw,26px)] leading-none text-green">
              {START.previewLabel}
            </p>
            <div className="pointer-events-none" inert>
              <FundraiserCard fundraiser={preview} />
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
