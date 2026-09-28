import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Download, Repeat, Tag, UserPlus, Users } from 'lucide-react'
import { COUNTRIES, DESIGNATIONS, DESIGNATION_KEYS } from '../../../shared/domain'
import type { Donor, Page } from '../../../shared/types'
import { api, download, errorMessage } from '../../portal/api'
import { formatDay, formatNumber, plural } from '../../portal/format'
import { useStaff } from '../../portal/session'
import {
  Avatar, Badge, BulkBar, Button, Callout, Card, ClearFilters, DataTable, Dialog, EmptyState, Field, FilterChip, Input, Money,
  PageHeader, Pagination, SearchInput, Segmented, Toolbar, toast, useDebounced, useDocumentTitle, useUrlState, type Column,
} from '../../portal/ui'
import { DonorFormDialog } from '../components/DonorFormDialog'
import { donorName, isMajor, place, type DonorSegment, type SegmentCounts } from '../components/donorTypes'

/* ---------------------------------------------------------------------------
   Donors: everyone who has given, or is on file to. The segments across the
   top are the questions the office actually asks ("who gives monthly?",
   "who has gone quiet?"), each with its count under the current search and
   filters so the numbers never disagree with the list below them.

   Everything — search, segment, filters, sort, page — lives in the URL, so a
   filtered list can be bookmarked, refreshed, or pasted to a colleague.
   Export takes the same filter, so what you see is what you download.
--------------------------------------------------------------------------- */

const SEGMENTS: { value: DonorSegment; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'regular', label: 'Regular givers' },
  { value: 'major', label: 'Major donors' },
  { value: 'new', label: 'New' },
  { value: 'lapsed', label: 'Lapsed' },
  { value: 'never', label: 'Not given yet' },
]

const SEGMENT_HELP: Partial<Record<DonorSegment, string>> = {
  regular: 'Donors with a regular donation running, paused or waiting on a card fix.',
  major: 'Tagged “major donor”, or $5,000 or more given in total.',
  new: 'Their first donation was in the last 90 days.',
  lapsed: 'Gave before, but nothing in the last 12 months.',
  never: 'On file — from an enquiry, an event or a sign-up — but no donation yet.',
}

const split = (s: string) => (s ? s.split(',') : [])

