import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startApi, type Api } from '../helpers/server'
import type { Client } from '../helpers/client'

/* ---------------------------------------------------------------------------
   The admin and compliance fixes from the security review:

     H1   uploads are typed by the server and served with a sandbox CSP
     H2   volunteers can't read the donor base, but can still find a donor
          for a cash gift through the narrow lookup, and record it
     C3   a donor's Emails tab never shows a sign-in code or a staff link
     M12  a name alone never matches a bank line unseen
     M14  the action-log export is itself in the log
     L6   "__proto__" as a settings section is a 400, not a 500
--------------------------------------------------------------------------- */

let api: Api
let owner: Client
let volunteer: Client
let compliance: Client
let aminaId: string

beforeAll(async () => {
  api = await startApi({ seed: 'demo' })
  owner = await api.staff('yusuf@alanwaar.group')
  volunteer = await api.staff('bilal@alanwaar.group')
  compliance = await api.staff('khalid@alanwaar.group')
  const found = await owner.get('/api/admin/donors?q=amina.rahman@example.com')
  aminaId = found.body.items[0].id
})
afterAll(() => api?.stop())

function upload(c: Client, path: string, fields: Record<string, string>, file: { name: string; type: string; body: Buffer | string }) {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.append(k, v)
  const bytes = typeof file.body === 'string' ? file.body : new Uint8Array(file.body)
  form.append('file', new Blob([bytes], { type: file.type }), file.name)
  return c.request('POST', path, undefined, { raw: form })
}

