/* ---------------------------------------------------------------------------
   Every word and figure on the accountability page, in one file.

   The page itself (pages/WhereItGoes.tsx) is a table of contents and its eight
   sections hold markup only, the way Zakat, About and Contact already work.
   ACCOUNTS and FACTS were inline in the page file until this split; the
   reasoning that was written above them has come across with them, because it
   is the reason the numbers are allowed to be printed at all.

   ---------------------------------------------------------------------------
   ONE INVENTED NUMBER, AND WHERE IT IS

   Everything in this file is filed, dated or checkable EXCEPT `indicative` on
   each PLACE — five round numbers, shown at the client's call (16 September
   2026) so the design can be judged with money in it. They are the only
   invented figures on a page whose entire argument is that nothing on it is
   invented, so they are fenced:

     - they live in this one field and nowhere else. Deleting the five lines
       is the whole rollback; PlaceLedger drops the column by itself and the
       section still reads.
     - every one of them is drawn with a "to confirm" chip beside it.
     - THEY DO NOT SUM TO THE FILED TOTAL, and must never be made to. Filed
       overseas spend across the four years is $566,682 (see ACCOUNTS); these
       five come to $530,000. If they were reconciled, a reader who added the
       column up would get a number agreeing with the audited-looking table
       above it, and the split would read as though it came off the AIS. It
       does not. The AIS has one overseas figure and its programs table is
       empty in every year, because a small charity is not required to
       complete it. There is no filed per-country split of this money and
       there is no way to derive one.

   `distributions` below carries NO amounts for exactly that reason. A dated
   record of what went where is something we hold; a dollar figure against
   each line is not, so the log prints what is true and stops there.
--------------------------------------------------------------------------- */

/* ===========================================================================
   Section 2 — the accounts, as filed
   ===========================================================================

   The home page's impact band links here for the working, and the footer and
   the header both point at it. This is the working. If anything on the site
   ever disagrees with this table, this table is right and the other thing
   changes.

   EVERY FIGURE IS FILED AND CHECKABLE
   The source is the charity's own Annual Information Statement, which the
   ACNC republishes as open data:

     data.gov.au → "ACNC <year> Annual Information Statement (AIS) Data"
     the row where `abn` = 16643085152 (AL ANWAAR CHARITY GROUP LTD)

   The columns map onto AIS fields one for one — `income` is "total gross
   income", `overseas` is "grants and donations made for use outside
   Australia", `other` is "all other expenses", `wages` is "employee
   expenses", `total` is "total expenses". In every year filed, `overseas +
   other` equals `total` to the dollar, which is what makes a two-part split
   honest rather than a simplification.

   THE WORD "AUDITED" DOES NOT APPEAR, AND MUST NOT
   Al-Anwaar is a SMALL charity under the ACNC's thresholds in every year it
   has filed. A small charity is not required to lodge a financial report and
   this one has not lodged any, so there is no auditor to name and no signed
   report to date. These are self-reported figures on a cash basis. That is
   printed under the table rather than left off it — a page inviting people to
   check the register cannot afford to imply an audit the register does not
   show.

   THE BAD YEAR STAYS IN
   2024 spent more than it raised and the reserves took the difference. 2021
   sent nothing anywhere, because the charity was three months old. Leaving
   either off would make the other three years worth less, not more.

   TODO
     - The 2025 statement (year ended 30 June 2025) is not in the open data
       yet. Add a row when it lands; everything on the page follows it,
       including the headline share.
     - Filing has been running late — the 2024 statement was due 31 Jan 2025
       and was received 15 May 2026, which is why the freshest year here is
       two years old. Not printed, but a reader who opens the register will
       see it.
     - When the ACNC register permalink for this charity is to hand (a GUID
       URL, copied out of the register by eye), put it in SOURCES below and
       the source line links straight to the profile.
--------------------------------------------------------------------------- */

export type FinancialYear = {
  /** the financial year, named for the June it ends in */
  fy: number
  /** "total gross income" */
  income: number
  /** "grants and donations made for use outside Australia" */
  overseas: number
  /** "all other expenses" — the only running-cost line the AIS has, and it
   *  does not break down, so admin and fundraising cannot be split apart */
  other: number
  /** "employee expenses". Zero in every year so far, which is the point. */
  wages: number
  /** "total expenses", and `overseas + other` agrees with it every year */
  total: number
  /** "staff - volunteers" */
  volunteers: number
}

