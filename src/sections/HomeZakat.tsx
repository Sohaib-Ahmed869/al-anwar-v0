import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import { GradientDomes, Tiles } from '../components/Brand'
import { BREAKOUT } from '../components/SectionHead'
import { ArrowRight } from '../components/icons'
import { HOME_ZAKAT_BAND as T } from '../components/zakat-data'

/* ---------------------------------------------------------------------------
   Step 4 of the home argument: zakat, as a signpost.

   A SIGNPOST, NOT A CALCULATOR (28 September 2026, client feedback)
   Until today this band held a quick estimate: one figure in, the 2.5% out,
   the eight categories of 9:60 as chips and a gold pay button. The client
   asked for the calculator to come off the home page and for the page to send
   people to the real one instead, so it is now one slim green-pale band with
   a line of words and a link to /zakat#calculator. The full calculator there
   walks through each kind of wealth, explains each heading, and does not
   choose a nisab for the reader, which a one-field estimate could not do well.

   No gold here: the link goes to a calculator, not to the give form, and gold
   on this site only ever means the button that takes money. Green-pale is the
   zakat colour already (ZakatPolicy, ZakatNisab).

   THE 2026 BRAND made it the home page's brand moment: the deep teal
   gradient, the tiles large and tone on tone, the six gradient domes of
   p. 15 standing on the right, and زكاة set in Noto Kufi in saffron. Saffron
   here is type, not a button, so the give-action rule still holds: the link
   itself is off-white.

   The words live in HOME_ZAKAT_BAND in components/zakat-data.ts. The band has
   no ground or spacing that depends on its neighbours, so it can still be
   lifted up the page in Home.tsx alone for Ramadan.
--------------------------------------------------------------------------- */

export default function HomeZakat() {
  return (
    <section id="zakat" aria-labelledby="zakat-head" className="py-[clamp(24px,3vw,40px)]">
      <div className="gutter mx-auto max-w-page">
        <Reveal variant="soft" className={BREAKOUT}>
          <div className="relative isolate overflow-hidden rounded-[24px] bg-grad-deep-x px-s3 py-s4 sm:px-s5 sm:py-s5">
            <Tiles className="-z-10 bg-teal-mid/[0.1]" style={{ '--tile': '220px' } as React.CSSProperties} />
            <GradientDomes
              className="absolute top-1/2 right-[clamp(16px,4vw,64px)] -z-10 hidden -translate-y-1/2 lg:flex"
              domeClass="w-[clamp(46px,4.6vw,74px)]"
            />
            <div className="relative flex max-w-[640px] flex-col gap-s3 sm:flex-row sm:items-center sm:gap-s4">
              <span
                aria-hidden="true"
                lang="ar"
                dir="rtl"
                className="font-arabic text-[clamp(44px,5vw,68px)] leading-none text-gold"
              >
                &#x0632;&#x0643;&#x0627;&#x0629;
              </span>
              <div>
                <p className="text-[11px] font-medium tracking-[0.24em] text-gold-pale uppercase">{T.eyebrow}</p>
                <h2
                  id="zakat-head"
                  className="mt-1.5 font-display text-[clamp(24px,2.6vw,34px)] leading-[1.1] tracking-[-0.02em] text-paper"
                >
                  {T.title}
                </h2>
                <p className="mt-2 max-w-[52ch] text-[14.5px] leading-relaxed text-text-on-ink-2">{T.body}</p>
                <Link
                  to={T.to}
                  className="group mt-s3 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[12px] bg-paper px-s3 text-[15px] font-semibold text-ink transition-[transform,background-color] duration-200 ease-brand hover:-translate-y-px hover:bg-offwhite"
                >
                  {T.cta}
                  <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
