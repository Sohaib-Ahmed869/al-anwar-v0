import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { ArrowRight } from '../components/icons'

/* ---------------------------------------------------------------------------
   Step 3 of the home argument: what the money turns into.

   The band above is a gold button on sand. The next thought after seeing it is
   "and what does that actually become?" — so this answers it in things rather
   than in dollars: six photographs of work that was done, and a line each.
   Nothing else — it carried a sentence of accounting at the foot ("ninety-four
   cents in every dollar left the country, nobody here draws a wage") and that
   has gone with the rest of the figures. The accounts are on the
   accountability page, where the header and the footer both already point.

   A GRID, NOT A RAIL (16 September 2026, at the user's request)
   This was the page's second drifting rail, and it had three faults: the rail
   cut a card at each edge ("…od packs", "A DISPLACEMENT CA…"), it repeated the
   appeals rail two bands up, and it stretched 600–880px photographs to 420px
   cards where they went soft. It is now a bento grid on the pattern of
   Al-Ihsan's "Your Support Can Change Lives" — every piece of work on screen at
   once, the picture carrying the tile and the words laid over it — without
   their saturated colour washes, which would fight the page's single ground.
   The page now has one rail, the appeals, and that is the right number.

   THE TILE SIZES FOLLOW THE PIXELS, NOT THE STORY
   Two large tiles and four small ones, on a diagonal. The large ones go to the
   two frames that can survive being large: the Gambia masjid (2012px, the only
   wide original) and the Yemen food pack (878px). The squares at 607 and 810px
   sit in single cells, where they stay sharp. If a better frame arrives, give
   it a large `area` and nothing else has to change.

   The one-line `does` is always shown on the two large tiles, and appears on
   hover or keyboard focus on the small ones — a 300px cell has no room for it
   without covering the picture. On a phone the small tiles keep their place
   and title only.

   THE PHOTOGRAPHS ARE ALL AL-ANWAAR'S OWN
   Two of them had the old site's titles burnt into the bottom of the frame,
   which is why they had gone unused. They are cropped to 3:2 off the top of
   the original square — the titles began at 72% and 83.5% of the height, so a
   crop to 66.6% clears both — and saved beside the originals as
   food-pack-yemen.webp and water-station.webp. The originals are untouched.

   Three of the six also appear above: the masjid and the hot meals in the
   appeals rail, the store of baskets in the give card. That is deliberate
   rather than careless — there are eight field photographs in the repository
   in total, and the alternative to reusing three of them is a grid of three.
   The framing differs each time: up there they are appeals asking for money,
   here they are a record of what the money already did. When the field team
   sends more frames, prefer new ones and let these go back to appearing once.

   WHERE THE WORDS COME FROM
   Food packs and their contents, and the pack feeding a family for a month:
   already the site's own figure, in HomeAsk and HomeAppeals, and the work is
   filed in the 2024 Annual Information Statement ("food packs and family food
   parcels to households in Lebanon and Yemen"). The water stations, the
   masjid, the Tarim distribution and the camp meals are all dated on the About
   page's ledger, off these same photographs — see AboutStory.tsx, which is
   where those dates were established. Qurban and medical aid are filed in the
   same statement but have no photograph, so they are not tiles.

   NO COUNTS, EVER
   There is no filed number of packs, wells or meals — the programs table of
   the AIS is empty for this charity in every year, because a small charity is
   not required to complete it. Dividing dollars by a unit cost to get "2,989
   packs" would be the one invented thing on a page whose argument is that
   nothing on it is invented. Impact here is what the thing DOES, which is
   true, not how many there were, which nobody has counted. That is also why
   these tiles have no progress bar, which is what gives Al-Ihsan's their punch.

   TODO: no tile names a town or a date that is not on the frame or already on
   the About ledger. When the field log arrives, each one can carry the month
   it was last done.
--------------------------------------------------------------------------- */

type Area = 'm' | 'f' | 'w' | 'h' | 't' | 'r'

type Work = {
  /** the file under /assets/images, and what is actually visible in it */
  image: string
  alt: string
  /** where, and nowhere it hasn't been done */
  place: string
  title: string
  /** what the thing does — the impact, without a number nobody counted */
  does: string
  /** the cause filter this belongs to, as the hero already routes them */
  to: string
  /** its cell in the grid — see GRID below */
  area: Area
  /** where to hold the crop, when the middle of the frame is not the subject */
  position?: string
}

const WORK: Work[] = [
  {
    image: '/assets/images/PHOTO-2022-07-29-10-21-12.webp',
    alt: 'A masjid under construction, with Al-Anwaar’s banner hung on the wall',
    place: 'The Gambia',
    title: 'A masjid, and a school beside it',
    does: 'The first thing we built to outlast us.',
    to: '/appeals?cause=jariyah',
    area: 'm',
  },
  {
    image: '/assets/images/water-station.webp',
    alt: 'Jerry cans being filled from a standing tap',
    place: 'Yemen',
    title: 'Water stations',
    does: 'A tap that stays, so the tanker does not have to keep coming back.',
    to: '/appeals?cause=water',
    area: 'w',
  },
  {
    image: '/assets/images/WhatsApp-Image-2024-03-01-at-10.21.59-AM.jpeg',
    alt: 'Cooked meals handed down from the back of a van to families at a camp',
    place: 'A displacement camp',
    title: 'Hot meals',
    does: 'Cooked and given out the same day. It only happens where somebody is standing there.',
    to: '/appeals?cause=food',
    area: 'h',
  },
  {
    image: '/assets/images/food-pack-yemen.webp',
    alt: 'A food pack laid out: basmati rice, flour, sugar, cooking oil and tinned goods',
    place: 'Yemen',
    title: 'Food packs',
    does: 'Flour, rice, oil, lentils and dates: a month of meals for one family.',
    to: '/appeals?cause=food',
    area: 'f',
  },
  {
    image: '/assets/images/PHOTO-2022-05-01-00-52-12.webp',
    alt: 'Families filling jerry cans and buckets from a water tank',
    place: 'Yemen',
    title: 'Water by the tanker',
    does: 'Before there is a station there is a truck, and everyone brings what they can carry.',
    to: '/appeals?cause=water',
    area: 't',
  },
  {
    image: '/assets/images/PHOTO-2021-12-23-22-48-18.webp',
    alt: 'Rows of prepared food baskets waiting in a distribution store',
    place: 'Tarim, Hadhramaut',
    title: 'The first distribution',
    does: 'December 2021. Baskets and meat, and the earliest handover we hold a photograph of.',
    to: '/appeals?cause=food',
    area: 'r',
  },
]

