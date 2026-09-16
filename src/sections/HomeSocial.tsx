import Reveal, { Words } from '../components/Reveal'
import { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { Facebook, Instagram } from '../components/icons'
import { ACCOUNTS, INSTAGRAM, type Account } from '../components/social-data'

/* ---------------------------------------------------------------------------
   Home, step 5 of 5: the close.

   This took the slot the next-event band held until 16 September 2026, when
   the events diary came off the site. It keeps that band's job exactly: it is
   the one thing on the home page that asks for attention instead of money, so
   it carries no gold, and the footer's ink does the full stop underneath it.

   A HEAD AND FOUR POSTS (16 September 2026, at the user's request)
   It was type and two links; it is now the "Latest from" layout the user
   supplied — the eyebrow and the handle on the left, the two accounts on the
   right, and a row of four post cards underneath.

   NO IFRAMES ON THE HOME PAGE, DELIBERATELY
   The Get involved page shows the actual posts, behind a click, for the
   privacy reason written at the head of social-data.ts. That reasoning applies
   twice as hard here: this is the page everybody lands on. So the cards are
   plain images saved on this site, each linking out to its post — nothing
   loads from Meta until somebody clicks one.

   THE CARDS ARE REAL POSTS, SAVED LOCALLY
   The four newest distinct posts on instagram.com/alanwaarcharity, read on
   16 September 2026. (The 3 August 2025 Gaza reel was posted twice; only one
   copy is here.) Each cover image was saved into /assets/images as ig-*.webp,
   so nothing is fetched from Instagram's CDN — whose signed URLs expire anyway.
   The reels carry no caption of their own, so each card's line describes what
   the post shows, and its date is the date Instagram gives for it.

   The three reel covers are only 640px wide at source, so they are cropped to
   ~360px squares — sharp enough at card size on a phone, a touch soft on a
   retina desktop. When the client refreshes this row, take the newest posts
   again and prefer photo posts, which come down at 1080px.

   FOUR, NOT THREE OR FIVE — the grid runs two across on a phone and four on a
   wide screen.
--------------------------------------------------------------------------- */

const MARKS: Record<string, (props: { className?: string }) => React.ReactElement> = {
  Facebook,
  Instagram,
}

type Post = {
  account: Account
  /** the post's own permalink */
  url: string
  image: string
  alt: string
  caption: string
  /** as Instagram dates it */
  date: string
}

const POSTS: Post[] = [
  {
    account: INSTAGRAM,
    url: 'https://www.instagram.com/reel/DVdjFRpksVH/',
    image: '/assets/images/ig-food-packs-2026-03.webp',
    alt: 'Hundreds of food packs laid out in rows on red sheeting in a courtyard, seen from above',
    caption: 'Food packs laid out row on row, ready to go out to families.',
    date: '4 March 2026',
  },
  {
    account: INSTAGRAM,
    url: 'https://www.instagram.com/reel/DM47kPGy-I9/',
    image: '/assets/images/ig-gaza-appeal-2025-08.webp',
    alt: 'Children holding out pots at a food distribution, under the words “Help is needed now”',
    caption: 'Gaza emergency appeal. Help is needed now: $200,000 in 24 hours.',
    date: '3 August 2025',
  },
  {
    account: INSTAGRAM,
    url: 'https://www.instagram.com/p/DKIhWxIBUAu/',
    image: '/assets/images/ig-qurban-yemen-2025.webp',
    alt: '2025 Qurban Yemen poster: two sheep in a field and a price of $250',
    caption: '2025 Qurban in Yemen is open, $250 a share.',
    date: '26 May 2025',
  },
  {
    account: INSTAGRAM,
    url: 'https://www.instagram.com/reel/DHdqxYAy59-/',
    image: '/assets/images/ig-last-ten-nights-2025-03.webp',
    alt: 'A member of the Al-Anwaar team speaking to camera in front of the charity’s logo',
    caption: 'The last ten nights of Ramadan, and a $200,000 target to meet in them.',
    date: '21 March 2025',
  },
]

export default function HomeSocial() {
  return (
    <section aria-labelledby="home-social-head" className={SECTION_Y}>
      <div className="gutter mx-auto max-w-page">
        <div className={`flex flex-wrap items-end justify-between gap-x-s4 gap-y-s3 ${BREAKOUT}`}>
          <div>
            {/* Set, and arriving, exactly as HomeAppeals' "Open right now"
                  (SectionHead). */}
            <Reveal variant="soft">
              <p className="font-script text-[clamp(21px,1.9vw,27px)] leading-none text-green">
                Latest from
              </p>
            </Reveal>
            <h2
              id="home-social-head"
              className="mt-s2 font-display text-[clamp(30px,3.9vw,46px)] leading-[1.06] tracking-[-0.022em]"
            >
              <Words text={INSTAGRAM.handle} delay={120} />
            </h2>
          </div>

          <Reveal variant="soft" delay={300}>
            <ul className="flex items-center gap-s2 text-[11px] font-semibold tracking-[0.16em] uppercase">
              {ACCOUNTS.map((account, i) => {
                const Mark = MARKS[account.label]
                return (
                  <li key={account.label} className="flex items-center gap-s2">
                    {i > 0 && <span aria-hidden="true" className="block h-px w-4 bg-line" />}
                    <a
                      href={account.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-ink transition-colors duration-200 ease-brand hover:text-green"
                    >
                      <Mark className="h-3.5 w-3.5" />
                      {account.label}
                    </a>
                  </li>
                )
              })}
            </ul>
          </Reveal>
        </div>

        {/* Out to the same edges as the appeals, give, impact and zakat bands. */}
        <ul
          className={`mt-s4 grid grid-cols-2 gap-s2 lg:mt-s5 ${BREAKOUT} lg:grid-cols-4 lg:gap-s3`}
        >
          {POSTS.map((post, i) => {
            const Mark = MARKS[post.account.label]
            return (
              <li key={post.url}>
                <Reveal variant="scale" delay={i * 110} className="h-full">
                  {/* Rounded as the impact tiles are: 12px on the phone, 16px from sm. */}
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex h-full flex-col overflow-hidden rounded-xl border border-line sm:rounded-2xl bg-paper transition-all duration-500 ease-brand hover:-translate-y-1 hover:border-green/35 hover:shadow-card"
                  >
                    <span className="relative block aspect-square overflow-hidden">
                      <img
                        src={post.image}
                        alt={post.alt}
                        loading="lazy"
                        decoding="async"
                        className="reveal-zoom h-full w-full object-cover group-hover:scale-[1.04]"
                      />
                      <span className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-ink/85 text-text-on-ink backdrop-blur-sm transition-transform duration-500 ease-brand group-hover:scale-110">
                        <Mark className="h-3.5 w-3.5" />
                        <span className="sr-only">
                          On {post.account.label}, {post.date}
                        </span>
                      </span>
                    </span>
                    <span className="flex flex-1 flex-col p-s2 lg:p-[20px]">
                      <span className="line-clamp-3 text-[13px] leading-relaxed text-text">
                        {post.caption}
                      </span>
                      <span className="mt-auto pt-s2 text-[10px] tracking-[0.24em] text-text-3 uppercase">
                        {post.date}
                      </span>
                    </span>
                  </a>
                </Reveal>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
