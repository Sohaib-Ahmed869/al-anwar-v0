import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { startApi, type Api } from '../helpers/server'

/* ---------------------------------------------------------------------------
   SECURITY FINDINGS C1 and L3.

   C1 — demo logins never reach a live deploy:
     - production refuses SEED_DEMO=1 unless the deploy also says it is
       staging (ALLOW_SIMULATED_PAYMENTS=1);
     - demoLoginsLeft() finds every active staff login still opening with the
       published demo password; server/index.ts refuses to start in
       production (not a demo) while that list isn't empty.

   L3 — a password found in a public breach is refused when it is set, using
   the Have I Been Pwned range API (k-anonymity: only five hex characters of
   the SHA-1 leave the server). The network is stubbed here; nothing in the
   test suite calls the real service.
--------------------------------------------------------------------------- */

let api: Api
beforeAll(async () => {
  api = await startApi({ seed: 'demo' })
})
afterAll(() => api?.stop())
afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.PWNED_CHECK
})

describe('C1: demo data and logins', () => {
  it('refuses SEED_DEMO=1 in production unless the deploy is staging', async () => {
    const { productionProblems } = await import('../../server/env')
    const base = { JWT_SECRET: 'x'.repeat(40), APP_URL: 'https://alanwaar.example' }
    const live = { ...base, STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', SMTP_HOST: 'smtp.example' }
    expect(productionProblems({ ...live, SEED_DEMO: '1' }).join(' ')).toMatch(/SEED_DEMO=1 is only allowed on a staging deploy/)
    expect(productionProblems({ ...live, SEED_DEMO: '0' })).toEqual([])
    expect(productionProblems({ ...base, SEED_DEMO: '1', ALLOW_SIMULATED_PAYMENTS: '1' })).toEqual([])
  })

  it('finds every active staff login still using the demo password, and only those', async () => {
    const { demoLoginsLeft } = await import('../../server/seed/seed')
    const before = await demoLoginsLeft()
    expect(before).toContain('yusuf@alanwaar.group')
    expect(before.length).toBeGreaterThanOrEqual(6)

    const { Staff } = await import('../../server/models')
    const bcrypt = (await import('bcryptjs')).default
    const saved = await Staff.find({}).select('+passwordHash').lean()
    const real = await bcrypt.hash('a different long passphrase', 4)
    await Staff.updateMany({}, { $set: { passwordHash: real } })
    try {
      expect(await demoLoginsLeft()).toEqual([])
    } finally {
      /* the other tests in this file sign in with the demo password */
      for (const s of saved) await Staff.updateOne({ _id: s._id }, { $set: { passwordHash: s.passwordHash } })
    }
  })
})

describe('L3: breached passwords', () => {
  const sha1 = (s: string) => createHash('sha1').update(s).digest('hex').toUpperCase()

  /** stub only the range API; everything else (the test's own API calls) goes through */
  function stubPwned(answer: (prefix: string) => Response | Promise<Response>) {
    const real = globalThis.fetch
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input instanceof Request ? input.url : input)
      const m = /^https:\/\/api\.pwnedpasswords\.com\/range\/([0-9A-F]{5})$/.exec(u)
      if (m) return answer(m[1])
      return real(input, init)
    })
  }

  it('counts a breached password, sending only the hash prefix', async () => {
    process.env.PWNED_CHECK = '1'
    const pw = 'correct horse battery staple'
    const h = sha1(pw)
    const seen: string[] = []
    stubPwned((prefix) => {
      seen.push(prefix)
      return new Response(`0000000000000000000000000000000000A:3\r\n${h.slice(5)}:1234\r\n`)
    })
    const { breachCount } = await import('../../server/lib/breached')
    expect(await breachCount(pw)).toBe(1234)
    expect(seen).toEqual([h.slice(0, 5)])
  })

  it('answers 0 for a password not in the list, and null (accept) when the service fails', async () => {
    process.env.PWNED_CHECK = '1'
    const { breachCount } = await import('../../server/lib/breached')
    stubPwned(() => new Response('0000000000000000000000000000000000A:3\r\n'))
    expect(await breachCount('an unusual sentence nobody has used')).toBe(0)
    stubPwned(() => {
      throw new TypeError('fetch failed')
    })
    expect(await breachCount('an unusual sentence nobody has used')).toBeNull()
    stubPwned(() => new Response('busy', { status: 503 }))
    expect(await breachCount('an unusual sentence nobody has used')).toBeNull()
  })

  it('is off outside production unless asked for', async () => {
    const { breachCount } = await import('../../server/lib/breached')
    stubPwned(() => {
      throw new Error('must not be called')
    })
    expect(await breachCount('anything at all here')).toBeNull()
  })

  it('refuses a breached password when staff change theirs', async () => {
    const owner = await api.staff('maryam@alanwaar.group')
    process.env.PWNED_CHECK = '1'
    const breached = 'summer holidays in lakemba'
    stubPwned(() => new Response(`${sha1(breached).slice(5)}:52\r\n`))
    const res = await owner.post('/api/auth/staff/password', { current: 'alanwaar-demo', next: breached })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.next).toMatch(/data breach/)

    stubPwned(() => new Response('0000000000000000000000000000000000A:3\r\n'))
    const ok = await owner.post('/api/auth/staff/password', { current: 'alanwaar-demo', next: 'a sentence only maryam would write' })
    expect(ok.status).toBe(200)
  })
})
