import { Router, type Request, type Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import type { Role } from '../../shared/access'
import { passwordProblem } from '../../shared/password-policy'
import { breachCount } from '../lib/breached'
import { env } from '../env'
import { otpEmail, passwordResetEmail } from '../emails/templates'
import { audit } from '../lib/audit'
import {
  currentDonor, currentStaff, newToken, permissionsOf, safeEqual, sha256,
  signInDonor, signInStaff, signOutDonor, signOutStaff,
} from '../lib/auth'
import { sendEmail, showsCodesOnScreen } from '../lib/email'
import { findOrCreateDonor, fullName } from '../lib/giving'
import { HttpError, parse, zEmail } from '../lib/http'
import {
  checkTotp, clearPending, mfaRequired, newEnrolment, newRecoveryCodes, readPending, reserveGuess, setPending,
  useRecoveryCode, type Pending,
} from '../lib/mfa'
import { alert } from '../lib/alert'
import { consumeOtp, issueOtp } from '../lib/otp'
import { limiter } from '../lib/ratelimit'
import { Donor, Staff, type DonorDoc, type StaffDoc } from '../models'
/* what a donor may see of their own record — never staff notes, tags, tokens
   or provider ids; the donor portal's routes share the same function */
import { donorOut } from './donor/util'

/* ---------------------------------------------------------------------------
   /api/auth — signing in and out, for donors and for staff.

   Limits. Every route that takes a guess (a code, a password, a reset) sits
   behind a per-IP limit, but an IP is cheap to change, so each also has a
   limit that follows the account: codes sent and wrong codes per address
   (lib/otp.ts), wrong passwords per staff login (ten locks it for fifteen
   minutes), reset emails per address, wrong second-step codes per account
   (lib/mfa.ts). The counts live in MongoDB (lib/ratelimit.ts), so a deploy
   doesn't reset them.

   Staff sign-in is up to three steps: the password; then, for anyone with
   two-step sign-in on, a code from their authenticator app; or, for a role
   that must have it and doesn't yet, setting the app up. Between steps the
   person holds a short "pending" cookie, never a session (lib/mfa.ts).

   What a reset or invite link grants: for someone with an app set up, the
   link only reaches the second step, so the mailbox alone can't get in. For
   a role that must have an app and hasn't set one up yet — a new invite, the
   first sign-in after go-live, or after an owner resets someone's app —
   whoever holds the link sets the app up. That is the bootstrap: the link is
   the trust, so invites go only to the person's own address, and an owner
   reset (admin/staff.ts) is followed by a password reset email to them.
   Setting up or replacing an app from an existing session asks for the
   current password, so a session left open on a shared machine can't swap
   in someone else's phone.

   Locked logins answer exactly as a wrong password does, so the lock can't
   be used to find out which addresses have staff logins; the lock itself is
   audited and raised as an [alert], and a reset link clears it.
--------------------------------------------------------------------------- */

const r = Router()

const MIN = 60_000
const emailKey = (req: Request) => String((req.body as { email?: unknown } | undefined)?.email ?? '').trim().toLowerCase() || '-'

/* per IP: codes, passwords, resets and second-step codes together */
const ipLimit = limiter({ name: 'auth-ip', windowMs: 15 * MIN, limit: 30 })
/* per account, whatever IP the guesses come from */
const loginByEmail = limiter({ name: 'auth-login-email', windowMs: 15 * MIN, limit: 10, keyGenerator: emailKey, skipSuccessfulRequests: true })
const forgotByEmail = limiter({ name: 'auth-forgot-email', windowMs: 60 * MIN, limit: 3, keyGenerator: emailKey,
  message: 'We have sent a reset link to this address already. Check your inbox, or try again in an hour.' })

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
  res.json({ google: Boolean(env.google), facebook: Boolean(env.facebook), devCodes: showsCodesOnScreen() })
})

/* ---------------------------------------------------------------------------
   DONORS — a six-digit code by email, no password to forget.
   Asking for a code never says whether an account exists: a first-time
   visitor gets an account the moment they prove the address is theirs.
--------------------------------------------------------------------------- */
r.post('/donor/code', ipLimit, async (req, res) => {
  const { email } = parse(z.object({ email: zEmail }), req.body)
  const code = await issueOtp(email, email, req.ip)
  const donor = await Donor.findOne({ $or: [{ email }, { altEmails: email }] })
  await sendEmail(email, otpEmail(code), { donor: donor?._id })
  /* with no SMTP in development the code is handed back so the login screen
     can show it; never in production and never with a real mail server */
  res.json({ ok: true, devCode: showsCodesOnScreen() ? code : undefined })
})

