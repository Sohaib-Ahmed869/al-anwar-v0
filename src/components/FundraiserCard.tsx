import { Link } from 'react-router-dom'

import { REASONS, type Fundraiser } from './fundraiser-data'
import { PLACES, appealBySlug } from './appeals-data'
import { appealView, money } from './appeal-view'
import { ArrowRight } from './icons'
import { daysLeft, percentOf } from '../services/fundraisers'

/* ---------------------------------------------------------------------------
   One community fundraiser as a card: on /fundraisers, under a single
   fundraiser, and in the Get involved page's #fundraise section.

   Photo on top (the organiser's own, or the appeal's band), then the
   reason, the title, who started it, and the appeal it raises for, which is
   the line that makes it genuine. A thin teal bar and the raised figure sit
   at the foot. The whole card opens the fundraiser; Donate goes straight to
   /give with the fundraiser on the link.
--------------------------------------------------------------------------- */

/** The photo a fundraiser shows: its own, or its appeal's. */
export function fundraiserPhoto(f: Fundraiser) {
  const appeal = appealBySlug(f.appeal)
  const a = appeal ? appealView(appeal) : null
  return {
    src: f.photo ?? a?.src ?? '/assets/images/hero-meal-1200.jpg',
    srcSet: f.photo ? undefined : a?.srcSet,
    position: f.photo ? '50% 50%' : (a?.position ?? '50% 50%'),
  }
}

export const fundraiserGiveHref = (f: Fundraiser, amount?: number) =>
  `/give?fundraiser=${f.slug}${amount ? `&amount=${amount}` : ''}`

export default function FundraiserCard({ fundraiser: f }: { fundraiser: Fundraiser }) {
  const appeal = appealBySlug(f.appeal)
  const photo = fundraiserPhoto(f)
  const pct = percentOf(f)
  const days = daysLeft(f.ends)
  const reason = REASONS.find((o) => o.id === f.reason)?.label

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper transition-[border-color,transform,box-shadow] duration-300 ease-brand hover:-translate-y-1 hover:border-teal/40 hover:shadow-card">
      <div className="relative aspect-[16/10] overflow-hidden bg-ink">
        <img
          src={photo.src}
          srcSet={photo.srcSet}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-700 ease-brand group-hover:scale-[1.05]"
          style={{ objectPosition: photo.position }}
        />
        {reason && (
          <span className="absolute top-3 left-3 rounded-full bg-paper/95 px-3 py-1 text-[12px] font-semibold text-ink">
            {reason}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-s3">
        <h3 className="font-display text-[clamp(19px,1.5vw,21px)] leading-snug font-semibold tracking-[-0.016em] text-balance">
          <Link to={`/fundraisers/${f.slug}`} className="after:absolute after:inset-0">
            {f.title}
          </Link>
        </h3>
        <p className="mt-1 text-[14px] text-text-3">by {f.organiser}</p>
        {appeal && (
          <p className="mt-s2 text-[14px] leading-snug text-text-2">
            For <span className="font-semibold text-teal">{appeal.title}</span>
            <span className="text-text-3">, {PLACES[appeal.country]}</span>
          </p>
        )}

        <div className="mt-auto pt-s3">
          <div className="flex items-end justify-between gap-s2">
            <p>
              <span className="nums font-display text-[22px] leading-none font-bold tracking-[-0.02em]">
                {money(f.raised)}
              </span>
              <span className="text-[13.5px] text-text-3"> of {money(f.goal)}</span>
            </p>
            <span className="nums text-[13px] font-semibold text-teal">{pct}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={`${pct}% of the goal raised`}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-2"
          >
            <div className="h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-s2 flex items-center justify-between gap-s2">
            <p className="nums text-[13px] text-text-3">
              {f.supporters} {f.supporters === 1 ? 'supporter' : 'supporters'} ·{' '}
              {days === 0 ? 'Ends today' : `${days} days left`}
            </p>
            <Link
              to={fundraiserGiveHref(f)}
              className="group/give relative z-10 inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-[10px] bg-gold px-4 text-[14px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-gold-dark hover:text-paper"
            >
              Donate
              <ArrowRight className="h-3 w-3 transition-transform duration-200 ease-brand group-hover/give:translate-x-0.5" />
              <span className="sr-only"> to {f.title}</span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
