import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import { ArrowRight } from '../components/icons'
import { PLACES, TOTAL_INDICATIVE, TOTAL_OVERSEAS, money } from '../components/where-data'

/* ---------------------------------------------------------------------------
   Where it goes, section 3 of 8: the five places.

   A ledger, not a card grid and not five photographs. Why there are no
   photographs in this section is written above PLACES in where-data.ts and is
   not a layout preference: we own frames from Yemen and The Gambia and none
   from Gaza, Lebanon or Syria, and stock is never captioned as our own field
   work. Two rows with pictures and three without reads as three broken rows.

   The ledger is the idiom the About page established for facts that can be
   checked — a rule per row, the name set large in the margin, no dots and no
   decoration. The country's anchor is on the row, so the five links in the
   header menu land on the row itself rather than on the section.

   THE FIGURE COLUMN IS THE INVENTED ONE AND IT IS FENCED IN PROSE
   Every other number on this page is filed. These five are not, and the
   paragraph above the ledger says so in the first sentence rather than in a
   footnote — a caveat under a table is read after the number has already been
   believed. Each figure also carries its own chip, and the foot of the section
   sets the five against the real filed total so nobody has to add them up to
   discover they do not reconcile. See the fence at the top of where-data.ts:
   they must never be made to reconcile.

   WHERE THERE IS NOTHING, THE ROW SAYS SO
   Gaza and Syria hold no dated record. Their rows print the admission in the
   place the evidence line would go, in the same type, not smaller and not
   greyed away. A page that prints its own gaps is making the argument; a page
   that hides two of five is only claiming it.
--------------------------------------------------------------------------- */

/** The quiet outlined chip an unconfirmed figure wears. Deliberately not gold
 *  — gold is the give action and the focus ring, and a caveat is neither. */
const CHIP =
  'inline-flex items-center rounded-full border border-line px-2 py-[3px] text-[10px] font-semibold tracking-[0.12em] text-text-3 uppercase'

export default function WherePlaces() {
  return (
    <section aria-labelledby="places-head" className="bg-paper-2 py-s5 lg:py-s6">
      <div className="gutter mx-auto max-w-page">
        <div className="grid gap-s3 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-s5">
          {/* Stays with the ledger rather than scrolling off the top of it,
              the same way the About story's heading column does. */}
          <div className="lg:sticky lg:top-[calc(var(--header-h)+40px)] lg:self-start">
            <p className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.16em] text-green uppercase">
              <span aria-hidden="true" className="h-px w-6 bg-green/40" />
              By place
            </p>
            <h2
              id="places-head"
              className="mt-s1 max-w-[14ch] font-display text-[clamp(26px,3vw,38px)] leading-snug"
            >
              Five places, and what we hold on each
            </h2>
            <p className="mt-s2 max-w-measure text-[15.5px] leading-relaxed text-text-2">
              <strong className="font-semibold text-text">
                The figures in this column are indicative and not yet confirmed.
              </strong>{' '}
              The statement we file each year reports one total for everything sent overseas, and
              its programs table is empty (a small charity is not required to complete it),
              so there is no filed split between these five countries and no way to derive
              one. These are our own working numbers while the field log is compiled.
            </p>
          </div>

          <ol className="lg:pt-s2">
            {PLACES.map((place, i) => (
              <Reveal key={place.id} delay={Math.min(i, 3) * 60}>
                <li
                  id={place.id}
                  className="scroll-mt-[calc(var(--header-h)+24px)] border-t border-line py-s3"
                >
                  {/* The name and the figure on one line, the figure held to
                      the right so the five stack into a readable column. It
                      wraps under the name on a narrow screen rather than
                      squeezing both. */}
                  <div className="flex flex-wrap items-baseline justify-between gap-x-s3 gap-y-1">
                    <h3 className="font-display text-[clamp(22px,2.2vw,29px)] leading-tight tracking-[-0.018em]">
                      {place.name}
                    </h3>
                    <p className="nums text-[clamp(18px,1.8vw,22px)] leading-tight text-text-2">
                      {money(place.indicative)}
                    </p>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-s2 gap-y-1">
                    <p className="text-[13px] text-text-3">
                      {place.since ? (
                        <>
                          Working here since <span className="nums">{place.since}</span>
                        </>
                      ) : (
                        'No start date on record'
                      )}
                    </p>
                    <span className={CHIP}>To confirm</span>
                  </div>

                  <p className="mt-s2 max-w-measure text-[15px] leading-relaxed text-text-2">
                    {place.work.join(' · ')}
                  </p>

                  {/* The evidence line, or the admission that stands in for
                      it. Same size and same colour as each other, because the
                      absence is as much a fact as the record is. */}
                  {place.gap ? (
                    <p className="mt-s2 max-w-measure border-l-2 border-line pl-s2 text-[14px] leading-relaxed text-text-2 italic">
                      {place.gap}
                    </p>
                  ) : (
                    <p className="mt-s2 text-[13px] leading-relaxed text-text-3">
                      <span className="nums">{place.distributions.length}</span>{' '}
                      {place.distributions.length === 1
                        ? 'dated distribution on record'
                        : 'dated distributions on record'}
                      , each one listed below with how its date is known.
                    </p>
                  )}

                  <Link
                    to={place.to}
                    className="group mt-s2 inline-flex items-center gap-2 text-[14px] font-semibold text-green transition-colors duration-200 ease-brand hover:text-ink"
                  >
                    Appeals in {place.name}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 ease-brand group-hover:translate-x-1" />
                  </Link>
                </li>
              </Reveal>
            ))}

            {/* The sum, set against the filed total in the same breath. This
                is the line that stops the column being mistaken for the
                accounts: it prints both numbers and says plainly that they do
                not meet. */}
            <li className="border-t border-line pt-s3 text-[13px] leading-relaxed text-text-3">
              The five figures above come to{' '}
              <span className="nums text-text-2">{money(TOTAL_INDICATIVE)}</span>. What we have
              actually filed as sent overseas, across every year since registration, is{' '}
              <span className="nums text-text-2">{money(TOTAL_OVERSEAS)}</span>. The two do not
              agree and are not meant to. The first is our own estimate of how the work
              divides, the second is what we have lodged and anyone can check. When the field log
              is compiled, the estimate goes and the split is stated from records.
            </li>
          </ol>
        </div>
      </div>
    </section>
  )
}
