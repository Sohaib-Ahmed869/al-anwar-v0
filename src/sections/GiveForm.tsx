import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'

import {
  BACK_BUTTON,
  EMPTY_DONOR,
  Field,
  OperatingCostsChoice,
  LABEL,
  NEXT_BUTTON,
  Tick,
  Underline,
  checkDonor,
  money,
  money2,
  nextIndex,
  type Donor,
  type DonorErrors,
} from '../components/GiveModule'
import {
  APPEALS,
  BANK,
  CAUSES,
  MIN_GIFT,
  TRUST,
  impactOf,
  rungsFor,
  takesMonthly,
} from '../components/give-data'
import TrustBadges from '../components/TrustBadges'
import { BADGE_REPLACES } from '../components/badges-data'
import { GIVE_ANON_LABEL } from '../components/recent-gifts-data'
import { PLACES, appealBySlug } from '../components/appeals-data'
import { useFundraiser } from '../services/fundraisers'
import type { Fundraiser } from '../components/fundraiser-data'
import Reveal, { useInView } from '../components/Reveal'
import { ArrowRight, Check, HandHeart, Lock } from '../components/icons'
import { ORG } from '../components/org-data'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { OPERATING_COSTS, startCheckout, validateGift, type Frequency, type GiftPayload, type Provider } from '../services/give'

/* ---------------------------------------------------------------------------
   /give, section 2 of 3: the form. Everything else on the page is there to
   support this one.

   THREE STEPS — Gift, Details, Pay (16 September 2026, at the user's request)
   Fund, frequency and amount are one step, the way the alihsan.org.au widget
   asks them together; they were two steps (For, Amount) before. The funds are
   label-only chips so the step stays about one screen, and the chosen fund's
   note is said once under them. The furniture — fields, ticks, buttons, the
   donor check, the money formats — is imported from GiveModule.

   IT PICKS UP WHERE THE LINK LEFT OFF
   Nearly every give button on the site lands here with something already
   chosen, and making somebody choose it again is the fastest way to lose them:
     ?designation=zakat&amount=350     the zakat calculator: fund and amount
     ?country=gaza · ?appeal=meals     the home hero: a place, resolved to a
                                       fund through APPEALS in give-data.ts
     ?appeal=tarim-school              an appeal card: its own fund and place,
                                       from appeals-data.ts
     router state { donor }            the home page card, which has already
                                       taken the name and email: straight to Pay
   The form opens on the first step that still has a question in it, and every
   earlier step is lit and clickable so nothing chosen for you is hidden.

   THE SUMMARY TRAVELS BESIDE IT
   A teal panel on the right from lg up (teal since 16 September 2026, to match
   the home page's appeal banner), sticky, with the fund's photograph and
   what the gift does in the display face — HomeAsk's panel, standing up. Under
   lg it follows the form, and a thin bar holding the total sticks to the foot
   of the screen while the form is in view: the zakat calculator's pattern.

   ONE-TIME OR MONTHLY
   Monthly was added on 16 September 2026, reversing the one-time-only call of
   the day before. The control sits between the fund and the amount on the
   Gift step.

   Two rules come with it, and both are enforced in services/give.ts as well as
   here, because that is what the server runs:
     - four funds do not take a monthly gift at all (zakat ul maal, zakat ul
       fitr, kaffarah, fidyah — each is owed once; the fiqh note is in
       give-data.ts). Choosing one while Monthly is on moves the gift back to
       one-time, and the control is replaced by a line saying why.
     - PayPal cannot take one. Choosing Monthly moves the payment to card.
   A gift booked as monthly and charged once would be a real-money bug, which
   is why `frequency` travels on the payload rather than being a display flag.

   PAYING
   The last step chooses Stripe (card, Apple Pay, Google Pay) or PayPal and
   hands the gift to services/give.ts, which asks the server for that
   provider's hosted page and sends the donor there; /thank-you then reads the
   gift back from the server and shows what really happened. The appeal's slug
   rides along (appealSlug, fundraiser) so the gift counts towards the appeal
   it came from. If the endpoint is ever switched off the button says so in
   place — "Online payment is not switched on yet" and the bank details — and
   NEVER shows a success state. Gold is the give button alone, as everywhere;
   every Continue is teal.
--------------------------------------------------------------------------- */

const STEPS = ['Donation', 'Details', 'Pay']

/** GiveModule's Continue, in the logo's teal like the rest of this form. */
const NEXT = NEXT_BUTTON.replace('bg-green', 'bg-teal')

const PROVIDERS: { id: Provider; title: string; note: string }[] = [
  { id: 'stripe', title: 'Credit or debit card', note: 'Apple Pay and Google Pay too, via Stripe' },
  { id: 'paypal', title: 'PayPal', note: 'Pay with your PayPal account' },
]

type Status =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'not-connected' }
  | { kind: 'failed'; message: string }

