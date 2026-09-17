import { CAUSES, type Cause } from './give-data'

/* ---------------------------------------------------------------------------
   The two seasonal campaign pages, as data: /ramadan and /dhul-hijjah.
   Built 17 September 2026, from the proposal's "Seasonal campaigns" line: the
   pages and the amounts are ready before the season, so on the night nobody is
   putting a page together.

   SWITCHING A SEASON ON
   `live` is the one switch. Off, the page still stands (it is found in search
   all year) but it says when the season is expected, and anything that can
   only be given in the season (`inSeason` below: zakat al-Fitr, Qurbani) shows
   the opening date instead of a Donate button. On, those buttons appear, and
   the hero shows its gold button. Nothing else changes.

   THE DATES follow the moon. They are the Umm al-Qura conversions for 1448 AH
   (api.aladhan.com, hToG, fetched 17 September 2026), so each may land a day
   either side once the moon is sighted in Australia. The page says so.
   TODO each year: move the eyebrow, `closedLine` and every `when` on, and confirm with the imam.

   THE VERSES were fetched from api.alquran.cloud (Tanzil simple script,
   Saheeh International) on 17 September 2026, never typed, the same rule as
   zakat-data.ts and give-data.ts. Al-Hajj 22:37 is quoted to its first stop
   (the ۚ mark) and cited as the ayah, the way 2:261 is on /give.

   THE FIQH (the order of the days, zakat al-Fitr before the prayer, the ten
   days, the days of sacrifice) is the ordinary mainstream reading, and where
   the schools differ the answer says so. TODO: the imam signs off, like the
   rest of the site's rulings.
--------------------------------------------------------------------------- */

export type SeasonKey = 'ramadan' | 'dhul-hijjah'

/** One way to give, drawn as a card. The price is a rung of the fund's own
 *  ladder in give-data.ts, so the card and the form never disagree. */
export type SeasonWay = {
  fund: string
  /** which rung of the fund's one-time ladder to quote; the first by default */
  rung?: number
  /** the card's one line: why this, in this season */
  line: string
  /** only payable in the season itself, so hidden until `live` */
  inSeason?: boolean
  /** a second, plain link under the button */
  more?: { label: string; to: string }
  /** the heading this way is listed under; a new one starts where it changes */
  group: string
}

export type SeasonDay = {
  /** short, as it sits over the day */
  when: string
  /** the same day in the Hijri month, as the card prints it */
  hijri: string
  /** where the day sits on the month strip: a day of the Hijri month, where
   *  one past the last cell is the day after the month ends (Eid al-Fitr) */
  at: number
  title: string
  body: string
}

/** The month strip SeasonDays draws: one cell per day of the Hijri month, a
 *  band over the days that matter most, and small marks on single nights. */
export type SeasonTrack = {
  /** the Hijri month, under the strip's first cell */
  month: string
  cells: number
  band: { from: number; to: number; label: string }
  /** the days after the band, drawn fainter (the days of tashreeq) */
  tail?: { from: number; to: number; label: string }
  /** single nights marked with a small moon (the odd nights) */
  marks?: number[]
  marksLabel?: string
}

export type Season = {
  key: SeasonKey
  path: string
  live: boolean
  /** script eyebrow over the title */
  eyebrow: string
  title: string
  /** when the season is expected, for the ways panel while `live` is off */
  closedLine: string
  /** when the season-only ways open, for the cards while `live` is off */
  opens: string
  photo: { stem: string; widths: [number, number]; position: string }
  verse: { arabic: string; english: string; cite: string }
  /** the hero's gold button */
  lead: { fund: string; label: string }
  ways: { eyebrow: string; title: string; lede: string; items: SeasonWay[] }
  days: { eyebrow: string; title: string; lede: string; track: SeasonTrack; items: SeasonDay[] }
  appeals: { eyebrow: string; title: string; lede: string; slugs: string[] }
  faq: { q: string; a: string }[]
}

