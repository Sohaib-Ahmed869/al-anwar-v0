import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { Types } from 'mongoose'
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { can, ROLES, type Permission, type Role } from '../../shared/access'
import { env } from '../env'
import { Donor, Staff, type DonorDoc, type StaffDoc } from '../models'
import { forbidden, HttpError } from './http'
import { mfaRequired } from './mfa'

/* ---------------------------------------------------------------------------
   Sessions.

   Staff and donors are two different audiences with two different cookies,
   so being signed in to the admin portal never makes anyone a donor, and a
   donor's session can never reach an /api/admin route. Both are httpOnly,
   SameSite=Lax JWTs; nothing in the browser can read them.

   Every state-changing request must also carry `X-Requested-With: aa`, which
   the portals' fetch wrapper sets and a cross-site form post cannot. That plus
   SameSite is the CSRF defence. Two requests are exempt: the Stripe webhook,
   and the one-click unsubscribe a mail provider POSTs on the reader's behalf
   (RFC 8058), whose token is its own authority.

   Both kinds of session can be ended everywhere: each cookie carries the
   record's sessionVersion, and bumping it (sign-out, a password or email
   change, a role change) makes every older cookie worthless.
--------------------------------------------------------------------------- */

declare module 'express-serve-static-core' {
  interface Request {
    staff?: StaffDoc
    donor?: DonorDoc
  }
}

const STAFF_COOKIE = 'aa_staff'
const DONOR_COOKIE = 'aa_donor'

type StaffClaims = { sub: string; kind: 'staff'; v: number }
type DonorClaims = { sub: string; kind: 'donor'; v?: number }

function setCookie(res: Response, name: string, token: string, days: number) {
  res.cookie(name, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: days * 86_400_000,
    path: '/',
  })
}

export function signInStaff(res: Response, staff: StaffDoc, remember: boolean) {
  const days = remember ? 30 : 1
  const token = jwt.sign({ sub: staff.id, kind: 'staff', v: staff.sessionVersion ?? 0 } satisfies StaffClaims, env.jwtSecret, {
    expiresIn: `${days}d`,
  })
  setCookie(res, STAFF_COOKIE, token, days)
}

export function signInDonor(res: Response, donor: DonorDoc) {
  const token = jwt.sign({ sub: donor.id, kind: 'donor', v: donor.sessionVersion ?? 0 } satisfies DonorClaims, env.jwtSecret, {
    expiresIn: '30d',
  })
  setCookie(res, DONOR_COOKIE, token, 30)
}

export const signOutStaff = (res: Response) => res.clearCookie(STAFF_COOKIE, { path: '/' })
export const signOutDonor = (res: Response) => res.clearCookie(DONOR_COOKIE, { path: '/' })

/** End every session a donor has, on every device: signing out, a changed
 *  sign-in email, or staff acting on a report of a stolen account. A cookie
 *  issued to a record later merged into this one is checked against the
 *  merged record's version (currentDonor), so those are bumped too. */
export async function signOutDonorEverywhere(donorId: unknown) {
  const id = new Types.ObjectId(String(donorId))
  await Donor.updateMany({ $or: [{ _id: id }, { mergedInto: id }] }, { $inc: { sessionVersion: 1 } })
}

/** The same for a staff member. */
export async function signOutStaffEverywhere(staffId: unknown) {
  await Staff.updateOne({ _id: staffId }, { $inc: { sessionVersion: 1 } })
}

function verify<T>(token: string | undefined): T | null {
  if (!token) return null
  try {
    return jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }) as T
  } catch {
    return null
  }
}

export async function currentStaff(req: Request): Promise<StaffDoc | null> {
  if (req.staff) return req.staff
  const claims = verify<StaffClaims>(req.cookies?.[STAFF_COOKIE])
  if (!claims || claims.kind !== 'staff') return null
  const staff = await Staff.findById(claims.sub)
  if (!staff || !staff.active || (staff.sessionVersion ?? 0) !== claims.v) return null
  /* a role that must use two-step sign-in and hasn't set it up yet is sent
     back to sign in, where it is walked through the setup (lib/mfa.ts) */
  if (mfaRequired(staff.role) && !staff.totpEnabled) return null
  req.staff = staff
  return staff
}

export async function currentDonor(req: Request): Promise<DonorDoc | null> {
  if (req.donor) return req.donor
  const claims = verify<DonorClaims>(req.cookies?.[DONOR_COOKIE])
  if (!claims || claims.kind !== 'donor') return null
  let donor = await Donor.findById(claims.sub)
  /* checked on the record the cookie names, before following a merge */
  if (!donor || (donor.sessionVersion ?? 0) !== (claims.v ?? 0)) return null
  /* a donor merged into another record keeps working: they are simply the
     surviving record now */
  if (donor?.status === 'merged' && donor.mergedInto) donor = await Donor.findById(donor.mergedInto)
  if (!donor) return null
  req.donor = donor
  return donor
}

/** Signed-in staff with EVERY permission listed. */
export function requireStaff(...perms: Permission[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const staff = await currentStaff(req)
    if (!staff) throw new HttpError(401, 'Please sign in again.')
    for (const p of perms) if (!can(staff.role as Role, p)) throw forbidden()
    next()
  }
}

/** Signed-in staff with ANY of the permissions listed. */
export function requireStaffAny(...perms: Permission[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const staff = await currentStaff(req)
    if (!staff) throw new HttpError(401, 'Please sign in again.')
    if (!perms.some((p) => can(staff.role as Role, p))) throw forbidden()
    next()
  }
}

export async function requireDonor(req: Request, _res: Response, next: NextFunction) {
  const donor = await currentDonor(req)
  if (!donor) throw new HttpError(401, 'Please sign in to your account.')
  next()
}

export const staffCan = (req: Request, p: Permission) => Boolean(req.staff && can(req.staff.role as Role, p))

export const permissionsOf = (role: Role): Permission[] => [...ROLES[role].perms]

/** Refuses cross-site state changes. See the note at the top of this file. */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  if (req.path.startsWith('/webhooks/')) return next()
  /* RFC 8058 one-click unsubscribe: Gmail and Yahoo POST it with no custom
     header; the unguessable token in the URL is what authorises it */
  if (req.method === 'POST' && req.path === '/public/unsubscribe/one-click') return next()
  /* the public site's forms post plain JSON too, and go through the same guard */
  if (req.get('x-requested-with') !== 'aa') throw new HttpError(403, 'Request refused.')
  next()
}

/* ---------- secrets ---------- */
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export const newToken = () => randomBytes(32).toString('base64url')

/** Six digits, never starting with 0 so nobody has to wonder whether it counts. */
export const newOtp = () => String(randomInt(100000, 1000000))
