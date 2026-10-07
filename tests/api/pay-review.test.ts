import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { startApi, type Api } from '../helpers/server'
import { checkoutBody } from '../helpers/giving'

/* ---------------------------------------------------------------------------
   The payments review (October 2026), finding by finding, against the real
   app with a stubbed Stripe client and a fake PayPal: nothing reaches the
   network.

     #1  only a decline is a decline: no answer, or "processing", keeps the
         same idempotency key; a late success is recorded once (webhook)
     (A) a plan the scheduler read as due, charged meanwhile by another
         path, is not charged again
     #2  a Stripe payment confirmed after the sweep gave up is still paid
     #3  PayPal: a held capture waits (and the sweep settles it), an unclear
         answer waits, only a decline fails
     #4  saving a bank statement again after an error makes no second gift
     #5  the volunteer lookup matches an email only in full, and is limited
     #6  a plan cancelled while its payment was in flight stays cancelled
     #7  a payment recorded by a run that then died is counted once
     #9  issuing a receipt keeps the rest of the receipt (sweptAt)
     #10 a lost chargeback stops the donation counting; a won one stands
     #11 migrations: old duplicate simulated ids, indexes, retry after a
         failure, a stale claim, and the second email-log redaction
--------------------------------------------------------------------------- */

const SECRET = 'whsec_test_review'
const PAYPAL = 'https://paypal.review.test'

let api: Api
let models: typeof import('../../server/models')
let giving: typeof import('../../server/lib/giving')
let plans: typeof import('../../server/lib/plans')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let s: any
const realFetch = globalThis.fetch

/* ---------- a fake PayPal ---------- */
type PpOrder = { id: string; value: string; capture: 'complete' | 'pending' | 'error'; captured: 'none' | 'COMPLETED' | 'PENDING' }
const ppOrders = new Map<string, PpOrder>()
let ppNext = 1
let ppUpcoming: PpOrder['capture'] = 'complete'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const ppBody = (o: PpOrder) => ({
  id: o.id,
  status: o.captured === 'none' ? 'APPROVED' : 'COMPLETED',
  purchase_units: o.captured === 'none' ? [{}] : [{ payments: { captures: [{ id: `CAP-${o.id}`, status: o.captured, amount: { currency_code: 'AUD', value: o.value } }] } }],
})
async function fakePaypal(url: URL, init?: RequestInit): Promise<Response> {
  if (url.pathname === '/v1/oauth2/token') return json({ access_token: 't' })
  if (url.pathname === '/v2/checkout/orders' && init?.method === 'POST') {
    const unit = JSON.parse(String(init.body)).purchase_units[0]
    const o: PpOrder = { id: `PPO-${ppNext++}`, value: unit.amount.value, capture: ppUpcoming, captured: 'none' }
    ppOrders.set(o.id, o)
    return json({ id: o.id, links: [{ rel: 'approve', href: `${PAYPAL}/approve?token=${o.id}` }] }, 201)
  }
  const m = /^\/v2\/checkout\/orders\/([^/]+)(\/capture)?$/.exec(url.pathname)
  const o = m && ppOrders.get(decodeURIComponent(m[1]))
  if (!o) return json({ name: 'RESOURCE_NOT_FOUND' }, 404)
  if (m![2]) {
    if (o.capture === 'error') return json({ name: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' }, 500)
    o.captured = o.capture === 'pending' ? 'PENDING' : 'COMPLETED'
    return json(ppBody(o), 201)
  }
  return json(ppBody(o))
}

beforeAll(async () => {
  api = await startApi({ seed: 'demo' })
  const { env } = await import('../../server/env')
  env.stripe = { key: 'sk_test_review', webhookSecret: SECRET }
  env.paypal = { id: 'id', secret: 'secret', api: PAYPAL, webhookId: '' }
  models = await import('../../server/models')
  giving = await import('../../server/lib/giving')
  plans = await import('../../server/lib/plans')
  const { stripe } = await import('../../server/lib/payments')
  s = await stripe()
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (url.origin === PAYPAL) return fakePaypal(url, init)
    return realFetch(input, init)
  }) as typeof fetch
})
afterAll(async () => {
  globalThis.fetch = realFetch
  await api?.stop()
})

