import { Link } from 'react-router-dom'

import AppealTile from '../components/AppealTile'
import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { APPEAL_LIST, type Appeal } from '../components/appeals-data'
import { ArrowRight } from '../components/icons'

/* ---------------------------------------------------------------------------
   A single appeal, section 7: other appeals.

   Three appeals as the /appeals photograph tiles (16 September 2026, when the
   page moved onto the home pattern; they were the old white cards on sand):
   appeals in the same place first, then ones that share this appeal's need,
   then anything else. The give bar (AppealGiveBox) steps aside when this comes
   on screen, because every tile here has its own Donate button; it finds this
   section by its id, so keep `related`.
--------------------------------------------------------------------------- */

const score = (a: Appeal, to: Appeal) =>
  (a.country === to.country ? 2 : 0) + (a.causes.some((c) => to.causes.includes(c)) ? 1 : 0)

export default function AppealRelated({ appeal }: { appeal: Appeal }) {
  const related = APPEAL_LIST.filter((a) => a.slug !== appeal.slug)
    .map((a, i) => ({ a, s: score(a, appeal), i }))
    .sort((x, y) => y.s - x.s || x.i - y.i)
    .slice(0, 3)
    .map((x) => x.a)

  return (
    <section id="related" aria-labelledby="related-head" className={`pt-0 ${SECTION_Y}`}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="related-head"
          eyebrow="Other appeals"
          title="Somewhere else to help."
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
          {related.map((a, i) => (
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
