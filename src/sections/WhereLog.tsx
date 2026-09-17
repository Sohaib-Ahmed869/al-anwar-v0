import { useState } from 'react'

import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { LOG, PLACES } from '../components/where-data'

/* ---------------------------------------------------------------------------
   Where it goes, section 4 of 5: every distribution we can date.

   17 September 2026, third layout of the day, at the user's request. A
   vertical timeline filled the left half and left the right empty; a pinned
   head beside it read as two halves that did not meet. Now it runs across:

     the head     SectionHead, with three figures in its action slot (how
                  many, how many places, the year of the first), counted off
                  LOG and PLACES, never typed
     the chips    one per place with a record
     the record   a grid of four across (two on tablets, one on phones).
                  Each entry hangs off a rule with a dot, so a row reads as a
                  stretch of timeline, newest first, left to right

   It still draws nothing below MINIMUM entries: a log of two lines is not a
   log. No amounts on any line, because we hold none per distribution.
--------------------------------------------------------------------------- */

const MINIMUM = 6

export default function WhereLog() {
  const [place, setPlace] = useState<string | null>(null)
  if (LOG.length < MINIMUM) return null

  const shown = place ? LOG.filter((e) => e.placeId === place) : LOG
  const chips = PLACES.filter((p) => p.distributions.length > 0)
  const facts = [
    { value: String(LOG.length), label: 'distributions' },
    { value: String(chips.length), label: chips.length === 1 ? 'place' : 'places' },
    { value: LOG[LOG.length - 1].iso.slice(0, 4), label: 'the first' },
  ]

  return (
    <section id="log" aria-labelledby="log-head" className={`scroll-mt-[calc(var(--header-h)+24px)] ${SECTION_Y}`}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="log-head"
          eyebrow="The record"
          title="Every distribution we can date."
          lede="Newest first, with how each date is known. Most are read off our own photo of the handover."
          action={
            <dl className="flex divide-x divide-line">
              {facts.map((f) => (
                <div key={f.label} className="px-s3 first:pl-0 last:pr-0">
                  <dt className="sr-only">{f.label}</dt>
                  <dd className="nums font-display text-[clamp(28px,3vw,40px)] leading-none font-semibold tracking-[-0.02em] text-teal">
                    {f.value}
                  </dd>
                  <dd aria-hidden="true" className="mt-1.5 text-[13px] text-text-2">
                    {f.label}
                  </dd>
                </div>
              ))}
            </dl>
          }
        />

        <div className={`mt-s4 flex flex-wrap items-center gap-1 lg:mt-s5 ${BREAKOUT}`}>
          {[{ id: null, name: 'All places' }, ...chips].map((p) => {
            const on = place === p.id
            return (
              <button
                key={p.id ?? 'all'}
                type="button"
                aria-pressed={on}
                onClick={() => setPlace(p.id)}
                className={`rounded-full px-3.5 py-[7px] text-[13.5px] font-medium transition-[background-color,color] duration-200 ease-brand ${
                  on ? 'bg-teal text-paper' : 'text-text-2 hover:bg-ink/[0.05] hover:text-ink'
                }`}
              >
                {p.name}
              </button>
            )
          })}
        </div>

        <ol
          key={place ?? 'all'}
          className={`mt-s5 grid gap-x-s4 gap-y-s5 sm:grid-cols-2 lg:grid-cols-4 ${BREAKOUT}`}
        >
          {shown.map((entry, i) => (
            <li key={entry.iso + entry.what} className="group">
              <Reveal delay={(i % 4) * 70} className="h-full">
                {/* the rule runs the full width of the cell and on into the
                    gap, so a row of four reads as one stretch of line */}
                <div className="relative h-full border-t border-teal/30 pt-s3 sm:-mr-s4 sm:pr-s4 group-last:mr-0 group-last:pr-0 sm:max-lg:group-even:mr-0 sm:max-lg:group-even:pr-0 lg:group-nth-[4n]:mr-0 lg:group-nth-[4n]:pr-0">
                  <span
                    aria-hidden="true"
                    className="absolute -top-[8px] left-0 size-[15px] rounded-full border-[3px] border-ground bg-teal ring-1 ring-teal/40"
                  />
                  <p className="nums font-display text-[clamp(20px,1.7vw,24px)] leading-tight font-semibold tracking-[-0.016em]">
                    {entry.date}
                  </p>
                  <p className="mt-s2 text-[12px] font-semibold tracking-[0.12em] text-teal uppercase">
                    {entry.place}
                    {entry.where && <span className="tracking-normal normal-case text-text-3">, {entry.where}</span>}
                  </p>
                  <p className="mt-1.5 text-[15.5px] leading-relaxed text-text">{entry.what}</p>
                  <p className="mt-s2 text-[13px] text-text-3">
                    {entry.source.charAt(0).toUpperCase() + entry.source.slice(1)}
                    {entry.partner && ', delivered with a named partner'}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
