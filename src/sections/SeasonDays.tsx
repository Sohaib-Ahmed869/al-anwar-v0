import { useState } from 'react'

import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import type { Season } from '../components/season-data'

/* ---------------------------------------------------------------------------
   /ramadan and /dhul-hijjah, section 3 of 5: the days. #days.

   REDESIGNED 17 September 2026, at the user's request. It was four dates on
   a hairline, which said when but not where in the month. Now:

     the strip   a teal panel with one cell per day of the Hijri month (30 for
                 Ramadan, 13 for Dhul Hijjah up to the end of tashreeq). The
                 days that matter most are a lighter band with a bracket and a
                 script label under them; the odd nights carry a small moon.
                 A numbered marker stands over each key day.
     the cards   the four days, each with the same number, the expected date,
                 the Hijri day, and one sentence.

   Pointing at a card lights its marker, and pointing at a marker lights its
   card, so the two read as one thing. From sm up only: on a phone the thirty
   cells are too narrow to hold four markers apart, so the strip shows the
   band and the moons and the cards carry the rest.

   Gold stays on the give buttons: the band is paper on teal, and the only pale
   gold is the script label, as in every teal panel on the site.
--------------------------------------------------------------------------- */

/** where the centre of a Hijri day sits across the strip, 0 to 100 */
const across = (day: number, cells: number) =>
  Math.min(100, Math.max(0, ((day - 0.5) / cells) * 100))

const Moon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className={className}>
    <path d="M10.2 1.8a6.4 6.4 0 1 0 4 11.1A5.4 5.4 0 0 1 10.2 1.8z" fill="currentColor" />
  </svg>
)

