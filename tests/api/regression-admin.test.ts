import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startApi, type Api } from '../helpers/server'
import type { Client } from '../helpers/client'
import { STAFF_BY_ROLE, freshEmail } from '../helpers/fixtures'
import { checkout } from '../helpers/giving'

/* ---------------------------------------------------------------------------
   The admin portal's everyday work, against the demo data, through the API
   the portal itself calls:

     offline gift entry · appeals · enquiries · staff invites and the owner
     rule · settings · income report, receipts and the Xero file · a campaign
     sent to a small audience · fundraiser approval · a bank statement
     imported, matched to a website pledge, and confirmed

   And one rule over all of them (CLAUDE.md "Audit every change"): every
   mutation leaves a row in the action log. `audited()` counts AuditEvent rows
   either side of a call.
--------------------------------------------------------------------------- */

let api: Api
let owner: Client
let admin: Client

beforeAll(async () => {
  api = await startApi({ seed: 'demo' })
  owner = await api.staff(STAFF_BY_ROLE.owner)
  admin = await api.staff(STAFF_BY_ROLE.admin)
})
afterAll(() => api?.stop())

async function audited<T>(fn: () => Promise<T>): Promise<T> {
  const { AuditEvent } = await import('../../server/models')
  const before = await AuditEvent.countDocuments()
  const out = await fn()
  expect(await AuditEvent.countDocuments(), 'the change is in the action log').toBeGreaterThan(before)
  return out
}

const today = () => {
  const d = new Date()
  /* the server dates gifts in Sydney; yesterday is safe in any zone */
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

describe('offline gift entry', () => {
  it('records a cash gift for a new donor, with a receipt', async () => {
    const res = await audited(() =>
      owner.post('/api/admin/gifts/offline', {
        newDonor: { firstName: 'Event', lastName: 'Giver', email: freshEmail('event') },
        amount: 2500,
        method: 'cash',
        designation: 'sadaqah',
        date: today(),
        sendReceipt: true,
      }),
    )
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.donorCreated).toBe(true)
    expect(res.body.gift.status).toBe('succeeded')
    expect(res.body.gift.amount).toBe(2500)
    expect(res.body.gift.receipt?.number).toMatch(/\d/)

    const listed = await owner.get(`/api/admin/gifts/${res.body.gift.id}`)
    expect(listed.status).toBe(200)
  })

  it('refuses a date in the future and a missing donor', async () => {
    const next = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
    const future = await owner.post('/api/admin/gifts/offline', {
      newDonor: { firstName: 'A' }, amount: 100, method: 'cash', designation: 'sadaqah', date: next,
    })
    expect(future.status).toBe(400)
    expect(future.body.error.fields.date).toBeTruthy()
    const nobody = await owner.post('/api/admin/gifts/offline', { amount: 100, method: 'cash', designation: 'sadaqah', date: today() })
    expect(nobody.status).toBe(400)
  })
})

describe('appeals', () => {
  it('creates and edits an appeal', async () => {
    const created = await audited(() =>
      owner.post('/api/admin/appeals', { title: 'Regression test appeal', country: 'yemen', summary: 'For the tests.', target: 100000 }),
    )
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const id = created.body.id
    const edited = await audited(() => owner.patch(`/api/admin/appeals/${id}`, { summary: 'Edited by the tests.' }))
    expect(edited.status, JSON.stringify(edited.body)).toBe(200)
    const read = await owner.get(`/api/admin/appeals/${id}`)
    expect(read.body.appeal.summary).toBe('Edited by the tests.')
  })
})

