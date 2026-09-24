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

   THE FUNDRAISERS THEMSELVES live on the platform (server/routes/public.ts)
   and are read through services/fundraisers.ts. A page started on
   /fundraisers/start, or in the donor portal, waits in the admin approval
   queue and appears here only once the team approves it. The invented
   SAMPLE_FUNDRAISERS that used to sit in this file are gone; the development
   database seeds its own.
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
}

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
/** What the start form says once the fundraiser is with us. It is not public
 *  until the team approves it, so nothing here offers a link to share. */
export const SENT = {
  eyebrow: 'Sent for approval',
  title: 'Your fundraiser is with us',
  body: 'Someone from our team reads every page before it goes public, usually within two working days. We will email you the moment it is live, with the link to share.',
  manage: 'Until then you can see it and change it from your account: sign in with the same email and we will send you a code.',
  account: 'Open my fundraisers',
  browse: 'See other fundraisers',
  sending: 'Sending…',
}