/* ---------- Stripe, stubbed ---------- */
let evN = 0
const event = (type: string, object: Record<string, unknown>) => ({ id: `evt_r_${evN++}`, object: 'event', type, livemode: false, created: 1, data: { object } })
async function deliver(e: unknown) {
  const payload = JSON.stringify(e)
  const header = s.webhooks.generateTestHeaderString({ payload, secret: SECRET })
  return api.client().post('/api/webhooks/stripe', undefined, { raw: payload, headers: { 'stripe-signature': header, 'Content-Type': 'application/json' } })
}
const connectionError = () => Object.assign(new Error('Could not connect to Stripe'), { type: 'StripeConnectionError' })
const cardError = () => Object.assign(new Error('Your card was declined.'), { type: 'StripeCardError', code: 'card_declined' })

/** a monthly plan due now, with a Stripe card on file */
async function duePlan(over: Record<string, unknown> = {}) {
  const { Plan, Donor } = models
  const donor = (await Donor.findOne({ status: 'active', email: { $not: /\.invalid$/ } }))!
  const due = new Date(Date.now() - 3_600_000)
  const p = await Plan.create({
    number: `P-R${Math.random().toString(36).slice(2, 8)}`,
    donor: donor._id,
    donorName: donor.firstName,
    amount: 2000,
    operatingCosts: 0,
    frequency: 'monthly',
    status: 'active',
    startDate: new Date(Date.now() - 40 * 86_400_000),
    nextChargeAt: due,
    failure: { count: 0 },
    payment: { method: 'card', brand: 'Visa', last4: '4242', stripeCustomer: 'cus_r', stripePaymentMethod: 'pm_r' },
    ...over,
  })
  return p
}

const giftsOf = (planId: import('mongoose').Types.ObjectId) => models.Gift.find({ plan: planId, status: 'succeeded' }).lean()

describe('#1 only a decline is a decline', () => {
  it('no answer from Stripe: nothing failed, the same key next time, and one gift when it answers', async () => {
    const p = await duePlan()
    const create = vi.fn().mockRejectedValueOnce(connectionError()).mockResolvedValueOnce({ id: 'pi_r1', status: 'succeeded' })
    s.paymentIntents.create = create

    const first = await plans.chargePlan(p)
    expect(first).toMatchObject({ ok: false, pending: true })
    let fresh = (await models.Plan.findById(p._id).lean())!
    expect(fresh.status).toBe('active')
    expect(fresh.failure?.count ?? 0).toBe(0)
    expect(fresh.pendingCharge?.key).toBeTruthy()
    expect(await models.Gift.countDocuments({ plan: p._id, status: 'failed' })).toBe(0)

    const second = await plans.chargePlan((await models.Plan.findById(p._id))!)
    expect(second.ok).toBe(true)
    expect(create.mock.calls[0][1].idempotencyKey).toBe(create.mock.calls[1][1].idempotencyKey)
    expect(create.mock.calls[0][0].metadata).toMatchObject({ planId: p.id })
    expect(await giftsOf(p._id)).toHaveLength(1)
    fresh = (await models.Plan.findById(p._id).lean())!
    expect(fresh.pendingCharge?.key).toBeFalsy()
    expect(fresh.nextChargeAt!.getTime()).toBeGreaterThan(Date.now())
  })

  it('still processing: waits; the webhook records it once, and the plan moves on once', async () => {
    const p = await duePlan()
    s.paymentIntents.create = vi.fn().mockResolvedValue({ id: 'pi_r2', status: 'processing' })
    const r = await plans.chargePlan(p)
    expect(r).toMatchObject({ ok: false, pending: true })
    expect(await giftsOf(p._id)).toHaveLength(0)

    const meta = s.paymentIntents.create.mock.calls[0][0].metadata
    const pi = { id: 'pi_r2', object: 'payment_intent', status: 'succeeded', amount: 2000, metadata: meta }
    await deliver(event('payment_intent.succeeded', pi))
    await deliver(event('payment_intent.succeeded', pi))
    expect(await giftsOf(p._id)).toHaveLength(1)
    const after = (await models.Plan.findById(p._id).lean())!
    expect(after.collected).toBe(2000)
    expect(after.nextChargeAt!.getTime()).toBeGreaterThan(Date.now())
    /* no longer due, so nothing charges it again today */
    s.paymentIntents.create = vi.fn()
    expect((await plans.chargePlan((await models.Plan.findById(p._id))!)).ok).toBe(false)
    expect(s.paymentIntents.create).not.toHaveBeenCalled()
  })

  it('a card error is a decline: past due, a failed gift, the donor told', async () => {
    const p = await duePlan()
    s.paymentIntents.create = vi.fn().mockRejectedValue(cardError())
    const r = await plans.chargePlan(p)
    expect(r.ok).toBe(false)
    const after = (await models.Plan.findById(p._id).lean())!
    expect(after.status).toBe('past_due')
    expect(after.failure?.count).toBe(1)
    expect(await models.Gift.countDocuments({ plan: p._id, status: 'failed' })).toBe(1)
  })
})

