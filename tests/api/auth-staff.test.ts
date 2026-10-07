process.env.STRICT_LIMITS = '1'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { sha256 } from '../../server/lib/auth'
import { RateWindow } from '../../server/lib/ratelimit'
import { Staff } from '../../server/models'
import { makeStaff, resetIpLimits } from '../helpers/auth-utils'
import { startApi, type Api } from '../helpers/server'

/* L1: wrong passwords lock a login; unknown emails get the same answer.
   L2: reset links die with a password change and are single-use; signing
   out ends every session. L3: the password rules. */

const PW = 'a long enough sentence'
let api: Api
beforeAll(async () => {
  api = await startApi({ seed: 'none' })
})
afterAll(() => api?.stop())
beforeEach(() => resetIpLimits())

const login = (email: string, password = PW) => api.client().post('/api/auth/staff/login', { email, password })

describe('staff passwords', () => {
  it('gives an unknown email the same answer as a wrong password', async () => {
    await makeStaff({ email: 'known@alanwaar.group', role: 'fundraising' })
    const unknown = await login('nobody@alanwaar.group')
    const wrongPw = await login('known@alanwaar.group', 'not the password')
    expect(unknown.status).toBe(401)
    expect(wrongPw.status).toBe(401)
    expect(unknown.body.error.message).toBe(wrongPw.body.error.message)
  })

  it('locks a login after ten wrong passwords, answering exactly as a wrong password does', async () => {
    await makeStaff({ email: 'locked@alanwaar.group', role: 'finance' })
    for (let i = 0; i < 10; i++) await login('locked@alanwaar.group', `wrong ${i}`)
    /* the per-email request limit would also refuse the next try; clear it
       so this checks the lock itself */
    await RateWindow.deleteMany({ _id: /^auth-login-email:/ })
    const right = await login('locked@alanwaar.group')
    const unknown = await login('nobody-at-all@alanwaar.group')
    /* the lock must not tell anyone that this address has a login */
    expect(right.status).toBe(401)
    expect(right.body).toEqual(unknown.body)
    const s = await Staff.findOne({ email: 'locked@alanwaar.group' }).select('+lockedUntil')
    expect(s!.lockedUntil!.getTime()).toBeGreaterThan(Date.now())
  })

  it('lets a reset link clear the lock', async () => {
    await makeStaff({ email: 'unlock@alanwaar.group', role: 'volunteer' })
    for (let i = 0; i < 10; i++) await login('unlock@alanwaar.group', `wrong ${i}`)
    await RateWindow.deleteMany({ _id: /^auth-login-email:/ })
    expect((await login('unlock@alanwaar.group')).status).toBe(401)

    const token = 'a-reset-token-for-the-unlock-test'
    await Staff.updateOne({ email: 'unlock@alanwaar.group' }, { $set: { tokenHash: sha256(token), tokenExpires: new Date(Date.now() + 3_600_000) } })
    const reset = await api.client().post('/api/auth/staff/reset', { token, password: 'a brand new sentence here' })
    expect(reset.status).toBe(200)
    const s = await Staff.findOne({ email: 'unlock@alanwaar.group' }).select('+lockedUntil +failedLogins')
    expect(s!.lockedUntil).toBeFalsy()
    expect(s!.failedLogins).toBe(0)
    expect((await login('unlock@alanwaar.group', 'a brand new sentence here')).status).toBe(200)
  })

  it('forgets wrong passwords older than an hour, so slow typos never add up to a lock', async () => {
    await makeStaff({ email: 'slow@alanwaar.group', role: 'volunteer' })
    for (let i = 0; i < 9; i++) await login('slow@alanwaar.group', `wrong ${i}`)
    /* the run began over an hour ago */
    await Staff.updateOne({ email: 'slow@alanwaar.group' }, { $set: { failedLoginsAt: new Date(Date.now() - 2 * 3_600_000) } })
    await RateWindow.deleteMany({ _id: /^auth-login-email:/ })
    await login('slow@alanwaar.group', 'one more typo')
    const s = await Staff.findOne({ email: 'slow@alanwaar.group' }).select('+failedLogins +lockedUntil')
    expect(s!.failedLogins).toBe(1)
    expect(s!.lockedUntil).toBeFalsy()
  })

  it('does not count successful sign-ins against the per-account limit', async () => {
    await makeStaff({ email: 'often@alanwaar.group', role: 'volunteer' })
    const statuses = []
    for (let i = 0; i < 12; i++) {
      statuses.push((await login('often@alanwaar.group')).status)
      await resetIpLimits()
    }
    expect(statuses.every((s) => s === 200)).toBe(true)
  })

  it('limits password attempts per account whatever the IP', async () => {
    await makeStaff({ email: 'spray@alanwaar.group', role: 'volunteer' })
    let last = 0
    for (let i = 0; i < 11; i++) {
      last = (await login('spray@alanwaar.group', `wrong ${i}`)).status
      await resetIpLimits()
    }
    expect(last).toBe(429)
  })

  it('refuses common, too-short and over-72-byte passwords', async () => {
    await makeStaff({ email: 'rules@alanwaar.group', role: 'volunteer' })
    const c = await api.staff('rules@alanwaar.group', PW)
    for (const next of ['password123', 'short', 'é'.repeat(40)]) {
      const r = await c.post('/api/auth/staff/password', { current: PW, next })
      expect(r.status).toBe(400)
      expect(r.body.error.fields.next).toBeTruthy()
    }
  })
})

