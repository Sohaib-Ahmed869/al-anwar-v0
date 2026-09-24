import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import type { Role } from '../../shared/access'
import { env } from '../env'
import { otpEmail, passwordResetEmail } from '../emails/templates'
import { audit } from '../lib/audit'
import {
  currentDonor, currentStaff, newOtp, newToken, permissionsOf, safeEqual, sha256,
  signInDonor, signInStaff, signOutDonor, signOutStaff,
} from '../lib/auth'
import { emailTransport, sendEmail } from '../lib/email'
import { findOrCreateDonor, fullName } from '../lib/giving'
import { HttpError, parse, zEmail } from '../lib/http'
import { Donor, OtpCode, Staff } from '../models'
/* what a donor may see of their own record — never staff notes, tags, tokens
   or provider ids; the donor portal's routes share the same function */
import { donorOut } from './donor/util'

const r = Router()

/* Slow down anyone guessing: codes, passwords and reset requests. Generous in
   development, where screenshots and tests sign in hundreds of times. */
const limiter = rateLimit({ windowMs: 15 * 60_000, limit: env.isProd ? 30 : 5000, standardHeaders: true, legacyHeaders: false,
  message: { error: { message: 'Too many attempts. Please wait a few minutes and try again.' } } })

export const staffOut = (s: InstanceType<typeof Staff>) => ({
  id: s.id,
  name: s.name,
  email: s.email,
  role: s.role,
  active: s.active,
  passwordSet: s.passwordSet,
  lastLoginAt: s.lastLoginAt?.toISOString(),
  invitedAt: s.invitedAt?.toISOString(),
  createdAt: (s as unknown as { createdAt: Date }).createdAt?.toISOString(),
})

/** Who is signed in, to which portal. Both can be true on one browser. */
r.get('/session', async (req, res) => {
  const [staff, donor] = await Promise.all([currentStaff(req), currentDonor(req)])
  res.json({
    staff: staff ? { user: staffOut(staff), permissions: permissionsOf(staff.role as Role) } : null,
    donor: donor ? donorOut(donor) : null,
  })
})

r.get('/providers', (_req, res) => {
  res.json({ google: Boolean(env.google), facebook: Boolean(env.facebook), devCodes: emailTransport() === 'outbox' && !env.isProd })
})

/* ---------------------------------------------------------------------------
   DONORS — a six-digit code by email, no password to forget.
   Asking for a code never says whether an account exists: a first-time
   visitor gets an account the moment they prove the address is theirs.
--------------------------------------------------------------------------- */
r.post('/donor/code', limiter, async (req, res) => {
  const { email } = parse(z.object({ email: zEmail }), req.body)
  const code = newOtp()
  await OtpCode.deleteMany({ email })
  await OtpCode.create({ email, codeHash: sha256(`${email}:${code}`), expiresAt: new Date(Date.now() + 10 * 60_000) })
  const donor = await Donor.findOne({ $or: [{ email }, { altEmails: email }] })
  await sendEmail(email, otpEmail(code), { donor: donor?._id })
  /* with no SMTP in development the code is handed back so the login screen
     can show it; never in production and never with a real mail server */
  res.json({ ok: true, devCode: emailTransport() === 'outbox' && !env.isProd ? code : undefined })
})

r.post('/donor/verify', limiter, async (req, res) => {
  const { email, code } = parse(z.object({ email: zEmail, code: z.string().trim().regex(/^\d{6}$/, 'The code is six digits') }), req.body)
  const row = await OtpCode.findOne({ email })
  if (!row || row.expiresAt < new Date()) throw new HttpError(400, 'That code has expired. Ask for a new one.', { code: 'Expired' })
  if (row.attempts >= 5) {
    await row.deleteOne()
    throw new HttpError(400, 'Too many tries. Ask for a new code.', { code: 'Too many tries' })
  }
  if (!safeEqual(row.codeHash, sha256(`${email}:${code}`))) {
    row.attempts += 1
    await row.save()
    throw new HttpError(400, 'That code is not right. Check the email and try again.', { code: 'Not right' })
  }
  await row.deleteOne()
  const { donor, created } = await findOrCreateDonor({ email, firstName: email.split('@')[0].replace(/[._\d]+/g, ' ').trim() || 'Friend' })
  donor.lastLoginAt = new Date()
  await donor.save()
  signInDonor(res, donor)
  req.donor = donor
  await audit(req, 'donor.login', `${fullName(donor)} signed in with an email code`, { type: 'donor', id: donor._id, label: donor.number })
  res.json({ donor: donorOut(donor), created })
})

