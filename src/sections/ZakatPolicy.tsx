import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useInView } from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { ArrowRight, Check } from '../components/icons'
import { POLICY } from '../components/zakat-data'

/* ---------------------------------------------------------------------------
   Zakat, section 3 of 5: what we do with your zakat. #policy, which HomeZakat,
   AppealBody, give-data's trust line and the mega menu all point at.

   REDESIGNED 16 SEPTEMBER 2026, at the user's request, to be more visual and
   something to use rather than two ruled lists. Two parts:

     THE PATH     the three commitments as the stops a dollar of zakat passes,
                  after "You give your zakat". The line between the stops draws
                  itself across when the path scrolls in and each stop lights in
                  turn (useInView; already drawn under reduced motion). Across
                  from lg up, down the left edge below it.

     THE EIGHT    At-Tawbah 9:60's categories as eight tiles. Pointing at or
                  choosing one opens it in the panel beside them: the Arabic,
                  the name, what it means and whether we take it. The panel is a
                  live region, so a screen reader hears the change.

   THE COLLECTORS ARE DIMMED, NEVER STRUCK THROUGH. That line is a category the
   Qur'an names, and a rule through it reads as crossing out the ayah. Not gold
   either: gold is for the give action.

   "Where it goes" (three cards of the kinds of work, WHERE in zakat-data.ts)
   came off at the user's request the same day; "Everything we fund" in the
   head links to the full picture.

   IT IS A DRAFT UNTIL THE BOARD SAYS OTHERWISE. While POLICY.adopted is null
   the lede ends by saying so. Set the date in zakat-data.ts and it changes.
--------------------------------------------------------------------------- */

const STOPS = [POLICY.start, ...POLICY.commitments]

