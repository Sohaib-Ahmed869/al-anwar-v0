process.env.REQUIRE_STAFF_MFA = '1'
process.env.STRICT_LIMITS = '1'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AuditEvent, Staff } from '../../server/models'
import { forgetLastStep, makeStaff, resetIpLimits, resetLimits, totp } from '../helpers/auth-utils'
import { startApi, type Api } from '../helpers/server'

/* ---------------------------------------------------------------------------
   Fixes from the review of two-step sign-in:
     1. guesses are reserved before they are checked, so a parallel burst
        can't get more than the allowance;
     3. recovery codes still work once the daily wrong-code cap is used up;
     4a. a lost phone: move to a new app with the current password, and new
        recovery codes with the password instead of an app code;
     4b. a secret no key opens is a 409, not a 500, and MFA_KEY can be added
        without breaking existing enrolments;
     8. setting up from a session asks for the current password;
     9. the per-sign-in limit tells the page to go back to the password.
--------------------------------------------------------------------------- */

const PW = 'a long enough sentence'
let api: Api
beforeAll(async () => {
  api = await startApi({ seed: 'none' })
})
afterAll(() => api?.stop())
beforeEach(() => resetLimits())
afterEach(() => {
  delete process.env.MFA_KEY
})

/** An owner who has set up an app (through the sign-in that requires it). */
async function enrolledOwner(email: string) {
  await makeStaff({ email, role: 'owner', password: PW })
  const c = api.client()
  expect((await c.post('/api/auth/staff/login', { email, password: PW })).body).toEqual({ mfa: 'enrol' })
  const setup = await c.post('/api/auth/staff/mfa/setup')
  const done = await c.post('/api/auth/staff/mfa/enable', { code: totp(setup.body.secret) })
  expect(done.status).toBe(200)
  return { session: c, secret: setup.body.secret as string, recoveryCodes: done.body.recoveryCodes as string[] }
}

/** A client part-way through signing in: password given, code to come. */
async function pending(email: string) {
  const c = api.client()
  expect((await c.post('/api/auth/staff/login', { email, password: PW })).body).toEqual({ mfa: 'challenge' })
  return c
}

describe('guess limits', () => {
  it('a burst of parallel wrong codes gets no more than five checked', async () => {
    await enrolledOwner('burst@alanwaar.group')
    const c = await pending('burst@alanwaar.group')
    const res = await Promise.all(Array.from({ length: 20 }, () => c.post('/api/auth/staff/mfa', { code: '000000' })))
    const checked = res.filter((r) => r.status === 400).length
    const refused = res.filter((r) => r.status === 429)
    expect(checked).toBeLessThanOrEqual(5)
    expect(checked + refused.length).toBe(20)
    /* the refusal sends the page back to the password */
    expect(refused[0].body.error.fields.session).toBe('expired')
  })

  it('takes a recovery code after the daily cap on app codes is used up', async () => {
    const { recoveryCodes } = await enrolledOwner('capped@alanwaar.group')
    for (let round = 0; round < 2; round++) {
      const c = await pending('capped@alanwaar.group')
      for (let i = 0; i < 5; i++) expect((await c.post('/api/auth/staff/mfa', { code: '000000' })).status).toBe(400)
      await resetIpLimits()
    }
    const c = await pending('capped@alanwaar.group')
    const app = await c.post('/api/auth/staff/mfa', { code: '111111' })
    expect(app.status).toBe(429)
    expect(app.body.error.message).toMatch(/recovery code/)
    const rc = await c.post('/api/auth/staff/mfa', { recoveryCode: recoveryCodes[0] })
    expect(rc.status).toBe(200)
    expect(rc.body.user.email).toBe('capped@alanwaar.group')
  })

  it('does not use up the daily allowance on right codes', async () => {
    const { secret } = await enrolledOwner('daily@alanwaar.group')
    for (let i = 0; i < 12; i++) {
      await forgetLastStep('daily@alanwaar.group')
      await resetIpLimits()
      const c = await pending('daily@alanwaar.group')
      expect((await c.post('/api/auth/staff/mfa', { code: totp(secret) })).status).toBe(200)
    }
  })
})

