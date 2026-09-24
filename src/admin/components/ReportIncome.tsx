import { useQuery } from '@tanstack/react-query'
import { Download, HandCoins, Receipt, Users, Wallet } from 'lucide-react'
import { api, download } from '../../portal/api'
import { BarList, Donut, MoneyColumnChart } from '../../portal/charts'
import { formatMoney, formatNumber, formatPercent } from '../../portal/format'
import { Button, Card, CardBody, CardHeader, EmptyState, Money, Segmented, Stat, toast, type DateRange } from '../../portal/ui'
import { ReportLoading, ReportTable, type ReportColumn } from './ReportBits'

/* ---------------------------------------------------------------------------
   Reports › Income. One question at a time — "by appeal", "by designation" —
   answered three ways: the tiles (how much, from how many), a chart (the
   shape), and the table (the numbers, with totals, exactly as the CSV).

   Parts of a whole (designation, method, source) get a ring; the rest get
   the month-by-month columns plus a ranked bar list, because twelve appeals
   in a ring is a colour-matching exercise, not a chart.
--------------------------------------------------------------------------- */

export type IncomeGroup = 'appeal' | 'designation' | 'country' | 'method' | 'month' | 'source'
type Row = { key: string; label: string; amount: number; fees: number; count: number; donors: number }
type Income = {
  from: string
  to: string
  group: IncomeGroup
  rows: Row[]
  totals: { amount: number; fees: number; count: number; donors: number }
  series: { month: string; label: string; amount: number; count: number }[]
}

export const GROUP_OPTIONS: { value: IncomeGroup; label: string }[] = [
  { value: 'appeal', label: 'Appeal' },
  { value: 'designation', label: 'Designation' },
  { value: 'country', label: 'Country' },
  { value: 'method', label: 'Method' },
  { value: 'month', label: 'Month' },
  { value: 'source', label: 'Source' },
]
const RING: IncomeGroup[] = ['designation', 'method', 'source']

export function ReportIncome({ range, group, onGroup, canExport }: { range: DateRange; group: IncomeGroup; onGroup: (g: IncomeGroup) => void; canExport: boolean }) {
  const q = useQuery({
    queryKey: ['reports', 'income', range, group],
    queryFn: () => api.get<Income>('/admin/reports/income', { ...range, group }),
    placeholderData: (prev) => prev,
  })
  const d = q.data
  const name = GROUP_OPTIONS.find((g) => g.value === group)!.label.toLowerCase()

  const columns: ReportColumn<Row>[] = [
    { key: 'label', header: GROUP_OPTIONS.find((g) => g.value === group)!.label, cell: (r) => <span className="font-medium text-text">{r.label}</span> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (r) => <Money cents={r.amount} className="font-medium text-text" />, total: d && <Money cents={d.totals.amount} /> },
    {
      key: 'share',
      header: 'Share',
      align: 'right',
      hideOnMobile: false,
      cell: (r) => (
        <span className="inline-flex items-center justify-end gap-2">
          <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-ink/[.07] sm:block">
            <span className="block h-full rounded-full bg-green" style={{ width: `${d?.totals.amount ? (r.amount / d.totals.amount) * 100 : 0}%` }} />
          </span>
          <span className="nums w-10 text-text-2">{d?.totals.amount ? formatPercent(r.amount / d.totals.amount) : '—'}</span>
        </span>
      ),
      total: '100%',
    },
    { key: 'count', header: 'Gifts', align: 'right', cell: (r) => <span className="nums">{formatNumber(r.count)}</span>, total: d && formatNumber(d.totals.count) },
    { key: 'donors', header: 'Donors', align: 'right', cell: (r) => <span className="nums">{formatNumber(r.donors)}</span>, total: d && formatNumber(d.totals.donors) },
    { key: 'fees', header: 'Fees covered', align: 'right', cell: (r) => <Money cents={r.fees} className="text-text-2" />, total: d && <Money cents={d.totals.fees} /> },
  ]

  const exportCsv = () =>
    download('/admin/reports/income.csv', { ...range, group }, 'income.csv')
      .then(() => toast.success('Income report downloaded'))
      .catch((e) => toast.error(e.message))

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1.5 text-[12.5px] font-medium text-text-2">Group by</p>
          <Segmented aria-label="Group income by" value={group} onChange={onGroup} options={GROUP_OPTIONS} />
        </div>
        {canExport && (
          <Button variant="secondary" icon={<Download />} onClick={exportCsv} disabled={!d?.rows.length}>
            Export CSV
          </Button>
        )}
      </div>

      {!d ? (
        <ReportLoading />
      ) : (
        <div className={q.isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={<Wallet />} label="Income" value={<Money cents={d.totals.amount} />} hint="paid gifts only" />
            <Stat icon={<HandCoins />} label="Gifts" value={formatNumber(d.totals.count)} hint={d.totals.count ? `average ${formatMoney(Math.round(d.totals.amount / d.totals.count), { whole: true })}` : undefined} />
            <Stat icon={<Users />} label="Donors" value={formatNumber(d.totals.donors)} hint={d.totals.donors ? `${formatMoney(Math.round(d.totals.amount / d.totals.donors), { whole: true })} each on average` : undefined} />
            <Stat icon={<Receipt />} label="Fees covered by donors" value={<Money cents={d.totals.fees} />} hint="on top of the gifts" />
          </div>

          {d.totals.count === 0 ? (
            <Card className="mt-5">
              <EmptyState icon={<Wallet />} title="No income in these dates">
                Choose a wider date range above — this financial year, or last.
              </EmptyState>
            </Card>
          ) : (
            <>
              <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <Card>
                  <CardHeader title="Month by month" description="Paid gifts, by the month they arrived" />
                  <CardBody>
                    <MoneyColumnChart data={d.series} xKey="label" series={[{ key: 'amount', label: 'Income' }]} height={250} />
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title={`By ${name}`} description={RING.includes(group) ? 'Share of the total' : d.rows.length > 6 ? 'The six largest, with the number of gifts' : 'With the number of gifts'} />
                  <CardBody>
                    {RING.includes(group) ? (
                      <Donut rows={d.rows.map((r) => ({ label: r.label, value: r.amount }))} centerLabel="total" />
                    ) : (
                      <BarList rows={d.rows.slice(0, 6).map((r) => ({ key: r.key, label: r.label, value: r.amount, sub: `· ${formatNumber(r.count)}` }))} />
                    )}
                  </CardBody>
                </Card>
              </div>

              <Card className="mt-5 overflow-hidden">
                <CardHeader title={`Income by ${name}`} description="The same figures as the CSV export." />
                <ReportTable
                  columns={columns}
                  rows={d.rows}
                  rowKey={(r) => r.key}
                  mobileTitle={(r) => r.label}
                  mobileValue={(r) => <Money cents={r.amount} />}
                />
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  )
}
