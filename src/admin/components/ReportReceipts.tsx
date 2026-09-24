import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, MailCheck, Receipt, RefreshCcw, Wallet } from 'lucide-react'
import type { Designation, Method } from '../../../shared/domain'
import { METHODS } from '../../../shared/domain'
import type { Page } from '../../../shared/types'
import { api, download } from '../../portal/api'
import { MoneyColumnChart } from '../../portal/charts'
import { formatDay, formatNumber, formatPercent } from '../../portal/format'
import {
  Badge, Button, Card, CardBody, CardHeader, DataTable, EmptyState, Money, Pagination, Stat, StatusBadge, toast, type Column, type DateRange,
} from '../../portal/ui'
import { BankDonorChip } from './BankBits'
import { ReportLoading } from './ReportBits'

/* ---------------------------------------------------------------------------
   Reports › Receipts issued: the receipt trail for a period, which is what an
   auditor asks for. Every receipt number, when it was issued, whether it was
   emailed, and how often a donor asked for it again. A refunded gift keeps
   its receipt number (numbers are never reused) and is marked, not hidden.
--------------------------------------------------------------------------- */

type Item = {
  id: string
  number: string
  donor: string
  donorName: string
  amount: number
  designation: Designation
  method: Method
  status: string
  date: string
  appealTitle?: string
  receipt: { number: string; issuedAt: string; emailedAt?: string; resent?: number }
}
type Receipts = {
  count: number
  total: number
  emailed: number
  resent: number
  refunded: number
  byMonth: { month: string; label: string; count: number; amount: number }[]
  items: Page<Item>
}

export function ReportReceipts({ range, canExport }: { range: DateRange; canExport: boolean }) {
  const [page, setPage] = useState(1)
  const q = useQuery({
    queryKey: ['reports', 'receipts', range, page],
    queryFn: () => api.get<Receipts>('/admin/reports/receipts', { ...range, page, pageSize: 20 }),
    placeholderData: (prev) => prev,
  })
  const d = q.data

  const columns: Column<Item>[] = [
    { key: 'receipt', header: 'Receipt', cell: (r) => <span className="nums font-medium text-text">{r.receipt.number}</span> },
    { key: 'issued', header: 'Issued', cell: (r) => <span className="text-text-2">{formatDay(r.receipt.issuedAt)}</span> },
    { key: 'donor', header: 'Donor', cell: (r) => <BankDonorChip id={r.donor} name={r.donorName} number={r.number} size="xs" /> },
    { key: 'for', header: 'For', hideBelow: 'xl', cell: (r) => (
      <span className="flex min-w-0 items-center gap-1.5">
        <StatusBadge kind="designation" value={r.designation} size="sm" />
        <span className="max-w-[200px] truncate text-[13px] text-text-2">{r.appealTitle ?? 'Where most needed'}</span>
      </span>
    ) },
    { key: 'method', header: 'Method', hideBelow: 'lg', cell: (r) => <span className="text-text-2">{METHODS[r.method]?.label}</span> },
    { key: 'emailed', header: 'Emailed', cell: (r) => (
      <span className="flex flex-wrap items-center gap-1">
        {r.status === 'refunded' && <Badge size="sm">Refunded</Badge>}
        {r.receipt.emailedAt ? <Badge size="sm" tone="green">Emailed</Badge> : <Badge size="sm" tone="amber">Not emailed</Badge>}
        {r.receipt.resent ? <span className="text-[12px] text-text-3">re-sent {r.receipt.resent}×</span> : null}
      </span>
    ) },
    { key: 'amount', header: 'Amount', align: 'right', cell: (r) => <Money cents={r.amount} className="font-medium text-text" /> },
  ]

  return (
    <div className="space-y-5">
      {canExport && (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            icon={<Download />}
            disabled={!d?.count}
            onClick={() => download('/admin/reports/receipts.csv', { ...range }, 'receipts.csv').then(() => toast.success('Receipt list downloaded')).catch((e) => toast.error(e.message))}
          >
            Export CSV
          </Button>
        </div>
      )}
      {!d ? (
        <ReportLoading />
      ) : (
        <div className={q.isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={<Receipt />} label="Receipts issued" value={formatNumber(d.count)} hint={d.refunded ? `${d.refunded} since refunded` : 'every one numbered'} />
            <Stat icon={<Wallet />} label="Total receipted" value={<Money cents={d.total} />} />
            <Stat icon={<MailCheck />} label="Emailed" value={d.count ? formatPercent(d.emailed / d.count) : '—'} hint={`${formatNumber(d.emailed)} of ${formatNumber(d.count)}`} />
            <Stat icon={<RefreshCcw />} label="Re-sent on request" value={formatNumber(d.resent)} hint="by donors or the office" />
          </div>

          <Card className="mt-5">
            <CardHeader title="Receipted each month" description="The value of receipts issued, by the month they were issued" />
            <CardBody>
              <MoneyColumnChart data={d.byMonth} xKey="label" series={[{ key: 'amount', label: 'Receipted' }]} height={220} />
            </CardBody>
          </Card>

          <Card className="mt-5 overflow-hidden">
            <CardHeader title="Every receipt" description="Newest first. Receipt numbers run on from one financial year to the next and are never reused." />
            <DataTable
              columns={columns}
              rows={d.items.items}
              rowKey={(r) => r.id}
              loading={q.isFetching}
              dense
              mobile={(r) => (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="nums text-[14px] font-medium text-text">{r.receipt.number}</p>
                    <p className="mt-0.5 truncate text-[12.5px] text-text-2">
                      {r.donorName} · {formatDay(r.receipt.issuedAt)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <StatusBadge kind="designation" value={r.designation} size="sm" />
                      {r.receipt.emailedAt ? <Badge size="sm" tone="green">Emailed</Badge> : <Badge size="sm" tone="amber">Not emailed</Badge>}
                      {r.status === 'refunded' && <Badge size="sm">Refunded</Badge>}
                    </div>
                  </div>
                  <Money cents={r.amount} className="shrink-0 text-[14px] font-medium text-text" />
                </div>
              )}
              empty={
                <EmptyState icon={<Receipt />} title="No receipts in these dates">
                  Receipts are issued the moment a gift is paid. Try a wider date range.
                </EmptyState>
              }
            />
            <Pagination page={page} pageSize={d.items.pageSize} total={d.items.total} onPage={setPage} />
          </Card>
        </div>
      )}
    </div>
  )
}
