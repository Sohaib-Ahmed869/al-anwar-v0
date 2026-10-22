import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { ArrowRight, Check, ChevronDown, HandHeart } from './icons'
import { MIN_GIFT, money } from './give-data'
import { groupPicks, useQuickGive, type QuickPick } from '../services/quickgive'

/* ---------------------------------------------------------------------------
   The quick give: a cause, an amount and a Donate button, in one glass pane.

   It was the bar docked along the foot of HomeAsk, the home page's own give
   band. That band came off at the client's request (16 September 2026) and the
   bar moved into the foot of the hero, so the first screen is where someone
   can actually give from instead of a button that sends them somewhere else.

   A QUICK GIVE, NOT A CHECKOUT. One decision and a button. Donate hands over
   to /give with `?designation=<fund>&amount=<n>`, which GiveForm reads on
   arrival and opens on step 2 (details), so nothing chosen here is asked
   twice. The full form lives there and only there.

   THE PICKER IS OUR OWN LISTBOX, not a native <select> — the browser's menu
   was a grey system list with a blue highlight dropped onto a designed card
   (client's request). It follows the listbox pattern: arrows move, Enter
   picks, Escape and a click outside close, Home and End jump.

   THE LIST IS STAFF'S (28 September 2026, client's request). The options,
   their order and their headings come from Admin → Appeals through
   useQuickGive() (services/quickgive.ts), with the defaults in
   shared/quickgive.ts until the call lands or if it fails. Each option names
   the fund it pays into, and the fund still decides the amounts and what
   /give accepts. The first option is the priority and what the box opens on
   ("Where needed most").

   IT IS SEARCHABLE once the list is long: a filter box at the top of the menu
   (a combobox driving the listbox), with the options grouped under "Projects"
   and "Zakat & obligations". On a touch screen the filter is not focused on
   open, so the phone's keyboard does not cover the list someone came to tap.

   Choosing an option calls `onPick`, which HomeHero uses to put that
   project's photograph and words beside the box.

   TWO LAYOUTS. `bar` is the original, one row across a wide screen; its menu
   opens upward, because the hero clips what hangs past its foot. `card`
   stacks cause, amount and Donate for the right-hand side of the home hero
   (16 September 2026), under a "Donate now" heading (client's wording,
   28 September 2026 — it said "Give to"); its menu opens downward over the
   amounts, inside the card.

   THE PANE IS GLASS (client's request): a blurred, darkened pane of whatever
   is behind it, with white type. So it only belongs on a photograph.

   DONATE IS NEVER DISABLED. A faded gold button read as broken while someone
   was halfway through typing an amount. Pressed with no amount, it puts the
   cursor back in "Other" and says what it needs.
--------------------------------------------------------------------------- */

export default function QuickGive({
  className = '',
  layout = 'bar',
  onPick,
}: {
  className?: string
  layout?: 'bar' | 'card'
  /** told when the visitor chooses an option (not on the first render) */
  onPick?: (p: QuickPick) => void
}) {
  const card = layout === 'card'
  const uid = useId()
  const navigate = useNavigate()
  const other = useRef<HTMLInputElement>(null)

  const { picks } = useQuickGive()
  const [pickId, setPickId] = useState<string | null>(null)
  const pick = picks.find((p) => p.id === pickId) ?? picks[0]
  const cause = pick.cause
  const [rung, setRung] = useState<number | null>(0)
  const [typed, setTyped] = useState('')
  const [nudge, setNudge] = useState(false)

  const typedValue = parseFloat(typed)
  const amount =
    rung !== null ? cause.amounts[rung].value : Number.isFinite(typedValue) ? typedValue : 0
  const valid = amount >= MIN_GIFT

  const choose = (next: QuickPick) => {
    setPickId(next.id)
    setRung(0)
    setTyped('')
    setNudge(false)
    onPick?.(next)
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
      aria-labelledby={`${uid}-head`}
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
      {/* The glass is its own layer, not the pane's background. An element with
          backdrop-filter stops anything inside it from blurring what lies
          beyond it, and the menu hangs outside the pane. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 rounded-2xl border border-paper/15 bg-ink/50 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.5)] backdrop-blur-md"
      />

      {/* the cause, under "Donate now", which also labels the picker */}
      <div className={card ? '' : 'lg:pr-s3'}>
        <p
          id={`${uid}-head`}
          className={
            card
              ? 'font-display text-[22px] leading-none font-semibold tracking-[-0.01em] text-paper'
              : 'text-[12px] font-semibold tracking-[0.08em] text-paper/70 uppercase'
          }
        >
          Donate now
        </p>
        <FundPicker
          labelId={`${uid}-head`}
          picks={picks}
          value={pick}
          onChange={choose}
          down={card}
          className={card ? 'mt-3' : 'mt-2'}
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
          className={`group relative inline-flex h-14 w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gold px-7 text-[16px] font-semibold whitespace-nowrap text-ink shadow-gold transition-[background-color,color,box-shadow,transform] duration-200 ease-brand hover:-translate-y-px hover:bg-gold-dark hover:text-ink hover:shadow-gold-lg active:translate-y-0 ${card ? '' : 'lg:w-auto lg:min-w-[13rem]'}`}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -left-full w-full bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,0.55)_50%,transparent_80%)] transition-transform duration-[750ms] ease-brand group-hover:translate-x-[250%]"
          />
          <HandHeart className="relative h-[18px] w-[18px] shrink-0" />
          <span className="nums relative">Donate now{valid ? ` ${money(amount)}` : ''}</span>
          <ArrowRight className="relative h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
        </button>
      </div>
    </form>
  )
}

