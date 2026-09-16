import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import Reveal, { Words } from '../components/Reveal'
import { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { ArrowRight, Check, HandHeart, Lock } from '../components/icons'
import { METAL_PRICE, NISAB, POLICY, clean, toNumber } from '../components/zakat-data'

/* ---------------------------------------------------------------------------
   Step 4 of the home argument: zakat.

   Everything above this band talks to somebody CONSIDERING a gift — moved by a
   photograph, choosing an amount, deciding. A reader with zakat due is not that
   person. They are discharging an obligation they already have, they are not
   going to be moved into it by a picture, and they have two questions: how
   much, and will it be handled properly? This band answers both and nothing
   else. No photograph, no appeal, no amount ladder.

   A PROMISE ON THE LEFT, A TOOL ON THE RIGHT (16 September 2026)
   It was two grey paragraphs and a pull-quote beside a card that restated the
   rule (87.48g, a lunar year, 2.5%) and then said the calculator would do the
   real work elsewhere. At the user's request, on the pattern of Al-Ihsan's
   "Calculate your Zakat" card, it now:

     - keeps the one line that matters, and SHOWS it: the eight categories of
       9:60 as a row, with the collectors' share dimmed;
     - turns the card into a quick estimate — one figure in, the 2.5% out as
       you type, and a gold button that carries that amount to the give form.

   The two paragraphs ("no salaries here", "a ledger of its own") live on
   /zakat in POLICY.commitments, one link away.

   THE ONE LINE THAT MATTERS
   Zakat has eight categories it may be spent on (Qur'an 9:60), and one of them
   — al-'amilina 'alayha — is the people employed to collect and administer it.
   So a charity is entitled to take its costs out of zakat. Al-Anwaar has
   committed, in public, to not taking that one: see AboutLimits.tsx and
   POLICY in zakat-data.ts. The ACNC statements record employee expenses of
   zero in every year, so it is cheap to honour, and the band says so without
   quoting the figure.

   The declined category is DIMMED, never struck through — a line through a
   word of the ayah reads as crossing it out — and never gold, which on this
   site only ever means the button that takes money. Same rule as ZakatPolicy.

   IT DOES NOT CHOOSE A NISAB FOR YOU
   The estimate is checked against BOTH lines and says which ones the figure is
   over, word for word the verdicts ZakatCalc gives. WHICH threshold we apply is
   ours to decide, the silver one is lower and would collect more, and the board
   has not adopted a written policy — so this band must not quietly pick one. A
   charity that decides your threshold for you, in its own favour, without
   saying so, is doing the thing this whole site is built not to do.

   ONE FIGURE, ON PURPOSE
   The home page carries no numbers about us, and this does not break that: the
   figure is the reader's own. It is one field because the reader it is for has
   a rough total in mind; anybody with several kinds of wealth or debts to take
   off is sent to the full calculator, which says so under the button. Nothing
   typed here is stored or sent — the only thing that leaves is the rounded
   figure on the pay link, and only if the reader presses it.

   TODO before launch
     - METAL_PRICE in zakat-data.ts is a placeholder, so the nisab verdict is
       only as right as that. Fix it there and both calculators follow.
     - The board adopts a zakat policy, and /zakat#policy carries it. When it
       names a threshold, this band may name it too.
     - Ramadan begins around mid-February 2027. This band has no ground or
       spacing that depends on its neighbours, so it can be lifted up the page
       in Home.tsx alone.
--------------------------------------------------------------------------- */

const aud = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 2,
})

const audWhole = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
})

/** One tap fills the field. Spread across the lines: under both, between
 *  them at the placeholder prices, and comfortably over both. */
const SAMPLES = [1000, 5000, 25000, 100000]

const GOLD_LINE = NISAB.goldGrams * METAL_PRICE.goldPerGram
const SILVER_LINE = NISAB.silverGrams * METAL_PRICE.silverPerGram

