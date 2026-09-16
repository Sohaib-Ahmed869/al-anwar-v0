import { Link } from 'react-router-dom'

import { Words, useHeroDepth } from '../components/Reveal'
import { ArrowRight, HandHeart } from '../components/icons'
import { VERSE } from '../components/zakat-data'

/* ---------------------------------------------------------------------------
   Zakat, section 1 of 5: the hero.

   REBUILT 16 SEPTEMBER 2026, at the user's request, to sit with HomeHero and
   GiveHero: one full screen, the words on the left, a script eyebrow in the
   pale gold, the title at SectionHead's size and weight, one line of body, the
   gold button and a plain link, and a checkable line under them.

   The verse used to BE the headline, with no visible title (the user's call on
   15 September 2026). On the 16th the user chose to trade that for a plain
   title so the three heroes read as one site. Ar-Rum 30:39 stays, Arabic over
   English exactly as zakat-data.ts holds it, on the right of the frame from lg
   up (user's request, same day) and under the buttons below lg.

   PHOTOGRAPHY
     Grain poured from one pair of hands into another's open palm, black and
     white on black: "Symbolic Hand Exchange with Falling Grains" by Rayan
     Hassan, pexels.com/photo/30831907, Pexels License, scaled to 1200 and 2400
     wide at 3:2. Replaced the wheat field (pexels 30594901) on 16 September
     2026, when the user asked for a picture about zakat itself: a giver and a
     receiver, and the grain the Qur'an uses for a gift multiplied (2:261).
     Stock, so it carries no caption. Do NOT mirror it: the hands would swap.
     The ground is near black, so the scrims are lighter than the other heroes'
     and the pour stays visible between the two columns.

   The photograph drifts with the scroll and the words lift away ahead of it
   (useHeroDepth), as on the other two heroes.
--------------------------------------------------------------------------- */

/* The entrance, as on HomeHero and GiveHero: each line rises through a blur. */
const rise = (step: number) => ({
  animation: 'hero-soft 1000ms var(--ease-reveal) both',
  animationDelay: `${step * 140}ms`,
})

/* The Arabic in two lines, broken where the sense breaks: "whatever you give
   in zakat, seeking the face of Allah" / "those are the multipliers". Left to
   wrap by width it split وَجْهَ from اللَّهِ. Cut from VERSE, never retyped. */
const VERSE_BREAK = VERSE.arabic.indexOf('فَأُولَٰئِكَ')
const VERSE_LINES = [VERSE.arabic.slice(0, VERSE_BREAK).trim(), VERSE.arabic.slice(VERSE_BREAK)]

const toCalculator = () =>
  document.getElementById('calculator')?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  })

