import type { ReactNode } from 'react'
import {
  APPEAL_STATUSES, BANK_LINE_STATUSES, CAMPAIGN_STATUSES, DESIGNATIONS, ENQUIRY_STATUSES, ENQUIRY_TYPES,
  FUNDRAISER_STATUSES, GIFT_STATUSES, OBLIGATION_CATEGORIES, PLAN_STATUSES, type Tone,
} from '../../../shared/domain'
import { cn } from './cn'

/* A status is a word in a pill. The tone carries the meaning at a glance,
   the word carries it for everyone else — colour is never the only signal. */

const TONES: Record<Tone, string> = {
  neutral: 'bg-ink/[.06] text-text-2',
  green: 'bg-green-pale text-green',
  teal: 'bg-teal-pale text-teal',
  amber: 'bg-amber-pale text-amber',
  red: 'bg-red-pale text-red',
  violet: 'bg-violet-pale text-violet',
  gold: 'bg-gold-50 text-gold-dark',
}
const DOTS: Record<Tone, string> = {
  neutral: 'bg-text-3',
  green: 'bg-green',
  teal: 'bg-teal',
  amber: 'bg-[#c98a0b]',
  red: 'bg-red',
  violet: 'bg-violet',
  gold: 'bg-gold',
}

export function Badge({
  tone = 'neutral',
  children,
  dot,
  className,
  size = 'md',
}: {
  tone?: Tone
  children: ReactNode
  dot?: boolean
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'h-5 px-2 text-[11px]' : 'h-6 px-2.5 text-[12px]',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', DOTS[tone])} />}
      {children}
    </span>
  )
}

const MAPS = {
  gift: GIFT_STATUSES,
  plan: PLAN_STATUSES,
  appeal: APPEAL_STATUSES,
  fundraiser: FUNDRAISER_STATUSES,
  enquiry: ENQUIRY_STATUSES,
  enquiryType: ENQUIRY_TYPES,
  campaign: CAMPAIGN_STATUSES,
  bankLine: BANK_LINE_STATUSES,
  obligation: OBLIGATION_CATEGORIES,
  designation: Object.fromEntries(Object.entries(DESIGNATIONS).map(([k, v]) => [k, { label: v.short, tone: v.tone }])),
} as const

/** <StatusBadge kind="plan" value={plan.status} /> — the label and tone come
 *  from shared/domain.ts, so every screen says the same word for a status. */
export function StatusBadge({ kind, value, size, className }: { kind: keyof typeof MAPS; value: string; size?: 'sm' | 'md'; className?: string }) {
  const m = (MAPS[kind] as Record<string, { label: string; tone: string }>)[value]
  if (!m) return <Badge size={size}>{value}</Badge>
  return (
    <Badge tone={m.tone as Tone} dot={kind !== 'designation' && kind !== 'enquiryType' && kind !== 'obligation'} size={size} className={className}>
      {m.label}
    </Badge>
  )
}
