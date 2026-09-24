import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowUpRight, CalendarClock, CreditCard, Pause, PencilLine, Play, RotateCw, Send, XCircle } from 'lucide-react'
import { DESIGNATIONS, FREQUENCIES, FREQUENCY_KEYS, RETRY_SCHEDULE_DAYS, type Frequency } from '../../../shared/domain'
import type { AuditEvent, Gift, Plan } from '../../../shared/types'
import { api, ApiError, errorMessage } from '../../portal/api'
import { formatDate, formatMoney, parseMoney, toInputDate } from '../../portal/format'
import {
  Avatar, Button, Callout, DescriptionList, Dialog, Field, FormError, Input, Money, MoneyInput, Segmented, Sheet, Skeleton,
  StatusBadge, Textarea, cn, toast,
} from '../../portal/ui'
import { HistoryList, SheetSection, type DonorSummary } from './GiftBits'

/* ---------------------------------------------------------------------------
   One regular gift: what it is, every charge it has made (and every one that
   failed), and the things the office does for a donor who rings up — retry
   the card, send the fix link again, pause, change, cancel.

   Each action is logged as done on the donor's behalf. The copy on each
   button says whether the donor hears about it: only "Send fix link" emails
   them; the rest are quiet changes the caller has asked for.
--------------------------------------------------------------------------- */

type Detail = {
  plan: Plan
  gifts: Pick<Gift, 'id' | 'number' | 'amount' | 'fee' | 'status' | 'date' | 'failureReason' | 'receipt' | 'method'>[]
  events: AuditEvent[]
  donor: DonorSummary | null
}

export const planCard = (p: Pick<Plan, 'payment'>) =>
  p.payment?.method === 'paypal' ? 'PayPal' : p.payment?.last4 ? `${p.payment.brand ?? 'Card'} •• ${p.payment.last4}` : 'Card'

