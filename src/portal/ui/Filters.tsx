import { useState, type ReactNode } from 'react'
import { Calendar, Check, ChevronDown, X } from 'lucide-react'
import { format, startOfMonth, subDays, subMonths, startOfYear } from 'date-fns'
import { fyOf, fyLabel } from '../../../shared/domain'
import { Popover } from './Menu'
import { Button } from './Button'
import { Input } from './Field'
import { cn } from './cn'

/* The pieces of a list's filter row: a chip that opens a checklist, and a
   date range with the presets a charity actually reaches for — this month,
   this financial year, last financial year. */

const chipClass = (active: boolean) =>
  cn(
    'inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium whitespace-nowrap transition-colors pointer-coarse:h-10',
    active ? 'bg-green-50 text-green ring-1 ring-green/25 ring-inset' : 'bg-paper text-text-2 ring-1 ring-line ring-inset hover:text-text hover:ring-[#cdcdc6]',
  )

export function FilterChip<T extends string>({
  label,
  options,
  value,
  onChange,
  multiple = true,
}: {
  label: string
  options: { value: T; label: ReactNode }[]
  value: T[]
  onChange: (v: T[]) => void
  multiple?: boolean
}) {
  const [open, setOpen] = useState(false)
  const active = value.length > 0
  const summary = active
    ? value.length === 1
      ? options.find((o) => o.value === value[0])?.label
      : `${value.length} selected`
    : null
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="w-60 p-1"
      trigger={
        <button type="button" className={chipClass(active)}>
          {label}
          {summary && (
            <>
              <span className="text-green/40">·</span>
              <span className="max-w-[140px] truncate">{summary}</span>
            </>
          )}
          <ChevronDown className="size-3.5 opacity-60" />
        </button>
      }
    >
      <div className="max-h-72 overflow-y-auto">
        {options.map((o) => {
          const on = value.includes(o.value)
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                if (!multiple) {
                  onChange(on ? [] : [o.value])
                  setOpen(false)
                } else onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])
              }}
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13.5px] hover:bg-ink/[.05]"
            >
              <span className={cn('grid size-4 place-items-center rounded-[4px] ring-1 ring-inset', on ? 'bg-green ring-green text-white' : 'ring-[#c9c9c2]')}>
                {on && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span className="flex-1 truncate">{o.label}</span>
            </button>
          )
        })}
      </div>
      {active && (
        <div className="mt-1 border-t border-line-2 p-1">
          <button type="button" onClick={() => onChange([])} className="h-8 w-full rounded-lg text-[13px] text-text-2 hover:bg-ink/[.05]">
            Clear
          </button>
        </div>
      )}
    </Popover>
  )
}

export type DateRange = { from: string; to: string }

/** `to` is exclusive in the API, inclusive on screen. */
export function datePresets(now = new Date()) {
  const iso = (d: Date) => format(d, 'yyyy-MM-dd')
  const fy = fyOf(now)
  const tomorrow = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  return [
    { key: '30d', label: 'Last 30 days', range: { from: iso(subDays(now, 29)), to: tomorrow } },
    { key: 'month', label: 'This month', range: { from: iso(startOfMonth(now)), to: tomorrow } },
    { key: 'lastmonth', label: 'Last month', range: { from: iso(startOfMonth(subMonths(now, 1))), to: iso(startOfMonth(now)) } },
    /* the financial year is Sydney's (shared/domain.ts), named by its dates
       rather than formatted from an instant in the browser's own zone */
    { key: 'fy', label: `This financial year (${fyLabel(fy)})`, range: { from: `${fy - 1}-07-01`, to: tomorrow } },
    { key: 'lastfy', label: `Last financial year (${fyLabel(fy - 1)})`, range: { from: `${fy - 2}-07-01`, to: `${fy - 1}-07-01` } },
    { key: 'year', label: 'This calendar year', range: { from: iso(startOfYear(now)), to: tomorrow } },
    { key: '12m', label: 'Last 12 months', range: { from: iso(subMonths(now, 12)), to: tomorrow } },
  ]
}

export function DateRangePicker({ value, onChange, allowAll = true }: { value: DateRange | null; onChange: (v: DateRange | null) => void; allowAll?: boolean }) {
  const [open, setOpen] = useState(false)
  const presets = datePresets()
  const match = value && presets.find((p) => p.range.from === value.from && p.range.to === value.to)
  const [from, setFrom] = useState(value?.from ?? '')
  const [to, setTo] = useState(value ? format(new Date(new Date(value.to).getTime() - 86_400_000), 'yyyy-MM-dd') : '')
  const label = !value
    ? 'All time'
    : match
      ? match.label.replace(/ \(.+\)$/, '')
      : `${format(new Date(value.from), 'd MMM yy')} – ${format(new Date(new Date(value.to).getTime() - 86_400_000), 'd MMM yy')}`
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="w-72 p-1"
      trigger={
        <button type="button" className={chipClass(Boolean(value))}>
          <Calendar className="size-3.5" />
          {label}
          <ChevronDown className="size-3.5 opacity-60" />
        </button>
      }
    >
      <div>
        {allowAll && (
          <PresetRow on={!value} onClick={() => (onChange(null), setOpen(false))}>
            All time
          </PresetRow>
        )}
        {presets.map((p) => (
          <PresetRow key={p.key} on={match?.key === p.key} onClick={() => (onChange(p.range), setOpen(false))}>
            {p.label}
          </PresetRow>
        ))}
      </div>
      <div className="mt-1 space-y-2 border-t border-line-2 p-2">
        <p className="text-[12px] font-medium text-text-3">Custom</p>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" className="px-2 text-[13px]" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" className="px-2 text-[13px]" />
        </div>
        <Button
          size="sm"
          variant="primary"
          className="w-full"
          disabled={!from || !to || from > to}
          onClick={() => {
            onChange({ from, to: format(new Date(new Date(to).getTime() + 86_400_000), 'yyyy-MM-dd') })
            setOpen(false)
          }}
        >
          Apply
        </Button>
      </div>
    </Popover>
  )
}

function PresetRow({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-left text-[13.5px] hover:bg-ink/[.05]">
      {children}
      {on && <Check className="size-4 text-green" />}
    </button>
  )
}

export function ClearFilters({ show, onClear }: { show: boolean; onClear: () => void }) {
  if (!show) return null
  return (
    <button type="button" onClick={onClear} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[13px] text-text-2 hover:text-text">
      <X className="size-3.5" /> Clear
    </button>
  )
}

/** The filter row above a list: wraps on a phone, scrolls if it must. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}
