import { Link } from 'react-router-dom'

import { MasjidMark } from '../components/Ornament'
import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { ArrowRight } from '../components/icons'

/* ---------------------------------------------------------------------------
   About, section 2 of 5: what we stand for.

   Moved onto the home page's pattern on 17 September 2026: the shared
   SectionHead, the page's one ground (it used to be a sand band and an ink
   strip), and the panels AppealsNotSure uses. The mission sits in the teal
   panel because it is the charity speaking; the vision beside it is a ruled
   panel. The three values run under them as ruled cards, each one a door to
   the page that proves it.

   Second pass, 17 September 2026: each value carries a large outlined
   numeral (the hero ribbon's outline style) that fills teal on hover, and the
   mission panel has the logo's masjid standing faintly in its corner.

   The hadith closes the section, centred under the values (it had its own
   ink strip, then briefly sat in the hero).

   PROVENANCE: the mission and the three value titles are the old site's own
   words, kept verbatim (so "Since 2022" stays, though the charity was
   registered in 2020; ask the client which they mean). The vision and the value
   bodies are drafts.

   The third value used to say the spending split is "published from the
   audited accounts". Al-Anwaar is a small charity and has no audited report, so
   it now says the accounts filed with the ACNC.
--------------------------------------------------------------------------- */

const VALUES = [
  {
    label: 'Faith',
    title: 'Our values are built on the Islamic faith',
    body: 'Zakat is held apart from every other gift and reaches only the people zakat is allowed to reach. Qurbani is slaughtered on the day. A sadaqah jariyah is built to last, not to photograph.',
    link: { text: 'How zakat is handled', to: '/zakat' },
  },
  {
    label: 'Community',
    title: 'We help build communities around the world',
    body: 'A food pack feeds a family for a month. A water station and a school outlast us. We run both, because the second kind is the reason a place stops needing the first.',
    link: { text: 'The appeals running now', to: '/appeals' },
  },
  {
    label: 'Transparency',
    title: 'Transparent donations',
    body: 'Every distribution is logged with a place and a date, and what we spend is published from the accounts we file with the ACNC. If we cannot evidence it, it does not go on the site.',
    link: { text: 'Where it goes', to: '/where-it-goes' },
  },
]

export default function AboutMission() {
  return (
    <section aria-labelledby="mission-head" className={SECTION_Y}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="mission-head"
          eyebrow="What we stand for"
          title="Our mission, and what it commits us to."
        />

        <div
          className={`mt-s4 grid gap-s2 lg:mt-s5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] ${BREAKOUT}`}
        >
          <Reveal variant="clip" className="h-full">
            <div className="relative isolate flex h-full flex-col overflow-hidden rounded-2xl bg-teal p-s3 text-paper sm:p-s4 lg:p-[clamp(32px,3.2vw,52px)]">
              {/* The logo's masjid, large and faint, standing in the corner. */}
              <MasjidMark className="absolute -right-[4%] -bottom-[14%] -z-10 size-[clamp(180px,20vw,300px)] text-paper/[0.07]" />
              <p className="font-script text-[clamp(26px,2.4vw,36px)] leading-none text-gold-pale">
                Our mission
              </p>
              <p className="mt-s2 max-w-[34ch] font-display text-[clamp(22px,2.2vw,31px)] leading-[1.3] font-medium tracking-[-0.016em] text-balance">
                We&rsquo;re committed to creating a brighter future for all. Since 2022, we&rsquo;ve
                been driven by compassion, providing vital support to those in need. With your help,
                we can make a lasting difference.
              </p>
            </div>
          </Reveal>

          <Reveal variant="clip" delay={90} className="h-full">
            <div className="flex h-full flex-col rounded-2xl border border-line p-s3 sm:p-s4 lg:p-[clamp(32px,3.2vw,52px)]">
              <p className="font-script text-[clamp(26px,2.4vw,36px)] leading-none text-green">
                Our vision
              </p>
              <p className="mt-s2 max-w-[38ch] text-[clamp(16px,1.4vw,18px)] leading-[1.6] text-text-2">
                A place we have worked in should need us less each year than the last: the well
                still running, the school still open, the family no longer waiting on a pack. We
                would rather finish somewhere than stay there.
              </p>
            </div>
          </Reveal>
        </div>

        <ol className={`mt-s2 grid gap-s2 md:grid-cols-3 ${BREAKOUT}`}>
          {VALUES.map((value, i) => (
            <li key={value.title} className="h-full">
              <Reveal variant="clip" delay={i * 90} className="h-full">
                <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper/40 p-s3 transition-[border-color,background-color,box-shadow,transform] duration-300 ease-brand hover:-translate-y-1 hover:border-teal/30 hover:bg-paper hover:shadow-card sm:p-s4">
                  {/* The numeral in outline, the hero ribbon's second style,
                      filling with teal under a pointer. */}
                  <div className="flex items-start justify-between gap-s2">
                    <p className="font-script text-[clamp(22px,1.9vw,27px)] leading-none text-green">
                      {value.label}
                    </p>
                    <span
                      aria-hidden="true"
                      className="nums font-display text-[clamp(48px,4.4vw,68px)] leading-[0.8] font-semibold tracking-[-0.05em] text-transparent transition-colors duration-300 ease-brand [-webkit-text-stroke:1.5px_var(--color-teal)] group-hover:text-teal"
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="mt-s3 font-display text-[clamp(20px,1.8vw,24px)] leading-[1.18] font-semibold tracking-[-0.018em] text-balance">
                    {value.title}
                  </h3>
                  <p className="mt-s2 mb-s3 text-[15px] leading-relaxed text-text-2">{value.body}</p>

                  <Link
                    to={value.link.to}
                    className="mt-auto inline-flex items-center gap-1.5 self-start text-[14.5px] font-semibold text-green transition-colors duration-200 ease-brand hover:text-ink"
                  >
                    {value.link.text}
                    <ArrowRight className="h-3 w-3 -translate-x-0.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                  </Link>
                </article>
              </Reveal>
            </li>
          ))}
        </ol>

        {/* The hadith the old homepage closed on: why any of this. Centred on
            the ground under the values, with the masjid's teal for the Arabic. */}
        <Reveal variant="soft">
          <figure className="mx-auto mt-s5 max-w-[760px] text-center lg:mt-[clamp(72px,7vw,110px)]">
            <p
              lang="ar"
              dir="rtl"
              className="font-arabic text-[clamp(22px,2.2vw,30px)] leading-[1.8] text-teal"
            >
              ظِلُّ الْمُؤْمِنِ يَوْمَ الْقِيَامَةِ صَدَقَتُهُ
            </p>
            <blockquote className="mt-s2 font-serif text-[clamp(22px,2.6vw,34px)] leading-[1.3] text-text italic [text-wrap:balance]">
              &ldquo;The believer&rsquo;s shade on the Day of Resurrection will be his
              charity.&rdquo;
            </blockquote>
            <figcaption className="mt-s2 flex items-center justify-center gap-3 text-[12.5px] font-medium tracking-[0.1em] text-text-3 uppercase">
              <span aria-hidden="true" className="h-px w-8 bg-gold/70" />
              Al-Tirmid&#772;hi&#772;
              <span aria-hidden="true" className="h-px w-8 bg-gold/70" />
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  )
}
