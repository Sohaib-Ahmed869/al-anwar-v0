import PageBand from '../components/PageBand'
import { WAYS } from '../components/involved-data'

/* ---------------------------------------------------------------------------
   Get involved, section 1 of 7: the band, and the four ways in.

   The shared compact ink band, the same one /give, /appeals and
   /where-it-goes open on. No photograph, and here that is a rule rather than a
   preference: the only images of volunteers in the repository are the licensed
   stock frames bought for the events diary before it was removed, and a stock
   photograph of somebody else's volunteers at the top of a page asking you to
   become one of ours is the caption rule broken in the laziest possible way.
   Those four frames are still in public/assets/images, unused — see the note
   above SOCIAL in involved-data.ts for why they were kept.

   THE INDEX UNDER THE BAND
   Four sections is one more than a reader will scroll through on faith, and
   the four are genuinely unlike each other — an afternoon, a fundraiser, a
   room, a workplace. The strip lets somebody who already knows which one they
   are go straight to it. It reads from WAYS, which is the same order the
   header menu lists them in, so the panel and the page cannot drift apart.

   They are plain anchors, not router links: every target is on this page, and
   a <Link> to a hash on the page you are already on is a route change
   pretending to be a scroll.
--------------------------------------------------------------------------- */

export default function InvolvedHero() {
  return (
    <>
      <PageBand title="Get involved.">
        Everything that leaves the warehouse leaves it because somebody turned up. There are four
        ways to be that person, and none of them needs you to fill in a form.
      </PageBand>

      <nav aria-label="The four ways in" className="border-b border-line bg-paper-2">
        <ul className="gutter mx-auto flex max-w-page flex-col sm:flex-row sm:flex-wrap">
          {WAYS.map((way, i) => (
            <li
              key={way.id}
              /* A hairline between each on a wide screen and under each on a
                 narrow one, so the strip reads as a row of four rather than a
                 paragraph of links. The first has none on either. */
              className={`flex-1 border-line ${i > 0 ? 'border-t sm:border-t-0 sm:border-l' : ''}`}
            >
              <a
                href={`#${way.id}`}
                className="group block h-full py-s2 transition-colors duration-200 ease-brand sm:px-s3 sm:first:pl-0"
              >
                <span className="block text-[14.5px] font-semibold transition-colors duration-200 ease-brand group-hover:text-green">
                  {way.label}
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-text-3">
                  {way.hint}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
