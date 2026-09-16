import { MESSAGE_MAX, MESSAGE_MIN, TOPICS, CONTACT } from '../components/contact-data'
import { ORG } from '../components/org-data'

/* ---------------------------------------------------------------------------
   What a contact message is, whether it is checked, and where it goes.

   Two consumers, deliberately:
     - the form in sections/ContactForm.tsx, in the browser
     - api/contact.ts, on whatever eventually serves it

   which is the whole reason `validate` lives here rather than in the component.
   Validation that only runs in the browser is not validation; anything can POST
   to an endpoint. The rules have to be the same in both places, so they are
   written once and imported twice.

   Nothing at the top level of this module touches `window`. That is what keeps
   it importable from a server — check before adding anything here.

   ── Where it posts ──────────────────────────────────────────────────────
   ENDPOINT is empty, because this site has no server yet. Until it is filled
   in, `submit` hands the finished message to the writer's own email client and
   says so. It does NOT show a tick.

   That distinction is the point, and it should survive whoever wires this up:
   a contact form that swallows a message and shows a green tick is worse than
   no contact form at all, because the person walks away believing they have
   been heard. `Sent` below has two shapes for exactly that reason, and the
   success card reads differently for each.
--------------------------------------------------------------------------- */

/** Fill this in once there is somewhere to post to. See api/contact.ts. */
export const ENDPOINT = ''

export type ContactPayload = {
  name: string
  email: string
  /** Optional. Australian shapes are tidied on blur, never rejected on shape
   *  alone unless it cannot be a phone number at all. */
  phone: string
  topic: string
  message: string
  consent: boolean
  /** The honeypot. A real person never sees this field, so anything in it came
   *  from something filling the form in by machine. Named for what a bot would
   *  expect to find rather than for what it does. */
  company?: string
}

export type ContactField = 'name' | 'email' | 'phone' | 'topic' | 'message' | 'consent'
export type FieldErrors = Partial<Record<ContactField, string>>

/* Deliberately loose. An address either has the shape of one or it does not;
   anything stricter starts rejecting real addresses, and the only test that
   matters is whether the reply arrives. */
const EMAIL_LOOKS_RIGHT = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** The site's one idea of what an address is. services/letter.ts asks this too,
 *  so the contact form and the letter band cannot end up disagreeing about
 *  whether somebody's address is one. */
export const looksLikeEmail = (raw: string) => EMAIL_LOOKS_RIGHT.test(raw.trim())

/** Digits only, so a number can be checked and formatted without caring how it
 *  was typed. */
const digitsOf = (s: string) => s.replace(/\D/g, '')

/**
 * The rules, in one place, for the browser and the server both.
 *
 * `topic` is checked against TOPICS rather than merely being non-empty: it goes
 * into the routing decision at the other end, so a value that is not one of the
 * six is a bug or a forgery, not a typo.
 */
export function validate(payload: ContactPayload): FieldErrors {
  const e = CONTACT.form.errors
  const bad: FieldErrors = {}

  if (!payload.name.trim()) bad.name = e.name

  const email = payload.email.trim()
  if (!email) bad.email = e.email
  else if (!looksLikeEmail(email)) bad.email = e.emailShape

  /* Optional, so an empty one is fine. A given one has to be able to be a
     number: Australian numbers are 8 digits (local) to 10 (with area code or
     mobile prefix), and up to 15 with an international prefix. */
  const phone = digitsOf(payload.phone)
  if (payload.phone.trim() && (phone.length < 8 || phone.length > 15)) bad.phone = e.phone

  if (!TOPICS.includes(payload.topic as (typeof TOPICS)[number])) bad.topic = e.topic

  const message = payload.message.trim()
  if (!message) bad.message = e.message
  else if (message.length < MESSAGE_MIN) bad.message = e.messageShort
  else if (message.length > MESSAGE_MAX) bad.message = e.messageLong

  if (!payload.consent) bad.consent = e.consent

  return bad
}

/** True when something filled the honeypot in. Kept out of `validate` on
 *  purpose: a bot must not be told which field gave it away, so this is
 *  answered silently rather than as a field error. */
export const looksAutomated = (payload: ContactPayload) => Boolean(payload.company?.trim())

/**
 * Tidy an Australian number, on blur, without ever refusing one.
 *
 * Light on purpose: it puts the spaces where an Australian would put them, and
 * hands anything it does not recognise straight back untouched. A formatter
 * that mangles a number somebody typed correctly — an international one, an
 * extension — is worse than no formatter.
 */
export function tidyPhone(raw: string): string {
  const input = raw.trim()
  if (!input || input.startsWith('+')) return input

  const d = digitsOf(input)

  // 13/1300/1800 service numbers: 1300 000 000, 1800 000 000, 13 00 00.
  if (/^1(300|800)\d{6}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
  if (/^13\d{4}$/.test(d)) return `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4)}`

  // Mobiles: 04XX XXX XXX.
  if (/^04\d{8}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`

  // Landlines with an area code: (02) 9876 5432.
  if (/^0[2378]\d{8}$/.test(d)) return `(${d.slice(0, 2)}) ${d.slice(2, 6)} ${d.slice(6)}`

  // Landlines without one: 9876 5432.
  if (/^\d{8}$/.test(d)) return `${d.slice(0, 4)} ${d.slice(4)}`

  return input
}

/** What the office reads. Assembled here rather than in the component so the
 *  POST body and the mailto body cannot drift apart. */
export function messageBody(payload: ContactPayload): string {
  return [
    `Subject: ${payload.topic}`,
    `Name: ${payload.name.trim()}`,
    `Email: ${payload.email.trim()}`,
    payload.phone.trim() ? `Phone: ${payload.phone.trim()}` : null,
    '',
    payload.message.trim(),
  ]
    .filter((line) => line !== null)
    .join('\n')
}

export type Sent =
  /** It reached us. */
  | { ok: true; via: 'endpoint' }
  /** It is written out in their email client, unsent. Say so; do not show a tick. */
  | { ok: true; via: 'mail' }
  | { ok: false; errors?: FieldErrors; message: string }

/**
 * Send it, or hand it over.
 *
 * `window` is touched only in here, never at the top level, so this module
 * stays importable from a server — see the note at the top.
 */
export async function submit(payload: ContactPayload): Promise<Sent> {
  const errors = validate(payload)
  if (Object.keys(errors).length) {
    return { ok: false, errors, message: CONTACT.form.errors.failed }
  }

  /* Silently accepted and silently dropped. Telling a bot it has been caught
     only tells whoever wrote it which field to leave alone next time. */
  if (looksAutomated(payload)) return { ok: true, via: 'endpoint' }

  if (ENDPOINT) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = (await res.json().catch(() => null)) as
        | { ok: boolean; errors?: FieldErrors }
        | null

      if (res.ok && body?.ok) return { ok: true, via: 'endpoint' }
      return {
        ok: false,
        errors: body?.errors,
        message: CONTACT.form.errors.failed,
      }
    } catch {
      /* Offline, blocked, or the endpoint is down. The person keeps everything
         they typed — the form is not cleared on a failure. */
      return { ok: false, message: CONTACT.form.errors.failed }
    }
  }

  window.location.href = `mailto:${ORG.email}?subject=${encodeURIComponent(
    `${payload.topic}: ${payload.name.trim()}`,
  )}&body=${encodeURIComponent(messageBody(payload))}`

  return { ok: true, via: 'mail' }
}
