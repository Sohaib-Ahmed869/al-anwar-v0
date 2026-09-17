import { Link } from 'react-router-dom'

import { EventFeature, EventRow } from '../components/EventCard'
import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { ArrowRight } from '../components/icons'
import { HOME_EVENTS as HEAD, upcomingEvents } from '../components/event-data'

/* ---------------------------------------------------------------------------
   Home: what's on. Added back 17 September 2026 at the user's request, in the
   slot the next-event band held before 16 September: after zakat and before
   the social close, since both ask for attention rather than money. No gold.

   The next event large, and up to two after it as rows, from the same diary
   and the same cards as /events. When the diary is empty the band is not
   drawn at all: an empty events box on the home page reads as abandoned.
--------------------------------------------------------------------------- */

export default function HomeEvents() {
  const [next, ...rest] = upcomingEvents()
  if (!next) return null

  return (
    <section aria-labelledby="home-events-head" className={SECTION_Y}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="home-events-head"
          eyebrow={HEAD.eyebrow}
          title={HEAD.title}
          lede={HEAD.lede}
          action={
            <Link
              to="/events"
              className="group inline-flex min-h-[44px] items-center gap-2 border-b border-line text-[15px] font-semibold text-text transition-colors duration-200 ease-brand hover:border-teal hover:text-teal"
            >
              {HEAD.all}
              <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
            </Link>
          }
        />

        <div className={`mt-s4 lg:mt-s5 ${BREAKOUT}`}>
          <Reveal variant="soft">
            <EventFeature event={next} />
          </Reveal>
          {rest.length > 0 && (
            <Reveal variant="soft" delay={120}>
              <ul className="mt-s3 border-b border-line">
                {rest.slice(0, 2).map((e) => (
                  <li key={e.slug}>
                    <EventRow event={e} />
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  )
}
