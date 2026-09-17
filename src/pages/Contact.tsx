import ContactHero from '../sections/ContactHero'
import ContactForm from '../sections/ContactForm'
import ContactSocial from '../sections/ContactSocial'
import Divider from '../components/Divider'

/* ---------------------------------------------------------------------------
   Contact, in three parts.

   17 SEPTEMBER 2026: moved onto the About page's pattern at the user's
   request. A light, type-led hero with a turning subject and a ribbon (no
   photograph, not an overlay route); the form and the social band on the
   shared SectionHead, SECTION_Y and one ground, with one small mark between
   them; the details panel in the logo teal. Older notes below describe the
   photo hero, the ink panel and the sand band.

   1. Talk to a person ......... ContactHero    the band, and the two ways in.
                                                Nothing along its foot but the
                                                way down — see the note there
   2. What is it about ......... ContactForm    the form, and beside it the
                                                panel holding every other way
                                                of reaching us
   3. Also find us on .......... ContactSocial  the two accounts

   There was a fourth: a Google embed of the warehouse under a "Come and see
   us" heading, with the hours and a directions button. It is gone. The address
   is in the panel in section 2 with a directions link on it, the hours are on
   the phone row beside it and in the desk status above it, and the footer gives
   the address again on every page — so the map was a whole second document,
   lazy-loaded at the foot of the page, to say for the third time something
   nobody had asked it. What it did have that nothing else does is a picture of
   the street; if that is wanted back it belongs beside the address in the
   panel, not as a band of its own.

   It used to be three parts and a great deal more machinery: a six-option
   subject picker that swapped the whole form, a per-subject FAQ block above it,
   per-subject optional fields, and a "What happens next" section of numbered
   steps and three promise cards. All of it was friction in front of somebody
   who only wanted to send a message, so all of it is gone. One form, one
   subject field in it.

   ── One rule for the whole page: it is not made of boxes ────────────────
   This page came within an inch of looking like every contact page a machine
   has ever produced, and it got there honestly — one bordered card per fact.
   Three frosted cards along the foot of the hero, three white cards for the
   email, the phone and the address, a card beside the map repeating all three
   of them again. Nine rounded rectangles down one screen, each with a border,
   a fill and an icon in a chip, and none of them any easier to read for it.

   All of them are now rules and rows: a hairline, a label, the thing itself.
   The page still has exactly one bordered panel in it — the reply that lands
   where the form was, because that one genuinely is a different kind of object
   from what it replaced. If a fourth section ever arrives, that is the budget
   it inherits.

   The ink panel beside the form does not spend from it. It has no border and
   nothing inside it has one either; it is a change of ground, the same move the
   give card on the home page makes, and the three facts on it are the same
   ruled rows they would be on paper. The rule is against a frame per fact, not
   against the page ever being more than one colour.

   What replaced the borders is behaviour, which is the part a screenshot does
   not show: rows that draw a rule under the pointer, fields that draw the same
   rule as you enter them, a hairline over the send button that fills as the
   form does, and a panel that says whether the office is open at this minute
   and travels down beside the form.

   Every word on this page lives in components/contact-data.ts. None of these
   four files holds copy of its own.
--------------------------------------------------------------------------- */
export default function Contact() {
  return (
    <>
      <ContactHero />
      <ContactForm />
      <Divider variant="mark" small />
      <ContactSocial />
    </>
  )
}