/** The plan actions both the list row and the sheet use. */
export function usePlanActions(planId: string | null) {
  const qc = useQueryClient()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'plans'] })
    qc.invalidateQueries({ queryKey: ['admin', 'badges'] })
    qc.invalidateQueries({ queryKey: ['admin', 'gifts'] })
  }
  const retry = useMutation({
    mutationFn: (id: string = planId!) => api.post<{ ok: boolean; error?: string; final?: boolean; plan: Plan }>(`/admin/plans/${id}/retry`),
    onSuccess: (r) => {
      if (r.ok) toast.success(`${formatMoney(r.plan.amount)} from ${r.plan.donorName} went through`, { description: 'The plan is active again and the receipt is on its way.' })
      else toast.error(`Declined again: ${r.error}`, { description: r.final ? 'That was the last automatic try. The donor needs to update their card.' : 'The donor has been emailed a link to update their card.' })
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remind = useMutation({
    mutationFn: (id: string = planId!) => api.post<{ to: string }>(`/admin/plans/${id}/remind`),
    onSuccess: (r) => toast.success(`Fix link emailed to ${r.to}`),
    onError: (e) => toast.error(errorMessage(e)),
  })
  return { retry, remind, refresh }
}

export function PlanSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [last, setLast] = useState<string | null>(id)
  useEffect(() => {
    if (id) setLast(id)
  }, [id])
  const q = useQuery({ queryKey: ['admin', 'plans', 'detail', last], queryFn: () => api.get<Detail>(`/admin/plans/${last}`), enabled: Boolean(last) })
  const { retry, remind, refresh } = usePlanActions(last)
  const [dialog, setDialog] = useState<null | 'change' | 'pause' | 'cancel'>(null)
  const resume = useMutation({
    mutationFn: () => api.post<{ plan: Plan }>(`/admin/plans/${last}/resume`),
    onSuccess: (r) => {
      toast.success(`Resumed. Next payment ${formatDate(r.plan.nextChargeAt)}`)
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const d = q.data
  const p = d?.plan
  const live = p && !['cancelled', 'completed'].includes(p.status)
  const freq = p ? FREQUENCIES[p.frequency as Frequency] : null

  return (
    <>
      <Sheet
        open={Boolean(id)}
        onOpenChange={(v) => !v && onClose()}
        width={560}
        title={
          p ? (
            <span className="nums">
              {formatMoney(p.amount)} {freq?.per} <span className="font-normal text-text-2">from</span> {p.donorName}
            </span>
          ) : (
            'Regular gift'
          )
        }
        description={p ? `${p.number} · since ${formatDate(p.startDate)}` : undefined}
        headerExtra={
          p && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <StatusBadge kind="plan" value={p.status} />
              <StatusBadge kind="designation" value={p.designation} />
            </div>
          )
        }
        footer={
          p && live ? (
            <div className="flex w-full flex-wrap justify-end gap-2">
              <Button variant="ghost" icon={<XCircle />} onClick={() => setDialog('cancel')} className="mr-auto text-red hover:bg-red-pale hover:text-red">
                Cancel gift
              </Button>
              {p.status === 'paused' ? (
                <Button variant="secondary" icon={<Play />} loading={resume.isPending} onClick={() => resume.mutate()}>
                  Resume
                </Button>
              ) : (
                <Button variant="secondary" icon={<Pause />} onClick={() => setDialog('pause')}>
                  Pause
                </Button>
              )}
              <Button variant="secondary" icon={<PencilLine />} onClick={() => setDialog('change')}>
                Change
              </Button>
            </div>
          ) : undefined
        }
      >
        {!d || !p ? (
          q.isError ? (
            <Callout tone="red" icon={<AlertTriangle />}>
              {errorMessage(q.error)}
            </Callout>
          ) : (
            <div className="space-y-4" aria-busy="true">
              <Skeleton className="h-20 w-full rounded-xl" />
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          )
        ) : (
          <div>
            {p.status === 'past_due' && (
              <Callout tone="red" icon={<AlertTriangle />} title="The last payment was declined" className="mb-6">
                <p>
                  {p.failure?.lastError ?? 'The card was declined.'}{' '}
                  {p.failure?.nextRetryAt
                    ? `Tried ${p.failure.count} ${p.failure.count === 1 ? 'time' : 'times'}; the next automatic try is ${formatDate(p.failure.nextRetryAt)}.`
                    : `All ${RETRY_SCHEDULE_DAYS.length + 1} tries failed, so it has stopped until the card is updated.`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="primary" icon={<RotateCw />} loading={retry.isPending} onClick={() => retry.mutate(p.id)}>
                    Retry now
                  </Button>
                  <Button size="sm" variant="secondary" icon={<Send />} loading={remind.isPending} onClick={() => remind.mutate(p.id)}>
                    Email fix link
                  </Button>
                </div>
              </Callout>
            )}
            {p.status === 'paused' && (
              <Callout tone="amber" icon={<Pause />} title="Paused" className="mb-6">
                {p.pausedUntil ? `No payments until ${formatDate(p.pausedUntil)}, then it carries on by itself.` : 'No payments until someone resumes it.'}
              </Callout>
            )}
            {p.status === 'cancelled' && (
              <Callout tone="neutral" icon={<XCircle />} title={`Cancelled ${formatDate(p.cancelledAt)}`} className="mb-6">
                {p.cancelReason ?? 'No reason was recorded.'}
              </Callout>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-paper-2/70 p-3.5 ring-1 ring-line-2 ring-inset">
                <p className="text-[12px] text-text-3">Collected so far</p>
                <Money cents={p.collected} className="mt-1 block text-[20px] font-semibold text-text" />
              </div>
              <div className="rounded-xl bg-paper-2/70 p-3.5 ring-1 ring-line-2 ring-inset">
                <p className="text-[12px] text-text-3">{p.kind === 'instalment' ? 'Instalments' : 'Next payment'}</p>
                <p className="nums mt-1 text-[20px] font-semibold text-text">
                  {p.kind === 'instalment' && p.instalments ? `${p.instalments.paid} of ${p.instalments.total}` : live && p.nextChargeAt && p.status !== 'paused' ? formatDate(p.nextChargeAt) : '—'}
                </p>
              </div>
            </div>

            <SheetSection title="Details" className="mt-6">
              <DescriptionList
                items={[
                  { label: 'Amount', value: `${formatMoney(p.amount, { exact: true })} ${freq?.per}` },
                  { label: 'Donor covers the fee', value: p.coverFee ? 'Yes' : 'No' },
                  { label: 'For', value: DESIGNATIONS[p.designation]?.label },
                  { label: 'Appeal', value: p.appealTitle ?? 'Where most needed' },
                  {
                    label: 'Paying with',
                    value: (
                      <span className="inline-flex items-center gap-1.5">
                        <CreditCard className="size-3.5 text-text-3" />
                        {planCard(p)}
                        {p.payment?.expMonth && <span className="text-text-3">exp {String(p.payment.expMonth).padStart(2, '0')}/{String(p.payment.expYear).slice(-2)}</span>}
                      </span>
                    ),
                  },
                  { label: 'Next payment', value: p.nextChargeAt ? formatDate(p.nextChargeAt) : '—', hidden: p.kind !== 'instalment' || !live },
                  { label: 'Last payment', value: p.lastChargeAt ? formatDate(p.lastChargeAt) : 'None yet' },
                  { label: 'Started', value: formatDate(p.startDate) },
                ]}
              />
            </SheetSection>

            {d.donor && (
              <SheetSection title="Donor">
                <div className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-line-2 ring-inset">
                  <Avatar name={d.donor.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{d.donor.name}</p>
                    <p className="truncate text-[12.5px] text-text-3">
                      {d.donor.number} · {d.donor.hasEmail ? d.donor.email : 'No email on file'}
                      {d.donor.phone ? ` · ${d.donor.phone}` : ''}
                    </p>
                  </div>
                  <Link to={`/admin/donors/${d.donor.id}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-medium text-green hover:bg-green-50">
                    Open <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              </SheetSection>
            )}

            <SheetSection title={`Payments (${d.gifts.length})`}>
              {d.gifts.length ? (
                <ol className="divide-y divide-line-2 rounded-xl ring-1 ring-line-2 ring-inset">
                  {d.gifts.map((g) => (
                    <li key={g.id}>
                      <Link to={`/admin/gifts?gift=${g.id}`} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-paper-2/70">
                        <span className={cn('size-2 shrink-0 rounded-full', g.status === 'succeeded' ? 'bg-green' : g.status === 'failed' ? 'bg-red' : 'bg-text-3')} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] text-text">{formatDate(g.date)}</p>
                          {g.status === 'failed' ? (
                            <p className="truncate text-[12.5px] text-red">{g.failureReason ?? 'Declined'}</p>
                          ) : (
                            <p className="nums truncate text-[12.5px] text-text-3">
                              {g.number}
                              {g.receipt?.number ? ` · ${g.receipt.number}` : ''}
                            </p>
                          )}
                        </div>
                        <Money cents={g.amount} className={cn('text-[13.5px] font-medium', g.status === 'succeeded' ? 'text-text' : 'text-text-3 line-through')} />
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[13px] text-text-3">No payments have been taken yet.</p>
              )}
            </SheetSection>

            <SheetSection title="History">
              <HistoryList events={d.events} empty="No changes since it was set up." />
            </SheetSection>
          </div>
        )}
      </Sheet>
      {p && <PlanChangeDialog open={dialog === 'change'} onOpenChange={(v) => setDialog(v ? 'change' : null)} plan={p} onDone={refresh} />}
      {p && <PlanPauseDialog open={dialog === 'pause'} onOpenChange={(v) => setDialog(v ? 'pause' : null)} plan={p} onDone={refresh} />}
      {p && <PlanCancelDialog open={dialog === 'cancel'} onOpenChange={(v) => setDialog(v ? 'cancel' : null)} plan={p} onDone={refresh} />}
    </>
  )
}

/* ---------- change ---------- */
function PlanChangeDialog({ open, onOpenChange, plan, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; plan: Plan; onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<Frequency>(plan.frequency)
  const [next, setNext] = useState('')
  useEffect(() => {
    if (open) {
      setAmount(String(plan.amount / 100))
      setFrequency(plan.frequency)
      setNext(toInputDate(plan.nextChargeAt))
    }
  }, [open, plan])
  const cents = parseMoney(amount)
  const save = useMutation({
    mutationFn: () => api.patch<{ changed: boolean }>(`/admin/plans/${plan.id}`, { amount: cents, frequency, ...(next ? { nextChargeAt: next } : {}) }),
    onSuccess: (r) => {
      toast.success(r.changed ? `${plan.number} updated for ${plan.donorName}` : 'Nothing needed changing')
      onDone()
      onOpenChange(false)
    },
  })
  const err = save.error instanceof ApiError ? save.error : null
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change this regular gift"
      description={`For ${plan.donorName}, at their request. It is logged as done on their behalf; they are not emailed.`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} disabled={!Number.isFinite(cents) || cents < 100} onClick={() => save.mutate()}>
            Save changes
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
        <Field label="Amount each time" error={err?.fields.amount}>
          <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="How often">
          <Segmented value={frequency} onChange={setFrequency} options={FREQUENCY_KEYS.map((f) => ({ value: f, label: FREQUENCIES[f].label }))} />
        </Field>
        <Field label="Next payment" error={err?.fields.nextChargeAt} help="Payments carry on from this date at the new frequency.">
          <Input type="date" value={next} min={toInputDate(new Date())} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  )
}

/* ---------- pause ---------- */
function PlanPauseDialog({ open, onOpenChange, plan, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; plan: Plan; onDone: () => void }) {
  const [until, setUntil] = useState('')
  useEffect(() => {
    if (open) setUntil('')
  }, [open])
  const save = useMutation({
    mutationFn: () => api.post(`/admin/plans/${plan.id}/pause`, { until }),
    onSuccess: () => {
      toast.success(until ? `Paused until ${formatDate(until)}` : `Paused ${plan.number}`)
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
      title="Pause this regular gift?"
      description={`No payments are taken from ${plan.donorName} while it is paused.`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Keep it going
          </Button>
          <Button variant="primary" icon={<Pause />} loading={save.isPending} onClick={() => save.mutate()}>
            Pause
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Until" optional error={err?.fields.until} help={until ? 'It starts again by itself on this date.' : 'Leave empty to pause until someone resumes it.'}>
          <Input type="date" value={until} min={toInputDate(new Date(Date.now() + 86_400_000))} onChange={(e) => setUntil(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3].map((m) => {
            const d = new Date()
            d.setMonth(d.getMonth() + m)
            return (
              <button key={m} type="button" onClick={() => setUntil(toInputDate(d))} className="h-8 rounded-lg px-3 text-[13px] text-text-2 ring-1 ring-line ring-inset hover:text-text pointer-coarse:h-10">
                <CalendarClock className="mr-1 -mt-0.5 inline size-3.5" />
                {m} {m === 1 ? 'month' : 'months'}
              </button>
            )
          })}
        </div>
        <FormError message={err && !Object.keys(err.fields).length ? err.message : null} />
      </div>
    </Dialog>
  )
}

/* ---------- cancel ---------- */
function PlanCancelDialog({ open, onOpenChange, plan, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; plan: Plan; onDone: () => void }) {
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (open) setReason('')
  }, [open])
  const save = useMutation({
    mutationFn: () => api.post(`/admin/plans/${plan.id}/cancel`, { reason }),
    onSuccess: () => {
      toast.success(`${plan.number} cancelled for ${plan.donorName}`)
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
      title="Cancel this regular gift?"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Keep it
          </Button>
          <Button variant="danger" loading={save.isPending} disabled={reason.trim().length < 3} onClick={() => save.mutate()}>
            Cancel regular gift
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[14px] leading-relaxed text-text-2">
          No more payments of {formatMoney(plan.amount)} {FREQUENCIES[plan.frequency as Frequency].per} will be taken from {plan.donorName}. Everything already given, and its receipts, stays on their record. This cannot be undone — they would need to set up a new one.
        </p>
        <Field label="Why" error={err?.fields.reason} help="Kept on the plan and in the action log.">
          <Textarea rows={3} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Donor rang: moving overseas" />
        </Field>
        <FormError message={err && !Object.keys(err.fields).length ? err.message : null} />
      </div>
    </Dialog>
  )
}
