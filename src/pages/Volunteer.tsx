import Divider from '../components/Divider'
import VolunteerHero from '../sections/VolunteerHero'
import { VolunteerRoles, VolunteerSteps, VolunteerWhy } from '../sections/VolunteerWhy'
import { VolunteerApply, VolunteerFaq } from '../sections/VolunteerApply'

/* ---------------------------------------------------------------------------
   /volunteer, in six parts. Every word is in components/volunteer-data.ts.

   1. The hero ......... VolunteerHero    Contact's teal duotone photo
   2. Why volunteer .... VolunteerWhy     three ruled cards that fill teal
   3. The roles ........ VolunteerRoles   #roles. Packing, driving, two skills
   4. How it goes ...... VolunteerSteps   four outlined numerals
   5. Apply ............ VolunteerApply   #apply. The form and a teal panel
   6. Questions ........ VolunteerFaq     the shared FaqList

   Added 17 September 2026 at the user's request, after the Volunteer page of
   a reference they named. The header's "Volunteer with us" link, Get
   involved's volunteer button and About's volunteer card all land here.
--------------------------------------------------------------------------- */
export default function Volunteer() {
  return (
    <>
      <VolunteerHero />
      <VolunteerWhy />
      <VolunteerRoles />
      <Divider variant="mark" small />
      <VolunteerSteps />
      <VolunteerApply />
      <VolunteerFaq />
    </>
  )
}
