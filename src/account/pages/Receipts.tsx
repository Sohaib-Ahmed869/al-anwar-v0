import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Mail, Receipt, SearchX } from 'lucide-react'
import { fyLabel } from '../../../shared/domain'
import { api, errorMessage } from '../../portal/api'
import { formatDay, plural } from '../../portal/format'
import { DateRangePicker, RangeStatementActions, isoDay, resolveRange } from '../components/DateRange'
import {
  Badge, Button, Card, DataTable, EmptyState, IconButton, Money, PageHeader, Pagination, SearchInput, Skeleton, Toolbar, buttonClass, toast,
  useDebounced, useUrlState, type Column,
} from '../../portal/ui'
import { SectionHeading } from '../components/bits'
import { keys, useStatements, useTitle, type GiftPage, type MyGift, type StatementYear } from '../components/data'
import { GiftSheet } from '../components/GiftSheet'

/* ---------------------------------------------------------------------------
   Receipts & tax. Two things live here, in the order people need them:

   1. A statement for any dates: presets (this or last financial year, the
      last 12 months, a calendar year, all time) or custom from/to. All the
      receipts in that range become one document to open, print, save as
      PDF or email. The same range filters the receipts list below.
   2. The tax statement — one document per financial year (July to June) with
      every gift and its receipt number, which is what an accountant or the
      ATO asks for. Open it to print or save as PDF, or email it to yourself.
   3. Every individual receipt, each re-sendable in one press.

   Only gifts that have arrived have receipts, so this list asks the server
   for succeeded gifts only; pledges and declined payments are on My giving.
--------------------------------------------------------------------------- */

const DEFAULTS = { range: 'last-fy', from: '', to: '', q: '', page: '1' }