describe('enquiries', () => {
  it('a message from the site lands in the inbox and can be closed', async () => {
    const sent = await api.client().post('/api/public/enquiries', {
      type: 'contact', name: 'Regression Tester', email: freshEmail('enq'), subject: 'Hello', message: 'A question from the tests.',
    })
    expect(sent.status).toBe(200)
    const inbox = await owner.get('/api/admin/enquiries?pageSize=100')
    const e = inbox.body.items.find((x: { id: string }) => x.id === sent.body.id)
    expect(e, 'the enquiry is in the inbox').toBeTruthy()
    const done = await audited(() => owner.patch(`/api/admin/enquiries/${e.id}`, { status: 'closed' }))
    expect(done.status, JSON.stringify(done.body)).toBe(200)
  })
})

describe('staff', () => {
  it('the owner invites a new member of staff', async () => {
    const res = await audited(() => owner.post('/api/admin/staff/invite', { name: 'New Person', email: freshEmail('staff'), role: 'fundraising' }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.passwordSet).toBe(false)
    expect(res.body.passwordHash).toBeUndefined()
    expect(res.body.tokenHash).toBeUndefined()
  })

  it('an admin cannot add or change an owner', async () => {
    const invite = await admin.post('/api/admin/staff/invite', { name: 'Would Be Owner', email: freshEmail('owner'), role: 'owner' })
    expect(invite.status).toBe(403)
    const list = await admin.get('/api/admin/staff')
    const theOwner = list.body.items.find((s: { email: string }) => s.email === STAFF_BY_ROLE.owner)
    const demote = await admin.patch(`/api/admin/staff/${theOwner.id}`, { role: 'volunteer' })
    expect(demote.status).toBe(403)
    const off = await admin.post(`/api/admin/staff/${theOwner.id}/deactivate`)
    expect(off.status).toBe(403)
  })
})

describe('settings', () => {
  it('reads and updates a section', async () => {
    const s = await owner.get('/api/admin/settings')
    expect(s.status).toBe(200)
    expect(s.body.org.name).toBeTruthy()
    const res = await audited(() => owner.put('/api/admin/settings/org', { ...s.body.org, phone: '02 9000 0000' }))
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.org.phone).toBe('02 9000 0000')
  })

  it('refuses a section that does not exist', async () => {
    expect((await owner.put('/api/admin/settings/nonsense', {})).status).toBe(400)
  })
})