export const ACCOUNTS: FinancialYear[] = [
  { fy: 2021, income: 3700, overseas: 0, other: 2512, wages: 0, total: 2512, volunteers: 3 },
  {
    fy: 2022,
    income: 217005,
    overseas: 183817,
    other: 11681,
    wages: 0,
    total: 195498,
    volunteers: 5,
  },
  {
    fy: 2023,
    income: 244275,
    overseas: 233384,
    other: 1646,
    wages: 0,
    total: 235030,
    volunteers: 6,
  },
  {
    fy: 2024,
    income: 146535,
    overseas: 149481,
    other: 8381,
    wages: 0,
    total: 157862,
    volunteers: 5,
  },
]

/** The most recent year filed. The headline reads this one. */
export const LATEST = ACCOUNTS[ACCOUNTS.length - 1]

/** Everything sent overseas since the charity was registered. Printed in the
 *  places section so the indicative column has the real total standing beside
 *  it rather than being quietly compared to nothing. */
export const TOTAL_OVERSEAS = ACCOUNTS.reduce((sum, y) => sum + y.overseas, 0)

export const money = (v: number) => '$' + v.toLocaleString('en-AU')
export const share = (y: FinancialYear) => ((y.overseas / y.total) * 100).toFixed(1)

/* ===========================================================================
   Section 3 — the five places, and section 4 — the log
   ===========================================================================

   NO PHOTOGRAPHS IN THIS SECTION, DELIBERATELY
   The obvious design is five country cards with a field photograph on each,
   and it cannot be built honestly. We own frames from Yemen and The Gambia
   and none at all from Gaza, Lebanon or Syria — the only images of those
   three in the repository are licensed stock heroes, and the site's rule is
   that stock is never captioned as our own field work. Two rows with
   photographs and three without reads as three broken rows. So the section is
   type and figures, like the table above it: this is the auditor's page, the
   photographs are on the home page's impact rail and on About, and a ledger
   is the idiom the About page already established for facts that can be
   checked.

   `distributions` is the dated record, and it is the thing the whole page is
   waiting on. Every entry in it today is dated off our own photographs or off
   the About ledger, which is where those dates were established. When the
   field team's log arrives it goes here, and section 4 — which renders
   nothing while the list is thin — fills out by itself.

   TODO
     - GAZA HOLDS NO DATED RECORD AT ALL. It has appeals, it is in every
       country list on the site, and there is not one dated distribution or
       one photograph behind it. Its row says so on screen rather than
       carrying an empty space. This is the first gap to close.
     - Syria is nearly as thin: one undated line.
     - Four of the five places cannot name a partner. See PARTNERS.
     - The camp meals of March 2024 are captioned by what is visibly in the
       frame; nothing on the file says which border it was taken on, so the
       entry sits under Lebanon with the place left vague. Confirm or move it.
--------------------------------------------------------------------------- */

export type Entry = {
  /** As it should read on the page. Undated work does not get an entry. */
  date: string
  /** Sorts the log. ISO, and the day is only as precise as we can defend. */
  iso: string
  /** What went out. No counts — nobody has counted them. */
  what: string
  /** Narrower than the country, where we can say it. */
  where?: string
  /** A key of PARTNERS, where one is named. */
  partner?: string
  /** How the date is known, in three or four words. Printed in the log, so
   *  every line carries its own provenance rather than one blanket claim. */
  source: string
}

export type Place = {
  /** the anchor the header menu links to: /where-it-goes#gaza */
  id: string
  name: string
  /** Where it sits in the sentence "working in ___ since". Omitted where we
   *  hold nothing that dates the start. */
  since?: string
  /** The kinds of work, in the order they started. No counts. */
  work: string[]
  /** PLACEHOLDER. See the fence at the top of this file. Five round numbers
   *  that do not reconcile to TOTAL_OVERSEAS and must not be made to. */
  indicative: number
  /** The dated record. Empty is allowed and says something true. */
  distributions: Entry[]
  /** Where the appeals menu sends someone who wants to give here. */
  to: string
  /** Drawn in place of the evidence line when there is no evidence. One
   *  sentence, in the charity's own voice, admitting the gap. */
  gap?: string
}

