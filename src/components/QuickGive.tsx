import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { ArrowRight, Check, ChevronDown, HandHeart } from './icons'
import { CAUSES, MIN_GIFT, money, type Cause } from './give-data'

/* ---------------------------------------------------------------------------
   The quick give: a fund, an amount and a Donate button, in one glass bar.

   It was the bar docked along the foot of HomeAsk, the home page's own give
   band. That band came off at the client's request (16 September 2026) and the
   bar moved into the foot of the hero, so the first screen is where someone
   can actually give from instead of a button that sends them somewhere else.

   A QUICK GIVE, NOT A CHECKOUT. One decision and a button. Donate hands over
   to /give with `?designation=<fund>&amount=<n>`, which GiveForm reads on
   arrival and opens on step 2 (details), so nothing chosen here is asked
   twice. The full form lives there and only there.

   THE FUND PICKER IS OUR OWN LISTBOX, not a native <select> — the browser's
   menu was a grey system list with a blue highlight dropped onto a designed
   card (client's request). One line per fund and nothing else. It always
   opens upward: the hero clips what hangs past its foot, and there is always
   room above the bar inside it. It follows the listbox pattern: arrows move, Enter or Space
   picks, Escape and a click outside close, Home and End jump. The funds stay
   in the charity's own order — see give-data.ts.

   TWO LAYOUTS. `bar` is the original, one row across a wide screen. `card`
   stacks fund, amount and Donate, for the right-hand side of the home hero
   (16 September 2026); its fund menu opens downward over the amounts, inside
   the card, instead of upward.

   THE BAR IS GLASS (client's request): a blurred, darkened pane of whatever is
   behind it, with white type. So it only belongs on a photograph.

   DONATE IS NEVER DISABLED. A faded gold button read as broken while someone
   was halfway through typing an amount. Pressed with no amount, it puts the
   cursor back in "Other" and says what it needs.
--------------------------------------------------------------------------- */

export default function QuickGive({
  className = '',
  layout = 'bar',
}: {
  className?: string
  layout?: 'bar' | 'card'
}) {
  const card = layout === 'card'
  const uid = useId()
  const navigate = useNavigate()
  const other = useRef<HTMLInputElement>(null)

  const [cause, setCause] = useState<Cause>(CAUSES[0])
  const [rung, setRung] = useState<number | null>(0)
  const [typed, setTyped] = useState('')
  const [nudge, setNudge] = useState(false)

  const typedValue = parseFloat(typed)
  const amount =
    rung !== null ? cause.amounts[rung].value : Number.isFinite(typedValue) ? typedValue : 0
  const valid = amount >= MIN_GIFT

  const pickCause = (next: Cause) => {
    setCause(next)
    setRung(0)
    setTyped('')
    setNudge(false)
  }

  const give = () => {
    if (!valid) {
      setRung(null)
      setNudge(true)
      other.current?.focus()
      return
    }
    navigate(`/give?designation=${cause.id}&amount=${amount}`)
  }

  return (
    <form
      id="give"
      aria-label="Give now"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        give()
      }}
      className={`relative isolate grid text-paper ${
        card
          ? 'gap-s3 p-s3 sm:p-[clamp(24px,2vw,32px)]'
          : 'gap-s3 p-s2 sm:p-s3 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_auto] lg:items-end lg:gap-0 lg:p-[clamp(20px,1.8vw,28px)]'
      } ${className}`}
    >
      {/* The glass is its own layer, not the bar's background. An element with
          backdrop-filter stops anything inside it from blurring what lies
          beyond it, and the fund menu hangs outside the bar. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 rounded-2xl border border-paper/15 bg-ink/50 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.5)] backdrop-blur-md"
      />

      {/* the fund */}
      <div className={card ? '' : 'lg:pr-s3'}>
        <p
          id={`${uid}-fund-label`}
          className="text-[12px] font-semibold tracking-[0.08em] text-paper/70 uppercase"
        >
          Give to
        </p>
        <FundPicker
          labelId={`${uid}-fund-label`}
          value={cause}
          onChange={pickCause}
          down={card}
          className="mt-2"
        />
      </div>

      {/* the amount */}
      <fieldset className={`relative ${card ? '' : 'lg:border-l lg:border-paper/15 lg:px-s3'}`}>
        <legend className="float-left text-[12px] font-semibold tracking-[0.08em] text-paper/70 uppercase">
          Amount <span className="font-normal normal-case tracking-normal">(AUD)</span>
        </legend>
        <div
          className={`clear-left grid grid-cols-3 gap-2 pt-2 ${
            card ? '' : 'sm:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.3fr)]'
          }`}
        >
          {cause.amounts.map((a, i) => {
            const on = rung === i
            return (
              <button
                key={`${cause.id}-${a.value}`}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setRung(i)
                  setTyped('')
                  setNudge(false)
                }}
                className={`nums h-14 rounded-xl text-[17px] font-semibold transition-[background-color,color,box-shadow] duration-200 ease-brand ${
                  on
                    ? 'bg-teal text-paper shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]'
                    : 'bg-paper/10 text-paper hover:bg-paper/20'
                }`}
              >
                {money(a.value)}
              </button>
            )
          })}
          <label
            className={`col-span-3 flex h-14 cursor-text items-center gap-1 rounded-xl px-4 transition-[background-color,box-shadow] duration-200 ease-brand ${
              card ? '' : 'sm:col-span-1'
            } ${
              nudge
                ? 'bg-paper/15 shadow-[inset_0_0_0_2px_var(--color-alert-pale)]'
                : rung === null
                  ? 'bg-paper/15 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.85)]'
                  : 'bg-paper/10 hover:bg-paper/20'
            }`}
          >
            <span aria-hidden="true" className="text-[17px] font-semibold text-paper/60">
              $
            </span>
            <span className="sr-only">Other amount, in Australian dollars</span>
            <input
              ref={other}
              inputMode="decimal"
              placeholder="Other amount"
              value={typed}
              aria-invalid={nudge || undefined}
              aria-describedby={nudge ? `${uid}-nudge` : undefined}
              onFocus={() => setRung(null)}
              onChange={(e) => {
                setRung(null)
                setNudge(false)
                setTyped(e.target.value.replace(/[^\d.]/g, ''))
              }}
              className="nums w-full min-w-0 bg-transparent text-[17px] font-semibold text-paper placeholder:text-[15px] placeholder:font-normal placeholder:text-paper/60 focus:outline-none"
            />
          </label>
        </div>
        {nudge && (
          <p
            id={`${uid}-nudge`}
            role="alert"
            className={`mt-2 text-[13px] text-alert-pale ${
              card ? '' : 'lg:absolute lg:top-full lg:left-s3 lg:mt-1.5'
            }`}
          >
            Enter an amount of {money(MIN_GIFT)} or more.
          </p>
        )}
      </fieldset>

      {/* the click */}
      <div className={card ? '' : 'lg:border-l lg:border-paper/15 lg:pl-s3'}>
        <button
          type="submit"
          className={`group relative inline-flex h-14 w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gold px-7 text-[16px] font-semibold whitespace-nowrap text-ink shadow-gold transition-[background-color,color,box-shadow,transform] duration-200 ease-brand hover:-translate-y-px hover:bg-gold-dark hover:text-paper hover:shadow-gold-lg active:translate-y-0 ${card ? '' : 'lg:w-auto lg:min-w-[13rem]'}`}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -left-full w-full bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,0.55)_50%,transparent_80%)] transition-transform duration-[750ms] ease-brand group-hover:translate-x-[250%]"
          />
          <HandHeart className="relative h-[18px] w-[18px] shrink-0" />
          <span className="nums relative">Donate{valid ? ` ${money(amount)}` : ''}</span>
          <ArrowRight className="relative h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
        </button>
      </div>
    </form>
  )
}

