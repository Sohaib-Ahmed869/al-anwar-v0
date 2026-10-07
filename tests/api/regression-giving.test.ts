import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startApi, type Api } from '../helpers/server'
import { checkout, giftStatus } from '../helpers/giving'
import { freshEmail, OPEN_APPEAL } from '../helpers/fixtures'

/* ---------------------------------------------------------------------------
   Giving on the public site, end to end through the API, with payments
   simulated (no provider keys in tests):

     - a one-off card gift is paid, receipted, and shows in the donor portal;
     - a bank transfer is a pending pledge with a reference and the account;
     - a monthly gift starts a plan;
     - the recurring engine charges a due plan, and a card ending 0002 is
       declined into past_due with a retry date;
     - the site's own rules refuse a monthly zakat and a gift under $2;
     - 50 gifts at once get 50 different receipt numbers.

   Receipt numbers are checked by shape only (they contain digits): a
   simulated gift may be numbered in a separate test series.
--------------------------------------------------------------------------- */

let api: Api
beforeAll(async () => {
  api = await startApi({ seed: 'demo' })
})
afterAll(() => api?.stop())

describe('one-off card gift', () => {
  it('is paid, receipted, and shows in the donor portal', async () => {
    const email = freshEmail()
    const paid = await checkout(api, { email, amount: 75, operatingCosts: 5, first: 'Hana', last: 'Ali' })
    expect(paid.kind).toBe('redirect')
    expect(paid.url).toMatch(/^\/thank-you\?/)

    const s = await giftStatus(api, paid.giftId, paid.query)
    expect(s.status).toBe(200)
    expect(s.body.status).toBe('succeeded')
    expect(s.body.amount).toBe(7500)
    expect(s.body.fee).toBe(500)
    expect(s.body.receiptNumber).toMatch(/\d/)
    expect(s.body.appealTitle).toBeTruthy()

    const donor = await api.donor(email)
    const mine = await donor.get('/api/me/gifts')
    expect(mine.status).toBe(200)
    const g = mine.body.items.find((x: { id: string }) => x.id === paid.giftId)
    expect(g, 'the gift is in the donor’s history').toBeTruthy()
    expect(g.status).toBe('succeeded')

    const receipt = await donor.get(`/api/me/gifts/receipt/${paid.giftId}`)
    expect(receipt.status).toBe(200)
  })

  it('raises the appeal’s total', async () => {
    const before = (await api.client().get(`/api/public/appeals/${OPEN_APPEAL}`)).body
    const raisedBefore = before.raised ?? before.appeal?.raised
    await checkout(api, { amount: 120 })
    const after = (await api.client().get(`/api/public/appeals/${OPEN_APPEAL}`)).body
    const raisedAfter = after.raised ?? after.appeal?.raised
    expect(typeof raisedBefore).toBe('number')
    expect(raisedAfter).toBeGreaterThanOrEqual(raisedBefore + 12000)
  })
})

describe('bank transfer', () => {
  it('is a pending pledge with a reference and the account to pay into', async () => {
    const res = await checkout(api, { provider: 'bank', amount: 200 })
    expect(res.kind).toBe('bank')
    expect(res.reference).toBeTruthy()
    expect(res.bank.bsb).toBeTruthy()
    expect(res.bank.accountNumber).toBeTruthy()

    const s = await giftStatus(api, res.giftId, res.query)
    expect(s.body.status).toBe('pending')
    expect(s.body.method).toBe('bank')
    expect(s.body.reference).toBe(res.reference)
    expect(s.body.receiptNumber).toBeNull()
  })

  it('is refused for a regular gift', async () => {
    const res = await api.client().post('/api/public/checkout', {
      fund: 'sadaqah', frequency: 'monthly', amount: 30, operatingCosts: 0, provider: 'bank',
      first: 'A', last: 'B', email: freshEmail(), behalfName: '', updates: false, appealSlug: OPEN_APPEAL,
    })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.provider).toBeTruthy()
  })
})

