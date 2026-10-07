import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { env } from '../../server/env'
import { Donor } from '../../server/models'
import type { Client } from '../helpers/client'
import { codeFor, resetIpLimits } from '../helpers/auth-utils'
import { startApi, type Api } from '../helpers/server'

/* M1: the OAuth state must really match. M2: a provider signs a donor in by
   its account id; an email address only links to an existing record after
   an emailed code proves the mailbox.

   The API runs in this process, so Google's and Facebook's endpoints are
   stubbed by wrapping fetch: requests to them get the profile set below,
   everything else (the test client's own calls) goes through untouched. */

let api: Api
let profile: Record<string, unknown> = {}
const realFetch = globalThis.fetch

beforeAll(async () => {
  api = await startApi({ seed: 'none' })
  env.google = { id: 'g-client', secret: 'g-secret' }
  env.facebook = { id: 'f-client', secret: 'f-secret' }
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    if (/oauth2\.googleapis\.com|graph\.facebook\.com\/v19\.0\/oauth/.test(url)) return Response.json({ access_token: 'tok' })
    if (/openidconnect\.googleapis\.com|graph\.facebook\.com\/me/.test(url)) return Response.json(profile)
    return realFetch(input, init)
  }) as typeof fetch
})
afterAll(async () => {
  globalThis.fetch = realFetch
  await api?.stop()
})
beforeEach(() => resetIpLimits())

/** Start the flow and come back with the given profile; returns the redirect. */
async function oauth(c: Client, p: 'google' | 'facebook', prof: Record<string, unknown>) {
  profile = prof
  const start = await c.get(`/api/auth/donor/oauth/${p}`)
  const state = new URL(start.headers.get('location')!).searchParams.get('state')!
  const back = await c.get(`/api/auth/donor/oauth/${p}/callback?code=abc&state=${encodeURIComponent(state)}`)
  return back.headers.get('location') ?? ''
}

describe('the OAuth state check (M1)', () => {
  it('fails when both the state and the cookie are missing', async () => {
    const r = await api.client().get('/api/auth/donor/oauth/google/callback?code=abc')
    expect(r.status).toBe(302)
    expect(r.headers.get('location')).toBe('/account/login?error=oauth')
    expect(r.headers.getSetCookie().some((c) => c.startsWith('aa_donor=') && !c.startsWith('aa_donor=;'))).toBe(false)
  })

  it('fails when the state does not match the cookie', async () => {
    const c = api.client()
    await c.get('/api/auth/donor/oauth/google')
    const r = await c.get(`/api/auth/donor/oauth/google/callback?code=abc&state=${'x'.repeat(43)}`)
    expect(r.headers.get('location')).toBe('/account/login?error=oauth')
  })
})

describe('linking providers (M2)', () => {
  it('refuses a Google address Google has not verified', async () => {
    const c = api.client()
    expect(await oauth(c, 'google', { sub: 'g-unverified', email: 'unverified@example.com', email_verified: false })).toBe('/account/login?error=oauth')
  })

  it('creates a new donor from a verified Google address and signs in by Google id after', async () => {
    const c = api.client()
    expect(await oauth(c, 'google', { sub: 'g-new', email: 'fresh@example.com', email_verified: true, given_name: 'Fresh' })).toBe('/account')
    expect((await c.get('/api/auth/session')).body.donor.email).toBe('fresh@example.com')
    /* the provider id, not the email, is what signs in next time */
    const again = api.client()
    expect(await oauth(again, 'google', { sub: 'g-new', email: 'changed@example.com', email_verified: true })).toBe('/account')
    expect((await again.get('/api/auth/session')).body.donor.email).toBe('fresh@example.com')
  })

  it('makes an existing donor prove the mailbox before Google is linked', async () => {
    await api.donor('existing@example.com')
    const c = api.client()
    const to = await oauth(c, 'google', { sub: 'g-attacker', email: 'existing@example.com', email_verified: true })
    expect(to).toBe('/account/login?link=google&email=existing%40example.com')
    expect((await c.get('/api/auth/session')).body.donor).toBeNull()

    const code = await codeFor(c, 'existing@example.com')
    expect((await c.post('/api/auth/donor/verify', { email: 'existing@example.com', code })).status).toBe(200)
    const d = await Donor.findOne({ email: 'existing@example.com' }).lean()
    expect(d!.oauth?.google).toBe('g-attacker')
  })

  it('does not link when the code proves a different address', async () => {
    await api.donor('victim@example.com')
    const c = api.client()
    await oauth(c, 'google', { sub: 'g-other', email: 'victim@example.com', email_verified: true })
    const code = await codeFor(c, 'someone.else@example.com')
    await c.post('/api/auth/donor/verify', { email: 'someone.else@example.com', code })
    expect((await Donor.findOne({ email: 'victim@example.com' }).lean())!.oauth?.google).toBeUndefined()
    expect((await Donor.findOne({ email: 'someone.else@example.com' }).lean())!.oauth?.google).toBeUndefined()
  })

  it('always sends Facebook through an emailed code first', async () => {
    const c = api.client()
    const to = await oauth(c, 'facebook', { id: 'f-1', email: 'fbuser@example.com', first_name: 'Fb' })
    expect(to).toBe('/account/login?link=facebook&email=fbuser%40example.com')
    expect(await Donor.exists({ email: 'fbuser@example.com' })).toBeNull()
  })
})
