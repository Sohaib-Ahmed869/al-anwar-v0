import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Inbox, MessagesSquare, SearchX, UserRound } from 'lucide-react'
import { ENQUIRY_TYPES, type EnquiryType } from '../../../shared/domain'
import type { Enquiry, Page } from '../../../shared/types'
import { api, errorMessage } from '../../portal/api'
import { formatDateTime } from '../../portal/format'
import {
  Avatar, Button, Card, ClearFilters, EmptyState, FilterChip, PageHeader, Pagination, SearchInput, Segmented, Sheet, SkeletonRows,
  StatusBadge, Toolbar, cn, useDebounced, useDocumentTitle, useMediaQuery, useUrlState,
} from '../../portal/ui'
import { EnquiryThread } from '../components/EnquiryThread'
import { shortAge } from '../components/GiftBits'

/* ---------------------------------------------------------------------------
   Enquiries — the inbox for the website's forms.

   On a wide screen it is two panes, list and conversation, so someone can
   work down the new ones without losing their place. Below that the list is
   the page and a conversation opens over it in a Sheet. Either way the open
   enquiry is ?id= in the URL, so a link to one can be pasted to a colleague.

   The default view is everything still open (new + in progress), newest
   first; "Assigned to me" is the view for the person who has been given some.
--------------------------------------------------------------------------- */

type Row = Omit<Enquiry, 'notes'> & { noteCount: number; lastActivityAt: string }
type InboxPage = Page<Row> & { counts: { new: number; open: number; closed: number; active: number } }

const DEFAULTS = { status: 'active', type: '', assigned: '', q: '', page: '1', id: '' }
type StatusView = 'active' | 'new' | 'open' | 'closed' | 'all'

