import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/* ---------------------------------------------------------------------------
   Fade-up as a section arrives, once.

   The same IntersectionObserver shape HomeAppeals already uses for its counter:
   watch, fire on the first intersection, disconnect. Once only — a section that
   re-animates every time you scroll back past it is a toy, and on a page people
   scroll up and down while filling in a form it would be actively annoying.

   Anyone who has asked for less motion never gets an observer at all: the
   content starts shown. That is deliberate rather than lazy — the global rule
   in index.css flattens transitions to 0.01ms, which would land this on its
   final frame anyway, but only after a frame of opacity:0. Starting shown means
   there is no flash to land.
--------------------------------------------------------------------------- */

const wantsLessMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* The watching half of Reveal, on its own, for the times a section wants the
   signal but not the wrapper — HomeAppeals fills its progress bars from 0 when
   the rail arrives, and a div with an opacity transition on it is the one thing
   that cannot deliver that, because the bars are four levels further down.

   It returns [ref, inView] and never goes back to false. Reduced motion starts
   it true, for the same reason Reveal does: whatever is keyed off it should be
   in its final state on the first frame, not one frame later. */
export function useInView<T extends Element>() {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(() => wantsLessMotion())

  useEffect(() => {
    const el = ref.current
    if (!el || inView) return

    /* A little way in from the bottom of the viewport, so a section starts
       arriving as you reach it rather than the instant its first pixel does. */
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setInView(true)
        io.disconnect()
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )

    io.observe(el)
    return () => io.disconnect()
  }, [inView])

  return [ref, inView] as const
}

/* How each variant starts. `up` is the original and every page but the home
   page uses it; the other three were added for the home page's scroll
   (16 September 2026) and run longer, on --ease-reveal.

     up     a short rise — the default everywhere
     soft   a longer, gentler rise, for text
     clip   a longer rise for photographs and banners; put `reveal-zoom` on the
            image inside and it settles back from close as the block lands

   Opacity and transform only, so every one runs on the GPU. `soft` used to
   clear a blur and `clip` used to unmask with clip-path; both repainted on
   every frame and made the home page stutter (16 September 2026).
     scale  a rise from slightly small, for a card that should feel set down */
export type RevealVariant = 'up' | 'soft' | 'clip' | 'scale'

const HIDDEN: Record<RevealVariant, CSSProperties> = {
  up: { opacity: 0, transform: 'translate3d(0, 18px, 0)' },
  soft: { opacity: 0, transform: 'translate3d(0, 28px, 0)' },
  clip: { opacity: 0, transform: 'translate3d(0, 48px, 0)' },
  scale: { opacity: 0, transform: 'translate3d(0, 32px, 0) scale(0.95)' },
}

const SHOWN: Record<RevealVariant, CSSProperties> = {
  up: { opacity: 1, transform: 'none' },
  soft: { opacity: 1, transform: 'none' },
  clip: { opacity: 1, transform: 'none' },
  scale: { opacity: 1, transform: 'none' },
}

const TRANSITION: Record<RevealVariant, string> = {
  up: 'opacity 700ms var(--ease-brand), transform 700ms var(--ease-brand)',
  soft: 'opacity 900ms var(--ease-reveal), transform 1100ms var(--ease-reveal)',
  clip: 'opacity 700ms var(--ease-reveal), transform 1300ms var(--ease-reveal)',
  scale: 'opacity 800ms var(--ease-reveal), transform 1200ms var(--ease-reveal)',
}

export default function Reveal({
  children,
  /** Milliseconds behind the first thing in the group. For staggering a row. */
  delay = 0,
  variant = 'up',
  className = '',
}: {
  children: ReactNode
  delay?: number
  variant?: RevealVariant
  className?: string
}) {
  const [ref, shown] = useInView<HTMLDivElement>()

  const style: CSSProperties = {
    ...(shown ? SHOWN[variant] : HIDDEN[variant]),
    transition: TRANSITION[variant]
      .split(', ')
      .map((t) => `${t} ${delay}ms`)
      .join(', '),
    ['--reveal-delay' as string]: `${delay}ms`,
  }

  return (
    <div ref={ref} data-revealed={shown} className={className} style={style}>
      {children}
    </div>
  )
}