/* payment_intent.payment_failed: a regular payment the plan was waiting on
   (it was "processing") that the bank then refused is recorded as a decline
   straight away — once, whoever learns of it first — while a decline the card
   gave on the spot, which the run already recorded, is not counted again. */
describe('a waiting regular payment that then fails', () => {
  const failedGifts = (planId: import('mongoose').Types.ObjectId) => models.Gift.countDocuments({ plan: planId, status: 'failed' })
  const failedEmails = async (planId: string) => {
    const plan = (await models.Plan.findById(planId).lean())!
    return models.EmailMessage.countDocuments({ donor: plan.donor, template: 'plan.failed', createdAt: { $gte: plan.createdAt } })
  }

  it('is recorded as one decline, however many times Stripe says so', async () => {
    const p = await duePlan()
    s.paymentIntents.create = vi.fn().mockResolvedValue({ id: 'pi_pf1', status: 'processing' })
    expect(await plans.chargePlan(p)).toMatchObject({ ok: false, pending: true })
    const meta = s.paymentIntents.create.mock.calls[0][0].metadata
    const pi = { id: 'pi_pf1', object: 'payment_intent', status: 'requires_payment_method', amount: 2000, metadata: meta, last_payment_error: { message: 'Insufficient funds.' } }

    expect((await deliver(event('payment_intent.payment_failed', pi))).status).toBe(200)
    expect((await deliver(event('payment_intent.payment_failed', pi))).status).toBe(200)

    const after = (await models.Plan.findById(p._id).lean())!
    expect(after.status).toBe('past_due')
    expect(after.failure?.count).toBe(1)
    expect(after.failure?.lastError).toBe('Insufficient funds.')
    expect(after.pendingCharge?.key).toBeFalsy()
    expect(await failedGifts(p._id)).toBe(1)
    expect(await failedEmails(p.id)).toBe(1)
  })

  it('does not count again a decline the run already recorded', async () => {
    const p = await duePlan()
    s.paymentIntents.create = vi.fn().mockRejectedValue(cardError())
    await plans.chargePlan(p)
    expect(await failedGifts(p._id)).toBe(1)
    /* Stripe sends payment_failed for that same decline too */
    const key = s.paymentIntents.create.mock.calls[0][1].idempotencyKey
    const pi = { id: 'pi_pf2', object: 'payment_intent', status: 'requires_payment_method', amount: 2000, metadata: { planId: p.id, chargeKey: key } }
    await deliver(event('payment_intent.payment_failed', pi))
    const after = (await models.Plan.findById(p._id).lean())!
    expect(after.failure?.count).toBe(1)
    expect(await failedGifts(p._id)).toBe(1)
  })

  it('records it once when the webhook and a retry of the same key arrive together', async () => {
    const p = await duePlan()
    s.paymentIntents.create = vi.fn().mockResolvedValueOnce({ id: 'pi_pf3', status: 'processing' })
    await plans.chargePlan(p)
    const meta = s.paymentIntents.create.mock.calls[0][0].metadata
    /* make the plan due for the retry run, which gets the same refusal */
    await models.Plan.updateOne({ _id: p._id }, { $set: { nextChargeAt: new Date(Date.now() - 60_000) } })
    s.paymentIntents.create = vi.fn().mockRejectedValue(cardError())
    const pi = { id: 'pi_pf3', object: 'payment_intent', status: 'requires_payment_method', amount: 2000, metadata: meta }
    await Promise.all([deliver(event('payment_intent.payment_failed', pi)), plans.chargePlan((await models.Plan.findById(p._id))!)])
    const after = (await models.Plan.findById(p._id).lean())!
    expect(after.failure?.count).toBe(1)
    expect(await failedGifts(p._id)).toBe(1)
    expect(await failedEmails(p.id)).toBe(1)
  })

  it('still tells the donor when a plan already past due is declined again', async () => {
    const p = await duePlan({ status: 'past_due', failure: { count: 1, nextRetryAt: new Date(Date.now() - 60_000), firstFailedAt: new Date() } })
    s.paymentIntents.create = vi.fn().mockRejectedValue(cardError())
    await plans.chargePlan(p)
    const after = (await models.Plan.findById(p._id).lean())!
    expect(after.failure?.count).toBe(2)
    expect(await failedEmails(p.id)).toBe(1)
  })
})

