import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowUpRight, Link2, Mail, MessageSquareText, Phone, Send, StickyNote, Unlink, UserPlus, UserRoundCheck } from 'lucide-react'
import { ENQUIRY_STATUSES, type EnquiryStatus } from '../../../shared/domain'
import type { Enquiry, EnquiryNote } from '../../../shared/types'
import { api, ApiError, errorMessage } from '../../portal/api'
import { formatDateTime, formatMoney, formatRelative } from '../../portal/format'
import { useStaff } from '../../portal/session'
import { Avatar, Badge, Button, Callout, FormError, IconButton, Kbd, Segmented, Select, Skeleton, StatusBadge, Textarea, cn, toast, useConfirm } from '../../portal/ui'
import { DonorPicker, type PickedDonor } from './DonorPicker'
import { SheetSection, type DonorSummary } from './GiftBits'

/* ---------------------------------------------------------------------------
   One enquiry as a conversation: what they wrote, the details the form sent,
   everything said and done since (notes, emailed replies, status changes in
   one timeline), who has it, and whose donor record it belongs on.

   Used as the right-hand pane of the inbox on a wide screen and inside a
   Sheet on a phone, so it owns its own data (GET /api/admin/enquiries/:id)
   and pushes every change straight back into the list.

   The composer says which it is doing — emailing the person or writing to
   colleagues — in the button itself, because sending a private note to a
   member of the public is the mistake this screen must make hard.
--------------------------------------------------------------------------- */

export type EnquiryDetail = { enquiry: Enquiry; donor: DonorSummary | null; suggestion: DonorSummary | null }
type Assignee = { id: string; name: string; email: string; role: string }

const META_LABELS: Record<string, string> = {
  availability: 'Availability',
  skills: 'Skills',
  organisation: 'Organisation',
  role: 'Their role',
  event: 'Event',
  seats: 'Seats',
}
const metaLabel = (k: string) => META_LABELS[k] ?? k.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())

