import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/** Navigation state for a link or setSearchParams that only filters the page
 *  it is on, so the scroll manager does not take the reader back to the top. */
export const KEEP_SCROLL = { keepScroll: true }

/* ---------------------------------------------------------------------------
   Every route change starts at the top of the new page, across the WHOLE app.

   This used to live in the public Layout, with two smaller copies in the
   portal shells, and that left gaps: the sign-in screens, the printable
   receipt and statement, and every jump from the website into a portal sat
   outside both, so "Sign in" from halfway down a page landed halfway down the
   sign-in screen (22 October 2026, client feedback). It is mounted once, in
   App, above every route, so nothing can fall outside it again.

   The browser only resets the scroll on a real navigation; a client-side
   router keeps the old position, which is why this exists at all.

   `key` IS IN THE DEPENDENCIES AND HAS TO BE. Going to the page you are
   already on changes neither pathname nor hash, so without the key the logo
   clicked from halfway down the home page did nothing. Every history entry
   gets its own key, so a second visit to the same URL is a change this sees.

   BACK AND FORWARD ARE LEFT ALONE. On a POP the reader is returning to
   something they have read and expects their place; the browser restores it.
   A POP that carries a hash still runs: those are in-page index links.

   A HASH ASKS FOR A SECTION, so it gets that section, looked for again after a
   paint when the jump comes from another page, and the top if it never turns
   up. A page can also name where a plain visit should land with data-land
   (/give does, when the link has already filled its form in).

   A FILTER IS NOT A NEW PAGE. On the public site, anything that only restates
   the page it is on passes KEEP_SCROLL. In the portals the tables write their
   filters and tabs into the query string on every change, so there the rule
   is simpler: only a change of PATH scrolls. */
const PORTALS = /^\/(admin|compliance|account)(\/|$)/

export default function ScrollManager() {
  const { pathname, hash, key, state } = useLocation()
  const navigationType = useNavigationType()
  const lastPath = useRef(pathname)

  useEffect(() => {
    const samePath = lastPath.current === pathname
    lastPath.current = pathname
    if (navigationType === 'POP' && !hash) return
    if ((state as { keepScroll?: boolean } | null)?.keepScroll) return
    if (samePath && !hash && PORTALS.test(pathname)) return

    if (!hash) {
      const land = document.querySelector('[data-land]')
      if (land) land.scrollIntoView({ block: 'start' })
      else window.scrollTo(0, 0)
      return
    }

    const id = decodeURIComponent(hash.slice(1))
    const jump = () => {
      const target = document.getElementById(id)
      target?.scrollIntoView()
      return Boolean(target)
    }

    if (jump()) return
    const frame = requestAnimationFrame(() => {
      if (!jump()) window.scrollTo(0, 0)
    })
    return () => cancelAnimationFrame(frame)
    // `state` is read with `key`, which changes whenever it does
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, hash, key, navigationType])

  return null
}
