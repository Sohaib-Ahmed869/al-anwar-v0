import { useState } from 'react'
import { Link } from 'react-router-dom'

import FundraiserTile from '../components/FundraiserTile'
import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { LISTING, REASONS, type Reason } from '../components/fundraiser-data'
import { ArrowRight } from '../components/icons'
import { allFundraisers } from '../services/fundraisers'

/* ---------------------------------------------------------------------------
   /fundraisers, section 2 of 3: every fundraiser, filtered by occasion.

   Rebuilt 17 September 2026 on AppealsList, at the user's request:
     - the shared SectionHead with "Start a fundraiser" on its right
     - a filter bar that holds under the header while the tiles scroll, on the
       page's ground with a hairline, with the count at its right end
     - photograph tiles (FundraiserTile) instead of white cards. With no
       filter on, the first tile is large and the rest fall into the appeals
       page's rows (see `size`); with a filter on, an even grid
   Chips only for occasions that have a fundraiser. The filter is local state:
   nothing links to a filtered view yet.
--------------------------------------------------------------------------- */

type Size = 'large' | 'wide' | 'small' | 'full'

/* Same rhythm as AppealsList: large with two small beside it, then rows of a
   wide and a small swapping sides; a tile alone in its row takes the row. */
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

export default function FundraisersList() {
  const list = allFundraisers()
  const [on, setOn] = useState<Reason | 'all'>('all')
  const shown = on === 'all' ? list : list.filter((f) => f.reason === on)
  const chips = REASONS.filter((r) => list.some((f) => f.reason === r.id))
  const bento = on === 'all' && shown.length >= 4

  return (
    <section
      id="browse"
      aria-labelledby="browse-head"
      className={`scroll-mt-[var(--header-h)] ${SECTION_Y}`}
    >
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="browse-head"
          eyebrow={LISTING.list.eyebrow}
          title={LISTING.list.title}
          lede={LISTING.list.lede}
          action={
            <Link
              to="/fundraisers/start"
              className="group inline-flex min-h-[50px] items-center gap-2 rounded-[10px] bg-teal px-6 text-[15.5px] font-semibold text-paper transition duration-200 ease-brand hover:-translate-y-px hover:bg-ink"
            >
              {LISTING.hero.start}
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
            </Link>
          }
        />
      </div>

      {/* --- the filters --- */}
      <div className="sticky top-[var(--header-h)] z-30 mt-s4 border-b border-line bg-ground/95 backdrop-blur-sm lg:mt-s5">
        <div className="gutter mx-auto max-w-page">
          <div className={`flex items-center gap-s3 py-3 ${BREAKOUT}`}>
            <div
              role="group"
              aria-label="Filter by occasion"
              className="-my-1 flex min-w-0 flex-1 gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {[{ id: 'all' as const, label: LISTING.list.all }, ...chips].map((c) => {
                const lit = on === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={lit}
                    onClick={() => setOn(c.id)}
                    className={`shrink-0 rounded-full px-3.5 py-[7px] text-[13.5px] font-medium whitespace-nowrap transition-[background-color,color] duration-200 ease-brand ${
                      lit ? 'bg-teal text-paper' : 'text-text-2 hover:bg-ink/[0.05] hover:text-ink'
                    }`}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
            <p aria-live="polite" className="nums shrink-0 text-[13.5px] text-text-3">
              {shown.length} {shown.length === 1 ? 'fundraiser' : 'fundraisers'}
            </p>
          </div>
        </div>
      </div>

      {/* --- the tiles --- */}
      <div className="gutter mx-auto max-w-page pt-s4 lg:pt-s5">
        {shown.length ? (
          <ul
            key={on}
            className={`grid auto-rows-[min(110vw,440px)] gap-s2 sm:auto-rows-[320px] sm:grid-cols-2 lg:auto-rows-[clamp(270px,23vw,350px)] lg:grid-cols-3 ${BREAKOUT}`}
          >
            {shown.map((f, i) => {
              const s = bento ? size(i, shown.length) : 'small'
              return (
                <li key={f.slug} className={SPAN[s]}>
                  <Reveal variant="up" delay={Math.min(i, 5) * 80} className="h-full">
                    <FundraiserTile fundraiser={f} big={s !== 'small'} eager={i === 0} />
                  </Reveal>
                </li>
              )
            })}
          </ul>
        ) : (
          <div
            className={`flex flex-col items-start gap-s2 rounded-2xl border border-dashed border-line p-s4 ${BREAKOUT}`}
          >
            <p className="text-[15.5px] text-text-2">{LISTING.list.empty}</p>
            <Link
              to="/fundraisers/start"
              className="group inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-teal"
            >
              {LISTING.hero.start}
              <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
