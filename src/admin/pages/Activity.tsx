import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { format, isToday, isYesterday } from 'date-fns'
import {
  Activity as ActivityIcon, Banknote, BookOpen, Building2, CalendarCheck, Download, FileText, HandCoins, Inbox, KeyRound,
  Megaphone, Repeat, Send, Settings, ShieldCheck, Users, type LucideIcon,
} from 'lucide-react'
import type { AuditEvent, Page } from '../../../shared/types'
import { api, download, errorMessage } from '../../portal/api'
import { formatNumber } from '../../portal/format'
import {
  Avatar, Button, Card, ClearFilters, DateRangePicker, EmptyState, FilterChip, PageHeader, Pagination, SearchInput, Select,
  SkeletonRows, Toolbar, Tooltip, cn, toast, useDebounced, useDocumentTitle, useUrlState,
} from '../../portal/ui'

/* ---------------------------------------------------------------------------
   The activity log — every change anyone made, with their name and the time,
   read-only. Grouped by day because that is how people look for something
   ("it was last Tuesday"); each entry carries an icon for its area so a
   screen of them can be scanned without reading.

   The filters (person, area, dates, words) are in the URL, and the CSV
   export takes exactly the same filters, so "export what I am looking at"
   is what it does.
--------------------------------------------------------------------------- */

type Actor = { id: string; name: string; count: number }

const AREAS: { key: string; label: string; icon: LucideIcon; match: string[] }[] = [
  { key: 'gift', label: 'Gifts', icon: HandCoins, match: ['gift', 'receipt'] },
  { key: 'donor', label: 'Donors', icon: Users, match: ['donor'] },
  { key: 'plan', label: 'Regular giving', icon: Repeat, match: ['plan'] },
  { key: 'appeal', label: 'Appeals', icon: Megaphone, match: ['appeal', 'fundraiser'] },
  { key: 'campaign', label: 'Email campaigns', icon: Send, match: ['campaign'] },
  { key: 'enquiry', label: 'Enquiries', icon: Inbox, match: ['enquiry'] },
  { key: 'bank', label: 'Bank imports', icon: Banknote, match: ['bank'] },
  { key: 'staff', label: 'Staff and sign-ins', icon: ShieldCheck, match: ['staff'] },
  { key: 'settings', label: 'Settings', icon: Settings, match: ['settings'] },
  { key: 'compliance', label: 'Compliance', icon: BookOpen, match: ['register', 'obligation', 'document'] },
  { key: 'report', label: 'Reports and exports', icon: FileText, match: ['report', 'export'] },
]

function iconFor(action: string): LucideIcon {
  const head = action.split('.')[0]!
  if (action.endsWith('.login') || action.endsWith('.logout') || action.endsWith('.password')) return KeyRound
  if (head === 'obligation') return CalendarCheck
  if (head === 'fundraiser') return Building2
  return AREAS.find((a) => a.match.includes(head))?.icon ?? ActivityIcon
}

const dayLabel = (d: Date) => (isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, d.getFullYear() === new Date().getFullYear() ? 'EEEE d MMMM' : 'EEEE d MMMM yyyy'))

