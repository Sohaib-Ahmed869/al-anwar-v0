import type { GiveCause, GiveChoice } from './GiveModule'

/* ---------------------------------------------------------------------------
   The funds, as data. The home page's give card (HomeAsk) and the /give page
   both read this, so the two can never disagree about a price or a ruling.

   THE NINE FUNDS ARE THE CHARITY'S OWN — READ BEFORE CHANGING THEM
   They are the list the organisation already gives under, in its own order:
   Sadaqah, Zakat ul Maal, Education, Water, Food, Zakat ul Fitr, Emergency,
   Kaffarah, Fidyah. They are not a taxonomy anybody invented here, and they are
   not three intentions plus six causes — half of them are an intention with a
   price attached by fiqh rather than by us, which is exactly why they cannot
   share one ladder.

   WHERE THE FIGURES COME FROM
   The rungs are taken from the old alanwaar.group shop, which is the only
   record of what this charity has actually charged, read off the January 2024
   and April 2025 Wayback snapshots of the homepage:

     Zakat Al Fitr           $20 flat, per head
     Zakat Al Mal            from $25
     General Sadaqa (Gaza)   from $25
     Meal Distribution       $10 a meal
     Water Stations          $350 to $2,500
     Water station upkeep    from $25
     Food Packs (Yemen)      $70

   Two things follow from that list, and both need a decision before launch:

     - The old shop priced a Yemen food pack at $70. This site says $50, in the
       headline here, in the nav's feature caption and on the appeal card, and
       the whole "a month of meals" claim rests on it. $50 is kept for now
       because it is at least consistent everywhere; if $70 is the live price it
       has to move in all four places at once, and this note goes with it.
     - $10 a meal is the Gaza meal price, and it is what the kaffarah and fidyah
       ladders are built on: sixty meals is $600, one day is $10. That is
       arithmetic on a real unit, not a costing anybody has signed off.

   THE FIQH ON THIS CARD NEEDS THE IMAM'S SIGN-OFF
   Four of these funds carry a ruling in their rungs. They are the ordinary
   mainstream readings rather than anything unusual, but they are still fiqh and
   nobody here is qualified to publish them unreviewed:

     Zakat ul Maal   owed above the nisab, payable only to the eight categories
     Zakat ul Fitr   per head of the household including children, due before
                     the Eid prayer, and handed over as food rather than cash
     Kaffarah        sixty people fed for a deliberately broken fast, ten for a
                     broken oath
     Fidyah          one person fed for each day owed, where the fast cannot be
                     made up

   A ladder carries "this buys X" labels only where somebody has costed the
   unit. Sadaqah, zakat ul maal, education and emergency are figures and nothing
   else — nobody has costed a classroom or a general fund for us, and the panel
   beside the form says what the gift is instead.

   For an amount someone types against a costed fund the line is worked out from
   that fund's own unit and rounds down; under one unit it stops counting rather
   than inventing a fraction of one.

   PHOTOGRAPHY — READ BEFORE LAUNCH
   Every frame is licensed stock, and the frame changes with the fund, because a
   gift of food, a gift of water and a gift to a build are not the same picture.

     give-children  "Smiling Children Making Gestures Posing Outdoors", irwan
                    zahuri, taken in Tarim, Hadhramaut Governorate, Yemen —
                    pexels.com/photo/14927253, Pexels License: commercial use,
                    no attribution required. It replaced one of Al-Anwaar's own
                    frames, which was 607px square and could not carry half a
                    card at this size.
     hero-classroom the same file the education slide of the home hero uses,
                    and the same file HomeAppeals puts on the Tarim card. There
                    is no photograph of the Tarim school in the repo; this is
                    framed as a classroom and nothing here says otherwise.
     hero-water     the water slide of the home hero.
     hero-meal      the food slide of the home hero.

   All of it being stock is why this section has no caption: nothing on the card
   says who these children are, where they are or what they were given, and
   nothing should start to. The panel beside them describes the gift, not the
   photograph. Swap in frames of the field team's own the moment there are any
   at 2400px.
--------------------------------------------------------------------------- */

