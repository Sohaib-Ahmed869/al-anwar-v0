import { useEffect, useRef, useState } from 'react'

/* ---------------------------------------------------------------------------
   Our field team at work: the small card stack.

   A set of Al-Anwaar's own distribution photographs, fanned out at an angle
   with the first on top. Swiping the top card left brings up the next
   photograph and right the one before, round and round. With one photograph
   there is nothing to page, so the card just sits. On a desktop the top card
   tilts toward the mouse, with a sheen that follows it (not under reduced
   motion).

   It lived in HomeHero, one stack per appeal, until 16 September 2026, when
   the client moved it to the /give hero (GiveHero) and gave the home hero's
   right-hand side to the quick give.

   OUR OWN PHOTOGRAPHS ONLY. Never stock, and each caption says only what the
   file or the About ledger already says: the real place, never an appeal's.
--------------------------------------------------------------------------- */

export type Field = {
  src: string
  alt: string
  what: string
  /** where the photograph was taken, which is not always the appeal's place */
  place: string
  /** left off where nothing on the file dates it */
  when?: string
  position?: string
}

const THROW = 48

/* How each card sits in the fan, by depth: 0 is on top. They pivot from near
   the bottom, so the tops splay out like cards held in a hand. */
const FAN = [
  { x: 0, y: 0, r: -4, s: 1, o: 1 },
  { x: 18, y: 4, r: 4, s: 0.96, o: 0.9 },
  { x: 34, y: 10, r: 11, s: 0.92, o: 0.75 },
  { x: 40, y: 14, r: 14, s: 0.9, o: 0 },
]

export default function FieldStack({
  cards,
  className = '',
  /** ms before the stack is dealt onto the screen */
  delay = 380,
}: {
  cards: Field[]
  className?: string
  delay?: number
}) {
  const n = cards.length
  const [at, setAt] = useState(0)
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [reduced, setReduced] = useState(false)
  /* where the mouse is over the top card, -0.5..0.5 each way; null when away */
  const [tilt, setTilt] = useState<{ x: number; y: number } | null>(null)
  const fromX = useRef<number | null>(null)

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  const turn = (to: number) => {
    if (n < 2) return
    setAt(((to % n) + n) % n)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (e.button !== 0 || n < 2) return
    fromX.current = e.clientX
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    setTilt(null)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (fromX.current !== null) {
      setDx(e.clientX - fromX.current)
      return
    }
    if (e.pointerType !== 'mouse' || reduced) return
    const box = e.currentTarget.getBoundingClientRect()
    setTilt({
      x: (e.clientX - box.left) / box.width - 0.5,
      y: (e.clientY - box.top) / box.height - 0.5,
    })
  }
  const onPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation()
    const from = fromX.current
    fromX.current = null
    setDragging(false)
    setDx(0)
    if (from === null) return
    const d = e.clientX - from
    if (Math.abs(d) > THROW) turn(at + (d < 0 ? 1 : -1))
  }

  const shot = cards[at]
  const caption = (f: Field) => (f.when ? `${f.place} · ${f.when}` : f.place)

  return (
    <figure
      aria-roledescription={n > 1 ? 'carousel' : undefined}
      aria-label={`From our field team: ${shot.what}, ${caption(shot)}`}
      /* Pointer events stop here, so a swipe on the cards never reaches
         anything listening for swipes behind them. */
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      className={`relative shrink-0 pt-3 pr-12 pl-2 ${className}`}
      style={{ animation: `hero-deal 1300ms var(--ease-reveal) ${delay}ms both` }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setTilt(null)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
          e.preventDefault()
          e.stopPropagation()
          turn(at + (e.key === 'ArrowRight' ? 1 : -1))
        }}
        tabIndex={n > 1 ? 0 : undefined}
        aria-label={n > 1 ? 'Field photographs: swipe, or use the arrow keys' : undefined}
        className={`relative aspect-[4/3] touch-pan-y rounded-[14px] select-none [perspective:900px] lg:aspect-[4/5] ${
          n < 2 ? '' : dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {cards.map((c, i) => {
          const depth = (i - at + n) % n
          const top = depth === 0
          const f = FAN[Math.min(depth, FAN.length - 1)]

          let transform = `translate(${f.x}px, ${f.y}px) rotate(${f.r}deg) scale(${f.s})`
          if (top && dragging) transform = `translateX(${dx}px) rotate(${f.r + dx * 0.08}deg)`
          else if (top && tilt)
            transform = `rotateX(${-tilt.y * 14}deg) rotateY(${tilt.x * 16}deg) rotate(${f.r * 0.25}deg) scale(1.04)`

          return (
            <div
              key={c.src}
              aria-hidden={!top}
              className={`absolute inset-0 origin-[50%_85%] overflow-hidden rounded-[14px] bg-ink ring-1 ring-paper/20 ${
                top
                  ? 'shadow-[0_28px_60px_-12px_rgba(0,0,0,0.65),0_8px_18px_rgba(0,0,0,0.3)]'
                  : 'shadow-[0_16px_36px_-10px_rgba(0,0,0,0.55)]'
              } ${
                top && (dragging || tilt)
                  ? 'transition-transform duration-100 ease-out'
                  : 'transition-[transform,opacity] duration-[650ms] ease-brand'
              }`}
              style={{ transform, opacity: f.o, zIndex: n - depth }}
            >
              <img
                src={c.src}
                alt={top ? c.alt : ''}
                draggable={false}
                className="h-full w-full object-cover"
                style={{ objectPosition: c.position }}
              />

              {/* the cards behind are dimmed, so the top one reads first */}
              <div
                className={`absolute inset-0 bg-ink transition-opacity duration-[650ms] ease-brand ${
                  top ? 'opacity-0' : 'opacity-40'
                }`}
              />

              {/* a soft sheen that follows the mouse across the top card */}
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
                  top && tilt ? 'opacity-100' : 'opacity-0'
                }`}
                style={{
                  background: tilt
                    ? `radial-gradient(circle at ${(tilt.x + 0.5) * 100}% ${(tilt.y + 0.5) * 100}%, rgba(255,255,255,0.22), transparent 55%)`
                    : undefined,
                }}
              />

              <div
                className={`absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(21,26,24,0.92))] px-3.5 pt-10 pb-3 transition-opacity duration-300 ${
                  top ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <p className="truncate text-[13.5px] font-semibold text-paper">{c.what}</p>
                <p className="truncate text-[11.5px] text-paper/70">{caption(c)}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* One dot per card, only when there is more than one to see. The
          button is 24px to the finger; the dot is 5px to the eye. */}
      {n > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-0.5">
          {cards.map((c, i) => (
            <button
              key={c.src}
              type="button"
              onClick={() => turn(i)}
              aria-label={`Photograph ${i + 1} of ${n}: ${c.what}`}
              aria-current={i === at}
              className="group flex h-6 items-center px-1"
            >
              <span
                aria-hidden="true"
                className={`block h-[5px] rounded-full transition-[width,background-color] duration-300 ease-brand ${
                  i === at ? 'w-4 bg-paper' : 'w-[5px] bg-paper/40 group-hover:bg-paper/80'
                }`}
              />
            </button>
          ))}
        </div>
      ) : (
        <div aria-hidden="true" className="h-4" />
      )}
    </figure>
  )
}