export function EnquiryThread({ id, className }: { id: string; className?: string }) {
  const qc = useQueryClient()
  const { user } = useStaff()
  const confirm = useConfirm()
  const key = ['admin', 'enquiries', 'detail', id]
  const q = useQuery({ queryKey: key, queryFn: () => api.get<EnquiryDetail>(`/admin/enquiries/${id}`) })
  const assignees = useQuery({
    queryKey: ['admin', 'enquiries', 'assignees'],
    queryFn: () => api.get<{ items: Assignee[] }>('/admin/enquiries/assignees'),
    staleTime: 5 * 60_000,
  })

  const [mode, setMode] = useState<'reply' | 'note'>('reply')
  const [body, setBody] = useState('')
  const [linking, setLinking] = useState(false)
  useEffect(() => {
    setBody('')
    setMode('reply')
    setLinking(false)
  }, [id])

  const apply = (d: EnquiryDetail) => {
    qc.setQueryData(key, d)
    qc.invalidateQueries({ queryKey: ['admin', 'enquiries', 'list'] })
    qc.invalidateQueries({ queryKey: ['admin', 'badges'] })
  }
  const patch = useMutation({
    mutationFn: (b: { status?: EnquiryStatus; assignedTo?: string | null }) => api.patch<EnquiryDetail>(`/admin/enquiries/${id}`, b),
    onSuccess: (d, b) => {
      apply(d)
      if (b.status) toast.success(`Marked ${ENQUIRY_STATUSES[b.status].label.toLowerCase()}`)
      else toast.success(b.assignedTo ? (b.assignedTo === user?.id ? 'It’s yours now' : `Given to ${d.enquiry.assignedName}`) : 'Unassigned')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const send = useMutation({
    mutationFn: () => api.post<EnquiryDetail>(`/admin/enquiries/${id}/${mode === 'reply' ? 'reply' : 'notes'}`, { body }),
    onSuccess: (d) => {
      apply(d)
      setBody('')
      toast.success(mode === 'reply' ? `Reply emailed to ${d.enquiry.email}` : 'Note added')
    },
  })
  const link = useMutation({
    mutationFn: (donorId: string | null) => api.post<EnquiryDetail>(`/admin/enquiries/${id}/link`, { donorId }),
    onSuccess: (d, donorId) => {
      apply(d)
      setLinking(false)
      toast.success(donorId ? `Now on ${d.donor?.name}’s record` : 'Taken off the donor record')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const create = useMutation({
    mutationFn: () => api.post<EnquiryDetail & { created: boolean }>(`/admin/enquiries/${id}/create-donor`),
    onSuccess: (d) => {
      apply(d)
      toast.success(d.created ? `Donor record ${d.donor?.number} created` : `Linked to ${d.donor?.name}, who already had a record`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (q.isError)
    return (
      <div className={cn('p-6', className)}>
        <Callout tone="red" icon={<AlertTriangle />}>
          {errorMessage(q.error)}
        </Callout>
      </div>
    )
  if (!q.data)
    return (
      <div className={cn('space-y-4 p-6', className)} aria-busy="true">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    )

  const { enquiry: e, donor, suggestion } = q.data
  const meta = Object.entries(e.meta ?? {}).filter(([, v]) => v)
  const mine = e.assignedTo === user?.id
  const err = send.error instanceof ApiError ? send.error : null
  const first = e.name.split(/\s+/)[0]

  return (
    <div className={cn('min-w-0', className)}>
      {/* who and what */}
      <div className="flex items-start gap-3">
        <Avatar name={e.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge kind="enquiryType" value={e.type} size="sm" />
            <StatusBadge kind="enquiry" value={e.status} size="sm" />
          </div>
          <h2 className="mt-1.5 text-[18px] leading-snug font-semibold tracking-[-0.01em] text-text">{e.subject || `Message from ${e.name}`}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-text-2">
            <span className="font-medium text-text">{e.name}</span>
            <a href={`mailto:${e.email}`} className="inline-flex items-center gap-1 hover:text-green hover:underline">
              <Mail className="size-3.5" />
              {e.email}
            </a>
            {e.phone && (
              <a href={`tel:${e.phone.replace(/\s/g, '')}`} className="nums inline-flex items-center gap-1 hover:text-green hover:underline">
                <Phone className="size-3.5" />
                {e.phone}
              </a>
            )}
          </p>
        </div>
      </div>

      {/* status and who has it */}
      <div className="mt-5 flex flex-col gap-2.5 rounded-xl bg-paper-2/70 p-3 ring-1 ring-line-2 ring-inset sm:flex-row sm:items-center sm:justify-between">
        <Segmented<EnquiryStatus>
          size="sm"
          aria-label="Status"
          value={e.status}
          onChange={(v) => v !== e.status && patch.mutate({ status: v })}
          options={(Object.keys(ENQUIRY_STATUSES) as EnquiryStatus[]).map((s) => ({ value: s, label: ENQUIRY_STATUSES[s].label }))}
        />
        <div className="flex items-center gap-2">
          {!mine && user && (
            <Button size="sm" variant="subtle" icon={<UserRoundCheck />} onClick={() => patch.mutate({ assignedTo: user.id })} disabled={patch.isPending}>
              Take it
            </Button>
          )}
          <label className="sr-only" htmlFor={`assignee-${e.id}`}>
            Assigned to
          </label>
          <div className="min-w-0 flex-1 sm:w-44 sm:flex-none">
            <Select
              id={`assignee-${e.id}`}
              value={e.assignedTo ?? ''}
              onChange={(ev) => patch.mutate({ assignedTo: ev.target.value || null })}
              className="h-8 text-[13px] pointer-coarse:h-10"
              disabled={patch.isPending}
            >
              <option value="">Nobody yet</option>
              {e.assignedTo && !assignees.data?.items.some((a) => a.id === e.assignedTo) && <option value={e.assignedTo}>{e.assignedName}</option>}
              {assignees.data?.items.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id === user?.id ? `${a.name} (me)` : a.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* what they wrote */}
      <SheetSection title={`Received ${formatRelative(e.createdAt)}`} className="mt-6">
        <div className="rounded-2xl rounded-tl-md bg-paper px-4 py-3.5 text-[14.5px] leading-relaxed whitespace-pre-line text-text ring-1 ring-line ring-inset">
          {e.message || <span className="text-text-3">No message — just the details below.</span>}
        </div>
        {meta.length > 0 && (
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {meta.map(([k, v]) => (
              <div key={k} className="rounded-xl bg-paper-2/70 px-3.5 py-2.5 ring-1 ring-line-2 ring-inset">
                <dt className="text-[12px] text-text-3">{metaLabel(k)}</dt>
                <dd className="mt-0.5 text-[13.5px] font-medium text-text [overflow-wrap:anywhere]">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-2 text-[12px] text-text-3">{formatDateTime(e.createdAt)}</p>
      </SheetSection>

      {/* donor record */}
      <SheetSection title="Donor record">
        {donor ? (
          <div className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-line-2 ring-inset">
            <Avatar name={donor.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text">{donor.name}</p>
              <p className="nums truncate text-[12.5px] text-text-3">
                {donor.number} · {donor.giftCount ? `${formatMoney(donor.totalGiven)} over ${donor.giftCount} ${donor.giftCount === 1 ? 'gift' : 'gifts'}` : 'No gifts yet'}
                {donor.hasActivePlan ? ' · gives regularly' : ''}
              </p>
            </div>
            <Link to={`/admin/donors/${donor.id}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-medium text-green hover:bg-green-50">
              Open <ArrowUpRight className="size-3.5" />
            </Link>
            <IconButton
              size="sm"
              label="Take off this donor’s record"
              onClick={async () => {
                if (await confirm({ title: `Take this off ${donor.name}’s record?`, body: 'The enquiry stays in the inbox; it just stops showing on their record.', confirmLabel: 'Unlink' }))
                  link.mutate(null)
              }}
            >
              <Unlink className="size-4" />
            </IconButton>
          </div>
        ) : linking ? (
          <div className="space-y-2">
            <DonorPicker value={null} onChange={(d: PickedDonor | null) => d && link.mutate(d.id)} placeholder="Find the donor by name, email or number" />
            <button type="button" onClick={() => setLinking(false)} className="text-[12.5px] text-text-2 hover:text-text">
              Cancel
            </button>
          </div>
        ) : (
          <div className="rounded-xl p-3 ring-1 ring-line-2 ring-inset">
            {suggestion ? (
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={suggestion.name} size="sm" />
                <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-text-2">
                  <span className="font-medium text-text">{suggestion.name}</span> ({suggestion.number}) has the same email address.
                </p>
                <Button size="sm" variant="primary" icon={<Link2 />} loading={link.isPending} onClick={() => link.mutate(suggestion.id)}>
                  Link
                </Button>
              </div>
            ) : (
              <p className="text-[13.5px] text-text-2">Not on a donor record. Nobody has this email address yet.</p>
            )}
            <div className="mt-2.5 flex flex-wrap gap-2 border-t border-line-2 pt-2.5">
              <Button size="sm" variant="ghost" icon={<Link2 />} onClick={() => setLinking(true)}>
                {suggestion ? 'Someone else' : 'Link to a donor'}
              </Button>
              {!suggestion && (
                <Button size="sm" variant="ghost" icon={<UserPlus />} loading={create.isPending} onClick={() => create.mutate()}>
                  Create a donor record
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetSection>

      {/* timeline */}
      <SheetSection title="Notes and replies">
        {e.notes.length ? (
          <ol className="space-y-3">
            {e.notes.map((n) => (
              <NoteItem key={n.id} n={n} />
            ))}
          </ol>
        ) : (
          <p className="text-[13px] text-text-3">Nothing yet. Reply to {first}, or leave a note for the team.</p>
        )}
      </SheetSection>

      {/* composer */}
      <div className="mt-6 rounded-2xl bg-paper ring-1 ring-line ring-inset focus-within:ring-2 focus-within:ring-green/60">
        <div className="flex items-center gap-1 border-b border-line-2 px-2 pt-2">
          {(
            [
              ['reply', 'Reply by email', MessageSquareText],
              ['note', 'Note for the team', StickyNote],
            ] as const
          ).map(([m, label, Icon]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                'relative -mb-px inline-flex h-9 items-center gap-1.5 rounded-t-lg px-3 text-[13px] font-medium transition-colors',
                mode === m ? 'text-text after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-green' : 'text-text-2 hover:text-text',
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
        <Textarea
          aria-label={mode === 'reply' ? `Reply to ${e.name}` : 'Note for the team'}
          value={body}
          onChange={(ev) => setBody(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey) && body.trim()) {
              ev.preventDefault()
              send.mutate()
            }
          }}
          rows={4}
          placeholder={mode === 'reply' ? `Assalamu alaykum ${first},\n\n` : 'Only staff see this.'}
          className={cn('rounded-none bg-transparent shadow-none ring-0 focus:ring-0', mode === 'note' && 'bg-amber-pale/30')}
        />
        <div className="flex flex-col gap-2 border-t border-line-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] leading-snug text-text-3">
            {mode === 'reply' ? (
              <>
                Emailed to <span className="text-text-2">{e.email}</span> and signed with your name. **bold**, *italic*, [link](https://…) and “- ” lists work.
              </>
            ) : (
              'Not sent to anyone outside the team.'
            )}{' '}
            <span className="hidden sm:inline">
              <Kbd>Ctrl</Kbd> <Kbd>Enter</Kbd> sends.
            </span>
          </p>
          <Button
            size="sm"
            variant={mode === 'reply' ? 'primary' : 'secondary'}
            icon={mode === 'reply' ? <Send /> : <StickyNote />}
            loading={send.isPending}
            disabled={!body.trim()}
            onClick={() => send.mutate()}
            className="shrink-0"
          >
            {mode === 'reply' ? `Email ${first}` : 'Add note'}
          </Button>
        </div>
      </div>
      <FormError message={err ? err.fields.body ?? err.message : send.error ? errorMessage(send.error) : null} />
    </div>
  )
}

function NoteItem({ n }: { n: EnquiryNote }) {
  if (n.kind === 'status')
    return (
      <li className="flex items-center gap-2 pl-1 text-[12.5px] text-text-3">
        <span className="size-1.5 rounded-full bg-text-3/60" aria-hidden />
        <span>
          <span className="text-text-2">{n.body}</span> · {n.by} · <span title={formatDateTime(n.at)}>{formatRelative(n.at)}</span>
        </span>
      </li>
    )
  const reply = n.kind === 'reply'
  return (
    <li className={cn('rounded-2xl px-4 py-3', reply ? 'rounded-tr-md bg-green-50 ring-1 ring-green/15' : 'bg-amber-pale/50 ring-1 ring-[#eadcbc]')}>
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
        <span className="font-medium text-text">{n.by}</span>
        <Badge size="sm" tone={reply ? 'green' : 'amber'}>
          {reply ? 'Emailed reply' : 'Internal note'}
        </Badge>
        <span className="text-text-3" title={formatDateTime(n.at)}>
          {formatRelative(n.at)}
        </span>
      </div>
      <p className="text-[13.5px] leading-relaxed whitespace-pre-line text-text">{n.body}</p>
    </li>
  )
}