/* ---------------------------------------------------------------------------
   A heading that arrives a word at a time, each word rising from behind the
   line it sits on.

   `play="view"` waits for the heading to scroll in, like Reveal. `play="load"`
   runs as soon as it mounts, for the hero, which is on screen from the start
   and remounts its heading per slide so each one replays.

   The words are aria-hidden and the whole line is given once to screen
   readers, so nobody hears a heading read out one word at a time. Put it
   inside the heading element, not around it. Each word's mask has a little
   padding at the foot so descenders are not clipped.
--------------------------------------------------------------------------- */
export function Words({
  text,
  delay = 0,
  /** ms between one word and the next */
  step = 45,
  play = 'view',
  accent,
}: {
  text: string
  delay?: number
  step?: number
  play?: 'view' | 'load'
  /** a class for the LAST word — the styleguide's two-tone heading, where one
   *  word of a title takes the highlight colour ("primary vertical", p. 5) */
  accent?: string
}) {
  const [ref, inView] = useInView<HTMLSpanElement>()
  const words = text.split(' ')

  return (
    <span ref={ref}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => {
          const at = delay + i * step
          const style: CSSProperties =
            play === 'load'
              ? { animation: `word-rise 1000ms var(--ease-reveal) ${at}ms both` }
              : {
                  transform: inView ? 'none' : 'translate3d(0, 108%, 0) rotate(4deg)',
                  transition: `transform 1000ms var(--ease-reveal) ${at}ms`,
                }
          return (
            <span key={i}>
              <span className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-bottom">
                <span className={`inline-block origin-[0_100%] ${accent && i === words.length - 1 ? accent : ''}`} style={style}>
                  {word}
                </span>
              </span>
              {i < words.length - 1 && ' '}
            </span>
          )
        })}
      </span>
    </span>
  )
}

/* ---------------------------------------------------------------------------
   Depth on a full-screen hero as it scrolls away: the photograph or film drifts
   down at a third of the scroll, and the words lift a little and fade ahead of
   it, so the page reads as layers rather than one flat sheet going up.

   Written straight to the elements in an animation frame, never through state,
   and not at all under reduced motion. Uses the `translate` property, so it
   composes with any transform or scale animation on the same elements (the
   heroes' entrance keyframes use `transform` and `scale`). Used by HomeHero
   and GiveHero.
--------------------------------------------------------------------------- */
export function useHeroDepth<
  H extends HTMLElement = HTMLElement,
  P extends HTMLElement = HTMLDivElement,
  C extends HTMLElement = HTMLDivElement,
>() {
  const hero = useRef<H>(null)
  const photo = useRef<P>(null)
  const content = useRef<C>(null)

  useEffect(() => {
    if (wantsLessMotion()) return
    let frame = 0
    let h = hero.current?.offsetHeight ?? 0
    let painted = -1
    const paint = () => {
      frame = 0
      const y = Math.min(Math.max(window.scrollY, 0), h)
      /* Past the hero, or not moved: nothing to write. Reading the height once
         (and on resize) rather than per frame keeps layout out of the scroll. */
      if (y === painted) return
      painted = y
      if (photo.current) photo.current.style.translate = `0 ${y * 0.32}px`
      if (content.current) {
        content.current.style.translate = `0 ${y * -0.12}px`
        content.current.style.opacity = String(Math.max(0, 1 - y / (h * 0.75)))
      }
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(paint)
    }
    const onResize = () => {
      h = hero.current?.offsetHeight ?? 0
      painted = -1
      onScroll()
    }
    paint()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(frame)
    }
  }, [])

  return { hero, photo, content }
}
