import { Logo } from '../../components/Brand'
import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { AlertTriangle, Download, FileBarChart2, Globe2, History, Printer, Receipt, Wallet } from 'lucide-react'
import { COUNTRIES, DESIGNATIONS, fyLabel, fyOf, OBLIGATION_CATEGORIES, RECURRENCES, type Designation, type ObligationCategory } from '../../../shared/domain'
import { REGISTERS, registerByKey } from '../../../shared/registers'
import type { Settings } from '../../../shared/types'
import { api } from '../../portal/api'
import { BarList, Donut, MoneyColumnChart } from '../../portal/charts'
import {
  Badge, Button, Card, CardHeader, cn, DataTable, EmptyState, Money, PageHeader, Select, Skeleton, Stat, TabPanel, Tabs, useDocumentTitle,
  useUrlState, type Column,
} from '../../portal/ui'
import { formatDate, formatDateLong, formatDateTime, formatMoney, formatNumber, plural } from '../../portal/format'
import { Disclaimer } from '../components/bits'
import { dollars, saveCsv } from '../components/csv'
import type { ObligationView } from '../components/types'
import { formatValue } from './Register'

/* ---------------------------------------------------------------------------
   /compliance/reports — the reports the proposal names, one Australian
   financial year at a time: receipts issued, income by appeal and
   designation, activity by country (with the overseas partners registered
   there), the action log, and the year-end evidence pack.

   Figures come aggregated from the server (routes/compliance/reports.ts
   explains which sum each report uses). CSV exports are written in the
   browser from what is already on screen.

   THE YEAR-END PACK (?tab=pack) is a document, not a dashboard: set like a
   report, printable, and "Print or save as PDF" is the browser's own print.
   While the tab is showing, `printing-pack` is put on <html> and a print
   stylesheet scoped to it hides the portal's sidebar, top bar and bottom
   bar and this page's own controls, so only the pack reaches the paper.
   The pack defaults to the LAST completed year, because that is the year an
   auditor asks about.
--------------------------------------------------------------------------- */

type Tab = 'receipts' | 'income' | 'countries' | 'actions' | 'pack'
const monthLabel = (m: string) => format(new Date(`${m}-01T00:00:00`), 'MMM')
const monthLong = (m: string) => format(new Date(`${m}-01T00:00:00`), 'MMMM yyyy')

export default function Reports() {
  useDocumentTitle('Reports', 'Compliance')
  const cur = fyOf(new Date())
  const [s, set] = useUrlState({ tab: 'receipts', fy: '' })
  const tab = s.tab as Tab
  const fy = s.fy ? Number(s.fy) : tab === 'pack' ? cur - 1 : cur
  const years = useQuery({ queryKey: ['compliance', 'reports', 'years'], queryFn: () => api.get<{ fy: number; label: string }[]>('/compliance/reports/years'), staleTime: 600_000 })

  return (
    <>
      <div className="no-print">
        <PageHeader
          crumbs={[{ label: 'Compliance', to: '/compliance' }, { label: 'Records' }]}
          title="Reports"
          description="On demand, for the board, the auditor or the ACNC — one financial year (July to June) at a time."
          actions={
            <label className="flex items-center gap-2 text-[13px] text-text-2">
              <span className="whitespace-nowrap">Financial year</span>
              <Select value={String(fy)} onChange={(e) => set({ fy: e.target.value })} className="w-44 read-only:bg-paper">
                {(years.data ?? [{ fy: cur, label: fyLabel(cur) }, { fy: cur - 1, label: fyLabel(cur - 1) }]).map((y) => (
                  <option key={y.fy} value={y.fy}>
                    {y.label}
                    {y.fy === cur ? ' (this year)' : ''}
                  </option>
                ))}
              </Select>
            </label>
          }
        />
      </div>
      <Tabs
        value={tab}
        onChange={(v) => set({ tab: v })}
        tabs={[
          { value: 'receipts', label: 'Receipts issued' },
          { value: 'income', label: 'Income' },
          { value: 'countries', label: 'By country' },
          { value: 'actions', label: 'Action log' },
          { value: 'pack', label: 'Year-end pack' },
        ]}
      >
        <TabPanel value="receipts" className="pt-6">
          <ReceiptsReport fy={fy} />
        </TabPanel>
        <TabPanel value="income" className="pt-6">
          <IncomeReport fy={fy} />
        </TabPanel>
        <TabPanel value="countries" className="pt-6">
          <CountriesReport fy={fy} />
        </TabPanel>
        <TabPanel value="actions" className="pt-6">
          <ActionsReport fy={fy} />
        </TabPanel>
        <TabPanel value="pack" className="pt-6">
          <YearEndPack fy={fy} />
        </TabPanel>
      </Tabs>
      <div className="no-print">
        <Disclaimer />
      </div>
    </>
  )
}