export const PLACES: Place[] = [
  {
    id: 'gaza',
    name: 'Gaza',
    work: ['Emergency relief', 'Hot meals'],
    indicative: 120000,
    distributions: [],
    to: '/appeals?country=gaza',
    gap: 'We hold no dated distribution record and no photograph from Gaza. Two appeals on this site raise money for it, so this is the gap that matters most, and it is being closed with the field team before the figure above is confirmed.',
  },
  {
    id: 'yemen',
    name: 'Yemen',
    since: 'December 2021',
    work: ['Food packs', 'Water by tanker', 'Water stations'],
    indicative: 210000,
    distributions: [
      {
        date: 'December 2021',
        iso: '2021-12-23',
        what: 'Food baskets and meat, packed and handed over, the first distribution the charity made',
        where: 'Tarim, Hadhramaut',
        source: 'dated off our own photograph',
      },
      {
        date: 'Ramadan 2022',
        iso: '2022-04-26',
        what: 'Food packages across Yemen',
        partner: 'alaf',
        source: 'dated off our own photograph',
      },
      {
        date: 'May 2022',
        iso: '2022-05-01',
        what: 'Water by tanker, families filling jerry cans and buckets from the truck',
        source: 'dated off our own photograph',
      },
      {
        date: '2022',
        iso: '2022-06-05',
        what: 'The first standing water stations, so the tanker did not have to keep coming back',
        source: 'dated off our own photograph',
      },
    ],
    to: '/appeals?country=yemen',
  },
  {
    id: 'lebanon',
    name: 'Lebanon',
    since: '2023',
    work: ['Food packs', 'Clean water', 'Eid clothes', 'Hot meals'],
    indicative: 95000,
    distributions: [
      {
        date: '2023',
        iso: '2023-06-01',
        what: 'Food packs, clean water and Eid clothes for children, and the first monthly subscriptions, which are what let a partner sign a lease or hire a driver',
        source: 'from the previous site’s campaign pages',
      },
      {
        date: 'March 2024',
        iso: '2024-03-01',
        what: 'Cooked meals handed out at a displacement camp in the days before Ramadan',
        where: 'A displacement camp; the border is not recorded',
        source: 'dated off our own photograph',
      },
    ],
    to: '/appeals?country=lebanon',
  },
  {
    id: 'syria',
    name: 'Syria',
    work: ['Food packs'],
    indicative: 40000,
    distributions: [],
    to: '/appeals?country=syria',
    gap: 'Syria is named in our country list and we hold nothing dated behind it. Until the field team sends the log, that is all this row can honestly say.',
  },
  {
    id: 'gambia',
    name: 'The Gambia',
    since: 'July 2022',
    work: ['A masjid', 'A Quran school'],
    indicative: 65000,
    distributions: [
      {
        date: 'July 2022',
        iso: '2022-07-29',
        what: 'A masjid, and a Quran school beside it, the first sadaqah jariyah we took on, and the point at which the work stopped being only relief',
        where: 'Jamee Muzafah',
        source: 'dated off our own photograph',
      },
    ],
    to: '/appeals?country=gambia',
  },
]

/** Every dated line the site holds, newest first, with its place attached.
 *  Section 4 reads this and renders nothing while it is thin. */
export const LOG = PLACES.flatMap((p) =>
  p.distributions.map((entry) => ({ ...entry, place: p.name, placeId: p.id })),
).sort((a, b) => b.iso.localeCompare(a.iso))

/** The five indicative figures added up, so the section can print the sum and
 *  say in the same breath that it is not the filed total. Deriving it rather
 *  than typing it means the disclaimer cannot go stale if a figure changes. */
export const TOTAL_INDICATIVE = PLACES.reduce((sum, p) => sum + p.indicative, 0)

/* ===========================================================================
   Section 5 — who delivers it
   ===========================================================================

   ONE PARTNER CAN BE NAMED AND FOUR CANNOT
   Alaf Foundation for Development is named because we photograph their banner
   rather than crop it out, which is the About page's line and is true. The
   other four places are delivered by people we have not been given names for.
   Writing "our trusted local partners" over that gap is the sentence every
   charity website uses and it means nothing; the section says how many we can
   name and how many we cannot, and the count comes off the array so it cannot
   drift.

   TODO — the four names, and for each: what they are registered as where they
   are, how long we have worked with them, and whether anybody from Al-Anwaar
   has stood in the room. Until then ROUTINE below describes a practice, and a
   practice with one named example is worth more than five unnamed logos.
--------------------------------------------------------------------------- */

export type Partner = {
  id: string
  name: string
  place: string
  /** What they do, and how we know them. */
  body: string
}

export const PARTNERS: Partner[] = [
  {
    id: 'alaf',
    name: 'Alaf Foundation for Development',
    place: 'Yemen',
    body: 'Our delivery partner for food packages across Yemen since Ramadan 2022. We photograph their banner at the handover rather than crop it out, because we do not deliver anonymously and the people receiving a pack should be able to see whose hands it came through.',
  },
]

/** How the work is done, wherever it is done. Three sentences, and all three
 *  were established on the About page off the first distribution in Tarim. */
