import { useState } from 'react'

import Reveal from '../components/Reveal'
import { LOG, PLACES } from '../components/where-data'

/* ---------------------------------------------------------------------------
   Where it goes, section 4 of 8: every distribution we can date.

   THIS SECTION DISAPPEARS RATHER THAN APOLOGISING
   It renders nothing at all below MINIMUM entries — no heading, no skeleton,
   no "coming soon". A log of two lines is not a log and a page that advertises
   one is worse off than a page that does not mention it. The day the field
   team's spreadsheet is typed into `distributions` in where-data.ts, this
   section appears by itself and the filters fill out with it. Nothing else has
   to change.

   EVERY LINE CARRIES ITS OWN PROVENANCE
   Not one blanket claim at the foot saying the dates are reliable, but a
   source against each row: dated off our own photograph, or off the previous
   site's campaign pages. Where they differ in strength the reader can see it,
   which is the whole reason for printing a log rather than a total.

   NO AMOUNTS, AND THAT IS NOT AN OVERSIGHT
   We hold a dated record of what went where. We do not hold a dollar figure
   against each line, and inventing one here would put made-up money on a
   hundred rows instead of the five it is fenced to in the places section
   above. The log states what is true and stops.

   THE FILTER IS LOCAL, NOT IN THE URL
   Unlike the appeals grid, whose filters are linked to from the menu and
   therefore live in the query string, nothing links into a filtered log. One
   piece of state, and tapping the lit chip clears it.
--------------------------------------------------------------------------- */

/** Below this the section does not draw. Six is roughly the point at which a
 *  list stops looking like the three examples somebody remembered. */
const MINIMUM = 6

export default function WhereLog() {
  const [place, setPlace] = useState<string | null>(null)

  if (LOG.length < MINIMUM) return null

  const shown = place ? LOG.filter((e) => e.placeId === place) : LOG
  /* Only places with something behind them get a chip, so nobody taps one
     into an empty list. */
  const chips = PLACES.filter((p) => p.distributions.length > 0)

  return (
    <section id="log" aria-labelledby="log-head" className="scroll-mt-[calc(var(--header-h)+24px)] bg-paper py-s5 lg:py-s6">
      <div className="gutter mx-auto max-w-page">
        <Reveal>
          <h2
            id="log-head"
            className="max-w-[18ch] font-display text-[clamp(26px,3vw,38px)] leading-snug"
          >
            Every distribution we can date
          </h2>
          <p className="mt-s2 max-w-measure text-[15.5px] leading-relaxed text-text-2">
            Not a selection. Every one we hold a record of, with the place, what went out, and how
            the date is known. Most of them read off our own photograph of the handover.
            Where a line is thinner than that, it says so.
          </p>
        </Reveal>

        <div className="mt-s3 flex flex-wrap items-center gap-2">
          {chips.map((p) => {
            const on = place === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlace(on ? null : p.id)}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors duration-200 ease-brand ${
                  on
                    ? 'border-green bg-green text-paper'
                    : 'border-line text-text-2 hover:border-text-3 hover:text-text'
                }`}
              >
                {p.name}
              </button>
            )
          })}
          {place && (
            <button
              type="button"
              onClick={() => setPlace(null)}
              className="ml-1 text-[13px] text-text-3 underline underline-offset-4 transition-colors duration-200 ease-brand hover:text-text"
            >
              Clear
            </button>
          )}
        </div>

        <ol className="mt-s3">
          {shown.map((entry) => (
            <li
              key={entry.iso + entry.what}
              className="grid gap-x-s3 gap-y-1 border-t border-line py-s2 sm:grid-cols-[minmax(0,2fr)_minmax(0,7fr)_minmax(0,3fr)]"
            >
              <p className="nums text-[14px] font-semibold text-text">{entry.date}</p>

              <div>
                <p className="text-[11px] font-semibold tracking-[0.13em] text-text-3 uppercase">
                  {entry.place}
                  {entry.where && <span className="normal-case tracking-normal">, {entry.where}</span>}
                </p>
                <p className="mt-1 text-[15px] leading-relaxed text-text-2">{entry.what}</p>
              </div>

              <p className="text-[12.5px] leading-relaxed text-text-3 sm:text-right">
                {entry.source}
                {entry.partner && (
                  <>
                    <br />
                    delivered with a named partner
                  </>
                )}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-s3 max-w-[92ch] border-t border-line pt-s2 text-[12.5px] leading-relaxed text-text-3">
          This log is not complete and does not claim to be. It holds what can be dated from
          records we have in hand. Gaza and Syria have no lines in it at all, which is stated in
          the section above rather than left to be noticed here.
        </p>
      </div>
    </section>
  )
}
