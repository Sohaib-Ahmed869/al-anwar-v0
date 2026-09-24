import { useEffect, useState, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, CreditCard, PauseCircle, Repeat, RotateCw, SearchX, Send, TrendingUp } from 'lucide-react'
import { FREQUENCIES, FREQUENCY_KEYS, PLAN_STATUSES, type Frequency, type PlanStatus } from '../../../shared/domain'
import type { Page, Plan } from '../../../shared/types'
import { api, errorMessage } from '../../portal/api'
import { formatDate, formatDay, formatMoney, formatNumber } from '../../portal/format'
import {
  Button,
  Card,
  ClearFilters,
  DataTable,
  EmptyState,
  FilterChip,
  Money,
  PageHeader,
  Pagination,
  SearchInput,
  Segmented,
  Stat,
  Toolbar,
  cn,
  useDebounced,
  useDocumentTitle,
  useIsMobile,
  useUrlState,
  type Column,
} from '../../portal/ui'
import { PlanSheet, planCard, usePlanActions } from '../components/PlanSheet'

/* ---------------------------------------------------------------------------
   Regular giving — the monthly, fortnightly and weekly gifts, and the
   instalment plans.

   The page leads with what needs a person: plans whose card was declined.
   Their tab is drawn in red whenever it has anything in it, and each failing
   row carries "Retry now" and "Send fix link" right there, so a morning's
   failures can be worked through without opening each one.

   ?id=<plan> opens a plan (the gift sheet and donor pages link here).
--------------------------------------------------------------------------- */

type PlanPage = Page<Plan> & {
  counts: Record<PlanStatus, number>
  summary: {
    monthlyValue: number
    active: number
    failing: number
    pausedCount: number
    recoveredThisMonth: number
  }
}

const DEFAULTS = {
  status: 'active',
  q: '',
  frequency: '',
  kind: '',
  sort: '',
  page: '1',
  id: '',
}
const TABS: PlanStatus[] = ['active', 'past_due', 'paused', 'cancelled', 'completed']