export const RAMADAN: Season = {
  key: 'ramadan',
  path: '/ramadan',
  live: false,
  eyebrow: 'Ramadan 1448',
  title: 'Give through Ramadan, and in the last ten nights.',
  closedLine:
    'The first fast of Ramadan is expected around 8 February 2027. Dates follow the moon and may move by a day.',
  opens: 'Opens in Ramadan',
  /* A Qur'an on a prayer mat: Unsplash photo-1609599006353-e629aaabfeae,
     served from images.unsplash.com (free Unsplash License, not Unsplash+),
     the image the user pointed to on calcite.charities.ltd/Ramadan on 17
     September 2026. Replaced event-iftar. TODO: record the photographer's
     name from its Unsplash page. Stock, so never captioned. */
  photo: { stem: 'hero-ramadan-quran', widths: [1200, 2400], position: '50% 45%' },
  verse: {
    arabic: 'لَيْلَةُ الْقَدْرِ خَيْرٌ مِنْ أَلْفِ شَهْرٍ',
    english: 'The Night of Decree is better than a thousand months.',
    cite: 'Al-Qadr 97:3',
  },
  lead: { fund: 'sadaqah', label: 'Give this Ramadan' },
  ways: {
    eyebrow: 'Ways to give',
    title: 'What you can give this Ramadan.',
    lede: 'Each one goes to its own fund, at the same amounts as the rest of the year.',
    items: [
      {
        fund: 'zakat',
        line: 'Many people pay their zakat in Ramadan. Work out what you owe first.',
        more: { label: 'Calculate your zakat', to: '/zakat#calculator' },
        group: 'What you owe',
      },
      {
        fund: 'zakat-fitr',
        line: 'Owed for every person in your household, and handed over as food before the Eid prayer.',
        inSeason: true,
        more: { label: 'Work it out for your household', to: '/zakat#fitr' },
        group: 'What you owe',
      },
      { fund: 'fidyah', line: 'For a fast you cannot make up: one person fed for each day.', group: 'What you owe' },
      { fund: 'kaffarah', rung: 1, line: 'For a fast broken on purpose: sixty people fed.', group: 'What you owe' },
      { fund: 'food', line: 'A month of food for one family, bought locally and handed over in Yemen.', group: 'What you choose to give' },
      { fund: 'sadaqah', line: 'Any amount, on any night, sent where the need is shortest.', group: 'What you choose to give' },
    ],
  },
  days: {
    eyebrow: 'The month',
    title: 'The days that matter.',
    lede: 'Expected dates for Ramadan 1448. Each follows the moon, so it may land a day either side.',
    track: {
      month: 'Ramadan',
      cells: 30,
      band: { from: 21, to: 30, label: 'The last ten nights' },
      marks: [21, 23, 25, 27, 29],
      marksLabel: 'The odd nights',
    },
    items: [
      {
        when: '7 Feb',
        hijri: 'Eve of 1 Ramadan',
        at: 1,
        title: 'The first night',
        body: 'Ramadan begins at sunset, and the first fast is the next morning.',
      },
      {
        when: '27 Feb',
        hijri: 'Eve of 21 Ramadan',
        at: 21,
        title: 'The last ten nights',
        body: 'They begin at sunset. Laylat al-Qadr is sought in these nights, most of all the odd ones.',
      },
      {
        when: 'By 8 Mar',
        hijri: '29 or 30 Ramadan',
        at: 29,
        title: 'Zakat al-Fitr',
        body: 'Give it in the last days of the month so it can reach families as food before the prayer.',
      },
      {
        when: '9 Mar',
        hijri: '1 Shawwal',
        at: 31,
        title: 'Eid al-Fitr',
        body: 'The month ends. Zakat al-Fitr given after the Eid prayer counts as ordinary sadaqah.',
      },
    ],
  },
  appeals: {
    eyebrow: 'Open appeals',
    title: 'Where Ramadan giving goes.',
    lede: 'Food first, in the places that are shortest of it.',
    slugs: ['gaza-hot-meals', 'yemen-food-relief', 'food-pack-lebanon'],
  },
  faq: [
    {
      q: 'Do I have to pay my zakat in Ramadan?',
      a: 'No. Zakat is due when a full year has passed on wealth above the nisab, whatever month that is. Many people choose a date in Ramadan so it is easy to remember each year, and that is fine as long as the date stays the same.',
    },
    {
      q: 'When should I give zakat al-Fitr?',
      a: 'Before the Eid prayer. We ask you to give it in the last days of Ramadan, so there is time to buy the food and hand it over before Eid. Scholars differ on how early it may be paid; many allow it at any point in the month.',
    },
    {
      q: 'What is the difference between fidyah and kaffarah?',
      a: 'Fidyah is for a fast you cannot make up, through long illness or old age: one person fed for each day. Kaffarah is for a fast broken on purpose without a valid reason: sixty days fasted in a row, or sixty people fed by someone who cannot fast them. The schools differ on which broken fasts need it.',
    },
    {
      q: 'Is my Ramadan gift tax deductible?',
      a: 'Yes. Al-Anwaar is a deductible gift recipient, so gifts of $2 and over can be claimed, whichever fund they go to. Your receipt is emailed as soon as the payment goes through.',
    },
  ],
}

