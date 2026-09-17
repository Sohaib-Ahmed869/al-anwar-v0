import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import { BREAKOUT } from '../components/SectionHead'
import { MasjidMark } from '../components/Ornament'
import { ArrowRight, Mail } from '../components/icons'
import { CLOSE } from '../components/involved-data'
import { ORG } from '../components/org-data'

/* ---------------------------------------------------------------------------
   Get involved, section 5 of 5: the close.

   Rebuilt 17 September 2026 as About's closing panel: the logo teal with the
   masjid watermark and a paper button. No gold, because nothing on this page
   asks for money; the Donate button in the header is there for anyone who
   changed their mind. The old copy explaining why there is no sign-up form
   came off with the rest of the self-referential lines.
--------------------------------------------------------------------------- */

export default function InvolvedAsk() {
  return (
    <section aria-labelledby="involved-close-head" className="pb-[clamp(56px,6.5vw,96px)]">
      <div className="gutter mx-auto max-w-page">
        <Reveal variant="clip" className={`block ${BREAKOUT}`}>
          <div className="relative isolate flex flex-col gap-s4 overflow-hidden rounded-2xl bg-teal p-s3 text-paper sm:p-s4 md:flex-row md:items-center md:justify-between lg:p-[clamp(40px,4vw,64px)]">
            <MasjidMark className="pointer-events-none absolute -right-[4%] -bottom-[18%] -z-10 size-[clamp(200px,22vw,320px)] text-paper/[0.07]" />
            <div>
              <p className="font-script text-[clamp(24px,2.2vw,32px)] leading-none text-gold-pale">
                {CLOSE.eyebrow}
              </p>
              <h2
                id="involved-close-head"
                className="mt-2 font-display text-[clamp(28px,3.2vw,44px)] leading-[1.08] font-semibold tracking-[-0.025em] text-balance"
              >
                {CLOSE.title}
              </h2>
              <p className="mt-s2 max-w-[48ch] text-[15.5px] leading-[1.55] text-paper/85">
                {CLOSE.body}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-s2 md:items-end">
              <a
                href={`mailto:${ORG.email}`}
                className="group inline-flex min-h-[52px] items-center gap-2 rounded-[10px] bg-paper px-6 text-[15.5px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-green-pale"
              >
                <Mail className="h-4 w-4" />
                {ORG.email}
                <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
              </a>
              <Link
                to="/contact"
                className="text-[14.5px] font-semibold text-paper underline decoration-paper/35 underline-offset-4 transition-colors duration-200 hover:text-gold-pale hover:decoration-gold-pale"
              >
                {CLOSE.form}
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
