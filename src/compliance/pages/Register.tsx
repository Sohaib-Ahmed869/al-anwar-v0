import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, CalendarClock, Download, History, Pencil, Plus, SearchX } from 'lucide-react'
import { registerByKey, type RegisterDef, type RegisterField } from '../../../shared/registers'
import { api, ApiError, download, errorMessage } from '../../portal/api'
import { useCan } from '../../portal/session'
import {
  Badge, Button, Callout, Card, Checkbox, ClearFilters, DataTable, DescriptionList, Dialog, EmptyState, FilterChip, PageHeader,
  SearchInput, Sheet, Skeleton, Tabs, TabPanel, Toolbar, toast, useConfirm, useDebounced, useDocumentTitle, useUrlState, type Column,
} from '../../portal/ui'
import { formatDate } from '../../portal/format'
import { ActivityItem } from '../components/Activity'
import { Disclaimer, RiskChip } from '../components/bits'
import { RegisterForm } from '../components/RegisterForm'
import type { EntryDetail, EntryView, RegisterPage } from '../components/types'

/* ---------------------------------------------------------------------------
   /compliance/registers/:key — any of the five ACNC registers.

   Nothing on this page knows which register it is showing: the columns, the
   form, the filters and the export all come from the RegisterDef, so the
   five registers behave identically and a sixth would need no new screen.

   An entry opens in a Sheet over the list (?id=…) with its facts, an Edit
   mode and its History — every change, by whom, field by field, read from
   the action log. ?new=1 opens the add form, which is what the command
   palette's "Add a risk" links to.
--------------------------------------------------------------------------- */

type Values = Record<string, string | number | boolean | null>

export function formatValue(f: RegisterField | undefined, v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  if (!f) return String(v)
  if (f.type === 'select') return f.options?.[String(v)] ?? String(v)
  if (f.type === 'date') return formatDate(new Date(`${v}T00:00:00`))
  if (f.type === 'boolean') return v ? 'Yes' : 'No'
  if (f.type === 'money') return `$${(Number(v) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`
  return String(v)
}

export default function Register() {
  const { key = '' } = useParams()
  const def = registerByKey(key)
  if (!def) {
    return (
      <Card>
        <EmptyState icon={<SearchX />} title="There is no register by that name">
          Choose one of the registers from the menu.
        </EmptyState>
      </Card>
    )
  }
  return <RegisterScreen key={def.key} def={def} />
}

