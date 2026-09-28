import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'

import { ArrowRight, Check, HandHeart, Lock } from './icons'
import { OPERATING_COSTS } from '../services/give'

/* ---------------------------------------------------------------------------
   The give module. Ported from #hero-give in ../../index.html.

   THREE STEPS, BECAUSE ONE SCREEN WAS A WALL
   Everything used to be on one card at once: the intention, the ladder, your
   own amount, the frequency, the fee, the receipt and the button. Every one of
   those was defensible on its own and together they were a wall — seven
   bordered rectangles stacked down a column, all the same weight, asking seven
   questions before anything had been answered. It is a checkout, so it is
   three steps now, the shape /give was always specced as (see pages/Give.tsx):

     1  Amount    what this is for, and how much
     2  Details   who is giving, and who it is given for
     3  Pay       what will be charged, and the button that charges it

   Step 1 is the whole of the old form minus four rows, and that is the point.

   ONE PIECE OF STATE, AND NOTHING ON IT IS EVER STALE
   Tap $150 and the button reads "Give $150 to the food fund"; tap a different
   fund and the note, the ladder, the fee sentence and the button's destination
   all follow it; type your own amount and the ladder lets go.

   THERE IS NO FREQUENCY ON THIS FORM — READ BEFORE PUTTING ONE BACK
   The step used to end on a one-time/monthly segmented control, and it is gone.
   It was the last question on the step and the most expensive one on the card:
   every rung had to carry two labels, the panel beside the form two arithmetics
   and the receipt two futures, all for a decision most people make once and
   rarely here. A gift made on this card is a single gift.

   Monthly giving is not offered online at all for now — the client's call on
   15 September 2026, when the /give page was built one-time only. If it comes
   back it comes back as its own step, not as a fourth control under the
   amount, and on /give as well as here.

   IT ANSWERS EVERY TIME IT IS TOUCHED
   The first version was correct and inert: hard rectangles, a black half and a
   white half, three boxes and a slab. Nothing moved, so nothing felt like it
   was listening. Every control now replies —

     · the stepper fills in behind you, and a step you have been through stays
       clickable so going back to change the amount costs one tap;
     · a rung of the ladder lifts under the pointer and, once it is chosen,
       takes a green edge, a pale green ground and a filled tick that scales in;
     · the field for your own amount draws a green rule along its foot as you
       enter it, which is the same gesture ContactForm uses;
     · the button is the site's gold button, the one in the hero and the header,
       shine and lift and all.

   THE COLOUR RULE DECIDES WHICH BUTTON IS WHICH
   Gold is the act of giving and nothing else, so only the last button on the
   last step is gold. "Continue" is the site's green button — the one on the
   contact form — and green is also the choice you have made, on a chip, a rung
   or a step already done. The two never appear on the same control.

   THE FIRST QUESTION IS WHAT KIND OF GIFT IT IS
   A Muslim donor does not begin with an amount, they begin with an intention:
   this is my zakat, this is sadaqah, this is the fidyah I owe for the fasts I
   could not keep. The niyyah is the first control on the first step, and the
   amount is the second, because the amount for half of these is decided by the
   intention rather than by generosity.

   NINE FUNDS, SO THEY ARE PILLS AND NOT TILES
   The list is the charity's own, and it is nine long. Three of anything can be
   a row of tiles with a word of Arabic stacked over a word of English; nine
   cannot — that is 560px of chrome before a single amount is on screen. They
   are small pills that wrap, the way a filter row wraps, and the Arabic moved
   into the note line under them, where only the chosen fund's is set and there
   is one of it instead of nine.

   Nine also means the note has to be one line. If a fund cannot be explained in
   one line it is the fund's name that is wrong, not the line.

   A FUND IS NOT A LABEL — IT CHANGES WHERE THE MONEY GOES
   Each fund carries its own ladder, its own place and its own appeal, and the
   whole card follows it: the note, the impact panel, the fee sentence and the
   button's destination. That is not decoration. Kaffarah is sixty meals and
   fidyah is one meal a day; zakat ul fitr is a fixed head price paid before the
   Eid prayer; the education fund is a building. Offering them one shared ladder
   would be the card's one real lie.

   A ladder only carries "this buys X" labels where somebody has actually costed
   the unit. The education, sadaqah, zakat and emergency rungs are figures and
   nothing else, because nobody has costed a classroom or a general fund for us
   and the ladder is not the place to invent one.

   THE MONEY IS SET IN THE DISPLAY SLOT
   Every figure takes `font-display` — the rungs of the ladder, the field you
   type into, the total — which is the move the rest of the page already makes:
   the display slot carries the thing that matters and the body face carries
   the explanation of it. The site runs on one face now, so that difference is
   weight and size rather than a second family; see the type note in index.css.

   IT ADDS UP OUT LOUD
   The fee tick used to say "add $1.30" while the button under it still said
   "Give $50", so the one number the form never showed was the number that would
   leave the account. The pay step is a receipt: the donation, any operating
   costs (the fee tick's successor, see below), and the
   total in the display face at the end of it, and nothing else — the line under
   it is set small and grey because the sum is the working, not the point.

   THE DETAILS DO NOT GO IN THE URL
   Step 2 collects a name and an email, and they are handed to /give in the
   router's own location state rather than the query string. A donor's address
   in a link is a donor's address in a browser history, a referrer header and
   anything that logs URLs. The query string carries only what /give needs to
   redraw itself if the link is opened cold: appeal, designation, amount,
   frequency, and ops (the operating-costs dollars, when one was chosen).

   EVERY GROUP IS A RADIO GROUP AND BEHAVES LIKE ONE
   All three are `role="radiogroup"` with a roving tabindex, so the arrow keys
   walk the options and Tab leaves the group in one press rather than three.
   Typing an amount unchecks every rung, which is the honest state: at that
   point none of them is the answer.

   IT CARRIES NO GROUND OF ITS OWN
   No card, no padding, no background: it takes the surface it is put on, and
   HomeAsk puts it inside the white half of a card. Somewhere darker it would
   need light type and is not ready for it.

   `onChange` exists so a section can echo the choice outside the form — HomeAsk
   rewrites the headline, the paragraph, the photograph and the panel under it
   as the card is used, which is the only reason to lift this state at all.

   It lives in components/ rather than beside the hero because the appeal page
   and the event page both want one too (SITE-STRUCTURE.md). The /give page does
   not use the card itself — it has four steps and a real pay step — but it
   imports the form furniture exported from here (Field, Tick, the buttons, the
   donor check, the money formats), so the two forms cannot drift apart.
--------------------------------------------------------------------------- */

