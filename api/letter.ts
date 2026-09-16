import { looksAutomated, requestBody, validate, type LetterPayload } from '../src/services/letter'
import { ORG } from '../src/components/org-data'

/* ---------------------------------------------------------------------------
   POST /api/letter

   ⚠ NOT WIRED UP YET, AND IT CANNOT BE FROM HERE.

   Same position as api/contact.ts, and the same reason: this repo builds to a
   static bundle and there is no server in it. This file is the handler that
   endpoint should be, written against the Web `Request`/`Response` signature —
   the one Vercel Functions, Netlify Functions v2, Cloudflare Workers and Deno
   Deploy all take — so whoever picks a host has to change as little as
   possible.

   Two things to do, in this order:

     1. Deploy somewhere with functions. On Vercel and Netlify this path is
        picked up automatically. Then set ENDPOINT in src/services/letter.ts to
        '/api/letter', and the footer stops handing addresses to the writer's own
        email client and starts posting here.

     2. Put the address on a list. See the TODO in `enrol` below. There is no
        list provider in this project, so `enrol` currently writes the address
        to the log and reports that it could not store it. It does NOT return
        ok.

   That last part is the one to leave alone. A box that takes an address and
   shows a tick without keeping it is worse than no box: the person is waiting
   for a letter that will never arrive.

   ── Before this goes live, three things that are law, not taste ─────────
   - **Double opt-in.** `enrol` should send a confirmation link and only add the
     address once it is followed. It stops one person signing another up, and it
     is what every provider expects of an Australian sender.
   - **An unsubscribe link in every letter.** The Spam Act requires a functional
     one. The footer no longer promises it in words, which changes nothing: the
     obligation is on the sender, not on what the page said.
   - **The address is personal information.** It falls under the privacy policy,
     which already says how long subscriptions are kept and how to end one — see
     the retention list in src/pages/Privacy.tsx. If the list lives with a
     provider overseas, that policy has to say so.

   The validation is imported rather than rewritten. Rules that only run in the
   browser are not rules — anything can POST here — and two copies of them would
   be out of step within a month.
--------------------------------------------------------------------------- */

/** Where a hand-run list would be read, if there is no provider yet. */
const TO = ORG.email

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/**
 * Put the address on the list.
 *
 * TODO: there is no list provider in this project. Pick one, add it to
 * package.json, and replace the body of this function with the call. Whatever
 * it is, it must throw or return false on failure rather than swallowing it —
 * see above — and it must confirm the address rather than trusting this POST.
 *
 * Roughly:
 *
 *   await provider.contacts.create({
 *     audienceId: process.env.LETTER_AUDIENCE_ID,
 *     email: payload.email,
 *     unsubscribed: true,           // until the confirmation link is followed
 *   })
 *   return true
 */
async function enrol(payload: LetterPayload): Promise<boolean> {
  console.warn(`[letter] No list configured — nothing was stored for ${TO}:\n${requestBody(payload)}`)
  return false
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ ok: false, message: 'Use POST.' }, 405)
  }

  let payload: LetterPayload
  try {
    const body = (await request.json()) as Partial<LetterPayload>
    /* Coerced rather than trusted. Everything below expects strings, and a
       client that sends null for `email` should get a field error, not a crash
       inside the validator. */
    payload = {
      email: String(body.email ?? ''),
      company: String(body.company ?? ''),
    }
  } catch {
    return json({ ok: false, message: 'That was not JSON.' }, 400)
  }

  const errors = validate(payload)
  if (errors.email) return json({ ok: false, errors }, 422)

  /* Accepted and dropped without a word. Telling a bot it has been caught only
     tells whoever wrote it which field to leave alone next time. */
  if (looksAutomated(payload)) return json({ ok: true })

  const enrolled = await enrol(payload)
  if (!enrolled) {
    return json({ ok: false, message: 'We could not add that. Please try again.' }, 502)
  }

  return json({ ok: true })
}
