import { useState } from 'react'
import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { money } from '../components/appeal-view'
import { ArrowRight, HandHeart } from '../components/icons'
import { giveTo, wayView, type Season } from '../components/season-data'

/* ---------------------------------------------------------------------------
   /ramadan and /dhul-hijjah, section 2 of 5: the ways to give. #ways.

   REDESIGNED 17 September 2026, at the user's request. It was six identical
   ruled cards, each with one price and one button, which read as a grid of
   the same box. Now it is a chooser:

     left   the funds as ruled rows under their group ("What you owe", "What
            you choose to give"), name, the opening price, the Arabic
     right  one teal panel for the chosen fund: its photograph with the name on
            it, the one line, the fund's whole one-time ladder as amounts to
            pick, and one gold "Donate $X" to /give with fund and amount set

   ZakatPolicy's "eight" tiles with a detail panel, which the user approved,
   are the precedent. From lg up the panel is sticky beside the list; below lg
   it opens under the row that was pressed, so the reader never scrolls to find
   it. The rows are plain toggle buttons (aria-pressed), not a tablist,
   because on a phone the panel sits between them.

   Every amount is a rung from give-data.ts, so the panel and /give can never
   quote different prices. A way marked `inSeason` shows its prices but no
   button while the season is off, and says when it opens.

   PHOTOGRAPHS are the funds' own frames from give-data.ts, all stock, so the
   words over them name the fund, never the picture.
--------------------------------------------------------------------------- */

type View = ReturnType<typeof wayView>

