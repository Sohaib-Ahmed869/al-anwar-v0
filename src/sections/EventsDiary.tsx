import { Link } from 'react-router-dom'

import { EventFeature, EventRow } from '../components/EventCard'
import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { ArrowRight } from '../components/icons'
import { DIARY_HEAD as HEAD, upcomingEvents } from '../components/event-data'

/* ---------------------------------------------------------------------------
   /events, section 2 of 3: the diary. #diary.

   The soonest event large (EventFeature), and everything after it as ruled
   rows (EventRow). Past events drop off on their own. When the diary is empty
   the section says so and points at the contact form, rather than vanishing
   and leaving a hero that promises something is on.
--------------------------------------------------------------------------- */

export default function EventsDiary() {
  const [next, ...rest] = upcomingEvents()

  return (
    <section id="diary" aria-labelledby="diary-head" className={`scroll-mt-[var(--header-h)] ${SECTION_Y}`}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead id="diary-head" eyebrow={HEAD.eyebrow} title={HEAD.title} lede={HEAD.lede} />

        <div className={`mt-s4 lg:mt-s5 ${BREAKOUT}`}>
          {next ? (
            <>
              <Reveal variant="soft">
                <EventFeature event={next} label={HEAD.next} />
              </Reveal>

              {rest.length > 0 && (
                <Reveal variant="soft" delay={120} className="mt-s5">
                  <p className="pb-s2 font-script text-[clamp(19px,1.6vw,23px)] leading-none text-green">{HEAD.rest}</p>
                  <ul className="border-b border-line">
                    {rest.map((e) => (
                      <li key={e.slug}>
                        <EventRow event={e} />
                      </li>
                    ))}
                  </ul>
                </Reveal>
              )}
            </>
          ) : (
            <Reveal variant="soft">
              <div className="rounded-2xl border border-line bg-paper p-s4 text-center">
                <p className="font-display text-[clamp(22px,2vw,28px)] tracking-[-0.02em]">
                  {HEAD.empty.title}
                </p>
                <p className="mx-auto mt-s2 max-w-[46ch] text-[15.5px] leading-[1.55] text-text-2">{HEAD.empty.body}</p>
                <Link
                  to="/contact?topic=Fundraising%20or%20an%20event"
                  className="group mt-s3 inline-flex min-h-[48px] items-center gap-2 rounded-[12px] bg-teal px-6 text-[15px] font-semibold text-paper transition-colors duration-200 ease-brand hover:bg-ink"
                >
                  {HEAD.empty.action}
                  <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                </Link>
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  )
}
