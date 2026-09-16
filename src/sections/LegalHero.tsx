import type { ReactNode } from 'react'

/* ---------------------------------------------------------------------------
   The hero on the two legal pages, built the way HomeHero is: one photograph,
   pulled up behind the header, read through the same two scrims.

   Like the home hero it takes --strip-h off the viewport, so it comes out
   exactly one screen tall whether or not the emergency strip is live — and it
   is pulled up behind the header by --header-h, which is what makes the bar sit
   inside the picture rather than on a shelf above it.

   Header goes transparent over this section — the `overlay` flag there lists
   the routes that open on a photograph, and these two are on it.

   It closes on the same gold-into-green hairline the footer opens with, so the
   two dark bands bookend the page and the paper between them reads as the
   document itself. That hairline is the only gold in the band, and there is no
   breadcrumb: the title says which document this is, the bar above says where
   it sits, and a "Home / Privacy policy" over a 58px headline only says it a
   third time.

   PHOTOGRAPHY
     hero-privacy  Close-up of Hands, Louis Bauer — pexels.com/photo/249360,
                   Pexels License: commercial use, no attribution required, like
                   the four on the home page.
     hero-terms    Person Signing Legal Document on Wooden Table, Matheus Lara —
                   pexels.com/photo/30268252, Pexels License, same terms.
                   It replaced a cut from public/assets/images/terms-and-conditions.jpg,
                   which was an Alamy comp with the agency's watermark tiled across
                   it — unlicensed, visibly marked, and sitting in public/, which
                   would have published it. That file is gone; do not put it back
                   without the purchased copy. This one is also the better picture
                   for the band: the arm and the table hold the left, where the
                   type is, and the document sits out on the right where the
                   photograph is allowed to show.

   Neither picture claims to be Al-Anwaar's own, and neither should start to —
   see the caption rule in DESIGN-NOTES.md.
--------------------------------------------------------------------------- */

export type HeroFact = {
  label: string
  value: ReactNode
  /** Dates and numbers take tabular figures, like every other number on the site. */
  nums?: boolean
}

type Props = {
  /** 'Legal' — the section these two pages share. */
  eyebrow: string
  title: string
  /** The plain-English version of the whole document, in one or two sentences. */
  summary: string
  facts: HeroFact[]
  /** The file stem under /assets/images, at 1200w and 2400w. */
  image: string
  /** How to frame it once the band is wider than the picture wants to be. */
  position?: string
}

export default function LegalHero({
  eyebrow,
  title,
  summary,
  facts,
  image,
  position = '50% 50%',
}: Props) {
  return (
    <section
      /* Header watches for this: the bar stays transparent for exactly as long
         as this section is still passing under it. */
      data-overlay-hero=""
      /* pulled up behind the header, which is transparent over it */
      className="relative isolate overflow-hidden bg-ink mt-[calc(var(--header-h)*-1)]"
    >
      {/* ---------- the photograph, and the dark it is read through ----------
          Presentational: the title is the content of this band and the picture
          behind it is the weather. What each one shows is written above the
          <LegalHero> that asks for it. */}
      <div aria-hidden="true" className="absolute inset-0">
        <img
          src={`/assets/images/hero-${image}-2400.jpg`}
          srcSet={`/assets/images/hero-${image}-1200.jpg 1200w, /assets/images/hero-${image}-2400.jpg 2400w`}
          sizes="100vw"
          alt=""
          width={2400}
          height={1600}
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: position, animation: 'hero-zoom 24s linear both' }}
        />

        {/* The same two scrims as the home hero. The first darkens the top for
            the header and the foot for the facts and lets the middle of the
            picture come through; the second only exists from md up, where the
            type is in a column on the left and the right of the photograph can
            be left alone. rgba of --color-ink, which a gradient cannot take as
            a variable. */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(21,26,24,0.74)_0%,rgba(21,26,24,0.30)_32%,rgba(21,26,24,0.38)_62%,rgba(21,26,24,0.82)_100%)]" />
        <div className="absolute inset-0 hidden bg-[linear-gradient(95deg,rgba(21,26,24,0.78)_0%,rgba(21,26,24,0.30)_46%,transparent_78%)] md:block" />
      </div>

      {/* ---------- what is on top of it ---------- */}
      <div className="relative flex min-h-[calc(100svh-var(--strip-h))] flex-col pt-[var(--header-h)]">
        <div className="gutter mx-auto flex w-full max-w-page flex-1 flex-col">
          <div className="flex flex-1 flex-col justify-center py-[clamp(26px,5vh,56px)]">
            {/* The rule and the label, set the way the home hero sets its own. */}
            <p className="flex items-center gap-3.5 text-[11.5px] font-semibold tracking-[0.2em] text-paper/75 uppercase [text-shadow:0_1px_14px_rgba(0,0,0,0.6)]">
              <span aria-hidden="true" className="h-px w-9 bg-paper/45" />
              {eyebrow}
            </p>

            <h1 className="mt-[clamp(10px,1.6vh,18px)] max-w-[16ch] font-display text-[clamp(34px,4.6vw,58px)] leading-[1.06] tracking-[-0.016em] text-paper [text-wrap:balance] [text-shadow:0_1px_30px_rgba(0,0,0,0.55)]">
              {title}
            </h1>

            <p className="mt-[clamp(12px,2vh,20px)] max-w-measure text-[clamp(15px,1.35vw,17px)] leading-relaxed text-paper/75 [text-shadow:0_1px_16px_rgba(0,0,0,0.55)]">
              {summary}
            </p>
          </div>

          {/* The three facts a reader wants before they start, along the foot of
              the band — where the home hero puts its controls. */}
          <dl className="flex flex-wrap gap-x-s4 gap-y-s2 border-t border-paper/15 pt-s3 pb-[clamp(20px,3.4vh,36px)]">
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <dt className="text-[11px] font-semibold tracking-[0.13em] text-paper/50 uppercase">
                  {fact.label}
                </dt>
                <dd
                  className={`mt-1 text-[14.5px] text-paper/90 [text-shadow:0_1px_14px_rgba(0,0,0,0.5)] ${
                    fact.nums ? 'nums' : ''
                  }`}
                >
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="relative h-px bg-[linear-gradient(90deg,transparent,rgba(200,155,44,.5),rgba(47,107,90,.5),transparent)]"
      />
    </section>
  )
}
