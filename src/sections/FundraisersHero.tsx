import { HeroBrand } from '../components/Brand'
import { Link } from 'react-router-dom'

import { fundraiserGiveHref, fundraiserPhoto } from '../components/FundraiserCard'
import { Words, useHeroDepth } from '../components/Reveal'
import { LISTING } from '../components/fundraiser-data'
import { PLACES, appealBySlug } from '../components/appeals-data'
import { money } from '../components/appeal-view'
import { ArrowRight } from '../components/icons'
import { useFundraisers, daysLeft, percentOf } from '../services/fundraisers'

/* ---------------------------------------------------------------------------
   /fundraisers, section 1 of 3: the hero.

   Rebuilt 17 September 2026 on the /appeals hero, at the user's request:
   a photograph behind the header at about 70% of the screen with the same
   entrance and scroll depth, the page's words on the left, and one
   fundraiser on the right in the home banner's teal panel, so the first
   thing on the page is something you can give to. It replaced a teal
   duotone hero with a floating totals card.

   THE FEATURED FUNDRAISER is the listed one closest to its goal without
   having reached it (the push that finishes one is the easiest ask), and the
   photo behind the page is its photo. The community totals sit under the
   intro as three plain figures on a hairline, not a card.

   The figures are the live fundraisers' own, from the platform.
--------------------------------------------------------------------------- */

const H = LISTING.hero