describe('reports and exports', () => {
  const from = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10)

  it('income report has totals and a monthly series', async () => {
    const res = await owner.get(`/api/admin/reports/income?from=${from}`)
    expect(res.status).toBe(200)
    expect(res.body.totals.count).toBeGreaterThan(0)
    expect(Array.isArray(res.body.series)).toBe(true)
  })

  it('the Xero file is a CSV with Xero’s own header, and the export is logged', async () => {
    const res = await audited(() => owner.get(`/api/admin/reports/xero?from=${from}`))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/csv/)
    const [header, first] = res.text.split(/\r?\n/)
    expect(header).toBe('*Date,*Amount,Payee,Description,Reference,Check Number,Account Code,Tax Type,Tracking Name 1,Tracking Option 1')
    expect(first).toBeTruthy()
  })

  it('receipts CSV downloads', async () => {
    const res = await owner.get(`/api/admin/reports/receipts.csv?from=${from}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toMatch(/attachment/)
  })

  it('an invalid date is a 400, not a crash', async () => {
    expect((await owner.get('/api/admin/reports/income?from=yesterday')).status).toBe(400)
  })
})

describe('campaigns', () => {
  it('sends to a small audience; sent + failed equals recipients', async () => {
    const { processCampaignQueue } = await import('../../server/jobs/campaigns')
    const { Campaign } = await import('../../server/models')

    const created = await audited(() =>
      owner.post('/api/admin/campaigns', {
        name: 'Regression campaign',
        subject: 'A short note',
        body: 'Salaam {{firstName}}, a short note from the regression tests.',
        segment: { minTotal: 500_000 },
      }),
    )
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const id = created.body.id

    const sent = await audited(() => owner.post(`/api/admin/campaigns/${id}/send`))
    expect(sent.status, JSON.stringify(sent.body)).toBe(200)

    /* the send route starts the first batch itself, in the background; a run
       already in progress makes processCampaignQueue() return at once, so
       keep nudging it until the campaign is done */
    const until = Date.now() + 20_000
    while (Date.now() < until) {
      const c = await Campaign.findById(id).lean()
      if (c!.status === 'sent') break
      await processCampaignQueue()
      await new Promise((r) => setTimeout(r, 100))
    }
    const done = await Campaign.findById(id).lean()
    expect(done!.status).toBe('sent')
    const st = done!.stats as { recipients: number; sent: number; failed: number }
    expect(st.recipients).toBeGreaterThan(0)
    expect(st.sent + st.failed).toBe(st.recipients)

    /* a sent campaign can't be sent again */
    expect((await owner.post(`/api/admin/campaigns/${id}/send`)).status).toBe(400)
  })
})

describe('supporter fundraisers', () => {
  it('approving a pending page puts it on the public site', async () => {
    const list = await owner.get('/api/admin/fundraisers?status=pending')
    expect(list.status).toBe(200)
    const pending = list.body.items[0]
    expect(pending, 'the seed has a pending fundraiser').toBeTruthy()

    const before = await api.client().get('/api/public/fundraisers')
    expect(before.body.items.map((f: { slug: string }) => f.slug)).not.toContain(pending.slug)

    const res = await audited(() => owner.post(`/api/admin/fundraisers/${pending.id}/review`, { decision: 'live' }))
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.status).toBe('live')

    const after = await api.client().get('/api/public/fundraisers')
    expect(after.body.items.map((f: { slug: string }) => f.slug)).toContain(pending.slug)
  })

  it('asking for changes needs a note', async () => {
    const list = await owner.get('/api/admin/fundraisers?status=pending')
    const pending = list.body.items[0]
    if (!pending) return
    const res = await owner.post(`/api/admin/fundraisers/${pending.id}/review`, { decision: 'changes' })
    expect(res.status).toBe(400)
  })
})

describe('bank statement import', () => {
  it('matches a website pledge by its reference and turns it into a receipted gift', async () => {
    const pledge = await checkout(api, { provider: 'bank', amount: 180 })
    const day = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Australia/Sydney' })
    const csv = ['Date,Amount,Description', `${day},180.00,TRANSFER FROM T DONOR ${pledge.reference}`].join('\n')

    const form = new FormData()
    form.append('file', new Blob([csv], { type: 'text/csv' }), `statement-${Date.now()}.csv`)
    const imported = await audited(() => owner.request('POST', '/api/admin/bank/imports', undefined, { raw: form }))
    expect(imported.status, JSON.stringify(imported.body)).toBe(201)

    const line = imported.body.lines?.[0] ?? imported.body.import?.lines?.[0]
    expect(line, JSON.stringify(imported.body).slice(0, 400)).toBeTruthy()
    expect(line.status).toBe('matched')

    const id = imported.body.id ?? imported.body.import?.id
    const confirmed = await audited(() => owner.post(`/api/admin/bank/imports/${id}/confirm`, {}))
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200)

    const { Gift } = await import('../../server/models')
    const g = await Gift.findById(pledge.giftId).lean()
    expect(g!.status).toBe('succeeded')
    expect(g!.receipt?.number).toMatch(/\d/)
  })

  it('refuses a file that is not a statement', async () => {
    const form = new FormData()
    form.append('file', new Blob(['hello'], { type: 'image/png' }), 'photo.png')
    const res = await owner.request('POST', '/api/admin/bank/imports', undefined, { raw: form })
    expect(res.status).toBe(400)
  })
})

describe('the action log', () => {
  it('lists events and exports them', async () => {
    const res = await owner.get('/api/admin/activity')
    expect(res.status).toBe(200)
    expect(res.body.items.length).toBeGreaterThan(0)
    const csv = await owner.get('/api/admin/activity/export')
    expect(csv.status).toBe(200)
  })
})
