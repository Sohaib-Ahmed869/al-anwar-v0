import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowUp } from './icons'
import { hasBottomBar } from './RecentGifts'

/* ---------------------------------------------------------------------------
   Back to the top, from anywhere (22 October 2026, client's ask). The footer
   has its own "Back to top", but on a long page that is a long way down; this
   is the same thing kept within reach.

   It appears once the reader is 500px down, and goes
   again near the top, so it is never there when it has nothing to do.

   WHERE IT SITS. On the website it stacks directly above the help chat's
   launcher, centred on it, and follows it up when the launcher is lifted over
   a page's fixed give bar on a phone (hasBottomBar). In the portals there is no
   chat; on a phone it clears the bottom navigation, and on a desktop it sits
   in the corner.

   Dark teal with the arrow in off-white, saffron on hover: a utility, so it
   wears the brand's quiet colours rather than the give action's.
--------------------------------------------------------------------------- */
export default function BackToTop({ place = 'site' }: { place?: 'site' | 'portal' }) {
  const { pathname } = useLocation()
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const read = () => setShown(window.scrollY > 500)
    read()
    window.addEventListener('scroll', read, { passive: true })
    return () => window.removeEventListener('scroll', read)
  }, [])

  const up = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  /* the chat launcher is 56px at right-3 / sm:right-6 and bottom-3 / sm:bottom-5
     (bottom-[96px] when lifted); this is 44px, centred over it with a 12px gap */
  const spot =
    place === 'portal'
      ? 'right-4 bottom-[84px] lg:right-6 lg:bottom-6'
      : hasBottomBar(pathname)
        ? 'right-[18px] bottom-[164px] sm:right-[30px] lg:bottom-[88px]'
        : 'right-[18px] bottom-[80px] sm:right-[30px] sm:bottom-[88px]'

  return (
    <button
      type="button"
      onClick={up}
      aria-label="Back to top"
      tabIndex={shown ? 0 : -1}
      aria-hidden={shown ? undefined : true}
      className={`group fixed z-[59] grid size-11 place-items-center rounded-full bg-ink text-paper shadow-lift ring-1 ring-paper/15 transition-[opacity,transform,background-color] duration-300 ease-brand hover:bg-teal ${spot} ${
        shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      <ArrowUp className="h-4 w-4 transition-[transform,color] duration-200 group-hover:-translate-y-0.5 group-hover:text-gold" />
    </button>
  )
}
