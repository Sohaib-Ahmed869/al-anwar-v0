import type { GiveAmount } from './GiveModule'

/* ---------------------------------------------------------------------------
   What a single appeal page says beyond its card. The card itself (title,
   blurb, place, fund, figures) is in appeals-data.ts; this is the long form,
   keyed by the same slug.

   ⚠ EVERY PARAGRAPH HERE IS A DRAFT — written on 15 September 2026 at the
   client's request, using only what the rest of the site already says: the
   About ledger (AboutStory.tsx), the home hero's appeal copy, the appeal cards,
   and the fund notes in give-data.ts. Nothing is added that the site did not
   already claim — no figures, no partner names that are not already on the
   About page, no dates that are not on a photograph. TODO: the team reads each
   one against what actually happened before launch, and replaces "our partner
   on the ground" with a name wherever a name can be published.

   BAND PHOTOGRAPHS
   The band across the top of each page needs a frame at least 2400px wide, and
   none of our own photographs is (the largest square is 810px). So the band
   uses the licensed stock frames the home hero and give card already use, with
   no caption — the site-wide rule. The masjid is the exception: its own
   2012px frame is the one photograph of ours big enough, and the About hero
   already runs it full screen.

   PROOF PHOTOGRAPHS
   Al-Anwaar's own field photographs, shown only where the place on the file
   matches the appeal, and captioned with the place and date the file itself
   carries (the same captions the home hero's field cards use). Gaza, Lebanon
   and the Tarim school have none, so their pages have no proof section. The
   March 2024 camp distribution is NOT used for Gaza: nothing on that file says
   which camp it was.
--------------------------------------------------------------------------- */

/** `when` is left off where the file carries no date, rather than guessed. */
export type Proof = { src: string; alt: string; what: string; place: string; when?: string; position?: string }

export type AppealDetail = {
  /** stem under /assets/images with -1200/-2400 variants, or a full path */
  band: string
  bandPosition: string
  /** why this appeal exists — two or three short paragraphs */
  need: string[]
  /** who hands it over, and how the work is checked */
  delivery: string[]
  proof: Proof[]
  /** amounts with what each buys, where the appeal's unit differs from its
   *  fund's ladder (Gaza meals are priced per meal, not per Yemen pack) */
  ladder?: GiveAmount[]
}

const TARIM_BASKETS: Proof = {
  src: '/assets/images/PHOTO-2021-12-23-22-48-18.webp',
  alt: 'Rows of prepared food baskets waiting in a distribution store',
  what: 'Food baskets packed',
  place: 'Tarim, Hadhramaut',
  when: 'December 2021',
}

/** The pattern every distribution follows, from the About ledger's 2021 entry. */
const PATTERN =
  'We buy in the country, deliver through a partner who lives there, and photograph the handover. Everything that has gone out, with the place and the date against it, is recorded on our accountability page.'

