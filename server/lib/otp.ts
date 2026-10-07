import { createHmac } from 'node:crypto'
import { env } from '../env'
import { OtpCode } from '../models'
import { HttpError } from './http'
import { MongoStore } from './ratelimit'
import { newOtp, safeEqual } from './auth'

/* ---------------------------------------------------------------------------
   Six-digit email codes: making one, and checking a guess.

   A code is worth guessing — it opens a donor's account, or moves another
   person's address onto one — so limits stand between a guesser and it. But
   the same limits are a way to keep a donor OUT: if anyone could use up an
   address's allowance, a stranger could stop that donor signing in. So the
   caps come in two sizes:

     - five guesses per code, counted with one atomic $inc, so twenty
       guesses sent at the same moment can't all read "0 tries so far";
     - per address AND IP: five codes an hour, ten wrong guesses a day. One
       attacker uses up only their own allowance; the donor, from their own
       connection, still gets codes;
     - per address, from anywhere: thirty codes an hour and fifty wrong
       guesses a day. This is what bounds a distributed attack: at most fifty
       guesses a day at a million-to-one, about one chance in twenty thousand
       a day — and locking the donor out takes the effort of five or more
       separate IPs, not one script.

   ("Address" is the donor, for an email change.)

   A right code is only good if deleting it succeeds, so two requests holding
   the same right code can't both sign in.

   Codes are stored as an HMAC under the server's secret rather than a bare
   SHA-256: with a million possible codes, a bare hash in a leaked database is
   reversed in a second.

   Outside production the hourly and daily caps are twenty times looser (the
   sweep and the browser tests sign in all day) unless STRICT_LIMITS=1.
--------------------------------------------------------------------------- */

const HOUR = 3_600_000
const DAY = 24 * HOUR
const TTL_MS = 10 * 60_000
export const OTP_GUESSES = 5
const SENDS_PER_HOUR = 5
const FAILS_PER_DAY = 10
const SENDS_PER_HOUR_ANYWHERE = 30
const FAILS_PER_DAY_ANYWHERE = 50

const strict = () => env.isProd || process.env.STRICT_LIMITS === '1'
const cap = (n: number) => (strict() ? n : n * 20)

function counter(name: string, windowMs: number) {
  const s = new MongoStore(name)
  s.windowMs = windowMs
  return {
    hit: async (key: string) => (await s.increment(key)).totalHits,
    count: async (key: string) => (await s.get(key))?.totalHits ?? 0,
  }
}
const sends = counter('otp-send', HOUR)
const fails = counter('otp-fail', DAY)

const digest = (key: string, code: string) => createHmac('sha256', env.jwtSecret).update(`${key}:${code}`).digest('hex')

const pair = (limitKey: string, ip: string) => `${limitKey}|${ip || '-'}`

const tooManyWrong = () => new HttpError(429, 'Too many wrong codes for this address today. Try again tomorrow, or contact us.', { code: 'Too many tries' })

/** Over either daily wrong-guess cap: this address from this IP, or this address from anywhere. */
async function assertGuessesLeft(limitKey: string, ip: string) {
  const [mine, all] = await Promise.all([fails.count(pair(limitKey, ip)), fails.count(limitKey)])
  if (mine >= cap(FAILS_PER_DAY) || all >= cap(FAILS_PER_DAY_ANYWHERE)) throw tooManyWrong()
}

/**
 * Make a fresh code for `key` (an email address, or an email-change key) and
 * return it for the caller to send. `limitKey` is what the hourly and daily
 * caps count against — the address for sign-in, the donor for a change — and
 * `ip` the requester (req.ip), for the per-address-and-IP caps.
 */
export async function issueOtp(key: string, limitKey: string = key, ip = ''): Promise<string> {
  await assertGuessesLeft(limitKey, ip)
  const [mine, all] = await Promise.all([sends.hit(pair(limitKey, ip)), sends.hit(limitKey)])
  if (mine > cap(SENDS_PER_HOUR) || all > cap(SENDS_PER_HOUR_ANYWHERE)) {
    throw new HttpError(429, 'We have sent several codes to this address already. Wait an hour, then ask for another.')
  }
  const code = newOtp()
  await OtpCode.deleteMany({ email: key })
  await OtpCode.create({ email: key, codeHash: digest(key, code), expiresAt: new Date(Date.now() + TTL_MS) })
  return code
}

/** Check a guess. Throws the message the form shows; returns if the code was right (and is now spent). */
export async function consumeOtp(key: string, code: string, limitKey: string = key, ip = ''): Promise<void> {
  await assertGuessesLeft(limitKey, ip)
  const now = new Date()
  const row = await OtpCode.findOneAndUpdate(
    { email: key, expiresAt: { $gt: now }, attempts: { $lt: OTP_GUESSES } },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' },
  )
  if (!row) {
    const spent = await OtpCode.findOne({ email: key, expiresAt: { $gt: now } })
    if (spent) {
      await OtpCode.deleteOne({ _id: spent._id })
      throw new HttpError(400, 'Too many tries. Ask for a new code.', { code: 'Too many tries' })
    }
    throw new HttpError(400, 'That code has expired. Ask for a new one.', { code: 'Expired' })
  }
  if (!safeEqual(row.codeHash, digest(key, code))) {
    await Promise.all([fails.hit(pair(limitKey, ip)), fails.hit(limitKey)])
    throw new HttpError(400, 'That code is not right. Check the email and try again.', { code: 'Not right' })
  }
  /* the delete is the claim: if another request got here first with the
     same code, this one finds nothing to delete and is refused */
  const { deletedCount } = await OtpCode.deleteOne({ _id: row._id })
  if (deletedCount !== 1) throw new HttpError(400, 'That code has already been used. Ask for a new one.', { code: 'Expired' })
}
