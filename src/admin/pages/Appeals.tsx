import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ImageOff, Megaphone, Plus, Star } from 'lucide-react'
import { COUNTRIES, type AppealStatus } from '../../../shared/domain'
import type { Appeal, Page } from '../../../shared/types'
import { api } from '../../portal/api'
import QuickGiveList from '../components/QuickGiveList'
import { daysUntil, formatDay, formatMoney, formatNumber } from '../../portal/format'
import {
  ButtonLink, Card, EmptyState, Money, PageHeader, Pagination, Progress, SearchInput, Segmented, Select, Skeleton,
  StatusBadge, Toolbar, cn, useDebounced, useDocumentTitle, useUrlState,
} from '../../portal/ui'

/* ---------------------------------------------------------------------------
   Appeals — every appeal as a card, because an appeal is a photograph and a
   progress bar before it is a row of numbers. Each card shows what the team
   checks most: raised against target, how many people gave, and what came
   in over the last 30 days (is it still moving?).

   Filters live in the URL. Open appeals come first by default (featured,
   then newest), which is the order the website shows them in.
--------------------------------------------------------------------------- */

export type AppealRow = Appeal & { raisedLast30: number }
type ListResponse = Page<AppealRow> & { counts: Partial<Record<AppealStatus, number>> }

const SORTS = [
  { value: '', label: 'Featured first' },
  { value: '-createdAt', label: 'Newest' },
  { value: '-raised', label: 'Most raised' },
  { value: 'closesAt', label: 'Closing soonest' },
  { value: 'title', label: 'Title A–Z' },
]

export default function Appeals() {
  useDocumentTitle('Appeals', 'Admin')
  const [s, set] = useUrlState({ status: '', q: '', sort: '', page: '1' })
  const q = useDebounced(s.q, 250)
  const list = useQuery({
    queryKey: ['admin', 'appeals', { ...s, q }],
    queryFn: () => api.get<ListResponse>('/admin/appeals', { status: s.status, q, sort: s.sort, page: s.page, pageSize: 24 }),
    placeholderData: keepPreviousData,
  })
  const counts = list.data?.counts ?? {}
  const all = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)
  const filtered = Boolean(s.status || s.q)

  return (
    <>
      <PageHeader
        title="Appeals"
        description="What the website asks people to give to. Set the target, the story and the suggested amounts; close an appeal and its page and history stay."
        actions={
          <>
            <ButtonLink to="#quick-give" onClick={(e) => { e.preventDefault(); document.getElementById('quick-give')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>
              Quick-donate list
            </ButtonLink>
            <ButtonLink to="/admin/appeals/new" variant="primary" icon={<Plus />}>
              New appeal
            </ButtonLink>
          </>
        }
      />

      <Toolbar className="mb-5">
        <Segmented
          aria-label="Status"
          value={s.status}
          onChange={(v) => set({ status: v })}
          options={[
            { value: '', label: 'All', count: list.data ? all : undefined },
            { value: 'open', label: 'Open', count: counts.open ?? 0 },
            { value: 'draft', label: 'Drafts', count: counts.draft ?? 0 },
            { value: 'closed', label: 'Closed', count: counts.closed ?? 0 },
          ]}
        />
        <SearchInput value={s.q} onChange={(v) => set({ q: v })} placeholder="Search appeals" className="min-w-0 flex-1 sm:ml-auto sm:w-64 sm:flex-none" />
        <div className="w-[150px] sm:w-48">
          <Select value={s.sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort">
            {SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </Toolbar>

      {list.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-[16/9] rounded-none" />
              <div className="space-y-3 p-5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-2 w-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : !list.data?.items.length ? (
        <Card>
          <EmptyState
            icon={<Megaphone />}
            title={filtered ? 'No appeals match' : 'No appeals yet'}
            action={
              filtered ? (
                <button type="button" className="text-sm font-medium text-green hover:underline" onClick={() => set({ status: '', q: '' })}>
                  Clear the filters
                </button>
              ) : (
                <ButtonLink to="/admin/appeals/new" variant="primary" icon={<Plus />}>
                  Write the first appeal
                </ButtonLink>
              )
            }
          >
            {filtered ? 'Try another word, or look in all statuses.' : 'An appeal is a story, a target and a few suggested amounts. It starts as a draft only the team can see.'}
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className={cn('grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3', list.isPlaceholderData && 'opacity-60')}>
            {list.data.items.map((a) => (
              <AppealCard key={a.id} a={a} />
            ))}
          </div>
          {list.data.total > list.data.pageSize && (
            <Card className="mt-4 overflow-hidden">
              <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={(p) => set({ page: String(p) })} className="border-0" />
            </Card>
          )}
        </>
      )}

      {/* The home page's "Donate now" box, ordered and named here (28 September 2026). */}
      <div className="mt-8">
        <QuickGiveList />
      </div>
    </>
  )
}

function AppealCard({ a }: { a: AppealRow }) {
  const pct = a.target ? Math.round((a.raised / a.target) * 100) : null
  const closing = a.status === 'open' && a.closesAt ? daysUntil(a.closesAt) : null
  return (
    <Link
      to={`/admin/appeals/${a.id}`}
      className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      <Card className="flex h-full flex-col overflow-hidden transition-shadow group-hover:shadow-lift">
        <div className="relative aspect-[2/1] overflow-hidden bg-paper-2 sm:aspect-[16/9]">
          {a.image ? (
            <img src={a.image} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
          ) : (
            <div className="grid size-full place-items-center text-text-3">
              <ImageOff className="size-6" />
            </div>
          )}
          <div className="absolute top-3 left-3 flex gap-1.5">
            <StatusBadge kind="appeal" value={a.status} className="bg-paper/95 shadow-soft backdrop-blur" />
            {a.featured && (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-paper/95 px-2.5 text-[12px] font-medium text-text-2 shadow-soft">
                <Star className="size-3" /> Featured
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <h3 className="text-[15.5px] leading-snug font-semibold tracking-[-0.01em] text-text">{a.title}</h3>
          <p className="mt-1 text-[13px] text-text-2">
            {COUNTRIES[a.country] ?? a.country}
            {a.where ? ` · ${a.where}` : ''}
            {closing != null && closing >= 0 && closing <= 30 && <span className="text-amber"> · closes {closing === 0 ? 'today' : `in ${closing} days`}</span>}
            {a.status === 'closed' && a.closesAt && <span> · closed {formatDay(a.closesAt)}</span>}
          </p>
          <div className="mt-auto pt-5">
            <div className="flex items-baseline justify-between gap-3">
              <Money cents={a.raised} className="text-[17px] font-semibold text-text" />
              <span className="nums text-[12.5px] text-text-3">
                {a.target ? (
                  <>
                    of {formatMoney(a.target)} · {pct}%
                  </>
                ) : (
                  'no target'
                )}
              </span>
            </div>
            <Progress value={a.raised} max={a.target || a.raised || 1} className="mt-2" label={`${pct ?? 0}% of target`} />
            <div className="mt-3 flex items-center justify-between text-[12.5px] text-text-2">
              <span className="nums">{formatNumber(a.donorCount)} donors</span>
              <span className="nums">
                {a.raisedLast30 ? (
                  <>
                    <span className="font-medium text-green">+{formatMoney(a.raisedLast30, { whole: true })}</span> last 30 days
                  </>
                ) : (
                  <span className="text-text-3">Nothing in the last 30 days</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
