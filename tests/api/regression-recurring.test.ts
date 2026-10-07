import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Types } from 'mongoose'
import { RETRY_SCHEDULE_DAYS } from '../../shared/domain'
import { startApi, type Api } from '../helpers/server'
import { freshEmail } from '../helpers/fixtures'

/* ---------------------------------------------------------------------------
   The recurring engine (server/jobs/recurring.ts, server/lib/plans.ts) the way
   the findings report's "Tests to add" asks for it, with simulated payments
   (no Stripe key): a card ending 0002 is declined, anything else goes through.

     a declining card, every retry, to the last attempt   one failed gift and
                                                          one email per attempt;
                                                          "has stopped" on the
                                                          last; never again
     a paused plan whose pause has ended                  resumes, no back-charge
     a plan three months behind (the server was down)     charged once, not three
     two runs at the same moment                          one gift per plan

   chargePlan() decides "due" from the real clock (its claim compares with
   new Date()), not from the `now` a run is given, so "time passing" here is
   the plan's dates being moved into the past, not `now` moved forward.
--------------------------------------------------------------------------- */

let api: Api
let models: typeof import('../../server/models')
let recurring: typeof import('../../server/jobs/recurring')
let giving: typeof import('../../server/lib/giving')

beforeAll(async () => {
  api = await startApi({ seed: 'demo' })
  models = await import('../../server/models')
  recurring = await import('../../server/jobs/recurring')
  giving = await import('../../server/lib/giving')
})
afterAll(() => api?.stop())

const DAY = 86_400_000
const ago = (ms: number) => new Date(Date.now() - ms)

/** a fresh donor (so their emails can be counted alone) with a monthly plan */
async function planFor(over: Record<string, unknown> = {}, last4 = '4242') {
  const { donor } = await giving.findOrCreateDonor({ email: freshEmail('plan'), firstName: 'Rania', lastName: 'Test' })
  const plan = await models.Plan.create({
    number: `P-T${Math.random().toString(36).slice(2, 9)}`,
    donor: donor._id,
    donorName: 'Rania Test',
    amount: 2500,
    operatingCosts: 0,
    designation: 'sadaqah',
    frequency: 'monthly',
    status: 'active',
    startDate: ago(40 * DAY),
    nextChargeAt: ago(60_000),
    failure: { count: 0 },
    payment: { method: 'card', brand: 'Visa', last4, expMonth: 12, expYear: new Date().getFullYear() + 3 },
    ...over,
  })
  return { plan, donor }
}

const gifts = (plan: Types.ObjectId, status: string) => models.Gift.countDocuments({ plan, status })
const failedEmails = (donor: Types.ObjectId) =>
  models.EmailMessage.find({ donor, template: 'plan.failed' }).sort({ createdAt: 1 }).select('subject').lean()

describe('a card that keeps declining', () => {
  it('is retried on schedule to the last attempt, then stops — and is never charged again', async () => {
    const { plan, donor } = await planFor({}, '0002')
    const attempts = RETRY_SCHEDULE_DAYS.length + 1

    for (let i = 1; i <= attempts; i++) {
      await recurring.processDuePlans(new Date())
      const p = (await models.Plan.findById(plan._id).lean())!
      expect(p.failure?.count, `attempt ${i}`).toBe(i)
      expect(p.status).toBe('past_due')
      expect(await gifts(plan._id, 'failed')).toBe(i)

      const mails = await failedEmails(donor._id)
      expect(mails).toHaveLength(i)
      expect(mails[i - 1].subject).toBe(i < attempts ? 'Your regular donation did not go through' : 'Your regular donation has stopped')

      /* running again before the retry date charges nothing */
      await recurring.processDuePlans(new Date())
      expect(await gifts(plan._id, 'failed')).toBe(i)

      if (i < attempts) {
        expect(p.failure?.nextRetryAt).toBeTruthy()
        /* the retry date arrives */
        await models.Plan.updateOne({ _id: plan._id }, { $set: { 'failure.nextRetryAt': ago(60_000) } })
      } else {
        /* the last attempt: no retry date, and the plan stays past_due
           (the donor never cancelled it; a new card brings it back) */
        expect(p.failure?.nextRetryAt ?? null).toBeNull()
      }
    }

    /* weeks later, nothing more is tried */
    await models.Plan.updateOne({ _id: plan._id }, { $set: { nextChargeAt: ago(DAY) } })
    await recurring.processDuePlans(new Date())
    await recurring.processDuePlans(new Date())
    expect(await gifts(plan._id, 'failed')).toBe(attempts)
    expect(await gifts(plan._id, 'succeeded')).toBe(0)
    expect(await failedEmails(donor._id)).toHaveLength(attempts)
  })
})

describe('a paused plan', () => {
  it('resumes when its pause ends, on a date in the future, without charging for the months it was paused', async () => {
    const { plan } = await planFor({ status: 'paused', pausedUntil: ago(60_000), nextChargeAt: ago(80 * DAY) })
    const summary = await recurring.processDuePlans(new Date())
    expect(summary.resumed).toBeGreaterThanOrEqual(1)

    const p = (await models.Plan.findById(plan._id).lean())!
    expect(p.status).toBe('active')
    expect(p.pausedUntil ?? null).toBeNull()
    expect(p.nextChargeAt!.getTime()).toBeGreaterThan(Date.now())
    expect(await gifts(plan._id, 'succeeded')).toBe(0)
    expect(await models.AuditEvent.countDocuments({ action: 'plan.resume', 'entity.id': plan._id })).toBe(1)

    /* a second run finds nothing to resume and nothing due */
    await recurring.processDuePlans(new Date())
    expect(await models.AuditEvent.countDocuments({ action: 'plan.resume', 'entity.id': plan._id })).toBe(1)
    expect(await gifts(plan._id, 'succeeded')).toBe(0)
  })
})

describe('after downtime', () => {
  it('a plan three months behind is charged once, not three times, and moves into the future', async () => {
    const { plan } = await planFor({ nextChargeAt: ago(92 * DAY) })
    await recurring.processDuePlans(new Date())
    expect(await gifts(plan._id, 'succeeded')).toBe(1)
    const p = (await models.Plan.findById(plan._id).lean())!
    expect(p.nextChargeAt!.getTime()).toBeGreaterThan(Date.now())

    await recurring.processDuePlans(new Date())
    expect(await gifts(plan._id, 'succeeded')).toBe(1)
  })
})

describe('two runs at the same moment', () => {
  it('charge each due plan once', async () => {
    const made = await Promise.all([planFor(), planFor(), planFor()])
    await Promise.all([recurring.processDuePlans(new Date()), recurring.processDuePlans(new Date())])
    for (const { plan } of made) {
      expect(await gifts(plan._id, 'succeeded')).toBe(1)
      expect(await gifts(plan._id, 'failed')).toBe(0)
      const p = (await models.Plan.findById(plan._id).lean())!
      expect(p.collected).toBe(2500)
      expect(p.nextChargeAt!.getTime()).toBeGreaterThan(Date.now())
    }
  })
})
