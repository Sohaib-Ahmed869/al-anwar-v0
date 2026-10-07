process.env.REQUIRE_STAFF_MFA = '1'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { sha256 } from '../../server/lib/auth'
import { AuditEvent, Staff } from '../../server/models'
import { forgetLastStep, makeStaff, resetIpLimits, resetLimits, totp } from '../helpers/auth-utils'
import { startApi, type Api } from '../helpers/server'

/* L3: two-step sign-in. Required for owner, admin and finance when
   REQUIRE_STAFF_MFA is on (it is in this file); optional for everyone else. */

const PW = 'a long enough sentence'
let api: Api
beforeAll(async () => {
  api = await startApi({ seed: 'none' })
})
afterAll(() => api?.stop())
beforeEach(() => resetIpLimits())

const sessionStaff = async (c: ReturnType<Api['client']>) => (await c.get('/api/auth/session')).body.staff

/** Sign in as a required role with no app yet, and set one up. */
async function enrol(email: string) {
  const c = api.client()
  const first = await c.post('/api/auth/staff/login', { email, password: PW })
  expect(first.body).toEqual({ mfa: 'enrol' })
  expect(await sessionStaff(c)).toBeNull()
  const setup = await c.post('/api/auth/staff/mfa/setup')
  expect(setup.status).toBe(200)
  expect(setup.body.qr).toMatch(/^data:image\/png;base64,/)
  const done = await c.post('/api/auth/staff/mfa/enable', { code: totp(setup.body.secret) })
  expect(done.status).toBe(200)
  expect(done.body.recoveryCodes).toHaveLength(10)
  expect(done.body.user.email).toBe(email)
  return { c, secret: setup.body.secret as string, recoveryCodes: done.body.recoveryCodes as string[] }
}

describe('required roles', () => {
  it('walks an owner with no app through setting one up before any session exists', async () => {
    await makeStaff({ email: 'owner@alanwaar.group', role: 'owner', password: PW })
    const { c } = await enrol('owner@alanwaar.group')
    expect((await sessionStaff(c)).user.role).toBe('owner')
    const s = await Staff.findOne({ email: 'owner@alanwaar.group' }).select('+totpSecret +recoveryCodes')
    /* the secret is encrypted and the recovery codes hashed */
    expect(s!.totpSecret).toMatch(/^v1:/)
    expect(s!.recoveryCodes!.every((h) => /^[0-9a-f]{64}$/.test(h))).toBe(true)
  })

  it('asks for a code at the next sign-in, and refuses a replayed one', async () => {
    await makeStaff({ email: 'admin@alanwaar.group', role: 'admin', password: PW })
    const { secret } = await enrol('admin@alanwaar.group')
    await forgetLastStep('admin@alanwaar.group')

    const c = api.client()
    expect((await c.post('/api/auth/staff/login', { email: 'admin@alanwaar.group', password: PW })).body).toEqual({ mfa: 'challenge' })
    const code = totp(secret)
    const ok = await c.post('/api/auth/staff/mfa', { code })
    expect(ok.status).toBe(200)
    expect((await sessionStaff(c)).user.email).toBe('admin@alanwaar.group')

    const again = api.client()
    await again.post('/api/auth/staff/login', { email: 'admin@alanwaar.group', password: PW })
    const replay = await again.post('/api/auth/staff/mfa', { code })
    expect(replay.status).toBe(400)
    expect(await sessionStaff(again)).toBeNull()
  })

  it('burns a pending sign-in after five wrong codes', async () => {
    await makeStaff({ email: 'finance@alanwaar.group', role: 'finance', password: PW })
    await enrol('finance@alanwaar.group')
    const c = api.client()
    await c.post('/api/auth/staff/login', { email: 'finance@alanwaar.group', password: PW })
    const statuses = []
    for (let i = 0; i < 6; i++) statuses.push((await c.post('/api/auth/staff/mfa', { code: '000000' })).status)
    expect(statuses.slice(0, 5)).toEqual([400, 400, 400, 400, 400])
    expect(statuses[5]).toBe(429)
    await resetLimits()
  })

  it('takes each recovery code once, and audits its use', async () => {
    await makeStaff({ email: 'lostphone@alanwaar.group', role: 'owner', password: PW })
    const { recoveryCodes } = await enrol('lostphone@alanwaar.group')
    const a = api.client()
    await a.post('/api/auth/staff/login', { email: 'lostphone@alanwaar.group', password: PW })
    expect((await a.post('/api/auth/staff/mfa', { recoveryCode: recoveryCodes[0].toUpperCase() })).status).toBe(200)
    const b = api.client()
    await b.post('/api/auth/staff/login', { email: 'lostphone@alanwaar.group', password: PW })
    expect((await b.post('/api/auth/staff/mfa', { recoveryCode: recoveryCodes[0] })).status).toBe(400)
    expect(await AuditEvent.exists({ action: 'staff.mfa_recovery' })).toBeTruthy()
  })

  it('ends an existing session of a required role that has no app yet', async () => {
    process.env.REQUIRE_STAFF_MFA = '0'
    await makeStaff({ email: 'oldsession@alanwaar.group', role: 'finance', password: PW })
    const c = await api.staff('oldsession@alanwaar.group', PW)
    expect(await sessionStaff(c)).toBeTruthy()
    process.env.REQUIRE_STAFF_MFA = '1'
    expect(await sessionStaff(c)).toBeNull()
    expect((await c.get('/api/admin/donors')).status).toBe(401)
  })

  it('does not let a reset link skip the second step', async () => {
    await makeStaff({ email: 'resetmfa@alanwaar.group', role: 'admin', password: PW })
    await enrol('resetmfa@alanwaar.group')
    await Staff.updateOne({ email: 'resetmfa@alanwaar.group' }, { $set: { tokenHash: sha256('tok-mfa-0123456789'), tokenExpires: new Date(Date.now() + 3_600_000) } })
    const c = api.client()
    const r = await c.post('/api/auth/staff/reset', { token: 'tok-mfa-0123456789', password: 'a brand new sentence' })
    expect(r.body).toEqual({ mfa: 'challenge' })
    expect(await sessionStaff(c)).toBeNull()
  })

  it('cannot be turned off by a required role', async () => {
    await makeStaff({ email: 'nooff@alanwaar.group', role: 'owner', password: PW })
    const { c, secret } = await enrol('nooff@alanwaar.group')
    await forgetLastStep('nooff@alanwaar.group')
    expect((await c.post('/api/auth/staff/mfa/disable', { code: totp(secret) })).status).toBe(403)
  })
})