function CsvButton({ onClick, label = 'Export CSV' }: { onClick: () => void; label?: string }) {
  return (
    <Button size="sm" variant="secondary" icon={<Download />} onClick={onClick}>
      {label}
    </Button>
  )
}

function Loading() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  )
}

/* ---------- receipts ---------- */
type ReceiptsData = { fy: number; months: { month: string; count: number; amount: number; resent: number }[]; total: { count: number; amount: number; resent: number } }

function ReceiptsReport({ fy }: { fy: number }) {
  const q = useQuery({ queryKey: ['compliance', 'reports', 'receipts', fy], queryFn: () => api.get<ReceiptsData>('/compliance/reports/receipts', { fy }) })
  const d = q.data
  if (!d) return <Loading />
  const busiest = [...d.months].sort((a, b) => b.count - a.count)[0]
  const cols: Column<ReceiptsData['months'][number]>[] = [
    { key: 'm', header: 'Month', cell: (m) => monthLong(m.month) },
    { key: 'c', header: 'Receipts', align: 'right', cell: (m) => <span className="nums">{formatNumber(m.count)}</span> },
    { key: 'r', header: 'Re-sent', align: 'right', hideBelow: 'lg', cell: (m) => <span className="nums text-text-2">{formatNumber(m.resent)}</span> },
    { key: 'a', header: 'Receipted value', align: 'right', cell: (m) => <Money cents={m.amount} className="font-medium" /> },
  ]
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<Receipt />} label="Receipts issued" value={formatNumber(d.total.count)} hint={`in ${fyLabel(fy)}`} />
        <Stat icon={<Wallet />} label="Receipted value" value={<Money cents={d.total.amount} />} hint="donations plus fees donors covered" />
        <Stat label="Busiest month" value={busiest && busiest.count ? monthLong(busiest.month).split(' ')[0] : '—'} hint={busiest?.count ? `${formatNumber(busiest.count)} receipts` : undefined} />
      </div>
      <Card>
        <CardHeader
          title="Receipted value by month"
          description="Every tax receipt issued, by the month it was issued."
          action={
            <CsvButton
              onClick={() =>
                saveCsv(`receipts-${fyLabel(fy)}.csv`, [
                  ['Month', 'Receipts issued', 'Re-sent', 'Receipted value (AUD)'],
                  ...d.months.map((m) => [monthLong(m.month), m.count, m.resent, dollars(m.amount)]),
                  ['Total', d.total.count, d.total.resent, dollars(d.total.amount)],
                ])
              }
            />
          }
        />
        <div className="px-3 pb-5 sm:px-5">
          <MoneyColumnChart data={d.months} xKey="month" series={[{ key: 'amount', label: 'Receipted value' }]} formatX={monthLabel} />
        </div>
        <DataTable
          columns={cols}
          rows={d.months}
          rowKey={(m) => m.month}
          dense
          mobile={(m) => (
            <div className="flex items-center justify-between">
              <span>
                <span className="block font-medium">{monthLong(m.month)}</span>
                <span className="nums text-[12.5px] text-text-3">{formatNumber(m.count)} receipts</span>
              </span>
              <Money cents={m.amount} className="font-medium" />
            </div>
          )}
          footer={
            <div className="nums flex justify-between border-t border-line px-5 py-3 text-[13.5px] font-semibold">
              <span>Total · {formatNumber(d.total.count)} receipts</span>
              <Money cents={d.total.amount} />
            </div>
          }
        />
      </Card>
    </div>
  )
}

