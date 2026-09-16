/* ---------------------------------------------------------------------------
   Every word on the Get involved page, in one file.

   The page (pages/GetInvolved.tsx) is a table of contents and its seven
   sections hold markup only, the way Zakat, About, Contact and Where it goes
   already work.

   ---------------------------------------------------------------------------
   NOTHING ON THIS PAGE COLLECTS A NAME

   Every call to action here goes to the contact form with a subject already
   chosen, or out to one of the two social accounts. There is no volunteer
   sign-up form, no
   fundraiser wizard and no "register your interest" box, and that is not a
   thing left for later — it is the same rule services/contact.ts and
   services/letter.ts both state at the top of themselves. This site has no
   server. A form that swallows somebody's details and shows a tick is worse
   than no form, and it is worst of all here, where the person filling it in is
   offering to give up a Saturday and will simply conclude they were not wanted
   when nobody writes back.

   When there is a server, a real sign-up belongs on #volunteer and this note
   is what should be read first.

   ---------------------------------------------------------------------------
   NO NUMBERS EXCEPT THE ONE WE FILED

   The obvious page furniture here is "join 300 volunteers", "we work with 40
   mosques", "$2m raised by our fundraisers". Nobody has counted any of that,
   and the accountability page is one click away arguing that this charity does
   not print figures it cannot show. So the only count on this page is the
   volunteer number out of the latest Annual Information Statement — read live
   from where-data.ts, so it can never disagree with the table on that page —
   and it is a small, unflattering number that is used as the invitation rather
   than hidden. See VOLUNTEER.

   TODO — WHERE THE PACKING ACTUALLY HAPPENS
   The site says two different things. AboutWork and this file say Silverwater,
   which is the registered office in org-data.ts. The ACNC register's business
   address is 70 Oxford St, Guildford — and the events diary, before it was
   taken off the site, put the warehouse in Guildford too. Somebody has to
   settle it before this page invites a stranger to drive to the wrong suburb.
--------------------------------------------------------------------------- */

import { LATEST } from './where-data'

/** How many people volunteered in the most recent year we filed. A real,
 *  lodged, checkable number, and deliberately not rounded up. */
export const VOLUNTEER_COUNT = LATEST.volunteers

/** The four ways in, in the order the header menu lists them, so the panel and
 *  the page cannot fall out of step. Drawn as the index under the band. */
export const WAYS = [
  { id: 'volunteer', label: 'Volunteer with us', hint: 'An afternoon in the warehouse' },
  { id: 'fundraise', label: 'Start a fundraiser', hint: 'A birthday, a run, a school iftar' },
  { id: 'partners', label: 'Mosque & school partnerships', hint: 'A box, a talk, a report back' },
  { id: 'corporate', label: 'Corporate & workplace giving', hint: 'Matched giving and payroll' },
]

/* ===========================================================================
   Section 3 — volunteer with us
   ===========================================================================

   THE HONEST OPENING IS THE SMALL NUMBER
   Five people volunteered last year. Every charity page like this one opens by
   implying a movement; this one opens by saying how few of us there are, which
   is both true and a better argument — a reader who turns up is not a rounding
   error in somebody else's operation, they are a sixth of it.

   TWO ROLES AND NO MORE
   Packing and driving. Those are the two things AboutWork already names and
   the two the warehouse actually needs. A longer list would be invented, and a
   volunteer page that lists eight roles when it can fill two reads as a
   wishlist rather than an offer.

   WHAT A DAY IS is written as what happens, not as requirements. The moment it
   becomes a person specification it is a jobs board, which is the mistake
   AboutWork's header already records having made and undone.
--------------------------------------------------------------------------- */

export const VOLUNTEER = {
  eyebrow: 'Volunteer with us',
  title: 'Last year there were five of us',
  body: `That is the number we filed with the regulator, and it is not a typo. Al-Anwaar has no paid staff. Everything that leaves the warehouse leaves it because somebody turned up on a Saturday. Turning up once and never again is a completely normal thing to do, and it still counts.`,

  roles: [
    {
      kind: 'Packing',
      title: 'Boxes, in Silverwater',
      body: 'Flour, rice, oil, lentils and dates into boxes, in a line, with a radio on. Two or three hours. No experience and no interview, and children are welcome if they are yours to watch.',
    },
    {
      kind: 'Driving',
      title: 'Getting them where they go',
      body: 'Packed boxes have to reach a container, a mosque or a family. If you have a van, a ute or a station wagon and a spare morning, this is the half of the job nobody volunteers for.',
    },
  ],

  /** What actually happens, so nobody arrives not knowing. Three steps, and
   *  the third is the one most volunteer pages leave out. */
  day: [
    'You write to us and we tell you the next date there is something on.',
    'You come to the warehouse. Somebody shows you the line and you join it.',
    'You find out where that run went, once it has gone. Everyone who packed gets told.',
  ],

  cta: 'Write to us about volunteering',
}

