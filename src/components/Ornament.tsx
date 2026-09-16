/* ---------------------------------------------------------------------------
   The masjid mark, taken out of the logo and made available on its own.

   THESE ARE TRACED FROM THE ARTWORK, NOT DRAWN.
   They were hand-drawn approximations for one round, on the argument that a
   159x126 bitmap traced at 28px is mush. That argument was right about the
   bitmap and wrong about the method: traced at 4x with the contour simplified
   afterwards, the mark comes out as about a hundred points and reads cleanly at
   16px — the favicon is the same geometry and survives a browser tab. So the
   approximation is gone, and what is here now is the charity's own mark rather
   than a careful drawing of it. Same source as public/favicon.svg: columns 1 to
   126 of assets/images/Al-Anwaar-Logo-600x136.png, which is the mark with the
   wordmark left behind.

   The practical consequence is that these two and the favicon cannot drift.
   They are one shape used three times, and if the logo artwork is ever
   redrawn, all three are regenerated from it together.

   IT LEANS, AND THAT IS THE ARTWORK.
   The minaret is on the left and there is no matching one on the right. The
   drawn version added a second minaret to make a centred ornament sit square,
   which is a real problem honestly solved and is also a different building
   from the one the charity uses. The lean stays. If a divider ever has to be
   optically centred against it, nudge the divider, not the mark.

   THE ARCADE IS GONE WITH THE DRAWING. The old glyph cut three arched openings
   out of the dome's base in `--ornament-cut`, so the mark could sit on any
   ground. The artwork has no such openings — at the size the logo is actually
   drawn they are not there — so the cut-out colour is no longer needed and
   `--ornament-cut` has come out of index.css with it.

   Everything here is `currentColor` and nothing carries a colour of its own.
   The divider decides the tint; the mark only decides the shape. The tint it
   should normally be given is `text-teal`, which is --color-teal, which is the
   logo's own #006770 — see the token note in index.css.
--------------------------------------------------------------------------- */

type MarkProps = {
  className?: string
  /** Defaults to hidden: this is decoration, and a screen reader has the logo already. */
  title?: string
}

/* The whole mark — the dome, the minaret, and the sweep they stand on. Square,
   because the artwork is: 125x125 source pixels, near enough to the unit.

   The sweep is the piece that makes the logo look like a place rather than an
   icon, and it is the reason this is the version a divider should use. It runs
   out past the buildings on both sides, so the mark meets the hairline either
   side of it instead of floating between two of them. */
export function MasjidMark({ className = '', title }: MarkProps) {
  return (
    <svg
      viewBox="0 0 128 128"
      fill="currentColor"
      fillRule="evenodd"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
    >
      <path d="M29.64 62.08L29.64 64.13L28.36 66.68L27.59 82.01L30.66 81.76L31.17 82.27L31.17 86.1L32.45 87.12L32.7 84.57L33.98 82.01L33.98 78.18L35.26 75.62L36.28 67.7L39.35 59.27L42.41 54.93L46.75 50.59L58 43.18L66.94 35.26L67.7 33.98L67.96 31.17L67.96 23.76L68.98 22.99L70 24.53L69.75 34.24L78.44 42.41L88.4 48.8L93 52.63L97.6 58.25L99.39 61.83L103.47 78.69L103.22 81.76L104.75 84.31L104.5 89.42L105.26 90.44L107.56 90.95L107.05 106.79L106.03 107.31L98.11 105.01L84.06 102.71L73.84 101.94L55.95 102.45L45.73 103.73L31.94 106.79L23.25 109.86L15.84 113.69L14.05 113.95L13.8 93.51L12.01 90.7L11.5 87.63L12.26 86.1L12.52 82.27L13.03 81.76L16.1 81.76L15.84 71.54L13.8 62.34L14.56 61.57L17.12 61.32L16.61 59.02L16.86 50.08L17.88 49.05L16.86 48.54L16.61 46.75L19.93 21.97L20.69 14.56L20.69 4.09L21.46 0.26L22.74 3.83L22.23 6.13L22.99 8.69L22.74 13.29L27.08 47.01L26.83 48.29L25.8 48.8L26.57 50.08L26.57 59.53L25.8 61.32L29.64 62.08ZM84.57 113.18L67.45 111.39L55.7 111.39L38.83 112.93L27.59 115.23L15.07 119.31L7.92 122.63L0 127.74L2.81 123.91L9.96 118.29L19.93 112.93L26.83 110.12L37.3 107.05L46.24 105.26L66.43 103.47L80.99 103.98L90.19 105.01L104.5 108.07L115.99 111.9L123.66 115.99L127.23 119.57L128 123.91L127.23 126.47L126.21 127.23L124.93 127.23L115.23 122.12L102.2 117.27L84.57 113.18Z" />
    </svg>
  )
}

