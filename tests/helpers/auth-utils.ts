import bcrypt from 'bcryptjs'
import type { Role } from '../../shared/access'
import { authenticator } from 'otplib'
import { RateWindow } from '../../server/lib/ratelimit'
import { Staff } from '../../server/models'
import type { Client } from './client'

/* ---------------------------------------------------------------------------
   Helpers for the sign-in tests (tests/api/auth-*.test.ts).

   Every request in a test file comes from 127.0.0.1, so with STRICT_LIMITS=1
   the per-IP limit (30 per 15 minutes) would trip long before the per-account
   limits a test means to check. resetIpLimits() clears just the per-IP
   counts between tests, leaving the per-account ones under test alone.
--------------------------------------------------------------------------- */

export const resetIpLimits = () => RateWindow.deleteMany({ _id: /^(auth-ip|me-profile):/ })
export const resetLimits = () => RateWindow.deleteMany({})

export async function makeStaff(o: { email: string; role: Role; password?: string; name?: string }) {
  return Staff.create({
    name: o.name ?? o.email.split('@')[0],
    email: o.email,
    role: o.role,
    passwordHash: await bcrypt.hash(o.password ?? 'a long enough sentence', 4),
    passwordSet: true,
  })
}

/** Ask for a donor code and return it (the dev code comes back in tests). */
export async function codeFor(c: Client, email: string) {
  const r = await c.post('/api/auth/donor/code', { email })
  if (r.status !== 200) throw new Error(`code for ${email}: ${r.status} ${JSON.stringify(r.body)}`)
  return r.body.devCode as string
}

/** A six-digit code that isn't `code`. */
export const wrong = (code: string) => String(((Number(code) - 100000 + 1) % 900000) + 100000)

/** The current code for a TOTP secret. */
export const totp = (secret: string) => authenticator.generate(secret)

/** Forget which time-step was last used, so a second code in the same 30
 *  seconds is accepted (the replay guard is tested on its own). */
export const forgetLastStep = (email: string) => Staff.updateOne({ email }, { $unset: { totpLastStep: 1 } })
