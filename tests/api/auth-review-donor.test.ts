process.env.STRICT_LIMITS = '1'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { env } from '../../server/env'
import { Donor } from '../../server/models'
import { codeFor, makeStaff, resetLimits, wrong } from '../helpers/auth-utils'
import type { Client } from '../helpers/client'
import { startApi, type Api } from '../helpers/server'

/* ---------------------------------------------------------------------------
   Fixes from the review of donor sign-in:
     5. a merge keeps every retired sign-in address retired, and ends the
        merged record's sessions;
     6. "sign out everywhere" also ends sessions issued to records merged in;
     7. one IP can't use up an address's code allowance for everyone else;
   and from the platform review: a staging deploy (production + simulated
   payments, no mail server) shows sign-in codes on screen, a live one never.

   Requests are told apart by IP with X-Forwarded-For: the app trusts one
   proxy hop (TRUST_PROXY defaults to 1), as it does behind Render.
--------------------------------------------------------------------------- */

const PW = 'a long enough sentence'
let api: Api
let owner: Client
beforeAll(async () => {
  api = await startApi({ seed: 'none' })
  await makeStaff({ email: 'owner@alanwaar.group', role: 'owner', password: PW })
  owner = await api.staff('owner@alanwaar.group', PW)
})
afterAll(() => api?.stop())
beforeEach(() => resetLimits())

const from = (ip: string) => ({ headers: { 'X-Forwarded-For': ip } })

async function donorSession(email: string) {
  const c = api.client()
  const code = await codeFor(c, email)
  expect((await c.post('/api/auth/donor/verify', { email, code })).status).toBe(200)
  return c
}
const signedIn = async (c: Client) => Boolean((await c.get('/api/auth/session')).body.donor)

describe('merging donors', () => {
  it('keeps a retired sign-in address retired on the survivor, and ends the merged record’s sessions', async () => {
    const keep = await donorSession('keep@example.com')
    const gone = await donorSession('gone@example.com')
    /* the second record moved its sign-in away from old@ (finding M4) */
    await Donor.updateOne({ email: 'gone@example.com' }, { $set: { altEmails: ['old@example.com'], retiredLogins: ['old@example.com'] } })
    const [p, s] = await Promise.all([Donor.findOne({ email: 'keep@example.com' }), Donor.findOne({ email: 'gone@example.com' })])

    const merged = await owner.post('/api/admin/donors/merge', { primary: p!.id, secondary: s!.id })
    expect(merged.status).toBe(200)
    expect(await signedIn(gone)).toBe(false)
    expect(await signedIn(keep)).toBe(true)

    const survivor = await Donor.findById(p!._id)
    expect(survivor!.retiredLogins).toContain('old@example.com')
    expect(survivor!.retiredLogins).not.toContain('keep@example.com')

    /* whoever reads old@ now can't get in through the merge */
    const c = api.client()
    const code = await codeFor(c, 'old@example.com')
    const r = await c.post('/api/auth/donor/verify', { email: 'old@example.com', code })
    expect(r.status).toBe(400)
    expect(r.body.error.message).toMatch(/no longer signs in/)
  })

  it('signs out sessions issued to records merged in earlier', async () => {
    await donorSession('survivor@example.com')
    const older = await donorSession('older@example.com')
    const [p, s] = await Promise.all([Donor.findOne({ email: 'survivor@example.com' }), Donor.findOne({ email: 'older@example.com' })])
    /* merged before this fix: no version bump, so its cookie still worked */
    await Donor.updateOne({ _id: s!._id }, { $set: { status: 'merged', mergedInto: p!._id } })
    expect(await signedIn(older)).toBe(true)
    expect((await owner.post(`/api/admin/donors/${p!.id}/sign-out`)).status).toBe(200)
    expect(await signedIn(older)).toBe(false)
  })
})

describe('code limits per address and IP', () => {
  it('a sixth code an hour is refused from one IP, but the donor’s own connection still gets one', async () => {
    const email = 'target@example.com'
    for (let i = 0; i < 5; i++) expect((await api.client().post('/api/auth/donor/code', { email }, from('203.0.113.9'))).status).toBe(200)
    expect((await api.client().post('/api/auth/donor/code', { email }, from('203.0.113.9'))).status).toBe(429)
    expect((await api.client().post('/api/auth/donor/code', { email }, from('198.51.100.7'))).status).toBe(200)
  })

  it('ten wrong guesses lock that IP out for the day, not the donor', async () => {
    const email = 'guessed@example.com'
    const attacker = api.client()
    for (let round = 0; round < 2; round++) {
      const code = (await attacker.post('/api/auth/donor/code', { email }, from('203.0.113.50'))).body.devCode as string
      for (let i = 0; i < 5; i++) {
        expect((await attacker.post('/api/auth/donor/verify', { email, code: wrong(code) }, from('203.0.113.50'))).status).toBe(400)
      }
    }
    expect((await attacker.post('/api/auth/donor/code', { email }, from('203.0.113.50'))).status).toBe(429)

    const donor = api.client()
    const code = (await donor.post('/api/auth/donor/code', { email }, from('198.51.100.20'))).body.devCode as string
    expect((await donor.post('/api/auth/donor/verify', { email, code }, from('198.51.100.20'))).status).toBe(200)
  })

  it('still bounds an address across many IPs: thirty codes an hour from anywhere', async () => {
    const email = 'spread@example.com'
    const statuses: number[] = []
    for (let i = 0; i < 31; i++) statuses.push((await api.client().post('/api/auth/donor/code', { email }, from(`192.0.2.${i + 1}`))).status)
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true)
    expect(statuses[30]).toBe(429)
  })
})

describe('sign-in codes on screen', () => {
  it('shows them on a staging deploy with no mail server, and never on a live one', async () => {
    const was = { isProd: env.isProd, allowSimulated: env.allowSimulated }
    try {
      env.isProd = true
      env.allowSimulated = true
      const staging = await api.client().post('/api/auth/donor/code', { email: 'staging@example.com' })
      expect(staging.body.devCode).toMatch(/^\d{6}$/)
      expect((await api.client().get('/api/auth/providers')).body.devCodes).toBe(true)

      env.allowSimulated = false
      const live = await api.client().post('/api/auth/donor/code', { email: 'live@example.com' })
      expect(live.body.devCode).toBeUndefined()
      expect((await api.client().get('/api/auth/providers')).body.devCodes).toBe(false)
    } finally {
      env.isProd = was.isProd
      env.allowSimulated = was.allowSimulated
    }
  })
})
