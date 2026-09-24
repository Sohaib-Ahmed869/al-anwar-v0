import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Legend, seriesColor } from '../../portal/charts'
import { formatNumber } from '../../portal/format'
import { Skeleton, cn, useIsMobile } from '../../portal/ui'

/* ---------------------------------------------------------------------------
   Pieces the report tabs share: a table with a totals footer that turns into
   cards on a phone, a column chart for counts (the kit's column chart is for
   money and puts dollars on its axis), and the loading block.
--------------------------------------------------------------------------- */

export type ReportColumn<T> = {
  key: string
  header: ReactNode
  cell: (r: T) => ReactNode
  total?: ReactNode
  align?: 'left' | 'right'
  className?: string
  /** leave out of the phone card's detail line */
  hideOnMobile?: boolean
}

export function ReportTable<T>({
  columns,
  rows,
  rowKey,
  totalLabel = 'Total',
  mobileTitle,
  mobileValue,
  empty,
}: {
  columns: ReportColumn<T>[]
  rows: T[]
  rowKey: (r: T) => string
  totalLabel?: string
  mobileTitle: (r: T) => ReactNode
  mobileValue: (r: T) => ReactNode
  empty?: ReactNode
}) {
  const mobile = useIsMobile()
  const hasTotals = columns.some((c) => c.total !== undefined)
  if (!rows.length) return <>{empty}</>
  if (mobile) {
    const detail = columns.filter((c) => !c.hideOnMobile).slice(1)
    return (
      <ul className="divide-y divide-line-2">
        {rows.map((r) => (
          <li key={rowKey(r)} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-[14px] font-medium text-text">{mobileTitle(r)}</span>
              <span className="nums shrink-0 text-[14px] font-semibold text-text">{mobileValue(r)}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-text-2">
              {detail.slice(1).map((c) => (
                <span key={c.key}>
                  <span className="text-text-3">{c.header}</span> <span className="nums">{c.cell(r)}</span>
                </span>
              ))}
            </div>
          </li>
        ))}
        {hasTotals && (
          <li className="flex items-baseline justify-between gap-3 bg-paper-2/70 px-4 py-3">
            <span className="text-[14px] font-semibold text-text">{totalLabel}</span>
            <span className="nums text-[14px] font-semibold text-text">{columns[1]?.total}</span>
          </li>
        )}
      </ul>
    )
  }
  const align = (c: ReportColumn<T>) => (c.align === 'right' ? 'text-right' : 'text-left')
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn('border-b border-line px-3 py-2.5 text-[12px] font-medium whitespace-nowrap text-text-3 first:pl-5 last:pr-5', align(c))}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="hover:bg-paper-2/60">
              {columns.map((c) => (
                <td key={c.key} className={cn('border-b border-line-2 px-3 py-2.5 first:pl-5 last:pr-5', align(c), c.className)}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {hasTotals && (
          <tfoot>
            <tr className="bg-paper-2/70">
              {columns.map((c, i) => (
                <td key={c.key} className={cn('nums px-3 py-3 font-semibold text-text first:pl-5 last:pr-5', align(c))}>
                  {i === 0 ? totalLabel : c.total}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

/** Columns of counts per month, one series or stacked. */
export function ReportCountChart({
  data,
  xKey,
  series,
  height = 240,
}: {
  data: Record<string, string | number>[]
  xKey: string
  series: { key: string; label: string; color?: string }[]
  height?: number
}) {
  const single = series.length === 1
  return (
    <div>
      {!single && <Legend className="mb-3" items={series.map((s, i) => ({ label: s.label, color: s.color ?? seriesColor(i) }))} />}
      <div style={{ height }} className="-ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="#ebebe7" />
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fill: '#8a908e', fontSize: 12 }} dy={6} minTickGap={8} />
            <YAxis allowDecimals={false} tickFormatter={(v) => formatNumber(Number(v))} tickLine={false} axisLine={false} tick={{ fill: '#8a908e', fontSize: 12 }} width={40} />
            <Tooltip
              cursor={{ fill: 'rgba(20,26,24,.04)' }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="min-w-40 rounded-xl bg-paper px-3 py-2.5 text-[12.5px] shadow-pop">
                    <p className="mb-1.5 font-medium text-text">{label}</p>
                    {payload.map((p) => (
                      <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-text-2">
                          <span className="size-2 rounded-full" style={{ background: String(p.color) }} />
                          {series.find((s) => s.key === p.dataKey)?.label}
                        </span>
                        <span className="nums font-medium text-text">{formatNumber(Number(p.value))}</span>
                      </div>
                    ))}
                  </div>
                ) : null
              }
            />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId={s.key === 'lapsed' ? undefined : single ? undefined : 'a'}
                fill={single ? '#2f6b5a' : (s.color ?? seriesColor(i))}
                stroke="#fff"
                strokeWidth={single ? 0 : 1}
                maxBarSize={32}
                animationDuration={600}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function ReportLoading({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className={cn('grid gap-4 sm:grid-cols-2', tiles === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-5')}>
        {Array.from({ length: tiles }, (_, i) => (
          <Skeleton key={i} className="h-[112px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[300px] rounded-2xl" />
      <Skeleton className="h-[240px] rounded-2xl" />
    </div>
  )
}