/* ===========================================================================
   Section 4 — start a fundraiser
   ===========================================================================

   WE HAVE NO FUNDRAISING PLATFORM AND THE PAGE SAYS SO
   Every large charity offers a page-builder here, and offering a button that
   creates a fundraising page would be advertising software that does not
   exist. What does exist is a bank account, a DGR endorsement and somebody who
   will answer an email — so the section describes what people actually do,
   then hands over the one real process: tell us, we set it up with you.

   THE IDEAS ARE THE ORDINARY ONES, on purpose. A birthday, a run, a school
   iftar and a sadaqah jar are what people genuinely do; inventing something
   novel would make the page feel aspirational rather than usable.

   TODO: if a platform is ever set up, the STEPS below are what it replaces,
   and `cta` is the only link that changes.
--------------------------------------------------------------------------- */

export const FUNDRAISE = {
  eyebrow: 'Start a fundraiser',
  title: 'Ask the people who would say yes to you',
  body: `You will raise more in a week among people who know you than we will in a month among strangers. We have no fundraising platform to hand you. What we have is an account for the money to land in, a deductible gift recipient endorsement so receipts are real, and somebody who will help you set it up.`,

  ideas: [
    { title: 'A birthday', body: 'Ask for the food fund instead of presents. The most common one, and the one that works.' },
    { title: 'A run or a ride', body: 'You are training anyway. Tell people what the kilometres are for.' },
    { title: 'A school or masjid iftar', body: 'A table, a collection, and a number read out at the end of the night.' },
    { title: 'A sadaqah jar', body: 'On the counter of a shop, a staffroom or a classroom. Emptied and banked monthly.' },
  ],

  steps: [
    'Tell us what you are thinking of. One paragraph is plenty.',
    'We agree what the money is for, so you can tell people exactly what they are giving to.',
    'You raise it. We give you the account details, and receipts go out to anyone who wants one.',
    'We tell you where it went, and you can tell them.',
  ],

  cta: 'Tell us your idea',
}

/* ===========================================================================
   Section 5 — mosque & school partnerships
   ===========================================================================

   WRITTEN AS A TRADE, NOT AS A REQUEST
   A partnerships section that only lists what the charity would like to be
   given reads as a request for favours. This one is in two columns — what a
   mosque or school gives, and what it gets back — because the thing that makes
   a partnership last is the second column, and most charity pages do not have
   one.

   "A REPORT BACK" IS THE REAL OFFER and it is the one thing on this page the
   organisation genuinely does better than it has to: the accountability page
   exists, it prints its own gaps, and a mosque that collected for us can be
   shown the same working. That is why it is last in the GET column, where it
   lands hardest.

   TODO: we cannot say how many mosques or schools currently work with us,
   because nobody has a list. No number appears in this section. If somebody
   compiles one, it belongs in where-data.ts with the rest of the checkable
   things, not here.
--------------------------------------------------------------------------- */

export const PARTNERS = {
  eyebrow: 'Mosque & school partnerships',
  title: 'This is where most of it actually comes from',
  body: `Not from advertising. From a box on a counter, a few minutes after a Friday, and a teacher who decided their class was doing this one this year.`,

  give: {
    title: 'What you would give us',
    items: [
      'A collection box on the counter, emptied and banked by you or by us.',
      'A few minutes after jumu‘ah, or an assembly slot, for somebody to explain one appeal.',
      'A term or a Ramadan where your community raises for one thing rather than ten.',
    ],
  },

  get: {
    title: 'What you would get back',
    items: [
      'The appeal written up for your noticeboard or newsletter, with nothing in it we cannot show.',
      'Receipts for anyone who wants one. We are a deductible gift recipient, so gifts of $2 and over are deductible.',
      'A report back on where your community’s money went, to the same standard as everything on our accountability page. Including what we do not know.',
    ],
  },

  cta: 'Talk to us about a partnership',
}

