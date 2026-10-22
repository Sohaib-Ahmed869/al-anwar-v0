import { useId, useRef, useState } from 'react'

import { Check, Send } from './icons'
import Reveal from './Reveal'
import { LETTER } from './letter-data'
import { ORG } from './org-data'
import { submit, validate, type LetterErrors, type LetterPayload } from '../services/letter'

/* ---------------------------------------------------------------------------
   The letter: the newsletter sign-up at the top of the footer, on every page.

   REDESIGNED 17 September 2026 at the user's request. It used to be a quiet
   type-only row on the footer's ink. It is now a card in the footer's own ink
   (the user asked for the footer colour instead of teal, and for no masjid
   watermark), with a hairline ring so it reads against the footer that sits across the join between the page and
   the footer, half on each, so the footer opens with one clear invitation:
     left   script eyebrow and the offer as a heading
     right  the underlined field and the type-set Subscribe from before the
            redesign (the user asked for the pill to go back to that)
   No gold on the button: gold is the give action.

   Made shorter the same day at the user's request: less padding, the heading
   back to its earlier size, and the lede line taken out.

   The logic is unchanged. A tick is only shown for something that actually
   happened: ENDPOINT in services/letter.ts is empty, so the button hands a
   one-line message to the writer's own email and the reply says exactly that.
--------------------------------------------------------------------------- */

/** Underlined rather than boxed, as it was before the redesign. `peer` lets
 *  the gold rule know it has focus; the two -webkit properties stop Chrome's
 *  autofill painting a pale slab on the ink. */
const FIELD =
  'peer block w-full border-b border-line-ink bg-transparent py-2 text-[15.5px] text-text-on-ink ' +
  'placeholder:text-text-3 transition-colors duration-200 focus-visible:outline-none ' +
  'autofill:[-webkit-box-shadow:inset_0_0_0_1000px_var(--color-ink)] ' +
  'autofill:[-webkit-text-fill-color:var(--color-text-on-ink)]'

