import type { ReactNode } from 'react'

/* ---------------------------------------------------------------------------
   The hero on the two legal pages.

   17 SEPTEMBER 2026, on the Contact hero's pattern at the user's request (see
   ContactHero.tsx): the photograph taken to greyscale with the logo teal multiplied
   into it (baked into the file), a lighter pane down the left, a fine dot screen, and the words
   at the foot. The eyebrow is the script in pale gold, the title heavy and
   tight with an optional second line in pale gold, and the three facts a
   reader wants before they start sit along a hairline under it.

   It used to be a full screen of photograph behind two ink scrims, a light
   serif title and a small-capitals "Legal" label, closed by a gold-into-green
   hairline. That is all gone: the band is shorter now, because nobody needs a
   whole screen before a policy.

   Header goes transparent over this section (both routes are in
   OVERLAY_ROUTES) and turns solid once past it.

   PHOTOGRAPHY
     hero-privacy  Close-up of Hands, Louis Bauer, pexels.com/photo/249360,
                   Pexels License: commercial use, no attribution required.
     hero-terms    Person Signing Legal Document on Wooden Table, Matheus Lara,
                   pexels.com/photo/30268252, Pexels License, same terms.
                   It replaced a cut from an Alamy comp with the agency's
                   watermark tiled across it: unlicensed, visibly marked, and
                   sitting in public/, which would have published it. That file
                   is gone; do not put it back without the purchased copy.

   Neither picture claims to be Al-Anwaar's own, and neither should start to.
--------------------------------------------------------------------------- */

export type HeroFact = {
  label: string
  value: ReactNode
  /** Dates and numbers take tabular figures, like every other number on the site. */
  nums?: boolean
}

type Props = {
  /** The script label over the title: the document's name. */
  eyebrow: string
  /** The first line of the title. */
  title: string
  /** An optional second line, in pale gold. */
  titleMark?: string
  /** The plain-English version of the whole document, in one or two sentences. */
  summary: string
  facts: HeroFact[]
  /** The file stem under /assets/images, at 1200w and 2400w. */
  image: string
  /** How to frame it once the band is wider than the picture wants to be. */
  position?: string
}

const rise = (ms: number) => ({ animation: `hero-soft 1000ms var(--ease-reveal) ${ms}ms both` })

/** The screen over the photograph: one pale dot every 3px, as on Contact. */
const SCREEN = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.22) 0.6px, transparent 0.9px)',
  backgroundSize: '3px 3px',
}

export default function LegalHero({
  eyebrow,
  title,
  titleMark,
  summary,
  facts,
  image,
  position = '50% 50%',
}: Props) {
  return (
    <section
      data-overlay-hero=""
      aria-labelledby="legal-title"
      className="relative isolate mt-[calc(var(--header-h)*-1)] overflow-hidden bg-teal"
    >
      {/* ---------- the picture ---------- */}
      <div aria-hidden="true" className="absolute inset-0">
        <img
          src={`/assets/images/hero-${image}-teal-2400.jpg`}
          srcSet={`/assets/images/hero-${image}-teal-1200.jpg 1200w, /assets/images/hero-${image}-teal-2400.jpg 2400w`}
          sizes="100vw"
          alt=""
          width={2400}
          height={1600}
          decoding="sync"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: position, animation: 'hero-zoom 24s linear both' }}
        />
        {/* The teal is baked into the file (hero-<stem>-teal-*.jpg): greyscale,
            contrast 1.15, multiplied by the logo teal with a quarter of flat
            teal over it. A flat bg-teal/70 over the photograph drowned these
            two pale pictures to a plain block. The originals are
            hero-<stem>-1200/2400.jpg if they need remaking.

            decoding="sync", and no negative z-index on this layer: with async
            decoding the band painted before the photograph was ready and
            Chrome did not come back for it, leaving plain teal (17 Sep 2026,
            reported by the user). Same fix in ContactHero. */}
        <div className="absolute inset-y-0 left-0 hidden w-[42%] border-r border-paper/15 bg-paper/[0.06] md:block" />
        <div className="absolute inset-0 opacity-70" style={SCREEN} />
      </div>

      <div className="relative gutter mx-auto flex min-h-[clamp(480px,70svh,720px)] max-w-page flex-col justify-end pt-[calc(var(--header-h)+40px)] pb-[clamp(28px,4.5vh,48px)]">
        <p
          className="font-script text-[clamp(24px,2.2vw,32px)] leading-none text-gold-pale"
          style={rise(60)}
        >
          {eyebrow}
        </p>
        <h1
          id="legal-title"
          className="mt-s2 max-w-[18ch] font-display text-[clamp(36px,4.8vw,72px)] leading-[1] font-semibold tracking-[-0.04em] text-paper [text-shadow:0_2px_30px_rgba(0,40,44,0.35)]"
          style={rise(140)}
        >
          <span className="block">{title}</span>
          {titleMark && <span className="block text-gold-pale">{titleMark}</span>}
        </h1>
        <p
          className="mt-s3 max-w-[58ch] text-[clamp(15.5px,1.25vw,18px)] leading-[1.55] text-pretty text-paper/90"
          style={rise(320)}
        >
          {summary}
        </p>

        {/* The three facts a reader wants before they start. */}
        <dl
          className="mt-[clamp(28px,4.5vh,48px)] grid gap-x-s4 gap-y-s2 border-t border-paper/20 pt-s3 sm:grid-cols-3"
          style={rise(480)}
        >
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-[11px] font-semibold tracking-[0.14em] text-paper/65 uppercase">
                {fact.label}
              </dt>
              <dd
                className={`mt-1 font-display text-[clamp(16px,1.3vw,19px)] font-semibold tracking-[-0.01em] break-words text-paper ${
                  fact.nums ? 'nums' : ''
                }`}
              >
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
