import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addMonths } from 'date-fns'
import { CircleCheck, Lock, PauseCircle, TriangleAlert } from 'lucide-react'
import { FREQUENCIES, FREQUENCY_KEYS, type Frequency } from '../../../shared/domain'
import { api, ApiError, errorMessage } from '../../portal/api'
import { formatDate, formatMoney, parseMoney } from '../../portal/format'
import { Button, Callout, ChoiceCards, Dialog, Field, FormError, Input, MoneyInput, Textarea, cn, toast } from '../../portal/ui'
import { cardLabel, perPeriod } from './bits'
import { keys, type MyPlan } from './data'

/* ---------------------------------------------------------------------------
   The four things a donor can do to a regular gift, each in its own dialog
   (a bottom sheet on a phone): change the amount, pause, switch card, cancel.

   Each dialog says what will happen before it happens — "Your next payment
   of $60 goes out on 12 October" — and the server emails a confirmation, so
   the words here and the email agree.

   Cancelling is kind, not sticky: one screen, an optional reason, and a
   single "would a pause help?" offer. No guilt, no three-step maze.

   Switching card in simulated mode takes test card details here (Stripe's
   own test numbers). With Stripe connected, the server hands back a link to
   Stripe's page instead and no card number ever passes through the portal.
--------------------------------------------------------------------------- */

export type PlanAction = 'amount' | 'pause' | 'card' | 'cancel'

export function PlanDialogs({
  plan,
  action,
  onAction,
  simulated,
}: {
  plan: MyPlan | null
  action: PlanAction | null
  onAction: (a: PlanAction | null) => void
  simulated: boolean
}) {
  const close = () => onAction(null)
  return (
    <>
      <AmountDialog plan={plan} open={action === 'amount'} onClose={close} />
      <PauseDialog plan={plan} open={action === 'pause'} onClose={close} />
      <CardDialog plan={plan} open={action === 'card'} onClose={close} simulated={simulated} />
      <CancelDialog plan={plan} open={action === 'cancel'} onClose={close} onPause={() => onAction('pause')} />
    </>
  )
}

function usePlanMutation<T>(fn: (body: T) => Promise<unknown>, onDone: () => void, success: string | ((r: unknown) => string)) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      toast.success(typeof success === 'string' ? success : success(r), { description: 'We have emailed you a confirmation.' })
      qc.invalidateQueries({ queryKey: keys.all })
      onDone()
    },
  })
}

