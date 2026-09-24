import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, CircleSlash, FileText, Inbox, Mail, PartyPopper, Trash2, Undo2 } from 'lucide-react'
import { BANK_LINE_STATUSES, type BankLineStatus } from '../../../shared/domain'
import type { BankImport, BankLine } from '../../../shared/types'
import { ApiError, api } from '../../portal/api'
import { formatDateTime, formatMoney, plural } from '../../portal/format'
import {
  Badge, BulkBar, Button, ButtonLink, Callout, Card, Checkbox, EmptyState, Money, PageHeader, Skeleton, Tabs, cn, toast,
  useConfirm, useDocumentTitle, useMediaQuery, useUrlState,
} from '../../portal/ui'
import { BankDonorChip, BankStepper } from '../components/BankBits'
import { BankLineEditor } from '../components/BankLineEditor'
import { BANK_GRID, BankLineCard, BankLineRow, type LineActions } from '../components/BankLineItem'

/* ---------------------------------------------------------------------------
   Admin › Bank import › one statement. The "check" step: every line with the
   match we propose and why, sorted into tabs by what needs doing.

   The rule the whole screen is built around: only lines in Matched are
   saved. Needs a look and Unmatched stay exactly where they are until a
   person decides, and the confirm dialog says so in as many words before
   anything is written. After saving, the page shows what was saved, with
   links, and the statement stays here as the record of the import.

   Each change is sent at once and the server answers with the whole import,
   which replaces the cached copy — the counts on the tabs and the Save
   button are never out of step with the lines.
--------------------------------------------------------------------------- */

type TabKey = Exclude<BankLineStatus, never>
const TAB_ORDER: TabKey[] = ['matched', 'review', 'unmatched', 'ignored', 'duplicate', 'confirmed']

const EMPTY: Record<TabKey, { title: string; body: string }> = {
  matched: { title: 'Nothing matched yet', body: 'Accept lines in “Needs a look”, or choose donors for unmatched lines, and they will wait here to be saved.' },
  review: { title: 'Nothing needs a look', body: 'Every line we were unsure of has been checked.' },
  unmatched: { title: 'No unmatched lines', body: 'Every line has a donor, or has been ignored.' },
  ignored: { title: 'Nothing ignored', body: 'Bank interest, refunds and transfers between your own accounts go here, so they are never saved as gifts.' },
  duplicate: { title: 'No duplicates', body: 'Lines already brought in by an earlier statement show here, so nobody is receipted twice.' },
  confirmed: { title: 'Nothing saved yet', body: 'When you save the matched lines, the gifts they became are listed here.' },
}

type ConfirmResult = {
  saved: number
  total: number
  emailed: number
  completed: boolean
  gifts: { lineId: string; giftId: string; number: string; donorId: string; donorName: string; amount: number; receiptNumber?: string; emailed: boolean }[]
  import: BankImport
}

