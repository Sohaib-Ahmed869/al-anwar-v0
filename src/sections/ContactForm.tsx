import { useId, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ArrowRight, Check, Copy, Mail, MapPin, Phone, Send } from '../components/icons'
import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import {
  CONTACT,
  DIRECTIONS,
  FORM_ID,
  MESSAGE_MAX,
  MESSAGE_MIN,
  TOPICS,
} from '../components/contact-data'
import { useDesk } from '../components/desk-status'
import { PHONE } from '../components/nav-data'
import { ORG } from '../components/org-data'
import {
  submit,
  tidyPhone,
  validate,
  type ContactPayload,
  type FieldErrors,
} from '../services/contact'

/* ---------------------------------------------------------------------------
   Contact, section 2 of 3: the form, and how to reach us without it.

   17 SEPTEMBER 2026, on the About page's pattern: the shared SectionHead over
   the whole width (its action is the phone, at every size now), one ground
   with no paper-2 band, the form in a ruled card, and the details panel in
   the logo teal with the masjid standing faintly in its corner, like the
   mission panel on About. The photograph at the head of the panel is gone
   with the hero's. Fields, pills, the tally and the send button are teal.
   Some notes below still describe the older ink panel.

   The form is on the left and the details are on the right, and the form is
   first in the document — which is the reverse of how this section started.

   The old order was argued for on the grounds that somebody who would rather
   ring should not have to scroll past a form to find the number. That is still
   true and it is still paid for, but not by handing the whole left-hand column
   to it: the hero's second button is Call, the header carries the number, and
   on a narrow screen — the only place the panel genuinely does sit below the
   form — there is a line under the intro offering the phone before a single
   field. What the old order cost was the page's own emphasis. This page exists
   to be written to, and the thing it exists for was in the second column.

   ── The panel is one object, not a column of facts ──────────────────────
   The details are now a single ink panel with a photograph at the head of it:
   picture, heading, whether anyone is at the desk, then the three ways of
   reaching us as a ruled ledger. It is built the way the give card in
   HomeAsk.tsx is — one rounded object, a photograph running to the corner
   radius, a dark plinth under it — because that is already the site's way of
   saying "this is one thing", and because a dark column against a paper-2
   ground is what gives this section a shape at all. Flat beige from edge to
   edge with two headings on it was the problem being fixed.

   This does not reopen the page's no-boxes rule. That rule is against a border
   per fact — three carded facts, and a fourth card repeating all three of them
   beside the map that used to close the page. Inside the panel the facts are
   still rules and rows with nothing drawn around any of them; what changed is
   the ground they sit on.

   ── What moves ─────────────────────────────────────────────────────────
   Four things, and each of them answers something rather than decorating it:

     the photograph  eases in a little under the pointer, the same slow push
                     the appeal cards on the home page use
     the rows        draw a pale rule along their own top hairline as the
                     pointer crosses them
     the fields      draw the same rule along their foot as you enter them
     the tally       a hairline above the button that fills as the form does

   The tally is the one new idea. Five things are required and a long form is
   easy to submit one short of; the rule says how far in you are without marking
   a field red before it has been left. It is not a live region — a count that
   spoke on every keystroke would be noise — and it says only what is filled in,
   never whether what is in there is right.

   ── The desk status ─────────────────────────────────────────────────────
   The panel says whether the office is open right now, and what the clock in
   Sydney reads. It is worked out through Intl from the visitor's own device, so
   it is right from anywhere in the world, and it is the same fact as
   PHONE.hours said in the present tense rather than a second one. See
   deskStatus() in components/desk-status.ts for what it does not know about.

   ── The subject field ───────────────────────────────────────────────────
   Chips on a wide screen, a native <select> on a narrow one, both bound to the
   same state and only one of them in the document at a time — `hidden` removes
   the other from the accessibility tree as well as from the layout, so a screen
   reader is never offered the choice twice.

   The chips are native radios with the pill drawn over them. The browser owns
   the arrow keys, the group semantics and what gets announced, and none of that
   is worth reimplementing; all the pill does is look like the control. The one
   thing it cannot do for itself is show focus, which is what
   `peer-focus-visible` on it is for.

   ── Validation ──────────────────────────────────────────────────────────
   The rules live in services/contact.ts, not here, because the server
   (zEnquiry in server/routes/public.ts) has to apply the same ones — validation
   that only runs in the browser is not validation. This file decides only WHEN to run them: on blur once a field
   has been left, and on submit. Never on the first keystroke. Being told an
   address is wrong while you are still on the third character of it is the
   worst version of this.

   PHOTOGRAPHY
     Al-Anwaar's own frame — a distribution from the back of a van at a camp,
     the same photograph the Tripoli appeal on the home page runs on. It is not
     stock, and it is not captioned: the type over it says how to reach the
     office, and nothing on the panel names the place, the date or the people.
     The path and the alt text are in contact-data.ts with the rest of the
     words, so the picture and the sentence describing it cannot drift apart.

   TODO before launch: ENDPOINT in services/contact.ts is empty, so the button
   hands the message to the writer's own email client and says so. Wire it up.
   What it must never do is swallow a message and show a tick.
--------------------------------------------------------------------------- */