r.post('/donor/verify', ipLimit, async (req, res) => {
  const { email, code } = parse(z.object({ email: zEmail, code: z.string().trim().regex(/^\d{6}$/, 'The code is six digits') }), req.body)
  await consumeOtp(email, code, email, req.ip)
  const { donor, created } = await findOrCreateDonor({ email, firstName: email.split('@')[0].replace(/[._\d]+/g, ' ').trim() || 'Friend' })
  /* an address the donor moved away from still matches their gifts, but no
     longer opens the account: whoever reads that mailbox now may not be them */
  if (donor.email !== email && donor.retiredLogins?.includes(email)) {
    throw new HttpError(400, 'This address no longer signs in to an account. Use the email the account was moved to, or contact us.', { code: 'Address retired' })
  }
  await linkPendingProvider(req, res, donor, email)
  donor.lastLoginAt = new Date()
  await donor.save()
  signInDonor(res, donor)
  req.donor = donor
  await audit(req, 'donor.login', `${fullName(donor)} signed in with an email code`, { type: 'donor', id: donor._id, label: donor.number })
  res.json({ donor: donorOut(donor), created })
})

/* Signing out ends the donor's sessions on every device: the cookie on this
   one is cleared, and the version bump makes any other copy of it worthless —
   which is what someone signing out after using a shared or stolen computer
   needs. Both the record the cookie names and the one it resolves to (after a
   merge) are bumped. */
r.post('/donor/logout', async (req, res) => {
  const donor = await currentDonor(req)
  if (donor) {
    const claims = jwt.decode(req.cookies?.aa_donor ?? '') as { sub?: string } | null
    const ids = [...new Set([donor.id as string, claims?.sub].filter(Boolean))]
    await Donor.updateMany({ _id: { $in: ids } }, { $inc: { sessionVersion: 1 } })
  }
  signOutDonor(res)
  res.json({ ok: true })
})

/* ---------- Google and Facebook, as plain OAuth code flows ----------
   The provider's account id is what signs a donor in. An email address only
   ever creates a NEW record (Google, and only an address Google says it has
   verified): if a donor already has that address, the provider is linked to
   them only after they prove the mailbox with an emailed code, because an
   unverified provider account carrying someone else's address must not open
   their record. Facebook says nothing about verification, so it always goes
   through the code first.

   The pending link is a short signed cookie; /donor/verify reads it and links
   the provider to the record the code just proved. */
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
type Provider = keyof typeof OAUTH

const STATE_COOKIE = 'aa_oauth'
const LINK_COOKIE = 'aa_link'
const LINK_PATH = '/api/auth/donor'
type LinkClaims = { kind: 'link'; p: Provider; id: string; email: string }

const creds = (p: Provider) => (p === 'google' ? env.google : env.facebook)
const redirectUri = (p: string) => `${env.appUrl}/api/auth/donor/oauth/${p}/callback`
const isProvider = (p: string): p is Provider => p === 'google' || p === 'facebook'

r.get('/donor/oauth/:provider', (req, res) => {
  const p = req.params.provider
  const c = isProvider(p) && creds(p)
  if (!isProvider(p) || !c) throw new HttpError(404, 'That sign-in method is not switched on.')
  const state = newToken()
  res.cookie(STATE_COOKIE, state, { httpOnly: true, sameSite: 'lax', secure: env.isProd, maxAge: 600_000, path: '/' })
  const q = new URLSearchParams({ client_id: c.id, redirect_uri: redirectUri(p), response_type: 'code', scope: OAUTH[p].scope, state })
  res.redirect(`${OAUTH[p].auth}?${q}`)
})