describe('validation', () => {
  const base = { frequency: 'once', operatingCosts: 0, provider: 'stripe', first: 'A', last: 'B', behalfName: '', updates: false, appealSlug: OPEN_APPEAL }

  it('refuses a monthly zakat', async () => {
    const res = await api.client().post('/api/public/checkout', { ...base, fund: 'zakat', frequency: 'monthly', amount: 50, email: freshEmail() })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.frequency).toBeTruthy()
  })

  it('refuses less than $2, an unlisted operating-costs figure, and a bad email', async () => {
    const c = api.client()
    const small = await c.post('/api/public/checkout', { ...base, fund: 'sadaqah', amount: 1, email: freshEmail() })
    expect(small.status).toBe(400)
    expect(small.body.error.fields.amount).toBeTruthy()
    const ops = await c.post('/api/public/checkout', { ...base, fund: 'sadaqah', amount: 20, operatingCosts: 3.17, email: freshEmail() })
    expect(ops.status).toBe(400)
    expect(ops.body.error.fields.operatingCosts).toBeTruthy()
    const email = await c.post('/api/public/checkout', { ...base, fund: 'sadaqah', amount: 20, email: 'not-an-email' })
    expect(email.status).toBe(400)
    expect(email.body.error.fields.email).toBeTruthy()
  })

  it('refuses a fund that does not exist', async () => {
    const res = await api.client().post('/api/public/checkout', { ...base, fund: 'nope', amount: 20, email: freshEmail() })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.fund).toBeTruthy()
  })
})

describe('monthly gift and the recurring engine', () => {
  it('starts a plan, charges it when due, and declines a card ending 0002 into past_due', async () => {
    const email = freshEmail('monthly')
    const paid = await checkout(api, { email, frequency: 'monthly', amount: 30 })
    const s = await giftStatus(api, paid.giftId, paid.query)
    expect(s.body.status).toBe('succeeded')
    expect(s.body.frequency).toBe('monthly')
    expect(s.body.nextChargeAt).toBeTruthy()

    const { Gift, Plan } = await import('../../server/models')
    const first = await Gift.findById(paid.giftId).lean()
    const plan = await Plan.findById(first!.plan)
    expect(plan, 'the first gift is linked to its plan').toBeTruthy()
    expect(plan!.status).toBe('active')

    const donor = await api.donor(email)
    const plans = await donor.get('/api/me/plans')
    expect(plans.body.items.map((p: { id: string }) => p.id)).toContain(String(plan!._id))

    const { processDuePlans } = await import('../../server/jobs/recurring')

    /* due now: charged once, a second gift, the next date moves on */
    const due = new Date(Date.now() - 60_000)
    await Plan.updateOne({ _id: plan!._id }, { $set: { nextChargeAt: due } })
    await processDuePlans(new Date())
    const charged = await Plan.findById(plan!._id).lean()
    expect(charged!.nextChargeAt!.getTime()).toBeGreaterThan(Date.now())
    expect(await Gift.countDocuments({ plan: plan!._id, status: 'succeeded' })).toBe(2)

    /* running again straight away charges nothing more */
    await processDuePlans(new Date())
    expect(await Gift.countDocuments({ plan: plan!._id, status: 'succeeded' })).toBe(2)

    /* the declining test card: past_due, a failed gift, a retry date */
    await Plan.updateOne({ _id: plan!._id }, { $set: { nextChargeAt: due, 'payment.last4': '0002' } })
    await processDuePlans(new Date())
    const declined = await Plan.findById(plan!._id).lean()
    expect(declined!.status).toBe('past_due')
    expect(declined!.failure?.count).toBe(1)
    expect(declined!.failure?.nextRetryAt).toBeTruthy()
    expect(await Gift.countDocuments({ plan: plan!._id, status: 'failed' })).toBe(1)
  })
})

describe('receipt numbers', () => {
  it('50 gifts at once get 50 different numbers', async () => {
    const results = await Promise.all(Array.from({ length: 50 }, () => checkout(api, { amount: 10 })))
    const { Gift } = await import('../../server/models')
    const gifts = await Gift.find({ _id: { $in: results.map((r) => r.giftId) } }).lean()
    const numbers = gifts.map((g) => g.receipt?.number)
    expect(numbers.every(Boolean)).toBe(true)
    expect(new Set(numbers).size).toBe(50)
  })
})
