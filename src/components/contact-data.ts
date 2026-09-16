import { PHONE } from './nav-data'
import { ORG } from './org-data'

/* ---------------------------------------------------------------------------
   Every word on the contact page, in one place.

   The sections under sections/Contact*.tsx hold no copy of their own: they read
   it from here. Somebody in the office should be able to change what the page
   says without opening a component, and the four sections should not be able to
   drift out of step with each other about the phone number or the hours.

   The facts that a legal document has to state exactly the same way every time
   — the address, the email, the phone — are NOT retyped here. They come from
   org-data.ts and nav-data.ts, which the legal pages and the footer read too.
--------------------------------------------------------------------------- */

/** Where the address search and the directions link both point. */
/** One string, so the directions link cannot disagree with the address printed
 *  above it. It outlived the map embed that used to share it. */
export const ADDRESS = `${ORG.street}, ${ORG.suburb}`

export const DIRECTIONS =
  'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(ADDRESS)

/** The id the hero's primary button scrolls to. */
export const FORM_ID = 'send-a-message'

/** What the message can be about. The order is the order they are shown in, and
 *  the string is what lands in the office inbox — so these read as a subject
 *  line, not as a code.
 *
 *  THESE ARE ROUTING, NOT COPY. Whoever reads the inbox sorts on them, so a
 *  topic is not added lightly. "Fundraising or an event" was added on
 *  16 September 2026 because the Get involved page invites people to run a
 *  fundraiser and there was no subject line for the reply to arrive under —
 *  they would all have landed in "Something else". THE OFFICE SHOULD CONFIRM
 *  it wants that as a separate pile before launch; the alternative is folding
 *  it back into Volunteering and changing the one link in involved-data.ts.
 *
 *  The Get involved page deep-links into the form with `?topic=` set to one of
 *  these strings, which is why they are exported and why ContactForm checks
 *  what arrives against this list rather than trusting it. */
export const TOPICS = [
  'A gift or a receipt',
  'A monthly gift',
  'Zakat',
  'Volunteering',
  'Fundraising or an event',
  'Partnership or media',
  'Something else',
] as const

export type Topic = (typeof TOPICS)[number]

export const MESSAGE_MAX = 1000
export const MESSAGE_MIN = 10

/* The hero used to end on three facts — "We reply within / One working day",
   the number and its hours, the street and its suburb — set along a hairline
   at the foot of the band. They are gone, and so is the type that described
   them; the note at the top of ContactHero.tsx says why.

   None of the three was lost with them. The reply time is the last sentence of
   the form's own intro, and the number and the address are the ledger in
   section 2, which is where the page properly says them. */

