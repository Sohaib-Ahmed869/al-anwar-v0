import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, FileUp, ListChecks, SearchCheck, Sparkles } from 'lucide-react'
import { BANK_LINE_STATUSES, type BankLineStatus } from '../../../shared/domain'
import { Avatar, Badge, cn } from '../../portal/ui'

/* ---------------------------------------------------------------------------
   The small pieces the bank import screens share: the four-step stepper,
   the confidence meter, the donor chip and the per-status count chips.

   The stepper is the same picture on the upload page (as an explanation of
   what is about to happen) and on the review page (as "you are here"), so
   the office learns the flow once.
--------------------------------------------------------------------------- */

export const BANK_STEPS = [
  { key: 'upload', label: 'Upload', hint: 'The CSV from your online banking', icon: FileUp },
  { key: 'match', label: 'Match', hint: 'Each line matched to a donor and appeal', icon: Sparkles },
  { key: 'check', label: 'Check', hint: 'You look over anything we are unsure of', icon: SearchCheck },
  { key: 'confirm', label: 'Confirm', hint: 'Donations saved and receipts emailed', icon: ListChecks },
] as const

/** Horizontal on wide screens; on a phone it stays one row of compact dots. */
export function BankStepper({ current, done, className }: { current: number; done?: boolean; className?: string }) {
  return (
    <ol className={cn('flex items-center gap-2 sm:gap-3', className)} aria-label="Import steps">
      {BANK_STEPS.map((s, i) => {
        const complete = done || i < current
        const active = !done && i === current
        return (
          <li key={s.key} className={cn('flex min-w-0 items-center gap-2 sm:flex-1 sm:gap-3', active && 'max-sm:flex-1')} aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold transition-colors',
                complete && 'bg-green text-white',
                active && 'bg-paper text-green ring-2 ring-green',
                !complete && !active && 'bg-ink/[.06] text-text-3',
              )}
            >
              {complete ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn('truncate text-[13px] font-medium', active ? 'text-text' : complete ? 'text-text-2' : 'text-text-3', !active && 'max-sm:sr-only')}>{s.label}</span>
            {i < BANK_STEPS.length - 1 && <span className={cn('h-px w-3 sm:w-auto sm:min-w-4 sm:flex-1', complete ? 'bg-green/40' : 'bg-line', active && 'max-sm:flex-1')} aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}

/** How sure the matcher is: green from 90%, amber below. */
export function BankConfidence({ value, className }: { value: number; className?: string }) {
  if (!value) return <span className={cn('text-[12.5px] text-text-3', className)}>—</span>
  const pct = Math.round(value * 100)
  const good = value >= 0.9
  return (
    <span className={cn('inline-flex items-center gap-2', className)} title={`${pct}% sure`}>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-ink/[.08]" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Confidence">
        <span className={cn('block h-full rounded-full', good ? 'bg-green' : 'bg-[#c98a0b]')} style={{ width: `${pct}%` }} />
      </span>
      <span className={cn('nums text-[12px] font-medium', good ? 'text-green' : 'text-amber')}>{pct}%</span>
    </span>
  )
}

export function BankDonorChip({ id, name, number, size = 'sm', link = true }: { id?: string; name: string; number?: string; size?: 'xs' | 'sm'; link?: boolean }) {
  const inner = (
    <>
      <Avatar name={name} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] leading-tight font-medium text-text group-hover:underline">{name}</span>
        {number && <span className="nums block text-[12px] leading-tight text-text-3">{number}</span>}
      </span>
    </>
  )
  if (link && id) {
    return (
      <Link to={`/admin/donors/${id}`} onClick={(e) => e.stopPropagation()} className="group flex min-w-0 items-center gap-2 rounded-lg">
        {inner}
      </Link>
    )
  }
  return <span className="flex min-w-0 items-center gap-2">{inner}</span>
}

const CHIP_ORDER: BankLineStatus[] = ['matched', 'review', 'unmatched', 'confirmed', 'ignored', 'duplicate']

/** "16 matched · 5 to check · 3 unmatched" as small pills. */
export function BankCountChips({ counts, className, only }: { counts: Partial<Record<BankLineStatus, number>>; className?: string; only?: BankLineStatus[] }) {
  const list = (only ?? CHIP_ORDER).filter((s) => counts[s])
  if (!list.length) return null
  return (
    <span className={cn('flex flex-wrap gap-1', className)}>
      {list.map((s) => (
        <Badge key={s} size="sm" tone={BANK_LINE_STATUSES[s].tone}>
          <span className="nums">{counts[s]}</span> {BANK_LINE_STATUSES[s].label.toLowerCase()}
        </Badge>
      ))}
    </span>
  )
}

/** The raw bank narrative, set apart so it reads as "what the bank said". */
export function BankNarrative({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-block max-w-full rounded-md bg-ink/[.045] px-2 py-1 font-mono text-[12px] leading-snug tracking-tight text-text [overflow-wrap:anywhere]', className)}>
      {children}
    </span>
  )
}
