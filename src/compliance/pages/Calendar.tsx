import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek,
} from 'date-fns'
import {
  Bell, CalendarCheck2, CalendarDays, Check, ChevronLeft, ChevronRight, FileText, List, Paperclip, Pencil, Plus, RotateCcw, SearchX, Trash2,
} from 'lucide-react'
import { OBLIGATION_CATEGORIES, RECURRENCES, type ObligationCategory } from '../../../shared/domain'
import type { Page } from '../../../shared/types'
import { api } from '../../portal/api'
import { useCan, useStaff } from '../../portal/session'
import {
  Badge, Button, Callout, Card, ClearFilters, cn, DescriptionList, EmptyState, FilterChip, IconButton, PageHeader, Segmented, Sheet,
  Skeleton, toast, Toolbar, useConfirm, useDocumentTitle, useIsMobile, useUrlState,
} from '../../portal/ui'
import { formatDate, formatDateTime, toInputDate } from '../../portal/format'
import { DaysPill, Disclaimer, reminderLabel, STATE_META, StateBadge } from '../components/bits'
import { CompleteDialog, EvidencePicker, ObligationDialog, useInvalidateCalendar, useOwners } from '../components/ObligationForms'
import type { ObligationView } from '../components/types'
import { CATEGORY_DOT } from './Overview'

/* ---------------------------------------------------------------------------
   /compliance/calendar — the statutory calendar.

   Two views of the same list. The MONTH grid is for seeing the year's shape
   (a busy October, a quiet February); the AGENDA is for working through it,
   grouped the way a person thinks about deadlines: overdue, this month,
   later, done. Phones default to the agenda, and their month grid shrinks to
   coloured dots with the chosen day's items listed underneath — chips of
   text in a 50px cell help nobody.

   The whole calendar is one query (it is a few dozen items a year), so
   switching months and views is instant and never shows a spinner.
   ?item=<id> opens an item, ?new=1 the add dialog; both are linked from the
   overview, the command palette and the reminder emails.
--------------------------------------------------------------------------- */

const CHIP: Record<ObligationCategory, string> = {
  acnc: 'bg-teal-pale text-teal',
  ato: 'bg-violet-pale text-violet',
  fundraising: 'bg-amber-pale text-amber',
  governance: 'bg-green-pale text-green',
  insurance: 'bg-[#e9eef3] text-[#4b5d6e]',
  other: 'bg-ink/[.06] text-text-2',
}