export const CONTACT = {
  hero: {
    eyebrow: 'Contact',
    title: 'Talk to a person.',
    intro:
      'Everything sent from this page is read by somebody who works here. Tell us what it is about, and we will put it in front of whoever can actually answer it.',
    primary: 'Send a message',
    secondary: `Call ${PHONE.label}`,
    scrollHint: 'Scroll to the form',
  },

  reach: {
    eyebrow: 'Get in touch',
    title: 'We are easy to find.',

    /* The photograph at the head of the panel. Al-Anwaar's own frame, not
       stock — the licence note is at the top of ContactForm.tsx, and the alt
       says only what is visible in it. The path is here rather than in the
       section only so that the words and the picture they describe cannot
       drift apart. */
    photo: {
      src: '/assets/images/WhatsApp-Image-2024-03-01-at-10.21.59-AM.jpeg',
      alt: 'Families collecting meals handed down from the back of a distribution van',
    },

    /* Whether anyone is at the desk right now, worked out from the clock —
       see deskStatus() in ContactForm.tsx, which fills in {when} and {time}.
       It is the same fact as PHONE.hours, said in the present tense, so if the
       hours change both have to move. */
    desk: {
      open: 'Open now',
      openBody: 'Somebody is at the desk. The phone is answered until 5pm.',
      closed: 'Closed',
      closedBody: 'The desk opens again {when}. Anything sent now is read when it does.',
      soon: 'this morning',
      tomorrow: 'tomorrow morning',
      onDay: 'on {day}',
      clock: '{time} in Sydney',
    },

    email: { label: 'Email', copy: 'Copy address', copied: 'Copied' },
    phone: { label: 'Phone' },
    warehouse: { label: 'The warehouse', directions: 'Get directions' },
  },

  form: {
    eyebrow: 'Send a message',
    title: 'What is it about?',
    intro:
      'Fill this in and it goes to the right team. You will hear back within one working day.',
    /* Narrow screens only. The panel with the number in it is under the form
       there rather than beside it, so this is the one line that says a phone
       call is still an option before somebody starts typing. */
    ratherRing: 'Would rather ring?',

    name: 'Full name',
    email: 'Email',
    phone: 'Contact number',
    phoneHint: 'Optional. Only if you would rather we rang.',
    topic: 'What is it about?',
    topicPlaceholder: 'Choose one',
    message: 'Message',
    /* The only placeholder on the form, and it asks for the thing people leave
       out: not what they want, but enough of the story to act on it. */
    messagePlaceholder: 'Tell us what it is about, and anything we would need to know…',
    messageHint: `Up to ${MESSAGE_MAX} characters.`,
    consent: 'I am happy for Al-Anwaar to reply to me by email or phone.',

    /* The count on the rule above the button. {done} and {total} are filled in
       by the section. It is a tally of what is filled in, not a promise that
       what is in there is right — that is what the field messages are for. */
    progress: '{done} of {total} filled in',
    progressDone: 'All filled in.',

    send: 'Send message',
    sending: 'Sending…',
    privacy: 'What we do with this is in the',
    privacyLink: 'privacy policy',

    /* One message per rule, and each one says what to do rather than what went
       wrong. "Email is invalid" tells somebody nothing they cannot see. */
    errors: {
      name: 'We need something to call you.',
      email: 'We need an address to reply to.',
      emailShape: 'That address is missing something.',
      phone: 'That does not look like a number we can ring.',
      topic: 'Pick the closest one so it reaches the right team.',
      message: 'Tell us what it is about.',
      messageShort: 'Tell us a little more than that.',
      messageLong: `That is over ${MESSAGE_MAX} characters. Trim it, or ring us instead.`,
      consent: 'We need your say-so before we can write back.',
      failed: 'Sorry, that did not send. Try again, or email us directly.',
    },

    sent: {
      title: 'Got it.',
      body: 'A person will reply within one working day.',
      /* The mailto hand-off is not a send, and it must never be dressed as one.
         See the note on ENDPOINT in services/contact.ts. */
      handedOff: 'Over to your email app.',
      handedOffBody:
        'Your message is written out and ready to send from your own email. If nothing opened, write to us directly and we will pick it up there.',
      again: 'Send another',
    },
  },

  social: {
    eyebrow: 'Stay connected',
    title: 'We post what has gone out, and where.',
    intro:
      'Field photographs from the team each week. A message to any of them reaches the same office as this form, only slower.',

    /** Which account takes the wide banner. It has to be a label in SOCIALS;
     *  anything else and the first account takes it instead. The channel,
     *  because it is the only one of the four that reaches somebody without
     *  their having to go and look. */
    feature: 'WhatsApp',
    /** {who} is the handle read off the account's own URL — "@alanwaar" — or,
     *  when there is no handle to read, "us on Instagram". */
    featureTitle: 'Follow {who}',
    featureFallback: 'us on {label}',
    featureBody: 'Appeals as they open, and word when something goes out.',
    featureAction: 'Open {label}',

    /** The rule-flanked label over whatever the banner did not take. */
    also: 'Also find us on',

    /** One line per account, for the cards under the banner. An account with no
     *  line here shows its name and nothing else, which is why this is a
     *  lookup rather than a field on SOCIALS: org-data holds the facts every
     *  page needs, and this is copy only this section says. */
    blurbs: {
      WhatsApp: 'Appeals and short notices.',
      Instagram: 'Photographs from the field.',
      Facebook: 'The longest record of what has gone out.',
      YouTube: 'Longer films from the projects.',
    },
  },
} as const