describe('(A) only when due', () => {
  it('a plan read as due, then charged by another path, is not charged again from the stale read', async () => {
    const p = await duePlan()
    const stale = (await models.Plan.findById(p._id))!
    s.paymentIntents.create = vi.fn().mockResolvedValue({ id: 'pi_rA', status: 'succeeded' })
    /* another path (a card update, an admin retry) charges it first */
    expect((await plans.chargePlan((await models.Plan.findById(p._id))!)).ok).toBe(true)
    /* then the scheduler reaches its stale copy */
    const again = await plans.chargePlan(stale)
    expect(again).toMatchObject({ ok: false, busy: true })
    expect(s.paymentIntents.create).toHaveBeenCalledTimes(1)
    expect(await giftsOf(p._id)).toHaveLength(1)
  })

  it('a failing plan is charged before its retry date only when asked to (a new card, Retry)', async () => {
    const p = await duePlan({ status: 'past_due', failure: { count: 1, nextRetryAt: new Date(Date.now() + 3 * 86_400_000) } })
    s.paymentIntents.create = vi.fn().mockResolvedValue({ id: 'pi_rA2', status: 'succeeded' })
    expect((await plans.chargePlan(p)).ok).toBe(false)
    expect(s.paymentIntents.create).not.toHaveBeenCalled()
    expect((await plans.chargePlan((await models.Plan.findById(p._id))!, null, { retryNow: true })).ok).toBe(true)
  })
})

describe('#6 and #7: stopping mid-charge, and a run that died', () => {
  it('a plan cancelled while its payment was taken stays cancelled; the money is recorded and flagged', async () => {
    const p = await duePlan()
    s.paymentIntents.create = vi.fn().mockImplementation(async () => {
      await models.Plan.updateOne({ _id: p._id }, { $set: { status: 'cancelled', cancelledAt: new Date() } })
      return { id: 'pi_r6', status: 'succeeded' }
    })
    expect((await plans.chargePlan(p)).ok).toBe(true)
    expect((await models.Plan.findById(p._id).lean())!.status).toBe('cancelled')
    expect(await giftsOf(p._id)).toHaveLength(1)
    expect(await models.AuditEvent.countDocuments({ action: 'plan.charged_while_stopped', 'entity.id': p._id })).toBe(1)
  })

  it('a payment recorded by a run that died before counting it is counted once, and the plan moves on', async () => {
    const p = await duePlan({ kind: 'instalment', instalments: { total: 3, paid: 1 }, collected: 2000 })
    const donor = (await models.Donor.findById(p.donor))!
    /* what the dead run left: the gift, but no count and no new date */
    await giving.recordGift({ donor, amount: 2000, designation: 'sadaqah', method: 'card', planId: p._id, source: 'recurring', external: { stripe: 'pi_r7' } })
    s.paymentIntents.create = vi.fn().mockResolvedValue({ id: 'pi_r7', status: 'succeeded' }) // Stripe replays it
    expect((await plans.chargePlan(p)).ok).toBe(true)
    await plans.settlePlanPayment({ id: 'pi_r7', amount: 2000, metadata: { planId: p.id, due: p.nextChargeAt!.toISOString() } })
    const after = (await models.Plan.findById(p._id).lean())!
    expect(after.collected).toBe(4000)
    expect(after.instalments?.paid).toBe(2)
    expect(await giftsOf(p._id)).toHaveLength(1)
  })
})

