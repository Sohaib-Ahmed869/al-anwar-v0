import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { HandHeart, Repeat, SearchX } from 'lucide-react'
import { DESIGNATIONS, DESIGNATION_KEYS, METHODS, METHOD_KEYS, fyLabel, fyRange, type Designation, type Method } from '../../../shared/domain'
import { api } from '../../portal/api'
import { formatDay, plural } from '../../portal/format'
import {
  Card, ClearFilters, DataTable, EmptyState, FilterChip, Money, PageHeader, Pagination, SearchInput, Skeleton, StatusBadge,
  Toolbar, buttonClass, cn, useDebounced, useUrlState, type Column,
} from '../../portal/ui'
import { keys, useTitle, type GiftPage, type MyGift } from '../components/data'
import { DateRangePicker, RangeStatementActions, isoDay, presetLabel, rangeLabel, resolveRange } from '../components/DateRange'
import { GiftSheet } from '../components/GiftSheet'

/* ---------------------------------------------------------------------------
   My giving — every gift, however it was made, in one list.

   Dates are the first filter because they are the question donors actually
   ask ("what did I give last year?"): presets for this and last financial
   year, the last 12 months, calendar years, or custom dates. Whatever range
   is showing can be opened, printed, saved as PDF or emailed as one
   statement from the total line. Designation and payment method are chips.
   An old link with ?fy=2026 still works and reads as that financial year.
   Everything lives in the URL, so a filtered view survives a refresh and the
   back button.

   Gifts that did not complete — a declined card, a bank transfer not yet
   arrived — are listed with a status and struck-through amount rather than
   hidden, and the running total above the list counts only what arrived.
--------------------------------------------------------------------------- */

const DEFAULTS = { range: '', from: '', to: '', fy: '', designation: '', method: '', q: '', sort: '-date', page: '1' }

