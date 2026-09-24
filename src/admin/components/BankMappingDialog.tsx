import { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Dialog, FormError, Segmented, Select, cn } from '../../portal/ui'

/* ---------------------------------------------------------------------------
   "Which column is which?" — shown when the server could not recognise a
   statement's layout. The first rows are laid out as a table with a choice
   above every column, which is how people think about a spreadsheet: look at
   the column, say what it is. Nothing about the file is remembered.
--------------------------------------------------------------------------- */

export type ColumnMapping = {
  date: number
  amount?: number
  credit?: number
  debit?: number
  description: number
  reference?: number
  dateFormat: 'dmy' | 'mdy' | 'ymd'
  hasHeader: boolean
}

export type MappingRequest = {
  headers: string[]
  sample: string[][]
  hasHeader: boolean
  dateFormat?: 'dmy' | 'mdy' | 'ymd'
  message?: string
}

type Role = '' | 'date' | 'amount' | 'credit' | 'debit' | 'description' | 'reference'
const ROLES: { value: Role; label: string }[] = [
  { value: '', label: 'Not needed' },
  { value: 'date', label: 'Date' },
  { value: 'amount', label: 'Amount (in and out)' },
  { value: 'credit', label: 'Money in' },
  { value: 'debit', label: 'Money out' },
  { value: 'description', label: 'Description' },
  { value: 'reference', label: 'Reference' },
]

/** A first guess from the headings, so the person corrects rather than starts from nothing. */
function guess(headers: string[]): Role[] {
  const used = new Set<Role>()
  return headers.map((h) => {
    const s = h.toLowerCase()
    const r: Role = /date/.test(s)
      ? 'date'
      : /credit|money in|deposit/.test(s)
        ? 'credit'
        : /debit|money out|withdraw/.test(s)
          ? 'debit'
          : /amount|value/.test(s)
            ? 'amount'
            : /narrative|description|details|particulars|memo|payee/.test(s)
              ? 'description'
              : /ref/.test(s)
                ? 'reference'
                : ''
    if (!r || used.has(r)) return ''
    used.add(r)
    return r
  })
}

export function BankMappingDialog({
  request,
  fileName,
  busy,
  onCancel,
  onSubmit,
}: {
  request: MappingRequest | null
  fileName?: string
  busy: boolean
  onCancel: () => void
  onSubmit: (m: ColumnMapping) => void
}) {
  const [roles, setRoles] = useState<Role[]>([])
  const [hasHeader, setHasHeader] = useState(false)
  const [dateFormat, setDateFormat] = useState<'dmy' | 'mdy' | 'ymd'>('dmy')

  useEffect(() => {
    if (!request) return
    setRoles(request.hasHeader ? guess(request.headers) : request.headers.map(() => ''))
    setHasHeader(request.hasHeader)
    setDateFormat(request.dateFormat ?? 'dmy')
  }, [request])

  const idx = (r: Role) => {
    const i = roles.indexOf(r)
    return i >= 0 ? i : undefined
  }
  const missing = useMemo(() => {
    const m: string[] = []
    if (idx('date') === undefined) m.push('the date')
    if (idx('amount') === undefined && idx('credit') === undefined) m.push('the amount (or money in)')
    if (idx('description') === undefined) m.push('the description')
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles])

  const setRole = (col: number, r: Role) =>
    setRoles((prev) => prev.map((x, i) => (i === col ? r : r && x === r ? '' : x)))

  const submit = () => {
    if (missing.length) return
    onSubmit({
      date: idx('date')!,
      amount: idx('amount'),
      credit: idx('credit'),
      debit: idx('debit'),
      description: idx('description')!,
      reference: idx('reference'),
      dateFormat,
      hasHeader,
    })
  }

  const rows = request?.sample ?? []
  const width = request?.headers.length ?? 0

  return (
    <Dialog
      open={Boolean(request)}
      onOpenChange={(v) => !v && !busy && onCancel()}
      size="xl"
      title="Which column is which?"
      description={
        <>
          We could not recognise the layout of <span className="font-medium text-text">{fileName ?? 'this file'}</span>. Choose what each column holds — you only need the date, the amount and the description.
        </>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={missing.length > 0} loading={busy}>
            Read the statement
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={request?.message} />
        <div className="overflow-x-auto rounded-xl ring-1 ring-line">
          <table className="w-full min-w-max border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                {Array.from({ length: width }, (_, c) => (
                  <th key={c} className="min-w-[150px] border-b border-line bg-paper-2 p-2 text-left align-bottom font-normal">
                    <span className="mb-1.5 block truncate text-[11.5px] font-medium tracking-wide text-text-3 uppercase">{request?.headers[c]}</span>
                    <Select
                      aria-label={`What column ${c + 1} holds`}
                      value={roles[c] ?? ''}
                      onChange={(e) => setRole(c, e.target.value as Role)}
                      className={cn('h-9 text-[13px]', roles[c] && 'bg-green-50 ring-green/40')}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {Array.from({ length: width }, (_, c) => (
                    <td key={c} className={cn('max-w-[260px] truncate border-b border-line-2 px-3 py-2 font-mono text-[12px] text-text-2', roles[c] && 'bg-green-50/40 text-text')}>
                      {r[c] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <Checkbox
            checked={hasHeader}
            onChange={setHasHeader}
            label="The first row is headings"
            description="Tick this if the file's first row names the columns rather than holding a transaction."
          />
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-text">Dates are written</p>
            <Segmented
              size="sm"
              aria-label="Date format"
              value={dateFormat}
              onChange={setDateFormat}
              options={[
                { value: 'dmy', label: 'Day first' },
                { value: 'mdy', label: 'Month first' },
                { value: 'ymd', label: 'Year first' },
              ]}
            />
          </div>
        </div>

        {missing.length > 0 && <p className="text-[13px] text-text-2">Still to choose: {missing.join(', ')}.</p>}
      </div>
    </Dialog>
  )
}
