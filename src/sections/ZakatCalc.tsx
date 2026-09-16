import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { ArrowRight, Check, HandHeart } from '../components/icons'
import {
  CALC_HOLD,
  CALC_LEAVE_OUT,
  CALC_OWE,
  METAL_PRICE,
  NISAB,
  clean,
  toNumber,
  type CalcField,
} from '../components/zakat-data'

/* ---------------------------------------------------------------------------
   Zakat, section 2 of 5: the calculator. #calculator (/zakat/calculator
   redirects here) and #nisab, on the strip of three facts at its top.

   THE SHAPE (16 September 2026). The user liked the first layout and asked
   for the steps and the detail of the Liverpool Islamic Centre's calculator
   (mialiverpool.com.au/zakat) inside it, so this is both:

     top     the rule in three facts (#nisab)
     left    a white card with GiveForm's stepper, walking through
               1. What you own   cash, gold and silver (by weight OR value),
                                 shares, business stock, money owed
               2. What you owe   short-term debts only
               3. Your zakat     every figure entered, each with a way back
                                 to change it, and Start over
             with the running total at the foot of steps 1 and 2
     right   the teal result panel, live the whole way: the verdict, the
             amount, a bar with both nisab lines on it, the working, the gold
             pay button and the metal prices. Sticky from lg up; under lg it
             follows the card and a thin bar with the running figure sticks to
             the foot of the screen while the card is in view.

   A step already reached can be clicked back to. On every step change focus
   moves to the step's heading, so a screen reader hears where it landed.

   IT DOES NOT CHOOSE A NISAB FOR YOU
   The reference site checks against silver only. This one checks against
   both, says which the total is over, and draws both on the bar. Picking one
   would be the charity deciding, in its own favour, how much a stranger owes
   it; see the note at the top of HomeZakat.tsx.

   THE PRICES ARE ESTIMATES AND SAY SO: zakat-data.ts, with the date they were
   set, editable in the panel. TODO: placeholders until somebody owns keeping
   them current.

   Nothing typed here is stored or sent anywhere. The only thing that leaves is
   the rounded figure, on the pay link, and only if the reader presses it.
--------------------------------------------------------------------------- */

const STEPS = ['What you own', 'What you owe', 'Your zakat']

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 })
const audWhole = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
})

const FIELDS = [...CALC_HOLD, ...CALC_OWE]
const EMPTY: Record<string, string> = Object.fromEntries(
  FIELDS.flatMap((f) => (f.metal ? [[f.key, ''], [`${f.key}Grams`, '']] : [[f.key, '']])),
)

const NEXT =
  'group inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[12px] bg-teal px-s3 text-[15.5px] font-semibold text-paper transition duration-200 ease-brand hover:-translate-y-px hover:bg-ink'
const BACK =
  'inline-flex min-h-[52px] items-center justify-center rounded-[12px] border border-line px-5 text-[14.5px] font-semibold text-text-2 transition-colors duration-200 ease-brand hover:border-ink hover:text-ink'

