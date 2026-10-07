/* A report already on screen, saved as CSV without another round trip.
   Registers and the audit trail export on the server (they may be larger
   than the page and the export is logged); the reports are aggregates the
   browser already holds, so they are written here. Same rules as the
   server's CSV (server/lib/csv.ts, which explains the rule): a BOM for
   Excel, quotes where needed, and a leading apostrophe on any text Excel
   would run as a formula — anything starting = + - @, a tab, CR or LF, or
   their full-width forms — unless the cell is a plain number like -12.50. */

const FORMULA = /^[=+\-@\t\r\n＝＋－＠]/
const NUMERIC = /^-?\d+(\.\d+)?$/

function cell(v: unknown) {
  let s = v === null || v === undefined ? '' : String(v)
  if (FORMULA.test(s) && !NUMERIC.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function saveCsv(filename: string, rows: unknown[][]) {
  const text = '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Cents as dollars for a spreadsheet: 1250 → 12.50 */
export const dollars = (cents: number) => (cents / 100).toFixed(2)