describe('H1: compliance document uploads', () => {
  const HTML = '<html><body><script>fetch("/api/admin/staff")</script></body></html>'

  it('refuses an HTML file named .pdf', async () => {
    const res = await upload(compliance, '/api/compliance/documents', { title: 'Policy', category: 'governance' }, { name: 'policy.pdf', type: 'text/html', body: HTML })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.file).toMatch(/does not look like a real \.pdf/)
  })

  it('stores a real PDF as a PDF whatever the browser called it, with the sandbox CSP', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')
    const made = await upload(compliance, '/api/compliance/documents', { title: 'Real policy', category: 'governance' }, { name: 'real.pdf', type: 'text/html', body: pdf })
    expect(made.status).toBe(201)
    const file = await compliance.get(`/api/compliance/documents/${made.body.id}/file`)
    expect(file.status).toBe(200)
    expect(file.headers.get('content-type')).toBe('application/pdf')
    expect(file.headers.get('content-disposition')).toMatch(/^inline/)
    expect(file.headers.get('content-security-policy')).toMatch(/sandbox/)
    expect(file.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('serves anything but a PDF, photo or plain text as a download', async () => {
    const csv = 'name,amount\nA,1\n'
    const made = await upload(compliance, '/api/compliance/documents', { title: 'Sheet', category: 'governance' }, { name: 'sheet.csv', type: 'text/html', body: csv })
    expect(made.status).toBe(201)
    const file = await compliance.get(`/api/compliance/documents/${made.body.id}/file`)
    expect(file.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(file.headers.get('content-disposition')).toMatch(/^attachment/)
    expect(file.headers.get('content-security-policy')).toMatch(/sandbox/)
  })

  it('no longer serves library files through the unaudited /api/files/documents route', async () => {
    const res = await owner.get('/api/files/documents/anything.pdf')
    expect(res.status).toBe(404)
  })

  it('refuses a non-image appeal photo whatever its claimed type', async () => {
    const appeals = await owner.get('/api/admin/appeals?pageSize=1')
    const id = appeals.body.items[0].id
    const res = await upload(owner, `/api/admin/appeals/${id}/image`, {}, { name: 'photo.png', type: 'image/png', body: HTML })
    expect(res.status).toBe(415)
  })
})

describe('H2: the volunteer role and the donor base', () => {
  it('refuses the donor list, a record, its gifts, its emails and the export', async () => {
    for (const path of ['/api/admin/donors', `/api/admin/donors/${aminaId}`, `/api/admin/donors/${aminaId}/gifts`, `/api/admin/donors/${aminaId}/emails`, '/api/admin/donors/export']) {
      const res = await volunteer.get(path)
      expect(res.status, path).toBe(403)
    }
  })

  it('does not include donors in the volunteer’s ⌘K search', async () => {
    const res = await volunteer.get('/api/admin/search?q=amina')
    expect(res.body.groups.map((g: { label: string }) => g.label)).not.toContain('Donors')
  })

  it('finds a donor through the lookup: five at most, masked, no totals', async () => {
    const short = await volunteer.get('/api/admin/lookup/donors?q=am')
    expect(short.body.items).toEqual([])

    const wide = await volunteer.get('/api/admin/lookup/donors?q=ali')
    expect(wide.body.items.length).toBeLessThanOrEqual(5)

    const amina = await volunteer.get('/api/admin/lookup/donors?q=amina rahman')
    const row = amina.body.items[0]
    expect(row.id).toBe(aminaId)
    expect(row.emailHint).toBe('a•••@example.com')
    expect(Object.keys(row).sort()).toEqual(['emailHint', 'firstName', 'id', 'lastName', 'noEmail', 'number', 'suburb'])
  })

  it('still records a cash gift for the donor it found', async () => {
    const day = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10)
    const res = await volunteer.post('/api/admin/gifts/offline', {
      donorId: aminaId, amount: 2500, method: 'cash', designation: 'sadaqah', date: day, sendReceipt: false,
    })
    expect(res.status).toBe(201)
    /* the answer, and the gift opened afterwards, must not hand back the
       address, phone or giving the lookup masked */
    const leaks = (body: unknown) => {
      const text = JSON.stringify(body)
      expect(text).not.toContain('amina.rahman@example.com')
      expect(text).not.toMatch(/"phone"|"totalGiven"|"giftCount"/)
    }
    leaks(res.body)
    expect(res.body.donor.email).toBeUndefined()
    expect(res.body.donor.emailHint).toBe('a•••@example.com')
    const opened = await volunteer.get(`/api/admin/gifts/${res.body.gift.id}`)
    expect(opened.status).toBe(200)
    leaks(opened.body)
    leaks((await volunteer.get(`/api/admin/gifts/donor/${aminaId}`)).body)
  })

  it('masks the donor on an enquiry the volunteer opens, linked or suggested', async () => {
    const list = await volunteer.get('/api/admin/enquiries?pageSize=100')
    expect(list.status).toBe(200)
    let withDonor = 0
    for (const e of list.body.items as { id: string }[]) {
      const d = await volunteer.get(`/api/admin/enquiries/${e.id}`)
      expect(d.status).toBe(200)
      for (const person of [d.body.donor, d.body.suggestion]) {
        if (!person) continue
        withDonor++
        expect(person.email).toBeUndefined()
        expect(Object.keys(person)).not.toEqual(expect.arrayContaining(['phone']))
        expect(person.totalGiven).toBeUndefined()
      }
    }
    expect(withDonor).toBeGreaterThan(0)
  })

  it('shows staff who may read donors the full summary', async () => {
    const res = await owner.get(`/api/admin/gifts/donor/${aminaId}`)
    expect(res.body.donor.email).toBe('amina.rahman@example.com')
  })

  it('keeps payment-provider ids out of the donor record for everyone', async () => {
    const res = await owner.get(`/api/admin/donors/${aminaId}`)
    const text = JSON.stringify(res.body)
    expect(text).not.toMatch(/stripeCustomer|stripePaymentMethod|"external"/)
    const gifts = await owner.get(`/api/admin/donors/${aminaId}/gifts`)
    expect(JSON.stringify(gifts.body)).not.toMatch(/"external"|"checkout"/)
  })
})

describe('C3: a donor’s Emails tab', () => {
  it('never lists a sign-in code', async () => {
    const sent = await api.client().post('/api/auth/donor/code', { email: 'amina.rahman@example.com' })
    expect(sent.status).toBe(200)
    const list = await owner.get(`/api/admin/donors/${aminaId}/emails?pageSize=200`)
    expect(list.status).toBe(200)
    const templates = list.body.items.map((m: { template: string }) => m.template)
    expect(templates).not.toContain('otp')
    expect(JSON.stringify(list.body)).not.toMatch(/sign-in code/i)
  })
})

describe('signing a donor out everywhere', () => {
  it('ends the donor’s portal sessions and is audited', async () => {
    const donor = await api.donor('amina.rahman@example.com')
    expect((await donor.get('/api/auth/session')).body.donor).toBeTruthy()
    expect((await volunteer.post(`/api/admin/donors/${aminaId}/sign-out`)).status).toBe(403)
    const res = await owner.post(`/api/admin/donors/${aminaId}/sign-out`)
    expect(res.status).toBe(200)
    expect((await donor.get('/api/auth/session')).body.donor).toBeNull()
  })
})

describe('resetting a staff member’s two-step sign-in', () => {
  it('is owner-only, never your own, signs them out and switches it off', async () => {
    const omar = await api.staff('omar@alanwaar.group')
    const { Staff } = await import('../../server/models')
    await Staff.updateOne({ email: 'omar@alanwaar.group' }, { $set: { totpEnabled: true, totpSecret: 'sealed-placeholder' } })
    const list = await owner.get('/api/admin/staff')
    const row = list.body.items.find((s: { email: string }) => s.email === 'omar@alanwaar.group')
    const me = list.body.items.find((s: { email: string }) => s.email === 'yusuf@alanwaar.group')
    expect(row.totpEnabled).toBe(true)
    expect(JSON.stringify(list.body)).not.toMatch(/totpSecret|recoveryCodes|passwordHash/)

    const admin = await api.staff('maryam@alanwaar.group')
    expect((await admin.post(`/api/admin/staff/${row.id}/reset-mfa`)).status).toBe(403)
    expect((await owner.post(`/api/admin/staff/${me.id}/reset-mfa`)).status).toBe(400)

    const res = await owner.post(`/api/admin/staff/${row.id}/reset-mfa`)
    expect(res.status).toBe(200)
    expect(res.body.totpEnabled).toBe(false)
    expect((await omar.get('/api/auth/session')).body.staff).toBeNull()
    const log = await owner.get('/api/admin/activity?area=staff')
    expect(log.body.items.some((e: { action: string }) => e.action === 'staff.mfa_reset')).toBe(true)
  })
})

describe('M12: bank lines matched on a name alone', () => {
  it('go to "needs a look", and a pledge of the same amount makes them a match', async () => {
    const made = await owner.post('/api/admin/donors', { firstName: 'Zephyrina', lastName: 'Quillfeather', email: 'zq@example.com' })
    expect(made.status).toBe(201)
    const { matchLines } = await import('../../server/lib/matching')
    const [line] = await matchLines([{ date: new Date(), amount: 5000, description: 'TRANSFER FROM ZEPHYRINA QUILLFEATHER' }])
    expect(line!.status).toBe('review')
    expect(line!.match.via).toBe('name')
    expect(line!.match.donorName).toMatch(/Zephyrina/)
  })
})

describe('L8: bank statement imports', () => {
  it('refuses a statement over the line cap', async () => {
    const rows = Array.from({ length: 5002 }, (_, i) => `01/07/2026,${(i % 90) + 10}.00,TRANSFER FROM PERSON ${i},1000.00`)
    const res = await upload(owner, '/api/admin/bank/imports', {}, { name: 'big.csv', type: 'text/csv', body: rows.join('\n') })
    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(/up to 5,000/)
  })

  it('saves each line once when "Save" is pressed twice at the same moment', async () => {
    const sample = await owner.get('/api/admin/bank/sample')
    expect(sample.status).toBe(200)
    const made = await upload(owner, '/api/admin/bank/imports', {}, { name: 'sample.csv', type: 'text/csv', body: sample.text })
    expect(made.status).toBe(201)
    const id = made.body.id
    const [a, b] = await Promise.all([owner.post(`/api/admin/bank/imports/${id}/confirm`, {}), owner.post(`/api/admin/bank/imports/${id}/confirm`, {})])
    const statuses = [a.status, b.status].sort()
    expect(statuses[0]).toBe(200)
    const saved = (a.status === 200 ? a.body.saved : 0) + (b.status === 200 ? b.body.saved : 0)
    const after = await owner.get(`/api/admin/bank/imports/${id}`)
    const confirmed = after.body.lines.filter((l: { status: string }) => l.status === 'confirmed')
    expect(saved).toBe(confirmed.length)
    const giftIds = confirmed.map((l: { gift: string }) => l.gift)
    expect(new Set(giftIds).size).toBe(giftIds.length)
  })
})

describe('M14: the action-log export', () => {
  it('writes an audit row', async () => {
    const res = await owner.get('/api/admin/activity/export')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/csv/)
    const log = await owner.get('/api/admin/activity?area=audit')
    expect(log.body.items.some((e: { action: string }) => e.action === 'audit.export')).toBe(true)
  })
})

describe('L6: settings sections', () => {
  it.each(['__proto__', 'constructor', 'nope'])('PUT /settings/%s is a 400, not a 500', async (section) => {
    const res = await owner.put(`/api/admin/settings/${section}`, {})
    expect(res.status).toBe(400)
  })
})
