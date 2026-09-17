import { useParams } from 'react-router-dom'

import NotFound from './NotFound'
import { appealBySlug } from '../components/appeals-data'
import FundraiserBand from '../sections/FundraiserBand'
import FundraiserBody from '../sections/FundraiserBody'
import { fundraiserBySlug } from '../services/fundraisers'

/* ---------------------------------------------------------------------------
   One community fundraiser, /fundraisers/<slug>.

   1. The hero ......... FundraiserBand   photo, title, the appeal it raises
                                          for, and the teal give card
   2. The story ........ FundraiserBody   their reason, share links, where the
                                          gift goes, latest supporters
   3. More ............. FundraiserBody   three more fundraiser cards

   A slug that is neither listed nor saved in this browser is the site's 404.
--------------------------------------------------------------------------- */
export default function Fundraiser() {
  const { slug } = useParams()
  const fundraiser = fundraiserBySlug(slug)
  const appeal = appealBySlug(fundraiser?.appeal)
  if (!fundraiser || !appeal) return <NotFound />

  return (
    <>
      <FundraiserBand key={fundraiser.slug} fundraiser={fundraiser} appeal={appeal} />
      <FundraiserBody fundraiser={fundraiser} appeal={appeal} />
    </>
  )
}
