import { ArrowRight } from '../components/icons'
import { HERO } from '../components/volunteer-data'
import { PHONE } from '../components/nav-data'

/* ---------------------------------------------------------------------------
   /volunteer, section 1 of 6: the hero.

   The Contact hero's pattern (17 September 2026): the photograph in greyscale
   with the logo teal laid flat over it, a 3px dot screen, a lighter pane down
   the left, the words at the foot on the left and the way in on the right.
   /volunteer is in Header's OVERLAY_ROUTES.

   The photograph is the reference's hero, used at the user's request: Tim
   Marshall's "Hands forming a heart" on Unsplash (licence and why it must stay
   greyscale are in volunteer-data.ts). Alt is empty: decoration under the
   words, and never captioned as our volunteers. Keep decoding="sync" and no
   -z-10 on the picture layer (see ContactHero).
--------------------------------------------------------------------------- */

const rise = (ms: number) => ({ animation: `hero-soft 1000ms var(--ease-reveal) ${ms}ms both` })

const wantsLessMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const SCREEN = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.22) 0.6px, transparent 0.9px)',
  backgroundSize: '3px 3px',
}

export default function VolunteerHero() {
  const toApply = () =>
    document.getElementById('apply')?.scrollIntoView({
      behavior: wantsLessMotion() ? 'auto' : 'smooth',
      block: 'start',
    })

  return (
    <section
      data-overlay-hero=""
      aria-labelledby="volunteer-title"
      className="relative isolate mt-[calc(var(--header-h)*-1)] overflow-hidden bg-grad-deep-x"
    >
      <div aria-hidden="true" className="absolute inset-0">
        <img
          src="/assets/images/hero-volunteer-2400.jpg"
          srcSet="/assets/images/hero-volunteer-1200.jpg 1200w, /assets/images/hero-volunteer-2400.jpg 2400w"
          sizes="100vw"
          alt=""
          width={2400}
          height={1600}
          decoding="sync"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover grayscale brightness-[0.95] contrast-[1.15]"
          style={{ objectPosition: '55% 45%', animation: 'hero-zoom 24s linear both' }}
        />
        <div className="absolute inset-0 bg-teal/[0.66]" />
        <div className="absolute inset-y-0 left-0 hidden w-[42%] border-r border-paper/15 bg-paper/[0.06] md:block" />
        <div className="absolute inset-0 opacity-70" style={SCREEN} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(8,38,42,0.5)_100%)]" />
      </div>

      <div className="relative gutter mx-auto flex min-h-[clamp(540px,82svh,840px)] max-w-page flex-col justify-end pt-[calc(var(--header-h)+40px)] pb-[clamp(36px,6vh,64px)]">
        <div className="flex flex-col gap-s4 md:flex-row md:items-end md:justify-between">
          <div>
            <p
              className="font-script text-[clamp(24px,2.2vw,32px)] leading-none text-gold-pale"
              style={rise(60)}
            >
              {HERO.eyebrow}
            </p>
            <h1
              id="volunteer-title"
              className="mt-s2 font-display text-[clamp(40px,5.6vw,84px)] leading-[0.98] tracking-[-0.04em] text-paper [text-shadow:0_2px_30px_rgba(8,38,42,0.35)]"
              style={rise(140)}
            >
              <span className="block">{HERO.titleLead}</span>
              <span className="block text-gold-pale">{HERO.titleMark}</span>
            </h1>
            <p
              className="mt-s3 max-w-[48ch] text-[clamp(15.5px,1.25vw,18px)] leading-[1.55] text-pretty text-paper/90"
              style={rise(320)}
            >
              {HERO.intro}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-1 md:items-end" style={rise(480)}>
            <button
              type="button"
              onClick={toApply}
              className="group inline-flex min-h-[44px] items-center gap-3 font-display text-[clamp(18px,1.5vw,22px)] tracking-[-0.015em] text-paper transition-colors duration-200 ease-brand hover:text-gold-pale"
            >
              {HERO.apply}
              <span
                aria-hidden="true"
                className="flex size-10 items-center justify-center rounded-full border border-paper/40 transition-[border-color,background-color,color] duration-300 ease-brand group-hover:border-gold-pale group-hover:bg-gold-pale group-hover:text-ink"
              >
                <ArrowRight className="h-3.5 w-3.5 rotate-90 transition-transform duration-300 ease-brand group-hover:translate-y-0.5" />
              </span>
            </button>
            <p className="text-[14.5px] text-paper/75">
              {HERO.call}{' '}
              <a
                href={PHONE.href}
                className="nums font-semibold text-paper underline decoration-paper/35 underline-offset-4 transition-colors duration-200 hover:text-gold-pale hover:decoration-gold-pale"
              >
                {PHONE.label}
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