/* ---------- change amount ---------- */
function AmountDialog({ plan, open, onClose }: { plan: MyPlan | null; open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  useEffect(() => {
    if (open && plan) {
      setAmount(String(plan.amount / 100))
      setFrequency(plan.frequency as Frequency)
    }
  }, [open, plan])
  const cents = parseMoney(amount)
  const valid = Number.isFinite(cents) && cents >= 100
  const m = usePlanMutation(
    () => api.patch(`/me/plans/${plan!.id}`, { amount: cents, frequency }),
    onClose,
    'Your regular donation is updated',
  )
  const err = m.error instanceof ApiError ? m.error : null
  const unchanged = plan && cents === plan.amount && frequency === plan.frequency
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Change your regular donation"
      description={plan?.appealTitle ? `Your donation to ${plan.appealTitle}.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep it as it is
          </Button>
          <Button variant="primary" type="submit" form="plan-amount" loading={m.isPending} disabled={!valid || Boolean(unchanged)}>
            Save the change
          </Button>
        </>
      }
    >
      <form
        id="plan-amount"
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid && !unchanged) m.mutate(undefined)
        }}
      >
        <Field label="Amount each time" error={err?.fields.amount ?? (!valid && amount ? 'Enter an amount of at least $1' : undefined)}>
          <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus className="text-[18px] font-semibold sm:text-[16px]" />
        </Field>
        <div className="flex flex-wrap gap-2">
          {[20, 50, 100, 250].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAmount(String(v))}
              className={cn(
                'nums h-9 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-inset transition-colors pointer-coarse:h-10',
                cents === v * 100 ? 'bg-green-50 text-green ring-green/40' : 'bg-paper text-text-2 ring-line hover:text-text',
              )}
            >
              ${v}
            </button>
          ))}
        </div>
        <Field label="How often">
          <ChoiceCards
            value={frequency}
            onChange={setFrequency}
            options={FREQUENCY_KEYS.map((f) => ({
              value: f,
              label: FREQUENCIES[f].label,
              hint: valid ? `${formatMoney(cents * FREQUENCIES[f].perYear)} a year` : ' ',
            }))}
          />
        </Field>
        {valid && plan && (
          <p className="rounded-xl bg-paper-2 px-4 py-3 text-[13.5px] leading-relaxed text-text-2 ring-1 ring-line-2">
            From {plan.nextChargeAt && plan.status === 'active' ? <strong className="text-text">{formatDate(plan.nextChargeAt)}</strong> : 'your next payment'}, you will give{' '}
            <strong className="text-text">{perPeriod({ amount: cents, frequency })}</strong>
            {plan.operatingCosts ? ', plus your operating costs contribution' : plan.coverFee && plan.operatingCosts == null ? ', plus the card fee you chose to cover' : ''}. Nothing else changes.
          </p>
        )}
        <FormError message={err && !Object.keys(err.fields).length ? err.message : undefined} />
      </form>
    </Dialog>
  )
}

/* ---------- pause ---------- */
type PauseChoice = '1m' | '3m' | 'open'
function PauseDialog({ plan, open, onClose }: { plan: MyPlan | null; open: boolean; onClose: () => void }) {
  const [choice, setChoice] = useState<PauseChoice>('1m')
  useEffect(() => {
    if (open) setChoice('1m')
  }, [open])
  const until = useMemo(() => (choice === 'open' ? null : addMonths(new Date(), choice === '1m' ? 1 : 3)), [choice])
  const m = usePlanMutation(
    () => api.post(`/me/plans/${plan!.id}/pause`, { until: until?.toISOString() ?? null }),
    onClose,
    until ? `Paused until ${formatDate(until)}` : 'Paused until you resume it',
  )
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Pause for a while"
      description="Nothing is taken while it is paused. Your donation stays set up, so starting again is one tap."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Not now
          </Button>
          <Button variant="primary" loading={m.isPending} onClick={() => m.mutate(undefined)} icon={<PauseCircle />}>
            Pause my donation
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ChoiceCards<PauseChoice>
          value={choice}
          onChange={setChoice}
          options={[
            { value: '1m', label: '1 month', hint: `Until ${formatDate(addMonths(new Date(), 1))}` },
            { value: '3m', label: '3 months', hint: `Until ${formatDate(addMonths(new Date(), 3))}` },
            { value: 'open', label: 'Until I resume', hint: 'Start again whenever you like' },
          ]}
        />
        <p className="text-[13.5px] leading-relaxed text-text-2">
          {until ? (
            <>
              Your {plan ? perPeriod(plan) : ''} donation picks up again on its usual day after <strong className="text-text">{formatDate(until)}</strong>. We will email you a few days before.
            </>
          ) : (
            <>Your donation stays paused until you come back here and press Resume.</>
          )}
        </p>
        <FormError message={m.error ? errorMessage(m.error) : undefined} />
      </div>
    </Dialog>
  )
}

/* ---------- switch card ---------- */
const TEST_CARDS = [
  { number: '4242 4242 4242 4242', what: 'goes through' },
  { number: '4000 0000 0000 0002', what: 'is declined' },
  { number: '4000 0000 0000 9995', what: 'has insufficient funds' },
]

function formatCardNumber(v: string) {
  return v.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ')
}

function CardDialog({ plan, open, onClose, simulated }: { plan: MyPlan | null; open: boolean; onClose: () => void; simulated: boolean }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [declined, setDeclined] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setName('')
      setNumber('')
      setExpiry('')
      setDeclined(null)
    }
  }, [open])
  const failing = plan?.status === 'past_due'
  const [mm, yy] = expiry.split('/').map((s) => s.trim())
  const m = useMutation({
    mutationFn: () =>
      api.post<{ url?: string; charge?: { ok: boolean; error?: string } | null }>(`/me/plans/${plan!.id}/card`, simulated ? { name, number, expMonth: Number(mm), expYear: Number(yy) } : {}),
    onSuccess: (r) => {
      if (r.url) {
        window.location.href = r.url
        return
      }
      qc.invalidateQueries({ queryKey: keys.all })
      if (r.charge && !r.charge.ok) {
        setDeclined(r.charge.error ?? 'The bank declined it.')
        return
      }
      toast.success(r.charge?.ok ? `Card updated, and your ${formatMoney(plan!.amount)} donation went through` : 'Your card is updated', {
        description: r.charge?.ok ? 'Thank you. Your receipt is on its way.' : 'Your next payment will use the new card.',
      })
      onClose()
    },
  })
  const err = m.error instanceof ApiError ? m.error : null
  const digits = number.replace(/\D/g, '')
  const ready = !simulated || (name.trim().length > 1 && digits.length >= 13 && /^\d{1,2}$/.test(mm ?? '') && /^\d{2,4}$/.test(yy ?? ''))

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={failing ? 'Update your card' : 'Use a different card'}
      description={
        plan ? (
          <>
            For your {perPeriod(plan)} donation{plan.appealTitle ? ` to ${plan.appealTitle}` : ''}. Now paying with {cardLabel(plan.payment)}.
          </>
        ) : undefined
      }
      dismissible={!m.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={m.isPending}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="plan-card" loading={m.isPending} disabled={!ready} icon={simulated ? undefined : <Lock />}>
            {!simulated ? 'Continue to secure card page' : failing ? `Save and give ${plan ? formatMoney(plan.amount) : ''} now` : 'Save card'}
          </Button>
        </>
      }
    >
      <form
        id="plan-card"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          setDeclined(null)
          if (ready) m.mutate()
        }}
      >
        {failing && !declined && (
          <Callout tone="amber" icon={<TriangleAlert />}>
            Your last payment did not go through{plan?.failure?.lastError ? <> — the bank said “{plan.failure.lastError}”</> : '.'} When you save the new card we will try the payment again straight away.
          </Callout>
        )}
        {declined && (
          <Callout tone="red" icon={<TriangleAlert />} title="The new card was saved, but the payment was declined">
            {declined} Try another card, or check with your bank. Nothing was taken.
          </Callout>
        )}
        {simulated ? (
          <>
            <Field label="Name on card" error={err?.fields.name}>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="cc-name" autoFocus />
            </Field>
            <Field label="Card number" error={err?.fields.number}>
              <Input
                value={number}
                onChange={(e) => setNumber(formatCardNumber(e.target.value))}
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="1234 5678 9012 3456"
                className="nums tracking-wide"
              />
            </Field>
            <Field label="Expiry" help="MM / YY" error={err?.fields.expYear ?? err?.fields.expMonth} className="max-w-[160px]">
              <Input
                value={expiry}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, '').slice(0, 4)
                  setExpiry(d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d)
                }}
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="08 / 29"
                className="nums"
              />
            </Field>
            <div className="rounded-xl bg-teal-pale/70 px-4 py-3 text-[12.5px] leading-relaxed text-teal ring-1 ring-teal/15">
              <p className="font-semibold">Test mode — no real card is charged</p>
              <p className="mt-1 text-teal/90">Payments are simulated with Stripe&rsquo;s test cards. Any future expiry works.</p>
              <ul className="mt-2 space-y-1">
                {TEST_CARDS.map((c) => (
                  <li key={c.number}>
                    <button type="button" onClick={() => setNumber(c.number)} className="nums font-medium underline decoration-teal/30 underline-offset-2 hover:decoration-teal">
                      {c.number}
                    </button>{' '}
                    {c.what}
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <p className="flex items-start gap-3 text-[13.5px] leading-relaxed text-text-2">
            <Lock className="mt-0.5 size-4 shrink-0 text-green" />
            You will enter the new card on Stripe&rsquo;s secure page, then come straight back here. Your card number never passes through our systems.
          </p>
        )}
        <FormError message={err && !Object.keys(err.fields).length ? err.message : undefined} />
      </form>
    </Dialog>
  )
}

/* ---------- cancel ---------- */
const REASONS = ['Money is tight at the moment', 'I give another way now', 'I only meant it to be once', 'Something went wrong']

function CancelDialog({ plan, open, onClose, onPause }: { plan: MyPlan | null; open: boolean; onClose: () => void; onPause: () => void }) {
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (open) setReason('')
  }, [open])
  const m = usePlanMutation(() => api.post(`/me/plans/${plan!.id}/cancel`, { reason: reason.trim() || undefined }), onClose, 'Your regular donation is cancelled')
  const canPause = plan?.status === 'active' && plan.kind !== 'instalment'
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Cancel this regular donation?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep giving
          </Button>
          <Button variant="danger" loading={m.isPending} onClick={() => m.mutate(undefined)}>
            Cancel my donation
          </Button>
        </>
      }
    >
      <div className="space-y-5 text-[14px] leading-relaxed text-text-2">
        <p>
          {plan && (
            <>
              No more payments will be taken for your {perPeriod(plan)} donation{plan.appealTitle ? <> to <strong className="text-text">{plan.appealTitle}</strong></> : ''}.{' '}
            </>
          )}
          Everything you have given stays in your account, with every receipt.
          {plan && plan.collected > 0 && (
            <>
              {' '}
              Together, it came to <strong className="nums text-text">{formatMoney(plan.collected)}</strong>. JazakAllahu khayran.
            </>
          )}
        </p>
        {canPause && (
          <div className="flex flex-col gap-3 rounded-xl bg-green-50 px-4 py-3 ring-1 ring-green/15 sm:flex-row sm:items-center">
            <p className="flex-1 text-[13.5px] text-green">Just need a break? You can pause instead and pick it up later.</p>
            <Button variant="subtle" size="sm" onClick={onPause} icon={<PauseCircle />}>
              Pause instead
            </Button>
          </div>
        )}
        <Field label="Would you tell us why?" optional help="It helps us, and nobody will call or chase you about it.">
          <div className="mb-2 flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(reason === r ? '' : r)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[12.5px] font-medium ring-1 ring-inset transition-colors',
                  reason === r ? 'bg-green-50 text-green ring-green/40' : 'bg-paper text-text-2 ring-line hover:text-text',
                )}
              >
                {reason === r && <CircleCheck className="mr-1 -mt-px inline size-3.5" />}
                {r}
              </button>
            ))}
          </div>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Or in your own words" />
        </Field>
        <FormError message={m.error ? errorMessage(m.error) : undefined} />
      </div>
    </Dialog>
  )
}