export default function Calendar() {
  useDocumentTitle('Statutory calendar', 'Compliance')
  const mobile = useIsMobile()
  const canWrite = useCan('compliance.write')
  const { user } = useStaff()
  const [s, set] = useUrlState({ view: '', month: '', category: '', owner: '', status: '', item: '', new: '', date: '' })
  const view = (s.view || (mobile ? 'agenda' : 'month')) as 'month' | 'agenda'
  const month = s.month ? new Date(`${s.month}-01T00:00:00`) : startOfMonth(new Date())

  const list = useQuery({
    queryKey: ['compliance', 'obligations', { category: s.category, owner: s.owner }],
    queryFn: () => api.get<Page<ObligationView>>('/compliance/obligations', { category: s.category, owner: s.owner, pageSize: 1000 }),
    placeholderData: (p) => p,
  })
  const owners = useOwners()
  const all = list.data?.items
  const items = useMemo(() => (s.status ? all?.filter((o) => s.status.split(',').includes(o.state)) : all), [all, s.status])
  const filtered = Boolean(s.category || s.owner || s.status)

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Compliance', to: '/compliance' }, { label: 'Records' }]}
        title="Statutory calendar"
        description="Every deadline the charity must meet — lodgements, returns, reviews and renewals — with an owner, reminders and the proof it was done."
        actions={
          <>
            <Segmented
              aria-label="View"
              value={view}
              onChange={(v) => set({ view: v === (mobile ? 'agenda' : 'month') ? '' : v })}
              options={[
                { value: 'month', label: <><CalendarDays className="size-4" /> Month</> },
                { value: 'agenda', label: <><List className="size-4" /> Agenda</> },
              ]}
            />
            {canWrite && (
              <Button variant="primary" icon={<Plus />} onClick={() => set({ new: '1' })}>
                Add item
              </Button>
            )}
          </>
        }
      />

      <Toolbar className="mb-4">
        <FilterChip
          label="Category"
          options={Object.entries(OBLIGATION_CATEGORIES).map(([value, v]) => ({
            value,
            label: (
              <span className="flex items-center gap-2">
                <span className={cn('size-2 rounded-full', CATEGORY_DOT[value as ObligationCategory])} />
                {v.label}
              </span>
            ),
          }))}
          value={s.category ? s.category.split(',') : []}
          onChange={(v) => set({ category: v.join(',') })}
        />
        <FilterChip
          label="Owner"
          multiple={false}
          options={[
            ...(user ? [{ value: 'me', label: 'Mine' }] : []),
            ...(owners.data ?? []).filter((o) => o.id !== user?.id).map((o) => ({ value: o.id, label: o.name })),
            { value: 'none', label: 'Nobody yet' },
          ]}
          value={s.owner ? [s.owner] : []}
          onChange={(v) => set({ owner: v[0] ?? '' })}
        />
        <FilterChip
          label="Status"
          options={(['overdue', 'due-soon', 'upcoming', 'done'] as const).map((k) => ({ value: k, label: STATE_META[k].label }))}
          value={s.status ? s.status.split(',') : []}
          onChange={(v) => set({ status: v.join(',') })}
        />
        <ClearFilters show={filtered} onClear={() => set({ category: '', owner: '', status: '' })} />
      </Toolbar>

      {!items ? (
        <Card className="p-6">
          <Skeleton className="h-[480px] w-full" />
        </Card>
      ) : view === 'month' ? (
        <MonthView
          month={month}
          items={items}
          mobile={mobile}
          onMonth={(m) => set({ month: isSameMonth(m, new Date()) ? '' : format(m, 'yyyy-MM') })}
          onOpen={(id) => set({ item: id })}
          onAdd={canWrite ? (d) => set({ new: '1', date: d }) : undefined}
        />
      ) : (
        <Agenda items={items} filtered={filtered} onOpen={(id) => set({ item: id })} onClear={() => set({ category: '', owner: '', status: '' })} onAdd={canWrite ? () => set({ new: '1' }) : undefined} />
      )}

      <Disclaimer />

      <ObligationDialog open={s.new === '1'} defaultDate={s.date} onClose={() => set({ new: '', date: '' })} onSaved={(o) => set({ new: '', date: '', item: o.id })} />
      <ItemSheet id={s.item} onClose={() => set({ item: '' })} />
    </>
  )
}

