import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Types } from 'mongoose'
import { startApi, type Api } from '../helpers/server'

/* Background jobs with more than one runner (SECURITY FINDING M8), and the
   retention job (M18):
   - the lease: two processes asking at once, exactly one gets it; it can be
     taken over once it runs out, and not before;
   - a campaign's batches: several runners at once still email every
     recipient exactly once, and sent + failed adds up to recipients;
   - startSending only starts a campaign once;
   - retention trims old email bodies and deletes old closed enquiries;
   - a gift at 9am on 1 July in Sydney gets the new financial year's receipt
     number (H5, end to end through recordGift). */

let api: Api
beforeAll(async () => {
  api = await startApi({ seed: 'demo' })
})
afterAll(() => api?.stop())

describe('the jobs lease', () => {
  it('two processes asking at once: exactly one holds it', async () => {
    const { acquireLease } = await import('../../server/models/JobLease')
    const got = await Promise.all(['a', 'b', 'c', 'd'].map((o) => acquireLease(`proc-${o}`, 60_000, 'test-lease')))
    expect(got.filter(Boolean)).toHaveLength(1)
  })

  it('the holder renews; others wait until it runs out, then one takes over', async () => {
    const { acquireLease, releaseLease, JobLease } = await import('../../server/models/JobLease')
    expect(await acquireLease('one', 60_000, 'lease-2')).toBe(true)
    expect(await acquireLease('one', 60_000, 'lease-2')).toBe(true)
    expect(await acquireLease('two', 60_000, 'lease-2')).toBe(false)
    /* the holder dies: its lease runs out */
    await JobLease.updateOne({ _id: 'lease-2' }, { $set: { until: new Date(Date.now() - 1) } })
    expect(await acquireLease('two', 60_000, 'lease-2')).toBe(true)
    expect(await acquireLease('one', 60_000, 'lease-2')).toBe(false)
    await releaseLease('two', 'lease-2')
    expect(await acquireLease('one', 60_000, 'lease-2')).toBe(true)
  })
})

describe('campaign batches under concurrency', () => {
  it('several runners claiming at once never take the same donor twice', async () => {
    const { Campaign } = await import('../../server/models')
    const { claimBatch } = await import('../../server/jobs/campaigns')
    const ids = Array.from({ length: 237 }, () => new Types.ObjectId())
    const c = await Campaign.create({ name: 'claim test', subject: 's', body: 'b'.repeat(30), status: 'sending', queue: ids, segment: {} })
    const taken: string[] = []
    for (;;) {
      const round = await Promise.all(Array.from({ length: 4 }, () => claimBatch(c._id)))
      const got = round.flatMap((b) => b?.ids ?? []).map(String)
      if (!got.length) break
      taken.push(...got)
    }
    expect(taken).toHaveLength(237)
    expect(new Set(taken).size).toBe(237)
  })

  it('a whole send, with two queue runs racing, emails each recipient once and the numbers add up', async () => {
    const { Campaign, Donor, EmailMessage } = await import('../../server/models')
    const { startSending } = await import('../../server/lib/segments')
    const { claimBatch } = await import('../../server/jobs/campaigns')
    const c = await Campaign.create({ name: 'race test', subject: 'Hello {{firstName}}', body: 'A campaign body that is long enough to send.', status: 'draft', segment: {} })

    const [a, b] = await Promise.all([startSending(c._id, {}), startSending(c._id, {})])
    /* only one of the two starts it */
    expect([a, b].filter((n) => n !== null)).toHaveLength(1)
    const recipients = (a ?? b)!
    expect(recipients).toBeGreaterThan(0)

    /* processCampaignQueue keeps a per-process flag, so to race two
       "processes" here, run its batch step directly from both sides */
    const mod = await import('../../server/jobs/campaigns')
    const runner = async () => {
      for (;;) {
        const doc = await Campaign.findById(c._id).lean<{ status: string }>()
        if (doc!.status !== 'sending') return
        await mod.processCampaignQueue()
        await new Promise((r) => setTimeout(r, 5))
      }
    }
    await Promise.all([runner(), runner(), (async () => void (await claimBatch(new Types.ObjectId())))()])

    const done = await Campaign.findById(c._id).lean<{ status: string; stats: { sent: number; failed: number; recipients: number } }>()
    expect(done!.status).toBe('sent')
    expect(done!.stats.sent + done!.stats.failed).toBe(done!.stats.recipients)
    const mails = await EmailMessage.find({ campaign: c._id }).select('to').lean<{ to: string }[]>()
    expect(new Set(mails.map((m) => m.to)).size).toBe(mails.length)
    expect(mails.length).toBe(done!.stats.sent + done!.stats.failed)
    expect(await Donor.countDocuments({})).toBeGreaterThan(0)
  })
})