/* The operating-cost amounts live in shared/operating-costs.ts (read here via
   services/give.ts), so the server charges exactly what the card offers.

   OPERATING COSTS, NOT A CARD FEE (28 September 2026, client feedback)
   The pay step used to end on "Add $1.30 so the full $50 reaches Yemen", a
   percentage of the gift. The client asked for the opposite message: the
   charity takes a 0% admin fee on donations. So the step now says that in one
   line and, under it, offers a small fixed contribution to operating costs —
   $2, $5 or $10 — with "No thanks" chosen until the donor picks otherwise.
   OperatingCostsChoice below is that control, and /give uses it too. */

/** An amount on the ladder, and what it buys. The label is optional: a fund
 *  with no costed unit shows its rungs as figures and lets the panel beside
 *  the form say what the gift is. */
export type GiveAmount = {
  value: number
  /** four or five words — "One family, one month", "A family of four" */
  label?: string
}

/** A fund: the intention a gift is made under, and the work that intention can
 *  actually pay for. Choosing one reconfigures the whole card. */
export type GiveCause = {
  /** handed to /give as ?designation= — the same param the nav's zakat link uses */
  id: string
  label: string
  /** the same word in the Arabic face, set in the note line. Absent for the
   *  funds that are English names rather than fiqh terms. */
  arabic?: string
  /** ONE line under the row: what this is, and what it pays for here */
  note: string
  /** the fund in words, as it appears in the button label */
  appeal: string
  /** the appeal's slug, handed to /give */
  slug: string
  /** who the money reaches, for the fee sentence: "…reaches Yemen" */
  place: string
  amounts: GiveAmount[]
}

/** What the form is currently saying, for anyone rendering alongside it. */
export type GiveChoice = {
  cause: GiveCause
  amount: number
  /** the chosen rung's label, or null once an amount has been typed — and
   *  null throughout for a fund whose rungs carry no label */
  impact: string | null
}

type Props = {
  /** the funds this card can be given to, in the charity's own order */
  causes: GiveCause[]
  /** told whenever the choice changes. Not called on the way past — only when
   *  the fund, the amount or the rung actually moves. */
  onChange?: (choice: GiveChoice) => void
  className?: string
}

