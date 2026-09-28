/* ---------------------------------------------------------------------------
   The Zakat page, as data. Every word and every figure the five sections in
   src/sections/Zakat*.tsx print lives here, the way contact-data.ts holds the
   contact page's. None of those files carries copy of its own.

   THREE KINDS OF THING IN HERE, and they are edited under different rules:

     1. SETTLED — the nisab weights, the 2.5% rate, the verse and the eight
        categories of 9:60. Not ours to change. Correct them only against a
        source, never to make the page read better.

     2. OURS, DECIDED — the commitments in POLICY that the home page and the
        About page already make in public: zakat in its own ledger, nothing out
        of it for running costs, only the eight categories. Change them in all
        three places or none.

     3. OURS, NOT YET DECIDED — marked TODO where they sit: the metal prices,
        the policy's adoption date, the programmes that take zakat, and the
        zakat al-fitr amount. Each one is on the page in a form that does not
        pretend to be settled.
--------------------------------------------------------------------------- */

/* ---------- the verse in the hero ----------
   Ar-Rum 30:39, the second half of the ayah (the first half is about riba).
   Arabic: the Tanzil "simple" text, fetched from api.alquran.cloud on
   15 September 2026 rather than typed, so the harakat are the mushaf's. The
   simple script, not the Uthmani, because IBM Plex Sans Arabic does not carry
   the Uthmani small high marks and they rendered as boxes.
   English: Saheeh International, word for word, including "countenance".

   TODO before launch: the board, or the imam the board takes advice from,
   approves this translation for the site. If a different one is chosen, change
   the English here and in POLICY.verse together. */
export const VERSE = {
  arabic: 'وَمَا آتَيْتُمْ مِنْ زَكَاةٍ تُرِيدُونَ وَجْهَ اللَّهِ فَأُولَٰئِكَ هُمُ الْمُضْعِفُونَ',
  english: 'But what you give in zakah, desiring the countenance of Allah, those are the multipliers.',
  cite: 'Ar-Rum 30:39',
  translation: 'Saheeh International',
}

/* ---------- the rule ---------- */

/** The two thresholds, in grams because grams do not go stale. Same figures
 *  as HomeZakat's. */
export const NISAB = {
  goldGrams: 87.48,
  silverGrams: 612.36,
  rate: 0.025,
}

/** What a gram is worth, in AUD, for turning the weights into dollars.
 *
 *  TODO — THESE ARE PLACEHOLDERS, NOT A QUOTE. There is no live price feed, and
 *  both numbers were put in to build the calculator against. Before launch
 *  either (a) somebody sets them from the Perth Mint's published price and
 *  updates `setOn`, on a schedule the team will actually keep, or (b) a feed
 *  replaces this object. The calculator lets the giver type today's price over
 *  them, and says it is an estimate, so a stale figure is visible rather than
 *  silently wrong — but it is still wrong. */
export const METAL_PRICE = {
  goldPerGram: 165,
  silverPerGram: 1.85,
  setOn: '15 September 2026',
}

/* Reading what somebody typed into an amount field. Shared by the calculator
   on this page and the quick estimate on the home page, so the two can never
   disagree about what "$1,200" means. */
/** "1,250.50" or "$1250" in, 1250.5 out. Anything unreadable counts as zero,
 *  so a half-typed field never turns the total into NaN. */
