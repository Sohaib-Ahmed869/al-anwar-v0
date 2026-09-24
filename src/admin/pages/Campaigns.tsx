import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Send } from 'lucide-react'
import type { CampaignStatus } from '../../../shared/domain'
import type { Campaign, Page } from '../../../shared/types'
import { api } from '../../portal/api'
import { formatDateTime, formatDay, formatNumber } from '../../portal/format'
import {
  ButtonLink, Card, DataTable, EmptyState, PageHeader, Pagination, Progress, SearchInput, Segmented, StatusBadge, Toolbar,
  useDebounced, useDocumentTitle, useUrlState, type Column,
} from '../../portal/ui'
import { describeSegment, useAppealOptions } from '../components/CampaignAudience'

/* ---------------------------------------------------------------------------
   Email campaigns — the list. Each row says who it went to in words
   ("Lapsed for 12+ months"), how many, and how it went; a campaign that is
   sending shows its progress and the list polls until it is done.
--------------------------------------------------------------------------- */

type ListResponse = Page<Campaign> & { counts: Partial<Record<CampaignStatus, number>> }

function when(c: Campaign) {
  if (c.status === 'sent') return { label: 'Sent', at: c.sentAt }
  if (c.status === 'scheduled') return { label: 'Goes out', at: c.scheduledAt }
  if (c.status === 'sending') return { label: 'Sending since', at: c.updatedAt }
  return { label: 'Edited', at: c.updatedAt }
}

export default function Campaigns() {
  useDocumentTitle('Email campaigns', 'Admin')
  const nav = useNavigate()
  const appeals = useAppealOptions()
  const [s, set] = useUrlState({ status: '', q: '', page: '1', sort: '' })
  const q = useDebounced(s.q, 250)
  const list = useQuery({
    queryKey: ['admin', 'campaigns', { ...s, q }],
    queryFn: () => api.get<ListResponse>('/admin/campaigns', { status: s.status, q, page: s.page, sort: s.sort }),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (query.state.data?.items.some((c) => c.status === 'sending') ? 3000 : false),
  })
  const counts = list.data?.counts ?? {}
  const all = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)

  const columns: Column<Campaign>[] = [
    {
      key: 'name',
      header: 'Campaign',
      sort: 'name',
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text">{c.name}</p>
          <p className="truncate text-[12.5px] text-text-2">{c.subject || <span className="text-text-3">No subject yet</span>}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (c) => <StatusBadge kind="campaign" value={c.status} size="sm" />, width: 120 },
    { key: 'audience', header: 'Audience', hideBelow: 'xl', cell: (c) => <span className="line-clamp-2 text-[13px] text-text-2">{describeSegment(c.segment, appeals.data?.items)}</span> },
    {
      key: 'recipients',
      header: 'Recipients',
      align: 'right',
      width: 180,
      cell: (c) =>
        c.status === 'sending' ? (
          <div className="ml-auto w-36">
            <p className="nums text-[12.5px] text-text-2">
              {formatNumber(c.stats.sent + c.stats.failed)} of {formatNumber(c.stats.recipients)}
            </p>
            <Progress value={c.stats.sent + c.stats.failed} max={c.stats.recipients || 1} size="sm" tone="amber" className="mt-1" />
          </div>
        ) : c.status === 'sent' ? (
          <span className="nums">
            {formatNumber(c.stats.sent)}
            {c.stats.failed > 0 && <span className="ml-1 text-[12.5px] text-red">· {c.stats.failed} failed</span>}
          </span>
        ) : (
          <span className="text-text-3">—</span>
        ),
    },
    {
      key: 'date',
      header: 'When',
      sort: 'updatedAt',
      align: 'right',
      width: 150,
      cell: (c) => {
        const w = when(c)
        return (
          <span className="text-[13px] whitespace-nowrap text-text-2" title={formatDateTime(w.at)}>
            {c.status === 'scheduled' ? formatDateTime(w.at) : formatDay(w.at)}
          </span>
        )
      },
    },
  ]

  return (
    <>
      <PageHeader
        title="Email campaigns"
        description="Write once, send to a chosen group — monthly donors, one country, people who have lapsed. Emails go out in batches, and only to donors who said yes to email."
        actions={
          <ButtonLink to="/admin/campaigns/new" variant="primary" icon={<Plus />}>
            New campaign
          </ButtonLink>
        }
      />
      <Toolbar className="mb-4">
        <Segmented
          aria-label="Status"
          value={s.status}
          onChange={(v) => set({ status: v })}
          options={[
            { value: '', label: 'All', count: list.data ? all : undefined },
            { value: 'draft', label: 'Drafts', count: counts.draft ?? 0 },
            { value: 'scheduled', label: 'Scheduled', count: counts.scheduled ?? 0 },
            { value: 'sent', label: 'Sent', count: counts.sent ?? 0 },
          ]}
        />
        <SearchInput value={s.q} onChange={(v) => set({ q: v })} placeholder="Search campaigns" className="w-full sm:ml-auto sm:w-64" />
      </Toolbar>
      <Card className="overflow-hidden">
        <DataTable
          columns={columns}
          rows={list.data?.items}
          loading={list.isFetching && !list.data}
          rowKey={(c) => c.id}
          sort={s.sort}
          onSort={(v) => set({ sort: v })}
          onRowClick={(c) => nav(`/admin/campaigns/${c.id}`)}
          mobile={(c) => {
            const w = when(c)
            return (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 font-medium text-text">{c.name}</p>
                  <StatusBadge kind="campaign" value={c.status} size="sm" />
                </div>
                <p className="mt-0.5 truncate text-[13px] text-text-2">{c.subject || 'No subject yet'}</p>
                <p className="nums mt-1.5 text-[12.5px] text-text-3">
                  {w.label} {c.status === 'scheduled' ? formatDateTime(w.at) : formatDay(w.at)}
                  {c.status === 'sent' && ` · ${formatNumber(c.stats.sent)} sent`}
                  {c.status === 'sending' && ` · ${formatNumber(c.stats.sent)} of ${formatNumber(c.stats.recipients)}`}
                </p>
              </div>
            )
          }}
          empty={
            <EmptyState
              icon={<Send />}
              title={s.q || s.status ? 'No campaigns match' : 'No campaigns yet'}
              action={
                !s.q && !s.status ? (
                  <ButtonLink to="/admin/campaigns/new" variant="primary" icon={<Plus />}>
                    Write the first one
                  </ButtonLink>
                ) : undefined
              }
            >
              {s.q || s.status ? 'Try another word, or look in all campaigns.' : 'Pick who it goes to, write it, preview it on a phone, then send it or schedule it.'}
            </EmptyState>
          }
        />
        {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={(p) => set({ page: String(p) })} />}
      </Card>
    </>
  )
}