export default function Donors() {
  useDocumentTitle('Donors', 'Al-Anwaar admin')
  const { can } = useStaff()
  const nav = useNavigate()
  const qc = useQueryClient()
  const [s, set] = useUrlState({ q: '', segment: 'all', designation: '', country: '', state: '', tag: '', sort: '-lastGiftAt', page: '1', new: '' })
  const [search, setSearch] = useState(s.q)
  const dq = useDebounced(search.trim(), 250)
  useEffect(() => {
    if (dq !== s.q) set({ q: dq })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq])

  const filters = { q: s.q, designation: s.designation, country: s.country, state: s.state, tag: s.tag }
  const page = Number(s.page) || 1
  const list = useQuery({
    queryKey: ['admin', 'donors', 'list', filters, s.segment, s.sort, page],
    queryFn: () =>
      api.get<Page<Donor>>('/admin/donors', { ...filters, segment: s.segment === 'all' ? undefined : s.segment, sort: s.sort, page, pageSize: 25 }),
    placeholderData: keepPreviousData,
  })
  const counts = useQuery({
    queryKey: ['admin', 'donors', 'counts', filters],
    queryFn: () => api.get<SegmentCounts>('/admin/donors/counts', filters),
    placeholderData: keepPreviousData,
  })
  const facets = useQuery({
    queryKey: ['admin', 'donors', 'facets'],
    queryFn: () => api.get<{ tags: string[]; states: string[] }>('/admin/donors/facets'),
    staleTime: 5 * 60_000,
  })
  const badges = useQuery({
    queryKey: ['admin', 'badges'],
    queryFn: () => api.get<Record<string, number>>('/admin/dashboard/badges'),
    enabled: can('donors.merge'),
  })
  const dupes = badges.data?.duplicates ?? 0

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tagOpen, setTagOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const anyFilter = Boolean(s.q || s.designation || s.country || s.state || s.tag || s.segment !== 'all')

  const exportCsv = async (ids?: string[]) => {
    setExporting(true)
    try {
      await download(
        '/admin/donors/export',
        ids ? { ids: ids.join(',') } : { ...filters, segment: s.segment === 'all' ? undefined : s.segment, sort: s.sort },
        'donors.csv',
      )
      toast.success(ids ? `Exported ${plural(ids.length, 'donor')}` : 'Your donor list is downloading')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  const columns: Column<Donor>[] = [
    {
      key: 'name',
      header: 'Donor',
      sort: 'lastName',
      cell: (d) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={donorName(d)} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-text">
              {donorName(d)}
              <span className="ml-2 text-[12px] font-normal text-text-3">{d.number}</span>
            </p>
            <p className="truncate text-[12.5px] text-text-3">{d.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'badges',
      header: '',
      cell: (d) => (
        <div className="flex flex-wrap gap-1">
          {d.hasActivePlan && (
            <Badge tone="green" size="sm">
              <Repeat className="size-3" /> Regular
            </Badge>
          )}
          {isMajor(d) && (
            <Badge tone="violet" size="sm">
              Major
            </Badge>
          )}
        </div>
      ),
      hideBelow: 'lg',
    },
    { key: 'total', header: 'Lifetime', sort: 'totalGiven', align: 'right', cell: (d) => <Money cents={d.totalGiven} className="font-medium text-text" /> },
    { key: 'count', header: 'Donations', sort: 'giftCount', align: 'right', cell: (d) => <span className="nums text-text-2">{formatNumber(d.giftCount)}</span>, hideBelow: 'lg' },
    {
      key: 'last',
      header: 'Last donation',
      sort: 'lastGiftAt',
      align: 'right',
      cell: (d) => <span className="nums text-text-2">{d.lastGiftAt ? formatDay(d.lastGiftAt) : <span className="text-text-3">Not yet</span>}</span>,
    },
    { key: 'place', header: 'Location', cell: (d) => <span className="text-text-2">{place(d) || <span className="text-text-3">—</span>}</span>, hideBelow: 'xl' },
  ]

  const tagOptions = (facets.data?.tags ?? []).map((t) => ({ value: t, label: t }))

  return (
    <>
      <PageHeader
        title="Donors"
        description="One record per person: every donation, regular donation, email and enquiry in one place."
        actions={
          <>
            {can('donors.export') && (
              <Button variant="secondary" icon={<Download />} loading={exporting && !selected.size} onClick={() => exportCsv()}>
                Export
              </Button>
            )}
            {can('donors.write') && (
              <Button variant="primary" icon={<UserPlus />} onClick={() => set({ new: '1' })}>
                Add donor
              </Button>
            )}
          </>
        }
      />

      {dupes > 0 && (
        <Callout
          tone="neutral"
          icon={<Copy />}
          className="mb-5"
          title={dupes === 1 ? 'One donor may be on file twice' : `${dupes} donors may be on file twice`}
          action={
            <Button variant="secondary" size="sm" onClick={() => nav('/admin/donors/duplicates')}>
              Compare and merge
            </Button>
          }
        >
          Merging keeps every donation, receipt and email — nothing is lost.
        </Callout>
      )}

      <Segmented
        aria-label="Which donors"
        value={s.segment as DonorSegment}
        onChange={(v) => set({ segment: v })}
        options={SEGMENTS.map((o) => ({ ...o, count: counts.data?.[o.value] }))}
        className="mb-3"
      />
      {SEGMENT_HELP[s.segment as DonorSegment] && <p className="mb-3 text-[13px] text-text-2">{SEGMENT_HELP[s.segment as DonorSegment]}</p>}

      <Toolbar className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Name, email, phone or donor number" className="w-full sm:w-80" />
        <FilterChip
          label="Gave as"
          options={DESIGNATION_KEYS.map((k) => ({ value: k, label: DESIGNATIONS[k].label }))}
          value={split(s.designation)}
          onChange={(v) => set({ designation: v.join(',') })}
        />
        <FilterChip
          label="Gave to"
          options={Object.entries(COUNTRIES).map(([k, v]) => ({ value: k, label: v }))}
          value={split(s.country)}
          onChange={(v) => set({ country: v.join(',') })}
        />
        <FilterChip
          label="State"
          options={(facets.data?.states ?? []).map((x) => ({ value: x, label: x }))}
          value={split(s.state)}
          onChange={(v) => set({ state: v.join(',') })}
        />
        {tagOptions.length > 0 && <FilterChip label="Tag" options={tagOptions} value={split(s.tag)} onChange={(v) => set({ tag: v.join(',') })} />}
        <ClearFilters
          show={anyFilter}
          onClear={() => {
            setSearch('')
            set({ q: '', segment: 'all', designation: '', country: '', state: '', tag: '' })
          }}
        />
      </Toolbar>

      <Card className="overflow-hidden">
        <DataTable
          columns={columns}
          rows={list.data?.items}
          rowKey={(d) => d.id}
          loading={list.isFetching}
          onRowClick={(d) => nav(`/admin/donors/${d.id}`)}
          sort={s.sort}
          onSort={(v) => set({ sort: v })}
          selectable={can('donors.write') || can('donors.export')}
          selected={selected}
          onSelectedChange={setSelected}
          mobile={(d) => (
            <div className="flex items-center gap-3">
              <Avatar name={donorName(d)} size="md" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[14.5px] font-medium text-text">
                  <span className="truncate">{donorName(d)}</span>
                  {d.hasActivePlan && <Repeat className="size-3.5 shrink-0 text-green" aria-label="Regular giver" />}
                </p>
                <p className="truncate text-[12.5px] text-text-3">{d.email}</p>
                <p className="mt-0.5 truncate text-[12.5px] text-text-3">
                  {d.giftCount ? `${plural(d.giftCount, 'donation')} · last ${formatDay(d.lastGiftAt)}` : 'No donations yet'}
                  {place(d) && ` · ${place(d)}`}
                </p>
              </div>
              <Money cents={d.totalGiven} className="shrink-0 text-[14px] font-semibold text-text" />
            </div>
          )}
          empty={
            anyFilter ? (
              <EmptyState
                icon={<Users />}
                title="No donors match"
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch('')
                      set({ q: '', segment: 'all', designation: '', country: '', state: '', tag: '' })
                    }}
                  >
                    Clear the filters
                  </Button>
                }
              >
                {s.q ? `Nobody matches “${s.q}” with these filters.` : 'Nobody fits all of these filters at once.'} Try fewer, or search by email or phone.
              </EmptyState>
            ) : (
              <EmptyState
                icon={<Users />}
                title="No donors yet"
                action={can('donors.write') ? <Button variant="primary" icon={<UserPlus />} onClick={() => set({ new: '1' })}>Add a donor</Button> : undefined}
              >
                Donors appear here with their first donation, or add someone by hand.
              </EmptyState>
            )
          }
        />
        {list.data && <Pagination page={page} pageSize={list.data.pageSize} total={list.data.total} onPage={(p) => set({ page: String(p) })} />}
      </Card>

      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        {can('donors.write') && (
          <Button size="sm" variant="secondary" icon={<Tag />} onClick={() => setTagOpen(true)}>
            Add tag
          </Button>
        )}
        {can('donors.export') && (
          <Button size="sm" variant="secondary" icon={<Download />} loading={exporting} onClick={() => exportCsv([...selected])}>
            Export
          </Button>
        )}
      </BulkBar>

      <BulkTagDialog
        open={tagOpen}
        onOpenChange={setTagOpen}
        ids={[...selected]}
        suggestions={facets.data?.tags ?? []}
        onDone={() => {
          setSelected(new Set())
          qc.invalidateQueries({ queryKey: ['admin', 'donors'] })
        }}
      />

      <DonorFormDialog
        open={s.new === '1'}
        onOpenChange={(v) => !v && set({ new: '' })}
        onSaved={(d) => nav(`/admin/donors/${d.id}`)}
      />
    </>
  )
}

