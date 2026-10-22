import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { ArrowUp, Check, Copy } from '../components/icons'

/* ---------------------------------------------------------------------------
   The body of a legal page: a contents list that sticks to the viewport on a
   wide screen and follows where you are, and the numbered clauses beside it.

   Both legal pages render through here, so a change to how a clause is set is
   made once. A page file supplies the prose and nothing else.

   Three things make a long document navigable, and all three are here:

   1. The contents knows where you are. One pale green surface travels down the
      list to the clause you are reading, the way the pill and the tab travel in
      the header — one element that moves, rather than sixteen that light up.
      A count beside the title says the same thing in figures: 04/16.
   2. Every clause can be linked to. Each one carries an id and a button that
      copies the deep link, because the thing people actually do with a policy
      is send someone else a particular paragraph of it.
   3. A clause tells you which one it is. The number and the rule beside it go
      green while you are inside it, so the contents and the document agree
      without either shouting.

   The clause prose is styled from this file rather than from the content, so
   the pages stay readable as documents — a paragraph in Privacy.tsx is a plain
   <p> with no class on it.

   17 SEPTEMBER 2026, with the hero moved onto the Contact pattern: every
   accent here is the logo teal now rather than the brand green, the clause
   titles are set heavy and tight like the section heads on About and
   Contact, the prose is a touch larger, and the contents card sits on the
   page ground with a hairline rather than on paper-2.

   No gold. Teal is what reacts here; gold is the give action and the focus
   ring and nothing else (DESIGN-NOTES.md). There is no scroll progress bar
   either — the header already draws one across the top of every page.
--------------------------------------------------------------------------- */

export type LegalSection = {
  /** The anchor. Links from elsewhere on the site can land on a clause. */
  id: string
  title: string
  body: ReactNode
}

/** Everything a clause is allowed to contain, set from here. */
const PROSE = [
  'mt-s2 text-[16px] text-text-2',
  '[&>p]:mt-s2 [&>p]:leading-[1.78] [&>p:first-child]:mt-0',
  '[&_strong]:font-semibold [&_strong]:text-text',
  '[&_a]:text-teal [&_a]:underline [&_a]:decoration-teal/30 [&_a]:underline-offset-4',
  '[&_a]:transition-colors [&_a]:duration-200 [&_a:hover]:decoration-teal',
  '[&>ul]:mt-s2 [&>ul]:space-y-s1',
  '[&>ul>li]:relative [&>ul>li]:pl-s3 [&>ul>li]:leading-[1.72]',
  "[&>ul>li]:before:absolute [&>ul>li]:before:left-0 [&>ul>li]:before:top-[0.66em]",
  "[&>ul>li]:before:h-[6px] [&>ul>li]:before:w-[6px] [&>ul>li]:before:rounded-full",
  "[&>ul>li]:before:bg-teal/50 [&>ul>li]:before:content-['']",
  '[&>h3]:mt-s3 [&>h3]:text-[16px] [&>h3]:font-semibold [&>h3]:text-text',
].join(' ')

/** A clause has to clear the sticky header when it is jumped to. */
const ANCHOR = 'scroll-mt-[calc(var(--header-h)+40px)]'

const two = (n: number) => String(n + 1).padStart(2, '0')

/** The soft edge on the contents where it is cut off, and nothing — two stops
 *  in the same place — on an edge where the list actually ends. */
const fade = ({ top, bottom }: { top: boolean; bottom: boolean }) =>
  top || bottom
    ? `linear-gradient(to bottom, transparent, #000 ${top ? '22px' : '0px'}, #000 calc(100% - ${
        bottom ? '22px' : '0px'
      }), transparent)`
    : undefined

const wantsLessMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The line a clause has to cross to count as the one you are reading: just
 *  clear of the sticky header, near the top of what you can actually see. */
const readingLine = () => {
  const header =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 76
  return header + 88
}

