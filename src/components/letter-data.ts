/* ---------------------------------------------------------------------------
   Every word in the letter, in one place.

   components/Letter.tsx holds no copy of its own, the same way the contact
   sections hold none: somebody in the office should be able to change what the
   footer promises without opening a component. The error messages are read by
   services/letter.ts as well, so the browser and the server complain in the
   same words.

   ⚠ THE TITLE IS A PROMISE, NOT COPY
   "Once a month" is an undertaking to everybody who hands over an address, and
   the office has to be able to keep it. If the list is going to go out
   fortnightly, or whenever there is something to say, then this is the file
   that has to change first — not the sending schedule afterwards. Confirm it
   with whoever will write the letter before launch.

   The block says nothing else. It was a heading, a paragraph explaining what
   the letter contains, and a line of small print about stopping it and about
   the privacy policy; all of that is gone, and the title carries the offer on
   its own. What was in the small print has not been lost — the footer's own
   bottom row links the privacy policy two rows below this, and the unsubscribe
   link in every letter is required by the Spam Act whether or not a page
   promises one. See server/emails/layout.ts, which draws it.
--------------------------------------------------------------------------- */

export const LETTER = {
  eyebrow: 'The letter',
  title: 'Once a month, what your giving did.',
  label: 'Email address',
  placeholder: 'you@example.com',
  button: 'Subscribe',
  sending: 'Adding…',

  /* One message per rule, each one saying what to do rather than what went
     wrong. The shape message is word for word the contact form's — it is the
     same complaint about the same thing, and the site should only have one way
     of saying it. */
  errors: {
    email: 'We need an address to send it to.',
    emailShape: 'That address is missing something.',
    failed: 'Sorry, that did not go through. Try again, or email us.',
  },

  /* Since 7 October 2026 joining takes two steps (double opt-in, finding
     M10): the form only sends a link, and the address is added when its owner
     clicks it. So the footer says "check your inbox", never "you are on the
     list" — that would be the small broken promise this block exists to
     avoid. The server answers the same way for every address, so this says
     the same thing to everyone. */
  joined: {
    title: 'Check your inbox.',
    body: 'We have sent a link to that address. Click it and the letter is yours, from the start of next month. Nothing is sent until you do.',
    /* The mailto hand-off is not a subscription, and it must never be dressed
       as one. See the note on ENDPOINT in services/letter.ts. */
    handedOff: 'Over to your email app.',
    handedOffBody:
      'A one-line message is written out and ready to send from your own email. Send it and we will add you by hand. If nothing opened, write to us at',
    again: 'Use a different address',
  },
} as const

/** The page the confirmation link opens (/letter/confirm). */
export const LETTER_CONFIRM = {
  eyebrow: 'The letter',
  title: 'Confirm your email',
  body: 'One click and the monthly letter starts coming to you: once a month, what your giving did.',
  button: 'Yes, send me the letter',
  done: { title: 'You are on the list.', body: 'The next letter goes out at the start of the month. You can stop it at any time from the link at the foot of every letter.' },
  failed: 'That link has expired or has already been used. You can sign up again from the bottom of any page.',
  missing: 'This page needs the link from your email. Open the email we sent and click the button in it.',
} as const
