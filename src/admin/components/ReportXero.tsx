import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpenCheck, Download, FileSpreadsheet, Save } from 'lucide-react'
import { DESIGNATIONS, DESIGNATION_KEYS, type Designation } from '../../../shared/domain'
import { ApiError, api, download } from '../../portal/api'
import { formatNumber } from '../../portal/format'
import { Button, Card, CardBody, CardFooter, CardHeader, EmptyState, Field, Input, Money, Segmented, Skeleton, Stat, cn, toast, type DateRange } from '../../portal/ui'

/* ---------------------------------------------------------------------------
   Reports › Xero export. The bookkeeper's month-end in three parts: which
   income account each designation goes to (set once, kept), a preview of
   exactly what the file will contain, and the download.

   The file is Xero's precoded bank statement layout, so on import every
   line arrives with its account code, tax type and appeal tracking already
   set — the bookkeeper reconciles rather than codes. Zakat stays in its own
   account from the moment it is given to the moment it is in the ledger.
--------------------------------------------------------------------------- */

type Settings = { accounts: Record<Designation, string>; feesAccount: string; trackingName: string; taxType: string }
type Preview = {
  header: string[]
  rows: string[][]
  totals: { gifts: number; lines: number; amount: number; fees: number }
  byAccount: { designation: Designation; label: string; code: string; amount: number; count: number }[]
}

const METHOD_SETS = [
  { value: 'all', label: 'All donations', methods: '' },
  { value: 'bank', label: 'Bank transfers', methods: 'bank' },
  { value: 'online', label: 'Card and PayPal', methods: 'card,paypal' },
  { value: 'offline', label: 'Cash, cheques, events', methods: 'cash,cheque,event' },
] as const
type MethodSet = (typeof METHOD_SETS)[number]['value']