export default function LegalBody({ sections }: { sections: LegalSection[] }) {
  /* Which clause you are in. Driven by a scroll handler rather than an
     IntersectionObserver: with a dozen sections the arithmetic is trivial, and
     "the last one whose top has crossed the line" is exactly right at the foot
     of the page, where an observer has nothing intersecting to report. */
  const [active, setActive] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  /** The sliding highlight, measured in pixels inside the contents card. */
  const [marker, setMarker] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  )

  const itemRefs = useRef<(HTMLLIElement | null)[]>([])
  const clauseRefs = useRef<(HTMLElement | null)[]>([])
  const copiedTimer = useRef<number | undefined>(undefined)
  /** The box the list scrolls in when the contents is taller than the window. */
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  /** Whether the list is cut off above or below. A row sliced clean through by
   *  the edge of the card reads as a mistake; one fading out reads as more. */
  const [edges, setEdges] = useState({ top: false, bottom: false })

  const readEdges = useCallback(() => {
    const box = scrollerRef.current
    if (!box) return
    const over = box.scrollHeight - box.clientHeight
    setEdges({ top: box.scrollTop > 4, bottom: over > 4 && box.scrollTop < over - 4 })
  }, [])

  useEffect(() => {
    let ticking = false

    const read = () => {
      ticking = false
      const line = readingLine()

      let now = 0
      clauseRefs.current.forEach((el, i) => {
        if (el && el.getBoundingClientRect().top <= line) now = i
      })
      setActive(now)
      setScrolled(window.scrollY > window.innerHeight * 0.6)
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(read)
    }

    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [sections])

  /** Sixteen clauses is taller than a laptop window, so at lg the list scrolls
   *  inside the card. Nudge the current clause into that window by moving the
   *  card's own scrollTop and nothing else: scrollIntoView would walk up the
   *  ancestors and take the page with it, fighting the scroll that got us here. */
  const keepInView = useCallback((item: HTMLElement) => {
    const box = scrollerRef.current
    if (!box || box.scrollHeight <= box.clientHeight + 1) return

    const pad = 40 /* leave a row of context above and below */
    const outer = box.getBoundingClientRect()
    const inner = item.getBoundingClientRect()
    const below = inner.bottom - (outer.bottom - pad)
    const above = outer.top + pad - inner.top
    const by = below > 0 ? below : above > 0 ? -above : 0
    if (!by) return

    box.scrollTo({ top: box.scrollTop + by, behavior: wantsLessMotion() ? 'auto' : 'smooth' })
  }, [])

  /* The highlight is measured rather than calculated. The items wrap to two
     lines at some widths and not others, and below lg the list is a grid, so
     neither its height nor its column is something we can work out in advance.

     The four numbers come off the item, whose offset parent is the <ol>; the
     marker is positioned against the <div> around it. Those two origins are the
     same point only while nothing sits between them, which is why the list
     carries the padding and its wrapper carries none. */
  useLayoutEffect(() => {
    const box = scrollerRef.current
    if (!box) return

    const measure = () => {
      const item = itemRefs.current[active]
      if (!item) return
      setMarker({
        x: item.offsetLeft,
        y: item.offsetTop,
        w: item.offsetWidth,
        h: item.offsetHeight,
      })
      keepInView(item)
      readEdges()
    }

    measure()
    /* Catches what a window resize does not: the sticky column settling at its
       own width, and the webfonts arriving and re-wrapping a title. */
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    return () => ro.disconnect()
  }, [active, sections, keepInView, readEdges])

  useEffect(() => () => window.clearTimeout(copiedTimer.current), [])

  const goTo = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: wantsLessMotion() ? 'auto' : 'smooth', block: 'start' })
    /* replaceState rather than a router navigation: the scroll is ours, and the
       address bar should still carry a link worth sending to somebody. */
    window.history.replaceState(null, '', `#${id}`)
  }, [])

  const copyLink = useCallback((id: string) => {
    const url = `${window.location.origin}${window.location.pathname}#${id}`
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(id)
        window.clearTimeout(copiedTimer.current)
        copiedTimer.current = window.setTimeout(() => setCopied(null), 1800)
      },
      () => {
        /* Clipboard refused — put the link in the address bar instead, so it can
           still be copied by hand. */
        window.history.replaceState(null, '', `#${id}`)
      },
    )
  }, [])

  return (
    <div className="gutter mx-auto max-w-page py-[clamp(56px,6.5vw,96px)]">
      <div className="grid gap-s4 lg:grid-cols-[minmax(0,3fr)_minmax(0,9fr)] lg:gap-s5">
        {/* ---------- contents ----------
            A card, so the list reads as an instrument beside the document
            rather than a second column of it. Two or three columns on a phone
            so a sixteen-clause document does not push the document itself a
            screen down the page; one column and sticky from lg.

            One highlight slides between the rows, the way the pill slides
            between items in the header. Sixteen rows each lighting their own
            background would be sixteen things moving; this is one. */}
        <nav
          aria-label="On this page"
          className="rounded-2xl border border-line bg-paper p-s2 lg:sticky lg:top-[calc(var(--header-h)+28px)] lg:flex lg:max-h-[calc(100vh-var(--header-h)-56px)] lg:flex-col lg:self-start"
        >
          {/* Title and count on one line. Sixteen rows of 34px stand 544px tall
              before the card is even drawn, so the label is not given a line of
              its own to sit in — and the count earns the space it takes by
              saying how far through the document you are. */}
          <div className="flex shrink-0 items-baseline justify-between gap-s2 px-s1 pb-s1">
            <h2 className="text-[11px] font-bold tracking-[0.13em] text-text-3 uppercase">
              On this page
            </h2>
            {/* The list already says this with aria-current. */}
            <p aria-hidden="true" className="nums text-[11px] font-medium tracking-[0.03em]">
              <span className="text-teal">{two(active)}</span>
              <span className="px-[3px] text-text-3/50">/</span>
              <span className="text-text-3">{two(sections.length - 1)}</span>
            </p>
          </div>

          <div
            ref={scrollerRef}
            onScroll={readEdges}
            /* No scrollbar in the card. index.css gives everything that scrolls
               a 12px lane, which is right for a panel you read and wrong for a
               sixteen-row instrument: it takes a lane out of a narrow column
               and puts a grey bar down the side of the contents. The faded edge
               says there is more, and the list brings the clause you are in
               into view by itself, so there is nothing left for it to do. */
            className="relative border-t border-line-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
            style={{ maskImage: fade(edges), WebkitMaskImage: fade(edges) }}
          >
            {/* The highlight. Measured in four numbers, so it works in one
                column and in three, and it is the only thing that moves.

                A tint and a tick rather than a white chip: a lifted surface with
                a shadow under it reads as a control you could pick up, and this
                is a place marker. The tick is centred rather than run full
                height, so a title that wraps to two lines does not grow it. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0 left-0 rounded-[10px] bg-teal/[0.08] transition-[transform,width,height,opacity] duration-300 ease-brand"
              style={{
                transform: `translate3d(${marker?.x ?? 0}px, ${marker?.y ?? 0}px, 0)`,
                width: marker?.w ?? 0,
                height: marker?.h ?? 0,
                opacity: marker ? 1 : 0,
              }}
            >
              <span className="absolute top-1/2 left-0 h-[17px] w-[3px] -translate-y-1/2 rounded-r-full bg-teal" />
            </span>

            {/* The padding belongs here and not on the wrapper: see the note on
                the measurement above. `relative` keeps the rows painting over
                the marker, which is a positioned sibling. */}
            <ol className="relative grid grid-cols-2 pt-s1 pb-0.5 sm:grid-cols-3 lg:grid-cols-1">
              {sections.map((section, i) => {
                const on = i === active
                return (
                  <li
                    key={section.id}
                    ref={(el) => {
                      itemRefs.current[i] = el
                    }}
                  >
                    {/* 20px for the figures and 13.5/20 for the title: two digits
                        of tabular 11.5px measure 15px, and both boxes are 20px
                        tall, so the numbers rule up in a column and sit on the
                        titles' first line whether it wraps or not. */}
                    <a
                      href={`#${section.id}`}
                      onClick={(e) => {
                        e.preventDefault()
                        goTo(section.id)
                      }}
                      aria-current={on ? 'true' : undefined}
                      className={`group grid h-full grid-cols-[20px_minmax(0,1fr)] items-start gap-s1 rounded-[10px] px-s1 py-[7px] text-[13.5px] leading-[20px] transition-colors duration-200 ${
                        on ? 'font-medium text-teal' : 'text-text-2 hover:bg-line-2/70 hover:text-text'
                      }`}
                    >
                      <span
                        className={`nums text-[11.5px] leading-[20px] font-medium tracking-[0.03em] transition-colors duration-200 ${
                          on ? 'text-teal' : 'text-text-3 group-hover:text-text-2'
                        }`}
                      >
                        {two(i)}
                      </span>
                      <span>{section.title}</span>
                    </a>
                  </li>
                )
              })}
            </ol>
          </div>

          {/* Only once there is something to come back from. */}
          {scrolled && (
            <div className="mt-s1 shrink-0 border-t border-line-2 pt-s1">
              <button
                type="button"
                onClick={() =>
                  window.scrollTo({ top: 0, behavior: wantsLessMotion() ? 'auto' : 'smooth' })
                }
                className="group flex items-center gap-1.5 rounded-[10px] px-s1 py-1.5 text-[12.5px] text-text-2 transition-colors duration-200 hover:text-teal"
              >
                <ArrowUp className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:-translate-y-0.5" />
                Back to top
              </button>
            </div>
          )}
        </nav>

        {/* ---------- the document ---------- */}
        <div className="max-w-[760px]">
          {sections.map((section, i) => {
            const on = i === active
            return (
              <section
                key={section.id}
                id={section.id}
                ref={(el) => {
                  clauseRefs.current[i] = el
                }}
                className={`${ANCHOR} group mt-s5 border-t border-line-2 pt-s4 first:mt-0 first:border-0 first:pt-0`}
              >
                {/* The number and its rule, set the way the hero sets its
                    eyebrow. Both go green while you are inside the clause, and
                    the rule grows — so the contents and the document are saying
                    the same thing in the same colour. */}
                <div className="flex items-center gap-s1">
                  <span
                    className={`nums text-[12px] font-bold tracking-[0.14em] transition-colors duration-300 ${
                      on ? 'text-teal' : 'text-text-3'
                    }`}
                  >
                    {two(i)}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`h-px transition-all duration-300 ease-brand ${
                      on ? 'w-10 bg-teal' : 'w-5 bg-line'
                    }`}
                  />
                </div>

                <div className="mt-s1 flex items-start gap-s2">
                  <h2 className="flex-1 font-display text-[clamp(23px,2.2vw,30px)] leading-[1.15] tracking-[-0.025em] text-text">
                    {section.title}
                  </h2>

                  {/* What people actually do with a policy is send somebody one
                      paragraph of it. Visible on a touch screen, where there is
                      no hover to reveal it. */}
                  <button
                    type="button"
                    onClick={() => copyLink(section.id)}
                    aria-label={`Copy a link to "${section.title}"`}
                    className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-text-3 opacity-70 transition duration-200 ease-brand hover:border-teal/40 hover:bg-teal/[0.08] hover:text-teal focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                  >
                    {copied === section.id ? (
                      <Check className="h-3.5 w-3.5 text-teal" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                <div className={PROSE}>{section.body}</div>

                {/* Said out loud for a screen reader the moment it changes, and
                    nowhere on the page. */}
                <span aria-live="polite" className="sr-only">
                  {copied === section.id ? 'Link copied' : ''}
                </span>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
