import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, MailX, Search, UserPlus } from 'lucide-react'
import { DESIGNATIONS, DESIGNATION_KEYS, type Designation, type Method } from '../../../shared/domain'
import type { Gift } from '../../../shared/types'
import { api, ApiError } from '../../portal/api'
import { formatMoney, parseMoney, plural, toInputDate } from '../../portal/format'
import {
  Button, Checkbox, Dialog, Field, FormError, Input, MoneyInput, Segmented, Switch, Textarea, cn, toast,
} from '../../portal/ui'
import { AppealSelect, DonorPicker, type PickedDonor } from './DonorPicker'
import { METHOD_ICONS, isPlaceholderEmail, type DonorSummary } from './GiftBits'

/* ---------------------------------------------------------------------------
   "Record a gift" — cash, cheques, event tables and transfers that did not
   come through the website.

   Built for a volunteer at a table with a queue in front of them, on a phone:
   the donor and the amount first and biggest, everything that stays the same
   all night (method, appeal, designation, date) remembered by "Save and add
   another", and a running tally so they can check the cash tin against it.

   A person who will not give an email still gets a donor record and a receipt
   number; the receipt switch explains why it cannot email one rather than
   silently doing nothing. POST /api/admin/gifts/offline.
--------------------------------------------------------------------------- */

export type SessionTally = { count: number; total: number }

type NewDonor = { firstName: string; lastName: string; email: string; phone: string }

type Result = {
  gift: Gift
  donor: DonorSummary
  donorCreated: boolean
  receiptEmailed: boolean
  receiptSkipped: 'no-email' | 'declined' | null
}

const METHOD_OPTIONS: { value: Extract<Method, 'cash' | 'cheque' | 'event' | 'bank'>; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'event', label: 'Event' },
  { value: 'bank', label: 'Bank' },
]

const REFERENCE: Record<string, { label: string; placeholder: string; help?: string }> = {
  cash: { label: 'Reference', placeholder: 'Receipt book number, envelope…' },
  cheque: { label: 'Cheque number', placeholder: 'e.g. 004512', help: 'Printed bottom left of the cheque.' },
  event: { label: 'Event', placeholder: 'e.g. Community iftar, Auburn', help: 'Kept for the next donation you add tonight.' },
  bank: { label: 'Bank reference', placeholder: 'As it shows on the statement' },
}

const QUICK = [20, 50, 100, 250]

function splitTyped(typed: string): NewDonor {
  const t = typed.trim()
  if (t.includes('@')) return { firstName: '', lastName: '', email: t, phone: '' }
  if (/^[\d\s+()-]{6,}$/.test(t)) return { firstName: '', lastName: '', email: '', phone: t }
  const [first = '', ...rest] = t.split(/\s+/)
  return { firstName: first, lastName: rest.join(' '), email: '', phone: '' }
}

