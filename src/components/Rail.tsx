import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

import { ArrowRight } from './icons'

/* ---------------------------------------------------------------------------
   The drifting rail, lifted out of HomeAppeals so the home page can have two of
   them without two copies of this frame loop. HomeAppeals is the original and
   its cards are unchanged; HomeImpact was the second one until it became a
   grid on 16 September 2026, which is why nothing currently uses the external
   pager or `controls` described below. Everything below was
   worked out there, and the reasoning is kept here with the code it explains.

   HOW THE LOOP WORKS
   The list is rendered twice on a track that is moved by transform, and the
   offset is a float. The moment it has travelled the width of one full set it
   jumps back by exactly that width — onto an identical card in an identical
   position, so there is no seam. transform rather than scrollLeft is the whole
   reason it is smooth: scrollLeft is an integer, so a drift of well under a
   pixel a frame lands on the same number several frames running and then jumps,
   which is the stutter. A transform takes sub-pixel values and is composited,
   so the same speed is continuous.

   Dragging it works because the pointer moves the same offset the drift does.
   touch-action stays pan-y, so a vertical swipe still scrolls the page.

   It stops whenever anyone is reading — pointer over it, keyboard inside it,
   tab in the background — and never starts for anyone who has asked for less
   motion. The second copy is hidden from assistive tech and out of the tab
   order, so a screen reader hears the items once, not twice: that is what the
   `clone` flag handed to the render function is for, and a card that ignores it
   will put every one of its links into the tab order twice.

   Everything the frame loop touches lives in a ref. Sixty re-renders a second
   to move one track would be absurd.
--------------------------------------------------------------------------- */

/** What Rail hands back through `controls`, for a section that places the
 *  pager itself. */
export type RailControls = { page: (dir: 1 | -1) => void }

/* ---------------------------------------------------------------------------
   The pager. Two arrows and no more: no disabled state and no position
   indicator, because the rail has no end to reach and nowhere along it to be.

   It is its own component so it can be rendered somewhere other than under the
   rail — HomeImpact stands it beside the heading, in the space its second
   column used to take, and drives it through Rail's `controls` ref.
--------------------------------------------------------------------------- */
export function RailPager({
  onPage,
  prev,
  next,
  className = '',
}: {
  onPage: (dir: 1 | -1) => void
  prev: string
  next: string
  className?: string
}) {
  return (
    <div className={`flex gap-2 ${className}`}>
      {([-1, 1] as const).map((dir) => (
        <button
          key={dir}
          type="button"
          onClick={() => onPage(dir)}
          aria-label={dir === -1 ? prev : next}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-text transition-[background-color,border-color,color] duration-200 ease-brand hover:border-ink hover:bg-ink hover:text-paper"
        >
          <ArrowRight className={`h-3.5 w-3.5 ${dir === -1 ? 'rotate-180' : ''}`} />
        </button>
      ))}
    </div>
  )
}

/** The gap between cards, in px. Kept in step with the `gap-6` on the track —
 *  the pager has to know it to advance by exactly one card. */
const GAP = 24

/** How hard the rail is pulled toward an arrow's target, per second. */
const EASE = 7

/** How far a pointer may travel and still count as a click rather than a drag.
 *  Six pixels: under a thumb's own wobble on a phone, over nothing on a mouse. */
const DRAG_SLOP = 6