export default function BankImportReview() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const wide = useMediaQuery('(min-width: 1024px)')
  const [url, setUrl] = useUrlState({ tab: '' })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<BankLine | null>(null)
  const [busyLine, setBusyLine] = useState<string | null>(null)
  const [result, setResult] = useState<ConfirmResult | null>(null)
  const key = ['bank', 'import', id]

  const q = useQuery({ queryKey: key, queryFn: () => api.get<BankImport>(`/admin/bank/imports/${id}`) })
  const imp = q.data
  useDocumentTitle(imp ? `Check ${imp.filename}` : 'Bank import', 'Al-Anwaar Admin')

  const put = (next: BankImport) => {
    qc.setQueryData(key, next)
    qc.invalidateQueries({ queryKey: ['bank', 'imports'] })
  }

  const counts = imp?.counts ?? {}
  const readOnly = imp?.status === 'completed'
  const defaultTab: TabKey = readOnly ? 'confirmed' : (TAB_ORDER.find((t) => counts[t]) ?? 'matched')
  const tab = (TAB_ORDER as string[]).includes(url.tab) ? (url.tab as TabKey) : defaultTab
  const lines = useMemo(() => imp?.lines.filter((l) => l.status === tab) ?? [], [imp, tab])
  const matched = useMemo(() => imp?.lines.filter((l) => l.status === 'matched') ?? [], [imp])
  const toSave = matched.reduce((s, l) => s + l.amount, 0)
  const willEmail = matched.filter((l) => !l.match.noEmail).length

  /* ---------- changes ---------- */
  const patch = useMutation({
    mutationFn: ({ line, body }: { line: BankLine; body: Record<string, unknown>; message: string }) => {
      setBusyLine(line.id)
      return api.patch<BankImport>(`/admin/bank/imports/${id}/lines/${line.id}`, body)
    },
    onSuccess: (next, v) => {
      put(next)
      toast.success(v.message)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'That change could not be saved.'),
    onSettled: () => setBusyLine(null),
  })

  const bulk = useMutation({
    mutationFn: (status: 'matched' | 'ignored' | 'review') =>
      api.post<{ changed: number; skipped: number; import: BankImport }>(`/admin/bank/imports/${id}/lines/bulk`, { lineIds: [...selected], status }),
    onSuccess: (r, status) => {
      put(r.import)
      setSelected(new Set())
      const verb = status === 'matched' ? 'Accepted' : status === 'ignored' ? 'Ignored' : 'Moved back'
      toast.success(`${verb} ${plural(r.changed, 'line')}`, r.skipped ? { description: `${plural(r.skipped, 'line')} had no donor yet and stayed where ${r.skipped === 1 ? 'it was' : 'they were'}.` } : undefined)
    },
    onError: (e) => toast.error((e as Error).message),
  })

  const save = useMutation({
    mutationFn: () => api.post<ConfirmResult>(`/admin/bank/imports/${id}/confirm`, {}),
    onSuccess: (r) => {
      put(r.import)
      setResult(r)
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['admin'] })
      qc.invalidateQueries({ queryKey: ['gifts'] })
      qc.invalidateQueries({ queryKey: ['donors'] })
      toast.success(`Saved ${plural(r.saved, 'gift')} totalling ${formatMoney(r.total)}`, { description: `${plural(r.emailed, 'receipt')} emailed.` })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    onError: (e) => toast.error((e as Error).message),
  })

  const discard = useMutation({
    mutationFn: () => api.del(`/admin/bank/imports/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank'] })
      toast.success('Statement discarded. Nothing from it was saved.')
      nav('/admin/bank')
    },
    onError: (e) => toast.error((e as Error).message),
  })

  const actions: LineActions = {
    onEdit: setEditing,
    onAccept: (line) => patch.mutate({ line, body: { status: 'matched' }, message: `Accepted: ${line.match.donorName}, ${formatMoney(line.amount)}` }),
    onIgnore: (line) => patch.mutate({ line, body: { status: 'ignored' }, message: 'Ignored — this line will not be saved as a gift' }),
    onUndo: (line) => patch.mutate({ line, body: { status: 'review' }, message: line.status === 'ignored' ? 'Line brought back' : 'Moved to “Needs a look”' }),
    onPick: (line, donorId) => {
      const c = line.match.candidates?.find((x) => x.donor === donorId)
      patch.mutate({ line, body: { donorId }, message: `Matched to ${c?.donorName ?? 'the donor'} (${c?.number ?? ''})` })
    },
    onNotDuplicate: (line) => patch.mutate({ line, body: { status: 'review' }, message: 'Matched again — check it in its new tab' }),
  }

  async function onSave() {
    if (!matched.length) return
    const left = (counts.review ?? 0) + (counts.unmatched ?? 0)
    const ok = await confirm({
      title: `Save ${plural(matched.length, 'gift')}?`,
      body: (
        <div className="space-y-3">
          <p>
            Saves {plural(matched.length, 'gift')} totalling <strong className="nums font-semibold text-text">{formatMoney(toSave)}</strong> to donor records and emails{' '}
            {plural(willEmail, 'receipt')}.
            {matched.length - willEmail > 0 && ` ${plural(matched.length - willEmail, 'donor')} ${matched.length - willEmail === 1 ? 'has' : 'have'} no email address, so ${matched.length - willEmail === 1 ? 'that receipt is' : 'those receipts are'} kept on file instead.`}
          </p>
          <p>Lines in “Needs a look” and “Unmatched” are not saved{left ? ` — ${plural(left, 'line')} will stay here for you to finish later` : ''}.</p>
        </div>
      ),
      confirmLabel: `Save ${plural(matched.length, 'gift')}`,
    })
    if (ok) save.mutate()
  }

  async function onDiscard() {
    const ok = await confirm({
      title: 'Discard this statement?',
      body: 'The lines and every match you made are removed. No gifts have been saved from it, so no donor record changes. You can upload the file again at any time.',
      confirmLabel: 'Discard statement',
      tone: 'danger',
    })
    if (ok) discard.mutate()
  }

  /* ---------- loading and missing ---------- */
  if (q.isLoading) {
    return (
      <div aria-busy="true">
        <Skeleton className="mb-3 h-4 w-40" />
        <Skeleton className="mb-2 h-8 w-72" />
        <Skeleton className="mb-8 h-4 w-96 max-w-full" />
        <Skeleton className="mb-6 h-10 w-full" />
        <Card className="space-y-4 p-5">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 flex-1" />
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </Card>
      </div>
    )
  }
  if (!imp) {
    return (
      <Card>
        <EmptyState
          icon={<FileText />}
          title="That statement could not be found"
          action={<ButtonLink to="/admin/bank" variant="primary">Back to bank import</ButtonLink>}
        >
          It may have been discarded. Statements you have imported are listed on the bank import page.
        </EmptyState>
      </Card>
    )
  }

  const total = imp.lines.length
  const selectable = !readOnly && tab !== 'confirmed'
  const allOn = selectable && lines.length > 0 && lines.every((l) => selected.has(l.id))
  const toggle = (lid: string, v: boolean) =>
    setSelected((s) => {
      const n = new Set(s)
      if (v) n.add(lid)
      else n.delete(lid)
      return n
    })

  const summary = [
    plural(total, 'line'),
    formatMoney(imp.credits),
    counts.confirmed ? `${counts.confirmed} saved` : null,
    counts.matched ? `${counts.matched} matched` : null,
    counts.review ? `${counts.review} need${counts.review === 1 ? 's' : ''} a look` : null,
    counts.unmatched ? `${counts.unmatched} unmatched` : null,
  ].filter(Boolean)

  const step = readOnly ? 3 : counts.confirmed ? 3 : 2

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Bank import', to: '/admin/bank' }, { label: imp.filename }]}
        title={readOnly ? 'Statement saved' : 'Check the matches'}
        description={
          <>
            <span className="font-medium text-text">{imp.filename}</span> · uploaded by {imp.uploadedByName}, {formatDateTime(imp.createdAt)}
            {imp.layout ? ` · read as ${imp.layout}` : ''}
            {imp.debitsSkipped ? ` · ${plural(imp.debitsSkipped, 'money-out line')} left out` : ''}
          </>
        }
        actions={
          !readOnly && (
            <>
              {!counts.confirmed && (
                <Button variant="ghost" icon={<Trash2 />} onClick={onDiscard} loading={discard.isPending}>
                  Discard
                </Button>
              )}
              <Button variant="primary" icon={<CheckCircle2 />} className="hidden lg:inline-flex" disabled={!matched.length} loading={save.isPending} onClick={onSave}>
                {matched.length ? `Save ${plural(matched.length, 'gift')}` : 'Nothing to save yet'}
              </Button>
            </>
          )
        }
      />

      <Card className="mb-5 px-4 py-4 sm:px-6">
        <BankStepper current={step} done={readOnly} />
        <p className="nums mt-3.5 border-t border-line-2 pt-3.5 text-[13.5px] text-text-2">
          {summary.map((s, i) => (
            <span key={i}>
              {i > 0 && <span className="mx-1.5 text-text-3">·</span>}
              <span className={cn(i < 2 && 'font-medium text-text')}>{s}</span>
            </span>
          ))}
        </p>
      </Card>

      {result && <SavedPanel result={result} onClose={() => setResult(null)} />}

      {readOnly && !result && (
        <Callout className="mb-5" tone="teal" icon={<CheckCircle2 />} title="This statement is finished">
          Every line was saved, ignored or already imported{imp.completedAt ? ` (${formatDateTime(imp.completedAt)})` : ''}. It stays here as the record of this import and can no longer be changed.
        </Callout>
      )}

      {!readOnly && !result && (counts.review || counts.unmatched) && !counts.matched ? (
        <Callout className="mb-5" tone="amber" icon={<Inbox />} title="Check the lines we were unsure of">
          Accept a proposed donor or choose one yourself; accepted lines move to Matched, ready to save.
        </Callout>
      ) : null}

      <Tabs
        value={tab}
        onChange={(t) => {
          setUrl({ tab: t === defaultTab ? '' : t })
          setSelected(new Set())
        }}
        tabs={TAB_ORDER.filter((t) => t === 'matched' || t === 'review' || t === 'unmatched' || counts[t]).map((t) => ({
          value: t,
          label: BANK_LINE_STATUSES[t].label,
          count: counts[t] ?? 0,
        }))}
      />

      <Card className="mt-4 overflow-hidden">
        {selectable && lines.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-b border-line-2 bg-paper-2/50 px-4 py-2 sm:px-5">
            <Checkbox
              checked={allOn ? true : lines.some((l) => selected.has(l.id)) ? 'indeterminate' : false}
              onChange={() => setSelected(allOn ? new Set() : new Set(lines.map((l) => l.id)))}
              label={<span className="font-normal text-text-2">Select all {plural(lines.length, 'line')}</span>}
            />
            <span className="nums text-[13px] text-text-2">
              <Money cents={lines.reduce((s, l) => s + l.amount, 0)} className="font-medium text-text" /> in this tab
            </span>
          </div>
        )}

        {lines.length === 0 ? (
          <EmptyState compact icon={<CheckCircle2 />} title={EMPTY[tab].title}>
            {EMPTY[tab].body}
          </EmptyState>
        ) : wide ? (
          <>
            <div className={cn('grid gap-x-4 border-b border-line px-5 py-2.5 text-[12px] font-medium text-text-3', BANK_GRID)}>
              <span />
              <span>Date</span>
              <span>What the bank says</span>
              <span>Proposed match</span>
              <span>Sure?</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            <ul>
              {lines.map((l) => (
                <BankLineRow
                  key={l.id}
                  line={l}
                  actions={actions}
                  readOnly={readOnly}
                  busy={busyLine === l.id}
                  selected={selected.has(l.id)}
                  onSelect={selectable ? (v) => toggle(l.id, v) : undefined}
                />
              ))}
            </ul>
          </>
        ) : (
          <ul>
            {lines.map((l) => (
              <BankLineCard
                key={l.id}
                line={l}
                actions={actions}
                readOnly={readOnly}
                busy={busyLine === l.id}
                selected={selected.has(l.id)}
                onSelect={selectable ? (v) => toggle(l.id, v) : undefined}
              />
            ))}
          </ul>
        )}
      </Card>

      {!readOnly && (
        <p className="mt-4 text-center text-[12.5px] text-text-3">
          Only lines in Matched are saved. Nothing in “Needs a look” or “Unmatched” is ever saved without someone choosing it.
        </p>
      )}

      {/* ---------- phone: the save button stays in reach, above the tab bar.
           Portalled to <body>: the page sits inside an animated (transformed)
           wrapper, which would otherwise pin "fixed" to the wrapper. ---------- */}
      {!readOnly && selected.size === 0 && <div className="h-20 lg:hidden" aria-hidden />}
      {createPortal(
        <>
          {!readOnly && selected.size === 0 && (
            <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur-md lg:hidden">
              <div className="mx-auto flex max-w-md items-center gap-3">
                <div className="min-w-0 flex-1 text-[12.5px] leading-tight text-text-2">
                  <span className="nums block font-semibold text-text">{formatMoney(toSave)}</span>
                  {plural(matched.length, 'matched line')}
                </div>
                <Button variant="primary" icon={<CheckCircle2 />} disabled={!matched.length} loading={save.isPending} onClick={onSave}>
                  {matched.length ? `Save ${plural(matched.length, 'gift')}` : 'Nothing to save'}
                </Button>
              </div>
            </div>
          )}
          <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
            {tab !== 'matched' && (
              <Button size="sm" variant="primary" icon={<CheckCircle2 />} loading={bulk.isPending && bulk.variables === 'matched'} onClick={() => bulk.mutate('matched')}>
                Accept
              </Button>
            )}
            {tab === 'matched' && (
              <Button size="sm" variant="secondary" icon={<Undo2 />} loading={bulk.isPending && bulk.variables === 'review'} onClick={() => bulk.mutate('review')}>
                Back to review
              </Button>
            )}
            {tab !== 'ignored' ? (
              <Button size="sm" variant="secondary" icon={<CircleSlash />} loading={bulk.isPending && bulk.variables === 'ignored'} onClick={() => bulk.mutate('ignored')}>
                Ignore
              </Button>
            ) : (
              <Button size="sm" variant="secondary" icon={<Undo2 />} loading={bulk.isPending && bulk.variables === 'review'} onClick={() => bulk.mutate('review')}>
                Bring back
              </Button>
            )}
          </BulkBar>
        </>,
        document.body,
      )}

      <BankLineEditor
        importId={id}
        line={editing}
        onClose={() => setEditing(null)}
        onSaved={(next, message) => {
          put(next)
          setEditing(null)
          toast.success(message)
        }}
      />
    </>
  )
}

function SavedPanel({ result, onClose }: { result: ConfirmResult; onClose: () => void }) {
  const [all, setAll] = useState(false)
  const shown = all ? result.gifts : result.gifts.slice(0, 6)
  const left = (result.import.counts.review ?? 0) + (result.import.counts.unmatched ?? 0)
  return (
    <Card className="mb-5 overflow-hidden ring-green/25">
      <div className="flex flex-col gap-4 bg-gradient-to-br from-green-50 to-paper px-5 py-5 sm:flex-row sm:items-center sm:px-6">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-green text-white shadow-soft">
          <PartyPopper className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-text">
            Saved {plural(result.saved, 'gift')} totalling <span className="nums">{formatMoney(result.total)}</span>
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-text-2">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-4 text-green" /> {plural(result.emailed, 'receipt')} emailed
            </span>
            {left > 0 && <span>{plural(left, 'line')} still to check below</span>}
            {result.completed && <span>This statement is finished.</span>}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <ButtonLink to="/admin/bank" variant="secondary" size="sm" icon={<ArrowLeft />}>
            All statements
          </ButtonLink>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      {result.gifts.length > 0 && (
        <ul className="divide-y divide-line-2 border-t border-line-2">
          {shown.map((g) => (
            <li key={g.giftId} className="flex items-center gap-3 px-5 py-2.5 sm:px-6">
              <div className="min-w-0 flex-1">
                <BankDonorChip id={g.donorId} name={g.donorName} number={g.number} size="xs" />
              </div>
              <span className="hidden text-[12.5px] text-text-3 sm:block">{g.receiptNumber}</span>
              {g.emailed ? <Badge size="sm" tone="green">Receipt emailed</Badge> : <Badge size="sm">No email</Badge>}
              <Money cents={g.amount} className="w-20 text-right text-[13.5px] font-medium text-text" />
            </li>
          ))}
        </ul>
      )}
      {result.gifts.length > 6 && (
        <div className="border-t border-line-2 px-5 py-2.5 sm:px-6">
          <button type="button" className="text-[13px] font-medium text-green hover:underline" onClick={() => setAll(!all)}>
            {all ? 'Show fewer' : `Show all ${result.gifts.length}`}
          </button>
          <span className="mx-2 text-text-3">·</span>
          <Link to="/admin/gifts?method=bank" className="text-[13px] font-medium text-text-2 hover:text-text hover:underline">
            See bank gifts
          </Link>
        </div>
      )}
    </Card>
  )
}