/* ---------------------------------------------------------------------------
   The picker. A button that opens a menu: a filter box (once the list has
   SEARCH_FROM options or more) above a grouped listbox. The filter is an ARIA
   combobox that controls the listbox, so arrows, Enter and Escape work from
   it while typing; without it the listbox takes focus itself and Space picks
   too.
--------------------------------------------------------------------------- */
const SEARCH_FROM = 7

function FundPicker({
  labelId,
  picks,
  value,
  onChange,
  down = false,
  className = '',
}: {
  labelId: string
  picks: QuickPick[]
  value: QuickPick
  onChange: (p: QuickPick) => void
  /** open below the button rather than above it */
  down?: boolean
  className?: string
}) {
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const searchable = picks.length >= SEARCH_FROM

  /* what the filter leaves, in groups, and the same options flat for the keys.
     "zakat" finds the whole obligations group, since that is what people type. */
  const q = query.trim().toLowerCase()
  const groups = useMemo(() => {
    const shown = q
      ? picks.filter((p) =>
          `${p.label} ${p.cause.label} ${p.group === 'obligations' ? 'zakat obligation' : p.group}`
            .toLowerCase()
            .includes(q),
        )
      : picks
    return groupPicks(shown)
  }, [picks, q])
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])

  /* close on a click anywhere else */
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  /* focus moves into the menu when it opens; the chosen option is in view */
  useEffect(() => {
    if (!open) return
    const fine = window.matchMedia('(pointer: fine)').matches
    if (searchable && fine) search.current?.focus({ preventScroll: true })
    else list.current?.focus({ preventScroll: true })
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open, searchable])

  useEffect(() => {
    if (open) document.getElementById(`${uid}-opt-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open, uid])

  const show = () => {
    setQuery('')
    setActive(Math.max(0, picks.findIndex((p) => p.id === value.id)))
    setOpen(true)
  }

  const choose = (p: QuickPick | undefined) => {
    if (!p) return
    onChange(p)
    setOpen(false)
    button.current?.focus()
  }

  const onButtonKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      show()
    }
  }

  const onMenuKey = (e: KeyboardEvent, fromSearch: boolean) => {
    const last = flat.length - 1
    const move: Record<string, () => void> = {
      ArrowDown: () => setActive((i) => Math.min(i + 1, last)),
      ArrowUp: () => setActive((i) => Math.max(i - 1, 0)),
      Enter: () => choose(flat[active]),
      Escape: () => {
        setOpen(false)
        button.current?.focus()
      },
      Tab: () => setOpen(false),
    }
    if (!fromSearch) {
      move.Home = () => setActive(0)
      move.End = () => setActive(last)
      move[' '] = () => choose(flat[active])
    }
    const fn = move[e.key]
    if (!fn) return
    if (e.key !== 'Tab') e.preventDefault()
    fn()
  }

  const activeId = flat[active] ? `${uid}-opt-${active}` : undefined

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
        <div
          className={`absolute left-0 z-30 flex max-h-[min(420px,60vh)] w-full flex-col overflow-hidden rounded-xl border border-paper/15 bg-ink/85 text-paper shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl ${down ? 'top-[calc(100%+6px)]' : 'bottom-[calc(100%+6px)]'}`}
          style={{ animation: 'fade-in 160ms var(--ease-brand) both' }}
        >
          {searchable && (
            <div className="border-b border-paper/10 p-1.5">
              <label className="flex h-11 items-center gap-2 rounded-lg bg-paper/10 px-3 focus-within:shadow-[inset_0_0_0_2px_rgba(255,255,255,0.7)]">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="h-4 w-4 shrink-0 text-paper/60"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="m10.5 10.5 3.5 3.5" strokeLinecap="round" />
                </svg>
                <span className="sr-only">Search causes</span>
                <input
                  ref={search}
                  type="search"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={`${uid}-list`}
                  aria-autocomplete="list"
                  aria-activedescendant={activeId}
                  placeholder="Search, e.g. water or zakat"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActive(0)
                  }}
                  onKeyDown={(e) => onMenuKey(e, true)}
                  className="w-full min-w-0 bg-transparent text-[16px] text-paper placeholder:text-[14px] placeholder:text-paper/55 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                />
              </label>
            </div>
          )}
          <div
            ref={list}
            id={`${uid}-list`}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={labelId}
            aria-activedescendant={searchable ? undefined : activeId}
            onKeyDown={(e) => onMenuKey(e, false)}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 focus:outline-none"
          >
            {flat.length === 0 && (
              <p className="px-3 py-3 text-[14px] text-paper/70">Nothing matches “{query.trim()}”.</p>
            )}
            {groups.map((g) => (
              <div
                key={g.group}
                role="group"
                aria-labelledby={g.heading ? `${uid}-g-${g.group}` : undefined}
              >
                {g.heading && (
                  <div
                    id={`${uid}-g-${g.group}`}
                    role="presentation"
                    className="px-3 pt-2.5 pb-1 text-[11px] font-semibold tracking-[0.08em] text-paper/55 uppercase"
                  >
                    {g.heading}
                  </div>
                )}
                {g.items.map((p) => {
                  const i = flat.indexOf(p)
                  const selected = p.id === value.id
                  return (
                    <div
                      key={p.id}
                      id={`${uid}-opt-${i}`}
                      role="option"
                      aria-selected={selected}
                      onPointerEnter={() => setActive(i)}
                      onClick={() => choose(p)}
                      className={`flex h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-[15px] transition-colors duration-150 ${
                        i === active ? 'bg-paper/12' : ''
                      } ${selected ? 'font-semibold text-paper' : 'text-paper/80'}`}
                    >
                      <span className="truncate">{p.label}</span>
                      {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
