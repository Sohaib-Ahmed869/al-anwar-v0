import { BrandMark } from './Brand'

/* ---------------------------------------------------------------------------
   The thing between two sections.

   THE PROBLEM IT SOLVES. Until now the home page told you a section had ended
   by changing the colour under your feet: paper, sand, paper, sand, paper, ink.
   That works, and it is what most charity sites do, but it costs something —
   the page arrives as five slabs rather than one argument, every band boundary
   is the loudest edge on the screen whether or not it is the most important
   one, and any card or photograph inside a band has to be re-checked against a
   second ground. Six grounds also means six chances for a section to look like
   it belongs to a different site.

   THE REPLACEMENT. One ground the whole way down — `--color-ground`, set in
   index.css, one line to change — and a drawn divider where a colour change
   used to be.

   WHEN TO USE WHICH.

     rule      A hairline, gold fading to green, the same one the top of every
               page already draws at the foot of its hero. The default, and now
               nearly the only one. Use it between two sections that are part of
               the same movement — the appeals rail and the ask under it are one
               thought, not two — and between two that are not, because there is
               nothing else left to reach for.

     mark      The hairline with the brandmark on it. THE SECTION BREAKER
               on the home page, at the client's direction (16 September 2026),
               and used at every seam rather than once.

               That is a reversal of what this file used to say, which was that
               two on a page turns a signature into a habit. The argument still
               holds and is worth knowing if the page ever gets longer: a mark
               that appears at every turn stops being read as one. What makes it
               survivable here is that the home page has four seams, not ten,
               and that the mark is now a line with a building on it rather than
               a badge dropped into a gap (written of the old masjid mark; the 2026
               hexagon keeps the same job) — it reads as rule first, ornament
               second, which is the right order for something used this often.

   ALL OF THEM ARE aria-hidden AND NONE OF THEM IS AN <hr>. A divider between
   two `<section>`s that already have headings adds nothing to the accessibility
   tree — the heading is the boundary — and an <hr> would announce a topic
   change that has already been announced. This is paint.

   ---------------------------------------------------------------------------
   THERE WERE TWO MORE, AND THEY ARE GONE — off at the client's request on
   16 September 2026, and deleted rather than left as variants nobody calls.
   Both are recoverable from here.

     skyline   A low horizon of domes and minarets at three depths, full-bleed,
               `h-[clamp(56px,7vw,96px)]`, `viewBox="0 0 1600 120"` with
               `preserveAspectRatio="xMidYMax slice"`. Five silhouettes at
               opacity .06 / .09 / .12 and a 2px ground rect at .1. One
               silhouette, drawn from the baseline up so `scale` only changed
               how far away it looked:

                 <g transform={`translate(${x} 120) scale(${s}) translate(0 -120)`}>
                   <path d="M-58 120 V64 a5 5 0 0 1 10 0 V120 Z" />
                   <path d="M-62 64 h18 l-3 -6 h-12 Z" />
                   <path d="M-53 58 l2 -12 l2 12 Z" />
                   <path d="M48 120 V64 a5 5 0 0 1 10 0 V120 Z" />
                   <path d="M44 64 h18 l-3 -6 h-12 Z" />
                   <path d="M53 58 l2 -12 l2 12 Z" />
                   <path d="M0 26 l2 12 h-4 Z" />
                   <path d="M0 36 C 8 52, 36 90, 42 106 C 43.5 111, 43.8 116,
                            44 120 L -44 120 C -43.8 116, -43.5 111, -42 106
                            C -36 90, -8 52, 0 36 Z" />
                 </g>

               That last path is the pointed bell, and it had to be kept in step
               with Ornament.tsx's — it was left as the earlier onion for one
               round and the horizon came out a row of teardrops standing next
               to a mark that was not a teardrop.

     tile      A 34px eight-point star lattice, as a repeating background rather
               than one drawing, faded at both ends with
               `[mask-image:linear-gradient(90deg,transparent,#000_22%,#000_78%,transparent)]`:

                 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'
                 width='34' height='34' viewBox='0 0 34 34'%3E%3Cg fill='none'
                 stroke='%232F6B5A' stroke-opacity='0.3' stroke-width='1'%3E
                 %3Cpath d='M17 0 L34 17 L17 34 L0 17 Z'/%3E%3Cpath d='M5 5 H29
                 V29 H5 Z'/%3E%3C/g%3E%3C/svg%3E")

               The one thing that is not obvious about it: the diamond touches
               all four edge midpoints. Inset it by even a pixel and the seam
               shows. And 0.3 is not a typo for something smaller — at 0.22 it
               was invisible in anything but a full-resolution screenshot.
--------------------------------------------------------------------------- */

type Variant = 'rule' | 'mark'

export default function Divider({
  variant = 'rule',
  small = false,
  className = '',
}: {
  variant?: Variant
  /** the mark at 24px, for a seam that should be felt more than seen */
  small?: boolean
  className?: string
}) {
  if (variant === 'mark') return <Marked small={small} className={className} />
  return <Rule className={className} />
}

/* The hairline. Gold on the left of centre, green on the right, both falling to
   nothing at the edges — the page's existing divider, lifted out of PageBand so
   there is one copy of it. Gold appearing here does not break the give-action
   rule: it is a 1px gradient at under half opacity, not a filled thing you
   could mistake for a button. */
function Rule({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`gutter mx-auto max-w-page ${className}`}>
      <div className="h-px bg-[linear-gradient(90deg,transparent,rgba(242,193,74,.45),rgba(0,103,112,.45),transparent)]" />
    </div>
  )
}

/* The hairline with the brandmark at its centre: two rules and the mark
   between them rather than one rule with something laid over it, so the mark
   needs no opaque backing plate and the divider still works if the ground
   changes under it. The gap is small on purpose, so the eye reads one line
   across the page and not three objects in a row. */
function Marked({ small = false, className = '' }: { small?: boolean; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`gutter mx-auto flex max-w-page items-center gap-s2 ${className}`}
    >
      <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(0,103,112,.45))]" />
      {/* The 2026 brandmark in its own colours — teal, with the doorway lit in
          saffron. It is a hexagon, symmetrical and self-contained, so it
          centres on the rule rather than standing on it the way the old
          masjid did; `items-center` replaces the old `items-end`. */}
      <BrandMark className={small ? 'h-7 w-auto shrink-0' : 'h-11 w-auto shrink-0 sm:h-12'} />
      <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(0,103,112,.45),transparent)]" />
    </div>
  )
}