/* ---------- income ---------- */
type IncomeData = {
  fy: number
  total: { amount: number; count: number }
  byAppeal: { appeal: string | null; title: string; country: string | null; amount: number; count: number; donors: number }[]
  byDesignation: { designation: Designation; label: string; amount: number; count: number }[]
  byMonth: { month: string; amount: number; count: number }[]
}

function IncomeReport({ fy }: { fy: number }) {
  const q = useQuery({ queryKey: ['compliance', 'reports', 'income', fy], queryFn: () => api.get<IncomeData>('/compliance/reports/income', { fy }) })
  const d = q.data
  if (!d) return <Loading />
  if (!d.total.count) return <NoGifts fy={fy} />
  const appealCols: Column<IncomeData['byAppeal'][number]>[] = [
    { key: 't', header: 'Appeal', cell: (a) => <span className="font-medium">{a.title}</span> },
    { key: 'c', header: 'Country', hideBelow: 'lg', className: 'text-text-2', cell: (a) => (a.country ? (COUNTRIES[a.country] ?? a.country) : '—') },
    { key: 'd', header: 'Donors', align: 'right', hideBelow: 'lg', cell: (a) => <span className="nums text-text-2">{formatNumber(a.donors)}</span> },
    { key: 'n', header: 'Donations', align: 'right', cell: (a) => <span className="nums text-text-2">{formatNumber(a.count)}</span> },
    { key: 'a', header: 'Amount', align: 'right', cell: (a) => <Money cents={a.amount} className="font-medium" /> },
  ]
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<Wallet />} label="Given in the year" value={<Money cents={d.total.amount} />} hint={fyLabel(fy)} />
        <Stat label="Donations" value={formatNumber(d.total.count)} hint={`average ${formatMoney(Math.round(d.total.amount / d.total.count))}`} />
        <Stat
          label="Zakat received"
          value={<Money cents={d.byDesignation.filter((x) => x.designation.startsWith('zakat')).reduce((s, x) => s + x.amount, 0)} />}
          hint="ul maal and ul fitr"
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader
            title="By designation"
            description="What donors gave it as."
            action={
              <CsvButton
                label="CSV"
                onClick={() =>
                  saveCsv(`income-by-designation-${fyLabel(fy)}.csv`, [
                    ['Designation', 'Donations', 'Amount (AUD)'],
                    ...d.byDesignation.map((x) => [x.label, x.count, dollars(x.amount)]),
                    ['Total', d.total.count, dollars(d.total.amount)],
                  ])
                }
              />
            }
          />
          <div className="px-5 pb-6 sm:px-6">
            <Donut rows={d.byDesignation.map((x) => ({ label: DESIGNATIONS[x.designation]?.short ?? x.label, value: x.amount }))} centerLabel="given" />
          </div>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="By month" description="Donations received, by the month they arrived." />
          <div className="px-3 pb-5 sm:px-5">
            <MoneyColumnChart data={d.byMonth} xKey="month" series={[{ key: 'amount', label: 'Given' }]} formatX={monthLabel} />
          </div>
        </Card>
      </div>
      <Card className="overflow-hidden">
        <CardHeader
          title="By appeal"
          description="Donations with no appeal are shown as “Where most needed”."
          action={
            <CsvButton
              onClick={() =>
                saveCsv(`income-by-appeal-${fyLabel(fy)}.csv`, [
                  ['Appeal', 'Country', 'Donors', 'Donations', 'Amount (AUD)'],
                  ...d.byAppeal.map((a) => [a.title, a.country ? (COUNTRIES[a.country] ?? a.country) : '', a.donors, a.count, dollars(a.amount)]),
                ])
              }
            />
          }
        />
        <DataTable
          columns={appealCols}
          rows={d.byAppeal}
          rowKey={(a) => a.appeal ?? 'none'}
          dense
          mobile={(a) => (
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate font-medium">{a.title}</span>
                <span className="nums text-[12.5px] text-text-3">
                  {formatNumber(a.count)} donations · {formatNumber(a.donors)} donors
                </span>
              </span>
              <Money cents={a.amount} className="shrink-0 font-medium" />
            </div>
          )}
        />
      </Card>
    </div>
  )
}

