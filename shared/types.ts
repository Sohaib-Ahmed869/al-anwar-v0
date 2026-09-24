/* ---------------------------------------------------------------------------
   What the API sends and receives.

   TWO RULES THAT HOLD EVERYWHERE
     - Money is integer CENTS. `amount: 5000` is fifty dollars. Floats never
       carry money between the server and a screen; `formatMoney` in
       shared/money.ts is the only place cents become dollars.
     - Dates cross the wire as ISO strings.

   Lists come back as `Page<T>`, errors as `{ error: { message, fields? } }`.
--------------------------------------------------------------------------- */

import type {
  AppealStatus, BankLineStatus, CampaignStatus, Designation, DocumentCategory, EmailTopic,
  EnquiryStatus, EnquiryType, Frequency, FundraiserOccasion, FundraiserStatus, GiftStatus,
  Method, ObligationCategory, PlanKind, PlanStatus, Recurrence, Segment,
} from './domain'
import type { Permission, Role } from './access'

export type ID = string
export type ISODate = string

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number }

export type ApiError = { error: { message: string; fields?: Record<string, string> } }

export type Address = {
  line1?: string
  line2?: string
  suburb?: string
  state?: string
  postcode?: string
  country?: string
}

/* ---------- people ---------- */
export type DonorPreferences = {
  emailOptIn: boolean
  topics: EmailTopic[]
  /** keep their name off public lists by default */
  anonymous: boolean
}

export type Donor = {
  id: ID
  /** human-facing, e.g. D-10234 */
  number: string
  firstName: string
  lastName: string
  email: string
  altEmails: string[]
  phone?: string
  address?: Address
  preferences: DonorPreferences
  tags: string[]
  source: 'web' | 'import' | 'offline' | 'bank' | 'fundraiser'
  notes?: string
  status: 'active' | 'merged'
  mergedInto?: ID
  /** payer names seen on bank statements, learnt when a line is confirmed */
  bankAliases: string[]
  /* kept current by the server after every gift change */
  totalGiven: number
  giftCount: number
  firstGiftAt?: ISODate
  lastGiftAt?: ISODate
  hasActivePlan: boolean
  createdAt: ISODate
}

export type StaffUser = {
  id: ID
  name: string
  email: string
  role: Role
  active: boolean
  passwordSet: boolean
  lastLoginAt?: ISODate
  invitedAt?: ISODate
  createdAt: ISODate
}

export type Session =
  | { kind: 'staff'; user: StaffUser; permissions: Permission[] }
  | { kind: 'donor'; donor: Donor }

/* ---------- money in ---------- */
export type Receipt = {
  number: string
  issuedAt: ISODate
  emailedAt?: ISODate
  resent: number
}

export type Gift = {
  id: ID
  number: string
  donor: ID
  donorName: string
  appeal?: ID
  appealTitle?: string
  country?: string
  fundraiser?: ID
  fundraiserTitle?: string
  plan?: ID
  /** the gift, before any fee the donor chose to cover */
  amount: number
  /** the fee the donor covered, 0 if none */
  fee: number
  designation: Designation
  method: Method
  status: GiftStatus
  /** when the money was received, or the pledge made for a pending transfer */
  date: ISODate
  /** the bank reference shown to the donor, for transfers */
  reference?: string
  receipt?: Receipt
  anonymous: boolean
  message?: string
  source: 'online' | 'offline' | 'bank' | 'recurring'
  enteredBy?: ID
  enteredByName?: string
  notes?: string
  failureReason?: string
  createdAt: ISODate
}

export type PaymentMethodSummary = {
  method: 'card' | 'paypal'
  brand?: string
  last4?: string
  expMonth?: number
  expYear?: number
}

export type Plan = {
  id: ID
  number: string
  donor: ID
  donorName: string
  appeal?: ID
  appealTitle?: string
  designation: Designation
  amount: number
  coverFee: boolean
  frequency: Frequency
  kind: PlanKind
  instalments?: { total: number; paid: number }
  status: PlanStatus
  startDate: ISODate
  nextChargeAt?: ISODate
  lastChargeAt?: ISODate
  pausedUntil?: ISODate
  failure?: { count: number; lastError?: string; firstFailedAt?: ISODate; nextRetryAt?: ISODate }
  payment: PaymentMethodSummary
  cancelledAt?: ISODate
  cancelReason?: string
  /** total collected so far */
  collected: number
  createdAt: ISODate
}

/* ---------- appeals and supporter pages ---------- */
export type SuggestedAmount = { amount: number; label?: string }

export type AppealUpdate = { id: ID; date: ISODate; title: string; body: string }

export type Appeal = {
  id: ID
  slug: string
  title: string
  summary: string
  story: string
  country: string
  where?: string
  causes: string[]
  zakatEligible: boolean
  target: number
  raised: number
  donorCount: number
  status: AppealStatus
  opensAt?: ISODate
  closesAt?: ISODate
  image?: string
  suggested: SuggestedAmount[]
  unit?: { name: string; plural: string; price: number }
  updates: AppealUpdate[]
  featured: boolean
  createdAt: ISODate
  updatedAt: ISODate
}