/** Everything the link and the router state say, resolved once, on arrival. */
function useArrival(fundraiser: Fundraiser | undefined) {
  const [params] = useSearchParams()
  const location = useLocation()

  return useState(() => {
    /* An appeal from /appeals names its own fund and place; a bare place or
       the hero's ?appeal=meals goes through APPEALS in give-data.ts. */
    /* A community fundraiser (/fundraisers/<slug>) gives to its appeal's fund,
       and the fundraiser's own title is what the form says it is for. */
    const named = appealBySlug(fundraiser?.appeal ?? params.get('appeal'))
    const place = named
      ? {
          fund: named.fund,
          label: fundraiser
            ? fundraiser.title
            : named.where
              ? `${named.where}, ${PLACES[named.country]}`
              : PLACES[named.country],
        }
      : (APPEALS[params.get('country') ?? ''] ?? APPEALS[params.get('appeal') ?? ''])
    const fundId =
      params.get('designation') ??
      CAUSES.find((c) => c.slug === params.get('appeal'))?.id ??
      place?.fund
    const causeIndex = Math.max(
      0,
      CAUSES.findIndex((c) => c.id === fundId),
    )
    const hasFund = CAUSES.some((c) => c.id === fundId)

    /* ?frequency=monthly from a campaign link, honoured only where the fund
       takes a monthly gift at all — the same rule the Monthly tab keeps */
    const frequency: Frequency =
      params.get('frequency') === 'monthly' && takesMonthly(CAUSES[causeIndex]) ? 'monthly' : 'once'

    const raw = parseFloat(params.get('amount') ?? '')
    const amount = Number.isFinite(raw) && raw >= MIN_GIFT ? raw : null
    const rung =
      amount === null ? -1 : rungsFor(CAUSES[causeIndex], frequency).findIndex((a) => a.value === amount)

    const handed = (location.state as { donor?: Donor } | null)?.donor
    const donor = handed ? { ...EMPTY_DONOR, ...handed } : EMPTY_DONOR
    const donorDone = !!handed && Object.keys(checkDonor(donor)).length === 0

    const step = !hasFund || amount === null ? 0 : donorDone ? 2 : 1
    return {
      causeIndex,
      frequency,
      appeal: place && hasFund && CAUSES[causeIndex].id === place.fund ? place.label : null,
      /** for the server, so the gift counts towards the appeal it came from */
      appealSlug: named?.slug,
      fundraiserSlug: fundraiser?.slug,
      chosen: amount === null ? 0 : rung >= 0 ? rung : null,
      typed: amount !== null && rung < 0 ? String(amount) : '',
      donor,
      /* The operating-costs contribution the home card chose, as ?ops= in
         dollars. Anything not on the list is ignored rather than trusted, and
         a cold link starts on "No thanks": the contribution is opt-in. */
      operatingCosts: OPERATING_COSTS.includes(Number(params.get('ops'))) ? Number(params.get('ops')) : 0,
      step,
      /** the link chose something, so the reader lands on the form */
      prefilled:
        ['appeal', 'designation', 'amount', 'country', 'fundraiser', 'frequency'].some((k) => params.has(k)) || !!handed,
    }
  })[0]
}

/* A gift for a community fundraiser waits for the fundraiser to arrive from
   the server, because everything the form starts with is read from it once. */
export default function GiveForm() {
  const [params] = useSearchParams()
  const { fundraiser, ready } = useFundraiser(params.get('fundraiser'))
  if (!ready) return <div className="min-h-[70svh]" aria-busy="true" />
  return <GiveFormReady fundraiser={fundraiser} />
}