describe('a lost or replaced phone', () => {
  it('moves to a new app with the current password; the old one stops working', async () => {
    const { session, secret: oldSecret } = await enrolledOwner('newphone@alanwaar.group')
    expect((await session.post('/api/auth/staff/mfa/replace', {})).status).toBe(400)
    const wrong = await session.post('/api/auth/staff/mfa/replace', { password: 'not the password' })
    expect(wrong.status).toBe(400)
    expect(wrong.body.error.fields.password).toBeTruthy()

    const started = await session.post('/api/auth/staff/mfa/replace', { password: PW })
    expect(started.status).toBe(200)
    const newSecret = started.body.secret as string
    expect(newSecret).not.toBe(oldSecret)
    /* until the new app proves itself, the old one still signs in */
    await forgetLastStep('newphone@alanwaar.group')
    const enabled = await session.post('/api/auth/staff/mfa/enable', { code: totp(newSecret) })
    expect(enabled.status).toBe(200)
    expect(enabled.body.recoveryCodes).toHaveLength(10)

    await forgetLastStep('newphone@alanwaar.group')
    const withOld = await pending('newphone@alanwaar.group')
    if (totp(oldSecret) !== totp(newSecret)) {
      expect((await withOld.post('/api/auth/staff/mfa', { code: totp(oldSecret) })).status).toBe(400)
    }
    await forgetLastStep('newphone@alanwaar.group')
    const withNew = await pending('newphone@alanwaar.group')
    expect((await withNew.post('/api/auth/staff/mfa', { code: totp(newSecret) })).status).toBe(200)
    expect(await AuditEvent.exists({ action: 'staff.mfa_replace' })).toBeTruthy()
  })

  it('makes new recovery codes with the password instead of an app code', async () => {
    const { session } = await enrolledOwner('pwcodes@alanwaar.group')
    expect((await session.post('/api/auth/staff/mfa/recovery-codes', { password: 'nope nope nope' })).status).toBe(400)
    const r = await session.post('/api/auth/staff/mfa/recovery-codes', { password: PW })
    expect(r.status).toBe(200)
    expect(r.body.recoveryCodes).toHaveLength(10)
    /* an owner can't turn it off at all; the password is no way round that */
    expect((await session.post('/api/auth/staff/mfa/disable', { password: PW })).status).toBe(403)
  })
})

describe('the key', () => {
  it('answers 409, not 500, when no key opens the stored secret', async () => {
    await enrolledOwner('broken@alanwaar.group')
    await Staff.updateOne({ email: 'broken@alanwaar.group' }, { $set: { totpSecret: 'v1:AAAAAAAAAAAAAAAA:BBBBBBBBBBBBBBBBBBBBBB:CCCC' } })
    const c = await pending('broken@alanwaar.group')
    const r = await c.post('/api/auth/staff/mfa', { code: '123456' })
    expect(r.status).toBe(409)
    expect(r.body.error.message).toMatch(/owner/)
  })

  it('keeps secrets sealed before MFA_KEY was set working once it is', async () => {
    const { secret, recoveryCodes } = await enrolledOwner('rotate@alanwaar.group')
    process.env.MFA_KEY = 'a separate key set later, before go-live'
    await forgetLastStep('rotate@alanwaar.group')
    const c = await pending('rotate@alanwaar.group')
    expect((await c.post('/api/auth/staff/mfa', { code: totp(secret) })).status).toBe(200)
    const d = await pending('rotate@alanwaar.group')
    expect((await d.post('/api/auth/staff/mfa', { recoveryCode: recoveryCodes[1] })).status).toBe(200)
  })
})

describe('owner reset of a colleague', () => {
  it('clears their password too and emails them a reset link', async () => {
    const { session: owner } = await enrolledOwner('boss@alanwaar.group')
    await enrolledOwner('colleague@alanwaar.group')
    const target = await Staff.findOne({ email: 'colleague@alanwaar.group' })
    const r = await owner.post(`/api/admin/staff/${target!.id}/reset-mfa`)
    expect(r.status).toBe(200)
    const after = await Staff.findById(target!._id).select('+passwordHash +tokenHash')
    expect(after!.totpEnabled).toBe(false)
    expect(after!.passwordHash).toBeFalsy()
    expect(after!.tokenHash).toBeTruthy()
    /* the old password no longer reaches the step where a new app is set up */
    const tryOld = await api.client().post('/api/auth/staff/login', { email: 'colleague@alanwaar.group', password: PW })
    expect(tryOld.status).toBe(401)
  })
})