export function ReportXero({ range, methods, onMethods }: { range: DateRange; methods: MethodSet; onMethods: (m: MethodSet) => void }) {
  const qc = useQueryClient()
  const methodParam = METHOD_SETS.find((m) => m.value === methods)?.methods || undefined
  const settings = useQuery({ queryKey: ['reports', 'xero-settings'], queryFn: () => api.get<Settings>('/admin/reports/xero-settings') })
  const preview = useQuery({
    queryKey: ['reports', 'xero', range, methods],
    queryFn: () => api.get<Preview>('/admin/reports/xero/preview', { ...range, methods: methodParam }),
    placeholderData: (prev) => prev,
  })

  const [draft, setDraft] = useState<Settings | null>(null)
  useEffect(() => {
    if (settings.data) setDraft(settings.data)
  }, [settings.data])
  const dirty = Boolean(draft && settings.data && JSON.stringify(draft) !== JSON.stringify(settings.data))

  const save = useMutation({
    mutationFn: (s: Settings) => api.put<Settings>('/admin/reports/xero-settings', { accounts: s.accounts, feesAccount: s.feesAccount, trackingName: s.trackingName }),
    onSuccess: (s) => {
      qc.setQueryData(['reports', 'xero-settings'], s)
      qc.invalidateQueries({ queryKey: ['reports', 'xero'] })
      toast.success('Account codes saved. The next export uses them.')
    },
  })
  const fieldErr = (k: string) => (save.error instanceof ApiError ? save.error.fields[k] : undefined)

  const [downloading, setDownloading] = useState(false)
  const get = () => {
    setDownloading(true)
    download('/admin/reports/xero', { ...range, methods: methodParam }, 'xero.csv')
      .then(() => toast.success('Xero file downloaded', { description: 'Import it in Xero under Accounting → Bank accounts → Import a statement.' }))
      .catch((e) => toast.error(e.message))
      .finally(() => setDownloading(false))
  }

  const p = preview.data

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1.5 text-[12.5px] font-medium text-text-2">Which money</p>
          <Segmented aria-label="Which donations to export" value={methods} onChange={onMethods} options={METHOD_SETS.map((m) => ({ value: m.value, label: m.label }))} />
        </div>
        <Button variant="primary" icon={<Download />} loading={downloading} disabled={!p?.totals.gifts || dirty} onClick={get}>
          Download for Xero
        </Button>
      </div>
      {dirty && <p className="-mt-2 text-right text-[12.5px] text-amber">Save the account codes first, so the file uses them.</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<FileSpreadsheet />} label="Donations in the file" value={p ? formatNumber(p.totals.gifts) : '—'} loading={!p} hint={p && p.totals.lines > p.totals.gifts ? `${formatNumber(p.totals.lines)} lines with operating costs` : undefined} />
        <Stat label="Income" value={p ? <Money cents={p.totals.amount} /> : '—'} loading={!p} />
        <Stat label="Operating costs contributions" value={p ? <Money cents={p.totals.fees} /> : '—'} loading={!p} hint="coded to the operating costs account" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        {/* ---------- account codes ---------- */}
        <Card>
          <CardHeader title="Account codes" description="Which income account in your Xero chart each designation is coded to." />
          <CardBody>
            {!draft ? (
              <div className="space-y-3">
                {Array.from({ length: 7 }, (_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : (
              <form
                id="xero-codes"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (dirty) save.mutate(draft)
                }}
              >
                <ul className="divide-y divide-line-2">
                  {DESIGNATION_KEYS.map((k) => {
                    const row = p?.byAccount.find((b) => b.designation === k)
                    return (
                      <li key={k} className="flex items-center gap-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-medium text-text">{DESIGNATIONS[k].label}</p>
                          <p className="nums text-[12px] text-text-3">{row ? <><Money cents={row.amount} /> in these dates</> : 'Nothing in these dates'}</p>
                        </div>
                        <div className="w-24 shrink-0">
                          <Input
                            aria-label={`Account code for ${DESIGNATIONS[k].label}`}
                            value={draft.accounts[k]}
                            invalid={Boolean(fieldErr(`accounts.${k}`))}
                            onChange={(e) => setDraft({ ...draft, accounts: { ...draft.accounts, [k]: e.target.value } })}
                            className="nums h-9 text-center"
                          />
                        </div>
                      </li>
                    )
                  })}
                  <li className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium text-text">Operating costs contributions</p>
                      <p className="text-[12px] text-text-3">Offsets what the card processor charged</p>
                    </div>
                    <div className="w-24 shrink-0">
                      <Input aria-label="Account code for operating costs contributions" value={draft.feesAccount} invalid={Boolean(fieldErr('feesAccount'))} onChange={(e) => setDraft({ ...draft, feesAccount: e.target.value })} className="nums h-9 text-center" />
                    </div>
                  </li>
                </ul>
                <Field className="mt-3" label="Tracking category" help="The name of the tracking category in Xero that holds your appeals." error={fieldErr('trackingName')}>
                  <Input value={draft.trackingName} onChange={(e) => setDraft({ ...draft, trackingName: e.target.value })} />
                </Field>
                {save.error && !(save.error instanceof ApiError && Object.keys(save.error.fields).length) && (
                  <p className="mt-3 text-[13px] text-red">{(save.error as Error).message}</p>
                )}
                {save.error instanceof ApiError && Object.keys(save.error.fields).length > 0 && (
                  <p className="mt-3 text-[13px] text-red">{Object.values(save.error.fields)[0]}</p>
                )}
              </form>
            )}
          </CardBody>
          <CardFooter>
            <Button variant="ghost" disabled={!dirty} onClick={() => settings.data && setDraft(settings.data)}>
              Undo changes
            </Button>
            <Button type="submit" form="xero-codes" variant="primary" icon={<Save />} disabled={!dirty} loading={save.isPending}>
              Save codes
            </Button>
          </CardFooter>
        </Card>

        <div className="min-w-0 space-y-5">
          {/* ---------- preview ---------- */}
          <Card className="overflow-hidden">
            <CardHeader title="What the file contains" description={p ? `The first ${Math.min(10, p.rows.length)} of ${formatNumber(p.totals.lines)} lines, exactly as Xero will read them.` : 'Loading the first lines…'} />
            {!p ? (
              <div className="space-y-2 px-5 pb-5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            ) : !p.rows.length ? (
              <EmptyState compact icon={<FileSpreadsheet />} title="No paid donations in these dates">
                Choose other dates above, such as last month.
              </EmptyState>
            ) : (
              <div className={cn('overflow-x-auto border-t border-line-2', preview.isFetching && 'opacity-60')}>
                <table className="w-full min-w-[860px] border-separate border-spacing-0 text-[12.5px]">
                  <thead>
                    <tr>
                      {p.header.map((h) => (
                        <th key={h} className="border-b border-line bg-paper-2/70 px-3 py-2 text-left font-mono text-[11.5px] font-medium whitespace-nowrap text-text-3 first:pl-5">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {p.rows.map((r, i) => (
                      <tr key={i}>
                        {r.map((c, j) => (
                          <td key={j} className={cn('max-w-[260px] truncate border-b border-line-2 px-3 py-2 whitespace-nowrap text-text-2 first:pl-5', (j === 1 || j === 6) && 'nums font-medium text-text', j === 1 && 'text-right')} title={c}>
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* ---------- how to import ---------- */}
          <Card>
            <CardHeader icon={<BookOpenCheck />} title="Importing it into Xero" />
            <CardBody>
              <ol className="list-decimal space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-text-2 marker:text-text-3">
                <li>
                  In Xero, go to <strong className="font-medium text-text">Accounting → Bank accounts</strong> and choose the account the money went into.
                </li>
                <li>
                  Choose <strong className="font-medium text-text">Import a statement</strong>, then this file.
                </li>
                <li>Xero recognises the columns (it is Xero's precoded layout). Check the preview and import.</li>
                <li>Reconcile as usual — each line already carries its account code, tax type and appeal.</li>
              </ol>
              <p className="mt-3 text-[12.5px] leading-relaxed text-text-3">
                Export one bank account at a time: card and PayPal donations arrive through your payment provider's payouts, bank transfers straight into your account. Each donation appears once, with its receipt number as the reference.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

export type { MethodSet }
