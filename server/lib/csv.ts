import type { Response } from 'express'

/* ---------------------------------------------------------------------------
   Writing CSV files: reports, the receipts list, the Xero bank file.

   Quoting follows RFC 4180 — a field with a comma, a quote, a line break or
   leading/trailing space is wrapped in quotes, and quotes inside are doubled —
   because donor names ("Smith, John"), appeal titles and bank narratives all
   contain commas sooner or later.

   Text that starts with = + @ or a tab is prefixed with an apostrophe so a
   spreadsheet does not run it as a formula (CSV injection): a donor could
   type "=HYPERLINK(...)" as their name on the website. Numbers are written
   as they are, so a negative amount is still a number.
--------------------------------------------------------------------------- */

export type CsvCell = string | number | boolean | null | undefined | Date
export type CsvRow = CsvCell[]

const FORMULA = /^[=+@\t\r]|^-(?![\d.])/

function cell(v: CsvCell): string {
  if (v == null) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  let s = v instanceof Date ? v.toISOString() : String(v)
  if (FORMULA.test(s)) s = `'${s}`
  return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: CsvRow[]): string {
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

/** Send rows as a download. `bom` makes Excel read the file as UTF-8 (names
 *  with accents); leave it off for files another system imports, like Xero. */
export function sendCsv(res: Response, filename: string, rows: CsvRow[], opts: { bom?: boolean } = { bom: true }) {
  const body = (opts.bom === false ? '' : '\uFEFF') + toCsv(rows)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/[^\w.-]+/g, '-')}"`)
  res.setHeader('Cache-Control', 'no-store')
  res.send(body)
}
