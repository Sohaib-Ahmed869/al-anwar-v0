import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt } from 'node:crypto'
import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'
import type { Role } from '../../shared/access'
import { env } from '../env'
import { Staff, type StaffDoc } from '../models'
import { HttpError } from './http'
import { MongoStore } from './ratelimit'

/* ---------------------------------------------------------------------------
   Two-step sign-in for staff: an authenticator app's six-digit code (TOTP,
   RFC 6238) after the password.

   WHO MUST USE IT. Owner, admin and finance can move money, see every donor
   and change who has access, so for them it is required wherever
   REQUIRE_STAFF_MFA says so: on by default in production, off by default in
   development and tests (where the seeded logins would otherwise all need an
   authenticator). Anyone else may switch it on for themselves. A required
   role with no authenticator yet is walked through setting one up at their
   next sign-in, and an old session of theirs stops working until they have
   (lib/auth.ts currentStaff), so the rule can't be dodged by staying signed in.

   BETWEEN THE PASSWORD AND THE CODE the person holds a "pending" cookie, not a
   session: a five-minute signed token that names who they are and which step
   they are on (a code to enter, or an app to set up). It opens nothing but the
   routes in routes/auth.ts that finish signing in.

   GUESSES are reserved before they are checked (reserveGuess): the counter
   goes up first, and a guess over the limit is refused without looking at the
   code, so a burst of parallel requests can't all read "none used yet". Five
   tries burn a pending sign-in; ten app codes a day lock the account's
   second step until tomorrow, whatever IP they come from. A right code gives
   its daily reservation back, so signing in often costs nothing. Recovery
   codes don't count against the daily cap — each is long, random and good
   once, and they are how someone gets back in when that cap has been run up
   by somebody holding their password.

   THE SECRET is encrypted (AES-256-GCM) before it is stored, so a copy of the
   database alone can't generate codes. The key comes from MFA_KEY when it is
   set, else from JWT_SECRET; decrypting tries both, so setting MFA_KEY later
   (do it before go-live, so rotating JWT_SECRET never touches two-step
   sign-in) leaves existing enrolments working, and a secret no key can open
   is a clear refusal — "ask an owner to reset it" — never a 500. A code is
   good for one use: the time-step it was made in is remembered, and a code
   from that step or earlier is refused, so a code read over a shoulder can't
   be replayed in the next thirty seconds.

   RECOVERY CODES: ten, shown once when the app is set up, stored hashed, each
   good once — for a lost phone. Using one is audited.
--------------------------------------------------------------------------- */

authenticator.options = { window: 1 }

const MFA_ROLES: Role[] = ['owner', 'admin', 'finance']
const ISSUER = 'Al-Anwaar'
const PENDING_COOKIE = 'aa_mfa'
const PENDING_PATH = '/api/auth/staff'
const PENDING_MS = 5 * 60_000
const GUESSES_PER_PENDING = 5
const FAILS_PER_DAY = 10

export function mfaRequired(role: string) {
  const flag = process.env.REQUIRE_STAFF_MFA
  const on = flag === '1' ? true : flag === '0' ? false : env.isProd
  return on && MFA_ROLES.includes(role as Role)
}

/* ---------- the secret, encrypted at rest ---------- */
/** the secrets keys are made from: MFA_KEY first (new seals use it), then
 *  JWT_SECRET (what everything was sealed with before MFA_KEY existed) */
const keySources = () => [...new Set([process.env.MFA_KEY, env.jwtSecret].filter((k): k is string => Boolean(k)))]
const aesKey = (source: string) => createHash('sha256').update(`aa-totp:${source}`).digest()

/** A stored secret that no current key opens: JWT_SECRET or MFA_KEY changed
 *  since it was set up. The person needs an owner to reset their second step. */
export const unreadableSecret = () =>
  new HttpError(409, 'Two-step sign-in for this login needs setting up again. Ask an owner to reset it from Staff and access.', {
    code: 'Needs resetting',
  })

export function sealSecret(secret: string) {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', aesKey(keySources()[0]), iv)
  const ct = Buffer.concat([c.update(secret, 'utf8'), c.final()])
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join(':')
}

/** The secret, or throws unreadableSecret() when no current key opens it. */
export function openSecret(sealed: string) {
  const [v, iv, tag, ct] = sealed.split(':')
  if (v !== 'v1' || !iv || !tag || !ct) throw unreadableSecret()
  for (const source of keySources()) {
    try {
      const d = createDecipheriv('aes-256-gcm', aesKey(source), Buffer.from(iv, 'base64url'))
      d.setAuthTag(Buffer.from(tag, 'base64url'))
      return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8')
    } catch {
      /* the wrong key fails GCM's tag check; try the next one */
    }
  }
  throw unreadableSecret()
}

/* ---------- setting up ---------- */
export async function newEnrolment(staff: StaffDoc) {
  const secret = authenticator.generateSecret()
  await Staff.updateOne({ _id: staff._id }, { $set: { totpPending: sealSecret(secret) } })
  const otpauth = authenticator.keyuri(staff.email, ISSUER, secret)
  return { secret, otpauth, qr: await QRCode.toDataURL(otpauth, { margin: 1, width: 220 }) }
}

/* ---------- recovery codes ---------- */
const RC_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const recoveryHash = (source: string, code: string) =>
  createHmac('sha256', source).update(`aa-recovery:${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`).digest('hex')
