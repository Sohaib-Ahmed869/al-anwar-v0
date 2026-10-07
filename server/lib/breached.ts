import { createHash } from 'node:crypto'
import { env } from '../env'

/* ---------------------------------------------------------------------------
   Has this password appeared in a public data breach? (finding L3)

   shared/password-policy.ts refuses the obvious ones from a small built-in
   list; this asks Have I Been Pwned about everything else, without telling it
   the password. Only the first five characters of the password's SHA-1 go
   over the wire (the "range" API's k-anonymity): the service answers with
   every breached hash sharing that prefix, and the match is done here.
   Add-Padding makes every answer the same size, so the response length says
   nothing either.

   The check never blocks a password change on its own failure: if the
   service is slow or down (two seconds), the password is accepted and the
   reason logged — a staff member locked out of setting a password is worse
   than one unchecked password, and the length and common-password rules
   still apply. On by default in production; PWNED_CHECK=1 or 0 overrides,
   and tests leave it off unless they stub the network.
--------------------------------------------------------------------------- */

const RANGE_API = 'https://api.pwnedpasswords.com/range/'

const enabled = () => {
  const v = process.env.PWNED_CHECK
  return v === '1' || (v !== '0' && env.isProd)
}

/** How many times the password appears in known breaches; 0 when it doesn't,
 *  null when the check is off or could not be made. */
export async function breachCount(password: string): Promise<number | null> {
  if (!enabled()) return null
  const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase()
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)
  try {
    const res = await fetch(RANGE_API + prefix, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'al-anwaar-platform' },
      signal: AbortSignal.timeout(2_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    for (const line of (await res.text()).split('\n')) {
      const [hash, count] = line.trim().split(':')
      if (hash === suffix) return Number(count) || 0
    }
    return 0
  } catch (err) {
    console.warn(`[auth] breached-password check unavailable, password accepted: ${(err as Error).message}`)
    return null
  }
}
