import { useEffect, useRef, type CSSProperties } from 'react'

import { ChevronDown} from '../components/icons'
import { CONTACT, FORM_ID } from '../components/contact-data'

const TRAVEL_X = 18
const TRAVEL_Y = 12

const rise = (step: number): CSSProperties => ({
  animation: 'hero-rise 780ms var(--ease-brand) both',
  animationDelay: `${step * 90}ms`,
})

const wantsLessMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function ContactHero() {
  const bandRef = useRef<HTMLElement>(null)
  const shiftRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const band = bandRef.current
    const shift = shiftRef.current
    if (!band || !shift) return

    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let cursor: { x: number; y: number } | null = null

    const write = () => {
      frame = 0

      const box = band.getBoundingClientRect()
      const c = cursor
      const over =
        c !== null && c.x >= box.left && c.x <= box.right && c.y >= box.top && c.y <= box.bottom

      const clamp = (n: number) => Math.max(-1, Math.min(1, n))
      const x = c && over ? clamp(((c.x - box.left) / box.width) * 2 - 1) : 0
      const y = c && over ? clamp(((c.y - box.top) / box.height) * 2 - 1) : 0

      shift.style.transform = `translate3d(${-x * TRAVEL_X}px, ${-y * TRAVEL_Y}px, 0)`
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(write)
    }

    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      cursor = { x: e.clientX, y: e.clientY }
      schedule()
    }
    const out = (e: PointerEvent) => {
      if (e.relatedTarget === null) {
        cursor = null
        schedule()
      }
    }
    const listen = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('scroll', schedule)
      document.removeEventListener('pointerout', out)

      if (fine.matches && !still.matches) {
        window.addEventListener('pointermove', move, { passive: true })
        window.addEventListener('scroll', schedule, { passive: true })
        document.addEventListener('pointerout', out)
      } else {
        cursor = null
      }
      schedule()
    }

    listen()
    fine.addEventListener('change', listen)
    still.addEventListener('change', listen)

    return () => {
      fine.removeEventListener('change', listen)
      still.removeEventListener('change', listen)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('scroll', schedule)
      document.removeEventListener('pointerout', out)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
  const toForm = () =>
    document.getElementById(FORM_ID)?.scrollIntoView({
      behavior: wantsLessMotion() ? 'auto' : 'smooth',
      block: 'start',
    })

  return (
    <section
      ref={bandRef}
      data-overlay-hero=""
      className="relative isolate mt-[calc(var(--header-h)*-1)] overflow-hidden bg-ink"
    >
      <div aria-hidden="true" className="absolute inset-0">
        <div
          ref={shiftRef}
          className="absolute -inset-[30px] will-change-transform"
          style={{
            transform: 'translate3d(0,0,0)',
            transition: 'transform 760ms var(--ease-brand)',
          }}
        >
          <img
            src="/assets/images/hero-contact-2400.jpg"
            srcSet="/assets/images/hero-contact-1200.jpg 1200w, /assets/images/hero-contact-2400.jpg 2400w"
            sizes="100vw"
            alt=""
            width={2400}
            height={1600}
            decoding="async"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: '58% 42%', animation: 'hero-zoom 24s linear both' }}
          />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(21,26,24,0.80)_0%,rgba(21,26,24,0.38)_32%,rgba(21,26,24,0.46)_62%,rgba(21,26,24,0.88)_100%)]" />
        <div className="absolute inset-0 hidden bg-[linear-gradient(95deg,rgba(21,26,24,0.90)_0%,rgba(21,26,24,0.62)_38%,rgba(21,26,24,0.22)_62%,transparent_84%)] md:block" />
      </div>
      <div className="relative flex min-h-[calc(100svh-var(--strip-h))] flex-col pt-[var(--header-h)]">

        <div className="gutter mx-auto flex w-full max-w-page flex-1 flex-col">
          <div className="flex flex-1 flex-col justify-center pt-[clamp(26px,5vh,56px)] pb-[clamp(72px,12vh,132px)]">
            <p
              style={rise(0)}
              className="flex items-center gap-3.5 text-[11.5px] font-semibold tracking-[0.2em] text-paper/75 uppercase [text-shadow:0_1px_14px_rgba(0,0,0,0.6)]"
            >
              <span aria-hidden="true" className="h-px w-9 bg-paper/45" />
              {CONTACT.hero.eyebrow}
            </p>

            <h1
              style={rise(1)}
              className="mt-[clamp(10px,1.6vh,18px)] max-w-[15ch] font-display text-[clamp(34px,4.6vw,58px)] leading-[1.06] tracking-[-0.016em] text-paper [text-shadow:0_1px_30px_rgba(0,0,0,0.55)] [text-wrap:balance]"
            >
              {CONTACT.hero.title}
            </h1>

            <p
              style={rise(2)}
              className="mt-[clamp(12px,2vh,20px)] max-w-measure text-[clamp(15px,1.35vw,17px)] leading-relaxed text-paper/80 [text-shadow:0_1px_16px_rgba(0,0,0,0.55)]"
            >
              {CONTACT.hero.intro}
            </p>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={toForm}
        aria-label={CONTACT.hero.scrollHint}
        className="group absolute inset-x-0 bottom-[18px] mx-auto flex h-11 w-11 items-center justify-center rounded-full text-paper/60 transition-colors duration-300 ease-brand hover:text-paper"
      >
        <span
          aria-hidden="true"
          className="block"
          style={{ animation: 'hero-bob 2.4s var(--ease-brand) infinite' }}
        >
          <ChevronDown className="h-5 w-5" />
        </span>
      </button>

      <div
        aria-hidden="true"
        className="relative h-px bg-[linear-gradient(90deg,transparent,rgba(200,155,44,.5),rgba(47,107,90,.5),transparent)]"
      />
    </section>
  )
}
