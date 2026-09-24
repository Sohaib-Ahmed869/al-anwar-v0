import { format, formatDistanceToNowStrict, isToday, isYesterday, differenceInCalendarDays } from 'date-fns'

export { formatMoney, formatMoneyShort, formatNumber, formatPercent, parseMoney } from '../../shared/money'

type D = string | Date | null | undefined

const toDate = (d: D) => (d ? new Date(d) : null)

/** 24 Sep 2026 */
export const formatDate = (d: D) => (toDate(d) ? format(toDate(d)!, 'd MMM yyyy') : '—')

/** 24 September 2026 */
export const formatDateLong = (d: D) => (toDate(d) ? format(toDate(d)!, 'd MMMM yyyy') : '—')

/** 24 Sep 2026, 3:04 pm */
export const formatDateTime = (d: D) => (toDate(d) ? format(toDate(d)!, "d MMM yyyy, h:mm aaa") : '—')

/** Today, Yesterday, Mon 21 Sep, or 21 Sep 2025 — for lists people scan. */
export function formatDay(d: D) {
  const x = toDate(d)
  if (!x) return '—'
  if (isToday(x)) return 'Today'
  if (isYesterday(x)) return 'Yesterday'
  const days = Math.abs(differenceInCalendarDays(new Date(), x))
  if (days < 7) return format(x, 'EEE d MMM')
  if (x.getFullYear() === new Date().getFullYear()) return format(x, 'd MMM')
  return format(x, 'd MMM yyyy')
}

/** "3 days ago", "in 5 days" */
export function formatRelative(d: D) {
  const x = toDate(d)
  if (!x) return '—'
  if (Math.abs(Date.now() - x.getTime()) < 60_000) return 'just now'
  const s = formatDistanceToNowStrict(x, { roundingMethod: 'floor' })
  return x.getTime() < Date.now() ? `${s} ago` : `in ${s}`
}

/** Days from today to d; negative when d has passed. */
export const daysUntil = (d: D) => (toDate(d) ? differenceInCalendarDays(toDate(d)!, new Date()) : 0)

export const toInputDate = (d: D) => (toDate(d) ? format(toDate(d)!, 'yyyy-MM-dd') : '')

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-AU')} ${n === 1 ? one : many}`