/* ===========================================================================
   Section 6 — corporate & workplace giving
   ===========================================================================

   WE ARE NOT A WORKPLACE GIVING PROVIDER AND MUST NOT IMPLY WE ARE
   Payroll giving and matched giving are run by the employer, not by us. The
   only honest thing this section can offer is that we hold the three things an
   employer's finance team will ask for before they will set one up — and we do
   hold all three, verifiably, which is worth more than a page of corporate
   language. So the section is mostly a short list of our own details, framed
   as "forward this to whoever asks".

   The three facts are stated here rather than imported from org-data.ts on
   purpose: they are written as sentences for a finance team to read, not as
   the label/value pairs the legal pages need. The values themselves must agree
   with org-data.ts — if the ABN or the endorsement ever changes, it changes in
   both.

   TODO: a "team packing day" is offered below and the warehouse has never
   hosted one. It is plausible and it is within our means, but before this line
   goes live somebody has to confirm the space can take a group of ten on a
   weekday and that there is insurance covering them.
--------------------------------------------------------------------------- */

export const CORPORATE = {
  eyebrow: 'Corporate & workplace giving',
  title: 'Your employer probably already has a scheme',
  body: `Matched giving and payroll giving are set up by your workplace, not by us, so the useful thing we can do is hand you everything their finance team will ask for. All three are on the public register and can be checked without taking our word for any of it.`,

  facts: [
    {
      title: 'We are a registered charity',
      body: 'Al-Anwaar Charity Group Ltd, ABN 16 643 085 152, registered with the ACNC on 30 July 2020 as a public benevolent institution.',
    },
    {
      title: 'Gifts are tax deductible',
      body: 'We are endorsed as a deductible gift recipient, item 1. Gifts of $2 and over are deductible, which is the test most matched-giving policies apply.',
    },
    {
      title: 'Nobody here draws a wage',
      body: 'Employee expenses have been zero in every year we have filed, and the figures are on our accountability page with the statements they came from.',
    },
  ],

  /** The one thing we would ask a company for that is not money. See the TODO
   *  above — it is not confirmed the warehouse can host one. */
  team: {
    title: 'Or bring the team instead',
    body: 'A packing morning takes a group of about ten and turns into several hundred boxes. If your workplace does a volunteering day, this is a real one.',
  },

  cta: 'Ask us for the paperwork',
}

/* ===========================================================================
   Section 6 — what we have been posting
   ===========================================================================

   THIS REPLACED THE EVENTS DIARY, which came off the site on 16 September 2026
   at the client's request — /events, /events/:slug, the home page's next-event
   band, event-data.ts and the event pinned into the header panel all went with
   it. Nothing in the repository refers to an event any more except the four
   licensed stock photographs still sitting in public/assets/images
   (event-dinner, event-packing, event-iftar, event-eid). They are left there
   deliberately rather than deleted: they were bought, they are unused, and
   they cost nothing to keep until somebody decides the diary is never coming
   back.

   What the band it inherited was for is unchanged — it is the one section on
   the page that asks for attention rather than money — and the social accounts
   are a better answer to that than a diary of four unconfirmed dates was.

   The account URLs, the reason nothing loads until it is asked for, and the
   reason the Instagram post list has to be typed by hand are all in
   social-data.ts. The words here are only the words.
--------------------------------------------------------------------------- */

export const SOCIAL = {
  eyebrow: 'Follow along',
  title: 'What we have been posting',
  body: 'The accounts are where the work actually shows up: a handover photographed the morning it happened, a van loaded, a partner’s banner on a wall. Most of it never becomes an appeal.',

  /** The one sentence before the button. It says what pressing it does, in
   *  plain words, because that is the entire point of asking first. */
  consent:
    'These feeds are served by Meta, so opening them loads content from Facebook and lets it set cookies in your browser. Nothing from Meta has loaded yet.',
  consentAction: 'Load the posts',

  /** What stands in each column before the button is pressed. */
  facebookResting:
    'The Facebook timeline will appear here once you load it: the most recent posts from the page, as they were posted.',
  instagramResting: 'Recent posts from the Instagram account will appear here once you load them.',

  /** When no post links have been listed. See POSTS in social-data.ts — this
   *  is the honest version of not having them, not an error state. */
  instagramEmpty:
    'Instagram does not let a website show a profile’s feed, only individual posts chosen by hand, and none have been chosen yet. Until they are, the photographs are all on the account itself.',
}

/* ===========================================================================
   Section 7 — the close
   =========================================================================== */

export const ASK = {
  title: 'None of this needs a form.',
  body: 'There is no sign-up on this page on purpose. We have nowhere to put your details yet, and we would rather tell you that than take them. Write one line to the office and a person reads it.',
}
