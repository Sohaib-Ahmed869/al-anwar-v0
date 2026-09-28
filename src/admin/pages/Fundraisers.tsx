import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Check, CircleSlash, ExternalLink, Flag, HeartHandshake, MessageSquareText, Sparkles } from 'lucide-react'
import { FUNDRAISER_OCCASIONS, FUNDRAISER_STATUSES, type FundraiserStatus } from '../../../shared/domain'
import type { Fundraiser, Page } from '../../../shared/types'
import { api, ApiError, errorMessage } from '../../portal/api'
import { formatDate, formatDay, formatMoney, formatNumber, formatRelative } from '../../portal/format'
import {
  Avatar, Button, Callout, Card, EmptyState, Field, FormError, Money, PageHeader, Pagination, Progress, SearchInput, Sheet,
  Skeleton, StatusBadge, Tabs, Textarea, Toolbar, cn, toast, useConfirm, useDebounced, useDocumentTitle, useUrlState,
} from '../../portal/ui'

/* ---------------------------------------------------------------------------
   Supporter pages — the approval queue for donors' own fundraisers.

   Nothing a supporter writes is public until someone here has read it, so
   the list leads with what is waiting (oldest first — first come, first
   served) and each page opens in a sheet laid out the way the public would
   see it. The decision sits under the story: approve, ask for changes, or
   decline. The last two need a note, and the note is emailed to the
   supporter, so the screen says so before it is sent.
--------------------------------------------------------------------------- */

type ListResponse = Page<Fundraiser> & { counts: Partial<Record<FundraiserStatus, number>> }
type Detail = {
  fundraiser: Fundraiser
  owner: null | {
    id: string
    number: string
    firstName: string
    lastName: string
    email: string
    totalGiven: number
    giftCount: number
    lastGiftAt?: string
    createdAt: string
    pages: number
  }
  gifts: { id: string; number: string; donor: string; donorName: string; amount: number; date: string; anonymous: boolean; message?: string }[]
}

const TABS: { value: '' | FundraiserStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Waiting' },
  { value: 'live', label: 'Live' },
  { value: 'changes', label: 'Changes requested' },
  { value: 'rejected', label: 'Not approved' },
  { value: 'ended', label: 'Ended' },
]

