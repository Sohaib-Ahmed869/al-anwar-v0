/* ---------------------------------------------------------------------------
   Words for the "someone just gave" toast (RecentGifts.tsx) and the give
   form's tick box that keeps a name out of it.

   The feed comes from GET /api/public/recent-gifts (server/routes/
   recent-gifts.ts), which already strips everything but a first name, a
   suburb, the amount, the cause and the time. A gift given anonymously comes
   back with no name and no place, and reads as "Someone".

   Timing lives here too, so whoever tunes how pushy the toast feels changes
   one file. A toast every ten seconds or so, up for five, is what the client
   pointed at (werehumanity.org); slower than that and nobody sees one, faster
   and it starts to feel like a sales page.
--------------------------------------------------------------------------- */

export const RECENT_GIFTS = {
  endpoint: '/api/public/recent-gifts',
  /** the first one waits until the reader has had a look at the page */
  firstDelayMs: 6000,
  /** time on screen */
  visibleMs: 5000,
  /** gap between one leaving and the next arriving */
  gapMs: 6000,
  /** sessionStorage key: closing it once keeps it closed for the visit */
  dismissKey: 'aa-recent-gifts-dismissed',
  /** where it is never shown: checkout and the thank-you page have one job */
  hiddenOn: ['/give', '/thank-you'],
  someone: 'Someone',
  gave: 'donated',
  to: 'to',
  from: 'from',
  close: 'Hide recent donations',
  label: 'Recent donation',
}

/** "3 min ago", "2 hours ago", "yesterday". Coarse on purpose. */
export function agoOf(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

/** The give form's tick box, beside "send me word of what this fund did". */
export const GIVE_ANON_LABEL = 'Give anonymously. Leave my name off the recent donations shown on the site.'