describe('retention (M18)', () => {
  it('trims email bodies after 90 days and deletes enquiries closed two years ago', async () => {
    const { EmailMessage, Enquiry } = await import('../../server/models')
    const { runRetention, REMOVED_HTML } = await import('../../server/jobs/retention')
    const old = new Date(Date.now() - 100 * 86_400_000)
    const oldMail = await EmailMessage.create({ to: 'x@example.com', subject: 'Receipt', template: 'receipt', html: '<p>Amina, 12 Smith St</p>', text: 'Amina', transport: 'outbox', status: 'sent', createdAt: old })
    const newMail = await EmailMessage.create({ to: 'y@example.com', subject: 'Receipt', template: 'receipt', html: '<p>keep</p>', transport: 'outbox', status: 'sent' })
    const ancient = new Date(Date.now() - 800 * 86_400_000)
    const closedOld = await Enquiry.create({ type: 'contact', status: 'closed', name: 'Old', email: 'old@example.com', message: 'hi' })
    await Enquiry.collection.updateOne({ _id: closedOld._id }, { $set: { updatedAt: ancient } })
    const openOld = await Enquiry.create({ type: 'contact', status: 'open', name: 'Open', email: 'open@example.com', message: 'hi' })
    await Enquiry.collection.updateOne({ _id: openOld._id }, { $set: { updatedAt: ancient } })

    const r = await runRetention()
    expect(r.emailsTrimmed).toBeGreaterThanOrEqual(1)
    const trimmed = await EmailMessage.findById(oldMail._id).lean<{ html: string; text?: string; to: string; contentRemovedAt?: Date }>()
    expect(trimmed!.html).toBe(REMOVED_HTML)
    expect(trimmed!.text).toBeUndefined()
    expect(trimmed!.to).toBe('x@example.com')
    expect(trimmed!.contentRemovedAt).toBeTruthy()
    expect((await EmailMessage.findById(newMail._id).lean<{ html: string }>())!.html).toBe('<p>keep</p>')
    expect(await Enquiry.exists({ _id: closedOld._id })).toBeNull()
    expect(await Enquiry.exists({ _id: openOld._id })).toBeTruthy()

    /* and running it again changes nothing */
    const again = await runRetention()
    expect(again.emailsTrimmed).toBe(0)
    expect(again.enquiriesDeleted).toBe(0)
  })
})

describe('the financial year of a receipt (H5)', () => {
  it('a gift at 9am on 1 July in Sydney is numbered in the new year', async () => {
    const { Donor } = await import('../../server/models')
    const { recordGift } = await import('../../server/lib/giving')
    const donor = await Donor.findOne({ email: 'amina.rahman@example.com' })
    /* 9am AEST on 1 July 2026 is 23:00 UTC on 30 June */
    const gift = await recordGift({
      donor: donor!, amount: 5000, designation: 'sadaqah', method: 'cash', source: 'offline',
      date: new Date('2026-06-30T23:00:00Z'), sendReceipt: false,
    })
    expect(gift.receipt?.number).toMatch(/-2027-\d{6}$/)

    const before = await recordGift({
      donor: donor!, amount: 5000, designation: 'sadaqah', method: 'cash', source: 'offline',
      date: new Date('2026-06-30T13:59:00Z'), sendReceipt: false,
    })
    expect(before.receipt?.number).toMatch(/-2026-\d{6}$/)
  })
})
