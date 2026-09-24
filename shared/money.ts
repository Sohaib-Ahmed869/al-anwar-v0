/* Cents to words. The only place money is formatted, on screen, in email and
   in a CSV — so a receipt and the portal can never print the same gift two
   different ways. */

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })
const AUD_WHOLE = new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0,
})

/** $1,234.50 — or $1,235 with `whole`, and $1,234 when the cents are zero. */
export function formatMoney(cents: number | null | undefined, opts: { whole?: boolean; exact?: boolean } = {}) {
  const v = (cents ?? 0) / 100
  if (opts.exact) return AUD.format(v)
  if (opts.whole || Number.isInteger(v)) return AUD_WHOLE.format(opts.whole ? Math.round(v) : v)
  return AUD.format(v)
}

/** $48.2k, $1.3m — for tiles and chart axes, never for a receipt. */
export function formatMoneyShort(cents: number | null | undefined) {
  const v = (cents ?? 0) / 100
  const a = Math.abs(v)
  if (a >= 1_000_000) return `$${(v / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}m`
  if (a >= 10_000) return `$${Math.round(v / 1000)}k`
  if (a >= 1_000) return `$${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return `$${Math.round(v)}`
}

/** "12.50" → 1250. Returns NaN for anything that is not a sum of money. */
export function parseMoney(input: string | number): number {
  if (typeof input === 'number') return Math.round(input * 100)
  const s = input.replace(/[$,\s]/g, '')
  if (!/^-?\d+(\.\d{0,2})?$/.test(s)) return NaN
  return Math.round(Number(s) * 100)
}

/** Cents as a plain decimal for CSV and Xero: 1250 → "12.50". */
export const centsToDecimal = (cents: number) => (cents / 100).toFixed(2)

export const formatNumber = (n: number) => new Intl.NumberFormat('en-AU').format(n)

export const formatPercent = (n: number, digits = 0) =>
  `${(n * 100).toFixed(digits).replace(/\.0+$/, '')}%`
