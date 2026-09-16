import { useCallback, useEffect, useRef, useState } from 'react'

/* ---------------------------------------------------------------------------
   The scrollbar, drawn over the page rather than beside it.

   The document's own is hidden in index.css. A native scrollbar takes a lane
   out of the viewport, and on a site whose heroes are full-bleed photographs
   that lane is a pale strip down the side of the picture: the hero stops at the
   edge of the layout viewport, and what shows in the gap is the page's white
   ground. This one is a fixed element, so the photograph reaches both edges of
   the window and the thumb floats on top of it.

   It is grey rather than ink or paper, because it has to be legible over both:
   the same rule crosses the dark hero and the white document beneath it.

   It shows only while the page is moving, and it can still be dragged. Hiding a
   scrollbar and not replacing what it did is worse than the strip was.
--------------------------------------------------------------------------- */

/** How long after the last scroll the thumb fades out. */
const IDLE = 900

/* How long the thumb is allowed to be. It is still drawn in proportion — the
   thumb is to the track as the window is to the document — but clamped at both
   ends, and the ceiling is the low one: a short rule reads as an overlay, and a
   long one starts to read as a panel down the side of the page.

   Losing some of the proportion costs less here than it would on a native bar,
   because the header already draws a progress line across the top of every
   page. That is what says how far through you are; this says where you are and
   gives you something to drag. */
const MIN_THUMB = 28
const MAX_THUMB = 72

/** Clear of the window edge, so it reads as floating rather than stuck on. */
const INSET = 4

type Box = { top: number; height: number }

export default function ScrollBar() {
  const [box, setBox] = useState<Box | null>(null)
  const [show, setShow] = useState(false)

  const idle = useRef(0)
  const drag = useRef<{ pointer: number; fromY: number; fromScroll: number } | null>(null)
  /** Set while dragging or hovering, so the thumb does not fade under the hand. */
  const held = useRef(false)

  /* Where the thumb sits, and how tall it is: the proportions a native
     scrollbar uses, with the length clamped. See MIN_THUMB and MAX_THUMB. */
  const measure = useCallback(() => {
    const doc = document.documentElement
    const view = window.innerHeight
    const total = Math.max(doc.scrollHeight, document.body.scrollHeight)
    const scrollable = total - view

    if (scrollable <= 1) {
      setBox(null)
      return
    }

    const track = view - INSET * 2
    const height = Math.min(MAX_THUMB, Math.max(MIN_THUMB, (view / total) * track))
    const top = INSET + (window.scrollY / scrollable) * (track - height)
    setBox({ top, height })
  }, [])

  const wake = useCallback(() => {
    setShow(true)
    window.clearTimeout(idle.current)
    idle.current = window.setTimeout(() => {
      if (!held.current) setShow(false)
    }, IDLE)
  }, [])

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(() => {
          ticking = false
          measure()
        })
      }
      wake()
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)

    /* The document grows and shrinks under us: a menu opens, an image lands, a
       route changes. Anything that moves the foot of the page moves the thumb. */
    const watcher = new ResizeObserver(() => measure())
    watcher.observe(document.body)

    return () => {
      window.clearTimeout(idle.current)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
      watcher.disconnect()
    }
  }, [measure, wake])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!box) return
    e.preventDefault()
    held.current = true
    drag.current = { pointer: e.pointerId, fromY: e.clientY, fromScroll: window.scrollY }
    e.currentTarget.setPointerCapture(e.pointerId)
    wake()
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const from = drag.current
    if (!from || !box) return
    const view = window.innerHeight
    const total = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
    const travel = view - INSET * 2 - box.height
    if (travel <= 0) return
    const dy = e.clientY - from.fromY
    window.scrollTo({ top: from.fromScroll + (dy / travel) * (total - view) })
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    e.currentTarget.releasePointerCapture(drag.current.pointer)
    drag.current = null
    held.current = false
    wake()
  }

  if (!box) return null

  return (
    /* Presentational, and duplicated by every other way of moving the page, so
       it stays out of the accessibility tree. The width here is the grab area;
       the rule inside it is what you see. */
    <div
      aria-hidden="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerEnter={() => {
        held.current = true
        wake()
      }}
      onPointerLeave={() => {
        if (!drag.current) held.current = false
        wake()
      }}
      className="fixed right-0 z-[150] flex w-[13px] cursor-default touch-none justify-center transition-opacity duration-300 ease-brand"
      style={{ top: box.top, height: box.height, opacity: show ? 1 : 0 }}
    >
      <span className="h-full w-[5px] rounded-full bg-[rgba(128,134,132,0.72)] transition-colors duration-200 hover:bg-[rgba(90,97,95,0.85)]" />
    </div>
  )
}
