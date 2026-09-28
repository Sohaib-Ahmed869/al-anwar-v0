import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { FileText, Mail } from 'lucide-react'
import { fyOf } from '../../../shared/domain'
import { api, errorMessage } from '../../portal/api'
import { formatDate } from '../../portal/format'
import { Button, Field, Input, Select, buttonClass, cn, toast } from '../../portal/ui'

/* ---------------------------------------------------------------------------
   The date range a donor looks at their giving through, shared by My giving
   and Receipts & tax.

   Presets come first because they answer the questions people actually ask:
   "this financial year" (1 July to 30 June in Australia), "last financial
   year" for the tax return, the last 12 months, a calendar year, everything.
   "Custom" opens two native date inputs, which on a phone bring up the OS
   date wheel. The choice lives in the URL as `range` (the preset) plus
   `from`/`to` for custom, so a filtered view survives a refresh.

   Resolved dates are plain YYYY-MM-DD days, inclusive at both ends — the
   same shape /api/me/gifts and /api/me/gifts/statement/range take.
--------------------------------------------------------------------------- */

export type RangePreset = 'all' | 'this-fy' | 'last-fy' | 'last-12' | 'this-cal' | 'last-cal' | 'custom'

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'this-fy', label: 'This financial year' },
  { value: 'last-fy', label: 'Last financial year' },
  { value: 'last-12', label: 'Last 12 months' },
  { value: 'this-cal', label: 'This calendar year' },
  { value: 'last-cal', label: 'Last calendar year' },
  { value: 'custom', label: 'Custom dates' },
]

const pad = (n: number) => String(n).padStart(2, '0')
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const DAY = /^\d{4}-\d{2}-\d{2}$/

/** The first day anyone could have given; "All time" starts here. */
const EPOCH = '2000-01-01'

export type Resolved = { from: string; to: string } | null

/** A preset (or custom from/to) as concrete days. null means "no date filter". */
export function resolveRange(preset: string, from = '', to = '', now = new Date()): Resolved {
  const y = now.getFullYear()
  const fy = fyOf(now)
  switch (preset as RangePreset) {
    case 'this-fy':
      return { from: `${fy - 1}-07-01`, to: `${fy}-06-30` }
    case 'last-fy':
      return { from: `${fy - 2}-07-01`, to: `${fy - 1}-06-30` }
    case 'last-12': {
      const start = new Date(y - 1, now.getMonth(), now.getDate() + 1)
      return { from: isoDay(start), to: isoDay(now) }
    }
    case 'this-cal':
      return { from: `${y}-01-01`, to: `${y}-12-31` }
    case 'last-cal':
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }
    case 'custom':
      if (!DAY.test(from) || !DAY.test(to) || from > to) return null
      return { from, to }
    default:
      return null
  }
}

/** "All time" still needs dates when it becomes a statement. */
export const statementRange = (r: Resolved, now = new Date()) => r ?? { from: EPOCH, to: isoDay(now) }

/** "1 Jul 2025 – 30 Jun 2026" */
export const rangeLabel = (r: { from: string; to: string }) => `${formatDate(localDay(r.from))} – ${formatDate(localDay(r.to))}`

function localDay(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const presetLabel = (p: string) => RANGE_PRESETS.find((o) => o.value === p)?.label ?? 'All time'

/** Custom dates that are filled in but do not make a range. */
export function rangeError(preset: string, from: string, to: string) {
  if (preset !== 'custom' || !from || !to) return undefined
  if (from > to) return 'The end date is before the start date.'
  if (from < EPOCH) return 'Choose a date from 2000 onwards.'
  return undefined
}

export function DateRangePicker({
  preset,
  from,
  to,
  onChange,
  className,
}: {
  preset: string
  from: string
  to: string
  onChange: (next: { range: string; from: string; to: string }) => void
  className?: string
}) {
  const custom = preset === 'custom'
  const r = resolveRange(preset, from, to)
  const err = rangeError(preset, from, to)
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end', className)}>
      <Field label="Dates" className="sm:w-56">
        <Select
          value={preset || 'all'}
          onChange={(e) => {
            const next = e.target.value
            /* entering Custom starts from whatever was showing, so the two
               fields are never blank and the donor only nudges them */
            if (next === 'custom') {
              const seed = statementRange(r)
              onChange({ range: next, from: from || seed.from, to: to || seed.to })
            } else onChange({ range: next, from: '', to: '' })
          }}
        >
          {RANGE_PRESETS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      {custom ? (
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end">
          <Field label="From" className="sm:w-44">
            <Input type="date" value={from} min={EPOCH} max={to || undefined} onChange={(e) => onChange({ range: 'custom', from: e.target.value, to })} className="nums" />
          </Field>
          <Field label="To" className="sm:w-44">
            <Input type="date" value={to} min={from || EPOCH} onChange={(e) => onChange({ range: 'custom', from, to: e.target.value })} className="nums" />
          </Field>
        </div>
      ) : (
        r && <p className="nums pb-2.5 text-[13px] text-text-3 sm:pb-3">{rangeLabel(r)}</p>
      )}
      {err && (
        <p className="text-[12.5px] text-red sm:basis-full" role="alert">
          {err}
        </p>
      )}
    </div>
  )
}

/** Open / print and Email for the statement covering a range. "Download"
 *  is the browser's Save as PDF from the statement page, which the button
 *  label says, so nobody hunts for a separate download. */
export function RangeStatementActions({ range, disabled, size = 'md', className }: { range: { from: string; to: string }; disabled?: boolean; size?: 'sm' | 'md'; className?: string }) {
  const href = `/account/statement/range?${new URLSearchParams(range).toString()}`
  const email = useMutation({
    mutationFn: () => api.post<{ to: string }>('/me/gifts/statement/range/email', range),
    onSuccess: (r) => toast.success('Your statement is on its way', { description: `${rangeLabel(range)}, sent to ${r.to}.` }),
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {disabled ? (
        <Button variant="primary" size={size} icon={<FileText />} disabled className="grow sm:grow-0">
          Open / print / PDF
        </Button>
      ) : (
        <Link to={href} className={buttonClass('primary', size, 'grow sm:grow-0')}>
          <FileText /> Open / print / PDF
        </Link>
      )}
      <Button variant="secondary" size={size} icon={<Mail />} loading={email.isPending} disabled={disabled} onClick={() => email.mutate()} className="grow sm:grow-0">
        Email to me
      </Button>
    </div>
  )
}
