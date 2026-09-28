import { Link } from 'react-router-dom'

import { BADGES, BADGE_FINE_PRINT } from './badges-data'

/* ---------------------------------------------------------------------------
   The ACNC and DGR badges with the tax line under them, for anywhere a donor
   is about to pay (28 September 2026, client feedback). The words and file
   paths are in badges-data.ts, and why the artwork is a placeholder is said
   there too.

   Both badges are round seals with their own white ground, drawn at one
   size so they read as a pair, the same on the dark summary panel of the
   give form as on paper. 76px keeps the ACNC logo's small type legible. `tone` only sets the colour of
   the fine print under them.
--------------------------------------------------------------------------- */

export default function TrustBadges({ tone = 'light', className = '' }: { tone?: 'light' | 'dark'; className?: string }) {
  return (
    <div className={className}>
      <ul className="flex flex-wrap items-center gap-3" aria-label="Accreditation">
        {BADGES.map((b) => {
          const img = <img src={b.src} alt={b.alt} width={76} height={76} className="block size-[76px]" />
          return (
            <li key={b.src}>
              {b.to ? (
                <Link to={b.to} className="block rounded-full transition-opacity duration-200 ease-brand hover:opacity-85">
                  {img}
                </Link>
              ) : (
                img
              )}
            </li>
          )
        })}
      </ul>
      <p className={`mt-2 text-[12.5px] leading-snug ${tone === 'dark' ? 'text-paper/65' : 'text-text-3'}`}>
        {BADGE_FINE_PRINT}
      </p>
    </div>
  )
}
