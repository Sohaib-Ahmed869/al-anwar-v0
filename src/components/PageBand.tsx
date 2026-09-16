import type { ReactNode } from 'react'

/* ---------------------------------------------------------------------------
   The compact band at the top of a working page — /give and /appeals, where
   the reader has come to do something and a full screen of photograph would
   only stand between them and it.

   A short ink band, pulled up behind the header and marked data-overlay-hero
   so the bar sits transparent over it (the route also has to be in
   OVERLAY_ROUTES in Header.tsx). The green wash and the gold-to-green hairline
   at its foot are every hero's, so it reads as the site rather than as a
   template dropped into it. The title is the page's h1.
--------------------------------------------------------------------------- */

export default function PageBand({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section
      data-overlay-hero=""
      aria-labelledby="page-title"
      className="relative isolate mt-[calc(var(--header-h)*-1)] overflow-hidden bg-ink text-paper"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(90%_140%_at_15%_0%,rgba(47,107,90,0.36)_0%,transparent_62%)]"
      />

      <div className="gutter mx-auto max-w-page pt-[calc(var(--header-h)+clamp(28px,5vh,56px))] pb-[clamp(28px,5vh,52px)]">
        <h1
          id="page-title"
          className="font-display text-[clamp(34px,4.4vw,56px)] leading-[1.04] tracking-[-0.02em]"
          style={{ animation: 'hero-rise 780ms var(--ease-brand) both' }}
        >
          {title}
        </h1>
        {children && (
          <p
            className="mt-s2 max-w-measure text-[clamp(15px,1.3vw,16.5px)] leading-relaxed text-paper/70"
            style={{ animation: 'hero-rise 780ms var(--ease-brand) 90ms both' }}
          >
            {children}
          </p>
        )}
      </div>

      <div
        aria-hidden="true"
        className="h-px bg-[linear-gradient(90deg,transparent,rgba(200,155,44,.5),rgba(47,107,90,.5),transparent)]"
      />
    </section>
  )
}
