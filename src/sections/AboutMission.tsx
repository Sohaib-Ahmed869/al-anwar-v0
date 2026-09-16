import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import { ArrowRight } from '../components/icons'

/* Each commitment carries the place to go and read the whole of it, which is
   what turns three claims into three doors. The three destinations are
   deliberately different pages — a card that promises more and then lands you
   somewhere you have already been is worse than no link at all. */
const VALUES = [
  {
    title: 'Our values are built on the Islamic faith',
    body: 'Zakat is held apart from every other gift and reaches only the people zakat is allowed to reach. Qurbani is slaughtered to the day. A sadaqah jariyah is built to last, not to photograph. The rules came first and the organisation was arranged around them, rather than the other way about.',
    link: { text: 'How zakat is handled', to: '/zakat' },
  },
  {
    title: 'We help build communities around the world',
    body: 'A food pack feeds a family for a month; a water station and a school outlast us. We run both, and we say plainly which is which, because the second kind is slower and less photogenic and it is the reason a place stops needing the first kind.',
    link: { text: 'The appeals running now', to: '/appeals' },
  },
  {
    title: 'Transparent donations',
    body: 'Every distribution is logged with a place and a date, every photograph is captioned with where and when it was taken, and the split of what we spend is published from the audited accounts rather than estimated. If we cannot evidence it, it does not go on the site.',
    link: { text: 'Every distribution, logged', to: '/where-it-goes' },
  },
]

/** The eyebrow: the section label, and again the label on each panel below. */
const LABEL = 'flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.14em] uppercase'

/* The commitment card.

   White on sand, so each one reads as an object standing on the ground rather
   than an outline drawn on paper — the same reasoning the give module is built
   on in HomeAsk, and the whole reason the band changed colour at all.

   It is ruled rather than floated: a real hairline in the system's line colour,
   a 12px radius instead of a pillowy one, and a shadow at rest so faint it only
   settles the card onto the sand. Three soft white rectangles with no edge and
   a big corner radius are what a template looks like; the edge is what makes
   this look drawn.

   Everything that moves under a pointer is written here rather than scattered
   through the markup: the card rises, its edge takes the brand green, and the
   shadow deepens under it. */
const CARD =
  'group relative isolate flex h-full flex-col overflow-hidden rounded-xl border border-line bg-paper p-s3 shadow-[0_1px_2px_rgba(21,26,24,0.04)] transition-[transform,border-color,box-shadow] duration-300 ease-brand hover:-translate-y-1 hover:border-green/40 hover:shadow-[0_20px_44px_-28px_rgba(21,26,24,0.45)] sm:p-s4'

/* The heading holds two lines' worth of height whether or not it needs them, so
   the three bodies start on the same line as each other. Without it the short
   third title dragged its paragraph 36px up the card and the row read as a
   mistake. Between md and xl the columns are narrow enough for a title to take
   three lines, so the floor is three there and drops to two once there is room.
   1.375em is leading-snug, which is what the heading is set in. */
const CARD_TITLE =
  'mt-s2 font-display text-[clamp(18px,1.7vw,20.5px)] leading-snug tracking-[-0.008em] text-text md:min-h-[4.125em] xl:min-h-[2.75em]'