export default function Giving() {
  useTitle('My giving')
  const [s, set] = useUrlState(DEFAULTS)
  const [q, setQ] = useState(s.q)
  const dq = useDebounced(q, 300)
  useEffect(() => {
    if (dq !== s.q) set({ q: dq })
  }, [dq])
  const [open, setOpen] = useState<MyGift | null>(null)

  /* ?fy= from an older link becomes that year's dates */
  const legacy = !s.range && Number(s.fy) > 2000 ? fyRange(Number(s.fy)) : null
  const dates = legacy ? { from: isoDay(legacy.from), to: isoDay(new Date(legacy.to.getTime() - 1)) } : resolveRange(s.range, s.from, s.to)
  const params = { from: dates?.from ?? '', to: dates?.to ?? '', designation: s.designation, method: s.method, q: s.q, sort: s.sort, page: s.page, pageSize: 20 }
  const list = useQuery({
    queryKey: keys.gifts(params),
    queryFn: () => api.get<GiftPage>('/me/gifts', params),
    placeholderData: keepPreviousData,
  })
  const des = s.designation ? (s.designation.split(',') as Designation[]) : []
  const methods = s.method ? (s.method.split(',') as Method[]) : []
  const filtered = Boolean(dates || s.designation || s.method || s.q)
  const clear = { range: '', from: '', to: '', fy: '', designation: '', method: '', q: '' }
  const rangeText = legacy ? fyLabel(Number(s.fy)) : dates ? (s.range === 'custom' ? rangeLabel(dates) : presetLabel(s.range).toLowerCase()) : ''
  /* the statement always has dates; "all time" runs from the first gift */
  const stmt = dates ?? { from: '2000-01-01', to: isoDay(new Date()) }

  const columns: Column<MyGift>[] = [
    { key: 'date', header: 'Date', sort: 'date', cell: (g) => <span className="whitespace-nowrap text-text-2">{formatDay(g.date)}</span>, width: 110 },
    {
      key: 'appeal',
      header: 'Donation',
      cell: (g) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-medium text-text">
            {g.plan && <Repeat className="size-3.5 shrink-0 text-text-3" aria-label="Regular donation" />}
            {g.appealTitle ?? 'Where most needed'}
          </p>
          {g.fundraiserTitle && <p className="truncate text-[12.5px] text-text-3">via {g.fundraiserTitle}</p>}
        </div>
      ),
    },
    { key: 'designation', header: 'Given as', cell: (g) => <StatusBadge kind="designation" value={g.designation} size="sm" /> },
    { key: 'method', header: 'Paid by', cell: (g) => <span className="text-text-2">{METHODS[g.method as Method]?.label}</span>, hideBelow: 'lg' },
    {
      key: 'receipt',
      header: 'Receipt',
      hideBelow: 'xl',
      cell: (g) => (g.receipt?.number ? <span className="nums text-[13px] text-text-2">{g.receipt.number}</span> : <StatusBadge kind="gift" value={g.status} size="sm" />),
    },
    {
      key: 'amount',
      header: 'Amount',
      sort: 'amount',
      align: 'right',
      cell: (g) => (
        <div className="flex items-center justify-end gap-2">
          {g.status !== 'succeeded' && <StatusBadge kind="gift" value={g.status} size="sm" className="xl:hidden" />}
          <Money cents={g.amount + (g.fee ?? 0)} className={cn('font-semibold', g.status === 'succeeded' ? 'text-text' : 'text-text-3', g.status === 'failed' && 'line-through')} />
        </div>
      ),
    },
  ]

  const data = list.data
  return (
    <div>
      <PageHeader
        title="My giving"
        description="Every donation you have made — by card, PayPal, bank transfer or in person. Tap one for its receipt."
      />

      <div className="mb-4 space-y-3">
        <DateRangePicker
          preset={legacy ? 'custom' : s.range}
          from={legacy ? (dates?.from ?? '') : s.from}
          to={legacy ? (dates?.to ?? '') : s.to}
          onChange={(v) => set({ ...v, fy: '', page: '1' })}
        />
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Appeal or receipt number" className="w-full sm:w-72" />
          <FilterChip
            label="Given as"
            options={DESIGNATION_KEYS.map((d) => ({ value: d, label: DESIGNATIONS[d].label }))}
            value={des}
            onChange={(v) => set({ designation: v.join(',') })}
          />
          <FilterChip
            label="Paid by"
            options={METHOD_KEYS.map((m) => ({ value: m, label: METHODS[m].label }))}
            value={methods}
            onChange={(v) => set({ method: v.join(',') })}
          />
          <ClearFilters
            show={filtered}
            onClear={() => {
              setQ('')
              set(clear)
            }}
          />
        </Toolbar>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-line-2 px-5 py-3.5">
          {data ? (
            <p className="text-[13.5px] text-text-2">
              <Money cents={data.sum} className="text-[15px] font-semibold text-text" /> given
              {rangeText ? ` · ${rangeText}` : filtered ? ' in this view' : ' in total'} · {plural(data.sumCount, 'donation')}
              {data.total > data.sumCount && <span className="text-text-3"> (plus {data.total - data.sumCount} not completed)</span>}
            </p>
          ) : (
            <Skeleton className="h-5 w-56" />
          )}
          {/* the statement covers every received gift in these dates; the
              designation and method chips narrow the list, not the statement */}
          <RangeStatementActions range={stmt} size="sm" disabled={!data?.sumCount && !(s.designation || s.method || s.q)} className="w-full sm:w-auto" />
        </div>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(g) => g.id}
          loading={list.isFetching}
          sort={s.sort}
          onSort={(sort) => set({ sort })}
          onRowClick={setOpen}
          mobile={(g) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-medium text-text">{g.appealTitle ?? 'Where most needed'}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-text-2">
                  {formatDay(g.date)}
                  <StatusBadge kind="designation" value={g.designation} size="sm" />
                  {g.status !== 'succeeded' && <StatusBadge kind="gift" value={g.status} size="sm" />}
                </div>
                <p className="mt-1 text-[12px] text-text-3">
                  {METHODS[g.method as Method]?.label}
                  {g.plan ? ' · regular donation' : ''}
                  {g.receipt?.number ? ` · ${g.receipt.number}` : ''}
                </p>
              </div>
              <Money cents={g.amount + (g.fee ?? 0)} className={cn('shrink-0 text-[15px] font-semibold', g.status === 'succeeded' ? 'text-text' : 'text-text-3', g.status === 'failed' && 'line-through')} />
            </div>
          )}
          empty={
            filtered ? (
              <EmptyState icon={<SearchX />} title="No donations match" action={<button type="button" className={buttonClass('secondary')} onClick={() => (setQ(''), set(clear))}>Show all my donations</button>}>
                Try another year, or clear the filters.
              </EmptyState>
            ) : (
              <EmptyState icon={<HandHeart />} title="No donations yet" action={<a href="/give" className={buttonClass('give')}>Make your first donation</a>}>
                When you give — online, by bank transfer or in person — it will appear here with its receipt.
              </EmptyState>
            )
          }
        />
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => set({ page: String(p) })} />}
      </Card>
      <GiftSheet gift={open} onClose={() => setOpen(null)} />
    </div>
  )
}
