import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { REGISTERS, type RegisterDef } from '../../shared/registers'
import { startApi, type Api } from '../helpers/server'
import type { Client } from '../helpers/client'
import { DONOR, STAFF_BY_ROLE } from '../helpers/fixtures'

/* ---------------------------------------------------------------------------
   The donor portal and the compliance portal, read by the people they are
   for, against the demo data:

     donor       overview, giving history, statements, a statement year,
                 receipts, regular gifts, own fundraisers, profile
     compliance  overview, every register (and an entry added, edited and
                 exported), the statutory calendar, the document library, the
                 audit trail and the reports pack
--------------------------------------------------------------------------- */

let api: Api
let donor: Client
let compliance: Client

beforeAll(async () => {
  api = await startApi({ seed: 'demo' })
  donor = await api.donor(DONOR)
  compliance = await api.staff(STAFF_BY_ROLE.compliance)
})
afterAll(() => api?.stop())

describe('donor portal', () => {
  it('overview', async () => {
    const res = await donor.get('/api/me/overview')
    expect(res.status).toBe(200)
    expect(res.body).toBeTypeOf('object')
  })

  it('giving history, filtered and summed', async () => {
    const res = await donor.get('/api/me/gifts')
    expect(res.status).toBe(200)
    expect(res.body.items.length).toBeGreaterThan(0)
    expect(res.body.total).toBeGreaterThanOrEqual(res.body.items.length)
    expect(res.body.sum).toBeGreaterThan(0)
    for (const g of res.body.items) expect(Number.isInteger(g.amount), 'amounts are integer cents').toBe(true)

    const card = await donor.get('/api/me/gifts?method=card&status=succeeded')
    expect(card.status).toBe(200)
    for (const g of card.body.items) {
      expect(g.method).toBe('card')
      expect(g.status).toBe('succeeded')
    }
  })

  it('statements: the years, one year, and a receipt', async () => {
    const years = await donor.get('/api/me/gifts/statements')
    expect(years.status).toBe(200)
    expect(years.body.items.length).toBeGreaterThan(0)
    const fy = years.body.items[0].fy
    const one = await donor.get(`/api/me/gifts/statement/${fy}`)
    expect(one.status).toBe(200)
    expect(one.body.fy).toBe(fy)

    const gifts = await donor.get('/api/me/gifts?status=succeeded')
    const withReceipt = gifts.body.items.find((g: { receipt?: { number?: string } }) => g.receipt?.number)
    expect(withReceipt, 'the seeded donor has a receipted gift').toBeTruthy()
    const receipt = await donor.get(`/api/me/gifts/receipt/${withReceipt.id}`)
    expect(receipt.status).toBe(200)

    expect((await donor.get('/api/me/gifts/statement/1999')).status).toBe(404)
  })

  it('regular gifts and fundraisers', async () => {
    const plans = await donor.get('/api/me/plans')
    expect(plans.status).toBe(200)
    expect(Array.isArray(plans.body.items)).toBe(true)
    const frs = await donor.get('/api/me/fundraisers')
    expect(frs.status).toBe(200)
    expect(Array.isArray(frs.body.items)).toBe(true)
  })

  it('profile: reads, updates a name, and never shows staff-only fields', async () => {
    const res = await donor.get('/api/me/profile')
    expect(res.status).toBe(200)
    const d = res.body.donor
    expect(d.email).toBe(DONOR)
    for (const k of ['notes', 'tags', 'unsubscribeToken', 'oauth', 'passwordHash', 'bankAliases']) expect(d[k], k).toBeUndefined()

    const upd = await donor.patch('/api/me/profile', { firstName: d.firstName, phone: '0400 000 000' })
    expect(upd.status, JSON.stringify(upd.body)).toBe(200)
    expect((await donor.get('/api/me/profile')).body.donor.phone).toBe('0400 000 000')

    const bad = await donor.patch('/api/me/profile', { phone: 'call me maybe' })
    expect(bad.status).toBe(400)
    expect(bad.body.error.fields.phone).toBeTruthy()
  })
})

