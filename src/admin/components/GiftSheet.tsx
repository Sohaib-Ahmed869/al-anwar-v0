import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock, Mail, PencilLine, Receipt, Repeat, Undo2 } from 'lucide-react'
import { COUNTRIES, DESIGNATIONS, DESIGNATION_KEYS, FREQUENCIES, type Designation, type Frequency } from '../../../shared/domain'
import type { AuditEvent, Gift, Plan } from '../../../shared/types'
import { api, ApiError, errorMessage } from '../../portal/api'
import { formatDate, formatDateTime, formatMoney, toInputDate } from '../../portal/format'
import { useStaff } from '../../portal/session'
import {
  Avatar, Badge, Button, Callout, DescriptionList, Dialog, Field, FormError, Input, Money, Select, Sheet, Skeleton, StatusBadge,
  Textarea, toast, useConfirm,
} from '../../portal/ui'
import { AppealSelect } from './DonorPicker'
import { HistoryList, MethodLabel, SheetSection, type DonorSummary } from './GiftBits'

/* ---------------------------------------------------------------------------
   One gift, in a panel beside the list: every fact about it, its receipt,
   the donor it belongs to, and what has happened to it since.

   The actions follow the person's role, and each says what it will do before
   it does it: a refund RECORDS money going back (the money itself is returned
   in Stripe or the bank), marking a transfer received emails the receipt.
--------------------------------------------------------------------------- */

type Detail = {
  gift: Gift
  donor: DonorSummary | null
  plan: Pick<Plan, 'id' | 'number' | 'status' | 'amount' | 'frequency' | 'kind' | 'nextChargeAt' | 'payment'> | null
  events: AuditEvent[]
}

const SOURCE: Record<Gift['source'], string> = {
  online: 'Website',
  offline: 'Entered by staff',
  bank: 'Bank statement import',
  recurring: 'Regular donation',
}

