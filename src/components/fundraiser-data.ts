/* ---------------------------------------------------------------------------
   Community fundraisers: every word, and the fundraisers themselves.

   Added 17 September 2026 at the user's request, after the reference they
   named (a peer-to-peer campaigns page: browse fundraisers, start your own,
   give to one). Three pages read this file:
     /fundraisers ............ pages/Fundraisers.tsx     browse
     /fundraisers/start ...... pages/FundraiserStart.tsx  start one
     /fundraisers/<slug> ..... pages/Fundraiser.tsx       one fundraiser
   and the Get involved page's #fundraise section shows the first few.

   THE GENUINE REASON IS AN APPEAL. A fundraiser here never raises for
   "a cause" in general: the person starting it picks one of our real appeals
   (APPEAL_LIST in appeals-data.ts), and every gift made on their page is
   booked to that appeal's fund. The reason (emergency relief, clean water) is
   what they are raising for, and the appeal is exactly where it goes. That is what keeps a community page honest: the donor can
   click through to the appeal and see exactly where the money lands.

   TODO BEFORE LAUNCH: SAMPLE_FUNDRAISERS
   Every fundraiser below is INVENTED so the pages can be judged with content
   in them, the same way the appeals' raised/goal figures are placeholders.
   The organisers, totals, supporters and messages are not real people or
   real money. Empty the list (or replace it with real, consented pages)
   before the site goes live. The pages all cope with an empty list.

   HOW A NEW ONE IS STORED is in services/fundraisers.ts: until there is a
   server, a fundraiser started on this site is kept in that browser only and
   the page says so.
--------------------------------------------------------------------------- */

/* THE REASONS ARE WHAT THE MONEY IS FOR (17 September 2026). The first
   version asked for an occasion (a birthday, a run, Ramadan) and the user
   asked for reasons that belong to fundraising instead, like the cause
   categories on the reference. On screen the step is still called
   "Occasion" (user's call, same day); in the code it is `reason`. Each reason names the appeal causes it covers
   (CAUSE_FILTERS keys in appeals-data.ts), and step 2 of the start form only
   offers appeals with one of them. A reason with no open appeal is not shown.
   `title` suggests the fundraiser's title, with the appeal's place after it. */

export type Reason = 'emergency' | 'food' | 'water' | 'education' | 'jariyah' | 'memory'

export const REASONS: {
  id: Reason
  label: string
  hint: string
  causes: string[]
  title: string
}[] = [
  {
    id: 'emergency',
    label: 'Emergency relief',
    hint: 'Food, water and shelter for families caught in a crisis.',
    causes: ['emergency'],
    title: 'Emergency relief for',
  },
  {
    id: 'food',
    label: 'Feeding families',
    hint: 'Food packs and hot meals for families who have nothing to cook.',
    causes: ['food'],
    title: 'Feeding families in',
  },
  {
    id: 'water',
    label: 'Clean water',
    hint: 'Water stations that give a whole village safe water to drink.',
    causes: ['water'],
    title: 'Clean water for',
  },
  {
    id: 'education',
    label: 'Education',
    hint: 'Classrooms and a school that will keep teaching for generations.',
    causes: ['education'],
    title: 'Education for children in',
  },
  {
    id: 'jariyah',
    label: 'Sadaqah jariyah',
    hint: 'Ongoing charity that keeps giving, like a masjid, a well or a school.',
    causes: ['jariyah'],
    title: 'Sadaqah jariyah in',
  },
  {
    id: 'memory',
    label: 'In memory of a loved one',
    hint: 'Lasting sadaqah jariyah in the name of someone you have lost.',
    causes: ['jariyah'],
    title: 'In loving memory, sadaqah jariyah in',
  },
]

export type Supporter = {
  name: string
  amount: number
  /** ISO date */
  on: string
  message?: string
}

