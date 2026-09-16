import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import FieldStack, { type Field } from '../components/FieldStack'
import { Words, useHeroDepth } from '../components/Reveal'
import { VERSE } from '../components/give-data'
import { TOTAL_OVERSEAS, money } from '../components/where-data'
import { ArrowRight, HandHeart } from '../components/icons'

/* ---------------------------------------------------------------------------
   /give, section 1 of 3: the hero.

   REBUILT 16 SEPTEMBER 2026, at the user's request, to sit with the home hero
   rather than apart from it. The centred poster (script eyebrow, serif title,
   the full ayah in Arabic and English, a spaced capital reference, a button
   and a legal line, all stacked down the middle) read as a template and hid
   the film behind it. Now:

     - the words sit on the left, as on HomeHero; the right of the frame holds
       our field team's photograph stack (FieldStack, moved from HomeHero on
       16 September 2026), small enough that the film still shows around it
     - one face, as on HomeHero: the display title and the sans body
     - the ayah is one line of its translation with its reference; the text
       and the sign-off TODO are still in give-data.ts
     - the line under the button is a figure anyone can check: everything
       lodged with the ACNC as sent overseas (where-data.ts), linked to the page
       that shows the returns
     - one gold button, and one plain link for the other visitor who lands
       here, the one working out their zakat

   ONE FULL SCREEN, like HomeHero (the user asked for the full height back on
   16 September 2026), with the title and body set in HomeHero's exact sizes:
   a script eyebrow, then the display face at 31 to 54px semibold (SectionHead's
   size), the body at 16px. Pulled up behind
   the header by --header-h so Header sits transparent over
   it, and a MINIMUM height, so it grows rather than clipping.

   THE FILM, AND SWAPPING IT (read this before changing FILM below)
   The film is the point of the hero, so it runs on phones too now, from a
   540p cut under 1 MB, and there is a pause button: a loop that cannot be
   stopped fails WCAG 2.2.2. It is not fetched at all under reduced motion or
   Data Saver; those visitors get the poster.

   The film fades in over the poster once, when it starts playing, and then
   loops natively with no fade at the seam (see useFilm).

   hero-give-water.mp4 is LICENSED STOCK AND NOT OUR WORK: Pexels video
   15405846, "A Group of Pakistani Women Filling Water Pots with a Hand Pump",
   by Hamza Awan. Pexels License, no attribution required, and no on-screen
   credit per the client's instruction of 14 September 2026. It is Pakistan,
   and Al-Anwaar works in Yemen, Gaza and Lebanon, so FILM.caption stays null
   while it runs. Nothing may say where it is or that it is our work.

   When the charity's own footage arrives:
     1. desktop: 1280x720 or 1920x1080, 10 to 20 seconds, no audio, H.264 MP4
        around 4 MB with +faststart; the subject in the right third of the frame
     2. phone: the same cut at 540p, around 1 MB
     3. poster: one frame of it as a 1600w JPEG
     4. set FILM's three paths and give it a caption (place and year). The
        caption shows only when it is set.
   The charity's 03-Al-anwar.mp4 (48 MB) is still unreferenced in
   public/assets/videos and ships in every build; it is the obvious first
   candidate, re-encoded as above.
--------------------------------------------------------------------------- */

const FILM = {
  src: '/assets/videos/hero-give-water.mp4',
  small: '/assets/videos/hero-give-water-sm.mp4',
  poster: '/assets/images/hero-give-water-1600.jpg',
  /** Place and year, for the charity's own footage only. Stock is never
   *  captioned; see the note above. */
  caption: null as string | null,
  position: '50% 45%',
}

/* Our field team at work, on the right of the film (moved here from the home
   hero, 16 September 2026, client's request). All Al-Anwaar's own
   photographs. Captions say only what the file or the About ledger already
   says; the March 2024 camp does not say which border, because nothing on the
   file does. Dates come off the files, not the field log: confirm them before
   launch. The film is stock and stays uncaptioned; these are the only
   captioned pictures on the screen. */
const FIELDS: Field[] = [
  {
    src: '/assets/images/PHOTO-2022-04-26-22-10-27.webp',
    alt: 'Children filling jerry cans from a water truck',
    what: 'Water by the tanker',
    place: 'Yemen',
    when: '2022',
    position: '50% 60%',
  },
  {
    src: '/assets/images/WhatsApp-Image-2024-03-01-at-10.21.59-AM.jpeg',
    alt: 'Cooked meals handed down from the back of a van to families at a camp',
    what: 'Hot meals handed out',
    place: 'A displacement camp',
    when: 'March 2024',
  },
  {
    src: '/assets/images/PHOTO-2021-12-23-22-48-18.webp',
    alt: 'Rows of prepared food baskets waiting in a distribution store',
    what: 'Food baskets packed',
    place: 'Tarim, Hadhramaut',
    when: 'December 2021',
  },
  {
    src: '/assets/images/PHOTO-2022-05-01-00-52-12.webp',
    alt: 'Families filling jerry cans and buckets from a water tank',
    what: 'Everyone brings a can',
    place: 'Yemen',
    when: '2022',
  },
  {
    src: '/assets/images/PHOTO-2022-06-05-00-56-50.webp',
    alt: 'A family beside a Ramadan food package and the Yemen Appeal banner',
    what: 'Ramadan food packages',
    place: 'Yemen',
    when: '2022',
    position: '50% 45%',
  },
  {
    src: '/assets/images/food-pack-yemen.webp',
    alt: 'A food pack laid out: basmati rice, flour, sugar, cooking oil and tinned goods',
    what: 'A Ramadan food pack',
    place: 'Yemen',
  },
  {
    src: '/assets/images/water-station.webp',
    alt: 'Jerry cans being filled from a standing tap',
    what: 'A water station',
    place: 'Yemen',
  },
]