export default function HomeZakat() {
  const uid = useId()
  const [raw, setRaw] = useState('')

  const r = useMemo(() => {
    const total = toNumber(raw)
    const overGold = total >= GOLD_LINE
    const overSilver = total >= SILVER_LINE
    const owes = overGold || overSilver
    const zakat = owes ? total * NISAB.rate : 0
    return { total, overGold, overSilver, owes, zakat, pay: Math.ceil(zakat) }
  }, [raw])

  const started = r.total > 0

  /* Only the in-between case needs a sentence. The other three are said by
     the two threshold marks and the figure, so the card does not repeat them
     in words. The wording matches ZakatCalc's verdicts. */
  const note = !started
    ? 'Cash, savings, gold and shares, less any debts due now.'
    : r.overGold
      ? 'Above both nisab lines, so zakat is owed.'
      : r.overSilver
        ? 'Above the silver line, below the gold. Whether it is due depends on which nisab you follow.'
        : 'Below both nisab lines, so nothing is owed on this.'

  return (
    <section id="zakat" aria-labelledby="zakat-head" className={`relative ${SECTION_Y}`}>
      {/* No ground of its own and no wash — the page runs on one colour and a
          drawn divider says a section has ended. See components/Divider.tsx. */}
      <div className="gutter mx-auto max-w-page">
        {/* The grid reaches out as far as the give card, the appeals banner and
            the impact grid do, so the band shares their edges. */}
        <div
          className={`grid gap-x-s5 gap-y-s4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center ${BREAKOUT}`}
        >
          {/* --- the promise --- */}
          <div>
            <h2
              id="zakat-head"
              className="max-w-[16ch] font-display text-[clamp(30px,3.9vw,46px)] leading-[1.06] tracking-[-0.022em] text-balance"
            >
              <Words text="Zakat is owed, not given." />
            </h2>

            <Reveal variant="soft" delay={220}>
              <p className="mt-s3 max-w-[34ch] text-[clamp(18px,1.8vw,23px)] leading-[1.44] font-medium tracking-[-0.014em] text-text">
                It belongs to eight kinds of people. One of them is those who collect it.{' '}
                <span className="text-green">We don&rsquo;t take that share.</span>
              </p>
            </Reveal>

            <Reveal variant="soft" delay={340}>
              {/* The eight, in the order of the ayah. The collectors' chip is the
              only one that looks different, and it is dimmed and dashed rather
              than struck — see the head of this file. */}
              <figure className="mt-s4">
                <ul className="flex max-w-[620px] flex-wrap gap-2">
                  {POLICY.categories.map((c) =>
                    c.ours === false ? (
                      <li
                        key={c.name}
                        className="rounded-full border border-dashed border-text-3/50 px-3 py-1.5 text-[13px] leading-none text-text-3"
                      >
                        {c.name}
                        <span className="sr-only"> (we don&rsquo;t take this share)</span>
                      </li>
                    ) : (
                      <li
                        key={c.name}
                        className="rounded-full border border-line bg-paper px-3 py-1.5 text-[13px] leading-none text-text"
                      >
                        {c.name}
                      </li>
                    ),
                  )}
                </ul>
                <figcaption className="mt-s2 text-[12px] tracking-[0.02em] text-text-3">
                  The eight it is owed to, {POLICY.verse.cite}. The dashed one is the share we
                  leave.
                </figcaption>
              </figure>

              <Link
                to="/zakat#policy"
                className="group mt-s4 inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-green transition-colors duration-200 ease-brand hover:text-ink"
              >
                How we handle your zakat
                <ArrowRight className="h-3 w-3 -translate-x-0.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
          </div>

          {/* --- the quick estimate ---
            Redesigned 16 September 2026. The first version was a bare
            underline field, three hairline rules and a big green "$0.00" that
            sat there shouting nothing before anyone had typed. Now:

              - the field is a real box, so it reads as something to type in;
              - four sample figures under it fill the field in one tap, so the
                card demonstrates itself to somebody who only wants to see how
                it behaves;
              - the result is a green-pale panel, the one tinted surface in the
                card, holding the figure and the two nisab lines as marks. It is
                muted until there is a figure, rather than a green zero;
              - the rules are gone apart from the one above the small print.

            Green-pale is the zakat colour already (ZakatPolicy, ZakatNisab).
            Gold stays on the one button that takes money. */}
          <Reveal variant="scale" delay={200}>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="rounded-[20px] border border-line bg-paper p-s3 shadow-card sm:p-[32px]"
            >
              <div className="flex items-center justify-between gap-s2">
                <p className="text-[11px] font-semibold tracking-[0.16em] text-green uppercase">
                  Quick estimate
                </p>
                <span
                  aria-hidden="true"
                  lang="ar"
                  dir="rtl"
                  className="font-arabic text-[18px] leading-none text-green/60"
                >
                  &#x0632;&#x0643;&#x0627;&#x0629;
                </span>
              </div>

              <label
                htmlFor={`${uid}-total`}
                className="mt-s3 block text-[14px] font-medium text-text"
              >
                What you hold today
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-[12px] border border-line bg-paper-2 px-s2 transition-[border-color,box-shadow,background-color] duration-200 ease-brand focus-within:border-green focus-within:bg-paper focus-within:shadow-[0_0_0_4px_rgba(47,107,90,0.12)]">
                <span className="font-display text-[26px] text-text-3">$</span>
                <input
                  id={`${uid}-total`}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={raw}
                  onChange={(e) => setRaw(clean(e.target.value))}
                  aria-describedby={`${uid}-note`}
                  className="nums h-[60px] w-full min-w-0 bg-transparent font-display text-[28px] tracking-[-0.02em] text-text outline-none placeholder:text-text-3/40"
                />
                <span className="text-[12px] font-semibold tracking-[0.08em] text-text-3">AUD</span>
              </div>

              <ul aria-label="Try a figure" className="mt-2.5 flex flex-wrap gap-1.5">
                {SAMPLES.map((n) => {
                  const on = r.total === n
                  return (
                    <li key={n}>
                      <button
                        type="button"
                        onClick={() => setRaw(n.toLocaleString('en-AU'))}
                        aria-pressed={on}
                        className={`nums rounded-full border px-3 py-1 text-[12.5px] transition-colors duration-200 ease-brand ${
                          on
                            ? 'border-green bg-green text-paper'
                            : 'border-line text-text-2 hover:border-green/50 hover:text-green'
                        }`}
                      >
                        {audWhole.format(n)}
                      </button>
                    </li>
                  )
                })}
              </ul>

              {/* --- the result --- */}
              <div
                aria-live="polite"
                className={`mt-s3 rounded-[14px] p-s2 transition-colors duration-300 ease-brand sm:p-s3 ${
                  started ? 'bg-green-pale' : 'bg-paper-2'
                }`}
              >
                <div className="flex items-end justify-between gap-s2">
                  <span className="pb-1.5 text-[13px] text-text-2">
                    Your zakat
                    <span className="block text-[11.5px] text-text-3">at {NISAB.rate * 100}%</span>
                  </span>
                  <span
                    className={`nums font-display text-[clamp(36px,3.8vw,48px)] leading-none tracking-[-0.03em] transition-colors duration-300 ease-brand ${
                      r.owes ? 'text-green' : 'text-text-3/60'
                    }`}
                  >
                    {r.owes ? aud.format(r.zakat) : '$0'}
                  </span>
                </div>

                <div className="mt-s2 flex flex-wrap gap-x-s2 gap-y-1 border-t border-ink/[0.06] pt-s2">
                  <Mark label="Silver nisab" on={started ? r.overSilver : undefined} />
                  <Mark label="Gold nisab" on={started ? r.overGold : undefined} />
                </div>

                <p
                  id={`${uid}-note`}
                  className="mt-1.5 min-h-[2.9em] text-[12.5px] leading-[1.45] text-text-2"
                >
                  {note}
                </p>
              </div>

              {/* Gold, always: somebody who already knows their figure pays it
                from here without typing anything. Once there is an estimate,
                the button carries it — rounded UP, as ZakatCalc rounds it. */}
              <Link
                to={
                  r.owes && r.pay > 0
                    ? `/give?designation=zakat&amount=${r.pay}`
                    : '/give?designation=zakat'
                }
                className="group relative mt-s3 flex min-h-[56px] items-center justify-center gap-2.5 overflow-hidden rounded-[12px] bg-gold px-6 text-[16px] font-semibold tracking-[-0.006em] text-ink shadow-gold transition-[transform,box-shadow,background-color,color] duration-200 ease-brand hover:-translate-y-[1.5px] hover:bg-gold-dark hover:text-paper hover:shadow-gold-lg active:translate-y-0"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 -left-full w-full bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,0.55)_50%,transparent_80%)] transition-transform duration-[750ms] ease-brand group-hover:translate-x-[250%]"
                />
                <HandHeart className="relative h-[17px] w-[17px] shrink-0 transition-transform duration-300 ease-brand group-hover:scale-[1.14]" />
                <span className="nums relative">
                  {r.owes && r.pay > 0 ? `Pay ${audWhole.format(r.pay)} zakat` : 'Pay your zakat'}
                </span>
              </Link>

              <div className="mt-s2 flex flex-wrap items-center justify-between gap-x-s2 gap-y-1.5 text-[12.5px]">
                <Link
                  to="/zakat#calculator"
                  className="group inline-flex items-center gap-1.5 font-semibold text-green transition-colors duration-200 ease-brand hover:text-ink"
                >
                  Full calculator
                  <ArrowRight className="h-3 w-3 -translate-x-0.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                </Link>
                <span className="inline-flex items-center gap-1.5 text-text-3">
                  <Lock className="h-3.5 w-3.5" />
                  Stays on this page
                </span>
              </div>

              <p className="mt-s2 border-t border-line-2 pt-s2 text-[11.5px] leading-relaxed text-text-3">
                An estimate on metal prices set {METAL_PRICE.setOn}. Several kinds of wealth, or
                debts to take off? The full calculator does each one.
              </p>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/** A nisab line, as a mark: undecided (nothing typed), over, or under. */
function Mark({ label, on }: { label: string; on?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[12.5px] ${
        on ? 'font-medium text-green' : 'text-text-3'
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid h-4 w-4 place-items-center rounded-full border transition-colors duration-300 ease-brand ${
          on ? 'border-green bg-green text-paper' : 'border-text-3/40'
        }`}
      >
        {on && <Check className="h-2.5 w-2.5" />}
      </span>
      {label}
      <span className="sr-only">{on === undefined ? '' : on ? ': above' : ': below'}</span>
    </span>
  )
}
