import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import Reveal, { Words, useHeroDepth } from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { MasjidMark } from '../components/Ornament'
import { ArrowRight, Box, Building, Check, Globe } from '../components/icons'
import { ROUTINE } from '../components/where-data'
import { FIELD_PARTNERS, OUR_PARTNERS, PARTNER_TYPES, PLACES } from '../components/partners-data'

/* ---------------------------------------------------------------------------
   /partners, all five sections. Words in components/partners-data.ts.

   1. PartnersHero ... the /appeals hero: a photo behind the header, the words
                       on the left, and the named field partner in the teal
                       panel on the right. Under the intro, the derived
                       figures on a hairline (no invented partner counts).
   2. PartnersField .. #field. The named partners as large cards, then every
                       place we deliver as a row: its work, and whether its
                       partner is named. An unnamed one says so in words.
   3. PartnersHow .... ROUTINE from where-data as three numbered cards.
   4. PartnersWays ... the four ways to partner, About's hover-fill cards,
                       each landing on /become-a-partner?type=<id>.
   5. PartnersClose .. a teal panel: Become a partner, and Donate in gold.
--------------------------------------------------------------------------- */

const H = OUR_PARTNERS.hero

const ICONS: Record<string, (p: { className?: string }) => ReactNode> = {
  masjid: MasjidMark,
  building: Building,
  box: Box,
  globe: Globe,
}

