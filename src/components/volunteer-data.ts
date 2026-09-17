import { LATEST } from './where-data'

/* ---------------------------------------------------------------------------
   Every word on /volunteer, in one file.

   Added 17 September 2026 at the user's request, after the Volunteer page of
   a reference they named (calcite.charities.ltd/team-hope): a photo hero with
   "Apply to volunteer", three reasons to volunteer, and a "Join our team"
   application. Built here on our own pattern (Contact's teal duotone hero,
   About's ruled cards, SectionHead, teal panels) and filled with only what is
   true of Al-Anwaar: two warehouse roles (packing, driving) and the two board
   skills AboutWork already asks for.

   THE PHOTO is the reference's own hero image, used at the user's request:
   "Hands forming a heart" by Tim Marshall on Unsplash (Unsplash License, free
   to use), images.unsplash.com/photo-1469571486292-0ba58a3f068b, saved as
   hero-volunteer-2400/1200.jpg. The hands are painted red; shown in colour
   beside the Gaza appeals it could read as blood, so it is only ever shown
   greyscale under the teal wash. Stock: never caption it as our volunteers.

   THE APPLICATION has no server to go to (services/volunteer.ts), so it opens
   the applicant's email with everything filled in and says so. No tick.

   TODO BEFORE LAUNCH
     - Where the warehouse is (Silverwater or Guildford) is still unsettled, so
       no suburb is named. See involved-data.ts.
     - Whether volunteers need a Working with Children Check when children come
       along. The FAQ does not claim either way; the office should confirm.
--------------------------------------------------------------------------- */

export const VOLUNTEER_COUNT = LATEST.volunteers

export const HERO = {
  eyebrow: 'Volunteer with us',
  titleLead: 'Lend a hand.',
  titleMark: 'Change a life.',
  intro:
    'Everything that leaves our warehouse leaves because somebody turned up. No experience needed, and coming once is completely normal.',
  apply: 'Apply to volunteer',
  call: 'or call',
}

export const WHY = {
  eyebrow: 'Why volunteer',
  title: 'Give a little, change a lot.',
  lede: 'A few hours of your time goes further here than almost anywhere else.',
  items: [
    {
      icon: 'heart',
      kind: 'Real impact',
      title: 'Your hands, their table',
      body: 'The boxes you pack are the food packs families receive. Nobody is paid to do it, so every hour you give goes straight into the work.',
    },
    {
      icon: 'calendar',
      kind: 'On your terms',
      title: 'Come when you can',
      body: 'There is no minimum commitment. Join one packing day, or become a regular. You choose the dates that suit you.',
    },
    {
      icon: 'users',
      kind: 'A small team',
      title: 'You will be missed if you go',
      body: `Last year there were ${VOLUNTEER_COUNT} of us. You are not a number on a roster here, you are a real part of a small team.`,
    },
  ],
}

export const ROLES = {
  eyebrow: 'Where you can help',
  title: 'Four ways to give your time.',
  lede: 'Two in the warehouse, and two skills our board is short of.',
  items: [
    {
      id: 'packing',
      icon: 'box',
      kind: 'In the warehouse',
      title: 'Packing',
      body: 'Flour, rice, oil, lentils and dates, packed into boxes in a line with a radio on.',
      time: '2 to 3 hours',
      needs: 'No experience. Children welcome with you.',
    },
    {
      id: 'driving',
      icon: 'van',
      kind: 'On the road',
      title: 'Driving',
      body: 'Getting packed boxes to a container, a mosque or a family. The half of the job nobody volunteers for.',
      time: 'A morning',
      needs: 'A licence and a van, ute or station wagon.',
    },
    {
      id: 'accounts',
      icon: 'book',
      kind: 'A skill',
      title: 'Charity accounting',
      body: 'An unpaid seat helping the board keep the books and the filings we publish in order.',
      time: 'A few hours a month',
      needs: 'Charity or not-for-profit accounting experience.',
    },
    {
      id: 'arabic',
      icon: 'users',
      kind: 'A skill',
      title: 'Arabic speaker',
      body: 'Sitting in on calls with our partners overseas and hearing what is actually being said.',
      time: 'A few hours a month',
      needs: 'Fluent Arabic and English.',
    },
  ],
}

export const STEPS = {
  eyebrow: 'How it goes',
  title: 'From applying to your first day.',
  items: [
    { title: 'Apply', body: 'Fill in the short form below. It takes a couple of minutes.' },
    { title: 'We get in touch', body: 'A real person replies with the next date there is something on.' },
    { title: 'Come along', body: 'Somebody shows you what to do and you join in.' },
    { title: 'Hear where it went', body: 'Everyone who helped is told where that run ended up.' },
  ],
}

export const APPLY = {
  eyebrow: 'Join our team',
  title: 'Apply to volunteer.',
  lede: 'Fill in the form below. It only takes a couple of minutes.',

  panel: {
    eyebrow: 'What happens next',
    title: 'A person reads every application.',
    points: [
      'We reply within a few working days.',
      'We tell you the next date and where to come.',
      'There is no interview and no obligation.',
    ],
    ask: 'Questions first?',
  },

  form: {
    first: 'First name',
    last: 'Last name',
    email: 'Email',
    phone: 'Mobile (optional)',
    phoneHint: 'So we can text you the day before.',
    suburb: 'Suburb (optional)',
    roles: 'What would you like to help with?',
    rolesHint: 'Choose as many as you like.',
    when: 'When are you usually free?',
    whenOptions: ['Weekday mornings', 'Weekday afternoons', 'Weekends', 'It varies'],
    note: 'Anything we should know? (optional)',
    notePlaceholder: 'Experience, languages, if you are bringing children, or anything else.',
    consent: 'I am happy for Al-Anwaar to contact me about volunteering.',
    submit: 'Send my application',
    errors: {
      first: 'Enter your first name.',
      last: 'Enter your last name.',
      email: 'Enter an email we can reply to.',
      phone: 'That does not look like a number we can ring.',
      roles: 'Choose at least one way to help.',
      when: 'Choose when you are usually free.',
      consent: 'Tick this so we can get in touch.',
    },
  },

  handedOff: {
    title: 'Your application is ready to send.',
    body: 'We have opened your email with everything filled in. Press send there and it reaches us. If nothing opened, write to',
    again: 'Edit my application',
  },
}

export const FAQ = {
  eyebrow: 'Good to know',
  title: 'Questions people ask.',
  items: [
    {
      q: 'Do I need any experience?',
      a: 'No. For packing and driving somebody shows you what to do on the day. The two skilled roles ask for experience, and they say which.',
    },
    {
      q: 'How often do I have to come?',
      a: 'As often as suits you. Plenty of people come once. Others come to every packing day. There is no minimum.',
    },
    {
      q: 'Can I bring my children?',
      a: 'Yes, children are welcome at packing days as long as they are yours to watch. Tell us in your application so we can plan for them.',
    },
    {
      q: 'Where is the warehouse?',
      a: 'We send the address with the date when we reply, so you have it in writing.',
    },
    {
      q: 'Can my workplace, school or masjid volunteer as a group?',
      a: 'Write to us first so we can check a date works for a group. Put the group size in the note on your application.',
    },
    {
      q: 'Is volunteering paid?',
      a: 'No. Nobody at Al-Anwaar draws a wage, including the board.',
    },
  ],
}