describe('reset links and sessions', () => {
  it('a password change kills an outstanding reset link', async () => {
    const s = await makeStaff({ email: 'resetme@alanwaar.group', role: 'volunteer' })
    await Staff.updateOne({ _id: s._id }, { $set: { tokenHash: sha256('tok-0123456789'), tokenExpires: new Date(Date.now() + 3_600_000) } })
    expect((await api.client().get('/api/auth/staff/token/tok-0123456789')).status).toBe(200)
    const c = await api.staff('resetme@alanwaar.group', PW)
    expect((await c.post('/api/auth/staff/password', { current: PW, next: 'an entirely new sentence' })).status).toBe(200)
    expect((await api.client().get('/api/auth/staff/token/tok-0123456789')).status).toBe(400)
  })

  it('a reset link works once, even when used twice at the same moment', async () => {
    const s = await makeStaff({ email: 'once@alanwaar.group', role: 'volunteer' })
    await Staff.updateOne({ _id: s._id }, { $set: { tokenHash: sha256('tok-once-0123456789'), tokenExpires: new Date(Date.now() + 3_600_000) } })
    const [a, b] = await Promise.all([
      api.client().post('/api/auth/staff/reset', { token: 'tok-once-0123456789', password: 'first new sentence here' }),
      api.client().post('/api/auth/staff/reset', { token: 'tok-once-0123456789', password: 'second new sentence here' }),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 400])
  })

  it('signing out ends every session', async () => {
    await makeStaff({ email: 'twice@alanwaar.group', role: 'volunteer' })
    const a = await api.staff('twice@alanwaar.group', PW)
    const b = await api.staff('twice@alanwaar.group', PW)
    await a.post('/api/auth/staff/logout')
    expect((await b.get('/api/auth/session')).body.staff).toBeNull()
  })

  it('answers forgotten-password requests the same for any address', async () => {
    await makeStaff({ email: 'forgot@alanwaar.group', role: 'volunteer' })
    const known = await api.client().post('/api/auth/staff/forgot', { email: 'forgot@alanwaar.group' })
    const unknown = await api.client().post('/api/auth/staff/forgot', { email: 'ghost@alanwaar.group' })
    expect(known.status).toBe(200)
    expect(unknown.status).toBe(200)
    expect(known.body).toEqual(unknown.body)
  })
})

describe('the CSRF guard', () => {
  it('exempts only the one-click unsubscribe', async () => {
    const one = await api.client().post('/api/public/unsubscribe/one-click?t=x', {}, { csrf: false })
    expect(one.status).not.toBe(403)
    const other = await api.client().post('/api/public/unsubscribe', {}, { csrf: false })
    expect(other.status).toBe(403)
  })
})
