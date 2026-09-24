import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { Skeleton } from './bits'
import { cn } from './cn'

/* A KPI tile: the figure, what it is, how it moved, and optionally the shape
   of its last few months. The delta says "vs last month" in words, not just
   an arrow, and its colour follows whether the move is good — for most
   figures up is good, for "lapsed donors" it is not (`inverse`). */

export function Stat({
  label,
  value,
  delta,
  deltaLabel,
  inverse,
  spark,
  icon,
  loading,
  hint,
  className,
  onClick,
}: {
  label: ReactNode
  value: ReactNode
  /** fractional change, 0.12 = +12% */
  delta?: number | null
  deltaLabel?: string
  inverse?: boolean
  spark?: number[]
  icon?: ReactNode
  loading?: boolean
  hint?: ReactNode
  className?: string
  onClick?: () => void
}) {
  const good = delta == null ? null : inverse ? delta < 0 : delta >= 0
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'group relative flex min-w-0 flex-col overflow-hidden rounded-2xl bg-paper p-4 text-left ring-1 ring-line/80 shadow-soft sm:p-5',
        onClick && 'transition-shadow hover:shadow-lift',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-[13px] font-medium text-text-2">
        {icon && <span className="text-text-3 [&_svg]:size-4">{icon}</span>}
        <span className="truncate">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-28" />
      ) : (
        <div className="nums mt-2 text-[26px] leading-none font-semibold tracking-[-0.02em] text-text sm:text-[28px]">{value}</div>
      )}
      <div className="mt-2.5 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
        {delta != null && !loading && (
          <span className={cn('nums inline-flex items-center gap-0.5 font-medium', good ? 'text-green' : 'text-red')}>
            {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(delta * 100).toFixed(Math.abs(delta) < 0.1 ? 1 : 0)}%
          </span>
        )}
        {deltaLabel && !loading && <span className="text-text-3">{deltaLabel}</span>}
        {hint && !loading && <span className="text-text-3">{hint}</span>}
      </div>
      {spark && spark.length > 1 && !loading && (
        <div className="pointer-events-none absolute right-0 bottom-0 h-14 w-[45%] opacity-80" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2f6b5a" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#2f6b5a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="#2f6b5a" strokeWidth={1.5} fill="url(#spark)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Tag>
  )
}
