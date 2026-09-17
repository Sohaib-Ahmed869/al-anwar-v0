/* ---------------------------------------------------------------------------
   The events diary, and every word on /events, in one file.

   BACK ON THE SITE 17 September 2026, at the user's request: /events and a
   "What's on" band on the home page. (The diary came off the whole site on
   16 September at the client's request; the README records that. Confirm with
   the client that it is wanted back before launch.)

   EVERY EVENT IN THE DIARY IS PLACEHOLDER DATA. `confirmed` is false on all
   four. The dinner came off the old prototype's nav panel and has never been
   checked with anyone; the other three are the kind of thing this charity
   plausibly runs, not anything scheduled. Nothing reads `confirmed`: it is a
   label, so a real date replacing a made-up one is an obvious two-line change.
   DO NOT LAUNCH WITH ANY OF THESE ON THE PAGE.

   The iftar and the Eid day sit inside Ramadan 1448 on the Umm al-Qura dates
   season-data.ts uses (1 Ramadan 8 Feb 2027, Eid al-Fitr 9 Mar 2027). Local
   moon sighting decides both.

   THE DATE IS WRITTEN ONCE, as an ISO day, and the weekday, the short and long
   forms and whether it has already happened are all worked out from it, so a
   site can never advertise a Saturday that falls on a Tuesday. A past event
   stops showing the day after it is held, and both the page and the home band
   handle an empty diary rather than invite people to last month's dinner.

   NO TICKETS, NO SIGN UP. The site has no server. Every event's button goes to
   the contact form with "Fundraising or an event" chosen. When there is a real
   ticket link, put it in `tickets` and the button uses it instead.

   WHERE: the warehouse suburb is still unsettled (Silverwater or Guildford, see
   involved-data.ts), so the packing day says "Western Sydney" until it is.

   PHOTOGRAPHS: all four are licensed Pexels stock (free for commercial use, no
   credit needed), bought for the first diary. Not one is an Al-Anwaar event,
   so no heading or line of copy may say it is, and each `alt` says only what
   is in the frame. Swap in a real photograph the moment there is one; 800w and
   1600w are the only sizes to match. An event with no photo gets a teal date
   panel instead (EventCard.tsx), which is what the dinner uses: the dinner
   frame (event-dinner, pexels.com/photo/348517) is built around a double bass
   player, wrong for this charity's dinners, so it is not used anywhere.
     event-packing  pexels.com/photo/6591154
     event-iftar    pexels.com/photo/20488464
     event-eid      pexels.com/photo/36223658
--------------------------------------------------------------------------- */

export type EventKind = 'Dinner' | 'Community' | 'Volunteer day'

export type CharityEvent = {
  slug: string
  name: string
  kind: EventKind
  /** one or two sentences on what happens and who it is for */
  blurb: string
  /** ISO, the day it is held. The only place a date is written down. */
  date: string
  /** when it starts, as it should be read aloud */
  time: string
  venue: string
  suburb: string
  /** what it costs to come, said plainly */
  cost: string
  /** a real ticket page, once there is one */
  tickets?: string
  /** file stem under /assets/images, at 800w and 1600w */
  photo?: string
  alt?: string
  position?: string
  /** false until a person has checked the date, venue and time */
  confirmed: boolean
}

