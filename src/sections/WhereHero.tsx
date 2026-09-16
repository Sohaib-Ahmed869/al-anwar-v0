import PageBand from '../components/PageBand'

/* ---------------------------------------------------------------------------
   Where it goes, section 1 of 8: the band.

   The shared compact ink band, the same one /give and /appeals open on, rather
   than a photograph. Somebody who has come to this page has come to check
   something, and a full screen of field photography between them and the table
   would be the exact move the page exists to argue against. It also keeps the
   page clear of the stock-photo problem: there is no honest hero frame for
   "our accounting".

   Adding this puts /where-it-goes in OVERLAY_ROUTES in Header.tsx, so the bar
   sits transparent inside the band and takes its paper back on scroll.

   The sentence under the title does not boast. It says what the page is and
   what it is missing, because the first thing on a page about honesty should
   not be the one thing on it that is oversold.
--------------------------------------------------------------------------- */

export default function WhereHero() {
  return (
    <PageBand title="Where it goes.">
      Every figure we have filed, every place we have worked, and the register you can check it
      all against. Where we hold nothing, this page says so rather than filling the space.
    </PageBand>
  )
}