/** The simile from Al-Baqarah 2:261, cut from the translation in give-data.ts
 *  rather than retyped, so the two can never disagree. */
const SIMILE = VERSE.english.slice(VERSE.english.indexOf('like a seed'))

/* The entrance, as on HomeHero (16 September 2026): each line rises through a
   blur that clears as it lands, the title a word at a time between them. A
   step is 140ms. */
const rise = (step: number) => ({
  animation: 'hero-soft 1000ms var(--ease-reveal) both',
  animationDelay: `${step * 140}ms`,
})

const toForm = () =>
  document.getElementById('give-form')?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  })

export default function GiveHero() {
  const film = useFilm()
  const depth = useHeroDepth<HTMLElement>()

  return (
    <section
      ref={depth.hero}
      data-overlay-hero=""
      aria-labelledby="page-title"
      className="relative isolate mt-[calc(var(--header-h)*-1)] overflow-hidden bg-ink text-paper"
    >
      {/* The film comes up out of the dark on load and settles back from
          close (hero-intro), then drifts with the scroll (useHeroDepth). */}
      <div
        ref={depth.photo}
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-ink will-change-[translate] hero-intro"
      >
        <img
          src={FILM.poster}
          alt=""
          width={1600}
          height={900}
          decoding="async"
          fetchPriority="high"
          className="h-full w-full object-cover"
          style={{ objectPosition: FILM.position }}
        />
        {film.src && (
          <video
            ref={film.ref}
            src={film.src}
            poster={FILM.poster}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onPlaying={film.onPlaying}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-brand ${
              film.visible ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ objectPosition: FILM.position }}
          />
        )}
      </div>

      {/* Dark only where the words are: a pass from the left and a floor under
          them, as on HomeHero, and the right of the frame left nearly clear.
          rgba of --color-ink, which a gradient cannot take as a variable. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(21,26,24,0.62)_0%,rgba(21,26,24,0.12)_28%,rgba(21,26,24,0.18)_55%,rgba(21,26,24,0.88)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 hidden bg-[linear-gradient(95deg,rgba(21,26,24,0.78)_0%,rgba(21,26,24,0.36)_40%,transparent_66%)] md:block"
      />

      <div className="relative flex min-h-[calc(100svh-var(--strip-h))] items-center pt-[var(--header-h)] pb-[clamp(56px,9vh,96px)]">
        <div className="gutter mx-auto w-full max-w-page">
          <div
            ref={depth.content}
            className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="max-w-[560px] min-w-0 flex-1">
              {/* Eyebrow and title set as SectionHead sets them, gold for the
                photograph (as on HomeHero). */}
              <p
                className="font-script text-[clamp(21px,1.9vw,27px)] leading-none text-gold-pale [text-shadow:0_1px_16px_rgba(0,0,0,0.55)]"
                style={rise(0)}
              >
                Give with purpose
              </p>
              <h1
                id="page-title"
                className="mt-s2 font-display text-[clamp(31px,4.2vw,54px)] leading-[1.05] font-semibold tracking-[-0.022em] text-paper [text-wrap:balance] [text-shadow:0_2px_30px_rgba(0,0,0,0.5)]"
              >
                {/* Sets up the verse under it (2:261): the gift as a seed. Was
                  "Your gift, handed over in Yemen, Gaza and Lebanon.", a list
                  of places; changed 16 September 2026 at the user's request
                  for a line that means something. */}
                <Words text="One gift, planted like a seed." play="load" delay={140} step={70} />
              </h1>

              <figure className="mt-4 max-w-[46ch]" style={rise(3)}>
                <blockquote className="text-[16px] leading-[1.6] text-paper/80 [text-shadow:0_1px_18px_rgba(0,0,0,0.6)]">
                  &ldquo;{SIMILE.charAt(0).toUpperCase() + SIMILE.slice(1)}&rdquo;
                </blockquote>
                <figcaption className="mt-1 text-[13px] text-paper/60">{VERSE.cite}</figcaption>
              </figure>

              <div className="mt-6 flex flex-wrap items-center gap-x-s4 gap-y-s2" style={rise(4)}>
                {/* Gold, because gold is the give action on this site. It takes
                  no payment: it scrolls to the form, which is the only place a
                  gift is decided on this page. A <button> so it can honour
                  reduced motion. */}
                <button
                  type="button"
                  onClick={toForm}
                  className="group relative inline-flex min-h-[54px] items-center justify-center gap-2.5 overflow-hidden rounded-[13px] bg-gold px-7 text-[16px] font-semibold tracking-[-0.008em] text-ink shadow-gold transition-[transform,box-shadow,background-color,color] duration-200 ease-brand hover:-translate-y-[1.5px] hover:bg-gold-dark hover:text-paper hover:shadow-gold-lg active:translate-y-0"
                >
                  <HandHeart className="h-[18px] w-[18px] shrink-0 transition-transform duration-300 ease-brand group-hover:scale-[1.12]" />
                  Give now
                </button>

                <Link
                  to="/zakat/calculator"
                  className="group inline-flex min-h-[44px] items-center gap-2 border-b border-paper/35 text-[15px] font-semibold text-paper transition-colors duration-200 ease-brand hover:border-gold-pale hover:text-gold-pale"
                >
                  Calculate your zakat
                  <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                </Link>
              </div>

              <p
                className="mt-s3 text-[13.5px] leading-relaxed text-paper/70 [text-shadow:0_1px_14px_rgba(0,0,0,0.6)]"
                style={rise(5)}
              >
                <span className="nums font-semibold text-paper">{money(TOTAL_OVERSEAS)}</span> sent
                overseas since we registered, as lodged with the ACNC.{' '}
                <Link
                  to="/where-it-goes"
                  className="underline decoration-paper/35 underline-offset-[3px] transition-colors duration-200 ease-brand hover:text-paper hover:decoration-paper"
                >
                  See the returns
                </Link>
              </p>
            </div>

            <FieldStack
              cards={FIELDS}
              delay={500}
              className="w-[min(62vw,250px)] lg:w-[clamp(220px,min(22vw,40vh),340px)]"
            />
          </div>
        </div>
      </div>

      {/* Bottom right: the caption when the footage is ours, and the pause. */}
      {(film.src || FILM.caption) && (
        <div className="gutter absolute right-0 bottom-[clamp(16px,3vh,28px)] flex items-center gap-3">
          {FILM.caption && (
            <p className="hidden text-[12.5px] text-paper/70 [text-shadow:0_1px_10px_rgba(0,0,0,0.6)] sm:block">
              {FILM.caption}
            </p>
          )}
          {film.src && (
            <button
              type="button"
              onClick={film.toggle}
              aria-label={film.playing ? 'Pause the background video' : 'Play the background video'}
              className="grid h-9 w-9 place-items-center rounded-full border border-paper/30 bg-ink/30 text-paper/85 backdrop-blur-sm transition-colors duration-200 ease-brand hover:border-paper/60 hover:text-paper"
            >
              {film.playing ? (
                <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor">
                  <rect x="2" y="1.5" width="2.6" height="9" rx="0.6" />
                  <rect x="7.4" y="1.5" width="2.6" height="9" rx="0.6" />
                </svg>
              ) : (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 12 12"
                  className="ml-0.5 h-3 w-3"
                  fill="currentColor"
                >
                  <path d="M3 1.8v8.4c0 .5.5.8.9.5l6.4-4.2a.6.6 0 0 0 0-1L3.9 1.3c-.4-.3-.9 0-.9.5Z" />
                </svg>
              )}
            </button>
          )}
        </div>
      )}

      {/* the gold-to-green hairline every hero on this site closes on */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(200,155,44,.5),rgba(47,107,90,.5),transparent)]"
      />
    </section>
  )
}

/* ---------------------------------------------------------------------------
   The film's state: which file, whether it is showing, and the pause.

   Chosen on the first render, never under reduced motion or Data Saver, and
   the small cut under 768px. `visible` turns true once, when the film is
   actually playing, and never goes back: the film fades in over the poster a
   single time and then loops natively.

   It used to fade out onto the poster over the loop's seam, including its
   first quarter second, and was only fetched 600ms after first paint. On
   load that showed the poster, then the film, then the poster again, then
   the film: the video looked as if it loaded twice (16 September 2026).
--------------------------------------------------------------------------- */

const pickFilm = () => {
  if (typeof window === 'undefined') return null
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null
  if ((navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return null
  return window.matchMedia('(max-width: 767px)').matches ? FILM.small : FILM.src
}

function useFilm() {
  const ref = useRef<HTMLVideoElement>(null)
  const [src] = useState(pickFilm)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(true)

  const toggle = () => {
    const v = ref.current
    if (!v) return
    if (v.paused) {
      void v.play()
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }

  return {
    ref,
    src,
    playing,
    visible: ready,
    onPlaying: () => setReady(true),
    toggle,
  }
}
