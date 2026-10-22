/* ---------------------------------------------------------------------------
   THE 2026 BRAND, as components. Everything here comes out of
   Al-Anwaar-Styleguide-2026.pdf as vectors (public/assets/brand/, generated
   from the PDF's own paths, never traced from a bitmap), so the website and
   the printed identity are one drawing.

   - Logo        the primary lock-ups (p. 5–7): horizontal or vertical, for a
                 light or a dark ground. Pick by GROUND, not by taste: the
                 guide pairs teal-on-off-white and off-white-on-dark-teal.
   - BrandMark   the hexagonal Kufi mark alone, inline, so it can take
                 currentColor. The illuminated doorway inside the wāw is
                 always saffron unless the mark is one colour.
   - Tiles       the tiled hexagonal pattern for background texture (p. 16).
   - OutlineMark the outlined logo layered over a background for depth.
   - Sticker     the brandmark sticker that overlays imagery like a stamp.
   - Arch        the dome-inspired border, framing a photograph.
   - DomePanel   a whole dome, for the gradient panels of p. 15.

   The masks behind Tiles, OutlineMark, Arch and DomePanel are utilities in
   index.css (.brand-*); their colour is the background the element is given.
--------------------------------------------------------------------------- */
import type { CSSProperties, ReactNode } from 'react'

const MARK_BODY =
  'M99.84 21.50C87.42 14.32 74.97 7.14 62.61 0.00C50.25 7.14 37.81 14.32 25.38 21.50C9.68 30.57 0.00 47.33 0.00 65.46L0.00 94.99C1.93 96.10 7.77 99.41 7.77 99.41L7.77 69.95C7.77 51.81 17.45 35.05 33.16 25.98L62.61 8.98L92.06 25.98C107.77 35.05 117.45 51.81 117.45 69.95L117.45 72.36C117.45 72.36 123.30 69.04 125.22 67.93L125.22 65.46C125.22 47.33 115.55 30.57 99.84 21.50M125.22 72.32L125.22 99.54C125.22 105.05 122.28 110.14 117.51 112.90L117.45 112.93L117.45 76.73C117.45 76.73 122.75 73.73 125.22 72.32M19.53 43.85L19.53 119.72C15.76 117.55 11.74 115.22 7.77 112.93C2.96 110.15 0.00 105.02 0.00 99.47C3.46 101.47 11.71 106.23 11.71 106.23L11.68 67.01C12.20 58.65 14.97 50.67 19.53 43.85M70.43 117.53L62.61 122.05L54.79 117.53L54.79 33.80C54.79 29.63 57.02 25.78 60.63 23.70L62.61 22.55L64.59 23.70C68.21 25.78 70.43 29.63 70.43 33.80L70.43 117.53M82.18 38.39L82.18 110.75L78.25 113.02L78.30 31.55C78.30 25.96 75.33 20.80 70.49 18.00L70.46 17.99C67.02 16.00 63.59 14.02 62.61 13.46C61.63 14.02 58.18 16.02 54.74 18.00C49.90 20.80 46.92 25.96 46.92 31.55L46.92 122.08C48.87 123.20 60.66 130.01 62.61 131.14C64.56 130.01 70.49 126.59 70.49 126.59L70.43 131.11L62.61 135.62L43.04 124.32L43.04 24.82L42.98 24.79C42.50 25.07 41.89 25.42 41.21 25.81C39.20 26.98 36.62 28.46 35.16 29.31L35.16 128.75C44.14 133.93 53.64 139.41 62.61 144.59C67.53 141.76 73.38 138.38 78.30 135.53L78.30 122.07C78.30 122.07 88.11 116.41 90.06 115.29L90.06 42.88L82.18 38.39M90.05 29.30L90.00 38.37C88.05 37.24 84.13 34.97 82.18 33.85L82.24 24.79C84.18 25.92 88.11 28.18 90.05 29.30M113.57 67.34L113.57 115.18C103.26 121.13 92.49 127.34 82.18 133.29L82.18 124.32C84.13 123.20 105.69 110.75 105.69 110.75L105.69 106.19L93.94 112.99L94.00 31.75C96.88 33.82 99.50 36.19 101.81 38.81L101.76 99.44C104.19 98.04 105.69 95.44 105.70 92.63L105.74 43.92C110.33 50.81 113.09 58.89 113.57 67.34M31.28 31.71L31.28 126.51C31.28 126.51 23.41 121.96 23.41 121.96L23.41 38.81C25.74 36.17 28.37 33.78 31.28 31.71'
const MARK_LIGHT =
  'M66.54 33.85L66.54 115.29L62.61 117.57L58.67 115.29L58.67 33.85C58.67 31.04 60.17 28.44 62.61 27.03L62.61 27.03C65.04 28.44 66.54 31.04 66.54 33.85'

type LogoProps = {
  layout?: 'horizontal' | 'vertical'
  onDark?: boolean
  className?: string
  alt?: string
}

export function Logo({ layout = 'horizontal', onDark = false, className = '', alt = 'Al-Anwaar Charity' }: LogoProps) {
  const src = `/assets/brand/logo-${layout}${onDark ? '-on-dark' : ''}.svg`
  /* Intrinsic sizes from the artwork, so the box is reserved before it loads. */
  const [w, h] = layout === 'horizontal' ? [321, 99] : [175, 205]
  return <img src={src} width={w} height={h} alt={alt} className={className} decoding="async" />
}

type MarkProps = {
  /** color: teal with the saffron doorway (light grounds) · onDark: off-white
   *  with the saffron doorway · mono: one colour, currentColor, doorway cut */
  tone?: 'color' | 'onDark' | 'mono'
  className?: string
  title?: string
  style?: CSSProperties
}