function BulkTagDialog({
  open,
  onOpenChange,
  ids,
  suggestions,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  ids: string[]
  suggestions: string[]
  onDone: () => void
}) {
  const [tag, setTag] = useState('')
  const [err, setErr] = useState('')
  const m = useMutation({
    mutationFn: () => api.post<{ updated: number }>('/admin/donors/bulk/tag', { ids, tag }),
    onSuccess: (r) => {
      toast.success(`Tagged ${plural(r.updated, 'donor')} “${tag.trim().toLowerCase()}”`)
      setTag('')
      onOpenChange(false)
      onDone()
    },
    onError: (e) => setErr(errorMessage(e)),
  })
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={`Tag ${plural(ids.length, 'donor')}`}
      description="Tags group donors for campaigns and lists — “board”, “Lakemba masjid”, “volunteer”."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={m.isPending} disabled={!tag.trim()} onClick={() => m.mutate()}>
            Add tag
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (tag.trim()) m.mutate()
        }}
      >
        <Field label="Tag" error={err}>
          <Input value={tag} onChange={(e) => (setTag(e.target.value), setErr(''))} autoFocus maxLength={40} placeholder="e.g. volunteer" />
        </Field>
        {suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {suggestions.slice(0, 10).map((t) => (
              <button key={t} type="button" onClick={() => setTag(t)} className="h-7 rounded-full bg-ink/[.05] px-2.5 text-[12.5px] text-text-2 hover:bg-ink/[.08] hover:text-text">
                {t}
              </button>
            ))}
          </div>
        )}
      </form>
    </Dialog>
  )
}

