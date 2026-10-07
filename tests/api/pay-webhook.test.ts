import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { startApi, type Api } from '../helpers/server'

/* ---------------------------------------------------------------------------
   The Stripe webhook (server/routes/webhooks.ts), with signed events and a
   stubbed Stripe client: nothing here reaches the network. The tests run
   with a test-mode key, so every event says livemode: false.

     bad signature, wrong mode, wrong amount, unpaid session   nothing changes
     the same event twice, and three at once                  one payment
     starting the plan fails, then Stripe redelivers          one plan (H6)
     expired, refunded, disputed                              L12, M5
--------------------------------------------------------------------------- */

const SECRET = 'whsec_test_secret_for_the_webhook_tests'

let api: Api
let models: typeof import('../../server/models')
let giving: typeof import('../../server/lib/giving')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let s: any

beforeAll(async () => {
  api = await startApi({ seed: 'demo' })
  const { env } = await import('../../server/env')
  env.stripe = { key: 'sk_test_webhook_tests', webhookSecret: SECRET }
  models = await import('../../server/models')
  giving = await import('../../server/lib/giving')
  const { stripe } = await import('../../server/lib/payments')
  s = await stripe()
})
afterAll(() => api?.stop())

const card = (id: string) => ({ id, customer: 'cus_test', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2031 } })

/** a pending card gift as POST /checkout leaves it, waiting for Stripe */
async function pendingGift(opts: { monthly?: boolean } = {}) {
  const { Donor, Gift } = models
  const donor = (await Donor.findOne({ status: 'active', email: { $not: /\.invalid$/ } }))!
  const g = await giving.recordGift({ donor, amount: 5000, fee: 200, designation: 'sadaqah', method: 'card', status: 'pending', source: 'online' })
  await Gift.updateOne({ _id: g._id }, { $set: { checkout: { frequency: opts.monthly ? 'monthly' : 'once', operatingCosts: 200 } } })
  return { gift: g, email: donor.email }
}

let n = 0
function event(type: string, object: Record<string, unknown>, over: Record<string, unknown> = {}) {
  return { id: `evt_test_${Date.now()}_${n++}`, object: 'event', type, livemode: false, created: Math.floor(Date.now() / 1000), data: { object }, ...over }
}
const paidSession = (giftId: string, pi: string, over: Record<string, unknown> = {}) => ({
  id: `cs_test_${pi}`, object: 'checkout.session', mode: 'payment', payment_status: 'paid', currency: 'aud',
  amount_total: 5200, payment_intent: pi, customer: 'cus_test', metadata: { giftId }, ...over,
})

async function deliver(e: unknown, secret = SECRET) {
  const payload = JSON.stringify(e)
  const header = s.webhooks.generateTestHeaderString({ payload, secret })
  return api.client().post('/api/webhooks/stripe', undefined, { raw: payload, headers: { 'stripe-signature': header, 'Content-Type': 'application/json' } })
}

const receiptEmails = (to: string, number: string) =>
  models.EmailMessage.countDocuments({ to, template: /^receipt/, subject: new RegExp(number) })

/** the receipt email goes just after the 200; wait for it */
async function settled(giftId: unknown) {
  for (let i = 0; i < 50; i++) {
    const g = await models.Gift.findById(giftId).lean()
    if (g?.receipt?.emailedAt) return g
    await new Promise((r) => setTimeout(r, 50))
  }
  return models.Gift.findById(giftId).lean()
}

describe('what the webhook refuses to believe', () => {
  it('a bad signature is a 400 and changes nothing', async () => {
    const { gift } = await pendingGift()
    const res = await deliver(event('checkout.session.completed', paidSession(gift.id, 'pi_badsig')), 'whsec_wrong')
    expect(res.status).toBe(400)
    expect((await models.Gift.findById(gift._id).lean())!.status).toBe('pending')
  })

  it('an event from the other Stripe mode is ignored', async () => {
    const { gift } = await pendingGift()
    const res = await deliver(event('checkout.session.completed', paidSession(gift.id, 'pi_live'), { livemode: true }))
    expect(res.status).toBe(200)
    expect((await models.Gift.findById(gift._id).lean())!.status).toBe('pending')
  })

  it('a session for a different amount or currency is not marked paid (M5)', async () => {
    const { gift } = await pendingGift()
    await deliver(event('checkout.session.completed', paidSession(gift.id, 'pi_amount', { amount_total: 100 })))
    await deliver(event('checkout.session.completed', paidSession(gift.id, 'pi_currency', { currency: 'usd' })))
    expect((await models.Gift.findById(gift._id).lean())!.status).toBe('pending')
    expect(await models.AuditEvent.exists({ action: 'gift.mismatch', 'entity.id': gift._id })).toBeTruthy()
  })

  it('an unpaid session waits for async_payment_succeeded (M5)', async () => {
    const { gift } = await pendingGift()
    await deliver(event('checkout.session.completed', paidSession(gift.id, 'pi_async', { payment_status: 'unpaid' })))
    expect((await models.Gift.findById(gift._id).lean())!.status).toBe('pending')
    await deliver(event('checkout.session.async_payment_succeeded', paidSession(gift.id, 'pi_async')))
    expect((await models.Gift.findById(gift._id).lean())!.status).toBe('succeeded')
  })
})

