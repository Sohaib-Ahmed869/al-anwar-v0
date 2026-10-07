import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { can } from '../../shared/access'
import { fyOf } from '../../shared/domain'
import { startApi, type Api } from '../helpers/server'
import { STAFF_BY_ROLE, freshEmail } from '../helpers/fixtures'

/* ---------------------------------------------------------------------------
   Payments and gifts, the hardening of 7 October 2026: receipts that are
   issued once, simulated gifts that can never pass for real ones, the rules
   a hand-built checkout cannot get round, the double opt-in, the thank-you
   page's token, refunds, and the races the findings named (M9, M16).
--------------------------------------------------------------------------- */

let api: Api
let models: typeof import('../../server/models')
let giving: typeof import('../../server/lib/giving')

beforeAll(async () => {
  api = await startApi({ seed: 'demo' })
  models = await import('../../server/models')
  giving = await import('../../server/lib/giving')
})
afterAll(() => api?.stop())

const body = (over: Record<string, unknown> = {}) => ({
  fund: 'sadaqah',
  frequency: 'once',
  amount: 50,
  operatingCosts: 0,
  provider: 'stripe',
  first: 'Test',
  last: 'Donor',
  email: freshEmail('pay'),
  behalfName: '',
  updates: false,
  ...over,
})

const giftOf = (url: string) => {
  const u = new URL(url, 'http://x')
  return { id: u.searchParams.get('gift')!, t: u.searchParams.get('t')! }
}

describe('receipt numbers', () => {
  it('50 concurrent recordGift calls get 50 unique, consecutive numbers with the gift date’s FY prefix', async () => {
    const { Donor, Gift, getSettings } = models
    const donor = (await Donor.findOne({ status: 'active' }))!
    const prefix = (await getSettings()).receipts.prefix
    /* 1 July 2026, 09:00 in Sydney, is 23:00 on 30 June in UTC: still FY2027 */
    const date = new Date('2026-06-30T23:00:00Z')
    const gifts = await Promise.all(
      Array.from({ length: 50 }, () =>
        giving.recordGift({ donor, amount: 1000, designation: 'sadaqah', method: 'cash', source: 'offline', date, sendReceipt: false }),
      ),
    )
    const numbers = gifts.map((g) => g.receipt!.number!)
    expect(new Set(numbers).size).toBe(50)
    const fy = fyOf(date)
    expect(fy).toBe(2027)
    for (const n of numbers) expect(n).toMatch(new RegExp(`^${prefix}-${fy}-\\d{6}$`))
    const seqs = numbers.map((n) => Number(n.split('-').at(-1))).sort((a, b) => a - b)
    expect(seqs.at(-1)! - seqs[0]).toBe(49)
    /* and the database agrees with what the callers were told */
    const stored = await Gift.find({ _id: { $in: gifts.map((g) => g._id) } }).select('receipt.number').lean()
    expect(stored.map((g) => g.receipt?.number).sort()).toEqual([...numbers].sort())
  })

  it('a gift issued a receipt twice at once keeps one number', async () => {
    const { Donor, Gift } = models
    const donor = (await Donor.findOne({ status: 'active' }))!
    const g = await giving.recordGift({ donor, amount: 500, designation: 'sadaqah', method: 'bank', status: 'pending', source: 'offline', sendReceipt: false })
    await Gift.updateOne({ _id: g._id }, { $set: { status: 'succeeded' } })
    const a = (await Gift.findById(g._id))!
    const b = (await Gift.findById(g._id))!
    await Promise.all([giving.issueReceipt(a, { email: false }), giving.issueReceipt(b, { email: false })])
    expect(a.receipt?.number).toBeTruthy()
    expect(a.receipt?.number).toBe(b.receipt?.number)
    expect((await Gift.findById(g._id).lean())!.receipt?.number).toBe(a.receipt?.number)
  })
})