function RegisterScreen({ def }: { def: RegisterDef }) {
  useDocumentTitle(def.label, 'Compliance')
  const canWrite = useCan('compliance.write')
  const selects = def.fields.filter((f) => f.type === 'select' && ['status', 'kind', 'position', 'country', 'risk', 'category', 'likelihood', 'impact'].includes(f.key))
  const [s, set] = useUrlState({
    q: '',
    archived: '',
    reviewDue: '',
    sort: '',
    id: '',
    new: '',
    ...Object.fromEntries(selects.map((f) => [f.key, ''])),
  } as Record<string, string>)
  const dq = useDebounced(s.q)
  const filterParams = Object.fromEntries(selects.map((f) => [f.key, s[f.key]]))
  const params = { q: dq, archived: s.archived, reviewDue: s.reviewDue, sort: s.sort, ...filterParams }

  const list = useQuery({
    queryKey: ['compliance', 'register', def.key, params],
    queryFn: () => api.get<RegisterPage>(`/compliance/registers/${def.key}`, params),
    placeholderData: (p) => p,
  })

  const columns: Column<EntryView>[] = def.fields
    .filter((f) => f.column)
    .map((f, i) => ({
      key: f.key,
      header: f.label,
      sort: f.key,
      hideBelow: i > 3 ? ('xl' as const) : undefined,
      className: i === 0 ? 'min-w-[200px]' : 'whitespace-nowrap text-text-2',
      cell: (e: EntryView) =>
        i === 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className={e.archived ? 'text-text-3 line-through decoration-text-3/40' : 'font-medium text-text'}>{e.title}</span>
            {e.reviewDue && (
              <Badge tone="amber" size="sm" dot>
                Review due
              </Badge>
            )}
            {e.archived && <Badge size="sm">Archived</Badge>}
          </div>
        ) : (
          formatValue(f, e.fields[f.key]) || <span className="text-text-3">—</span>
        ),
    }))
  if (def.key === 'risks') columns.splice(1, 0, { key: 'score', header: 'Rating', cell: (e) => <RiskChip score={e.riskScore} /> })

  const summaryFields = def.fields.filter((f) => f.column).slice(1, 3)
  const mobile = (e: EntryView) => (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium text-text">{e.title}</p>
        <p className="mt-0.5 truncate text-[13px] text-text-2">
          {summaryFields
            .map((f) => formatValue(f, e.fields[f.key]))
            .filter(Boolean)
            .join(' · ') || '—'}
        </p>
        {(e.reviewDue || e.archived) && (
          <div className="mt-1.5 flex gap-1.5">
            {e.reviewDue && (
              <Badge tone="amber" size="sm" dot>
                Review due
              </Badge>
            )}
            {e.archived && <Badge size="sm">Archived</Badge>}
          </div>
        )}
      </div>
      {def.key === 'risks' && <RiskChip score={e.riskScore} />}
    </div>
  )

  const filtered = Boolean(s.q || s.reviewDue || selects.some((f) => s[f.key]))
  const dueCount = list.data?.items.filter((e) => e.reviewDue).length ?? 0
  const [exporting, setExporting] = useState(false)

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Compliance', to: '/compliance' }, { label: 'Registers' }]}
        title={def.label}
        description={def.blurb}
        meta={
          <>
            {def.standards.map((code) => (
              <Badge key={code} tone="teal" size="sm">
                {code}
              </Badge>
            ))}
            <span className="text-[12.5px] text-text-3">ACNC standards this register evidences</span>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Download />}
              loading={exporting}
              onClick={async () => {
                setExporting(true)
                try {
                  await download(`/compliance/registers/${def.key}/export`, { archived: s.archived }, `${def.key}.csv`)
                } catch (e) {
                  toast.error(errorMessage(e))
                } finally {
                  setExporting(false)
                }
              }}
            >
              Export CSV
            </Button>
            {canWrite && (
              <Button variant="primary" icon={<Plus />} onClick={() => set({ new: '1' })}>
                Add {def.singular}
              </Button>
            )}
          </>
        }
      />

      {dueCount > 0 && !s.reviewDue && (
        <Callout
          tone="amber"
          icon={<CalendarClock />}
          className="mb-4"
          title={`${dueCount} ${dueCount === 1 ? 'entry is' : 'entries are'} past the review date`}
          action={
            <Button size="sm" variant="secondary" onClick={() => set({ reviewDue: '1' })}>
              Show them
            </Button>
          }
        >
          Review each one, update the dates, and the flag clears.
        </Callout>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-line-2 px-4 py-3 sm:px-5">
          <Toolbar>
            <SearchInput value={s.q} onChange={(q) => set({ q })} placeholder={`Search ${def.label.toLowerCase()}`} className="w-full sm:w-64" />
            <div className="-mx-4 flex w-[calc(100%+32px)] gap-2 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0">
            {selects.filter((f) => !['likelihood', 'impact'].includes(f.key) || s[f.key]).map((f) => (
              <FilterChip
                key={f.key}
                label={f.label}
                options={Object.entries(f.options ?? {}).map(([value, label]) => ({ value, label }))}
                value={s[f.key] ? s[f.key]!.split(',') : []}
                onChange={(v) => set({ [f.key]: v.join(',') })}
              />
            ))}
            {def.reviewField && (
              <FilterChip
                label="Review"
                multiple={false}
                options={[{ value: '1', label: 'Review due' }]}
                value={s.reviewDue ? ['1'] : []}
                onChange={(v) => set({ reviewDue: v[0] ?? '' })}
              />
            )}
            </div>
            <ClearFilters show={filtered} onClear={() => set({ q: '', reviewDue: '', ...Object.fromEntries(selects.map((f) => [f.key, ''])) })} />
            <div className="ml-auto">
              <Checkbox
                checked={s.archived === '1'}
                onChange={(v) => set({ archived: v ? '1' : '' })}
                label={
                  <span className="text-[13px] font-normal text-text-2">
                    Show archived{list.data?.archived ? <span className="nums text-text-3"> ({list.data.archived})</span> : null}
                  </span>
                }
              />
            </div>
          </Toolbar>
        </div>
        <DataTable
          columns={columns}
          rows={list.data?.items}
          rowKey={(e) => e.id}
          loading={list.isFetching}
          onRowClick={(e) => set({ id: e.id })}
          sort={s.sort}
          onSort={(sort) => set({ sort })}
          mobile={mobile}
          rowClassName={(e) => (e.reviewDue ? 'bg-amber-pale/35 hover:!bg-amber-pale/60' : e.archived ? 'opacity-70' : undefined)}
          empty={
            filtered ? (
              <EmptyState compact icon={<SearchX />} title="Nothing matches those filters" action={<Button variant="secondary" onClick={() => set({ q: '', reviewDue: '', ...Object.fromEntries(selects.map((f) => [f.key, ''])) })}>Clear filters</Button>}>
                Try a different word, or clear the filters to see the whole register.
              </EmptyState>
            ) : (
              <EmptyState
                icon={<Plus />}
                title={`No ${def.label.toLowerCase()} recorded yet`}
                action={canWrite && <Button variant="primary" icon={<Plus />} onClick={() => set({ new: '1' })}>Add the first {def.singular}</Button>}
              >
                {def.blurb}
              </EmptyState>
            )
          }
          footer={
            list.data && list.data.items.length > 0 ? (
              <p className="nums border-t border-line-2 px-5 py-3 text-[12.5px] text-text-3">
                {list.data.total} {list.data.total === 1 ? def.singular : `${def.label.toLowerCase()} entries`}
                {dueCount ? ` · ${dueCount} due for review` : ''}
              </p>
            ) : null
          }
        />
      </Card>

      <Disclaimer />

      <NewEntryDialog def={def} open={s.new === '1'} onClose={() => set({ new: '' })} onCreated={(id) => set({ new: '', id })} />
      <EntrySheet def={def} id={s.id} onClose={() => set({ id: '' })} />
    </>
  )
}