r.get('/donor/oauth/:provider/callback', async (req, res) => {
  const p = req.params.provider
  const c = isProvider(p) && creds(p)
  const fail = () => res.redirect('/account/login?error=oauth')
  /* the state must be present on both sides, long enough to be ours, and
     equal: two missing values are not a match (login CSRF) */
  const state = req.query.state
  const cookie = req.cookies?.[STATE_COOKIE]
  res.clearCookie(STATE_COOKIE, { path: '/' })
  if (!isProvider(p) || !c) return fail()
  if (typeof req.query.code !== 'string' || typeof state !== 'string' || state.length < 32 || typeof cookie !== 'string' || !safeEqual(state, cookie)) {
    return fail()
  }
  try {
    const body = new URLSearchParams({
      client_id: c.id, client_secret: c.secret, code: req.query.code,
      redirect_uri: redirectUri(p), grant_type: 'authorization_code',
    })
    const tok = (await (await fetch(OAUTH[p].token, { method: 'POST', body })).json()) as { access_token?: string }
    if (!tok.access_token) return fail()
    const profileUrl = p === 'google'
      ? 'https://openidconnect.googleapis.com/v1/userinfo'
      : 'https://graph.facebook.com/me?fields=id,email,first_name,last_name'
    const prof = (await (await fetch(profileUrl, { headers: { Authorization: `Bearer ${tok.access_token}` } })).json()) as {
      sub?: string; id?: string; email?: string; email_verified?: boolean
      given_name?: string; family_name?: string; first_name?: string; last_name?: string
    }
    const pid = prof.sub ?? prof.id
    if (!pid) return fail()
    if (p === 'google' && prof.email && prof.email_verified !== true) return fail()

    let donor: DonorDoc | null = await Donor.findOne({ [`oauth.${p}`]: pid })
    while (donor?.status === 'merged' && donor.mergedInto) donor = await Donor.findById(donor.mergedInto)

    if (!donor) {
      const email = prof.email?.trim().toLowerCase()
      if (!email) return fail()
      const known = await Donor.exists({ $or: [{ email }, { altEmails: email }] })
      if (known || p === 'facebook') {
        const link: LinkClaims = { kind: 'link', p, id: pid, email }
        res.cookie(LINK_COOKIE, jwt.sign(link, env.jwtSecret, { expiresIn: 600 }), {
          httpOnly: true, sameSite: 'lax', secure: env.isProd, maxAge: 600_000, path: LINK_PATH,
        })
        return res.redirect(`/account/login?link=${p}&email=${encodeURIComponent(email)}`)
      }
      donor = (await findOrCreateDonor({
        email,
        firstName: prof.given_name ?? prof.first_name ?? 'Friend',
        lastName: prof.family_name ?? prof.last_name ?? '',
      })).donor
      donor.set(`oauth.${p}`, pid)
    }
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

/** After an email code proves the mailbox, link the provider that sent the
 *  donor to the code screen — if it was for this same address. */
async function linkPendingProvider(req: Request, res: Response, donor: DonorDoc, email: string) {
  const token = req.cookies?.[LINK_COOKIE]
  if (!token) return
  res.clearCookie(LINK_COOKIE, { path: LINK_PATH })
  let link: LinkClaims
  try {
    link = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }) as LinkClaims
  } catch {
    return
  }
  if (link.kind !== 'link' || link.email !== email || !isProvider(link.p)) return
  /* never move a provider account off another donor's record */
  if (await Donor.exists({ [`oauth.${link.p}`]: link.id, _id: { $ne: donor._id } })) return
  donor.set(`oauth.${link.p}`, link.id)
  await audit(req, 'donor.oauth_link', `${fullName(donor)} linked ${link.p === 'google' ? 'Google' : 'Facebook'} sign-in after confirming their email`, {
    type: 'donor', id: donor._id, label: donor.number,
  })
}

/* ---------------------------------------------------------------------------
   STAFF — email and password, set through an invite link, then (where it is
   on) a code from an authenticator app.
--------------------------------------------------------------------------- */

/* Unknown addresses are compared against this, so a wrong email takes as long
   to refuse as a wrong password: the timing can't be used to find out which
   addresses have staff logins. */
const DUMMY_HASH = bcrypt.hashSync('not-a-password-anyone-has', 12)
const LOCK_AFTER = 10
const LOCK_MS = 15 * MIN
/* wrong passwords count towards a lock only within an hour of the first */
const FAIL_WINDOW_MS = 60 * MIN

async function recordWrongPassword(req: Request, staff: StaffDoc) {
  const now = new Date()
  /* one atomic update: a run that began over an hour ago starts again at 1 */
  const s = await Staff.findOneAndUpdate(
    { _id: staff._id },
    [
      { $set: { _fresh: { $or: [{ $eq: [{ $ifNull: ['$failedLoginsAt', null] }, null] }, { $lt: ['$failedLoginsAt', new Date(now.getTime() - FAIL_WINDOW_MS)] }] } } },
      {
        $set: {
          failedLogins: { $cond: ['$_fresh', 1, { $add: [{ $ifNull: ['$failedLogins', 0] }, 1] }] },
          failedLoginsAt: { $cond: ['$_fresh', now, '$failedLoginsAt'] },
        },
      },
      { $unset: '_fresh' },
    ],
    { returnDocument: 'after', updatePipeline: true },
  ).select('+failedLogins')
  if ((s?.failedLogins ?? 0) < LOCK_AFTER) return
  const locked = await Staff.updateOne(
    { _id: staff._id, failedLogins: { $gte: LOCK_AFTER } },
    { $set: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) }, $unset: { failedLoginsAt: 1 } },
  )
  if (locked.modifiedCount) {
    await audit(req, 'staff.locked', `${staff.name}'s login was locked for 15 minutes after ${LOCK_AFTER} wrong passwords`, { type: 'staff', id: staff._id, label: staff.name })
    alert('auth', `staff login ${staff.email} locked after ${LOCK_AFTER} wrong passwords within an hour (last from ${req.ip})`)
  }
}