export function PartnersHero() {
  const depth = useHeroDepth()
  const featured = FIELD_PARTNERS[0]
  const rise = (delay: number, ms = 1000) => ({
    animation: `hero-soft ${ms}ms var(--ease-reveal) ${delay}ms both`,
  })

  return (
    <section
      data-overlay-hero=""
      ref={depth.hero}
      aria-labelledby="partners-title"
      className="relative isolate mt-[calc(var(--header-h)*-1)] overflow-hidden bg-ink"
    >
      <div
        ref={depth.photo}
        aria-hidden="true"
        className="absolute inset-x-0 -top-[4%] -bottom-[4%] will-change-[translate] hero-intro"
      >
        <img
          src="/assets/images/hero-yemen-2400.jpg"
          srcSet="/assets/images/hero-yemen-1200.jpg 1200w, /assets/images/hero-yemen-2400.jpg 2400w"
          sizes="100vw"
          alt=""
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(21,26,24,0.74)_0%,rgba(21,26,24,0.34)_26%,rgba(21,26,24,0.46)_60%,rgba(21,26,24,0.9)_100%)]" />
        <div className="absolute inset-0 hidden bg-[linear-gradient(95deg,rgba(21,26,24,0.86)_0%,rgba(21,26,24,0.44)_44%,transparent_72%)] md:block" />
      </div>

      <div className="relative flex min-h-[calc(74svh-var(--strip-h))] flex-col pt-[var(--header-h)]">
        <div className="gutter mx-auto flex w-full max-w-page flex-1 flex-col justify-center gap-10 py-[clamp(32px,6vh,72px)] lg:flex-row lg:items-center lg:justify-between lg:gap-s5">
          <div ref={depth.content} className="max-w-[600px] min-w-0 flex-1">
            <p
              className="font-script text-[clamp(21px,1.9vw,27px)] leading-none text-gold-pale [text-shadow:0_1px_16px_rgba(0,0,0,0.55)]"
              style={rise(60)}
            >
              {H.eyebrow}
            </p>
            <h1
              id="partners-title"
              className="mt-s2 font-display text-[clamp(34px,4.6vw,60px)] leading-[1.04] font-semibold tracking-[-0.022em] text-paper [text-wrap:balance] [text-shadow:0_2px_30px_rgba(0,0,0,0.5)]"
            >
              <Words text={H.title} play="load" delay={160} step={70} />
            </h1>
            <p
              className="mt-4 max-w-[48ch] text-[16px] leading-[1.6] text-paper/80 [text-shadow:0_1px_18px_rgba(0,0,0,0.6)]"
              style={rise(420)}
            >
              {H.intro}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-s3 gap-y-3" style={rise(560)}>
              <Link
                to="/become-a-partner"
                className="group inline-flex min-h-[50px] items-center gap-2 rounded-[10px] bg-paper px-6 text-[15.5px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-gold-pale"
              >
                {H.become}
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#field"
                className="group inline-flex min-h-[44px] items-center gap-2 border-b border-paper/35 text-[15px] font-semibold text-paper transition-colors duration-200 ease-brand hover:border-paper"
              >
                {H.see}
                <ArrowRight className="h-3 w-3 rotate-90 transition-transform duration-300 ease-brand group-hover:translate-y-0.5" />
              </a>
            </div>

            <dl
              className="mt-s4 grid max-w-[600px] grid-cols-2 gap-y-s3 border-t border-paper/20 pt-s3 sm:grid-cols-4"
              style={rise(680)}
            >
              {OUR_PARTNERS.stats.map((s, i) => (
                <div
                  key={s.label}
                  className={`flex flex-col-reverse ${i > 0 ? 'sm:border-l sm:border-paper/15 sm:pl-s3' : ''} ${i % 2 ? 'border-l border-paper/15 pl-s2 sm:pl-s3' : ''}`}
                >
                  <dt className="mt-1 text-[12.5px] leading-snug text-paper/65">{s.label}</dt>
                  <dd className="nums font-display text-[clamp(22px,2vw,28px)] leading-none font-bold tracking-[-0.02em] text-paper">
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {featured && (
            <div
              className="relative isolate flex w-full shrink-0 flex-col overflow-hidden rounded-2xl bg-teal p-s3 text-paper shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)] sm:p-s4 lg:w-[clamp(340px,32vw,440px)]"
              style={rise(300, 1200)}
            >
              <MasjidMark className="pointer-events-none absolute -right-[8%] -bottom-[12%] -z-10 size-[220px] text-paper/[0.07]" />
              <p className="font-script text-[clamp(24px,2vw,30px)] leading-none text-gold-pale">
                Our field partner in {featured.place}
              </p>
              <h2 className="mt-2 font-display text-[clamp(24px,2.2vw,32px)] leading-[1.1] font-semibold tracking-[-0.02em] text-balance">
                {featured.name}
              </h2>
              <p className="mt-s2 line-clamp-4 text-[15px] leading-[1.55] text-paper/85">{featured.body}</p>
              <a
                href="#field"
                className="group mt-s3 inline-flex items-center gap-1.5 self-start border-t border-paper/15 pt-s2 text-[14px] font-semibold text-paper/80 transition-colors duration-200 ease-brand hover:text-paper"
              >
                All field partners
                <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export function PartnersField() {
  const F = OUR_PARTNERS.field
  return (
    <section id="field" aria-labelledby="field-head" className={`scroll-mt-[calc(var(--header-h)+24px)] ${SECTION_Y}`}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead id="field-head" eyebrow={F.eyebrow} title={F.title} lede={F.lede} />

        {/* the named partners */}
        <ul className={`mt-s4 grid gap-s2 lg:mt-s5 ${BREAKOUT}`}>
          {FIELD_PARTNERS.map((p) => {
            const place = PLACES.find((pl) => pl.name === p.place)
            return (
              <li key={p.id}>
                <Reveal variant="clip">
                  <article className="grid overflow-hidden rounded-2xl border border-line bg-paper md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                    {/* No photograph: the one Ramadan 2022 frame we hold shows another
                        organisation's banner, so it cannot sit on this card. The
                        teal side carries only facts we hold. */}
                    <div className="relative isolate flex min-h-[240px] flex-col justify-between overflow-hidden bg-teal p-s3 text-paper sm:p-s4 lg:p-[clamp(32px,3.2vw,52px)]">
                      <MasjidMark className="pointer-events-none absolute -right-[10%] -bottom-[12%] -z-10 size-[clamp(220px,24vw,340px)] text-paper/[0.08]" />
                      <p className="font-script text-[clamp(24px,2vw,30px)] leading-none text-gold-pale">Working together since</p>
                      <div>
                        <p className="nums font-display text-[clamp(64px,7vw,104px)] leading-[0.85] font-bold tracking-[-0.05em]">2022</p>
                        <p className="mt-s2 text-[15px] text-paper/80">Ramadan food packages across {p.place}</p>
                      </div>
                    </div>
                    <div className="flex flex-col p-s3 sm:p-s4 lg:p-[clamp(32px,3.2vw,52px)]">
                      <p className="font-script text-[clamp(24px,2vw,30px)] leading-none text-green">
                        {F.featuredLabel} · {p.place}
                      </p>
                      <h3 className="mt-2 font-display text-[clamp(26px,2.6vw,36px)] leading-[1.1] font-semibold tracking-[-0.02em] text-balance">
                        {p.name}
                      </h3>
                      <p className="mt-s2 max-w-[60ch] text-[15.5px] leading-relaxed text-text-2">{p.body}</p>
                      {place && (
                        <ul className="mt-s3 flex flex-wrap gap-2">
                          {place.work.map((w) => (
                            <li key={w} className="rounded-full bg-teal/[0.08] px-3 py-1 text-[13px] font-semibold text-teal">
                              {w}
                            </li>
                          ))}
                        </ul>
                      )}
                      <Link
                        to={`/where-it-goes#${place?.id ?? 'partners'}`}
                        className="group mt-s4 inline-flex items-center gap-1.5 self-start text-[14.5px] font-semibold text-green transition-colors duration-200 ease-brand hover:text-ink lg:mt-auto lg:pt-s3"
                      >
                        {F.record}
                        <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                      </Link>
                    </div>
                  </article>
                </Reveal>
              </li>
            )
          })}
        </ul>

        {/* every place, and whether its partner is named */}
        <Reveal variant="soft">
          <h3 className={`mt-s5 font-display text-[clamp(22px,2vw,28px)] font-semibold tracking-[-0.02em] lg:mt-s6 ${BREAKOUT}`}>
            {F.placesTitle}
          </h3>
        </Reveal>
        <ul className={`mt-s3 grid gap-s2 sm:grid-cols-2 lg:grid-cols-5 ${BREAKOUT}`}>
          {PLACES.map((place, i) => {
            const partner = FIELD_PARTNERS.find((p) => p.place === place.name)
            return (
              <li key={place.id} className="h-full">
                <Reveal variant="clip" delay={i * 70} className="h-full">
                  <Link
                    to={`/where-it-goes#${place.id}`}
                    className="group flex h-full flex-col rounded-2xl border border-line p-s3 transition-[border-color,transform,box-shadow] duration-300 ease-brand hover:-translate-y-1 hover:border-teal hover:shadow-card"
                  >
                    <p className="font-display text-[21px] font-semibold tracking-[-0.016em]">{place.name}</p>
                    {place.since && <p className="mt-0.5 text-[13px] text-text-3">Since {place.since}</p>}
                    <p className="mt-s2 mb-s3 text-[14px] leading-snug text-text-2">{place.work.join(', ')}</p>
                    <p
                      className={`mt-auto flex items-start gap-1.5 border-t border-line pt-s2 text-[13px] font-semibold ${
                        partner ? 'text-teal' : 'text-text-3'
                      }`}
                    >
                      {partner && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                      {partner ? partner.name : F.unnamed}
                    </p>
                  </Link>
                </Reveal>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export function PartnersHow() {
  return (
    <section aria-labelledby="how-head" className={SECTION_Y}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead id="how-head" eyebrow={OUR_PARTNERS.how.eyebrow} title={OUR_PARTNERS.how.title} />
        <ol className={`mt-s4 grid gap-s2 md:grid-cols-3 lg:mt-s5 ${BREAKOUT}`}>
          {ROUTINE.map((r, i) => (
            <li key={r.title} className="h-full">
              <Reveal variant="clip" delay={i * 90} className="h-full">
                <article className="group flex h-full flex-col rounded-2xl border border-line p-s3 sm:p-s4">
                  <span
                    aria-hidden="true"
                    className="nums font-display text-[clamp(48px,4.4vw,68px)] leading-[0.8] font-semibold tracking-[-0.05em] text-transparent transition-colors duration-300 ease-brand [-webkit-text-stroke:1.5px_var(--color-teal)] group-hover:text-teal"
                  >
                    0{i + 1}
                  </span>
                  <h3 className="mt-s3 font-display text-[clamp(20px,1.8vw,24px)] leading-[1.18] font-semibold tracking-[-0.018em] text-balance">
                    {r.title}
                  </h3>
                  <p className="mt-s2 text-[15px] leading-relaxed text-text-2">{r.body}</p>
                </article>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function PartnersWays() {
  const W = OUR_PARTNERS.ways
  return (
    <section aria-labelledby="ways-head" className={SECTION_Y}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead id="ways-head" eyebrow={W.eyebrow} title={W.title} lede={W.lede} />
        <ul className={`mt-s4 grid gap-s2 sm:grid-cols-2 lg:mt-s5 lg:grid-cols-4 ${BREAKOUT}`}>
          {PARTNER_TYPES.map((t, i) => {
            const Icon = ICONS[t.icon]
            return (
              <li key={t.id} className="h-full">
                <Reveal variant="clip" delay={i * 80} className="h-full">
                  <article className="group relative isolate flex h-full flex-col overflow-hidden rounded-2xl border border-line p-s3 transition-[border-color,transform,box-shadow] duration-300 ease-brand hover:-translate-y-1 hover:border-teal hover:shadow-card sm:p-s4">
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 -z-10 origin-bottom scale-y-0 bg-teal transition-transform duration-500 ease-brand group-hover:scale-y-100"
                    />
                    <div className="flex items-start justify-between gap-s2">
                      <span
                        aria-hidden="true"
                        className="flex size-12 items-center justify-center rounded-full bg-teal/[0.08] text-teal transition-colors duration-300 group-hover:bg-paper/15 group-hover:text-gold-pale"
                      >
                        <Icon className="size-6" />
                      </span>
                      <span
                        aria-hidden="true"
                        className="flex size-9 items-center justify-center rounded-full border border-line text-teal transition-[border-color,background-color,color,transform] duration-300 ease-brand group-hover:-rotate-45 group-hover:border-gold group-hover:bg-gold group-hover:text-ink"
                      >
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                    <p className="mt-s3 font-script text-[clamp(22px,1.8vw,26px)] leading-none text-green transition-colors duration-300 group-hover:text-gold-pale">
                      {t.kind}
                    </p>
                    <h3 className="mt-2 font-display text-[clamp(20px,1.7vw,23px)] leading-[1.18] font-semibold tracking-[-0.018em] text-balance transition-colors duration-300 group-hover:text-paper">
                      <Link to={`/become-a-partner?type=${t.id}`} className="after:absolute after:inset-0">
                        {t.title}
                      </Link>
                    </h3>
                    <p className="mt-s2 text-[14.5px] leading-relaxed text-text-2 transition-colors duration-300 group-hover:text-paper/80">
                      {t.body}
                    </p>
                  </article>
                </Reveal>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export function PartnersClose() {
  const C = OUR_PARTNERS.close
  return (
    <section aria-labelledby="partners-close-head" className="pb-[clamp(56px,6.5vw,96px)]">
      <div className="gutter mx-auto max-w-page">
        <Reveal variant="clip" className={`block ${BREAKOUT}`}>
          <div className="relative isolate flex flex-col gap-s4 overflow-hidden rounded-2xl bg-teal p-s3 text-paper sm:p-s4 md:flex-row md:items-center md:justify-between lg:p-[clamp(40px,4vw,64px)]">
            <MasjidMark className="pointer-events-none absolute -right-[4%] -bottom-[18%] -z-10 size-[clamp(200px,22vw,320px)] text-paper/[0.07]" />
            <div>
              <p className="font-script text-[clamp(24px,2.2vw,32px)] leading-none text-gold-pale">{C.eyebrow}</p>
              <h2
                id="partners-close-head"
                className="mt-2 font-display text-[clamp(28px,3.2vw,44px)] leading-[1.08] font-semibold tracking-[-0.025em] text-balance"
              >
                {C.title}
              </h2>
              <p className="mt-s2 max-w-[52ch] text-[15.5px] leading-[1.55] text-paper/85">{C.body}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <Link
                to="/become-a-partner"
                className="group inline-flex min-h-[52px] items-center gap-2 rounded-[10px] bg-paper px-6 text-[15.5px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-green-pale"
              >
                {C.primary}
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/give"
                className="inline-flex min-h-[52px] items-center gap-2 rounded-[10px] bg-gold px-6 text-[15.5px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-gold-dark hover:text-paper"
              >
                {C.secondary}
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
