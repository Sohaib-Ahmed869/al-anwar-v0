/* The shapes the dashboard and donor endpoints answer with
   (server/routes/admin/dashboard.ts and donors.ts). They are particular to
   these screens, so they live beside them rather than in shared/types.ts. */

import type { Designation, Method } from '../../../shared/domain'
import type { AuditEvent, Donor, Enquiry, Fundraiser, Gift, Plan } from '../../../shared/types'

export type Kpi = { value: number; previous?: number; delta?: number | null }

export type AttentionItem = {
  key: string
  tone: 'red' | 'amber' | 'teal' | 'neutral'
  count: number
  title: string
  detail?: string
  to: string
  action: string
}

export type MonthRow = {
  month: string
  total: number
  count: number
  byMethod: Partial<Record<Method, number>>
  byDesignation: Partial<Record<Designation, number>>
}

export type DashboardData = {
  generatedAt: string
  fy: number
  kpis: {
    raisedThisMonth: Kpi & { gifts: number }
    fyToDate: Kpi
    regular: { monthly: number; active: number }
    newDonors: Kpi
    returningDonors: Kpi
    lapsedDonors: Kpi
    averageGift: Kpi
  }
  sparks: { raised: number[]; newDonors: number[]; regular: number[]; averageGift: number[] }
  series: MonthRow[]
  appeals: { id: string; title: string; country: string; target: number; raised: number; donorCount: number; closesAt: string | null; last30: number }[]
  designations: { designation: Designation; total: number; count: number }[]
  recentGifts: Gift[]
  attention: AttentionItem[]
}

export type DonorSegment = 'all' | 'regular' | 'lapsed' | 'major' | 'new' | 'never'
export type SegmentCounts = Record<DonorSegment, number>

export type DonorRecord = {
  donor: Donor
  summary: {
    thisFy: { fy: number; total: number; count: number }
    byDesignation: { designation: Designation; total: number; count: number }[]
    byMethod: { method: Method; total: number; count: number }[]
    byYear: { fy: number; total: number; count: number }[]
    plans: Plan[]
    regularMonthly: number
    recentGifts: Gift[]
    enquiries: Enquiry[]
    fundraisers: Fundraiser[]
    emailsCount: number
    mergedFrom: Pick<Donor, 'id' | 'number' | 'firstName' | 'lastName' | 'email'>[]
  }
}

export type EmailRow = {
  id: string
  to: string
  subject: string
  template: string
  status: 'queued' | 'sent' | 'failed'
  transport: 'smtp' | 'outbox'
  error?: string
  createdAt: string
  sentAt?: string
  html?: string
}

export type ActivityRow = Omit<AuditEvent, 'ip'>

export type DupDonor = Pick<
  Donor,
  'id' | 'number' | 'firstName' | 'lastName' | 'email' | 'altEmails' | 'phone' | 'address' | 'totalGiven' | 'giftCount' | 'lastGiftAt' | 'firstGiftAt' | 'hasActivePlan' | 'createdAt'
>

export type DuplicatePair = { id: string; score: number; reasons: string[]; a: DupDonor; b: DupDonor }

export type CompareSide = {
  donor: Donor
  counts: { gifts: number; lifetime: number; plans: number; activePlans: number; enquiries: number; fundraisers: number; emails: number }
  recentGifts: Pick<Gift, 'id' | 'number' | 'amount' | 'date' | 'appealTitle' | 'designation' | 'status'>[]
}

export type CompareResponse = { a: CompareSide; b: CompareSide; score: number | null; reasons: string[] }

export const donorName = (d: { firstName: string; lastName?: string }) => `${d.firstName} ${d.lastName ?? ''}`.trim()

export const isMajor = (d: Pick<Donor, 'tags' | 'totalGiven'>) => d.tags.includes('major donor') || d.totalGiven >= 500_000

export const place = (d: Pick<Donor, 'address'>) => [d.address?.suburb, d.address?.state].filter(Boolean).join(' ')
