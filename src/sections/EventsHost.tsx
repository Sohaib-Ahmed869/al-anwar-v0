import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import { BREAKOUT } from '../components/SectionHead'
import { MasjidMark } from '../components/Ornament'
import { ArrowRight } from '../components/icons'
import { HOST } from '../components/event-data'

/* ---------------------------------------------------------------------------
   /events, section 3 of 3: the close. Get involved's teal panel (InvolvedAsk),
   asking people to run an event of their own. No gold: it does not take money.
--------------------------------------------------------------------------- */

export default function EventsHost() {
  return (
    <section id="host" aria-labelledby="events-host-head" className="scroll-mt-[calc(var(--header-h)+24px)] pb-[clamp(56px,6.5vw,96px)]">
      <div className="gutter mx-auto max-w-page">
        <Reveal variant="clip" className={`block ${BREAKOUT}`}>
          <div className="relative isolate flex flex-col gap-s4 overflow-hidden rounded-2xl bg-teal p-s3 text-paper sm:p-s4 md:flex-row md:items-center md:justify-between lg:p-[clamp(40px,4vw,64px)]">
            <MasjidMark className="pointer-events-none absolute -right-[4%] -bottom-[18%] -z-10 size-[clamp(200px,22vw,320px)] text-paper/[0.07]" />
            <div>
              <p className="font-script text-[clamp(24px,2.2vw,32px)] leading-none text-gold-pale">{HOST.eyebrow}</p>
              <h2
                id="events-host-head"
                className="mt-2 max-w-[22ch] font-display text-[clamp(28px,3.2vw,44px)] leading-[1.08] font-semibold tracking-[-0.025em] text-balance"
              >
                {HOST.title}
              </h2>
              <p className="mt-s2 max-w-[48ch] text-[15.5px] leading-[1.55] text-paper/85">{HOST.body}</p>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-s2 md:items-end">
              <Link
                to="/contact?topic=Fundraising%20or%20an%20event"
                className="group inline-flex min-h-[52px] items-center gap-2 rounded-[10px] bg-paper px-6 text-[15.5px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-green-pale"
              >
                {HOST.action}
                <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/fundraisers/start"
                className="text-[14.5px] font-semibold text-paper underline decoration-paper/35 underline-offset-4 transition-colors duration-200 hover:text-gold-pale hover:decoration-gold-pale"
              >
                {HOST.start}
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
