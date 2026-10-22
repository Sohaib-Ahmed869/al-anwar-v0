import { HeroBrand } from '../components/Brand'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import QuickGive from '../components/QuickGive'
import { pickPhoto, type QuickPick } from '../services/quickgive'
import { Words, useHeroDepth } from '../components/Reveal'
import { ArrowRight } from '../components/icons'

/* ---------------------------------------------------------------------------
   The home hero: one screen, and the places the money goes.

   It is pulled up behind the header by --header-h and takes --strip-h off the
   viewport, so it comes out exactly one screen tall whether or not the
   emergency strip is live. Header reads the same two variables and goes
   transparent over this section — see the `overlay` flag there.

   THE PHOTOGRAPH is what the gift is FOR: the destruction and the camps in
   Gaza, then Yemen and Lebanon. It rotates with the appeal. It is stock, so it
   is never captioned.

   THE CARD ON THE RIGHT is the quick give (16 September 2026, client's
   request). It used to be a stack of our field team's photographs, one set per
   appeal, with the quick give docked as a bar along the foot. The photographs
   moved to the /give hero (components/FieldStack.tsx, GiveHero) and the quick
   give took their place, so the appeal and the way to give sit side by side.

   Gaza leads, holds longest, and has two of the four slides: the emergency
   appeal and the field camps. It is the only slide allowed red, which is the
   live-crisis colour everywhere else on the site too.

   BACKGROUNDS — licensed stock from Pexels (free commercial use, no attribution
   required). No on-screen credit (client's request, 14 September 2026), so the
   only safeguard is this: never caption these as our work.
     gaza     Musa Alzanoun  pexels.com/photo/8155814   rescue crews and a digger on a collapsed building
                             (the photographer is Gaza-based and posts as @gaza, but the photo page
                             does not state the place — CONFIRM IT IS GAZA BEFORE LAUNCH)
     camps    Hosny Salah    pexels.com/photo/35934248  a flooded tent camp under ruined buildings, Gaza
     yemen    Mohammad Hadi  pexels.com/photo/11097030  a historic mud-brick town, Yemen
     lebanon  Mohamad Mekawi pexels.com/photo/10122911  families at a gathering, Beqaa Governorate, Lebanon

   THE CARD DRIVES THE PICTURE (28 September 2026, client's request). Choosing
   a cause in the quick give puts that cause's photograph and words where the
   appeal was, with a link to its page, and holds the rotation there: someone
   who has just chosen "Water Project" should not have Gaza slide back in under
   the card six seconds later. Clicking a progress line goes back to the
   appeals. The photograph and words are staff's (Admin → Appeals, quick-donate
   list) or, where they left them empty, the fund's own from give-data.ts.

   FIGURES — none in the appeal's words (client's request, 15 September 2026).
   The amounts on this screen are the quick give's (components/QuickGive.tsx).
--------------------------------------------------------------------------- */

type Slide = {
  /** the file stem under /assets/images, at 1200w and 2400w */
  file: string
  place: string
  note: string
  /** the live emergency — the only slide that takes red */
  alert?: boolean
  title: string
  body: string
  give: { label: string; to: string }
  /** the small link beside the dots, to that place's page */
  more: { label: string; to: string }
  /** how to frame the photograph once the viewport is taller than it is wide */
  position: string
  credit: string
  /** how long this slide holds, in ms */
  hold: number
}

const SLIDES: Slide[] = [
  {
    file: 'gaza',
    place: 'Gaza',
    note: 'Emergency appeal',
    alert: true,
    title: 'Gaza cannot wait.',
    body: 'Homes have been reduced to rubble, and families are living in tents with too little food and water. Help reach them today.',
    give: { label: 'Donate to Gaza', to: '/give?country=gaza' },
    more: { label: 'Gaza relief', to: '/appeals?country=gaza' },
    position: '58% 45%',
    credit: 'Musa Alzanoun',
    hold: 7000,
  },
  {
    file: 'camps',
    place: 'Gaza',
    note: 'Hot meals in the camps',
    title: 'Hot meals where families shelter.',
    body: 'Cooked and handed out in the camps by people on the ground, to families who have lost their kitchens.',
    give: { label: 'Give hot meals', to: '/give?appeal=meals' },
    more: { label: 'Field camps', to: '/where-it-goes' },
    position: '55% 50%',
    credit: 'Hosny Salah',
    hold: 6000,
  },
  {
    file: 'yemen',
    place: 'Yemen',
    note: 'Food, water, a school',
    title: 'Food, water and a school for Yemen.',
    body: 'Monthly food packs, water stations, and the Tarim school rebuild.',
    give: { label: 'Donate to Yemen', to: '/give?country=yemen' },
    more: { label: 'Yemen relief', to: '/appeals?country=yemen' },
    position: '50% 62%',
    credit: 'Mohammad Hadi',
    hold: 6000,
  },
  {
    file: 'lebanon',
    place: 'Lebanon',
    note: 'Crisis response',
    title: 'Lebanon still needs help.',
    body: 'Food packs, clean water and Eid clothes, bought locally in Tripoli.',
    give: { label: 'Donate to Lebanon', to: '/give?country=lebanon' },
    more: { label: 'Lebanon relief', to: '/appeals?country=lebanon' },
    position: '55% 35%',
    credit: 'Mohamad Mekawi',
    hold: 6000,
  },
]

