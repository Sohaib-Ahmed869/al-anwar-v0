import { BecomeExpect, BecomeForm, BecomeHero, BecomeTrade } from '../sections/BecomePartner'

/* ---------------------------------------------------------------------------
   /become-a-partner: the enquiry. Sections in sections/BecomePartner.tsx,
   words in partners-data.ts (BECOME). ?type=<community|business|in-kind|field>
   chooses the partnership card. Added 17 September 2026 after
   calcite.charities.ltd/become-a-partner.
--------------------------------------------------------------------------- */
export default function BecomePartner() {
  return (
    <>
      <BecomeHero />
      <BecomeExpect />
      <BecomeTrade />
      <BecomeForm />
    </>
  )
}
