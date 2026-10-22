import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { ArrowRight, Check } from '../components/icons'
import { PARTNERS, PLACES } from '../components/where-data'

/* ---------------------------------------------------------------------------
   Where it goes, section 3 of 5: the five places.

   Rebuilt 17 September 2026 at the user's request as cards on the home
   pattern. Each card is the place's anchor (#gaza, #yemen...), which the
   header menu and /partners link straight to.

   REMOVED: the five "indicative" dollar figures with their "To confirm" chips,
   the paragraph fencing them and the footnote setting their sum against the
   filed total. They were the only invented numbers on the page. The data
   field is still in where-data.ts if the client wants them back.

   IMPACT (17 September 2026, user's request): three reach figures per card
   from `impact` in where-data.ts. They are PLACEHOLDERS until the field team
   sends real counts; see the note on that field.

   Places with dated records show their count and a link to the log; places
   without (Gaza, Syria) print their gap in words, in the same card, so the
   absence is as visible as the evidence. Photos are left off on purpose: we
   hold our own frames for only two of the five.
--------------------------------------------------------------------------- */

export default function WherePlaces() {
  return (
    <section id="places" aria-labelledby="places-head" className={`scroll-mt-[calc(var(--header-h)+24px)] ${SECTION_Y}`}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="places-head"
          eyebrow="Where we work"
          title="Five places, and what we do in each."
          lede="What your giving has done in each place, and the record behind it."
        />

        <ul className={`mt-s4 grid gap-s2 sm:grid-cols-2 lg:mt-s5 lg:grid-cols-3 ${BREAKOUT}`}>
          {PLACES.map((place, i) => {
            const partner = PARTNERS.find((p) => p.place === place.name)
            const count = place.distributions.length
            return (
              <li
                key={place.id}
                id={place.id}
                className={`scroll-mt-[calc(var(--header-h)+24px)] ${i === 0 ? 'lg:row-span-2' : ''}`}
              >
                <Reveal variant="clip" delay={Math.min(i, 4) * 80} className="h-full">
                  <article
                    className={`relative isolate flex h-full flex-col overflow-hidden rounded-2xl p-s3 sm:p-s4 ${
                      i === 0 ? 'bg-grad-lagoon-x text-paper' : 'border border-line bg-paper'
                    }`}
                  >
                    <p
                      className={`font-script text-[clamp(21px,1.8vw,26px)] leading-none ${
                        i === 0 ? 'text-gold-pale' : 'text-green'
                      }`}
                    >
                      {place.since ? `Since ${place.since}` : place.work[0]}
                    </p>
                    <h3
                      className={`mt-2 font-display leading-none font-semibold tracking-[-0.025em] ${
                        i === 0 ? 'text-[clamp(40px,4.4vw,64px)]' : 'text-[clamp(28px,2.6vw,36px)]'
                      }`}
                    >
                      {place.name}
                    </h3>

                    {/* The impact figures. PLACEHOLDERS: see `impact` in
                        where-data.ts, to be replaced with real counts. */}
                    <dl
                      className={`mt-s3 grid grid-cols-3 border-y py-s2 ${
                        i === 0 ? 'border-paper/15' : 'border-line'
                      }`}
                    >
                      {place.impact.map((f, k) => (
                        <div
                          key={f.label}
                          className={`flex flex-col pr-2 ${
                            k > 0 ? `border-l pl-s2 ${i === 0 ? 'border-paper/15' : 'border-line'}` : ''
                          }`}
                        >
                          <dt className={`order-2 mt-1 text-[12px] leading-snug ${i === 0 ? 'text-paper/75' : 'text-text-3'}`}>
                            {f.label}
                          </dt>
                          <dd
                            className={`nums font-display leading-none font-bold tracking-[-0.03em] ${
                              i === 0 ? 'text-[clamp(28px,2.8vw,40px)] text-paper' : 'text-[clamp(22px,2vw,28px)] text-teal'
                            }`}
                          >
                            {f.value}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    <ul className="mt-s3 flex flex-wrap gap-2">
                      {place.work.map((w) => (
                        <li
                          key={w}
                          className={`rounded-full px-3 py-1 text-[13px] font-semibold ${
                            i === 0 ? 'bg-paper/15 text-paper' : 'bg-teal/[0.08] text-teal'
                          }`}
                        >
                          {w}
                        </li>
                      ))}
                    </ul>

                    <div className={`mt-s3 mb-s3 text-[14.5px] leading-relaxed ${i === 0 ? 'text-paper/85' : 'text-text-2'}`}>
                      {place.gap ? (
                        <p>{place.gap}</p>
                      ) : (
                        <p>
                          <span className="nums font-semibold">{count}</span>{' '}
                          {count === 1 ? 'dated distribution' : 'dated distributions'} on record.
                        </p>
                      )}
                      {partner && (
                        <p className={`mt-s2 flex items-start gap-1.5 font-semibold ${i === 0 ? 'text-gold-pale' : 'text-teal'}`}>
                          <Check className="mt-1 h-3.5 w-3.5 shrink-0" />
                          With {partner.name}
                        </p>
                      )}
                    </div>

                    <Link
                      to={place.to}
                      className={`group mt-auto inline-flex items-center gap-1.5 self-start border-t pt-s2 text-[14.5px] font-semibold transition-colors duration-200 ease-brand ${
                        i === 0
                          ? 'border-paper/15 text-paper hover:text-gold-pale'
                          : 'border-line text-green hover:text-ink'
                      }`}
                    >
                      Appeals in {place.name}
                      <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                    </Link>
                  </article>
                </Reveal>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
