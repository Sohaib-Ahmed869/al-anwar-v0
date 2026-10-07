import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startApi, type Api } from '../helpers/server'
import { STAFF_BY_ROLE } from '../helpers/fixtures'

/* ---------------------------------------------------------------------------
   Taking regular payments (server/lib/plans.ts), with payments simulated.

     the same plan charged from three places at once     one payment (M7)
     two plans charged on the same day                   two payments: the
                                                         simulated ids differ
     "Retry now" on a plan that is not due yet            refused
     a simulated charge                                   a simulated gift
--------------------------------------------------------------------------- */

let api: Api
let models: typeof import('../../server/models')
let plans: typeof import('../../server/lib/plans')

beforeAll(async () => {
  api = await startApi({ seed: 'demo' })
  models = await import('../../server/models')
  plans = await import('../../server/lib/plans')
})
afterAll(() => api?.stop())

const used: unknown[] = []
/** an active plan on a card that goes through, due now — a different one
 *  each call, so no two tests share a plan's payment for today */
async function duePlan() {
  const { Plan } = models
  const p = (await Plan.findOne({ _id: { $nin: used }, status: 'active', 'payment.last4': { $nin: ['0002', '9995', '0069', '0119'] }, chargingAt: null, kind: 'recurring' }))!
  used.push(p._id)
  await Plan.updateOne({ _id: p._id }, { $set: { nextChargeAt: new Date(Date.now() - 60_000) } })
  return (await Plan.findById(p._id))!
}

describe('one payment at a time (M7)', () => {
  it('three overlapping charges on one plan take one payment', async () => {
    const { Gift, Plan } = models
    const p = await duePlan()
    const before = await Gift.countDocuments({ plan: p._id })
    const results = await Promise.all([plans.chargePlan(p), plans.chargePlan(p), plans.chargePlan(p)])
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(results.filter((r) => !r.ok && r.busy)).toHaveLength(2)
    expect(await Gift.countDocuments({ plan: p._id })).toBe(before + 1)
    const after = (await Plan.findById(p._id).lean())!
    expect(after.chargingAt).toBeFalsy()
    expect(after.nextChargeAt!.getTime()).toBeGreaterThan(Date.now())
    expect(after.collected).toBe(p.collected + p.amount)
  })

  it('a claim left behind by a crash is taken over after ten minutes', async () => {
    const { Plan } = models
    const p = await duePlan()
    await Plan.updateOne({ _id: p._id }, { $set: { chargingAt: new Date(Date.now() - 60_000) } })
    expect((await plans.chargePlan(p)).ok).toBe(false)
    await Plan.updateOne({ _id: p._id }, { $set: { chargingAt: new Date(Date.now() - 11 * 60_000) } })
    expect((await plans.chargePlan(p)).ok).toBe(true)
  })

  it('two plans charged on the same day are two payments, each marked simulated', async () => {
    const { Gift } = models
    const a = await duePlan()
    const b = await duePlan()
    expect((await plans.chargePlan(a)).ok).toBe(true)
    expect((await plans.chargePlan(b)).ok).toBe(true)
    const [ga, gb] = await Promise.all([
      Gift.findOne({ plan: a._id }).sort({ createdAt: -1 }).lean(),
      Gift.findOne({ plan: b._id }).sort({ createdAt: -1 }).lean(),
    ])
    expect(ga!.external?.stripe).toMatch(/^sim_pi_/)
    expect(ga!.external?.stripe).not.toBe(gb!.external?.stripe)
    expect(ga!.simulated).toBe(true)
    expect(ga!.receipt?.number).toMatch(/^SIM-/)
  })
})

describe('a payment that was already taken', () => {
  it('moving the date back to one already paid takes and records nothing new', async () => {
    const { Gift, Plan } = models
    const p = await duePlan()
    const due = p.nextChargeAt!
    expect((await plans.chargePlan(p)).ok).toBe(true)
    const count = await Gift.countDocuments({ plan: p._id })
    const collected = (await Plan.findById(p._id).lean())!.collected
    await Plan.updateOne({ _id: p._id }, { $set: { nextChargeAt: due } })
    expect((await plans.chargePlan((await Plan.findById(p._id))!)).ok).toBe(true)
    expect(await Gift.countDocuments({ plan: p._id })).toBe(count)
    const after = (await Plan.findById(p._id).lean())!
    expect(after.collected).toBe(collected)
    expect(after.nextChargeAt!.getTime()).toBeGreaterThan(Date.now())
    expect(await models.AuditEvent.exists({ action: 'plan.replayed', 'entity.id': p._id })).toBeTruthy()
  })
})

describe('"Retry now" in the admin', () => {
  it('is refused on an active plan whose payment is not due yet', async () => {
    const { Plan } = models
    const p = (await Plan.findOne({ status: 'active', nextChargeAt: { $gt: new Date(Date.now() + 86_400_000) } }).lean())!
    const owner = await api.staff(STAFF_BY_ROLE.owner)
    const res = await owner.post(`/api/admin/plans/${p._id}/retry`, {})
    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(/not due/)
  })

  it('takes a failing plan’s payment', async () => {
    const { Plan } = models
    const p = await duePlan()
    await Plan.updateOne({ _id: p._id }, { $set: { status: 'past_due', 'failure.count': 1, 'failure.nextRetryAt': new Date(Date.now() + 86_400_000) } })
    const owner = await api.staff(STAFF_BY_ROLE.owner)
    const res = await owner.post(`/api/admin/plans/${p._id}/retry`, {})
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.plan.status).toBe('active')
  })
})
