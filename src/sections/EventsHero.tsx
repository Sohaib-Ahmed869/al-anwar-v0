import { HeroBrand } from '../components/Brand'
import { Link } from 'react-router-dom'

import { DatePlate } from '../components/EventCard'
import { ArrowRight } from '../components/icons'
import { EVENTS_HERO as HERO, askAbout, placeOf, upcomingEvents } from '../components/event-data'

/* ---------------------------------------------------------------------------
   /events, section 1 of 3: the hero.

   REDESIGNED 17 September 2026 at the user's request. It was the Get involved
   duotone (one photograph, greyscale under teal, full bleed), and the iftar
   frame blown up that wide read as a blur of hands. Now:

     left    the words on flat logo teal, with the masjid watermark, and two
             ways on: down to the diary, or to the host panel
     right   two photographs in full colour, overlapped (the Eid table large,
             the iftar small), and a paper "Next up" ticket with the soonest
             event's date, name and place, which links like its card does

   The ticket is its own card beside the pictures, never a caption on them:
   both frames are licensed stock (see event-data.ts), not Al-Anwaar events,
   so their alts are empty. With nothing in the diary the ticket is not drawn.

   /events is in Header's OVERLAY_ROUTES; the teal runs up under the bar.
--------------------------------------------------------------------------- */

const rise = (ms: number) => ({ animation: `hero-soft 1000ms var(--ease-reveal) ${ms}ms both` })

const scrollTo = (id: string) =>
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  })

const photo = (stem: string) => ({
  src: `/assets/images/${stem}-1600.jpg`,
  srcSet: `/assets/images/${stem}-800.jpg 800w, /assets/images/${stem}-1600.jpg 1600w`,
})

export default function EventsHero() {
  const next = upcomingEvents()[0]

  return (
    <section
      data-overlay-hero=""
      aria-labelledby="events-title"
      className="relative isolate mt-[calc(var(--header-h)*-1)] overflow-hidden bg-grad-deep-x text-paper"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(90%_80%_at_85%_20%,rgba(255,255,255,0.08)_0%,transparent_60%)]"
      />
      <HeroBrand z="-z-10" />

      <div className="gutter mx-auto grid max-w-page items-center gap-x-s5 gap-y-s5 pt-[calc(var(--header-h)+clamp(40px,6vw,72px))] pb-[clamp(56px,7vw,96px)] lg:min-h-[clamp(620px,88svh,860px)] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* ---------- the words ---------- */}
        <div>
          <p className="font-script text-[clamp(24px,2.2vw,32px)] leading-none text-gold-pale" style={rise(60)}>
            {HERO.eyebrow}
          </p>
          <h1
            id="events-title"
            className="mt-s2 font-display text-[clamp(42px,5.4vw,80px)] leading-[0.98] tracking-[-0.04em]"
            style={rise(140)}
          >
            <span className="block">{HERO.titleLead}</span>
            <span className="block text-gold-pale">{HERO.titleMark}</span>
          </h1>
          <p
            className="mt-s3 max-w-[42ch] text-[clamp(15.5px,1.25vw,18px)] leading-[1.6] text-pretty text-paper/85"
            style={rise(320)}
          >
            {HERO.intro}
          </p>
          <div className="mt-s4 flex flex-wrap items-center gap-x-s3 gap-y-s2" style={rise(460)}>
            <button
              type="button"
              onClick={() => scrollTo('diary')}
              className="group inline-flex min-h-[52px] items-center gap-2.5 rounded-[12px] bg-paper px-6 text-[15.5px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-green-pale"
            >
              {HERO.more}
              <ArrowRight className="h-3 w-3 rotate-90 transition-transform duration-300 ease-brand group-hover:translate-y-0.5" />
            </button>
            <button
              type="button"
              onClick={() => scrollTo('host')}
              className="inline-flex min-h-[44px] items-center border-b border-paper/35 text-[15px] font-semibold text-paper transition-colors duration-200 ease-brand hover:border-gold-pale hover:text-gold-pale"
            >
              {HERO.host}
            </button>
          </div>
        </div>

        {/* ---------- the pictures and the ticket ---------- */}
        <div className="relative pb-[72px] sm:pb-s4 lg:pb-0" style={rise(260)}>
          <div className="relative ml-auto aspect-[16/11] w-full overflow-hidden rounded-2xl bg-ink/20 shadow-[0_30px_70px_-35px_rgba(0,0,0,0.6)] sm:w-[86%]">
            <img
              {...photo('event-eid')}
              sizes="(min-width: 1024px) 46vw, 90vw"
              alt=""
              decoding="sync"
              fetchPriority="high"
              className="h-full w-full object-cover"
              style={{ objectPosition: '50% 40%' }}
            />
          </div>

          <div className="absolute bottom-0 left-0 hidden aspect-[4/5] w-[34%] overflow-hidden rounded-2xl border-[6px] border-teal shadow-[0_24px_50px_-25px_rgba(0,0,0,0.6)] sm:block lg:-bottom-s4">
            <img
              {...photo('event-iftar')}
              sizes="20vw"
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
              style={{ objectPosition: '62% 50%' }}
            />
          </div>

          {next && (
            <Link
              to={askAbout(next)}
              className="group absolute right-s2 bottom-0 left-s2 flex items-center gap-s2 rounded-2xl bg-paper p-s2 text-ink shadow-[0_24px_50px_-20px_rgba(0,0,0,0.55)] transition-transform duration-300 ease-brand hover:-translate-y-1 sm:right-auto sm:left-[38%] sm:w-[min(380px,58%)] lg:-bottom-s3"
            >
              <DatePlate event={next} className="shadow-none ring-1 ring-line" />
              <span className="min-w-0 flex-1">
                <span className="block font-script text-[18px] leading-none text-green">{HERO.nextUp}</span>
                <span className="mt-1 block truncate font-display text-[18px] leading-tight tracking-[-0.015em]">
                  {next.name}
                </span>
                <span className="mt-0.5 block truncate text-[13.5px] text-text-2">
                  {placeOf(next)}
                </span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-teal transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