/** a valid entry for any register, from its own field definitions */
function sampleFields(def: RegisterDef) {
  const fields: Record<string, unknown> = {}
  for (const f of def.fields) {
    if (!f.required) continue
    if (f.type === 'select') fields[f.key] = Object.keys(f.options ?? {})[0]
    else if (f.type === 'date') fields[f.key] = '2026-03-01'
    else if (f.type === 'number' || f.type === 'money') fields[f.key] = 1
    else if (f.type === 'email') fields[f.key] = 'register@example.com'
    else if (f.type === 'boolean') fields[f.key] = true
    else fields[f.key] = `Regression ${f.label}`
  }
  return fields
}

describe('compliance portal', () => {
  it('overview and badges', async () => {
    expect((await compliance.get('/api/compliance/overview')).status).toBe(200)
    expect((await compliance.get('/api/compliance/overview/badges')).status).toBe(200)
  })

  it.each(REGISTERS.map((d) => [d.key, d] as const))('register %s: list, add, edit, export', async (_key, def) => {
    const list = await compliance.get(`/api/compliance/registers/${def.key}`)
    expect(list.status).toBe(200)

    const created = await compliance.post(`/api/compliance/registers/${def.key}`, { fields: sampleFields(def) })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const id = created.body.id

    const title = def.fields.find((f) => f.key === def.titleField)!
    if (title.type === 'text' || title.type === 'textarea') {
      const edited = await compliance.patch(`/api/compliance/registers/${def.key}/${id}`, {
        fields: { ...sampleFields(def), [def.titleField]: 'Edited by the regression tests' },
      })
      expect(edited.status, JSON.stringify(edited.body)).toBe(200)
    }
    const one = await compliance.get(`/api/compliance/registers/${def.key}/${id}`)
    expect(one.status).toBe(200)
    expect(one.body.history.length, 'the entry carries its own history').toBeGreaterThan(0)

    const csv = await compliance.get(`/api/compliance/registers/${def.key}/export`)
    expect(csv.status).toBe(200)
    expect(csv.headers.get('content-type')).toMatch(/csv/)
  })

  it('refuses an entry missing a required field', async () => {
    const def = REGISTERS[0]!
    const res = await compliance.post(`/api/compliance/registers/${def.key}`, { fields: {} })
    expect(res.status).toBe(400)
  })

  it('statutory calendar: list, add, complete', async () => {
    const list = await compliance.get('/api/compliance/obligations')
    expect(list.status).toBe(200)
    expect(list.body.items.length).toBeGreaterThan(0)

    const created = await compliance.post('/api/compliance/obligations', {
      title: 'Regression obligation', category: 'acnc', dueDate: '2027-01-31', recurrence: 'none', reminderDays: [30, 7],
    })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const done = await compliance.post(`/api/compliance/obligations/${created.body.id}/complete`, {})
    expect(done.status, JSON.stringify(done.body)).toBeLessThan(300)
  })

  it('document library and audit trail', async () => {
    const docs = await compliance.get('/api/compliance/documents')
    expect(docs.status).toBe(200)
    expect(Array.isArray(docs.body.items)).toBe(true)
    const audit = await compliance.get('/api/compliance/audit')
    expect(audit.status).toBe(200)
    expect(audit.body.items.length).toBeGreaterThan(0)
  })

  it('reports and the reports pack', async () => {
    const years = await compliance.get('/api/compliance/reports/years')
    expect(years.status).toBe(200)
    expect((await compliance.get('/api/compliance/reports/income')).status).toBe(200)
    expect((await compliance.get('/api/compliance/reports/receipts')).status).toBe(200)
    const pack = await compliance.get('/api/compliance/reports/pack')
    expect(pack.status).toBe(200)
  })
})
