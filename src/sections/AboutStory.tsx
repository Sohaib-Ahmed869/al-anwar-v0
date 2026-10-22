import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { ArrowRight } from '../components/icons'

/* ---------------------------------------------------------------------------
   About, section 3 of 5: how it started.

   A charity's story page is usually a paragraph about a founder having an idea.
   This one is a ledger, because everything in it can be checked: the first two
   entries are on the ACNC register, and the rest are dated off our own
   photographs of the distributions. That is the same standard the appeal pages
   hold their proof to — a photograph is only proof if it says where and when.

   Those three photographs used to be printed underneath as the evidence for the
   rows, and were taken off at the client's request. The dating claim above is
   what is left of them, so it now rests on files nobody outside the office can
   see. If the ledger is ever questioned, this is the section that has to put
   them back or drop the claim.

   It is still not a decorated timeline, and there are still no dots down the
   side: a dot per row is a picture of a sequence the dates already state, and
   it would say nothing the margin does not. What runs down the left instead is
   a single rule that fills as you read, whose head sits level with the year you
   have reached. That is not decoration — it is the one thing the page knows and
   the reader does not, which is how far through six years they are. Everything
   it draws is a function of the scroll position, so it can only ever tell the
   truth about where you are.

   17 September 2026, second pass: from lg up the ledger has a very large year
   held beside it that turns over as each row reaches the reading line
   (outlined, like the hero ribbon; solid teal at "Now"), and the row being
   read is at full strength while the others rest back. Rows are title over
   body rather than three narrow columns.

   17 September 2026: moved onto the home page's pattern. The sticky heading
   column is gone for the shared SectionHead (its action is the link out to
   the full record, which used to be a paragraph at the foot), and the rows
   are a three-column ledger from lg up. It is #story, which the hero's
   "Read our story" link lands on.

   TODO before launch, two:
     - the dates on rows three to seven come off the image files and off the
       old site's campaign pages, not off the field team's log. Every one of
       them needs confirming, and the places need confirming with them — the
       2024 camp distribution in particular is captioned by what is visibly in
       the frame, because nothing on the file says which border it was taken on.
     - GAZA HAS NO ROW HERE YET, and it should have one. It is in the "Now"
       entry and in every country list on the site, but the ledger only carries
       rows we can date off a photograph, and there is no Gaza photograph in
       public/assets/. Give me the month the first Gaza distribution went out
       and one frame from it, and it drops in between 2023 and 2024.
     - the register lists our operating countries as Australia, Bangladesh and
       Yemen. The site says Gaza, Yemen, Lebanon, Syria and The Gambia. One of
       the two is out of date and it is almost certainly the register: the ACNC
       Annual Information Statement is where that gets corrected.
--------------------------------------------------------------------------- */

type Entry = {
  /** Set large in the margin. Tabular, so the column lines up. */
  year: string
  /** The month or season, where we have one. */
  when?: string
  title: string
  body: string
}

const ENTRIES: Entry[] = [
  {
    year: '2020',
    when: '30 July',
    title: 'Registered on the day it was formed',
    body: 'Al-Anwaar Charity Group Ltd was incorporated and registered with the ACNC on the same date, as a public benevolent institution advancing health and social welfare. Not a group that ran for years and formalised later: the obligations came first.',
  },
  {
    year: '2021',
    when: 'December',
    title: 'The first distribution, in Hadhramaut',
    body: 'Food baskets and meat, packed and handed over in Tarim. It is the earliest distribution we hold a photograph of, and it set the pattern everything since has followed: buy in the country, deliver through a partner who lives there, photograph the handover.',
  },
  {
    year: '2022',
    when: 'Ramadan',
    title: 'The Yemen appeal, and a partner with a name',
    body: 'Food packages across Yemen with Alaf Foundation for Development, whose banner we photograph rather than crop out, because we do not deliver anonymously. Water followed the same year: tanker distributions, then the standing water stations that meant the tanker did not have to come back as often.',
  },
  {
    year: '2022',
    when: 'July',
    title: 'The Gambia, and the first thing built to outlast us',
    body: 'A masjid, and a Quran school beside it, the first sadaqah jariyah we took on, and the point at which the work stopped being only relief. A pack feeds a family for a month. A building is still there in thirty years.',
  },
  {
    year: '2023',
    /* TO CONFIRM: no photograph or log dates this row. April is a placeholder
       chosen because the Eid clothes point to Eid al-Fitr 2023 (late April). */
    when: 'April',
    title: 'Lebanon',
    body: 'Food packs, clean water, Eid clothes for children, and the first monthly subscriptions, from donors who wanted to be a standing line in a budget rather than a spike at Ramadan. Monthly giving is what lets a partner sign a lease or hire a driver.',
  },
  {
    year: '2024',
    when: 'March',
    title: 'Hot meals at the camps',
    body: 'Cooked food handed out from the back of a truck at a displacement camp, in the days before Ramadan. Different work from a food pack and harder to do well: it has to be eaten the day it is made, so it only happens where somebody is standing there.',
  },
  {
    year: 'Now',
    title: 'Five places, six years on',
    body: 'Gaza, Yemen, Lebanon, Syria and The Gambia, run from a warehouse in Silverwater by a board of three and the people who turn up to pack. Everything that has gone out, with the place and the date against it, is on the accountability page.',
  },
]

