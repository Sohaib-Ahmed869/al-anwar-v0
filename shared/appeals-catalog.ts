/* ---------------------------------------------------------------------------
   The appeals catalogue as plain data, shared by the site and the server.

   It lives in shared/ because both sides need it: the site renders the cards
   and pages from it (src/components/appeals-data.ts re-exports it alongside
   the display helpers), and the development seed (server/seed/seed.ts) makes
   its Appeal records from it. Plain data only: no React, no assets, no
   window, so the server can import it.

   The home page's rail (HomeAppeals), the /appeals page, the emergency strip
   in Header and the single appeal page all read this, so an appeal is
   written down in exactly one place.

   PHOTOGRAPHY
   The five that were on the home rail keep their frames and the notes on them
   in HomeAppeals.tsx: four are Al-Anwaar's own field photographs, the Tarim
   school is stock. The two Gaza appeals use the home hero's stock frames
   (hero-gaza, hero-camps; credits in HomeHero.tsx) and, like every stock
   frame, nothing on a card captions them as our work.

   ZAKAT ELIGIBILITY
   `zakat: true` only where the gift goes into the hands of people who qualify:
   food, meals, emergency relief. Water stations, the school and the masjid are
   `false` for the reason given on the Zakat page (ZakatPolicy, WHERE in
   zakat-data.ts): whether zakat may pay for shared buildings and infrastructure
   is a question scholars answer differently. TODO: the imam confirms each one.

   TODO BEFORE LAUNCH — THE FIGURES
   Every `raised` and `goal` below is an invented round number, shown on the
   cards at the client's request (15 September 2026) so the design can be
   judged with its progress bars in it. They are the most persuasive thing on
   the page and the most damaging if they ship wrong. Real totals, or take the
   bars out, before launch.
--------------------------------------------------------------------------- */

export type Appeal = {
  /** the URL: /appeals/<slug> */
  slug: string
  title: string
  /** one or two sentences; the cards clamp it to two lines */
  blurb: string
  /** a key of PLACES */
  country: string
  /** where exactly, when it is narrower than the country */
  where?: string
  /** keys of CAUSES_F; the first is the one shown on the card */
  causes: string[]
  /** keys of SEASONS */
  seasons: string[]
  /** the give fund it books to, a CAUSES id in give-data.ts */
  fund: string
  zakat: boolean
  /** PLACEHOLDER — see the TODO above */
  raised: number
  goal: number
  image: string
  /** what is visible in the frame, and no more */
  alt: string
  /** on the home page rail */
  home?: boolean
}

export const APPEAL_LIST: Appeal[] = [
  {
    slug: 'gaza-emergency',
    title: 'Gaza cannot wait',
    blurb:
      'Homes have been reduced to rubble, and families are living in tents with too little food and water.',
    country: 'gaza',
    causes: ['emergency', 'food'],
    seasons: [],
    fund: 'emergency',
    zakat: true,
    raised: 146000,
    goal: 250000,
    image: '/assets/images/hero-gaza-1200.jpg',
    alt: 'A collapsed concrete building, with people searching the rubble',
  },
  {
    slug: 'gaza-hot-meals',
    title: 'Hot meals where families shelter',
    blurb:
      'Cooked and handed out in the camps by people on the ground, to families who have lost their kitchens.',
    country: 'gaza',
    where: 'The camps',
    causes: ['food', 'emergency'],
    seasons: [],
    fund: 'food',
    zakat: true,
    raised: 38500,
    goal: 60000,
    image: '/assets/images/hero-camps-1200.jpg',
    alt: 'Tents standing in floodwater below damaged buildings',
  },
  {
    slug: 'food-pack-lebanon',
    title: 'Food packs in Tripoli',
    blurb:
      'Our partner is distributing this week. Every pack is bought in-country, so the money moves faster than the goods would.',
    country: 'lebanon',
    where: 'Tripoli',
    causes: ['food', 'emergency'],
    seasons: [],
    fund: 'food',
    zakat: true,
    raised: 12400,
    goal: 40000,
    image: '/assets/images/WhatsApp-Image-2024-03-01-at-10.21.59-AM.jpeg',
    alt: 'Families collecting meals handed down from the back of a distribution van',
    home: true,
  },
  {
    slug: 'yemen-food-relief',
    title: 'A month of food for a family',
    blurb: 'A $50 pack is flour, rice, oil, lentils and dates, enough to feed one family for a month.',
    country: 'yemen',
    causes: ['food'],
    seasons: [],
    fund: 'food',
    zakat: true,
    raised: 88200,
    goal: 150000,
    image: '/assets/images/PHOTO-2022-06-05-00-56-50.webp',
    alt: 'A family standing beside a food package set out on the ground',
    home: true,
  },
  {
    slug: 'water-stations-yemen',
    title: 'Water that is not a two-hour walk away',
    blurb:
      'A tanker run fills every container in a street. A station means the next one is close enough to carry home.',
    country: 'yemen',
    causes: ['water', 'jariyah'],
    seasons: [],
    fund: 'water',
    zakat: false,
    raised: 31500,
    goal: 90000,
    image: '/assets/images/PHOTO-2022-04-26-22-10-27.webp',
    alt: 'Children filling yellow jerry cans from a water truck',
    home: true,
  },
  {
    slug: 'gambia-masjid',
    title: 'A masjid that outlives the giver',
    blurb:
      'Built on behalf of someone named on the wall, and left standing for a village that had nowhere to pray together.',
    country: 'gambia',
    causes: ['jariyah'],
    seasons: [],
    fund: 'sadaqah',
    zakat: false,
    raised: 64000,
    goal: 110000,
    image: '/assets/images/PHOTO-2022-07-29-10-21-12.webp',
    alt: 'A masjid under construction, block walls up and the roof line begun',
    home: true,
  },
  {
    slug: 'tarim-school',
    title: 'Build a school, build a future',
    blurb:
      'Upgrading and completing a high school in Tarim: new classrooms, a new level, and the facilities its students should already have.',
    country: 'yemen',
    where: 'Tarim',
    causes: ['education', 'jariyah'],
    seasons: [],
    fund: 'education',
    zakat: false,
    raised: 121000,
    goal: 400000,
    image: '/assets/images/hero-classroom-1200.jpg',
    alt: 'A class of girls at their desks, seen through a broken window',
    home: true,
  },
]
