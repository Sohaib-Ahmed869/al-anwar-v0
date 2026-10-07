import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startApi, type Api } from '../helpers/server'

/* The harness itself: the app boots on the demo data, staff and donors can
   sign in, and the CSRF header is required on writes. */

let api: Api
beforeAll(async () => {
  api = await startApi({ seed: 'demo' })
})
afterAll(() => api?.stop())

describe('test harness', () => {
  it('answers the health check', async () => {
    const res = await api.client().get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('signs staff in and returns their permissions', async () => {
    const owner = await api.staff('yusuf@alanwaar.group')
    const res = await owner.get('/api/auth/session')
    expect(res.body.staff.user.role).toBe('owner')
    expect(res.body.staff.permissions).toContain('staff.manage')
  })

  it('signs a donor in with the emailed code', async () => {
    const donor = await api.donor('amina.rahman@example.com')
    const res = await donor.get('/api/auth/session')
    expect(res.body.donor.email).toBe('amina.rahman@example.com')
  })

  it('refuses a write without the CSRF header', async () => {
    const res = await api.client().post('/api/auth/donor/code', { email: 'x@example.com' }, { csrf: false })
    expect(res.status).toBe(403)
  })
})
