import { useEffect } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import ScrollBar from './ScrollBar'

/** Navigation state for a link or setSearchParams that only filters the page
 *  it is on, so Layout does not scroll back to the top for it. */
export const KEEP_SCROLL = { keepScroll: true }

export default function Layout() {
  const { pathname, hash, key, state } = useLocation()
  const navigationType = useNavigationType()

  /* A route change has to start at the top of the new page. The browser only
     does that on a real navigation, so with a client-side router you keep the
     old scroll position — click Privacy in the footer and you land halfway down
     the clauses, having never seen the page begin.

     `key` IS IN THE DEPENDENCIES AND HAS TO BE. Without it this watched
     `pathname` and `hash`, which are strings — so going to a page you are
     already on changed neither of them, the effect never re-ran, and nothing
     scrolled. That is not a corner case: it is the logo. Click it from halfway
     down the home page and you stayed exactly where you were, which in practice
     meant landing on the give band and wondering why the logo went to the
     donation section. Every history entry gets its own `key`, so a second visit
     to the same URL is a change this can see.

     BACK AND FORWARD ARE LEFT ALONE. On a POP the reader is returning to
     something they have already read and expects to find their place; the
     browser restores it and this keeps out of the way. A POP that carries a
     hash still runs, because that is the in-page index links on Get involved
     asking for a section by name.

     A HASH ASKS FOR A SECTION, so it gets one instead of the top — the footer
     and the header menus both link into the middle of pages this way, and they
     have to work even when you are already on the page. The target may not be
     in the DOM on the first pass when the jump is from another page, so it is
     looked for again after a paint, and failing that the page at least starts
     at the top rather than wherever the last one happened to be.

     A FILTER IS NOT A NEW PAGE. The /appeals filters write the query string,
     which is a new history entry with a new `key`, and this used to throw the
     reader back to the top of the page on every tap (16 September 2026).
     Anything that only restates the page it is on passes `KEEP_SCROLL` as the
     navigation's state, and this leaves the scroll to it. */
  useEffect(() => {
    if (navigationType === 'POP' && !hash) return
    if ((state as { keepScroll?: boolean } | null)?.keepScroll) return

    if (!hash) {
      window.scrollTo(0, 0)
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

  /* The scrollbar is invisible until the page is moving. The rules live in
     index.css and react to one class on <html>; all this does is put it there
     while you scroll and take it off again 900ms after you stop.

     Capture, because scroll events do not bubble: without it a scroller inside
     the page — the mega menu, a long panel — would move with no thumb showing. */
  useEffect(() => {
    const root = document.documentElement
    let idle = 0

    const moving = () => {
      root.classList.add('scrolling')
      window.clearTimeout(idle)
      idle = window.setTimeout(() => root.classList.remove('scrolling'), 900)
    }

    window.addEventListener('scroll', moving, { capture: true, passive: true })
    return () => {
      window.clearTimeout(idle)
      window.removeEventListener('scroll', moving, true)
      root.classList.remove('scrolling')
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {/* the skip link in Header lands here; tabIndex makes it a focus target */}
      <main id="main" tabIndex={-1} className="flex-1 scroll-mt-24 focus:outline-none">
        <Outlet />
      </main>
      {/* Footer renders the letter as its first block — one dark region, the
          ask and then the directory. */}
      <Footer />
      {/* Over the page, because the document's own bar is hidden. */}
      <ScrollBar />
    </div>
  )
}
