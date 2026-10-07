import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Types } from 'mongoose'
import { startApi, type Api } from '../helpers/server'
import { freshEmail } from '../helpers/fixtures'

/* ---------------------------------------------------------------------------
   A campaign sending in batches of 50 (server/jobs/campaigns.ts), and a
   recipient who unsubscribes between batches — with the link in an email
   they already had, through the real route (server/routes/unsubscribe.ts):

     - they are not emailed by a later batch;
     - sent + failed adds up to the recipients, who are counted without them;
     - the unsubscribe is on their record and in the audit trail.
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

const RECIPIENTS = 70 /* more than one batch of 50 */

describe('an unsubscribe partway through a send', () => {
  it('is honoured by the next batch, and the numbers still add up', async () => {
    const { Campaign, Donor, EmailMessage, AuditEvent } = models
    const ids: Types.ObjectId[] = []
    for (let i = 0; i < RECIPIENTS; i++) {
      const { donor } = await giving.findOrCreateDonor({ email: freshEmail(`camp${i}`), firstName: `Reader${i}`, lastName: 'Test' })
      await Donor.updateOne({ _id: donor._id }, { $set: { 'preferences.emailOptIn': true, unsubscribeToken: `tok${i}x${Date.now().toString(36)}xxxxxxxxxxxxxxxx` } })
      ids.push(donor._id)
    }
    const c = await Campaign.create({
      name: 'unsubscribe partway',
      subject: 'News from the field',
      body: 'A campaign body that is long enough to send.',
      status: 'sending',
      queue: ids,
      segment: {},
      stats: { recipients: RECIPIENTS, sent: 0, failed: 0 },
    })

    const { processCampaignQueue } = await import('../../server/jobs/campaigns')

    /* the first batch */
    await processCampaignQueue()
    const sentTo = () => EmailMessage.find({ campaign: c._id }).select('donor').lean()
    expect(await sentTo()).toHaveLength(50)

    /* someone still in the queue unsubscribes, from an earlier email's link */
    const leaving = (await Donor.findById(ids[60]).select('+unsubscribeToken').lean())!
    const t = (leaving as { unsubscribeToken?: string }).unsubscribeToken!
    const res = await api.client().post(`/api/public/unsubscribe/one-click?t=${encodeURIComponent(t)}`, undefined, { csrf: false })
    expect(res.status).toBeLessThan(400)
    expect((await Donor.findById(ids[60]).lean())!.preferences?.emailOptIn).toBe(false)

    /* the rest */
    for (let i = 0; i < 5; i++) {
      const doc = await Campaign.findById(c._id).lean()
      if (doc!.status !== 'sending') break
      await processCampaignQueue()
    }

    const done = (await Campaign.findById(c._id).lean<{ status: string; stats: { sent: number; failed: number; recipients: number } }>())!
    expect(done.status).toBe('sent')
    const mails = await sentTo()
    expect(mails.map((m) => String(m.donor))).not.toContain(String(ids[60]))
    expect(mails).toHaveLength(RECIPIENTS - 1)
    expect(done.stats.recipients).toBe(RECIPIENTS - 1)
    expect(done.stats.sent + done.stats.failed).toBe(done.stats.recipients)
    expect(await AuditEvent.countDocuments({ action: 'donor.unsubscribe', 'entity.id': ids[60] })).toBe(1)
  })
})
