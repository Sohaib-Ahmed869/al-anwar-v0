/* ---------------------------------------------------------------------------
   The platform's vocabulary, written once and imported by both the server and
   the three portals. Nothing in here may touch `window`, `process` or a
   Node module: the browser bundle and the API both compile it.

   If a label changes here it changes on every screen, every CSV and every
   receipt at once — which is the point.
--------------------------------------------------------------------------- */

/* ---------- what a gift is for ----------
   Every gift carries one, and it stays on the gift through to the reports so
   the office can always show how much zakat came in and where it went. */
export const DESIGNATIONS = {
  general: { label: 'General', short: 'General', tone: 'neutral' },
  sadaqah: { label: 'Sadaqah', short: 'Sadaqah', tone: 'green' },
  zakat: { label: 'Zakat ul Maal', short: 'Zakat', tone: 'teal' },
  zakat_fitr: { label: 'Zakat ul Fitr', short: 'Fitr', tone: 'teal' },
  lillah: { label: 'Lillah', short: 'Lillah', tone: 'violet' },
  kaffarah: { label: 'Kaffarah', short: 'Kaffarah', tone: 'amber' },
  fidyah: { label: 'Fidyah', short: 'Fidyah', tone: 'amber' },
} as const
export type Designation = keyof typeof DESIGNATIONS
export const DESIGNATION_KEYS = Object.keys(DESIGNATIONS) as Designation[]

/* ---------- how the money arrived ---------- */
export const METHODS = {
  card: { label: 'Card', online: true },
  paypal: { label: 'PayPal', online: true },
  bank: { label: 'Bank transfer', online: false },
  cash: { label: 'Cash', online: false },
  cheque: { label: 'Cheque', online: false },
  event: { label: 'At an event', online: false },
} as const
export type Method = keyof typeof METHODS
export const METHOD_KEYS = Object.keys(METHODS) as Method[]
export const OFFLINE_METHODS: Method[] = ['cash', 'cheque', 'event', 'bank']

export const GIFT_STATUSES = {
  succeeded: { label: 'Paid', tone: 'green' },
  pending: { label: 'Awaiting transfer', tone: 'amber' },
  failed: { label: 'Failed', tone: 'red' },
  refunded: { label: 'Refunded', tone: 'neutral' },
} as const
export type GiftStatus = keyof typeof GIFT_STATUSES

/* ---------- regular giving ---------- */
export const FREQUENCIES = {
  weekly: { label: 'Weekly', per: 'a week', days: 7, perYear: 52 },
  fortnightly: { label: 'Fortnightly', per: 'a fortnight', days: 14, perYear: 26 },
  monthly: { label: 'Monthly', per: 'a month', days: 0, perYear: 12 },
} as const
export type Frequency = keyof typeof FREQUENCIES
export const FREQUENCY_KEYS = Object.keys(FREQUENCIES) as Frequency[]