/* ---------- month ---------- */
function MonthView({
  month,
  items,
  mobile,
  onMonth,
  onOpen,
  onAdd,
}: {
  month: Date
  items: ObligationView[]
  mobile: boolean
  onMonth: (d: Date) => void
  onOpen: (id: string) => void
  onAdd?: (day: string) => void
}) {
  const [picked, setPicked] = useState<Date | null>(null)
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) })
  const on = (d: Date) => items.filter((o) => isSameDay(new Date(o.dueDate), d))
  const inMonth = items.filter((o) => isSameMonth(new Date(o.dueDate), month))
  const pickedDay = picked && isSameMonth(picked, month) ? picked : null
  const listed = pickedDay ? on(pickedDay) : inMonth

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line-2 px-4 py-3 sm:px-5">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-text">{format(month, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-1">
          <IconButton label="Previous month" size="sm" onClick={() => onMonth(addMonths(month, -1))}>
            <ChevronLeft />
          </IconButton>
          <Button size="sm" variant="secondary" onClick={() => onMonth(new Date())} disabled={isSameMonth(month, new Date())}>
            Today
          </Button>
          <IconButton label="Next month" size="sm" onClick={() => onMonth(addMonths(month, 1))}>
            <ChevronRight />
          </IconButton>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-line-2 bg-paper-2/60">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="py-2 text-center text-[11.5px] font-medium tracking-wide text-text-3 uppercase">
            {mobile ? d[0] : d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const list = on(d)
          const inside = isSameMonth(d, month)
          const today = isToday(d)
          const sel = pickedDay && isSameDay(d, pickedDay)
          if (mobile)
            return (
              <button
                key={i}
                type="button"
                onClick={() => setPicked(sel ? null : d)}
                aria-label={`${format(d, 'd MMMM')}: ${list.length} item${list.length === 1 ? '' : 's'}`}
                className={cn('flex h-14 flex-col items-center gap-1 border-b border-line-2 pt-1.5', !inside && 'opacity-40', sel && 'bg-green-50')}
              >
                <span className={cn('nums grid size-7 place-items-center rounded-full text-[13px]', today ? 'bg-teal font-semibold text-white' : 'text-text')}>{format(d, 'd')}</span>
                <span className="flex gap-0.5">
                  {list.slice(0, 3).map((o) => (
                    <span key={o.id} className={cn('size-1.5 rounded-full', o.state === 'overdue' ? 'bg-red' : o.state === 'done' ? 'bg-text-3/50' : CATEGORY_DOT[o.category])} />
                  ))}
                </span>
              </button>
            )
          return (
            <div
              key={i}
              className={cn(
                'group relative min-h-[118px] border-b border-line-2 p-1.5 [&:not(:nth-child(7n))]:border-r',
                !inside && 'bg-paper-2/50',
              )}
            >
              <div className="flex items-center justify-between px-1 pt-0.5">
                <span
                  className={cn(
                    'nums grid size-7 place-items-center rounded-full text-[12.5px]',
                    today ? 'font-semibold text-teal ring-2 ring-teal' : inside ? 'text-text-2' : 'text-text-3/70',
                  )}
                >
                  {format(d, 'd')}
                </span>
                {onAdd && inside && (
                  <button
                    type="button"
                    onClick={() => onAdd(toInputDate(d))}
                    aria-label={`Add an item on ${format(d, 'd MMMM')}`}
                    className="grid size-6 place-items-center rounded-md text-text-3 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-ink/5 hover:text-text focus-visible:opacity-100"
                  >
                    <Plus className="size-3.5" />
                  </button>
                )}
              </div>
              <div className="mt-1 space-y-1">
                {list.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => onOpen(o.id)}
                    title={o.title}
                    className={cn(
                      'flex w-full items-center gap-1 truncate rounded-md px-1.5 py-1 text-left text-[12px] leading-tight font-medium transition-[filter] hover:brightness-95',
                      o.state === 'overdue' ? 'bg-red-pale text-red ring-1 ring-red/25 ring-inset' : o.state === 'done' ? 'bg-ink/[.04] text-text-3 line-through' : CHIP[o.category],
                    )}
                  >
                    {o.state === 'done' && <Check className="size-3 shrink-0 no-underline" />}
                    <span className="truncate">{o.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {mobile && (
        <div className="p-4">
          <p className="mb-2 text-[12.5px] font-medium text-text-3">{pickedDay ? format(pickedDay, 'EEEE d MMMM') : `All of ${format(month, 'MMMM')}`}</p>
          {listed.length ? (
            <ul className="divide-y divide-line-2 rounded-xl ring-1 ring-line-2">
              {listed.map((o) => (
                <AgendaRow key={o.id} o={o} onOpen={onOpen} />
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-text-2">Nothing due {pickedDay ? 'that day' : 'this month'}.</p>
          )}
        </div>
      )}
      {!mobile && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-5 py-3">
          {Object.entries(OBLIGATION_CATEGORIES).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5 text-[12px] text-text-2">
              <span className={cn('size-2 rounded-full', CATEGORY_DOT[k as ObligationCategory])} />
              {v.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-[12px] text-text-2">
            <span className="size-2 rounded-full bg-red" />
            Overdue
          </span>
        </div>
      )}
    </Card>
  )
}

/* ---------- agenda ---------- */
function AgendaRow({ o, onOpen }: { o: ObligationView; onOpen: (id: string) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onOpen(o.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-paper-2/70 sm:px-5">
        <div className="w-11 shrink-0 text-center">
          <div className="text-[11px] font-medium text-text-3 uppercase">{format(new Date(o.dueDate), 'MMM')}</div>
          <div className={cn('nums text-[19px] leading-tight font-semibold', o.state === 'overdue' ? 'text-red' : 'text-text')}>{format(new Date(o.dueDate), 'd')}</div>
        </div>
        <span className={cn('size-2.5 shrink-0 rounded-full', CATEGORY_DOT[o.category])} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className={cn('line-clamp-2 text-[14px] leading-snug font-medium sm:line-clamp-1', o.state === 'done' ? 'text-text-2' : 'text-text')}>{o.title}</span>
          <span className="block truncate text-[12.5px] text-text-3">
            {OBLIGATION_CATEGORIES[o.category].label}
            {o.ownerName ? ` · ${o.ownerName}` : ' · no owner'}
            {o.recurrence !== 'none' ? ` · ${RECURRENCES[o.recurrence].toLowerCase()}` : ''}
          </span>
        </span>
        {o.state === 'done' && o.evidence.length > 0 && (
          <span className="hidden items-center gap-1 text-[12px] text-text-3 sm:flex">
            <Paperclip className="size-3.5" />
            {o.evidence.length}
          </span>
        )}
        <DaysPill days={o.daysLeft} done={o.state === 'done'} />
      </button>
    </li>
  )
}

function Agenda({ items, filtered, onOpen, onClear, onAdd }: { items: ObligationView[]; filtered: boolean; onOpen: (id: string) => void; onClear: () => void; onAdd?: () => void }) {
  const [showDone, setShowDone] = useState(5)
  const now = new Date()
  const open = items.filter((o) => o.state !== 'done')
  const groups = [
    { key: 'overdue', label: 'Overdue', items: open.filter((o) => o.state === 'overdue'), tone: 'text-red' },
    { key: 'month', label: 'This month', items: open.filter((o) => o.state !== 'overdue' && isSameMonth(new Date(o.dueDate), now)), tone: 'text-text' },
    { key: 'later', label: 'Later', items: open.filter((o) => o.state !== 'overdue' && !isSameMonth(new Date(o.dueDate), now)), tone: 'text-text' },
    { key: 'done', label: 'Done', items: items.filter((o) => o.state === 'done').sort((a, b) => +new Date(b.completedAt ?? b.dueDate) - +new Date(a.completedAt ?? a.dueDate)), tone: 'text-text-2' },
  ].filter((g) => g.items.length)

  if (!items.length)
    return (
      <Card>
        {filtered ? (
          <EmptyState icon={<SearchX />} title="Nothing matches those filters" action={<Button variant="secondary" onClick={onClear}>Clear filters</Button>}>
            Try another category or owner.
          </EmptyState>
        ) : (
          <EmptyState icon={<CalendarCheck2 />} title="The calendar is empty" action={onAdd && <Button variant="primary" icon={<Plus />} onClick={onAdd}>Add the first item</Button>}>
            Start with the Annual Information Statement and your activity statements.
          </EmptyState>
        )}
      </Card>
    )

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.key}>
          <h2 className={cn('mb-2 flex items-center gap-2 px-1 text-[13px] font-semibold', g.tone)}>
            {g.label}
            <span className="nums rounded-full bg-ink/[.06] px-1.5 text-[11px] font-medium text-text-2">{g.items.length}</span>
          </h2>
          <Card className={cn('overflow-hidden', g.key === 'overdue' && 'ring-red/25')}>
            <ul className="divide-y divide-line-2">
              {(g.key === 'done' ? g.items.slice(0, showDone) : g.items).map((o) => (
                <AgendaRow key={o.id} o={o} onOpen={onOpen} />
              ))}
            </ul>
            {g.key === 'done' && g.items.length > showDone && (
              <button type="button" onClick={() => setShowDone((n) => n + 20)} className="w-full border-t border-line-2 py-3 text-[13px] font-medium text-green hover:bg-paper-2/70">
                Show {Math.min(20, g.items.length - showDone)} more
              </button>
            )}
          </Card>
        </section>
      ))}
    </div>
  )
}

/* ---------- one item ---------- */
function ItemSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const canWrite = useCan('compliance.write')
  const confirm = useConfirm()
  const invalidate = useInvalidateCalendar()
  const [dialog, setDialog] = useState<'' | 'edit' | 'done' | 'evidence'>('')
  const q = useQuery({
    queryKey: ['compliance', 'obligation', id],
    queryFn: () => api.get<ObligationView>(`/compliance/obligations/${id}`),
    enabled: Boolean(id),
  })
  const o = q.data
  const reopen = useMutation({
    mutationFn: () => api.post<ObligationView>(`/compliance/obligations/${id}/reopen`),
    onSuccess: (x) => {
      invalidate()
      toast.success(`Reopened ${x.title}`)
    },
  })
  const del = useMutation({
    mutationFn: () => api.del(`/compliance/obligations/${id}`),
    onSuccess: () => {
      invalidate()
      toast.success('Deleted from the calendar')
      onClose()
    },
    onError: (e) => toast.error((e as Error).message),
  })
  const detach = useMutation({
    mutationFn: (docId: string) => api.patch(`/compliance/obligations/${id}`, { evidence: o!.evidence.map((e) => e.document).filter((x) => x !== docId) }),
    onSuccess: () => invalidate(),
  })

  return (
    <>
      <Sheet
        open={Boolean(id)}
        onOpenChange={(v) => !v && onClose()}
        width={540}
        title={o?.title ?? ' '}
        description={o ? `${OBLIGATION_CATEGORIES[o.category].label} · ${RECURRENCES[o.recurrence]}` : undefined}
        headerExtra={o && <div className="mt-2.5 flex flex-wrap items-center gap-2"><StateBadge state={o.state} size="sm" /><DaysPill days={o.daysLeft} done={o.state === 'done'} /></div>}
        footer={
          o && canWrite ? (
            o.status === 'done' ? (
              <Button variant="secondary" icon={<RotateCcw />} loading={reopen.isPending} onClick={() => reopen.mutate()}>
                Reopen
              </Button>
            ) : (
              <>
                <IconButton
                  label="Delete"
                  variant="ghost"
                  className="mr-auto text-red hover:bg-red-pale hover:text-red"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete ${o.title}?`,
                      body: 'It comes off the calendar and its reminders stop. The deletion is recorded in the audit trail. If it was done, mark it done instead — that keeps the proof.',
                      confirmLabel: 'Delete',
                      tone: 'danger',
                      typeToConfirm: 'delete',
                    })
                    if (ok) del.mutate()
                  }}
                >
                  <Trash2 />
                </IconButton>
                <Button variant="secondary" icon={<Pencil />} onClick={() => setDialog('edit')}>
                  Edit
                </Button>
                <Button variant="primary" icon={<Check />} onClick={() => setDialog('done')}>
                  Mark as done
                </Button>
              </>
            )
          ) : undefined
        }
      >
        {!o ? (
          q.isError ? (
            <EmptyState compact icon={<SearchX />} title="This item could not be found">
              It may have been deleted.
            </EmptyState>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          )
        ) : (
          <div className="space-y-6">
            {o.state === 'done' && (
              <Callout tone="teal" icon={<CalendarCheck2 />} title={`Done ${formatDate(o.completedAt)}${o.completedByName ? ` by ${o.completedByName}` : ''}`}>
                {o.completionNote || 'No note was left.'}
              </Callout>
            )}
            {o.state === 'overdue' && (
              <Callout tone="red" icon={<Bell />} title={`${-o.daysLeft} day${o.daysLeft === -1 ? '' : 's'} overdue`}>
                {o.ownerName ? `${o.ownerName} has been emailed.` : 'Nobody owns this yet — give it an owner so someone is reminded.'}
              </Callout>
            )}
            {o.description && <p className="text-[14px] leading-relaxed whitespace-pre-line text-text-2">{o.description}</p>}
            <DescriptionList
              items={[
                { label: 'Due', value: formatDate(o.dueDate) },
                { label: 'Repeats', value: RECURRENCES[o.recurrence] },
                { label: 'Owner', value: o.ownerName ?? <span className="text-text-3">Nobody yet</span> },
                { label: 'Added', value: formatDate(o.createdAt) },
              ]}
            />
            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-text">Email reminders</h3>
              {o.reminderDays.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {[...o.reminderDays].sort((a, b) => b - a).map((d) => {
                    const sent = o.remindersSent?.includes(d)
                    return (
                      <Badge key={d} tone={sent ? 'teal' : 'neutral'} className="[&_svg]:size-3.5">
                        {sent ? <Check /> : <Bell />}
                        {reminderLabel(d)}
                      </Badge>
                    )
                  })}
                  {o.remindersSent?.includes(-1) && (
                    <Badge tone="red" className="[&_svg]:size-3.5">
                      <Check /> Overdue notice
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-[13.5px] text-text-2">No reminders set.</p>
              )}
              <p className="mt-2 text-[12.5px] text-text-3">
                {o.ownerName ? `Sent to ${o.ownerName}. Ticked ones have gone.` : 'Reminders go to the owner, and this has none.'}
              </p>
            </section>
            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-[13px] font-semibold text-text">Evidence</h3>
                {canWrite && (
                  <Button size="xs" variant="ghost" icon={<Paperclip />} onClick={() => setDialog('evidence')}>
                    Attach from library
                  </Button>
                )}
              </div>
              {o.evidence.length ? (
                <ul className="divide-y divide-line-2 rounded-xl ring-1 ring-line-2">
                  {o.evidence.map((e) => (
                    <li key={e.document} className="flex items-center gap-3 px-3 py-2.5">
                      <FileText className="size-4 shrink-0 text-teal" />
                      <Link to={`/compliance/documents/${e.document}`} className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-text hover:text-green hover:underline">
                        {e.title}
                      </Link>
                      {canWrite && (
                        <button type="button" onClick={() => detach.mutate(e.document)} className="text-[12px] text-text-3 hover:text-red">
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl bg-paper-2 px-4 py-3 text-[13px] text-text-2">
                  Nothing attached yet. Attach the lodgement receipt, the minutes or the signed return when it is done.
                </p>
              )}
            </section>
            {o.notes && (
              <section>
                <h3 className="mb-1.5 text-[13px] font-semibold text-text">Notes</h3>
                <p className="text-[13.5px] leading-relaxed whitespace-pre-line text-text-2">{o.notes}</p>
              </section>
            )}
            <p className="text-[12px] text-text-3">Last changed {formatDateTime((o as ObligationView & { updatedAt?: string }).updatedAt ?? o.createdAt)}</p>
          </div>
        )}
      </Sheet>
      {o && (
        <>
          <ObligationDialog open={dialog === 'edit'} item={o} onClose={() => setDialog('')} />
          <CompleteDialog open={dialog === 'done'} item={o} onClose={() => setDialog('')} />
          <EvidencePicker open={dialog === 'evidence'} item={o} onClose={() => setDialog('')} />
        </>
      )}
    </>
  )
}
