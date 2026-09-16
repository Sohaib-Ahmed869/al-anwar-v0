/* ---------------------------------------------------------------------------
   About, section 1 of 5: the band at the top.

   Built the way ContactHero and LegalHero are — one photograph, pulled up
   behind the header, read through the same two scrims — and like them it
   carries its own copy of the gradients rather than reaching for a fourth
   shared file. Four heroes with four jobs is now close to being a component;
   what is stopping it is that this one is the only band on the site whose
   photograph is allowed a credit, and the credit is the point.

   It is a full screen, like the home hero and the two legal ones: pulled up
   behind the header by --header-h, and with --strip-h taken off the viewport so
   it comes out exactly one screen tall whether or not the emergency strip is
   live. The contact hero is the only band on the site that is deliberately
   shorter, because the point of that page is the form. The point of this one is
   the photograph — it is the only hero on the site we actually took — so it
   gets the whole screen the home page gets.

   PHOTOGRAPHY
     A masjid of ours going up in The Gambia, July 2022 —
     public/assets/images/PHOTO-2022-07-29-10-21-12.webp. This is the one hero
     on the site that is OURS: the banner tied to the wall reads "Al-Anwaar
     MASJID BUILDING PROJECT", which is why the line under the headline says so
     out loud. Everywhere else the hero is licensed stock and is never captioned
     as our work — see DESIGN-NOTES.md and the note at the top of HomeHero. Here
     the rule runs the other way, and the About page is exactly where it should.

     The banner also reads "on behalf of JAM.. MUZAFAH". That is the dedication,
     not the village: an earlier draft of this caption read "the masjid at Jamee
     Muzafah" and turned a donor into a place. The name is off the page until
     somebody confirms both the spelling and whose it is.

     RESOLUTION. It is 2012x958 — the largest frame we hold of it, and the only
     photograph of ours big enough to carry a full screen at all. Because the
     band is now a whole screen the crop is height-bound, so the picture is
     scaled to the viewport's height and the sides are cropped off: comfortable
     up to about 1440x900, roughly 13% upscaled at 1920x1080, and half as big
     again as it wants to be on a 2560px monitor. It holds because it is read
     through two scrims and because the subject is a rendered concrete wall
     rather than a face. If the original frame still exists on somebody's phone,
     re-export it at 2400px and 3200px and give this a srcSet like the stock
     heroes have — that is the proper fix and it is a five-minute one.

   TODO: the date comes off the file, not off the field team's log. Confirm the
   month, and the village, before launch — same rule as every other caption on
   the site.
--------------------------------------------------------------------------- */

type Fact = { label: string; value: string }

/** One, and it is where we work. Two others have come off this row and both
 *  for the same reason: a photograph of our own work is the argument this band
 *  is making, and a registration number is not evidence, it is paperwork.
 *
 *  The ABN, the ACNC registration date and the DGR endorsement have not been
 *  lost — they are set out as sentences on Where it goes, under #registration,
 *  which is where a donor checking up on us actually goes and where the footer
 *  has always pointed. The 88c-in-the-dollar line went the same way: it is that
 *  page's headline number, it is not audited yet, and it was the one claim in
 *  this band asking to be believed rather than checked. */
const FACTS: Fact[] = [
  /* All five on one line and wrapping if they must. Splitting the list across
     a value and a note made the last two read as an afterthought. */
  { label: 'Where we work', value: 'Gaza, Yemen, Lebanon, Syria, The Gambia' },
]

export default function AboutHero() {
  return (
    <section
      /* Header watches for this: the bar stays transparent for exactly as long
         as this section is still passing under it. */
      data-overlay-hero=""
      className="relative isolate mt-[calc(var(--header-h)*-1)] overflow-hidden bg-ink"
    >
      <div aria-hidden="true" className="absolute inset-0">
        <img
          src="/assets/images/PHOTO-2022-07-29-10-21-12.webp"
          alt=""
          width={2012}
          height={958}
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
          /* Framed right of centre, so the building and the banner tied to it
             sit out in the open half of the band rather than under the type. */
          style={{ objectPosition: '72% 62%', animation: 'hero-zoom 24s linear both' }}
        />

        {/* The same two scrims as the other three heroes. The first darkens the
            top for the header and the foot for the facts and lets the middle of
            the picture through; the second only exists from md up, where the
            type is in a column on the left and the right of the photograph —
            here, the building itself — can be left alone. rgba of --color-ink,
            which a gradient cannot take as a variable. */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(21,26,24,0.80)_0%,rgba(21,26,24,0.38)_32%,rgba(21,26,24,0.46)_62%,rgba(21,26,24,0.88)_100%)]" />
        <div className="absolute inset-0 hidden bg-[linear-gradient(95deg,rgba(21,26,24,0.90)_0%,rgba(21,26,24,0.62)_38%,rgba(21,26,24,0.22)_62%,transparent_84%)] md:block" />
      </div>

      {/* One screen, less the emergency strip — the same arithmetic HomeHero
          and LegalHero do, so all three bands agree on what "a screen" is. */}
      <div className="relative flex min-h-[calc(100svh-var(--strip-h))] flex-col pt-[var(--header-h)]">
        {/* No breadcrumb, here or anywhere. This page has its own item lit up
            in the bar directly above, and a "Home / About" under it only says
            again what the nav already shows. */}
        <div className="gutter mx-auto flex w-full max-w-page flex-1 flex-col">
          <div className="flex flex-1 flex-col justify-center py-[clamp(26px,5vh,56px)]">
            <p className="flex items-center gap-3.5 text-[11.5px] font-semibold tracking-[0.2em] text-paper/75 uppercase [text-shadow:0_1px_14px_rgba(0,0,0,0.6)]">
              <span aria-hidden="true" className="h-px w-9 bg-paper/45" />
              About us
            </p>

            <h1 className="mt-[clamp(10px,1.6vh,18px)] max-w-[15ch] font-display text-[clamp(34px,4.6vw,58px)] leading-[1.06] tracking-[-0.016em] text-paper [text-shadow:0_1px_30px_rgba(0,0,0,0.55)] [text-wrap:balance]">
              Who you are giving to.
            </h1>

            {/* One sentence. The band already carries a headline, a photograph
                and the list of places; a paragraph explaining the page as well
                is the one thing here nobody reads. What it used to say — where
                it came from, who decides, what it costs — is the page itself. */}
            <p className="mt-[clamp(12px,2vh,20px)] max-w-measure text-[clamp(15px,1.35vw,17px)] leading-relaxed text-paper/80 [text-shadow:0_1px_16px_rgba(0,0,0,0.55)]">
              A registered Australian charity, delivering through partners we can name.
            </p>

            {/* The one hero photograph on the site that is ours, said out loud
                rather than left for a reader to assume. */}
            <p className="mt-[clamp(14px,2.2vh,22px)] flex max-w-measure items-center gap-s1 text-[12.5px] leading-relaxed text-paper/55">
              <span aria-hidden="true" className="h-px w-5 shrink-0 bg-gold/70" />
              <span>Our masjid build in The Gambia. July 2022.</span>
            </p>
          </div>

          <dl className="flex flex-wrap gap-x-s4 gap-y-s2 border-t border-paper/15 pt-s3 pb-[clamp(20px,3.4vh,36px)]">
            {FACTS.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <dt className="text-[11px] font-semibold tracking-[0.13em] text-paper/50 uppercase">
                  {fact.label}
                </dt>
                <dd className="mt-1 text-[14.5px] text-paper/90 [text-shadow:0_1px_14px_rgba(0,0,0,0.5)]">
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