function GiveFormReady({ fundraiser }: { fundraiser: Fundraiser | undefined }) {
  const uid = useId()
  const start = useArrival(fundraiser)

  const [step, setStep] = useState(start.step)
  const [reached, setReached] = useState(start.step)
  const [causeIndex, setCauseIndex] = useState(start.causeIndex)
  const [appeal, setAppeal] = useState<string | null>(start.appeal)
  const [frequency, setFrequency] = useState<Frequency>(start.frequency)
  const [chosen, setChosen] = useState<number | null>(start.chosen)
  const [typed, setTyped] = useState(start.typed)
  const [amountError, setAmountError] = useState('')
  const [donor, setDonor] = useState<Donor>(start.donor)
  const [errors, setErrors] = useState<DonorErrors>({})
  /* dollars, one of OPERATING_COSTS; 0 is "No thanks" */
  const [operatingCosts, setOperatingCosts] = useState(start.operatingCosts)
  const [provider, setProvider] = useState<Provider>('stripe')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const cause = CAUSES[causeIndex]
  const monthly = frequency === 'monthly'
  /* The same ladder the hero's card shows, from give-data, so the two can never
     offer different rungs for the same gift. */
  const rungs = rungsFor(cause, frequency)
  const typedAmount = parseFloat(typed.replace(/[^\d.]/g, ''))
  const custom = typedAmount > 0
  const rung = rungs[chosen ?? 0]
  const amount = custom ? typedAmount : (rung?.value ?? 0)
  const rungLabel = custom ? null : (rung?.label ?? null)
  const total = amount + operatingCosts
  const impact = monthly
    ? `${money(amount * 12)} a year to ${cause.appeal}`
    : impactOf({ cause, amount, impact: rungLabel })
  /** what the donor is charged on the day, said the same way everywhere */
  const each = monthly ? ' a month' : ''

  /* The step that has just arrived takes the focus — but not on the first
     render, or the page would open scrolled to the form past its own header.

     preventScroll, because the panel swaps in place: the reader is already
     looking at it, and without this the browser's own scroll-into-view fights
     the one the hero's handover asks for below. */
  const panelRef = useRef<HTMLDivElement>(null)
  const moved = useRef(false)
  useEffect(() => {
    if (moved.current) panelRef.current?.focus({ preventScroll: true })
    moved.current = true
  }, [step])

  const go = (to: number) => {
    setStep(to)
    setReached((r) => Math.max(r, to))
    setStatus({ kind: 'idle' })
  }

  /* PayPal cannot take a recurring gift here — recurring PayPal needs a billing
     plan created in advance and nothing in this repo creates one. Rather than
     let the Pay step offer a choice that would be refused, choosing Monthly
     moves the payment to card and the PayPal tile says why. */
  useEffect(() => {
    if (monthly && provider === 'paypal') setProvider('stripe')
  }, [monthly, provider])

  const forward = () => {
    if (step === 0 && amount < MIN_GIFT) {
      setAmountError(`The smallest donation we can take is $${MIN_GIFT}.`)
      document.getElementById(`${uid}-own`)?.focus()
      return
    }
    if (step === 1) {
      const bad = checkDonor(donor)
      setErrors(bad)
      const first = (['first', 'last', 'email', 'behalfName'] as const).find((k) => bad[k])
      if (first) {
        document.getElementById(`${uid}-${first === 'behalfName' ? 'behalf' : first}`)?.focus()
        return
      }
    }
    go(step + 1)
  }

  const setField = <K extends keyof Donor>(key: K, value: Donor[K]) => {
    setDonor((d) => ({ ...d, [key]: value }))
    setErrors((bad) => {
      if (!(key in bad)) return bad
      const { [key as keyof DonorErrors]: _gone, ...rest } = bad
      return rest
    })
  }

  /* A fund brings its own ladder, so the old rung may not exist in the new one.
     Choosing a different fund also lets go of the place the link came with,
     unless it is the fund that place resolves to. */
  const pickCause = (i: number) => {
    setCauseIndex(i)
    /* A fund that is owed once cannot be monthly, so choosing one takes the
       gift back to one-time rather than refusing the click. */
    if (!takesMonthly(CAUSES[i])) setFrequency('once')
    setChosen(0)
    setTyped('')
    setAmountError('')
    setAppeal(i === start.causeIndex ? start.appeal : null)
  }

  /* Every ladder is a different ladder, so the rung that was lit may not exist
     in the new one — the same reason pickCause resets it. */
  const pickFrequency = (to: Frequency) => {
    setFrequency(to)
    setChosen(0)
    setTyped('')
    setAmountError('')
  }

  const pick = (i: number) => {
    setChosen(i)
    setTyped('')
    setAmountError('')
  }

  const handleTyped = (value: string) => {
    setTyped(value)
    setAmountError('')
    const n = parseFloat(value.replace(/[^\d.]/g, ''))
    if (n > 0) setChosen(null)
    else if (chosen === null) setChosen(0)
  }

  const causeRefs = useRef<(HTMLButtonElement | null)[]>([])
  const rungRefs = useRef<(HTMLButtonElement | null)[]>([])
  const providerRefs = useRef<(HTMLButtonElement | null)[]>([])

  const onCauseKey = (e: KeyboardEvent) => {
    const i = nextIndex(e.key, causeIndex, CAUSES.length)
    if (i === null) return
    e.preventDefault()
    pickCause(i)
    causeRefs.current[i]?.focus()
  }
  const onLadderKey = (e: KeyboardEvent) => {
    const i = nextIndex(e.key, chosen ?? 0, rungs.length)
    if (i === null) return
    e.preventDefault()
    pick(i)
    rungRefs.current[i]?.focus()
  }
  const onProviderKey = (e: KeyboardEvent) => {
    /* Monthly leaves one payable tile, so the arrow keys have nowhere to go. */
    if (monthly) return
    const from = PROVIDERS.findIndex((p) => p.id === provider)
    const i = nextIndex(e.key, from, PROVIDERS.length)
    if (i === null) return
    e.preventDefault()
    setProvider(PROVIDERS[i].id)
    providerRefs.current[i]?.focus()
  }

  const pay = async () => {
    const payload: GiftPayload = {
      fund: cause.id,
      appeal: appeal ?? undefined,
      /* only while the form is still giving to that appeal: changing the fund
         clears `appeal`, and the slug goes with it */
      appealSlug: appeal ? start.appealSlug : undefined,
      fundraiser: appeal ? start.fundraiserSlug : undefined,
      frequency,
      amount,
      operatingCosts,
      provider,
      first: donor.first,
      last: donor.last,
      email: donor.email,
      behalfName: donor.behalf ? donor.behalfName : '',
      updates: donor.updates,
      anonymous: Boolean(donor.anonymous),
    }
    /* The same rules the server applies (shared/giving.ts), run here first so
       a gift it would refuse is caught before the round trip. A problem with
       the donor's details takes them back to that step with the field marked;
       anything else is said under the button. */
    const bad = validateGift(payload)
    const field = (['first', 'last', 'email'] as const).find((k) => bad[k])
    if (field) {
      setErrors({ [field]: bad[field] })
      go(1)
      return
    }
    const message = Object.values(bad)[0]
    if (message) {
      setStatus({ kind: 'failed', message })
      return
    }
    setStatus({ kind: 'busy' })
    const result = await startCheckout(payload)
    if (result.kind === 'redirect') window.location.assign(result.url)
    else setStatus(result)
  }

  const labelled = rungs.some((r) => r.label)
  const [summaryRef, summaryIn] = useInView<HTMLElement>()

  return (
    <section
      id="give-form"
      /* A link that fills the form in lands here, not on the hero above
         (16 September 2026, client's request): the Donate buttons on
         /appeals, a single appeal, the home banner, the zakat calculator and
         the quick give all carry what they chose, and the reader should see it
         chosen. A plain /give, from the header's Donate, still opens on the
         hero. Layout does the scrolling; see data-land there. */
      data-land={start.prefilled ? '' : undefined}
      aria-labelledby="give-form-head"
      className={`scroll-mt-[var(--header-h)] ${SECTION_Y}`}
    >
      <div className="gutter mx-auto max-w-page">
        <SectionHead id="give-form-head" eyebrow="Give today" title="Where should your donation go?" />
        <div
          className={`mt-s4 grid gap-s3 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-s4 ${BREAKOUT}`}
        >
          {/* ============ the form, with the phone bar at its foot ============
              Set down as it scrolls in (Reveal `scale`). Reveal's wrapper ends
              on `transform: none`, so the sticky phone bar inside still sticks. */}
          <Reveal variant="scale" delay={200}>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="rounded-2xl border border-line bg-paper p-s3 shadow-card sm:p-s4"
            >
              {/* --- the stepper: GiveModule's --- */}
              <ol className="flex items-center">
                {STEPS.map((name, i) => {
                  const done = i < step
                  const now = i === step
                  const open = i <= reached
                  return (
                    <li
                      key={name}
                      className={`flex items-center ${i ? 'min-w-0 flex-1' : 'shrink-0'}`}
                    >
                      {i > 0 && (
                        <span
                          aria-hidden="true"
                          className={`mx-2 h-px min-w-3 flex-1 transition-colors duration-300 ease-brand ${
                            i <= step ? 'bg-teal' : 'bg-line'
                          }`}
                        />
                      )}
                      <button
                        type="button"
                        disabled={!open}
                        aria-current={now ? 'step' : undefined}
                        onClick={() => open && go(i)}
                        className={`flex shrink-0 items-center gap-2 rounded-full transition-opacity duration-200 ease-brand ${
                          open ? 'cursor-pointer hover:opacity-70' : 'cursor-default'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`grid h-[28px] w-[28px] shrink-0 place-items-center rounded-full text-[12.5px] font-semibold transition-[background-color,border-color,color] duration-300 ease-brand ${
                            done
                              ? 'bg-teal text-paper'
                              : now
                                ? 'bg-ink text-paper'
                                : 'border border-line text-text-3'
                          }`}
                        >
                          {done ? <Check className="h-[11px] w-[11px]" /> : i + 1}
                        </span>
                        <span
                          className={`text-[13.5px] font-semibold whitespace-nowrap transition-colors duration-300 ease-brand ${
                            now
                              ? 'inline text-ink'
                              : `hidden sm:inline ${done ? 'text-text-2' : 'text-text-3'}`
                          }`}
                        >
                          <span className="sr-only">Step {i + 1}: </span>
                          {name}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>

              <div
                key={step}
                ref={panelRef}
                tabIndex={-1}
                className="mt-s4 focus:outline-none"
                style={{ animation: 'hero-rise 380ms var(--ease-brand) both' }}
              >
                {/* ======================= 1 · GIFT ======================= */}
                {step === 0 && (
                  <>
                    <h3 id={`${uid}-for`} className="text-[20px] font-semibold tracking-[-0.012em]">
                      Fund and amount
                    </h3>

                    {/* --- the fund ---
                        Label-only chips, so fund, frequency and amount fit one
                        step. The chosen fund's note is said once, under them. */}
                    <p id={`${uid}-fund`} className={`${LABEL} mt-s3`}>
                      Give to
                    </p>
                    <div
                      role="radiogroup"
                      aria-labelledby={`${uid}-fund`}
                      onKeyDown={onCauseKey}
                      className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3"
                    >
                      {CAUSES.map((c, i) => {
                        const on = causeIndex === i
                        return (
                          <button
                            key={c.id}
                            ref={(el) => {
                              causeRefs.current[i] = el
                            }}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            tabIndex={on ? 0 : -1}
                            onClick={() => pickCause(i)}
                            className={`flex min-h-[46px] items-center justify-between gap-2 rounded-[12px] border px-3 text-left text-[14px] font-semibold transition-[border-color,background-color,box-shadow,color] duration-200 ease-brand ${
                              on
                                ? 'border-teal bg-teal text-paper'
                                : 'border-line bg-paper text-ink hover:border-teal/50'
                            }`}
                          >
                            <span className="min-w-0 truncate">{c.label}</span>
                            {on && <Check className="h-[11px] w-[11px] shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-2 text-[13px] leading-[1.45] text-text-2">
                      {cause.note}
                      {appeal && <span className="text-text-3"> · {appeal}</span>}
                      {cause.arabic && (
                        <span
                          dir="rtl"
                          lang="ar"
                          className="ml-2 font-arabic text-[14px] text-teal"
                        >
                          {cause.arabic}
                        </span>
                      )}
                    </p>

                    {/* --- how often ---
                        Only where the fund takes a monthly gift at all. The four
                        that are owed once say so in place of the control, and
                        choosing one of them while Monthly is on moves the gift
                        back to one-time (pickCause). */}
                    <p id={`${uid}-often`} className={`${LABEL} mt-s3`}>
                      How often
                    </p>
                    {takesMonthly(cause) ? (
                      <div
                        role="radiogroup"
                        aria-labelledby={`${uid}-often`}
                        className="mt-2 flex gap-1 rounded-[14px] bg-paper-2 p-1 ring-1 ring-line"
                      >
                        {(
                          [
                            { id: 'once', label: 'One-time' },
                            { id: 'monthly', label: 'Monthly' },
                          ] as { id: Frequency; label: string }[]
                        ).map((f) => {
                          const on = frequency === f.id
                          return (
                            <button
                              key={f.id}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              onClick={() => pickFrequency(f.id)}
                              className={`min-h-[40px] flex-1 rounded-[10px] px-3 text-[14px] font-semibold tracking-[-0.006em] transition-[background-color,color,box-shadow] duration-200 ease-brand ${
                                on ? 'bg-teal text-paper' : 'text-text-2 hover:text-ink'
                              }`}
                            >
                              {f.label}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="mt-2 flex min-h-[48px] items-center rounded-[14px] bg-paper-2 px-3.5 text-[13.5px] text-text-2 ring-1 ring-line">
                        One-time. {cause.label} is owed once, so it isn&rsquo;t offered monthly.
                      </p>
                    )}

                    {/* --- how much --- */}
                    <p id={`${uid}-how`} className={`${LABEL} mt-s3`}>
                      Amount (AUD{each})
                    </p>
                    <div
                      role="radiogroup"
                      aria-labelledby={`${uid}-how`}
                      onKeyDown={onLadderKey}
                      className="mt-2 grid grid-cols-3 gap-2.5"
                    >
                      {rungs.map((a, i) => {
                        const on = chosen === i
                        return (
                          <button
                            key={a.value}
                            ref={(el) => {
                              rungRefs.current[i] = el
                            }}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            tabIndex={(chosen ?? 0) === i ? 0 : -1}
                            onClick={() => pick(i)}
                            className={`flex flex-col items-start rounded-[14px] border p-3 text-left transition-[transform,border-color,background-color,box-shadow] duration-200 ease-brand sm:p-4 ${
                              labelled ? 'min-h-[100px]' : 'min-h-[68px]'
                            } ${
                              on
                                ? 'border-teal bg-teal text-paper'
                                : 'border-line bg-paper hover:border-teal/50'
                            }`}
                          >
                            <span className="flex w-full items-start justify-between gap-1">
                              <span
                                className={`nums font-display text-[21px] leading-none tracking-[-0.02em] sm:text-[28px] ${
                                  on ? 'text-paper' : 'text-ink'
                                }`}
                              >
                                {money(a.value)}
                                {monthly && (
                                  <span
                                    className={`text-[13px] font-medium tracking-normal ${on ? 'text-paper/70' : 'text-text-3'}`}
                                  >
                                    /mo
                                  </span>
                                )}
                              </span>
                              <span
                                aria-hidden="true"
                                className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-paper text-teal transition-[opacity,transform] duration-200 ease-brand ${
                                  on ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                                }`}
                              >
                                <Check className="h-[10px] w-[10px]" />
                              </span>
                            </span>
                            {a.label && (
                              <span
                                className={`mt-auto pt-2 text-[12.5px] leading-[1.3] ${on ? 'text-paper/80' : 'text-text-2'}`}
                              >
                                {a.label}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    <label htmlFor={`${uid}-own`} className="sr-only">
                      Other amount (AUD{each})
                    </label>
                    <div className="relative mt-s2">
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 font-display text-[21px] leading-none transition-colors duration-200 ease-brand ${
                          custom ? 'text-teal' : 'text-text-3'
                        }`}
                      >
                        $
                      </span>
                      <input
                        id={`${uid}-own`}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="Other amount"
                        value={typed}
                        onChange={(e) => handleTyped(e.target.value)}
                        aria-invalid={amountError ? 'true' : undefined}
                        aria-describedby={amountError ? `${uid}-own-bad` : undefined}
                        className={`nums peer block w-full border-b bg-transparent py-2 pl-5 font-display text-[21px] tracking-[-0.01em] transition-colors duration-200 placeholder:text-[15px] placeholder:font-normal placeholder:tracking-normal placeholder:text-text-3 focus:outline-none ${
                          amountError
                            ? 'border-alert'
                            : custom
                              ? 'border-teal text-teal'
                              : 'border-line text-text'
                        }`}
                      />
                      <Underline bad={!!amountError} />
                    </div>
                    {amountError && (
                      <p id={`${uid}-own-bad`} className="mt-1 text-[13px] text-alert">
                        {amountError}
                      </p>
                    )}

                    <button type="button" onClick={forward} className={`${NEXT} mt-s4 w-full`}>
                      Continue
                      <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                    </button>
                  </>
                )}

                {/* ======================= 2 · DETAILS ======================= */}
                {step === 1 && (
                  <>
                    <h3 className="text-[20px] font-semibold tracking-[-0.012em]">Your details</h3>
                    <p className="mt-1 text-[13.5px] text-text-2">
                      For your receipt. Nothing else, and never passed on.
                    </p>

                    <div className="mt-s3 grid gap-s3 sm:grid-cols-2">
                      <Field
                        id={`${uid}-first`}
                        label="First name"
                        value={donor.first}
                        onChange={(v) => setField('first', v)}
                        error={errors.first}
                        autoComplete="given-name"
                      />
                      <Field
                        id={`${uid}-last`}
                        label="Last name"
                        value={donor.last}
                        onChange={(v) => setField('last', v)}
                        error={errors.last}
                        autoComplete="family-name"
                      />
                    </div>
                    <div className="mt-s3">
                      <Field
                        id={`${uid}-email`}
                        label="Email"
                        type="email"
                        value={donor.email}
                        onChange={(v) => setField('email', v)}
                        error={errors.email}
                        autoComplete="email"
                      />
                    </div>

                    <div className="mt-s3 rounded-[14px] border border-line-2 bg-paper-2/60 p-3.5">
                      <Tick checked={donor.behalf} onChange={(v) => setField('behalf', v)}>
                        Give on behalf of someone else
                      </Tick>
                      {donor.behalf && (
                        <div
                          className="mt-3"
                          style={{ animation: 'hero-rise 380ms var(--ease-brand) both' }}
                        >
                          <Field
                            id={`${uid}-behalf`}
                            label="Their name"
                            value={donor.behalfName}
                            onChange={(v) => setField('behalfName', v)}
                            error={errors.behalfName}
                          />
                        </div>
                      )}
                    </div>

                    <Tick
                      checked={donor.updates}
                      onChange={(v) => setField('updates', v)}
                      className="mt-s3"
                    >
                      Keep me updated on this project
                    </Tick>

                    <Tick
                      checked={Boolean(donor.anonymous)}
                      onChange={(v) => setField('anonymous', v)}
                      className="mt-s2"
                    >
                      {GIVE_ANON_LABEL}
                    </Tick>

                    <div className="mt-s4 flex gap-2">
                      <button type="button" onClick={() => go(0)} className={BACK_BUTTON}>
                        Back
                      </button>
                      <button type="button" onClick={forward} className={NEXT}>
                        Continue
                        <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                      </button>
                    </div>
                  </>
                )}

                {/* ======================= 3 · PAY ======================= */}
                {step === 2 && (
                  <>
                    <h3 className="text-[20px] font-semibold tracking-[-0.012em]">Check and pay</h3>

                    <dl className="mt-s3 border-y border-line text-[14px]">
                      <SummaryRow label="Donation" onChange={() => go(0)}>
                        <span className="nums font-semibold text-text">{money(amount)}</span>
                        {each} to {cause.label}
                        {appeal && <span className="text-text-3"> · {appeal}</span>}
                      </SummaryRow>
                      <SummaryRow label="From" onChange={() => go(1)}>
                        <span className="break-words">
                          {donor.first} {donor.last} · {donor.email}
                        </span>
                        {donor.behalf && donor.behalfName && (
                          <span className="block text-text-3">On behalf of {donor.behalfName}</span>
                        )}
                      </SummaryRow>
                    </dl>

                    {/* 0% admin fee, then the optional operating costs (28
                        September 2026, replacing the card-fee tick). On a
                        monthly donation it is added to every payment. */}
                    <OperatingCostsChoice
                      value={operatingCosts}
                      onChange={setOperatingCosts}
                      tone="teal"
                      className="mt-s3"
                    />

                    <p id={`${uid}-method`} className={`${LABEL} mt-s3`}>
                      Pay with
                    </p>
                    <div
                      role="radiogroup"
                      aria-labelledby={`${uid}-method`}
                      onKeyDown={onProviderKey}
                      className="mt-2 grid gap-2.5 sm:grid-cols-2"
                    >
                      {PROVIDERS.map((p, i) => {
                        const on = provider === p.id
                        /* PayPal cannot take a recurring gift here. Disabled and
                           explained rather than removed: a payment method that
                           disappeared between two visits would look like a fault,
                           and the reason is a real one. */
                        const off = monthly && p.id === 'paypal'
                        return (
                          <button
                            key={p.id}
                            ref={(el) => {
                              providerRefs.current[i] = el
                            }}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            disabled={off}
                            tabIndex={on ? 0 : -1}
                            onClick={() => {
                              setProvider(p.id)
                              setStatus({ kind: 'idle' })
                            }}
                            className={`flex items-start gap-3 rounded-[14px] border p-3.5 text-left transition-[border-color,background-color,box-shadow,opacity] duration-200 ease-brand ${
                              off
                                ? 'cursor-not-allowed border-line-2 bg-paper-2/60 opacity-60'
                                : on
                                  ? 'border-teal bg-teal/[0.06] shadow-[inset_0_0_0_1px_var(--color-teal)]'
                                  : 'border-line bg-paper hover:border-teal/50'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`mt-[2px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border transition-colors duration-200 ${
                                on ? 'border-teal bg-teal' : 'border-line bg-paper'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full bg-paper ${on ? 'opacity-100' : 'opacity-0'}`}
                              />
                            </span>
                            <span>
                              <span
                                className={`block text-[14.5px] font-semibold ${on ? 'text-teal' : 'text-ink'}`}
                              >
                                {p.title}
                              </span>
                              <span className="block text-[12.5px] text-text-2">
                                {off ? 'Not available for a monthly donation' : p.note}
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    <div className="mt-s3 flex items-end justify-between gap-4 border-t border-line-2 pt-3">
                      <div className="min-w-0">
                        <p className={LABEL}>{monthly ? 'Charged each month' : 'Charged today'}</p>
                        <p className="mt-1 text-[12.5px] leading-[1.4] text-text-3">
                          <span className="nums">{money(amount)}</span> donation
                          {operatingCosts > 0 && (
                            <>
                              {' + '}
                              <span className="nums">{money2(operatingCosts)}</span> operating costs
                            </>
                          )}
                        </p>
                      </div>
                      <p className="nums shrink-0 font-display text-[clamp(26px,2.8vw,34px)] leading-none tracking-[-0.022em]">
                        {money2(total)}
                        {monthly && (
                          <span className="text-[15px] font-medium tracking-normal text-text-3">
                            /mo
                          </span>
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={pay}
                      disabled={status.kind === 'busy'}
                      className="group relative mt-s2 flex min-h-[60px] w-full items-center justify-center gap-2.5 overflow-hidden rounded-[14px] bg-gold px-6 text-[16.5px] font-semibold tracking-[-0.006em] text-ink shadow-gold transition-[transform,box-shadow,background-color,color,opacity] duration-200 ease-brand hover:-translate-y-[1.5px] hover:bg-gold-dark hover:text-paper hover:shadow-gold-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-70"
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 -left-full w-full bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,0.55)_50%,transparent_80%)] transition-transform duration-[750ms] ease-brand group-hover:translate-x-[250%]"
                      />
                      <HandHeart className="relative h-[17px] w-[17px] shrink-0 transition-transform duration-300 ease-brand group-hover:scale-[1.14]" />
                      <span className="relative">
                        {status.kind === 'busy' ? (
                          'Opening secure payment…'
                        ) : (
                          <>
                            Give <span className="nums">{money2(total)}</span>
                            {each}
                          </>
                        )}
                      </span>
                    </button>

                    {/* What happened when the button was pressed. A live region,
                        and never a tick: nothing on this page may say a gift went
                        through, because nothing on this page can know. */}
                    <div aria-live="polite">
                      {status.kind === 'not-connected' && (
                        <div
                          className="mt-s2 rounded-[14px] border border-line bg-paper-2 p-3.5 text-[13.5px] leading-relaxed text-text-2"
                          style={{ animation: 'hero-rise 380ms var(--ease-brand) both' }}
                        >
                          <p className="font-semibold text-text">
                            Online payment isn&rsquo;t switched on yet.
                          </p>
                          <p className="mt-1">
                            Nothing has been charged. You can give today by bank transfer.
                          </p>
                          {/* The details themselves, here: the "Other ways to
                              give" band this used to link to was removed on 16
                              September 2026 at the user's request. */}
                          <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-s2 gap-y-1">
                            <dt className="text-text-3">Account name</dt>
                            <dd className="text-text">{BANK.name}</dd>
                            <dt className="text-text-3">BSB</dt>
                            <dd className="nums font-semibold text-text">{BANK.bsb}</dd>
                            <dt className="text-text-3">Account</dt>
                            <dd className="nums font-semibold text-text">{BANK.account}</dd>
                            <dt className="text-text-3">Reference</dt>
                            <dd className="text-text">Your name and the fund</dd>
                          </dl>
                          <p className="mt-2">
                            Then email{' '}
                            <a
                              href={`mailto:${ORG.email}?subject=${encodeURIComponent('Bank transfer receipt')}`}
                              className="font-semibold text-teal underline decoration-teal/30 underline-offset-4 hover:text-ink"
                            >
                              {ORG.email}
                            </a>{' '}
                            and we&rsquo;ll send your tax receipt.
                          </p>
                        </div>
                      )}
                      {status.kind === 'failed' && (
                        <p className="mt-s2 text-[13.5px] text-alert">
                          {status.message} Nothing has been charged.
                        </p>
                      )}
                    </div>

                    <p className="mt-2.5 flex items-start justify-center gap-1.5 text-center text-[12.5px] leading-relaxed text-text-3">
                      <Lock className="mt-[3px] h-3 w-3 shrink-0" />
                      You finish on {provider === 'paypal' ? 'PayPal' : 'Stripe'}&rsquo;s secure
                      page. We never see your card.
                    </p>
                  </>
                )}
              </div>
            </form>

            {/* The running total, for phones. aria-hidden: the form says it. */}
            <div
              aria-hidden="true"
              className="sticky bottom-0 z-10 -mx-[var(--gutter)] mt-s2 px-[var(--gutter)] pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden"
            >
              <div className="flex items-center justify-between gap-s2 rounded-[12px] bg-teal px-s2 py-3 shadow-nav">
                <span className="min-w-0 truncate text-[13px] text-paper/70">
                  {cause.label}
                  {monthly && ' · monthly'}
                </span>
                <span className="nums text-[18px] font-semibold text-paper">
                  {money2(total)}
                  {monthly && <span className="text-[12px] font-medium text-paper/60">/mo</span>}
                </span>
              </div>
            </div>
          </Reveal>

          {/* ============ the summary ============
              Rises in just behind the form. Not wrapped in a Reveal: a wrapper
              would be the sticky summary's containing block and stop it
              sticking, so the aside watches for itself. */}
          <aside
            ref={summaryRef}
            aria-label="Your donation so far"
            className="overflow-hidden rounded-2xl bg-teal text-paper lg:sticky lg:top-[calc(var(--header-h)+24px)]"
            style={{
              opacity: summaryIn ? 1 : 0,
              transform: summaryIn ? 'none' : 'translate3d(0, 48px, 0)',
              transition:
                'opacity 900ms var(--ease-reveal) 380ms, transform 1300ms var(--ease-reveal) 380ms',
            }}
          >
            <img
              key={cause.photo}
              src={`/assets/images/${cause.photo}-1200.jpg`}
              alt={cause.alt}
              width={1200}
              height={800}
              decoding="async"
              className="h-44 w-full object-cover sm:h-56 lg:h-52"
              style={{
                objectPosition: cause.position,
                animation: 'fade-in 520ms var(--ease-brand) both',
              }}
            />
            <div className="p-s3 sm:p-s4">
              <p className="font-script text-[clamp(24px,2.1vw,30px)] leading-none text-gold-pale">
                {cause.label}
              </p>
              {(appeal || monthly) && (
                <p className="mt-1.5 text-[13px] text-paper/65">
                  {appeal}
                  {appeal && monthly && ' · '}
                  {monthly && 'Every month'}
                </p>
              )}
              <p
                key={impact}
                className="mt-1.5 font-display text-[clamp(22px,2.1vw,28px)] leading-[1.14] tracking-[-0.018em] text-balance"
                style={{ animation: 'hero-rise 420ms var(--ease-brand) both' }}
              >
                {impact}.
              </p>

              <dl className="mt-s3 border-b border-paper/15 text-[14px]">
                <div className="flex justify-between gap-s2 border-t border-paper/15 py-2.5">
                  <dt className="text-paper/60">Donation</dt>
                  <dd className="nums text-paper/90">{money2(amount)}</dd>
                </div>
                <div className="flex justify-between gap-s2 border-t border-paper/15 py-2.5">
                  <dt className="text-paper/60">Operating costs</dt>
                  <dd className="nums text-paper/90">{operatingCosts ? money2(operatingCosts) : 'None'}</dd>
                </div>
                <div className="flex justify-between gap-s2 border-t border-paper/15 py-2.5">
                  <dt className="font-semibold">{monthly ? 'Each month' : 'Total'}</dt>
                  <dd className="nums font-semibold">
                    {money2(total)}
                    {monthly && <span className="text-[12px] font-medium text-paper/60">/mo</span>}
                  </dd>
                </div>
              </dl>

              <p className="mt-s2 text-[12.5px] leading-relaxed text-paper/65">
                {monthly
                  ? 'Charged on this date each month until you stop it, with a receipt every time.'
                  : 'A one-time donation, with a receipt by email.'}
              </p>

              {/* The four trust facts, beside the button rather than in a band of
                  their own below the form (removed 16 September 2026): this is
                  where a donor who hesitates is looking. Plain ruled lines, the
                  way the summary above them is set. */}
              {/* The first two facts are badges since 28 September 2026
                  (client feedback): components/TrustBadges.tsx. The list
                  under them leaves out the two titles they replace. */}
              <TrustBadges tone="dark" className="mt-s3" />
              <ul className="mt-s2 border-t border-paper/15 text-[13px] leading-[1.45]">
                {TRUST.filter((t) => !BADGE_REPLACES.includes(t.title)).map((t) => (
                  <li key={t.title} className="border-b border-paper/15 py-2.5">
                    {t.to ? (
                      <Link
                        to={t.to}
                        className="font-semibold text-paper underline decoration-paper/30 underline-offset-[3px] transition-colors duration-200 ease-brand hover:decoration-paper"
                      >
                        {t.title}
                      </Link>
                    ) : (
                      <span className="font-semibold text-paper">{t.title}</span>
                    )}
                    <span className="block text-paper/65">{t.body}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}

function SummaryRow({
  label,
  onChange,
  children,
}: {
  label: string
  onChange: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-line-2 py-3 first:border-t-0">
      <div className="min-w-0">
        <dt className="text-[12px] text-text-3">{label}</dt>
        <dd className="mt-0.5 leading-[1.45] text-text-2">{children}</dd>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 text-[13px] font-semibold text-teal underline decoration-teal/35 underline-offset-2 transition-colors duration-200 ease-brand hover:text-ink hover:decoration-ink/40"
      >
        Change
      </button>
    </div>
  )
}
