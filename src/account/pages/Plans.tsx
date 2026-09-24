import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, CreditCard, PauseCircle, Pencil, PlayCircle, Repeat, TriangleAlert } from 'lucide-react'
import { api, errorMessage } from '../../portal/api'
import { formatDate, formatMoney } from '../../portal/format'
import { Badge, Button, Callout, Card, EmptyState, Money, PageHeader, Skeleton, StatusBadge, buttonClass, cn, toast } from '../../portal/ui'
import { CardChip, InstalmentProgress, cardExpired, nextPaymentText, perPeriod } from '../components/bits'
import { keys, usePlans, useTitle, type MyPlan } from '../components/data'
import { PlanDialogs, type PlanAction } from '../components/PlanDialogs'

/* ---------------------------------------------------------------------------
   Regular gifts. One card per gift, with everything a donor might want to
   change within one tap of it: the amount, a pause, the card, cancelling.

   A failing gift sorts first and says so in red with the fix as its main
   button. The payment-failed email links here as ?fix=<planId>, which opens
   the card dialog straight away — the donor clicks the email and is looking
   at the card form, not hunting for it. Finished and cancelled gifts are
   folded away underneath, kept for the record.
--------------------------------------------------------------------------- */

const CURRENT = ['past_due', 'active', 'paused']

