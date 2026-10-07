import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startApi, type Api } from '../helpers/server'
import { DONOR, NO_SUCH_ID, OPEN_APPEAL, STAFF_BY_ROLE, freshEmail } from '../helpers/fixtures'
import { checkout } from '../helpers/giving'

/* ---------------------------------------------------------------------------
   The two sessions and the walls between them (CLAUDE.md "Two sessions",
   "CSRF"):

     - a donor's cookie opens /api/me and nothing staff-side; a staff cookie
       opens /api/admin and /api/compliance and never /api/me;
     - /api/me only ever shows the signed-in donor's own records, whatever id
       a request carries;
     - every write needs the X-Requested-With header, signed in or not;
     - a forged or tampered cookie is the same as no cookie.
--------------------------------------------------------------------------- */

let api: Api
beforeAll(async () => {
  api = await startApi({ seed: 'demo' })
})
afterAll(() => api?.stop())

describe('session separation', () => {
  it('a donor session opens nothing staff-side', async () => {
    const donor = await api.donor(DONOR)
    for (const path of ['/api/admin/dashboard', '/api/admin/donors', '/api/compliance/overview', '/api/admin/dashboard/badges']) {
      expect((await donor.get(path)).status, path).toBe(401)
    }
  })

  it('a staff session never opens the donor portal, even for the owner', async () => {
    const owner = await api.staff(STAFF_BY_ROLE.owner)
    for (const path of ['/api/me/overview', '/api/me/gifts', '/api/me/plans', '/api/me/profile']) {
      expect((await owner.get(path)).status, path).toBe(401)
    }
  })

  it('swapping the cookie names does not cross over', async () => {
    const owner = await api.staff(STAFF_BY_ROLE.owner)
    const donor = await api.donor(DONOR)
    const staffToken = owner.cookies.get('aa_staff')!
    const donorToken = donor.cookies.get('aa_donor')!
    const a = api.client()
    a.cookies.set('aa_donor', staffToken)
    expect((await a.get('/api/me/overview')).status).toBe(401)
    const b = api.client()
    b.cookies.set('aa_staff', donorToken)
    expect((await b.get('/api/admin/dashboard')).status).toBe(401)
  })

  it('a forged token is refused', async () => {
    const c = api.client()
    const fake = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    c.cookies.set('aa_staff', `${fake}.${Buffer.from('{"sub":"x","kind":"staff","v":0}').toString('base64url')}.bad`)
    c.cookies.set('aa_donor', 'not-a-token')
    expect((await c.get('/api/admin/dashboard')).status).toBe(401)
    expect((await c.get('/api/me/overview')).status).toBe(401)
  })

  it('signing out ends access from that browser', async () => {
    const donor = await api.donor(DONOR)
    expect((await donor.get('/api/me/overview')).status).toBe(200)
    await donor.post('/api/auth/donor/logout')
    expect((await donor.get('/api/me/overview')).status).toBe(401)

    const owner = await api.staff(STAFF_BY_ROLE.owner)
    await owner.post('/api/auth/staff/logout')
    expect((await owner.get('/api/admin/dashboard')).status).toBe(401)
  })

  it('signed out, every portal answers 401', async () => {
    const c = api.client()
    for (const path of ['/api/me/overview', '/api/admin/dashboard', '/api/compliance/overview']) {
      expect((await c.get(path)).status, path).toBe(401)
    }
  })

  it('a wrong staff password is refused', async () => {
    const res = await api.client().post('/api/auth/staff/login', { email: STAFF_BY_ROLE.owner, password: 'not-the-password' })
    expect(res.status).toBe(401)
  })
})

describe('/api/me only ever shows your own records', () => {
  it('ignores a donor id in the query, the body, or the path', async () => {
    /* donor B gives, then donor A tries every way of asking for B's gift */
    const bEmail = freshEmail('other')
    const paid = await checkout(api, { email: bEmail, first: 'Other', last: 'Person' })
    const giftB = paid.giftId

    const { Gift } = await import('../../server/models')
    const bDonorId = String((await Gift.findById(giftB).lean())!.donor)

    const a = await api.donor(DONOR)
    const mine = await a.get(`/api/me/gifts?donor=${bDonorId}&donorId=${bDonorId}&pageSize=100`)
    expect(mine.status).toBe(200)
    expect(mine.body.items.map((g: { id: string }) => g.id)).not.toContain(giftB)

    expect((await a.get(`/api/me/gifts/${giftB}`)).status).toBe(404)
    expect((await a.get(`/api/me/gifts/receipt/${giftB}`)).status).toBe(404)
    expect((await a.post(`/api/me/gifts/${giftB}/resend`)).status).toBe(404)

    /* a profile update carrying another donor's id changes only the caller */
    const before = (await a.get('/api/me/profile')).body.donor
    const res = await a.patch('/api/me/profile', { id: bDonorId, _id: bDonorId, donor: bDonorId, firstName: before.firstName })
    expect(res.status).toBe(200)
    const { Donor } = await import('../../server/models')
    expect((await Donor.findById(bDonorId).lean())!.firstName).toBe('Other')
  })

  it('answers 404, not someone else’s record, for an unknown id', async () => {
    const a = await api.donor(DONOR)
    expect((await a.get(`/api/me/gifts/${NO_SUCH_ID}`)).status).toBe(404)
    expect((await a.get(`/api/me/plans/${NO_SUCH_ID}`)).status).toBe(404)
    expect((await a.get(`/api/me/fundraisers/${NO_SUCH_ID}`)).status).toBe(404)
  })
})

describe('CSRF: every write needs the X-Requested-With header', () => {
  const writes: [string, string][] = [
    ['POST', '/api/auth/staff/login'],
    ['POST', '/api/auth/donor/code'],
    ['POST', '/api/auth/donor/verify'],
    ['POST', '/api/public/checkout'],
    ['POST', '/api/public/enquiries'],
    ['POST', '/api/public/letter'],
    ['POST', '/api/public/fundraisers'],
    ['PATCH', '/api/me/profile'],
    ['POST', `/api/me/plans/${NO_SUCH_ID}/cancel`],
    ['POST', '/api/admin/gifts/offline'],
    ['PUT', '/api/admin/settings/org'],
    ['DELETE', `/api/admin/campaigns/${NO_SUCH_ID}`],
    ['POST', '/api/admin/staff/invite'],
    ['POST', '/api/compliance/registers/risks'],
  ]

  it.each(writes)('%s %s without the header → 403, even signed in', async (method, path) => {
    const owner = await api.staff(STAFF_BY_ROLE.owner)
    const res = await owner.request(method, path, {}, { csrf: false })
    expect(res.status).toBe(403)
    const anon = await api.client().request(method, path, {}, { csrf: false })
    expect(anon.status).toBe(403)
  })

  it('reads do not need it', async () => {
    const res = await api.client().get(`/api/public/appeals/${OPEN_APPEAL}`, { csrf: false })
    expect(res.status).toBe(200)
  })
})