const wrap = (i: number) => ((i % SLIDES.length) + SLIDES.length) % SLIDES.length

export default function HomeHero() {
  const [index, setIndex] = useState(0)
  const [reduced, setReduced] = useState(false)

  /* Only the pictures that have been reached, plus the one coming next, carry a
     src. Four full-bleed photographs downloaded at once would cost the first
     paint more than the whole rest of the page. */
  const [seen, setSeen] = useState<number[]>([0, 1])

  /* The elapsed time is read inside an animation frame, so it lives in a ref —
     putting it in state would re-render the hero sixty times a second to move
     four bars. */
  const heldRef = useRef(0)
  const [picked, setPicked] = useState<QuickPick | null>(null)
  const pickedRef = useRef(false)
  pickedRef.current = picked !== null
  const fillRefs = useRef<(HTMLSpanElement | null)[]>([])

  const go = useCallback((to: number) => {
    heldRef.current = 0
    setPicked(null)
    setIndex(wrap(to))
  }, [])

  useEffect(() => {
    const next = wrap(index + 1)
    setSeen((prev) =>
      prev.includes(index) && prev.includes(next) ? prev : [...new Set([...prev, index, next])],
    )
  }, [index])

  /* Asking for less motion stops the slow zoom on the photograph. The rotation
     itself keeps running (client's request, 15 September 2026). */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const read = () => setReduced(mq.matches)
    read()
    mq.addEventListener('change', read)
    return () => mq.removeEventListener('change', read)
  }, [])

  /* --- the clock ---------------------------------------------------------
     One frame loop drives both the advance and the bar in the active dot, so
     the bar you are watching is the timer rather than a second animation hoping
     to stay in step with it.

     It never stops for the visitor (client's request, 15 September 2026):
     hovering, focusing and swiping the cards all leave it
     running. Clicking a line or swiping the photograph jumps and restarts the
     clock. It only holds while the tab is hidden, where nobody can see it. */
  useEffect(() => {
    const paint = (at: number) =>
      fillRefs.current.forEach((el, i) => {
        if (el) el.style.transform = `scaleX(${i === index ? at : 0})`
      })

    const hold = SLIDES[index].hold
    let frame = 0
    let last = performance.now()

    const tick = (now: number) => {
      const dt = now - last
      last = now
      if (!document.hidden && !pickedRef.current) heldRef.current += dt

      const at = Math.min(heldRef.current / hold, 1)
      paint(at)

      if (at >= 1) {
        heldRef.current = 0
        setIndex((i) => wrap(i + 1))
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [index])

  /* A drag across the picture on a phone. Mouse drags are left alone — a stray
     drag over a link should not change the slide underneath it. The quick give
     card stops its own drags from reaching this. */
  const downX = useRef<number | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    downX.current = e.pointerType === 'touch' ? e.clientX : null
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const from = downX.current
    downX.current = null
    if (from === null) return
    const dx = e.clientX - from
    if (Math.abs(dx) > 56) go(index + (dx < 0 ? 1 : -1))
  }

  /* --- the scroll --- depth as the hero scrolls away; see useHeroDepth. */
  const depth = useHeroDepth()

  const slide = SLIDES[index]
  /* what the words say: the appeal, or the cause chosen in the card */
  const shown = picked
    ? {
        key: `pick-${picked.id}`,
        note: picked.label,
        title: picked.title || picked.cause.title,
        body: picked.body || picked.cause.note,
        link: picked.link ? { label: `About the ${picked.label}`, to: picked.link } : null,
      }
    : { key: String(index), note: slide.note, title: slide.title, body: slide.body, link: slide.give }
  const pickedPhoto = picked ? pickPhoto(picked) : null
  /* Each line of the appeal rises through a blur that clears as it lands. */
  const rise = (delay: number, ms = 1000) => ({
    animation: `hero-soft ${ms}ms var(--ease-reveal) both`,
    animationDelay: `${delay}ms`,
  })

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Where your donation goes"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      data-overlay-hero=""
      ref={depth.hero}
      className="relative isolate overflow-hidden bg-ink mt-[calc(var(--header-h)*-1)]"
    >
      <h1 className="sr-only">Al-Anwaar: relief for Gaza, Yemen and Lebanon</h1>

      {/* ---------- the photographs, and the dark they are read through ------
          On first load the whole layer comes up out of the dark and settles
          back from close (hero-intro); it is not keyed, so a slide change does
          not replay it. Oversized top and bottom by the parallax's travel. */}
      <div
        ref={depth.photo}
        aria-hidden="true"
        className="absolute inset-x-0 -top-[4%] -bottom-[4%] will-change-[translate] hero-intro"
      >
        {SLIDES.map((s, i) => (
          <img
            key={s.file}
            src={seen.includes(i) ? `/assets/images/hero-${s.file}-2400.jpg` : undefined}
            srcSet={
              seen.includes(i)
                ? `/assets/images/hero-${s.file}-1200.jpg 1200w, /assets/images/hero-${s.file}-2400.jpg 2400w`
                : undefined
            }
            sizes="100vw"
            alt=""
            width={2400}
            height={1600}
            decoding="async"
            fetchPriority={i === 0 ? 'high' : 'low'}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[900ms] ease-brand ${
              i === index && !picked ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              objectPosition: s.position,
              ...(i === index && !reduced ? { animation: 'hero-zoom 14s linear both' } : null),
            }}
          />
        ))}

        {/* the chosen cause's photograph, over the appeals while it holds */}
        {pickedPhoto && (
          <img
            key={pickedPhoto.src}
            src={pickedPhoto.src}
            srcSet={pickedPhoto.srcSet}
            sizes="100vw"
            alt=""
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              objectPosition: pickedPhoto.position,
              animation: reduced ? 'fade-in 600ms var(--ease-brand) both' : 'fade-in 600ms var(--ease-brand) both, hero-zoom 14s linear both',
            }}
          />
        )}

        {/* Top for the header, foot for the controls, and from md up a second
            pass from the left where the words sit. rgba of --color-ink, which a
            gradient cannot take as a variable. */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,38,42,0.74)_0%,rgba(8,38,42,0.30)_24%,rgba(8,38,42,0.42)_52%,rgba(8,38,42,0.82)_80%,rgba(8,38,42,0.96)_100%)]" />
        <div className="absolute inset-0 hidden bg-[linear-gradient(95deg,rgba(8,38,42,0.82)_0%,rgba(8,38,42,0.40)_42%,transparent_70%)] md:block" />
        <HeroBrand outline />
      </div>

      {/* ---------- what is on top of it ---------- */}
      <div className="relative flex min-h-[calc(100svh-var(--strip-h))] flex-col pt-[var(--header-h)]">
        <div className="gutter mx-auto flex w-full max-w-page flex-1 flex-col">
          {/* The appeal on the left, the quick give card on the right. */}
          <div className="flex flex-1 flex-col justify-center gap-10 py-[clamp(20px,4vh,56px)] lg:flex-row lg:items-center lg:gap-s5">
            {/* --- the appeal ---
                Remounted per slide so each line replays its entrance. Not
                announced: a region that changes on its own every few seconds
                would talk over a screen reader. */}
            {/* Only the words lift and fade on scroll (useHeroDepth), not the
                card: fading a frosted pane re-blurs it on every frame. */}
            <div ref={depth.content} className="min-w-0 max-w-[560px] flex-1">
              <div key={shown.key}>
                {/* The eyebrow and title are set exactly as SectionHead sets every
                  band's head (16 September 2026, user's request), in the pale
                  gold rather than green because they sit on a photograph. */}
                <p
                  className="font-script text-[clamp(21px,1.9vw,27px)] leading-none text-gold-pale [text-shadow:0_1px_16px_rgba(0,0,0,0.55)]"
                  style={rise(60)}
                >
                  {shown.note}
                </p>
                <h2 className="mt-s2 font-display text-[clamp(31px,4.2vw,54px)] leading-[1.05] tracking-[-0.022em] text-paper [text-wrap:balance] [text-shadow:0_2px_30px_rgba(0,0,0,0.5)]">
                  {/* a word at a time, replayed per slide (the block is keyed) */}
                  <Words text={shown.title} play="load" delay={160} step={70} />
                </h2>

                <p
                  className="mt-4 max-w-[46ch] text-[16px] leading-[1.6] text-paper/80 [text-shadow:0_1px_18px_rgba(0,0,0,0.6)]"
                  style={rise(420)}
                >
                  {shown.body}
                </p>

                {/* --- this appeal's own way in ---
                  A plain link now, not a gold button: the gold on this screen is
                  the quick give beside it, where the gift is actually made
                  (16 September 2026). Two gold buttons would ask twice. */}
                {shown.link && (
                <div className="mt-6" style={rise(560)}>
                  <Link
                    to={shown.link.to}
                    className="group inline-flex min-h-[44px] items-center gap-2 border-b border-paper/35 text-[15px] font-semibold text-paper transition-colors duration-200 ease-brand hover:border-gold-pale hover:text-gold-pale"
                  >
                    {shown.link.label}
                    <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                  </Link>
                </div>
                )}
              </div>
            </div>

            {/* --- the quick give card ---
                Where the field photographs were until 16 September 2026 (they
                are on /give now), and before that a bar along the foot. The
                first screen is where someone gives from. Not keyed, so it does
                not follow the slide: a cause chosen here should not change under
                the visitor every six seconds. It leads instead — see the head. The pointer stops here, so a
                swipe or a tap on the card never pages the appeal behind it.
                z-10 so the fund menu paints over everything. */}
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              className="relative z-10 w-full shrink-0 lg:ml-auto lg:w-[clamp(340px,30vw,420px)]"
              style={{ animation: 'hero-lift 1200ms var(--ease-reveal) 200ms both' }}
            >
              <QuickGive layout="card" onPick={setPicked} />
            </div>
          </div>

          {/* --- the progress lines ---
              One thin line per place and no arrows: the line you are on fills
              as the slide holds, so it is the clock. Every line is the same
              width, so nothing shifts when the slide changes. Each button is
              24px tall to the finger though the line is 2px to the eye; the
              place is in its label, and left and right page the hero once a
              line has the keyboard.

              The appeal's own page ("Gaza relief") sits beside the lines rather
              than beside the Donate button, so the button stands alone. The row
              is a three-column grid with the lines in the middle column, so the
              lines stay centred however long the link's words are. */}
          <div
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 pb-[clamp(18px,3.5vh,32px)] sm:gap-5"
            style={{ animation: 'fade-in 900ms var(--ease-reveal) 1000ms both' }}
          >
            <ul
              onKeyDown={(e) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
                e.preventDefault()
                go(index + (e.key === 'ArrowRight' ? 1 : -1))
              }}
              className="col-start-2 flex list-none items-center gap-1.5"
            >
              {SLIDES.map((s, i) => (
                <li key={s.file}>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={i === index && !picked}
                    aria-label={`${s.place}: ${s.note}`}
                    title={`${s.place}: ${s.note}`}
                    className="group flex h-6 items-center"
                  >
                    <span
                      aria-hidden="true"
                      className="block h-[2px] w-8 overflow-hidden rounded-full bg-paper/25 transition-colors duration-300 group-hover:bg-paper/45 sm:w-10"
                    >
                      <span
                        ref={(el) => {
                          fillRefs.current[i] = el
                        }}
                        className="block h-full w-full origin-left bg-paper"
                        style={{ transform: 'scaleX(0)' }}
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {!picked && (
            <Link
              key={slide.file}
              to={slide.more.to}
              className="group flex items-center gap-4 justify-self-start text-[13px] font-medium whitespace-nowrap text-paper/65 transition-colors duration-200 hover:text-paper sm:gap-5"
              style={{ animation: 'fade-in 500ms var(--ease-brand) both' }}
            >
              <span aria-hidden="true" className="h-3 w-px bg-paper/25" />
              <span className="flex items-center gap-1.5">
                {slide.more.label}
                <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
              </span>
            </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