/* ---------- the verse in the hero ----------
   Al-Baqarah 2:261, the simile only — the ayah runs on "And Allah multiplies
   [His reward] for whom He wills. And Allah is all-Encompassing and Knowing."
   The citation says 2:261 rather than pretending the part is the whole, which
   is the same rule ZakatHero follows with Ar-Rum 30:39 (see zakat-data.ts).

   This is the Qur'an's own picture of a gift multiplied, which is why it is on
   the page that asks for one and not on the zakat page.

   Arabic: the Tanzil "simple" text, fetched from api.alquran.cloud on
   16 September 2026 rather than typed, so the harakat are the mushaf's. The
   simple script, not the Uthmani, because IBM Plex Sans Arabic does not carry
   the Uthmani small high marks and they render as boxes.
   English: Saheeh International, word for word, from the same call.

   TODO before launch: the board, or the imam the board takes advice from,
   approves this translation and this partial quotation for the site. If a
   different translation is chosen it changes here and in zakat-data.ts
   together, so the site does not quote two different Englishes. */
export const VERSE = {
  arabic:
    'مَثَلُ الَّذِينَ يُنْفِقُونَ أَمْوَالَهُمْ فِي سَبِيلِ اللَّهِ كَمَثَلِ حَبَّةٍ أَنْبَتَتْ سَبْعَ سَنَابِلَ فِي كُلِّ سُنْبُلَةٍ مِائَةُ حَبَّةٍ',
  english:
    'The example of those who spend their wealth in the way of Allah is like a seed [of grain] which grows seven spikes; in each spike is a hundred grains.',
  cite: 'Al-Baqarah 2:261',
  translation: 'Saheeh International',
}

/** What one unit of a fund's work costs, and how to say n of them. Only the
 *  funds with a real, quoted unit price have one. */
type Unit = { price: number; say: (n: number) => string }

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/* ---------------------------------------------------------------------------
   MONTHLY GIVING IS NOT OFFERED ON EVERY FUND, AND THAT IS DELIBERATE
   (added 16 September 2026, with the hero's Monthly tab)

   Four of the nine funds are an obligation with its own timing, and a standing
   monthly instruction is the wrong shape for all four:

     Zakat ul Maal   owed once a year, on the wealth you still hold when the
                     hawl completes. A fixed monthly amount is a guess at a
                     figure that is meant to be calculated. /zakat is where
                     that calculation belongs, not a subscription.
     Zakat ul Fitr   due once, per head, before the Eid prayer.
     Kaffarah        a fixed expiation for a specific broken fast or oath. It
                     is discharged and then it is over.
     Fidyah          one person fed per day owed. Also finite.

   So `monthly` is opt-in and only the five voluntary funds carry it. The form's
   For step disables the other four while Monthly is chosen and says why on the
   tile, and services/give.ts refuses the combination again on the way to the
   payment, rather than quietly taking a standing order for something nobody
   should be paying monthly.

   THIS IS FIQH AND IT NEEDS THE IMAM'S SIGN-OFF, like everything else in the
   rungs above. It is the ordinary mainstream reading, not an unusual one, but
   it is still a ruling and nobody here is qualified to publish it unreviewed.

   THE RUNGS THEMSELVES are smaller than the one-time ones, because a monthly
   instalment is not a one-time gift, and the food fund's are its real unit:
   $50 a month is one family fed for that month, every month.
--------------------------------------------------------------------------- */

/** A fund as the form needs it, plus the head of the band that belongs to it,
 *  the photograph that belongs to it, and the arithmetic the panel does
 *  against it. */
export type Cause = GiveCause & {
  /** the band's headline while this fund is chosen */
  title: string
  /** the file stem under /assets/images, at 1200w and 2400w */
  photo: string
  /** what is visible in the frame, and no more */
  alt: string
  /** how to frame it once the column is taller than the picture is */
  position: string
  /** absent where the work has no costed unit; then `standing` is used at
   *  every amount */
  unit?: Unit
  /** what the panel says for a fund with no unit, at any amount */
  standing: string
  /** the rungs a standing monthly gift offers. ABSENT where the fund is an
   *  obligation with its own timing and cannot sensibly be given monthly —
   *  see the note above. */
  monthly?: number[]
}

/** Can this fund be given monthly at all? The hero and the form both ask. */
export const takesMonthly = (c: Cause) => !!c.monthly

/** A rung on whichever ladder is showing. */
export type Rung = { value: number; label?: string }