export default function SeasonDays({ season }: { season: Season }) {
  const { days } = season
  const { track } = days
  const [lit, setLit] = useState<number | null>(null)

  const inBand = (n: number) => n >= track.band.from && n <= track.band.to
  const inTail = (n: number) => !!track.tail && n >= track.tail.from && n <= track.tail.to
  const litDay = lit === null ? null : days.items[lit].at
  const cells = Array.from({ length: track.cells }, (_, i) => i + 1)
  const showNumber = (n: number) => track.cells <= 15 || n === 1 || n % 5 === 0

  const bracket = (from: number, to: number, label: string, faint: boolean) => (
    <div
      className="absolute top-0"
      style={{ left: `${((from - 1) / track.cells) * 100}%`, width: `${((to - from + 1) / track.cells) * 100}%` }}
    >
      <div className={`h-2 rounded-b-[3px] border-x border-b ${faint ? 'border-paper/25' : 'border-paper/50'}`} />
      <p
        className={`mt-2 text-center font-script leading-none whitespace-nowrap ${
          faint ? 'text-[clamp(15px,1.3vw,19px)] text-paper/60' : 'text-[clamp(18px,1.7vw,24px)] text-gold-pale'
        }`}
      >
        {label}
      </p>
    </div>
  )

  return (
    <section id="days" aria-labelledby="days-head" className={`scroll-mt-[var(--header-h)] ${SECTION_Y}`}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead id="days-head" eyebrow={days.eyebrow} title={days.title} lede={days.lede} />

        <div className={`mt-s4 lg:mt-s5 ${BREAKOUT}`}>
          {/* ---------- the month ---------- */}
          <Reveal variant="clip">
            <div
              aria-hidden="true"
              className="rounded-2xl bg-teal px-s3 pt-s3 pb-s4 text-paper sm:px-s4 sm:pt-s4 lg:px-[clamp(40px,3.6vw,56px)] lg:pt-[clamp(32px,3vw,44px)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-s3 gap-y-2 text-[12.5px] font-medium tracking-[0.08em] text-paper/70 uppercase">
                <span>{track.month}</span>
                {track.marks && track.marksLabel && (
                  <span className="flex items-center gap-1.5 normal-case tracking-normal text-[13px]">
                    <Moon className="h-3 w-3 text-paper" />
                    {track.marksLabel}
                  </span>
                )}
              </div>

              {/* markers over the key days, from sm up */}
              <div className="relative mt-s2 hidden h-[46px] sm:block">
                {days.items.map((d, i) => {
                  const on = lit === i
                  return (
                    <span
                      key={d.title}
                      onMouseEnter={() => setLit(i)}
                      onMouseLeave={() => setLit(null)}
                      className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
                      style={{ left: `${across(d.at, track.cells)}%` }}
                    >
                      <span
                        className={`nums flex h-[30px] w-[30px] items-center justify-center rounded-full border text-[13px] font-semibold transition-[background-color,color,border-color,transform] duration-200 ease-brand ${
                          on ? 'scale-110 border-paper bg-paper text-teal' : 'border-paper/60 text-paper'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className={`h-[16px] w-px ${on ? 'bg-paper' : 'bg-paper/40'}`} />
                    </span>
                  )
                })}
              </div>

              {/* the cells */}
              <div className="mt-s3 flex h-[clamp(40px,4.6vw,60px)] gap-[2px] sm:mt-0 sm:gap-[3px]">
                {cells.map((n) => {
                  const band = inBand(n)
                  const tail = inTail(n)
                  const on = litDay !== null && (n === litDay || (litDay === track.cells + 1 && n === track.cells))
                  return (
                    <span
                      key={n}
                      className={`relative flex flex-1 items-center justify-center rounded-[3px] transition-colors duration-200 ease-brand sm:rounded-[5px] ${
                        on ? 'bg-paper' : band ? 'bg-paper/40' : tail ? 'bg-paper/20' : 'bg-paper/10'
                      }`}
                    >
                      {track.marks?.includes(n) && (
                        <Moon className={`h-[clamp(8px,1vw,13px)] w-[clamp(8px,1vw,13px)] ${on ? 'text-teal' : 'text-ink/60'}`} />
                      )}
                    </span>
                  )
                })}
              </div>

              {/* day numbers */}
              <div className="relative mt-2 h-4 text-[11px] text-paper/60">
                {cells.filter(showNumber).map((n) => (
                  <span
                    key={n}
                    className="nums absolute -translate-x-1/2"
                    style={{ left: `${across(n, track.cells)}%` }}
                  >
                    {n}
                  </span>
                ))}
              </div>

              {/* the band's bracket and name */}
              <div className="relative mt-s2 h-[42px]">
                {bracket(track.band.from, track.band.to, track.band.label, false)}
                {track.tail && bracket(track.tail.from, track.tail.to, track.tail.label, true)}
              </div>
            </div>
          </Reveal>

          {/* ---------- the four days ---------- */}
          <ol className="mt-s2 grid gap-s2 sm:grid-cols-2 lg:grid-cols-4">
            {days.items.map((d, i) => {
              const on = lit === i
              return (
                <li key={d.title}>
                  <Reveal variant="soft" delay={i * 80} className="h-full">
                    <div
                      onMouseEnter={() => setLit(i)}
                      onMouseLeave={() => setLit(null)}
                      className={`h-full rounded-2xl border bg-paper p-s3 transition-[border-color,box-shadow] duration-200 ease-brand ${
                        on ? 'border-teal shadow-card' : 'border-line'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className={`nums flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[12.5px] font-semibold transition-colors duration-200 ease-brand ${
                            on ? 'bg-teal text-paper' : 'border border-teal/40 text-teal'
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="text-[12px] font-medium tracking-[0.06em] text-text-3 uppercase">
                          {d.hijri}
                        </span>
                      </div>
                      <p className="nums mt-s3 font-display text-[clamp(26px,2.3vw,34px)] leading-none tracking-[-0.02em] text-teal">
                        {d.when}
                      </p>
                      <h3 className="mt-s2 text-[17px] font-semibold text-text">{d.title}</h3>
                      <p className="mt-1.5 text-[15px] leading-[1.55] text-text-2">{d.body}</p>
                    </div>
                  </Reveal>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}