describe('optional roles', () => {
  it('a volunteer signs in without it, can turn it on, and off again with a code', async () => {
    await makeStaff({ email: 'vol@alanwaar.group', role: 'volunteer', password: PW })
    const c = await api.staff('vol@alanwaar.group', PW)
    expect((await c.get('/api/auth/staff/mfa')).body).toMatchObject({ enabled: false, required: false })
    /* from a session, setting up asks for the current password */
    expect((await c.post('/api/auth/staff/mfa/setup')).status).toBe(400)
    expect((await c.post('/api/auth/staff/mfa/setup', { password: 'not it' })).body.error.fields.password).toBeTruthy()
    const setup = await c.post('/api/auth/staff/mfa/setup', { password: PW })
    const on = await c.post('/api/auth/staff/mfa/enable', { code: totp(setup.body.secret) })
    expect(on.status).toBe(200)
    expect(on.body.recoveryCodes).toHaveLength(10)
    expect((await c.get('/api/auth/staff/mfa')).body).toMatchObject({ enabled: true, recoveryCodesLeft: 10 })

    /* now it is asked for */
    await forgetLastStep('vol@alanwaar.group')
    const next = await api.staff('vol@alanwaar.group', PW, { totpSecret: setup.body.secret })
    expect(await sessionStaff(next)).toBeTruthy()

    await forgetLastStep('vol@alanwaar.group')
    expect((await c.post('/api/auth/staff/mfa/disable', { code: '000000' })).status).toBe(400)
    expect((await c.post('/api/auth/staff/mfa/disable', { code: totp(setup.body.secret) })).status).toBe(200)
    expect((await api.client().post('/api/auth/staff/login', { email: 'vol@alanwaar.group', password: PW })).body.user).toBeTruthy()
  })
})
