import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import ScrollBar from './ScrollBar'
import HelpChat from './HelpChat'
import RecentGifts from './RecentGifts'

/* KEEP_SCROLL and the scroll-to-top on navigation moved to ScrollManager.tsx,
   which App mounts once above every route. Re-exported for old imports. */
export { KEEP_SCROLL } from './ScrollManager'

export default function Layout() {

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
      {/* the public site's two floating asides; the portals sit outside
          Layout, so neither appears there */}
      <RecentGifts />
      <HelpChat />
    </div>
  )
}
