import { useParams } from 'react-router-dom'

import NotFound from './NotFound'
import { appealBySlug } from '../components/appeals-data'
import FundraiserBand from '../sections/FundraiserBand'
import FundraiserBody from '../sections/FundraiserBody'
import { useFundraiser } from '../services/fundraisers'

/* ---------------------------------------------------------------------------
   One community fundraiser, /fundraisers/<slug>.

   1. The hero ......... FundraiserBand   photo, title, the appeal it raises
                                          for, and the teal give card
   2. The story ........ FundraiserBody   their reason, share links, where the
                                          gift goes, latest supporters
   3. More ............. FundraiserBody   three more fundraiser cards

   A slug the server does not know (or has not approved) is the site's 404;
   until it answers, the page holds its space rather than flash one.
--------------------------------------------------------------------------- */
export default function Fundraiser() {
  const { slug } = useParams()
  const { fundraiser, ready } = useFundraiser(slug)
  const appeal = appealBySlug(fundraiser?.appeal)
  if (!fundraiser || !appeal) return ready ? <NotFound /> : <div className="min-h-[80svh]" aria-busy="true" />

  return (
    <>
      <FundraiserBand key={fundraiser.slug} fundraiser={fundraiser} appeal={appeal} />
      <FundraiserBody fundraiser={fundraiser} appeal={appeal} />
    </>
  )
}
