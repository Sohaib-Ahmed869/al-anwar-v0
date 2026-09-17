import Divider from '../components/Divider'
import {
  PartnersClose,
  PartnersField,
  PartnersHero,
  PartnersHow,
  PartnersWays,
} from '../sections/Partners'

/* ---------------------------------------------------------------------------
   /partners: our field partners, and the ways to partner with us. Every
   section is in sections/Partners.tsx and every word in partners-data.ts.
   Added 17 September 2026 after calcite.charities.ltd/our-partners.
--------------------------------------------------------------------------- */
export default function Partners() {
  return (
    <>
      <PartnersHero />
      <PartnersField />
      <PartnersHow />
      <Divider variant="mark" small />
      <PartnersWays />
      <PartnersClose />
    </>
  )
}
