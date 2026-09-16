import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
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

   The heading column beside it stays put while the ledger runs past. Six years
   is a long scroll to spend with nothing in the left half of the screen, and a
   heading that leaves the top of the window takes the reader's place in the
   argument with it.

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
    title: 'Five places, and the sixth year',
    body: 'Gaza, Yemen, Lebanon, Syria and The Gambia, run from a warehouse in Silverwater by a board of three and the people who turn up to pack. Everything that has gone out, with the place and the date against it, is on the accountability page.',
  },
]

/* How far down the window the reading line sits. A little past the middle,
   because a row is read from its year downwards: put the line dead centre and
   the rule stops short of the row your eye is actually on. */
const READING_LINE = 0.58

export default function AboutStory() {
  const listRef = useRef<HTMLOListElement>(null)

  /* One number, written straight onto the list as a custom property, and the
     rule and its head are both sized off it in CSS. It is deliberately not
     React state: this runs on every scroll frame, and re-rendering seven rows
     sixty times a second to move one rule would be a lot of work to do badly.

     Nothing here animates on its own — every value is a function of where the
     page is, so anyone who has asked for less motion loses nothing by it and
     there is nothing to switch off. */
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
    }

    /* Coalesced onto the frame, so a fast scroll measures once per paint
       rather than once per event. */
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

  return (
    <section className="border-t border-line-2 py-s5">
      <div className="gutter mx-auto max-w-page">
        <div className="grid gap-s3 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-s5">
          {/* Stays with the ledger rather than scrolling off the top of it.
              self-start is what lets it: a stretched grid item is already the
              height of the row and has nowhere to travel. */}
          <div className="lg:sticky lg:top-[calc(var(--header-h)+40px)] lg:self-start">
            <p className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.16em] text-green uppercase">
              <span aria-hidden="true" className="h-px w-6 bg-green/40" />
              Our story
            </p>
            <h2 className="mt-s1 max-w-[14ch] font-display text-[clamp(26px,3vw,38px)] leading-snug">
              How it started, with dates
            </h2>
            <p className="mt-s2 max-w-measure text-[15.5px] leading-relaxed text-text-2">
              Six years, written as a ledger rather than as a founder&rsquo;s paragraph. The first
              two lines are on the public register and you can check them there. The rest are dated
              from our own photographs of the distributions themselves.
            </p>
          </div>

          <ol ref={listRef} className="relative [--read:0] lg:pt-s2">
            {/* The rule, its fill, and the head at the end of the fill. The
                whole thing is 1px of line colour with a green one drawn over
                it; the head is the only part wider than a hairline, so the eye
                has something to find without the column acquiring furniture. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-px bg-line"
            >
              <div className="h-[calc(var(--read)*100%)] w-px bg-green" />
              <span className="absolute top-[calc(var(--read)*100%)] left-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-green" />
            </div>

            {ENTRIES.map((entry) => (
              /* Padding rather than margin on the row, so the ledger rule still
                 runs the full width of the column and meets the vertical one at
                 the left. */
              <li
                key={entry.year + entry.title}
                className="border-t border-line py-s3 pl-s3 sm:pl-s4"
              >
                {/* No stagger down the column, unlike the three photographs
                    below. Each row has its own observer and rises as it is
                    reached, so a delay per index would not stagger anything —
                    it would only make every row after the first sit still for
                    a moment after it had already arrived. */}
                <Reveal className="grid gap-x-s3 gap-y-s1 sm:grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)]">
                  <div>
                    <p className="nums font-display text-[clamp(24px,2.4vw,30px)] leading-none tracking-[-0.02em] text-green">
                      {entry.year}
                    </p>
                    {entry.when && (
                      <p className="nums mt-1.5 text-[12.5px] tracking-[0.06em] text-text-3 uppercase">
                        {entry.when}
                      </p>
                    )}
                  </div>

                  <div>
                    <h3 className="font-display text-[19px] leading-snug">{entry.title}</h3>
                    <p className="mt-1 max-w-[62ch] text-[15px] leading-relaxed text-text-2">
                      {entry.body}
                    </p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>

        {/* ---------- where the whole of it is ----------
            The ledger stops at seven rows. The full record does not, and this
            is the line that says so — the section's one way out, kept after
            the photographs came off it. */}
        <div className="mt-s4 border-t border-line pt-s3">
          <p className="max-w-measure text-[14.5px] leading-relaxed text-text-2">
            Every distribution we have made, by place and by date, is on the accountability page
            with what it cost.{' '}
            <Link
              to="/where-it-goes"
              className="group inline-flex items-baseline gap-1 text-green underline decoration-line underline-offset-4 transition-colors duration-200 hover:decoration-green"
            >
              See where it goes
              <ArrowRight className="h-3 w-3 translate-y-px transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