/* ---------------------------------------------------------------------------
   The fund picker. A button that opens a listbox; see the head of the file.
--------------------------------------------------------------------------- */
function FundPicker({
  labelId,
  value,
  onChange,
  down = false,
  className = '',
}: {
  labelId: string
  value: Cause
  onChange: (c: Cause) => void
  /** open below the button rather than above it */
  down?: boolean
  className?: string
}) {
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(() => CAUSES.indexOf(value))
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)

  /* close on a click anywhere else */
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  /* focus moves into the list when it opens, and the chosen fund is in view */
  useEffect(() => {
    if (!open) return
    list.current?.focus({ preventScroll: true })
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open])

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const show = () => {
    setActive(CAUSES.indexOf(value))
    setOpen(true)
  }

  const choose = (i: number) => {
    onChange(CAUSES[i])
    setOpen(false)
    button.current?.focus()
  }

  const onButtonKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      show()
    }
  }

  const onListKey = (e: KeyboardEvent) => {
    const last = CAUSES.length - 1
    const move: Record<string, () => void> = {
      ArrowDown: () => setActive((i) => Math.min(i + 1, last)),
      ArrowUp: () => setActive((i) => Math.max(i - 1, 0)),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => choose(active),
      ' ': () => choose(active),
      Escape: () => {
        setOpen(false)
        button.current?.focus()
      },
      Tab: () => setOpen(false),
    }
    const fn = move[e.key]
    if (!fn) return
    if (e.key !== 'Tab') e.preventDefault()
    fn()
  }

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${labelId} ${uid}-value`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onButtonKey}
        className={`flex h-14 w-full items-center gap-3 rounded-xl px-4 text-left transition-[background-color,box-shadow] duration-200 ease-brand ${
          open
            ? 'bg-paper/15 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.85)]'
            : 'bg-paper/10 hover:bg-paper/20'
        }`}
      >
        <span id={`${uid}-value`} className="min-w-0 flex-1 truncate text-[16px] font-semibold">
          {value.label}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-paper/70 transition-transform duration-300 ease-brand ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          ref={list}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelId}
          aria-activedescendant={`${uid}-opt-${active}`}
          onKeyDown={onListKey}
          className={`absolute left-0 z-30 max-h-[min(380px,50vh)] w-full overflow-y-auto overscroll-contain rounded-xl border border-paper/15 bg-ink/80 p-1.5 text-paper shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl focus:outline-none ${down ? 'top-[calc(100%+6px)]' : 'bottom-[calc(100%+6px)]'}`}
          style={{ animation: 'fade-in 160ms var(--ease-brand) both' }}
        >
          {CAUSES.map((c, i) => {
            const selected = c.id === value.id
            return (
              <li
                key={c.id}
                id={`${uid}-opt-${i}`}
                role="option"
                aria-selected={selected}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex h-10 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-[15px] transition-colors duration-150 ${
                  i === active ? 'bg-paper/12' : ''
                } ${selected ? 'font-semibold text-paper' : 'text-paper/80'}`}
              >
                <span className="truncate">{c.label}</span>
                {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
