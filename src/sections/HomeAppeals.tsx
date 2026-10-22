import { Sticker } from '../components/Brand'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import SectionHead, { SECTION_Y } from '../components/SectionHead'
import { ArrowRight } from '../components/icons'
import { APPEAL_LIST, giveHref } from '../components/appeals-data'
import { appealView, money } from '../components/appeal-view'

/* ---------------------------------------------------------------------------
   Step 2 of the home argument: what's urgent right now.

   The hero moves someone and then asks them to give — but to what? This is
   where the feeling becomes a decision.

   ONE APPEAL AT A TIME, AT FULL WIDTH, AND IT MOVES ON ITS OWN — modelled on
   Al-Ihsan's appeal banner at the client's direction (16 September 2026). A
   solid panel on the left with the cause in script, the title, one line of
   description, what has been raised so far, and a "from" price with the Donate
   button beside it; the photograph on the right with nothing on it; two round
   arrows over the top right.

   It was a card rail, then a banner with tabs, progress bars and a pulsing
   crisis dot. The client read the second as generated rather than designed,
   and the extra furniture went with it.

   THE PANEL IS THE LOGO'S TEAL (--color-teal), not --color-green: the client
   asked that it be the same green as the mark, with no visible difference.

   THE LOOP. The track carries one extra slide at the end, a copy of the first.
   Going forward from the last appeal slides onto the copy and, when that
   transition ends, jumps back to the real first with the transition off — so
   the banner always travels left and never rewinds across all five. Going back
   from the first does the same in reverse before it animates.

   THE PHOTOGRAPHS AND THE "FROM" PRICE are worked out in
   components/appeal-view.ts, which the /appeals hero and tiles share.
--------------------------------------------------------------------------- */

/** How long each appeal stays before the banner moves on, in ms. */
const HOLD = 6000

const APPEALS = APPEAL_LIST.filter((a) => a.home).map((a) => {
  const v = appealView(a)
  return { ...v, pct: Math.min(Math.round((a.raised / a.goal) * 100), 100) }
})

const SLIDES = [...APPEALS, APPEALS[0]]
const N = APPEALS.length

/* How far a finger has to travel across the banner to count as a swipe. */
const SWIPE = 48

