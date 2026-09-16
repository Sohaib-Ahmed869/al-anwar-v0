import { useState } from 'react'
import { Link } from 'react-router-dom'

import Reveal, { Words } from '../components/Reveal'
import { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { HandHeart } from '../components/icons'
import { FITR } from '../components/zakat-data'

/* ---------------------------------------------------------------------------
   Zakat, section 4 of 5: zakat al-fitr.

   A different obligation from everything above it — per head rather than on
   wealth, due before a prayer rather than after a year — so it is a band of
   its own rather than a paragraph in the questions. Since 16 September 2026 it
   sits on the page's one ground under a head set the way SectionHead sets it,
   with the stepper card on the right.

   The one thing a household needs to know is the total for the people in it,
   so that is the whole interaction: how many people, the total, and the button.
   The stepper is two buttons around a number rather than a text field, because
   the answer is a small whole number and a keyboard is the slowest way to give
   one on a phone.

   The link carries the same three parameters GiveModule's own zakat-fitr rung
   sends, so /give can redraw the gift from it cold.

   The band is built to be lifted up the page in Ramadan, like HomeZakat: no
   ground or spacing here depends on what sits either side of it.
--------------------------------------------------------------------------- */

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })

export default function ZakatFitr() {
  const [people, setPeople] = useState(4)
  const total = people * FITR.perHead
  const step = (by: number) => setPeople((n) => Math.min(FITR.maxPeople, Math.max(1, n + by)))

  return (
    <section
      id="fitr"
      aria-labelledby="fitr-head"
      className={`scroll-mt-[var(--header-h)] ${SECTION_Y}`}
    >
      <div className="gutter mx-auto max-w-page">
      <div className={`grid gap-x-s5 gap-y-s4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center ${BREAKOUT}`}>
        <div>
          <Reveal variant="soft">
            <p className="font-script text-[clamp(21px,1.9vw,27px)] leading-none text-green">End of Ramadan</p>
          </Reveal>
          <h2
            id="fitr-head"
            className="mt-s2 max-w-[16ch] font-display text-[clamp(31px,4.2vw,54px)] leading-[1.05] tracking-[-0.022em] text-balance"
          >
            <Words text="Zakat al-Fitr, before the Eid prayer." delay={120} />
          </h2>
          <Reveal variant="soft" delay={260}>
          <p className="mt-s2 max-w-measure text-[clamp(15.5px,1.2vw,17px)] leading-[1.55] text-text-2">
            Owed at the end of Ramadan for every person in your household, children included, so that
            nobody goes without food on the day of Eid. We turn it into food and hand it over before the
            prayer.
          </p>
          <p className="mt-s3 max-w-[32ch] border-l-2 border-teal/50 pl-s2 text-[clamp(18px,1.8vw,23px)] leading-[1.44] font-medium tracking-[-0.014em] text-text">
            <span className="nums">{aud.format(FITR.perHead)}</span> for each person.
          </p>
          </Reveal>
        </div>

        <Reveal variant="soft" delay={200}>
          <div className="rounded-2xl border border-line bg-paper p-s3 shadow-card sm:p-s4">
            <div className="flex items-center justify-between gap-s2">
              <p id="fitr-people" className="text-[15px] font-medium text-text">
                People in your household
              </p>
              <span
                aria-hidden="true"
                lang="ar"
                dir="rtl"
                className="font-arabic text-[15px] leading-none text-text-3"
              >
                زكاة الفطر
              </span>
            </div>

            <div
              role="group"
              aria-labelledby="fitr-people"
              className="mt-s2 flex items-center justify-between gap-s2 border-y border-line py-s2"
            >
              <StepButton label="One fewer person" onClick={() => step(-1)} disabled={people <= 1}>
                −
              </StepButton>
              <output aria-live="polite" className="nums font-display text-[44px] leading-none tracking-[-0.03em] text-text">
                {people}
              </output>
              <StepButton label="One more person" onClick={() => step(1)} disabled={people >= FITR.maxPeople}>
                +
              </StepButton>
            </div>

            <div className="mt-s2 flex items-baseline justify-between gap-s2">
              <span className="text-[14px] text-text-2">Your zakat al-fitr</span>
              <span className="nums text-[22px] font-semibold tracking-[-0.01em] text-text">
                {aud.format(total)}
              </span>
            </div>

            <Link
              to={`/give?appeal=zakat-al-fitr&designation=zakat-fitr&amount=${total}`}
              className="group relative mt-s3 flex min-h-[54px] items-center justify-center gap-2.5 overflow-hidden rounded-[10px] bg-gold px-6 text-[16px] font-semibold tracking-[-0.006em] text-ink shadow-gold transition-[transform,box-shadow,background-color,color] duration-200 ease-brand hover:-translate-y-[1.5px] hover:bg-gold-dark hover:text-paper hover:shadow-gold-lg active:translate-y-0"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 -left-full w-full bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,0.55)_50%,transparent_80%)] transition-transform duration-[750ms] ease-brand group-hover:translate-x-[250%]"
              />
              <HandHeart className="relative h-[17px] w-[17px] shrink-0 transition-transform duration-300 ease-brand group-hover:scale-[1.14]" />
              <span className="nums relative">Pay {aud.format(total)}</span>
            </Link>
          </div>
        </Reveal>
      </div>
      </div>
    </section>
  )
}

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  children: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-ink/15 text-[22px] leading-none text-text transition-[border-color,background-color,opacity] duration-200 ease-brand hover:border-ink hover:bg-paper-2 disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  )
}