export default function Plans() {
  useTitle('Regular gifts')
  const { data, isLoading } = usePlans()
  const [params, setParams] = useSearchParams()
  const [target, setTarget] = useState<{ plan: MyPlan; action: PlanAction } | null>(null)
  const [showPast, setShowPast] = useState(false)
  const qc = useQueryClient()

  /* ?fix=<id> from the payment-failed email, and ?card=updated back from Stripe */
  useEffect(() => {
    if (!data) return
    const fix = params.get('fix')
    const card = params.get('card')
    if (fix) {
      const p = data.items.find((x) => x.id === fix)
      if (p && CURRENT.includes(p.status)) setTarget({ plan: p, action: 'card' })
    }
    if (card === 'updated') toast.success('Your card is updated', { description: 'Your next payment will use the new card.' })
    if (fix || card) {
      const next = new URLSearchParams(params)
      next.delete('fix')
      next.delete('card')
      next.delete('session')
      setParams(next, { replace: true })
    }
  }, [data, params, setParams])

  const resume = useMutation({
    mutationFn: (p: MyPlan) => api.post<{ plan: MyPlan }>(`/me/plans/${p.id}/resume`),
    onSuccess: (r) => {
      toast.success('Welcome back — your gift has resumed', {
        description: r.plan.nextChargeAt ? `The next payment goes out on ${formatDate(r.plan.nextChargeAt)}.` : undefined,
      })
      qc.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const open = (plan: MyPlan, action: PlanAction) => setTarget({ plan, action })
  const current = data?.items.filter((p) => CURRENT.includes(p.status)) ?? []
  const past = data?.items.filter((p) => !CURRENT.includes(p.status)) ?? []
  const monthly = current
    .filter((p) => p.status === 'active')
    .reduce((s, p) => s + Math.round((p.amount * { weekly: 52, fortnightly: 26, monthly: 12 }[p.frequency]) / 12), 0)

  return (
    <div>
      <PageHeader
        title="Regular gifts"
        description="Change the amount, pause for a while, use another card or stop — any time, from here. Every change is confirmed by email."
        meta={data?.simulated ? <Badge tone="teal">Test payments — no real money moves</Badge> : undefined}
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : current.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Repeat />}
            title={past.length ? 'No regular gifts running' : 'No regular gifts yet'}
            action={<a href="/give" className={buttonClass('give', 'md')}>Set up a monthly gift</a>}
          >
            A regular gift is steady support an appeal can plan around. You choose the amount and the day, and you can pause or stop it here whenever you like.
          </EmptyState>
        </Card>
      ) : (
        <>
          {monthly > 0 && current.length > 1 && (
            <p className="mb-4 text-[14px] text-text-2">
              Together, about <strong className="nums font-semibold text-text">{formatMoney(monthly)}</strong> a month.
            </p>
          )}
          <div className="grid items-start gap-4 md:grid-cols-2">
            {current.map((p) => (
              <PlanCard key={p.id} plan={p} onAction={(a) => open(p, a)} onResume={() => resume.mutate(p)} resuming={resume.isPending && resume.variables?.id === p.id} />
            ))}
          </div>
        </>
      )}

      {past.length > 0 && (
        <section className="mt-10">
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            aria-expanded={showPast}
            className="flex items-center gap-2 rounded-lg py-1 text-[14px] font-medium text-text-2 hover:text-text"
          >
            <ChevronDown className={cn('size-4 transition-transform', showPast && 'rotate-180')} />
            Past regular gifts ({past.length})
          </button>
          {showPast && (
            <Card className="mt-3 divide-y divide-line-2 overflow-hidden">
              {past.map((p) => (
                <div key={p.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-text">
                      {p.kind === 'instalment' ? `${formatMoney(p.amount * (p.instalments?.total ?? 0))} in ${p.instalments?.total} instalments` : perPeriod(p)}
                      <span className="font-normal text-text-2"> · {p.appealTitle ?? 'Where most needed'}</span>
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-text-3">
                      {formatDate(p.startDate)} – {formatDate(p.cancelledAt ?? p.lastChargeAt)}
                      {p.cancelReason ? ` · “${p.cancelReason}”` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] text-text-2">
                      <Money cents={p.collected} className="font-semibold text-text" /> given
                    </span>
                    <StatusBadge kind="plan" value={p.status} size="sm" />
                  </div>
                </div>
              ))}
            </Card>
          )}
        </section>
      )}

      <PlanDialogs
        plan={target?.plan ?? null}
        action={target?.action ?? null}
        simulated={Boolean(data?.simulated)}
        onAction={(a) => setTarget((t) => (a && t ? { ...t, action: a } : null))}
      />
    </div>
  )
}

function PlanCard({ plan: p, onAction, onResume, resuming }: { plan: MyPlan; onAction: (a: PlanAction) => void; onResume: () => void; resuming: boolean }) {
  const failing = p.status === 'past_due'
  const paused = p.status === 'paused'
  const instalment = p.kind === 'instalment'
  const expired = cardExpired(p.payment)
  return (
    <Card className={cn('flex flex-col overflow-hidden', failing && 'ring-red/30')}>
      <div className="px-5 pt-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium text-text-3">{instalment ? 'Instalments' : 'Regular gift'} · {p.number}</p>
            <p className={cn('nums mt-1 text-[26px] leading-tight font-semibold tracking-[-0.02em]', paused ? 'text-text-2' : 'text-text')}>{perPeriod(p)}</p>
            <p className="mt-1 text-[14px] text-text-2">
              {p.appealTitle ?? 'Where most needed'} <StatusBadge kind="designation" value={p.designation} size="sm" className="ml-1 align-[1px]" />
            </p>
          </div>
          <StatusBadge kind="plan" value={p.status} size="sm" />
        </div>
        {instalment && <InstalmentProgress plan={p} className="mt-4" />}
      </div>

      {failing && (
        <Callout tone="red" icon={<TriangleAlert />} className="mx-5 mt-4 sm:mx-6" title="The last payment did not go through">
          {p.failure?.lastError ?? 'The bank declined it.'} {p.failure?.nextRetryAt ? `We will try again on ${formatDate(p.failure.nextRetryAt)}, or ` : ''}update the card and we will try straight away.
        </Callout>
      )}

      <dl className="mx-5 mt-4 divide-y divide-line-2 border-y border-line-2 text-[13.5px] sm:mx-6">
        <Row label={failing ? 'Next try' : paused ? 'Status' : 'Next payment'} value={<span className={cn(failing && 'text-red')}>{nextPaymentText(p)}</span>} />
        {paused && p.nextChargeAt && <Row label="Then" value={formatDate(p.nextChargeAt)} />}
        <Row label="Paying with" value={<CardChip payment={p.payment} />} />
        <Row label="Given so far" value={<Money cents={p.collected} className="font-medium text-text" />} />
        <Row label="Since" value={formatDate(p.startDate)} />
        {p.coverFee && <Row label="Card fee" value="You cover it, thank you" />}
      </dl>

      {expired && !failing && (
        <p className="mx-5 mt-3 text-[12.5px] font-medium text-red sm:mx-6">This card has expired — switch it before the next payment.</p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 px-5 py-4 sm:px-6">
        {failing ? (
          <Button variant="primary" icon={<CreditCard />} onClick={() => onAction('card')} className="grow sm:grow-0">
            Update card
          </Button>
        ) : paused ? (
          <>
            <Button variant="primary" icon={<PlayCircle />} loading={resuming} onClick={onResume} className="grow sm:grow-0">
              Resume
            </Button>
            <Button variant="secondary" icon={<CreditCard />} onClick={() => onAction('card')}>
              Switch card
            </Button>
          </>
        ) : (
          <>
            {!instalment && (
              <Button variant="secondary" icon={<Pencil />} onClick={() => onAction('amount')}>
                Change amount
              </Button>
            )}
            {!instalment && (
              <Button variant="secondary" icon={<PauseCircle />} onClick={() => onAction('pause')}>
                Pause
              </Button>
            )}
            <Button variant={expired ? 'primary' : 'secondary'} icon={<CreditCard />} onClick={() => onAction('card')}>
              Switch card
            </Button>
          </>
        )}
        <Button variant="ghost" className="ml-auto text-text-3 hover:text-red" onClick={() => onAction('cancel')}>
          Cancel
        </Button>
      </div>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-text-2">{label}</dt>
      <dd className="min-w-0 text-right text-text">{value}</dd>
    </div>
  )
}
