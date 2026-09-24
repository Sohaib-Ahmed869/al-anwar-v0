/* What the compliance API sends back, as the pages read it. The stored shapes
   are in shared/types.ts; these are those plus what the server works out on
   each read (a register entry's review state, an obligation's days left, a
   document's "have I read it"). */

import type { DocVersion, ID, ISODate, LibraryDocument, Obligation, Page, RegisterEntry, AuditEvent } from '../../../shared/types'

export type EntryView = RegisterEntry & {
  title: string
  reviewDue: boolean
  riskScore?: number | null
  riskBand?: RiskBand | null
}
export type RegisterPage = Page<EntryView> & { archived: number }
export type Change = { field: string; label: string; from: string; to: string }
export type EventView = AuditEvent & { href: string | null; changes?: Change[]; meta?: { changes?: Change[] } }
export type EntryDetail = EntryView & { history: EventView[] }

export type RiskBand = 'low' | 'medium' | 'high' | 'extreme'

export type ObligationState = 'overdue' | 'due-soon' | 'upcoming' | 'done'
export type ObligationView = Obligation & {
  state: ObligationState
  daysLeft: number
  remindersSent: number[]
  completionNote?: string
}

export type Owner = { id: ID; name: string; role: string }

export type DocSummary = Omit<LibraryDocument, 'versions' | 'acks'> & {
  latest: DocVersion | null
  versionCount: number
  myAckVersion: number | null
  ackedByMe: boolean
  toRead: boolean
  ackCount: number
  staffCount: number
}
export type DocDetail = DocSummary & {
  versions: DocVersion[]
  acks: { staff: ID; name: string; version: number; at: ISODate }[]
  readers: { id: ID; name: string; role: string; version: number | null; at: ISODate | null; current: boolean }[]
}

export type StandardStatus = 'evidenced' | 'attention' | 'gap'
export type OverviewData = {
  health: {
    overdue: number
    dueSoon: number
    reviewsDue: number
    docsToRead: number
    score: number
    scoreParts: { label: string; points: number }[]
    lastActivityAt: ISODate | null
    generatedAt: ISODate
  }
  reviewsDue: { id: ID; register: string; registerLabel: string; title: string; date: string }[]
  standards: {
    code: string
    title: string
    ask: string
    status: StandardStatus
    reason: string
    links: { label: string; to: string; status: StandardStatus; reason: string }[]
  }[]
  upcoming: ObligationView[]
  riskMatrix: number[][]
  openRisks: number
  topRisks: { id: ID; title: string; score: number | null; band: RiskBand | null }[]
  toRead: { id: ID; title: string; category: string; version: number; updatedAt: ISODate }[]
  recent: EventView[]
  registers: { key: string; label: string; count: number }[]
}