export default function AboutMission() {
  return (
    <>
      <section className="border-t border-line-2 py-s5">
        <div className="gutter mx-auto max-w-page">
          <p className={`${LABEL} text-green`}>
            <span aria-hidden="true" className="h-px w-6 bg-green/40" />
            What we are for
          </p>

          <h2 className="mt-s1 max-w-[20ch] font-display text-[clamp(26px,3vw,38px)] leading-snug [text-wrap:balance]">
            The mission, and the vision it is working towards
          </h2>
          <div className="mt-s4 grid gap-px bg-line lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <div className="bg-green-pale p-s3 sm:p-s4">
              <h3 className={`${LABEL} text-green`}>
                <span aria-hidden="true" className="h-px w-4 bg-green/45" />
                Our mission
              </h3>
              <p className="mt-s2 max-w-[34ch] text-[clamp(18px,1.8vw,23px)] leading-[1.44] font-medium tracking-[-0.014em] text-text">
                We&rsquo;re committed to creating a brighter future for all. Since 2022, we&rsquo;ve
                been driven by compassion, providing vital support to those in need. With your
                help, we can make a lasting difference.
              </p>
            </div>

            <div className="bg-paper-2 p-s3 sm:p-s4">
              <h3 className={`${LABEL} text-text-3`}>
                <span aria-hidden="true" className="h-px w-4 bg-line" />
                Our vision
              </h3>
              <p className="mt-s2 max-w-[38ch] text-[clamp(16px,1.5vw,18.5px)] leading-[1.55] text-text-2">
                A place we have worked in should need us less each year than the last; the
                well still running, the school still open, the family no longer waiting on a pack.
                We would rather finish somewhere than stay there.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- what that commits us to ----------
          The three values, given their own band rather than left as a footnote
          to the mission above.

          WHY IT MOVED OFF PAPER
          On white these were three columns of running text under a hairline,
          which is exactly what a footnote looks like: the eye read the mission,
          met a small grey label, and slid past three paragraphs it had no
          reason to treat as separate things. Sand (#ECEAE4) is the one light
          ground in the system that is unmistakably not paper at a glance —
          paper-2 sits too close to white to register as a band, and green-pale
          is already carrying the mission panel directly above it, so a green
          band here would have run the two together into a single field.

          Sand is also what the board tiles in AboutTeam stand on further down
          this page — the faces are lifted off it the way these cards are, and
          for the same reason. Those are the only two sand bands on the page,
          and there is a paper section and an ink one between them.

          The ground then does the work the cards would otherwise need heavy
          borders for. White panels on sand are objects; the same panels on
          paper are outlines. */}
      <section
        aria-labelledby="commitments-head"
        className="relative isolate overflow-hidden bg-sand py-s5"
      >
        {/* A green wash off the top-left corner, so the band is a ground rather
            than a slab — the same device the ink strip below uses, at a third
            of the strength, because this one has to stay quiet under text. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(85%_70%_at_10%_0%,rgba(47,107,90,0.1)_0%,transparent_62%)]"
        />

        <div className="gutter mx-auto max-w-page">
          <Reveal>
            <p className={`${LABEL} text-green`}>
              <span aria-hidden="true" className="h-px w-6 bg-green/40" />
              The mission in practice
            </p>

            <h3
              id="commitments-head"
              className="mt-s1 max-w-[20ch] font-display text-[clamp(24px,2.7vw,33px)] leading-snug [text-wrap:balance]"
            >
              What that commits us to
            </h3>
            <p className="mt-s2 max-w-measure text-[15.5px] leading-relaxed text-text-2">
              A mission is easy to write. These three are what it obliges us to do once it is
              written, and they are the ones to hold us to.
            </p>
          </Reveal>

          <ol className="mt-s4 grid gap-s3 md:grid-cols-3">
            {VALUES.map((value, i) => (
              /* Each card arrives a beat behind the one to its left, so the row
                 reads left to right as it lands instead of appearing all at
                 once. Reveal fires the first time it is reached and never
                 again, and hands anyone who has asked for less motion the
                 layout with none of the travel. */
              <li key={value.title} className="h-full">
                <Reveal delay={i * 90} className="h-full">
                  <article className={CARD}>
                    {/* The green edge that draws itself across the top on
                        hover. It starts at the left, in step with the rule
                        beside the numeral, so one gesture happens rather than
                        two. */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-green transition-transform duration-500 ease-brand group-hover:scale-x-100"
                    />

                    {/* And the warmth behind it: a wash up out of the top-right
                        corner, under the text rather than over it. */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_95%_at_100%_0%,rgba(47,107,90,0.11)_0%,transparent_60%)] opacity-0 transition-opacity duration-500 ease-brand group-hover:opacity-100"
                    />

                    {/* The numeral is the only display-sized thing in the card
                        that is not the heading, and it is set on the same
                        baseline as the rule it runs into. */}
                    <div className="flex items-center gap-s2">
                      <span className="font-display text-[clamp(30px,3vw,36px)] leading-none text-green/85 transition-colors duration-300 ease-brand group-hover:text-green">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span
                        aria-hidden="true"
                        className="h-px flex-1 bg-line transition-colors duration-500 ease-brand group-hover:bg-green/40"
                      />
                    </div>

                    <h4 className={CARD_TITLE}>{value.title}</h4>

                    <p className="mt-s2 text-[15px] leading-relaxed text-text-2">{value.body}</p>

                    {/* mt-auto is what squares the row off: the three footers
                        sit on one line at the bottom of the tallest card, so
                        the space a shorter card has left over becomes margin
                        above a rule rather than a hole under a paragraph. */}
                    <div className="mt-auto pt-s3">
                      <div className="border-t border-line-2 pt-s2">
                        <Link
                          to={value.link.to}
                          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-green transition-colors duration-200 ease-brand hover:text-ink"
                        >
                          {value.link.text}
                          <ArrowRight className="h-3 w-3 -translate-x-0.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                        </Link>
                      </div>
                    </div>
                  </article>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- why any of it ----------
          One dark strip, one hadith, nothing else on it. It is the line the old
          site closed its homepage with, and it is the answer to the question
          the three values above do not answer: not what we do, but why anybody
          would. Set on ink so the page takes a breath between what we are for
          and how it started. */}
      <section className="relative isolate overflow-hidden bg-ink py-s5">
        {/* A single soft green wash, so the ink is a ground rather than a slab. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(120%_140%_at_18%_0%,rgba(47,107,90,0.34)_0%,transparent_62%)]"
        />

        <figure className="gutter relative mx-auto max-w-page">
          <p
            lang="ar"
            dir="rtl"
            className="font-arabic text-left text-[clamp(16px,1.6vw,21px)] leading-[1.9] text-paper/55"
          >
            ظِلُّ الْمُؤْمِنِ يَوْمَ الْقِيَامَةِ صَدَقَتُهُ
          </p>
          <blockquote className="mt-s2 max-w-[24ch] font-display text-[clamp(26px,3.4vw,44px)] leading-[1.14] tracking-[-0.014em] text-paper [text-wrap:balance]">
            The believer&rsquo;s shade on the Day of Resurrection will be his charity.
          </blockquote>
          <figcaption className="mt-s3 flex items-center gap-3 text-[12.5px] tracking-[0.06em] text-paper/50 uppercase">
            <span aria-hidden="true" className="h-px w-8 bg-gold/60" />
            Al-Tirmid&#772;hi&#772;
          </figcaption>
        </figure>
      </section>
    </>
  )
}
