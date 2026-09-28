import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { DESIGNATIONS, FREQUENCIES, type Designation } from '../../shared/domain'
import { formatMoney } from '../../shared/money'
import { ArrowRight, Check, Copy, HandHeart, Mail } from '../components/icons'
import { ORG } from '../components/org-data'
import { giftStatus, type GiftStatus } from '../services/give'

/* ---------------------------------------------------------------------------
   /thank-you — where every payment sends the donor back to.

   Planned as three parts, and still built that way:
     1. The impact line — what this gift was, named to its appeal
     2. Your receipt — what's coming and when (or, for a transfer, what is
        still to do)
     3. One more thing — see it in your account, or give again

   IT SHOWS WHAT THE SERVER KNOWS, NOT WHAT THE FORM HOPED
   Stripe and PayPal send the donor here with ?gift=<id>, and the page asks
   /api/public/gifts/<id>/status what actually happened. A donor can reach this
   URL without paying — the back button, a copied link, a card declined on the
   provider's page — so the page never assumes: the tick appears only for a
   gift the server has as paid.
     succeeded           tick, the sum, the receipt number, emailed
     pending, card       "confirming" — Stripe's webhook can land a second or
                         two after the donor does, so the page asks again for
                         about half a minute before saying it is still waiting
     pending, transfer   no tick: one step left, with the account and the
                         reference to pay to
     failed              nothing was taken, and the way back to /give
   A gift made while payments are SIMULATED (no Stripe keys on the platform)
   says so in plain words under the tick, so a demo is never mistaken for money.
   With no ?gift at all the page thanks the reader without claiming anything.
--------------------------------------------------------------------------- */

type State = { kind: 'none' } | { kind: 'loading' } | { kind: 'missing' } | { kind: 'ready'; gift: GiftStatus; waiting: boolean }

const POLL_MS = 2000
const POLL_TRIES = 15