export type Fundraiser = {
  /** the URL: /fundraisers/<slug> */
  slug: string
  title: string
  /** first name and an initial, or a group's name */
  organiser: string
  reason: Reason
  /** a slug from APPEAL_LIST: where every gift on this page goes */
  appeal: string
  goal: number
  raised: number
  supporters: number
  /** ISO dates */
  created: string
  ends: string
  /** paragraphs, in the organiser's own words */
  story: string[]
  /** a data: URL or a path; absent means the appeal's own photograph */
  photo?: string
  recent: Supporter[]
  /** true when it was started in this browser and exists nowhere else */
  local?: boolean
}

/** INVENTED. See the TODO at the top of this file. */
export const SAMPLE_FUNDRAISERS: Fundraiser[] = [
  {
    slug: 'maryams-10th-birthday-gaza',
    title: 'Maryam’s 10th birthday for Gaza',
    organiser: 'Maryam A.',
    reason: 'food',
    appeal: 'gaza-hot-meals',
    goal: 1000,
    raised: 740,
    supporters: 31,
    created: '2026-08-28',
    ends: '2026-10-05',
    story: [
      'I am turning ten and I already have enough toys. This year I would like my family and friends to help children in Gaza have a hot meal instead.',
      'Mum says every $10 is a hot meal cooked and handed out in the camps. My goal is 100 meals before my party.',
    ],
    recent: [
      { name: 'Aunty Huda', amount: 50, on: '2026-09-16', message: 'So proud of you Maryam!' },
      { name: 'Anonymous', amount: 20, on: '2026-09-15' },
      { name: 'The Karimi family', amount: 100, on: '2026-09-13', message: 'Happy birthday habibti.' },
    ],
  },
  {
    slug: 'sydney-half-marathon-yemen-water',
    title: 'Running the Sydney half for clean water',
    organiser: 'Yusuf K.',
    reason: 'water',
    appeal: 'water-stations-yemen',
    goal: 3500,
    raised: 2180,
    supporters: 46,
    created: '2026-08-10',
    ends: '2026-10-19',
    story: [
      'I am running 21 kilometres in October, which is further than I have ever run. In parts of Yemen people walk that far for water that is not even safe to drink.',
      'A water station costs $350. My goal is ten of them, and if you sponsor me every dollar goes to building them.',
    ],
    recent: [
      { name: 'Omar S.', amount: 100, on: '2026-09-16', message: 'Go Yusuf, see you at the finish line.' },
      { name: 'Anonymous', amount: 35, on: '2026-09-14' },
      { name: 'Leila and Sami', amount: 50, on: '2026-09-11' },
    ],
  },
  {
    slug: 'in-memory-of-nana-tarim-school',
    title: 'In memory of our Nana, for the school in Tarim',
    organiser: 'The Rahman family',
    reason: 'memory',
    appeal: 'tarim-school',
    goal: 5000,
    raised: 3925,
    supporters: 58,
    created: '2026-07-30',
    ends: '2026-11-30',
    story: [
      'Our Nana taught every one of her grandchildren to read Qur’an at her kitchen table. She believed nothing was worth more than learning.',
      'We are raising for the school in Tarim as sadaqah jariyah in her name, so that her love of teaching keeps going.',
    ],
    recent: [
      { name: 'Anonymous', amount: 250, on: '2026-09-15', message: 'May Allah grant her Jannah.' },
      { name: 'Fatima R.', amount: 40, on: '2026-09-12' },
      { name: 'Br. Idris', amount: 100, on: '2026-09-09', message: 'She was a light in our community.' },
    ],
  },
  {
    slug: 'year-6-food-drive-lebanon',
    title: 'Year 6 food drive for families in Tripoli',
    organiser: 'Year 6 class',
    reason: 'food',
    appeal: 'food-pack-lebanon',
    goal: 1500,
    raised: 460,
    supporters: 22,
    created: '2026-09-02',
    ends: '2026-10-31',
    story: [
      'Our class decided to raise money for food packs this term. We are holding a bake sale every Friday and asking our families to help.',
      'Each pack is bought in Lebanon, so the money reaches families faster. We will read out the total at assembly.',
    ],
    recent: [
      { name: 'Ms. Hassan', amount: 50, on: '2026-09-12', message: 'Well done Year 6!' },
      { name: 'Anonymous', amount: 15, on: '2026-09-12' },
      { name: 'Bilal’s dad', amount: 30, on: '2026-09-05' },
    ],
  },
]

