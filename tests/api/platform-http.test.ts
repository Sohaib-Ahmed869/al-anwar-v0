import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { startApi, type Api } from '../helpers/server'
import { Client } from '../helpers/client'

/* The platform's HTTP surface:
   H4   the origin gate: with ORIGIN_SECRET set, /api answers only requests
        carrying it (the health checks and the Stripe webhook excepted)
   L4   unsubscribe: the GET only asks; the POST does it; RFC 8058 one-click
        works without the CSRF header or a cookie
   L7   a body over the size limit is a 413, not a 500
   M15  the API's own CSP
   M17  /api/health fails (503) when the database is gone — last, since it
        disconnects */

const SECRET = 'origin-secret-for-tests-0123456789'
let api: Api
let donorToken: string
let donorId: string

beforeAll(async () => {
  /* the gate is read when the app is built, so set it first */
  const { env } = await import('../../server/env')
  env.originSecret = SECRET
  api = await startApi({ seed: 'demo' })
  const { Donor } = await import('../../server/models')
  const d = await Donor.findOne({ email: 'amina.rahman@example.com' })
  d!.unsubscribeToken = 'tok_' + 'a'.repeat(28)
  d!.set('preferences.emailOptIn', true)
  await d!.save()
  donorToken = d!.unsubscribeToken!
  donorId = String(d!._id)
})
afterAll(() => api?.stop())

/** a client that comes through the front door, as Vercel's middleware does */
const front = () => {
  const c = new Client(api.url)
  const request = c.request.bind(c)
  c.request = (method, path, body, opts = {}) => request(method, path, body, { ...opts, headers: { 'X-Origin-Auth': SECRET, ...opts.headers } })
  return c
}

async function optedIn() {
  const { Donor } = await import('../../server/models')
  return (await Donor.findById(donorId).lean<{ preferences?: { emailOptIn?: boolean } }>())!.preferences?.emailOptIn
}

describe('the origin gate (H4)', () => {
  it('refuses /api without the secret', async () => {
    const res = await api.client().get('/api/public/appeals')
    expect(res.status).toBe(403)
  })

  it('refuses a wrong secret', async () => {
    const res = await api.client().get('/api/public/appeals', { headers: { 'X-Origin-Auth': 'nope' } })
    expect(res.status).toBe(403)
  })

  it('answers with the secret', async () => {
    const res = await front().get('/api/public/appeals')
    expect(res.status).toBe(200)
  })

  it('lets the health checks and the Stripe webhook through without it', async () => {
    expect((await api.client().get('/api/health')).status).toBe(200)
    expect((await api.client().get('/api/live')).status).toBe(200)
    /* no Stripe in tests: the webhook answers 404 itself, not the gate's 403 */
    const hook = await api.client().post('/api/webhooks/stripe', {}, { csrf: false })
    expect(hook.status).not.toBe(403)
  })

  it('records the address Express trusts, not a forged X-Forwarded-For', async () => {
    /* TRUST_PROXY is 1 here: one proxy in front, which appends the address it
       saw (203.0.113.9). Anything to the left of that was written by the
       caller — the old clientIp() took the left-most, so it recorded 6.6.6.6 */
    const owner = front()
    const login = await owner.post('/api/auth/staff/login', { email: 'yusuf@alanwaar.group', password: 'alanwaar-demo', remember: true }, { headers: { 'X-Forwarded-For': '6.6.6.6, 203.0.113.9' } })
    expect(login.status).toBe(200)
    const { AuditEvent } = await import('../../server/models')
    const last = await AuditEvent.findOne({}).sort({ _id: -1 }).lean<{ ip?: string }>()
    expect(last?.ip).toBe('203.0.113.9')
  })
})

describe('unsubscribe (L4)', () => {
  it('the link in the email only asks', async () => {
    const res = await front().get(`/api/public/unsubscribe?t=${donorToken}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(res.text).toContain('<form method="post"')
    expect(res.headers.get('content-security-policy')).toContain("form-action 'self'")
    expect(await optedIn()).toBe(true)
  })

  it('an unknown token is a 404 page', async () => {
    const res = await front().get('/api/public/unsubscribe?t=nottherighttokenatall')
    expect(res.status).toBe(404)
  })

  it('the button (a plain form POST, no CSRF header) unsubscribes', async () => {
    const res = await front().request('POST', `/api/public/unsubscribe/one-click?t=${donorToken}`, 'x', {
      csrf: false,
      raw: 'List-Unsubscribe=One-Click',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html' },
    })
    expect(res.status).toBe(200)
    expect(res.text).toContain('You are unsubscribed')
    expect(await optedIn()).toBe(false)
  })

  it('a mail app’s one-click POST works with no header or cookie', async () => {
    const { Donor } = await import('../../server/models')
    await Donor.updateOne({ _id: donorId }, { $set: { 'preferences.emailOptIn': true } })
    const res = await front().request('POST', `/api/public/unsubscribe/one-click?t=${donorToken}`, 'x', {
      csrf: false,
      raw: 'List-Unsubscribe=One-Click',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(await optedIn()).toBe(false)
  })

  it('a campaign email carries the RFC 8058 headers', async () => {
    const { unsubscribeLinks } = await import('../../server/routes/unsubscribe')
    const l = unsubscribeLinks(donorToken)
    expect(l.headers['List-Unsubscribe']).toMatch(/^<https?:\/\/.+\/api\/public\/unsubscribe\/one-click\?t=/)
    expect(l.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })
})

describe('request bodies (L7)', () => {
  it('a body over the limit is a 413 with a field message', async () => {
    const res = await front().post('/api/public/fundraisers', { photo: 'x'.repeat(3_000_000) })
    expect(res.status).toBe(413)
    expect(res.body.error.fields.photo).toBeTruthy()
  })

  it('malformed JSON is a 400', async () => {
    const res = await front().request('POST', '/api/public/letter', 'x', { raw: '{"email":', headers: { 'Content-Type': 'application/json' } })
    expect(res.status).toBe(400)
  })
})

describe('API headers (M15)', () => {
  it('JSON answers carry a CSP that allows nothing and no framing', async () => {
    const res = await front().get('/api/public/appeals')
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'")
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('cross-origin-resource-policy')).toBe('same-origin')
  })

  it('public photos may be loaded from anywhere — emails and the sandboxed email previews', async () => {
    /* an uploaded photo, as an appeal or fundraiser upload stores one: a 1×1 PNG */
    const { newKey, putFile } = await import('../../server/lib/storage')
    const key = newKey('images', 'photo.png')
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
    await putFile(key, png, 'image/png')
    const res = await front().get(`/api/files/${key}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('cross-origin-resource-policy')).toBe('cross-origin')
  })
})

describe('health (M17)', () => {
  it('reports the database and the jobs', async () => {
    const res = await api.client().get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, db: 'up' })
    expect(res.body.jobs).toHaveProperty('jobs.plans')
  })

  it('reports when each job last worked or failed, never the error text — the endpoint is public', async () => {
    const res = await api.client().get('/api/health')
    for (const s of Object.values(res.body.jobs.jobs as Record<string, object>)) {
      expect(Object.keys(s).every((k) => k === 'lastOkAt' || k === 'lastErrorAt')).toBe(true)
    }
    expect(JSON.stringify(res.body)).not.toContain('lastError"')
  })

  it('fails with 503 when the database is down', async () => {
    await mongoose.disconnect()
    const res = await api.client().get('/api/health')
    expect(res.status).toBe(503)
    expect(res.body.db).toBe('down')
    /* the process itself is fine */
    expect((await api.client().get('/api/live')).status).toBe(200)
  })
})
