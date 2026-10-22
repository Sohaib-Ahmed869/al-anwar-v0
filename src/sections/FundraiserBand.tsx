import { HeroBrand } from '../components/Brand'
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'

import { fundraiserGiveHref, fundraiserPhoto } from '../components/FundraiserCard'
import { REASONS, type Fundraiser } from '../components/fundraiser-data'
import { CAUSES, MIN_GIFT } from '../components/give-data'
import { PLACES, type Appeal } from '../components/appeals-data'
import { APPEAL_DETAIL } from '../components/appeal-detail-data'
import { money } from '../components/appeal-view'
import { ArrowRight, Lock } from '../components/icons'
import { daysLeft, percentOf } from '../services/fundraisers'

/* ---------------------------------------------------------------------------
   A single fundraiser, section 1: the hero and the give card.

   The single appeal's hero (AppealBand) with a fundraiser in it: the photo
   behind the header, darkened; on the left the reason, the title, who
   started it and the appeal it raises for; on the right a teal card with the
   progress, the fund's own amounts, and Give, which goes to /give with the
   fundraiser and the amount on the link. The give form books it to the
   appeal's fund.

   No following bar here, unlike AppealGiveBox: the page is short enough that
   the card and the Donate button in the supporters panel cover it.
--------------------------------------------------------------------------- */