/** The ladder for a fund at a frequency, so the hero's card and the form's
 *  Amount step can never offer different rungs for the same gift.
 *
 *  The one-time ladders carry the charity's own words ("One water station").
 *  The monthly ones are worked out from the fund's costed unit and stay bare
 *  where there isn't one — the same rule impactOf follows, and for the same
 *  reason: a rung never claims something nobody has priced. */
export const rungsFor = (cause: Cause, frequency: 'once' | 'monthly'): Rung[] => {
  if (frequency === 'once') return cause.amounts
  return (cause.monthly ?? []).map((value) => {
    const u = cause.unit
    const n = u ? Math.floor(value / u.price) : 0
    return { value, label: u && n >= 1 ? u.say(n) : undefined }
  })
}

/* The four frames, so a fund names one rather than repeating its alt text. */
const CHILDREN = {
  photo: 'give-children',
  alt: 'Children outside a mudbrick house, laughing and holding their hands up to the camera',
  position: '50% 38%',
}
const CLASSROOM = {
  photo: 'hero-classroom',
  alt: 'A class of girls at their desks, seen through a broken window',
  position: '58% 50%',
}
const WATER = {
  photo: 'hero-water',
  alt: 'A child drinking from a hand pump, cupped hands under the spout',
  position: '62% 55%',
}
const MEAL = {
  photo: 'hero-meal',
  alt: 'Children sitting along a mat sharing a meal, terracotta walls behind them',
  position: '62% 52%',
}