export function GiftRecordDialog({
  open,
  onOpenChange,
  presetDonorId,
  tally,
  onTally,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  presetDonorId?: string | null
  tally: SessionTally
  onTally: (t: SessionTally) => void
}) {
  const qc = useQueryClient()
  const today = toInputDate(new Date())

  const [donor, setDonor] = useState<PickedDonor | null>(null)
  const [newDonor, setNewDonor] = useState<NewDonor | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<(typeof METHOD_OPTIONS)[number]['value']>('cash')
  const [designation, setDesignation] = useState<Designation>('sadaqah')
  const [appealId, setAppealId] = useState('')
  const [date, setDate] = useState(today)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [sendReceipt, setSendReceipt] = useState(true)
  const [more, setMore] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  /* opened from a donor's record: start with them chosen */
  const preset = useQuery({
    queryKey: ['admin', 'gifts', 'donor', presetDonorId],
    queryFn: () => api.get<{ donor: DonorSummary }>(`/admin/gifts/donor/${presetDonorId}`),
    enabled: open && Boolean(presetDonorId),
  })
  useEffect(() => {
    const d = preset.data?.donor
    if (open && d) {
      setDonor({ id: d.id, number: d.number, firstName: d.firstName, lastName: d.lastName, email: d.email || 'No email on file' })
      setNewDonor(null)
      setTimeout(() => amountRef.current?.focus(), 250)
    }
  }, [preset.data, open])

  /* a volunteer's picker shows a masked address (DonorPicker), so it says
     outright whether there is a real one behind it */
  const noEmail = newDonor
    ? !newDonor.email.trim()
    : donor
      ? Boolean(donor.noEmail) || isPlaceholderEmail(donor.email) || donor.email === 'No email on file'
      : false
  const cents = parseMoney(amount)
  const hasDonor = Boolean(donor || (newDonor && newDonor.firstName.trim()))

  const save = useMutation({
    mutationFn: (_again: boolean) =>
      api.post<Result>('/admin/gifts/offline', {
        ...(donor
          ? { donorId: donor.id }
          : {
              newDonor: {
                firstName: newDonor?.firstName ?? '',
                lastName: newDonor?.lastName ?? '',
                email: newDonor?.email.trim() || undefined,
                phone: newDonor?.phone.trim() || undefined,
              },
            }),
        amount: Number.isFinite(cents) ? cents : 0,
        method,
        designation,
        appealId: appealId || null,
        date,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        anonymous,
        /* for a no-email donor the server records the unsendable receipt email as failed, with the reason */
        sendReceipt: noEmail ? true : sendReceipt,
      }),
    onSuccess: (r, again) => {
      const name = r.donor.name
      const what = `${formatMoney(r.gift.amount)} from ${name}`
      toast.success(`Saved ${what}`, {
        description: r.receiptEmailed
          ? `Receipt ${r.gift.receipt?.number ?? ''} emailed to ${r.donor.email || r.donor.emailHint}.`
          : r.receiptSkipped === 'no-email'
            ? `Receipt ${r.gift.receipt?.number ?? ''} issued. No email on file, so it was not sent.`
            : `Receipt ${r.gift.receipt?.number ?? ''} issued, not emailed.`,
      })
      onTally({ count: tally.count + 1, total: tally.total + r.gift.amount })
      qc.invalidateQueries({ queryKey: ['admin', 'gifts'] })
      qc.invalidateQueries({ queryKey: ['admin', 'badges'] })
      qc.invalidateQueries({ queryKey: ['admin', 'donors'] })
      clearPerson()
      if (again) {
        /* the event stays; a cheque number or bank reference belongs to one gift */
        if (method !== 'event') setReference('')
        setTimeout(() => (document.querySelector('[data-gift-donor] input') as HTMLInputElement | null)?.focus(), 50)
      } else {
        onOpenChange(false)
      }
    },
  })

  function clearPerson() {
    setDonor(null)
    setNewDonor(null)
    setAmount('')
    setNotes('')
    setAnonymous(false)
    setSendReceipt(true)
    save.reset()
  }

  /* opening puts the cursor in the donor search; closing forgets the person
     and amount but keeps the evening's settings */
  useEffect(() => {
    if (open && !presetDonorId) {
      const t = setTimeout(() => (document.querySelector('[data-gift-donor] input') as HTMLInputElement | null)?.focus(), 80)
      return () => clearTimeout(t)
    }
    if (!open) {
      clearPerson()
      setMore(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const err = save.error instanceof ApiError ? save.error : null
  const fe = err?.fields ?? {}
  const topError = err && !Object.keys(fe).length ? err.message : save.error && !err ? 'Something went wrong. Please try again.' : null
  const ref = REFERENCE[method]

  const submit = (again: boolean) => {
    if (!formRef.current?.reportValidity()) return
    save.mutate(again)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!save.isPending}
      title="Record a donation"
      description={
        tally.count > 0 ? (
          <span className="inline-flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-green" aria-hidden />
            <span className="nums font-medium text-text">
              {plural(tally.count, 'donation')} · {formatMoney(tally.total)}
            </span>{' '}
            this session
          </span>
        ) : (
          'Cash, cheques, event tables and transfers. A receipt number is issued straight away.'
        )
      }
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={() => submit(true)} loading={save.isPending && save.variables === true} disabled={save.isPending}>
            Save and add another
          </Button>
          <Button variant="primary" onClick={() => submit(false)} loading={save.isPending && save.variables === false} disabled={save.isPending}>
            Save donation
          </Button>
        </>
      }
    >
      <form
        ref={formRef}
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          submit(false)
        }}
      >
        <FormError message={topError} />

        {/* who */}
        <Field
          label="Donor"
          error={fe.donor || fe['newDonor.firstName'] || fe['newDonor.email']}
          action={
            newDonor ? (
              <button type="button" onClick={() => setNewDonor(null)} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-green hover:underline">
                <Search className="size-3.5" /> Search instead
              </button>
            ) : !donor ? (
              <button
                type="button"
                onClick={() => setNewDonor({ firstName: '', lastName: '', email: '', phone: '' })}
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-green hover:underline"
              >
                <UserPlus className="size-3.5" /> New donor
              </button>
            ) : null
          }
        >
          {newDonor ? (
            <div className="rounded-xl bg-paper-2/70 p-3 ring-1 ring-line-2 ring-inset">
              <div className="grid grid-cols-2 gap-2.5">
                <Input
                  aria-label="First name"
                  placeholder="First name"
                  autoFocus
                  required
                  autoComplete="off"
                  value={newDonor.firstName}
                  onChange={(e) => setNewDonor({ ...newDonor, firstName: e.target.value })}
                  invalid={Boolean(fe['newDonor.firstName'])}
                />
                <Input aria-label="Last name" placeholder="Last name" autoComplete="off" value={newDonor.lastName} onChange={(e) => setNewDonor({ ...newDonor, lastName: e.target.value })} />
                <Input
                  aria-label="Email"
                  type="email"
                  placeholder="Email (for the receipt)"
                  autoComplete="off"
                  className="col-span-2"
                  value={newDonor.email}
                  onChange={(e) => setNewDonor({ ...newDonor, email: e.target.value })}
                  invalid={Boolean(fe['newDonor.email'])}
                />
                <div className="col-span-2">
                  <Input aria-label="Phone" type="tel" placeholder="Phone (optional)" autoComplete="off" value={newDonor.phone} onChange={(e) => setNewDonor({ ...newDonor, phone: e.target.value })} />
                </div>
              </div>
              <p className="mt-2 text-[12.5px] leading-snug text-text-3">If the email is already on a donor’s record, the donation goes on that record instead.</p>
            </div>
          ) : (
            <div data-gift-donor>
              <DonorPicker
                value={donor}
                onChange={(d) => {
                  setDonor(d)
                  if (d) setTimeout(() => amountRef.current?.focus(), 30)
                }}
                onCreateNew={(typed) => setNewDonor(splitTyped(typed))}
                invalid={Boolean(fe.donor)}
                placeholder={preset.isLoading ? 'Loading…' : 'Name, email, phone or donor number'}
              />
            </div>
          )}
        </Field>

        {/* how much */}
        <Field label="Amount" error={fe.amount}>
          <MoneyInput
            ref={amountRef}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
            pattern="^\$?\s*[0-9,]*(\.[0-9]{0,2})?$"
            className="h-14 text-[26px] font-semibold tracking-[-0.01em] sm:h-14 sm:text-[24px] pointer-coarse:h-14"
            aria-describedby="gift-quick"
          />
          <div id="gift-quick" className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className={cn(
                  'nums h-8 rounded-lg px-3 text-[13px] font-medium ring-1 ring-inset transition-colors pointer-coarse:h-10',
                  cents === q * 100 ? 'bg-green-50 text-green ring-green/30' : 'bg-paper text-text-2 ring-line hover:text-text',
                )}
              >
                ${q}
              </button>
            ))}
          </div>
        </Field>

        <Field label="How it was given">
          <Segmented
            aria-label="How it was given"
            value={method}
            onChange={setMethod}
            className="w-full [&>button]:flex-1 [&>button]:justify-center"
            options={METHOD_OPTIONS.map((m) => {
              const Icon = METHOD_ICONS[m.value]
              return {
                value: m.value,
                label: (
                  <>
                    <Icon className="size-4" aria-hidden /> {m.label}
                  </>
                ),
              }
            })}
          />
        </Field>

        <Field label="What it is for" help={designation === 'zakat' || designation === 'zakat_fitr' ? 'Zakat is kept separate all the way through to the reports.' : undefined}>
          {/* seven choices, four to a row even on a phone: one glance, one tap */}
          <div role="radiogroup" aria-label="What it is for" className="grid grid-cols-4 gap-1.5">
            {DESIGNATION_KEYS.map((k) => {
              const on = designation === k
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setDesignation(k)}
                  className={cn(
                    'h-10 truncate rounded-[10px] px-1.5 text-[13px] font-medium ring-1 ring-inset transition-colors pointer-coarse:h-11',
                    on ? 'bg-green-50 text-green ring-2 ring-green' : 'bg-paper text-text ring-line hover:ring-[#c9c9c2]',
                  )}
                >
                  {DESIGNATIONS[k].short}
                </button>
              )
            })}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Appeal" error={fe.appealId}>
            <AppealSelect value={appealId} onChange={(id) => setAppealId(id)} />
          </Field>
          <Field label="Date received" error={fe.date}>
            <Input type="date" value={date} max={today} required onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        <Field label={ref.label} optional help={ref.help} error={fe.reference}>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={ref.placeholder} autoComplete="off" />
        </Field>

        <div className="rounded-xl ring-1 ring-line-2 ring-inset">
          <div className="p-3.5">
            {noEmail ? (
              <div className="flex items-start gap-3">
                <MailX className="mt-0.5 size-4 shrink-0 text-text-3" aria-hidden />
                <div className="text-[13px] leading-snug">
                  <p className="font-medium text-text">No receipt email</p>
                  <p className="mt-0.5 text-text-2">
                    {hasDonor ? 'There is no email address for this donor.' : 'Choose a donor first.'} A receipt number is still issued, and it can be emailed later from the donation once their address is added.
                  </p>
                </div>
              </div>
            ) : (
              <Switch
                checked={sendReceipt}
                onChange={setSendReceipt}
                label="Email a receipt"
                description={donor ? `To ${donor.email}, straight away.` : 'Sent to the donor as soon as you save.'}
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            aria-expanded={more}
            className="flex w-full items-center justify-between border-t border-line-2 px-3.5 py-2.5 text-[13px] font-medium text-text-2 hover:text-text"
          >
            More: notes, anonymous
            <ChevronDown className={cn('size-4 transition-transform', more && 'rotate-180')} />
          </button>
          {more && (
            <div className="space-y-4 border-t border-line-2 p-3.5">
              <Field label="Notes" optional help="Only staff see these.">
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the office should know" />
              </Field>
              <Checkbox checked={anonymous} onChange={setAnonymous} label="Keep their name off public lists" description="The donation still appears on their record and receipt." />
            </div>
          )}
        </div>
        {/* Enter in any field saves */}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  )
}