export default function Plans() {
  useDocumentTitle('Regular giving', 'Al-Anwaar admin')
  const [s, set] = useUrlState(DEFAULTS)
  const [search, setSearch] = useState(s.q)
  const dq = useDebounced(search, 250)
  useEffect(() => {
    if (dq !== s.q) set({ q: dq })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq])

  const params = {
    status: s.status,
    q: s.q,
    frequency: s.frequency,
    kind: s.kind,
    sort: s.sort,
    page: Number(s.page) || 1,
    pageSize: 25,
  }
  const q = useQuery({
    queryKey: ['admin', 'plans', 'list', params],
    queryFn: () => api.get<PlanPage>('/admin/plans', params),
    placeholderData: keepPreviousData,
  })
  const { retry, remind } = usePlanActions(null)
  const isMobile = useIsMobile()
  const data = q.data
  const sum = data?.summary
  const failingTab = s.status === 'past_due'
  const filtered = Boolean(s.q || s.frequency || s.kind)
  const clear = () => {
    setSearch('')
    set({ q: '', frequency: '', kind: '' })
  }
  const open = (p: Plan) => set({ id: p.id, page: s.page })

  const rowActions = (p: Plan, compact?: boolean) =>
    p.status === 'past_due' ? (
      <div
        className="flex flex-wrap items-center justify-end gap-1.5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Button
          size="sm"
          variant="secondary"
          icon={<RotateCw />}
          loading={retry.isPending && retry.variables === p.id}
          disabled={retry.isPending}
          onClick={() => retry.mutate(p.id)}
        >
          Retry now
        </Button>
        <Button
          size="sm"
          variant={compact ? 'secondary' : 'ghost'}
          icon={<Send />}
          loading={remind.isPending && remind.variables === p.id}
          disabled={remind.isPending}
          onClick={() => remind.mutate(p.id)}
        >
          Send fix link
        </Button>
      </div>
    ) : null

  const columns: Column<Plan>[] = [
    {
      key: 'donor',
      header: 'Donor',
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text">{p.donorName}</p>
          <p className="nums truncate text-[12.5px] text-text-3">
            {p.number}
            {p.kind === 'instalment' && p.instalments ? ` · instalment ${p.instalments.paid} of ${p.instalments.total}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      sort: 'amount',
      cell: (p) => (
        <span className="whitespace-nowrap">
          <Money cents={p.amount} className="font-semibold text-text" />{' '}
          <span className="text-text-3">{FREQUENCIES[p.frequency]?.per}</span>
        </span>
      ),
    },
    {
      key: 'appeal',
      header: 'Appeal',
      hideBelow: 'xl',
      cell: (p) => <span className="line-clamp-1 max-w-[220px] text-text-2">{p.appealTitle ?? 'Where most needed'}</span>,
    },
    {
      key: 'next',
      header: failingTab
        ? 'What happened'
        : s.status === 'cancelled'
          ? 'Cancelled'
          : s.status === 'paused'
            ? 'Paused until'
            : 'Next payment',
      sort: failingTab || s.status === 'cancelled' ? undefined : 'nextChargeAt',
      cell: (p) => <NextCell p={p} />,
    },
    {
      key: 'card',
      header: 'Paying with',
      hideBelow: 'lg',
      cell: (p) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-text-2">
          <CreditCard className="size-3.5 text-text-3" />
          <span className="nums">{planCard(p)}</span>
        </span>
      ),
    },
    ...(failingTab
      ? [
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            align: 'right' as const,
            cell: (p: Plan) => rowActions(p),
          },
        ]
      : []),
  ]

  return (
    <div>
      <PageHeader
        title="Regular giving"
        description="Monthly, fortnightly and weekly gifts, and larger gifts paid in instalments. A declined card is retried and the donor is sent a link to fix it."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat
          label="Monthly value"
          icon={<TrendingUp />}
          loading={!sum}
          value={<Money cents={sum?.monthlyValue} />}
          hint="from active plans"
        />
        <Stat
          label="Active"
          icon={<Repeat />}
          loading={!sum}
          value={formatNumber(sum?.active ?? 0)}
          onClick={() => set({ status: 'active' })}
          hint="giving regularly"
        />
        <Stat
          label="Payment failed"
          icon={<AlertTriangle className={cn(sum?.failing ? 'text-red' : undefined)} />}
          loading={!sum}
          value={<span className={cn(sum?.failing ? 'text-red' : undefined)}>{formatNumber(sum?.failing ?? 0)}</span>}
          onClick={() => set({ status: 'past_due' })}
          hint={
            sum ? (sum.recoveredThisMonth ? `${sum.recoveredThisMonth} recovered this month` : 'none recovered yet this month') : undefined
          }
          className={cn(sum?.failing ? 'ring-red/25' : undefined)}
        />
        <Stat
          label="Paused"
          icon={<PauseCircle />}
          loading={!sum}
          value={formatNumber(sum?.pausedCount ?? 0)}
          onClick={() => set({ status: 'paused' })}
          hint="at the donor’s request"
        />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented<PlanStatus>
          aria-label="Status"
          value={s.status as PlanStatus}
          onChange={(v) => set({ status: v, sort: '' })}
          options={TABS.map((t) => ({
            value: t,
            label:
              t === 'past_due' && (data?.counts.past_due ?? 0) > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-red">
                  <AlertTriangle className="size-3.5" /> {PLAN_STATUSES[t].label}
                  <span className="nums rounded-full bg-red px-1.5 text-[11px] text-white">{data?.counts.past_due}</span>
                </span>
              ) : (
                PLAN_STATUSES[t].label
              ),
            count: t === 'past_due' && (data?.counts.past_due ?? 0) > 0 ? undefined : data?.counts[t],
          }))}
        />
        <Toolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Donor, plan number or appeal" className="w-full sm:w-72" />
          <FilterChip<Frequency>
            label="Frequency"
            value={s.frequency ? [s.frequency as Frequency] : []}
            multiple={false}
            onChange={(v) => set({ frequency: v[0] ?? '' })}
            options={FREQUENCY_KEYS.map((f) => ({
              value: f,
              label: FREQUENCIES[f].label,
            }))}
          />
          <FilterChip
            label="Kind"
            value={s.kind ? [s.kind] : []}
            multiple={false}
            onChange={(v) => set({ kind: v[0] ?? '' })}
            options={[
              { value: 'recurring', label: 'Ongoing' },
              { value: 'instalment', label: 'Instalments' },
            ]}
          />
          <ClearFilters show={filtered} onClear={clear} />
        </Toolbar>
      </div>

      <Card className={cn('overflow-hidden', failingTab && data?.items.length ? 'ring-red/20' : undefined)}>
        {failingTab && data && data.items.length > 0 && (
          <div className="border-b border-line-2 bg-red-pale/50 px-5 py-3 text-[13px] leading-relaxed text-red">
            Each of these donors has been emailed a link to update their card. <strong>Retry now</strong> charges the card straight away;{' '}
            <strong>Send fix link</strong> emails them the link again.
          </div>
        )}
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(p) => p.id}
          loading={q.isFetching}
          /* on a phone the card holds its own buttons, so the card itself
             cannot be one; its top half opens the plan instead */
          onRowClick={isMobile ? undefined : open}
          sort={s.sort || undefined}
          onSort={(v) => set({ sort: v })}
          rowClassName={(p) => (p.id === s.id ? 'bg-green-50/60' : undefined)}
          mobile={(p) => (
            <div className="-mx-4 -my-3.5">
              <button type="button" onClick={() => open(p)} className="block w-full px-4 pt-3.5 pb-3 text-left active:bg-ink/[.03]">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-text">{p.donorName}</p>
                    <p className="mt-0.5 truncate text-[13px] text-text-2">
                      {p.appealTitle ?? 'Where most needed'} · {planCard(p)}
                    </p>
                  </div>
                  <p className="shrink-0 text-right">
                    <Money cents={p.amount} className="text-[15px] font-semibold text-text" />
                    <span className="block text-[12px] text-text-3">{FREQUENCIES[p.frequency]?.per}</span>
                  </p>
                </div>
                <div className="mt-1.5 text-[13px]">
                  <NextCell p={p} />
                </div>
              </button>
              {p.status === 'past_due' && <div className="px-4 pb-3.5 [&>div]:justify-start">{rowActions(p, true)}</div>}
            </div>
          )}
          empty={
            q.isError ? (
              <EmptyState title="Regular gifts could not be loaded" action={<Button onClick={() => q.refetch()}>Try again</Button>}>
                {errorMessage(q.error)}
              </EmptyState>
            ) : filtered ? (
              <EmptyState icon={<SearchX />} title="No regular gifts match" action={<Button onClick={clear}>Clear filters</Button>}>
                Try another name or fewer filters.
              </EmptyState>
            ) : (
              <EmptyState icon={failingTab ? <CheckCircle2 /> : <Repeat />} title={EMPTY[s.status as PlanStatus]?.title ?? 'Nothing here'}>
                {EMPTY[s.status as PlanStatus]?.body}
              </EmptyState>
            )
          }
        />
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => set({ page: String(p) })} />}
      </Card>

      <PlanSheet id={s.id || null} onClose={() => set({ id: '', page: s.page })} />
    </div>
  )
}

const EMPTY: Record<PlanStatus, { title: string; body: ReactNode }> = {
  active: {
    title: 'No active regular gifts',
    body: 'When a donor chooses to give every week, fortnight or month on the website, it appears here.',
  },
  past_due: {
    title: 'Every card went through',
    body: 'No regular gift has a failed payment right now. Declines appear here the moment they happen.',
  },
  paused: {
    title: 'Nothing is paused',
    body: 'Donors can pause for a while from their account, or you can do it for them from a plan.',
  },
  cancelled: {
    title: 'Nothing has been cancelled',
    body: 'Cancelled plans stay here with the reason, and their gifts stay on the donor’s record.',
  },
  completed: {
    title: 'No completed instalment plans yet',
    body: 'A gift paid in instalments moves here once its last payment is taken.',
  },
}

function NextCell({ p }: { p: Plan }) {
  if (p.status === 'past_due') {
    return (
      <div className="min-w-0">
        <p className="line-clamp-1 text-red">{p.failure?.lastError ?? 'Declined'}</p>
        <p className="text-[12.5px] text-text-3">
          {p.failure?.nextRetryAt
            ? `Tried ${p.failure.count}× · next try ${formatDay(p.failure.nextRetryAt)}`
            : `Stopped after ${p.failure?.count ?? 0} tries`}
        </p>
      </div>
    )
  }
  if (p.status === 'paused') return <span className="text-text-2">{p.pausedUntil ? formatDate(p.pausedUntil) : 'Until resumed'}</span>
  if (p.status === 'cancelled')
    return (
      <div className="min-w-0">
        <p className="text-text-2">{formatDay(p.cancelledAt)}</p>
        {p.cancelReason && <p className="line-clamp-1 max-w-[240px] text-[12.5px] text-text-3">{p.cancelReason}</p>}
      </div>
    )
  if (p.status === 'completed') return <span className="text-text-2">Completed {p.lastChargeAt ? formatDay(p.lastChargeAt) : ''}</span>
  return (
    <span className="whitespace-nowrap text-text-2">
      {formatDay(p.nextChargeAt)}
      <span className="sr-only"> for {formatMoney(p.amount)}</span>
    </span>
  )
}