/** Who is giving, and who it is given for. Handed to /give in router state. */
export type Donor = {
  first: string
  last: string
  email: string
  /** a gift made in someone else's name — common for jariyah */
  behalf: boolean
  behalfName: string
  updates: boolean
  /** leave the first name out of the site's recent-gifts feed. Optional so
   *  a donor handed over in router state from an older link still works. */
  anonymous?: boolean
}

export const EMPTY_DONOR: Donor = {
  first: '',
  last: '',
  email: '',
  behalf: false,
  behalfName: '',
  updates: false,
  anonymous: false,
}

export type DonorErrors = Partial<Record<'first' | 'last' | 'email' | 'behalfName', string>>

/* A whole dollar amount loses its cents; a fee and a total are always written
   to the cent, because those are the two numbers someone checks against a
   statement afterwards. */
export const money = (v: number) =>
  '$' + v.toLocaleString('en-AU', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })
export const money2 = (v: number) =>
  '$' + v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STEPS = ['Amount', 'Details', 'Pay']

/** Arrow keys, Home and End inside a radio group, resolved to an index. Returns
 *  null for every other key, so the handler can get out of the way. */
export const nextIndex = (key: string, from: number, count: number): number | null => {
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  if (key === 'ArrowRight' || key === 'ArrowDown') return (from + 1) % count
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (from - 1 + count) % count
  return null
}

/* Deliberately loose. The only thing worth catching here is a typo obvious
   enough that the receipt would bounce; anything stricter turns away real
   addresses, and the real check is that the mail arrives. */
const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

export const checkDonor = (d: Donor): DonorErrors => {
  const bad: DonorErrors = {}
  if (!d.first.trim()) bad.first = 'We would like to know who to thank.'
  if (!d.last.trim()) bad.last = 'And the rest of it.'
  if (!d.email.trim()) bad.email = 'The receipt needs somewhere to go.'
  else if (!looksLikeEmail(d.email)) bad.email = 'That address is missing something.'
  if (d.behalf && !d.behalfName.trim()) bad.behalfName = 'Whose name should it be given in?'
  return bad
}

/* --- the shared bits of form furniture ---------------------------------- */

export const LABEL = 'block text-[11px] font-semibold tracking-[0.14em] text-text-3 uppercase'

/** Underlined rather than boxed, exactly as on the contact form: a column of
 *  outlines reads as a database, and by this point in the card there are quite
 *  enough rectangles already. */
const FIELD =
  'peer block w-full border-b border-line bg-transparent py-2 text-[15.5px] text-text ' +
  'placeholder:text-text-3 transition-colors duration-200 focus:outline-none'

/** The rule that wipes along the foot of a field as you enter it and retracts
 *  the same way on the way out. Alert and held out while it is being
 *  complained about, because there the line is the complaint. */
export function Underline({ bad }: { bad?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left transition-transform duration-300 ease-brand ${
        bad ? 'scale-x-100 bg-alert' : 'scale-x-0 bg-green peer-focus:scale-x-100'
      }`}
    />
  )
}

export function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  type?: string
  autoComplete?: string
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-bad` : undefined}
          className={`${FIELD} ${error ? 'border-alert' : ''}`}
        />
        <Underline bad={!!error} />
      </div>
      {error && (
        <p id={`${id}-bad`} className="mt-1 text-[13px] text-alert">
          {error}
        </p>
      )}
    </div>
  )
}

/** A tick box drawn rather than native, so it can animate and take the gold
 *  ring. The real checkbox is still there for the keyboard and the reader. */
export function Tick({
  checked,
  onChange,
  className = '',
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`mt-[2px] grid h-[19px] w-[19px] shrink-0 place-items-center rounded-[6px] border transition-[background-color,border-color] duration-200 ease-brand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold ${
          checked ? 'border-green bg-green' : 'border-line bg-paper'
        }`}
      >
        <Check
          className={`h-[11px] w-[11px] text-paper transition-[opacity,transform] duration-200 ease-brand ${
            checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
          }`}
        />
      </span>
      <span className="text-[13.5px] leading-[1.45] text-text-2">{children}</span>
    </label>
  )
}

/** The green button. Gold is the give action alone, so every button before the
 *  last one on the last step is this. */
export const NEXT_BUTTON =
  'group inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-[12px] bg-green ' +
  'px-s3 text-[15.5px] font-semibold text-paper transition duration-200 ease-brand ' +
  'hover:-translate-y-px hover:bg-ink'