describe('simulated payments (C2)', () => {
  it('a simulated gift is marked, gets a SIM- test receipt, and its email says it is not a tax receipt', async () => {
    const b = body()
    const res = await api.client().post('/api/public/checkout', b)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const { id } = giftOf(res.body.url)
    const g = (await models.Gift.findById(id).lean())!
    expect(g.simulated).toBe(true)
    expect(g.receipt?.number).toMatch(/^SIM-\d{4}-\d{6}$/)
    const mail = await models.EmailMessage.findOne({ to: b.email, template: /^receipt/ }).lean()
    expect(mail?.subject).toMatch(/^TEST/)
  })

  it('an offline gift entered by staff is not simulated and gets a real number', async () => {
    const { Donor } = models
    const donor = (await Donor.findOne({ status: 'active' }))!
    const g = await giving.recordGift({ donor, amount: 700, designation: 'sadaqah', method: 'cash', source: 'offline', sendReceipt: false })
    expect(g.simulated).toBe(false)
    expect(g.receipt?.number).not.toMatch(/^SIM-/)
  })
})

describe('checkout rules a hand-built request cannot get round', () => {
  it('refuses zakat to an appeal that cannot take it (M11)', async () => {
    const appeal = (await models.Appeal.findOne({ status: 'open', zakatEligible: false }).lean())!
    expect(appeal).toBeTruthy()
    const res = await api.client().post('/api/public/checkout', body({ fund: 'zakat', appealSlug: appeal.slug }))
    expect(res.status).toBe(400)
    expect(res.body.error.fields.fund).toMatch(/cannot take zakat/i)
  })

  it('takes zakat to an appeal that can', async () => {
    const appeal = (await models.Appeal.findOne({ status: 'open', zakatEligible: true }).lean())!
    const res = await api.client().post('/api/public/checkout', body({ fund: 'zakat', appealSlug: appeal.slug }))
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const g = (await models.Gift.findById(giftOf(res.body.url).id).lean())!
    expect(g.designation).toBe('zakat')
  })

  it('refuses a designation that is not the fund’s own, so a monthly zakat cannot ride in as sadaqah (M11)', async () => {
    const res = await api.client().post('/api/public/checkout', body({ fund: 'sadaqah', designation: 'zakat', frequency: 'monthly' }))
    expect(res.status).toBe(400)
    expect(res.body.error.fields.designation).toBeTruthy()
  })

  it('refuses a name carrying a link (M10)', async () => {
    const res = await api.client().post('/api/public/checkout', body({ first: '[Your receipt](https://evil.tld)' }))
    expect(res.status).toBe(400)
    expect(res.body.error.fields.first).toBeTruthy()
  })

  it('refuses a fundraiser past its end date, and the sweep ends it (L10)', async () => {
    const { Fundraiser, Appeal, Donor } = models
    const appeal = (await Appeal.findOne({ status: 'open' }))!
    const owner = (await Donor.findOne({ status: 'active' }))!
    const f = await Fundraiser.create({
      slug: `ended-${Date.now()}`, owner: owner._id, ownerName: 'Test Owner', appeal: appeal._id, appealTitle: appeal.title,
      title: 'Finished fundraiser', target: 10000, status: 'live', endsAt: new Date(Date.now() - 86_400_000),
    })
    const res = await api.client().post('/api/public/checkout', body({ fundraiser: f.slug, appealSlug: appeal.slug }))
    expect(res.status).toBe(400)
    expect(res.body.error.fields.fundraiser).toBeTruthy()
    const { endExpiredFundraisers } = await import('../../server/lib/sweeps')
    expect(await endExpiredFundraisers()).toBeGreaterThanOrEqual(1)
    expect((await Fundraiser.findById(f._id).lean())!.status).toBe('ended')
  })

  it('two first-time gifts from one address at once make one donor (M16)', async () => {
    const email = freshEmail('race')
    const results = await Promise.all(
      Array.from({ length: 5 }, () => giving.findOrCreateDonor({ email, firstName: 'Race', lastName: 'Test' })),
    )
    expect(new Set(results.map((r) => String(r.donor._id))).size).toBe(1)
    expect(await models.Donor.countDocuments({ email })).toBe(1)
    expect(results.filter((r) => r.created).length).toBe(1)
  })
})

