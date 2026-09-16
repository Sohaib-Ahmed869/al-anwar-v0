import {
  looksAutomated,
  messageBody,
  validate,
  type ContactPayload,
} from '../src/services/contact'
import { ORG } from '../src/components/org-data'

/* ---------------------------------------------------------------------------
   POST /api/contact

   ⚠ NOT WIRED UP YET, AND IT CANNOT BE FROM HERE.

   This repo builds to a static bundle: `vite build` emits dist/, and there is
   no server in it and no host configured. This file is the handler that
   endpoint should be, written against the Web `Request`/`Response` signature —
   the one Vercel Functions, Netlify Functions v2, Cloudflare Workers and Deno
   Deploy all take — so that whoever picks a host has to change as little as
   possible. Until one is picked, nothing runs it.

   Two things to do, in this order:

     1. Deploy somewhere with functions. On Vercel and Netlify this path is
        picked up automatically. Then set ENDPOINT in src/services/contact.ts
        to '/api/contact', and the form stops handing messages to the writer's
        own email client and starts posting here.

     2. Send the mail. See the TODO in `deliver` below. There is no mailer in
        this project — no nodemailer, no Resend, no SES, nothing — so `deliver`
        currently writes the message to the log and reports that it could not
        send it. It does NOT return ok.

   That last part is the one to leave alone. A contact form that swallows a
   message and shows a green tick is worse than no contact form at all: the
   person walks away believing they have been heard. If the mail cannot be
   sent, this must say so, and the form will keep everything they typed.

   The validation is imported rather than rewritten. Rules that only run in the
   browser are not rules — anything can POST here — and two copies of them would
   be out of step within a month.
--------------------------------------------------------------------------- */

/** Where messages from the form go. Same address the site prints everywhere. */
const TO = ORG.email

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/**
 * Hand the message to a mailer.
 *
 * TODO: there is no mailer in this project. Pick one, add it to package.json,
 * and replace the body of this function with the send. Whatever it is, it must
 * throw or return false on failure rather than swallowing it — see above.
 *
 * Roughly:
 *
 *   await resend.emails.send({
 *     from: 'website@alanwaar.group',
 *     to: TO,
 *     replyTo: payload.email,          // so hitting reply reaches the person
 *     subject: `${payload.topic} — ${payload.name}`,
 *     text: messageBody(payload),
 *   })
 *   return true
 *
 * `replyTo` is the part that is easy to leave out and annoying to live without.
 */
async function deliver(payload: ContactPayload): Promise<boolean> {
  console.warn(
    `[contact] No mailer configured — message to ${TO} was NOT sent:\n${messageBody(payload)}`,
  )
  return false
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ ok: false, message: 'Use POST.' }, 405)
  }

  let payload: ContactPayload
  try {
    const body = (await request.json()) as Partial<ContactPayload>
    /* Coerced rather than trusted. Everything below expects strings, and a
       client that sends null for `message` should get a field error, not a
       crash inside the validator. */
    payload = {
      name: String(body.name ?? ''),
      email: String(body.email ?? ''),
      phone: String(body.phone ?? ''),
      topic: String(body.topic ?? ''),
      message: String(body.message ?? ''),
      consent: body.consent === true,
      company: String(body.company ?? ''),
    }
  } catch {
    return json({ ok: false, message: 'That was not JSON.' }, 400)
  }

  const errors = validate(payload)
  if (Object.keys(errors).length) return json({ ok: false, errors }, 422)

  /* Accepted and dropped without a word. Telling a bot it has been caught only
     tells whoever wrote it which field to leave alone next time. */
  if (looksAutomated(payload)) return json({ ok: true })

  const delivered = await deliver(payload)
  if (!delivered) {
    return json({ ok: false, message: 'We could not send that. Please try again.' }, 502)
  }

  return json({ ok: true })
}
