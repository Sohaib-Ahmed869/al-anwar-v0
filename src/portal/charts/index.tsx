import type { ReactNode } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { formatMoney, formatMoneyShort } from '../format'
import { cn } from '../ui/cn'

/* ---------------------------------------------------------------------------
   Charts for the portals.

   CATEGORICAL ORDER — validated with the dataviz skill's validate_palette.js
   against the paper surface (lightness band, chroma floor, CVD and
   normal-vision separation all PASS). Slot 2 (amber) is under 3:1 against
   white, so every chart here carries a legend or direct labels: identity is
   never colour alone. Assign in this order and never cycle; past five series
   the rest folds into "Other" in OTHER gray.

   Re-validated for the 2026 brand on its off-white card (#fffbf4). The
   brand's teal (#006770) is too grey to hold a categorical slot (chroma 0.08,
   below the floor), so series 1 is a brighter step of the same hue (#00909c)
   and the order changed to keep green away from red for protan readers;
   single-series charts, which need no separation, keep the brand teal.

   One axis per chart, always. Text is ink, never the series colour.
--------------------------------------------------------------------------- */

export const SERIES = ['#00909c', '#d1850a', '#1a7f5a', '#5b4bb0', '#c94f2c'] as const
export const OTHER = '#8aa3a3'
export const BRAND = '#006770'
const GRID = '#efe4d0'
const AXIS = '#6f8788'

export const seriesColor = (i: number) => (i < SERIES.length ? SERIES[i] : OTHER)

/** Keep the first n-1 by value and fold the rest into "Other". */
export function foldOther<T extends { label: string; value: number }>(rows: T[], max = SERIES.length): { label: string; value: number }[] {
  const sorted = [...rows].sort((a, b) => b.value - a.value)
  if (sorted.length <= max) return sorted
  const head = sorted.slice(0, max - 1)
  const rest = sorted.slice(max - 1).reduce((s, r) => s + r.value, 0)
  return [...head, { label: 'Other', value: rest }]
}

function TooltipBox({ title, rows }: { title?: ReactNode; rows: { color?: string; label: ReactNode; value: ReactNode }[] }) {
  return (
    <div className="min-w-40 rounded-xl bg-paper px-3 py-2.5 text-[12.5px] shadow-pop">
      {title && <p className="mb-1.5 font-medium text-text">{title}</p>}
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-text-2">
              {r.color && <span className="size-2 rounded-full" style={{ background: r.color }} />}
              {r.label}
            </span>
            <span className="nums font-medium text-text">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Legend({ items, className }: { items: { label: string; color: string; value?: ReactNode }[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-text-2', className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} />
          {i.label}
          {i.value != null && <span className="nums font-medium text-text">{i.value}</span>}
        </li>
      ))}
    </ul>
  )
}

type Series = { key: string; label: string; color?: string }

/**
 * Money over time. One series → a brand-green area with a crosshair.
 * Several → stacked areas in categorical order with a legend.
 */
