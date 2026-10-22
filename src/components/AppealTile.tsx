import { Link } from 'react-router-dom'

import { PLACES, giveHref, type Appeal } from './appeals-data'
import { appealView, money } from './appeal-view'
import { ArrowRight } from './icons'

/* ---------------------------------------------------------------------------
   One appeal as a photograph tile, on /appeals (AppealsList) and under a single
   appeal (AppealRelated). The entrance needs a Reveal around it: see
   .reveal-curtain and .reveal-rise in index.css.

   The whole tile opens the appeal (the title's link is stretched over it); the Donate button sits above that link
   and goes straight to /give with the appeal filled in. A big tile (large,
   wide, full) also shows the blurb; a small one keeps to the title and price.
--------------------------------------------------------------------------- */
export default function AppealTile({
  appeal,
  big,
  eager,
}: {
  appeal: Appeal
  big: boolean
  eager: boolean
}) {
  const a = appealView(appeal)
  const meta = `${a.cause} · ${a.where ? `${a.where}, ` : ''}${PLACES[a.country]}`
  const line = (i: number) => ({ ['--i' as string]: i })

  return (
    <article className="group relative isolate h-full overflow-hidden rounded-xl bg-ink sm:rounded-2xl">
      <img
        src={a.src}
        srcSet={a.srcSet}
        sizes={
          big
            ? '(min-width: 1024px) 66vw, 100vw'
            : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'
        }
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className="reveal-zoom absolute inset-0 -z-10 h-full w-full object-cover group-hover:scale-[1.06]"
        style={{ objectPosition: a.position }}
      />
      {/* the fade the words sit on: ink, not a colour wash */}
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/90 via-ink/50 via-45% to-ink/0"
      />
      <span aria-hidden="true" className="reveal-curtain absolute inset-0 z-20 bg-teal" />

      <span
        aria-hidden="true"
        className="absolute top-3 right-3 flex h-9 w-9 translate-y-1 items-center justify-center rounded-full bg-paper/90 text-ink opacity-0 transition-[opacity,transform] duration-300 ease-brand group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
      >
        <ArrowRight className="h-3.5 w-3.5 -rotate-45" />
      </span>

      <div className={`absolute inset-x-0 bottom-0 ${big ? 'p-s3 lg:p-s4' : 'p-s3'}`}>
        <p className="reveal-rise text-[13px] text-text-on-ink-2" style={line(0)}>
          {meta}
          {appeal.zakat && <span className="text-text-on-ink"> · Zakat eligible</span>}
        </p>
        <h3
          className={`reveal-rise mt-1.5 max-w-[24ch] font-display leading-[1.1] font-semibold tracking-[-0.018em] text-balance text-text-on-ink ${
            big ? 'text-[clamp(26px,2.6vw,38px)]' : 'text-[clamp(21px,1.7vw,25px)]'
          }`}
          style={line(1)}
        >
          <Link to={`/appeals/${a.slug}`} className="after:absolute after:inset-0">
            {a.title}
          </Link>
        </h3>
        {big && (
          <p
            className="reveal-rise mt-2 hidden max-w-[48ch] text-[15px] leading-[1.55] text-text-on-ink/85 sm:line-clamp-2"
            style={line(2)}
          >
            {a.blurb}
          </p>
        )}

        <div
          className="reveal-rise mt-s2 flex items-end justify-between gap-s2"
          style={line(big ? 3 : 2)}
        >
          <p className="text-text-on-ink">
            <span className="block text-[12.5px] text-text-on-ink-2">{a.fromLine}</span>
            <span className="nums font-display text-[clamp(26px,2.2vw,32px)] leading-none tracking-[-0.02em]">
              {money(a.from)}
            </span>
          </p>
          <Link
            to={giveHref(a)}
            className="group/give relative z-10 inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-[10px] bg-gold px-4 text-[14.5px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-gold-dark hover:text-ink"
          >
            Donate
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 ease-brand group-hover/give:translate-x-0.5" />
            <span className="sr-only"> to {a.title}</span>
          </Link>
        </div>
      </div>
    </article>
  )
}
