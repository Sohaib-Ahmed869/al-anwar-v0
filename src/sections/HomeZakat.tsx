import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
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

   The words live in HOME_ZAKAT_BAND in components/zakat-data.ts. The band has
   no ground or spacing that depends on its neighbours, so it can still be
   lifted up the page in Home.tsx alone for Ramadan.
--------------------------------------------------------------------------- */

export default function HomeZakat() {
  return (
    <section id="zakat" aria-labelledby="zakat-head" className="py-[clamp(24px,3vw,40px)]">
      <div className="gutter mx-auto max-w-page">
        <Reveal variant="soft" className={BREAKOUT}>
          <div className="flex flex-col gap-s2 rounded-[20px] bg-green-pale px-s3 py-s3 sm:flex-row sm:items-center sm:justify-between sm:gap-s4 sm:px-s4">
            <div className="flex items-center gap-s2">
              <span
                aria-hidden="true"
                lang="ar"
                dir="rtl"
                className="hidden font-arabic text-[26px] leading-none text-green/60 sm:block"
              >
                &#x0632;&#x0643;&#x0627;&#x0629;
              </span>
              <div>
                <p className="text-[11px] font-semibold tracking-[0.16em] text-green uppercase">{T.eyebrow}</p>
                <h2
                  id="zakat-head"
                  className="mt-1 font-display text-[clamp(21px,2.2vw,27px)] leading-[1.15] tracking-[-0.015em] text-text"
                >
                  {T.title}
                </h2>
                <p className="mt-1 max-w-[60ch] text-[14px] leading-relaxed text-text-2">{T.body}</p>
              </div>
            </div>
            <Link
              to={T.to}
              className="group inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-[12px] bg-green px-s3 text-[15px] font-semibold text-paper transition-[transform,background-color] duration-200 ease-brand hover:-translate-y-px hover:bg-ink"
            >
              {T.cta}
              <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