export function BrandMark({ tone = 'color', className = '', title, style }: MarkProps) {
  const body = tone === 'color' ? 'var(--color-teal)' : tone === 'onDark' ? 'var(--color-offwhite)' : 'currentColor'
  return (
    <svg
      viewBox="0 0 125.22 144.59"
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
    >
      <path fill={body} d={MARK_BODY} />
      {tone !== 'mono' && <path fill="var(--color-gold)" d={MARK_LIGHT} />}
    </svg>
  )
}

type LayerProps = { className?: string; style?: CSSProperties }

/** Background texture. Give it a colour (`bg-teal/40`) and, optionally, a
 *  size: style={{ '--tile': '64px' }}. Sits absolutely inside its parent.
 *  `fade` is a mask-image for the WRAPPER (e.g. 'linear-gradient(to top,#000,
 *  transparent)'): the tiles are themselves a mask, so a fade has to live on a
 *  box around them or the two masks fight and the fade is lost. */
export function Tiles({ className = 'bg-teal/25', style, fade }: LayerProps & { fade?: string }) {
  const tiles = <div aria-hidden="true" className={`brand-tiles pointer-events-none absolute inset-0 ${fade ? '' : className}`} style={style} />
  if (!fade) return tiles
  const z = className.match(/(^|\s)(-?z-\S+)/)?.[2] ?? ''
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${z}`} style={{ maskImage: fade, WebkitMaskImage: fade }}>
      <div className={`brand-tiles absolute inset-0 ${className.replace(z, '')}`} style={style} />
    </div>
  )
}

/** The outlined brandmark, large and faint behind content. Position it with
 *  className (it fills its box, keeping the mark's proportion). */
export function OutlineMark({ className = 'bg-teal/30', style }: LayerProps) {
  return <div aria-hidden="true" className={`brand-outline pointer-events-none absolute ${className}`} style={style} />
}

/** The stamp: the brandmark sticker over a photograph's corner. */
export function Sticker({ className = '', style }: LayerProps) {
  return (
    <img
      src="/assets/brand/sticker.svg"
      alt=""
      aria-hidden="true"
      width={97}
      height={113}
      className={`pointer-events-none drop-shadow-[0_6px_14px_rgba(8,38,42,0.35)] ${className}`}
      style={style}
    />
  )
}

/** A photograph (or anything) framed by the dome's pointed top. */
export function Arch({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`brand-arch relative overflow-hidden ${className}`}>{children}</div>
}

/** A whole dome, for decoration: give it a gradient (`bg-grad-dawn`). */
export function DomePanel({ className = '', style, children }: LayerProps & { children?: ReactNode }) {
  return (
    <div aria-hidden={children ? undefined : 'true'} className={`brand-dome aspect-[131/435] ${className}`} style={style}>
      {children}
    </div>
  )
}

/** THE HERO TREATMENT, the same on every photograph-led hero so the site reads
 *  as one identity from page to page, and kept QUIET — the photograph is the
 *  hero, the brand is a whisper over it: a light grade toward the deep teal
 *  gradient (p. 15), the outlined brandmark standing large and faint on the
 *  right (p. 16, "layered over backgrounds to add depth"), the tiles faint and
 *  low, fading up from the foot, and a saffron-to-teal line along the bottom.
 *  The tiles were once laid over the whole picture and read as noise; kept to
 *  the foot at a few percent, they read as texture. Place it after the hero's scrims; pass
 *  z="-z-10" where those scrims sit at -z-10. */
export function HeroBrand({ z = '', outline = false }: { z?: string; outline?: boolean }) {
  return (
    <>
      <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${z} bg-grad-deep opacity-20 mix-blend-multiply`} />
      {/* the tiles, but only as a whisper: large, off-white at a few percent,
          rising out of the foot of the picture and gone well before the
          headline (22 October 2026, client: "shouldn't look too prominent") */}
      <Tiles
        className={`${z} bg-paper/[0.06]`}
        fade="linear-gradient(to top, #000 0%, rgba(0,0,0,.55) 18%, transparent 42%)"
        style={{ '--tile': '200px' } as CSSProperties}
      />
      {outline && <OutlineMark className={`${z} top-[10%] right-[-6%] hidden h-[110%] w-[48%] bg-paper/[0.09] md:block`} />}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 bottom-0 ${z} h-[3px] bg-[linear-gradient(90deg,var(--color-gold),var(--color-teal-mid)_45%,transparent_90%)]`}
      />
    </>
  )
}

/* The six gradients of p. 15, in the guide's order, each as a dome. */
const DOME_GRADIENTS = ['bg-grad-dawn', 'bg-grad-mist', 'bg-grad-sea', 'bg-grad-deep', 'bg-grad-dusk', 'bg-grad-lagoon'] as const

/** THE GRADIENT DOMES (p. 15): a row of domes, each one of the brand's
 *  gradients, alternately raised and dropped as the guide sets them. Pure
 *  decoration. `pick` chooses which gradients and in what order (indexes into
 *  the six). */
export function GradientDomes({
  pick = [0, 1, 2, 3, 4, 5],
  className = '',
  domeClass = 'w-[clamp(44px,6vw,92px)]',
}: {
  pick?: number[]
  className?: string
  domeClass?: string
}) {
  return (
    <div aria-hidden="true" className={`pointer-events-none flex items-center gap-[clamp(10px,1.4vw,22px)] ${className}`}>
      {pick.map((g, i) => (
        <div
          key={i}
          className={`brand-dome aspect-[131/435] shrink-0 ${DOME_GRADIENTS[g % 6]} ${domeClass} ${i % 2 ? '-translate-y-[9%]' : 'translate-y-[9%]'}`}
        />
      ))}
    </div>
  )
}
