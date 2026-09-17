import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

import { ArrowRight } from './icons'
import { MasjidMark } from './Ornament'
import { DIARY_HEAD, askAbout, dateParts, dayOf, longDate, placeOf, type CharityEvent } from './event-data'

/* ---------------------------------------------------------------------------
   The two ways an event is drawn, shared by /events and the home page band so
   the diary looks the same wherever it turns up.

     EventFeature   the next event: photograph with a date plate on it, the
                    name, one or two sentences, when, where and what it costs,
                    and one teal button
     EventRow       everything after it: a date block, the name, the time and
                    place, as one ruled row that is itself the link

   No gold on either: nothing here takes money. The photographs are stock (see
   event-data.ts), so nothing over them names the picture.
--------------------------------------------------------------------------- */

/** A ticket page leaves the site; the contact form does not. */
function Go({ to, className, children }: { to: string; className: string; children: ReactNode }) {
  return to.startsWith('http') ? (
    <a href={to} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <Link to={to} className={className}>
      {children}
    </Link>
  )
}

export function DatePlate({ event, className = '' }: { event: CharityEvent; className?: string }) {
  const { weekday, day, month } = dateParts(event)
  return (
    <span
      aria-hidden="true"
      className={`flex w-[68px] shrink-0 flex-col items-center rounded-xl bg-paper py-2 text-center shadow-[0_8px_24px_-12px_rgba(0,0,0,0.35)] ${className}`}
    >
      <span className="text-[11px] font-semibold tracking-[0.12em] text-text-3 uppercase">{weekday}</span>
      <span className="nums font-display text-[30px] leading-[1.05] font-bold tracking-[-0.03em] text-teal">
        {day}
      </span>
      <span className="text-[12px] font-semibold tracking-[0.08em] text-text uppercase">{month}</span>
    </span>
  )
}

export function EventFeature({ event, label }: { event: CharityEvent; label?: string }) {
  const facts = [
    { term: 'When', detail: `${longDate(event)}, ${event.time}` },
    { term: 'Where', detail: placeOf(event) },
    { term: 'Cost', detail: event.cost },
  ]

  return (
    <article className="grid overflow-hidden rounded-2xl border border-line bg-paper lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="relative isolate aspect-[16/10] overflow-hidden bg-teal lg:aspect-auto lg:min-h-[440px]">
        {event.photo ? (
          <img
            src={`/assets/images/${event.photo}-1600.jpg`}
            srcSet={`/assets/images/${event.photo}-800.jpg 800w, /assets/images/${event.photo}-1600.jpg 1600w`}
            sizes="(min-width: 1024px) 58vw, 100vw"
            alt={event.alt ?? ''}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: event.position }}
          />
        ) : (
          /* no photograph: the date itself, large on teal */
          <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-end p-s3 text-paper sm:p-s4 lg:p-[clamp(32px,3vw,48px)]">
            <MasjidMark className="pointer-events-none absolute -right-[6%] -bottom-[14%] -z-10 size-[clamp(220px,30vw,420px)] text-paper/[0.07]" />
            <span className="font-script text-[clamp(22px,2vw,30px)] leading-none text-gold-pale">
              {dateParts(event).weekday}
            </span>
            <span className="nums mt-1 font-display text-[clamp(88px,11vw,168px)] leading-[0.85] font-bold tracking-[-0.05em]">
              {dateParts(event).day}
            </span>
            <span className="mt-s2 text-[clamp(15px,1.3vw,19px)] font-semibold tracking-[0.14em] text-paper/80 uppercase">
              {dayOf(event).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
            </span>
          </div>
        )}
        {event.photo && <DatePlate event={event} className="absolute top-s2 left-s2 sm:top-s3 sm:left-s3" />}
      </div>

      <div className="flex flex-col p-s3 sm:p-s4 lg:p-[clamp(32px,3vw,48px)]">
        {label && <p className="font-script text-[clamp(19px,1.6vw,23px)] leading-none text-green">{label}</p>}
        <p className={`${label ? 'mt-s2' : ''} text-[12px] font-semibold tracking-[0.12em] text-text-3 uppercase`}>
          {event.kind}
        </p>
        <h3 className="mt-2 font-display text-[clamp(26px,2.6vw,38px)] leading-[1.08] font-semibold tracking-[-0.022em] text-balance">
          {event.name}
        </h3>
        <p className="mt-s2 max-w-[48ch] text-[15.5px] leading-[1.55] text-text-2">{event.blurb}</p>

        <dl className="mt-s3 border-t border-line">
          {facts.map((f) => (
            <div key={f.term} className="grid grid-cols-[64px_1fr] gap-s2 border-b border-line py-3 text-[14.5px]">
              <dt className="text-text-3">{f.term}</dt>
              <dd className="font-medium text-text">{f.detail}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-auto pt-s3">
          <Go
            to={askAbout(event)}
            className="group inline-flex min-h-[50px] items-center gap-2.5 rounded-[12px] bg-teal px-6 text-[15.5px] font-semibold text-paper transition-[background-color,transform] duration-200 ease-brand hover:-translate-y-px hover:bg-ink"
          >
            {event.tickets ? DIARY_HEAD.tickets : DIARY_HEAD.ask}
            <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
            <span className="sr-only">: {event.name}</span>
          </Go>
        </div>
      </div>
    </article>
  )
}

export function EventRow({ event }: { event: CharityEvent }) {
  return (
    <Go
      to={askAbout(event)}
      className="group flex items-center gap-s2 border-t border-line py-s2 sm:gap-s3 sm:py-[22px]"
    >
      <DatePlate event={event} className="shadow-none ring-1 ring-line transition-[box-shadow] duration-200 ease-brand group-hover:ring-teal/50" />

      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] font-semibold tracking-[0.12em] text-text-3 uppercase">{event.kind}</span>
        <span className="mt-1 block font-display text-[clamp(19px,1.7vw,24px)] leading-[1.15] font-semibold tracking-[-0.018em] text-text transition-colors duration-200 ease-brand group-hover:text-teal">
          {event.name}
        </span>
        <span className="mt-1 block text-[14px] text-text-2">
          {event.time}
          <span aria-hidden="true" className="mx-2 text-line">
            |
          </span>
          {placeOf(event)}
        </span>
      </span>

      <span className="hidden max-w-[16ch] text-right text-[14px] font-medium text-text md:block">{event.cost}</span>

      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line text-text transition-[border-color,background-color,color] duration-300 ease-brand group-hover:border-teal group-hover:bg-teal group-hover:text-paper"
      >
        <ArrowRight className="h-3 w-3" />
      </span>
      <span className="sr-only">
        {longDate(event)}. {DIARY_HEAD.ask}
      </span>
    </Go>
  )
}