function NoGifts({ fy }: { fy: number }) {
  return (
    <Card>
      <EmptyState icon={<FileBarChart2 />} title={`No donations in ${fyLabel(fy)}`}>
        Choose another financial year from the list above.
      </EmptyState>
    </Card>
  )
}

/* ---------- countries ---------- */
type CountriesData = {
  fy: number
  total: { amount: number; count: number }
  countries: {
    country: string
    label: string
    amount: number
    count: number
    appeals: string[]
    partners: { id: string; name: string; lastReport: string | null; risk: string | null; agreementSigned: string | null }[]
  }[]
}

const monthsSince = (d: string | null) => (d ? (Date.now() - new Date(`${d}T00:00:00`).getTime()) / (30.4 * 86_400_000) : Infinity)

function CountriesReport({ fy }: { fy: number }) {
  const q = useQuery({ queryKey: ['compliance', 'reports', 'countries', fy], queryFn: () => api.get<CountriesData>('/compliance/reports/countries', { fy }) })
  const d = q.data
  if (!d) return <Loading />
  const overseas = d.countries.filter((c) => c.country !== 'australia' && c.country !== 'unspecified' && c.amount > 0)
  const noPartner = overseas.filter((c) => !c.partners.length)
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Given by country" description={`${formatMoney(d.total.amount)} across ${plural(d.countries.filter((c) => c.amount).length, 'country', 'countries')}.`} />
          <div className="px-5 pb-6 sm:px-6">
            <BarList rows={d.countries.filter((c) => c.amount).map((c) => ({ key: c.country, label: c.label, value: c.amount, sub: `${formatNumber(c.count)} donations` }))} />
          </div>
        </Card>
        <Card className="p-5 sm:p-6 lg:col-span-3">
          <h2 className="text-[15px] font-semibold text-text">Reading this against ECS 1 and ECS 3</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-2">
            For each country money went to, the overseas partners register should show who delivers the work, when the agreement was signed and
            when their last report came in. A country with money but no partner, or a partner whose last report is more than six months old, is
            flagged below so it can be followed up.
          </p>
          {noPartner.length > 0 ? (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-pale px-3.5 py-3 text-[13px] text-amber">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              No partner registered for {noPartner.map((c) => c.label).join(', ')}.
            </p>
          ) : (
            <p className="mt-4 rounded-xl bg-teal-pale px-3.5 py-3 text-[13px] text-teal">Every country that received money has a partner in the register.</p>
          )}
        </Card>
      </div>
      <Card className="overflow-hidden">
        <CardHeader
          title="Countries, appeals and partners"
          action={
            <CsvButton
              onClick={() =>
                saveCsv(`activity-by-country-${fyLabel(fy)}.csv`, [
                  ['Country', 'Donations', 'Amount (AUD)', 'Appeals', 'Partners', 'Partner last report dates'],
                  ...d.countries.map((c) => [
                    c.label,
                    c.count,
                    dollars(c.amount),
                    c.appeals.join('; '),
                    c.partners.map((p) => p.name).join('; '),
                    c.partners.map((p) => `${p.name}: ${p.lastReport ?? 'none'}`).join('; '),
                  ]),
                ])
              }
            />
          }
        />
        <ul className="divide-y divide-line-2 border-t border-line-2">
          {d.countries.map((c) => (
            <li key={c.country} className="grid gap-4 px-5 py-4 sm:px-6 lg:grid-cols-[220px_1fr_1fr]">
              <div>
                <p className="flex items-center gap-2 text-[15px] font-semibold text-text">
                  <Globe2 className="size-4 text-teal" />
                  {c.label}
                </p>
                <p className="mt-1 text-[13px] text-text-2">
                  <Money cents={c.amount} className="font-medium text-text" /> · <span className="nums">{formatNumber(c.count)}</span> donations
                </p>
              </div>
              <div>
                <p className="mb-1.5 text-[12px] font-medium text-text-3">Appeals</p>
                {c.appeals.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {c.appeals.map((a) => (
                      <Badge key={a} size="sm">
                        {a}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-text-3">None this year</p>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-[12px] font-medium text-text-3">Registered partners</p>
                {c.partners.length ? (
                  <ul className="space-y-1.5">
                    {c.partners.map((p) => {
                      const stale = monthsSince(p.lastReport) > 6
                      return (
                        <li key={p.id} className="text-[13px]">
                          <Link to={`/compliance/registers/overseas-partners?id=${p.id}`} className="font-medium text-text hover:text-green hover:underline">
                            {p.name}
                          </Link>
                          <span className={cn('ml-1.5', stale ? 'text-amber' : 'text-text-3')}>
                            {p.lastReport ? `last report ${formatDate(new Date(`${p.lastReport}T00:00:00`))}` : 'no report yet'}
                            {stale && ' — follow up'}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                ) : c.country === 'australia' || c.country === 'unspecified' ? (
                  <p className="text-[13px] text-text-3">Not overseas</p>
                ) : (
                  <p className="text-[13px] text-amber">None registered</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

/* ---------- action log ---------- */
type ActionsData = {
  fy: number
  total: number
  byArea: { area: string; count: number }[]
  byPerson: { id: string | null; kind: string; name: string; count: number; areas: string[]; last: string }[]
  byMonth: { month: string; count: number }[]
}

function ActionsReport({ fy }: { fy: number }) {
  const q = useQuery({ queryKey: ['compliance', 'reports', 'actions', fy], queryFn: () => api.get<ActionsData>('/compliance/reports/actions', { fy }) })
  const d = q.data
  if (!d) return <Loading />
  if (!d.total)
    return (
      <Card>
        <EmptyState icon={<History />} title={`Nothing was logged in ${fyLabel(fy)}`}>
          The action log starts from the day the platform went live. Choose this financial year to see it.
        </EmptyState>
      </Card>
    )
  const cols: Column<ActionsData['byPerson'][number]>[] = [
    { key: 'n', header: 'Person', cell: (p) => <span className="font-medium">{p.name}</span> },
    { key: 'a', header: 'Areas', hideBelow: 'lg', className: 'text-text-2', cell: (p) => p.areas.join(', ') },
    { key: 'l', header: 'Last action', hideBelow: 'lg', className: 'whitespace-nowrap text-text-2', cell: (p) => formatDate(p.last) },
    { key: 'c', header: 'Actions', align: 'right', cell: (p) => <span className="nums font-medium">{formatNumber(p.count)}</span> },
  ]
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<History />} label="Actions logged" value={formatNumber(d.total)} hint={fyLabel(fy)} />
        <Stat label="People" value={formatNumber(d.byPerson.filter((p) => p.kind === 'staff').length)} hint="staff who changed something" />
        <Stat label="Busiest area" value={d.byArea[0]?.area ?? '—'} hint={d.byArea[0] ? `${formatNumber(d.byArea[0].count)} actions` : undefined} />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader
            title="By area"
            action={<CsvButton label="CSV" onClick={() => saveCsv(`action-log-by-area-${fyLabel(fy)}.csv`, [['Area', 'Actions'], ...d.byArea.map((a) => [a.area, a.count])])} />}
          />
          <div className="px-5 pb-6 sm:px-6">
            <BarList rows={d.byArea.map((a) => ({ key: a.area, label: a.area.charAt(0).toUpperCase() + a.area.slice(1), value: a.count }))} format={formatNumber} />
          </div>
        </Card>
        <Card className="overflow-hidden lg:col-span-3">
          <CardHeader
            title="By person"
            description="Each person's actions in the year. The full log, with every change, is in the audit trail."
            action={
              <CsvButton
                label="CSV"
                onClick={() =>
                  saveCsv(`action-log-by-person-${fyLabel(fy)}.csv`, [['Person', 'Actions', 'Areas', 'Last action'], ...d.byPerson.map((p) => [p.name, p.count, p.areas.join('; '), p.last])])
                }
              />
            }
          />
          <DataTable
            columns={cols}
            rows={d.byPerson}
            rowKey={(p) => `${p.kind}-${p.id}`}
            dense
            mobile={(p) => (
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-medium">{p.name}</span>
                  <span className="block truncate text-[12.5px] text-text-3">{p.areas.join(', ')}</span>
                </span>
                <span className="nums font-medium">{formatNumber(p.count)}</span>
              </div>
            )}
          />
        </Card>
      </div>
    </div>
  )
}

/* ---------- the year-end evidence pack ---------- */
type PackEntry = { id: string; fields: Record<string, unknown>; title: string; reviewDue: boolean; riskScore?: number | null }
type PackData = {
  fy: number
  label: string
  period: { from: string; to: string }
  generatedAt: string
  generatedBy: string
  org: Settings['org']
  registers: { key: string; label: string; blurb: string; standards: string[]; items: PackEntry[] }[]
  obligations: ObligationView[]
  documents: {
    id: string
    title: string
    categoryLabel: string
    requiresAck: boolean
    versions: { n: number; fileName: string; uploadedAt: string; uploadedByName: string; note?: string }[]
    latestAcks: number
  }[]
  income: { total: { amount: number; count: number }; byDesignation: IncomeData['byDesignation']; byAppeal: IncomeData['byAppeal'] }
  receipts: { count: number; amount: number; resent: number }
  countries: { country: string; label: string; amount: number; count: number; partners: string[] }[]
}

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 16mm 14mm; }
  html.printing-pack, html.printing-pack body { background: #fff !important; }
  html.printing-pack aside, html.printing-pack header, html.printing-pack nav,
  html.printing-pack .no-print, html.printing-pack [role="tablist"], html.printing-pack [data-sonner-toaster] { display: none !important; }
  html.printing-pack main { padding: 0 !important; }
  html.printing-pack main > div { max-width: none !important; padding: 0 !important; }
  html.printing-pack .pack { box-shadow: none !important; border: 0 !important; padding: 0 !important; max-width: none !important; }
  html.printing-pack .pack-break { break-before: page; }
  html.printing-pack .pack table { break-inside: auto; }
  html.printing-pack .pack tr { break-inside: avoid; }
  html.printing-pack .animate-portal-in { animation: none !important; }
}`

function YearEndPack({ fy }: { fy: number }) {
  const q = useQuery({ queryKey: ['compliance', 'reports', 'pack', fy], queryFn: () => api.get<PackData>('/compliance/reports/pack', { fy }) })
  useEffect(() => {
    document.documentElement.classList.add('printing-pack')
    return () => document.documentElement.classList.remove('printing-pack')
  }, [])
  const d = q.data
  if (!d) return <Skeleton className="mx-auto h-[900px] max-w-[860px] rounded-2xl" />

  const sections = ['Organisation', 'Registers', 'Statutory calendar', 'Document library', 'Income and receipts', 'Activity by country']

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="no-print mb-5 flex flex-col gap-3 rounded-2xl bg-teal-pale px-5 py-4 text-teal sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13.5px] leading-relaxed">
          <span className="font-semibold">The evidence pack for {d.label}</span> — registers, calendar, documents, income and countries in one
          document. Print it or save it as a PDF for the auditor or the board.
        </p>
        <Button variant="primary" icon={<Printer />} onClick={() => window.print()} className="shrink-0">
          Print or save as PDF
        </Button>
      </div>

      <article className="pack mx-auto max-w-[860px] rounded-2xl bg-paper px-6 py-10 text-text shadow-soft ring-1 ring-line/80 sm:px-14 sm:py-14">
        {/* cover */}
        <section className="flex min-h-[560px] flex-col border-b border-line pb-10 print:min-h-[240mm] print:border-0">
          <Logo layout="vertical" className="h-28 w-auto self-start" />
          <div className="my-auto py-12">
            <p className="text-[12px] font-semibold tracking-[0.12em] text-teal uppercase">Year-end evidence pack</p>
            <h1 className="mt-3 font-display text-[34px] leading-[1.1] sm:text-[44px]">{d.org.name}</h1>
            <p className="mt-4 text-[17px] text-text-2">
              Financial year {d.label} · {formatDateLong(d.period.from)} to {formatDateLong(d.period.to)}
            </p>
          </div>
          <dl className="grid gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2">
            <PackFact label="ABN" value={d.org.abn} />
            <PackFact label="DGR status" value={d.org.dgr ? 'Endorsed Deductible Gift Recipient' : 'Not endorsed'} />
            <PackFact label="Address" value={d.org.address} />
            <PackFact label="Contact" value={[d.org.email, d.org.phone].filter(Boolean).join(' · ')} />
            <PackFact label="Prepared" value={`${formatDateTime(d.generatedAt)} by ${d.generatedBy}`} />
            <PackFact
              label="Contents"
              value={
                <ol className="list-inside list-decimal">
                  {sections.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ol>
              }
            />
          </dl>
        </section>

        <PackSection n={1} title="Organisation" first>
          <p className="text-[13.5px] leading-relaxed text-text-2">
            {d.org.name} (ABN {d.org.abn}), {d.org.address}. {d.org.dgr ? d.org.dgrNote : ''} Website {d.org.website}.
          </p>
        </PackSection>

        <PackSection n={2} title="Registers" lead="Each register as it stands on the day this pack was prepared, archived entries left out.">
          {d.registers.map((r) => {
            const def = registerByKey(r.key) ?? REGISTERS[0]!
            const cols = def.fields.filter((f) => f.column)
            return (
              <div key={r.key} className="mt-7 first:mt-0">
                <h3 className="flex flex-wrap items-baseline gap-x-3 text-[16px] font-semibold">
                  {r.label}
                  <span className="text-[12px] font-normal text-text-3">
                    {plural(r.items.length, 'entry', 'entries')} · {r.standards.join(', ')}
                  </span>
                </h3>
                <p className="mt-0.5 mb-2.5 text-[13px] text-text-2">{r.blurb}</p>
                {r.items.length ? (
                  <PackTable
                    head={[...cols.map((f) => f.label), ...(r.key === 'risks' ? ['Rating'] : [])]}
                    rows={r.items.map((e) => [
                      ...cols.map((f, i) => (i === 0 ? <span className="font-medium">{e.title}{e.reviewDue ? <span className="ml-1.5 text-[11px] font-normal text-amber">review due</span> : null}</span> : formatValue(f, e.fields[f.key]) || '—')),
                      ...(r.key === 'risks' ? [String(e.riskScore ?? '—')] : []),
                    ])}
                  />
                ) : (
                  <p className="text-[13px] text-text-3">No entries.</p>
                )}
              </div>
            )
          })}
        </PackSection>

        <PackSection n={3} title="Statutory calendar" lead={`Items due between ${formatDate(d.period.from)} and ${formatDate(d.period.to)}, with when they were done and the evidence attached.`}>
          {d.obligations.length ? (
            <PackTable
              head={['Item', 'Category', 'Due', 'Status', 'Evidence']}
              rows={d.obligations.map((o) => [
                <span className="font-medium">{o.title}</span>,
                OBLIGATION_CATEGORIES[o.category as ObligationCategory]?.label ?? o.category,
                formatDate(o.dueDate),
                o.status === 'done' ? `Done ${formatDate(o.completedAt)}${o.completedByName ? `, ${o.completedByName}` : ''}` : o.state === 'overdue' ? <span className="text-red">Not done</span> : 'Open',
                o.evidence.length ? o.evidence.map((e) => e.title).join('; ') : '—',
              ])}
            />
          ) : (
            <p className="text-[13px] text-text-3">Nothing on the calendar fell due in this year.</p>
          )}
          <p className="mt-2 text-[12px] text-text-3">Repeating items: {Object.values(RECURRENCES).slice(1).join(', ').toLowerCase()} — the next occurrence is created when one is marked done.</p>
        </PackSection>

        <PackSection n={4} title="Document library" lead="Every current document, its version history, and how many staff have confirmed reading the current version.">
          <PackTable
            head={['Document', 'Category', 'Versions', 'Read']}
            rows={d.documents.map((doc) => [
              <span className="font-medium">{doc.title}</span>,
              doc.categoryLabel,
              <span className="block space-y-0.5">
                {[...doc.versions].reverse().map((v) => (
                  <span key={v.n} className="block">
                    v{v.n} · {formatDate(v.uploadedAt)} · {v.uploadedByName}
                    {v.note ? ` — ${v.note}` : ''}
                  </span>
                ))}
              </span>,
              doc.requiresAck ? `${doc.latestAcks} confirmed` : 'Not asked',
            ])}
          />
        </PackSection>

        <PackSection n={5} title="Income and receipts" lead="Donations received in the year (the donation, before any fee the donor covered) and the tax receipts issued.">
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <PackFigure label="Given" value={formatMoney(d.income.total.amount)} sub={`${formatNumber(d.income.total.count)} donations`} />
            <PackFigure label="Receipts issued" value={formatNumber(d.receipts.count)} sub={`${formatMoney(d.receipts.amount)} receipted`} />
            <PackFigure label="Receipts re-sent" value={formatNumber(d.receipts.resent)} sub="at the donor's request" />
          </div>
          <h3 className="mb-2 text-[14px] font-semibold">By designation</h3>
          <PackTable head={['Designation', 'Donations', 'Amount']} align={['left', 'right', 'right']} rows={d.income.byDesignation.map((x) => [x.label, formatNumber(x.count), formatMoney(x.amount)])} total={['Total', formatNumber(d.income.total.count), formatMoney(d.income.total.amount)]} />
          <h3 className="mt-6 mb-2 text-[14px] font-semibold">By appeal</h3>
          <PackTable head={['Appeal', 'Donations', 'Amount']} align={['left', 'right', 'right']} rows={d.income.byAppeal.map((a) => [a.title, formatNumber(a.count), formatMoney(a.amount)])} />
        </PackSection>

        <PackSection n={6} title="Activity by country" lead="Where the money went, and the overseas partners registered in each country.">
          <PackTable
            head={['Country', 'Donations', 'Amount', 'Partners']}
            align={['left', 'right', 'right', 'left']}
            rows={d.countries.map((c) => [c.label, formatNumber(c.count), formatMoney(c.amount), c.partners.join('; ') || '—'])}
          />
        </PackSection>

        <footer className="mt-12 border-t border-line pt-5 text-[11.5px] leading-relaxed text-text-3">
          Prepared from the records kept on Al-Anwaar's platform on {formatDateTime(d.generatedAt)}. Al-Anwaar's platform keeps the records and
          evidence in one place. We are a technology partner, not auditors or lawyers — nothing here is legal, tax or audit advice.
        </footer>
      </article>
    </>
  )
}

function PackFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-[0.08em] text-text-3 uppercase">{label}</dt>
      <dd className="mt-0.5 text-text">{value || '—'}</dd>
    </div>
  )
}

function PackFigure({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-paper-2 px-4 py-3 print:border print:border-line print:bg-transparent">
      <p className="text-[12px] text-text-3">{label}</p>
      <p className="nums mt-0.5 text-[20px] font-semibold">{value}</p>
      <p className="text-[12px] text-text-3">{sub}</p>
    </div>
  )
}

function PackSection({ n, title, lead, children, first }: { n: number; title: string; lead?: string; children: ReactNode; first?: boolean }) {
  return (
    <section className={cn('pt-10', !first && 'pack-break')}>
      <h2 className="flex items-baseline gap-3 border-b-2 border-ink pb-2 text-[22px] font-semibold tracking-[-0.015em]">
        <span className="nums text-teal">{n}</span>
        {title}
      </h2>
      {lead && <p className="mt-2.5 mb-5 text-[13.5px] leading-relaxed text-text-2">{lead}</p>}
      {!lead && <div className="mt-4" />}
      {children}
    </section>
  )
}

function PackTable({ head, rows, align, total }: { head: string[]; rows: ReactNode[][]; align?: ('left' | 'right')[]; total?: ReactNode[] }) {
  const a = (i: number) => (align?.[i] === 'right' ? 'text-right' : 'text-left')
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full border-collapse text-[12.5px] leading-snug">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={cn('border-b border-line py-1.5 pr-3 align-bottom text-[11px] font-semibold tracking-[0.04em] whitespace-nowrap text-text-3 uppercase last:pr-0', a(i))}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={cn('nums border-b border-line-2 py-1.5 pr-3 align-top text-text last:pr-0', a(j), j > 0 && 'text-text-2')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
          {total && (
            <tr>
              {total.map((c, j) => (
                <td key={j} className={cn('nums border-t border-ink py-1.5 pr-3 font-semibold last:pr-0', a(j))}>
                  {c}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
