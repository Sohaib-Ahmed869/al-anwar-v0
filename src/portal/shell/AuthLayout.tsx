import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/* The frame for every sign-in screen: the form on paper on one side, one of
   the charity's own photographs on the other (hidden on a phone, where the
   form is the whole screen). */
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
            <img src="/assets/images/Al-Anwaar-Logo-600x136.png" alt="Al-Anwaar" className="h-8 w-auto" />
          </Link>
          {tag && <span className="rounded-md bg-green-50 px-2 py-1 text-[11px] font-semibold tracking-wide text-green uppercase">{tag}</span>}
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px] animate-portal-in">{children}</div>
        </div>
        <p className="text-[12px] text-text-3">
          Al-Anwaar Charity Group Ltd · ABN 16 643 085 152 · <Link to="/privacy" className="underline-offset-2 hover:underline">Privacy</Link>
        </p>
      </div>
      <div className="relative hidden overflow-hidden lg:block">
        <img src={image} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,40,44,.15)_0%,rgba(0,40,44,.2)_45%,rgba(10,28,26,.82)_100%)]" />
        {quote && (
          <figure className="absolute inset-x-12 bottom-12 max-w-lg text-white">
            <blockquote className="font-serif text-[26px] leading-snug font-light">“{quote.text}”</blockquote>
            <figcaption className="mt-4 text-[13px] tracking-wide text-white/75">{quote.cite}</figcaption>
          </figure>
        )}
      </div>
    </div>
  )
}
