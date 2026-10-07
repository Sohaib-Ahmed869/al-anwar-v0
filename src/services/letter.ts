import { LETTER } from '../components/letter-data'
import { looksLikeEmail } from './contact'
import { ORG } from '../components/org-data'

/* ---------------------------------------------------------------------------
   What joining the letter is, whether it is checked, and where it goes.

   Built the same way services/contact.ts is: the rule lives here, apart from
   components/Letter.tsx, the block at the top of the footer. Validation that
   only runs in the browser is not validation; anything can POST to an
   endpoint, so the server checks the address again (zLetter in
   server/routes/public.ts) and the two have to agree.

   Nothing at the top level of this module touches `window`, which is what keeps
   it importable from a server. Check that before adding anything here.

   ── Where it posts ──────────────────────────────────────────────────────
   ENDPOINT is the platform API (server/routes/public.ts), which emails the
   address a link to confirm it (double opt-in) and changes nothing else; the
   link opens /letter/confirm, whose button calls confirmLetter() below, and
   only then is the address put on the list. The server answers the same for
   every address, so this cannot be used to learn who is a supporter. If
   ENDPOINT is ever emptied, `submit` hands a one-line message to the writer's
   own email client and says so on screen. It does NOT show a tick.

   That distinction is carried over from the contact form deliberately. An
   address typed into a box that goes nowhere is worse than no box at all: the
   person walks away believing they will hear from us in a month, and then does
   not, and the first thing this charity ever did for them was break a small
   promise. `Joined` below has two shapes for exactly that reason, and the footer
   reads differently for each.
--------------------------------------------------------------------------- */

/** The platform API. Empty it to fall back to the mail client. */
export const ENDPOINT = '/api/public/letter'

export type LetterPayload = {
  email: string
  /** The honeypot. A real person never sees this field, so anything in it came
   *  from something filling the form in by machine. Named for what a bot would
   *  expect to find rather than for what it does — the same trick, and the same
   *  field name, as the contact form. */
  company?: string
}

export type LetterErrors = { email?: string }

/** The rules, in one place, for the browser and the server both. One field, so
 *  this is short — it is a function rather than an inline check because the
 *  server has to be able to run the identical thing. */
export function validate(payload: LetterPayload): LetterErrors {
  const e = LETTER.errors
  const email = payload.email.trim()

  if (!email) return { email: e.email }
  if (!looksLikeEmail(email)) return { email: e.emailShape }
  return {}
}

/** True when something filled the honeypot in. Kept out of `validate` on
 *  purpose: a bot must not be told which field gave it away, so this is
 *  answered silently rather than as a field error. */
export const looksAutomated = (payload: LetterPayload) => Boolean(payload.company?.trim())

/** What the office reads if this arrives as mail rather than as a POST. */
export function requestBody(payload: LetterPayload): string {
  return `Please add ${payload.email.trim()} to the monthly letter.`
}

export type Joined =
  /** It reached the list. */
  | { ok: true; via: 'endpoint' }
  /** It is written out in their email client, unsent. Say so; do not show a
   *  tick. */
  | { ok: true; via: 'mail' }
  | { ok: false; errors?: LetterErrors; message: string }

/**
 * Join, or hand it over.
 *
 * `window` is touched only in here, never at the top level, so this module
 * stays importable from a server — see the note at the top.
 */
export async function submit(payload: LetterPayload): Promise<Joined> {
  const errors = validate(payload)
  if (errors.email) return { ok: false, errors, message: LETTER.errors.failed }

  /* Silently accepted and silently dropped. Telling a bot it has been caught
     only tells whoever wrote it which field to leave alone next time. */
  if (looksAutomated(payload)) return { ok: true, via: 'endpoint' }

  if (ENDPOINT) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'aa' },
        body: JSON.stringify(payload),
      })
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: { fields?: LetterErrors } }
        | null

      if (res.ok && body?.ok) return { ok: true, via: 'endpoint' }
      const email = body?.error?.fields?.email
      return { ok: false, errors: email ? { email } : undefined, message: LETTER.errors.failed }
    } catch {
      /* Offline, blocked, or the endpoint is down. The address stays in the
         field — nothing is cleared on a failure. */
      return { ok: false, message: LETTER.errors.failed }
    }
  }

  window.location.href = `mailto:${ORG.email}?subject=${encodeURIComponent(
    'Add me to the letter',
  )}&body=${encodeURIComponent(requestBody(payload))}`

  return { ok: true, via: 'mail' }
}

/** The confirmation link's page posts its token here. */
export async function confirmLetter(token: string): Promise<{ ok: true } | { ok: false; message?: string }> {
  try {
    const res = await fetch(`${ENDPOINT}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'aa' },
      body: JSON.stringify({ t: token }),
    })
    if (res.ok) return { ok: true }
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    return { ok: false, message: body?.error?.message }
  } catch {
    return { ok: false }
  }
}
