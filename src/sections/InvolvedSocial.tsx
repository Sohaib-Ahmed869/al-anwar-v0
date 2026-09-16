import { useState } from 'react'

import Reveal from '../components/Reveal'
import { ArrowRight, Facebook, Instagram } from '../components/icons'
import { SOCIAL } from '../components/involved-data'
import {
  EMBEDDABLE,
  FACEBOOK,
  INSTAGRAM,
  facebookTimeline,
} from '../components/social-data'

/* ---------------------------------------------------------------------------
   Get involved, section 6 of 7: what we have been posting.

   This replaced the events diary, which came off the site entirely on
   16 September 2026 along with /events, /events/:slug and the pinned event in
   the header panel. The band it sat in was the one asking for attention rather
   than money, and that is exactly what this one asks for, so it kept the slot
   and the ground.

   NOTHING FROM META LOADS UNTIL SOMEBODY PRESSES A BUTTON
   Both halves are iframes served by Facebook, and mounting one sets Meta's
   cookies on every visitor who opens the page whether they wanted the posts or
   not. The full reasoning — and the precedent, which is the map in Footer.tsx
   — is at the head of social-data.ts. Here it is one piece of state: until
   `loaded` is true there is not an iframe on the page, and the button that
   flips it says what pressing it will do rather than just saying "Load".

   It is one switch for both halves rather than two, because two consent
   buttons on one section is a cookie banner in disguise. Press it and you have
   asked for the section; leave it and you have not.

   THE TWO HALVES ARE NOT THE SAME SHAPE, BECAUSE THE PLATFORMS ARE NOT
   Facebook's page plugin takes the page URL and renders the timeline itself,
   so that half needs nothing but the account and is a single tall frame.
   Instagram has no profile-feed embed at all and has not had one since the
   oEmbed endpoint started requiring an app token — so its half is a grid of
   individual posts, listed by hand in social-data.ts, and that list is EMPTY
   until somebody pastes post links in. With nothing in it the Instagram column
   is an invitation to go and look, which is the truthful version of not having
   the posts, and the grid appears by itself the moment the list is filled.
--------------------------------------------------------------------------- */

/** Matches the frame Instagram's own embed renders at its narrowest useful
 *  width. A post is roughly square with a caption strip under it. */
const POST_RATIO = 'aspect-[4/5]'

