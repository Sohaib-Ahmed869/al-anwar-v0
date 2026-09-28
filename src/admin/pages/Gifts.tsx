import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Download, HandCoins, Plus, SearchX } from 'lucide-react'
import { DESIGNATIONS, DESIGNATION_KEYS, GIFT_STATUSES, METHODS, METHOD_KEYS, type GiftStatus, type Method } from '../../../shared/domain'
import type { Appeal, Gift, Page } from '../../../shared/types'
import { api, download, errorMessage } from '../../portal/api'
import { formatDay, formatMoney, formatNumber, plural } from '../../portal/format'
import { useStaff } from '../../portal/session'
import {
  Button, Card, ClearFilters, DataTable, DateRangePicker, EmptyState, FilterChip, Money, PageHeader, Pagination, SearchInput,
  StatusBadge, Toolbar, cn, toast, useDebounced, useDocumentTitle, useUrlState, type Column,
} from '../../portal/ui'
import { MethodLabel } from '../components/GiftBits'
import { GiftRecordDialog, type SessionTally } from '../components/GiftRecordDialog'
import { GiftSheet } from '../components/GiftSheet'

/* ---------------------------------------------------------------------------
   Gifts — every gift, however it came in, in one list.

   Two audiences share this page. Finance and fundraising staff get the whole
   ledger: filters, totals for whatever is filtered, a CSV of exactly that.
   A volunteer gets "Gifts you've entered": the Record button front and
   centre, their own last 30 days (the server decides that, not this page),
   and nothing to export.

   Deep links: ?gift=<id> opens a gift; ?new=1&donor=<id> opens the record
   dialog with that donor chosen (from a donor's page or the command palette).
--------------------------------------------------------------------------- */

type GiftPage = Page<Gift> & { totals: { amount: number; count: number }; scope: 'all' | 'mine' }

const DEFAULTS = {
  q: '',
  from: '',
  to: '',
  method: '',
  designation: '',
  status: '',
  appeal: '',
  sort: '-date',
  page: '1',
  gift: '',
  new: '',
  donor: '',
}

const csv = (s: string) => (s ? s.split(',') : [])
const TALLY_KEY = 'aa.gift-tally'

function readTally(): SessionTally {
  try {
    const t = JSON.parse(sessionStorage.getItem(TALLY_KEY) ?? '')
    if (typeof t?.count === 'number' && typeof t?.total === 'number') return t
  } catch {
    /* nothing kept yet */
  }
  return { count: 0, total: 0 }
}

