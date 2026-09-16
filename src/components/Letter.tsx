import { useId, useRef, useState } from 'react'

import { Check, Send } from './icons'
import Reveal from './Reveal'
import { LETTER } from './letter-data'
import { ORG } from './org-data'
import { submit, validate, type LetterErrors, type LetterPayload } from '../services/letter'

/* ---------------------------------------------------------------------------
   The letter: the first block inside the footer, on every page, where somebody
   who has read to the bottom can ask to hear what happened next.

   It is rendered by Footer.tsx rather than by Layout, and it carries no ground
   of its own — the footer's ink runs straight through it. One dark region with
   two rooms in it: the ask, a hairline, then the directory.

   Four things and no more: an eyebrow, the offer, a field, a button. The
   paragraph explaining what is in the letter and the line of small print under
   the field have both gone — down here the title has to do it alone, and a
   footer is not where anybody reads two sentences of explanation. The privacy
   policy is still one link away: the footer's own bottom row carries it, two
   rows below this.

   That is the whole idea, and it is why this is no longer a band. It was one: a
   paper-2 strip between the last section and the footer, which made the foot of
   every page three grounds deep and put the loudest change of colour on the
   screen immediately before the small print. Sharing the footer's ink costs it
   nothing — it is still the quietest thing on the page — and buys the page one
   ending instead of two.

   ── What holds it apart from the columns below ──────────────────────────
   Three things, none of them a box. The hairline the footer already draws above
   its small print, repeated here. Sixty-four pixels of air on either side of
   it. And one soft green wash falling from the corner the heading starts in —
   the same move the hadith strip on the About page makes, for the same reason:
   so the ink reads as a ground rather than a slab, and the top of the footer
   sits a shade above the bottom of it without a second line being drawn.

   ── Reading on ink ──────────────────────────────────────────────────────
   Nothing in here is brand green, and that is not a preference. #2F6B5A on
   #151A18 is 2.8:1, which is not a colour anybody can read a word in. The site
   settled this already on the contact page's dark panel: the accent on ink is
   green-pale, a complaint is alert-pale — the same hue lifted to carry on a
   dark ground — and an eyebrow is paper at 75%. Brand green survives nowhere in
   here at all, not even on the button: there is nothing filled in the footer.

   ── The one rule this shares with the contact form ──────────────────────
   A tick is only ever shown for something that actually happened. ENDPOINT in
   services/letter.ts is empty, so today the button hands a one-line message to
   the writer's own email client, and the reply below says exactly that rather
   than pretending. Read the note in that file before changing it.
--------------------------------------------------------------------------- */

/** The contact page's dark-panel label, and it is a second constant there for
 *  the same reason it is one here: text-text-3 on ink is under 3:1, so the two
 *  grounds cannot share one. */
const LABEL = 'block text-[11px] font-semibold tracking-[0.13em] text-text-on-ink-2 uppercase'

/** Underlined rather than boxed, on the footer's own hairline colour, so the
 *  field is a line to write on rather than a box to fill in. `peer` is what lets
 *  the rule below know it has focus.
 *
 *  ── Two things it turns off ─────────────────────────────────────────────
 *  The boxed focus ring. The design system draws 2px of gold around anything
 *  focused, which is right for a button and wrong for a rule: it puts a
 *  rectangle around a field that has three sides missing, and the field jumps
 *  from a line to a box the moment you reach it. Gold is not lost — it moves
 *  into the rule under the field, which is where a focus ring belongs on a
 *  field shaped like this. `outline-none` only ever applies with the rule
 *  underneath it, so the field is never focused without something showing.
 *
 *  And the autofill wash. Chrome paints an autofilled field with its own pale
 *  background and near-black text, which on ink is a white slab with unreadable
 *  type in it. The two -webkit properties are the only way to refuse it: an
 *  inset shadow big enough to cover the box, and a text fill colour, because
 *  autofill ignores `color`. */
const FIELD =
  'peer block w-full border-b border-line-ink bg-transparent py-2 text-[15.5px] text-text-on-ink ' +
  'placeholder:text-text-3 transition-colors duration-200 focus-visible:outline-none ' +
  'autofill:[-webkit-box-shadow:inset_0_0_0_1000px_var(--color-ink)] ' +
  'autofill:[-webkit-text-fill-color:var(--color-text-on-ink)]'