/* The buildings on their own, with the sweep left off — for anywhere the mark
   has to read as a glyph in a line of type rather than as a scene: a bullet, a
   list marker, a chip. Taller than it is wide, 108x128, which is the artwork's
   own proportion for this part of it.

   Use MasjidMark for a divider and this for anything sitting beside words. */
/* THE GLYPH WAS A BITMAP TRACE for a while, and this is what it was:

   viewBox="0 0 108 128", fillRule="evenodd", one path beginning
   'M20.39 69.6L20.39 71.9L18.96 74.77L18.1 92.01L21.54 91.72…'

   It is the logo's own outline and it is accurate, which is not the same as
   legible. Auto-traced coordinates carry every wobble in the source bitmap, the
   composition is the lock-up's — one minaret up the left, the dome off centre,
   the sweep running out to the right — and at the 28-36px a divider actually
   uses it went to mush and leaned. If the full outline is wanted somewhere it
   can be large, MasjidMark above is the drawn version of the same thing. */

export function MasjidGlyph({ className = '', title }: MarkProps) {
  return (
    <svg
      viewBox="0 0 120 64"
      fill="currentColor"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
    >
      {/* minaret, left */}
      <path d="M22 4 L24 16 L20 16 Z" />
      <path d="M18 16 h8 l-1 5 h-6 Z" />
      <path d="M19 21 h6 l1 41 h-8 Z" />

      {/* minaret, right — a true mirror of the left. The logo has one minaret
          and this has two, which is the one place the glyph is allowed to
          disagree with the artwork: a divider is a centred ornament, and a
          centred ornament with a spire up one side only leans. */}
      <path d="M98 4 L100 16 L96 16 Z" />
      <path d="M94 16 h8 l-1 5 h-6 Z" />
      <path d="M95 21 h6 l1 41 h-8 Z" />

      {/* the dome — the same pointed bell as the full mark: the sides leave the
          finial steeply, bow out, and are still widening when they reach the
          springing line. An onion pulls back in near the foot and comes out a
          teardrop. */}
      <path d="M60 0 L62 12 L58 12 Z" />
      <path
        d="M60 11
           C 68 24, 84 45, 88 54
           C 89.4 57.2, 89.8 59.6, 90 62
           L 30 62
           C 30.2 59.6, 30.6 57.2, 32 54
           C 36 45, 52 24, 60 11 Z"
      />

      {/* THE GROUND, AND IT IS THE POINT. It is the last 2 units of the viewBox,
          so the bottom edge of this box IS the line the building stands on.
          Divider.tsx aligns its two hairlines to that edge, and the three become
          one continuous rule with a masjid standing on it. Put empty space back
          under here and the rules go back to crossing the dome two thirds of
          the way up, which is what made the old one read as a blob on a line. */}
      <rect x="6" y="62" width="108" height="2" />
    </svg>
  )
}

/* THERE WAS AN ARCH HERE — the dome's profile opened out into a doorway, as an
   objectBoundingBox clip path, used to crop the photographs on the home page's
   impact rail. It came off at the client's request on 16 September 2026 and is
   gone rather than left sitting unused, along with `.arch-crop` in index.css
   and the one `<ArchClip />` Layout rendered to define it.

   If it comes back: the path was
   'M0,1 L0,0.46 C0,0.26 0.30,0.09 0.5,0 C0.70,0.09 1,0.26 1,0.46 L1,1 Z'
   and the two things that were hard-won about it are that the control points
   have to come in steep — 0.30 and 0.70 on the x, not 0.22 and 0.78, or the
   apex rounds off into a plain archway — and that it only reads on a portrait
   box, because the clip stretches with whatever it is put on. */