function useGift(id: string | null): State {
  const [state, setState] = useState<State>(id ? { kind: 'loading' } : { kind: 'none' })
  useEffect(() => {
    if (!id) return
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const ask = async (n: number) => {
      const gift = await giftStatus(id)
      if (!alive) return
      if (!gift) return setState({ kind: 'missing' })
      const confirming = gift.status === 'pending' && gift.method !== 'bank'
      setState({ kind: 'ready', gift, waiting: confirming && n < POLL_TRIES })
      if (confirming && n < POLL_TRIES) timer = setTimeout(() => ask(n + 1), POLL_MS)
    }
    void ask(0)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [id])
  return state
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export default function ThankYou() {
  const [params] = useSearchParams()
  const state = useGift(params.get('gift'))

  return (
    <div className="gutter mx-auto max-w-page py-s5 sm:py-s6">
      <div className="mx-auto max-w-[680px]">
        {state.kind === 'loading' && <Loading />}
        {state.kind === 'none' && <Plain />}
        {state.kind === 'missing' && <Missing />}
        {state.kind === 'ready' && <Gift gift={state.gift} waiting={state.waiting} />}
      </div>
    </div>
  )
}

/* ---------- the four outcomes ---------- */

function Gift({ gift: g, waiting }: { gift: GiftStatus; waiting: boolean }) {
  const total = g.amount + g.fee
  const regular = g.frequency !== 'once'
  const to = g.fundraiserTitle ? `${g.fundraiserTitle}, for ${g.appealTitle}` : (g.appealTitle ?? 'where it is needed most')
  const as = DESIGNATIONS[g.designation as Designation]?.label ?? 'Sadaqah'

  if (g.status === 'succeeded' || g.status === 'refunded') {
    return (
      <>
        <Head
          tick={g.status === 'succeeded'}
          eyebrow={g.status === 'refunded' ? 'Refunded' : 'Donation received'}
          title={g.firstName ? `Thank you, ${g.firstName}` : 'Thank you'}
        >
          Your <span className="nums font-semibold text-text">{formatMoney(g.amount)}</span>
          {regular && ` ${FREQUENCIES[g.frequency as keyof typeof FREQUENCIES].per}`} has gone to{' '}
          <span className="text-text">{to}</span>. May Allah accept it from you and put barakah in what
          remains.
        </Head>

        {g.simulated && (
          <Note tone="amber" title="This was a simulated payment">
            Online payments are not connected to a card processor yet, so no card was charged and no money moved.
            The donation, the receipt and the email are real records, made to show how giving will work.
          </Note>
        )}

        <Card>
          <Facts
            rows={[
              ['Donation', formatMoney(g.amount, { exact: true })],
              ...(g.fee ? ([['Operating costs contribution', formatMoney(g.fee, { exact: true })]] as [string, string][]) : []),
              ['Given as', as],
              ['Paid by', g.method === 'paypal' ? 'PayPal' : 'Card'],
              ...(g.receiptNumber ? ([['Receipt number', g.receiptNumber]] as [string, string][]) : []),
            ]}
            total={['Total', formatMoney(total, { exact: true })]}
          />
          <p className="mt-s2 flex items-start gap-2 text-[14px] leading-relaxed text-text-2">
            <Mail className="mt-[3px] h-4 w-4 shrink-0 text-teal" />
            {g.receiptEmailed
              ? 'Your tax receipt is in your inbox now. Keep it for your return — donations of $2 or more are tax deductible.'
              : 'Your tax receipt is on its way to your inbox.'}
          </p>
          {regular && g.nextChargeAt && (
            <p className="mt-s1 text-[14px] leading-relaxed text-text-2">
              {g.instalments
                ? `Payment 1 of ${g.instalments}. The next is taken on ${day(g.nextChargeAt)}`
                : `Your ${FREQUENCIES[g.frequency as keyof typeof FREQUENCIES].label.toLowerCase()} donation carries on from here. The next payment is on ${day(g.nextChargeAt)}`}
              , and we email you a few days before each one. You can change, pause or stop it yourself, any time.
            </p>
          )}
        </Card>

        <Next />
      </>
    )
  }

  if (g.status === 'pending' && g.method === 'bank') {
    return (
      <>
        <Head eyebrow="One step left" title={g.firstName ? `Nearly there, ${g.firstName}` : 'Nearly there'}>
          Your <span className="nums font-semibold text-text">{formatMoney(g.amount)}</span> donation to{' '}
          <span className="text-text">{to}</span> is waiting for your transfer. Nothing has arrived yet —
          send it from your banking app with the reference below.
        </Head>
        <Card>
          {g.bank && (
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-s3 gap-y-2 text-[15px]">
              <dt className="text-text-3">Account name</dt>
              <dd className="text-text">{g.bank.accountName}</dd>
              <dt className="text-text-3">BSB</dt>
              <dd className="nums font-semibold text-text">{g.bank.bsb}</dd>
              <dt className="text-text-3">Account</dt>
              <dd className="nums font-semibold text-text">{g.bank.accountNumber}</dd>
              <dt className="text-text-3">Amount</dt>
              <dd className="nums font-semibold text-text">{formatMoney(g.amount, { exact: true })}</dd>
              <dt className="text-text-3">Reference</dt>
              <dd>
                <CopyRef value={g.reference ?? ''} />
              </dd>
            </dl>
          )}
          <p className="mt-s3 text-[14px] leading-relaxed text-text-2">
            Please use the reference exactly — it is how we match the money to you. We have emailed these details too.
            Your tax receipt follows the day the transfer reaches us, usually one to two business days.
          </p>
        </Card>
        <Next />
      </>
    )
  }

  if (g.status === 'pending') {
    return (
      <>
        <Head eyebrow={waiting ? 'Confirming' : 'Still confirming'} title="Waiting for the payment to confirm">
          {waiting
            ? `We are waiting to hear from ${g.method === 'paypal' ? 'PayPal' : 'the card processor'} that your ${formatMoney(total)} went through. This usually takes a few seconds.`
            : `We have not heard back from ${g.method === 'paypal' ? 'PayPal' : 'the card processor'} yet. If the payment went through, your receipt will arrive by email as soon as it confirms — there is no need to give again.`}
        </Head>
        {waiting && (
          <div className="mt-s4 h-1 overflow-hidden rounded-full bg-line-2" aria-hidden="true">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-teal/60" />
          </div>
        )}
        {!waiting && <Next />}
      </>
    )
  }

  return (
    <>
      <Head eyebrow="Not taken" title="The payment did not go through">
        Nothing has been charged. {g.failureReason ? `The payment service said: “${g.failureReason}”` : ''}
      </Head>
      <div className="mt-s4 flex flex-wrap gap-s2">
        <Link
          to="/give"
          className="inline-flex min-h-[52px] items-center gap-2.5 rounded-[14px] bg-gold px-6 text-[15.5px] font-semibold text-ink shadow-gold transition-[transform,background-color,color] duration-200 ease-brand hover:-translate-y-[1.5px] hover:bg-gold-dark hover:text-paper"
        >
          <HandHeart className="h-4 w-4" />
          Try again
        </Link>
        <a
          href={`mailto:${ORG.email}?subject=${encodeURIComponent('A donation that did not go through')}`}
          className="inline-flex min-h-[52px] items-center text-[15px] text-teal underline decoration-teal/30 underline-offset-4 hover:decoration-teal"
        >
          Or write to us
        </a>
      </div>
    </>
  )
}

function Plain() {
  return (
    <>
      <Head eyebrow="Thank you" title="Thank you for thinking of us">
        If a donation has just gone through, your tax receipt is on its way to your inbox, and every donation you give is kept
        together in your account.
      </Head>
      <Next />
    </>
  )
}

function Missing() {
  return (
    <>
      <Head eyebrow="Thank you" title="We could not look this donation up just now">
        That does not mean anything went wrong. If the payment went through, your tax receipt arrives by email, and the
        donation is in your account. If you are unsure, write to us at{' '}
        <a href={`mailto:${ORG.email}`} className="text-teal underline decoration-teal/30 underline-offset-4">
          {ORG.email}
        </a>{' '}
        and we will check — please do not give twice.
      </Head>
      <Next />
    </>
  )
}

function Loading() {
  return (
    <div aria-busy="true" aria-label="Looking up your donation">
      <div className="h-3 w-28 animate-pulse rounded bg-line-2" />
      <div className="mt-s2 h-10 w-3/4 animate-pulse rounded bg-line-2" />
      <div className="mt-s2 h-4 w-full animate-pulse rounded bg-line-2" />
      <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-line-2" />
      <div className="mt-s4 h-48 animate-pulse rounded-2xl bg-line-2/70" />
    </div>
  )
}

/* ---------- furniture ---------- */

function Head({ eyebrow, title, tick, children }: { eyebrow: string; title: string; tick?: boolean; children: ReactNode }) {
  return (
    <header style={{ animation: 'hero-rise 620ms var(--ease-brand) both' }}>
      {tick && (
        <span className="mb-s3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-teal text-paper">
          <Check className="h-5 w-5" />
        </span>
      )}
      <p className="text-[11px] font-semibold tracking-[0.13em] text-text-3 uppercase">{eyebrow}</p>
      <h1 className="mt-s1 font-display text-[clamp(32px,4.4vw,48px)] leading-[1.08] tracking-[-0.022em] text-ink">
        {title}
      </h1>
      <p role="status" className="mt-s2 max-w-measure text-[16.5px] leading-relaxed text-text-2">
        {children}
      </p>
    </header>
  )
}

function Card({ children }: { children: ReactNode }) {
  return (
    <section className="mt-s4 rounded-2xl border border-line border-t-2 border-t-teal bg-paper p-s3 sm:p-s4">{children}</section>
  )
}

function Note({ title, tone, children }: { title: string; tone: 'amber'; children: ReactNode }) {
  return (
    <div className={`mt-s3 rounded-[14px] border p-3.5 text-[14px] leading-relaxed ${tone === 'amber' ? 'border-amber/25 bg-amber-pale text-amber' : ''}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-text-2">{children}</p>
    </div>
  )
}

function Facts({ rows, total }: { rows: [string, string][]; total: [string, string] }) {
  return (
    <dl className="text-[15px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-s2 border-b border-line-2 py-2.5">
          <dt className="text-text-2">{k}</dt>
          <dd className="nums text-right text-text">{v}</dd>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-s2 pt-s2">
        <dt className="font-semibold text-text">{total[0]}</dt>
        <dd className="nums font-display text-[26px] leading-none tracking-[-0.02em] text-ink">{total[1]}</dd>
      </div>
    </dl>
  )
}

function CopyRef({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="nums rounded-md bg-teal/[0.08] px-2 py-0.5 font-semibold tracking-[0.04em] text-teal">{value}</span>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          })
        }}
        className="inline-flex items-center gap-1 text-[13px] text-text-3 transition-colors hover:text-teal"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  )
}

function Next() {
  return (
    <nav aria-label="What next" className="mt-s4 grid gap-s2 sm:grid-cols-2">
      <Link
        to="/account"
        className="group flex items-center justify-between gap-s2 rounded-2xl border border-line bg-paper p-s3 transition-[border-color,box-shadow] duration-200 ease-brand hover:border-teal/50 hover:shadow-card"
      >
        <span>
          <span className="block font-semibold text-ink">See it in your account</span>
          <span className="mt-0.5 block text-[14px] text-text-2">Every donation and receipt, and your tax statement</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-teal transition-transform duration-200 group-hover:translate-x-0.5" />
      </Link>
      <Link
        to="/appeals"
        className="group flex items-center justify-between gap-s2 rounded-2xl border border-line bg-paper p-s3 transition-[border-color,box-shadow] duration-200 ease-brand hover:border-teal/50 hover:shadow-card"
      >
        <span>
          <span className="block font-semibold text-ink">Where it goes</span>
          <span className="mt-0.5 block text-[14px] text-text-2">The appeals your donations are working in</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-teal transition-transform duration-200 group-hover:translate-x-0.5" />
      </Link>
    </nav>
  )
}