r.post('/donor/logout', (_req, res) => {
  signOutDonor(res)
  res.json({ ok: true })
})

/* ---------- Google and Facebook, as plain OAuth code flows ---------- */
const OAUTH = {
  google: {
    auth: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
  },
  facebook: {
    auth: 'https://www.facebook.com/v19.0/dialog/oauth',
    token: 'https://graph.facebook.com/v19.0/oauth/access_token',
    scope: 'email,public_profile',
  },
} as const

const creds = (p: 'google' | 'facebook') => (p === 'google' ? env.google : env.facebook)
const redirectUri = (p: string) => `${env.appUrl}/api/auth/donor/oauth/${p}/callback`

r.get('/donor/oauth/:provider', (req, res) => {
  const p = req.params.provider as 'google' | 'facebook'
  const c = OAUTH[p] && creds(p)
  if (!c) throw new HttpError(404, 'That sign-in method is not switched on.')
  const state = newToken()
  res.cookie('aa_oauth', state, { httpOnly: true, sameSite: 'lax', secure: env.isProd, maxAge: 600_000 })
  const q = new URLSearchParams({ client_id: c.id, redirect_uri: redirectUri(p), response_type: 'code', scope: OAUTH[p].scope, state })
  res.redirect(`${OAUTH[p].auth}?${q}`)
})

r.get('/donor/oauth/:provider/callback', async (req, res) => {
  const p = req.params.provider as 'google' | 'facebook'
  const c = OAUTH[p] && creds(p)
  const fail = () => res.redirect('/account/login?error=oauth')
  if (!c || !req.query.code || req.query.state !== req.cookies?.aa_oauth) return fail()
  res.clearCookie('aa_oauth')
  try {
    const body = new URLSearchParams({
      client_id: c.id, client_secret: c.secret, code: String(req.query.code),
      redirect_uri: redirectUri(p), grant_type: 'authorization_code',
    })
    const tok = (await (await fetch(OAUTH[p].token, { method: 'POST', body })).json()) as { access_token?: string }
    if (!tok.access_token) return fail()
    const profileUrl = p === 'google'
      ? 'https://openidconnect.googleapis.com/v1/userinfo'
      : 'https://graph.facebook.com/me?fields=id,email,first_name,last_name'
    const prof = (await (await fetch(profileUrl, { headers: { Authorization: `Bearer ${tok.access_token}` } })).json()) as {
      sub?: string; id?: string; email?: string; given_name?: string; family_name?: string; first_name?: string; last_name?: string
    }
    if (!prof.email) return fail()
    const { donor } = await findOrCreateDonor({
      email: prof.email,
      firstName: prof.given_name ?? prof.first_name ?? 'Friend',
      lastName: prof.family_name ?? prof.last_name ?? '',
    })
    donor.set(`oauth.${p}`, prof.sub ?? prof.id)
    donor.lastLoginAt = new Date()
    await donor.save()
    signInDonor(res, donor)
    req.donor = donor
    await audit(req, 'donor.login', `${fullName(donor)} signed in with ${p === 'google' ? 'Google' : 'Facebook'}`, { type: 'donor', id: donor._id, label: donor.number })
    res.redirect('/account')
  } catch {
    fail()
  }
})