export default function Fundraisers() {
  useDocumentTitle('Supporter pages', 'Admin')
  const [s, set] = useUrlState({ status: '', q: '', page: '1', open: '' })
  const q = useDebounced(s.q, 250)
  const list = useQuery({
    queryKey: ['admin', 'fundraisers', { status: s.status, q, page: s.page }],
    queryFn: () => api.get<ListResponse>('/admin/fundraisers', { status: s.status, q, page: s.page }),
    placeholderData: keepPreviousData,
  })
  const counts = list.data?.counts ?? {}
  const all = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)
  const pending = counts.pending ?? 0

  return (
    <>
      <PageHeader
        title="Supporter pages"
        description="Fundraising pages donors start for a wedding, a walk or a birthday. Each one waits here until someone has read it; only then does it go public."
      />

      {pending > 0 && s.status !== 'pending' && (
        <Callout
          tone="amber"
          icon={<Flag />}
          className="mb-5"
          title={pending === 1 ? 'One page is waiting for approval' : `${pending} pages are waiting for approval`}
          action={
            <Button size="sm" variant="secondary" onClick={() => set({ status: 'pending' })}>
              Show them
            </Button>
          }
        >
          The supporter is told by email as soon as you decide.
        </Callout>
      )}

      <Tabs
        value={s.status as '' | FundraiserStatus}
        onChange={(v) => set({ status: v })}
        tabs={TABS.map((t) => ({ ...t, count: t.value === '' ? (list.data ? all : undefined) : (counts[t.value] ?? 0) }))}
        className="mb-4"
      />
      <Toolbar className="mb-4">
        <SearchInput value={s.q} onChange={(v) => set({ q: v })} placeholder="Search by title, supporter or appeal" className="w-full sm:w-80" />
      </Toolbar>

      <Card className="overflow-hidden">
        {list.isLoading ? (
          <div className="divide-y divide-line-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex gap-4 p-5">
                <Skeleton className="size-20 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : !list.data?.items.length ? (
          <EmptyState
            icon={s.status === 'pending' || (!s.status && !s.q) ? <Check /> : <HeartHandshake />}
            title={s.status === 'pending' ? 'Nothing waiting for approval' : s.q ? 'No pages match' : 'No supporter pages here'}
          >
            {s.status === 'pending'
              ? 'Every supporter page has been read. New ones appear here the moment a supporter submits them.'
              : s.q
                ? 'Try the supporter’s name, or the appeal.'
                : 'When a donor starts a fundraiser from their account, it lands here for approval.'}
          </EmptyState>
        ) : (
          <ul className={cn('divide-y divide-line-2 transition-opacity', list.isPlaceholderData && 'opacity-60')}>
            {list.data.items.map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => set({ open: f.id })} className="flex w-full gap-4 p-4 text-left transition-colors hover:bg-paper-2/80 sm:p-5">
                  <Thumb f={f} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                      <p className="min-w-0 text-[15px] font-semibold text-text">{f.title}</p>
                      <StatusBadge kind="fundraiser" value={f.status} size="sm" />
                    </div>
                    <p className="mt-0.5 text-[13px] text-text-2">
                      {f.ownerName} · for {f.appealTitle} · {FUNDRAISER_OCCASIONS[f.occasion]}
                    </p>
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-text-2">{f.story}</p>
                    <p className="nums mt-2 text-[12.5px] text-text-3">
                      {f.status === 'pending' ? (
                        <span className="font-medium text-amber">Submitted {formatRelative(f.createdAt)}</span>
                      ) : (
                        <>
                          {formatMoney(f.raised)} of {formatMoney(f.target)} · {formatNumber(f.donorCount)} donors
                        </>
                      )}
                      {f.status === 'pending' && <> · target {formatMoney(f.target)}</>}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={(p) => set({ page: String(p) })} />}
      </Card>

      <FundraiserSheet id={s.open} onClose={() => set({ open: '' })} />
    </>
  )
}

function Thumb({ f }: { f: Fundraiser }) {
  return f.image ? (
    <img src={f.image} alt="" className="size-16 shrink-0 rounded-xl object-cover sm:size-20" loading="lazy" />
  ) : (
    <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-green-50 text-green sm:size-20">
      <Sparkles className="size-5" />
    </div>
  )
}

type Mode = null | 'changes' | 'rejected'

function FundraiserSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [mode, setMode] = useState<Mode>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<{ message: string; note?: string } | null>(null)
  const d = useQuery({ queryKey: ['admin', 'fundraiser', id], queryFn: () => api.get<Detail>(`/admin/fundraisers/${id}`), enabled: Boolean(id) })

  const done = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'fundraisers'] })
    qc.invalidateQueries({ queryKey: ['admin', 'fundraiser', id] })
    qc.invalidateQueries({ queryKey: ['admin', 'badges'] })
  }
  const review = useMutation({
    mutationFn: (decision: 'live' | 'changes' | 'rejected') => api.post<Fundraiser>(`/admin/fundraisers/${id}/review`, { decision, note: note.trim() || undefined }),
    onSuccess: (f) => {
      done()
      toast.success(
        f.status === 'live' ? `“${f.title}” is live, and ${f.ownerName} has been emailed` : f.status === 'changes' ? `${f.ownerName} has been asked for changes` : `${f.ownerName} has been told it was not approved`,
      )
      setMode(null)
      setNote('')
      onClose()
    },
    onError: (e) => setError({ message: errorMessage(e), note: e instanceof ApiError ? e.fields.note : undefined }),
  })
  const end = useMutation({
    mutationFn: () => api.post<Fundraiser>(`/admin/fundraisers/${id}/end`),
    onSuccess: () => {
      done()
      toast.success('Fundraiser ended. Its page and donations stay.')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const close = () => {
    setMode(null)
    setNote('')
    setError(null)
    onClose()
  }
  const f = d.data?.fundraiser
  const reviewable = f && f.status !== 'ended'

  const footer = !f ? undefined : mode ? (
    <>
      <Button variant="secondary" onClick={() => (setMode(null), setError(null))}>
        Back
      </Button>
      <Button variant={mode === 'rejected' ? 'danger' : 'primary'} loading={review.isPending} disabled={note.trim().length < 5} onClick={() => review.mutate(mode)}>
        {mode === 'rejected' ? 'Decline and email' : 'Send the request'}
      </Button>
    </>
  ) : reviewable ? (
    <>
      {f.status === 'live' ? (
        <Button
          variant="secondary"
          icon={<CalendarClock />}
          loading={end.isPending}
          onClick={async () => {
            if (await confirm({ title: 'End this fundraiser?', body: 'It stops taking donations. The page stays up with its total, and the donations stay in the appeal.', confirmLabel: 'End it' }))
              end.mutate()
          }}
        >
          End it
        </Button>
      ) : (
        <>
          {f.status !== 'rejected' && (
            <Button variant="ghost" icon={<CircleSlash />} onClick={() => setMode('rejected')}>
              Decline
            </Button>
          )}
          {f.status !== 'changes' && (
            <Button variant="secondary" icon={<MessageSquareText />} onClick={() => setMode('changes')}>
              Ask for changes
            </Button>
          )}
          <Button variant="primary" icon={<Check />} loading={review.isPending} onClick={() => review.mutate('live')}>
            Approve
          </Button>
        </>
      )}
    </>
  ) : undefined

  return (
    <Sheet
      open={Boolean(id)}
      onOpenChange={(v) => !v && close()}
      width={620}
      title={f ? f.title : 'Supporter page'}
      description={f ? `${f.ownerName}’s ${FUNDRAISER_OCCASIONS[f.occasion].toLowerCase()} page for ${f.appealTitle}` : undefined}
      headerExtra={f && <div className="mt-2.5"><StatusBadge kind="fundraiser" value={f.status} /></div>}
      footer={footer}
    >
      {d.isLoading || !d.data || !f ? (
        d.isError ? (
          <FormError message={errorMessage(d.error)} />
        ) : (
          <div className="space-y-4">
            <Skeleton className="aspect-[16/9] w-full rounded-xl" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        )
      ) : mode ? (
        <div className="space-y-4">
          <Callout tone={mode === 'rejected' ? 'red' : 'teal'} icon={<MessageSquareText />}>
            {mode === 'rejected'
              ? `The page will not go public. ${f.ownerName.split(' ')[0]} is emailed your note, so write it to them — kindly, and with the reason.`
              : `${f.ownerName.split(' ')[0]} is emailed your note and can edit the page from their account. It comes back here when they resubmit.`}
          </Callout>
          <Field label={mode === 'rejected' ? 'Why it cannot be published' : 'What to change'} error={error?.note} help="At least a sentence. They will read exactly this.">
            <Textarea
              rows={6}
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                mode === 'rejected'
                  ? 'e.g. We can only publish pages raising for one of our open appeals…'
                  : 'e.g. Could you add a line about who the walk is with, and take out the phone number?'
              }
            />
          </Field>
          {error && !error.note && <FormError message={error.message} />}
        </div>
      ) : (
        <PublicPreview d={d.data} />
      )}
    </Sheet>
  )
}

/** The page as a visitor would see it, then what the office needs to know. */
function PublicPreview({ d }: { d: Detail }) {
  const f = d.fundraiser
  const o = d.owner
  return (
    <div className="space-y-6">
      <article className="overflow-hidden rounded-2xl ring-1 ring-line">
        {f.image ? (
          <img src={f.image} alt="" className="aspect-[16/9] w-full object-cover" />
        ) : (
          <div className="grid aspect-[5/1] place-items-center bg-green-50 text-[13px] text-green">No photo — the appeal’s photo is used</div>
        )}
        <div className="p-5">
          <p className="text-[12px] font-medium tracking-wide text-green uppercase">{FUNDRAISER_OCCASIONS[f.occasion]} · for {f.appealTitle}</p>
          <h3 className="mt-1.5 text-[20px] leading-snug font-semibold tracking-[-0.01em] text-text">{f.title}</h3>
          <p className="mt-1 text-[13px] text-text-2">Started by {f.ownerName}{f.endsAt ? ` · ends ${formatDate(f.endsAt)}` : ''}</p>
          <div className="mt-4">
            <div className="flex items-baseline justify-between text-[13px]">
              <Money cents={f.raised} className="text-[17px] font-semibold" />
              <span className="nums text-text-2">raised of {formatMoney(f.target)}</span>
            </div>
            <Progress value={f.raised} max={f.target || 1} className="mt-2" label="Raised of target" />
          </div>
          <div className="mt-5 space-y-3 text-[14.5px] leading-relaxed whitespace-pre-line text-text">{f.story || <span className="text-text-3">No story written.</span>}</div>
        </div>
      </article>

      {f.review && (
        <div className="rounded-xl bg-paper-2 px-4 py-3 text-[13px]">
          <p className="font-medium text-text">
            {FUNDRAISER_STATUSES[f.status].label} by {f.review.by} · {formatDay(f.review.at)}
          </p>
          {f.review.note && <p className="mt-1 whitespace-pre-line text-text-2">“{f.review.note}”</p>}
        </div>
      )}

      {o && (
        <section>
          <h4 className="mb-2 text-[13px] font-semibold text-text">The supporter</h4>
          <Link to={`/admin/donors/${o.id}`} className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-line transition-colors hover:bg-paper-2">
            <Avatar name={`${o.firstName} ${o.lastName}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-text">
                {o.firstName} {o.lastName} <span className="font-normal text-text-3">· {o.number}</span>
              </p>
              <p className="truncate text-[12.5px] text-text-2">{o.email}</p>
            </div>
            <div className="shrink-0 text-right text-[12.5px] text-text-2">
              <Money cents={o.totalGiven} className="block text-[14px] font-medium text-text" />
              {formatNumber(o.giftCount)} donations · {o.pages} {o.pages === 1 ? 'page' : 'pages'}
            </div>
          </Link>
        </section>
      )}

      <section>
        <h4 className="mb-2 text-[13px] font-semibold text-text">Donations through this page</h4>
        {d.gifts.length === 0 ? (
          <p className="text-[13px] text-text-3">None yet{f.status === 'pending' ? ' — it is not public until approved' : ''}.</p>
        ) : (
          <ul className="divide-y divide-line-2">
            {d.gifts.map((g) => (
              <li key={g.id} className="flex items-start justify-between gap-3 py-2.5 text-[13px]">
                <div className="min-w-0">
                  <Link to={`/admin/donors/${g.donor}`} className="font-medium text-text hover:text-green">
                    {g.donorName}
                  </Link>
                  {g.anonymous && <span className="ml-1 text-text-3">(shown as anonymous)</span>}
                  {g.message && <p className="mt-0.5 text-text-2">“{g.message}”</p>}
                </div>
                <div className="shrink-0 text-right">
                  <Money cents={g.amount} className="font-medium" />
                  <p className="text-[12px] text-text-3">{formatDay(g.date)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {f.status === 'live' && (
        <a href={`/fundraisers/${f.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-green hover:underline">
          <ExternalLink className="size-3.5" /> Open the public page
        </a>
      )}
    </div>
  )
}
