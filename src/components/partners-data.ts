import { ACCOUNTS, PARTNERS as FIELD_PARTNERS, PLACES } from './where-data'

/* ---------------------------------------------------------------------------
   Every word on /partners and /become-a-partner, in one file.

   Added 17 September 2026 at the user's request, after two reference pages
   they named (calcite.charities.ltd/our-partners and /become-a-partner).
   The reference opens on "40+ partner organisations", "12 communities" and a
   logo wall. We cannot say any of that, so this page shows only what the
   rest of the site already stands behind:
     - the field partners in where-data.ts (one named: Alaf Foundation in
       Yemen) and the five places we deliver, with the places that have no
       named partner saying so rather than showing a blank logo
     - the three rules of how we work with any partner (ROUTINE, where-data)
     - the figures are all derived: places from PLACES, named partners from
       PARTNERS, and staff wages from the filed ACCOUNTS
   and then the ways an Australian organisation can partner with us, each one
   landing on /become-a-partner with its type chosen.

   THE PHOTOS
     /partners uses hero-yemen (stock, uncaptioned; see HomeHero).
     /become-a-partner uses the reference's own hero, used at the user's
     request: "People in a meeting" by Jason Goodman on Unsplash (Unsplash
     License), images.unsplash.com/photo-1552664730-d307ca884978, saved as
     hero-partners-2400/1200.jpg, shown greyscale under the teal wash.

   THE ENQUIRY has no server (services/partner.ts): it opens the sender's
   email with everything filled in and says so.

   TODO BEFORE LAUNCH: the four places without a named partner. See PARTNERS
   in where-data.ts. Adding a name there adds a card here by itself.
--------------------------------------------------------------------------- */

export { FIELD_PARTNERS, PLACES }

const WAGES_EVERY_YEAR = ACCOUNTS.every((y) => y.wages === 0)

export const OUR_PARTNERS = {
  hero: {
    eyebrow: 'Stronger together',
    title: 'The people who carry it the last mile.',
    intro:
      'Every donation reaches a family through somebody who lives there. These are the partners we work with, and how we work with them.',
    become: 'Become a partner',
    see: 'Meet our field partners',
  },

  stats: [
    { value: String(PLACES.length), label: 'Places we deliver' },
    { value: String(FIELD_PARTNERS.length), label: 'Field partner we can name' },
    { value: '2022', label: 'Working with Alaf since' },
    ...(WAGES_EVERY_YEAR ? [{ value: '$0', label: 'Spent on staff wages' }] : []),
  ],

  field: {
    eyebrow: 'Our field partners',
    title: 'Who hands it over.',
    lede: 'We name a partner only when we can stand behind the name. Where we cannot yet, we say so.',
    featuredLabel: 'Field partner',
    placesTitle: 'Where we deliver',
    named: 'Partner named',
    unnamed: 'Local partner, name to be published',
    record: 'See the record',
  },

  how: {
    eyebrow: 'How we work with partners',
    title: 'Three rules, wherever we work.',
  },

  ways: {
    eyebrow: 'Partner with us',
    title: 'Ways to work together.',
    lede: 'However you are placed to help, there is a way to partner with us.',
  },

  close: {
    eyebrow: 'Let’s work together',
    title: 'Your community, our field partners.',
    body: 'Whether you run a masjid, a school, a business or an aid organisation, we would like to hear how we could work together.',
    primary: 'Become a partner',
    secondary: 'Donate now',
  },
}

/** The ways to partner. `id` is what /become-a-partner?type= chooses. */
export const PARTNER_TYPES = [
  {
    id: 'community',
    icon: 'masjid',
    kind: 'Community',
    title: 'Mosques and schools',
    body: 'A collection box, a few minutes after jumu‘ah, or a class that raises for one appeal. We write it up for your noticeboard and report back on where it went.',
  },
  {
    id: 'business',
    icon: 'building',
    kind: 'Business',
    title: 'Businesses and workplaces',
    body: 'Matched giving, workplace fundraising or sponsoring one appeal. We give your finance team the registration and tax details they need.',
  },
  {
    id: 'in-kind',
    icon: 'box',
    kind: 'In kind',
    title: 'Goods, space and skills',
    body: 'Packing materials, a van for a morning, storage, printing, or professional skills that stretch every dollar further.',
  },
  {
    id: 'field',
    icon: 'globe',
    kind: 'Overseas',
    title: 'Field and aid organisations',
    body: 'A registered organisation delivering food, water or education where we work, or where we should. We start small and report on every handover.',
  },
] as const

export type PartnerType = (typeof PARTNER_TYPES)[number]['id']

export const BECOME = {
  hero: {
    eyebrow: 'Become a partner',
    titleLead: 'Let’s do more',
    titleMark: 'good, together.',
    intro:
      'Tell us about your organisation and how you would like to work with us. A person reads every enquiry and replies within a few working days.',
    start: 'Start your enquiry',
  },

  expect: {
    eyebrow: 'What to expect',
    title: 'What a partnership with us looks like.',
    items: [
      { title: 'Tell us about you', body: 'Send the short enquiry below. There is nothing to sign at this stage.' },
      { title: 'We talk', body: 'A member of our team calls or meets you to understand what you have in mind.' },
      { title: 'Agree what fits', body: 'We agree one thing to do together, what it costs, and who does what.' },
      { title: 'We report back', body: 'You hear where the money or the goods went, with photos from the handover.' },
    ],
  },

  give: {
    eyebrow: 'A fair exchange',
    giveTitle: 'What you bring',
    give: [
      'Your community, your team or your organisation’s reach.',
      'A few minutes, a space, goods or a skill.',
      'A commitment to one thing, done properly.',
    ],
    getTitle: 'What you get back',
    get: [
      'The appeal written up for your newsletter, noticeboard or intranet.',
      'Tax receipts for donations of $2 and over. We are a deductible gift recipient.',
      'A report back on where it went, including what we do not know yet.',
    ],
  },

  form: {
    eyebrow: 'Your enquiry',
    title: 'Tell us about your organisation.',
    lede: 'It takes a few minutes. Fields marked optional can be left blank.',
    type: 'What kind of partnership?',
    org: 'Organisation name',
    name: 'Your name',
    role: 'Your role (optional)',
    email: 'Email',
    phone: 'Phone (optional)',
    website: 'Website (optional)',
    location: 'City or suburb',
    message: 'How would you like to work together?',
    messagePlaceholder: 'A few sentences is plenty: what you have in mind, and when.',
    consent: 'I am happy for Al-Anwaar to contact me about this enquiry.',
    submit: 'Send my enquiry',
    errors: {
      type: 'Choose the kind of partnership.',
      org: 'Enter your organisation’s name.',
      name: 'Enter your name.',
      email: 'Enter an email we can reply to.',
      location: 'Tell us where you are.',
      message: 'Tell us a little about what you have in mind.',
      consent: 'Tick this so we can reply.',
    },
    handedOff: {
      title: 'Your enquiry is ready to send.',
      body: 'We have opened your email with everything filled in. Press send there and it reaches us. If nothing opened, write to',
      again: 'Edit my enquiry',
    },
    panel: {
      eyebrow: 'Before you write',
      title: 'Registered and accountable.',
      points: [
        'Registered with the ACNC as a public benevolent institution.',
        'A deductible gift recipient, so donations are tax deductible.',
        'Nobody draws a wage, and every year we file is public.',
      ],
      records: 'Read our public record',
    },
  },
}