export const ROUTINE = [
  {
    title: 'Bought in the country it is delivered in',
    body: 'The money moves faster than goods would, it costs less by the time it arrives, and it is spent in the economy of the place it is meant to help rather than on freight out of Australia.',
  },
  {
    title: 'Delivered by somebody who lives there',
    body: 'Not by a team flown in for a week. A partner who is still there next month is the only kind who can be held to anything, and the only kind who knows which families were missed last time.',
  },
  {
    title: 'Photographed at the handover',
    body: 'A photograph is only proof if it says where and when. Every date in the log on this page is read off one, and where we hold no photograph the log says so instead of filling the space.',
  },
]

/* ===========================================================================
   Section 6 — what we file, and where to read it
   ===========================================================================

   THERE ARE NO ANNUAL REPORTS, AND THE MENU LINKS TO "ANNUAL REPORTS &
   FINANCIALS"
   A small charity is not required to lodge a financial report and Al-Anwaar
   has not lodged one, so a shelf of report covers would be advertising
   documents that do not exist. What it does lodge is an Annual Information
   Statement every year, and the ACNC republishes all of them as open data. So
   this section hands over the sources themselves — the register, and the
   dataset for each year — and lets anyone rebuild the table in section 2 from
   scratch. The CSV button at the foot of it writes out ACCOUNTS as filed, so
   the arithmetic can be checked in a spreadsheet rather than taken on trust.

   TODO
     - `register` is the ACNC's charity search, filtered as far as a plain URL
       can be. The direct profile permalink is a GUID that has to be copied out
       of the register by eye; when somebody does that, it replaces this.
     - the 2025 dataset lands when the 2025 statement is processed.
--------------------------------------------------------------------------- */

export type Source = {
  label: string
  /** What a reader will actually find when they get there. */
  note: string
  href: string
}

export const REGISTER_SEARCH =
  'https://www.acnc.gov.au/charity/charities?search=Al-Anwaar%20Charity%20Group'

export const SOURCES: Source[] = [
  {
    label: 'Our entry on the ACNC charity register',
    note: 'Registration status, the responsible persons, the governing document, and every statement we have lodged.',
    href: REGISTER_SEARCH,
  },
  {
    label: 'Annual Information Statement data, by year',
    note: 'The ACNC publishes every charity’s statement as open data. Find the row where the ABN is 16 643 085 152 and every figure in the table above is in it.',
    href: 'https://data.gov.au/dataset?q=ACNC+Annual+Information+Statement',
  },
  {
    label: 'ABN Lookup',
    note: 'The ABN, the entity type, the GST registration and the deductible gift recipient endorsement, from the Australian Business Register.',
    href: 'https://abr.business.gov.au/ABN/View?abn=16643085152',
  },
]

/** The accounts table as a CSV, built from the same array the table renders
 *  from, so a downloaded file can never disagree with the printed one. */
export function accountsCsv(): string {
  const head = [
    'Year ended 30 June',
    'Total gross income',
    'Grants and donations made for use outside Australia',
    'All other expenses',
    'Employee expenses',
    'Total expenses',
    'Volunteers',
  ]
  const rows = ACCOUNTS.map((y) => [y.fy, y.income, y.overseas, y.other, y.wages, y.total, y.volunteers])
  return [head, ...rows].map((r) => r.join(',')).join('\n')
}

/* ===========================================================================
   Section 7 — registration
   ===========================================================================
   Moved off the footer: the registration facts, written out as sentences a
   donor can check rather than as a wall of badges. The footer's "ACNC, ABN &
   DGR" link lands on #registration.

   TODO: org-data.ts holds the legal name, ABN, registration date, address and
   email, and this list still carries its own copies. Point it there — the top
   of org-data.ts already notes that this file and Footer.tsx both need to be.
   Its other open item matters here too: the register's business address is
   70 Oxford St, Guildford, and this says Silverwater.
--------------------------------------------------------------------------- */

export const FACTS = [
  { label: 'Legal name', value: 'Al-Anwaar Charity Group Ltd' },
  { label: 'ABN', value: '16 643 085 152', nums: true },
  {
    label: 'ACNC registration',
    value: 'Registered 30 July 2020, as a public benevolent institution',
    nums: true,
  },
  {
    label: 'Tax status',
    value: 'Deductible gift recipient, item 1. Gifts of $2 and over are tax deductible',
  },
  { label: 'Registered office', value: '11 Egerton St, Silverwater NSW 2128' },
  { label: 'Email', value: 'info@alanwaar.group' },
]