export const PLAN_STATUSES = {
  active: { label: 'Active', tone: 'green' },
  paused: { label: 'Paused', tone: 'amber' },
  past_due: { label: 'Payment failed', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  completed: { label: 'Completed', tone: 'teal' },
} as const
export type PlanStatus = keyof typeof PLAN_STATUSES

/** A plan runs until cancelled, or a larger gift is split into a set number of
 *  payments and completes on its own. */
export type PlanKind = 'recurring' | 'instalment'

/** How many times a declined card is tried again, and how many days after the
 *  first failure each retry happens. After the last one the plan stops and the
 *  office is told. */
export const RETRY_SCHEDULE_DAYS = [1, 3, 7]

/** Donors are emailed this many days before each regular payment is taken. */
export const PRE_CHARGE_NOTICE_DAYS = 3

/* ---------- appeals ---------- */
export const APPEAL_STATUSES = {
  draft: { label: 'Draft', tone: 'neutral' },
  open: { label: 'Open', tone: 'green' },
  closed: { label: 'Closed', tone: 'teal' },
} as const
export type AppealStatus = keyof typeof APPEAL_STATUSES

export const COUNTRIES: Record<string, string> = {
  gaza: 'Gaza',
  yemen: 'Yemen',
  lebanon: 'Lebanon',
  syria: 'Syria',
  gambia: 'The Gambia',
  bangladesh: 'Bangladesh',
  australia: 'Australia',
}

/* `unverified`: started from the public form by someone not signed in, and
   waiting for the organiser to confirm the email address by the link we sent.
   Nobody else sees it — not the public, not the approval queue — and it is
   deleted after 7 days if the link is never used (server/lib/sweeps.ts). */
export const FUNDRAISER_STATUSES = {
  unverified: { label: 'Waiting for email confirmation', tone: 'neutral' },
  pending: { label: 'Awaiting approval', tone: 'amber' },
  live: { label: 'Live', tone: 'green' },
  changes: { label: 'Changes requested', tone: 'violet' },
  rejected: { label: 'Not approved', tone: 'red' },
  ended: { label: 'Ended', tone: 'neutral' },
} as const
export type FundraiserStatus = keyof typeof FUNDRAISER_STATUSES

export const FUNDRAISER_OCCASIONS = {
  wedding: 'Wedding',
  birthday: 'Birthday',
  walk: 'Walk, run or challenge',
  workplace: 'Workplace appeal',
  memory: 'In memory',
  ramadan: 'Ramadan',
  other: 'Something else',
} as const
export type FundraiserOccasion = keyof typeof FUNDRAISER_OCCASIONS

/* ---------- enquiries ---------- */
export const ENQUIRY_TYPES = {
  contact: { label: 'Message', tone: 'neutral' },
  volunteer: { label: 'Volunteer', tone: 'green' },
  partner: { label: 'Partner', tone: 'teal' },
  event: { label: 'Event sign-up', tone: 'violet' },
  fundraising: { label: 'Fundraising', tone: 'amber' },
} as const
export type EnquiryType = keyof typeof ENQUIRY_TYPES

export const ENQUIRY_STATUSES = {
  new: { label: 'New', tone: 'amber' },
  open: { label: 'In progress', tone: 'teal' },
  closed: { label: 'Closed', tone: 'neutral' },
} as const
export type EnquiryStatus = keyof typeof ENQUIRY_STATUSES

/* ---------- email campaigns ---------- */
export const CAMPAIGN_STATUSES = {
  draft: { label: 'Draft', tone: 'neutral' },
  scheduled: { label: 'Scheduled', tone: 'violet' },
  sending: { label: 'Sending', tone: 'amber' },
  sent: { label: 'Sent', tone: 'green' },
} as const
export type CampaignStatus = keyof typeof CAMPAIGN_STATUSES

/** Topics a donor can choose to hear about, on their profile. */
export const EMAIL_TOPICS = {
  appeals: 'New appeals and emergencies',
  reports: 'Where the money went',
  ramadan: 'Ramadan and Dhul Hijjah',
  events: 'Events near me',
} as const
export type EmailTopic = keyof typeof EMAIL_TOPICS

/** Who a campaign goes to. Every filter is optional; together they AND. */
export type Segment = {
  /** only donors with an active regular gift */
  regular?: boolean
  /** gave to an appeal in one of these countries */
  countries?: string[]
  /** gave to one of these appeals (ids) */
  appeals?: string[]
  /** gave with one of these designations */
  designations?: Designation[]
  /** last gift more than this many months ago */
  lapsedMonths?: number
  /** gave at least once in the last N months */
  activeMonths?: number
  /** lifetime total at least this */
  minTotal?: number
  /** subscribed to this topic */
  topic?: EmailTopic
}

/* ---------- bank import ---------- */
export const BANK_LINE_STATUSES = {
  matched: { label: 'Matched', tone: 'green' },
  review: { label: 'Needs a look', tone: 'amber' },
  unmatched: { label: 'Unmatched', tone: 'red' },
  ignored: { label: 'Ignored', tone: 'neutral' },
  duplicate: { label: 'Already imported', tone: 'neutral' },
  confirmed: { label: 'Saved', tone: 'teal' },
} as const
export type BankLineStatus = keyof typeof BANK_LINE_STATUSES

/** The reference a donor is shown on screen when they choose bank transfer.
 *  The matcher looks for exactly this shape in a statement line. */
export const BANK_REF_PREFIX = 'AA'
export const BANK_REF_PATTERN = /\bAA[-\s]?([A-HJ-NP-Z2-9]{6})\b/i

/* ---------- compliance ---------- */
export const OBLIGATION_CATEGORIES = {
  acnc: { label: 'ACNC', tone: 'teal' },
  ato: { label: 'ATO', tone: 'violet' },
  fundraising: { label: 'Fundraising', tone: 'amber' },
  governance: { label: 'Governance', tone: 'green' },
  insurance: { label: 'Insurance', tone: 'neutral' },
  other: { label: 'Other', tone: 'neutral' },
} as const
export type ObligationCategory = keyof typeof OBLIGATION_CATEGORIES

export const RECURRENCES = {
  none: 'Once',
  monthly: 'Every month',
  quarterly: 'Every quarter',
  annual: 'Every year',
} as const
export type Recurrence = keyof typeof RECURRENCES

export const DOCUMENT_CATEGORIES = {
  policy: 'Policy',
  governance: 'Governance',
  agreement: 'Partner agreement',
  audit: 'Audit and review',
  report: 'Report',
  acnc: 'ACNC lodgement',
  other: 'Other',
} as const
export type DocumentCategory = keyof typeof DOCUMENT_CATEGORIES

/* ---------- tones ----------
   Every status above names a tone rather than a colour, and the UI kit's Badge
   owns what each tone looks like. */
export type Tone = 'neutral' | 'green' | 'teal' | 'amber' | 'red' | 'violet' | 'gold'

/* ---------- the charity's calendar: Sydney ----------
   Every date that matters to a donor or the ATO — which financial year a gift
   falls in, the day printed on a receipt — is a date in Sydney, where the
   charity is. This file runs on the server AND in browsers anywhere, so it
   never asks the machine for its zone (getMonth(), new Date(y, m, d)): a
   donor in London, or a server in UTC, would get a different answer at the
   edges of the day. It asks for Sydney by name instead. (The server process
   is pinned to Sydney too — server/env.ts — but this must not depend on it.) */
export const ORG_TZ = 'Australia/Sydney'

const sydneyFmt = new Intl.DateTimeFormat('en-AU', {
  timeZone: ORG_TZ,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
})

/** An instant's date and time on Sydney's calendar (month 1–12). */
export function sydneyParts(d: Date | string) {
  const parts = Object.fromEntries(sydneyFmt.formatToParts(new Date(d)).map((p) => [p.type, p.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

/** Sydney's calendar date of an instant, as yyyy-mm-dd. */
export function sydneyDay(d: Date | string): string {
  const p = sydneyParts(d)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** The instant a Sydney calendar day begins (month 1–12). Midnight never falls
 *  in a daylight-saving jump in Sydney (they happen at 2am and 3am), so it
 *  always exists and is unique. */
export function sydneyMidnight(year: number, month: number, day: number): Date {
  const wall = Date.UTC(year, month - 1, day)
  let t = wall
  /* the offset depends on the instant, which depends on the offset: two
     rounds settle it, since midnight is hours away from any changeover */
  for (let i = 0; i < 2; i++) {
    const p = sydneyParts(new Date(t))
    const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - t
    t = wall - offset
  }
  return new Date(t)
}

/* ---------- the Australian financial year ----------
   July to June. "FY2026" is 1 July 2025 to 30 June 2026, which is the year a
   tax statement covers and the year the AIS reports on — in Sydney: a gift at
   9am on 1 July in Sydney is still 30 June in UTC, and belongs to the new
   year. */
export function fyOf(d: Date | string): number {
  const { year, month } = sydneyParts(d)
  return month >= 7 ? year + 1 : year
}
/** From Sydney midnight on 1 July to Sydney midnight a year later (exclusive). */
export function fyRange(fy: number): { from: Date; to: Date } {
  return { from: sydneyMidnight(fy - 1, 7, 1), to: sydneyMidnight(fy, 7, 1) }
}
export const fyLabel = (fy: number) => `${fy - 1}–${String(fy).slice(2)}`
