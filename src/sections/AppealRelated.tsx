import { Link } from 'react-router-dom'

import AppealCard from '../components/AppealCard'
import Reveal from '../components/Reveal'
import { APPEAL_LIST, type Appeal } from '../components/appeals-data'
import { ArrowRight } from '../components/icons'

/* ---------------------------------------------------------------------------
   A single appeal, section 8: other appeals.

   Three cards from the /appeals grid: appeals in the same place first, then
   ones that share this appeal's need, then anything else, so there are always
   three while there are four appeals on the site. On sand, the asking ground,
   because every card here carries a Give button.
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
    <section
      aria-labelledby="related-head"
      className="relative isolate overflow-hidden bg-sand py-s5 lg:py-s6"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(85%_70%_at_10%_0%,rgba(47,107,90,0.1)_0%,transparent_62%)]"
      />
      <div className="gutter mx-auto max-w-page">
        <Reveal className="flex flex-wrap items-end justify-between gap-s2">
          <h2
            id="related-head"
            className="font-display text-[clamp(28px,3.4vw,40px)] leading-[1.08] tracking-[-0.02em]"
          >
            Other appeals
          </h2>
          <Link to="/appeals" className="group inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-green hover:text-ink">
            All appeals
            <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
        <ul className="mt-s4 grid gap-x-s3 gap-y-s5 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((a, i) => (
            <li key={a.slug} className={i === 2 ? 'sm:hidden lg:block' : undefined}>
              <Reveal delay={i * 70} className="h-full">
                <AppealCard appeal={a} />
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