describe('the thank-you page’s status route (L5)', () => {
  it('answers only with the token, and keeps an anonymous donor’s name off it', async () => {
    const res = await api.client().post('/api/public/checkout', body({ first: 'Hidden', anonymous: true }))
    const { id, t } = giftOf(res.body.url)
    expect(t).toBeTruthy()
    const c = api.client()
    expect((await c.get(`/api/public/gifts/${id}/status`)).status).toBe(404)
    expect((await c.get(`/api/public/gifts/${id}/status?t=wrong-token-value`)).status).toBe(404)
    const ok = await c.get(`/api/public/gifts/${id}/status?t=${encodeURIComponent(t)}`)
    expect(ok.status).toBe(200)
    expect(ok.body.firstName).toBeNull()
    expect(ok.body.simulated).toBe(true)
  })

  it('describes a failure in its own words, never the provider’s', async () => {
    const res = await api.client().post('/api/public/checkout', body())
    const { id, t } = giftOf(res.body.url)
    await models.Gift.updateOne({ _id: id }, { $set: { status: 'failed', failureReason: 'INTERNAL_SERVER_ERROR: debug id 9f3a' } })
    const s = await api.client().get(`/api/public/gifts/${id}/status?t=${encodeURIComponent(t)}`)
    expect(s.body.failureReason).not.toMatch(/debug|INTERNAL/)
  })
})

describe('the letter and "send me updates": double opt-in (M10)', () => {
  it('answers the same for every address and changes nothing until the link is used', async () => {
    const fresh = freshEmail('letter')
    const known = (await models.Donor.findOne({ status: 'active', 'preferences.emailOptIn': false }).lean())
    const a = await api.client().post('/api/public/letter', { email: fresh })
    expect(a.status).toBe(200)
    expect(a.body).toEqual({ ok: true })
    expect(await models.Donor.exists({ email: fresh })).toBeNull()
    if (known) {
      const b = await api.client().post('/api/public/letter', { email: known.email })
      expect(b.body).toEqual({ ok: true })
      expect((await models.Donor.findById(known._id).lean())!.preferences?.emailOptIn).toBe(false)
    }
    const { OptIn } = await import('../../server/models/OptIn')
    expect(await OptIn.countDocuments({ email: fresh })).toBe(1)
  })

  it('the confirmation link’s token switches the letter on, once', async () => {
    const { OptIn } = await import('../../server/models/OptIn')
    const email = freshEmail('confirm')
    const token = 'a-known-test-token-0123456789'
    await OptIn.create({
      email, tokenHash: createHash('sha256').update(token).digest('hex'), topics: ['reports'], source: 'letter',
      expiresAt: new Date(Date.now() + 3_600_000),
    })
    const c = api.client()
    expect((await c.post('/api/public/letter/confirm', { t: token })).status).toBe(200)
    const d = (await models.Donor.findOne({ email }).lean())!
    expect(d.preferences?.emailOptIn).toBe(true)
    expect(d.preferences?.topics).toContain('reports')
    expect(d.tags).toContain('newsletter')
    expect((await c.post('/api/public/letter/confirm', { t: token })).status).toBe(400)
  })

  it('a checkout never switches an existing supporter’s marketing on; it sends a confirmation', async () => {
    const d = (await models.Donor.findOne({ status: 'active', 'preferences.emailOptIn': false, email: { $not: /\.invalid$/ } }).lean())
    if (!d) return
    const res = await api.client().post('/api/public/checkout', body({ email: d.email, first: 'Test', updates: true }))
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect((await models.Donor.findById(d._id).lean())!.preferences?.emailOptIn).toBe(false)
    expect(await models.EmailMessage.exists({ to: d.email, template: 'optin.confirm' })).toBeTruthy()
  })

  it('a new donor from a checkout starts with marketing off', async () => {
    const email = freshEmail('newdonor')
    await api.client().post('/api/public/checkout', body({ email }))
    expect((await models.Donor.findOne({ email }).lean())!.preferences?.emailOptIn).toBe(false)
  })
})

