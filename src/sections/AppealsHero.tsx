import { Link } from 'react-router-dom'

import { Words, useHeroDepth } from '../components/Reveal'
import { CRISIS, PLACES, appealBySlug, giveHref } from '../components/appeals-data'
import { appealView, money } from '../components/appeal-view'
import { CAUSES } from '../components/give-data'
import { ArrowRight } from '../components/icons'

/* ---------------------------------------------------------------------------
   /appeals, section 1 of 3: the hero.

   Rebuilt on the home page's pattern on 16 September 2026, at the client's
   request, replacing the compact PageBand and the white featured card under
   it. The page opens on a photograph the way the home page does, with the
   page's own words on the left and the live appeal on the right in the home
   banner's teal panel, so the one thing that is urgent is also the first
   thing you can give to.

   ABOUT 70% OF THE SCREEN, not a full one (client's choice): people come to
   this page to pick, so the top of the list should show under the fold.

   THE PHOTOGRAPH is the live appeal's band, which is stock and so is never
   captioned. The panel names the appeal's place, not the picture's.

   NO LIVE APPEAL: when CRISIS is null (appeals-data.ts) the panel offers
   sadaqah, where it is needed most, over the Gaza frame. The red strip along
   the top of the site is already the live marker, so the panel carries no dot.

   No progress bar here or anywhere on the page (client's choice): one figure
   per appeal, the smallest gift that helps.
--------------------------------------------------------------------------- */

const SADAQAH = CAUSES.find((c) => c.id === 'sadaqah')

export default function AppealsHero() {
  const depth = useHeroDepth()
  const crisis = appealBySlug(CRISIS?.slug)
  const live = crisis ? appealView(crisis) : null
  const photo = live ?? appealView(appealBySlug('gaza-emergency')!)

  const panel = live
    ? {
        script: `Live now in ${PLACES[live.country]}`,
        title: live.title,
        body: live.blurb,
        fromLine: live.fromLine,
        from: live.from,
        give: { label: 'Donate now', to: giveHref(live) },
        more: { label: 'Read the appeal', to: `/appeals/${live.slug}` },
      }
    : {
        script: 'Not sure yet?',
        title: 'Where it’s needed most',
        body: 'Sadaqah goes to whichever appeal is shortest of what it needs that week.',
        fromLine: 'Give from',
        from: SADAQAH?.amounts[0]?.value ?? 25,
        give: { label: 'Give sadaqah', to: '/give?designation=sadaqah' },
        more: null,
      }

  const rise = (delay: number, ms = 1000) => ({
    animation: `hero-soft ${ms}ms var(--ease-reveal) ${delay}ms both`,
  })

  return (
    <section
      data-overlay-hero=""
      ref={depth.hero}
      aria-labelledby="page-title"
      className="relative isolate mt-[calc(var(--header-h)*-1)] overflow-hidden bg-ink"
    >
      {/* ---------- the photograph, and the dark it is read through ---------- */}
      <div
        ref={depth.photo}
        aria-hidden="true"
        className="absolute inset-x-0 -top-[4%] -bottom-[4%] will-change-[translate] hero-intro"
      >
        <img
          src={photo.src}
          srcSet={photo.srcSet}
          sizes="100vw"
          alt=""
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: photo.position }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(21,26,24,0.74)_0%,rgba(21,26,24,0.34)_26%,rgba(21,26,24,0.46)_60%,rgba(21,26,24,0.9)_100%)]" />
        <div className="absolute inset-0 hidden bg-[linear-gradient(95deg,rgba(21,26,24,0.82)_0%,rgba(21,26,24,0.40)_42%,transparent_70%)] md:block" />
      </div>

      <div className="relative flex min-h-[calc(70svh-var(--strip-h))] flex-col pt-[var(--header-h)]">
        <div className="gutter mx-auto flex w-full max-w-page flex-1 flex-col justify-center gap-10 py-[clamp(32px,6vh,72px)] lg:flex-row lg:items-center lg:justify-between lg:gap-s5">
          {/* --- the page's own words --- set as the home hero sets its appeal */}
          <div ref={depth.content} className="max-w-[560px] min-w-0 flex-1">
            <p
              className="font-script text-[clamp(21px,1.9vw,27px)] leading-none text-gold-pale [text-shadow:0_1px_16px_rgba(0,0,0,0.55)]"
              style={rise(60)}
            >
              Open appeals
            </p>
            <h1
              id="page-title"
              className="mt-s2 font-display text-[clamp(34px,4.6vw,60px)] leading-[1.04] font-semibold tracking-[-0.022em] text-paper [text-wrap:balance] [text-shadow:0_2px_30px_rgba(0,0,0,0.5)]"
            >
              <Words text="Where your gift is needed now." play="load" delay={160} step={70} />
            </h1>
            <p
              className="mt-4 max-w-[46ch] text-[16px] leading-[1.6] text-paper/80 [text-shadow:0_1px_18px_rgba(0,0,0,0.6)]"
              style={rise(420)}
            >
              Every appeal we have open, what it pays for, and the smallest gift that helps.
            </p>
            <div className="mt-6" style={rise(560)}>
              <a
                href="#all"
                className="group inline-flex min-h-[44px] items-center gap-2 border-b border-paper/35 text-[15px] font-semibold text-paper transition-colors duration-200 ease-brand hover:border-paper hover:text-paper"
              >
                See every appeal
                <ArrowRight className="h-3 w-3 rotate-90 transition-transform duration-300 ease-brand group-hover:translate-y-0.5" />
              </a>
            </div>
          </div>

          {/* --- the live appeal --- the home banner's teal panel, standing alone.
              Solid, so it can fade as it rises; there is no blur under it. */}
          <div
            className="flex w-full shrink-0 flex-col rounded-2xl bg-teal p-s3 text-paper shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)] sm:p-s4 lg:w-[clamp(340px,32vw,440px)]"
            style={rise(300, 1200)}
          >
            <p className="font-script text-[clamp(24px,2vw,30px)] leading-none text-gold-pale">
              {panel.script}
            </p>
            <h2 className="mt-2 font-display text-[clamp(24px,2.2vw,32px)] leading-[1.1] font-semibold tracking-[-0.02em] text-balance">
              {panel.title}
            </h2>
            <p className="mt-s2 line-clamp-3 text-[15px] leading-[1.55] text-paper/85">
              {panel.body}
            </p>

            <div className="mt-s3 flex flex-wrap items-end justify-between gap-x-s3 gap-y-s2">
              <div>
                <p className="text-[13px] font-semibold">{panel.fromLine}</p>
                <p className="nums mt-1 font-display text-[clamp(40px,3.6vw,56px)] leading-none font-bold tracking-[-0.03em]">
                  {money(panel.from)}
                </p>
              </div>
              <Link
                to={panel.give.to}
                className="group inline-flex min-h-[50px] items-center gap-2 rounded-[10px] bg-gold px-5 text-[15px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-gold-dark hover:text-paper sm:px-6 sm:text-[16px]"
              >
                {panel.give.label}
                <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" />
              </Link>
            </div>

            {panel.more && (
              <Link
                to={panel.more.to}
                className="group mt-s3 inline-flex items-center gap-1.5 border-t border-paper/15 pt-s2 text-[14px] font-semibold text-paper/80 transition-colors duration-200 ease-brand hover:text-paper"
              >
                {panel.more.label}
                <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