function useInvalidate(def: RegisterDef) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['compliance', 'register', def.key] })
    qc.invalidateQueries({ queryKey: ['compliance', 'overview'] })
    qc.invalidateQueries({ queryKey: ['compliance', 'entry', def.key] })
  }
}

function NewEntryDialog({ def, open, onClose, onCreated }: { def: RegisterDef; open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const invalidate = useInvalidate(def)
  const create = useMutation({
    mutationFn: (fields: Values) => api.post<EntryView>(`/compliance/registers/${def.key}`, { fields }),
    onSuccess: (e) => {
      invalidate()
      toast.success(`Added ${e.title} to ${def.label.toLowerCase()}`)
      onCreated(e.id)
    },
  })
  const err = create.error instanceof ApiError ? create.error : null
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          onClose()
          create.reset()
        }
      }}
      size="lg"
      dismissible={false}
      title={`Add ${def.singular}`}
      description={def.blurb}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="new-entry" loading={create.isPending}>
            Add {def.singular}
          </Button>
        </>
      }
    >
      {open && <RegisterForm def={def} formId="new-entry" onSubmit={(f) => create.mutate(f)} errors={err?.fields} error={err && !Object.keys(err.fields).length ? err.message : null} />}
    </Dialog>
  )
}

function EntrySheet({ def, id, onClose }: { def: RegisterDef; id: string; onClose: () => void }) {
  const canWrite = useCan('compliance.write')
  const confirm = useConfirm()
  const invalidate = useInvalidate(def)
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [tab, setTab] = useState<'details' | 'history'>('details')
  const q = useQuery({
    queryKey: ['compliance', 'entry', def.key, id],
    queryFn: () => api.get<EntryDetail>(`/compliance/registers/${def.key}/${id}`),
    enabled: Boolean(id),
  })
  const e = q.data
  const save = useMutation({
    mutationFn: (fields: Values) => api.patch<EntryView>(`/compliance/registers/${def.key}/${id}`, { fields }),
    onSuccess: (x) => {
      invalidate()
      setMode('view')
      toast.success(`Saved ${x.title}`)
    },
  })
  const archive = useMutation({
    mutationFn: (verb: 'archive' | 'restore') => api.post<EntryView>(`/compliance/registers/${def.key}/${id}/${verb}`),
    onSuccess: (x, verb) => {
      invalidate()
      toast.success(verb === 'archive' ? `Archived ${x.title}` : `Restored ${x.title}`)
    },
  })
  const close = () => {
    onClose()
    setMode('view')
    setTab('details')
    save.reset()
  }
  const err = save.error instanceof ApiError ? save.error : null
  const reviewValue = def.reviewField ? e?.fields[def.reviewField] : null

  return (
    <Sheet
      open={Boolean(id)}
      onOpenChange={(v) => !v && close()}
      width={560}
      title={mode === 'edit' ? `Edit ${def.singular}` : (e?.title ?? ' ')}
      description={
        mode === 'edit' ? 'Changes are saved to the register and recorded in its history.' : e ? `${def.label} · updated ${formatDate(e.updatedAt)}${e.updatedByName ? ` by ${e.updatedByName}` : ''}` : undefined
      }
      footer={
        !e || !canWrite ? undefined : mode === 'edit' ? (
          <>
            <Button variant="secondary" onClick={() => (setMode('view'), save.reset())}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="edit-entry" loading={save.isPending}>
              Save changes
            </Button>
          </>
        ) : (
          <>
            {e.archived ? (
              <Button variant="secondary" icon={<ArchiveRestore />} loading={archive.isPending} onClick={() => archive.mutate('restore')}>
                Restore
              </Button>
            ) : (
              <Button
                variant="secondary"
                icon={<Archive />}
                loading={archive.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: `Archive ${e.title}?`,
                    body: 'It leaves the register and the reports but keeps its history, and you can restore it from "Show archived" at any time.',
                    confirmLabel: 'Archive',
                  })
                  if (ok) archive.mutate('archive')
                }}
              >
                Archive
              </Button>
            )}
            <Button variant="primary" icon={<Pencil />} onClick={() => (setMode('edit'), setTab('details'))}>
              Edit
            </Button>
          </>
        )
      }
    >
      {!e ? (
        q.isError ? (
          <EmptyState compact icon={<SearchX />} title="This entry could not be found">
            It may have been removed. Close this panel to go back to the register.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-40 w-full" />
          </div>
        )
      ) : mode === 'edit' ? (
        <RegisterForm
          def={def}
          initial={e.fields}
          formId="edit-entry"
          onSubmit={(f) => save.mutate(f)}
          errors={err?.fields}
          error={err && !Object.keys(err.fields).length ? err.message : null}
        />
      ) : (
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'details', label: 'Details' },
            { value: 'history', label: 'History', count: e.history.length },
          ]}
        >
          <TabPanel value="details" className="pt-5">
            <div className="space-y-4">
              {e.archived && (
                <Callout tone="neutral" icon={<Archive />}>
                  Archived — kept for the record, left out of the register and reports.
                </Callout>
              )}
              {e.reviewDue && (
                <Callout tone="amber" icon={<CalendarClock />} title="Review due">
                  The review date, {formatValue(def.fields.find((f) => f.key === def.reviewField), reviewValue)}, has passed.
                </Callout>
              )}
              {def.key === 'risks' && (
                <div className="flex items-center justify-between rounded-xl bg-paper-2 px-4 py-3">
                  <div>
                    <p className="text-[13px] text-text-2">Risk rating</p>
                    <p className="text-[12px] text-text-3">Likelihood × impact, out of 25</p>
                  </div>
                  <RiskChip score={e.riskScore} className="h-7 px-3 text-[13px]" />
                </div>
              )}
              <DescriptionList
                items={def.fields.map((f) => {
                  const v = e.fields[f.key]
                  const text = formatValue(f, v)
                  return {
                    label: f.label,
                    value: !text ? (
                      <span className="text-text-3">—</span>
                    ) : f.type === 'email' ? (
                      <a href={`mailto:${text}`} className="text-green hover:underline">
                        {text}
                      </a>
                    ) : f.type === 'textarea' ? (
                      <span className="block text-left whitespace-pre-line">{text}</span>
                    ) : (
                      text
                    ),
                  }
                })}
              />
            </div>
          </TabPanel>
          <TabPanel value="history" className="pt-5">
            {e.history.length ? (
              <ol className="space-y-5">
                {e.history.map((h) => (
                  <ActivityItem key={h.id} e={h} showLink={false} />
                ))}
              </ol>
            ) : (
              <EmptyState compact icon={<History />} title="No history yet">
                Changes to this entry will be listed here, with who made them and when.
              </EmptyState>
            )}
          </TabPanel>
        </Tabs>
      )}
    </Sheet>
  )
}
