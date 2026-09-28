import { Link } from 'react-router-dom'

import Reveal, { Words } from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { money, type GiveAmount } from '../components/GiveModule'
import { PLACES, giveHref, type Appeal } from '../components/appeals-data'
import type { AppealDetail, Proof } from '../components/appeal-detail-data'
import { ArrowRight, Check } from '../components/icons'

/* ---------------------------------------------------------------------------
   A single appeal, sections 3 to 6: the story, full width, on the home page's
   pattern (16 September 2026, the second pass after /appeals). It used to be
   one narrow column beside a sticky give box; the give box is in the hero now
   and follows the reader as a bar (AppealGiveBox).

     3. Why this appeal ..... a large statement beside the rest of the need
     4. What your gift does . each costed amount as a card that opens /give
                              with it chosen; only where amounts carry a label
     5. From the field ...... our own photographs as a grid with the caption
                              on the picture, as HomeImpact draws its tiles;
                              gone where there are none
     6. Zakat, and delivery . two panels side by side, as AppealsNotSure

   One ground, no bands of colour: the sections are separated by space alone.
   Every word is a draft from appeal-detail-data.ts; see the note there.
--------------------------------------------------------------------------- */

/** What a zakat-ineligible appeal pays for, said in the reason line. */
const BUILT: Record<string, string> = {
  water: 'water stations',
  education: 'a school',
  jariyah: 'a building',
}

const PANEL_HEAD =
  'mt-2 font-display text-[clamp(24px,2.3vw,32px)] leading-[1.12] font-semibold tracking-[-0.02em] text-balance'