const LABEL = 'block text-[11px] font-semibold tracking-[0.13em] text-text-3 uppercase'

/** The same label on the dark panel. Worth the second constant rather than a
 *  prop: text-text-3 on ink is under 3:1, so the two grounds cannot share one. */
const LABEL_INK = 'block text-[11px] font-semibold tracking-[0.13em] text-paper/70 uppercase'

/** Underlined rather than boxed: a row of outlines reads as a database form,
 *  and this is a letter. The gold ring on focus is the design system's, and it
 *  is left alone — it is what a keyboard user navigates by.
 *
 *  `block` matters: an input is inline by default, which leaves a few pixels of
 *  line-height under it, and the rule below is positioned against the bottom of
 *  the wrapper rather than the bottom of the field. `peer` is what lets that
 *  rule know the field has focus. */
const FIELD =
  'peer block w-full border-b border-line bg-transparent py-2 text-[15.5px] text-text ' +
  'placeholder:text-text-3 transition-colors duration-200 ' +
  /* No gold ring round a field (user's call, 17 Sep 2026): the drawn rule
     along its foot is the focus state, and a box round an underlined field
     read as a glow. Buttons and chips keep the ring. */
  'focus:outline-none focus-visible:outline-none'

const FIELD_BAD = 'border-alert'

/** The rule that draws itself along the foot of a field as you enter it, and
 *  retracts the same way when you leave. Two pixels of green over the hairline,
 *  wiping from the left — the same gesture the ledger rows in the panel beside
 *  it use on hover, and the same one the tally above the button fills on, so
 *  the section has one idea about what "this one, now" looks like rather than a
 *  different flourish per control.
 *
 *  A field that is being complained about keeps its rule out and in alert,
 *  because there the line is not a focus state, it is the complaint. */
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

const PILL =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-s2 py-1.5 text-[14px] ' +
  'transition duration-200 ease-brand ' +
  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold'

const PILL_ON = 'border-teal bg-teal text-paper shadow-[0_6px_16px_-10px_rgba(0,103,112,0.9)]'

/* No border colour of its own: an unchosen pill takes it from whether the group
   has been complained about. Two border-colour utilities on one element are
   settled by the order Tailwind happened to emit them in rather than the order
   they are written, so only one of them may ever be on it. */
const PILL_OFF = 'bg-paper text-text-2 hover:-translate-y-px hover:border-teal/45 hover:text-teal'

const EMPTY: ContactPayload = {
  name: '',
  email: '',
  phone: '',
  topic: '',
  message: '',
  consent: false,
  company: '',
}

/** What the tally counts: name, email, subject, message, consent. The phone
 *  number is not in it — that field is optional, and a tally that could never
 *  reach its own end would be worse than none. It is kept in step with
 *  validate() by hand, which is the one duplication in here; if a required
 *  field is ever added, this is the second place it has to go. */
const REQUIRED = 5

