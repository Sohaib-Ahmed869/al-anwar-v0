import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Donor, EmailMessage } from '../../server/models'
import { codeFor, resetIpLimits } from '../helpers/auth-utils'
import { startApi, type Api } from '../helpers/server'

/* M3: donor sessions can be ended everywhere. M4: a changed sign-in email
   retires the old address as a login and tells it. M16: one active donor per
   address. */

let api: Api
beforeAll(async () => {
  api = await startApi({ seed: 'none' })
})
afterAll(() => api?.stop())
beforeEach(() => resetIpLimits())

const signedIn = async (c: ReturnType<Api['client']>) => (await c.get('/api/auth/session')).body.donor

describe('donor sessions', () => {
  it('signing out on one device signs out every device', async () => {
    const a = await api.donor('two.devices@example.com')
    const b = await api.donor('two.devices@example.com')
    expect(await signedIn(b)).toBeTruthy()
    const stolen = new Map(b.cookies)
    await a.post('/api/auth/donor/logout')
    expect(await signedIn(a)).toBeNull()
    expect(await signedIn(b)).toBeNull()
    /* a copy of the cookie taken before sign-out is worthless too */
    const thief = api.client()
    for (const [k, v] of stolen) thief.cookies.set(k, v)
    expect((await thief.get('/api/me/profile')).status).toBe(401)
  })
})

describe('changing the sign-in email', () => {
  it('retires the old address, tells it, ends other sessions and keeps this one', async () => {
    const old = 'moving@example.com'
    const next = 'moved@example.com'
    const here = await api.donor(old)
    const elsewhere = await api.donor(old)

    const sent = await here.post('/api/me/profile/email', { email: next })
    expect(sent.status).toBe(200)
    const done = await here.post('/api/me/profile/email/confirm', { email: next, code: sent.body.devCode })
    expect(done.status).toBe(200)
    expect(done.body.donor.email).toBe(next)

    expect((await signedIn(here))?.email).toBe(next)
    expect(await signedIn(elsewhere)).toBeNull()

    const notice = await EmailMessage.findOne({ to: old, template: 'account.email_changed' }).lean()
    expect(notice).toBeTruthy()
    expect(notice!.html).not.toMatch(/\d{6}/)

    /* the old address proves its mailbox but is refused */
    const c = api.client()
    const code = await codeFor(c, old)
    const refused = await c.post('/api/auth/donor/verify', { email: old, code })
    expect(refused.status).toBe(400)
    expect(refused.body.error.message).toMatch(/no longer signs in/)

    /* gifts made with it still match the record */
    const d = await Donor.findOne({ email: next }).lean()
    expect(d!.altEmails).toContain(old)
    expect(d!.retiredLogins).toContain(old)
  })

  it('caps email-change codes per donor', async () => {
    process.env.STRICT_LIMITS = '1'
    try {
      const d = await api.donor('capped@example.com')
      const statuses: number[] = []
      for (let i = 0; i < 6; i++) {
        statuses.push((await d.post('/api/me/profile/email', { email: `new${i}@example.com` })).status)
        await resetIpLimits()
      }
      expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true)
      expect(statuses[5]).toBe(429)
    } finally {
      process.env.STRICT_LIMITS = ''
    }
  })
})

describe('one active donor per address', () => {
  it('refuses a second active record with the same email, but not a merged one', async () => {
    await Donor.init()
    await Donor.create({ number: 'D-T1', firstName: 'A', email: 'unique@example.com' })
    await expect(Donor.create({ number: 'D-T2', firstName: 'B', email: 'unique@example.com' })).rejects.toMatchObject({ code: 11000 })
    await expect(Donor.create({ number: 'D-T3', firstName: 'C', email: 'unique@example.com', status: 'merged' })).resolves.toBeTruthy()
  })
})
