import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, isToday, isYesterday } from 'date-fns'
import { Download, History, SearchX } from 'lucide-react'
import type { Page } from '../../../shared/types'
import { api, download, errorMessage } from '../../portal/api'
import {
  Button, Card, ClearFilters, DateRangePicker, EmptyState, FilterChip, PageHeader, Pagination, SearchInput, Skeleton, toast, Toolbar,
  useDebounced, useDocumentTitle, useUrlState,
} from '../../portal/ui'
import { formatNumber } from '../../portal/format'
import { ActivityItem } from '../components/Activity'
import { Disclaimer } from '../components/bits'
import type { EventView } from '../components/types'

/* ---------------------------------------------------------------------------
   /compliance/audit — the action log, for anyone with audit.read.

   Every change on the platform, by whom and when, newest first and grouped
   by day so a person can scan a week at a glance. The filters live in the URL
   (an auditor's question — "what did finance change in June?" — becomes a
   link), and Export CSV takes exactly what is on screen, filters and all.
   The export is itself logged.
--------------------------------------------------------------------------- */

type AuditPage = Page<EventView> & { actors: { id: string; name: string; count: number }[]; areas: string[] }

const AREA_LABELS: Record<string, string> = {
  register: 'Registers',
  obligation: 'Statutory calendar',
  document: 'Documents',
  audit: 'Audit trail',
  donor: 'Donors',
  gift: 'Gifts',
  plan: 'Regular gifts',
  appeal: 'Appeals',
  fundraiser: 'Fundraising pages',
  campaign: 'Email campaigns',
  enquiry: 'Enquiries',
  bank: 'Bank imports',
  staff: 'Staff',
  settings: 'Settings',
  auth: 'Sign-ins',
  receipt: 'Receipts',
  report: 'Reports',
}
const areaLabel = (a: string) => AREA_LABELS[a] ?? a.charAt(0).toUpperCase() + a.slice(1)

function dayLabel(d: Date) {
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, d.getFullYear() === new Date().getFullYear() ? 'EEEE d MMMM' : 'EEEE d MMMM yyyy')
}

export default function AuditTrail() {
  useDocumentTitle('Audit trail', 'Compliance')
  const [s, set] = useUrlState({ q: '', actor: '', area: '', from: '', to: '', page: '1' })
  const dq = useDebounced(s.q)
  const params = { q: dq, actor: s.actor, area: s.area, from: s.from, to: s.to }
  const list = useQuery({
    queryKey: ['compliance', 'audit', params, s.page],
    queryFn: () => api.get<AuditPage>('/compliance/audit', { ...params, page: s.page, pageSize: 50 }),
    placeholderData: (p) => p,
  })
  const [exporting, setExporting] = useState(false)
  const filtered = Boolean(s.q || s.actor || s.area || s.from)

  const groups: { day: string; items: EventView[] }[] = []
  for (const e of list.data?.items ?? []) {
    const day = dayLabel(new Date(e.at))
    const g = groups[groups.length - 1]
    if (g?.day === day) g.items.push(e)
    else groups.push({ day, items: [e] })
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Compliance', to: '/compliance' }, { label: 'Records' }]}
        title="Audit trail"
        description="Every change made on the platform, with the person's name and the time. Nothing here can be edited or deleted."
        actions={
          <Button
            variant="secondary"
            icon={<Download />}
            loading={exporting}
            onClick={async () => {
              setExporting(true)
              try {
                await download('/compliance/audit/export', params, 'audit-trail.csv')
                toast.success('Exported. The export has been recorded in the trail.')
              } catch (e) {
                toast.error(errorMessage(e))
              } finally {
                setExporting(false)
              }
            }}
          >
            Export CSV
          </Button>
        }
      />

      <Toolbar className="mb-4">
        <SearchInput value={s.q} onChange={(q) => set({ q })} placeholder="Search what happened" className="w-full sm:w-72" />
        <FilterChip
          label="Person"
          multiple={false}
          options={[
            ...(list.data?.actors ?? []).map((a) => ({ value: a.id, label: a.name })),
            { value: 'system', label: 'System (automatic)' },
            { value: 'donor', label: 'Donors' },
          ]}
          value={s.actor ? [s.actor] : []}
          onChange={(v) => set({ actor: v[0] ?? '' })}
        />
        <FilterChip
          label="Area"
          options={(list.data?.areas ?? ['register', 'obligation', 'document']).map((a) => ({ value: a, label: areaLabel(a) }))}
          value={s.area ? s.area.split(',') : []}
          onChange={(v) => set({ area: v.join(',') })}
        />
        <DateRangePicker value={s.from && s.to ? { from: s.from, to: s.to } : null} onChange={(r) => set({ from: r?.from ?? '', to: r?.to ?? '' })} />
        <ClearFilters show={filtered} onClear={() => set({ q: '', actor: '', area: '', from: '', to: '' })} />
        {list.data && (
          <span className="nums text-[12.5px] text-text-3 sm:ml-auto">
            {formatNumber(list.data.total)} {list.data.total === 1 ? 'event' : 'events'}
          </span>
        )}
      </Toolbar>

      <Card className="overflow-hidden">
        {!list.data ? (
          <div className="space-y-5 p-6">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : groups.length ? (
          <div className={list.isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
            {groups.map((g) => (
              <section key={g.day + g.items[0]!.id}>
                <h2 className="border-y border-line-2 bg-paper-2/80 px-5 py-2 text-[12.5px] font-semibold text-text-2 first:border-t-0 sm:px-6">
                  {g.day}
                </h2>
                <ol className="space-y-5 px-5 py-5 sm:px-6">
                  {g.items.map((e) => (
                    <ActivityItem key={e.id} e={e} aside={<span className="nums hidden shrink-0 pt-0.5 text-[12px] text-text-3 sm:block">{format(new Date(e.at), 'h:mm a')}</span>} />
                  ))}
                </ol>
              </section>
            ))}
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={(p) => set({ page: String(p) })} />
          </div>
        ) : filtered ? (
          <EmptyState icon={<SearchX />} title="Nothing matches those filters" action={<Button variant="secondary" onClick={() => set({ q: '', actor: '', area: '', from: '', to: '' })}>Clear filters</Button>}>
            Try a wider date range or another person.
          </EmptyState>
        ) : (
          <EmptyState icon={<History />} title="Nothing has happened yet">
            Changes appear here the moment they are made.
          </EmptyState>
        )}
      </Card>

      <Disclaimer />
    </>
  )
}
