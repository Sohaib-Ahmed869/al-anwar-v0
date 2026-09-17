import { Link } from 'react-router-dom'

import { Words, useHeroDepth } from '../components/Reveal'
import { ArrowRight } from '../components/icons'
import { ACCOUNTS, LATEST, PLACES, TOTAL_OVERSEAS, money, share } from '../components/where-data'

/* ---------------------------------------------------------------------------
   Where it goes, section 1 of 5: the hero.

   Rebuilt 17 September 2026 at the user's request on the /appeals hero: a
   photograph behind the header at about 70% of the screen, the page's words
   on the left, and the filed headline figures in the home banner's teal panel
   on the right. It replaced the compact ink PageBand.

   THE PHOTO is food-aid-2400 (Esmat Sediqi, Pexels License), stock, and not
   one of our distributions, so nothing on the page captions it.

   EVERY FIGURE IN THE PANEL IS FILED: the total sent overseas since
   registration, the share sent in the latest year, and wages, all read from
   ACCOUNTS in where-data.ts so they cannot disagree with the chart below.
--------------------------------------------------------------------------- */

export default function WhereHero() {
  const depth = useHeroDepth()
  const noWages = ACCOUNTS.every((y) => y.wages === 0)
  const rise = (delay: number, ms = 1000) => ({
    animation: `hero-soft ${ms}ms var(--ease-reveal) ${delay}ms both`,
  })

  return (
    <section
      data-overlay-hero=""
      ref={depth.hero}
      aria-labelledby="where-title"
      className="relative isolate mt-[calc(var(--header-h)*-1)] overflow-hidden bg-ink"
    >
      <div
        ref={depth.photo}
        aria-hidden="true"
        className="absolute inset-x-0 -top-[4%] -bottom-[4%] will-change-[translate] hero-intro"
      >
        <img
          src="/assets/images/food-aid-2400.jpg"
          srcSet="/assets/images/food-aid-1200.jpg 1200w, /assets/images/food-aid-2400.jpg 2400w"
          sizes="100vw"
          alt=""
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: '45% 50%' }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(21,26,24,0.74)_0%,rgba(21,26,24,0.34)_26%,rgba(21,26,24,0.46)_60%,rgba(21,26,24,0.9)_100%)]" />
        <div className="absolute inset-0 hidden bg-[linear-gradient(95deg,rgba(21,26,24,0.86)_0%,rgba(21,26,24,0.44)_44%,transparent_72%)] md:block" />
      </div>

      <div className="relative flex min-h-[calc(72svh-var(--strip-h))] flex-col pt-[var(--header-h)]">
        <div className="gutter mx-auto flex w-full max-w-page flex-1 flex-col justify-center gap-10 py-[clamp(32px,6vh,72px)] lg:flex-row lg:items-center lg:justify-between lg:gap-s5">
          <div ref={depth.content} className="max-w-[580px] min-w-0 flex-1">
            <p
              className="font-script text-[clamp(21px,1.9vw,27px)] leading-none text-gold-pale [text-shadow:0_1px_16px_rgba(0,0,0,0.55)]"
              style={rise(60)}
            >
              Where it goes
            </p>
            <h1
              id="where-title"
              className="mt-s2 font-display text-[clamp(34px,4.6vw,60px)] leading-[1.04] font-semibold tracking-[-0.022em] text-paper [text-wrap:balance] [text-shadow:0_2px_30px_rgba(0,0,0,0.5)]"
            >
              <Words text="Every dollar, accounted for." play="load" delay={160} step={70} />
            </h1>
            <p
              className="mt-4 max-w-[46ch] text-[16px] leading-[1.6] text-paper/80 [text-shadow:0_1px_18px_rgba(0,0,0,0.6)]"
              style={rise(420)}
            >
              What we have filed with the regulator each year, the {PLACES.length} places we work,
              and every distribution we can date.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-s3 gap-y-3" style={rise(560)}>
              <a
                href="#accounts"
                className="group inline-flex min-h-[44px] items-center gap-2 border-b border-paper/35 text-[15px] font-semibold text-paper transition-colors duration-200 ease-brand hover:border-paper"
              >
                See the accounts
                <ArrowRight className="h-3 w-3 rotate-90 transition-transform duration-300 ease-brand group-hover:translate-y-0.5" />
              </a>
              <a
                href="#places"
                className="group inline-flex min-h-[44px] items-center gap-2 border-b border-paper/35 text-[15px] font-semibold text-paper transition-colors duration-200 ease-brand hover:border-paper"
              >
                See the places
                <ArrowRight className="h-3 w-3 rotate-90 transition-transform duration-300 ease-brand group-hover:translate-y-0.5" />
              </a>
            </div>
          </div>

          {/* --- the filed figures --- */}
          <div
            className="w-full shrink-0 rounded-2xl bg-teal p-s3 text-paper shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)] sm:p-s4 lg:w-[clamp(340px,32vw,440px)]"
            style={rise(300, 1200)}
          >
            <p className="font-script text-[clamp(24px,2vw,30px)] leading-none text-gold-pale">As filed with the ACNC</p>
            <p className="mt-s3 text-[13px] font-semibold text-paper/75">Sent overseas since we registered</p>
            <p className="nums mt-1 font-display text-[clamp(40px,3.8vw,58px)] leading-none font-bold tracking-[-0.03em]">
              {money(TOTAL_OVERSEAS)}
            </p>
            <dl className="mt-s3 grid grid-cols-2 border-t border-paper/15 pt-s3">
              <div className="flex flex-col-reverse">
                <dt className="mt-1 text-[12.5px] leading-snug text-paper/70">
                  Of spending sent overseas in <span className="nums">{LATEST.fy}</span>
                </dt>
                <dd className="nums font-display text-[clamp(24px,2.2vw,32px)] leading-none font-bold">{share(LATEST)}%</dd>
              </div>
              {noWages && (
                <div className="flex flex-col-reverse border-l border-paper/15 pl-s3">
                  <dt className="mt-1 text-[12.5px] leading-snug text-paper/70">Paid in wages, every year</dt>
                  <dd className="nums font-display text-[clamp(24px,2.2vw,32px)] leading-none font-bold">$0</dd>
                </div>
              )}
            </dl>
            <Link
              to="/give"
              className="group mt-s4 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[10px] bg-gold px-6 text-[15.5px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-gold-dark hover:text-paper"
            >
              Give with confidence
              <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
