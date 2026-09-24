import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'
import { formatNumber } from '../format'
import { Checkbox } from './Field'
import { Skeleton } from './bits'
import { cn } from './cn'
import { useIsMobile } from './hooks'

/* ---------------------------------------------------------------------------
   The table every list in the admin and compliance portals uses.

   Wide screens: a real <table>, sticky header, sortable columns, row
   selection for bulk actions, the whole row clickable (and focusable, and
   Enter opens it). Phones: the same rows as stacked cards, from `mobile` —
   a table squeezed onto a 375px screen is a table nobody can read.

   Sorting is controlled ("-date" / "amount") so it lives in the URL with the
   rest of the list's state and the server does it.
--------------------------------------------------------------------------- */

export type Column<T> = {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** the server-side sort key, if sortable */
  sort?: string
  align?: 'left' | 'right' | 'center'
  className?: string
  headerClassName?: string
  /** hide below this width on the desktop table */
  hideBelow?: 'lg' | 'xl'
  width?: number | string
}

type Props<T> = {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string
  loading?: boolean
  onRowClick?: (row: T) => void
  /** how a row looks on a phone */
  mobile?: (row: T) => ReactNode
  sort?: string
  onSort?: (sort: string) => void
  selectable?: boolean
  selected?: Set<string>
  onSelectedChange?: (s: Set<string>) => void
  empty?: ReactNode
  className?: string
  rowClassName?: (row: T) => string | undefined
  /** a line under the table: totals */
  footer?: ReactNode
  dense?: boolean
}

export function DataTable<T>({
  columns, rows, rowKey, loading, onRowClick, mobile, sort, onSort, selectable, selected, onSelectedChange,
  empty, className, rowClassName, footer, dense,
}: Props<T>) {
  const isMobile = useIsMobile()
  const list = rows ?? []
  const allOn = selectable && list.length > 0 && list.every((r) => selected?.has(rowKey(r)))
  const someOn = selectable && list.some((r) => selected?.has(rowKey(r)))

  const toggle = (id: string) => {
    const s = new Set(selected)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    onSelectedChange?.(s)
  }
  const toggleAll = () => {
    const s = new Set(selected)
    if (allOn) list.forEach((r) => s.delete(rowKey(r)))
    else list.forEach((r) => s.add(rowKey(r)))
    onSelectedChange?.(s)
  }

  if (loading && !rows) {
    return (
      <div className={cn('space-y-0 divide-y divide-line-2', className)} aria-busy="true">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    )
  }
  if (!list.length) return <div className={className}>{empty}</div>

  if (isMobile && mobile) {
    return (
      <div className={cn(className)}>
        <ul className={cn('divide-y divide-line-2 transition-opacity', loading && 'opacity-60')}>
          {list.map((r) => {
            const id = rowKey(r)
            return (
              <li key={id} className={cn('flex items-stretch gap-3', rowClassName?.(r))}>
                {selectable && (
                  <div className="flex items-center pl-4">
                    <Checkbox checked={Boolean(selected?.has(id))} onChange={() => toggle(id)} aria-label="Select" />
                  </div>
                )}
                {onRowClick ? (
                  <button type="button" onClick={() => onRowClick(r)} className="min-w-0 flex-1 px-4 py-3.5 text-left active:bg-ink/[.03]">
                    {mobile(r)}
                  </button>
                ) : (
                  <div className="min-w-0 flex-1 px-4 py-3.5">{mobile(r)}</div>
                )}
              </li>
            )
          })}
        </ul>
        {footer}
      </div>
    )
  }

  const hide = (c: Column<T>) => (c.hideBelow === 'lg' ? 'hidden lg:table-cell' : c.hideBelow === 'xl' ? 'hidden xl:table-cell' : '')
  const align = (c: Column<T>) => (c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left')

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className={cn('w-full border-separate border-spacing-0 text-sm transition-opacity', loading && 'opacity-60')}>
        <thead>
          <tr>
            {selectable && (
              <th className="sticky top-0 z-[1] w-10 border-b border-line bg-paper py-2.5 pl-5">
                <Checkbox checked={allOn ? true : someOn ? 'indeterminate' : false} onChange={toggleAll} aria-label="Select all" />
              </th>
            )}
            {columns.map((c) => {
              const active = sort?.replace(/^-/, '') === c.sort
              const desc = sort?.startsWith('-')
              return (
                <th
                  key={c.key}
                  scope="col"
                  style={{ width: c.width }}
                  aria-sort={active ? (desc ? 'descending' : 'ascending') : undefined}
                  className={cn(
                    'sticky top-0 z-[1] border-b border-line bg-paper px-3 py-2.5 text-[12px] font-medium whitespace-nowrap text-text-3 first:pl-5 last:pr-5',
                    align(c),
                    hide(c),
                    c.headerClassName,
                  )}
                >
                  {c.sort && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(active && !desc ? `-${c.sort}` : active && desc ? c.sort! : `-${c.sort}`)}
                      className={cn('group inline-flex items-center gap-1 rounded transition-colors hover:text-text', active && 'text-text', c.align === 'right' && 'flex-row-reverse')}
                    >
                      {c.header}
                      {active ? (
                        desc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />
                      ) : (
                        <ChevronsUpDown className="size-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const id = rowKey(r)
            const on = selected?.has(id)
            return (
              <tr
                key={id}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(r) : undefined}
                className={cn(
                  'group transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-paper-2/80 focus-visible:bg-paper-2 focus-visible:outline-none',
                  on && 'bg-green-50/70 hover:bg-green-50',
                  rowClassName?.(r),
                )}
              >
                {selectable && (
                  <td className="w-10 border-b border-line-2 py-3 pl-5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={Boolean(on)} onChange={() => toggle(id)} aria-label="Select row" />
                  </td>
                )}
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'border-b border-line-2 px-3 align-middle first:pl-5 last:pr-5 group-last:border-0',
                      dense ? 'py-2' : 'py-3',
                      align(c),
                      hide(c),
                      c.className,
                    )}
                  >
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      {footer}
    </div>
  )
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  className,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
  className?: string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const btn =
    'grid size-8 place-items-center rounded-lg text-text-2 transition-colors hover:bg-ink/5 hover:text-text disabled:pointer-events-none disabled:opacity-35 pointer-coarse:size-10'
  return (
    <div className={cn('flex items-center justify-between gap-4 border-t border-line-2 px-5 py-3 text-[13px] text-text-2', className)}>
      <span className="nums">
        {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </button>
        <span className="nums px-2">
          {page} / {pages}
        </span>
        <button type="button" className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}

/** Bulk actions for selected rows: floats at the bottom of the screen. */
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (!count) return null
  return (
    <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-6">
      <div className="flex items-center gap-2 rounded-2xl bg-ink py-2 pr-2 pl-4 text-text-on-ink shadow-pop animate-[portal-in_220ms_var(--ease-reveal)]">
        <span className="nums text-[13.5px] font-medium whitespace-nowrap">{count} selected</span>
        <button type="button" onClick={onClear} className="rounded-lg px-2 py-1 text-[13px] text-text-on-ink-2 hover:text-white">
          Clear
        </button>
        <span className="mx-1 h-5 w-px bg-white/15" />
        <div className="flex items-center gap-1.5 [&_button]:h-8">{children}</div>
      </div>
    </div>
  )
}