export const APPEAL_DETAIL: Record<string, AppealDetail> = {
  'gaza-emergency': {
    band: 'hero-gaza',
    bandPosition: '58% 45%',
    need: [
      'Homes in Gaza have been reduced to rubble. Families are living in tents, with too little food and water.',
      'This appeal goes to the Emergency Fund for Gaza, so it can be spent on whatever is most needed at the time it arrives: food, water or shelter.',
    ],
    delivery: [
      'Relief is bought and handed over locally by our partner on the ground.',
      PATTERN,
    ],
    proof: [],
  },
  'gaza-hot-meals': {
    band: 'hero-camps',
    bandPosition: '55% 50%',
    need: [
      'Families sheltering in the camps have lost their kitchens along with their homes. A food pack is no use without somewhere to cook it.',
      'A hot meal has to be eaten the day it is made, so it only happens where somebody is standing there to cook it and hand it out.',
    ],
    delivery: ['Meals are cooked and handed out in the camps by people on the ground.', PATTERN],
    proof: [],
    /* $10 a meal: the Gaza meal price on the old alanwaar.group shop. See the
       figures note in give-data.ts; confirm it is still the price. */
    ladder: [
      { value: 30, label: 'Three hot meals' },
      { value: 100, label: 'Ten hot meals' },
      { value: 250, label: 'Twenty-five hot meals' },
    ],
  },
  'food-pack-lebanon': {
    band: 'hero-lebanon',
    bandPosition: '55% 35%',
    need: [
      'Families in Lebanon are still struggling to put food on the table, and our partner in Tripoli is distributing food packs this week.',
    ],
    delivery: [
      'We have worked in Lebanon since 2023: food packs, clean water and Eid clothes for children, handed over by our partner in Tripoli.',
      PATTERN,
    ],
    proof: [],
  },
  'yemen-food-relief': {
    /* A food handover in a desert village — Esmat Sediqi, pexels.com/photo/25600494,
       Pexels License. It replaced hero-yemen, a view of a mud-brick town, which
       said where and not what; the home banner (HomeAppeals) shows this beside
       the appeal's words, and a townscape there read as tourism. Stock, and the
       place is not Yemen: nothing captions it. */
    band: 'food-aid',
    bandPosition: '45% 50%',
    need: [
      'Food relief was the first work Al-Anwaar ever did: food baskets packed and handed over in Tarim, Hadhramaut, in 2021.',
      'Monthly food packs are still at the centre of our work in Yemen, alongside the water stations and the Tarim school.',
    ],
    delivery: [
      'Food packages across Yemen are delivered with Alaf Foundation for Development, our partner since 2022. We photograph their banner at every handover rather than crop it out, because we do not deliver anonymously.',
      PATTERN,
    ],
    proof: [
      TARIM_BASKETS,
      {
        src: '/assets/images/PHOTO-2022-06-05-00-56-50.webp',
        alt: 'A family beside a Ramadan food package and the Yemen Appeal banner',
        what: 'Ramadan food packages',
        place: 'Yemen',
        when: '2022',
        position: '50% 45%',
      },
      {
        src: '/assets/images/food-pack-yemen.webp',
        alt: 'A food pack laid out: basmati rice, flour, sugar, cooking oil and tinned goods',
        what: 'What goes in a pack',
        place: 'Yemen',
      },
    ],
  },
  'water-stations-yemen': {
    band: 'hero-water',
    bandPosition: '62% 55%',
    need: [
      'Where there is no running water, a tanker run fills every container in a street, and then the street waits for the tanker to come back.',
      'A water station changes that. The next fill is close enough to carry home, and the tanker does not have to come as often.',
    ],
    delivery: [
      'Water followed our Yemen food appeal in 2022: tanker distributions first, then the standing water stations that followed.',
      PATTERN,
    ],
    proof: [
      {
        src: '/assets/images/PHOTO-2022-04-26-22-10-27.webp',
        alt: 'Children filling jerry cans from a water truck',
        what: 'Water by the tanker',
        place: 'Yemen',
        when: '2022',
        position: '50% 60%',
      },
      {
        src: '/assets/images/PHOTO-2022-05-01-00-52-12.webp',
        alt: 'Families filling jerry cans and buckets from a water tank',
        what: 'Everyone brings a can',
        place: 'Yemen',
        when: '2022',
      },
      {
        src: '/assets/images/water-station.webp',
        alt: 'Jerry cans being filled from a standing tap',
        what: 'A water station',
        place: 'Yemen',
      },
    ],
  },
  'gambia-masjid': {
    band: '/assets/images/PHOTO-2022-07-29-10-21-12.webp',
    bandPosition: '72% 62%',
    need: [
      'A village in The Gambia had nowhere to pray together. The masjid, and a Quran school beside it, was the first sadaqah jariyah Al-Anwaar took on.',
      'A food pack feeds a family for a month. A building is still there in thirty years.',
    ],
    delivery: [
      'The masjid is built on behalf of a donor whose dedication is on the wall, under the Al-Anwaar Masjid Building Project banner.',
      PATTERN,
    ],
    proof: [
      {
        src: '/assets/images/PHOTO-2022-07-29-10-21-12.webp',
        alt: 'A masjid under construction, block walls up and the roof line begun',
        what: 'The walls going up',
        place: 'The Gambia',
        when: 'July 2022',
        position: '72% 62%',
      },
    ],
  },
  'tarim-school': {
    band: 'hero-classroom',
    bandPosition: '58% 50%',
    need: [
      'A high school in Tarim, Hadhramaut, needs finishing: a new level, new classrooms, and the essential facilities its students should already have.',
      'It is the town where Al-Anwaar made its first distribution, and a school is the kind of gift that keeps teaching long after it is built.',
    ],
    delivery: [
      'The project upgrades and completes an existing school: a new level, new classrooms, essential facilities and better infrastructure.',
      PATTERN,
    ],
    proof: [],
  },
}