/** The last step of every staff sign-in: the session cookie, and the answer the portal expects. */
async function completeSignIn(req: Request, res: Response, staff: StaffDoc, remember: boolean, how: string) {
  await Staff.updateOne({ _id: staff._id }, { $set: { lastLoginAt: new Date() } })
  signInStaff(res, staff, remember)
  req.staff = staff
  await audit(req, 'staff.login', `${staff.name} ${how}`, { type: 'staff', id: staff._id, label: staff.name })
  return { user: staffOut(staff), permissions: permissionsOf(staff.role as Role) }
}

/** After a password (or a reset link): the next step this person needs. */
async function afterPassword(req: Request, res: Response, staff: StaffDoc, remember: boolean, how: string) {
  if (staff.totpEnabled) {
    setPending(res, staff, 'challenge', remember)
    return { mfa: 'challenge' as const }
  }
  if (mfaRequired(staff.role)) {
    setPending(res, staff, 'enrol', remember)
    return { mfa: 'enrol' as const }
  }
  return completeSignIn(req, res, staff, remember, how)
}

r.post('/staff/login', ipLimit, loginByEmail, async (req, res) => {
  const { email, password, remember } = parse(
    z.object({ email: zEmail, password: z.string().min(1, 'Enter your password').max(200), remember: z.boolean().optional() }),
    req.body,
  )
  const staff = await Staff.findOne({ email }).select('+passwordHash +lockedUntil')
  /* always one bcrypt compare, so every refusal takes as long as any other */
  const ok = await bcrypt.compare(password, staff?.passwordHash || DUMMY_HASH)
  /* locked: the same answer as a wrong password, even for the right one —
     a different answer would say this address has a login. The wrong guesses
     made while locked aren't counted, so the lock doesn't extend itself. */
  const locked = Boolean(staff?.lockedUntil && staff.lockedUntil > new Date())
  if (!staff || !staff.passwordHash || !ok || locked) {
    if (staff && !ok && !locked) await recordWrongPassword(req, staff)
    throw new HttpError(401, 'That email and password do not match.')
  }
  if (!staff.active) throw new HttpError(403, 'This login has been switched off. Ask an administrator.')
  await Staff.updateOne({ _id: staff._id }, { $set: { failedLogins: 0 }, $unset: { lockedUntil: 1, failedLoginsAt: 1 } })
  res.json(await afterPassword(req, res, staff, Boolean(remember), 'signed in'))
})

/* Signing out ends this person's sessions everywhere, not just this cookie:
   a cookie copied off a shared machine stops working the moment they sign out. */
r.post('/staff/logout', async (req, res) => {
  const staff = await currentStaff(req)
  if (staff) {
    await Staff.updateOne({ _id: staff._id }, { $inc: { sessionVersion: 1 } })
    await audit(req, 'staff.logout', `${staff.name} signed out`, { type: 'staff', id: staff._id, label: staff.name })
  }
  signOutStaff(res)
  clearPending(res)
  res.json({ ok: true })
})

/* The answer is the same, and arrives as fast, whether or not the address has
   a login: the token and the email are made after the response has gone. */
