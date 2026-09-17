import { Link } from 'react-router-dom'

import { fundraiserGiveHref, fundraiserPhoto } from './FundraiserCard'
import { REASONS, type Fundraiser } from './fundraiser-data'
import { PLACES, appealBySlug } from './appeals-data'
import { money } from './appeal-view'
import { ArrowRight } from './icons'
import { daysLeft, percentOf } from '../services/fundraisers'

/* ---------------------------------------------------------------------------
   One community fundraiser as a photograph tile, on /fundraisers.

   AppealTile's pattern (17 September 2026, the user asked for the list to
   look like the appeals page): the photo fills the tile, the words sit on an
   ink fade at the foot, and a teal curtain draws up off the picture on entry
   (.reveal-curtain / .reveal-rise / .reveal-zoom in index.css, which need a
   Reveal around the tile).

   A fundraiser, unlike an appeal, has a goal, so the tile keeps one thin bar
   in pale gold under the raised figure. It is the only bar; no percentage
   pill. The title's link is stretched over the whole tile and Donate sits
   above it.
--------------------------------------------------------------------------- */

export default function FundraiserTile({
  fundraiser: f,
  big,
  eager,
}: {
  fundraiser: Fundraiser
  big: boolean
  eager: boolean
}) {
  const appeal = appealBySlug(f.appeal)
  const photo = fundraiserPhoto(f)
  const pct = percentOf(f)
  const days = daysLeft(f.ends)
  const reason = REASONS.find((r) => r.id === f.reason)?.label
  const meta = [reason, appeal && PLACES[appeal.country]].filter(Boolean).join(' · ')
  const line = (i: number) => ({ ['--i' as string]: i })

  return (
    <article className="group relative isolate h-full overflow-hidden rounded-xl bg-ink sm:rounded-2xl">
      <img
        src={photo.src}
        srcSet={photo.srcSet}
        sizes={
          big
            ? '(min-width: 1024px) 66vw, 100vw'
            : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'
        }
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className="reveal-zoom absolute inset-0 -z-10 h-full w-full object-cover group-hover:scale-[1.06]"
        style={{ objectPosition: photo.position }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/95 via-ink/55 via-50% to-ink/0"
      />
      <span aria-hidden="true" className="reveal-curtain absolute inset-0 z-20 bg-teal" />

      {f.local && (
        <span className="absolute top-3 left-3 rounded-full bg-gold-pale px-3 py-1 text-[12px] font-semibold text-ink">
          Preview
        </span>
      )}
      <span
        aria-hidden="true"
        className="absolute top-3 right-3 flex h-9 w-9 translate-y-1 items-center justify-center rounded-full bg-paper/90 text-ink opacity-0 transition-[opacity,transform] duration-300 ease-brand group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
      >
        <ArrowRight className="h-3.5 w-3.5 -rotate-45" />
      </span>

      <div className={`absolute inset-x-0 bottom-0 ${big ? 'p-s3 lg:p-s4' : 'p-s3'}`}>
        <p className="reveal-rise text-[13px] text-text-on-ink-2" style={line(0)}>
          {meta}
        </p>
        <h3
          className={`reveal-rise mt-1.5 max-w-[26ch] font-display leading-[1.1] font-semibold tracking-[-0.018em] text-balance text-text-on-ink ${
            big ? 'text-[clamp(26px,2.6vw,38px)]' : 'text-[clamp(20px,1.6vw,24px)]'
          }`}
          style={line(1)}
        >
          <Link to={`/fundraisers/${f.slug}`} className="after:absolute after:inset-0">
            {f.title}
          </Link>
        </h3>
        <p className="reveal-rise mt-1 text-[13.5px] text-text-on-ink/75" style={line(2)}>
          by {f.organiser}
          {big && appeal && (
            <>
              {' '}
              for <span className="font-semibold text-text-on-ink">{appeal.title}</span>
            </>
          )}
        </p>

        <div className="reveal-rise mt-s2" style={line(3)}>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={`${pct}% of the goal raised`}
            className="h-1 overflow-hidden rounded-full bg-paper/20"
          >
            <div className="h-full rounded-full bg-gold-pale" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-s2 flex items-end justify-between gap-s2">
            <p className="text-text-on-ink">
              <span className="nums font-display text-[clamp(24px,2vw,30px)] leading-none font-bold tracking-[-0.02em]">
                {money(f.raised)}
              </span>
              <span className="nums block pt-1 text-[12.5px] text-text-on-ink-2">
                of {money(f.goal)} · {days === 0 ? 'ends today' : `${days} days left`}
              </span>
            </p>
            <Link
              to={fundraiserGiveHref(f)}
              className="group/give relative z-10 inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-[10px] bg-gold px-4 text-[14.5px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-gold-dark hover:text-paper"
            >
              Donate
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 ease-brand group-hover/give:translate-x-0.5" />
              <span className="sr-only"> to {f.title}</span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