export function MoneyAreaChart({
  data,
  xKey,
  series,
  height = 260,
  formatX = (v) => String(v),
}: {
  data: Record<string, string | number>[]
  xKey: string
  series: Series[]
  height?: number
  formatX?: (v: string) => string
}) {
  const single = series.length === 1
  return (
    <div>
      {!single && <Legend className="mb-3" items={series.map((s, i) => ({ label: s.label, color: s.color ?? seriesColor(i) }))} />}
      <div style={{ height }} className="-ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {series.map((s, i) => {
                const c = single ? BRAND : (s.color ?? seriesColor(i))
                return (
                  <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c} stopOpacity={single ? 0.22 : 0.35} />
                    <stop offset="100%" stopColor={c} stopOpacity={single ? 0.01 : 0.08} />
                  </linearGradient>
                )
              })}
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey={xKey} tickFormatter={formatX} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} dy={6} minTickGap={16} />
            <YAxis tickFormatter={(v) => formatMoneyShort(v)} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} width={56} />
            <Tooltip
              cursor={{ stroke: '#dccdb2', strokeWidth: 1 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={formatX(String(label))}
                    rows={[
                      ...payload.map((p) => ({ color: single ? BRAND : String(p.color), label: series.find((s) => s.key === p.dataKey)?.label, value: formatMoney(Number(p.value)) })),
                      ...(single ? [] : [{ label: 'Total', value: formatMoney(payload.reduce((s, p) => s + Number(p.value), 0)) }]),
                    ]}
                  />
                ) : null
              }
            />
            {series.map((s, i) => {
              const c = single ? BRAND : (s.color ?? seriesColor(i))
              return (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stackId={single ? undefined : 'a'}
                  stroke={c}
                  strokeWidth={2}
                  fill={`url(#g-${s.key})`}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                  animationDuration={700}
                />
              )
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Monthly columns, one series or stacked. 2px surface gap between stacked segments. */
export function MoneyColumnChart({
  data,
  xKey,
  series,
  height = 240,
  formatX = (v) => String(v),
}: {
  data: Record<string, string | number>[]
  xKey: string
  series: Series[]
  height?: number
  formatX?: (v: string) => string
}) {
  const single = series.length === 1
  return (
    <div>
      {!single && <Legend className="mb-3" items={series.map((s, i) => ({ label: s.label, color: s.color ?? seriesColor(i) }))} />}
      <div style={{ height }} className="-ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey={xKey} tickFormatter={formatX} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} dy={6} minTickGap={8} />
            <YAxis tickFormatter={(v) => formatMoneyShort(v)} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} width={56} />
            <Tooltip
              cursor={{ fill: 'rgba(8,38,42,.04)' }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={formatX(String(label))}
                    rows={[
                      ...payload.map((p) => ({ color: String(p.color), label: series.find((s) => s.key === p.dataKey)?.label, value: formatMoney(Number(p.value)) })),
                      ...(single ? [] : [{ label: 'Total', value: formatMoney(payload.reduce((s, p) => s + Number(p.value), 0)) }]),
                    ]}
                  />
                ) : null
              }
            />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId={single ? undefined : 'a'}
                fill={single ? BRAND : (s.color ?? seriesColor(i))}
                stroke="#fff"
                strokeWidth={single ? 0 : 1}
                radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                maxBarSize={36}
                animationDuration={600}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Part of a whole: a ring with the total in the middle and a labelled legend beside it. */
export function Donut({
  rows,
  size = 168,
  centerLabel,
  format = (v: number) => formatMoney(v),
}: {
  rows: { label: string; value: number }[]
  size?: number
  centerLabel?: ReactNode
  format?: (v: number) => string
}) {
  const data = foldOther(rows)
  const total = data.reduce((s, r) => s + r.value, 0)
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="68%" outerRadius="100%" paddingAngle={data.length > 1 ? 1.5 : 0} stroke="none" animationDuration={700}>
              {data.map((r, i) => (
                <Cell key={r.label} fill={r.label === 'Other' ? OTHER : seriesColor(i)} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <TooltipBox rows={[{ color: String(payload[0].payload.fill), label: payload[0].name, value: `${format(Number(payload[0].value))} · ${Math.round((Number(payload[0].value) / total) * 100)}%` }]} />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="nums text-lg font-semibold text-text">{formatMoneyShort(total)}</div>
            {centerLabel && <div className="text-[11.5px] text-text-3">{centerLabel}</div>}
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-2">
        {data.map((r, i) => (
          <li key={r.label} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-2 text-text-2">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: r.label === 'Other' ? OTHER : seriesColor(i) }} />
              <span className="truncate">{r.label}</span>
            </span>
            <span className="nums shrink-0 text-text">
              {format(r.value)} <span className="text-text-3">· {total ? Math.round((r.value / total) * 100) : 0}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Ranked horizontal bars in plain HTML — appeal performance, top countries.
 *  One hue: the bars show magnitude, the labels carry identity. */
export function BarList({
  rows,
  format = (v: number) => formatMoney(v),
  max,
  onClick,
}: {
  rows: { key?: string; label: ReactNode; value: number; sub?: ReactNode; target?: number }[]
  format?: (v: number) => string
  max?: number
  onClick?: (key: string) => void
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.target ?? r.value))
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => {
        const pct = Math.min(100, (r.value / top) * 100)
        const inner = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate font-medium text-text">{r.label}</span>
              <span className="nums shrink-0 text-text">
                {format(r.value)}
                {r.sub && <span className="ml-1.5 text-text-3">{r.sub}</span>}
              </span>
            </div>
            <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-ink/[.06]">
              <div className="h-full rounded-full bg-green transition-[width] duration-700 ease-[var(--ease-reveal)]" style={{ width: `${pct}%` }} />
            </div>
          </>
        )
        return (
          <li key={r.key ?? i}>
            {onClick && r.key ? (
              <button type="button" onClick={() => onClick(r.key!)} className="-mx-2 block w-[calc(100%+16px)] rounded-lg px-2 py-1 text-left transition-colors hover:bg-ink/[.03]">
                {inner}
              </button>
            ) : (
              inner
            )}
          </li>
        )
      })}
    </ul>
  )
}