export default function Receipts() {
  useTitle('Receipts & tax')
  const statements = useStatements()
  const [s, set] = useUrlState(DEFAULTS)
  const [q, setQ] = useState(s.q)
  const dq = useDebounced(q, 300)
  useEffect(() => {
    if (dq !== s.q) set({ q: dq })
  }, [dq])
  const [open, setOpen] = useState<MyGift | null>(null)
  const qc = useQueryClient()

  const dates = resolveRange(s.range, s.from, s.to)
  const stmt = dates ?? { from: '2000-01-01', to: isoDay(new Date()) }
  const inRange = { status: 'succeeded', from: dates?.from ?? '', to: dates?.to ?? '' }
  /* the total for the chosen dates, independent of the search box */
  const summary = useQuery({ queryKey: keys.gifts({ ...inRange, pageSize: 1 }), queryFn: () => api.get<GiftPage>('/me/gifts', { ...inRange, pageSize: 1 }), placeholderData: keepPreviousData })
  const params = { ...inRange, q: s.q, page: s.page, pageSize: 15, sort: '-date' }
  const list = useQuery({ queryKey: keys.gifts(params), queryFn: () => api.get<GiftPage>('/me/gifts', params), placeholderData: keepPreviousData })

  const resend = useMutation({
    mutationFn: (g: MyGift) => api.post<{ to: string }>(`/me/gifts/${g.id}/resend`),
    onSuccess: (r, g) => {
      toast.success(`Receipt ${g.receipt?.number ?? ''} sent to ${r.to}`)
      qc.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const columns: Column<MyGift>[] = [
    { key: 'receipt', header: 'Receipt', cell: (g) => <span className="nums font-medium text-text">{g.receipt?.number}</span> },
    { key: 'date', header: 'Date', cell: (g) => <span className="text-text-2">{formatDay(g.date)}</span> },
    { key: 'appeal', header: 'For', cell: (g) => <span className="block max-w-[320px] truncate text-text-2">{g.appealTitle ?? 'Where most needed'}</span>, hideBelow: 'lg' },
    { key: 'amount', header: 'Amount', align: 'right', cell: (g) => <Money cents={g.amount + (g.fee ?? 0)} className="font-semibold text-text" /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      width: 96,
      cell: (g) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <IconButton label={`Email receipt ${g.receipt?.number} again`} size="sm" loading={resend.isPending && resend.variables?.id === g.id} onClick={() => resend.mutate(g)}>
            <Mail />
          </IconButton>
          <Link to={`/account/receipt/${g.id}`} className={buttonClass('ghost', 'sm', 'w-8 px-0')} aria-label={`Open receipt ${g.receipt?.number}`} title="Open to print">
            <FileText />
          </Link>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Receipts & tax" description="Your tax statement for each financial year, and every receipt we have issued you." />

      <section className="mb-10">
        <SectionHeading title="Statement for any dates">Choose the dates, then open, print, save as PDF or email every receipt in them as one statement.</SectionHeading>
        <Card className="p-5">
          <DateRangePicker preset={s.range} from={s.from} to={s.to} onChange={(v) => set({ ...v, page: '1' })} />
          <div className="mt-5 flex flex-col gap-4 border-t border-line-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
            {summary.data ? (
              <p className="text-[13px] text-text-2">
                <Money cents={summary.data.sum} className="text-[22px] font-semibold tracking-[-0.02em] text-text" />
                <span className="ml-2">{plural(summary.data.sumCount, 'receipt')}</span>
              </p>
            ) : (
              <Skeleton className="h-10 w-48" />
            )}
            <RangeStatementActions range={stmt} disabled={!summary.data?.sumCount} />
          </div>
        </Card>
      </section>

      <section className="mb-10">
        <SectionHeading title="Tax statements">One per financial year, 1 July to 30 June — every donation with its receipt number, ready for your tax return.</SectionHeading>
        {statements.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        ) : !statements.data?.items.length ? (
          <Card>
            <EmptyState compact icon={<FileText />} title="No statements yet">
              Once you have given, a statement for that financial year appears here.
            </EmptyState>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {statements.data.items.map((y) => (
              <StatementCard key={y.fy} y={y} current={statements.data.current} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading title={dates ? 'Receipts in these dates' : 'All receipts'} />
        <Toolbar className="mb-3">
          <SearchInput value={q} onChange={setQ} placeholder="Receipt number or appeal" className="w-full sm:w-80" />
        </Toolbar>
        <Card className="overflow-hidden">
          <DataTable
            columns={columns}
            rows={list.data?.items}
            rowKey={(g) => g.id}
            loading={list.isFetching}
            onRowClick={setOpen}
            mobile={(g) => (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="nums text-[14px] font-medium text-text">{g.receipt?.number}</p>
                  <p className="mt-0.5 truncate text-[12.5px] text-text-2">
                    {formatDay(g.date)} · {g.appealTitle ?? 'Where most needed'}
                  </p>
                </div>
                <Money cents={g.amount + (g.fee ?? 0)} className="shrink-0 font-semibold text-text" />
              </div>
            )}
            empty={
              s.q || dates ? (
                <EmptyState icon={<SearchX />} title="No receipts match" action={<Button onClick={() => (setQ(''), set({ q: '', range: 'all', from: '', to: '' }))}>Show all receipts</Button>}>
                  {s.q ? 'Receipt numbers look like AA-2026-001234.' : 'No donations were received between these dates.'}
                </EmptyState>
              ) : (
                <EmptyState icon={<Receipt />} title="No receipts yet">
                  Every donation that arrives gets a numbered tax receipt, emailed to you and kept here.
                </EmptyState>
              )
            }
          />
          {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={(p) => set({ page: String(p) })} />}
        </Card>
      </section>
      <GiftSheet gift={open} onClose={() => setOpen(null)} />
    </div>
  )
}

function StatementCard({ y, current }: { y: StatementYear; current: number }) {
  const inProgress = y.fy >= current
  const email = useMutation({
    mutationFn: () => api.post<{ to: string }>(`/me/gifts/statement/${y.fy}/email`),
    onSuccess: (r) => toast.success(`Your ${fyLabel(y.fy)} statement is on its way`, { description: `Sent to ${r.to}.` }),
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[18px] font-semibold tracking-[-0.01em] text-text">{fyLabel(y.fy)}</p>
          <p className="mt-0.5 text-[12.5px] text-text-3">
            1 July {y.fy - 1} – 30 June {y.fy}
          </p>
        </div>
        {inProgress ? <Badge tone="amber" size="sm">Year in progress</Badge> : <Badge tone="green" size="sm">Complete</Badge>}
      </div>
      <p className="mt-4 text-[13px] text-text-2">
        <Money cents={y.total} className="text-[24px] font-semibold tracking-[-0.02em] text-text" />
        <span className="ml-2">{plural(y.count, 'donation')}</span>
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link to={`/account/statement/${y.fy}`} className={buttonClass('primary', 'md', 'grow sm:grow-0')}>
          <FileText /> Open / print
        </Link>
        <Button variant="secondary" icon={<Mail />} loading={email.isPending} onClick={() => email.mutate()} className="grow sm:grow-0">
          Email to me
        </Button>
      </div>
    </Card>
  )
}
