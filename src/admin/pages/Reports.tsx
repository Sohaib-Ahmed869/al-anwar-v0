import { useMemo } from 'react'
import { useCan } from '../../portal/session'
import { DateRangePicker, PageHeader, Tabs, datePresets, useDocumentTitle, useUrlState, type DateRange } from '../../portal/ui'
import { ReportDonors } from '../components/ReportDonors'
import { GROUP_OPTIONS, ReportIncome, type IncomeGroup } from '../components/ReportIncome'
import { ReportReceipts } from '../components/ReportReceipts'
import { ReportXero, type MethodSet } from '../components/ReportXero'

/* ---------------------------------------------------------------------------
   Admin › Reports: income, the receipt trail, donor retention and the Xero
   export, as tabs of one page that share a date range — so "this financial
   year" chosen on Income is still chosen on Xero. Everything lives in the
   URL (?tab=xero&from=…), so a report can be linked to a treasurer.

   Exports need reports.export; a role with reports.read alone sees every
   figure but no download buttons, and no Xero tab.
--------------------------------------------------------------------------- */

type Tab = 'income' | 'receipts' | 'donors' | 'xero'

export default function Reports() {
  const canExport = useCan('reports.export')
  const fy = useMemo(() => datePresets().find((p) => p.key === 'fy')!.range, [])
  const [s, set] = useUrlState({ tab: 'income', from: '', to: '', group: 'appeal', methods: 'all' })
  const tabs: { value: Tab; label: string }[] = [
    { value: 'income', label: 'Income' },
    { value: 'receipts', label: 'Receipts issued' },
    { value: 'donors', label: 'Donors' },
    ...(canExport ? [{ value: 'xero' as const, label: 'Xero export' }] : []),
  ]
  const tab: Tab = tabs.some((t) => t.value === s.tab) ? (s.tab as Tab) : 'income'
  const range: DateRange = s.from && s.to ? { from: s.from, to: s.to } : fy
  const group = (GROUP_OPTIONS.some((g) => g.value === s.group) ? s.group : 'appeal') as IncomeGroup
  useDocumentTitle(`${tabs.find((t) => t.value === tab)?.label ?? 'Reports'} · Reports`, 'Al-Anwaar Admin')

  const descriptions: Record<Tab, string> = {
    income: 'Paid gifts by appeal, designation, country or month — the figures the board and the auditor ask for.',
    receipts: 'Every tax receipt issued in the period, with whether it was emailed. Numbers are never reused.',
    donors: 'Who is new, who keeps giving, and who has stopped — month by month.',
    xero: 'A file for your bookkeeper: every paid gift, already coded to the right income account.',
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description={descriptions[tab]}
        actions={
          <DateRangePicker
            allowAll={false}
            value={range}
            onChange={(r) => set({ from: r && (r.from !== fy.from || r.to !== fy.to) ? r.from : '', to: r && (r.from !== fy.from || r.to !== fy.to) ? r.to : '' })}
          />
        }
      />
      <Tabs value={tab} onChange={(t) => set({ tab: t })} tabs={tabs} />
      <div className="mt-5">
        {tab === 'income' && <ReportIncome range={range} group={group} onGroup={(g) => set({ group: g })} canExport={canExport} />}
        {tab === 'receipts' && <ReportReceipts key={`${range.from}-${range.to}`} range={range} canExport={canExport} />}
        {tab === 'donors' && <ReportDonors range={range} />}
        {tab === 'xero' && canExport && <ReportXero range={range} methods={s.methods as MethodSet} onMethods={(m) => set({ methods: m })} />}
      </div>
    </>
  )
}
