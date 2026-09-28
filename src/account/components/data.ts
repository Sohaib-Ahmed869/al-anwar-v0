import { useQuery } from '@tanstack/react-query'
import type { Address, Donor, Fundraiser, Gift, Plan, Settings } from '../../../shared/types'
import { api } from '../../portal/api'
import { useDocumentTitle } from '../../portal/ui'

/* ---------------------------------------------------------------------------
   The donor portal's view of /api/me: the response shapes, the query keys,
   and the few hooks more than one page uses. Every key starts with 'me' so a
   change anywhere can refresh the whole account with one
   invalidateQueries({ queryKey: ['me'] }) — a donor's data is small, and a
   stale total on the overview after cancelling a gift would look like a bug.
--------------------------------------------------------------------------- */

export type MeDonor = Omit<Donor, 'tags' | 'source' | 'notes' | 'status' | 'mergedInto' | 'bankAliases'> & {
  linked: { google: boolean; facebook: boolean }
}

export type MyGift = Omit<Gift, 'donorName' | 'enteredBy' | 'enteredByName' | 'notes'> & {
  appealSlug?: string
  appealOpen?: boolean
}

export type MyPlan = Omit<Plan, 'donorName'>

export type StatementYear = { fy: number; total: number; count: number; label?: string; complete?: boolean }

export type Overview = {
  donor: MeDonor
  fy: number
  totals: { lifetime: number; thisFy: number; lastFy: number; giftCount: number; appealsSupported: number; countries: string[] }
  impact: { count: number; label: string; appealTitle: string; appealSlug: string }[]
  plans: MyPlan[]
  failing: MyPlan[]
  recentGifts: MyGift[]
  statements: StatementYear[]
  fundraisers: { count: number; live: number; raised: number; featured: Fundraiser | null }
}

export type GiftPage = { items: MyGift[]; total: number; page: number; pageSize: number; sum: number; sumCount: number }

export type DocDonor = { name: string; number: string; email: string; address: Address | null }

export type StatementDoc = {
  /** null for a statement over dates the donor chose */
  fy: number | null
  range?: { from: string; to: string }
  label: string
  period: { from: string; to: string }
  complete: boolean
  issuedAt: string
  org: Settings['org']
  receipts: Settings['receipts']
  donor: DocDonor
  gifts: { id: string; date: string; number: string; receiptNumber: string; appealTitle?: string; fundraiserTitle?: string; designation: Gift['designation']; method: Gift['method']; amount: number; fee: number }[]
  byDesignation: { designation: Gift['designation']; label: string; total: number; count: number }[]
  totals: { amount: number; fees: number; total: number; count: number }
}

export type ReceiptDoc = { gift: MyGift; donor: DocDonor; org: Settings['org']; receipts: Settings['receipts'] }

export type MyFundraiser = Fundraiser & { pendingAmount?: number }
export type OpenAppeal = { id: string; title: string; slug: string; summary?: string; country: string; image?: string; target: number; raised: number }

export const keys = {
  all: ['me'] as const,
  overview: ['me', 'overview'] as const,
  gifts: (params: Record<string, unknown>) => ['me', 'gifts', params] as const,
  gift: (id: string) => ['me', 'gift', id] as const,
  statements: ['me', 'statements'] as const,
  statement: (fy: number) => ['me', 'statement', fy] as const,
  rangeStatement: (from: string, to: string) => ['me', 'statement', 'range', from, to] as const,
  receipt: (id: string) => ['me', 'receipt', id] as const,
  plans: ['me', 'plans'] as const,
  plan: (id: string) => ['me', 'plan', id] as const,
  fundraisers: ['me', 'fundraisers'] as const,
  fundraiser: (id: string) => ['me', 'fundraiser', id] as const,
  appeals: ['me', 'appeals'] as const,
  profile: ['me', 'profile'] as const,
}

export const useOverview = () => useQuery({ queryKey: keys.overview, queryFn: () => api.get<Overview>('/me/overview') })

export const useStatements = () =>
  useQuery({ queryKey: keys.statements, queryFn: () => api.get<{ items: StatementYear[]; current: number }>('/me/gifts/statements') })

export const usePlans = () =>
  useQuery({ queryKey: keys.plans, queryFn: () => api.get<{ items: MyPlan[]; simulated: boolean }>('/me/plans') })

/** "/give?appeal=…&designation=…&amount=…" — the website's give form reads
 *  all three from the link, so "Give again" lands on a filled-in form. */
export function giveAgainHref(g: { appealSlug?: string; designation?: string; amount?: number }) {
  const q = new URLSearchParams()
  if (g.appealSlug) q.set('appeal', g.appealSlug)
  if (g.designation) q.set('designation', g.designation)
  if (g.amount) q.set('amount', String(Math.round(g.amount / 100)))
  const s = q.toString()
  return s ? `/give?${s}` : '/give'
}

/** The browser tab: "Regular gifts · Al-Anwaar". */
export const useTitle = (t: string | undefined) => useDocumentTitle(t, 'Al-Anwaar')