export default function ZakatCalc() {
  const uid = useId()
  const [values, setValues] = useState(EMPTY)
  const [goldPrice, setGoldPrice] = useState(String(METAL_PRICE.goldPerGram))
  const [silverPrice, setSilverPrice] = useState(String(METAL_PRICE.silverPerGram))
  const [step, setStep] = useState(0)
  const [reached, setReached] = useState(0)

  const cardRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)

  const set = (key: string, raw: string) => setValues((v) => ({ ...v, [key]: clean(raw) }))
  const price = (metal: 'gold' | 'silver') => toNumber(metal === 'gold' ? goldPrice : silverPrice)

  /** A field's dollar value. For gold and silver, the weight at the price in
   *  the panel if a weight was given, otherwise the value typed. */
  const valueOf = (f: CalcField) => {
    if (!f.metal) return toNumber(values[f.key])
    const grams = toNumber(values[`${f.key}Grams`])
    return grams > 0 ? grams * price(f.metal) : toNumber(values[f.key])
  }

  const r = useMemo(() => {
    const held = CALC_HOLD.reduce((sum, f) => sum + valueOf(f), 0)
    const owed = CALC_OWE.reduce((sum, f) => sum + valueOf(f), 0)
    const net = Math.max(0, held - owed)
    const goldLine = NISAB.goldGrams * toNumber(goldPrice)
    const silverLine = NISAB.silverGrams * toNumber(silverPrice)
    return {
      held,
      owed,
      net,
      goldLine,
      silverLine,
      zakat: net * NISAB.rate,
      overGold: goldLine > 0 && net >= goldLine,
      overSilver: silverLine > 0 && net >= silverLine,
    }
    // valueOf reads values and the two prices, all listed here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, goldPrice, silverPrice])

  const started = r.held > 0 || r.owed > 0
  const owes = r.overGold || r.overSilver
  /* Rounded UP to the dollar for the pay link: the give form takes whole
     dollars, and rounding a religious obligation down is the wrong way. */
  const payAmount = Math.ceil(owes ? r.zakat : 0)

  let verdict: { head: string; body: string }
  if (!started) verdict = { head: 'Enter what you own', body: 'Your zakat appears here as you type.' }
  else if (r.overGold)
    verdict = { head: 'Zakat is owed', body: 'Your total is above both the gold and the silver nisab.' }
  else if (r.overSilver)
    verdict = {
      head: 'Owed on the silver nisab',
      body: 'Your total is above the silver line but below the gold one. Whether zakat is due depends on which nisab you follow.',
    }
  else
    verdict = {
      head: 'Below nisab',
      body: 'Your total is under both lines, so no zakat is owed on it this year.',
    }

  const go = (to: number) => {
    moved.current = true
    setStep(to)
    setReached((n) => Math.max(n, to))
  }
  const startOver = () => {
    setValues(EMPTY)
    setReached(0)
    go(0)
  }

  /* After a step change: bring the card's top back into view if it has
     scrolled off, and put focus on the new step's heading. Not on first
     render. */
  useEffect(() => {
    if (!moved.current) return
    const card = cardRef.current
    if (card && card.getBoundingClientRect().top < 80) {
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      card.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
    }
    headRef.current?.focus({ preventScroll: true })
  }, [step])

  /* The bar: 0 on the left, the gold line (the higher) on the right, the silver
     line marked where it falls. Both lines drawn, neither chosen. */
  const top = Math.max(r.goldLine, r.silverLine, 1)
  const fill = Math.min(100, (r.net / top) * 100)
  const silverAt = Math.min(100, (r.silverLine / top) * 100)

  /* Everything entered, for step 3's check list. */
  const entered = FIELDS.map((f) => ({ f, v: valueOf(f), owe: CALC_OWE.includes(f) })).filter((x) => x.v > 0)

  return (
    <section
      id="calculator"
      aria-labelledby="calc-head"
      className={`scroll-mt-[var(--header-h)] ${SECTION_Y}`}
    >
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="calc-head"
          eyebrow="Work it out"
          title="What do you owe this year?"
          lede="Use what everything is worth on the day your zakat falls due, and leave empty anything that doesn’t apply. Nothing you type leaves this page."
        />

        {/* The rule, in the order it is applied. */}
        <Reveal variant="soft" className={`mt-s4 ${BREAKOUT}`}>
          <dl
            id="nisab"
            className="grid scroll-mt-[calc(var(--header-h)+24px)] border-y border-line sm:grid-cols-3"
          >
            <Fact label="Nisab">
              <span className="nums font-semibold text-text">{NISAB.goldGrams}g</span> of gold or{' '}
              <span className="nums font-semibold text-text">{NISAB.silverGrams}g</span> of silver, in value
            </Fact>
            <Fact label="Held for">
              <span className="font-semibold text-text">One lunar year</span>, about 354 days
            </Fact>
            <Fact label="You give">
              <span className="nums font-semibold text-text">{NISAB.rate * 100}%</span> of the total
            </Fact>
          </dl>
        </Reveal>

        <div
          className={`mt-s4 grid gap-s3 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-s4 ${BREAKOUT}`}
        >
          {/* --- the card, with the phone bar at its foot --- */}
          <div>
            <Reveal variant="soft">
              <div
                ref={cardRef}
                className="scroll-mt-[calc(var(--header-h)+16px)] overflow-hidden rounded-2xl border border-line bg-paper shadow-card"
              >
                {/* the stepper: GiveForm's */}
                <ol className="flex items-center border-b border-line bg-paper-2/60 px-s3 py-s2 sm:px-s4">
                  {STEPS.map((name, i) => {
                    const done = i < step
                    const now = i === step
                    const open = i <= reached
                    return (
                      <li key={name} className={`flex items-center ${i ? `flex-1 ${now ? 'min-w-fit' : 'min-w-0'}` : 'shrink-0'}`}>
                        {i > 0 && (
                          <span
                            aria-hidden="true"
                            className={`mx-2 h-px min-w-3 flex-1 transition-colors duration-300 ease-brand ${
                              i <= step ? 'bg-teal' : 'bg-line'
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
                            className={`grid h-[28px] w-[28px] shrink-0 place-items-center rounded-full text-[12.5px] font-semibold transition-[background-color,border-color,color] duration-300 ease-brand ${
                              done ? 'bg-teal text-paper' : now ? 'bg-ink text-paper' : 'border border-line text-text-3'
                            }`}
                          >
                            {done ? <Check className="h-[11px] w-[11px]" /> : i + 1}
                          </span>
                          <span
                            className={`text-[13.5px] font-semibold whitespace-nowrap ${
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

                <div className="p-s3 sm:p-s4">
                  {step === 0 && (
                    <>
                      <StepHead headRef={headRef} n={1} title="What do you own?">
                        Enter the value in Australian dollars. Leave anything that doesn&rsquo;t apply
                        empty.
                      </StepHead>

                      <div className="mt-s3 grid gap-s3">
                        {CALC_HOLD.map((f) =>
                          f.metal ? (
                            <Metal
                              key={f.key}
                              uid={uid}
                              field={f}
                              grams={values[`${f.key}Grams`]}
                              value={values[f.key]}
                              perGram={price(f.metal)}
                              set={set}
                            />
                          ) : (
                            <Money key={f.key} uid={uid} field={f} value={values[f.key]} set={set} />
                          ),
                        )}
                      </div>

                      <p className="mt-s3 text-[13px] leading-relaxed text-text-3">{CALC_LEAVE_OUT}</p>

                      <Running label="What you own so far" value={audWhole.format(r.held)} />

                      <div className="mt-s3 flex justify-end">
                        <button type="button" onClick={() => go(1)} className={`${NEXT} w-full sm:w-auto`}>
                          Next: what you owe
                          <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                        </button>
                      </div>
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <StepHead headRef={headRef} n={2} title="What do you owe right now?">
                        Only debts due now come off: bills, credit cards and this year&rsquo;s
                        repayments. The rest of a mortgage or a long loan is not taken off.
                      </StepHead>

                      <div className="mt-s3 grid gap-s3">
                        {CALC_OWE.map((f) => (
                          <Money key={f.key} uid={uid} field={f} value={values[f.key]} set={set} minus />
                        ))}
                      </div>

                      <Running label="What you own, less what you owe" value={audWhole.format(r.net)} />

                      <div className="mt-s3 flex flex-wrap justify-between gap-s2">
                        <button type="button" onClick={() => go(0)} className={BACK}>
                          Back
                        </button>
                        <button type="button" onClick={() => go(2)} className={`${NEXT} flex-1 sm:flex-none`}>
                          See your zakat
                          <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                        </button>
                      </div>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <StepHead headRef={headRef} n={3} title="Check your figures">
                        This is what your zakat is worked out from. Change anything that isn&rsquo;t
                        right, and your zakat updates as you do.
                      </StepHead>

                      {entered.length ? (
                        <ul className="mt-s3 border-b border-line text-[15px]">
                          {entered.map(({ f, v, owe }) => (
                            <li
                              key={f.key}
                              className="flex items-baseline justify-between gap-s2 border-t border-line py-3"
                            >
                              <span className="min-w-0 text-text">
                                {f.label}
                                {f.metal && toNumber(values[`${f.key}Grams`]) > 0 && (
                                  <span className="nums text-text-3"> ({toNumber(values[`${f.key}Grams`])}g)</span>
                                )}
                              </span>
                              <span className="flex shrink-0 items-baseline gap-s2">
                                <span className="nums font-semibold text-text">
                                  {owe ? '− ' : ''}
                                  {aud.format(v)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => go(owe ? 1 : 0)}
                                  className="text-[13px] font-semibold text-teal transition-colors duration-200 ease-brand hover:text-ink"
                                >
                                  Change<span className="sr-only"> {f.label}</span>
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-s3 rounded-xl bg-paper-2 px-s2 py-s2 text-[14.5px] text-text-2">
                          Nothing entered yet.{' '}
                          <button type="button" onClick={() => go(0)} className="font-semibold text-teal hover:text-ink">
                            Add what you own
                          </button>
                        </p>
                      )}

                      <Running label="Your total" value={audWhole.format(r.net)} />

                      <p className="mt-s3 text-[13px] leading-relaxed text-text-3">
                        This is an estimate for guidance. For anything complicated, such as a business,
                        property held for sale or superannuation, ask a scholar you trust.
                      </p>

                      <div className="mt-s3 flex flex-wrap items-center justify-between gap-s2">
                        <button type="button" onClick={() => go(1)} className={BACK}>
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={startOver}
                          className="min-h-[44px] text-[14px] font-semibold text-text-3 underline decoration-line underline-offset-4 transition-colors duration-200 ease-brand hover:text-ink"
                        >
                          Start over
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Reveal>

            {/* The running figure, for phones. Sticky to the foot of the screen
                inside this column, so it rides along while the card is on
                screen and lets go as the result panel arrives under it.
                aria-hidden: the panel says the same in a live region. */}
            <div
              aria-hidden="true"
              className={`sticky bottom-0 z-10 -mx-[var(--gutter)] mt-s2 px-[var(--gutter)] pb-[max(12px,env(safe-area-inset-bottom))] transition-opacity duration-300 ease-brand lg:hidden ${
                started ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <div className="flex items-center justify-between gap-s2 rounded-[12px] bg-teal px-s2 py-3 shadow-nav">
                <span className="text-[13px] text-paper/75">Your zakat</span>
                <span className="nums text-[18px] font-semibold text-paper">{aud.format(owes ? r.zakat : 0)}</span>
              </div>
            </div>
          </div>

          {/* --- the result, live the whole way --- */}
          <Reveal variant="soft" delay={120} className="lg:sticky lg:top-[calc(var(--header-h)+24px)]">
            <div className="rounded-2xl bg-teal p-s3 text-paper sm:p-s4">
              <div aria-live="polite">
                <p className="text-[11px] font-semibold tracking-[0.14em] text-gold-pale uppercase">
                  Your zakat ({NISAB.rate * 100}%)
                </p>
                <p className="nums mt-s2 font-display text-[clamp(40px,4.6vw,56px)] leading-none font-semibold tracking-[-0.03em]">
                  {aud.format(owes ? r.zakat : 0)}
                </p>
                <p className="mt-s2 text-[15px] font-semibold">{verdict.head}</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-paper/75">{verdict.body}</p>
              </div>

              {/* where the total sits against both lines */}
              <div className="mt-s3">
                <div className="flex items-baseline justify-between text-[11px] font-semibold tracking-[0.14em] text-paper/60 uppercase">
                  <span>Against nisab</span>
                  <span className="nums">{audWhole.format(r.net)}</span>
                </div>
                <div className="relative mt-2 h-2 rounded-full bg-paper/15">
                  <div
                    className="h-full rounded-full bg-gold-pale transition-[width] duration-700 ease-brand"
                    style={{ width: `${fill}%` }}
                  />
                  <span aria-hidden="true" className="absolute -top-1 h-4 w-px bg-paper" style={{ left: `${silverAt}%` }} />
                  <span aria-hidden="true" className="absolute -top-1 right-0 h-4 w-px bg-paper" />
                </div>
                <div className="relative mt-2 h-4 text-[12px] text-paper/65">
                  <span className="absolute whitespace-nowrap" style={{ left: `${silverAt}%` }}>
                    Silver
                  </span>
                  <span className="absolute right-0 whitespace-nowrap">Gold</span>
                </div>
              </div>

              <dl className="mt-s3 border-b border-paper/15 text-[14px]">
                <Line label="What you own" value={aud.format(r.held)} />
                <Line label="Less what you owe" value={`− ${aud.format(r.owed)}`} />
                <Line label="Your total" value={aud.format(r.net)} strong />
                <Line label="Silver nisab" value={audWhole.format(r.silverLine)} mark={started ? r.overSilver : undefined} />
                <Line label="Gold nisab" value={audWhole.format(r.goldLine)} mark={started ? r.overGold : undefined} />
              </dl>

              {/* Gold only once there is something to pay. */}
              {payAmount > 0 ? (
                <Link
                  to={`/give?designation=zakat&amount=${payAmount}`}
                  className="group relative mt-s3 flex min-h-[54px] items-center justify-center gap-2.5 overflow-hidden rounded-[10px] bg-gold px-6 text-[16px] font-semibold tracking-[-0.006em] text-ink shadow-gold transition-[transform,box-shadow,background-color,color] duration-200 ease-brand hover:-translate-y-[1.5px] hover:bg-gold-dark hover:text-paper hover:shadow-gold-lg active:translate-y-0"
                >
                  <HandHeart className="h-[17px] w-[17px] shrink-0 transition-transform duration-300 ease-brand group-hover:scale-[1.14]" />
                  <span className="nums">Pay {audWhole.format(payAmount)} zakat</span>
                </Link>
              ) : (
                <p className="mt-s3 flex min-h-[54px] items-center justify-center rounded-[10px] border border-paper/20 px-6 text-center text-[14.5px] text-paper/60">
                  {started ? 'Nothing to pay on this total' : 'Nothing to pay yet'}
                </p>
              )}

              {/* The prices: the one input the reader did not type, so they can
                  correct it. Weights in step 1 are valued at these. */}
              <details className="group/p mt-s3 border-t border-paper/15 pt-s2">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-s2 text-[12.5px] text-paper/65 transition-colors duration-200 hover:text-paper/85 [&::-webkit-details-marker]:hidden">
                  <span>Metal prices are estimates, set {METAL_PRICE.setOn}</span>
                  <span className="font-semibold text-paper/80 group-open/p:hidden">Change</span>
                  <span className="hidden font-semibold text-paper/80 group-open/p:inline">Done</span>
                </summary>
                <div className="mt-s2 grid grid-cols-2 gap-s2">
                  <Price id={`${uid}-gp`} label="Gold, per gram" value={goldPrice} onChange={setGoldPrice} />
                  <Price id={`${uid}-sp`} label="Silver, per gram" value={silverPrice} onChange={setSilverPrice} />
                </div>
              </details>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ---------- the parts ---------- */

const INPUT =
  'peer nums block w-full border-b border-line bg-transparent py-2 text-[16px] text-text placeholder:text-text-3 focus:outline-none'

/** The contact form's field: a hairline under it, and a teal rule that wipes
 *  in from the left while it has focus. */
function Underline() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-0 bottom-0 left-0 h-[2px] origin-left scale-x-0 bg-teal transition-transform duration-300 ease-brand peer-focus:scale-x-100"
    />
  )
}

function StepHead({
  headRef,
  n,
  title,
  children,
}: {
  headRef: RefObject<HTMLHeadingElement | null>
  n: number
  title: string
  children: ReactNode
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-[0.14em] text-teal uppercase">Step {n} of 3</p>
      <h3
        ref={headRef}
        tabIndex={-1}
        className="mt-1.5 text-[clamp(22px,2.2vw,28px)] leading-tight font-semibold tracking-[-0.015em] text-text focus:outline-none"
      >
        {title}
      </h3>
      <p className="mt-1.5 max-w-[56ch] text-[14.5px] leading-relaxed text-text-2">{children}</p>
    </div>
  )
}

function Money({
  uid,
  field,
  value,
  set,
  minus = false,
}: {
  uid: string
  field: CalcField
  value: string
  set: (key: string, raw: string) => void
  minus?: boolean
}) {
  const id = `${uid}-${field.key}`
  return (
    <div>
      <label htmlFor={id} className="block text-[14.5px] font-semibold text-text">
        {field.label}
      </label>
      <div className="relative mt-0.5 flex items-baseline">
        <span aria-hidden="true" className="nums shrink-0 pr-1.5 text-[16px] whitespace-nowrap text-text-3">
          {minus ? '−$' : '$'}
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          aria-describedby={`${id}-hint`}
          value={value}
          onChange={(e) => set(field.key, e.target.value)}
          className={INPUT}
        />
        <Underline />
      </div>
      <p id={`${id}-hint`} className="mt-1.5 text-[12.5px] text-text-3">
        {field.hint}
      </p>
    </div>
  )
}

/** Gold or silver: a weight in grams or a dollar value, in a box of its own
 *  with the price per gram it is valued at. */
function Metal({
  uid,
  field,
  grams,
  value,
  perGram,
  set,
}: {
  uid: string
  field: CalcField
  grams: string
  value: string
  perGram: number
  set: (key: string, raw: string) => void
}) {
  const g = toNumber(grams)
  const id = `${uid}-${field.key}`
  return (
    <fieldset className="rounded-xl border border-line bg-paper-2/50 p-s2 sm:p-s3" aria-describedby={`${id}-hint`}>
      <legend className="float-left w-full">
        <span className="flex items-baseline justify-between gap-s2">
          <span className="text-[14.5px] font-semibold text-text">{field.label}</span>
          <span className="nums text-[12.5px] text-text-3">at {aud.format(perGram)}/g</span>
        </span>
      </legend>
      <div className="clear-both mt-s2 grid gap-s2 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-g`} className="block text-[12.5px] text-text-2">
            Weight in grams
          </label>
          <div className="relative flex items-baseline">
            <input
              id={`${id}-g`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={grams}
              onChange={(e) => set(`${field.key}Grams`, e.target.value)}
              className={INPUT}
            />
            <span aria-hidden="true" className="pl-1.5 text-[15px] text-text-3">
              g
            </span>
            <Underline />
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-v`} className="block text-[12.5px] text-text-2">
            Or its value
          </label>
          <div className="relative flex items-baseline">
            <span aria-hidden="true" className="nums pr-1.5 text-[16px] text-text-3">
              $
            </span>
            <input
              id={`${id}-v`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={g > 0 ? String(Math.round(g * perGram)) : '0'}
              disabled={g > 0}
              value={g > 0 ? '' : value}
              onChange={(e) => set(field.key, e.target.value)}
              className={`${INPUT} disabled:cursor-not-allowed disabled:placeholder:text-text-2`}
            />
            <Underline />
          </div>
        </div>
      </div>
      <p id={`${id}-hint`} className="mt-2 text-[12.5px] text-text-3">
        {g > 0 ? (
          <span className="font-semibold text-teal">
            About <span className="nums">{audWhole.format(g * perGram)}</span> at today&rsquo;s estimate.
          </span>
        ) : (
          field.hint
        )}
      </p>
    </fieldset>
  )
}

function Running({ label, value }: { label: string; value: string }) {
  return (
    <div
      aria-live="polite"
      className="mt-s3 flex items-baseline justify-between gap-s2 rounded-xl bg-teal/[0.06] px-s2 py-s2 sm:px-s3"
    >
      <span className="text-[13.5px] font-semibold text-text-2">{label}</span>
      <span className="nums text-[clamp(22px,2.2vw,28px)] font-semibold tracking-[-0.02em] text-text">{value}</span>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-s2 border-line py-s2 not-first:border-t sm:flex-col sm:gap-1 sm:not-first:border-t-0 sm:not-first:border-l sm:px-s3 sm:first:pl-0">
      <dt className="w-[72px] shrink-0 text-[10.5px] font-semibold tracking-[0.14em] text-text-3 uppercase sm:w-auto">
        {label}
      </dt>
      <dd className="text-[15px] leading-[1.5] text-text-2">{children}</dd>
    </div>
  )
}

function Line({
  label,
  value,
  strong = false,
  mark,
}: {
  label: string
  value: string
  strong?: boolean
  /** true: the total is over this line; false: under it; undefined: nothing entered. */
  mark?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-s2 border-t border-paper/15 py-2.5">
      <dt className={strong ? 'font-semibold text-paper' : 'text-paper/70'}>
        {label}
        {mark !== undefined && (
          <span className={`ml-2 text-[12px] ${mark ? 'font-semibold text-gold-pale' : 'text-paper/50'}`}>
            {mark ? 'over' : 'under'}
          </span>
        )}
      </dt>
      <dd className={`nums ${strong ? 'font-semibold text-paper' : 'text-paper/85'}`}>{value}</dd>
    </div>
  )
}

function Price({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12px] text-paper/65">
        {label}
      </label>
      <div className="mt-1 flex items-baseline border-b border-paper/25 focus-within:border-paper/70">
        <span aria-hidden="true" className="pr-1 text-[14px] text-paper/55">
          $
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(clean(e.target.value))}
          className="nums block w-full bg-transparent py-1.5 text-[14.5px] text-paper focus:outline-none"
        />
      </div>
    </div>
  )
}
