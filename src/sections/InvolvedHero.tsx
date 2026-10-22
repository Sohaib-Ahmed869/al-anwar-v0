import { ArrowRight } from '../components/icons'
import { HERO } from '../components/involved-data'

/* ---------------------------------------------------------------------------
   Get involved, section 1 of 5: the hero.

   17 SEPTEMBER 2026, rebuilt on the Contact hero at the user's choice: a wide
   photograph taken to greyscale with the logo teal laid flat over it, a 3px
   dot screen, a lighter pane down the left, the words at the foot on the left
   and the way in on the right. /get-involved is in Header's OVERLAY_ROUTES,
   so the header sits over it and turns solid once past.

   It replaced the compact ink PageBand and the index strip under it. A card
   row of the ways in followed it for a day and was removed at the user's
   request, so "Find your way in" goes straight to the first of them.

   The photograph is licensed stock bought for the events diary before that
   was removed (event-packing-*.jpg, see the README): four volunteers packing
   food boxes. They are not Al-Anwaar's volunteers, so nothing here may
   caption it, and its alt is empty because it is decoration under the words.
   Only 1600 wide exists; the teal wash and the screen hide the softness. Keep
   decoding="sync" and no -z-10 on the picture layer (see ContactHero: without
   them the photo did not paint on first load).
--------------------------------------------------------------------------- */

const rise = (ms: number) => ({ animation: `hero-soft 1000ms var(--ease-reveal) ${ms}ms both` })

const wantsLessMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The screen over the photograph: one pale dot every 3px. */
const SCREEN = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.22) 0.6px, transparent 0.9px)',
  backgroundSize: '3px 3px',
}

export default function InvolvedHero() {
  const toWays = () =>
    document.getElementById('volunteer')?.scrollIntoView({
      behavior: wantsLessMotion() ? 'auto' : 'smooth',
      block: 'start',
    })

  return (
    <section
      data-overlay-hero=""
      aria-labelledby="involved-title"
      className="relative isolate mt-[calc(var(--header-h)*-1)] overflow-hidden bg-grad-deep-x"
    >
      {/* ---------- the picture ---------- */}
      <div aria-hidden="true" className="absolute inset-0">
        <img
          src="/assets/images/event-packing-1600.jpg"
          srcSet="/assets/images/event-packing-800.jpg 800w, /assets/images/event-packing-1600.jpg 1600w"
          sizes="100vw"
          alt=""
          width={1600}
          height={1000}
          decoding="sync"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover grayscale brightness-[0.9] contrast-[1.1]"
          style={{ objectPosition: '60% 30%', animation: 'hero-zoom 24s linear both' }}
        />
        {/* the teal wash, laid flat over the greyscale photograph */}
        <div className="absolute inset-0 bg-teal/[0.7]" />
        {/* the lighter pane down the left, with a hairline edge */}
        <div className="absolute inset-y-0 left-0 hidden w-[42%] border-r border-paper/15 bg-paper/[0.06] md:block" />
        {/* the screen */}
        <div className="absolute inset-0 opacity-70" style={SCREEN} />
        {/* a little depth at the foot, under the words */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(8,38,42,0.45)_100%)]" />
      </div>

      <div className="relative gutter mx-auto flex min-h-[clamp(520px,80svh,820px)] max-w-page flex-col justify-end pt-[calc(var(--header-h)+40px)] pb-[clamp(36px,6vh,64px)]">
        <div className="flex flex-col gap-s4 md:flex-row md:items-end md:justify-between">
          <div>
            <p
              className="font-script text-[clamp(24px,2.2vw,32px)] leading-none text-gold-pale"
              style={rise(60)}
            >
              {HERO.eyebrow}
            </p>
            <h1
              id="involved-title"
              className="mt-s2 font-display text-[clamp(40px,5.6vw,84px)] leading-[0.98] tracking-[-0.04em] text-paper [text-shadow:0_2px_30px_rgba(8,38,42,0.35)]"
              style={rise(140)}
            >
              <span className="block">{HERO.titleLead}</span>
              <span className="block text-gold-pale">{HERO.titleMark}</span>
            </h1>
            <p
              className="mt-s3 max-w-[46ch] text-[clamp(15.5px,1.25vw,18px)] leading-[1.55] text-pretty text-paper/90"
              style={rise(320)}
            >
              {HERO.intro}
            </p>
          </div>

          <div className="shrink-0" style={rise(480)}>
            <button
              type="button"
              onClick={toWays}
              className="group inline-flex min-h-[44px] items-center gap-3 font-display text-[clamp(18px,1.5vw,22px)] tracking-[-0.015em] text-paper transition-colors duration-200 ease-brand hover:text-gold-pale"
            >
              {HERO.more}
              <span
                aria-hidden="true"
                className="flex size-10 items-center justify-center rounded-full border border-paper/40 transition-[border-color,background-color,color] duration-300 ease-brand group-hover:border-gold-pale group-hover:bg-gold-pale group-hover:text-ink"
              >
                <ArrowRight className="h-3.5 w-3.5 rotate-90 transition-transform duration-300 ease-brand group-hover:translate-y-0.5" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
