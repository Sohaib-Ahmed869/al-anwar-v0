import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import { ArrowRight, Mail } from '../components/icons'
import { ASK } from '../components/involved-data'
import { ORG } from '../components/org-data'

/* ---------------------------------------------------------------------------
   Get involved, section 7 of 7: the close.

   IT CLOSES BY EXPLAINING THE THING IT DOES NOT HAVE
   Every other page on this site closes with a gold button. This one cannot,
   and should not pretend otherwise: the page has just made four offers and
   collected nothing, and a reader who has scrolled the whole way has probably
   noticed there was never a sign-up box. So the last section says why — no
   server, nowhere to put your details, and we would rather tell you than take
   them — which turns the site's biggest missing feature into the last piece of
   evidence for the argument every page here makes.

   The reasoning is the one at the top of services/contact.ts and
   services/letter.ts, stated to the reader for once instead of only to the
   next developer. When there is a server, this section is the one that
   changes, and involved-data.ts says what should replace it.

   NO GOLD. Gold is the give action and this section does not ask for money —
   the email address is the loudest thing in it, which is correct, because
   writing one line to a person is the entire ask. The give button is at the
   top of every page already for anyone who came here and changed their mind.
--------------------------------------------------------------------------- */

export default function InvolvedAsk() {
  return (
    <section
      aria-labelledby="involved-ask-head"
      className="relative isolate overflow-hidden border-t border-line bg-sand py-s5"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(85%_70%_at_10%_0%,rgba(47,107,90,0.1)_0%,transparent_62%)]"
      />

      <Reveal className="gutter mx-auto flex max-w-page flex-col gap-s4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2
            id="involved-ask-head"
            className="max-w-[18ch] font-display text-[clamp(28px,3.4vw,40px)] leading-[1.08] tracking-[-0.02em] text-balance"
          >
            {ASK.title}
          </h2>
          <p className="mt-s2 max-w-measure text-[15.5px] leading-relaxed text-text-2">
            {ASK.body}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`mailto:${ORG.email}`}
            className="group inline-flex min-h-[54px] items-center justify-center gap-2.5 rounded-[12px] bg-ink px-7 text-[16px] font-semibold text-paper transition-[transform,background-color] duration-200 ease-brand hover:-translate-y-[1.5px] hover:bg-ink-2 active:translate-y-0"
          >
            <Mail className="h-[18px] w-[18px] shrink-0" />
            {ORG.email}
          </a>

          <Link
            to="/contact"
            className="group inline-flex min-h-[54px] items-center justify-center gap-1.5 rounded-[12px] border border-ink/15 px-6 text-[15.5px] font-semibold text-text transition-[border-color,background-color] duration-200 ease-brand hover:border-ink hover:bg-paper-2"
          >
            Or use the form
            <ArrowRight className="h-3 w-3 -translate-x-0.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
          </Link>
        </div>
      </Reveal>
    </section>
  )
}
