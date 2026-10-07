import { Router } from 'express'
import { z } from 'zod'
import { EMAIL_TOPICS, type EmailTopic } from '../../../shared/domain'
import { emailChangedEmail } from '../../emails/account'
import { otpEmail } from '../../emails/templates'
import { env } from '../../env'
import { audit } from '../../lib/audit'
import { signInDonor } from '../../lib/auth'
import { sendEmail, showsCodesOnScreen } from '../../lib/email'
import { HttpError, parse, zEmail } from '../../lib/http'
import { consumeOtp, issueOtp } from '../../lib/otp'
import { limiter } from '../../lib/ratelimit'
import { Donor, Enquiry } from '../../models'
import { donorName, donorOut, me } from './util'

/* ---------------------------------------------------------------------------
   /api/me/profile — the donor's own details and preferences.

   Changing the sign-in email is two steps: a code goes to the NEW address,
   and only a correct code moves it. The old address is kept in altEmails, so
   a gift later made with it still lands on this record and a bank matcher
   that learnt it keeps working — but it is also retired as a login
   (retiredLogins), because whoever reads that mailbox later need not be this
   donor. The old address is told about the change, which is the only warning
   its owner gets if it wasn't them, and every other session the donor has is
   ended (this one is re-issued).

   The code is stored under a key naming this donor and the new address
   ("change:<id>:<email>") rather than the bare address, so it can never be
   mistaken for, or wipe out, a sign-in code for that address. Codes sent and
   wrong guesses are capped per donor (lib/otp.ts): a code that moves an
   address onto this account is worth guessing.

   Deleting an account is a request, not a button: gift records must be kept
   for seven years for the ATO, so a person in the office handles it and
   writes back. It arrives as an enquiry on the donor's record.
--------------------------------------------------------------------------- */

const r = Router()

const limit = limiter({ name: 'me-profile', windowMs: 15 * 60_000, limit: 20 })

const changeKey = (donorId: string, email: string) => `change:${donorId}:${email}`
const limitKey = (donorId: string) => `donor:${donorId}`

r.get('/', async (req, res) => {
  res.json({ donor: donorOut(me(req)), providers: { google: Boolean(env.google), facebook: Boolean(env.facebook) } })
})

const TOPICS = Object.keys(EMAIL_TOPICS) as [EmailTopic, ...EmailTopic[]]
const opt = (max: number) => z.string().trim().max(max).optional()

r.patch('/', async (req, res) => {
  const body = parse(
    z.object({
      firstName: z.string().trim().min(1, 'Enter your first name').max(60).optional(),
      lastName: z.string().trim().max(60).optional(),
      phone: z.string().trim().max(30).regex(/^[\d\s()+-]*$/, 'Use digits, spaces and + only').optional(),
      address: z
        .object({ line1: opt(120), line2: opt(120), suburb: opt(60), state: opt(40), postcode: z.string().trim().max(10).regex(/^[\dA-Za-z\s-]*$/, 'Check the postcode').optional(), country: opt(60) })
        .optional(),
      preferences: z
        .object({ emailOptIn: z.boolean().optional(), topics: z.array(z.enum(TOPICS)).optional(), anonymous: z.boolean().optional() })
        .optional(),
    }),
    req.body,
  )
  const donor = me(req)
  const changed: string[] = []
  if (body.firstName !== undefined && body.firstName !== donor.firstName) (donor.firstName = body.firstName), changed.push('name')
  if (body.lastName !== undefined && body.lastName !== donor.lastName) {
    donor.lastName = body.lastName
    if (!changed.includes('name')) changed.push('name')
  }
  if (body.phone !== undefined && body.phone !== (donor.phone ?? '')) donor.set('phone', body.phone || undefined), changed.push('phone')
  if (body.address) {
    donor.set('address', { ...(donor.toObject().address ?? {}), ...body.address })
    changed.push('address')
  }
  if (body.preferences) {
    const p = body.preferences
    if (p.emailOptIn !== undefined) donor.set('preferences.emailOptIn', p.emailOptIn)
    if (p.topics) donor.set('preferences.topics', [...new Set(p.topics)])
    if (p.anonymous !== undefined) donor.set('preferences.anonymous', p.anonymous)
    changed.push('email preferences')
  }
  if (!changed.length) {
    res.json({ donor: donorOut(donor) })
    return
  }
  const before = donorName(donor)
  await donor.save()
  const pref = body.preferences
  const detail = pref
    ? [
        pref.emailOptIn !== undefined ? (pref.emailOptIn ? 'opted in to email' : 'opted out of email') : '',
        pref.anonymous !== undefined ? (pref.anonymous ? 'anonymous by default' : 'named by default') : '',
        pref.topics ? `topics: ${pref.topics.length ? pref.topics.join(', ') : 'none'}` : '',
      ].filter(Boolean).join('; ')
    : ''
  await audit(req, 'donor.update', `${before} updated their own ${changed.join(', ')}${detail ? ` (${detail})` : ''}`, { type: 'donor', id: donor._id, label: donor.number })
  res.json({ donor: donorOut(donor) })
})

