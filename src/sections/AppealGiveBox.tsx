import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

import { money, type GiveAmount } from '../components/GiveModule'
import { MIN_GIFT } from '../components/give-data'
import { giveHref, type Appeal } from '../components/appeals-data'
import { ArrowRight, Lock } from '../components/icons'
import TrustBadges from '../components/TrustBadges'

/* ---------------------------------------------------------------------------
   A single appeal, section 2: the give card, and the bar that follows.

   THE CARD sits on the right of the hero in the home banner's teal (16
   September 2026). It asks one question, how much, and hands the rest to
   /give with the appeal and the amount on the link: the form there opens with
   both already chosen. The ladder is the appeal's own where its unit differs
   from the fund's (Gaza meals), otherwise the fund's.

   THE BAR. Once the card has scrolled off the top, a small dark bar rises at
   the foot of the screen with the appeal's name and "Give $X" for the amount
   chosen in the card, so the way to give is never more than a tap away while
   the story is read. It drops away again when the card comes back, and when
   the other appeals come on screen, where every tile has its own button.
   Solid, not frosted: a blur over a scrolling page is redrawn on every frame.
   It is portalled to <body>: inside the hero it would sit in the hero's own
   stacking context (`isolate`) and slide under the sections below it.
--------------------------------------------------------------------------- */

export default function AppealGiveBox({
  appeal,
  ladder,
}: {
  appeal: Appeal
  ladder: GiveAmount[]
}) {
  const uid = useId()
  const [chosen, setChosen] = useState(0)
  const [typed, setTyped] = useState('')
  const card = useRef<HTMLDivElement>(null)
  const [bar, setBar] = useState(false)

  const typedAmount = parseFloat(typed.replace(/[^\d.]/g, ''))
  const tooSmall = typedAmount > 0 && typedAmount < MIN_GIFT
  const amount = tooSmall
    ? MIN_GIFT
    : typedAmount > 0
      ? typedAmount
      : (ladder[chosen]?.value ?? MIN_GIFT)
  const to = `${giveHref(appeal)}&amount=${amount}`

  useEffect(() => {
    let frame = 0
    const check = () => {
      frame = 0
      const past = (card.current?.getBoundingClientRect().bottom ?? 1) < 0
      const related = document.getElementById('related')
      const done = related ? related.getBoundingClientRect().top < window.innerHeight * 0.85 : false
      setBar(past && !done)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check)
    }
    check()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <>
      <div
        ref={card}
        className="w-full shrink-0 rounded-2xl bg-teal p-s3 text-paper shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)] sm:p-s4 lg:w-[clamp(350px,32vw,440px)]"
        style={{ animation: 'hero-soft 1200ms var(--ease-reveal) 300ms both' }}
      >
        <p className="font-script text-[clamp(24px,2vw,30px)] leading-none text-gold-pale">
          Give to this appeal
        </p>

        <p id={`${uid}-amt`} className="mt-s3 text-[13px] font-semibold text-paper/80">
          Choose an amount (AUD)
        </p>
        <div
          role="radiogroup"
          aria-labelledby={`${uid}-amt`}
          className="mt-2 grid grid-cols-3 gap-2"
        >
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
                className={`flex min-h-[68px] flex-col items-start rounded-[12px] p-2.5 text-left transition-[background-color,color,transform] duration-200 ease-brand active:scale-[0.97] ${
                  on ? 'bg-paper text-ink' : 'bg-paper/10 text-paper hover:bg-paper/20'
                }`}
              >
                <span className="nums font-display text-[22px] leading-none">
                  {money(a.value)}
                </span>
                {a.label && (
                  <span
                    className={`mt-auto pt-1.5 text-[11.5px] leading-[1.25] ${on ? 'text-text-2' : 'text-paper/70'}`}
                  >
                    {a.label}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <label htmlFor={`${uid}-own`} className="sr-only">
          Or your own amount
        </label>
        <div
          className={`mt-2 flex h-12 items-center gap-1 rounded-[12px] px-3.5 ring-1 transition-[background-color,box-shadow] duration-200 ease-brand focus-within:bg-paper/15 ${
            tooSmall
              ? 'bg-paper/10 ring-alert-pale'
              : 'bg-paper/10 ring-paper/15 focus-within:ring-gold-pale'
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
            aria-invalid={tooSmall ? 'true' : undefined}
            className="nums w-full bg-transparent text-[16px] text-paper placeholder:text-paper/55 focus:outline-none"
          />
        </div>
        {tooSmall && (
          <p className="mt-1.5 text-[13px] text-alert-pale">
            The smallest donation we can take is ${MIN_GIFT}.
          </p>
        )}

        <Link
          to={to}
          className="group mt-s3 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[12px] bg-gold px-6 text-[16px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-gold-dark hover:text-ink"
        >
          Give <span className="nums">{money(amount)}</span>
          <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" />
        </Link>

        <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[12.5px] text-paper/65">
          <Lock className="h-3 w-3 shrink-0" />
          Secure checkout.
        </p>

        {/* The ACNC and DGR badges since 28 September 2026 (client feedback),
            which carry the tax line that used to end the sentence above. */}
        <TrustBadges tone="dark" className="mt-s2 flex flex-col items-center text-center" />
      </div>

      {/* --- the bar --- */}
      {createPortal(
        <div
          aria-hidden={!bar}
          className={`fixed inset-x-0 bottom-0 z-40 px-s2 pb-[max(12px,env(safe-area-inset-bottom))] transition-[transform,opacity] duration-500 ease-brand ${
            bar ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-[130%] opacity-0'
          }`}
        >
          <div className="mx-auto flex max-w-[560px] items-center gap-s2 rounded-2xl bg-ink p-2 pl-4 text-paper shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)] ring-1 ring-paper/10">
            <p className="min-w-0 flex-1">
              <span className="block text-[12px] text-paper/60">Give to</span>
              <span className="block truncate text-[15px] font-semibold">{appeal.title}</span>
            </p>
            <Link
              to={to}
              tabIndex={bar ? undefined : -1}
              className="group inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded-[12px] bg-gold px-5 text-[15px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-gold-dark hover:text-ink"
            >
              Give <span className="nums">{money(amount)}</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
