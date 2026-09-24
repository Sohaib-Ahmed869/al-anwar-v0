import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FileText, Search } from 'lucide-react'
import { OBLIGATION_CATEGORIES, RECURRENCES, type ObligationCategory, type Recurrence } from '../../../shared/domain'
import type { Page } from '../../../shared/types'
import { api, ApiError } from '../../portal/api'
import { Button, cn, Dialog, EmptyState, Field, FormError, Input, SearchInput, Select, Skeleton, Textarea, toast, useDebounced } from '../../portal/ui'
import { formatDay, toInputDate } from '../../portal/format'
import { reminderLabel } from './bits'
import type { DocSummary, ObligationView, Owner } from './types'

/* ---------------------------------------------------------------------------
   The statutory calendar's dialogs: add or edit an item, mark one done, and
   the library picker used to attach evidence.

   Reminders are chosen from the handful of lead times people actually use
   rather than typed as numbers — the server takes any 0–365, but "30 days,
   7 days, 1 day before" is the language the calendar speaks.
--------------------------------------------------------------------------- */

const REMINDER_CHOICES = [90, 60, 30, 14, 7, 3, 1, 0]

export function useOwners() {
  return useQuery({ queryKey: ['compliance', 'owners'], queryFn: () => api.get<Owner[]>('/compliance/obligations/owners'), staleTime: 300_000 })
}

export function useInvalidateCalendar() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['compliance', 'obligations'] })
    qc.invalidateQueries({ queryKey: ['compliance', 'obligation'] })
    qc.invalidateQueries({ queryKey: ['compliance', 'overview'] })
    qc.invalidateQueries({ queryKey: ['compliance', 'badges'] })
  }
}

type Form = {
  title: string
  category: ObligationCategory
  dueDate: string
  recurrence: Recurrence
  owner: string
  reminderDays: number[]
  description: string
  notes: string
}

export function ObligationDialog({
  open,
  onClose,
  item,
  defaultDate,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  item?: ObligationView | null
  defaultDate?: string
  onSaved?: (o: ObligationView) => void
}) {
  const owners = useOwners()
  const invalidate = useInvalidateCalendar()
  const blank = (): Form => ({
    title: item?.title ?? '',
    category: item?.category ?? 'acnc',
    dueDate: item ? toInputDate(item.dueDate) : (defaultDate ?? ''),
    recurrence: item?.recurrence ?? 'annual',
    owner: item?.owner ?? '',
    reminderDays: item?.reminderDays ?? [30, 7, 1],
    description: item?.description ?? '',
    notes: item?.notes ?? '',
  })
  const [f, setF] = useState<Form>(blank)
  useEffect(() => {
    if (open) setF(blank())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      item ? api.patch<ObligationView>(`/compliance/obligations/${item.id}`, body) : api.post<ObligationView>('/compliance/obligations', body),
    onSuccess: (o) => {
      invalidate()
      toast.success(item ? `Saved ${o.title}` : `Added ${o.title} to the calendar`)
      onSaved?.(o)
      onClose()
    },
  })
  const err = save.error instanceof ApiError ? save.error : null
  const fe = err?.fields ?? {}
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate({ ...f, owner: f.owner || null, description: f.description || null, notes: f.notes || null })
  }
  const toggle = (d: number) =>
    setF((x) => ({ ...x, reminderDays: x.reminderDays.includes(d) ? x.reminderDays.filter((y) => y !== d) : [...x.reminderDays, d].sort((a, b) => b - a) }))

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          onClose()
          save.reset()
        }
      }}
      dismissible={false}
      size="lg"
      title={item ? 'Edit calendar item' : 'Add to the statutory calendar'}
      description={item ? undefined : 'A deadline the charity must meet, who owns it, and when to remind them.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="obligation-form" loading={save.isPending} disabled={!f.title.trim() || !f.dueDate}>
            {item ? 'Save changes' : 'Add to calendar'}
          </Button>
        </>
      }
    >
      <form id="obligation-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {err && !Object.keys(fe).length && (
          <div className="sm:col-span-2">
            <FormError message={err.message} />
          </div>
        )}
        <Field label="What is due" error={fe.title} className="sm:col-span-2">
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Annual Information Statement 2027" autoFocus />
        </Field>
        <Field label="Category" error={fe.category}>
          <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ObligationCategory })} className="read-only:bg-paper">
            {Object.entries(OBLIGATION_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date" error={fe.dueDate}>
          <Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
        </Field>
        <Field label="Repeats" error={fe.recurrence} help={f.recurrence !== 'none' ? 'Marking it done puts the next one on the calendar.' : undefined}>
          <Select value={f.recurrence} onChange={(e) => setF({ ...f, recurrence: e.target.value as Recurrence })} className="read-only:bg-paper">
            {Object.entries(RECURRENCES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Owner" error={fe.owner} help="They get the email reminders.">
          <Select value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} placeholder="Nobody yet" className="read-only:bg-paper">
            {owners.data?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Email reminders" error={fe.reminderDays} help={f.owner ? 'Plus one email if it becomes overdue.' : 'Choose an owner for reminders to be sent.'} className="sm:col-span-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Reminders">
            {REMINDER_CHOICES.map((d) => {
              const on = f.reminderDays.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(d)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12.5px] font-medium ring-1 transition-colors ring-inset pointer-coarse:h-10',
                    on ? 'bg-green-50 text-green ring-green/30' : 'bg-paper text-text-2 ring-line hover:text-text',
                  )}
                >
                  {on && <Check className="size-3.5" />}
                  {reminderLabel(d)}
                </button>
              )
            })}
          </div>
        </Field>
        <Field label="What it involves" optional error={fe.description} className="sm:col-span-2">
          <Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Where it is lodged, what the board needs to see, who to ask." />
        </Field>
        <Field label="Notes" optional error={fe.notes} className="sm:col-span-2">
          <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  )
}