export const BACK_BUTTON =
  'inline-flex min-h-[52px] shrink-0 items-center justify-center rounded-[12px] px-4 text-[14.5px] ' +
  'font-semibold text-text-3 transition-colors duration-200 ease-brand hover:text-ink'

/** "0% admin fee on donations", then the optional operating-costs choice as a
 *  radio group of four: No thanks, $2, $5, $10. `value` is in dollars. The
 *  tone follows the form it sits in — green on the home card, teal on /give —
 *  because neither is the give action, so neither may be gold. */
export function OperatingCostsChoice({
  value,
  onChange,
  tone = 'green',
  className = '',
}: {
  value: number
  onChange: (dollars: number) => void
  tone?: 'green' | 'teal'
  className?: string
}) {
  const uid = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const at = Math.max(0, OPERATING_COSTS.indexOf(value))
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = nextIndex(e.key, at, OPERATING_COSTS.length)
    if (i === null) return
    e.preventDefault()
    onChange(OPERATING_COSTS[i])
    refs.current[i]?.focus()
  }
  const on = tone === 'teal' ? 'border-teal bg-teal text-paper' : 'border-green bg-green text-paper'
  const off = tone === 'teal' ? 'border-line bg-paper text-ink hover:border-teal/50' : 'border-line bg-paper text-ink hover:border-green/45'
  return (
    <div className={`rounded-[14px] border border-line-2 bg-paper-2/60 p-3.5 ${className}`}>
      <p className="text-[14px] font-semibold text-ink">Al-Anwaar takes a 0% admin fee on donations.</p>
      <p id={`${uid}-ops`} className="mt-1 text-[13px] leading-[1.45] text-text-2">
        Would you like to contribute to our operating costs? Optional, and added to what you pay.
      </p>
      <div
        role="radiogroup"
        aria-labelledby={`${uid}-ops`}
        onKeyDown={onKey}
        className="mt-2.5 grid grid-cols-4 gap-2"
      >
        {OPERATING_COSTS.map((v, i) => {
          const chosen = at === i
          return (
            <button
              key={v}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={chosen}
              tabIndex={chosen ? 0 : -1}
              onClick={() => onChange(v)}
              className={`min-h-[42px] rounded-[10px] border px-2 text-[13.5px] font-semibold transition-[border-color,background-color,color] duration-200 ease-brand ${
                chosen ? on : off
              }`}
            >
              {v === 0 ? 'No thanks' : <span className="nums">{money(v)}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function GiveModule({ causes, onChange, className = '' }: Props) {
  const uid = useId()

  const [step, setStep] = useState(0)
  /* How far anyone has got. The stepper lets you back into a step you have
     already been through and no further — a numbered circle you cannot use is
     a signpost, not a control. */
  const [reached, setReached] = useState(0)

  const [causeIndex, setCauseIndex] = useState(0)
  /* null once someone types their own amount — the ladder lets go */
  const [chosen, setChosen] = useState<number | null>(0)
  const [typed, setTyped] = useState('')
  /* dollars; 0 is "No thanks", the default */
  const [operatingCosts, setOperatingCosts] = useState(0)
  const [donor, setDonor] = useState<Donor>(EMPTY_DONOR)
  const [errors, setErrors] = useState<DonorErrors>({})

  const cause = causes[causeIndex]
  const amounts = cause.amounts
  /* A ladder with nothing to say about what a rung buys is set shorter, so the
     tiles are not three figures floating in an inch of nothing. */
  const labelled = amounts.some((a) => a.label)

  const typedAmount = parseFloat(typed.replace(/[^\d.]/g, ''))
  const custom = typedAmount > 0
  const rung = amounts[chosen ?? 0]
  const amount = custom ? typedAmount : rung.value
  const impact = custom ? null : (rung.label ?? null)

  const total = amount + operatingCosts

  const href =
    `/give?appeal=${cause.slug}&designation=${cause.id}&amount=${amount}` +
    (operatingCosts ? `&ops=${operatingCosts}` : '')

  /* The callback is held in a ref so an inline arrow from the parent cannot
     turn this into a render loop: the effect fires on the choice, never on the
     identity of the function that is told about it. */
  const notify = useRef(onChange)
  notify.current = onChange
  useEffect(() => {
    notify.current?.({ cause, amount, impact })
  }, [cause, amount, impact])

  /* The step that has just arrived takes the focus, or a keyboard user is left
     at the top of the document wondering what happened. It is only moved on a
     real step change, never on the first render. */
  const panelRef = useRef<HTMLDivElement>(null)
  const moved = useRef(false)
  useEffect(() => {
    if (moved.current) panelRef.current?.focus()
    moved.current = true
  }, [step])

  const go = (to: number) => {
    setStep(to)
    setReached((r) => Math.max(r, to))
  }

  /* Forward out of the details step is the only move that is allowed to fail,
     and when it does the focus goes to the first field being complained about
     rather than leaving a keyboard user at a button that did nothing. */
  const forward = () => {
    if (step === 1) {
      const bad = checkDonor(donor)
      setErrors(bad)
      const first = (['first', 'last', 'email', 'behalfName'] as const).find((k) => bad[k])
      if (first) {
        document.getElementById(`${uid}-${first === 'behalfName' ? 'behalf' : first}`)?.focus()
        return
      }
    }
    go(step + 1)
  }

  const setField = <K extends keyof Donor>(key: K, value: Donor[K]) => {
    setDonor((d) => ({ ...d, [key]: value }))
    /* A complaint clears the moment the thing it complained about changes.
       Being told off while you are typing the fix is the worst of both. */
    setErrors((bad) => {
      if (!(key in bad)) return bad
      const { [key as keyof DonorErrors]: _gone, ...rest } = bad
      return rest
    })
  }

  /* Typing deselects the ladder; clearing the field hands it back. */
  const handleTyped = (value: string) => {
    setTyped(value)
    const n = parseFloat(value.replace(/[^\d.]/g, ''))
    if (n > 0) setChosen(null)
    else if (chosen === null) setChosen(0)
  }

  /* Choosing a rung is always also abandoning whatever was typed. */
  const pick = (i: number) => {
    setChosen(i)
    setTyped('')
  }

  /* A fund brings its own ladder, so the old choice would be a rung that no
     longer exists — or worse, a $20 head price read as a kaffarah. Start again. */
  const pickCause = (i: number) => {
    setCauseIndex(i)
    setChosen(0)
    setTyped('')
  }

  /* Every group moves the selection with the arrow keys and takes the focus
     with it, which is what a radio group is supposed to do. */
  const causeRefs = useRef<(HTMLButtonElement | null)[]>([])
  const rungRefs = useRef<(HTMLButtonElement | null)[]>([])

  const onCauseKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = nextIndex(e.key, causeIndex, causes.length)
    if (i === null) return
    e.preventDefault()
    pickCause(i)
    causeRefs.current[i]?.focus()
  }

  const onLadderKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = nextIndex(e.key, chosen ?? 0, amounts.length)
    if (i === null) return
    e.preventDefault()
    pick(i)
    rungRefs.current[i]?.focus()
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className={className}>
      <h2 className="sr-only">Give to {cause.appeal}</h2>

      {/* --- the stepper ---
          It fills in behind you: a step already visited keeps its green disc
          and stays clickable, so going back to change the amount costs one tap
          rather than a scroll and a guess. The rule between two discs is the
          progress bar — there is no second bar, because two things drawing the
          same fact is how a form starts to feel like paperwork. */}
      <ol className="flex items-center">
        {STEPS.map((name, i) => {
          const done = i < step
          const now = i === step
          const open = i <= reached
          return (
            <li key={name} className={`flex items-center ${i ? 'min-w-0 flex-1' : 'shrink-0'}`}>
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={`mx-2 h-px min-w-3 flex-1 transition-colors duration-300 ease-brand ${
                    i <= step ? 'bg-green' : 'bg-line'
                  }`}
                />
              )}

              <button
                type="button"
                disabled={!open}
                aria-current={now ? 'step' : undefined}
                onClick={() => open && go(i)}
                className={`flex shrink-0 items-center gap-2 rounded-full transition-opacity duration-200 ease-brand ${
                  open ? 'cursor-pointer hover:opacity-70' : 'cursor-default'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-[12px] font-semibold transition-[background-color,border-color,color] duration-300 ease-brand ${
                    done
                      ? 'bg-green text-paper'
                      : now
                        ? 'bg-ink text-paper'
                        : 'border border-line text-text-3'
                  }`}
                >
                  {done ? <Check className="h-[11px] w-[11px]" /> : i + 1}
                </span>

                {/* On a phone three labels and two rules do not fit without the
                    rules collapsing to stubs, so only the step being worked on
                    keeps its word. The discs still say where you are. */}
                <span
                  className={`text-[11px] font-semibold tracking-[0.13em] whitespace-nowrap uppercase transition-colors duration-300 ease-brand ${
                    now ? 'inline text-ink' : `hidden sm:inline ${done ? 'text-text-2' : 'text-text-3'}`
                  }`}
                >
                  <span className="sr-only">Step {i + 1}: </span>
                  {name}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {/* Each step is remounted so it settles in rather than snapping, and takes
          the focus on arrival. */}
      <div
        key={step}
        ref={panelRef}
        tabIndex={-1}
        className="mt-s3 focus:outline-none"
        style={{ animation: 'hero-rise 380ms var(--ease-brand) both' }}
      >
        {/* ================= 1 · AMOUNT ================================== */}
        {step === 0 && (
          <>
            <h3 className="sr-only">Step 1 of 3: what for, and how much</h3>

            {/* --- which fund ---
                The intention comes first, because for most of the people
                reading this it genuinely does. Nine of them, so they are pills
                that wrap rather than tiles that stack: one line of type each,
                no Arabic, no ground of their own until one is chosen. */}
            <p id={`${uid}-kind`} className={LABEL}>
              What is this for?
            </p>

            <div
              role="radiogroup"
              aria-labelledby={`${uid}-kind`}
              onKeyDown={onCauseKey}
              className="mt-2 flex flex-wrap gap-1.5"
            >
              {causes.map((c, i) => {
                const on = causeIndex === i
                return (
                  <button
                    key={c.id}
                    ref={(el) => {
                      causeRefs.current[i] = el
                    }}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    tabIndex={on ? 0 : -1}
                    onClick={() => pickCause(i)}
                    className={`rounded-full border px-3 py-[6.5px] text-[12.5px] leading-[1.15] whitespace-nowrap transition-[border-color,background-color,color,transform] duration-200 ease-brand ${
                      on
                        ? 'border-green bg-green-pale font-semibold text-green'
                        : 'border-line bg-paper font-medium text-text-2 hover:-translate-y-px hover:border-green/45 hover:text-ink'
                    }`}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>

            {/* One line: the fund's own word in Arabic where it has one, and
                what the money does. This is the only place the Arabic is set,
                which is why it can be — nine of them on nine pills would be
                decoration. Remounted on the fund. */}
            <p
              key={cause.id}
              className="mt-2.5 text-[12px] leading-[1.5] text-text-3"
              style={{ animation: 'hero-rise 420ms var(--ease-brand) both' }}
            >
              {cause.arabic && (
                <>
                  <span dir="rtl" className="font-arabic text-[12.5px] text-green">
                    {cause.arabic}
                  </span>
                  <span aria-hidden="true"> · </span>
                </>
              )}
              {cause.note}
            </p>

            {/* --- the amount ladder ---
                The figure is the point of a rung, so it takes the top line to
                itself in the display face; the words it buys sit on the floor
                of the tile, which is what keeps all three bottom-aligned
                however they wrap. The tick sits in the flow beside the figure
                rather than floating over the corner, so a narrow column can
                never stack the two on top of each other. */}
            <p id={`${uid}-amount`} className={`${LABEL} mt-s3`}>
              Amount (AUD)
            </p>

            <div
              role="radiogroup"
              aria-labelledby={`${uid}-amount`}
              onKeyDown={onLadderKey}
              className="mt-2 grid grid-cols-3 gap-2.5"
            >
              {amounts.map((a, i) => {
                const on = chosen === i
                const label = a.label
                return (
                  <button
                    key={a.value}
                    ref={(el) => {
                      rungRefs.current[i] = el
                    }}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    tabIndex={(chosen ?? 0) === i ? 0 : -1}
                    onClick={() => pick(i)}
                    className={`flex flex-col items-start rounded-[14px] border p-3 text-left transition-[transform,border-color,background-color,box-shadow] duration-200 ease-brand sm:p-3.5 ${
                      labelled ? 'min-h-[100px]' : 'min-h-[64px]'
                    } ${
                      on
                        ? 'border-green bg-green-pale shadow-[inset_0_0_0_1px_var(--color-green),0_14px_28px_-20px_rgba(47,107,90,0.9)]'
                        : 'border-line bg-paper hover:-translate-y-0.5 hover:border-green/45 hover:shadow-[0_12px_22px_-16px_rgba(20,26,24,0.55)]'
                    }`}
                  >
                    <span className="flex w-full items-start justify-between gap-1">
                      <span
                        className={`nums font-display text-[20px] leading-none tracking-[-0.02em] transition-colors duration-200 ease-brand sm:text-[23px] lg:text-[26px] ${
                          on ? 'text-green' : 'text-ink'
                        }`}
                      >
                        {money(a.value)}
                      </span>

                      <span
                        aria-hidden="true"
                        className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-green text-paper transition-[opacity,transform] duration-200 ease-brand ${
                          on ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                        }`}
                      >
                        <Check className="h-[10px] w-[10px]" />
                      </span>
                    </span>

                    {label && (
                      <span className="mt-auto pt-2 text-[12px] leading-[1.3] text-text-2">
                        {label}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* --- or your own amount ---
                A rule and a dollar sign, not a fourth box: the ladder above is
                already three bordered rectangles and a fourth would read as a
                fourth rung. It goes green as it fills, because at that moment
                this field is the answer and the ladder is not. */}
            <label htmlFor={`${uid}-own`} className={`${LABEL} mt-s3`}>
              Other amount
            </label>

            <div className="relative mt-1">
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 font-display text-[19px] leading-none transition-colors duration-200 ease-brand ${
                  custom ? 'text-green' : 'text-text-3'
                }`}
              >
                $
              </span>
              <input
                id={`${uid}-own`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="Enter amount"
                value={typed}
                onChange={(e) => handleTyped(e.target.value)}
                className={`nums peer block w-full border-b bg-transparent py-2 pl-5 font-display text-[19px] tracking-[-0.01em] transition-colors duration-200 focus:outline-none placeholder:text-[15px] placeholder:font-normal placeholder:tracking-normal placeholder:text-text-3 ${
                  custom ? 'border-green text-green' : 'border-line text-text'
                }`}
              />
              <Underline />
            </div>

            <button type="button" onClick={forward} className={`${NEXT_BUTTON} mt-s4 w-full`}>
              Continue
              <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
            </button>
          </>
        )}

        {/* ================= 2 · DETAILS ================================= */}
        {step === 1 && (
          <>
            <h3 className="sr-only">Step 2 of 3: your details</h3>

            <p className="text-[12.5px] leading-[1.5] text-text-3">
              For your receipt. Nothing else, and never passed on.
            </p>

            <div className="mt-s3 grid gap-s3 sm:grid-cols-2">
              <Field
                id={`${uid}-first`}
                label="First name"
                value={donor.first}
                onChange={(v) => setField('first', v)}
                error={errors.first}
                autoComplete="given-name"
              />
              <Field
                id={`${uid}-last`}
                label="Last name"
                value={donor.last}
                onChange={(v) => setField('last', v)}
                error={errors.last}
                autoComplete="family-name"
              />
            </div>

            <div className="mt-s3">
              <Field
                id={`${uid}-email`}
                label="Email"
                type="email"
                value={donor.email}
                onChange={(v) => setField('email', v)}
                error={errors.email}
                autoComplete="email"
              />
            </div>

            {/* Giving in someone else's name is ordinary here and the reason
                a great deal of jariyah is given at all, so it is on the form
                rather than in an email afterwards. Closed until it is wanted. */}
            <div className="mt-s3 rounded-[14px] border border-line-2 bg-paper-2/60 p-3.5">
              <Tick checked={donor.behalf} onChange={(v) => setField('behalf', v)}>
                Give on behalf of someone else
              </Tick>

              {donor.behalf && (
                <div style={{ animation: 'hero-rise 380ms var(--ease-brand) both' }} className="mt-3">
                  <Field
                    id={`${uid}-behalf`}
                    label="Their name"
                    value={donor.behalfName}
                    onChange={(v) => setField('behalfName', v)}
                    error={errors.behalfName}
                  />
                </div>
              )}
            </div>

            <Tick
              checked={donor.updates}
              onChange={(v) => setField('updates', v)}
              className="mt-s3"
            >
              Keep me updated on this project
            </Tick>

            <div className="mt-s3 flex gap-2">
              <button type="button" onClick={() => go(0)} className={BACK_BUTTON}>
                Back
              </button>
              <button type="button" onClick={forward} className={NEXT_BUTTON}>
                Continue
                <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
              </button>
            </div>
          </>
        )}

        {/* ================= 3 · PAY ===================================== */}
        {step === 2 && (
          <>
            <h3 className="sr-only">Step 3 of 3: what will be charged</h3>

            {/* Everything settled so far, in two lines, each with the way back
                to the step that set it. A summary nobody can correct in place
                is a summary nobody reads. */}
            <dl className="rounded-[14px] border border-line-2 bg-paper-2/60 p-3.5 text-[13.5px]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <dt className="sr-only">Your donation</dt>
                  <dd className="leading-[1.45] text-text">
                    <span className="nums font-semibold">{money(amount)}</span> · {cause.label}
                  </dd>
                </div>
                <button
                  type="button"
                  onClick={() => go(0)}
                  className="shrink-0 text-[12.5px] font-semibold text-green underline decoration-green/35 underline-offset-2 transition-colors duration-200 ease-brand hover:text-ink hover:decoration-ink/40"
                >
                  Change
                </button>
              </div>

              <div className="mt-2.5 flex items-start justify-between gap-3 border-t border-line-2 pt-2.5">
                <div className="min-w-0">
                  <dt className="sr-only">From</dt>
                  <dd className="leading-[1.45] break-words text-text-2">
                    {donor.first} {donor.last} · {donor.email}
                    {donor.behalf && donor.behalfName && (
                      <span className="mt-0.5 block text-text-3">
                        On behalf of {donor.behalfName}
                      </span>
                    )}
                  </dd>
                </div>
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="shrink-0 text-[12.5px] font-semibold text-green underline decoration-green/35 underline-offset-2 transition-colors duration-200 ease-brand hover:text-ink hover:decoration-ink/40"
                >
                  Change
                </button>
              </div>
            </dl>

            {/* --- 0% admin fee, and the optional operating costs --- */}
            <OperatingCostsChoice value={operatingCosts} onChange={setOperatingCosts} className="mt-s3" />

            {/* --- the receipt ---
                The last thing read before the button, and the only place the
                number that actually leaves the account is written down. The
                total is in the display face because it is the figure being
                agreed to; what it is made of is in the small sans under it. */}
            <div className="mt-s3 flex items-end justify-between gap-4 border-t border-line-2 pt-3">
              <div className="min-w-0">
                <p className={LABEL}>Charged today</p>

                <p className="mt-1 text-[12px] leading-[1.4] text-text-3">
                  <span className="nums">{money(amount)}</span> donation
                  {operatingCosts > 0 && (
                    <>
                      {' + '}
                      <span className="nums">{money2(operatingCosts)}</span> operating costs
                    </>
                  )}
                </p>
              </div>

              <p className="nums shrink-0 font-display text-[clamp(23px,2.5vw,29px)] leading-none tracking-[-0.022em]">
                {money2(total)}
              </p>
            </div>

            {/* Gold is the give action and nothing else, and this is the same
                button as the one in the hero and the header — shine, lift and
                heart. The donor goes in the router's state, not the URL. */}
            <Link
              to={href}
              state={{ donor }}
              className="group relative mt-s2 flex min-h-[60px] w-full items-center justify-center gap-2.5 overflow-hidden rounded-[14px] bg-gold px-6 text-[16.5px] font-semibold tracking-[-0.006em] text-ink shadow-gold transition-[transform,box-shadow,background-color,color] duration-200 ease-brand hover:-translate-y-[1.5px] hover:bg-gold-dark hover:text-paper hover:shadow-gold-lg active:translate-y-0"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 -left-full w-full bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,0.55)_50%,transparent_80%)] transition-transform duration-[750ms] ease-brand group-hover:translate-x-[250%]"
              />
              <HandHeart className="relative h-[17px] w-[17px] shrink-0 transition-transform duration-300 ease-brand group-hover:scale-[1.14]" />
              {/* the button says exactly what will happen. One span, so the flex
                  container does not eat the spaces around the amount. */}
              <span className="relative">
                Give <span className="nums">{money(amount)}</span> to {cause.appeal}
              </span>
            </Link>

            <p className="mt-2.5 flex items-start justify-center gap-1.5 text-[12px] leading-relaxed text-text-3">
              <Lock className="mt-[3px] h-3 w-3 shrink-0" />
              Apple Pay, Google Pay, PayPal or card.
            </p>

            {/* No Back button on this step. There are already three ways out of
                it — two "Change" links in the summary and two lit steps in the
                stepper — and a fourth under the gold button would be one more
                grey thing between the total and the end of the card. */}
          </>
        )}
      </div>
    </form>
  )
}