r.post('/staff/forgot', ipLimit, forgotByEmail, async (req, res) => {
  const { email } = parse(z.object({ email: zEmail }), req.body)
  res.json({ ok: true })
  void (async () => {
    const staff = await Staff.findOne({ email, active: true })
    if (!staff) return
    const token = newToken()
    await Staff.updateOne({ _id: staff._id }, { $set: { tokenHash: sha256(token), tokenExpires: new Date(Date.now() + 3_600_000) } })
    await sendEmail(staff.email, passwordResetEmail(staff.name, `${env.appUrl}/admin/reset?token=${token}`))
  })().catch((err) => console.error('[auth] password reset email failed', err))
})

r.get('/staff/token/:token', async (req, res) => {
  const staff = await Staff.findOne({ tokenHash: sha256(req.params.token) }).select('+tokenExpires')
  if (!staff || !staff.tokenExpires || staff.tokenExpires < new Date()) throw new HttpError(400, 'This link has expired. Ask for a new one.')
  res.json({ name: staff.name, email: staff.email, invite: !staff.passwordSet })
})

/* the shared rules first (length, common, not the email), then whether the
   password is in a public breach (server/lib/breached.ts) */
const newPassword = async (field: string, password: string, email?: string) => {
  const problem = passwordProblem(password, email)
  if (problem) throw new HttpError(400, problem, { [field]: problem })
  if (await breachCount(password)) {
    const msg = 'That password has appeared in a data breach elsewhere. Choose a different one'
    throw new HttpError(400, msg, { [field]: msg })
  }
}

/* The link is spent by the same update that sets the password, so two tabs
   holding it can't both use it; and it signs in only as far as the second
   step, if the person has one. */
r.post('/staff/reset', ipLimit, async (req, res) => {
  const { token, password } = parse(z.object({ token: z.string().min(10).max(200), password: z.string().max(200) }), req.body)
  const tokenHash = sha256(token)
  const peek = await Staff.findOne({ tokenHash, tokenExpires: { $gt: new Date() } })
  if (!peek) throw new HttpError(400, 'This link has expired. Ask for a new one.')
  await newPassword('password', password, peek.email)
  const passwordHash = await bcrypt.hash(password, 12)
  const staff = await Staff.findOneAndUpdate(
    { _id: peek._id, tokenHash, tokenExpires: { $gt: new Date() } },
    {
      $set: { passwordHash, passwordSet: true, failedLogins: 0 },
      $unset: { tokenHash: 1, tokenExpires: 1, lockedUntil: 1, failedLoginsAt: 1 },
      $inc: { sessionVersion: 1 },
    },
    { returnDocument: 'after' },
  )
  if (!staff) throw new HttpError(400, 'This link has expired. Ask for a new one.')
  const first = !peek.passwordSet
  await audit(req, first ? 'staff.activate' : 'staff.reset', first ? `${staff.name} set a password and activated their login` : `${staff.name} reset their password`, { type: 'staff', id: staff._id, label: staff.name })
  res.json(await afterPassword(req, res, staff, false, first ? 'signed in for the first time' : 'signed in with a reset link'))
})

r.post('/staff/password', ipLimit, async (req, res) => {
  const staff = await currentStaff(req)
  if (!staff) throw new HttpError(401, 'Please sign in again.')
  const { current, next } = parse(
    z.object({ current: z.string().min(1, 'Enter your current password').max(200), next: z.string().max(200) }),
    req.body,
  )
  await newPassword('next', next, staff.email)
  const withHash = await Staff.findById(staff._id).select('+passwordHash')
  if (!withHash?.passwordHash || !(await bcrypt.compare(current, withHash.passwordHash))) {
    throw new HttpError(400, 'Your current password is not right.', { current: 'Not right' })
  }
  /* a reset or invite link still sitting in an inbox dies with the old password */
  const fresh = await Staff.findOneAndUpdate(
    { _id: staff._id },
    { $set: { passwordHash: await bcrypt.hash(next, 12) }, $inc: { sessionVersion: 1 }, $unset: { tokenHash: 1, tokenExpires: 1 } },
    { returnDocument: 'after' },
  )
  signInStaff(res, fresh!, false)
  await audit(req, 'staff.password', `${staff.name} changed their password`, { type: 'staff', id: staff._id, label: staff.name })
  res.json({ ok: true })
})

