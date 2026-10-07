import type { Response } from 'express'

/* ---------------------------------------------------------------------------
   Writing CSV files: every export the platform makes goes through here — the
   donor list, gifts, reports, receipts, the Xero bank file, the action logs
   and the compliance registers. One cell function, so one rule.

   Quoting follows RFC 4180 — a field with a comma, a quote, a line break or
   leading/trailing space is wrapped in quotes, and quotes inside are doubled —
   because donor names ("Smith, John"), appeal titles and bank narratives all
   contain commas sooner or later.

   Formula injection: a spreadsheet runs a cell that starts with = + - or @
   (and, in some programs, a tab, a carriage return or a line feed, or the
   full-width ＝ ＋ － ＠ that Excel folds into the ASCII ones). A donor could
   type "=HYPERLINK(...)" as their name on the website and finance would open
   it in Excel. So any text cell starting with one of those gets an apostrophe
   in front, which Excel shows as plain text and does not print.

   The one exception is a cell that is a plain number and nothing else —
   "-12.50", "42" — because a refund's negative amount must stay a number in
   the sheet. "-1+HYPERLINK(...)" is not a plain number, so it is escaped;
   the old rule let "-" followed by a digit through whatever came after.
--------------------------------------------------------------------------- */

export type CsvCell = string | number | boolean | null | undefined | Date
export type CsvRow = CsvCell[]

const FORMULA = /^[=+\-@\t\r\n＝＋－＠]/
const NUMERIC = /^-?\d+(\.\d+)?$/

/** One cell, escaped and quoted. Exported for the few producers that build
 *  their own lines; prefer toCsv/sendCsv. */
export function csvCell(v: CsvCell): string {
  if (v == null) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  let s = v instanceof Date ? v.toISOString() : String(v)
  if (FORMULA.test(s) && !NUMERIC.test(s)) s = `'${s}`
  return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: CsvRow[]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** Send rows as a download. `bom` makes Excel read the file as UTF-8 (names
 *  with accents); leave it off for files another system imports, like Xero. */
export function sendCsv(res: Response, filename: string, rows: CsvRow[], opts: { bom?: boolean } = { bom: true }) {
  const body = (opts.bom === false ? '' : '﻿') + toCsv(rows)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/[^\w.-]+/g, '-')}"`)
  res.setHeader('Cache-Control', 'no-store')
  res.send(body)
}