export const CAUSES: Cause[] = [
  {
    id: 'sadaqah',
    label: 'Sadaqah',
    arabic: 'صدقة',
    note: 'Voluntary, any amount, at any time. It goes wherever the need is shortest.',
    appeal: 'the sadaqah fund',
    slug: 'general-sadaqah',
    place: 'the people it is for',
    amounts: [{ value: 25 }, { value: 100 }, { value: 250 }],
    monthly: [10, 25, 50],
    standing: 'Wherever the need is greatest',
    title: 'Any amount, any day, any reason.',
    ...CHILDREN,
  },
  {
    id: 'zakat',
    label: 'Zakat ul Maal',
    arabic: 'زكاة المال',
    note: 'Obligatory above the nisab, and passed on in full to those who qualify.',
    appeal: 'the zakat fund',
    slug: 'zakat-al-mal',
    place: 'those who qualify',
    amounts: [{ value: 50 }, { value: 250 }, { value: 1000 }],
    standing: 'Distributed in full, to those who qualify',
    title: 'The part of it that was never yours.',
    ...CHILDREN,
  },
  {
    id: 'education',
    label: 'Education Project',
    note: 'Classrooms, and the high school being completed in Tarim.',
    appeal: 'the education project',
    slug: 'tarim-school',
    place: 'the school in Tarim',
    amounts: [{ value: 100 }, { value: 250 }, { value: 500 }],
    monthly: [25, 50, 100],
    standing: 'A school in Tarim, for as long as it teaches',
    title: 'Give once. Keep giving for forty years.',
    ...CLASSROOM,
  },
  {
    id: 'water',
    label: 'Water Project',
    note: 'Stations sunk in Yemen, and the upkeep that keeps them running.',
    appeal: 'the water project',
    slug: 'water-stations-yemen',
    place: 'Yemen',
    amounts: [
      { value: 50, label: 'Towards the next station' },
      { value: 350, label: 'One water station' },
      { value: 700, label: 'Two water stations' },
    ],
    unit: { price: 350, say: (n) => plural(n, 'water station', 'water stations') },
    monthly: [25, 50, 100],
    standing: 'Towards the next water station',
    title: 'The best charity is giving water.',
    ...WATER,
  },
  {
    id: 'food',
    label: 'Food Project',
    note: 'Food packs in Yemen and hot meals in Gaza, bought and handed over locally.',
    appeal: 'the food project',
    slug: 'yemen-food-relief',
    place: 'Yemen',
    amounts: [
      { value: 50, label: 'One family, one month' },
      { value: 150, label: 'Three families, one month' },
      { value: 300, label: 'Six families, one month' },
    ],
    unit: { price: 50, say: (n) => `${plural(n, 'family', 'families')}, one month` },
    /* the fund's own unit: $50 a month is one family fed, every month */
    monthly: [50, 100, 150],
    standing: 'Towards a family’s month of meals',
    title: 'Fifty dollars is a month of meals.',
    ...MEAL,
  },
  {
    id: 'zakat-fitr',
    label: 'Zakat ul Fitr',
    arabic: 'زكاة الفطر',
    note: 'Owed per person in the household, and given as food before the Eid prayer.',
    appeal: 'zakat ul fitr',
    slug: 'zakat-al-fitr',
    place: 'families before Eid',
    amounts: [
      { value: 20, label: 'One person' },
      { value: 80, label: 'A family of four' },
      { value: 200, label: 'Ten people' },
    ],
    unit: { price: 20, say: (n) => `${plural(n, 'person', 'people')}, before Eid` },
    standing: 'Given as food, before the Eid prayer',
    title: 'Paid per head, before the prayer.',
    ...MEAL,
  },
  {
    id: 'emergency',
    label: 'Emergency Project',
    note: 'Held unspent, so the first response does not wait on an appeal.',
    appeal: 'the emergency project',
    slug: 'emergency-response',
    place: 'the next emergency',
    amounts: [{ value: 50 }, { value: 150 }, { value: 500 }],
    monthly: [10, 25, 50],
    standing: 'Ready before the next crisis',
    title: 'The money that is already there.',
    ...CHILDREN,
  },
  {
    id: 'kaffarah',
    label: 'Kaffarah',
    arabic: 'كفّارة',
    note: 'Expiation for a fast or an oath broken, given as meals.',
    appeal: 'kaffarah',
    slug: 'kaffarah',
    place: 'the people fed',
    amounts: [
      { value: 100, label: 'An oath: ten people' },
      { value: 600, label: 'A fast: sixty people' },
      { value: 1200, label: 'Two fasts' },
    ],
    unit: { price: 10, say: (n) => plural(n, 'meal', 'meals') },
    standing: 'Meals, given on your behalf',
    title: 'Sixty people fed, in one payment.',
    ...MEAL,
  },
  {
    id: 'fidyah',
    label: 'Fidyah',
    arabic: 'فدية',
    note: 'For a fast that cannot be made up: one person fed for each day owed.',
    appeal: 'fidyah',
    slug: 'fidyah',
    place: 'the people fed',
    amounts: [
      { value: 10, label: 'One day' },
      { value: 150, label: 'Fifteen days' },
      { value: 300, label: 'A whole Ramadan' },
    ],
    unit: { price: 10, say: (n) => `${plural(n, 'day', 'days')} covered` },
    standing: 'Meals, one for each day owed',
    title: 'One person fed for every day missed.',
    ...MEAL,
  },
  /* QURBANI, added 17 September 2026 with the /dhul-hijjah page. Not one of
     the nine on the old shop's list, but the charity's own: the 26 May 2025
     Instagram poster (ig-qurban-yemen-2025.webp, HomeSocial) sells "2025
     Qurban Yemen" at $250, with a sheep on it. So one share is one sheep in
     Yemen at $250.
     TODO before Dhul Hijjah 1448: the office confirms the 2027 price and that
     a share is still one sheep. It is owed once, so no monthly ladder.
     Photograph: "Flock of sheep grazing on rocky hillside", Anastasija,
     pexels.com/photo/33103868, Pexels License. Stock, not Yemen, and never
     captioned. */
  {
    id: 'qurbani',
    label: 'Qurbani',
    arabic: 'أضحية',
    note: 'One sheep sacrificed in Yemen after the Eid prayer, and the meat given to families.',
    appeal: 'Qurbani',
    slug: 'qurbani',
    place: 'families in Yemen',
    amounts: [
      { value: 250, label: 'One share' },
      { value: 500, label: 'Two shares' },
      { value: 1250, label: 'Five shares' },
    ],
    unit: { price: 250, say: (n) => plural(n, 'Qurbani share', 'Qurbani shares') },
    standing: 'Towards a Qurbani share in Yemen',
    title: 'One share, given on the day of Eid.',
    photo: 'hero-qurbani-sheep',
    alt: 'A flock of sheep grazing on a rocky hillside in evening light',
    position: '50% 45%',
  },
]

export const money = (v: number) => '$' + v.toLocaleString('en-AU', { maximumFractionDigits: 2 })

