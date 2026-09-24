import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-2xl bg-paper ring-1 ring-line/80 shadow-soft', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
  icon,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  icon?: ReactNode
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5 pb-3 sm:px-6', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-green-50 text-green [&_svg]:size-4">{icon}</div>}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-text">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] leading-snug text-text-2">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-5 pb-5 sm:px-6 sm:pb-6', className)}>{children}</div>
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('flex items-center justify-end gap-2 border-t border-line-2 px-5 py-3.5 sm:px-6', className)}>{children}</div>
  )
}

/** A label-and-value list — the facts about a record. */
export function DescriptionList({
  items,
  className,
  columns = 1,
}: {
  items: { label: ReactNode; value: ReactNode; hidden?: boolean }[]
  className?: string
  columns?: 1 | 2
}) {
  return (
    <dl className={cn('grid gap-x-6', columns === 2 ? 'sm:grid-cols-2' : '', className)}>
      {items
        .filter((i) => !i.hidden)
        .map((i, n) => (
          <div key={n} className="flex items-baseline justify-between gap-4 border-b border-line-2 py-2.5 last:border-0 sm:[&:nth-last-child(2)]:border-0">
            <dt className="shrink-0 text-[13px] text-text-2">{i.label}</dt>
            <dd className="min-w-0 text-right text-sm text-text [overflow-wrap:anywhere]">{i.value}</dd>
          </div>
        ))}
    </dl>
  )
}
