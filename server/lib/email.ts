import nodemailer, { type Transporter } from 'nodemailer'
import type { Types } from 'mongoose'
import { env } from '../env'
import { EmailMessage, getSettings } from '../models'
import type { Email } from '../emails/templates'
import { alert } from './alert'

/* ---------------------------------------------------------------------------
   Sending email.

   With SMTP configured (Amazon SES's SMTP endpoint in production) mail goes
   out for real. Without it, nothing leaves the machine: the message is stored
   with transport 'outbox' and appears in Admin > Email log, rendered, so a
   receipt or a sign-in code can be read in development exactly as a donor
   would see it. Either way every message is recorded against the donor.

   A failed send is recorded as failed and does not throw — a receipt that
   could not be emailed must never undo the gift it is for.
--------------------------------------------------------------------------- */

let transport: Transporter | null = null
function smtp() {
  if (!env.smtp) return null
  transport ??= nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  })
  return transport
}

const toText = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(br|\/p|\/tr|\/h\d|\/li)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

/* For the browser tests only (scripts/e2e-server.ts): a listener handed the
   real message whenever one goes to the development outbox, so a test can
   follow a link that, by design, never reaches the email log. The outbox is
   never used in production (above), and the setter refuses there anyway. */
let outboxTap: ((to: string, email: Email) => void) | null = null
export function tapOutbox(fn: (to: string, email: Email) => void) {
  if (env.isProd) throw new Error('the outbox tap is for tests')
  outboxTap = fn
}

export async function sendEmail(
  to: string,
  email: Email,
  links: { donor?: Types.ObjectId | string; campaign?: Types.ObjectId | string } = {},
) {
  /* what the log keeps: the redacted copy when the email carries a secret
     (templates.ts, "SECRETS NEVER REACH THE EMAIL LOG"), the email otherwise */
  const kept = email.logged ?? email
  const record = { to, subject: kept.subject, template: email.template, html: kept.html, text: toText(kept.html), donor: links.donor, campaign: links.campaign }

  /* a donor entered at an event without an email gets a placeholder address
     on the reserved .invalid domain; nothing is sent to it, but the attempt is
     still recorded against them so the record shows why no receipt went */
  if (to.trim().toLowerCase().endsWith('.invalid')) {
    const row = await EmailMessage.create({ ...record, transport: smtp() ? 'smtp' : 'outbox', status: 'failed', error: 'No email address on file' })
    return { ok: false as const, id: row.id as string, error: 'No email address on file' }
  }
  const t = smtp()

  /* PRODUCTION WITH NO MAIL SERVER: the outbox is a development convenience.
     In production it used to record the message as "sent" — and a receipt
     marked emailed that nobody received is worse than one marked failed, which
     staff can see and resend. env.ts refuses to start production without SMTP
     unless ALLOW_SIMULATED_PAYMENTS=1 (staging), so this is staging's path. */
  if (!t && env.isProd) {
    const row = await EmailMessage.create({ ...record, transport: 'outbox', status: 'failed', error: 'No mail server configured' })
    alert('email', `not sent to ${to} (${email.template}): no mail server configured`)
    /* staging only (ALLOW_SIMULATED_PAYMENTS=1, no SMTP): an invitation or
       reset link has nowhere else to go, so the API's own log gets it — the
       one way in for staff on a staging deploy that has no mail server */
    if (env.allowSimulated && email.logged) console.log('[email] (staging, no mail server) the unredacted message:', toText(email.html))
    return { ok: false as const, id: row.id as string, error: 'No mail server configured' }
  }

  const row = await EmailMessage.create({
    ...record,
    transport: t ? 'smtp' : 'outbox',
    status: t ? 'queued' : 'sent',
    sentAt: t ? undefined : new Date(),
  })
  if (!t) {
    outboxTap?.(to, email)
    console.log(`[email] outbox → ${to}: ${email.subject}`)
    /* the log never shows a secret, so in development (no mail server, never
       production — see above) the real one is printed here instead: this is
       where a developer finds an invitation or reset link */
    if (email.logged) console.log('[email] (development only) the unredacted message:', toText(email.html))
    return { ok: true as const, id: row.id as string }
  }
  try {
    const s = await getSettings()
    await t.sendMail({
      from: `"${s.email.fromName}" <${s.email.fromEmail}>`,
      replyTo: s.email.replyTo,
      to,
      subject: email.subject,
      html: email.html,
      /* from the real message, not the row: the row may be the redacted copy */
      text: toText(email.html),
      headers: email.headers,
    })
    row.status = 'sent'
    row.sentAt = new Date()
    await row.save()
    return { ok: true as const, id: row.id as string }
  } catch (err) {
    row.status = 'failed'
    row.error = err instanceof Error ? err.message : String(err)
    await row.save()
    alert('email', `failed to ${to} (${email.template}): ${row.error}`)
    return { ok: false as const, id: row.id as string, error: row.error }
  }
}

export const emailTransport = () => (env.smtp ? 'smtp' : 'outbox')

/** Whether a sign-in code may be handed back to the screen that asked for it:
 *  only with no mail server, and only in development or on a deploy declared
 *  staging (ALLOW_SIMULATED_PAYMENTS=1). Never on a live deploy, never when the
 *  code actually goes by email. Without this, staging — no SMTP, a redacted
 *  email log — had no way for anyone to sign in by code. */
export const showsCodesOnScreen = () => emailTransport() === 'outbox' && (!env.isProd || env.allowSimulated)