export default function Enquiries() {
  useDocumentTitle('Enquiries', 'Al-Anwaar admin')
  const wide = useMediaQuery('(min-width: 1024px)')
  const [s, set] = useUrlState(DEFAULTS)
  const [search, setSearch] = useState(s.q)
  const dq = useDebounced(search, 250)
  useEffect(() => {
    if (dq !== s.q) set({ q: dq })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq])

  const params = { status: s.status === 'all' ? '' : s.status, type: s.type, assigned: s.assigned, q: s.q, page: Number(s.page) || 1, pageSize: 30 }
  const q = useQuery({
    queryKey: ['admin', 'enquiries', 'list', params],
    queryFn: () => api.get<InboxPage>('/admin/enquiries', params),
    placeholderData: keepPreviousData,
  })
  const data = q.data
  const c = data?.counts
  const filtered = Boolean(s.type || s.assigned || s.q)
  const clear = () => {
    setSearch('')
    set({ type: '', assigned: '', q: '' })
  }
  const open = (id: string) => set({ id, page: s.page })
  const types = s.type ? (s.type.split(',') as EnquiryType[]) : []

  const list = (
    <>
      {q.isLoading ? (
        <SkeletonRows rows={8} className="p-5" />
      ) : !data?.items.length ? (
        q.isError ? (
          <EmptyState compact title="The inbox could not be loaded" action={<Button onClick={() => q.refetch()}>Try again</Button>}>
            {errorMessage(q.error)}
          </EmptyState>
        ) : filtered ? (
          <EmptyState compact icon={<SearchX />} title="Nothing matches" action={<Button onClick={clear}>Clear filters</Button>}>
            Try another name, or fewer filters.
          </EmptyState>
        ) : (
          <EmptyState compact icon={<Inbox />} title={s.status === 'active' || s.status === 'new' ? 'All caught up' : 'Nothing here'}>
            {s.status === 'active' || s.status === 'new'
              ? 'Every enquiry has been dealt with. New messages, sign-ups and offers from the website land here.'
              : 'Enquiries appear here as they move through the inbox.'}
          </EmptyState>
        )
      ) : (
        <ul className={cn('divide-y divide-line-2 transition-opacity', q.isFetching && q.isPlaceholderData && 'opacity-60')}>
          {data.items.map((e) => (
            <li key={e.id}>
              <InboxRow e={e} active={e.id === s.id} onOpen={() => open(e.id)} />
            </li>
          ))}
        </ul>
      )}
      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => set({ page: String(p) })} />}
    </>
  )

  return (
    <div>
      <PageHeader
        title="Enquiries"
        description="Messages, volunteer and partner offers, event sign-ups and fundraising ideas from the website. Reply from here and it is emailed from Al-Anwaar, with the thread kept on the donor’s record."
      />

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Segmented<StatusView>
          aria-label="Status"
          value={s.status as StatusView}
          onChange={(v) => set({ status: v })}
          options={[
            { value: 'active', label: 'Open', count: c?.active },
            { value: 'new', label: 'New', count: c?.new },
            { value: 'open', label: 'In progress', count: c?.open },
            { value: 'closed', label: 'Closed', count: c?.closed },
            { value: 'all', label: 'All' },
          ]}
        />
        <Toolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Name, email or words in the message" className="w-full sm:w-72" />
          <FilterChip<EnquiryType>
            label="Type"
            value={types}
            onChange={(v) => set({ type: v.join(',') })}
            options={(Object.keys(ENQUIRY_TYPES) as EnquiryType[]).map((t) => ({ value: t, label: ENQUIRY_TYPES[t].label }))}
          />
          <button
            type="button"
            aria-pressed={s.assigned === 'me'}
            onClick={() => set({ assigned: s.assigned === 'me' ? '' : 'me' })}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium whitespace-nowrap ring-1 ring-inset transition-colors pointer-coarse:h-10',
              s.assigned === 'me' ? 'bg-green-50 text-green ring-green/25' : 'bg-paper text-text-2 ring-line hover:text-text',
            )}
          >
            <UserRound className="size-3.5" /> Assigned to me
          </button>
          <button
            type="button"
            aria-pressed={s.assigned === 'unassigned'}
            onClick={() => set({ assigned: s.assigned === 'unassigned' ? '' : 'unassigned' })}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium whitespace-nowrap ring-1 ring-inset transition-colors pointer-coarse:h-10',
              s.assigned === 'unassigned' ? 'bg-green-50 text-green ring-green/25' : 'bg-paper text-text-2 ring-line hover:text-text',
            )}
          >
            Nobody’s yet
          </button>
          <ClearFilters show={filtered} onClear={clear} />
        </Toolbar>
      </div>

      {wide ? (
        <div className="grid grid-cols-[minmax(320px,400px)_1fr] items-start gap-4">
          <Card className="sticky top-4 flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
          </Card>
          <Card className="min-h-[560px] overflow-hidden">
            {s.id ? (
              <EnquiryThread key={s.id} id={s.id} className="p-6 xl:p-8" />
            ) : (
              <EmptyState icon={<MessagesSquare />} title="Choose an enquiry" className="py-28">
                {c?.new ? `${c.new} ${c.new === 1 ? 'is' : 'are'} new and waiting for someone to pick up.` : 'Pick one from the list to read it, reply or pass it to a colleague.'}
              </EmptyState>
            )}
          </Card>
        </div>
      ) : (
        <>
          <Card className="overflow-hidden">{list}</Card>
          <Sheet open={Boolean(s.id)} onOpenChange={(v) => !v && set({ id: '', page: s.page })} title="Enquiry" width={640}>
            {s.id && <EnquiryThread key={s.id} id={s.id} />}
          </Sheet>
        </>
      )}
    </div>
  )
}

function InboxRow({ e, active, onOpen }: { e: Row; active: boolean; onOpen: () => void }) {
  const unread = e.status === 'new'
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={active || undefined}
      className={cn(
        'relative flex w-full gap-3 px-4 py-3.5 text-left transition-colors sm:px-5',
        active ? 'bg-green-50' : 'hover:bg-paper-2/80',
        active && 'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-green',
      )}
    >
      <span className="relative shrink-0">
        <Avatar name={e.name} size="sm" />
        {unread && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-[#c98a0b] ring-2 ring-paper" aria-label="New" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cn('min-w-0 flex-1 truncate text-[14px]', unread ? 'font-semibold text-text' : 'font-medium text-text')}>{e.name}</span>
          <span className="nums shrink-0 text-[12px] text-text-3" title={formatDateTime(e.createdAt)}>
            {shortAge(e.createdAt)}
          </span>
        </span>
        <span className={cn('mt-0.5 block truncate text-[13px]', unread ? 'text-text' : 'text-text-2')}>{e.subject || 'No subject'}</span>
        <span className="mt-0.5 line-clamp-1 text-[12.5px] text-text-3">{e.message}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <StatusBadge kind="enquiryType" value={e.type} size="sm" />
          {e.status === 'open' && <StatusBadge kind="enquiry" value="open" size="sm" />}
          {e.assignedName && <span className="truncate text-[12px] text-text-3">· {e.assignedName}</span>}
        </span>
      </span>
    </button>
  )
}