describe('#2 a late Stripe confirmation', () => {
  it('pays a card gift the sweep had already marked abandoned', async () => {
    const donor = (await models.Donor.findOne({ status: 'active', email: { $not: /\.invalid$/ } }))!
    const g = await giving.recordGift({ donor, amount: 3000, designation: 'sadaqah', method: 'card', status: 'pending', source: 'online' })
    await models.Gift.collection.updateOne({ _id: g._id }, { $set: { createdAt: new Date(Date.now() - 5 * 86_400_000) } })
    const { sweepAbandonedCheckouts } = await import('../../server/lib/sweeps')
    await sweepAbandonedCheckouts()
    expect((await models.Gift.findById(g._id).lean())!.status).toBe('failed')

    await deliver(event('checkout.session.completed', {
      id: 'cs_r2', object: 'checkout.session', mode: 'payment', payment_status: 'paid', currency: 'aud', amount_total: 3000,
      payment_intent: 'pi_r2late', customer: 'cus_r', metadata: { giftId: g.id },
    }))
    const after = (await models.Gift.findById(g._id).lean())!
    expect(after.status).toBe('succeeded')
    expect(after.receipt?.number).toBeTruthy()
    expect(after.failureReason).toBeFalsy()
    expect(await models.AuditEvent.countDocuments({ action: 'gift.revived', 'entity.id': g._id })).toBe(1)
  })
})

describe('#3 PayPal waits unless it is a decline', () => {
  async function startPaypal(capture: PpOrder['capture']) {
    ppUpcoming = capture
    const res = await api.client().post('/api/public/checkout', checkoutBody({ provider: 'paypal', amount: 40 }))
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const orderId = new URL(res.body.url).searchParams.get('token')!
    const gift = (await models.Gift.findOne({ 'external.paypal': orderId }).select('+publicToken'))!
    return { gift, orderId }
  }
  const comeBack = (giftId: string, orderId: string) => api.client().get(`/api/public/paypal/return?gift=${giftId}&token=${orderId}`)

  it('a capture PayPal holds for review: pending, "held" on the thank-you page, and paid when the sweep finds it released', async () => {
    const { gift, orderId } = await startPaypal('pending')
    await comeBack(gift.id, orderId)
    let g = (await models.Gift.findById(gift._id).lean())!
    expect(g.status).toBe('pending')
    expect(g.paypalCapture?.status).toBe('PENDING')
    const status = await api.client().get(`/api/public/gifts/${gift.id}/status?t=${gift.publicToken}`)
    expect(status.body).toMatchObject({ status: 'pending', held: true })

    /* four days on it is still held: not abandoned */
    await models.Gift.collection.updateOne({ _id: gift._id }, { $set: { createdAt: new Date(Date.now() - 5 * 86_400_000) } })
    const { sweepAbandonedCheckouts } = await import('../../server/lib/sweeps')
    await sweepAbandonedCheckouts()
    expect((await models.Gift.findById(gift._id).lean())!.status).toBe('pending')

    /* PayPal releases it */
    ppOrders.get(orderId)!.captured = 'COMPLETED'
    await sweepAbandonedCheckouts()
    g = (await models.Gift.findById(gift._id).lean())!
    expect(g.status).toBe('succeeded')
    expect(g.receipt?.number).toBeTruthy()
  })

  it('an unclear answer (PayPal 500, order not captured) leaves the gift pending, not failed', async () => {
    const { gift, orderId } = await startPaypal('error')
    await comeBack(gift.id, orderId)
    expect((await models.Gift.findById(gift._id).lean())!.status).toBe('pending')
  })
})