/* ===========================================================================
   The words
   =========================================================================== */

export const LISTING = {
  hero: {
    eyebrow: 'Community fundraisers',
    titleLead: 'Raise it together.',
    titleMark: 'Send it where it counts.',
    intro:
      'Give to a fundraiser someone in our community has started, or start your own for one of our appeals.',
    start: 'Start a fundraiser',
    browse: 'Browse fundraisers',
  },
  stats: { raised: 'Raised by the community', count: 'Fundraisers running', supporters: 'Supporters' },
  list: {
    eyebrow: 'Give to a fundraiser',
    title: 'Fundraisers that need you',
    lede: 'Every one raises for a real appeal, so you always know where your gift goes.',
    all: 'All',
    empty: 'No fundraisers for this yet. Be the first to start one.',
  },
  how: {
    eyebrow: 'How it works',
    title: 'Start one in a few minutes',
    steps: [
      { title: 'Pick an appeal', body: 'Choose where the money goes. It is always one of our real appeals.' },
      { title: 'Make your page', body: 'Add your reason, a goal and a photo if you like.' },
      { title: 'Share it', body: 'Send the link to family, friends and your community.' },
      { title: 'See where it went', body: 'Every gift is receipted, and we report back on the appeal.' },
    ],
  },
  close: {
    eyebrow: 'Have a reason to ask?',
    title: 'Your people will say yes to you.',
    body: 'A birthday, a run, a Ramadan, a memory. Turn it into food, water or a classroom for someone who needs it.',
  },
}

export const START = {
  eyebrow: 'Start a fundraiser',
  title: 'Set up your fundraiser',
  lede: 'Four short steps. You can see your page taking shape as you go.',
  steps: ['Occasion', 'Appeal', 'Your page', 'About you'],

  reason: { title: 'What is the occasion?', hint: 'Choose what you are raising for. Next you pick the appeal your money goes to.' },
  appeal: { title: 'Which appeal should it go to?', hint: 'Every gift on your page goes to this appeal. Donors can click through and see it.' },
  page: {
    title: 'Tell people why',
    titleLabel: 'Fundraiser title',
    storyLabel: 'Your reason, in your own words',
    storyHint: 'A few sentences is plenty. Say why this matters to you.',
    goalLabel: 'Your goal (AUD)',
    endsLabel: 'End date',
    photoLabel: 'A photo (optional)',
    photoHint: 'If you leave it, your page uses the appeal’s photo.',
    photoAction: 'Choose a photo',
    photoRemove: 'Remove photo',
  },
  you: {
    title: 'About you',
    hint: 'Your first name and last initial show on the page. We only use your email about this fundraiser.',
    first: 'First name',
    last: 'Last name',
    email: 'Email',
    group: 'Or a group name (optional)',
    groupHint: 'For a class, a family or a team, shown instead of your name.',
    agree: 'I will only share this page with people I know, and I understand every gift goes to the appeal I chose.',
  },

  back: 'Back',
  next: 'Continue',
  create: 'Create my fundraiser',
  previewLabel: 'Your page so far',
}

/** Shown on a fundraiser that lives only in this browser. */
export const LOCAL_NOTICE = {
  title: 'This page is a preview',
  body: 'Online fundraisers are not switched on yet, so this page is saved in this browser only and nobody else can see it. Send it to us and we will set it up with you.',
  action: 'Send it to us',
}
