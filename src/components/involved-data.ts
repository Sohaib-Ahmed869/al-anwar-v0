/* ---------------------------------------------------------------------------
   Every word on the Get involved page, in one file.

   The page (pages/GetInvolved.tsx) is a table of contents and its sections
   hold markup only, the way Zakat, About, Contact and Where it goes work.

   REBUILT 17 SEPTEMBER 2026 on the Home / About / Contact pattern, at the
   user's request. What they chose:
     - the hero is the Contact hero: a stock photo in greyscale under the logo
       teal, uncaptioned
     - the volunteer section opens warm, and the filed volunteer count is a
       small fact inside it rather than the headline
     - the social feeds are cut (Home and Contact both carry them); the menu's
       "Latest posts" now goes to /#social (the home page's HomeSocial)
     - the corporate & workplace giving section is cut, with its menu link
   The copy was also cut down: every paragraph is one or two sentences, and
   the lines that explained the site to itself ("None of this needs a form")
   are gone.

   NOTHING ON THIS PAGE COLLECTS A NAME. Every call to action goes to the
   contact form with a subject already chosen, or to the email address. This
   site has no server, and a sign-up form that shows a tick and goes nowhere is
   worst of all on a page where somebody is offering a Saturday. When there is
   a server, a real sign-up belongs on #volunteer.

   NO NUMBERS EXCEPT THE ONE WE FILED. The only count on the page is the
   volunteer number from the latest Annual Information Statement, read live
   from where-data.ts so it cannot disagree with that page.

   TODO: WHERE THE PACKING HAPPENS. The registered office in org-data.ts is
   Silverwater; the ACNC business address is 70 Oxford St, Guildford. No suburb
   is named on this page until somebody settles it.
--------------------------------------------------------------------------- */

import { LATEST } from './where-data'

/** How many people volunteered in the most recent year we filed. */
export const VOLUNTEER_COUNT = LATEST.volunteers

/* The hero. Same shape as CONTACT.hero: script eyebrow, a heavy two-line
   title with the second line in pale gold, and one line of intro. */
export const HERO = {
  eyebrow: 'Get involved',
  titleLead: 'Give your time.',
  titleMark: 'Not only money.',
  intro:
    'Every box that leaves the warehouse leaves because somebody turned up. Here are three ways to be that person.',
  more: 'Find your way in',
}

/* ===========================================================================
   Volunteer with us
   ===========================================================================
   Two roles and no more: packing and driving are what the warehouse actually
   needs. The day is written as what happens, not as requirements, and the
   third step (being told where the run went) is the one that brings people
   back. */

export const VOLUNTEER = {
  eyebrow: 'Volunteer with us',
  title: 'An afternoon that ends up on a family’s table',
  lede: 'No experience, no interview, and coming once is completely normal.',

  /** Sits beside the count, which the section reads from VOLUNTEER_COUNT. */
  countLabel: 'volunteers in the year we last filed. There is room for you.',

  roles: [
    {
      kind: 'Packing',
      icon: 'box',
      title: 'Fill the boxes',
      body: 'Flour, rice, oil, lentils and dates, packed in a line with a radio on. Two or three hours, and children are welcome with you.',
    },
    {
      kind: 'Driving',
      icon: 'van',
      title: 'Get them where they go',
      body: 'Packed boxes have to reach a container, a mosque or a family. A van, a ute or a station wagon and a spare morning is all it takes.',
    },
  ],

  dayTitle: 'How a day goes',
  day: [
    { title: 'You write to us', body: 'We reply with the next date there is something on.' },
    { title: 'You come along', body: 'Somebody shows you the line and you join it.' },
    { title: 'You hear where it went', body: 'Everyone who packed is told once the run arrives.' },
  ],

  cta: 'Apply to volunteer',
}

/* ===========================================================================
   Start a fundraiser
   ===========================================================================
   17 September 2026: the four idea cards (a birthday, a run, an iftar, a jar)
   came off at the user's request, because they read as suggestions rather
   than anything real. The section now shows live community fundraisers from
   fundraiser-data.ts, each one raising for a real appeal, and links to
   /fundraisers/start. The steps come from LISTING.how in the same file. */

export const FUNDRAISE = {
  eyebrow: 'Start a fundraiser',
  title: 'Raise money for a real appeal',
  lede: 'Pick one of our appeals, make a page in a few minutes, and ask the people who would say yes to you.',
  cta: 'Start a fundraiser',
  all: 'See all fundraisers',
  stepsEyebrow: 'Start to finish',
  stepsTitle: 'How it works',
}

/* ===========================================================================
   Mosque & school partnerships
   ===========================================================================
   Written as a trade: what a mosque or school gives, and what it gets back.
   The report back is last because it is the real offer. No count of partners
   appears, because nobody has a list. */

export const PARTNERS = {
  eyebrow: 'Mosque & school partnerships',
  title: 'This is where most of it comes from',
  lede: 'A box on a counter, a few minutes after jumu‘ah, a class that picks one appeal for the year.',

  give: {
    kind: 'You give',
    title: 'A little room',
    items: [
      'A collection box on the counter, banked by you or by us.',
      'A few minutes after jumu‘ah, or an assembly slot, to explain one appeal.',
      'A term or a Ramadan where your community raises for one cause.',
    ],
  },

  get: {
    kind: 'You get back',
    title: 'Something to show your community',
    items: [
      'The appeal written up for your noticeboard or newsletter.',
      'Tax receipts for anyone who wants one, for donations of $2 and over.',
      'A report back on where the money went, including what we do not know yet.',
    ],
  },

  cta: 'Talk to us about a partnership',
  proof: 'Meet our partners',
}

/* ===========================================================================
   The close
   =========================================================================== */

export const CLOSE = {
  eyebrow: 'Not sure which fits?',
  title: 'Write us one line.',
  body: 'Tell us what you have in mind. A person reads it and answers within a working day.',
  form: 'Or use the form',
}