describe('one payment, however many times Stripe says so', () => {
  it('the same event twice: paid once, one receipt number, one email', async () => {
    const { gift, email } = await pendingGift()
    const e = event('checkout.session.completed', paidSession(gift.id, 'pi_twice'))
    expect((await deliver(e)).status).toBe(200)
    const first = (await settled(gift._id))!
    expect(first.status).toBe('succeeded')
    expect(first.external?.stripe).toBe('pi_twice')
    expect((await deliver(e)).status).toBe(200)
    const second = (await settled(gift._id))!
    expect(second.receipt?.number).toBe(first.receipt?.number)
    expect(await receiptEmails(email, first.receipt!.number!)).toBe(1)
  })

  it('three deliveries at the same moment: paid once, one email, one log line', async () => {
    const { gift, email } = await pendingGift()
    const e = event('checkout.session.completed', paidSession(gift.id, 'pi_concurrent'))
    const results = await Promise.all([deliver(e), deliver(e), deliver(e)])
    expect(results.map((r) => r.status)).toEqual([200, 200, 200])
    const g = (await settled(gift._id))!
    await new Promise((r) => setTimeout(r, 300))
    expect(g.status).toBe('succeeded')
    expect(await receiptEmails(email, g.receipt!.number!)).toBe(1)
    /* recordGift logged the pledge when the gift was made; this is the
       confirmation, which only the delivery that marked it paid writes */
    expect(await models.AuditEvent.countDocuments({ action: 'gift.online', 'entity.id': gift._id, summary: /^Stripe confirmed/ })).toBe(1)
  })
})

describe('a regular gift whose plan fails to start (H6)', () => {
  it('answers 500, keeps the payment and receipt, and the redelivery starts exactly one plan', async () => {
    const { Gift, Plan } = models
    const { gift, email } = await pendingGift({ monthly: true })
    const retrieve = vi.fn()
      .mockRejectedValueOnce(new Error('Stripe is having a moment'))
      .mockResolvedValue({ id: 'pi_plan', customer: 'cus_test', payment_method: card('pm_plan') })
    s.paymentIntents.retrieve = retrieve
    const e = event('checkout.session.completed', paidSession(gift.id, 'pi_plan'))

    const first = await deliver(e)
    expect(first.status).toBe(500)
    const afterFail = (await Gift.findById(gift._id).lean())!
    expect(afterFail.status).toBe('succeeded')
    expect(afterFail.receipt?.number).toBeTruthy()
    expect(afterFail.plan).toBeFalsy()
    expect(afterFail.checkout?.planClaimedAt).toBeFalsy()
    expect(await receiptEmails(email, afterFail.receipt!.number!)).toBe(1)

    expect((await deliver(e)).status).toBe(200)
    expect((await deliver(e)).status).toBe(200)
    const plans = await Plan.find({ firstGift: gift._id }).lean()
    expect(plans).toHaveLength(1)
    expect(plans[0].payment?.last4).toBe('4242')
    expect(plans[0].payment?.stripePaymentMethod).toBe('pm_plan')
    expect(String((await Gift.findById(gift._id).lean())!.plan)).toBe(String(plans[0]._id))
    expect(await receiptEmails(email, afterFail.receipt!.number!)).toBe(1)
    expect(retrieve).toHaveBeenCalledTimes(2)
  })

  it('two deliveries at once start one plan', async () => {
    const { Plan } = models
    const { gift } = await pendingGift({ monthly: true })
    s.paymentIntents.retrieve = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 100))
      return { id: 'pi_plan2', customer: 'cus_test', payment_method: card('pm_plan2') }
    })
    const e = event('checkout.session.completed', paidSession(gift.id, 'pi_plan2'))
    await Promise.all([deliver(e), deliver(e)])
    expect(await Plan.countDocuments({ firstGift: gift._id })).toBe(1)
  })
})

describe('the other events', () => {
  it('checkout.session.expired marks the gift abandoned (L12)', async () => {
    const { gift } = await pendingGift()
    await deliver(event('checkout.session.expired', paidSession(gift.id, 'pi_expired', { payment_status: 'unpaid' })))
    const g = (await models.Gift.findById(gift._id).lean())!
    expect(g.status).toBe('failed')
    expect(g.failureReason).toBe('Checkout abandoned')
  })

  it('charge.refunded records a full refund once; a partial one only goes in the log', async () => {
    const full = await pendingGift()
    await deliver(event('checkout.session.completed', paidSession(full.gift.id, 'pi_refund_full')))
    const charge = (pi: string, refunded: number) => ({ id: `ch_${pi}`, object: 'charge', payment_intent: pi, amount: 5200, amount_refunded: refunded, refunded: refunded >= 5200 })
    await deliver(event('charge.refunded', charge('pi_refund_full', 5200)))
    await deliver(event('charge.refunded', charge('pi_refund_full', 5200)))
    expect((await models.Gift.findById(full.gift._id).lean())!.status).toBe('refunded')
    expect(await models.AuditEvent.countDocuments({ action: 'gift.refund', 'entity.id': full.gift._id })).toBe(1)

    const part = await pendingGift()
    await deliver(event('checkout.session.completed', paidSession(part.gift.id, 'pi_refund_part')))
    await deliver(event('charge.refunded', charge('pi_refund_part', 1000)))
    expect((await models.Gift.findById(part.gift._id).lean())!.status).toBe('succeeded')
    expect(await models.AuditEvent.exists({ action: 'gift.refund_partial', 'entity.id': part.gift._id })).toBeTruthy()
  })

  it('charge.dispute.created flags the gift, once', async () => {
    const { gift } = await pendingGift()
    await deliver(event('checkout.session.completed', paidSession(gift.id, 'pi_dispute')))
    const dispute = { id: 'dp_test', object: 'dispute', payment_intent: 'pi_dispute', amount: 5200, reason: 'fraudulent' }
    await deliver(event('charge.dispute.created', dispute))
    await deliver(event('charge.dispute.created', dispute))
    expect((await models.Gift.findById(gift._id).lean())!.dispute?.reason).toBe('fraudulent')
    expect(await models.AuditEvent.countDocuments({ action: 'gift.dispute', 'entity.id': gift._id })).toBe(1)
  })
})
