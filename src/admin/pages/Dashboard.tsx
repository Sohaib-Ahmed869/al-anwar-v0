import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, CircleDollarSign, Copy, FileWarning, HandCoins, Inbox, Landmark,
  Megaphone, Plus, Repeat, TrendingUp, UserCheck, UserMinus, UserPlus,
} from 'lucide-react'
import { DESIGNATIONS, METHODS, fyLabel, type Designation, type Method } from '../../../shared/domain'
import { api } from '../../portal/api'
import { Donut, MoneyAreaChart, MoneyColumnChart } from '../../portal/charts'
import { formatDay, formatMoney, formatMoneyShort, formatNumber, formatPercent } from '../../portal/format'
import { useStaff } from '../../portal/session'
import {
  Avatar, ButtonLink, Card, CardHeader, EmptyState, Money, PageHeader, Progress, Segmented, Skeleton, Stat, StatusBadge, cn,
  useDocumentTitle, useIsMobile, useMediaQuery,
} from '../../portal/ui'
import type { AttentionItem, DashboardData, MonthRow } from '../components/donorTypes'

/* ---------------------------------------------------------------------------
   The admin home. Read top to bottom it answers, in order: how are we doing
   (the tiles), what needs me today (Needs attention), and then the detail
   behind the numbers — the months, the appeals, what the money was given as,
   who gave most recently.

   "Needs attention" is the working part of the page, so on a phone it comes
   straight after the tiles, before any chart. Every row names the job in
   plain words and links to exactly where it gets done; when nothing is
   waiting it says so, which is worth knowing too.

   Deltas are written out ("vs the same days last month") because a bare
   arrow on the 3rd of the month tells nobody anything.
--------------------------------------------------------------------------- */

const monthLabel = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  return format(new Date(y!, mo! - 1, 1), 'MMM yy')
}

