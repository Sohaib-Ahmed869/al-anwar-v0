/* ---------------------------------------------------------------------------
   The gallery, and every word on /gallery, in one file.

   Added 17 September 2026 at the user's request (the sitemap lists Gallery).

   ONLY AL-ANWAAR'S OWN PHOTOGRAPHS. A charity gallery is a claim: "this is
   our work". So no stock frame may ever go in PHOTOS, however good it looks,
   and the hero's stock rule does not apply here because there is no stock.
   What is NOT here, on purpose:
     - every hero-*, event-* and give-* image (licensed stock)
     - the Tarim school flyer (WhatsApp-Image-2026-07-21), a rendered design,
       not a photograph of anything built
     - Food-Packs-Yemen_1 and Water-Stations_1, which have the old site's
       titles burnt in; the cropped copies beside them are used instead
     - the Instagram covers, which are posters and reels, and are on the home
       page's #social already

   WHERE THE WORDS COME FROM. Every alt, title, place and date is the one the
   site already uses for the same file (HomeImpact.tsx, GiveHero.tsx and the
   About ledger in AboutStory.tsx), so the gallery cannot disagree with them.
   Years come off the file names; the two cropped frames have no date and say
   so rather than guess. TODO before launch: check each against the field log.

   EIGHT IS NOT MANY, and the page is designed for that: one even grid where
   wide frames take two cells, the year on each. When the field
   team sends more, add them here with `year`, and the filters, the counts and
   the hero line all follow. Most of these are 600 to 900px squares, so the
   tiles stay small and the lightbox never scales a frame past its own size.
--------------------------------------------------------------------------- */

export type Place = 'Yemen' | 'The Gambia' | 'A displacement camp'

export type Photo = {
  src: string
  /** what is visible in the frame, and no more */
  alt: string
  title: string
  place: Place
  /** the town, when the frame or the About ledger names one */
  town?: string
  /** as precise as the evidence allows: "December 2021", "2022" */
  when?: string
  /** for grouping; null when nothing dates the frame */
  year: number | null
  width: number
  height: number
  position?: string
  /** the appeal this work belongs to, for the lightbox link */
  appeal: { label: string; to: string }
}

const FOOD = { label: 'Food appeals', to: '/appeals?cause=food' }
const WATER = { label: 'Water appeals', to: '/appeals?cause=water' }
const JARIYAH = { label: 'Sadaqah jariyah appeals', to: '/appeals?cause=jariyah' }

export const PHOTOS: Photo[] = [
  {
    src: '/assets/images/PHOTO-2021-12-23-22-48-18.webp',
    alt: 'Rows of prepared food baskets waiting in a distribution store',
    title: 'Food baskets, packed and waiting',
    place: 'Yemen',
    town: 'Tarim, Hadhramaut',
    when: 'December 2021',
    year: 2021,
    width: 607,
    height: 607,
    appeal: FOOD,
  },
  {
    src: '/assets/images/PHOTO-2022-04-26-22-10-27.webp',
    alt: 'Children filling jerry cans from a water truck',
    title: 'Water by the tanker',
    place: 'Yemen',
    when: '2022',
    year: 2022,
    width: 780,
    height: 780,
    position: '50% 60%',
    appeal: WATER,
  },
  {
    src: '/assets/images/PHOTO-2022-05-01-00-52-12.webp',
    alt: 'Families filling jerry cans and buckets from a water tank',
    title: 'Everyone brings a can',
    place: 'Yemen',
    when: '2022',
    year: 2022,
    width: 810,
    height: 810,
    appeal: WATER,
  },
  {
    src: '/assets/images/PHOTO-2022-06-05-00-56-50.webp',
    alt: 'A family beside a Ramadan food package and the Yemen Appeal banner',
    title: 'Ramadan food packages',
    place: 'Yemen',
    when: '2022',
    year: 2022,
    width: 720,
    height: 720,
    position: '50% 45%',
    appeal: FOOD,
  },
  {
    src: '/assets/images/PHOTO-2022-07-29-10-21-12.webp',
    alt: 'A masjid under construction, with Al-Anwaar’s banner hung on the wall',
    title: 'A masjid, and a school beside it',
    place: 'The Gambia',
    when: 'July 2022',
    year: 2022,
    width: 2012,
    height: 958,
    appeal: JARIYAH,
  },
  {
    src: '/assets/images/WhatsApp-Image-2024-03-01-at-10.21.59-AM.jpeg',
    alt: 'Cooked meals handed down from the back of a van to families at a camp',
    title: 'Hot meals handed out',
    place: 'A displacement camp',
    when: 'March 2024',
    year: 2024,
    width: 1024,
    height: 682,
    appeal: FOOD,
  },
  {
    src: '/assets/images/food-pack-yemen.webp',
    alt: 'A food pack laid out: basmati rice, flour, sugar, cooking oil and tinned goods',
    title: 'What goes in a food pack',
    place: 'Yemen',
    year: null,
    width: 878,
    height: 585,
    appeal: FOOD,
  },
  {
    src: '/assets/images/water-station.webp',
    alt: 'Jerry cans being filled from a standing tap',
    title: 'A water station',
    place: 'Yemen',
    year: null,
    width: 878,
    height: 585,
    appeal: WATER,
  },
]

/** "Tarim, Hadhramaut, Yemen" or just "Yemen" */
export const whereOf = (p: Photo) => (p.town ? `${p.town}, ${p.place}` : p.place)

/** Every place with at least one photograph, most photographs first. */
export const PLACES = (() => {
  const counts = new Map<Place, number>()
  for (const p of PHOTOS) counts.set(p.place, (counts.get(p.place) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1]).map(([place, count]) => ({ place, count }))
})()

/** Newest year first, and the undated frames last. */
export function byYear(photos: Photo[]) {
  const groups = new Map<number | null, Photo[]>()
  for (const p of photos) groups.set(p.year, [...(groups.get(p.year) ?? []), p])
  return [...groups]
    .sort((a, b) => (a[0] === null ? 1 : b[0] === null ? -1 : b[0] - a[0]))
    .map(([year, items]) => ({ year, items }))
}

const years = PHOTOS.map((p) => p.year).filter((y): y is number => y !== null)
export const FIRST_YEAR = Math.min(...years)
export const LAST_YEAR = Math.max(...years)

/* ===========================================================================
   The words on /gallery
   =========================================================================== */

export const GALLERY_HERO = {
  eyebrow: 'Gallery',
  titleLead: 'From the field.',
  titleMark: 'In our own photographs.',
  intro: `The work your gifts paid for, photographed where it happened: ${PLACES.length} places, from ${FIRST_YEAR} to ${LAST_YEAR}.`,
  more: 'See the photographs',
}

export const ALBUM = {
  eyebrow: 'The album',
  title: 'Every photograph, with where and when.',
  lede: 'Newest first. Choose a place to narrow it down, and open any photograph to see it larger.',
  all: 'All places',
  undated: 'Date to confirm',
  open: 'Open photograph',
  close: 'Close',
  previous: 'Previous photograph',
  next: 'Next photograph',
}

export const SEND = {
  eyebrow: 'Were you there?',
  title: 'Send us your photographs from a distribution.',
  body: 'If you volunteered, travelled with a partner or packed boxes with us, we would love to add your pictures, with your name against them.',
  action: 'Email your photos',
  subject: 'Photographs for the gallery',
  follow: 'More on Instagram',
}
