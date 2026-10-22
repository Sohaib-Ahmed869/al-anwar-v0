import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Arch, Logo, OutlineMark, Sticker, Tiles } from '../../components/Brand'

/* The frame for every sign-in screen: the form on paper on one side, and on
   the other a composition straight out of the styleguide — the deep teal
   gradient (p. 15), the tiles and the outlined mark behind (p. 16), one of the
   charity's own photographs framed in the dome border, and the brandmark
   sticker pressed onto its corner like a stamp. Hidden on a phone, where the
   form is the whole screen. */
export function AuthLayout({
  children,
  image = '/assets/images/hero-water-1200.jpg',
  quote,
  tag,
}: {
  children: ReactNode
  image?: string
  quote?: { text: string; cite: string }
  tag?: string
}) {
  return (
    <div className="grid min-h-dvh bg-paper lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10 sm:py-8">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="Al-Anwaar home">
            <Logo className="h-11 w-auto" />
          </Link>
          {tag && <span className="rounded-md bg-gold/20 px-2.5 py-1 text-[11px] font-semibold tracking-[0.18em] text-green uppercase">{tag}</span>}
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px] animate-portal-in">{children}</div>
        </div>
        <p className="text-[12px] text-text-3">
          Al-Anwaar Charity Group Ltd · ABN 16 643 085 152 · <Link to="/privacy" className="underline-offset-2 hover:underline">Privacy</Link>
        </p>
      </div>
      <div className="relative hidden overflow-hidden bg-grad-deep lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-14 lg:py-16">
        <Tiles className="bg-paper/[0.045]" style={{ '--tile': '220px' } as React.CSSProperties} />
        <OutlineMark className="-right-[18%] -bottom-[22%] h-[90%] w-[80%] bg-teal-soft/25" />
        <div className="relative w-full max-w-[420px] [filter:drop-shadow(0_40px_50px_rgba(0,0,0,0.45))]">
          <Arch className="aspect-[4/5] w-full">
            <img src={image} alt="" className="size-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(8,38,42,.55)_100%)]" />
          </Arch>
          <Sticker className="absolute -bottom-6 -left-7 w-[92px]" />
        </div>
        {quote && (
          <figure className="relative mt-12 max-w-[440px] text-center">
            <blockquote className="font-serif text-[22px] leading-snug text-paper">“{quote.text}”</blockquote>
            <figcaption className="mt-3 text-[12px] tracking-[0.22em] text-gold uppercase">{quote.cite}</figcaption>
          </figure>
        )}
      </div>
    </div>
  )
}