const DIARY: CharityEvent[] = [
  {
    slug: 'annual-fundraising-dinner',
    name: 'Annual fundraising dinner',
    kind: 'Dinner',
    blurb: 'A meal, the year’s work set out in front of the people who paid for it, and the appeal for the year ahead.',
    date: '2026-10-03',
    time: 'Doors 6:30pm',
    venue: 'Grand Royale',
    suburb: 'Granville',
    cost: 'Seats and tables, price to be set',
    confirmed: false,
  },
  {
    slug: 'food-pack-packing-day',
    name: 'Food pack packing day',
    kind: 'Volunteer day',
    blurb: 'Flour, rice, oil, lentils and dates into boxes for Yemen. Two hours, no experience needed, and children are welcome.',
    date: '2026-11-14',
    time: '9:00am to 11:00am',
    venue: 'Our warehouse',
    suburb: 'Western Sydney',
    cost: 'Free',
    photo: 'event-packing',
    alt: 'Volunteers in matching tops filling a cardboard box with food',
    position: '50% 45%',
    confirmed: false,
  },
  {
    slug: 'community-iftar',
    name: 'Community iftar',
    kind: 'Community',
    blurb: 'We break the fast together in the second week of Ramadan. Open to anyone, and the collection goes to the food fund.',
    date: '2027-02-20',
    time: 'At maghrib',
    venue: 'Venue to be confirmed',
    suburb: 'Western Sydney',
    cost: 'Free',
    photo: 'event-iftar',
    alt: 'Two women at a laid table with their hands raised in dua',
    position: '45% 50%',
    confirmed: false,
  },
  {
    slug: 'eid-family-day',
    name: 'Eid family day',
    kind: 'Community',
    blurb: 'A morning in the park on the first Saturday after Eid al-Fitr, with food, games for the children and a thank you to everyone who gave.',
    date: '2027-03-13',
    time: '10:00am',
    venue: 'Park to be confirmed',
    suburb: 'Western Sydney',
    cost: 'Free',
    photo: 'event-eid',
    alt: 'A family in festival clothes standing over a table laid with dishes',
    position: '50% 45%',
    confirmed: false,
  },
]

/** Parsed as local time: `new Date('2026-10-03')` is midnight UTC, which is
 *  still the 2nd anywhere behind UTC. */
export const dayOf = (e: CharityEvent) => {
  const [y, m, d] = e.date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Everything from today onwards, soonest first. An event stays on all through
 *  the day it is held. */
export function upcomingEvents(): CharityEvent[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return DIARY.filter((e) => dayOf(e) >= today).sort((a, b) => a.date.localeCompare(b.date))
}

/** The pieces a date plate is built from: "Sat", "3", "Oct", "2026". */
export function dateParts(e: CharityEvent) {
  const d = dayOf(e)
  return {
    weekday: d.toLocaleDateString('en-AU', { weekday: 'short' }),
    day: d.getDate(),
    month: d.toLocaleDateString('en-AU', { month: 'short' }),
    year: d.getFullYear(),
  }
}

/** "Saturday 3 October 2026" */
export const longDate = (e: CharityEvent) =>
  dayOf(e)
    .toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .replace(',', '')

export const placeOf = (e: CharityEvent) => `${e.venue}, ${e.suburb}`

/** Where the event's button goes: its ticket page, or the contact form with the
 *  subject chosen (a string from TOPICS in contact-data.ts). */
export const askAbout = (e: CharityEvent) =>
  e.tickets ?? '/contact?topic=Fundraising%20or%20an%20event'

/* ===========================================================================
   The words on /events
   =========================================================================== */

export const EVENTS_HERO = {
  eyebrow: 'Events',
  titleLead: 'Come and sit',
  titleMark: 'at the table.',
  intro: 'Dinners, iftars, packing mornings and Eid days in Western Sydney. Most cost nothing, and everyone is welcome.',
  more: 'See what’s on',
  host: 'Host an event',
  nextUp: 'Next up',
}

export const DIARY_HEAD = {
  eyebrow: 'What’s on',
  title: 'The next one, and the rest of the diary.',
  lede: 'Dates for Ramadan and Eid follow the moon, so they are confirmed nearer the time.',
  next: 'Coming up next',
  rest: 'After that',
  ask: 'Ask about this event',
  tickets: 'Book your seat',
  empty: {
    title: 'Nothing in the diary just now.',
    body: 'New dates go up here and on Instagram first. Or tell us what you would like to come to.',
    action: 'Get in touch',
  },
}

export const HOST = {
  eyebrow: 'Host one for us',
  title: 'Running a night at your mosque or school?',
  body: 'A bake sale, a dinner or a sports day. Tell us what you have in mind and we will help you plan it and choose the appeal it raises for.',
  action: 'Tell us about it',
  start: 'Or start an online fundraiser',
}

export const HOME_EVENTS = {
  eyebrow: 'Come along',
  title: 'What’s on next.',
  lede: 'Meet the team, give in person, or spend a morning packing boxes.',
  all: 'All events',
}
