/* ---------------------------------------------------------------------------
   The two social accounts, and the posts the site shows from them.

   THESE TWO URLS ARE REAL, AND THEY ARE THE FIRST ONES ON THIS SITE THAT ARE.
   Given by the client on 16 September 2026 and checked the same day: both
   return 200, and Instagram's own page metadata reads "Al-Anwaar Charity
   Organisation (@alanwaarcharity)", which is the account. Everything that used
   to point at facebook.com/alanwaar and instagram.com/alanwaar was a
   placeholder and is now gone — Footer.tsx and org-data.ts both carried their
   own copies and both read this file instead.

   Note the two handles do NOT match each other, and neither matches the
   website: the Facebook page is `alanwaarorgau` and Instagram is
   `alanwaarcharity`. Nothing here derives one from the other for that reason.

   TODO — the other two accounts. org-data.ts still lists a WhatsApp channel
   and a YouTube account, both invented on 8 September 2026 to build the
   contact page's social section against, and neither goes anywhere real. They
   are not in this file because this file is for accounts that exist. Either
   the real URLs land here beside these two, or those two rows come off the
   contact page before launch.

   ---------------------------------------------------------------------------
   WHY NOTHING FROM META LOADS UNTIL SOMEBODY ASKS FOR IT

   Facebook's page plugin and Instagram's post embeds are iframes served by
   Meta. Rendering one sets Meta's cookies on every visitor who so much as
   opens the page, before they have clicked anything and regardless of whether
   they care about the posts — which on a site carrying a privacy policy
   written to the Australian Privacy Principles is a claim the policy would
   then have to cover.

   So both embeds sit behind a click. The section renders a card describing
   what is there, and the iframe is only mounted once somebody presses the
   button — at which point the button says plainly that content is about to
   load from Meta. Nothing is fetched before that, and a reader who never
   presses it is never handed to Facebook at all.

   This is not a new idea on this site: Footer.tsx already loads its
   OpenStreetMap preview only on hover, for the same reason and with the same
   sentence in its comment.

   ---------------------------------------------------------------------------
   INSTAGRAM POSTS HAVE TO BE LISTED BY HAND, AND THERE IS NO WAY AROUND IT

   Facebook's page plugin takes the page URL and shows the timeline itself, so
   the Facebook side needs nothing but the account.

   Instagram has no equivalent. There is no public profile-feed embed: the
   oEmbed endpoint has required an app access token since 2020, and the profile
   page itself serves no post permalinks to anybody who is not logged in —
   checked on 16 September 2026, and the markup comes back with the account's
   name and follower count in its metadata and nothing else. The only embed
   Instagram still serves without credentials is a single post, by shortcode,
   at instagram.com/p/<shortcode>/embed/.

   So POSTS below is typed by hand and it is EMPTY. Until somebody pastes in
   post URLs, the Instagram half of the section is an invitation to go and look
   rather than a grid of posts, which is the honest version of not having them.
   Adding them is the whole job: copy a post's link from Instagram — the
   "Copy link" item on the post's own menu — and paste it in. `shortcodeOf`
   takes the full URL and pulls the code out, so nothing has to be edited by
   hand and a wrong-looking URL is dropped rather than rendered as a broken
   frame.

   FOUR OR SIX, NOT FIVE. The grid runs two across on a phone and three on a
   wide screen, so an odd number leaves a hole in the last row.
--------------------------------------------------------------------------- */

export type Account = {
  /** As it should be read, and as the nav panel prints it. */
  label: string
  /** The public profile. Verified to resolve; see the head of this file. */
  href: string
  /** The @handle, for the places that show one. They differ per platform. */
  handle: string
  /** What this account is actually for, in one line. */
  blurb: string
}

export const FACEBOOK: Account = {
  label: 'Facebook',
  href: 'https://www.facebook.com/alanwaarorgau',
  handle: 'alanwaarorgau',
  blurb: 'The longest record: appeals as they open, and word when a distribution goes out.',
}

export const INSTAGRAM: Account = {
  label: 'Instagram',
  href: 'https://www.instagram.com/alanwaarcharity/',
  handle: '@alanwaarcharity',
  blurb: 'Photographs from the field, and the handovers as they happen.',
}

export const ACCOUNTS: Account[] = [FACEBOOK, INSTAGRAM]

/** The Facebook page plugin, built from the account rather than pasted in, so
 *  the embed and the link can never point at two different pages.
 *
 *  `adapt_container_width` makes it fill whatever column it is given.
 *  `show_facepile` is off: a row of profile photographs of strangers who liked
 *  the page is social proof rather than news, and this section is meant to
 *  show what the charity has posted. */
export function facebookTimeline(height = 640) {
  const params = new URLSearchParams({
    href: FACEBOOK.href,
    tabs: 'timeline',
    height: String(height),
    small_header: 'false',
    adapt_container_width: 'true',
    hide_cover: 'false',
    show_facepile: 'false',
  })
  return `https://www.facebook.com/plugins/page.php?${params}`
}

/** A post URL as copied out of Instagram, in any of the shapes it hands out:
 *  instagram.com/p/<code>/, /reel/<code>/, with or without a query string. */
export type InstagramPost = {
  /** The full URL, exactly as copied. */
  url: string
  /** What is in the frame, for anyone who cannot see it. Instagram's own embed
   *  carries no useful alternative text, so the iframe gets a title from this
   *  and the placeholder card shows it as the caption. */
  alt: string
}

/** EMPTY ON PURPOSE — read the note at the head of this file. Paste four or
 *  six post URLs in and the grid fills itself; leave it empty and the section
 *  says, truthfully, that the posts are on Instagram. */
export const POSTS: InstagramPost[] = []

/** Pulls the shortcode out of a post URL. Returns null for anything that is
 *  not one, so a mistyped row is dropped rather than rendered as a frame that
 *  will not load. */
export function shortcodeOf(url: string): string | null {
  const hit = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/)
  return hit ? hit[1] : null
}

/** Only the rows that are actually a post, with their embed URL worked out. */
export const EMBEDDABLE = POSTS.map((post) => ({ ...post, code: shortcodeOf(post.url) })).filter(
  (post): post is InstagramPost & { code: string } => post.code !== null,
)
