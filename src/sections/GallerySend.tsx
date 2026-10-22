import Reveal from '../components/Reveal'
import { BREAKOUT } from '../components/SectionHead'
import { ArrowRight, Instagram, Mail } from '../components/icons'
import { SEND } from '../components/gallery-data'
import { ORG } from '../components/org-data'
import { INSTAGRAM } from '../components/social-data'

/* ---------------------------------------------------------------------------
   /gallery, section 3 of 3: the close. The same teal panel as Get involved
   and Events, asking for the one thing this page is short of: photographs.
   An email, not an upload form, because the site has no server. No gold.
--------------------------------------------------------------------------- */

export default function GallerySend() {
  const mailto = `mailto:${ORG.email}?subject=${encodeURIComponent(SEND.subject)}`

  return (
    <section aria-labelledby="gallery-send-head" className="pb-[clamp(56px,6.5vw,96px)]">
      <div className="gutter mx-auto max-w-page">
        <Reveal variant="clip" className={`block ${BREAKOUT}`}>
          <div className="relative isolate flex flex-col gap-s4 overflow-hidden rounded-2xl bg-grad-lagoon-x p-s3 text-paper sm:p-s4 md:flex-row md:items-center md:justify-between lg:p-[clamp(40px,4vw,64px)]">
            <div>
              <p className="font-script text-[clamp(24px,2.2vw,32px)] leading-none text-gold-pale">{SEND.eyebrow}</p>
              <h2
                id="gallery-send-head"
                className="mt-2 max-w-[22ch] font-display text-[clamp(28px,3.2vw,44px)] leading-[1.08] tracking-[-0.025em] text-balance"
              >
                {SEND.title}
              </h2>
              <p className="mt-s2 max-w-[48ch] text-[15.5px] leading-[1.55] text-paper/85">{SEND.body}</p>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-s2 md:items-end">
              <a
                href={mailto}
                className="group inline-flex min-h-[52px] items-center gap-2 rounded-[10px] bg-paper px-6 text-[15.5px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-green-pale"
              >
                <Mail className="h-4 w-4" />
                {SEND.action}
                <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
              </a>
              <a
                href={INSTAGRAM.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-[14.5px] font-semibold text-paper underline decoration-paper/35 underline-offset-4 transition-colors duration-200 hover:text-gold-pale hover:decoration-gold-pale"
              >
                <Instagram className="h-3.5 w-3.5" />
                {SEND.follow}
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