export default function ZakatPolicy() {
  const [path, drawn] = useInView<HTMLOListElement>()
  const [open, setOpen] = useState(0)
  const cat = POLICY.categories[open]
  const declined = cat.ours === false

  return (
    <section
      id="policy"
      aria-labelledby="policy-head"
      className={`scroll-mt-[var(--header-h)] ${SECTION_Y}`}
    >
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="policy-head"
          eyebrow="Our promise"
          title="What we do with your zakat."
          lede={
            <>
              Three rules for every dollar of zakat we are given, whatever appeal it came in
              through.{' '}
              <span className="text-text-3">
                {POLICY.adopted
                  ? `Adopted by the board, ${POLICY.adopted}.`
                  : 'Draft, awaiting adoption by the board.'}
              </span>
            </>
          }
          action={
            <Link
              to="/where-it-goes"
              className="group inline-flex items-center gap-1.5 text-[15px] font-semibold text-teal transition-colors duration-200 ease-brand hover:text-ink"
            >
              Everything we fund
              <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
            </Link>
          }
        />

        {/* --- the path --- */}
        <ol
          ref={path}
          className={`relative mt-s5 grid gap-y-s4 lg:grid-cols-4 lg:gap-x-s3 ${BREAKOUT}`}
        >
          {STOPS.map((stop, i) => (
            <li
              key={stop.title}
              className="group relative grid grid-cols-[44px_minmax(0,1fr)] gap-x-s2 lg:block"
            >
              {/* The piece of line to the next stop: down the left below lg,
                  across to the next circle from lg. Each piece draws after
                  the stop before it has lit. */}
              {i < STOPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-11 -bottom-s4 left-[21.5px] w-px bg-line lg:top-[21.5px] lg:right-[calc(var(--spacing-s3)*-1)] lg:bottom-auto lg:left-11 lg:h-px lg:w-auto"
                >
                  <span
                    className={`absolute inset-0 origin-top bg-teal transition-[scale] duration-500 ease-brand motion-reduce:transition-none lg:origin-left ${
                      drawn ? 'scale-100' : 'scale-y-0 lg:scale-x-0 lg:scale-y-100'
                    }`}
                    style={{ transitionDelay: drawn ? `${i * 380 + 200}ms` : '0ms' }}
                  />
                </span>
              )}
              <span
                aria-hidden="true"
                className={`relative z-10 grid h-11 w-11 place-items-center rounded-full border text-[15px] font-semibold transition-[background-color,border-color,color,transform] duration-500 ease-brand group-hover:scale-110 motion-reduce:transition-none ${
                  drawn ? 'border-teal bg-teal text-paper' : 'border-line bg-ground text-text-3'
                }`}
                style={{ transitionDelay: drawn ? `${i * 380}ms` : '0ms' }}
              >
                {i === 0 ? <Check className="h-4 w-4" /> : i}
              </span>
              <div
                className={`transition-[opacity,translate] duration-700 ease-brand motion-reduce:transition-none lg:mt-s3 lg:pr-s2 ${
                  drawn ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                }`}
                style={{ transitionDelay: drawn ? `${i * 380 + 120}ms` : '0ms' }}
              >
                <p className="pt-2 text-[clamp(17px,1.5vw,19px)] leading-snug font-semibold tracking-[-0.012em] text-text lg:pt-0">
                  {stop.title}
                </p>
                <p className="mt-1.5 max-w-[34ch] text-[14.5px] leading-relaxed text-text-2">{stop.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* --- the eight --- */}
        <div className={`mt-s5 grid gap-s4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-stretch ${BREAKOUT}`}>
          <div>
            <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-text">The eight it is owed to</h3>
            <figure className="mt-s2 max-w-[46rem]">
              <blockquote className="font-serif text-[clamp(17px,1.5vw,19px)] leading-[1.5] text-text-2 italic">
                &ldquo;{POLICY.verse.english}&rdquo;
              </blockquote>
              <figcaption className="mt-1.5 text-[12.5px] font-medium tracking-[0.08em] text-text-3 uppercase">
                {POLICY.verse.cite}
              </figcaption>
            </figure>

            <ul className="mt-s3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {POLICY.categories.map((c, i) => {
                const on = i === open
                const out = c.ours === false
                return (
                  <li key={c.name}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-controls="eight-detail"
                      onClick={() => setOpen(i)}
                      onMouseEnter={() => setOpen(i)}
                      onFocus={() => setOpen(i)}
                      className={`flex h-full min-h-[92px] w-full flex-col justify-between rounded-xl border p-3 text-left transition-[background-color,border-color,color,transform] duration-200 ease-brand ${
                        on
                          ? 'border-teal bg-teal text-paper'
                          : out
                            ? 'border-dashed border-line bg-transparent text-text-3 hover:border-teal/50'
                            : 'border-line bg-paper text-text hover:-translate-y-0.5 hover:border-teal/50'
                      }`}
                    >
                      <span className="flex w-full items-baseline justify-between gap-1">
                        <span className={`nums text-[12px] ${on ? 'text-paper/70' : 'text-text-3'}`}>{i + 1}</span>
                        <span
                          lang="ar"
                          dir="rtl"
                          className={`font-arabic text-[14px] leading-none ${on ? 'text-paper/80' : 'text-text-3'}`}
                        >
                          {c.ar}
                        </span>
                      </span>
                      <span className="mt-2 text-[14px] leading-snug font-semibold">{c.name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* the one open, in full */}
          <div
            id="eight-detail"
            aria-live="polite"
            className={`flex flex-col justify-between rounded-2xl p-s3 sm:p-s4 ${
              declined ? 'border border-dashed border-line bg-paper text-text' : 'bg-teal text-paper'
            }`}
          >
            <div key={open} style={{ animation: 'hero-soft 500ms var(--ease-reveal) both' }}>
              <p className={`nums text-[12.5px] font-semibold tracking-[0.14em] uppercase ${declined ? 'text-text-3' : 'text-gold-pale'}`}>
                {open + 1} of 8
              </p>
              <p
                lang="ar"
                dir="rtl"
                className={`mt-s2 text-right font-arabic text-[clamp(30px,3vw,40px)] leading-[1.5] ${declined ? 'text-text-3' : 'text-paper'}`}
              >
                {cat.ar}
              </p>
              <p className="mt-s1 text-[clamp(22px,2vw,26px)] leading-tight font-semibold tracking-[-0.015em]">
                {cat.name}
              </p>
              <p className={`mt-2 text-[15.5px] leading-relaxed ${declined ? 'text-text-2' : 'text-paper/80'}`}>
                {cat.gloss}
              </p>
            </div>

            <p
              className={`mt-s4 flex items-center gap-2 border-t pt-s2 text-[14px] font-semibold ${
                declined ? 'border-line text-text-2' : 'border-paper/20 text-paper'
              }`}
            >
              {declined ? (
                <>
                  <span aria-hidden="true" className="h-px w-4 bg-text-3" />
                  The cost of collecting comes out of general sadaqah
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 text-gold-pale" />
                  Named in {POLICY.verse.cite}
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
