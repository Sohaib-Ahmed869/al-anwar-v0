import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { MasjidMark } from '../components/Ornament'
import { Words } from '../components/Reveal'
import { ArrowRight, HandHeart } from '../components/icons'

/* ---------------------------------------------------------------------------
   About, section 1 of 5: the hero.

   THIRD VERSION, 17 SEPTEMBER 2026. The history, so nobody walks it back:
     1. a full screen of the Gambia masjid photo: the user wanted no image
     2. ink with green washes: the user wanted the dark background gone
     3. a lattice arch with a white card of four stats over its foot: the user
        asked for the arch ("tomb") and the stats to come off
   So: no photograph, no dark ground, no background shape, no stat tiles.

   What carries it now is type and movement, on the page's own ground:

     THE TITLE   very large and left aligned, "giving to." in teal with a gold
                 stroke drawn under it once the words have landed.
     THE PLACES  "Delivering in" and a place that turns over every couple of
                 seconds, Gaza first. Under reduced motion it holds on Gaza and
                 the full list is in the sentence beside it anyway.
     NO RIBBON   the band of the work that ran under the hero was removed at
                 the user's request the same day.

   /about is not in Header's OVERLAY_ROUTES: the bar is solid over a light hero.
--------------------------------------------------------------------------- */

const PLACES = ['Gaza', 'Yemen', 'Lebanon', 'Syria', 'The Gambia']

const rise = (ms: number) => ({ animation: `hero-soft 1000ms var(--ease-reveal) ${ms}ms both` })

/* The place that turns over. Each new word is remounted by key so it rises in
   through word-rise, the same entrance as the title's words. */
function TurningPlace() {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => setI((n) => (n + 1) % PLACES.length), 2400)
    return () => window.clearInterval(id)
  }, [])

  return (
    <span className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-bottom">
      <span
        key={i}
        className="inline-block text-teal"
        style={{ animation: 'word-rise 800ms var(--ease-reveal) both' }}
      >
        {PLACES[i]}
      </span>
    </span>
  )
}

export default function AboutHero() {
  return (
    <section aria-labelledby="about-title" className="relative isolate overflow-hidden">
      <div className="gutter mx-auto max-w-page pt-[clamp(64px,11vh,140px)] pb-[clamp(48px,8vh,96px)]">
        <p
          className="flex items-center gap-3 font-script text-[clamp(24px,2.2vw,32px)] leading-none text-green"
          style={rise(60)}
        >
          <MasjidMark className="size-7 text-teal sm:size-8" />
          About us
        </p>

        {/* The title on the left, and where we are standing level with its
            last line on the right. */}
        <div className="mt-s3 grid gap-s4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-s5">
          <h1
            id="about-title"
            className="font-display text-[clamp(36px,5.2vw,76px)] leading-[0.98] font-semibold tracking-[-0.04em] text-text"
          >
            <span className="block">
              <Words text="Who you are" play="load" delay={140} step={80} />
            </span>
            <span className="relative inline-block text-teal">
              <Words text="giving to." play="load" delay={380} step={80} />
              {/* the gold stroke, drawn once the words are in */}
              <svg
                aria-hidden="true"
                viewBox="0 0 300 16"
                preserveAspectRatio="none"
                className="absolute -bottom-[0.16em] left-0 h-[0.14em] w-full overflow-visible"
              >
                <path
                  d="M3 11 C 70 3, 190 2, 297 8"
                  fill="none"
                  stroke="var(--color-gold)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray="1"
                  style={{ animation: 'stroke-draw 900ms var(--ease-reveal) 950ms both' }}
                />
              </svg>
            </span>
          </h1>

          <p
            className="border-l-2 border-gold pl-s2 font-display text-[clamp(22px,2.3vw,34px)] leading-[1.05] font-semibold tracking-[-0.03em] text-text lg:mb-[0.2em] lg:min-w-[7.2em] lg:justify-self-end"
            style={rise(600)}
          >
            <span className="block text-[clamp(12px,0.95vw,13.5px)] font-semibold tracking-[0.16em] text-text-3 uppercase">
              Delivering in
            </span>
            <span className="sr-only">{PLACES.join(', ')}</span>
            <span aria-hidden="true" className="mt-1 block">
              <TurningPlace />
            </span>
          </p>
        </div>

        {/* The foot: what we are on the left, how to act on the right, on one
            hairline. */}
        <div
          className="mt-[clamp(32px,5vh,64px)] flex flex-col gap-s3 border-t border-line pt-s3 md:flex-row md:items-center md:justify-between md:gap-s5"
          style={rise(750)}
        >
          <p className="max-w-[56ch] text-[clamp(15.5px,1.2vw,17.5px)] leading-[1.6] text-text-2">
            A registered Australian charity since 2020, delivering food, water and lasting builds
            through partners we can name, and publishing where every gift goes.
          </p>

          <div className="flex shrink-0 flex-wrap items-center gap-x-s3 gap-y-s2">
            <a
              href="#story"
              className="group inline-flex min-h-[44px] items-center gap-2 border-b border-ink/25 text-[15.5px] font-semibold text-text transition-colors duration-200 ease-brand hover:border-teal hover:text-teal"
            >
              Read our story
              <ArrowRight className="h-3 w-3 rotate-90 transition-transform duration-300 ease-brand group-hover:translate-y-0.5" />
            </a>

            {/* Gold, because this one takes money. */}
            <Link
              to="/give"
              className="group relative inline-flex min-h-[54px] items-center justify-center gap-2.5 overflow-hidden rounded-[13px] bg-gold px-7 text-[16px] font-semibold tracking-[-0.008em] text-ink shadow-gold transition-[transform,box-shadow,background-color,color] duration-200 ease-brand hover:-translate-y-[1.5px] hover:bg-gold-dark hover:text-paper hover:shadow-gold-lg active:translate-y-0"
            >
              <HandHeart className="h-[18px] w-[18px] shrink-0 transition-transform duration-300 ease-brand group-hover:scale-[1.12]" />
              Donate
            </Link>
          </div>
        </div>
      </div>

    </section>
  )
}