/* ---------------------------------------------------------------------------
   STAFF — email and password, set through an invite link.
--------------------------------------------------------------------------- */
r.post('/staff/login', limiter, async (req, res) => {
  const { email, password, remember } = parse(
    z.object({ email: zEmail, password: z.string().min(1, 'Enter your password'), remember: z.boolean().optional() }),
    req.body,
  )
  const staff = await Staff.findOne({ email }).select('+passwordHash')
  const ok = staff?.passwordHash ? await bcrypt.compare(password, staff.passwordHash) : false
  if (!staff || !ok) throw new HttpError(401, 'That email and password do not match.')
  if (!staff.active) throw new HttpError(403, 'This login has been switched off. Ask an administrator.')
  staff.lastLoginAt = new Date()
  await staff.save()
  signInStaff(res, staff, Boolean(remember))
  req.staff = staff
  await audit(req, 'staff.login', `${staff.name} signed in`, { type: 'staff', id: staff._id, label: staff.name })
  res.json({ user: staffOut(staff), permissions: permissionsOf(staff.role as Role) })
})

r.post('/staff/logout', async (req, res) => {
  const staff = await currentStaff(req)
  if (staff) await audit(req, 'staff.logout', `${staff.name} signed out`, { type: 'staff', id: staff._id, label: staff.name })
  signOutStaff(res)
  res.json({ ok: true })
})

r.post('/staff/forgot', limiter, async (req, res) => {
  const { email } = parse(z.object({ email: zEmail }), req.body)
  const staff = await Staff.findOne({ email, active: true })
  if (staff) {
    const token = newToken()
    staff.set({ tokenHash: sha256(token), tokenExpires: new Date(Date.now() + 3_600_000) })
    await staff.save()
    await sendEmail(staff.email, passwordResetEmail(staff.name, `${env.appUrl}/admin/reset?token=${token}`))
  }
  /* the same answer either way, so this cannot be used to find staff emails */
  res.json({ ok: true })
})

r.get('/staff/token/:token', async (req, res) => {
  const staff = await Staff.findOne({ tokenHash: sha256(req.params.token) }).select('+tokenExpires')
  if (!staff || !staff.tokenExpires || staff.tokenExpires < new Date()) throw new HttpError(400, 'This link has expired. Ask for a new one.')
  res.json({ name: staff.name, email: staff.email, invite: !staff.passwordSet })
})

r.post('/staff/reset', limiter, async (req, res) => {
  const { token, password } = parse(
    z.object({ token: z.string().min(10), password: z.string().min(10, 'Use at least 10 characters') }),
    req.body,
  )
  const staff = await Staff.findOne({ tokenHash: sha256(token) }).select('+tokenExpires +tokenHash')
  if (!staff || !staff.tokenExpires || staff.tokenExpires < new Date()) throw new HttpError(400, 'This link has expired. Ask for a new one.')
  const first = !staff.passwordSet
  staff.set({
    passwordHash: await bcrypt.hash(password, 12),
    passwordSet: true,
    tokenHash: undefined,
    tokenExpires: undefined,
    sessionVersion: (staff.sessionVersion ?? 0) + 1,
    lastLoginAt: new Date(),
  })
  await staff.save()
  signInStaff(res, staff, false)
  req.staff = staff
  await audit(req, first ? 'staff.activate' : 'staff.reset', first ? `${staff.name} set a password and activated their login` : `${staff.name} reset their password`, { type: 'staff', id: staff._id, label: staff.name })
  res.json({ user: staffOut(staff), permissions: permissionsOf(staff.role as Role) })
})

r.post('/staff/password', async (req, res) => {
  const staff = await currentStaff(req)
  if (!staff) throw new HttpError(401, 'Please sign in again.')
  const { current, next } = parse(
    z.object({ current: z.string().min(1, 'Enter your current password'), next: z.string().min(10, 'Use at least 10 characters') }),
    req.body,
  )
  const withHash = await Staff.findById(staff._id).select('+passwordHash')
  if (!withHash?.passwordHash || !(await bcrypt.compare(current, withHash.passwordHash))) {
    throw new HttpError(400, 'Your current password is not right.', { current: 'Not right' })
  }
  withHash.passwordHash = await bcrypt.hash(next, 12)
  withHash.sessionVersion = (withHash.sessionVersion ?? 0) + 1
  await withHash.save()
  signInStaff(res, withHash, false)
  await audit(req, 'staff.password', `${staff.name} changed their password`, { type: 'staff', id: staff._id, label: staff.name })
  res.json({ ok: true })
})

export default r