/** The rung's own words where there is a rung, the same arithmetic done
 *  honestly where there is not, and the fund's standing line where the work has
 *  no unit to divide by. */
export const impactOf = ({ amount, impact, cause }: GiveChoice) => {
  if (impact) return impact
  const { unit, standing } = cause as Cause
  if (!unit) return standing
  const n = Math.floor(amount / unit.price)
  return n < 1 ? standing : unit.say(n)
}

/* ---------------------------------------------------------------------------
   Everything below is the /give page's own.
--------------------------------------------------------------------------- */

/** The smallest gift the form takes: the smallest that can carry a deductible
 *  receipt, per /terms. */
export const MIN_GIFT = 2

/** Links around the site name a place or an appeal rather than a fund —
 *  the home hero's "Donate to Gaza" sends ?country=gaza, its hot-meals slide
 *  ?appeal=meals. Each is resolved to the fund that pays for that work, and the
 *  place is kept on the gift so the donor still sees where they chose to give.
 *
 *  TODO before launch: the finance side confirms these four mappings match
 *  how the ledger actually books Gaza, Yemen and Lebanon gifts. */
export const APPEALS: Record<string, { fund: string; label: string }> = {
  gaza: { fund: 'emergency', label: 'Gaza' },
  meals: { fund: 'food', label: 'Hot meals in Gaza' },
  yemen: { fund: 'food', label: 'Yemen' },
  lebanon: { fund: 'emergency', label: 'Lebanon' },
}

/** Read off the charity's own Tarim school flyer
 *  (public/assets/images/WhatsApp-Image-2026-07-21-at-14.36.36.jpeg), which
 *  prints them under "Donate now". The client confirmed on 15 September 2026
 *  that they can go on the site. BSB 062-xxx is a Commonwealth Bank branch.
 *  TODO: the name on the flyer is "Al Anwaar Charity Org"; check it is exactly
 *  the account name the bank holds, or transfers can be flagged. */
export const BANK = {
  name: 'Al Anwaar Charity Org',
  bsb: '062-141',
  account: '1048 6594',
}

export const TRUST = [
  {
    title: 'Registered with the ACNC',
    body: 'A public benevolent institution, on the national charity register since 2020.',
    to: '/where-it-goes#accounts',
  },
  {
    title: 'Tax deductible',
    body: 'We are a deductible gift recipient. Gifts of $2 and over can be claimed.',
  },
  {
    title: 'Zakat, passed on whole',
    body: 'Kept in its own ledger. None of it pays for running the charity.',
    to: '/zakat#policy',
  },
  {
    title: 'Your card stays with the bank',
    body: 'You pay on Stripe’s or PayPal’s own secure page. Your card never reaches our site.',
  },
] as { title: string; body: string; to?: string }[]

/* TODO: an answer about receipts depends on the payment setup doing what
   api/checkout.ts says it should — check both once it is live.
   Five questions, cut from seven on 16 September 2026: "is paying online
   safe?" went (the pay step and the summary panel both say it), and the two
   monthly questions became one. */
export const GIVE_FAQ = [
  {
    q: 'Is my gift tax deductible?',
    a: 'Yes. Al-Anwaar is a deductible gift recipient, so gifts of $2 and over are tax deductible. Your receipt is the record to keep for your return.',
  },
  {
    q: 'When does my receipt arrive?',
    a: 'By email, as soon as the payment goes through. If it hasn’t arrived within an hour, check your spam folder and then write to us.',
  },
  {
    q: 'Can I give monthly, and how do I stop?',
    a: 'Yes, on the voluntary funds: sadaqah, education, water, food and the emergency fund. Choose Monthly on the first step of the form. It is charged to your card on the same date each month. To stop it, write to us and nothing more is taken; there is no minimum number of months and no fee. Zakat, zakat ul fitr, kaffarah and fidyah are not offered monthly: each is owed once, for a particular reason, and a standing order is the wrong shape for them.',
  },
  {
    q: 'How is my zakat handled?',
    a: 'It goes into a ledger of its own and is spent only on the people zakat is owed to. None of it pays for running the charity.',
  },
  {
    q: 'I made a mistake with my gift. Can I get a refund?',
    a: 'Tell us within 30 days if you were charged the wrong amount, charged twice, or your card was used without permission, and we will refund it to the same card or account.',
  },
]
