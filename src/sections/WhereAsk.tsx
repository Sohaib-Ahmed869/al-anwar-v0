import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import { ArrowRight, HandHeart } from '../components/icons'

/* ---------------------------------------------------------------------------
   Where it goes, section 8 of 8: the ask.

   The same sand band the Zakat page closes on, and it earns its place here for
   a reason the other pages do not have: somebody who has read this far has
   just been shown the gaps as well as the figures, and the honest next move is
   to ask anyway rather than let the page trail off into the footer as though
   the charity were embarrassed.

   So the heading does not claim the page proved anything. It says what the
   page actually is — a page that shows its working, including where the
   working runs out — and then asks. The second link goes to a person, because
   the reader most likely to have got to the bottom of this page is the reader
   most likely to have a question the page did not answer.
--------------------------------------------------------------------------- */

export default function WhereAsk() {
  return (
    <section
      aria-labelledby="where-ask-head"
      className="relative isolate overflow-hidden border-t border-line bg-sand py-s5"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(85%_70%_at_10%_0%,rgba(47,107,90,0.1)_0%,transparent_62%)]"
      />

      <Reveal className="gutter mx-auto flex max-w-page flex-col gap-s4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2
            id="where-ask-head"
            className="max-w-[20ch] font-display text-[clamp(28px,3.4vw,40px)] leading-[1.08] tracking-[-0.02em] text-balance"
          >
            You have seen the working, gaps and all.
          </h2>
          <p className="mt-s2 max-w-measure text-[15.5px] leading-relaxed text-text-2">
            Nothing on this page asks to be taken on trust. Every figure is either lodged
            with the regulator or marked as one we have not confirmed yet. If something here does
            not add up for you,{' '}
            <Link
              to="/contact"
              className="font-semibold text-green underline decoration-green/30 underline-offset-4 transition-colors duration-200 ease-brand hover:text-ink hover:decoration-ink/40"
            >
              ask us about it
            </Link>{' '}
            before you give.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/give"
            className="group relative inline-flex min-h-[54px] items-center justify-center gap-2.5 overflow-hidden rounded-[12px] bg-gold px-7 text-[16px] font-semibold tracking-[-0.006em] text-ink shadow-gold transition-[transform,box-shadow,background-color,color] duration-200 ease-brand hover:-translate-y-[1.5px] hover:bg-gold-dark hover:text-paper hover:shadow-gold-lg active:translate-y-0"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 -left-full w-full bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,0.55)_50%,transparent_80%)] transition-transform duration-[750ms] ease-brand group-hover:translate-x-[250%]"
            />
            <HandHeart className="relative h-[18px] w-[18px] shrink-0 transition-transform duration-300 ease-brand group-hover:scale-[1.12]" />
            <span className="relative">Make a gift</span>
          </Link>

          <Link
            to="/appeals"
            className="group inline-flex min-h-[54px] items-center justify-center gap-1.5 rounded-[12px] border border-ink/15 px-6 text-[15.5px] font-semibold text-text transition-[border-color,background-color] duration-200 ease-brand hover:border-ink hover:bg-paper-2"
          >
            See the appeals
            <ArrowRight className="h-3 w-3 -translate-x-0.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
          </Link>
        </div>
      </Reveal>
    </section>
  )
}