export const DHUL_HIJJAH: Season = {
  key: 'dhul-hijjah',
  path: '/dhul-hijjah',
  live: false,
  eyebrow: 'Dhul Hijjah 1448',
  title: 'Your Qurbani, and the ten best days of the year.',
  closedLine:
    'Dhul Hijjah is expected to begin around 7 May 2027, and Qurbani booking opens before then.',
  opens: 'Opens before Dhul Hijjah',
  photo: { stem: 'hero-qurbani-sheep', widths: [1200, 2400], position: '50% 45%' },
  verse: {
    arabic: 'لَنْ يَنَالَ اللَّهَ لُحُومُهَا وَلَا دِمَاؤُهَا وَلَٰكِنْ يَنَالُهُ التَّقْوَىٰ مِنْكُمْ',
    english:
      'Their meat will not reach Allah, nor will their blood, but what reaches Him is piety from you.',
    cite: 'Al-Hajj 22:37',
  },
  lead: { fund: 'qurbani', label: 'Book your Qurbani' },
  ways: {
    eyebrow: 'Ways to give',
    title: 'What you can give in Dhul Hijjah.',
    lede: 'Qurbani is made on Eid. Everything else can be given on any of the ten days.',
    items: [
      {
        fund: 'qurbani',
        line: 'One sheep, sacrificed in Yemen after the Eid prayer. The meat goes to families there.',
        inSeason: true,
        group: 'On Eid',
      },
      { fund: 'sadaqah', line: 'Any amount on the ten days, and on the Day of Arafah.', group: 'On any of the ten days' },
      { fund: 'food', line: 'A month of food for a family, so Eid is not the only full table.', group: 'On any of the ten days' },
      { fund: 'water', rung: 1, line: 'A water station in Yemen, given once and used for years.', group: 'On any of the ten days' },
      { fund: 'emergency', line: 'Held ready, so the first response does not wait for an appeal.', group: 'On any of the ten days' },
    ],
  },
  days: {
    eyebrow: 'The ten days',
    title: 'The days that matter.',
    lede: 'Expected dates for Dhul Hijjah 1448. Each follows the moon, so it may land a day either side.',
    track: {
      month: 'Dhul Hijjah',
      cells: 13,
      band: { from: 1, to: 10, label: 'The ten days' },
      tail: { from: 11, to: 13, label: 'Tashreeq' },
    },
    items: [
      {
        when: '6 May',
        hijri: 'Eve of 1 Dhul Hijjah',
        at: 1,
        title: 'The ten days begin',
        body: 'At sunset. If you are giving a Qurbani, the practice is to leave your hair and nails uncut until it is made.',
      },
      {
        when: '15 May',
        hijri: '9 Dhul Hijjah',
        at: 9,
        title: 'The Day of Arafah',
        body: 'The pilgrims stand at Arafah. For everyone else it is a day to fast and to give.',
      },
      {
        when: '16 May',
        hijri: '10 Dhul Hijjah',
        at: 10,
        title: 'Eid al-Adha',
        body: 'The sacrifice is made after the Eid prayer, never before it.',
      },
      {
        when: '17 to 19 May',
        hijri: '11 to 13 Dhul Hijjah',
        at: 12,
        title: 'The days of tashreeq',
        body: 'Sacrifice may continue. Scholars differ on whether the last day is the 12th or the 13th.',
      },
    ],
  },
  appeals: {
    eyebrow: 'Open appeals',
    title: 'Where else your gift can go.',
    lede: 'The appeals that stay open through Eid.',
    slugs: ['gaza-emergency', 'yemen-food-relief', 'water-stations-yemen'],
  },
  faq: [
    {
      q: 'What is one share?',
      a: 'One sheep, sacrificed in Yemen. One sheep or goat is one Qurbani for one person; a cow or a camel can be shared by seven.',
    },
    {
      q: 'Can I give a Qurbani for someone else?',
      a: 'Yes. On the details step of the form, choose to give on someone’s behalf and add their name. The Qurbani is made in that name.',
    },
    {
      q: 'Who has to give a Qurbani?',
      a: 'Scholars differ. The Hanafi school holds it is required of every adult Muslim at home, not travelling, who has wealth above the nisab on the days of Eid; the other schools hold it is a strongly recommended sunnah. If you are unsure, ask a scholar you trust.',
    },
    {
      q: 'Why is the sacrifice made in Yemen?',
      a: 'It is where our partners already work, and where many families will not otherwise eat meat at Eid. The animal is bought locally and the meat handed over in the days of Eid.',
    },
  ],
}

export const SEASON_LIST: Season[] = [RAMADAN, DHUL_HIJJAH]

/** A way as drawn: the fund, its whole one-time ladder, the rung it opens
 *  on, and where a given amount goes. The hero's gold button uses the opening
 *  rung, so it quotes what the panel opens on. */
export const wayView = (w: SeasonWay) => {
  const cause = CAUSES.find((c) => c.id === w.fund) as Cause
  const start = Math.min(w.rung ?? 0, cause.amounts.length - 1)
  const rung = cause.amounts[start]
  return {
    ...w,
    cause,
    rungs: cause.amounts,
    start,
    amount: rung.value,
    per: rung.label ?? 'Give from',
    to: giveTo(cause.id, rung.value),
  }
}

export const giveTo = (fund: string, amount: number) => `/give?designation=${fund}&amount=${amount}` 