export default function ZakatHero() {
  const depth = useHeroDepth<HTMLElement>()

  return (
    <section
      ref={depth.hero}
      data-overlay-hero=""
      aria-labelledby="zakat-title"
      className="relative isolate mt-[calc(var(--header-h)*-1)] overflow-hidden bg-ink text-paper"
    >
      <div
        ref={depth.photo}
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-ink will-change-[translate] hero-intro"
      >
        <img
          src="/assets/images/hero-zakat-grain-2400.jpg"
          srcSet="/assets/images/hero-zakat-grain-1200.jpg 1200w, /assets/images/hero-zakat-grain-2400.jpg 2400w"
          sizes="100vw"
          alt=""
          width={2400}
          height={1600}
          decoding="async"
          fetchPriority="high"
          className="h-full w-full object-cover"
          style={{ objectPosition: '46% 40%' }}
        />
      </div>

      {/* The photograph is mostly black already, so only the edges are pulled
          down: the header's band, the foot, and each side under a column,
          leaving the pour in the middle clear. Below md the words sit over the
          hands, so the whole frame is dimmed instead. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(21,26,24,0.55)_0%,transparent_24%,transparent_62%,rgba(21,26,24,0.85)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-ink/45 md:bg-[linear-gradient(90deg,rgba(21,26,24,0.72)_0%,rgba(21,26,24,0.25)_38%,transparent_50%,rgba(21,26,24,0.45)_62%,rgba(21,26,24,0.85)_100%)]"
      />

      <div className="relative flex min-h-[calc(100svh-var(--strip-h))] items-center pt-[var(--header-h)] pb-[clamp(56px,9vh,96px)]">
        <div className="gutter mx-auto w-full max-w-page">
          <div
            ref={depth.content}
            className="grid gap-y-10 lg:grid-cols-[minmax(0,540px)_minmax(0,430px)] lg:items-center lg:justify-between"
          >
            <div>
              <p
                className="font-script text-[clamp(21px,1.9vw,27px)] leading-none text-gold-pale [text-shadow:0_1px_16px_rgba(0,0,0,0.55)]"
                style={rise(0)}
              >
                Zakat
              </p>
              <h1
                id="zakat-title"
                className="mt-s2 font-display text-[clamp(31px,4.2vw,54px)] leading-[1.05] font-semibold tracking-[-0.022em] text-paper [text-wrap:balance] [text-shadow:0_2px_30px_rgba(0,0,0,0.5)]"
              >
                <Words text="Your zakat, delivered in full." play="load" delay={140} step={70} />
              </h1>

              {/* One sentence that does the work the old proof line did, so the
                  promise is read before the buttons rather than after them. */}
              <p
                className="mt-4 max-w-[44ch] text-[clamp(15.5px,1.2vw,17px)] leading-[1.6] text-paper/80 [text-shadow:0_1px_16px_rgba(0,0,0,0.6)]"
                style={rise(3)}
              >
                Work out what you owe, then pay it here. Every dollar reaches people zakat is meant
                for, and none of it pays our running costs.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-x-s4 gap-y-s2" style={rise(4)}>
                {/* Gold, because this one takes money. */}
                <Link
                  to="/give?designation=zakat"
                  className="group relative inline-flex min-h-[54px] items-center justify-center gap-2.5 overflow-hidden rounded-[13px] bg-gold px-7 text-[16px] font-semibold tracking-[-0.008em] text-ink shadow-gold transition-[transform,box-shadow,background-color,color] duration-200 ease-brand hover:-translate-y-[1.5px] hover:bg-gold-dark hover:text-paper hover:shadow-gold-lg active:translate-y-0"
                >
                  <HandHeart className="h-[18px] w-[18px] shrink-0 transition-transform duration-300 ease-brand group-hover:scale-[1.12]" />
                  Pay your zakat
                </Link>

                <button
                  type="button"
                  onClick={toCalculator}
                  className="group inline-flex min-h-[44px] items-center gap-2 border-b border-paper/35 text-[15px] font-semibold text-paper transition-colors duration-200 ease-brand hover:border-gold-pale hover:text-gold-pale"
                >
                  Calculate what you owe
                  <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>

            {/* The verse, on the other side from the title (user's request).
                Set as scripture rather than as UI text: the Arabic larger and
                balanced so it never leaves one word on a line, the English in
                Fraunces italic, and a pale gold rule down its edge, the same
                rule the reference ends on. Arabic keeps to the right, where it
                starts; the English reads from the left like any English. */}
            <figure
              className="border-l border-gold-pale/40 pl-6 lg:pl-8"
              style={rise(5)}
            >
              <p
                lang="ar"
                dir="rtl"
                className="font-arabic text-[clamp(22px,2vw,28px)] leading-[1.85] text-paper [text-shadow:0_1px_18px_rgba(0,0,0,0.7)]"
              >
                <span className="block">{VERSE_LINES[0]}</span>
                <span className="block">{VERSE_LINES[1]}</span>
              </p>
              <blockquote className="mt-3 font-serif text-[clamp(17px,1.45vw,20px)] leading-[1.5] text-paper/85 italic [text-wrap:pretty] [text-shadow:0_1px_18px_rgba(0,0,0,0.7)]">
                &ldquo;{VERSE.english}&rdquo;
              </blockquote>
              <figcaption className="mt-4 text-[12.5px] font-medium tracking-[0.08em] text-gold-pale/80 uppercase">
                {VERSE.cite}
              </figcaption>
            </figure>
          </div>
        </div>
      </div>

      {/* the gold-to-green hairline every hero on this site closes on */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(200,155,44,.5),rgba(47,107,90,.5),transparent)]"
      />
    </section>
  )
}