describe('"Received" and "Refund" in the admin (M9, L10)', () => {
  it('two clicks on Received give one receipt; a card checkout cannot be received', async () => {
    const sent = body({ provider: 'bank' })
    const pledge = await api.client().post('/api/public/checkout', sent)
    expect(pledge.status, JSON.stringify(pledge.body)).toBe(200)
    const id = pledge.body.giftId as string
    const finance = await api.staff(STAFF_BY_ROLE.finance)
    const [a, b] = await Promise.all([finance.post(`/api/admin/gifts/${id}/received`, {}), finance.post(`/api/admin/gifts/${id}/received`, {})])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    const g = (await models.Gift.findById(id).lean())!
    expect(g.status).toBe('succeeded')
    expect(g.receipt?.number).toBeTruthy()
    expect(await models.EmailMessage.countDocuments({ to: sent.email, template: /^receipt/ })).toBe(1)

    const { Donor } = models
    const donor = (await Donor.findOne({ status: 'active' }))!
    const card = await giving.recordGift({ donor, amount: 900, designation: 'sadaqah', method: 'card', status: 'pending', source: 'online' })
    expect((await finance.post(`/api/admin/gifts/${card.id}/received`, {})).status).toBe(409)
  })

  it('a refund is recorded once, adjusts the regular donation and tells the donor', async () => {
    const { Plan, Gift, Donor } = models
    const plan = (await Plan.findOne({ status: 'active', collected: { $gt: 0 } }))!
    const gift = (await Gift.findOne({ plan: plan._id, status: 'succeeded' }))!
    const donor = (await Donor.findById(gift.donor).lean())!
    const owner = await api.staff(STAFF_BY_ROLE.owner)
    const [a, b] = await Promise.all([
      owner.post(`/api/admin/gifts/${gift.id}/refund`, { reason: 'Donor asked' }),
      owner.post(`/api/admin/gifts/${gift.id}/refund`, { reason: 'Donor asked' }),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    expect((await Plan.findById(plan._id).lean())!.collected).toBe(plan.collected - gift.amount)
    if (!donor.email.endsWith('.invalid')) expect(await models.EmailMessage.exists({ to: donor.email, template: 'gift.refund' })).toBeTruthy()
    expect(a.body.gift?.external ?? b.body.gift?.external).toBeUndefined()
  })

  it('refuses to move a receipted gift into another financial year', async () => {
    const { Gift } = models
    const g = (await Gift.findOne({ status: 'succeeded', 'receipt.number': { $type: 'string' }, source: 'offline' }))!
    const other = new Date(g.date)
    other.setFullYear(other.getFullYear() - 1)
    const ymd = `${other.getFullYear()}-${String(other.getMonth() + 1).padStart(2, '0')}-${String(other.getDate()).padStart(2, '0')}`
    const owner = await api.staff(STAFF_BY_ROLE.owner)
    const res = await owner.patch(`/api/admin/gifts/${g.id}`, { date: ymd })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.date).toMatch(/belongs to/)
  })
})

describe('the gift export (M13, L6)', () => {
  it('a donor name that would run as a formula is neutralised', async () => {
    const { Donor } = models
    const donor = (await Donor.findOne({ status: 'active' }))!
    const g = await giving.recordGift({ donor, amount: 1200, designation: 'sadaqah', method: 'cash', source: 'offline', sendReceipt: false })
    await models.Gift.updateOne({ _id: g._id }, { $set: { donorName: '=HYPERLINK("https://evil.tld","Click")', notes: '+1+cmd|calc' } })
    const owner = await api.staff(STAFF_BY_ROLE.owner)
    const res = await owner.get(`/api/admin/gifts/export?q=${encodeURIComponent(g.number)}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/csv/)
    const line = res.text.split('\r\n').find((l) => l.includes(g.number))!
    expect(line).toBeTruthy()
    expect(line).not.toMatch(/(^|,)"?=HYPERLINK/)
    expect(line).not.toMatch(/(^|,)"?\+1\+cmd/)
    expect(line).toContain('HYPERLINK')
  })

  it('a filter value like __proto__ is ignored, not an error', async () => {
    const owner = await api.staff(STAFF_BY_ROLE.owner)
    const res = await owner.get('/api/admin/gifts?method=__proto__,constructor&status=__proto__')
    expect(res.status).toBe(200)
  })
})

describe('what staff see of a gift (H2)', () => {
  it('a gift never leaves the admin API with its provider ids or token', async () => {
    const { Gift } = models
    const g = (await Gift.findOne({ status: 'succeeded' }))!
    await Gift.updateOne({ _id: g._id }, { $set: { 'external.stripe': `pi_test_${g.id}` } })
    const owner = await api.staff(STAFF_BY_ROLE.owner)
    const res = await owner.get(`/api/admin/gifts/${g.id}`)
    expect(res.status).toBe(200)
    expect(res.body.gift.external).toBeUndefined()
    expect(res.body.gift.publicToken).toBeUndefined()
    expect(res.body.gift.checkout).toBeUndefined()
  })

  it('someone who may enter gifts but not read donors gets a masked donor', async () => {
    const d = (await models.Donor.findOne({ status: 'active', email: { $not: /\.invalid$/ } }).lean())!
    const volunteer = await api.staff(STAFF_BY_ROLE.volunteer)
    const res = await volunteer.get(`/api/admin/gifts/donor/${d._id}`)
    expect(res.status).toBe(200)
    if (can('volunteer', 'donors.read')) {
      expect(res.body.donor.email).toBe(d.email)
    } else {
      expect(res.body.donor.email).toBeUndefined()
      expect(res.body.donor.phone).toBeUndefined()
      expect(res.body.donor.totalGiven).toBeUndefined()
      expect(res.body.donor.emailHint).toMatch(/^.•••@/)
    }
  })
})

describe('sweeps', () => {
  it('marks card checkouts abandoned after four days (past Stripe’s retries), and leaves bank pledges alone (L12)', async () => {
    const { Gift, Donor } = models
    const donor = (await Donor.findOne({ status: 'active' }))!
    const card = await giving.recordGift({ donor, amount: 1500, designation: 'sadaqah', method: 'card', status: 'pending', source: 'online' })
    const bank = await giving.recordGift({ donor, amount: 1500, designation: 'sadaqah', method: 'bank', status: 'pending', source: 'online' })
    const { sweepAbandonedCheckouts } = await import('../../server/lib/sweeps')
    /* three days on, Stripe may still deliver the webhook: not yet */
    await Gift.collection.updateMany({ _id: { $in: [card._id, bank._id] } }, { $set: { createdAt: new Date(Date.now() - 73 * 3_600_000) } })
    await sweepAbandonedCheckouts()
    expect((await Gift.findById(card._id).lean())!.status).toBe('pending')
    await Gift.collection.updateMany({ _id: { $in: [card._id, bank._id] } }, { $set: { createdAt: new Date(Date.now() - 97 * 3_600_000) } })
    expect(await sweepAbandonedCheckouts()).toBeGreaterThanOrEqual(1)
    expect((await Gift.findById(card._id).lean())!.status).toBe('failed')
    expect((await Gift.findById(card._id).lean())!.failureReason).toBe('Checkout abandoned')
    expect((await Gift.findById(bank._id).lean())!.status).toBe('pending')
    expect(await sweepAbandonedCheckouts()).toBe(0)
  })

  it('sends a paid gift’s missing receipt, once (H6)', async () => {
    const { Gift, Donor } = models
    const donor = (await Donor.findOne({ status: 'active', email: { $not: /\.invalid$/ } }))!
    /* paid, numbered, but the email never went (the process stopped after
       the webhook's 200) */
    const g = await giving.recordGift({ donor, amount: 2500, designation: 'sadaqah', method: 'card', source: 'online' })
    await Gift.collection.updateOne({ _id: g._id }, { $unset: { 'receipt.emailedAt': 1 }, $set: { updatedAt: new Date(Date.now() - 3_600_000) } })
    const { sweepPaidWithoutReceipt } = await import('../../server/lib/sweeps')
    expect(await sweepPaidWithoutReceipt()).toBeGreaterThanOrEqual(1)
    expect((await Gift.findById(g._id).lean())!.receipt?.emailedAt).toBeTruthy()
    expect(await sweepPaidWithoutReceipt()).toBe(0)
  })

  it('never sends a receipt staff chose not to send, or a bank transfer’s (review #8)', async () => {
    const { Gift, Donor } = models
    const donor = (await Donor.findOne({ status: 'active', email: { $not: /\.invalid$/ } }))!
    const quiet = await giving.recordGift({ donor, amount: 2600, designation: 'sadaqah', method: 'card', source: 'online', sendReceipt: false })
    const bank = await giving.recordGift({ donor, amount: 2700, designation: 'sadaqah', method: 'bank', source: 'online' })
    await Gift.collection.updateMany(
      { _id: { $in: [quiet._id, bank._id] } },
      { $unset: { 'receipt.emailedAt': 1 }, $set: { updatedAt: new Date(Date.now() - 3_600_000) } },
    )
    const { sweepPaidWithoutReceipt } = await import('../../server/lib/sweeps')
    await sweepPaidWithoutReceipt()
    for (const id of [quiet._id, bank._id]) expect((await Gift.findById(id).lean())!.receipt?.emailedAt).toBeFalsy()
    expect((await Gift.findById(quiet._id).lean())!.receipt?.suppressed).toBe(true)
  })
})
