import type { ReactNode } from 'react'
import { CreditCard } from 'lucide-react'
import { COUNTRIES, FREQUENCIES, type Frequency } from '../../../shared/domain'
import type { PaymentMethodSummary } from '../../../shared/types'
import { daysUntil, formatDate, formatMoney } from '../../portal/format'
import { cn } from '../../portal/ui'
import type { MyPlan } from './data'

/* Small pieces the donor pages share: how a card is written, how a regular
   gift is said in words, section headings. Kept here so "Visa ending 4242"
   and "$50 a month" read the same on every screen. */

export const countryName = (c?: string) => (c ? COUNTRIES[c] ?? c : '')

/** "$50 a month" */
export const perPeriod = (p: Pick<MyPlan, 'amount' | 'frequency'>) =>
  `${formatMoney(p.amount)} ${FREQUENCIES[p.frequency as Frequency].per}`

/** When the next payment goes out, in words a person would use. */
export function nextPaymentText(p: MyPlan): string {
  if (p.status === 'cancelled') return p.cancelledAt ? `Cancelled ${formatDate(p.cancelledAt)}` : 'Cancelled'
  if (p.status === 'completed') return 'Paid in full'
  if (p.status === 'past_due') return p.failure?.nextRetryAt ? `We will try again ${formatDate(p.failure.nextRetryAt)}` : 'Waiting for a new card'
  if (p.status === 'paused') return p.pausedUntil ? `Paused until ${formatDate(p.pausedUntil)}` : 'Paused until you resume'
  if (!p.nextChargeAt) return '—'
  const d = daysUntil(p.nextChargeAt)
  if (d <= 0) return 'Going out today'
  if (d === 1) return 'Tomorrow'
  return formatDate(p.nextChargeAt)
}

export function cardLabel(pm?: PaymentMethodSummary | null) {
  if (!pm) return 'No card on file'
  if (pm.method === 'paypal') return 'PayPal'
  return pm.last4 ? `${pm.brand ?? 'Card'} ending ${pm.last4}` : 'Card'
}

export function cardExpired(pm?: PaymentMethodSummary | null) {
  if (!pm?.expYear || !pm.expMonth) return false
  const now = new Date()
  return pm.expYear < now.getFullYear() || (pm.expYear === now.getFullYear() && pm.expMonth < now.getMonth() + 1)
}

/** A small card with the brand and last four — the way a wallet shows it. */
export function CardChip({ payment, className }: { payment?: PaymentMethodSummary | null; className?: string }) {
  const expired = cardExpired(payment)
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2 text-[13px] text-text-2', className)}>
      <span className="grid h-5 w-8 shrink-0 place-items-center rounded-[4px] bg-ink/[.06] ring-1 ring-inset ring-line text-text-3">
        {payment?.brand && payment.brand !== 'Card' ? (
          <span className="text-[8.5px] leading-none font-bold tracking-tight text-text-2 uppercase">{payment.brand === 'Mastercard' ? 'MC' : payment.brand.slice(0, 4)}</span>
        ) : (
          <CreditCard className="size-3" />
        )}
      </span>
      <span className="nums truncate">
        {payment?.last4 ? `•••• ${payment.last4}` : cardLabel(payment)}
        {payment?.expMonth && payment.expYear ? (
          <span className={cn('ml-1.5', expired ? 'font-medium text-red' : 'text-text-3')}>
            {expired ? 'expired ' : ''}
            {String(payment.expMonth).padStart(2, '0')}/{String(payment.expYear).slice(-2)}
          </span>
        ) : null}
      </span>
    </span>
  )
}

export function SectionHeading({ title, action, className, children }: { title: ReactNode; action?: ReactNode; className?: string; children?: ReactNode }) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-text">{title}</h2>
        {children && <p className="mt-0.5 text-[13px] text-text-2">{children}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** Instalment progress: "3 of 10 paid" with a bar. */
export function InstalmentProgress({ plan, className }: { plan: MyPlan; className?: string }) {
  const total = plan.instalments?.total ?? 0
  const paid = plan.instalments?.paid ?? 0
  if (!total) return null
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
        <span className="font-medium text-text">
          <span className="nums">{paid}</span> of <span className="nums">{total}</span> paid
        </span>
        <span className="nums text-text-3">
          {formatMoney(plan.amount * paid)} of {formatMoney(plan.amount * total)}
        </span>
      </div>
      <div className="flex gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={paid} aria-label="Instalments paid">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < paid ? 'bg-green' : 'bg-ink/[.08]')} />
        ))}
      </div>
    </div>
  )
}
