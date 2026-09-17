import { ArrowRight } from '../components/icons'
import { CONTACT, FORM_ID } from '../components/contact-data'
import { PHONE } from '../components/nav-data'

/* ---------------------------------------------------------------------------
   Contact, section 1 of 3: the hero.

   17 SEPTEMBER 2026, fourth version, taken from the reference the user named
   (Vale Capital's contact page on Dribbble): a wide photograph washed flat in
   one brand colour with a fine screen over it, a lighter pane down the left
   third, the words at the foot on the left and the way in on the right.

   The words were then rewritten at the user's choice: "Contact us" in the
   script, "Talk to / our team." heavy with the second line in pale gold,
   a two-line intro, and on the right "Write to us" with "or call" under it.

   The wash is the logo teal: the photograph is taken to greyscale and the
   teal laid flat over it, so any frame reads as the same colour. The
   screen is a 3px dot grid drawn in CSS. The header sits over it
   (/contact is back in OVERLAY_ROUTES) and turns solid once past it.

   The photograph is stock, chosen by the user as the free stand-in for the
   reference's own picture: "Women talking at office standing desk" by
   LinkedIn Sales Solutions on Unsplash (Unsplash License, free to use, no
   credit required), https://unsplash.com/photos/qbDiSp5IqxA, saved at 2400
   and 1200 wide as hero-contact-glass-*.jpg. Nothing here may caption it as
   Al-Anwaar's own work, and its alt is empty because it is decoration under
   the words.

   Earlier versions the same day, for the record: a light type-led hero with
   a turning subject and a ribbon; then with three contact cards down the
   right. The cards' email, phone and address are all in the panel beside the
   form.
--------------------------------------------------------------------------- */

const H = CONTACT.hero

const rise = (ms: number) => ({ animation: `hero-soft 1000ms var(--ease-reveal) ${ms}ms both` })

const wantsLessMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The screen over the photograph: one pale dot every 3px. */
const SCREEN = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.22) 0.6px, transparent 0.9px)',
  backgroundSize: '3px 3px',
}

export default function ContactHero() {
  const toForm = () =>
    document.getElementById(FORM_ID)?.scrollIntoView({
      behavior: wantsLessMotion() ? 'auto' : 'smooth',
      block: 'start',
    })

  return (
    <section
      data-overlay-hero=""
      aria-labelledby="contact-title"
      className="relative isolate mt-[calc(var(--header-h)*-1)] overflow-hidden bg-teal"
    >
      {/* ---------- the picture ---------- */}
      <div aria-hidden="true" className="absolute inset-0">
        <img
          src="/assets/images/hero-contact-glass-2400.jpg"
          srcSet="/assets/images/hero-contact-glass-1200.jpg 1200w, /assets/images/hero-contact-glass-2400.jpg 2400w"
          sizes="100vw"
          alt=""
          width={2400}
          height={1600}
          decoding="sync"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover grayscale brightness-[0.9] contrast-[1.1]"
          style={{ objectPosition: '62% 35%', animation: 'hero-zoom 24s linear both' }}
        />
        {/* the teal wash, laid flat over the greyscale photograph */}
        <div className="absolute inset-0 bg-teal/[0.66]" />
        {/* the lighter pane down the left third, with a hairline edge */}
        <div className="absolute inset-y-0 left-0 hidden w-[42%] border-r border-paper/15 bg-paper/[0.06] md:block" />
        {/* the screen */}
        <div className="absolute inset-0 opacity-70" style={SCREEN} />
        {/* a little depth at the foot, under the words */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(0,40,44,0.45)_100%)]" />
      </div>

      <div className="relative gutter mx-auto flex min-h-[clamp(520px,80svh,820px)] max-w-page flex-col justify-end pt-[calc(var(--header-h)+40px)] pb-[clamp(36px,6vh,64px)]">
        <div className="flex flex-col gap-s4 md:flex-row md:items-end md:justify-between">
          <div>
            <p
              className="font-script text-[clamp(24px,2.2vw,32px)] leading-none text-gold-pale"
              style={rise(60)}
            >
              {H.eyebrow}
            </p>
            <h1
              id="contact-title"
              className="mt-s2 font-display text-[clamp(40px,5.6vw,84px)] leading-[0.98] font-semibold tracking-[-0.04em] text-paper [text-shadow:0_2px_30px_rgba(0,40,44,0.35)]"
              style={rise(140)}
            >
              <span className="block">{H.titleLead}</span>
              <span className="block text-gold-pale">{H.titleMark}</span>
            </h1>
            <p
              className="mt-s3 max-w-[48ch] text-[clamp(15.5px,1.25vw,18px)] leading-[1.55] text-pretty text-paper/90"
              style={rise(320)}
            >
              {H.intro}
            </p>
          </div>

          {/* Both ways in: the form below, or the phone. */}
          <div className="flex shrink-0 flex-col items-start gap-1 md:items-end" style={rise(480)}>
            <button
              type="button"
              onClick={toForm}
              className="group inline-flex min-h-[44px] items-center gap-3 font-display text-[clamp(18px,1.5vw,22px)] font-semibold tracking-[-0.015em] text-paper transition-colors duration-200 ease-brand hover:text-gold-pale"
            >
              {H.more}
              <span
                aria-hidden="true"
                className="flex size-10 items-center justify-center rounded-full border border-paper/40 transition-[border-color,background-color,color] duration-300 ease-brand group-hover:border-gold-pale group-hover:bg-gold-pale group-hover:text-ink"
              >
                <ArrowRight className="h-3.5 w-3.5 rotate-90 transition-transform duration-300 ease-brand group-hover:translate-y-0.5" />
              </span>
            </button>
            <p className="text-[14.5px] text-paper/75">
              {H.call}{' '}
              <a
                href={PHONE.href}
                className="nums font-semibold text-paper underline decoration-paper/35 underline-offset-4 transition-colors duration-200 hover:text-gold-pale hover:decoration-gold-pale"
              >
                {PHONE.label}
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