export default function HomeAppeals() {
  /* 0..N, where N is the copy of the first slide */
  const [at, setAt] = useState(0)
  const [animate, setAnimate] = useState(true)
  const real = at % N

  const step = (dir: 1 | -1) => {
    if (dir === -1 && at === 0) {
      /* jump to the copy without moving, then slide back one */
      setAnimate(false)
      setAt(N)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setAnimate(true)
          setAt(N - 1)
        }),
      )
      return
    }
    setAnimate(true)
    setAt((i) => Math.min(i + dir, N))
  }

  const onEnd = () => {
    if (at !== N) return
    setAnimate(false)
    setAt(0)
  }

  /* Timer restarts on every move, so an arrow press gets a full hold. */
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setTimeout(() => step(1), HOLD)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at])

  const downX = useRef<number | null>(null)
  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') downX.current = e.clientX
  }
  const onUp = (e: PointerEvent) => {
    if (downX.current === null) return
    const dx = e.clientX - downX.current
    downX.current = null
    if (Math.abs(dx) > SWIPE) step(dx < 0 ? 1 : -1)
  }

  return (
    <section aria-labelledby="appeals-head" aria-roledescription="carousel" className="relative">
      <div className="gutter mx-auto max-w-page">
        {/* No top border and no padding of its own beyond SECTION_Y: the gaps
            between home bands are all the same now. */}
        <div className={SECTION_Y}>
          {/* --- the head --- the shared one; see components/SectionHead.tsx */}
          <SectionHead
            id="appeals-head"
            eyebrow="Open right now"
            title="Where your help is needed this week."
            action={
              <div className="flex items-center gap-s3">
                <Link
                  to="/appeals"
                  className="group flex shrink-0 items-center gap-1.5 text-[14.5px] font-semibold text-green transition-colors duration-200 ease-brand hover:text-ink"
                >
                  All appeals
                  <ArrowRight className="h-3 w-3 -translate-x-0.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                </Link>
                <div className="flex gap-2.5">
                  {([-1, 1] as const).map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => step(dir)}
                      aria-label={dir === -1 ? 'Previous appeal' : 'Next appeal'}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-teal text-paper transition-[background-color,transform] duration-200 ease-brand hover:bg-ink active:scale-95"
                    >
                      <Chevron className={`h-4 w-4 ${dir === -1 ? 'rotate-180' : ''}`} />
                    </button>
                  ))}
                </div>
              </div>
            }
          />

          {/* --- the banner --- unmasks upward as it scrolls in */}
          <Reveal variant="clip" delay={160}>
            {/* Wider than the page column: it reaches out up to 72px a side,
                and never closer than 24px to the window edge. */}
            <div
              className="mt-s4 touch-pan-y overflow-hidden lg:mt-s5 lg:-mx-[min(72px,max(0px,calc((100vw_-_100%)/2_-_24px)))]"
              onPointerDown={onDown}
              onPointerUp={onUp}
              onPointerCancel={() => (downX.current = null)}
            >
              <div
                className="flex"
                style={{
                  transform: `translate3d(-${at * 100}%,0,0)`,
                  transition: animate ? 'transform 800ms cubic-bezier(.65,0,.35,1)' : 'none',
                }}
                onTransitionEnd={(e) => e.target === e.currentTarget && onEnd()}
              >
                {SLIDES.map((a, i) => {
                  const shown = i === at || (at === N && i === 0)
                  const hidden = !shown || i === N
                  return (
                    <div
                      key={`${a.slug}-${i}`}
                      role="group"
                      aria-roledescription="slide"
                      aria-label={`${(i % N) + 1} of ${N}: ${a.title}`}
                      aria-hidden={hidden || undefined}
                      className="grid w-full shrink-0 grid-rows-[auto_1fr] lg:h-[clamp(380px,31vw,500px)] lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] lg:grid-rows-1"
                    >
                      {/* the panel */}
                      <div className="relative isolate order-2 flex flex-col overflow-hidden rounded-b-2xl bg-grad-lagoon p-s3 text-paper sm:p-s4 lg:order-1 lg:rounded-tl-2xl lg:rounded-br-none lg:p-[clamp(32px,3.2vw,52px)]">
                        {/* the panel is the guide's lagoon gradient (medium teal
                            into teal, p. 15) */}
                        <p className="font-script text-[clamp(28px,2.6vw,40px)] leading-none text-gold-pale">
                          {a.cause}
                        </p>
                        <h3 className="mt-2 font-display text-[clamp(26px,2.5vw,36px)] leading-[1.1] tracking-[-0.02em] text-balance">
                          {a.title}
                        </h3>
                        <p className="mt-s2 max-w-[40ch] text-[15.5px] leading-[1.55] text-paper/85 lg:line-clamp-3">
                          {a.blurb}
                        </p>

                        {/* What has come in so far. PLACEHOLDER figures — see
                            the TODO in appeals-data.ts. The bar fills each time
                            its slide comes round. */}
                        <div className="mt-s4 lg:mt-auto lg:pt-s3">
                          <div
                            role="progressbar"
                            aria-valuenow={a.pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${money(a.raised)} raised of ${money(a.goal)}`}
                            className="h-1.5 w-full overflow-hidden rounded-full bg-paper/20"
                          >
                            <span
                              className="block h-full rounded-full bg-[linear-gradient(90deg,var(--color-offwhite),var(--color-gold))]"
                              style={{
                                width: `${shown ? a.pct : 0}%`,
                                transition: shown ? 'width 1100ms var(--ease-brand) 350ms' : 'none',
                              }}
                            />
                          </div>
                          <p className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-3 text-[14px]">
                            <span>
                              <b className="nums font-semibold">{money(a.raised)}</b>{' '}
                              <span className="text-paper/75">raised</span>
                            </span>
                            <span className="nums text-paper/75">
                              {a.pct}% of {money(a.goal)}
                            </span>
                          </p>
                        </div>

                        {/* The price and the button share a row: the button sits on
                            the figure it gives, not in a corner of the photograph
                            (moved 16 September 2026, at the client's request). */}
                        <div className="mt-s3 flex flex-wrap items-end justify-between gap-x-s3 gap-y-s2">
                          <div>
                            <p className="text-[13px] font-semibold">{a.fromLine}</p>
                            <p className="nums mt-1 font-display text-[clamp(44px,4.2vw,66px)] leading-none tracking-[-0.03em]">
                              {money(a.from)}
                            </p>
                          </div>
                          <Link
                            to={giveHref(a)}
                            tabIndex={hidden ? -1 : undefined}
                            className="group inline-flex min-h-[48px] items-center gap-2 rounded-[10px] bg-gold px-5 text-[15px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-gold-dark hover:text-ink sm:min-h-[52px] sm:px-6 sm:text-[16px]"
                          >
                            Donate Now
                            <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" />
                            <span className="sr-only"> to {a.title}</span>
                          </Link>
                        </div>
                      </div>

                      {/* the photograph */}
                      <div className="relative order-1 aspect-[16/10] overflow-hidden rounded-t-2xl bg-ink lg:order-2 lg:aspect-auto lg:rounded-tl-none lg:rounded-br-2xl">
                        <img
                          src={a.src}
                          srcSet={a.srcSet}
                          sizes="(min-width: 1024px) 70vw, 100vw"
                          alt=""
                          loading={i === 0 ? 'eager' : 'lazy'}
                          decoding="async"
                          draggable={false}
                          className="absolute inset-0 h-full w-full object-cover select-none"
                          style={{ objectPosition: a.position }}
                        />
                        {/* the stamp: the brandmark sticker on the photograph's
                            corner, as the guide lays it over imagery (p. 16) */}
                        <Sticker className="absolute top-5 right-5 w-[clamp(56px,5vw,84px)]" />

                        {/* The cause pill that sat top-left on the photograph came
                            off at the client's request, 16 September 2026: the
                            cause is already the script line in the panel. The Donate
                            button that sat bottom-right went to the panel, beside
                            the price. */}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* where you are, quietly */}
            <div aria-hidden="true" className="mt-s3 flex justify-center gap-2">
              {APPEALS.map((a, i) => (
                <span
                  key={a.slug}
                  className={`h-1.5 rounded-full transition-[width,background-color] duration-500 ease-brand ${
                    i === real ? 'w-6 bg-teal' : 'w-1.5 bg-line'
                  }`}
                />
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}