export function GiftSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can } = useStaff()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [editing, setEditing] = useState(false)
  const [refunding, setRefunding] = useState(false)
  const [last, setLast] = useState<string | null>(id)
  useEffect(() => {
    if (id) setLast(id)
  }, [id])

  const key = ['admin', 'gifts', 'detail', last]
  const q = useQuery({ queryKey: key, queryFn: () => api.get<Detail>(`/admin/gifts/${last}`), enabled: Boolean(last) })
  const d = q.data
  const g = d?.gift

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'gifts'] })
    qc.invalidateQueries({ queryKey: ['admin', 'badges'] })
  }

  const resend = useMutation({
    mutationFn: () => api.post<{ to: string }>(`/admin/gifts/${last}/resend-receipt`),
    onSuccess: (r) => {
      toast.success(`Receipt emailed to ${r.to}`)
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const received = useMutation({
    mutationFn: () => api.post<{ receiptEmailed: boolean }>(`/admin/gifts/${last}/received`, {}),
    onSuccess: (r) => {
      toast.success(`Marked as received${r.receiptEmailed ? ', and the receipt is on its way' : ''}`)
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const canManage = can('gifts.manage')
  const canRead = can('gifts.read')
  const title = g ? (
    <span className="nums">
      {formatMoney(g.amount, { exact: g.amount % 100 !== 0 })} <span className="font-normal text-text-2">from</span> {g.donorName}
    </span>
  ) : (
    'Donation'
  )

  return (
    <>
      <Sheet
        open={Boolean(id)}
        onOpenChange={(v) => !v && onClose()}
        title={title}
        description={g ? `${g.number} · ${formatDate(g.date)}` : undefined}
        headerExtra={
          g && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <StatusBadge kind="gift" value={g.status} />
              <StatusBadge kind="designation" value={g.designation} />
              {g.anonymous && <Badge>Anonymous</Badge>}
              {g.simulated && <Badge tone="amber">Test payment</Badge>}
              {g.dispute && <Badge tone="red">Disputed</Badge>}
            </div>
          )
        }
        footer={
          g && canManage && (g.status === 'succeeded' || g.status === 'pending') ? (
            <div className="flex w-full flex-wrap justify-end gap-2">
              <Button variant="secondary" icon={<PencilLine />} onClick={() => setEditing(true)}>
                Correct
              </Button>
              {g.status === 'succeeded' && (
                <Button variant="secondary" icon={<Undo2 />} onClick={() => setRefunding(true)}>
                  Refund
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        {q.isLoading || !d || !g ? (
          q.isError ? (
            <Callout tone="red" icon={<AlertTriangle />}>
              {errorMessage(q.error)}
            </Callout>
          ) : (
            <div className="space-y-4" aria-busy="true">
              <Skeleton className="h-16 w-full rounded-xl" />
              {Array.from({ length: 7 }, (_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          )
        ) : (
          <div>
            {/* A card or PayPal checkout left pending was never paid, so it is
                not something that can be "received" — the server refuses it
                too (finding M9). It is closed by the provider or by the
                abandoned-checkout sweep instead. */}
            {g.status === 'pending' && g.method !== 'bank' && (
              <Callout tone="amber" icon={<Clock />} title="Waiting for the payment page" className="mb-6">
                The donor opened the {g.method === 'paypal' ? 'PayPal' : 'card'} payment page and has not finished paying. If they never do, this is
                marked as abandoned after two days.
              </Callout>
            )}
            {g.status === 'pending' && g.method === 'bank' && (
              <Callout
                tone="amber"
                icon={<Clock />}
                title="Waiting for the transfer"
                className="mb-6"
                action={
                  canManage ? (
                    <Button
                      size="sm"
                      variant="primary"
                      loading={received.isPending}
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Mark this transfer as received?',
                          body: `Use this when ${formatMoney(g.amount)} with reference ${g.reference ?? 'shown'} is in the bank but did not come through a statement import. The donation counts from today, and ${
                            d.donor?.hasEmail ? `a receipt is emailed to ${d.donor.email}` : 'a receipt number is issued'
                          }.`,
                          confirmLabel: 'Mark as received',
                        })
                        if (ok) received.mutate()
                      }}
                    >
                      Mark received
                    </Button>
                  ) : undefined
                }
              >
                The donor chose bank transfer and was shown reference <strong className="nums">{g.reference}</strong>. A statement import matches it automatically when it arrives.
              </Callout>
            )}
            {g.status === 'failed' && (
              <Callout tone="red" icon={<AlertTriangle />} title="This payment did not go through" className="mb-6">
                {g.failureReason ?? 'The card was declined.'}
              </Callout>
            )}
            {g.status === 'refunded' && (
              <Callout tone="neutral" icon={<Undo2 />} title="Refunded" className="mb-6">
                It no longer counts towards the donor’s or the appeal’s totals.
              </Callout>
            )}

            <SheetSection title="The donation">
              <DescriptionList
                items={[
                  { label: 'Amount', value: <Money cents={g.amount} exact /> },
                  { label: 'Operating costs contribution', value: <Money cents={g.fee} exact />, hidden: !g.fee },
                  { label: 'For', value: DESIGNATIONS[g.designation]?.label ?? g.designation },
                  {
                    label: 'Appeal',
                    value: g.appealTitle ? (
                      <>
                        {g.appealTitle}
                        {g.country && <span className="text-text-3"> · {COUNTRIES[g.country] ?? g.country}</span>}
                      </>
                    ) : (
                      'Where most needed'
                    ),
                  },
                  { label: 'Supporter page', value: g.fundraiserTitle, hidden: !g.fundraiserTitle },
                  { label: 'Method', value: <MethodLabel method={g.method} className="text-text" /> },
                  {
                    label: g.method === 'cheque' ? 'Cheque number' : g.method === 'event' ? 'Event' : 'Reference',
                    value: <span className="nums">{g.reference}</span>,
                    hidden: !g.reference,
                  },
                  { label: 'Date', value: formatDate(g.date) },
                  { label: 'Came in through', value: g.enteredByName ? `${SOURCE[g.source]} · ${g.enteredByName}` : SOURCE[g.source] },
                  { label: 'Recorded', value: formatDateTime(g.createdAt) },
                  { label: 'Public lists', value: g.anonymous ? 'Anonymous' : 'Name shown' },
                ]}
              />
              {g.message && (
                <blockquote className="mt-3 rounded-xl bg-paper-2 px-4 py-3 text-[13.5px] leading-relaxed text-text-2 italic">“{g.message}”</blockquote>
              )}
              {g.notes && (
                <div className="mt-3 rounded-xl bg-amber-pale/60 px-4 py-3 text-[13px] leading-relaxed whitespace-pre-line text-text">
                  <p className="mb-0.5 text-[12px] font-medium text-amber">Staff notes</p>
                  {g.notes}
                </div>
              )}
            </SheetSection>

            {d.donor && (
              <SheetSection title="Donor">
                <div className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-line-2 ring-inset">
                  <Avatar name={d.donor.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{d.donor.name}</p>
                    <p className="truncate text-[12.5px] text-text-3">
                      {d.donor.number} · {d.donor.hasEmail ? d.donor.email || d.donor.emailHint : 'No email on file'}
                    </p>
                    {canRead && (
                      <p className="nums mt-0.5 text-[12.5px] text-text-2">
                        {formatMoney(d.donor.totalGiven)} over {d.donor.giftCount} {d.donor.giftCount === 1 ? 'donation' : 'donations'}
                      </p>
                    )}
                  </div>
                  {can('donors.read') && (
                    <Link to={`/admin/donors/${d.donor.id}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-medium text-green hover:bg-green-50">
                      Open <ArrowUpRight className="size-3.5" />
                    </Link>
                  )}
                </div>
              </SheetSection>
            )}

            {d.plan && (
              <SheetSection title="Regular donation">
                <div className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-line-2 ring-inset">
                  <span className="grid size-9 place-items-center rounded-full bg-teal-pale text-teal">
                    <Repeat className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">
                      <Money cents={d.plan.amount} /> {FREQUENCIES[d.plan.frequency as Frequency]?.per}
                    </p>
                    <p className="text-[12.5px] text-text-3">
                      {d.plan.number}
                      {d.plan.payment?.last4 ? ` · ${d.plan.payment.brand ?? 'Card'} ending ${d.plan.payment.last4}` : ''}
                    </p>
                  </div>
                  <StatusBadge kind="plan" value={d.plan.status} size="sm" />
                  {can('plans.manage') && (
                    <Link to={`/admin/plans?id=${d.plan.id}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-medium text-green hover:bg-green-50">
                      Open <ArrowUpRight className="size-3.5" />
                    </Link>
                  )}
                </div>
              </SheetSection>
            )}

            {(g.status === 'succeeded' || g.status === 'refunded') && (
              <SheetSection title="Receipt">
                <div className="rounded-xl bg-paper-2/70 p-4 ring-1 ring-line-2 ring-inset">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-green-pale text-green">
                      <Receipt className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="nums text-sm font-semibold text-text">{g.receipt?.number ?? 'Not issued yet'}</p>
                      <p className="mt-0.5 text-[12.5px] leading-snug text-text-2">
                        {g.receipt?.issuedAt && <>Issued {formatDate(g.receipt.issuedAt)}. </>}
                        {g.receipt?.emailedAt ? (
                          <>
                            <CheckCircle2 className="-mt-0.5 mr-0.5 inline size-3.5 text-green" />
                            Emailed {formatDateTime(g.receipt.emailedAt)}
                            {g.receipt.resent ? ` · sent again ${g.receipt.resent} ${g.receipt.resent === 1 ? 'time' : 'times'}` : ''}
                          </>
                        ) : d.donor && !d.donor.hasEmail ? (
                          'Not emailed: there is no email address on the donor’s record.'
                        ) : (
                          'Not emailed yet.'
                        )}
                      </p>
                    </div>
                  </div>
                  {canRead && g.status === 'succeeded' && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-2 pt-3">
                      <Button size="sm" variant="secondary" icon={<Mail />} disabled={!d.donor?.hasEmail} loading={resend.isPending} onClick={() => resend.mutate()}>
                        {g.receipt?.emailedAt ? 'Resend receipt' : 'Email receipt'}
                      </Button>
                      <span className="text-[12.5px] text-text-3">
                        {d.donor?.hasEmail ? `To ${d.donor.email}` : 'Add an email to the donor’s record first.'}
                      </span>
                    </div>
                  )}
                </div>
              </SheetSection>
            )}

            <SheetSection title="History">
              <HistoryList events={d.events} />
            </SheetSection>
          </div>
        )}
      </Sheet>
      {g && <GiftCorrectDialog open={editing} onOpenChange={setEditing} gift={g} onDone={refresh} />}
      {g && <GiftRefundDialog open={refunding} onOpenChange={setRefunding} gift={g} donor={d?.donor ?? null} onDone={refresh} />}
    </>
  )
}

/* ---------- correct ---------- */
function GiftCorrectDialog({ open, onOpenChange, gift, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; gift: Gift; onDone: () => void }) {
  const [designation, setDesignation] = useState<Designation>(gift.designation)
  const [appealId, setAppealId] = useState(gift.appeal ?? '')
  const [date, setDate] = useState(toInputDate(gift.date))
  const [notes, setNotes] = useState(gift.notes ?? '')
  useEffect(() => {
    if (open) {
      setDesignation(gift.designation)
      setAppealId(gift.appeal ?? '')
      setDate(toInputDate(gift.date))
      setNotes(gift.notes ?? '')
    }
  }, [open, gift])
  const save = useMutation({
    mutationFn: () => api.patch<{ changed: boolean }>(`/admin/gifts/${gift.id}`, { designation, appealId: appealId || null, date, notes }),
    onSuccess: (r) => {
      toast.success(r.changed ? `${gift.number} corrected. The change is in its history.` : 'Nothing needed changing')
      onDone()
      onOpenChange(false)
    },
  })
  const err = save.error instanceof ApiError ? save.error : null
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Correct ${gift.number}`}
      description="For a donation put against the wrong appeal, designation or day. The amount and donor cannot change here: refund it and record it again."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
            Save correction
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <FormError message={err && !Object.keys(err.fields).length ? err.message : null} />
        <Field label="What it is for" error={err?.fields.designation}>
          <Select value={designation} onChange={(e) => setDesignation(e.target.value as Designation)}>
            {DESIGNATION_KEYS.map((k) => (
              <option key={k} value={k}>
                {DESIGNATIONS[k].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Appeal" error={err?.fields.appealId}>
          <AppealSelect value={appealId} onChange={(id) => setAppealId(id)} includeClosed />
        </Field>
        <Field label="Date received" error={err?.fields.date} help="The receipt keeps its number.">
          <Input type="date" value={date} max={toInputDate(new Date())} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Staff notes" optional>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  )
}

/* ---------- refund ---------- */
function GiftRefundDialog({
  open, onOpenChange, gift, donor, onDone,
}: { open: boolean; onOpenChange: (v: boolean) => void; gift: Gift; donor: DonorSummary | null; onDone: () => void }) {
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (open) setReason('')
  }, [open])
  const save = useMutation({
    mutationFn: () => api.post(`/admin/gifts/${gift.id}/refund`, { reason }),
    onSuccess: () => {
      toast.success(`${formatMoney(gift.amount)} from ${gift.donorName} recorded as refunded`)
      onDone()
      onOpenChange(false)
    },
  })
  const err = save.error instanceof ApiError ? save.error : null
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={`Refund ${formatMoney(gift.amount)}?`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Keep the donation
          </Button>
          <Button variant="danger" loading={save.isPending} disabled={reason.trim().length < 3} onClick={() => save.mutate()}>
            Record refund
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[14px] leading-relaxed text-text-2">
          This marks {gift.number} from {donor?.name ?? gift.donorName} as refunded and takes it off their total
          {gift.appealTitle ? ` and ${gift.appealTitle}’s` : ''}. Receipt {gift.receipt?.number} stays in the trail, marked refunded.
        </p>
        <Callout tone="amber" icon={<AlertTriangle />}>
          It does not move any money. Return it {gift.method === 'card' || gift.method === 'paypal' ? `in ${gift.method === 'paypal' ? 'PayPal' : 'Stripe'}` : 'from the bank'} first.
        </Callout>
        <Field label="Why" error={err?.fields.reason} help="Kept on the donation and in the action log.">
          <Textarea rows={3} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Donor gave twice by mistake" />
        </Field>
        <FormError message={err && !Object.keys(err.fields).length ? err.message : null} />
      </div>
    </Dialog>
  )
}
