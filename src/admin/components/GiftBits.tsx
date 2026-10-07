import type { ReactNode } from 'react'
import { Banknote, CalendarHeart, CreditCard, FileText, Landmark, Wallet } from 'lucide-react'
import { METHODS, type Method } from '../../../shared/domain'
import type { AuditEvent } from '../../../shared/types'
import { formatDateTime, formatRelative } from '../../portal/format'
import { Avatar, cn } from '../../portal/ui'

/* ---------------------------------------------------------------------------
   Small pieces the Gifts, Regular giving and Enquiries screens share: the
   donor summary the API sends with a record, method icons, the history list
   read from the action log, and a compact "3h" age for inbox rows.
--------------------------------------------------------------------------- */

/** What gifts/plans/enquiries detail endpoints send about the person. Staff
 *  without donors.read (a volunteer) get only who it is: no email (a masked
 *  `emailHint` instead), phone or giving — see donorFor() in
 *  server/routes/admin/gifts.ts. */
export type DonorSummary = {
  id: string
  number: string
  name: string
  firstName: string
  lastName: string
  /** '' when the record only has a placeholder address; absent when masked */
  email?: string
  /** "a•••@example.com", when the address is masked */
  emailHint?: string
  hasEmail: boolean
  phone?: string
  totalGiven?: number
  giftCount?: number
  firstGiftAt?: string
  lastGiftAt?: string
  hasActivePlan?: boolean
}

/** A donor record entered without an email carries a placeholder on the
 *  reserved .invalid domain; nothing is ever sent to it. */
export const isPlaceholderEmail = (email?: string | null) => Boolean(email?.toLowerCase().endsWith('.invalid'))

export const METHOD_ICONS: Record<Method, typeof Banknote> = {
  card: CreditCard,
  paypal: Wallet,
  bank: Landmark,
  cash: Banknote,
  cheque: FileText,
  event: CalendarHeart,
}

export function MethodLabel({ method, className }: { method: string; className?: string }) {
  const Icon = METHOD_ICONS[method as Method] ?? Banknote
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-text-2', className)}>
      <Icon className="size-3.5 shrink-0 text-text-3" aria-hidden />
      {METHODS[method as Method]?.label ?? method}
    </span>
  )
}

/** "4m", "3h", "2d", "5w" — for rows people scan. */
export function shortAge(d: string | Date) {
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86_400) return `${Math.floor(s / 3600)}h`
  if (s < 86_400 * 14) return `${Math.floor(s / 86_400)}d`
  if (s < 86_400 * 90) return `${Math.floor(s / (86_400 * 7))}w`
  return `${Math.floor(s / (86_400 * 30))}mo`
}

/** A section heading inside a Sheet. */
export function SheetSection({ title, action, children, className }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('mt-7 first:mt-0', className)}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h3 className="text-[12px] font-semibold tracking-[0.06em] text-text-3 uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Who did what to this record, newest first, from the action log. */
export function HistoryList({ events, empty = 'Nothing has been changed yet.' }: { events: AuditEvent[]; empty?: string }) {
  if (!events.length) return <p className="text-[13px] text-text-3">{empty}</p>
  return (
    <ol className="relative space-y-3.5 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-line-2">
      {events.map((e) => (
        <li key={e.id} className="relative flex gap-3">
          <Avatar name={e.actor.name} size="xs" className="relative ring-2 ring-paper" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-snug text-text">{e.summary}</p>
            <p className="mt-0.5 text-[12px] text-text-3" title={formatDateTime(e.at)}>
              {e.actor.name} · {formatRelative(e.at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