export const toNumber = (raw: string) => {
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Lets through digits, commas and one point, so a pasted "$1,200.00" survives
 *  and a letter does not. */
export const clean = (raw: string) => raw.replace(/[^0-9.,]/g, '').replace(/(\..*)\./g, '$1')

/* ---------- the calculator ----------
   Three steps since 16 September 2026, at the user's request (modelled on the
   Liverpool Islamic Centre's calculator): what you own, what you owe, your
   zakat. `key` is the field's name in state and must stay unique. A field with
   `metal` takes a weight in grams OR a dollar value, and the weight wins when
   both are filled.

   `info` is the text of the small (i) beside each label, added 28 September
   2026 at the client's request. It is written for somebody who has never
   worked out zakat before: what counts under this heading, and the one rule
   that applies to it, in a sentence or two. It is guidance, not a ruling, and
   the calculator already says to ask a scholar about anything complicated. */
export type CalcField = { key: string; label: string; hint: string; info: string; metal?: 'gold' | 'silver' }

export const CALC_HOLD: CalcField[] = [
  {
    key: 'cash',
    label: 'Cash and savings',
    hint: 'Every bank account, savings, and cash at home.',
    info: 'All the money you have: cash at home, everyday and savings accounts, term deposits and money in apps like PayPal. Zakat is 2.5% of it once your total wealth has stayed above the nisab for a full lunar year.',
  },
  {
    key: 'gold',
    label: 'Gold',
    hint: 'Coins, bars, and jewellery kept as savings.',
    info: 'Gold coins, bars and gold jewellery you keep as savings. Enter the weight in grams or what it would sell for today. Many scholars say jewellery worn regularly is exempt, while others count it, so follow the view you trust.',
    metal: 'gold',
  },
  {
    key: 'silver',
    label: 'Silver',
    hint: 'Coins, bars, and silver kept as savings.',
    info: 'Silver coins, bars and silver items kept as savings. Enter the weight in grams or its value today. Silver is also one of the two measures for the nisab, which is 612.36g of silver.',
    metal: 'silver',
  },
  {
    key: 'shares',
    label: 'Shares and investments',
    hint: 'Their market value on the day your zakat is due.',
    info: 'Shares, managed funds, ETFs and crypto you hold. Count what they would sell for on the day your zakat falls due. Shares you bought to trade count in full, and scholars differ on long-term holdings, so ask if unsure.',
  },
  {
    key: 'business',
    label: 'Business stock',
    hint: 'Goods held for sale, and the business’s cash.',
    info: 'If you run a business: the goods you have for sale, valued at what they would sell for, plus the business’s cash. Buildings, machines and equipment the business uses are not counted.',
  },
  {
    key: 'owed',
    label: 'Money owed to you',
    hint: 'Loans you have made and expect to be repaid.',
    info: 'Money you have lent to someone and expect to get back. Count it if you are confident it will be repaid. A debt you doubt you will ever see is not counted until you actually receive it.',
  },
]

export const CALC_LEAVE_OUT =
  'Leave out the home you live in, your car, furniture and clothes, and the tools you work with.'

export const CALC_OWE: CalcField[] = [
  {
    key: 'debts',
    label: 'Short-term debts',
    hint: 'Bills due now, credit card balances, and this year’s loan repayments.',
    info: 'Debts you have to pay now are taken off your wealth before zakat is worked out: bills that are due, credit card balances, and the repayments due this year. The rest of a mortgage or long-term loan is not taken off.',
  },
]

/* ---------- the policy ---------- */

/** TODO before launch: the board adopts these, and `adopted` becomes the date
 *  it did. Until then the page says in so many words that it is a draft. */
export const POLICY = {
  adopted: null as string | null,
  /** The first stop on the section's path, before the three commitments. */
  start: {
    title: 'You give your zakat.',
    body: 'On this page, or through any of our appeals. Tell us it is zakat and it is kept as zakat.',
  },
  commitments: [
    {
      title: 'It sits in a ledger of its own.',
      body: 'Zakat is never mixed with general donations, so it can only ever be spent as zakat.',
    },
    {
      title: 'None of it runs the charity.',
      body: 'No salaries, no office, no cost of collecting it. Those come out of general sadaqah.',
    },
    {
      title: 'It goes only to the eight.',
      body: 'Every dollar reaches one of the categories the Qur’an names, and nobody else.',
    },
  ],
  verse: {
    english:
      'Zakah expenditures are only for the poor and for the needy and for those employed to collect [zakah] …',
    cite: 'At-Tawbah 9:60',
  },
  /* In the order of the ayah. `ours: false` is the one we decline. The plain
     glosses are deliberately short: four, five and seven carry real scholarly
     discussion, and a line on a charity's website is not the place to settle
     it. */
  categories: [
    { ar: 'الفقراء', name: 'The poor', gloss: 'Those without enough to live on.' },
    { ar: 'المساكين', name: 'The needy', gloss: 'Those whose income does not meet their needs.' },
    {
      ar: 'العاملين عليها',
      name: 'Those who collect it',
      gloss: 'We don’t take this share.',
      ours: false,
    },
    { ar: 'المؤلفة قلوبهم', name: 'Hearts to be reconciled', gloss: 'Those drawn towards the faith.' },
    { ar: 'في الرقاب', name: 'Freeing captives', gloss: 'Those held in bondage.' },
    { ar: 'الغارمين', name: 'Those in debt', gloss: 'Debts taken on for lawful needs.' },
    { ar: 'في سبيل الله', name: 'In the cause of Allah', gloss: 'As scholars define it.' },
    { ar: 'ابن السبيل', name: 'The stranded traveller', gloss: 'Away from home and without means.' },
  ] as { ar: string; name: string; gloss: string; ours?: boolean }[],
}

/* ---------- where it goes ----------
   The KINDS of work zakat pays for (the right half of
   ZakatPolicy), and where we do them. No amounts, because
   we do not yet have zakat figures by country and a page about zakat is the
   last place to round one up.

   Only work the rest of the site already describes is listed, and only work
   that is given into the hands of people who qualify. Water stations and the
   Tarim school are left off on purpose: whether zakat may pay for shared
   infrastructure is a question scholars answer differently, and they are
   funded from sadaqah.

   TODO before launch: the board confirms this list against what the zakat
   ledger has actually been spent on, and after the first Islamic year closes
   this section becomes the breakdown by country. */
export const WHERE = [
  {
    what: 'Food for families who qualify',
    detail: 'Monthly food packs, bought locally and handed over in person.',
    places: ['Yemen', 'Lebanon'],
  },
  {
    what: 'Hot meals in the camps',
    detail: 'Cooked and handed out to families who have lost their kitchens.',
    places: ['Gaza'],
  },
  {
    what: 'Emergency relief',
    detail: 'Food, water and shelter for families who have lost everything.',
    places: ['Gaza', 'Lebanon'],
  },
]

/* ---------- zakat al-fitr ----------
   $20 a head is the figure the give card on the home page already uses
   (HomeAsk.tsx, zakat-fitr). TODO: confirm it against a local fitrana ruling
   for the coming Ramadan, and change it there and here together. */
export const FITR = {
  perHead: 20,
  maxPeople: 30,
}

/* ---------- questions ----------
   Where scholars genuinely differ — jewellery, superannuation — the answer
   says so and does not pick. Same rule as HomeZakat's refusal to choose a
   nisab for the reader. TODO: an imam reads all seven before launch.
   ("When is zakat al-fitr due?" came off on 16 September 2026: the al-Fitr
   section answers it.) */
export const FAQ = [
  {
    q: 'Do you take anything out of my zakat?',
    a: 'No. Zakat is in a ledger of its own and none of it pays for running the charity. There are no salaries here, and what the rest costs comes out of general sadaqah.',
  },
  {
    q: 'Can I pay it in instalments?',
    a: 'Yes. Many people pay monthly through the year so it doesn’t fall due all at once. What matters is that the full amount has been paid by the time it is owed.',
  },
  {
    q: 'Can I give my zakat to my own family?',
    a: 'Not to the people you are already obliged to support, such as your parents, children or spouse. Other relatives who qualify are among the best people to give it to.',
  },
  {
    q: 'I missed zakat in past years. What do I do?',
    a: 'It is still owed. Work out each year as carefully as you can and pay it. If the figures can’t be found, a careful estimate is better than leaving it, and a scholar can help you arrive at one.',
  },
  {
    q: 'Does gold jewellery I wear count?',
    a: 'Scholars differ. The Hanafi school counts it; most others exempt jewellery worn regularly. Jewellery kept as savings counts in every view. Follow the scholar you trust.',
  },
  {
    q: 'What about my superannuation?',
    a: 'Scholars differ, mostly over whether money you cannot yet reach is fully yours. Some say zakat is due on it only once you can access it; others say on what you could withdraw each year. Ask a scholar you trust.',
  },
  {
    q: 'Is my zakat tax deductible?',
    a: 'Yes. Al-Anwaar is a deductible gift recipient, so donations of $2 and over are tax deductible, and your receipt comes by email.',
  },
]

/* ---------- the home page's zakat band ----------
   Since 28 September 2026 (client feedback) the home page no longer carries a
   calculator of its own, only this one line and a link to the full one on
   /zakat. See the head of sections/HomeZakat.tsx. */
export const HOME_ZAKAT_BAND = {
  eyebrow: 'Zakat',
  title: 'Work out your zakat in a few minutes.',
  body: 'Our step-by-step calculator explains each kind of wealth as you go, and nothing you type leaves the page.',
  cta: 'Open the zakat calculator',
  to: '/zakat#calculator',
}
