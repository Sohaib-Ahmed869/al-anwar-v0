process.env.STRICT_LIMITS = '1'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { OtpCode } from '../../server/models'
import { codeFor, resetIpLimits, wrong } from '../helpers/auth-utils'
import { startApi, type Api } from '../helpers/server'

/* H3: donor sign-in codes can't be brute-forced — not by guessing in
   parallel, not by asking for fresh codes, and a right code works once. */

let api: Api
beforeAll(async () => {
  api = await startApi({ seed: 'none' })
})
afterAll(() => api?.stop())
beforeEach(() => resetIpLimits())

describe('donor sign-in codes', () => {
  it('counts parallel guesses atomically: at most five are even checked', async () => {
    const c = api.client()
    const email = 'parallel@example.com'
    const code = await codeFor(c, email)
    const results = await Promise.all(Array.from({ length: 20 }, () => c.post('/api/auth/donor/verify', { email, code: wrong(code) })))
    const checked = results.filter((r) => r.body?.error?.fields?.code === 'Not right')
    expect(checked.length).toBeLessThanOrEqual(5)
    /* and the code is burnt: the right one no longer works */
    const late = await c.post('/api/auth/donor/verify', { email, code })
    expect(late.status).toBe(400)
  })

  it('lets a right code sign in only once, even when sent twice at once', async () => {
    const email = 'twice@example.com'
    const code = await codeFor(api.client(), email)
    const [a, b] = await Promise.all([
      api.client().post('/api/auth/donor/verify', { email, code }),
      api.client().post('/api/auth/donor/verify', { email, code }),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 400])
  })

  it('stores the code as an HMAC, never the code itself', async () => {
    const email = 'stored@example.com'
    const code = await codeFor(api.client(), email)
    const row = await OtpCode.findOne({ email }).lean()
    expect(row!.codeHash).not.toContain(code)
    expect(row!.codeHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('sends at most five codes an hour to one address', async () => {
    const c = api.client()
    const email = 'sends@example.com'
    for (let i = 0; i < 5; i++) expect((await c.post('/api/auth/donor/code', { email })).status).toBe(200)
    const sixth = await c.post('/api/auth/donor/code', { email })
    expect(sixth.status).toBe(429)
    /* a different address is unaffected */
    expect((await c.post('/api/auth/donor/code', { email: 'other@example.com' })).status).toBe(200)
  })

  it('caps wrong guesses per address across codes, so resending gives no fresh guesses', async () => {
    const c = api.client()
    const email = 'resend@example.com'
    for (let round = 0; round < 2; round++) {
      const code = await codeFor(c, email)
      for (let i = 0; i < 5; i++) await c.post('/api/auth/donor/verify', { email, code: wrong(code) })
      await resetIpLimits()
    }
    /* ten wrong today: no more codes, and no more guesses */
    const send = await c.post('/api/auth/donor/code', { email })
    expect(send.status).toBe(429)
    const guess = await c.post('/api/auth/donor/verify', { email, code: '123456' })
    expect(guess.status).toBe(429)
  })
})