export default function Letter() {
  const uid = useId()
  const fieldRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  /** The honeypot's value, kept out of `email`. */
  const [trap, setTrap] = useState('')
  const [errors, setErrors] = useState<LetterErrors>({})
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [joined, setJoined] = useState<'no' | 'endpoint' | 'mail'>('no')

  const payload = (): LetterPayload => ({ email, company: trap })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending) return

    const bad = validate(payload())
    setErrors(bad)
    setFailed(null)

    if (bad.email) {
      fieldRef.current?.focus()
      return
    }

    setSending(true)
    const result = await submit(payload())
    setSending(false)

    if (!result.ok) {
      if (result.errors) setErrors(result.errors)
      setFailed(result.message)
      return
    }
    setJoined(result.via)
  }

  const again = () => {
    setEmail('')
    setErrors({})
    setFailed(null)
    setJoined('no')
  }

  return (
    <section aria-labelledby={`${uid}-head`} className="gutter relative z-10 mx-auto max-w-page">
      <Reveal variant="clip">
        <div className="relative isolate overflow-hidden rounded-2xl bg-ink px-s3 py-s3 text-paper ring-1 ring-paper/10 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.6)] sm:px-s4 lg:px-[clamp(40px,4vw,64px)] lg:py-[clamp(24px,2.4vw,34px)]">
          <div className="grid gap-s3 lg:grid-cols-12 lg:items-center lg:gap-s4">
            {/* ---------- what the letter is ---------- */}
            <div className="lg:col-span-6">
              <p className="font-script text-[clamp(20px,1.7vw,24px)] leading-none text-gold-pale">
                {LETTER.eyebrow}
              </p>
              <h2
                id={`${uid}-head`}
                className="mt-1.5 font-display text-[clamp(21px,2vw,27px)] leading-snug tracking-[-0.018em] text-balance"
              >
                {LETTER.title}
              </h2>
            </div>

            {/* ---------- the ask ---------- */}
            <div className="lg:col-span-6">
              {joined !== 'no' ? (
                <div
                  role="status"
                  className="rounded-xl bg-paper/10 p-s3 ring-1 ring-paper/15"
                  style={{ animation: 'hero-rise 620ms var(--ease-brand) both' }}
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gold-pale text-ink">
                    <Check className="h-[18px] w-[18px]" />
                  </span>
                  <p className="mt-s2 font-display text-[20px] leading-snug">
                    {joined === 'endpoint' ? LETTER.joined.title : LETTER.joined.handedOff}
                  </p>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-paper/80">
                    {joined === 'endpoint' ? (
                      LETTER.joined.body
                    ) : (
                      <>
                        {LETTER.joined.handedOffBody}{' '}
                        <a href={`mailto:${ORG.email}`} className="text-gold-pale underline underline-offset-4">
                          {ORG.email}
                        </a>
                        .
                      </>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={again}
                    className="mt-s2 text-[14px] text-gold-pale underline decoration-gold-pale/40 underline-offset-4 hover:decoration-gold-pale"
                  >
                    {LETTER.joined.again}
                  </button>
                </div>
              ) : (
                <form noValidate onSubmit={onSubmit}>
                  {/* The honeypot. Off-screen rather than display:none, hidden
                      from people and screen readers, never tabbable. */}
                  <div aria-hidden="true" className="absolute h-px w-px overflow-hidden opacity-0">
                    <label htmlFor={`${uid}-company`}>Company</label>
                    <input
                      id={`${uid}-company`}
                      name="company"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={trap}
                      onChange={(e) => setTrap(e.target.value)}
                    />
                  </div>

                  {/* The field as it was before the redesign: a line to write
                      on, not a box, with the label above it and the action set
                      as type standing on the end of the rule. */}
                  <div className="flex flex-wrap items-end gap-s2 sm:flex-nowrap">
                    <div className="min-w-[200px] flex-1">
                      <label
                        htmlFor={`${uid}-email`}
                        className="block text-[11px] font-semibold tracking-[0.13em] text-text-on-ink-2 uppercase"
                      >
                        {LETTER.label}
                      </label>
                      <div className="relative">
                        <input
                          ref={fieldRef}
                          id={`${uid}-email`}
                          name="email"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          placeholder={LETTER.placeholder}
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value)
                            if (errors.email) setErrors({})
                          }}
                          onBlur={() => {
                            if (email.trim()) setErrors(validate(payload()))
                          }}
                          aria-invalid={errors.email ? 'true' : undefined}
                          aria-describedby={errors.email ? `${uid}-bad` : undefined}
                          className={`${FIELD} ${errors.email ? 'border-alert-pale' : ''}`}
                        />
                        {/* the gold rule that draws in on focus */}
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left transition-transform duration-300 ease-brand ${
                            errors.email ? 'scale-x-100 bg-alert-pale' : 'scale-x-0 bg-gold peer-focus:scale-x-100'
                          }`}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={sending}
                      className="group inline-flex min-h-[46px] shrink-0 items-center gap-2 pb-2 text-[12px] font-semibold tracking-[0.16em] text-green-pale uppercase transition-colors duration-200 ease-brand hover:text-paper disabled:pointer-events-none disabled:opacity-70"
                    >
                      {sending ? (
                        <>
                          {LETTER.sending}
                          <span
                            aria-hidden="true"
                            className="h-4 w-4 animate-spin rounded-full border-2 border-green-pale/35 border-t-green-pale"
                          />
                        </>
                      ) : (
                        <>
                          {LETTER.button}
                          <Send className="h-4 w-4 transition-transform duration-300 ease-brand group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </>
                      )}
                    </button>
                  </div>

                  <p id={`${uid}-bad`} className="mt-1.5 min-h-[18px] text-[13px] text-alert-pale">
                    {errors.email}
                  </p>

                  {failed && (
                    <p role="alert" className="mt-s1 rounded-lg bg-alert-pale/15 px-s2 py-s1 text-[13.5px] text-alert-pale">
                      {failed}{' '}
                      <a href={`mailto:${ORG.email}`} className="underline underline-offset-4">
                        {ORG.email}
                      </a>
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
