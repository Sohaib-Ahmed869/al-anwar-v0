import { Link } from 'react-router-dom'

import { Words, useHeroDepth } from '../components/Reveal'
import { ArrowRight, HandHeart } from '../components/icons'
import { wayView, type Season } from '../components/season-data'

/* ---------------------------------------------------------------------------
   /ramadan and /dhul-hijjah, section 1 of 5: the hero.

   ZakatHero's layout, because these two pages sit beside it in the same menu:
   one screen, the words on the left in a script eyebrow and a plain title, the
   verse on the right from lg up and under the buttons below it.

   NO LEDE AND NO STATUS LINE under the title: both came off on 17 September
   2026 at the user's request. When a season is off, the ways panel still
   says when it opens.

   THE GOLD BUTTON only appears when it can take money. On /dhul-hijjah it is
   Qurbani, which waits for `live`; until then the hero offers the ways to give
   as a plain link and nothing gold.

   PHOTOGRAPHS are stock on both pages (credits in season-data.ts and
   give-data.ts), so the hero carries no caption.
--------------------------------------------------------------------------- */

const rise = (step: number) => ({
  animation: 'hero-soft 1000ms var(--ease-reveal) both',
  animationDelay: `${step * 140}ms`,
})

const toWays = () =>
  document.getElementById('ways')?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  })

export default function SeasonHero({ season }: { season: Season }) {
  const depth = useHeroDepth<HTMLElement>()
  const { photo, verse } = season
  const [small, large] = photo.widths
  const leadWay = season.ways.items.find((w) => w.fund === season.lead.fund)
  const canGive = season.live || !leadWay?.inSeason
  const lead = leadWay ? wayView(leadWay) : null

  return (
    <section
      ref={depth.hero}
      data-overlay-hero=""
      aria-labelledby="season-title"
      className="relative isolate mt-[calc(var(--header-h)*-1)] overflow-hidden bg-ink text-paper"
    >
      <div
        ref={depth.photo}
        aria-hidden="true"
        className="absolute inset-x-0 -top-[4%] -bottom-[4%] bg-ink will-change-[translate] hero-intro"
      >
        <img
          src={`/assets/images/${photo.stem}-${large}.jpg`}
          srcSet={`/assets/images/${photo.stem}-${small}.jpg ${small}w, /assets/images/${photo.stem}-${large}.jpg ${large}w`}
          sizes="100vw"
          alt=""
          decoding="sync"
          fetchPriority="high"
          className="h-full w-full object-cover"
          style={{ objectPosition: photo.position }}
        />
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(21,26,24,0.6)_0%,rgba(21,26,24,0.12)_28%,rgba(21,26,24,0.2)_62%,rgba(21,26,24,0.85)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-ink/40 md:bg-[linear-gradient(90deg,rgba(21,26,24,0.8)_0%,rgba(21,26,24,0.35)_42%,rgba(21,26,24,0.1)_58%,rgba(21,26,24,0.6)_100%)]"
      />

      <div className="relative flex min-h-[calc(100svh-var(--strip-h))] items-center pt-[var(--header-h)] pb-[clamp(56px,9vh,96px)]">
        <div className="gutter mx-auto w-full max-w-page">
          <div
            ref={depth.content}
            className="grid gap-y-10 lg:grid-cols-[minmax(0,560px)_minmax(0,430px)] lg:items-center lg:justify-between"
          >
            <div>
              <p
                className="font-script text-[clamp(21px,1.9vw,27px)] leading-none text-gold-pale [text-shadow:0_1px_16px_rgba(0,0,0,0.55)]"
                style={rise(0)}
              >
                {season.eyebrow}
              </p>
              <h1
                id="season-title"
                className="mt-s2 font-display text-[clamp(31px,4.2vw,54px)] leading-[1.05] font-semibold tracking-[-0.022em] text-paper [text-wrap:balance] [text-shadow:0_2px_30px_rgba(0,0,0,0.5)]"
              >
                <Words text={season.title} play="load" delay={140} step={70} />
              </h1>
              <div className="mt-7 flex flex-wrap items-center gap-x-s4 gap-y-s2" style={rise(5)}>
                {canGive && lead && (
                  <Link
                    to={lead.to}
                    className="group relative inline-flex min-h-[54px] items-center justify-center gap-2.5 overflow-hidden rounded-[13px] bg-gold px-7 text-[16px] font-semibold tracking-[-0.008em] text-ink shadow-gold transition-[transform,box-shadow,background-color,color] duration-200 ease-brand hover:-translate-y-[1.5px] hover:bg-gold-dark hover:text-paper hover:shadow-gold-lg active:translate-y-0"
                  >
                    <HandHeart className="h-[18px] w-[18px] shrink-0 transition-transform duration-300 ease-brand group-hover:scale-[1.12]" />
                    {season.lead.label}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={toWays}
                  className="group inline-flex min-h-[44px] items-center gap-2 border-b border-paper/35 text-[15px] font-semibold text-paper transition-colors duration-200 ease-brand hover:border-gold-pale hover:text-gold-pale"
                >
                  See every way to give
                  <ArrowRight className="h-3 w-3 rotate-90 transition-transform duration-300 ease-brand group-hover:translate-y-0.5" />
                </button>
              </div>
            </div>

            <figure className="border-l border-gold-pale/40 pl-6 lg:pl-8" style={rise(6)}>
              <p
                lang="ar"
                dir="rtl"
                className="font-arabic text-[clamp(22px,2vw,28px)] leading-[1.85] text-paper [text-wrap:balance] [text-shadow:0_1px_18px_rgba(0,0,0,0.7)]"
              >
                {verse.arabic}
              </p>
              <blockquote className="mt-3 font-serif text-[clamp(17px,1.45vw,20px)] leading-[1.5] text-paper/85 italic [text-wrap:pretty] [text-shadow:0_1px_18px_rgba(0,0,0,0.7)]">
                &ldquo;{verse.english}&rdquo;
              </blockquote>
              <figcaption className="mt-4 text-[12.5px] font-medium tracking-[0.08em] text-gold-pale/80 uppercase">
                {verse.cite}
              </figcaption>
            </figure>
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(200,155,44,.5),rgba(47,107,90,.5),transparent)]"
      />
    </section>
  )
}