export default function Activity() {
  useDocumentTitle('Activity log', 'Admin')
  const [s, set] = useUrlState({ q: '', actor: '', area: '', from: '', to: '', page: '1' })
  const q = useDebounced(s.q, 300)
  const areas = s.area ? s.area.split(',') : []
  const params = {
    q,
    actor: s.actor,
    area: areas.flatMap((a) => AREAS.find((x) => x.key === a)?.match ?? []).join(','),
    from: s.from,
    to: s.to,
  }
  const list = useQuery({
    queryKey: ['admin', 'activity', params, s.page],
    queryFn: () => api.get<Page<AuditEvent>>('/admin/activity', { ...params, page: s.page, pageSize: 50 }),
    placeholderData: keepPreviousData,
  })
  const actors = useQuery({ queryKey: ['admin', 'activity-actors'], queryFn: () => api.get<Actor[]>('/admin/activity/actors'), staleTime: 300_000 })
  const exp = useMutation({
    mutationFn: () => download('/admin/activity/export', params, 'activity.csv'),
    onSuccess: () => toast.success('The CSV is downloading'),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const filtered = Boolean(s.q || s.actor || s.area || s.from)

  const groups: { day: string; items: AuditEvent[] }[] = []
  for (const e of list.data?.items ?? []) {
    const d = dayLabel(new Date(e.at))
    const g = groups[groups.length - 1]
    if (g?.day === d) g.items.push(e)
    else groups.push({ day: d, items: [e] })
  }

  return (
    <>
      <PageHeader
        title="Activity log"
        description="Everything anyone has changed, with their name and the time. Nothing here can be edited or deleted."
        actions={
          <Button variant="secondary" icon={<Download />} loading={exp.isPending} onClick={() => exp.mutate()}>
            Export CSV
          </Button>
        }
      />
      <Toolbar className="mb-4">
        <SearchInput value={s.q} onChange={(v) => set({ q: v })} placeholder="Search names, donors, appeals…" className="w-full sm:w-72" />
        <div className="w-full sm:w-52">
          <Select value={s.actor} onChange={(e) => set({ actor: e.target.value })} aria-label="Who">
            <option value="">Everyone</option>
            <option value="system">The system (jobs, webhooks)</option>
            <option value="donor">Donors themselves</option>
            {actors.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <span className="sm:hidden">
          <FilterChip label="Area" options={AREAS.map((a) => ({ value: a.key, label: a.label }))} value={areas} onChange={(v) => set({ area: v.join(',') })} />
        </span>
        <DateRangePicker value={s.from && s.to ? { from: s.from, to: s.to } : null} onChange={(r) => set({ from: r?.from ?? '', to: r?.to ?? '' })} />
        <ClearFilters show={filtered} onClear={() => set({ q: '', actor: '', area: '', from: '', to: '' })} />
      </Toolbar>

      <div className="mb-4 hidden flex-wrap gap-1.5 sm:flex">
        {AREAS.map((a) => {
          const on = areas.includes(a.key)
          return (
            <button
              key={a.key}
              type="button"
              aria-pressed={on}
              onClick={() => set({ area: (on ? areas.filter((x) => x !== a.key) : [...areas, a.key]).join(',') })}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium ring-1 ring-inset transition-colors',
                on ? 'bg-green-50 text-green ring-green/25' : 'bg-paper text-text-2 ring-line hover:text-text',
              )}
            >
              <a.icon className="size-3.5" /> {a.label}
            </button>
          )
        })}
      </div>

      <Card className="overflow-clip">
        {list.isLoading ? (
          <SkeletonRows rows={8} className="p-5" />
        ) : !groups.length ? (
          <EmptyState icon={<ActivityIcon />} title={filtered ? 'Nothing matches' : 'Nothing has happened yet'}>
            {filtered ? 'Try a wider date range, another person, or fewer areas.' : 'Every change anyone makes will be listed here.'}
          </EmptyState>
        ) : (
          <div className={cn('transition-opacity', list.isPlaceholderData && 'opacity-60')}>
            {groups.map((g) => (
              <section key={g.day}>
                <h2 className="sticky top-14 z-[1] border-b border-line-2 bg-paper-2/95 px-5 py-2 text-[12.5px] font-semibold text-text-2 backdrop-blur lg:top-0">{g.day}</h2>
                <ol className="divide-y divide-line-2">
                  {g.items.map((e) => {
                    const Icon = iconFor(e.action)
                    return (
                      <li key={e.id} className="flex gap-3 px-5 py-3.5">
                        <div className="relative shrink-0">
                          <Avatar name={e.actor.kind === 'system' ? 'System' : e.actor.name} size="sm" className={e.actor.kind === 'system' ? 'bg-ink/[.06] text-text-2' : ''} />
                          <span className="absolute -right-1 -bottom-1 grid size-[18px] place-items-center rounded-full bg-paper text-text-2 ring-1 ring-line">
                            <Icon className="size-[11px]" />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] leading-snug text-text">
                            {e.summary.startsWith(e.actor.name) ? (
                              <span className="[overflow-wrap:anywhere]">
                                <span className="font-medium">{e.actor.name}</span>
                                {e.summary.slice(e.actor.name.length)}
                              </span>
                            ) : (
                              <>
                                <span className="font-medium">{e.actor.name}</span>
                                {e.actor.kind === 'donor' && <span className="text-text-3"> (donor)</span>} <span className="text-text-3">·</span>{' '}
                                <span className="[overflow-wrap:anywhere]">{e.summary}</span>
                              </>
                            )}
                          </p>
                          <p className="mt-0.5 flex flex-wrap gap-x-2 text-[12px] text-text-3">
                            <Tooltip content={format(new Date(e.at), 'd MMM yyyy, h:mm:ss aaa')}>
                              <time dateTime={e.at} className="nums">
                                {format(new Date(e.at), 'h:mm aaa')}
                              </time>
                            </Tooltip>
                            <code className="text-[11.5px]">{e.action}</code>
                            {e.ip && <span className="hidden sm:inline">from {e.ip.replace(/^::ffff:/, '')}</span>}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
        {list.data && (
          <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={(p) => set({ page: String(p) })} />
        )}
      </Card>
      {list.data && list.data.total > 0 && (
        <p className="nums mt-3 text-center text-[12.5px] text-text-3">{formatNumber(list.data.total)} entries match. The export includes all of them.</p>
      )}
    </>
  )
}