export default function Rail<T>({
  items,
  label,
  card,
  children,
  /** Pixels a second. A drift, not a ride — you should be able to read a card
   *  without chasing it. */
  speed = 26,
  prev,
  next,
  pager = true,
  fade = false,
  controls,
  className = '',
  pagerClassName = '',
}: {
  items: T[]
  /** what a screen reader is told the region is */
  label: string
  /** the width and layout of one card — the rail cannot guess it */
  card: string
  /** one card. `clone` is true for the duplicate set: take every link in it
   *  out of the tab order when it is set. `i` is the index within one set, so
   *  the first card can be the only one that loads eagerly. */
  children: (item: T, clone: boolean, i: number) => ReactNode
  speed?: number
  /** the pager's two labels, which are the only words this component says */
  prev: string
  next: string
  /** false when the section puts the pager somewhere of its own — see
   *  `controls` below, and HomeImpact, which stands it beside the heading */
  pager?: boolean
  /** Dissolve the cut cards at both ends of the rail into the ground instead
   *  of stopping them dead at the column edge. See the frame below. */
  fade?: boolean
  /** Rail keeps this filled with its own paging function, so a section that
   *  has turned the built-in pager off can still drive the rail. */
  controls?: RefObject<RailControls | null>
  className?: string
  pagerClassName?: string
}) {
  const trackRef = useRef<HTMLUListElement>(null)

  const posRef = useRef(0)
  const loopRef = useRef(0)
  const targetRef = useRef<number | null>(null)
  const pausedRef = useRef(false)
  const dragRef = useRef<{ id: number; from: number; at: number; moved: boolean } | null>(null)
  const draggedRef = useRef(false)

  /* Read on the first render, not in the effect a tick later. It used to start
     false for everyone, which meant anyone who had asked for less motion still
     got a frame or two of drift before it settled — small, but it is the one
     thing they asked not to see. */
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  const count = items.length

  const measure = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const first = el.children[0] as HTMLElement | undefined
    const second = el.children[count] as HTMLElement | undefined
    loopRef.current = first && second ? second.offsetLeft - first.offsetLeft : 0
  }, [count])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    /* Card heights settle when the webfonts land, which moves the offsets. */
    document.fonts?.ready.then(measure).catch(() => {})
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const read = () => setReduced(mq.matches)
    read()
    mq.addEventListener('change', read)
    return () => mq.removeEventListener('change', read)
  }, [])

  /* --- the drift ---------------------------------------------------------- */
  useEffect(() => {
    if (reduced) return
    let frame = 0
    let last = performance.now()

    const tick = (now: number) => {
      /* Clamped, so coming back to a backgrounded tab does not teleport the
         rail by however many seconds were spent away from it. */
      const dt = Math.min(now - last, 64) / 1000
      last = now

      const track = trackRef.current
      const loop = loopRef.current
      if (track && loop > 0) {
        if (dragRef.current) {
          /* the pointer owns the offset while it is down */
        } else if (targetRef.current !== null) {
          const gap = targetRef.current - posRef.current
          if (Math.abs(gap) < 0.4) {
            posRef.current = targetRef.current
            targetRef.current = null
          } else {
            posRef.current += gap * Math.min(1, dt * EASE)
          }
        } else if (!pausedRef.current && !document.hidden) {
          posRef.current += speed * dt
        }

        /* The seam. Both jumps land on an identical card in an identical
           position, so neither is visible. The arrow's target comes along, or
           it would pull the rail back across the join it just crossed. */
        if (posRef.current >= loop) {
          posRef.current -= loop
          if (targetRef.current !== null) targetRef.current -= loop
        } else if (posRef.current < 0) {
          posRef.current += loop
          if (targetRef.current !== null) targetRef.current += loop
        }

        track.style.transform = `translate3d(${-posRef.current}px, 0, 0)`
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [reduced, speed])

  const step = () => {
    const track = trackRef.current
    const first = track?.children[0] as HTMLElement | undefined
    return first ? first.offsetWidth + GAP : 320
  }

  const page = (dir: 1 | -1) => {
    targetRef.current = (targetRef.current ?? posRef.current) + dir * step()
  }

  /* --- dragging ----------------------------------------------------------- */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    dragRef.current = { id: e.pointerId, from: e.clientX, at: posRef.current, moved: false }
    draggedRef.current = false
    targetRef.current = null
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.id !== e.pointerId) return
    if (Math.abs(e.clientX - drag.from) > DRAG_SLOP) drag.moved = true
    posRef.current = drag.at - (e.clientX - drag.from)
  }

  const endDrag = (e: React.PointerEvent) => {
    if (dragRef.current?.id !== e.pointerId) return
    draggedRef.current = dragRef.current.moved
    dragRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId)
  }

  /* THE CLICK AT THE END OF A DRAG.
     A pointer that goes down on a card, travels, and comes up still on that
     card fires a click, and the browser is right to: nothing it can see says
     otherwise. On a rail it is wrong every time — you were pushing the cards
     along, not choosing one — and it got worse the moment a card became one
     link across its whole surface instead of three small ones, because there
     is no longer any dead area to let go over.

     So: capture, and swallow the click if the pointer travelled more than the
     slop. Capture rather than bubble, so it is gone before the link sees it.
     The flag is cleared on the next pointerdown rather than here, because a
     drag that ends over dead space produces no click at all and would
     otherwise leave it armed for the next real one. */
  const onClickCapture = (e: React.MouseEvent) => {
    if (!draggedRef.current) return
    e.preventDefault()
    e.stopPropagation()
  }

  /* No dependency array: `page` closes over refs only, so re-assigning it on
     every render costs nothing and can never go stale. */
  useEffect(() => {
    if (!controls) return
    controls.current = { page }
    return () => {
      controls.current = null
    }
  })

  const hold = () => {
    pausedRef.current = true
  }
  const release = () => {
    pausedRef.current = false
  }

  const cards = [...items, ...items]

  /* THE RAMP, and how far down it goes.

     A mask cannot darken anything. All it can do is take the card away and
     leave whatever is behind it, and what is behind it is `--color-ground` at
     #F5F5F2 — so over the dark end of a photograph the ramp reads as a white
     glow, and there is no version of a mask that reads as a shadow instead.
     Painting a dark gradient over the ends would give a shadow, and would be
     wrong for a different reason: two grey smudges at the ends of a rail on an
     off-white page, which is a vignette on a page that has none.

     So the glow is turned down rather than recoloured. The ramp stops at EDGE
     instead of running to nothing, which means the outermost pixels still show
     most of the card and only a third of the ground comes through. It takes the
     hard edge off the cut without putting light on the photograph.

     Both numbers are here and nowhere else. EDGE at 1 is a clean cut with no
     ramp at all; at 0 it is the full dissolve this started as. */
  const ramp = 'clamp(8px, 1.5vw, 22px)'
  const EDGE = 'rgba(0,0,0,0.68)'
  const mask = fade
    ? `linear-gradient(90deg, ${EDGE} 0, #000 ${ramp}, #000 calc(100% - ${ramp}), ${EDGE} 100%)`
    : undefined

  return (
    <>
      {/* THE FRAME.

          Held to the page column, so the rail starts and ends where every other
          band on the page does.

          It ran the full width of the window for a while instead — `bleed` —
          on the argument that this rail never stops moving, so the card at each
          end is always sliced through, and a slice at the edge of the screen
          reads as the strip carrying on while a slice at a margin line reads as
          damage. That is gone at the client's request (16 September 2026). If
          it is ever wanted back it was one prop: no gutter and no max-width on
          this div for the both-edges version, or
          `paddingInlineStart: calc(max(0px, (100vw - var(--container-page)) / 2) + var(--gutter))`
          for the left-anchored one, and it had to be off under reduced motion
          or the first card stood hard against the window with no gutter.

          `fade` is the other answer to the same problem and the one that is
          here now: leave the rail in the column and dissolve the cut cards into
          the ground rather than stopping them dead against a line.

          THERE IS A NOTE IN THE HISTORY OF THIS FILE SAYING NOT TO DO THAT. It
          was right when it was written and is not right now, and the difference
          is the page underneath. Back then this section sat on `bg-paper` with
          `bg-sand` bands above and below it, and a mask has to fade to the one
          colour behind it — so the ramp read as a wash of light lying on the
          outer photographs instead of as the card ending. The home page has run
          on a single `--color-ground` from the header to the footer since the
          dividers went in, so there is now exactly one colour to dissolve into
          and the ramp reads as what it is.

          It is a real alpha mask, not a gradient overlay. An overlay would have
          to be painted in the ground colour, which puts it back to being a wash
          and breaks the moment anything behind the rail changes. */}
      <div className={`gutter mx-auto max-w-page ${className}`}>
        <div
          className="cursor-grab overflow-hidden active:cursor-grabbing"
          onMouseEnter={hold}
          onMouseLeave={release}
          onFocusCapture={hold}
          onBlurCapture={release}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={onClickCapture}
          /* a vertical swipe still belongs to the page */
          style={{ touchAction: 'pan-y', maskImage: mask, WebkitMaskImage: mask }}
        >
          <ul
            ref={trackRef}
            role="region"
            aria-label={label}
            className="m-0 flex w-max list-none gap-6 p-0 will-change-transform"
          >
            {cards.map((item, i) => {
              const clone = i >= count
              return (
                <li key={i} aria-hidden={clone || undefined} className={card}>
                  {children(item, clone, i % count)}
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {pager && (
        /* justify-center belongs here rather than in RailPager: the built-in
           pager sits under the rail and is centred on it, while a section that
           places the pager itself wants it wherever it put it — HomeImpact
           pushes the same component to the right of its heading. */
        <RailPager
          onPage={page}
          prev={prev}
          next={next}
          className={`mt-s4 justify-center ${pagerClassName}`}
        />
      )}
    </>
  )
}
