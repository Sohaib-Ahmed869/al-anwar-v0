/* ---------------------------------------------------------------------------
   The menu, as data. Ported from the header in ../../index.html and the
   navbar section of ../../SITE-STRUCTURE.md.

   Desktop panels and the mobile drawer both read this file, so a link only
   ever has to be added in one place.
--------------------------------------------------------------------------- */

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
}

export type NavColumn = {
  title?: string
  links: NavItem[]
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
  /** Appeals closes with a field photograph and one appeal to give to. */
  feature?: {
    src: string
    alt: string
    caption: string
    cta: NavItem
    /** The phone drawer has no room for the photograph, so a feature whose
     *  link is a page in its own right lists that link there instead. */
    inDrawer?: boolean
  }
}

export const NAV: NavSection[] = [
  {
    id: 'appeals',
    label: 'Appeals',
    layout: 'mega',
    match: ['/appeals', '/ramadan', '/dhul-hijjah'],
    columns: [
      {
        title: 'By need',
        links: [
          { label: 'Food & nutrition', to: '/appeals?cause=food' },
          { label: 'Clean water', to: '/appeals?cause=water' },
          { label: 'Education', to: '/appeals?cause=education' },
          { label: 'Orphans & family', to: '/appeals?cause=orphans' },
          { label: 'Medical', to: '/appeals?cause=medical' },
          { label: 'Sadaqah jariyah', to: '/appeals?cause=jariyah' },
          { label: 'All appeals', to: '/appeals', tone: 'index' },
        ],
      },
      {
        title: 'By place',
        links: [
          { label: 'Gaza', to: '/appeals?country=gaza' },
          { label: 'Yemen', to: '/appeals?country=yemen' },
          { label: 'Lebanon', to: '/appeals?country=lebanon' },
          { label: 'Syria', to: '/appeals?country=syria' },
          { label: 'The Gambia', to: '/appeals?country=gambia' },
          { label: 'All countries', to: '/where-it-goes', tone: 'index' },
        ],
      },
      {
        title: 'Seasonal',
        links: [
          { label: 'Ramadan', to: '/ramadan' },
          { label: 'Dhul Hijjah & Qurbani', to: '/dhul-hijjah' },
          { label: 'Zakat al-Fitr', to: '/zakat#fitr' },
          { label: 'Lebanon crisis response', to: '/appeals/food-pack-lebanon', tone: 'alert' },
        ],
      },
    ],
    feature: {
      src: '/assets/images/PHOTO-2021-12-23-22-48-18.webp',
      alt: 'A food distribution in Yemen',
      caption: 'Yemen: a $50 food pack feeds a family for a month',
      cta: { label: 'Give to this appeal', to: '/appeals/yemen-food-relief' },
    },
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
export const PHONE = { label: '1300 000 000', href: 'tel:1300000000', hours: 'Mon to Fri, 9 to 5 AEST' }

/** Which section owns the current URL, so one nav item can show as current. */
export function activeSection(pathname: string): string | null {
  const hit = NAV.find((s) => s.match.some((p) => pathname === p || pathname.startsWith(p + '/')))
  return hit ? hit.id : null
}