export default function ContactForm() {
  const uid = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)

  /* --- arriving with the subject already chosen ---------------------------
     The Get involved page sends people here from four different sections, and
     a reader who clicked "Write to us about volunteering" should not have to
     tell the form what they just told the link. `?topic=` fills the select and
     nothing else — the field is still a normal select the writer can change,
     and nothing is submitted for them.

     What arrives is checked against TOPICS rather than trusted. The value goes
     into the routing decision at the other end, so an unrecognised one is a
     stale link or a forgery; either way it is dropped and the form opens on
     "Choose one" as though nobody had asked. This is the same reasoning
     validate() applies to the same field in services/contact.ts.

     Read once, as the initial state, not in an effect: as a synced effect it
     would overwrite a subject the writer had already picked every time the
     query string changed underneath them. */
  const [params] = useSearchParams()
  const asked = params.get('topic')
  const wanted = TOPICS.find((t) => t === asked) ?? ''

  const [values, setValues] = useState<ContactPayload>(() => ({ ...EMPTY, topic: wanted }))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [sent, setSent] = useState<'no' | 'endpoint' | 'mail'>('no')

  const set = <K extends keyof ContactPayload>(key: K, value: ContactPayload[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    /* An error clears the moment the thing it complained about changes. Being
       told off while you are typing the fix is the worst of both. */
    setErrors((bad) => {
      if (!(key in bad)) return bad
      const { [key as keyof FieldErrors]: _gone, ...rest } = bad
      return rest
    })
  }

  /** Check one field, on the way out of it. Only ever adds a complaint about
   *  the field just left — the rest of the form is not marked up because
   *  somebody tabbed through the first box. */
  const checkOne = (key: keyof FieldErrors) => () => {
    const found = validate(values)[key]
    setErrors((bad) => (found ? { ...bad, [key]: found } : bad))
  }

  /** The textarea grows to fit rather than scrolling inside itself. Reset to
   *  auto first, or it can only ever get taller. */
  const grow = () => {
    const el = messageRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending) return

    const bad = validate(values)
    setErrors(bad)
    setFailed(null)

    if (Object.keys(bad).length) {
      /* Focus the first thing that is wrong, rather than leaving a screen
         reader to hunt for the red text. querySelector walks the document in
         order, so "first" here means first on the page, not first in the
         errors object. */
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }

    setSending(true)
    const result = await submit(values)
    setSending(false)

    if (!result.ok) {
      if (result.errors) setErrors(result.errors)
      setFailed(result.message)
      return
    }
    setSent(result.via)
  }

  const again = () => {
    setValues(EMPTY)
    setErrors({})
    setFailed(null)
    setSent('no')
  }

  const left = MESSAGE_MAX - values.message.length

  /* What the rule above the button fills to. The message only counts once it is
     past the length the validator asks for, so the tally and the field cannot
     disagree about whether that box is done. */
  const done =
    (values.name.trim() ? 1 : 0) +
    (values.email.trim() ? 1 : 0) +
    (values.topic ? 1 : 0) +
    (values.message.trim().length >= MESSAGE_MIN ? 1 : 0) +
    (values.consent ? 1 : 0)

  return (
    <section
      id={FORM_ID}
      aria-labelledby="form-head"
      className={`scroll-mt-[calc(var(--header-h)+24px)] ${SECTION_Y}`}
    >
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="form-head"
          eyebrow={CONTACT.form.eyebrow}
          title={CONTACT.form.title}
          lede={CONTACT.form.intro}
          action={
            <a
              href={PHONE.href}
              className="group flex shrink-0 items-center gap-1.5 text-[14.5px] font-semibold text-green transition-colors duration-200 ease-brand hover:text-ink"
            >
              {CONTACT.form.ratherRing}{' '}
              <span className="nums">{PHONE.label}</span>
              <ArrowRight className="h-3 w-3 -translate-x-0.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
            </a>
          }
        />

        <div
          className={`mt-s4 grid gap-s4 lg:mt-s5 lg:grid-cols-12 lg:items-start lg:gap-s4 xl:gap-s5 ${BREAKOUT}`}
        >
          {/* ---------- the form ---------- */}
          <Reveal
            variant="soft"
            className="rounded-2xl border border-line bg-paper p-s3 sm:p-s4 lg:col-span-7 lg:p-[clamp(32px,3.2vw,52px)]"
          >
            {sent !== 'no' ? (
              /* The one place on this page a border earns itself: something has
                 changed under you, and the reply needs to read as a different
                 kind of thing from the form it replaced. It arrives on the
                 ledger's own gesture — a green rule drawn along the top —
                 rather than simply appearing. */
              <div
                role="status"
                className="relative border-t-2 border-teal bg-teal/5 p-s3"
                style={{ animation: 'hero-rise 620ms var(--ease-brand) both' }}
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-teal text-paper">
                  <Check className="h-5 w-5" />
                </span>
                <p className="mt-s2 font-display text-[23px] leading-snug">
                  {sent === 'endpoint' ? CONTACT.form.sent.title : CONTACT.form.sent.handedOff}
                </p>
                <p className="mt-s1 max-w-measure text-[15px] leading-relaxed text-text-2">
                  {sent === 'endpoint' ? (
                    CONTACT.form.sent.body
                  ) : (
                    <>
                      {CONTACT.form.sent.handedOffBody}{' '}
                      <a
                        href={`mailto:${ORG.email}`}
                        className="text-green underline underline-offset-4"
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
                  className="mt-s2 text-[14px] text-green underline decoration-green/30 underline-offset-4 transition-colors hover:decoration-green"
                >
                  {CONTACT.form.sent.again}
                </button>
              </div>
            ) : (
              <form ref={formRef} noValidate onSubmit={onSubmit}>
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
                    value={values.company}
                    onChange={(e) => set('company', e.target.value)}
                  />
                </div>

                <div className="grid gap-s3 sm:grid-cols-2">
                  <Text
                    id={`${uid}-name`}
                    label={CONTACT.form.name}
                    value={values.name}
                    onChange={(v) => set('name', v)}
                    onBlur={checkOne('name')}
                    error={errors.name}
                    autoComplete="name"
                  />
                  <Text
                    id={`${uid}-email`}
                    label={CONTACT.form.email}
                    type="email"
                    value={values.email}
                    onChange={(v) => set('email', v)}
                    onBlur={checkOne('email')}
                    error={errors.email}
                    autoComplete="email"
                  />

                  <div className="sm:col-span-2">
                    <Text
                      id={`${uid}-phone`}
                      label={CONTACT.form.phone}
                      type="tel"
                      inputMode="tel"
                      value={values.phone}
                      onChange={(v) => set('phone', v)}
                      /* Tidied on the way out, so nobody watches their number
                         rearrange itself under the cursor as they type it. */
                      onBlur={() => {
                        set('phone', tidyPhone(values.phone))
                        checkOne('phone')()
                      }}
                      error={errors.phone}
                      hint={CONTACT.form.phoneHint}
                      autoComplete="tel"
                    />
                  </div>

                  {/* ---------- what it is about ---------- */}
                  <div className="sm:col-span-2">
                    {/* Narrow screens: a real select. Six pills wrap to three
                        ragged lines on a phone, and the native picker is a
                        better control there in every way. */}
                    <div className="sm:hidden">
                      <label htmlFor={`${uid}-topic`} className={LABEL}>
                        {CONTACT.form.topic}
                      </label>
                      <div className="relative">
                        <select
                          id={`${uid}-topic`}
                          value={values.topic}
                          onChange={(e) => set('topic', e.target.value)}
                          onBlur={checkOne('topic')}
                          aria-invalid={errors.topic ? 'true' : undefined}
                          aria-describedby={errors.topic ? `${uid}-topic-bad` : undefined}
                          className={`${FIELD} ${errors.topic ? FIELD_BAD : ''}`}
                        >
                          <option value="">{CONTACT.form.topicPlaceholder}</option>
                          {TOPICS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <Underline bad={!!errors.topic} />
                      </div>
                    </div>

                    {/* Wide screens: the six as chips, all visible at once. */}
                    <fieldset className="hidden sm:block">
                      <legend className={LABEL}>{CONTACT.form.topic}</legend>
                      <div className="mt-s2 flex flex-wrap gap-s1">
                        {TOPICS.map((t, i) => {
                          const on = values.topic === t
                          return (
                            <label key={t} className="inline-flex">
                              <input
                                type="radio"
                                name={`${uid}-topic-chips`}
                                value={t}
                                checked={on}
                                onChange={() => set('topic', t)}
                                /* Only the first chip of a bad group is
                                   marked, so the focus-the-first-problem query
                                   lands on the group once. */
                                aria-invalid={errors.topic && i === 0 ? 'true' : undefined}
                                className="peer sr-only"
                              />
                              <span
                                className={`${PILL} ${
                                  on
                                    ? PILL_ON
                                    : `${PILL_OFF} ${errors.topic ? 'border-alert/60' : 'border-line'}`
                                }`}
                              >
                                {t}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </fieldset>

                    {errors.topic && (
                      <p id={`${uid}-topic-bad`} className="mt-1.5 text-[13px] text-alert">
                        {errors.topic}
                      </p>
                    )}
                  </div>

                  {/* ---------- the message ---------- */}
                  <div className="sm:col-span-2">
                    <label htmlFor={`${uid}-message`} className={LABEL}>
                      {CONTACT.form.message}
                    </label>
                    <div className="relative">
                      <textarea
                        ref={messageRef}
                        id={`${uid}-message`}
                        rows={5}
                        value={values.message}
                        onChange={(e) => {
                          set('message', e.target.value)
                          grow()
                        }}
                        onBlur={checkOne('message')}
                        /* The one placeholder on the form. Every other field
                           says what it wants in two words above the line; this
                           one is a quarter of the section tall and empty, and
                           an empty box is the hardest question on any form. */
                        placeholder={CONTACT.form.messagePlaceholder}
                        aria-invalid={errors.message ? 'true' : undefined}
                        aria-describedby={`${uid}-message-hint${
                          errors.message ? ` ${uid}-message-bad` : ''
                        }`}
                        className={`${FIELD} min-h-[132px] resize-none overflow-hidden leading-relaxed ${
                          errors.message ? FIELD_BAD : ''
                        }`}
                      />
                      <Underline bad={!!errors.message} />
                    </div>

                    <div className="mt-1.5 flex items-start justify-between gap-s2">
                      <p id={`${uid}-message-hint`} className="text-[13px] text-text-3">
                        {CONTACT.form.messageHint}
                      </p>
                      {/* Visual only. A count that announces itself on every
                          keystroke is noise in a screen reader; the limit is in
                          the hint beside it, which is what is described.

                          It fades in on the first character rather than sitting
                          there reading 0/1000 at somebody who has not written
                          anything yet — a limit is only news once you are near
                          it, and a counter at rest is one more number on a page
                          that already has enough. */}
                      <p
                        aria-hidden="true"
                        className={`nums shrink-0 text-[13px] tabular-nums transition-opacity duration-300 ease-brand ${
                          values.message.length ? 'opacity-100' : 'opacity-0'
                        } ${left < 0 ? 'text-alert' : left < 100 ? 'text-text-2' : 'text-text-3'}`}
                      >
                        {values.message.length}/{MESSAGE_MAX}
                      </p>
                    </div>

                    {errors.message && (
                      <p id={`${uid}-message-bad`} className="mt-1 text-[13px] text-alert">
                        {errors.message}
                      </p>
                    )}
                  </div>

                  {/* ---------- consent ---------- */}
                  <div className="sm:col-span-2">
                    <label className="flex cursor-pointer items-start gap-s1 text-[14.5px] leading-relaxed text-text-2">
                      <input
                        type="checkbox"
                        checked={values.consent}
                        onChange={(e) => set('consent', e.target.checked)}
                        aria-invalid={errors.consent ? 'true' : undefined}
                        aria-describedby={errors.consent ? `${uid}-consent-bad` : undefined}
                        className="mt-[3px] h-[17px] w-[17px] shrink-0 accent-teal"
                      />
                      <span>{CONTACT.form.consent}</span>
                    </label>
                    {errors.consent && (
                      <p id={`${uid}-consent-bad`} className="mt-1 text-[13px] text-alert">
                        {errors.consent}
                      </p>
                    )}
                  </div>
                </div>

                {failed && (
                  <p
                    role="alert"
                    className="mt-s3 border-l-2 border-alert bg-alert/5 px-s2 py-s1 text-[14px] text-alert"
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

                <Tally done={done} />

                {/* Ink at rest, filling brand green under a pointer — the
                    reverse of every other button on the site, and deliberate.
                    This is the heaviest thing on the page and it should be:
                    sending the message is the only reason anybody came here.
                    Gold would be heavier still and gold is not available — it
                    is the give action and the focus ring and nothing else, and
                    Donate is in the header three inches above this. Ink is what
                    is left that outranks green. */}
                <div className="mt-s3 flex flex-wrap items-center gap-s2">
                  <button
                    type="submit"
                    disabled={sending}
                    className="group inline-flex min-h-[50px] items-center gap-2.5 rounded-[10px] bg-teal px-s3 text-[15.5px] font-semibold text-paper transition duration-200 ease-brand hover:-translate-y-px hover:bg-ink disabled:pointer-events-none disabled:opacity-70"
                  >
                    {sending ? (
                      <>
                        {CONTACT.form.sending}
                        {/* A ring with one transparent quarter, spun. No icon
                            and no dependency for what is two borders. */}
                        <span
                          aria-hidden="true"
                          className="h-4 w-4 animate-spin rounded-full border-2 border-paper/35 border-t-paper"
                        />
                      </>
                    ) : (
                      <>
                        {CONTACT.form.send}
                        <Send className="h-4 w-4 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>

                  <p className="text-[13px] text-text-2">
                    {CONTACT.form.privacy}{' '}
                    <Link
                      to="/privacy"
                      className="text-green underline decoration-line underline-offset-4 hover:decoration-green"
                    >
                      {CONTACT.form.privacyLink}
                    </Link>
                    .
                  </p>
                </div>
              </form>
            )}
          </Reveal>

          {/* ---------- reach us directly ----------
              Sticky from lg, the way the About page's story column is: the form
              beside it is half as tall again, and a panel that stopped a third
              of the way down left a hole the size of a laptop screen next to the
              message box. Sticky, the three ways of reaching us stay level with
              whatever field you are in — which is the point of putting them
              beside the form rather than under it. */}
          <Reveal
            variant="soft"
            delay={120}
            className="lg:sticky lg:top-[calc(var(--header-h)+40px)] lg:col-span-5 lg:self-start"
          >
            <Panel />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* --- the tally -----------------------------------------------------------
   A hairline above the button that fills as the five required fields do, and a
   count beside it that fades in once there is something to count.

   It is a transform rather than a width: a scaled span is composited, and this
   one animates on a page where somebody is typing.

   Not a live region, and deliberately no progressbar role. It is the same
   information the fields already carry, said in a way that only makes sense
   visually — a screen reader is told what is missing field by field, on blur
   and on submit, which is more use than a running total.
--------------------------------------------------------------------------- */
function Tally({ done }: { done: number }) {
  const all = done === REQUIRED

  return (
    <div className="mt-s4">
      <p
        className={`text-[12.5px] transition-opacity duration-300 ease-brand ${
          done ? 'opacity-100' : 'opacity-0'
        } ${all ? 'font-medium text-teal' : 'text-text-2'}`}
      >
        {all
          ? CONTACT.form.progressDone
          : CONTACT.form.progress
              .replace('{done}', String(done))
              .replace('{total}', String(REQUIRED))}
      </p>

      <div className="relative mt-1.5 h-px w-full bg-line">
        <span
          aria-hidden="true"
          className="absolute -top-px left-0 h-[2px] w-full origin-left bg-teal transition-transform duration-500 ease-brand"
          style={{ transform: `scaleX(${done / REQUIRED})` }}
        />
      </div>
    </div>
  )
}

/* --- the panel -----------------------------------------------------------
   One object: a photograph, the heading standing on the foot of it, whether
   anybody is at the desk, and then the three ways of reaching us.

   The ledger inside it is a ruled list rather than three cards. They were
   cards: each one a rounded rectangle with its own border, its own white fill,
   its own icon in a rounded chip, lifting on hover. Three of those stacked next
   to a map card, a form and a social band gave the page nine bordered
   rectangles down one screen, which is the look every generated contact page
   has and the reason this one read as one. Boxing a phone number does not make
   it easier to find; it makes it one more thing with a frame around it. The map
   has since gone with them — see the note in pages/Contact.tsx.

   So the rows are content and one hairline between each. The icon is set loose
   in the margin rather than in a chip, the value is three points larger than it
   was because it no longer has to share the row with a border, and the hover is
   a pale rule that draws itself across the top of the row from the left. The
   row is not a link — two of the three hold more than one thing to click — so
   nothing about it claims to be; the rule is a cursor finding its place, not a
   button lighting up.

   On ink the accent is green-pale rather than green: the brand green is a dark
   colour, and at 4.5:1 against #08262a it is not one anybody could read a link
   in. Gold is not an option — it belongs to the give action and the focus ring,
   and to nothing else on this site.
--------------------------------------------------------------------------- */
function Panel() {
  return (
    <div className="relative isolate overflow-hidden rounded-2xl bg-grad-lagoon-x text-paper shadow-card">
      {/* The logo's masjid, large and faint, standing in the corner. */}

      <div className="p-s3 sm:p-s4 lg:p-[clamp(32px,3vw,44px)]">
        <p className="font-script text-[clamp(26px,2.4vw,34px)] leading-none text-gold-pale">
          {CONTACT.reach.eyebrow}
        </p>
        <h2 className="mt-2 font-display text-[clamp(24px,2.4vw,32px)] leading-[1.12] tracking-[-0.02em] text-balance">
          {CONTACT.reach.title}
        </h2>

        <Desk />

        <ul className="mt-s3 list-none">
          <EmailRow />

          <ReachRow Icon={Phone} label={CONTACT.reach.phone.label}>
            <a
              href={PHONE.href}
              className="nums text-[17.5px] font-medium text-paper underline decoration-paper/30 decoration-1 underline-offset-[5px] transition-colors duration-200 hover:text-gold-pale hover:decoration-gold-pale/60"
            >
              {PHONE.label}
            </a>
            <span className="mt-1 block text-[13.5px] text-paper/70">{PHONE.hours}</span>
          </ReachRow>

          <ReachRow Icon={MapPin} label={CONTACT.reach.warehouse.label}>
            <span className="block text-[17.5px] font-medium text-paper">{ORG.street}</span>
            <span className="block text-[14px] text-paper/70">{ORG.suburb}</span>
            <a
              href={DIRECTIONS}
              target="_blank"
              rel="noreferrer noopener"
              className="group/link mt-1.5 inline-flex items-center gap-1.5 text-[13.5px] text-gold-pale underline decoration-gold-pale/30 underline-offset-4 transition-colors duration-200 hover:decoration-gold-pale"
            >
              {CONTACT.reach.warehouse.directions}
              <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover/link:translate-x-1" />
            </a>
          </ReachRow>
        </ul>
      </div>
    </div>
  )
}

/** Its own component, so a ticking clock does not re-render the form under
 *  somebody's cursor. Every thirty seconds, which is twice as often as the
 *  minute it shows: a clock polled on its own schedule rather than the minute's
 *  can be a whole minute stale, and thirty seconds halves that for one timer. */
function Desk() {
  const { open, clock, line } = useDesk()

  return (
    <div className="pt-s3">
      <div className="flex flex-wrap items-center justify-between gap-x-s2 gap-y-1">
        <p className="flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.13em] text-paper uppercase">
          {/* A dot, and while the desk is open a ring going out from it. It is
              the only thing on the panel that moves without being asked, which
              is what makes it read as "now" rather than as a label. */}
          <span aria-hidden="true" className="relative flex h-2 w-2 shrink-0">
            {open && (
              <span className="absolute inset-0 animate-ping rounded-full bg-gold-pale/60" />
            )}
            <span
              className={`relative h-2 w-2 rounded-full ${
                open ? 'bg-gold-pale' : 'bg-paper/40'
              }`}
            />
          </span>
          {open ? CONTACT.reach.desk.open : CONTACT.reach.desk.closed}
        </p>

        <p className="nums text-[13px] text-paper/70 tabular-nums">{clock}</p>
      </div>

      <p className="mt-s1 text-[14px] leading-relaxed text-paper/70">{line}</p>
    </div>
  )
}

/* --- the three ways of reaching us --------------------------------------- */

const ROW = 'group relative border-t border-paper/15 py-s3'

/** The hover rule, sitting exactly on the row's own top hairline and drawing in
 *  from the left. -top-px because the border is outside the padding box. */
function RowRule() {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-px left-0 h-px w-full origin-left scale-x-0 bg-gold-pale transition-transform duration-500 ease-brand group-hover:scale-x-100"
    />
  )
}

const ICON =
  'mt-[3px] h-[18px] w-[18px] shrink-0 text-paper/70 transition-colors duration-300 ease-brand group-hover:text-gold-pale'

function ReachRow({
  Icon,
  label,
  children,
}: {
  Icon: (p: { className?: string }) => React.ReactElement
  label: string
  children: React.ReactNode
}) {
  return (
    <li className={ROW}>
      <RowRule />
      <div className="flex gap-s2">
        <Icon className={ICON} />
        <div className="min-w-0">
          <p className={LABEL_INK}>{label}</p>
          <div className="mt-1.5">{children}</div>
        </div>
      </div>
    </li>
  )
}

/** The email row, with the one extra thing an address wants: a way to take it
 *  without selecting it by hand. The confirmation is on the button rather than
 *  in a floating toast — it is where the pointer already is, and there is
 *  nothing to dismiss.
 *
 *  The button used to be an outlined pill. It is now a plain label with an icon
 *  in front of it, for the same reason the cards went: a bordered capsule next
 *  to an address is a second thing competing for the row, and this one only has
 *  to be findable once somebody is already reading the address. */
function EmailRow() {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const copy = () => {
    navigator.clipboard?.writeText(ORG.email).then(
      () => {
        setCopied(true)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setCopied(false), 1800)
      },
      () => {
        /* Clipboard refused — a permissions prompt declined, or an insecure
           origin. The address is a mailto link three pixels away, so this stays
           quiet rather than raising an error about a convenience. */
      },
    )
  }

  return (
    <li className={ROW}>
      <RowRule />
      <div className="flex gap-s2">
        <Mail className={ICON} />

        <div className="min-w-0 flex-1">
          <p className={LABEL_INK}>{CONTACT.reach.email.label}</p>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-s2 gap-y-1">
            <a
              href={`mailto:${ORG.email}`}
              className="text-[17.5px] font-medium break-all text-paper underline decoration-paper/30 decoration-1 underline-offset-[5px] transition-colors duration-200 hover:text-gold-pale hover:decoration-gold-pale/60"
            >
              {ORG.email}
            </a>

            <button
              type="button"
              onClick={copy}
              className="inline-flex shrink-0 items-center gap-1.5 text-[13px] text-paper/70 transition-colors duration-200 hover:text-gold-pale"
            >
              {/* The tick lands in the space the clipboard icon was in, so the
                  label shifts by nothing when it changes. */}
              {copied ? (
                <Check className="h-3.5 w-3.5 text-gold-pale" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? CONTACT.reach.email.copied : CONTACT.reach.email.copy}
            </button>
          </div>
          {/* Announced once when it changes, rather than being part of the
              button's own name — a button whose label keeps changing is a
              button a screen reader user cannot find twice. */}
          <span role="status" className="sr-only">
            {copied ? CONTACT.reach.email.copied : ''}
          </span>
        </div>
      </div>
    </li>
  )
}

/* --- fields ------------------------------------------------------------- */

function Text({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  type = 'text',
  inputMode,
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  error?: string
  hint?: string
  type?: string
  inputMode?: 'text' | 'tel' | 'email'
  autoComplete?: string
}) {
  const described = [hint ? `${id}-hint` : null, error ? `${id}-bad` : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={described || undefined}
          className={`${FIELD} ${error ? FIELD_BAD : ''}`}
        />
        <Underline bad={!!error} />
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-[13px] text-text-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-bad`} className="mt-1 text-[13px] text-alert">
          {error}
        </p>
      )}
    </div>
  )
}
