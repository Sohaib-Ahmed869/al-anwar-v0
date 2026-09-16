import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import { ArrowRight } from '../components/icons'
import { FUNDRAISE } from '../components/involved-data'

/* ---------------------------------------------------------------------------
   Get involved, section 3 of 7: start a fundraiser.

   THERE IS NO PLATFORM AND THE SECTION SAYS SO IN ITS SECOND SENTENCE
   Every large charity puts a "create your page" button here. We have no
   page-builder, no JustGiving account and no server, so a button like that
   would be advertising software that does not exist. What we have is an
   account, a DGR endorsement and somebody who answers email — which is
   genuinely enough to run a birthday appeal on, and saying it plainly costs
   nothing. See involved-data.ts.

   TWO HALVES: what people actually do, and what happens when they do it. The
   ideas are the ordinary ones on purpose — a birthday, a run, an iftar, a jar
   — because the reader has to be able to see themselves in one, and a novel
   suggestion makes the page aspirational rather than usable.

   The steps are numbered and the last one is the one that matters: we tell you
   where it went, so you can tell the people who gave. Somebody who raised
   money among their friends has borrowed their trust, and the only way to give
   it back is a specific answer. That is the same promise the accountability
   page makes to a donor, made here to a fundraiser.
--------------------------------------------------------------------------- */

export default function InvolvedFundraise() {
  return (
    <section
      id="fundraise"
      aria-labelledby="fundraise-head"
      className="scroll-mt-[calc(var(--header-h)+24px)] bg-paper-2 py-s5 lg:py-s6"
    >
      <div className="gutter mx-auto max-w-page">
        <Reveal>
          <p className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.16em] text-green uppercase">
            <span aria-hidden="true" className="h-px w-6 bg-green/40" />
            {FUNDRAISE.eyebrow}
          </p>
          <h2
            id="fundraise-head"
            className="mt-s1 max-w-[20ch] font-display text-[clamp(28px,3.4vw,42px)] leading-[1.08] tracking-[-0.02em] text-balance"
          >
            {FUNDRAISE.title}
          </h2>
          <p className="mt-s2 max-w-measure text-[15.5px] leading-relaxed text-text-2">
            {FUNDRAISE.body}
          </p>
        </Reveal>

        {/* The four ordinary ideas. A quiet grid — these are prompts, not
            offers, so nothing here is a card with a border and a shadow
            competing with the give buttons elsewhere on the site. */}
        <div className="mt-s4 grid gap-s3 sm:grid-cols-2 lg:grid-cols-4">
          {FUNDRAISE.ideas.map((idea, i) => (
            <Reveal key={idea.title} delay={i * 60}>
              <div className="border-t border-line pt-s2">
                <h3 className="font-display text-[19px] leading-snug tracking-[-0.012em]">
                  {idea.title}
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-text-2">{idea.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* What happens once you say yes. */}
        <Reveal delay={120}>
          <div className="mt-s5 grid gap-s4 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-s5">
            <h3 className="font-display text-[clamp(20px,2vw,26px)] leading-snug tracking-[-0.016em]">
              How it works, start to finish
            </h3>

            <div>
              <ol className="grid gap-s2">
                {FUNDRAISE.steps.map((step, i) => (
                  <li key={step} className="flex gap-s2 border-t border-line pt-s2">
                    <span
                      aria-hidden="true"
                      className="nums mt-[3px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green/10 text-[12px] font-semibold text-green"
                    >
                      {i + 1}
                    </span>
                    <p className="max-w-measure text-[15px] leading-relaxed text-text-2">{step}</p>
                  </li>
                ))}
              </ol>

              <Link
                to="/contact?topic=Fundraising%20or%20an%20event"
                className="group mt-s3 inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-[12px] border border-ink/15 bg-paper px-6 text-[15px] font-semibold text-text transition-[border-color,background-color] duration-200 ease-brand hover:border-ink"
              >
                {FUNDRAISE.cta}
                <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