export default function InvolvedSocial() {
  const [loaded, setLoaded] = useState(false)

  return (
    <section
      id="social"
      aria-labelledby="social-head"
      className="scroll-mt-[calc(var(--header-h)+24px)] bg-paper-2 py-s5 lg:py-s6"
    >
      <div className="gutter mx-auto max-w-page">
        <Reveal>
          <p className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.16em] text-green uppercase">
            <span aria-hidden="true" className="h-px w-6 bg-green/40" />
            {SOCIAL.eyebrow}
          </p>
          <h2
            id="social-head"
            className="mt-s1 max-w-[18ch] font-display text-[clamp(28px,3.4vw,42px)] leading-[1.08] tracking-[-0.02em] text-balance"
          >
            {SOCIAL.title}
          </h2>
          <p className="mt-s2 max-w-measure text-[15.5px] leading-relaxed text-text-2">
            {SOCIAL.body}
          </p>
        </Reveal>

        {/* --- the consent line ---
            Not a banner and not a modal. One sentence and one button, in the
            flow of the section, where somebody deciding whether they want the
            posts is already looking. It disappears once pressed. */}
        {!loaded && (
          <Reveal delay={60}>
            <div className="mt-s3 flex flex-wrap items-center gap-s2 rounded-2xl border border-line bg-paper p-s3">
              <p className="max-w-measure flex-1 text-[14.5px] leading-relaxed text-text-2">
                {SOCIAL.consent}
              </p>
              <button
                type="button"
                onClick={() => setLoaded(true)}
                className="group inline-flex min-h-[48px] shrink-0 items-center justify-center gap-1.5 rounded-[12px] border border-ink/15 px-6 text-[15px] font-semibold text-text transition-[border-color,background-color] duration-200 ease-brand hover:border-ink hover:bg-paper-2"
              >
                {SOCIAL.consentAction}
                <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
              </button>
            </div>
          </Reveal>
        )}

        <div className="mt-s4 grid gap-s4 lg:grid-cols-2 lg:gap-s5">
          {/* --- Facebook: the timeline, whole --- */}
          <div>
            <AccountHead
              label={FACEBOOK.label}
              handle={FACEBOOK.handle}
              href={FACEBOOK.href}
              blurb={FACEBOOK.blurb}
              Icon={Facebook}
            />

            {loaded ? (
              <div className="mt-s2 overflow-hidden rounded-2xl border border-line bg-paper">
                <iframe
                  src={facebookTimeline()}
                  title={`Recent posts from Al-Anwaar on ${FACEBOOK.label}`}
                  loading="lazy"
                  /* Facebook's own recommended sandbox for the page plugin.
                     scripts and same-origin are what the plugin needs to run;
                     popups and popups-to-escape-sandbox are what lets a post
                     open properly when somebody clicks one. */
                  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
                  className="block h-[640px] w-full border-0"
                />
              </div>
            ) : (
              <Placeholder>{SOCIAL.facebookResting}</Placeholder>
            )}
          </div>

          {/* --- Instagram: individual posts, or the invitation --- */}
          <div>
            <AccountHead
              label={INSTAGRAM.label}
              handle={INSTAGRAM.handle}
              href={INSTAGRAM.href}
              blurb={INSTAGRAM.blurb}
              Icon={Instagram}
            />

            {EMBEDDABLE.length === 0 ? (
              /* No posts listed. Says so, and sends people to the account —
                 see the head of social-data.ts for why this list cannot be
                 filled automatically. */
              <Placeholder>{SOCIAL.instagramEmpty}</Placeholder>
            ) : loaded ? (
              <div className="mt-s2 grid grid-cols-2 gap-s2 xl:grid-cols-3">
                {EMBEDDABLE.map((post) => (
                  <div
                    key={post.code}
                    className={`${POST_RATIO} overflow-hidden rounded-xl border border-line bg-paper`}
                  >
                    <iframe
                      src={`https://www.instagram.com/p/${post.code}/embed/`}
                      title={post.alt}
                      loading="lazy"
                      scrolling="no"
                      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                      className="block h-full w-full border-0"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Placeholder>{SOCIAL.instagramResting}</Placeholder>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/* --- the head above each half -------------------------------------------
   The account's mark, its name and handle, and the line saying what that
   account is for. The whole head is the link out, so somebody who has decided
   they would rather just go to the account does not have to find a small link
   underneath the posts. */
function AccountHead({
  label,
  handle,
  href,
  blurb,
  Icon,
}: {
  label: string
  handle: string
  href: string
  blurb: string
  Icon: (props: { className?: string }) => React.ReactElement
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group flex items-start gap-s2 border-t border-line pt-s2"
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-text-3 transition-colors duration-200 ease-brand group-hover:text-green" />
      <span className="flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-[clamp(19px,1.8vw,23px)] leading-snug tracking-[-0.014em] transition-colors duration-200 ease-brand group-hover:text-green">
            {label}
          </span>
          <span className="text-[13px] text-text-3">{handle}</span>
        </span>
        <span className="mt-1 block max-w-measure text-[14px] leading-relaxed text-text-2">
          {blurb}
        </span>
      </span>
      <ArrowRight className="mt-1.5 h-4 w-4 shrink-0 -rotate-45 text-text-3 transition-all duration-200 ease-brand group-hover:translate-x-1 group-hover:text-green" />
    </a>
  )
}

/* What stands where a frame will go. Deliberately not a grey box with a
   spinner in it: nothing is loading, because nothing has been asked for. It is
   a sentence on paper, the same height as nothing in particular, and it holds
   the column open so pressing the button does not make the page jump. */
function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-s2 flex min-h-[200px] items-center rounded-2xl border border-dashed border-line bg-paper p-s3">
      <p className="max-w-measure text-[14.5px] leading-relaxed text-text-3">{children}</p>
    </div>
  )
}
