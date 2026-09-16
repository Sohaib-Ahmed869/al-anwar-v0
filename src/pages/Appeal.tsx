import { useParams } from 'react-router-dom'

import NotFound from './NotFound'
import { CAUSES } from '../components/give-data'
import { appealBySlug } from '../components/appeals-data'
import { APPEAL_DETAIL } from '../components/appeal-detail-data'
import AppealBand from '../sections/AppealBand'
import AppealGiveBox from '../sections/AppealGiveBox'
import AppealBody from '../sections/AppealBody'
import AppealRelated from '../sections/AppealRelated'

/* ---------------------------------------------------------------------------
   A single appeal, /appeals/<slug>. One template for all of them; the card
   data is in appeals-data.ts and the long form in appeal-detail-data.ts.

   1. The band ............... AppealBand     half-screen photograph, the title
   2. The give box ........... AppealGiveBox  sticky beside the story on desktop,
                                              straight after the band on a phone
   3–7. The story ............ AppealBody     the need, what a gift does, field
                                              photographs, zakat, delivery
   8. Other appeals .......... AppealRelated

   The two-column layout lives here rather than in a section, because it is
   the relationship between two sections — the box beside the story — and
   neither of them should know about the other.

   Decided with the client on 15 September 2026: drafted copy marked TODO, our
   own field photographs where the place matches, a photo band with a sticky
   give box. An unknown slug is the site's 404.
--------------------------------------------------------------------------- */
export default function Appeal() {
  const { slug } = useParams()
  const appeal = appealBySlug(slug)
  const detail = slug ? APPEAL_DETAIL[slug] : undefined
  if (!appeal || !detail) return <NotFound />

  const ladder = detail.ladder ?? CAUSES.find((c) => c.id === appeal.fund)?.amounts ?? []

  return (
    <>
      <AppealBand appeal={appeal} detail={detail} />

      <div className="bg-paper pb-s5 lg:pb-s6">
        <div className="gutter mx-auto grid max-w-page gap-x-s5 gap-y-s5 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
          <aside
            aria-label="Give to this appeal"
            className="relative z-10 -mt-s4 lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:order-2 lg:-mt-[140px] lg:self-start"
          >
            <AppealGiveBox key={appeal.slug} appeal={appeal} ladder={ladder} />
          </aside>
          <div className="lg:order-1 lg:pt-s5">
            <AppealBody appeal={appeal} detail={detail} ladder={ladder} />
          </div>
        </div>
      </div>

      <AppealRelated appeal={appeal} />
    </>
  )
}
