import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import { ArrowRight } from '../components/icons'
import { PARTNERS } from '../components/involved-data'

/* ---------------------------------------------------------------------------
   Get involved, section 4 of 7: mosque & school partnerships.

   WRITTEN AS A TRADE, IN TWO COLUMNS
   A partnerships section that only lists what the charity would like to be
   given is a request for favours with a heading on it. This one has a second
   column — what a mosque or school gets back — because that is what makes a
   partnership last past the first Ramadan, and most charity pages do not have
   one to show.

   The two columns are deliberately equal in width and weight. Making the
   "give" column heavier would put the ask first; making the "get" column
   heavier would look like overselling. They are the same size because it is
   meant to read as an exchange between equals — a masjid committee is not a
   donor, it is a partner with its own congregation to answer to.

   THE LAST LINE OF THE SECOND COLUMN IS THE REAL OFFER: a report back to the
   standard of the accountability page, including what we do not know. It is
   last so it lands last, and it links there, because a promise about
   transparency that cannot be inspected is just another sentence.

   Sand, and the only sand band on the page apart from the close — this is the
   section that is about a room rather than about money or a task.

   TODO: no count of mosques or schools appears anywhere here, because nobody
   has a list. See involved-data.ts.
--------------------------------------------------------------------------- */

/** The two lists are the same shape, so they are drawn once. */
function Column({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  /** The "get" column marks its bullets in green; the "give" column's are
   *  neutral. One difference, and it is the only thing distinguishing them —
   *  enough for the eye to tell which side it is on without a box or a rule
   *  down the middle. */
  tone: 'give' | 'get'
}) {
  return (
    <div>
      <h3 className="font-display text-[clamp(19px,1.8vw,23px)] leading-snug tracking-[-0.014em]">
        {title}
      </h3>
      <ul className="mt-s2 grid gap-s2">
        {items.map((item) => (
          <li key={item} className="flex gap-s2 border-t border-line/70 pt-s2">
            <span
              aria-hidden="true"
              className={`mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full ${
                tone === 'get' ? 'bg-green' : 'bg-text-3'
              }`}
            />
            <p className="max-w-measure text-[15px] leading-relaxed text-text-2">{item}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function InvolvedPartners() {
  return (
    <section
      id="partners"
      aria-labelledby="involved-partners-head"
      className="relative isolate scroll-mt-[calc(var(--header-h)+24px)] overflow-hidden bg-sand py-s5 lg:py-s6"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(85%_70%_at_10%_0%,rgba(47,107,90,0.1)_0%,transparent_62%)]"
      />

      <div className="gutter mx-auto max-w-page">
        <Reveal>
          <p className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.16em] text-green uppercase">
            <span aria-hidden="true" className="h-px w-6 bg-green/40" />
            {PARTNERS.eyebrow}
          </p>
          <h2
            id="involved-partners-head"
            className="mt-s1 max-w-[20ch] font-display text-[clamp(28px,3.4vw,42px)] leading-[1.08] tracking-[-0.02em] text-balance"
          >
            {PARTNERS.title}
          </h2>
          <p className="mt-s2 max-w-measure text-[15.5px] leading-relaxed text-text-2">
            {PARTNERS.body}
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-s4 grid gap-s4 md:grid-cols-2 lg:gap-s5">
            <Column title={PARTNERS.give.title} items={PARTNERS.give.items} tone="give" />
            <Column title={PARTNERS.get.title} items={PARTNERS.get.items} tone="get" />
          </div>
        </Reveal>

        <Reveal delay={140}>
          <div className="mt-s4 flex flex-wrap items-center gap-s2 border-t border-line pt-s3">
            <Link
              to="/contact?topic=Partnership%20or%20media"
              className="group inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-[12px] border border-ink/15 bg-paper px-6 text-[15px] font-semibold text-text transition-[border-color,background-color] duration-200 ease-brand hover:border-ink"
            >
              {PARTNERS.cta}
              <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
            </Link>

            <Link
              to="/where-it-goes"
              className="text-[14px] font-semibold text-green underline decoration-green/30 underline-offset-4 transition-colors duration-200 ease-brand hover:text-ink hover:decoration-ink/40"
            >
              See what a report back looks like
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