describe('#4 a bank statement saved twice', () => {
  it('makes one gift for a line, however many times it is saved', async () => {
    const owner = await api.staff('yusuf@alanwaar.group')
    const donor = (await models.Donor.findOne({ status: 'active', email: { $not: /\.invalid$/ } }))!
    const imp = await models.BankImport.create({
      filename: 'review.csv',
      lines: [{
        date: new Date(Date.now() - 2 * 86_400_000), description: 'TRANSFER FROM REVIEW TEST', amount: 4321, hash: `h-${Date.now()}`,
        status: 'matched', match: { donor: donor._id, donorName: donor.firstName, designation: 'general', confidence: 1, reasons: ['Chosen by a test'], via: 'manual' },
      }],
    })
    const lineId = imp.lines[0]._id
    const first = await owner.post(`/api/admin/bank/imports/${imp.id}/confirm`, {})
    expect(first.status, JSON.stringify(first.body)).toBe(200)
    expect(await models.Gift.countDocuments({ bankLine: lineId })).toBe(1)

    /* as if the save had stopped after the gift but before the line was marked */
    await models.BankImport.updateOne({ _id: imp._id, 'lines._id': lineId }, { $set: { status: 'review', 'lines.$.status': 'matched' }, $unset: { 'lines.$.gift': 1, completedAt: 1 } })
    const again = await owner.post(`/api/admin/bank/imports/${imp.id}/confirm`, {})
    expect(again.status, JSON.stringify(again.body)).toBe(200)
    expect(await models.Gift.countDocuments({ bankLine: lineId })).toBe(1)
    const line = (await models.BankImport.findById(imp._id).lean())!.lines[0]
    expect(line.status).toBe('confirmed')
  })
})

describe('#5 the volunteer lookup', () => {
  it('finds a donor by a whole email address, never by part of one', async () => {
    const volunteer = await api.staff('bilal@alanwaar.group')
    const whole = await volunteer.get('/api/admin/lookup/donors?q=amina.rahman@example.com')
    expect(whole.body.items.map((d: { lastName: string }) => d.lastName)).toContain('Rahman')
    for (const q of ['amina.rahman@example', 'a@example.com', 'rahman @example.com', 'D-10001 a@']) {
      const part = await volunteer.get(`/api/admin/lookup/donors?q=${encodeURIComponent(q)}`)
      expect(part.body.items, q).toHaveLength(0)
    }
  })

  it('is rate-limited per member of staff', async () => {
    const volunteer = await api.staff('bilal@alanwaar.group')
    process.env.STRICT_LIMITS = '1'
    try {
      let last = 200
      for (let i = 0; i < 65 && last !== 429; i++) last = (await volunteer.get(`/api/admin/lookup/donors?q=nobody${i}`)).status
      expect(last).toBe(429)
    } finally {
      delete process.env.STRICT_LIMITS
    }
  })
})

describe('#9 and #10: receipts and chargebacks', () => {
  it('issuing a receipt keeps what the receipt already carried', async () => {
    const donor = (await models.Donor.findOne({ status: 'active' }))!
    const g = await giving.recordGift({ donor, amount: 1200, designation: 'sadaqah', method: 'card', status: 'pending', source: 'online' })
    const sweptAt = new Date(Date.now() - 60_000)
    await models.Gift.updateOne({ _id: g._id }, { $set: { status: 'succeeded', 'receipt.sweptAt': sweptAt } })
    await giving.issueReceipt((await models.Gift.findById(g._id))!, { email: false })
    const after = (await models.Gift.findById(g._id).lean())!
    expect(after.receipt?.number).toBeTruthy()
    expect(after.receipt?.sweptAt?.getTime()).toBe(sweptAt.getTime())
  })

  it('a lost chargeback stops the donation counting, without a refund email; a won one stands', async () => {
    const donor = (await models.Donor.findOne({ status: 'active', email: { $not: /\.invalid$/ } }))!
    const lost = await giving.recordGift({ donor, amount: 5100, designation: 'sadaqah', method: 'card', source: 'online', external: { stripe: 'pi_r10l' } })
    const won = await giving.recordGift({ donor, amount: 5200, designation: 'sadaqah', method: 'card', source: 'online', external: { stripe: 'pi_r10w' } })
    const before = await models.EmailMessage.countDocuments({ to: donor.email, template: /refund/ })
    const dispute = (pi: string, status: string) => ({ id: `dp_${pi}`, object: 'dispute', payment_intent: pi, status, reason: 'fraudulent', amount: 5100 })

    await deliver(event('charge.dispute.closed', dispute('pi_r10l', 'lost')))
    await deliver(event('charge.dispute.closed', dispute('pi_r10l', 'lost')))
    await deliver(event('charge.dispute.closed', dispute('pi_r10w', 'won')))

    const l = (await models.Gift.findById(lost._id).lean())!
    expect(l.status).toBe('refunded')
    expect(l.dispute?.outcome).toBe('lost')
    expect(await models.EmailMessage.countDocuments({ to: donor.email, template: /refund/ })).toBe(before)
    expect(await models.AuditEvent.countDocuments({ action: 'gift.dispute_lost', 'entity.id': lost._id })).toBe(1)
    const w = (await models.Gift.findById(won._id).lean())!
    expect(w.status).toBe('succeeded')
    expect(w.dispute?.outcome).toBe('won')
  })
})