export default function FundraiserBand({ fundraiser: f, appeal }: { fundraiser: Fundraiser; appeal: Appeal }) {
  const uid = useId()
  const photo = fundraiserPhoto(f)
  const pct = percentOf(f)
  const days = daysLeft(f.ends)
  const reason = REASONS.find((o) => o.id === f.reason)?.label
  /* the appeal's own ladder where it has one (Gaza meals), as on its page */
  const ladder = (APPEAL_DETAIL[appeal.slug]?.ladder ?? CAUSES.find((c) => c.id === appeal.fund)?.amounts ?? []).slice(0, 6)

  const [chosen, setChosen] = useState(Math.min(1, ladder.length - 1))
  const [typed, setTyped] = useState('')
  const typedAmount = parseFloat(typed.replace(/[^\d.]/g, ''))
  const tooSmall = typedAmount > 0 && typedAmount < MIN_GIFT
  const amount = tooSmall ? MIN_GIFT : typedAmount > 0 ? typedAmount : (ladder[chosen]?.value ?? 25)

  const rise = (delay: number) => ({ animation: `hero-soft 1000ms var(--ease-reveal) ${delay}ms both` })

  return (
    <section
      data-overlay-hero=""
      aria-labelledby="fundraiser-title"
      className="relative isolate mt-[calc(var(--header-h)*-1)] overflow-hidden bg-ink"
    >
      <div aria-hidden="true" className="absolute inset-0">
        <img
          src={photo.src}
          srcSet={photo.srcSet}
          sizes="100vw"
          alt=""
          decoding="sync"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: photo.position }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,38,42,0.74)_0%,rgba(8,38,42,0.34)_26%,rgba(8,38,42,0.46)_60%,rgba(8,38,42,0.9)_100%)]" />
        <div className="absolute inset-0 hidden bg-[linear-gradient(95deg,rgba(8,38,42,0.84)_0%,rgba(8,38,42,0.42)_44%,transparent_72%)] md:block" />
        <HeroBrand />
      </div>

      <div className="relative gutter mx-auto flex min-h-[calc(80svh-var(--strip-h))] max-w-page flex-col justify-center gap-10 pt-[calc(var(--header-h)+32px)] pb-[clamp(32px,6vh,72px)] lg:flex-row lg:items-center lg:justify-between lg:gap-s5">
        <div className="max-w-[600px] min-w-0 flex-1">
          <Link
            to="/fundraisers"
            className="group inline-flex items-center gap-2 text-[13.5px] font-medium text-paper/70 transition-colors duration-200 ease-brand hover:text-paper"
            style={rise(0)}
          >
            <ArrowRight className="h-3 w-3 rotate-180 transition-transform duration-300 ease-brand group-hover:-translate-x-0.5" />
            All fundraisers
          </Link>
          {reason && (
            <p
              className="mt-s4 font-script text-[clamp(22px,2vw,28px)] leading-none text-gold-pale [text-shadow:0_1px_16px_rgba(0,0,0,0.55)]"
              style={rise(60)}
            >
              {reason}
            </p>
          )}
          <h1
            id="fundraiser-title"
            className="mt-s2 font-display text-[clamp(34px,4.6vw,60px)] leading-[1.04] tracking-[-0.022em] text-paper [text-wrap:balance] [text-shadow:0_2px_30px_rgba(0,0,0,0.5)]"
            style={rise(140)}
          >
            {f.title}
          </h1>
          <p className="mt-s3 text-[15.5px] text-paper/80" style={rise(300)}>
            Started by <span className="font-semibold text-paper">{f.organiser}</span>
          </p>
          <Link
            to={`/appeals/${appeal.slug}`}
            className="group mt-s3 inline-flex items-center gap-3 rounded-full bg-paper/10 py-2 pr-4 pl-2 text-[14.5px] text-paper ring-1 ring-paper/20 transition-colors duration-200 ease-brand hover:bg-paper/20"
            style={rise(420)}
          >
            <span className="rounded-full bg-gold-pale px-2.5 py-1 text-[12px] font-semibold text-ink">
              Raising for
            </span>
            <span className="font-semibold">{appeal.title}</span>
            <span className="text-paper/70">{PLACES[appeal.country]}</span>
            <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* --- the give card --- */}
        <div
          className="w-full shrink-0 rounded-2xl bg-teal p-s3 text-paper shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)] sm:p-s4 lg:w-[clamp(350px,32vw,440px)]"
          style={rise(300)}
        >
          <p className="nums font-display text-[clamp(34px,3vw,44px)] leading-none tracking-[-0.03em]">
            {money(f.raised)}
          </p>
          <p className="nums mt-1.5 text-[14px] text-paper/75">raised of {money(f.goal)} goal</p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={`${pct}% of the goal raised`}
            className="mt-s2 h-2 overflow-hidden rounded-full bg-paper/15"
          >
            <div className="h-full rounded-full bg-gold-pale" style={{ width: `${pct}%` }} />
          </div>
          <p className="nums mt-2 flex justify-between text-[13px] text-paper/75">
            <span>
              {f.supporters} {f.supporters === 1 ? 'supporter' : 'supporters'}
            </span>
            <span>{days === 0 ? 'Ends today' : `${days} days left`}</span>
          </p>

          <p id={`${uid}-amt`} className="mt-s3 text-[13px] font-semibold text-paper/80">
            Choose an amount (AUD)
          </p>
          <div role="radiogroup" aria-labelledby={`${uid}-amt`} className="mt-2 grid grid-cols-3 gap-2">
            {ladder.map((a, i) => {
              const on = chosen === i && !(typedAmount > 0)
              return (
                <button
                  key={a.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setChosen(i)
                    setTyped('')
                  }}
                  className={`nums min-h-[48px] rounded-[12px] font-display text-[19px] font-semibold transition-[background-color,color,transform] duration-200 ease-brand active:scale-[0.97] ${
                    on ? 'bg-paper text-ink' : 'bg-paper/10 text-paper hover:bg-paper/20'
                  }`}
                >
                  {money(a.value)}
                </button>
              )
            })}
          </div>
          <label htmlFor={`${uid}-own`} className="sr-only">
            Or your own amount
          </label>
          <div
            className={`mt-2 flex h-12 items-center gap-1 rounded-[12px] bg-paper/10 px-3.5 ring-1 transition-[background-color,box-shadow] duration-200 ease-brand focus-within:bg-paper/15 ${
              tooSmall ? 'ring-alert-pale' : 'ring-paper/15 focus-within:ring-gold-pale'
            }`}
          >
            <span aria-hidden="true" className="text-[16px] text-paper/60">
              $
            </span>
            <input
              id={`${uid}-own`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="Or your own amount"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="nums w-full bg-transparent text-[16px] text-paper placeholder:text-paper/55 focus:outline-none"
            />
          </div>
          {tooSmall && (
            <p className="mt-1.5 text-[13px] text-alert-pale">The smallest donation we can take is ${MIN_GIFT}.</p>
          )}

          <Link
            to={fundraiserGiveHref(f, amount)}
            className="group mt-s3 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[12px] bg-gold px-6 text-[16px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-gold-dark hover:text-ink"
          >
            Donate <span className="nums">{money(amount)}</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" />
          </Link>
          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[12.5px] text-paper/65">
            <Lock className="h-3 w-3 shrink-0" />
            Goes to {appeal.title}. Tax deductible from $2.
          </p>
        </div>
      </div>
    </section>
  )
}
