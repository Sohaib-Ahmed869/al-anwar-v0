import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { formatMoney, formatMoneyShort, initials } from '../format'
import { cn } from './cn'

/* The small things every screen uses: money, avatars, skeletons, empty
   states, the page header, progress, keyboard hints. */

export function Money({ cents, short, exact, className }: { cents: number | null | undefined; short?: boolean; exact?: boolean; className?: string }) {
  return <span className={cn('nums', className)}>{short ? formatMoneyShort(cents) : formatMoney(cents, { exact })}</span>
}

const AVATAR_TONES = [
  'bg-green-pale text-green',
  'bg-teal-pale text-teal',
  'bg-violet-pale text-violet',
  'bg-amber-pale text-amber',
  'bg-[#e9eef7] text-[#35507f]',
  'bg-[#f6e8ee] text-[#8a3a5c]',
]

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-semibold select-none',
        { xs: 'size-6 text-[10px]', sm: 'size-8 text-[11.5px]', md: 'size-9 text-[12.5px]', lg: 'size-12 text-[15px]', xl: 'size-16 text-xl' }[size],
        AVATAR_TONES[h % AVATAR_TONES.length],
        className,
      )}
    >
      {initials(name) || '?'}
    </span>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-md', className)} />
}

export function SkeletonRows({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
  compact,
}: {
  icon?: ReactNode
  title: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      {icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-green-50 text-green ring-1 ring-green/10 [&_svg]:size-5">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-text">{title}</h3>
      {children && <div className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-text-2">{children}</div>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

export type Crumb = { label: string; to?: string }

export function PageHeader({
  title,
  description,
  actions,
  crumbs,
  meta,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  crumbs?: Crumb[]
  /** badges or facts under the title */
  meta?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('mb-6 sm:mb-8', className)}>
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2.5">
          <ol className="flex flex-wrap items-center gap-1 text-[13px] text-text-3">
            {crumbs.map((c, i) => (
              <li key={i} className="flex items-center gap-1">
                {c.to ? (
                  <Link to={c.to} className="rounded transition-colors hover:text-text">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-text-2">{c.label}</span>
                )}
                {i < crumbs.length - 1 && <ChevronRight className="size-3.5 opacity-60" />}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-text sm:text-[30px]">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-[14.5px] leading-relaxed text-text-2">{description}</p>}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}

export function Progress({
  value,
  max,
  tone = 'green',
  className,
  size = 'md',
  label,
}: {
  value: number
  max: number
  tone?: 'green' | 'gold' | 'teal' | 'amber' | 'red'
  className?: string
  size?: 'sm' | 'md'
  label?: string
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('overflow-hidden rounded-full bg-ink/[.07]', size === 'sm' ? 'h-1.5' : 'h-2', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-700 ease-[var(--ease-reveal)]',
          { green: 'bg-green', gold: 'bg-gold', teal: 'bg-teal', amber: 'bg-[#c98a0b]', red: 'bg-red' }[tone],
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-grid h-5 min-w-5 place-items-center rounded-[5px] bg-paper px-1 font-sans text-[11px] font-medium text-text-2 ring-1 ring-line shadow-[0_1px_0_rgba(20,26,24,.08)]',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

export function Divider({ className, label }: { className?: string; label?: string }) {
  if (!label) return <hr className={cn('border-line-2', className)} />
  return (
    <div className={cn('flex items-center gap-3 text-[12px] text-text-3', className)}>
      <span className="h-px flex-1 bg-line-2" />
      {label}
      <span className="h-px flex-1 bg-line-2" />
    </div>
  )
}

/** A banner across the top of a card or page: something needs doing. */
export function Callout({
  tone = 'green',
  icon,
  title,
  children,
  action,
  className,
}: {
  tone?: 'green' | 'amber' | 'red' | 'teal' | 'neutral'
  icon?: ReactNode
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl px-4 py-3.5 sm:flex-row sm:items-center',
        {
          green: 'bg-green-50 text-green ring-1 ring-green/15',
          amber: 'bg-amber-pale text-amber ring-1 ring-[#e7d3a8]',
          red: 'bg-red-pale text-red ring-1 ring-red/15',
          teal: 'bg-teal-pale text-teal ring-1 ring-teal/15',
          neutral: 'bg-ink/[.04] text-text-2 ring-1 ring-line',
        }[tone],
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {icon && <div className="mt-0.5 shrink-0 [&_svg]:size-[18px]">{icon}</div>}
        <div className="min-w-0 text-[13.5px] leading-relaxed">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={cn(title && 'opacity-90')}>{children}</div>}
        </div>
      </div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </div>
  )
}