const hashRecovery = (code: string) => recoveryHash(keySources()[0], code)

export function newRecoveryCodes() {
  const codes = Array.from({ length: 10 }, () => {
    const s = Array.from({ length: 8 }, () => RC_ALPHABET[randomInt(RC_ALPHABET.length)]).join('')
    return `${s.slice(0, 4)}-${s.slice(4)}`
  })
  return { codes, hashes: codes.map(hashRecovery) }
}

/** Spend a recovery code. True if it was one of theirs and unused. */
export async function useRecoveryCode(staffId: unknown, code: string) {
  /* under every current key, so codes made before MFA_KEY was set still work */
  const hs = keySources().map((k) => recoveryHash(k, code))
  const hit = await Staff.findOneAndUpdate({ _id: staffId, recoveryCodes: { $in: hs } }, { $pull: { recoveryCodes: { $in: hs } } })
  return Boolean(hit)
}

/** For an owner helping someone who lost both their phone and their recovery
 *  codes: switch the second step off and end their sessions. A role that
 *  must use it is walked through setting it up again at their next sign-in. */
export async function resetStaffMfa(staffId: unknown) {
  await Staff.updateOne(
    { _id: staffId },
    {
      $set: { totpEnabled: false },
      $unset: { totpSecret: 1, totpPending: 1, totpLastStep: 1, recoveryCodes: 1, totpEnabledAt: 1 },
      $inc: { sessionVersion: 1 },
    },
  )
}

/* ---------- checking a code ---------- */
/** Check a six-digit code against a sealed secret; on success remember its
 *  time-step so the same code can't be used again. */
export async function checkTotp(staffId: unknown, sealed: string | null | undefined, code: string) {
  if (!sealed || !/^\d{6}$/.test(code)) return false
  /* openSecret throws unreadableSecret() (a 409) when the key has changed */
  const delta = authenticator.checkDelta(code, openSecret(sealed))
  if (delta === null) return false
  const step = Math.floor(Date.now() / 30_000) + delta
  /* the update is the claim: a code from a step already used finds nothing */
  const ok = await Staff.updateOne(
    { _id: staffId, $or: [{ totpLastStep: { $exists: false } }, { totpLastStep: null }, { totpLastStep: { $lt: step } }] },
    { $set: { totpLastStep: step } },
  )
  return ok.modifiedCount === 1
}

/* ---------- guesses ---------- */
const strict = () => env.isProd || process.env.STRICT_LIMITS === '1'
function counter(name: string, windowMs: number) {
  const s = new MongoStore(name)
  s.windowMs = windowMs
  return {
    hit: async (k: string) => (await s.increment(k)).totalHits,
    giveBack: (k: string) => s.decrement(k),
  }
}
const pendingGuesses = counter('mfa-pending', PENDING_MS)
const dailyGuesses = counter('mfa-fail', 24 * 3_600_000)

/**
 * Take one guess's worth of allowance BEFORE the code is looked at, or throw.
 * Returns what to call when the guess turns out right: the daily allowance is
 * given back then, so only wrong codes use it up. The per-pending allowance is
 * never given back (a right code ends the pending sign-in anyway).
 *
 * `recovery`: a recovery code doesn't touch the daily cap (see the header).
 */
export async function reserveGuess(p: Pending, opts: { recovery?: boolean } = {}): Promise<() => Promise<void>> {
  if ((await pendingGuesses.hit(p.jti)) > GUESSES_PER_PENDING) {
    /* fields.session tells the sign-in page to go back to the password */
    throw new HttpError(429, 'Too many wrong codes. Sign in again to get another try.', { session: 'expired' })
  }
  if (opts.recovery) return async () => {}
  if ((await dailyGuesses.hit(p.sub)) > (strict() ? FAILS_PER_DAY : FAILS_PER_DAY * 20)) {
    throw new HttpError(429, 'Too many wrong codes today. Use a recovery code, try again tomorrow, or ask an owner for help.')
  }
  return () => dailyGuesses.giveBack(p.sub)
}

/* ---------- the pending cookie ---------- */
export type Pending = { sub: string; kind: 'mfa'; stage: 'challenge' | 'enrol'; remember: boolean; v: number; jti: string }

export function setPending(res: Response, staff: StaffDoc, stage: Pending['stage'], remember: boolean) {
  const claims: Pending = { sub: staff.id, kind: 'mfa', stage, remember, v: staff.sessionVersion ?? 0, jti: randomBytes(12).toString('base64url') }
  const token = jwt.sign(claims, env.jwtSecret, { expiresIn: Math.floor(PENDING_MS / 1000) })
  res.cookie(PENDING_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: env.isProd, maxAge: PENDING_MS, path: PENDING_PATH })
}

export const clearPending = (res: Response) => res.clearCookie(PENDING_COOKIE, { path: PENDING_PATH })

/** The pending sign-in this request carries, and the staff member it is for, or null. */
export async function readPending(req: Request): Promise<{ pending: Pending; staff: StaffDoc } | null> {
  const token = req.cookies?.[PENDING_COOKIE]
  if (!token) return null
  let claims: Pending
  try {
    claims = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }) as Pending
  } catch {
    return null
  }
  if (claims.kind !== 'mfa') return null
  const staff = await Staff.findById(claims.sub)
  if (!staff || !staff.active || (staff.sessionVersion ?? 0) !== claims.v) return null
  return { pending: claims, staff }
}