r.post('/email', limit, async (req, res) => {
  const { email } = parse(z.object({ email: zEmail }), req.body)
  const donor = me(req)
  if (email === donor.email) throw new HttpError(400, 'That is already your email.', { email: 'Already yours' })
  const taken = await Donor.exists({ _id: { $ne: donor._id }, status: 'active', $or: [{ email }, { altEmails: email }] })
  if (taken) {
    throw new HttpError(409, 'Another account already uses that email. If both are yours, send us a message and we will join them together.', { email: 'Used by another account' })
  }
  const code = await issueOtp(changeKey(donor.id, email), limitKey(donor.id), req.ip)
  await sendEmail(email, otpEmail(code), { donor: donor._id })
  res.json({ ok: true, devCode: showsCodesOnScreen() ? code : undefined })
})

r.post('/email/confirm', limit, async (req, res) => {
  const { email, code } = parse(z.object({ email: zEmail, code: z.string().trim().regex(/^\d{6}$/, 'The code is six digits') }), req.body)
  const donor = me(req)
  await consumeOtp(changeKey(donor.id, email), code, limitKey(donor.id), req.ip)
  /* checked again: someone may have taken the address in the last ten minutes */
  if (await Donor.exists({ _id: { $ne: donor._id }, status: 'active', $or: [{ email }, { altEmails: email }] })) {
    throw new HttpError(409, 'Another account now uses that email. Send us a message and we will sort it out.')
  }
  const old = donor.email
  donor.email = email
  donor.altEmails = [...new Set([...(donor.altEmails ?? []).filter((e) => e !== email), old])]
  donor.retiredLogins = [...new Set([...(donor.retiredLogins ?? []).filter((e) => e !== email), old])]
  donor.sessionVersion = (donor.sessionVersion ?? 0) + 1
  try {
    await donor.save()
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new HttpError(409, 'Another account now uses that email. Send us a message and we will sort it out.')
    throw err
  }
  /* every other device is signed out; this one carries on */
  signInDonor(res, donor)
  await sendEmail(old, emailChangedEmail(donor.firstName, email), { donor: donor._id })
  await audit(req, 'donor.email', `${donorName(donor)} changed their sign-in email from ${old} to ${email} (confirmed with a code); the old address was told and no longer signs in`, { type: 'donor', id: donor._id, label: donor.number })
  res.json({ donor: donorOut(donor) })
})

r.post('/delete-request', limit, async (req, res) => {
  const { reason } = parse(z.object({ reason: z.string().trim().max(2000).optional() }), req.body)
  const donor = me(req)
  const open = await Enquiry.exists({ donor: donor._id, subject: 'Account deletion request', status: { $ne: 'closed' } })
  if (open) throw new HttpError(409, 'We already have your request and someone will be in touch soon.')
  const e = await Enquiry.create({
    type: 'contact',
    name: donorName(donor),
    email: donor.email,
    phone: donor.phone,
    subject: 'Account deletion request',
    message: reason || 'Please delete my account.',
    donor: donor._id,
    meta: { source: 'donor portal', donorNumber: donor.number },
  })
  await audit(req, 'donor.delete_request', `${donorName(donor)} asked for their account to be deleted`, { type: 'enquiry', id: e._id, label: 'Account deletion request' })
  res.status(201).json({ ok: true })
})

export default r
