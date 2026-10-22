import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { ArrowRight, Close } from '../components/icons'
import { ALBUM, PHOTOS, PLACES, byYear, whereOf, type Photo } from '../components/gallery-data'

/* ---------------------------------------------------------------------------
   /gallery, section 2 of 3: the album. #album.

     the filter   one chip per place with its count, and "All places"
     the grid     one grid, newest first and undated last, the year on each
                  frame. A wide frame takes two cells, so the rows stay even
                  without cropping a landscape into a square. (It was grouped
                  under year headings for an hour on 17 September 2026; with
                  eight photographs most years held one, and read as gaps.)
     the viewer   a native <dialog>: focus stays inside it and Escape closes
                  it for free. Arrow keys and the two buttons step through
                  whatever the filter is showing, and each photograph links
                  to the appeals for its kind of work.

   A frame is never drawn wider than its own pixels in the viewer, because
   most of these are 600 to 900px and would go soft.
--------------------------------------------------------------------------- */

const isWide = (p: Photo) => p.width / p.height > 1.4

export default function GalleryAlbum() {
  const [place, setPlace] = useState<string | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)

  const shown = place ? PHOTOS.filter((p) => p.place === place) : PHOTOS
  /* newest first, undated last; the viewer steps in the same order */
  const order = byYear(shown).flatMap((g) => g.items)
  const current = open === null ? null : order[open]

  const step = (by: number) => setOpen((i) => (i === null ? i : (i + by + order.length) % order.length))

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open !== null && !d.open) d.showModal()
    if (open === null && d.open) d.close()
  }, [open])

  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open === null, order.length])

  const chip = (label: string, count: number, value: string | null) => {
    const on = place === value
    return (
      <button
        key={label}
        type="button"
        aria-pressed={on}
        onClick={() => setPlace(value)}
        className={`inline-flex min-h-[42px] items-center gap-2 rounded-full border px-4 text-[14.5px] font-semibold transition-[background-color,border-color,color] duration-200 ease-brand ${
          on ? 'border-teal bg-teal text-paper' : 'border-line bg-paper text-text hover:border-teal/50'
        }`}
      >
        {label}
        <span className={`nums text-[12.5px] ${on ? 'text-paper/70' : 'text-text-3'}`}>{count}</span>
      </button>
    )
  }

  return (
    <section id="album" aria-labelledby="album-head" className={`scroll-mt-[var(--header-h)] ${SECTION_Y}`}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead id="album-head" eyebrow={ALBUM.eyebrow} title={ALBUM.title} lede={ALBUM.lede} />

        <div className={`mt-s4 lg:mt-s5 ${BREAKOUT}`}>
          <Reveal variant="soft">
            <div role="group" aria-label="Filter by place" className="flex flex-wrap gap-2">
              {chip(ALBUM.all, PHOTOS.length, null)}
              {PLACES.map((p) => chip(p.place, p.count, p.place))}
            </div>
          </Reveal>

          <ul className="mt-s3 grid grid-cols-2 gap-x-s2 gap-y-s3 lg:grid-cols-4 lg:gap-x-s3">
            {order.map((p, i) => (
              <li key={`${place}-${p.src}`} className={isWide(p) ? 'col-span-2' : ''}>
                <Reveal variant="scale" delay={(i % 4) * 80} className="h-full">
                  <button type="button" onClick={() => setOpen(i)} className="group block w-full text-left">
                    {/* A wide frame is exactly two square cells and the gap
                        between them tall, so every row lines up. */}
                    <span
                      className={`relative overflow-hidden rounded-xl bg-line sm:rounded-2xl ${
                        isWide(p) ? 'grid grid-cols-2 gap-x-s2 lg:gap-x-s3' : 'block'
                      }`}
                    >
                      <span aria-hidden="true" className="block aspect-square" />
                      <img
                        src={p.src}
                        alt={p.alt}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.04]"
                        style={{ objectPosition: p.position }}
                      />
                      {p.year && (
                        <span className="nums absolute top-3 left-3 rounded-full bg-paper/90 px-2.5 py-1 text-[12px] font-semibold text-teal">
                          {p.year}
                        </span>
                      )}
                      <span
                        aria-hidden="true"
                        className="absolute top-3 right-3 flex size-9 scale-90 items-center justify-center rounded-full bg-paper/90 text-ink opacity-0 transition-[opacity,transform] duration-300 ease-brand group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100"
                      >
                        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" />
                        </svg>
                      </span>
                    </span>
                    <span className="mt-2.5 block text-[15px] leading-snug font-semibold text-text transition-colors duration-200 ease-brand group-hover:text-teal">
                      {p.title}
                    </span>
                    <span className="mt-0.5 block text-[13.5px] text-text-2">
                      {whereOf(p)}
                      {p.when ? `, ${p.when}` : `, ${ALBUM.undated.toLowerCase()}`}
                    </span>
                    <span className="sr-only">. {ALBUM.open}</span>
                  </button>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ---------- the viewer ---------- */}
      <dialog
        ref={dialog}
        aria-label={current?.title}
        onClose={() => setOpen(null)}
        onClick={(e) => e.target === e.currentTarget && setOpen(null)}
        className="m-0 h-full max-h-none w-full max-w-none bg-ink p-0 text-paper backdrop:bg-ink"
      >
        {current && (
          <div
            className="flex h-full flex-col"
            onClick={(e) => e.target === e.currentTarget && setOpen(null)}
          >
            <div className="gutter flex items-center justify-between py-s2">
              <p className="nums text-[13.5px] text-paper/60">
                {(open ?? 0) + 1} of {order.length}
              </p>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="flex size-11 items-center justify-center rounded-full border border-paper/25 transition-colors duration-200 ease-brand hover:bg-paper hover:text-ink"
              >
                <Close className="h-4 w-4" />
                <span className="sr-only">{ALBUM.close}</span>
              </button>
            </div>

            <div
              className="relative flex min-h-0 flex-1 items-center justify-center px-s2 sm:px-[72px]"
              onClick={(e) => e.target === e.currentTarget && setOpen(null)}
            >
              <img
                key={current.src}
                src={current.src}
                alt={current.alt}
                className="max-h-full rounded-xl object-contain"
                style={{ maxWidth: `min(100%, ${current.width}px)`, animation: 'fade-in 350ms var(--ease-reveal) both' }}
              />
              {order.length > 1 &&
                ([-1, 1] as const).map((by) => (
                  <button
                    key={by}
                    type="button"
                    onClick={() => step(by)}
                    className={`absolute top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-paper/25 bg-ink/40 transition-colors duration-200 ease-brand hover:bg-paper hover:text-ink sm:flex ${
                      by < 0 ? 'left-s2' : 'right-s2'
                    }`}
                  >
                    <ArrowRight className={`h-3.5 w-3.5 ${by < 0 ? 'rotate-180' : ''}`} />
                    <span className="sr-only">{by < 0 ? ALBUM.previous : ALBUM.next}</span>
                  </button>
                ))}
            </div>

            <div className="gutter mx-auto flex w-full max-w-page flex-wrap items-end justify-between gap-x-s4 gap-y-s2 py-s3">
              <div>
                <p className="font-display text-[clamp(20px,1.8vw,26px)] tracking-[-0.02em]">{current.title}</p>
                <p className="mt-1 text-[14.5px] text-paper/70">
                  {whereOf(current)}
                  {current.when && `, ${current.when}`}
                </p>
              </div>
              <div className="flex items-center gap-s2">
                {order.length > 1 && (
                  <span className="flex gap-2 sm:hidden">
                    {([-1, 1] as const).map((by) => (
                      <button
                        key={by}
                        type="button"
                        onClick={() => step(by)}
                        className="flex size-11 items-center justify-center rounded-full border border-paper/25"
                      >
                        <ArrowRight className={`h-3.5 w-3.5 ${by < 0 ? 'rotate-180' : ''}`} />
                        <span className="sr-only">{by < 0 ? ALBUM.previous : ALBUM.next}</span>
                      </button>
                    ))}
                  </span>
                )}
                <Link
                  to={current.appeal.to}
                  onClick={() => setOpen(null)}
                  className="group inline-flex min-h-[44px] items-center gap-2 border-b border-paper/35 text-[14.5px] font-semibold transition-colors duration-200 ease-brand hover:border-gold-pale hover:text-gold-pale"
                >
                  {current.appeal.label}
                  <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </section>
  )
}
