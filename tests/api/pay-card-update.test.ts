import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Types } from 'mongoose'
import { startApi, type Api } from '../helpers/server'

/* ---------------------------------------------------------------------------
   The card-update webhook (server/routes/webhooks.ts onCardUpdated):
   checkout.session.completed in mode 'setup' with metadata.purpose
   'card-update' puts the new card on the plan and, for a failing plan, tries
   the payment again at once. Stripe delivers at least once, so:

     the same event twice, one after the other   the card set once, one log
                                                 line, one payment
     the same event twice, at the same moment    the same

   Signed events and a stubbed Stripe client, as in pay-webhook.test.ts.
--------------------------------------------------------------------------- */

const SECRET = 'whsec_test_card_update'

let api: Api
let models: typeof import('../../server/models')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let s: any

beforeAll(async () => {
  api = await startApi({ seed: 'demo' })
  const { env } = await import('../../server/env')
  env.stripe = { key: 'sk_test_card_update', webhookSecret: SECRET }
  models = await import('../../server/models')
  const { stripe } = await import('../../server/lib/payments')
  s = await stripe()
})
afterAll(() => api?.stop())

let n = 0
const event = (object: Record<string, unknown>) => ({
  id: `evt_cu_${Date.now()}_${n++}`, object: 'event', type: 'checkout.session.completed', livemode: false,
  created: Math.floor(Date.now() / 1000), data: { object },
})
async function deliver(e: unknown) {
  const payload = JSON.stringify(e)
  const header = s.webhooks.generateTestHeaderString({ payload, secret: SECRET })
  return api.client().post('/api/webhooks/stripe', undefined, { raw: payload, headers: { 'stripe-signature': header, 'Content-Type': 'application/json' } })
}

/** a plan failing on an old card, as a donor's "update my card" checkout finds it */
async function failingPlan(tag: string) {
  const donor = (await models.Donor.findOne({ status: 'active', email: { $not: /\.invalid$/ } }))!
  return models.Plan.create({
    number: `P-CU${tag}${Math.random().toString(36).slice(2, 6)}`,
    donor: donor._id,
    donorName: donor.firstName,
    amount: 3000,
    operatingCosts: 0,
    designation: 'sadaqah',
    frequency: 'monthly',
    status: 'past_due',
    startDate: new Date(Date.now() - 60 * 86_400_000),
    nextChargeAt: new Date(Date.now() - 2 * 86_400_000),
    failure: { count: 1, lastError: 'Your card was declined.', nextRetryAt: new Date(Date.now() + 2 * 86_400_000), firstFailedAt: new Date() },
    payment: { method: 'card', brand: 'Visa', last4: '0002', stripeCustomer: 'cus_cu', stripePaymentMethod: 'pm_old' },
  })
}

function stubStripe(pmId: string, piId: string) {
  s.setupIntents.retrieve = vi.fn().mockResolvedValue({
    id: `seti_${pmId}`, customer: 'cus_cu',
    payment_method: { id: pmId, customer: 'cus_cu', card: { brand: 'mastercard', last4: '4444', exp_month: 5, exp_year: 2032 } },
  })
  s.paymentMethods.attach = vi.fn().mockResolvedValue({})
  s.customers.create = vi.fn().mockResolvedValue({ id: 'cus_new' })
  s.paymentIntents.create = vi.fn().mockResolvedValue({ id: piId, status: 'succeeded' })
}

const session = (planId: string, pmTag: string) => ({
  id: `cs_cu_${pmTag}`, object: 'checkout.session', mode: 'setup', setup_intent: `seti_${pmTag}`, customer: 'cus_cu',
  metadata: { purpose: 'card-update', planId },
})

/** the retry runs just after the 200; wait for it to land */
async function settled(planId: unknown) {
  for (let i = 0; i < 60; i++) {
    const p = await models.Plan.findById(planId).lean()
    if (p?.status === 'active' && !p.chargingAt) return p
    await new Promise((r) => setTimeout(r, 50))
  }
  return models.Plan.findById(planId).lean()
}

const cardLines = (planId: Types.ObjectId) => models.AuditEvent.countDocuments({ action: 'plan.card', 'entity.id': planId })
const paid = (planId: Types.ObjectId) => models.Gift.countDocuments({ plan: planId, status: 'succeeded' })

describe('a donor’s new card, from Stripe', () => {
  it('delivered twice: the card is set once, the failing plan is charged once and is active again', async () => {
    const plan = await failingPlan('a')
    stubStripe('pm_new_a', 'pi_cu_a')
    const e = event(session(plan.id, 'pm_new_a'))

    expect((await deliver(e)).status).toBe(200)
    expect((await deliver(e)).status).toBe(200)

    const p = (await settled(plan._id))!
    expect(p.status).toBe('active')
    expect(p.payment?.stripePaymentMethod).toBe('pm_new_a')
    expect(p.payment?.last4).toBe('4444')
    expect(p.failure?.count ?? 0).toBe(0)
    expect(await paid(plan._id)).toBe(1)
    expect(s.paymentIntents.create).toHaveBeenCalledTimes(1)
    expect(await cardLines(plan._id)).toBe(1)
  })

  /* Two deliveries at the same moment both see the old card; onCardUpdated
     claims the change with a conditional write before touching Stripe, so only
     one goes on to create the customer, log and retry (this test found that it
     used to do all three twice). */
  it('delivered twice at the same moment: one log line as well as one payment', async () => {
    const plan = await failingPlan('b')
    stubStripe('pm_new_b', 'pi_cu_b')
    const e = event(session(plan.id, 'pm_new_b'))

    const [r1, r2] = await Promise.all([deliver(e), deliver(e)])
    expect([r1.status, r2.status]).toEqual([200, 200])

    const p = (await settled(plan._id))!
    expect(p.status).toBe('active')
    expect(p.payment?.stripePaymentMethod).toBe('pm_new_b')
    expect(await paid(plan._id)).toBe(1)
    expect(await cardLines(plan._id)).toBe(1)
  })

  it('delivered twice at the same moment: the payment is still taken once', async () => {
    const plan = await failingPlan('c')
    stubStripe('pm_new_c', 'pi_cu_c')
    const e = event(session(plan.id, 'pm_new_c'))
    await Promise.all([deliver(e), deliver(e)])
    const p = (await settled(plan._id))!
    expect(p.status).toBe('active')
    expect(await paid(plan._id)).toBe(1)
    expect(s.paymentIntents.create.mock.calls.length).toBeLessThanOrEqual(2)
    /* same idempotency key if it was asked twice: Stripe returns one payment */
    const keys = new Set(s.paymentIntents.create.mock.calls.map((c: unknown[]) => (c[1] as { idempotencyKey: string }).idempotencyKey))
    expect(keys.size).toBe(1)
  })
})