/* The layout, as named areas so it reads at a glance:

     phone        desktop
     m m          m m w h
     m m          m m f f
     w h          t r f f
     f f
     t r

   Written out in full rather than built from parts, so Tailwind can find the
   classes when it scans this file. */
const GRID = [
  "grid grid-cols-2 auto-rows-[42vw] gap-s1 [grid-template-areas:'m_m'_'m_m'_'w_h'_'f_f'_'t_r']",
  'sm:auto-rows-[220px] sm:gap-s2',
  "lg:grid-cols-4 lg:auto-rows-[clamp(210px,17vw,290px)] lg:[grid-template-areas:'m_m_w_h'_'m_m_f_f'_'t_r_f_f']",
].join(' ')

const AREA: Record<Area, string> = {
  m: '[grid-area:m]',
  f: '[grid-area:f]',
  w: '[grid-area:w]',
  h: '[grid-area:h]',
  t: '[grid-area:t]',
  r: '[grid-area:r]',
}

const LARGE: Area[] = ['m', 'f']

export default function HomeImpact() {
  return (
    <section
      id="impact"
      aria-labelledby="impact-head"
      /* No ground of its own — the page has one. See components/Divider.tsx. */
      className={SECTION_Y}
    >
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="impact-head"
          eyebrow="Your donation at work"
          title="The result of your support."
          action={
            <Link
              to="/where-it-goes"
              className="group flex shrink-0 items-center gap-1.5 text-[14.5px] font-semibold text-green transition-colors duration-200 ease-brand hover:text-ink"
            >
              Where it goes
              <ArrowRight className="h-3 w-3 -translate-x-0.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
            </Link>
          }
        />

        {/* The grid breaks out of the column by exactly as much as the give
            card above it does (HomeAsk.tsx), so the two image bands share left
            and right edges. The heading goes out with it, as the appeals and
            zakat headings do. Keep every copy of the expression identical. */}
        <ul
          aria-label="What Al-Anwaar has delivered"
          className={`mt-s4 lg:mt-s5 ${BREAKOUT} ${GRID}`}
        >
          {WORK.map((work, i) => {
            const large = LARGE.includes(work.area)
            return (
              <li key={work.image} className={AREA[work.area]}>
                {/* Each tile unmasks upward and its photograph settles back
                    from close (reveal-zoom), one after the next. */}
                <Reveal variant="clip" delay={i * 90} className="h-full">
                  {/* rounded-2xl from sm, as the appeals banner and the give card
                      are; a step smaller on the phone's narrower tiles. */}
                  <Link
                    to={work.to}
                    className="group relative block h-full overflow-hidden rounded-xl bg-sand sm:rounded-2xl"
                  >
                    <img
                      src={work.image}
                      alt={work.alt}
                      loading="lazy"
                      decoding="async"
                      style={work.position ? { objectPosition: work.position } : undefined}
                      className="reveal-zoom absolute inset-0 h-full w-full object-cover group-hover:scale-[1.04]"
                    />

                    {/* The fade the words sit on. Ink, not a colour wash. */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 via-45% to-transparent"
                    />

                    <span
                      aria-hidden="true"
                      className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-paper/90 text-ink opacity-0 transition-opacity duration-300 ease-brand group-hover:opacity-100 group-focus-visible:opacity-100"
                    >
                      <ArrowRight className="h-3.5 w-3.5 -rotate-45" />
                    </span>

                    <span
                      className={`absolute inset-x-0 bottom-0 block ${large ? 'p-s2 sm:p-s3 lg:p-s4' : 'p-s2 lg:p-s3'}`}
                    >
                      <span className="block text-[10px] font-semibold tracking-[0.16em] text-text-on-ink-2 uppercase sm:text-[11px]">
                        {work.place}
                      </span>
                      <span
                        className={`mt-1 block font-display leading-[1.1] tracking-[-0.018em] text-balance text-text-on-ink ${
                          large ? 'text-[clamp(22px,2.4vw,34px)]' : 'text-[clamp(16px,1.5vw,22px)]'
                        }`}
                      >
                        {work.title}
                      </span>
                      <span
                        className={
                          large
                            ? 'mt-2 hidden max-w-[40ch] text-[14.5px] leading-[1.5] text-text-on-ink/85 sm:block'
                            : 'hidden max-h-0 max-w-[36ch] overflow-hidden text-[13.5px] leading-[1.5] text-text-on-ink/85 opacity-0 transition-all duration-500 ease-brand lg:block lg:group-hover:mt-2 lg:group-hover:max-h-24 lg:group-hover:opacity-100 lg:group-focus-visible:mt-2 lg:group-focus-visible:max-h-24 lg:group-focus-visible:opacity-100'
                        }
                      >
                        {work.does}
                      </span>
                    </span>
                  </Link>
                </Reveal>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
