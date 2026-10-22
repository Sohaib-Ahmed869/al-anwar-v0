import { HeroBrand } from '../components/Brand'
import { ArrowRight } from '../components/icons'
import { GALLERY_HERO as HERO, PHOTOS, whereOf } from '../components/gallery-data'

/* ---------------------------------------------------------------------------
   /gallery, section 1 of 3: the hero.

   The Events hero's shape (flat logo teal, the words on the left, pictures on
   the right) so the two newest pages read as a pair. The difference is the
   pictures: these are the charity's own, so here, and only here among the
   heroes, each one carries its place and year.

   THREE FRAMES: the Gambia masjid (the one wide original, 2012px) across the
   top, and two squares under it. They are chosen in HERO_PICKS by file, so a
   better frame arriving is a one-line change. None is shown past its own
   width. /gallery is in Header's OVERLAY_ROUTES.
--------------------------------------------------------------------------- */

const HERO_PICKS = [
  '/assets/images/PHOTO-2022-07-29-10-21-12.webp',
  '/assets/images/PHOTO-2022-04-26-22-10-27.webp',
  '/assets/images/WhatsApp-Image-2024-03-01-at-10.21.59-AM.jpeg',
]

const rise = (ms: number) => ({ animation: `hero-soft 1000ms var(--ease-reveal) ${ms}ms both` })

export default function GalleryHero() {
  const [wide, ...small] = HERO_PICKS.map((src) => PHOTOS.find((p) => p.src === src)!).filter(Boolean)

  const toAlbum = () =>
    document.getElementById('album')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })

  const frame = (p: typeof wide, className: string, sizes: string, delay: number) => (
    <figure
      className={`group relative overflow-hidden rounded-2xl bg-ink/20 shadow-[0_30px_70px_-35px_rgba(0,0,0,0.6)] ${className}`}
      style={rise(delay)}
    >
      <img
        src={p.src}
        alt={p.alt}
        sizes={sizes}
        decoding="sync"
        className="h-full w-full object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.03]"
        style={{ objectPosition: p.position }}
      />
      <figcaption className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.6))] px-s2 pt-s4 pb-2.5 text-[12.5px] font-medium text-paper">
        {whereOf(p)}
        {p.when && <span className="text-paper/70">, {p.when}</span>}
      </figcaption>
    </figure>
  )

  return (
    <section
      data-overlay-hero=""
      aria-labelledby="gallery-title"
      className="relative isolate mt-[calc(var(--header-h)*-1)] overflow-hidden bg-grad-deep-x text-paper"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(90%_80%_at_85%_20%,rgba(255,255,255,0.08)_0%,transparent_60%)]"
      />
      <HeroBrand z="-z-10" />

      <div className="gutter mx-auto grid max-w-page items-center gap-x-s5 gap-y-s5 pt-[calc(var(--header-h)+clamp(40px,6vw,72px))] pb-[clamp(56px,7vw,96px)] lg:min-h-[clamp(620px,88svh,860px)] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div>
          <p className="font-script text-[clamp(24px,2.2vw,32px)] leading-none text-gold-pale" style={rise(60)}>
            {HERO.eyebrow}
          </p>
          <h1
            id="gallery-title"
            className="mt-s2 font-display text-[clamp(42px,5.4vw,80px)] leading-[0.98] tracking-[-0.04em]"
            style={rise(140)}
          >
            <span className="block">{HERO.titleLead}</span>
            <span className="block text-gold-pale">{HERO.titleMark}</span>
          </h1>
          <p
            className="mt-s3 max-w-[42ch] text-[clamp(15.5px,1.25vw,18px)] leading-[1.6] text-pretty text-paper/85"
            style={rise(320)}
          >
            {HERO.intro}
          </p>
          <div className="mt-s4" style={rise(460)}>
            <button
              type="button"
              onClick={toAlbum}
              className="group inline-flex min-h-[52px] items-center gap-2.5 rounded-[12px] bg-paper px-6 text-[15.5px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-green-pale"
            >
              {HERO.more}
              <ArrowRight className="h-3 w-3 rotate-90 transition-transform duration-300 ease-brand group-hover:translate-y-0.5" />
            </button>
          </div>
        </div>

        {wide && (
          <div className="grid grid-cols-2 gap-s2">
            {frame(wide, 'col-span-2 aspect-[2/1]', '(min-width: 1024px) 50vw, 92vw', 240)}
            {small.map((p, i) => frame(p, 'aspect-square', '(min-width: 1024px) 25vw, 46vw', 360 + i * 120))}
          </div>
        )}
      </div>
    </section>
  )
}
