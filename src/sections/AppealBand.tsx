import { HeroBrand } from '../components/Brand'
import { Link } from 'react-router-dom'

import type { GiveAmount } from '../components/GiveModule'
import { Words, useHeroDepth } from '../components/Reveal'
import { CRISIS, PLACES, type Appeal } from '../components/appeals-data'
import { appealView } from '../components/appeal-view'
import { ArrowRight, Check } from '../components/icons'
import AppealGiveBox from './AppealGiveBox'

/* ---------------------------------------------------------------------------
   A single appeal, section 1: the hero.

   Rebuilt on the home page's pattern on 16 September 2026, at the client's
   request, as the second pass after /appeals: the photograph behind the
   header with the same entrance and scroll depth as the home and /appeals
   heroes, the appeal's words on the left, and the give card on the right in
   the home banner's teal. It used to be a half-screen band with a white give
   box pulled up over its foot and stuck beside the story; the story is full
   width now, and the way to give follows the reader as a small bar instead
   (AppealGiveBox).

   The photograph is the appeal's band (appeal-view.ts): stock and uncaptioned,
   except the masjid, which is ours. See appeal-detail-data.ts.

   No progress bar (client's choice for every appeal view): the raised and goal
   figures are placeholders and are not shown on this page.
--------------------------------------------------------------------------- */

export default function AppealBand({ appeal, ladder }: { appeal: Appeal; ladder: GiveAmount[] }) {
  const depth = useHeroDepth()
  const a = appealView(appeal)
  const live = appeal.slug === CRISIS?.slug
  const place = `${a.where ? `${a.where}, ` : ''}${PLACES[a.country]}`

  const rise = (delay: number, ms = 1000) => ({
    animation: `hero-soft ${ms}ms var(--ease-reveal) ${delay}ms both`,
  })

  return (
    <section
      data-overlay-hero=""
      ref={depth.hero}
      aria-labelledby="appeal-title"
      className="relative isolate mt-[calc(var(--header-h)*-1)] overflow-hidden bg-ink"
    >
      {/* ---------- the photograph, and the dark it is read through ---------- */}
      <div
        ref={depth.photo}
        aria-hidden="true"
        className="absolute inset-x-0 -top-[4%] -bottom-[4%] will-change-[translate] hero-intro"
      >
        <img
          src={a.src}
          srcSet={a.srcSet}
          sizes="100vw"
          alt=""
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: a.position }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,38,42,0.74)_0%,rgba(8,38,42,0.34)_26%,rgba(8,38,42,0.46)_60%,rgba(8,38,42,0.9)_100%)]" />
        <div className="absolute inset-0 hidden bg-[linear-gradient(95deg,rgba(8,38,42,0.84)_0%,rgba(8,38,42,0.42)_44%,transparent_72%)] md:block" />
        <HeroBrand />
      </div>

      <div className="relative flex min-h-[calc(80svh-var(--strip-h))] flex-col pt-[var(--header-h)]">
        <div className="gutter mx-auto flex w-full max-w-page flex-1 flex-col justify-center gap-10 py-[clamp(32px,6vh,72px)] lg:flex-row lg:items-center lg:justify-between lg:gap-s5">
          {/* --- the appeal --- */}
          <div ref={depth.content} className="max-w-[600px] min-w-0 flex-1">
            <Link
              to="/appeals"
              className="group inline-flex items-center gap-2 text-[13.5px] font-medium text-paper/70 transition-colors duration-200 ease-brand hover:text-paper"
              style={rise(0, 800)}
            >
              <ArrowRight className="h-3 w-3 rotate-180 transition-transform duration-300 ease-brand group-hover:-translate-x-0.5" />
              All appeals
            </Link>

            <p
              className="mt-s4 font-script text-[clamp(22px,2vw,28px)] leading-none text-gold-pale [text-shadow:0_1px_16px_rgba(0,0,0,0.55)]"
              style={rise(60)}
            >
              {live ? `Live now in ${PLACES[a.country]}` : a.cause}
            </p>
            <h1
              id="appeal-title"
              className="mt-s2 font-display text-[clamp(34px,4.6vw,60px)] leading-[1.04] tracking-[-0.022em] text-paper [text-wrap:balance] [text-shadow:0_2px_30px_rgba(0,0,0,0.5)]"
            >
              <Words text={appeal.title} play="load" delay={160} step={70} />
            </h1>
            <p
              className="mt-4 max-w-[48ch] text-[clamp(15.5px,1.3vw,17px)] leading-[1.6] text-paper/80 [text-shadow:0_1px_18px_rgba(0,0,0,0.6)]"
              style={rise(420)}
            >
              {appeal.blurb}
            </p>

            <p
              className="mt-s3 flex flex-wrap items-center gap-x-s3 gap-y-2 text-[14px] text-paper/75"
              style={rise(560)}
            >
              <span>{place}</span>
              {appeal.zakat && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="grid h-4 w-4 place-items-center rounded-full bg-gold-pale text-ink"
                  >
                    <Check className="h-2 w-2" />
                  </span>
                  Zakat eligible
                </span>
              )}
            </p>
          </div>

          {/* --- the give card, and the bar that follows the reader --- */}
          <AppealGiveBox key={appeal.slug} appeal={appeal} ladder={ladder} />
        </div>
      </div>
    </section>
  )
}
