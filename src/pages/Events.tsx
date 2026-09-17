import EventsHero from '../sections/EventsHero'
import EventsDiary from '../sections/EventsDiary'
import EventsHost from '../sections/EventsHost'

/* ---------------------------------------------------------------------------
   Events, in three parts. A table of contents, like every page. The diary and
   every word on the page are in components/event-data.ts, which the home
   page's HomeEvents band reads too.

   Added 17 September 2026 at the user's request (the sitemap lists Events).
   EVERY DATE IN THE DIARY IS A PLACEHOLDER: read the head of event-data.ts.

   1. The hero ........ EventsHero   Get involved's teal duotone photo
   2. The diary ....... EventsDiary  #diary. The next event large, the rest as rows
   3. The close ....... EventsHost   teal panel: run an event for us

   No page per event and no sign up: every event's button goes to the contact
   form with the subject chosen, until there is a ticket link.
--------------------------------------------------------------------------- */
export default function Events() {
  return (
    <>
      <EventsHero />
      <EventsDiary />
      <EventsHost />
    </>
  )
}