export default function Gifts() {
  const { can } = useStaff()
  const all = can('gifts.read')
  const canCreate = can('gifts.create')
  const canExport = all && can('reports.export')
  useDocumentTitle(all ? 'Donations' : 'Donations you’ve entered', 'Al-Anwaar admin')

  const [s, set] = useUrlState(DEFAULTS)
  const [search, setSearch] = useState(s.q)
  const dq = useDebounced(search, 250)
  useEffect(() => {
    if (dq !== s.q) set({ q: dq })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq])

  /* the running tally survives closing the dialog and a refresh, not the tab */
  const [tally, setTallyState] = useState<SessionTally>(readTally)
  const setTally = (t: SessionTally) => {
    setTallyState(t)
    try {
      sessionStorage.setItem(TALLY_KEY, JSON.stringify(t))
    } catch {
      /* private mode: the tally just lives in memory */
    }
  }

  const page = Number(s.page) || 1
  const params = {
    q: s.q,
    from: s.from,
    to: s.to,
    method: s.method,
    designation: s.designation,
    status: s.status,
    appeal: s.appeal,
    /* ?donor= narrows the list to one person (the donor record links here) and
       also preselects them when the record dialog opens */
    donor: s.donor,
    sort: s.sort,
    page,
    pageSize: 25,
  }
  const q = useQuery({
    queryKey: ['admin', 'gifts', 'list', params],
    queryFn: () => api.get<GiftPage>('/admin/gifts', params),
    placeholderData: keepPreviousData,
  })
  const appeals = useQuery({
    queryKey: ['appeal-options', true],
    queryFn: () => api.get<Page<Appeal>>('/admin/appeals', { pageSize: 200 }),
    enabled: all,
    staleTime: 60_000,
  })

  const filtered = Boolean(s.q || s.from || s.method || s.designation || s.status || s.appeal || s.donor)
  const clear = () => {
    setSearch('')
    set({ q: '', from: '', to: '', method: '', designation: '', status: '', appeal: '', donor: '' })
  }
  const openGift = (g: Gift) => set({ gift: g.id, page: s.page })
  const openNew = () => set({ new: '1', page: s.page })

  const [exporting, setExporting] = useState(false)
  const exportCsv = async () => {
    setExporting(true)
    try {
      const { gift: _g, new: _n, page: _p, sort: _s, ...f } = s
      await download('/admin/gifts/export', f, 'gifts.csv')
      toast.success(`Downloaded ${plural(q.data?.total ?? 0, 'donation')} as CSV`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  const columns: Column<Gift>[] = [
    {
      key: 'date',
      header: 'Date',
      sort: 'date',
      width: 110,
      cell: (g) => <span className="whitespace-nowrap text-text-2">{formatDay(g.date)}</span>,
    },
    {
      key: 'donor',
      header: 'Donor',
      cell: (g) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text">{g.donorName}</p>
          <p className="nums truncate text-[12.5px] text-text-3">{g.number}</p>
        </div>
      ),
    },
    {
      key: 'appeal',
      header: 'Appeal',
      hideBelow: 'lg',
      cell: (g) => <span className="line-clamp-1 max-w-[260px] text-text-2">{g.appealTitle ?? (g.fundraiserTitle || 'Where most needed')}</span>,
    },
    { key: 'designation', header: 'For', cell: (g) => <StatusBadge kind="designation" value={g.designation} size="sm" /> },
    { key: 'method', header: 'Method', hideBelow: 'xl', cell: (g) => <MethodLabel method={g.method} /> },
    { key: 'status', header: 'Status', cell: (g) => <StatusBadge kind="gift" value={g.status} size="sm" /> },
    {
      key: 'amount',
      header: 'Amount',
      sort: 'amount',
      align: 'right',
      cell: (g) => (
        <Money
          cents={g.amount}
          className={cn('font-semibold', g.status === 'refunded' || g.status === 'failed' ? 'text-text-3 line-through decoration-text-3/60' : 'text-text')}
        />
      ),
    },
  ]

  const data = q.data
  const totals = data?.totals

  return (
    <div>
      <PageHeader
        title={all ? 'Donations' : 'Donations you’ve entered'}
        description={
          all
            ? 'Every donation, online and offline, with its receipt. Filter, open one to resend a receipt or correct it.'
            : 'Cash, cheques and event donations you have recorded in the last 30 days. Record each one as it is handed to you and the donor gets their receipt straight away.'
        }
        actions={
          <>
            {canExport && (
              <Button variant="secondary" icon={<Download />} loading={exporting} onClick={exportCsv} disabled={!data?.total}>
                Export CSV
              </Button>
            )}
            {canCreate && (
              <Button variant="primary" size={all ? 'md' : 'lg'} icon={<Plus />} onClick={openNew} className={cn(!all && 'w-full sm:w-auto')}>
                Record a donation
              </Button>
            )}
          </>
        }
      />

      {tally.count > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-green-50 px-4 py-3 ring-1 ring-green/15">
          <p className="text-[13.5px] text-green">
            <span className="nums font-semibold">
              {plural(tally.count, 'donation')} · {formatMoney(tally.total)}
            </span>{' '}
            recorded this session — check it against the tin before you hand it in.
          </p>
          <button type="button" onClick={() => setTally({ count: 0, total: 0 })} className="text-[13px] font-medium text-green/80 hover:text-green hover:underline">
            Start a new count
          </button>
        </div>
      )}

      <Toolbar className="mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={all ? 'Donor, donation, receipt or bank reference' : 'Donor, donation or receipt number'}
          className="w-full sm:w-80"
        />
        {all && <DateRangePicker value={s.from ? { from: s.from, to: s.to } : null} onChange={(r) => set({ from: r?.from ?? '', to: r?.to ?? '' })} />}
        <FilterChip<Method>
          label="Method"
          value={csv(s.method) as Method[]}
          onChange={(v) => set({ method: v.join(',') })}
          options={(all ? METHOD_KEYS : (['cash', 'cheque', 'event', 'bank'] as Method[])).map((m) => ({ value: m, label: METHODS[m].label }))}
        />
        {all && (
          <>
            <FilterChip
              label="For"
              value={csv(s.designation)}
              onChange={(v) => set({ designation: v.join(',') })}
              options={DESIGNATION_KEYS.map((d) => ({ value: d, label: DESIGNATIONS[d].label }))}
            />
            <FilterChip<GiftStatus>
              label="Status"
              value={csv(s.status) as GiftStatus[]}
              onChange={(v) => set({ status: v.join(',') })}
              options={(Object.keys(GIFT_STATUSES) as GiftStatus[]).map((k) => ({ value: k, label: GIFT_STATUSES[k].label }))}
            />
            <FilterChip
              label="Appeal"
              value={csv(s.appeal)}
              onChange={(v) => set({ appeal: v.join(',') })}
              options={(appeals.data?.items ?? []).map((a) => ({ value: a.id, label: a.title }))}
            />
          </>
        )}
        <ClearFilters show={filtered} onClear={clear} />
      </Toolbar>

      <Card className="overflow-hidden">
        {/* the figure for whatever is filtered */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line-2 px-5 py-3.5">
          {totals ? (
            <p className="nums text-[14px] text-text-2">
              <span className="font-semibold text-text">{formatNumber(totals.count)}</span> {totals.count === 1 ? 'donation' : 'donations'}
              <span className="mx-2 text-text-3">·</span>
              <span className="font-semibold text-text">{formatMoney(totals.amount)}</span> received
            </p>
          ) : (
            <span className="skeleton h-4 w-48 rounded" />
          )}
          {data && data.totals.count > 0 && s.status !== 'succeeded' && (
            <p className="text-[12.5px] text-text-3">Refunded, failed and awaiting donations are not in the total.</p>
          )}
        </div>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(g) => g.id}
          loading={q.isFetching}
          onRowClick={openGift}
          sort={s.sort}
          onSort={(v) => set({ sort: v })}
          rowClassName={(g) => (g.id === s.gift ? 'bg-green-50/60' : undefined)}
          mobile={(g) => (
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-text">{g.donorName}</p>
                <p className="mt-0.5 truncate text-[13px] text-text-2">
                  {formatDay(g.date)} · {METHODS[g.method].label}
                  {g.appealTitle ? ` · ${g.appealTitle}` : ''}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <StatusBadge kind="designation" value={g.designation} size="sm" />
                  {g.status !== 'succeeded' && <StatusBadge kind="gift" value={g.status} size="sm" />}
                </div>
              </div>
              <Money
                cents={g.amount}
                className={cn('shrink-0 text-[15px] font-semibold', g.status === 'refunded' || g.status === 'failed' ? 'text-text-3 line-through' : 'text-text')}
              />
            </div>
          )}
          empty={
            q.isError ? (
              <EmptyState title="The donations could not be loaded" action={<Button onClick={() => q.refetch()}>Try again</Button>}>
                {errorMessage(q.error)}
              </EmptyState>
            ) : filtered ? (
              <EmptyState icon={<SearchX />} title="No donations match" action={<Button onClick={clear}>Clear filters</Button>}>
                Try a wider date range or fewer filters.
              </EmptyState>
            ) : (
              <EmptyState
                icon={<HandCoins />}
                title={all ? 'No donations yet' : 'You have not recorded a donation in the last 30 days'}
                action={
                  canCreate && (
                    <Button variant="primary" icon={<Plus />} onClick={openNew}>
                      Record a donation
                    </Button>
                  )
                }
              >
                {all
                  ? 'Donations from the website, bank imports and regular giving will appear here as they arrive.'
                  : 'When someone hands you cash or a cheque, record it here. It takes about ten seconds.'}
              </EmptyState>
            )
          }
        />
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => set({ page: String(p) })} />}
      </Card>

      <GiftSheet id={s.gift || null} onClose={() => set({ gift: '', page: s.page })} />
      {canCreate && (
        <GiftRecordDialog
          open={s.new === '1'}
          onOpenChange={(v) => set(v ? { new: '1', page: s.page } : { new: '', donor: '', page: s.page })}
          presetDonorId={s.donor || null}
          tally={tally}
          onTally={setTally}
        />
      )}
    </div>
  )
}
