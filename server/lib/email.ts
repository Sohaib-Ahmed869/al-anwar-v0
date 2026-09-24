import nodemailer, { type Transporter } from 'nodemailer'
import type { Types } from 'mongoose'
import { env } from '../env'
import { EmailMessage, getSettings } from '../models'
import type { Email } from '../emails/templates'

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

export async function sendEmail(
  to: string,
  email: Email,
  links: { donor?: Types.ObjectId | string; campaign?: Types.ObjectId | string } = {},
) {
  /* a donor entered at an event without an email gets a placeholder address
     on the reserved .invalid domain; nothing is sent to it, but the attempt is
     still recorded against them so the record shows why no receipt went */
  if (to.trim().toLowerCase().endsWith('.invalid')) {
    const row = await EmailMessage.create({
      to,
      subject: email.subject,
      template: email.template,
      html: email.html,
      text: toText(email.html),
      transport: smtp() ? 'smtp' : 'outbox',
      status: 'failed',
      error: 'No email address on file',
      donor: links.donor,
      campaign: links.campaign,
    })
    return { ok: false as const, id: row.id as string, error: 'No email address on file' }
  }
  const t = smtp()
  const row = await EmailMessage.create({
    to,
    subject: email.subject,
    template: email.template,
    html: email.html,
    text: toText(email.html),
    transport: t ? 'smtp' : 'outbox',
    status: t ? 'queued' : 'sent',
    sentAt: t ? undefined : new Date(),
    donor: links.donor,
    campaign: links.campaign,
  })
  if (!t) {
    if (!env.isProd) console.log(`[email] outbox → ${to}: ${email.subject}`)
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
      text: row.text ?? undefined,
    })
    row.status = 'sent'
    row.sentAt = new Date()
    await row.save()
    return { ok: true as const, id: row.id as string }
  } catch (err) {
    row.status = 'failed'
    row.error = err instanceof Error ? err.message : String(err)
    await row.save()
    console.error('[email] failed', to, email.subject, row.error)
    return { ok: false as const, id: row.id as string, error: row.error }
  }
}

export const emailTransport = () => (env.smtp ? 'smtp' : 'outbox')