export function CompleteDialog({ item, open, onClose }: { item: ObligationView; open: boolean; onClose: () => void }) {
  const invalidate = useInvalidateCalendar()
  const [note, setNote] = useState('')
  const [evidence, setEvidence] = useState<string[]>([])
  useEffect(() => {
    if (open) {
      setNote('')
      setEvidence(item.evidence.map((e) => e.document))
    }
  }, [open, item])
  const done = useMutation({
    mutationFn: () => api.post<ObligationView & { next: ObligationView | null }>(`/compliance/obligations/${item.id}/complete`, { note: note.trim() || undefined, evidence }),
    onSuccess: (o) => {
      invalidate()
      toast.success(o.next ? `Done. The next one is on the calendar for ${formatDay(o.next.dueDate)}.` : `Marked ${o.title} as done`)
      onClose()
    },
  })
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title={`Mark "${item.title}" as done`}
      description={
        item.recurrence !== 'none'
          ? `It repeats ${item.recurrence === 'annual' ? 'every year' : item.recurrence === 'quarterly' ? 'every quarter' : 'every month'}, so the next one goes on the calendar with the same owner and reminders.`
          : 'Reminders stop, and it stays on the calendar as done, with its evidence.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Check />} loading={done.isPending} onClick={() => done.mutate()}>
            Mark as done
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <FormError message={done.error ? (done.error as Error).message : null} />
        <Field label="Note" optional help="What was lodged or decided, and any reference number.">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Lodged on the ACNC portal, receipt 2026-118842." />
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-text">Evidence from the document library</p>
          <DocumentChooser selected={evidence} onChange={setEvidence} />
        </div>
      </div>
    </Dialog>
  )
}

/** Search the library and tick documents. Used inline and inside the picker dialog. */
export function DocumentChooser({ selected, onChange, height = 260 }: { selected: string[]; onChange: (ids: string[]) => void; height?: number }) {
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const docs = useQuery({
    queryKey: ['compliance', 'documents', 'picker', dq],
    queryFn: () => api.get<Page<DocSummary>>('/compliance/documents', { q: dq, sort: 'title' }),
    placeholderData: (p) => p,
  })
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-line">
      <div className="border-b border-line-2 p-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search the library" />
      </div>
      <ul className="overflow-y-auto" style={{ maxHeight: height }}>
        {!docs.data ? (
          <li className="space-y-2 p-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </li>
        ) : docs.data.items.length ? (
          docs.data.items.map((d) => {
            const on = selected.includes(d.id)
            return (
              <li key={d.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange(on ? selected.filter((x) => x !== d.id) : [...selected, d.id])}
                  className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-paper-2', on && 'bg-green-50/70')}
                >
                  <span className={cn('grid size-[18px] shrink-0 place-items-center rounded-[5px] ring-1 ring-inset', on ? 'bg-green text-white ring-green' : 'ring-[#c9c9c2]')}>
                    {on && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <FileText className="size-4 shrink-0 text-text-3" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-text">{d.title}</span>
                    <span className="block text-[12px] text-text-3">
                      v{d.latest?.n ?? 1} · updated {formatDay(d.updatedAt)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })
        ) : (
          <li>
            <EmptyState compact icon={<Search />} title="No documents match">
              Upload it to the library first, then attach it here.
            </EmptyState>
          </li>
        )}
      </ul>
    </div>
  )
}

export function EvidencePicker({ item, open, onClose }: { item: ObligationView; open: boolean; onClose: () => void }) {
  const invalidate = useInvalidateCalendar()
  const [sel, setSel] = useState<string[]>([])
  useEffect(() => {
    if (open) setSel(item.evidence.map((e) => e.document))
  }, [open, item])
  const save = useMutation({
    mutationFn: () => api.patch<ObligationView>(`/compliance/obligations/${item.id}`, { evidence: sel }),
    onSuccess: () => {
      invalidate()
      toast.success('Evidence saved')
      onClose()
    },
  })
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Attach evidence"
      description="Tick the documents that prove this was done — the lodgement receipt, the minutes, the signed return."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
            Save evidence{sel.length ? ` (${sel.length})` : ''}
          </Button>
        </>
      }
    >
      <FormError message={save.error ? (save.error as Error).message : null} />
      <DocumentChooser selected={sel} onChange={setSel} height={320} />
    </Dialog>
  )
}
