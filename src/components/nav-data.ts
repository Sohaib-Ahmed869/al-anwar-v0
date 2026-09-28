/* ---------------------------------------------------------------------------
   The menu, as data. Ported from the header in ../../index.html and the
   navbar section of ../../SITE-STRUCTURE.md.

   Desktop panels and the mobile drawer both read this file, so a link only
   ever has to be added in one place.
--------------------------------------------------------------------------- */

import { appealBySlug, giveHref } from './appeals-data'
import { FACEBOOK, INSTAGRAM } from './social-data'

/** `index` is the "All appeals" style link that closes a column; `alert` is the
 *  live crisis, and is the one place red is allowed inside a panel. */
export type LinkTone = 'index' | 'alert'

export type NavItem = {
  label: string
  to: string
  tone?: LinkTone
  /** Leaves the site. Header and MobileDrawer both render these as a plain
   *  <a> with target and rel set, because react-router's <Link> treats an
   *  absolute URL as a path and would route to /https://… instead. Added for
   *  the two social accounts in the Get involved panel. */
  external?: boolean
  /** A short second line under the label, in the desktop panel only. The
   *  Where it goes panel uses it to say what the work is in each place. */
  note?: string
  /** In a column that drives the feature panel, what the panel shows while
   *  this link is hovered or focused. See `drivesFeature`. */
  feature?: NavFeature
}

/** What the photograph beside the Appeals columns shows: one appeal, and the
 *  two ways into it. `donate` is the gold "Donate now" under the caption and
 *  goes straight to the form; `cta` is the quieter link to the appeal's page. */
export type NavFeature = {
  src: string
  alt: string
  caption: string
  cta: NavItem
  donate?: NavItem
  /** The phone drawer has no room for the photograph, so a feature whose
   *  link is a page in its own right lists that link there instead. */
  inDrawer?: boolean
}

export type NavColumn = {
  title?: string
  links: NavItem[]
  /** Whether hovering or focusing a link in this column swaps the feature
   *  panel to that link's `feature`. Only Projects and Countries do: they sit
   *  furthest from the panel, and the pointer crossing the other two columns on
   *  its way there must not change what it is heading for. */
  drivesFeature?: boolean
}

export type NavSection = {
  id: string
  label: string
  /** How wide the panel opens, or 'link' for an item that just goes somewhere. */
  layout: 'mega' | 'two' | 'single' | 'link'
  /** Where a 'link' section points. Panelled sections use their index link. */
  to?: string
  /** Paths that light this item up as the current section. */
  match: string[]
  columns: NavColumn[]
  /** Appeals closes with a field photograph and one appeal to give to. It is
   *  the one shown before anything is hovered. */
  feature?: NavFeature
}

/* A feature built from an appeal in appeals-data.ts, so the photograph, its alt
   text and the give link cannot drift from the appeal page itself. Only the
   caption is written here, because the panel has room for one line. */
function fromAppeal(slug: string, caption: string): NavFeature | undefined {
  const a = appealBySlug(slug)
  if (!a) return undefined
  return {
    src: a.image,
    alt: a.alt,
    caption,
    cta: { label: 'About this appeal', to: `/appeals/${a.slug}` },
    donate: { label: 'Donate now', to: giveHref(a) },
  }
}

const FOOD = fromAppeal('yemen-food-relief', 'Yemen: a $50 food pack feeds a family for a month')
const WATER = fromAppeal('water-stations-yemen', 'Yemen: a water station close enough to carry home from')
const SCHOOL = fromAppeal('tarim-school', 'Tarim: completing a high school for the students it already has')
const MASJID = fromAppeal('gambia-masjid', 'The Gambia: a masjid that outlives the giver')
const GAZA = fromAppeal('gaza-emergency', 'Gaza: food and water for families living in tents')
const LEBANON = fromAppeal('food-pack-lebanon', 'Tripoli: food packs, bought in-country and handed out this week')

