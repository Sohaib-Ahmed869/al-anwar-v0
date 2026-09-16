import HomeHero from '../sections/HomeHero'
import HomeAppeals from '../sections/HomeAppeals'
import HomeImpact from '../sections/HomeImpact'
import HomeZakat from '../sections/HomeZakat'
import HomeSocial from '../sections/HomeSocial'
import Divider from '../components/Divider'

/* ---------------------------------------------------------------------------
   The home page, in seven steps. Like About and Contact, this file is a table
   of contents and nothing else â€” every section of it is one file in
   src/sections/.

   1. One dark screen ........... HomeHero      DONE. The one dark screen on the
                                                 page: an appeal per place â€”
                                                 Gaza first, the field camps,
                                                 Yemen, Lebanon â€” each with
                                                 what a gift buys and its own
                                                 Donate button, and small dots at
                                                 the foot are the clock.
   2. What's urgent right now ... HomeAppeals   DONE. The feeling becomes a
                                                 decision: five appeals on a
                                                 rail, each with what it costs.
      (HomeAsk, the quick-give band that followed the appeals, came off the
      page on 16 September 2026 at the client's request. Its fund-and-amount
      bar now sits along the foot of the hero: components/QuickGive.tsx.)
   3. What the money turns into . HomeImpact    DONE. The objection the ask
                                                 creates, answered in things
                                                 rather than in dollars: six
                                                 photographs of work already
                                                 done, as a bento grid with
                                                 the words on the pictures
                                                 (a rail until 16 Sep 2026).
                                                 No figures on it at
                                                 all â€” those are on the
                                                 accountability page.

   4. Work out your zakat ....... HomeZakat    DONE. The one band that is not
                                                 addressed to somebody being
                                                 persuaded: an obligation, the
                                                 two figures that are not ours
                                                 to move, and the category of
                                                 spending we decline. Green-
                                                 pale, and liftable to the top
                                                 of the page for Ramadan.
   5. Follow along .............. HomeSocial   DONE. The close. The only band
                                                 that asks for attention
                                                 instead of money, so it
                                                 carries no gold, and the
                                                 footer's dark does the full
                                                 stop under it. The two
                                                 accounts up top and four real
                                                 Instagram posts below, saved
                                                 locally and linking out — no
                                                 iframe, because nobody should
                                                 be handed to Meta for opening
                                                 this page. The real posts are
                                                 on Get involved.

   ONE GROUND, DRAWN SEAMS (16 September 2026)
   The page used to alternate paper and sand to say a step had ended: paper,
   sand, paper, sand, paper, then the footer's ink. It now runs on one colour —
   --color-ground in index.css — and the seams are drawn instead. The reasoning,
   and which of the four dividers to reach for where, is at the top of
   components/Divider.tsx. Two things follow from it and are easy to undo by
   accident: no section on this page may set a background of its own, and the
   dividers above are part of the argument's punctuation, not decoration
   sprinkled between the parts. A `mark` between every step would say nothing.

   THE NEXT-EVENT BAND HELD THIS SLOT until 16 September 2026, when the events
   diary came off the whole site at the client's request. Step 5's job did not
   change with it: it is still the one band that asks for time and attention
   rather than money.

   THE FIELD REPORT IS GONE FROM THIS LIST
   It was step 4 â€” "what the money did, dated" â€” and HomeImpact is now exactly
   that. Building it would have put the same six photographs on the page twice.

   The page has one rail, the appeals. HomeImpact was a second, slower one
   until 16 September 2026 and is now a grid — two moving strips read as one
   long conveyor. See the note in HomeImpact before adding another.

   The order is an argument, the same way the About page is: here is what we
   promise, here is what needs money today, here is what happened to the last
   lot, here is the family it reached, and here is where to meet us.

   WHY THE ORDER CHANGED
   This used to run: the ticker, the zakat calculator, the 88/7/5 split, the
   field report, the events. Two things were wrong with it. The proof was split
   into three separate steps with the calculator wedged into the middle of
   them, which is a topic change in the middle of an argument â€” proof is one
   movement and now runs 3 then 4. And zakat has moved to 5 because it speaks
   only to a reader with an obligation already due: it is a second door, not
   the next sentence, and it wants to be liftable to the top of the page for
   Ramadan without the rest of the order collapsing. Build it so it can move.

   The 88/7/5 split named above is gone and is not coming back. The filed
   accounts do not break down that way â€” there is one "all other expenses"
   line and it does not split, so the third slice would have had to be
   invented. Step 3 briefly WAS that table, and it has been turned into the
   work itself: a home page should say what the money becomes, not audit
   itself in front of the reader. The accounts did not go in the bin â€” they
   are on the accountability page now, which is the page for them, and the
   header and footer both already point at it. Step 3 carries no figure of any
   kind, which is the whole point of it: it is the one band on the page that
   answers "what happens to the money" without quoting a number.

   The page is now complete end to end. What is left of the original plan is
   the sticky mobile "Give $50" bar, which appears once the hero's
   give module scrolls out of view and so needs HomeHero and the header to
   share one piece of state.
--------------------------------------------------------------------------- */
export default function Home() {
  return (
    <>
      <HomeHero />
      <HomeAppeals />
      {/* ONE SEAM, 16 September 2026, at the client's request. Every other
          divider on the page is gone and the bands are separated only by their
          shared padding (SECTION_Y in components/SectionHead.tsx). This one
          stays because it is the page's real turn — stop asking, start showing —
          and it is small (a 24px mark) with no padding of its own, so the gap
          here is the same as every other gap. It sat under HomeAsk until that
          band came off the page the same day. */}
      <Divider variant="mark" small />
      <HomeImpact />
      <HomeZakat />
      <HomeSocial />
    </>
  )
}
