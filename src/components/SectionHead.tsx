import type { ReactNode } from 'react'

import Reveal, { Words } from './Reveal'

/* ---------------------------------------------------------------------------
   The head every home-page band opens with, so the page scrolls on one beat.

   Added 16 September 2026, at the user's request. Before it, the five bands
   each built their own: a script eyebrow on one, small capitals on another,
   nothing on two; headlines at 46px in some bands and 54px in others; and not
   one line anywhere saying what a band was FOR. Read at scrolling speed the
   page was a string of clever phrases. Now every band says the same three
   things in the same places:

     eyebrow   Caveat Brush, green — the page's signature, and short: a label,
               never a sentence
     title     the one thing the band is, in plain words, at one size
     lede      one sentence, two lines at most, on why it matters

   and the band's single action, if it has one, sits on the right, level with
   the foot of the lede. A band with no action leaves the right empty rather
   than inventing one.

   WHO USES IT: HomeAppeals and HomeImpact. HomeZakat and HomeSocial were moved
   onto it and then put back on their own heads at the user's request the same
   day — the zakat heading sits inside its left column beside the estimate, and
   the social head leads with the handle. They still import BREAKOUT from here.

   THE ENTRANCE
   The eyebrow rises through a blur, the title follows a word at a time from
   behind its own line (Words), then the lede and the action — Reveal's `soft`
   variant, so it is once only and skipped entirely under reduced motion.

   THE WIDTH
   The head reaches out as far as the give card, the appeals banner and the
   image grids do (BREAKOUT, below), so every band shares one left and one right
   edge from lg up. Anything else in a band that should share those edges uses
   the same constant.
--------------------------------------------------------------------------- */

/** Vertical padding of every home section, so every gap on the page is the
 *  same. There is one divider left (between HomeAppeals and HomeImpact, with no
 *  padding of its own), so this is all the air there is between bands. */
export const SECTION_Y = 'py-[clamp(56px,6.5vw,96px)]'

/** Out to up to 72px past the page column a side, never nearer than 24px to
 *  the window. HomeAppeals' banner carries the same expression written out;
 *  keep them identical. */
export const BREAKOUT = 'lg:-mx-[min(72px,max(0px,calc((100vw_-_100%)/2_-_24px)))]'

export default function SectionHead({
  id,
  eyebrow,
  title,
  lede,
  action,
  className = '',
}: {
  /** the h2's id, for the section's aria-labelledby */
  id: string
  eyebrow: string
  title: ReactNode
  lede?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex flex-wrap items-end justify-between gap-x-s5 gap-y-s3 ${BREAKOUT} ${className}`}
    >
      <div className="max-w-[720px]">
        <Reveal variant="soft">
          <p className="font-script text-[clamp(21px,1.9vw,27px)] leading-none text-green">
            {eyebrow}
          </p>
        </Reveal>
        {/* A plain-text title arrives a word at a time (Words); anything
            richer falls back to a soft rise. */}
        {typeof title === 'string' ? (
          <h2
            id={id}
            className="mt-s2 max-w-[20ch] font-display text-[clamp(31px,4.2vw,54px)] leading-[1.05] tracking-[-0.022em] text-balance"
          >
            <Words text={title} delay={120} accent="text-teal-mid" />
          </h2>
        ) : (
          <Reveal variant="soft" delay={80}>
            <h2
              id={id}
              className="mt-s2 max-w-[20ch] font-display text-[clamp(31px,4.2vw,54px)] leading-[1.05] tracking-[-0.022em] text-balance"
            >
              {title}
            </h2>
          </Reveal>
        )}
        {lede && (
          <Reveal variant="soft" delay={260}>
            <p className="mt-s2 max-w-[54ch] text-[clamp(15.5px,1.2vw,17px)] leading-[1.55] text-text-2">
              {lede}
            </p>
          </Reveal>
        )}
      </div>

      {action && (
        <Reveal variant="soft" delay={360} className="ml-auto">
          {action}
        </Reveal>
      )}
    </div>
  )
}