export default function AppealBody({
  appeal,
  detail,
  ladder,
}: {
  appeal: Appeal
  detail: AppealDetail
  ladder: GiveAmount[]
}) {
  const costed = ladder.filter((a) => a.label)
  const built = BUILT[appeal.causes.find((c) => BUILT[c]) ?? ''] ?? 'something built to be shared'
  const place = `${appeal.where ? `${appeal.where}, ` : ''}${PLACES[appeal.country]}`
  const [lead, ...rest] = detail.need

  return (
    <div className={SECTION_Y}>
      <div className="gutter mx-auto flex max-w-page flex-col gap-[clamp(80px,9vw,136px)]">
        {/* 3 · why this appeal */}
        <section
          aria-labelledby="need-head"
          className={`grid gap-s4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-s6 ${BREAKOUT}`}
        >
          <div>
            <Reveal variant="soft">
              <p className="font-script text-[clamp(21px,1.9vw,27px)] leading-none text-green">
                Why this appeal
              </p>
            </Reveal>
            <h2
              id="need-head"
              className="mt-s2 max-w-[14ch] font-display text-[clamp(31px,4.2vw,54px)] leading-[1.05] tracking-[-0.022em] text-balance"
            >
              <Words text={`The need in ${place}.`} delay={120} />
            </h2>
          </div>
          <div className="lg:pt-s5">
            <Reveal variant="soft" delay={200}>
              <p className="max-w-[34ch] text-[clamp(20px,2vw,27px)] leading-[1.4] font-medium tracking-[-0.014em] text-text">
                {lead}
              </p>
            </Reveal>
            {rest.map((p, i) => (
              <Reveal key={i} variant="soft" delay={300 + i * 90}>
                <p className="mt-s3 max-w-[58ch] text-[17px] leading-[1.65] text-text-2">{p}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 4 · what your gift does */}
        {costed.length > 0 && (
          <section aria-labelledby="does-head">
            <SectionHead
              id="does-head"
              eyebrow="What your donation does"
              title="Choose what it pays for."
              lede="Each amount opens the give form with this appeal and that amount already chosen."
            />
            <ul className={`mt-s4 grid gap-s2 sm:grid-cols-3 lg:mt-s5 ${BREAKOUT}`}>
              {costed.map((a, i) => (
                <li key={a.value}>
                  <Reveal variant="up" delay={i * 90} className="h-full">
                    <Link
                      to={`${giveHref(appeal)}&amount=${a.value}`}
                      className="group relative flex h-full min-h-[210px] flex-col overflow-hidden rounded-2xl bg-paper p-s3 ring-1 ring-line transition-[background-color,color,box-shadow] duration-300 ease-brand hover:bg-teal hover:text-paper hover:ring-teal lg:p-s4"
                    >
                      <span className="nums font-display text-[clamp(44px,4.4vw,64px)] leading-none font-bold tracking-[-0.03em]">
                        {money(a.value)}
                      </span>
                      <span className="mt-s2 text-[17px] leading-snug text-text-2 transition-colors duration-300 group-hover:text-paper/85">
                        {a.label}
                      </span>
                      <span className="mt-auto flex items-center justify-between pt-s3 text-[14.5px] font-semibold">
                        Give {money(a.value)}
                        <span
                          aria-hidden="true"
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-ink/[0.06] transition-[background-color,color,transform] duration-300 ease-brand group-hover:translate-x-1 group-hover:bg-gold group-hover:text-ink"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      </span>
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 5 · from the field */}
        {detail.proof.length > 0 && (
          <section aria-labelledby="proof-head">
            <SectionHead
              id="proof-head"
              eyebrow="From the field"
              title="Our own photographs of this work."
              lede="Taken at the handover, with the place and the date the photograph carries."
            />
            <ul
              className={`mt-s4 grid auto-rows-[68vw] gap-s2 sm:auto-rows-[260px] sm:grid-cols-2 lg:mt-s5 lg:auto-rows-[clamp(220px,19vw,300px)] lg:grid-cols-3 ${BREAKOUT}`}
            >
              {detail.proof.map((ph, i) => (
                <li key={ph.src} className={proofSpan(i, detail.proof.length)}>
                  <Reveal variant="up" delay={i * 90} className="h-full">
                    <ProofTile photo={ph} large={i === 0} />
                  </Reveal>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 6 · zakat, and how it gets there */}
        <section
          aria-label="Zakat and delivery"
          className={`grid gap-s2 lg:grid-cols-2 ${BREAKOUT}`}
        >
          <Reveal variant="up" className="h-full">
            <div
              className={`flex h-full flex-col rounded-2xl p-s3 sm:p-s4 lg:p-[clamp(32px,3.2vw,52px)] ${
                appeal.zakat ? 'bg-green-pale' : 'bg-paper ring-1 ring-line'
              }`}
            >
              <p className="flex items-center gap-2 font-script text-[clamp(24px,2.2vw,32px)] leading-none text-green">
                Zakat
                {appeal.zakat && (
                  <span
                    aria-hidden="true"
                    className="grid h-5 w-5 place-items-center rounded-full bg-green text-paper"
                  >
                    <Check className="h-2.5 w-2.5" />
                  </span>
                )}
              </p>
              <h2 className={PANEL_HEAD}>
                {appeal.zakat
                  ? 'This appeal can take your zakat.'
                  : 'This appeal is for sadaqah, not zakat.'}
              </h2>
              <p className="mt-s2 max-w-[48ch] text-[16px] leading-[1.6] text-text-2">
                {appeal.zakat
                  ? 'It pays for food and relief given into the hands of people who qualify. Zakat given here goes into a ledger of its own, and none of it pays for running the charity.'
                  : `It pays for ${built}, and scholars differ on whether zakat may be spent that way. To give your zakat, choose a food or relief appeal instead.`}
              </p>
              <div className="mt-s3 flex flex-wrap gap-x-s3 gap-y-2 lg:mt-auto lg:pt-s3">
                <PanelLink to="/zakat#policy">Our zakat policy</PanelLink>
                {!appeal.zakat && <PanelLink to="/appeals?cause=food">Food appeals</PanelLink>}
              </div>
            </div>
          </Reveal>

          <Reveal variant="up" delay={90} className="h-full">
            <div className="flex h-full flex-col rounded-2xl bg-paper p-s3 ring-1 ring-line sm:p-s4 lg:p-[clamp(32px,3.2vw,52px)]">
              <p className="font-script text-[clamp(24px,2.2vw,32px)] leading-none text-green">
                How it gets there
              </p>
              <h2 className={PANEL_HEAD}>
                {appeal.causes.some((c) => c === 'jariyah' || c === 'education')
                  ? 'Built by people who live there.'
                  : 'Bought locally, handed over in person.'}
              </h2>
              <div className="mt-s2 space-y-s2">
                {detail.delivery.map((p, i) => (
                  <p key={i} className="max-w-[52ch] text-[16px] leading-[1.6] text-text-2">
                    {p}
                  </p>
                ))}
              </div>
              <div className="mt-s3 lg:mt-auto lg:pt-s3">
                <PanelLink to="/where-it-goes">Where the money goes</PanelLink>
              </div>
            </div>
          </Reveal>
        </section>
      </div>
    </div>
  )
}

/* One photograph: the first is large, the rest fill in beside it. With one it
   takes the whole width, with two they share it. */
const proofSpan = (i: number, n: number) => {
  if (n === 1) return 'sm:col-span-2 sm:row-span-2 lg:col-span-3 lg:row-span-2'
  if (n === 2)
    return i === 0 ? 'sm:row-span-2 lg:col-span-2 lg:row-span-2' : 'sm:row-span-2 lg:row-span-2'
  return i === 0 ? 'sm:col-span-2 lg:row-span-2' : ''
}

function ProofTile({ photo, large }: { photo: Proof; large: boolean }) {
  const line = (i: number) => ({ ['--i' as string]: i })
  return (
    <figure className="group relative isolate h-full overflow-hidden rounded-xl bg-sand sm:rounded-2xl">
      <img
        src={photo.src}
        alt={photo.alt}
        loading="lazy"
        decoding="async"
        className="reveal-zoom absolute inset-0 -z-10 h-full w-full object-cover group-hover:scale-[1.05]"
        style={{ objectPosition: photo.position }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/85 via-ink/20 via-45% to-ink/0"
      />
      <span aria-hidden="true" className="reveal-curtain absolute inset-0 z-20 bg-teal" />
      <figcaption className={`absolute inset-x-0 bottom-0 ${large ? 'p-s3 lg:p-s4' : 'p-s3'}`}>
        <span className="reveal-rise block text-[13px] text-text-on-ink-2" style={line(0)}>
          {photo.place}
          {photo.when && ` · ${photo.when}`}
        </span>
        <span
          className={`reveal-rise mt-1 block font-display leading-[1.1] font-semibold tracking-[-0.018em] text-text-on-ink ${
            large ? 'text-[clamp(24px,2.4vw,34px)]' : 'text-[clamp(18px,1.6vw,22px)]'
          }`}
          style={line(1)}
        >
          {photo.what}
        </span>
      </figcaption>
    </figure>
  )
}

function PanelLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-green transition-colors duration-200 ease-brand hover:text-ink"
    >
      {children}
      <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
    </Link>
  )
}