export type Fundraiser = {
  id: ID
  slug: string
  owner: ID
  ownerName: string
  appeal: ID
  appealTitle: string
  title: string
  story: string
  occasion: FundraiserOccasion
  target: number
  raised: number
  donorCount: number
  image?: string
  endsAt?: ISODate
  status: FundraiserStatus
  review?: { by: string; at: ISODate; note?: string }
  createdAt: ISODate
}

/* ---------- people writing in ---------- */
export type EnquiryNote = { id: ID; by: string; at: ISODate; body: string; kind: 'note' | 'reply' | 'status' }

export type Enquiry = {
  id: ID
  type: EnquiryType
  status: EnquiryStatus
  name: string
  email: string
  phone?: string
  subject?: string
  message: string
  donor?: ID
  assignedTo?: ID
  assignedName?: string
  /** anything else the form sent: availability, organisation, event name */
  meta: Record<string, string>
  notes: EnquiryNote[]
  createdAt: ISODate
  updatedAt: ISODate
}

/* ---------- email ---------- */
export type Campaign = {
  id: ID
  name: string
  subject: string
  preheader?: string
  body: string
  segment: Segment
  status: CampaignStatus
  scheduledAt?: ISODate
  stats: { recipients: number; sent: number; failed: number }
  sentAt?: ISODate
  createdByName?: string
  createdAt: ISODate
  updatedAt: ISODate
}

export type EmailMessage = {
  id: ID
  to: string
  subject: string
  template: string
  html: string
  status: 'queued' | 'sent' | 'failed'
  transport: 'smtp' | 'outbox'
  donor?: ID
  campaign?: ID
  error?: string
  createdAt: ISODate
  sentAt?: ISODate
}

/* ---------- bank import ---------- */
export type BankLine = {
  id: ID
  date: ISODate
  description: string
  reference?: string
  amount: number
  status: BankLineStatus
  match: {
    donor?: ID
    donorName?: string
    appeal?: ID
    appealTitle?: string
    designation: Designation
    /** 0 to 1 */
    confidence: number
    reasons: string[]
    /** the pending bank-transfer gift this line pays, when the reference matched one */
    pledge?: ID
    /** filled in by GET /imports/:id for the donor chip */
    donorNumber?: string
    /** the donor has no email address on file, so no receipt can be emailed */
    noEmail?: boolean
    /** when a name fits more than one donor: the people it could be */
    candidates?: { donor: ID; donorName: string; number: string }[]
  }
  gift?: ID
  /* filled in by GET /imports/:id, for display */
  /** the payer's name as read from the bank narrative ("A RAHMAN") */
  payer?: string
  pledgeInfo?: { number: string; amount: number; reference?: string; date: ISODate }
  giftInfo?: { number: string; receiptNumber?: string; emailed: boolean }
}

export type BankImport = {
  id: ID
  filename: string
  uploadedByName: string
  createdAt: ISODate
  status: 'review' | 'completed'
  completedAt?: ISODate
  counts: Partial<Record<BankLineStatus, number>>
  credits: number
  lines: BankLine[]
  /** the bank layout the file was read as */
  layout?: string
  /** money-out lines left out of the import */
  debitsSkipped?: number
  /** list view only: how many lines, and the sum of the saved ones */
  lineCount?: number
  savedTotal?: number
}

/* ---------- compliance ---------- */
export type RegisterEntry = {
  id: ID
  register: string
  fields: Record<string, string | number | boolean | null>
  archived: boolean
  updatedByName?: string
  createdAt: ISODate
  updatedAt: ISODate
}

export type Obligation = {
  id: ID
  title: string
  category: ObligationCategory
  description?: string
  dueDate: ISODate
  recurrence: Recurrence
  owner?: ID
  ownerName?: string
  reminderDays: number[]
  status: 'upcoming' | 'done'
  completedAt?: ISODate
  completedByName?: string
  completionNote?: string
  evidence: { document: ID; title: string }[]
  notes?: string
  createdAt: ISODate
}

export type DocVersion = {
  n: number
  fileName: string
  size: number
  mime: string
  uploadedByName: string
  uploadedAt: ISODate
  note?: string
}

export type LibraryDocument = {
  id: ID
  title: string
  category: DocumentCategory
  description?: string
  versions: DocVersion[]
  requiresAck: boolean
  acks: { staff: ID; name: string; version: number; at: ISODate }[]
  archived: boolean
  createdAt: ISODate
  updatedAt: ISODate
}

/* ---------- the record of everything ---------- */
export type AuditEvent = {
  id: ID
  at: ISODate
  actor: { kind: 'staff' | 'donor' | 'system'; id?: ID; name: string }
  action: string
  entity?: { type: string; id?: ID; label?: string }
  summary: string
  ip?: string
}

/* ---------- settings ---------- */
export type Settings = {
  org: {
    name: string
    abn: string
    dgr: boolean
    dgrNote: string
    email: string
    phone: string
    address: string
    website: string
  }
  receipts: { prefix: string; signatory: string; signatoryTitle: string; footer: string }
  bank: { accountName: string; bsb: string; accountNumber: string; bankName: string }
  payments: { feeRate: number; mode: 'live' | 'test' | 'simulated' }
  email: { fromName: string; fromEmail: string; replyTo: string }
  zakat: { nisab: number; nisabBasis: 'silver' | 'gold'; updatedAt: ISODate }
}
