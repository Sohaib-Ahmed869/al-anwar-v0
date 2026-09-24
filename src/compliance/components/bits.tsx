import type { ReactNode } from 'react'
import { CheckCircle2, CircleAlert, CircleDashed, File, FileImage, FileSpreadsheet, FileText, Presentation, ShieldCheck } from 'lucide-react'
import type { Tone } from '../../../shared/domain'
import { riskBand } from '../../../shared/registers'
import { Badge, cn } from '../../portal/ui'
import type { ObligationState, RiskBand, StandardStatus } from './types'

/* ---------------------------------------------------------------------------
   The compliance portal's small pieces.

   Teal is this portal's own accent (the mark's colour, see index.css): it
   marks things that are in order. Green stays the colour of an action and
   gold never appears here. Status is always a word as well as a colour.
--------------------------------------------------------------------------- */

/* ---------- days left ---------- */
export function daysText(days: number) {
  if (days === 0) return 'Due today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return '1 day overdue'
  if (days < 0) return `${-days} days overdue`
  return `${days} days`
}

export function DaysPill({ days, done, className }: { days: number; done?: boolean; className?: string }) {
  if (done) return <Badge tone="teal" size="sm" className={className}>Done</Badge>
  const tone: Tone = days < 0 ? 'red' : days <= 7 ? 'amber' : days <= 30 ? 'neutral' : 'teal'
  return (
    <Badge tone={tone} size="sm" className={cn('nums', className)}>
      {daysText(days)}
    </Badge>
  )
}

export const STATE_META: Record<ObligationState, { label: string; tone: Tone }> = {
  overdue: { label: 'Overdue', tone: 'red' },
  'due-soon': { label: 'Due soon', tone: 'amber' },
  upcoming: { label: 'Upcoming', tone: 'neutral' },
  done: { label: 'Done', tone: 'teal' },
}

export function StateBadge({ state, size }: { state: ObligationState; size?: 'sm' | 'md' }) {
  const m = STATE_META[state]
  return (
    <Badge tone={m.tone} dot size={size}>
      {m.label}
    </Badge>
  )
}

/* ---------- risk ---------- */
export const BAND_META: Record<RiskBand, { label: string; cell: string; chip: string; dot: string }> = {
  low: { label: 'Low', cell: 'bg-teal-pale text-teal', chip: 'bg-teal-pale text-teal', dot: 'bg-teal' },
  medium: { label: 'Medium', cell: 'bg-amber-pale text-amber', chip: 'bg-amber-pale text-amber', dot: 'bg-[#c98a0b]' },
  high: { label: 'High', cell: 'bg-[#f8e0d3] text-[#9a3f12]', chip: 'bg-[#f8e0d3] text-[#9a3f12]', dot: 'bg-[#d9692c]' },
  extreme: { label: 'Extreme', cell: 'bg-red text-white', chip: 'bg-red text-white', dot: 'bg-red' },
}

export function RiskChip({ score, className }: { score: number | null | undefined; className?: string }) {
  const band = riskBand(score ?? null)
  if (!band || score == null) return <span className="text-text-3">—</span>
  const m = BAND_META[band]
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap', m.chip, className)}>
      <span className="nums font-semibold">{score}</span>
      <span className="opacity-80">{m.label}</span>
    </span>
  )
}

/* ---------- standards ---------- */
export const STANDARD_META: Record<StandardStatus, { label: string; tone: Tone; icon: ReactNode }> = {
  evidenced: { label: 'Evidenced', tone: 'teal', icon: <CheckCircle2 /> },
  attention: { label: 'Needs attention', tone: 'amber', icon: <CircleAlert /> },
  gap: { label: 'Gap', tone: 'red', icon: <CircleDashed /> },
}

export function StandardChip({ status, size }: { status: StandardStatus; size?: 'sm' | 'md' }) {
  const m = STANDARD_META[status]
  return (
    <Badge tone={m.tone} size={size} className="[&_svg]:size-3.5">
      {m.icon}
      {m.label}
    </Badge>
  )
}

/* ---------- files ---------- */
export function fileKind(name = '', mime = '') {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (mime === 'application/pdf' || ext === 'pdf') return { label: 'PDF', icon: FileText, tone: 'bg-[#fbebe6] text-[#a63a1c]' }
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return { label: 'Word', icon: FileText, tone: 'bg-[#e9eef7] text-[#35507f]' }
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return { label: ext === 'csv' ? 'CSV' : 'Excel', icon: FileSpreadsheet, tone: 'bg-green-pale text-green' }
  if (['ppt', 'pptx'].includes(ext)) return { label: 'Slides', icon: Presentation, tone: 'bg-amber-pale text-amber' }
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return { label: 'Image', icon: FileImage, tone: 'bg-violet-pale text-violet' }
  if (['txt', 'md'].includes(ext)) return { label: 'Text', icon: FileText, tone: 'bg-ink/[.06] text-text-2' }
  return { label: 'File', icon: File, tone: 'bg-ink/[.06] text-text-2' }
}

export function FileIcon({ name, mime, size = 'md' }: { name?: string; mime?: string; size?: 'sm' | 'md' | 'lg' }) {
  const k = fileKind(name, mime)
  const Icon = k.icon
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-xl',
        { sm: 'size-8 [&_svg]:size-4', md: 'size-10 [&_svg]:size-5', lg: 'size-12 [&_svg]:size-6' }[size],
        k.tone,
      )}
    >
      <Icon />
    </span>
  )
}

export function formatBytes(n: number | undefined) {
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/* ---------- the line at the foot of every compliance page ---------- */
export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn('mt-10 flex items-start gap-2 border-t border-line-2 pt-5 text-[12.5px] leading-relaxed text-text-3', className)}>
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal/70" />
      <span>
        Al-Anwaar's platform keeps the records and evidence in one place. We are a technology partner, not auditors or lawyers — nothing here is
        legal, tax or audit advice.
      </span>
    </p>
  )
}

/** A reminder schedule in words: "30 days, 7 days and 1 day before". */
export function reminderLabel(d: number) {
  return d === 0 ? 'On the day' : `${d} day${d === 1 ? '' : 's'} before`
}