export default function Letter() {
  const uid = useId()
  const fieldRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  /** The honeypot's value, kept out of `email` so that nothing typed into it
   *  can reach the list whatever else changes in here. */
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
    <section aria-labelledby={`${uid}-head`} className="relative isolate overflow-hidden">
      {/* The wash. It falls from the corner the heading starts in and is spent
          by the hairline, so the footer darkens as it goes down. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(115%_150%_at_10%_0%,rgba(47,107,90,0.24)_0%,transparent_62%)]"
      />

      {/* The rule is on the container rather than the section, so it lines up
          with the one over the footer's small print. */}
      <div className="gutter relative mx-auto max-w-page border-b border-line-ink py-s5">
        <div className="grid gap-s3 lg:grid-cols-12 lg:items-end lg:gap-s4">
          {/* ---------- what the letter is ---------- */}
          <Reveal className="lg:col-span-5">
            <p className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.16em] text-paper/75 uppercase">
              <span aria-hidden="true" className="h-px w-6 bg-paper/45" />
              {LETTER.eyebrow}
            </p>

            {/* Two steps down from a section heading, on purpose. This is the
                last thing the page says, not a seventh argument. */}
            <h2
              id={`${uid}-head`}
              className="mt-s1 max-w-[16ch] font-display text-[clamp(23px,2.4vw,29px)] leading-snug text-paper"
            >
              {LETTER.title}
            </h2>
          </Reveal>

          {/* ---------- the ask ---------- */}
          <Reveal delay={120} className="lg:col-span-6 lg:col-start-7">
            {joined !== 'no' ? (
              /* Lands where the field was, and arrives rather than appearing.
                 The contact form's reply is a pale green card; on ink that
                 becomes the faintest lift of the ground under a green-pale
                 rule, which is the same gesture in the only two colours that
                 read down here. */
              <div
                role="status"
                className="border-t-2 border-green-pale bg-paper/[0.055] p-s3"
                style={{ animation: 'hero-rise 620ms var(--ease-brand) both' }}
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-green-pale text-ink">
                  <Check className="h-[18px] w-[18px]" />
                </span>
                <p className="mt-s2 font-display text-[20px] leading-snug text-paper">
                  {joined === 'endpoint' ? LETTER.joined.title : LETTER.joined.handedOff}
                </p>
                <p className="mt-1 text-[14.5px] leading-relaxed text-text-on-ink-2">
                  {joined === 'endpoint' ? (
                    LETTER.joined.body
                  ) : (
                    <>
                      {LETTER.joined.handedOffBody}{' '}
                      <a
                        href={`mailto:${ORG.email}`}
                        className="text-green-pale underline underline-offset-4"
                      >
                        {ORG.email}
                      </a>
                      .
                    </>
                  )}
                </p>
                <button
                  type="button"
                  onClick={again}
                  className="mt-s2 text-[14px] text-green-pale underline decoration-green-pale/30 underline-offset-4 transition-colors hover:decoration-green-pale"
                >
                  {LETTER.joined.again}
                </button>
              </div>
            ) : (
              <form noValidate onSubmit={onSubmit}>
                {/* The honeypot. Off-screen rather than display:none — a bot
                    that checks for the latter skips it, which is the one thing
                    it must not do. Hidden from people and from screen readers,
                    and never focusable by tabbing. */}
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

                {/* The field and the button share a baseline on anything wider
                    than a phone, and stack on one. `items-end` is what keeps the
                    button standing on the field's rule rather than floating
                    beside its label. */}
                <div className="flex flex-wrap items-end gap-s2 sm:flex-nowrap">
                  <div className="min-w-[200px] flex-1">
                    <label htmlFor={`${uid}-email`} className={LABEL}>
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
                          /* The complaint clears the moment the thing it
                             complained about changes. Being told off while you
                             are typing the fix is the worst of both. */
                          if (errors.email) setErrors({})
                        }}
                        /* Checked on the way out, but never complained about
                           for being empty on the way past: this field is not
                           something the page asked anybody to fill in. */
                        onBlur={() => {
                          if (email.trim()) setErrors(validate(payload()))
                        }}
                        aria-invalid={errors.email ? 'true' : undefined}
                        aria-describedby={errors.email ? `${uid}-bad` : undefined}
                        className={`${FIELD} ${errors.email ? 'border-alert-pale' : ''}`}
                      />

                      {/* The rule that draws itself along the foot of the field
                          as you enter it, and retracts the same way when you
                          leave. It is gold, and it is doing the job the boxed
                          outline was: this IS the focus ring, in the one colour
                          the design system allows one to be, drawn to the shape
                          of the thing it is ringing. 6.9:1 on ink.

                          A field being complained about keeps it out and in
                          alert instead, because there the line is not a focus
                          state, it is the complaint. */}
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left transition-transform duration-300 ease-brand ${
                          errors.email
                            ? 'scale-x-100 bg-alert-pale'
                            : 'scale-x-0 bg-gold peer-focus:scale-x-100'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Not a filled button. A green slab at the end of the field
                      was the one loud object in the footer, and it read as a
                      second Donate — the give action is gold, it is at the top
                      of every page, and nothing down here should compete with
                      it for the same glance. So the action is set as type, in
                      the label's own uppercase, standing on the end of the
                      field's rule: at this size the rule and the words are one
                      control, which is what it is.

                      It keeps a 46px box so the tap target survives the change,
                      brightens to full paper on hover, and takes the paper
                      plane the contact form's Send button uses — the one icon
                      on the site that already means "this goes somewhere". */}
                  <button
                    type="submit"
                    disabled={sending}
                    className="group inline-flex min-h-[46px] shrink-0 items-center gap-2 pb-2 text-[12px] font-semibold tracking-[0.16em] text-green-pale uppercase transition-colors duration-200 ease-brand hover:text-paper disabled:pointer-events-none disabled:opacity-70"
                  >
                    {sending ? (
                      <>
                        {LETTER.sending}
                        {/* A ring with one transparent quarter, spun. No icon
                            and no dependency for what is two borders. */}
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

                {/* The row is here whether or not there is anything in it. This
                    column is bottom-aligned against the paragraph beside it, so
                    a message that arrived out of nothing would shove the field
                    and the button up the page as somebody was reaching for
                    them. Reserving the line costs 18px of air under the field
                    and keeps the footer exactly one height. */}
                <p id={`${uid}-bad`} className="mt-1.5 min-h-[18px] text-[13px] text-alert-pale">
                  {errors.email}
                </p>

                {failed && (
                  <p
                    role="alert"
                    className="mt-s2 border-l-2 border-alert-pale bg-alert-pale/10 px-s2 py-s1 text-[13.5px] text-alert-pale"
                  >
                    {failed}{' '}
                    <a
                      href={`mailto:${ORG.email}`}
                      className="underline underline-offset-4 hover:decoration-2"
                    >
                      {ORG.email}
                    </a>
                  </p>
                )}
              </form>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  )
}