describe('#11 and the migrations', () => {
  it('gives old duplicate simulated ids their own, and builds the unique indexes (replacing an old one)', async () => {
    const { Gift } = models
    const mongoose = (await import('mongoose')).default
    const { runMigrations } = await import('../../server/migrations')
    /* a database from before: no unique index, a sparse receipt index, two
       simulated payments sharing an id */
    await Gift.collection.dropIndex('external.stripe_1').catch(() => {})
    await Gift.collection.dropIndex('receipt.number_1').catch(() => {})
    await Gift.collection.createIndex({ 'receipt.number': 1 }, { sparse: true })
    const donor = (await models.Donor.findOne({ status: 'active' }))!
    const a = await giving.recordGift({ donor, amount: 1000, designation: 'sadaqah', method: 'card', source: 'recurring' })
    const b = await giving.recordGift({ donor, amount: 1000, designation: 'sadaqah', method: 'card', source: 'recurring' })
    await Gift.collection.updateMany({ _id: { $in: [a._id, b._id] } }, { $set: { 'external.stripe': 'sim_pi_2026-10-01-0' } })
    await mongoose.connection.collection('migrations').deleteOne({ _id: '2026-10-unique-simulated-charge-ids' } as never)

    await runMigrations()

    const ids = (await Gift.find({ _id: { $in: [a._id, b._id] } }).lean()).map((g) => g.external?.stripe)
    expect(new Set(ids).size).toBe(2)
    const indexes = await Gift.collection.indexes()
    expect(indexes.find((i) => i.name === 'external.stripe_1')?.unique).toBe(true)
    expect(indexes.find((i) => i.name === 'receipt.number_1')?.unique).toBe(true)
  })

  it('a migration that fails runs again at the next start; a stale claim is taken over', async () => {
    const mongoose = (await import('mongoose')).default
    const m = await import('../../server/migrations')
    let runs = 0
    let fail = true
    m.MIGRATIONS.push({
      name: 'test-flaky',
      run: async () => {
        runs++
        if (fail) throw new Error('boom')
        return 'ok'
      },
    })
    try {
      await expect(m.runMigrations()).rejects.toThrow('boom')
      fail = false
      await m.runMigrations()
      expect(runs).toBe(2)
      const row = await mongoose.connection.collection('migrations').findOne({ _id: 'test-flaky' } as never)
      expect(row?.finishedAt).toBeTruthy()

      /* a process died holding a claim twenty minutes ago */
      await mongoose.connection.collection('migrations').updateOne({ _id: 'test-flaky' } as never, { $set: { startedAt: new Date(Date.now() - 20 * 60_000) }, $unset: { finishedAt: 1 } })
      await m.runMigrations()
      expect(runs).toBe(3)
    } finally {
      m.MIGRATIONS.pop()
    }
  })

  it('the second redaction catches codes logged by old instances after the first', async () => {
    const mongoose = (await import('mongoose')).default
    const { runMigrations } = await import('../../server/migrations')
    await models.EmailMessage.create({ to: 'late@example.com', subject: '424242 is your Al-Anwaar sign-in code', template: 'otp', html: '<p>424242</p>', text: '424242', transport: 'outbox', status: 'sent' })
    await mongoose.connection.collection('migrations').deleteOne({ _id: '2026-10-redact-email-log-2' } as never)
    await runMigrations()
    expect(await models.EmailMessage.countDocuments({ $or: [{ subject: /424242/ }, { html: /424242/ }] })).toBe(0)
  })
})
