import { Link } from 'react-router-dom'

import AppealTile from '../components/AppealTile'
import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { appealBySlug, type Appeal } from '../components/appeals-data'
import { ArrowRight } from '../components/icons'
import type { Season } from '../components/season-data'

/* ---------------------------------------------------------------------------
   /ramadan and /dhul-hijjah, section 4 of 5: open appeals.

   Three appeals picked by hand in season-data.ts, drawn as the /appeals
   photograph tiles in AppealRelated's grid. A slug that has been taken out of
   appeals-data.ts simply drops off; if all three have, the section goes.
--------------------------------------------------------------------------- */

export default function SeasonAppeals({ season }: { season: Season }) {
  const { appeals } = season
  const list = appeals.slugs.map(appealBySlug).filter((a): a is Appeal => !!a)
  if (list.length === 0) return null

  return (
    <section aria-labelledby="season-appeals-head" className={SECTION_Y}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="season-appeals-head"
          eyebrow={appeals.eyebrow}
          title={appeals.title}
          lede={appeals.lede}
          action={
            <Link
              to="/appeals"
              className="group flex shrink-0 items-center gap-1.5 text-[14.5px] font-semibold text-green transition-colors duration-200 ease-brand hover:text-ink"
            >
              All appeals
              <ArrowRight className="h-3 w-3 -translate-x-0.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
            </Link>
          }
        />
        <ul
          className={`mt-s4 grid auto-rows-[min(96vw,400px)] gap-s2 sm:auto-rows-[300px] sm:grid-cols-2 lg:mt-s5 lg:auto-rows-[clamp(280px,23vw,360px)] lg:grid-cols-3 ${BREAKOUT}`}
        >
          {list.map((a, i) => (
            <li key={a.slug} className={i === 2 ? 'sm:col-span-2 lg:col-span-1' : undefined}>
              <Reveal variant="up" delay={i * 90} className="h-full">
                <AppealTile appeal={a} big={false} eager={false} />
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
