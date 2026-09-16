import { useParams } from 'react-router-dom'

import NotFound from './NotFound'
import { CAUSES } from '../components/give-data'
import { appealBySlug } from '../components/appeals-data'
import { APPEAL_DETAIL } from '../components/appeal-detail-data'
import AppealBand from '../sections/AppealBand'
import AppealBody from '../sections/AppealBody'
import AppealRelated from '../sections/AppealRelated'

/* ---------------------------------------------------------------------------
   A single appeal, /appeals/<slug>. One template for all of them; the card
   data is in appeals-data.ts and the long form in appeal-detail-data.ts.

   1–2. The hero ............. AppealBand      the photograph, the appeal, and
                                               the teal give card
                                               (AppealGiveBox), whose bar
                                               follows the reader down
   3–6. The story ............ AppealBody      why, what a gift does, field
                                               photographs, zakat and delivery
   7. Other appeals .......... AppealRelated   three photograph tiles

   REBUILT ON THE HOME PAGE'S PATTERN, 16 September 2026, at the client's
   request, as the second pass after /appeals: a photograph hero with the give
   card in it instead of a half band and a sticky box beside a narrow column,
   the story full width with the shared SectionHead, one ground, and no
   progress bars. Drafted copy, our own field photographs where the place
   matches, and an unknown slug as the site's 404 are all unchanged from the
   15 September build.
--------------------------------------------------------------------------- */
export default function Appeal() {
  const { slug } = useParams()
  const appeal = appealBySlug(slug)
  const detail = slug ? APPEAL_DETAIL[slug] : undefined
  if (!appeal || !detail) return <NotFound />

  const ladder = detail.ladder ?? CAUSES.find((c) => c.id === appeal.fund)?.amounts ?? []

  return (
    <>
      <AppealBand key={appeal.slug} appeal={appeal} ladder={ladder} />
      <AppealBody appeal={appeal} detail={detail} ladder={ladder} />
      <AppealRelated appeal={appeal} />
    </>
  )
}