export const NAV: NavSection[] = [
  {
    id: 'appeals',
    label: 'Appeals',
    layout: 'mega',
    match: ['/appeals', '/ramadan', '/dhul-hijjah'],
    /* 28 Sep 2026, client feedback: "By need" became Projects and "By place"
       Countries, the live emergencies got a column of their own, and Seasonal
       became Duties & obligations — the gifts a donor owes rather than chooses.
       Orphans & family, Medical and Syria have no appeal behind them yet, so
       they have no feature and leave the panel on whatever it last showed. */
    columns: [
      {
        title: 'Projects',
        drivesFeature: true,
        links: [
          { label: 'Food & nutrition', to: '/appeals?cause=food', feature: FOOD },
          { label: 'Clean water', to: '/appeals?cause=water', feature: WATER },
          { label: 'Education', to: '/appeals?cause=education', feature: SCHOOL },
          { label: 'Orphans & family', to: '/appeals?cause=orphans' },
          { label: 'Medical', to: '/appeals?cause=medical' },
          { label: 'Sadaqah jariyah', to: '/appeals?cause=jariyah', feature: MASJID },
          { label: 'All appeals', to: '/appeals', tone: 'index' },
        ],
      },
      {
        title: 'Countries',
        drivesFeature: true,
        links: [
          { label: 'Gaza', to: '/appeals?country=gaza', feature: GAZA },
          { label: 'Yemen', to: '/appeals?country=yemen', feature: FOOD },
          { label: 'Lebanon', to: '/appeals?country=lebanon', feature: LEBANON },
          { label: 'Syria', to: '/appeals?country=syria' },
          { label: 'The Gambia', to: '/appeals?country=gambia', feature: MASJID },
          { label: 'All countries', to: '/where-it-goes', tone: 'index' },
        ],
      },
      {
        title: 'Crisis response',
        links: [
          { label: 'Lebanon response', to: '/appeals/food-pack-lebanon', tone: 'alert' },
          { label: 'Gaza emergency', to: '/appeals/gaza-emergency' },
          { label: 'Hot meals in Gaza', to: '/appeals/gaza-hot-meals' },
          { label: 'Yemen food relief', to: '/appeals/yemen-food-relief' },
          { label: 'Emergency fund', to: '/give?designation=emergency' },
          { label: 'All emergencies', to: '/appeals?cause=emergency', tone: 'index' },
        ],
      },
      {
        title: 'Duties & obligations',
        links: [
          { label: 'Zakat', to: '/zakat' },
          { label: 'Zakat al-Fitr', to: '/zakat#fitr' },
          { label: 'Kaffarah', to: '/give?designation=kaffarah' },
          { label: 'Fidya', to: '/give?designation=fidyah' },
          /* There is no Aqiqah fund in give-data.ts yet, so it goes to the
             office rather than booking to a fund it is not. */
          { label: 'Aqiqah', to: '/contact?topic=A+gift+or+a+receipt' },
          { label: 'Qurbani', to: '/dhul-hijjah' },
          { label: 'Ramadan', to: '/ramadan' },
        ],
      },
    ],
    feature: FOOD,
  },
  {
    id: 'about',
    label: 'About',
    layout: 'link',
    to: '/about',
    match: ['/about'],
    columns: [
      {
        links: [
          { label: 'Our story', to: '/about' },
          { label: 'Board & team', to: '/about#team' },
          { label: 'Ways to help', to: '/about#work' },
        ],
      },
    ],
  },
  {
    id: 'where',
    label: 'Where it goes',
    /* 17 Sep 2026: the "Our accountability" column (reports, field partners,
       ACNC status) was cut at the user's request, and so were those sections
       of the page. What is left is the places, each with what the work there
       is (read off PLACES in where-data.ts), and the gallery as a photograph,
       like the one that closes the Appeals panel. It is the charity's own
       photograph, so it may carry a place and a date. */
    layout: 'two',
    match: ['/where-it-goes', '/gallery'],
    columns: [
      {
        title: 'Where we work',
        links: [
          { label: 'Gaza', to: '/where-it-goes#gaza', note: 'Emergency relief and hot meals' },
          { label: 'Yemen', to: '/where-it-goes#yemen', note: 'Food packs and clean water' },
          { label: 'Lebanon', to: '/where-it-goes#lebanon', note: 'Food packs, water and Eid clothes' },
          { label: 'Syria', to: '/where-it-goes#syria', note: 'Food packs' },
          { label: 'The Gambia', to: '/where-it-goes#gambia', note: 'A masjid and a Quran school' },
          { label: 'Where it goes', to: '/where-it-goes', tone: 'index' },
        ],
      },
    ],
    feature: {
      src: '/assets/images/PHOTO-2022-07-29-10-21-12.webp',
      alt: 'A masjid under construction, with Al-Anwaar’s banner hung on the wall',
      caption: 'A masjid and a Quran school in The Gambia',
      cta: { label: 'See the photo gallery', to: '/gallery' },
      inDrawer: true,
    },
  },
  {
    id: 'involved',
    label: 'Get involved',
    layout: 'two',
    match: ['/get-involved', '/fundraisers', '/events', '/volunteer', '/partners', '/become-a-partner'],
    columns: [
      {
        links: [
          { label: 'Volunteer with us', to: '/volunteer' },
          { label: 'Start a fundraiser', to: '/fundraisers/start' },
          { label: 'Community fundraisers', to: '/fundraisers' },
          { label: 'Our partners', to: '/partners' },
          { label: 'Become a partner', to: '/become-a-partner' },
          { label: 'Events', to: '/events' },
          { label: 'Get involved', to: '/get-involved', tone: 'index' },
        ],
      },
      {
        title: 'Follow along',
        links: [
          { label: 'Latest posts', to: '/#social' },
          { label: FACEBOOK.label, to: FACEBOOK.href, external: true },
          { label: INSTAGRAM.label, to: INSTAGRAM.href, external: true },
        ],
      },
    ],
  },
  {
    id: 'zakat',
    label: 'Zakat',
    layout: 'link',
    to: '/zakat',
    match: ['/zakat'],
    columns: [
      {
        links: [
          { label: 'Calculate your zakat', to: '/zakat#calculator' },
          { label: 'Pay zakat now', to: '/give?designation=zakat' },
          { label: 'What is nisab?', to: '/zakat#nisab' },
          { label: 'Our zakat policy', to: '/zakat#policy' },
          { label: 'Zakat questions', to: '/zakat#faq' },
          { label: 'Zakat overview', to: '/zakat', tone: 'index' },
        ],
      },
    ],
  },
  {
    id: 'contact',
    label: 'Contact',
    layout: 'link',
    to: '/contact',
    match: ['/contact'],
    columns: [],
  },
]

/** How to reach a person. Shown in the mobile drawer and the footer. */
export const PHONE = { label: '+61 400 000 000', href: 'tel:+61400000000', hours: 'Mon to Fri, 9 to 5 AEST' } // placeholder until the charity's number is confirmed

/** Which section owns the current URL, so one nav item can show as current. */
export function activeSection(pathname: string): string | null {
  const hit = NAV.find((s) => s.match.some((p) => pathname === p || pathname.startsWith(p + '/')))
  return hit ? hit.id : null
}