/* How far down the window the reading line sits. A little past the middle,
   because a row is read from its year downwards: put the line dead centre and
   the rule stops short of the row your eye is actually on. */
const READING_LINE = 0.58

export default function AboutStory() {
  const listRef = useRef<HTMLOListElement>(null)

  /* The row the reading line is on. State, but it only changes seven times in
     the whole scroll, and React skips the render when it has not changed. */
  const [active, setActive] = useState(0)

  /* The fill is one number written straight onto the list as a custom
     property, and the rule and its head are both sized off it in CSS, so the
     per-frame work never goes through React. Every value is a function of where
     the page is, so there is nothing to switch off under reduced motion. */
  useEffect(() => {
    const list = listRef.current
    if (!list) return

    let frame = 0

    const measure = () => {
      frame = 0
      const box = list.getBoundingClientRect()
      if (!box.height) return

      const line = window.innerHeight * READING_LINE
      const progress = Math.min(1, Math.max(0, (line - box.top) / box.height))
      list.style.setProperty('--read', String(progress))

      let current = 0
      list.querySelectorAll<HTMLElement>(':scope > li').forEach((row, i) => {
        if (row.getBoundingClientRect().top <= line) current = i
      })
      setActive(current)
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  const now = ENTRIES[active]

  return (
    <section
      id="story"
      aria-labelledby="story-head"
      className={`scroll-mt-[calc(var(--header-h)+24px)] ${SECTION_Y}`}
    >
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="story-head"
          eyebrow="Our story"
          title="How it started."
          lede="The first line is on the public register. The rest are dated from our own photographs of the distributions."
          action={
            <Link
              to="/where-it-goes"
              className="group flex shrink-0 items-center gap-1.5 text-[14.5px] font-semibold text-green transition-colors duration-200 ease-brand hover:text-ink"
            >
              Every distribution, logged
              <ArrowRight className="h-3 w-3 -translate-x-0.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
            </Link>
          }
        />

        <div
          className={`mt-s4 grid lg:mt-s5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-s5 ${BREAKOUT}`}
        >
          {/* ---------- the year you are on ----------
              From lg up only. Held beside the ledger as it scrolls, very large,
              turning over as each row reaches the reading line. Outlined when
              it is a year and solid teal at "Now", the ribbon's two styles. */}
          <div aria-hidden="true" className="hidden lg:block">
            {/* Starts level with the first row, in the flow of the column, and only
                sticks once it reaches the middle of the window below the header.
                The top offset is half the space under the header less half the
                block's own height (0.9 x the year's size, plus the month), less its top padding. */}
            <div className="sticky top-[calc((100svh+var(--header-h))/2-(0.9*clamp(110px,11vw,176px)+46px)/2-var(--spacing-s4))] lg:pt-s4">
              <div className="-mb-[0.1em] overflow-hidden pb-[0.1em]">
                <p
                  key={active}
                  className={`nums font-display text-[clamp(110px,11vw,176px)] leading-[0.9] font-semibold tracking-[-0.05em] ${
                    now.year === 'Now'
                      ? 'text-teal'
                      : 'text-transparent [-webkit-text-stroke:2px_var(--color-teal)]'
                  }`}
                  style={{ animation: 'word-rise 700ms var(--ease-reveal) both' }}
                >
                  {now.year}
                </p>
              </div>
              <p className="mt-s2 font-script text-[clamp(24px,2vw,30px)] leading-none text-green">
                {now.when ?? ' '}
              </p>
            </div>
          </div>

          <ol ref={listRef} className="relative [--read:0]">
            {/* The rule, its fill, and the head at the end of the fill. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-px bg-line"
            >
              <div className="h-[calc(var(--read)*100%)] w-px bg-green" />
              <span className="absolute top-[calc(var(--read)*100%)] left-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-green" />
            </div>

            {ENTRIES.map((entry, i) => (
              <li
                key={entry.year + entry.title}
                className={`py-s3 pl-s3 transition-opacity duration-500 ease-brand sm:pl-s4 lg:py-s4 ${
                  i === active ? 'lg:opacity-100' : 'lg:opacity-40'
                }`}
              >
                <Reveal variant="soft">
                  {/* The year on the row itself below lg, where there is no
                      column beside it; from lg up the big year carries it and
                      this is kept small. */}
                  <p className="nums flex items-baseline gap-s1 font-display text-[clamp(22px,2vw,26px)] leading-none tracking-[-0.02em] text-teal lg:text-[15px] lg:tracking-normal">
                    {entry.year}
                    {entry.when && (
                      <span className="font-script text-[18px] font-normal tracking-normal text-text-3 lg:text-[17px]">
                        {entry.when}
                      </span>
                    )}
                  </p>
                  <h3 className="mt-s1 font-display text-[clamp(21px,2vw,28px)] leading-[1.15] tracking-[-0.02em] text-balance">
                    {entry.title}
                  </h3>
                  <p className="mt-s2 max-w-[60ch] text-[clamp(15px,1.15vw,16.5px)] leading-[1.65] text-text-2">
                    {entry.body}
                  </p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