/* ---------------------------------------------------------------------------
   STAFF — the second step (lib/mfa.ts).
--------------------------------------------------------------------------- */
const timedOut = () => new HttpError(400, 'Your sign-in timed out. Enter your password again.', { session: 'expired' })
const zCode = z.string().trim().transform((s) => s.replace(/\s/g, '')).pipe(z.string().regex(/^\d{6}$/, 'The code is six digits'))

/** A code from the app, or a recovery code, to finish signing in. */
r.post('/staff/mfa', ipLimit, async (req, res) => {
  const p = await readPending(req)
  if (!p || p.pending.stage !== 'challenge') throw timedOut()
  const body = parse(
    z.object({ code: zCode.optional(), recoveryCode: z.string().trim().min(8).max(20).optional() })
      .refine((b) => b.code || b.recoveryCode, { message: 'Enter the code from your app', path: ['code'] }),
    req.body,
  )
  const giveBack = await reserveGuess(p.pending, { recovery: Boolean(body.recoveryCode) })
  const staff = await Staff.findById(p.staff._id).select('+totpSecret')
  if (!staff?.totpEnabled) throw timedOut()
  const ok = body.recoveryCode ? await useRecoveryCode(staff._id, body.recoveryCode) : await checkTotp(staff._id, staff.totpSecret, body.code!)
  if (ok) await giveBack()
  if (!ok) {
    throw body.recoveryCode
      ? new HttpError(400, 'That recovery code is not right, or has been used already.', { recoveryCode: 'Not right' })
      : new HttpError(400, 'That code is not right. Check the app and try again.', { code: 'Not right' })
  }
  clearPending(res)
  if (body.recoveryCode) {
    await audit(req, 'staff.mfa_recovery', `${staff.name} signed in with a recovery code instead of their authenticator app`, { type: 'staff', id: staff._id, label: staff.name })
  }
  res.json(await completeSignIn(req, res, staff, p.pending.remember, 'signed in with two-step sign-in'))
})

/** Whoever is setting up an app: someone signed in, or someone part-way
 *  through a sign-in that requires one. */
async function enrolling(req: Request): Promise<{ staff: StaffDoc; pending: Pending | null }> {
  const p = await readPending(req)
  if (p?.pending.stage === 'enrol') return { staff: p.staff, pending: p.pending }
  const staff = await currentStaff(req)
  if (staff) return { staff, pending: null }
  throw timedOut()
}

r.get('/staff/mfa', async (req, res) => {
  const staff = await currentStaff(req)
  if (!staff) throw new HttpError(401, 'Please sign in again.')
  const s = await Staff.findById(staff._id).select('+recoveryCodes')
  res.json({
    enabled: Boolean(s?.totpEnabled),
    required: mfaRequired(staff.role),
    enabledAt: s?.totpEnabledAt?.toISOString(),
    recoveryCodesLeft: s?.recoveryCodes?.length ?? 0,
  })
})

/** The signed-in person's current password, or a refusal. A wrong one counts
 *  towards the login lock, so a session can't be used to guess it. */
async function confirmPassword(req: Request, staff: StaffDoc, password: string) {
  const s = await Staff.findById(staff._id).select('+passwordHash')
  if (!s?.passwordHash || !(await bcrypt.compare(password, s.passwordHash))) {
    if (s) await recordWrongPassword(req, s)
    throw new HttpError(400, 'Your current password is not right.', { password: 'Not right' })
  }
}

/* Part-way through a sign-in that requires an app (the "enrol" pending
   cookie), the password was just given. From a session, the current
   password is asked for again — and with it, someone whose phone is lost or
   replaced can move to a new app (POST /staff/mfa/replace): nothing changes
   until a code from the new app proves it, then the new secret replaces the
   old and fresh recovery codes are issued. */
async function setup(req: Request, res: Response) {
  const p = await readPending(req)
  if (p?.pending.stage === 'enrol') {
    res.json(await newEnrolment(p.staff))
    return
  }
  const staff = await currentStaff(req)
  if (!staff) throw timedOut()
  const { password } = parse(z.object({ password: z.string().min(1, 'Enter your current password').max(200) }), req.body)
  await confirmPassword(req, staff, password)
  res.json(await newEnrolment(staff))
}
r.post('/staff/mfa/setup', ipLimit, setup)
r.post('/staff/mfa/replace', ipLimit, setup)