export default function FundraisersHero() {
  const depth = useHeroDepth()
  const { list: listed } = useFundraisers()
  const featured =
    [...listed].filter((f) => f.raised < f.goal).sort((a, b) => percentOf(b) - percentOf(a))[0] ??
    listed[0]
  const appeal = featured ? appealBySlug(featured.appeal) : undefined
  const photo = featured
    ? fundraiserPhoto(featured)
    : { src: '/assets/images/hero-meal-2400.jpg', srcSet: undefined, position: '50% 40%' }

  const stats = [
    { value: money(listed.reduce((s, f) => s + f.raised, 0)), label: LISTING.stats.raised },
    { value: String(listed.length), label: LISTING.stats.count },
    { value: String(listed.reduce((s, f) => s + f.supporters, 0)), label: LISTING.stats.supporters },
  ]

  const rise = (delay: number, ms = 1000) => ({
    animation: `hero-soft ${ms}ms var(--ease-reveal) ${delay}ms both`,
  })

  return (
    <section
      data-overlay-hero=""
      ref={depth.hero}
      aria-labelledby="fundraisers-title"
      className="relative isolate mt-[calc(var(--header-h)*-1)] overflow-hidden bg-ink"
    >
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
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,38,42,0.74)_0%,rgba(8,38,42,0.34)_26%,rgba(8,38,42,0.46)_60%,rgba(8,38,42,0.9)_100%)]" />
        <div className="absolute inset-0 hidden bg-[linear-gradient(95deg,rgba(8,38,42,0.84)_0%,rgba(8,38,42,0.42)_44%,transparent_72%)] md:block" />
        <HeroBrand />
      </div>

      <div className="relative flex min-h-[calc(72svh-var(--strip-h))] flex-col pt-[var(--header-h)]">
        <div className="gutter mx-auto flex w-full max-w-page flex-1 flex-col justify-center gap-10 py-[clamp(32px,6vh,72px)] lg:flex-row lg:items-center lg:justify-between lg:gap-s5">
          {/* --- the page's own words --- */}
          <div ref={depth.content} className="max-w-[580px] min-w-0 flex-1">
            <p
              className="font-script text-[clamp(21px,1.9vw,27px)] leading-none text-gold-pale [text-shadow:0_1px_16px_rgba(0,0,0,0.55)]"
              style={rise(60)}
            >
              {H.eyebrow}
            </p>
            <h1
              id="fundraisers-title"
              className="mt-s2 font-display text-[clamp(34px,4.6vw,60px)] leading-[1.04] tracking-[-0.022em] text-paper [text-wrap:balance] [text-shadow:0_2px_30px_rgba(0,0,0,0.5)]"
            >
              <Words text={`${H.titleLead} ${H.titleMark}`} play="load" delay={160} step={70} />
            </h1>
            <p
              className="mt-4 max-w-[46ch] text-[16px] leading-[1.6] text-paper/80 [text-shadow:0_1px_18px_rgba(0,0,0,0.6)]"
              style={rise(420)}
            >
              {H.intro}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-x-s3 gap-y-3" style={rise(560)}>
              <Link
                to="/fundraisers/start"
                className="group inline-flex min-h-[50px] items-center gap-2 rounded-[10px] bg-paper px-6 text-[15.5px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-gold-pale"
              >
                {H.start}
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#browse"
                className="group inline-flex min-h-[44px] items-center gap-2 border-b border-paper/35 text-[15px] font-semibold text-paper transition-colors duration-200 ease-brand hover:border-paper"
              >
                {H.browse}
                <ArrowRight className="h-3 w-3 rotate-90 transition-transform duration-300 ease-brand group-hover:translate-y-0.5" />
              </a>
            </div>

            {listed.length > 0 && (
              <dl
                className="mt-s4 grid max-w-[520px] grid-cols-3 border-t border-paper/20 pt-s3"
                style={rise(680)}
              >
                {stats.map((s, i) => (
                  <div
                    key={s.label}
                    className={`flex flex-col-reverse ${i > 0 ? 'border-l border-paper/15 pl-s2 sm:pl-s3' : ''}`}
                  >
                    <dt className="mt-1 text-[12.5px] leading-snug text-paper/65">{s.label}</dt>
                    <dd className="nums font-display text-[clamp(20px,2vw,28px)] leading-none tracking-[-0.02em] text-paper">
                      {s.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {/* --- one fundraiser to give to now --- */}
          {featured && appeal && (
            <div
              className="flex w-full shrink-0 flex-col rounded-2xl bg-teal p-s3 text-paper shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)] sm:p-s4 lg:w-[clamp(340px,32vw,440px)]"
              style={rise(300, 1200)}
            >
              <p className="font-script text-[clamp(24px,2vw,30px)] leading-none text-gold-pale">
                Help finish this one
              </p>
              <h2 className="mt-2 font-display text-[clamp(24px,2.2vw,32px)] leading-[1.1] tracking-[-0.02em] text-balance">
                {featured.title}
              </h2>
              <p className="mt-s2 text-[14.5px] leading-[1.5] text-paper/80">
                by {featured.organiser} for{' '}
                <span className="font-semibold text-paper">{appeal.title}</span>, {PLACES[appeal.country]}
              </p>

              <div className="mt-s3">
                <div className="flex items-end justify-between gap-s2">
                  <p className="nums font-display text-[clamp(36px,3.2vw,50px)] leading-none tracking-[-0.03em]">
                    {money(featured.raised)}
                  </p>
                  <p className="nums pb-1 text-[13px] text-paper/75">of {money(featured.goal)}</p>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percentOf(featured)}
                  aria-label={`${percentOf(featured)}% of the goal raised`}
                  className="mt-s2 h-1.5 overflow-hidden rounded-full bg-paper/15"
                >
                  <div className="h-full rounded-full bg-gold-pale" style={{ width: `${percentOf(featured)}%` }} />
                </div>
                <p className="nums mt-2 flex justify-between text-[13px] text-paper/75">
                  <span>{featured.supporters} supporters</span>
                  <span>{daysLeft(featured.ends)} days left</span>
                </p>
              </div>

              <div className="mt-s3 flex flex-wrap items-center justify-between gap-s2 border-t border-paper/15 pt-s3">
                <Link
                  to={`/fundraisers/${featured.slug}`}
                  className="group inline-flex items-center gap-1.5 text-[14px] font-semibold text-paper/80 transition-colors duration-200 ease-brand hover:text-paper"
                >
                  Read their story
                  <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                </Link>
                <Link
                  to={fundraiserGiveHref(featured)}
                  className="group inline-flex min-h-[50px] items-center gap-2 rounded-[10px] bg-gold px-5 text-[15px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-gold-dark hover:text-ink sm:px-6 sm:text-[16px]"
                >
                  Donate now
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