function greeting(d = new Date()) {
  const h = d.getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function Dashboard() {
  const { user, can } = useStaff()
  useDocumentTitle('Dashboard', 'Al-Anwaar admin')
  const q = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => api.get<DashboardData>('/admin/dashboard'),
    refetchInterval: 120_000,
  })
  const d = q.data
  const first = user?.name.split(' ')[0] ?? ''
  const nav = useNavigate()
  /* two tiles abreast on a phone leave no room for a sparkline beside the words */
  const narrow = useIsMobile()
  const lastMonthName = format(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), 'MMMM')

  return (
    <>
      <PageHeader
        title={`${greeting()}${first ? `, ${first}` : ''}`}
        description={
          <>
            {format(new Date(), 'EEEE d MMMM yyyy')}
            {d && <span className="text-text-3"> · Financial year {fyLabel(d.fy)}</span>}
          </>
        }
        actions={
          <>
            {can('donors.write') && (
              <ButtonLink to="/admin/donors?new=1" variant="secondary" icon={<UserPlus />}>
                Add donor
              </ButtonLink>
            )}
            {can('gifts.create') && (
              <ButtonLink to="/admin/gifts?new=1" variant="primary" icon={<Plus />}>
                Record a donation
              </ButtonLink>
            )}
          </>
        }
      />

      {q.isError && (
        <Card className="mb-4 p-5 text-[13.5px] text-red">The dashboard could not load just now. It will try again in a moment.</Card>
      )}

      {/* ---------- the headline figures ---------- */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat
          label="Raised this month"
          icon={<HandCoins />}
          loading={!d}
          value={d && <Money cents={d.kpis.raisedThisMonth.value} short={d.kpis.raisedThisMonth.value >= 1_000_000} />}
          delta={d?.kpis.raisedThisMonth.delta}
          deltaLabel={`vs same days of ${lastMonthName}`}
          
        />
        <Stat
          label={d ? `Financial year ${fyLabel(d.fy)}` : 'This financial year'}
          icon={<TrendingUp />}
          loading={!d}
          value={d && <Money cents={d.kpis.fyToDate.value} short />}
          delta={d?.kpis.fyToDate.delta}
          deltaLabel="vs last year to date"
        />
        <Stat
          label="Regular giving"
          icon={<Repeat />}
          loading={!d}
          value={
            d && (
              <>
                <Money cents={d.kpis.regular.monthly} short={d.kpis.regular.monthly >= 1_000_000} />
                <span className="ml-1 text-[14px] font-medium tracking-normal text-text-3">/mo</span>
              </>
            )
          }
          hint={d && `${formatNumber(d.kpis.regular.active)} active plans`}
          spark={narrow ? undefined : d?.sparks.regular}
          onClick={can('plans.manage') ? () => nav('/admin/plans') : undefined}
        />
        <Stat
          label="Average donation"
          icon={<CircleDollarSign />}
          loading={!d}
          value={d && <Money cents={d.kpis.averageGift.value} />}
          delta={d?.kpis.averageGift.delta}
          deltaLabel={d ? `${formatNumber(d.kpis.raisedThisMonth.gifts)} donations this month` : undefined}
        />
      </div>

      {/* ---------- what needs doing, and the months ---------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <AttentionCard items={d?.attention} loading={!d} className="lg:order-last" />
        <RaisedCard series={d?.series} className="lg:col-span-2" />
      </div>

      {/* ---------- donors ---------- */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <Stat
          label="New donors this month"
          icon={<UserPlus />}
          loading={!d}
          value={d && formatNumber(d.kpis.newDonors.value)}
          delta={d?.kpis.newDonors.delta}
          deltaLabel={`vs same days of ${lastMonthName}`}
          onClick={can('donors.read') ? () => nav('/admin/donors?segment=new') : undefined}
        />
        <Stat
          label="Returning donors"
          icon={<UserCheck />}
          loading={!d}
          value={d && formatNumber(d.kpis.returningDonors.value)}
          hint="gave again this month"
        />
        <Stat
          label="Lapsed donors"
          icon={<UserMinus />}
          loading={!d}
          value={d && formatNumber(d.kpis.lapsedDonors.value)}
          hint="gave before, nothing in 12 months"
          onClick={can('donors.read') ? () => nav('/admin/donors?segment=lapsed') : undefined}
        />
      </div>

      {/* ---------- appeals and designations ---------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
        <AppealsCard appeals={d?.appeals} canOpen={can('appeals.manage')} className="xl:col-span-3" />
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="Given as" description={d ? `This financial year, ${fyLabel(d.fy)}` : 'This financial year'} />
          <div className="px-5 pb-6 sm:px-6">
            {!d ? (
              <div className="flex items-center gap-5">
                <Skeleton className="size-[150px] rounded-full" />
                <div className="flex-1 space-y-2.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} className="h-3.5 w-full" />
                  ))}
                </div>
              </div>
            ) : d.designations.length ? (
              <Donut
                size={150}
                centerLabel="this year"
                rows={d.designations.map((x) => ({ label: DESIGNATIONS[x.designation]?.label ?? x.designation, value: x.total }))}
              />
            ) : (
              <EmptyState compact title="No donations yet this year">The split appears with the first donation of the financial year.</EmptyState>
            )}
          </div>
        </Card>
      </div>

      {/* ---------- recent gifts ---------- */}
      {can('gifts.read') && (
        <Card className="mt-4 overflow-hidden">
          <CardHeader
            title="Latest donations"
            description="Paid donations, newest first"
            action={
              <ButtonLink to="/admin/gifts" variant="ghost" size="sm" iconRight={<ArrowRight />}>
                All donations
              </ButtonLink>
            }
          />
          {!d ? (
            <div className="px-5 pb-5 sm:px-6">
              <SkeletonList />
            </div>
          ) : d.recentGifts.length ? (
            <ul className="divide-y divide-line-2 border-t border-line-2">
              {d.recentGifts.map((g) => (
                <li key={g.id}>
                  <Link
                    to={`/admin/gifts?gift=${g.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink/[.025] focus-visible:bg-ink/[.035] focus-visible:outline-none sm:px-6"
                  >
                    <Avatar name={g.donorName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-text">
                        {g.donorName}
                        {g.anonymous && <span className="ml-1.5 text-[12px] font-normal text-text-3">(anonymous on the site)</span>}
                      </p>
                      <p className="truncate text-[12.5px] text-text-3">
                        {g.appealTitle ?? 'Where most needed'} · {METHODS[g.method as Method]?.label ?? g.method}
                      </p>
                    </div>
                    <StatusBadge kind="designation" value={g.designation} size="sm" className="hidden sm:inline-flex" />
                    <div className="w-20 shrink-0 text-right">
                      <Money cents={g.amount} className="text-[13.5px] font-semibold text-text" />
                      <p className="text-[12px] text-text-3">{formatDay(g.date)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={<HandCoins />} title="No donations yet">
              Donations from the website, the bank import and events appear here as they arrive.
            </EmptyState>
          )}
        </Card>
      )}
    </>
  )
}

function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-3.5 w-14" />
        </div>
      ))}
    </div>
  )
}

/* ---------- needs attention ---------- */

const ATTENTION_ICONS: Record<string, typeof AlertTriangle> = {
  failedPlans: Repeat,
  bank: Landmark,
  pledges: CalendarClock,
  fundraisers: Megaphone,
  enquiries: Inbox,
  overdue: FileWarning,
  dueSoon: CalendarClock,
  duplicates: Copy,
}

const TONE_RING: Record<AttentionItem['tone'], string> = {
  red: 'bg-red-pale text-red',
  amber: 'bg-amber-pale text-amber',
  teal: 'bg-teal-pale text-teal',
  neutral: 'bg-ink/[.05] text-text-2',
}

function AttentionCard({ items, loading, className }: { items?: AttentionItem[]; loading: boolean; className?: string }) {
  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      <CardHeader
        title="Needs attention"
        description={
          loading ? 'Checking…' : items?.length ? `${items.length} thing${items.length === 1 ? '' : 's'} waiting on the team` : 'Nothing is waiting on you'
        }
        action={
          items?.length ? (
            <span className="nums grid size-7 place-items-center rounded-full bg-red-pale text-[12.5px] font-semibold text-red">{items.length}</span>
          ) : undefined
        }
      />
      {loading ? (
        <div className="space-y-4 px-5 pt-1 pb-6 sm:px-6">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : items?.length ? (
        <ul className="flex-1 divide-y divide-line-2 border-t border-line-2">
          {items.map((i) => {
            const Icon = ATTENTION_ICONS[i.key] ?? AlertTriangle
            return (
              <li key={i.key}>
                <Link
                  to={i.to}
                  className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-ink/[.025] focus-visible:bg-ink/[.035] focus-visible:outline-none sm:px-6"
                >
                  <span className={cn('relative grid size-9 shrink-0 place-items-center rounded-xl', TONE_RING[i.tone])}>
                    <Icon className="size-[17px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] leading-snug font-medium text-text">{i.title}</span>
                    {i.detail && <span className="mt-0.5 block truncate text-[12.5px] text-text-3">{i.detail}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-green opacity-80 transition-opacity group-hover:opacity-100">
                    <span className="hidden sm:inline">{i.action}</span>
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 pt-4 pb-10 text-center">
          <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-green-50 text-green ring-1 ring-green/10">
            <CheckCircle2 className="size-5" />
          </div>
          <p className="text-[15px] font-semibold text-text">All clear</p>
          <p className="mt-1 max-w-[16rem] text-[13px] leading-relaxed text-text-2">
            No failed payments, unmatched bank lines or unanswered enquiries. Enjoy it.
          </p>
        </div>
      )}
    </Card>
  )
}

/* ---------- raised over time ---------- */

type Split = 'total' | 'method' | 'designation'

function RaisedCard({ series, className }: { series?: MonthRow[]; className?: string }) {
  const [span, setSpan] = useState<'12' | '24'>('12')
  const wide = useMediaQuery('(min-width: 1024px)')
  const h = wide ? 400 : 260
  const [split, setSplit] = useState<Split>('total')
  const rows = useMemo(() => (series ? series.slice(-Number(span)) : []), [series, span])
  const total = rows.reduce((s, r) => s + r.total, 0)
  const prior = series && span === '12' ? series.slice(0, 12).reduce((s, r) => s + r.total, 0) : 0

  const chart = useMemo(() => {
    if (split === 'total') return null
    const field = split === 'method' ? 'byMethod' : 'byDesignation'
    const sums = new Map<string, number>()
    for (const r of rows) for (const [k, v] of Object.entries(r[field])) sums.set(k, (sums.get(k) ?? 0) + (v ?? 0))
    const ranked = [...sums.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
    /* four named series and the rest folded into "Other" — past five colours stop being readable */
    const named = ranked.length > 5 ? ranked.slice(0, 4) : ranked
    const rest = ranked.slice(named.length)
    const label = (k: string) => (split === 'method' ? METHODS[k as Method]?.label : DESIGNATIONS[k as Designation]?.short) ?? k
    const data = rows.map((r) => {
      const o: Record<string, string | number> = { month: r.month }
      const src = r[field] as Record<string, number | undefined>
      for (const k of named) o[k] = src[k] ?? 0
      if (rest.length) o.other = rest.reduce((s, k) => s + (src[k] ?? 0), 0)
      return o
    })
    const seriesDef = [...named.map((k) => ({ key: k, label: label(k) })), ...(rest.length ? [{ key: 'other', label: 'Other', color: '#9aa09e' }] : [])]
    return { data, series: seriesDef }
  }, [rows, split])

  return (
    <Card className={cn('min-w-0', className)}>
      <div className="flex flex-col gap-3 px-5 pt-5 pb-2 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-text">Raised</h2>
          {series ? (
            <p className="mt-1 text-[13px] text-text-2">
              <Money cents={total} className="text-[20px] font-semibold tracking-[-0.02em] text-text" />
              <span className="ml-2">in the last {span} months</span>
              {prior > 0 && (
                <span className={cn('ml-2 nums font-medium', total >= prior ? 'text-green' : 'text-red')}>
                  {total >= prior ? '+' : '−'}
                  {formatPercent(Math.abs(total - prior) / prior)} on the year before
                </span>
              )}
            </p>
          ) : (
            <Skeleton className="mt-2 h-6 w-48" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            size="sm"
            aria-label="Split the months"
            value={split}
            onChange={setSplit}
            options={[
              { value: 'total', label: 'Total' },
              { value: 'method', label: 'By method' },
              { value: 'designation', label: 'By designation' },
            ]}
          />
          <Segmented
            size="sm"
            aria-label="How many months"
            value={span}
            onChange={setSpan}
            options={[
              { value: '12', label: '12 mo' },
              { value: '24', label: '24 mo' },
            ]}
          />
        </div>
      </div>
      <div className="px-3 pb-4 sm:px-4">
        {!series ? (
          <div className="mx-2 mt-2"><Skeleton className="h-[260px] lg:h-[400px]" /></div>
        ) : split === 'total' ? (
          <MoneyAreaChart data={rows.map((r) => ({ month: r.month, total: r.total }))} xKey="month" series={[{ key: 'total', label: 'Raised' }]} formatX={monthLabel} height={h} />
        ) : (
          <div className="pl-2">
            <MoneyColumnChart data={chart!.data} xKey="month" series={chart!.series} formatX={monthLabel} height={h - 24} />
          </div>
        )}
      </div>
    </Card>
  )
}

/* ---------- appeals ---------- */

function AppealsCard({ appeals, canOpen, className }: { appeals?: DashboardData['appeals']; canOpen: boolean; className?: string }) {
  const nav = useNavigate()
  return (
    <Card className={cn('min-w-0', className)}>
      <CardHeader
        title="Open appeals"
        description="Raised against target, and what came in over the last 30 days"
        action={
          canOpen ? (
            <ButtonLink to="/admin/appeals" variant="ghost" size="sm" iconRight={<ArrowRight />}>
              Appeals
            </ButtonLink>
          ) : undefined
        }
      />
      <div className="px-5 pb-5 sm:px-6">
        {!appeals ? (
          <div className="space-y-5 pt-1">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : appeals.length ? (
          <ul className="-mx-2 space-y-1">
            {appeals.map((a) => {
              const pct = a.target ? a.raised / a.target : 0
              const body = (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[13.5px] font-medium text-text">{a.title}</span>
                    <span className="nums shrink-0 text-[13px] text-text">
                      <span className="font-semibold">{formatMoneyShort(a.raised)}</span>
                      {a.target > 0 && <span className="text-text-3"> of {formatMoneyShort(a.target)}</span>}
                    </span>
                  </div>
                  <Progress className="mt-2" value={a.raised} max={a.target || a.raised || 1} tone={pct >= 1 ? 'teal' : 'green'} size="sm" label={`${a.title}: ${formatPercent(pct)} of target`} />
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[12px] text-text-3">
                    <span className="nums">
                      {a.last30 > 0 ? `${formatMoney(a.last30, { whole: true })} in the last 30 days` : 'Nothing in the last 30 days'} · {formatNumber(a.donorCount)} donors
                    </span>
                    {a.target > 0 && (
                      <span className={cn('nums font-medium', pct >= 1 ? 'text-teal' : 'text-text-2')}>
                        {pct >= 1 ? `Target passed · ${formatPercent(pct)}` : `${formatPercent(pct)} of target`}
                      </span>
                    )}
                  </div>
                </>
              )
              return (
                <li key={a.id}>
                  {canOpen ? (
                    <button type="button" onClick={() => nav(`/admin/appeals/${a.id}`)} className="block w-full rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-ink/[.03]">
                      {body}
                    </button>
                  ) : (
                    <div className="px-2 py-2.5">{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState
            compact
            icon={<Megaphone />}
            title="No appeals are open"
            action={canOpen ? <ButtonLink to="/admin/appeals/new" variant="primary" size="sm" icon={<Plus />}>New appeal</ButtonLink> : undefined}
          >
            Open an appeal and its progress shows here.
          </EmptyState>
        )}
      </div>
    </Card>
  )
}