r.post('/staff/mfa/enable', ipLimit, async (req, res) => {
  const { staff, pending } = await enrolling(req)
  const { code } = parse(z.object({ code: zCode }), req.body)
  const guess: Pending = pending ?? { sub: staff.id, kind: 'mfa', stage: 'enrol', remember: false, v: 0, jti: `session:${staff.id}` }
  const giveBack = await reserveGuess(guess)
  const s = await Staff.findById(staff._id).select('+totpPending')
  if (!s?.totpPending) throw new HttpError(400, 'Start the setup again.')
  if (!(await checkTotp(s._id, s.totpPending, code))) {
    throw new HttpError(400, 'That code is not right. Check the app shows Al-Anwaar, and try the newest code.', { code: 'Not right' })
  }
  await giveBack()
  const replacing = Boolean(s.totpEnabled)
  const { codes, hashes } = newRecoveryCodes()
  await Staff.updateOne(
    { _id: s._id },
    { $set: { totpEnabled: true, totpSecret: s.totpPending, recoveryCodes: hashes, totpEnabledAt: new Date() }, $unset: { totpPending: 1 } },
  )
  await audit(
    req,
    replacing ? 'staff.mfa_replace' : 'staff.mfa_enable',
    replacing ? `${staff.name} moved two-step sign-in to a new authenticator app (old recovery codes no longer work)` : `${staff.name} turned on two-step sign-in`,
    { type: 'staff', id: staff._id, label: staff.name },
  )
  if (!pending) {
    res.json({ recoveryCodes: codes })
    return
  }
  clearPending(res)
  const fresh = (await Staff.findById(staff._id))!
  res.json({ recoveryCodes: codes, ...(await completeSignIn(req, res, fresh, pending.remember, 'set up two-step sign-in and signed in')) })
})

/** Turning it off needs a code from the app now. Making new recovery codes
 *  takes the app code or, for someone who has lost the phone and signed in
 *  with a recovery code, the current password. */
async function confirmWithApp(req: Request, opts: { orPassword?: boolean } = {}) {
  const staff = await currentStaff(req)
  if (!staff) throw new HttpError(401, 'Please sign in again.')
  const body = parse(
    z.object({ code: zCode.optional(), password: z.string().min(1).max(200).optional() })
      .refine((b) => b.code || (opts.orPassword && b.password), { message: 'Enter the code from your app', path: ['code'] }),
    req.body,
  )
  const s = await Staff.findById(staff._id).select('+totpSecret')
  if (!s?.totpEnabled) throw new HttpError(400, 'Two-step sign-in is not on for this login.')
  if (!body.code && body.password) {
    await confirmPassword(req, staff, body.password)
    return staff
  }
  const guess: Pending = { sub: staff.id, kind: 'mfa', stage: 'challenge', remember: false, v: 0, jti: `session:${staff.id}` }
  const giveBack = await reserveGuess(guess)
  if (!(await checkTotp(s._id, s.totpSecret, body.code!))) {
    throw new HttpError(400, 'That code is not right. Check the app and try again.', { code: 'Not right' })
  }
  await giveBack()
  return staff
}

r.post('/staff/mfa/disable', ipLimit, async (req, res) => {
  const me = await currentStaff(req)
  if (me && mfaRequired(me.role)) throw new HttpError(403, 'Your role must use two-step sign-in, so it cannot be turned off.')
  const staff = await confirmWithApp(req)
  await Staff.updateOne(
    { _id: staff._id },
    { $set: { totpEnabled: false }, $unset: { totpSecret: 1, totpPending: 1, totpLastStep: 1, recoveryCodes: 1, totpEnabledAt: 1 } },
  )
  await audit(req, 'staff.mfa_disable', `${staff.name} turned off two-step sign-in`, { type: 'staff', id: staff._id, label: staff.name })
  res.json({ ok: true })
})

r.post('/staff/mfa/recovery-codes', ipLimit, async (req, res) => {
  const staff = await confirmWithApp(req, { orPassword: true })
  const { codes, hashes } = newRecoveryCodes()
  await Staff.updateOne({ _id: staff._id }, { $set: { recoveryCodes: hashes } })
  await audit(req, 'staff.mfa_recovery_codes', `${staff.name} made a new set of recovery codes (the old ones no longer work)`, { type: 'staff', id: staff._id, label: staff.name })
  res.json({ recoveryCodes: codes })
})

export default r