export default function SeasonWays({ season }: { season: Season }) {
  const { ways } = season
  const views = ways.items.map(wayView)
  const [active, setActive] = useState(0)
  /* the rung chosen on each fund, kept when the reader moves between them */
  const [chosen, setChosen] = useState<number[]>(() => views.map((v) => v.start))

  const choose = (i: number) => (rung: number) =>
    setChosen((prev) => prev.map((r, j) => (j === i ? rung : r)))

  return (
    <section id="ways" aria-labelledby="ways-head" className={`scroll-mt-[var(--header-h)] ${SECTION_Y}`}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead id="ways-head" eyebrow={ways.eyebrow} title={ways.title} lede={ways.lede} />

        <div
          className={`mt-s4 grid gap-x-s5 gap-y-s3 lg:mt-s5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start ${BREAKOUT}`}
        >
          <Reveal variant="soft">
            <ul className="border-b border-line">
              {views.map((v, i) => {
                const on = i === active
                const open = season.live || !v.inSeason
                const newGroup = i === 0 || views[i - 1].group !== v.group

                return (
                  <li key={v.fund}>
                    {newGroup && (
                      <p
                        className={`font-script text-[clamp(19px,1.6vw,23px)] leading-none text-green ${i === 0 ? '' : 'mt-s4'} pb-s2`}
                      >
                        {v.group}
                      </p>
                    )}

                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setActive(i)}
                      className="group relative flex w-full items-center gap-s2 border-t border-line py-[18px] pr-1 pl-s3 text-left"
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute top-3 bottom-3 left-0 w-[3px] rounded-full bg-teal transition-transform duration-300 ease-brand ${
                          on ? 'scale-y-100' : 'scale-y-0'
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block font-display text-[clamp(20px,1.7vw,24px)] leading-[1.15] font-semibold tracking-[-0.018em] transition-colors duration-200 ease-brand ${
                            on ? 'text-teal' : 'text-text group-hover:text-teal'
                          }`}
                        >
                          {v.cause.label}
                        </span>
                        <span className="mt-1 block text-[13.5px] text-text-2">
                          {open ? (
                            <>
                              {v.per} <span className="nums font-semibold text-text">{money(v.amount)}</span>
                            </>
                          ) : (
                            season.opens
                          )}
                        </span>
                      </span>
                      {v.cause.arabic && (
                        <span
                          lang="ar"
                          dir="rtl"
                          aria-hidden="true"
                          className={`font-arabic text-[17px] leading-none transition-colors duration-200 ease-brand ${
                            on ? 'text-teal' : 'text-text-3'
                          }`}
                        >
                          {v.cause.arabic}
                        </span>
                      )}
                      <ArrowRight
                        className={`hidden h-3.5 w-3.5 shrink-0 transition-[transform,opacity,color] duration-300 ease-brand lg:block ${
                          on ? 'translate-x-0 text-teal opacity-100' : '-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-60'
                        }`}
                      />
                    </button>

                    {/* below lg, the panel opens under its own row */}
                    {on && (
                      <div className="pb-s3 lg:hidden">
                        <Panel view={v} season={season} rung={chosen[i]} onRung={choose(i)} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Reveal>

          <Reveal variant="soft" delay={120} className="hidden lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:block">
            <Panel view={views[active]} season={season} rung={chosen[active]} onRung={choose(active)} />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function Panel({
  view: v,
  season,
  rung,
  onRung,
}: {
  view: View
  season: Season
  rung: number
  onRung: (i: number) => void
}) {
  const open = season.live || !v.inSeason
  const amount = v.rungs[rung]?.value ?? v.amount
  const { photo, position } = v.cause
  /* re-run the fade each time the fund changes */
  const enter = { animation: 'fade-in 450ms var(--ease-reveal) both' }

  return (
    <div className="overflow-hidden rounded-2xl bg-teal text-paper shadow-[0_24px_60px_-30px_rgba(0,0,0,0.45)]">
      <div className="relative aspect-[16/10] overflow-hidden bg-ink sm:aspect-[2/1] lg:aspect-[16/7]">
        <img
          key={photo}
          src={`/assets/images/${photo}-1200.jpg`}
          srcSet={`/assets/images/${photo}-1200.jpg 1200w, /assets/images/${photo}-2400.jpg 2400w`}
          sizes="(min-width: 1024px) 55vw, 100vw"
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: position, ...enter }}
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,103,112,0)_35%,rgba(0,103,112,0.55)_70%,#006770_100%)]"
        />
        <div
          key={v.fund}
          className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-s2 px-s3 pb-s2 sm:px-s4"
          style={enter}
        >
          <div>
            <p className="font-script text-[clamp(19px,1.7vw,24px)] leading-none text-gold-pale">{v.group}</p>
            <h3 className="mt-1.5 font-display text-[clamp(30px,3vw,44px)] leading-[1.05] tracking-[-0.022em]">
              {v.cause.label}
            </h3>
          </div>
          {v.cause.arabic && (
            <span lang="ar" dir="rtl" className="pb-1 font-arabic text-[clamp(20px,1.8vw,26px)] leading-none text-gold-pale">
              {v.cause.arabic}
            </span>
          )}
        </div>
      </div>

      <div key={v.fund} className="relative -mt-px bg-teal px-s3 pt-s2 pb-s3 sm:px-s4 sm:pb-s4" style={enter}>
        <p className="max-w-[50ch] text-[16px] leading-[1.55] text-paper/85">{v.line}</p>

        <p className="mt-s4 text-[13px] font-semibold text-paper/75">
          {open ? 'Choose an amount' : 'The amounts'}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {v.rungs.map((r, i) => {
            const on = open && i === rung
            const body = (
              <>
                <span className="nums block font-display text-[clamp(21px,1.9vw,27px)] leading-none tracking-[-0.02em]">
                  {money(r.value)}
                </span>
                {r.label && (
                  <span className={`mt-1.5 block text-[12.5px] leading-[1.3] ${on ? 'text-ink/70' : 'text-paper/70'}`}>
                    {r.label}
                  </span>
                )}
              </>
            )
            return open ? (
              <button
                key={r.value}
                type="button"
                aria-pressed={on}
                onClick={() => onRung(i)}
                className={`min-h-[64px] rounded-[12px] border px-3 py-3 text-left transition-[background-color,border-color,color] duration-200 ease-brand ${
                  on ? 'border-paper bg-paper text-ink' : 'border-paper/25 hover:border-paper/60'
                }`}
              >
                {body}
              </button>
            ) : (
              <div key={r.value} className="rounded-[12px] border border-paper/15 px-3 py-3 text-paper/80">
                {body}
              </div>
            )
          })}
        </div>

        <div className="mt-s4 flex flex-wrap items-center justify-between gap-x-s3 gap-y-s2 border-t border-paper/15 pt-s3">
          {open ? (
            <Link
              to={giveTo(v.cause.id, amount)}
              className="group inline-flex min-h-[52px] items-center gap-2.5 rounded-[12px] bg-gold px-6 text-[16px] font-semibold text-ink shadow-gold transition-[background-color,color,transform] duration-200 ease-brand hover:-translate-y-[1px] hover:bg-gold-dark hover:text-ink"
            >
              <HandHeart className="h-[17px] w-[17px] shrink-0" />
              <span>
                Donate <span className="nums">{money(amount)}</span>
              </span>
              <span className="sr-only"> to {v.cause.label}</span>
            </Link>
          ) : (
            <p className="max-w-[40ch] text-[14.5px] leading-[1.5] text-paper/85">
              <span className="font-semibold text-paper">{season.opens}.</span> {season.closedLine}
            </p>
          )}
          {v.more && (
            <Link
              to={v.more.to}
              className="group inline-flex min-h-[44px] items-center gap-1.5 text-[14.5px] font-semibold text-paper/80 transition-colors duration-200 ease-brand hover:text-paper"
            >
              {v.more.label}
              <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
