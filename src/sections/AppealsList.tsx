import { useLayoutEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

import AppealTile from '../components/AppealTile'
import { KEEP_SCROLL } from '../components/Layout'
import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import {
  APPEAL_LIST,
  CAUSE_FILTERS,
  PLACES,
  SEASONS,
  type Appeal,
} from '../components/appeals-data'
import { ArrowRight } from '../components/icons'

/* ---------------------------------------------------------------------------
   /appeals, section 2 of 3: the filters, the tiles, and what to say when the
   filters leave nothing.

   ON THE HOME PAGE'S PATTERN (16 September 2026, client's request)
   The shared SectionHead, no ground of its own, and the appeals as photograph
   tiles with the words on the picture, as HomeImpact draws its grid. Each tile
   says one figure, the smallest gift that helps (appeal-view.ts), and has its
   own Donate button. No progress bars, no percentages, no pills: the client
   read that furniture as generated. The single appeal pages still use
   AppealCard until they are brought across in a second pass.

   A SPLIT CARD WAS TRIED THE SAME DAY (the photograph cut away from a panel
   of words, like the home banner) and the client went back to this.

   THE TILE SIZES. With every appeal showing, the first is large and the rest
   fall into rows of a wide tile and a small one, swapping sides each row, so
   the grid has a rhythm and every row squares off (see `size`). Once a filter
   is on it is an even grid: a lopsided layout for two results reads as broken.

   THE ENTRANCE (Reveal, and .reveal-curtain / .reveal-rise in index.css)
   The tile rises a little, a teal panel draws up off the photograph as the
   picture settles back from close, and then the lines of words come up one
   after the next. Transform and opacity only. Hovering pushes slowly into the
   photograph.

   THE URL IS THE STATE
   The Appeals menu links straight into filtered views (?cause=water,
   ?country=gaza, ?season=fitr), so the filters read the query string and
   write back to it (replace, not push, so a dozen taps do not become a dozen
   Back presses). One value per group; tapping the lit chip clears it. Groups
   combine with AND: "Food" and "Yemen" is food appeals in Yemen.

   ONLY CHIPS WITH SOMETHING BEHIND THEM (the client's call)
   A chip is drawn only if at least one appeal matches it, so nobody taps
   "Medical" into an empty page. A whole group with nothing in it (Season, at
   the moment) is not drawn at all. The menu still links to all fourteen, so a
   filter arriving from the URL that has no chip is drawn anyway, lit, so the
   reader can see what was asked for and take it off.

   STICKY UNDER THE HEADER
   The bar holds to the top of the screen below the header while the tiles
   scroll, with the count and Clear at its right end, on the page's ground with
   a hairline under it. The groups are told apart by a short rule rather than a
   visible label; each keeps its name for screen readers. On a phone each group
   scrolls sideways rather than wrapping into a wall of chips.

   A TAP KEEPS YOUR PLACE (16 September 2026)
   A filter is a new URL, and Layout used to take every new URL to the top of
   the page. The filters pass KEEP_SCROLL so it does not. If the reader was
   further down the grid than its first row, the page glides back up so the
   first result sits just under the bar; the list below it has changed, and
   being left in the middle of a shorter one reads as nothing happening.

   NOTHING MATCHES
   A card that says in words exactly what was asked for ("No medical appeals in
   Syria are open right now") with each filter as a chip you can take off on
   its own, and a way back to everything. Under it, the open appeals closest to
   the question: those that match at least one of the filters, the best
   matches first, or when nothing matches any of them, the first few open
   appeals. The one gift that is always open (sadaqah) is the band under this
   section, so it is not repeated here.
--------------------------------------------------------------------------- */

type Group = { key: 'cause' | 'country' | 'season'; label: string; names: Record<string, string> }

const GROUPS: Group[] = [
  { key: 'cause', label: 'Need', names: CAUSE_FILTERS },
  { key: 'country', label: 'Place', names: PLACES },
  { key: 'season', label: 'Season', names: SEASONS },
]

type Size = 'large' | 'wide' | 'small' | 'full'

/* The first tile is large with two small beside it; after that, rows of two
   (a wide and a small, swapping sides each row) so every row fills its three
   columns. A tile left alone in its row takes the whole row. */
const size = (i: number, n: number): Size => {
  if (i === 0) return 'large'
  if (i < 3) return 'small'
  const k = i - 3
  if (k % 2 === 0 && i === n - 1) return 'full'
  const evenRow = Math.floor(k / 2) % 2 === 0
  return evenRow === (k % 2 === 0) ? 'wide' : 'small'
}

const SPAN: Record<Size, string> = {
  large: 'sm:col-span-2 lg:row-span-2',
  wide: 'sm:col-span-2',
  small: '',
  full: 'sm:col-span-2 lg:col-span-3',
}

const matches = (a: Appeal, key: Group['key'], value: string) =>
  key === 'cause'
    ? a.causes.includes(value)
    : key === 'country'
      ? a.country === value
      : a.seasons.includes(value)

export default function AppealsList() {
  const [params, setParams] = useSearchParams()
  const bar = useRef<HTMLDivElement>(null)
  const results = useRef<HTMLDivElement>(null)
  const active = {
    cause: params.get('cause'),
    country: params.get('country'),
    season: params.get('season'),
  }
  const filtering = Object.values(active).some(Boolean)

  const shown = APPEAL_LIST.filter((a) =>
    GROUPS.every((g) => !active[g.key] || matches(a, g.key, active[g.key]!)),
  )

  /* Write the filters to the URL without leaving the reader's place, then, if
     they were below the first row, bring the first result up under the bar. */
  const settle = useRef(false)
  const apply = (next: URLSearchParams) => {
    settle.current = true
    setParams(next, { replace: true, preventScrollReset: true, state: KEEP_SCROLL })
  }

  const toggle = (key: Group['key'], value: string) => {
    const next = new URLSearchParams(params)
    if (next.get(key) === value) next.delete(key)
    else next.set(key, value)
    apply(next)
  }
  const drop = (key: Group['key']) => {
    const next = new URLSearchParams(params)
    next.delete(key)
    apply(next)
  }
  const clear = () => apply(new URLSearchParams())

  /* The chips each group draws: every value with an appeal behind it, plus the
     value in the URL if it has none. */
  const chipsFor = (g: Group) =>
    Object.keys(g.names).filter(
      (value) => APPEAL_LIST.some((a) => matches(a, g.key, value)) || active[g.key] === value,
    )

  const asked = [
    active.cause && (CAUSE_FILTERS[active.cause] ?? active.cause).toLowerCase(),
    'appeals',
    active.country && `in ${PLACES[active.country] ?? active.country}`,
    active.season && `for ${SEASONS[active.season] ?? active.season}`,
  ]
    .filter(Boolean)
    .join(' ')

  /* For the empty state: the filters that are on, and the open appeals nearest
     to them. */
  const on = GROUPS.filter((g) => active[g.key]).map((g) => ({
    key: g.key,
    label: g.names[active[g.key]!] ?? active[g.key]!,
  }))
  const score = (a: Appeal) => on.filter((f) => matches(a, f.key, active[f.key]!)).length
  const closest = APPEAL_LIST.map((a) => ({ a, n: score(a) }))
    .filter((x) => x.n > 0)
    .sort((x, y) => y.n - x.n)
    .map((x) => x.a)
  const near = (closest.length ? closest : APPEAL_LIST).slice(0, 3)

  const groups = GROUPS.filter((g) => chipsFor(g).length)
  const bento = !filtering && shown.length >= 5
  const filterKey = `${active.cause}-${active.country}-${active.season}`

  /* After a filter has been drawn: if the reader was below the first row,
     bring the first result up under the bar. */
  useLayoutEffect(() => {
    if (!settle.current || !results.current) return
    settle.current = false
    const header =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0
    const target =
      results.current.getBoundingClientRect().top +
      window.scrollY -
      header -
      (bar.current?.offsetHeight ?? 0)
    if (window.scrollY <= target + 1) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: target, behavior: still ? 'auto' : 'smooth' })
  }, [filterKey])

  return (
    <section
      id="all"
      aria-labelledby="list-head"
      className={`scroll-mt-[var(--header-h)] ${SECTION_Y}`}
    >
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="list-head"
          eyebrow="Every open appeal"
          title="Choose where it goes."
          lede="Narrow it down by need or by place. Each one says the smallest donation that helps."
        />
      </div>

      {/* --- the filters --- */}
      <div
        ref={bar}
        className="sticky top-[var(--header-h)] z-30 mt-s4 border-b border-line bg-ground/95 backdrop-blur-sm lg:mt-s5"
      >
        <div className="gutter mx-auto max-w-page">
          <div
            className={`flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:gap-s4 ${BREAKOUT}`}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:gap-s2">
              {groups.map((g, gi) => (
                <div
                  key={g.key}
                  role="group"
                  aria-label={g.label}
                  className="flex min-w-0 items-center gap-s2"
                >
                  {gi > 0 && (
                    <span
                      aria-hidden="true"
                      className="hidden h-5 w-px shrink-0 bg-line lg:block"
                    />
                  )}
                  <div className="-my-1 flex gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {chipsFor(g).map((value) => {
                      const lit = active[g.key] === value
                      return (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={lit}
                          onClick={() => toggle(g.key, value)}
                          className={`shrink-0 rounded-full px-3.5 py-[7px] text-[13.5px] font-medium whitespace-nowrap transition-[background-color,color] duration-200 ease-brand ${
                            lit
                              ? 'bg-teal text-paper'
                              : 'text-text-2 hover:bg-ink/[0.05] hover:text-ink'
                          }`}
                        >
                          {g.names[value] ?? value}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-s3 lg:justify-end">
              <p aria-live="polite" className="nums text-[13.5px] text-text-3">
                {shown.length} {shown.length === 1 ? 'appeal' : 'appeals'}
              </p>
              {filtering && (
                <button
                  type="button"
                  onClick={clear}
                  className="text-[13.5px] font-semibold text-green underline decoration-green/30 underline-offset-4 hover:text-ink"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- the tiles, or the empty state --- */}
      <div ref={results} className="gutter mx-auto max-w-page pt-s4 lg:pt-s5">
        {shown.length > 0 ? (
          <ul
            key={filterKey}
            className={`grid auto-rows-[min(96vw,400px)] gap-s2 sm:auto-rows-[300px] sm:grid-cols-2 lg:auto-rows-[clamp(250px,21vw,330px)] lg:grid-cols-3 ${BREAKOUT}`}
          >
            {shown.map((a, i) => {
              const s = bento ? size(i, shown.length) : 'small'
              return (
                <li key={a.slug} className={SPAN[s]}>
                  <Reveal variant="up" delay={Math.min(i, 5) * 80} className="h-full">
                    <AppealTile appeal={a} big={s !== 'small'} eager={i === 0} />
                  </Reveal>
                </li>
              )
            })}
          </ul>
        ) : (
          <div key={filterKey} className={BREAKOUT}>
            {/* the answer, in words, with a way out of each part of it */}
            <div
              className="relative isolate overflow-hidden rounded-2xl bg-paper p-s3 ring-1 ring-line sm:p-s4 lg:p-[clamp(36px,3.6vw,56px)]"
              style={{ animation: 'hero-soft 900ms var(--ease-reveal) both' }}
            >
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 bg-[radial-gradient(70%_120%_at_100%_0%,rgba(0,103,112,0.09)_0%,transparent_60%)]"
              />
              <div className="flex flex-col gap-s4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-[40rem]">
                  <p className="font-script text-[clamp(22px,2vw,28px)] leading-none text-green">
                    Nothing open here yet
                  </p>
                  <p className="mt-s2 font-display text-[clamp(26px,3vw,40px)] leading-[1.08] font-semibold tracking-[-0.02em] text-balance">
                    No {asked} are open right now.
                  </p>
                  <p className="mt-s2 max-w-[48ch] text-[15.5px] leading-relaxed text-text-2">
                    When one opens it will show here. Take a filter off, or look at the closest
                    appeals below.
                  </p>

                  <ul aria-label="Filters on" className="mt-s3 flex flex-wrap gap-2">
                    {on.map((f, i) => (
                      <li
                        key={f.key}
                        style={{
                          animation: `hero-rise 600ms var(--ease-brand) ${200 + i * 80}ms both`,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => drop(f.key)}
                          aria-label={`Remove ${f.label}`}
                          className="group inline-flex items-center gap-2 rounded-full bg-teal py-[7px] pr-2 pl-3.5 text-[13.5px] font-medium text-paper transition-colors duration-200 ease-brand hover:bg-ink"
                        >
                          {f.label}
                          <span
                            aria-hidden="true"
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-paper/15 transition-transform duration-300 ease-brand group-hover:rotate-90"
                          >
                            <svg
                              viewBox="0 0 12 12"
                              className="h-2.5 w-2.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            >
                              <path d="M3 3l6 6M9 3l-6 6" />
                            </svg>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={clear}
                  className="group inline-flex min-h-[50px] shrink-0 items-center gap-2 self-start rounded-[10px] border border-ink/15 px-6 text-[15.5px] font-semibold text-text transition-[border-color,background-color] duration-200 ease-brand hover:border-ink hover:bg-ground lg:self-end"
                >
                  See all {APPEAL_LIST.length} appeals
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>

            {/* the closest open appeals */}
            <p className="mt-s5 mb-s3 font-script text-[clamp(22px,2vw,28px)] leading-none text-green">
              {closest.length ? 'Closest to what you asked' : 'Open right now'}
            </p>
            <ul className="grid auto-rows-[min(96vw,400px)] gap-s2 sm:auto-rows-[300px] sm:grid-cols-2 lg:auto-rows-[clamp(250px,21vw,330px)] lg:grid-cols-3">
              {near.map((a, i) => (
                <li key={a.slug} className={i === 2 ? 'sm:col-span-2 lg:col-span-1' : ''}>
                  <Reveal variant="up" delay={i * 90} className="h-full">
                    <AppealTile appeal={a} big={false} eager={false} />
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
