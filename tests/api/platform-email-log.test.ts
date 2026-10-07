import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startApi, type Api } from '../helpers/server'
import type { Client } from '../helpers/client'

/* SECURITY FINDING C3: the email log must never hold a sign-in code or a
   reset/invitation link, wherever staff read it from — Admin → Email log, or
   a donor's Emails tab. Also: the outbox in production records a failure
   rather than "sent" (C2), and the C3 migration redacts old rows. */

let api: Api
let owner: Client
beforeAll(async () => {
  api = await startApi({ seed: 'demo' })
  owner = await api.staff('yusuf@alanwaar.group')
})
afterAll(() => api?.stop())

const DONOR = 'amina.rahman@example.com'

async function logRows(q: string) {
  const list = await owner.get(`/api/admin/emails?q=${encodeURIComponent(q)}&pageSize=50`)
  expect(list.status).toBe(200)
  const full = await Promise.all(list.body.items.map((m: { id: string }) => owner.get(`/api/admin/emails/${m.id}`)))
  return { list: list.body.items as { subject: string; template: string }[], full: full.map((r) => r.body as { subject: string; html: string; text?: string; template: string }) }
}

describe('the email log never holds a secret', () => {
  it('keeps a donor sign-in code out of the log and out of the subject', async () => {
    const sent = await api.client().post('/api/auth/donor/code', { email: DONOR })
    expect(sent.status).toBe(200)
    const code: string = sent.body.devCode
    expect(code).toMatch(/^\d{6}$/)

    const { list, full } = await logRows(DONOR)
    const otp = full.filter((m) => m.template === 'otp')
    expect(otp.length).toBeGreaterThan(0)
    for (const m of otp) {
      expect(m.subject).toBe('Your Al-Anwaar sign-in code')
      expect(m.html).not.toContain(code)
      expect(m.text ?? '').not.toContain(code)
    }
    for (const m of list) expect(m.subject).not.toContain(code)
  })

  it('keeps it out of the donor record’s Emails tab too', async () => {
    const sent = await api.client().post('/api/auth/donor/code', { email: DONOR })
    const code: string = sent.body.devCode
    const found = await owner.get(`/api/admin/donors?q=${encodeURIComponent(DONOR)}`)
    const id = found.body.items[0].id
    const tab = await owner.get(`/api/admin/donors/${id}/emails?pageSize=50`)
    expect(tab.status).toBe(200)
    for (const m of tab.body.items) {
      expect(m.subject).not.toContain(code)
      const one = await owner.get(`/api/admin/donors/${id}/emails/${m.id}`)
      if (one.status === 200) expect(JSON.stringify(one.body)).not.toContain(code)
    }
  })

  it('keeps a password-reset link out of the log', async () => {
    const res = await api.client().post('/api/auth/staff/forgot', { email: 'omar@alanwaar.group' })
    expect(res.status).toBe(200)
    /* the reset email is sent after the response */
    let rows: Awaited<ReturnType<typeof logRows>>['full'] = []
    for (let i = 0; i < 40 && !rows.some((m) => m.template === 'staff.reset'); i++) {
      await new Promise((r) => setTimeout(r, 100))
      rows = (await logRows('omar@alanwaar.group')).full
    }
    const reset = rows.filter((m) => m.template === 'staff.reset')
    expect(reset.length).toBeGreaterThan(0)
    for (const m of reset) {
      expect(m.html).not.toMatch(/token=/)
      expect(m.text ?? '').not.toMatch(/token=/)
    }
  })

  it('keeps an invitation link out of the log', async () => {
    const res = await owner.post('/api/admin/staff/invite', { name: 'Test Person', email: 'new.person@alanwaar.group', role: 'volunteer' })
    expect(res.status).toBe(201)
    const { full } = await logRows('new.person@alanwaar.group')
    const invite = full.filter((m) => m.template === 'staff.invite')
    expect(invite.length).toBe(1)
    expect(invite[0].html).not.toMatch(/token=/)
  })
})

describe('the outbox in production', () => {
  it('records "failed", not "sent", when there is no mail server', async () => {
    const { env } = await import('../../server/env')
    const { sendEmail } = await import('../../server/lib/email')
    const { otpEmail } = await import('../../server/emails/templates')
    const { EmailMessage } = await import('../../server/models')
    env.isProd = true
    try {
      const r = await sendEmail('someone@example.com', otpEmail('123456'))
      expect(r.ok).toBe(false)
      const row = await EmailMessage.findById(r.id).lean<{ status: string; error: string; html: string }>()
      expect(row!.status).toBe('failed')
      expect(row!.error).toMatch(/no mail server/i)
      expect(row!.html).not.toContain('123456')
    } finally {
      env.isProd = false
    }
  })
})

describe('the C3 migration', () => {
  it('redacts rows logged before the fix and cancels live staff links', async () => {
    const { EmailMessage, Staff } = await import('../../server/models')
    const { runMigrations } = await import('../../server/migrations')
    const mongoose = (await import('mongoose')).default
    await EmailMessage.create({ to: 'old@example.com', subject: '654321 is your Al-Anwaar sign-in code', template: 'otp', html: '<p>654321</p>', text: '654321', transport: 'outbox', status: 'sent' })
    await EmailMessage.create({ to: 'omar@alanwaar.group', subject: 'Reset your Al-Anwaar password', template: 'staff.reset', html: '<a href="https://x/admin/reset?token=abc">x</a>', transport: 'outbox', status: 'sent' })
    await Staff.updateOne({ email: 'omar@alanwaar.group' }, { $set: { tokenHash: 'h', tokenExpires: new Date(Date.now() + 3_600_000) } })
    /* the startup run (if any) is recorded; run it again as if for the first time */
    await mongoose.connection.collection('migrations').deleteMany({})

    await runMigrations()

    const leaked = await EmailMessage.find({ $or: [{ subject: /654321/ }, { html: /654321|token=/ }] }).lean()
    expect(leaked).toHaveLength(0)
    const omar = await Staff.findOne({ email: 'omar@alanwaar.group' }).select('+tokenHash +tokenExpires').lean<{ tokenHash?: string }>()
    expect(omar!.tokenHash).toBeUndefined()

    /* and it runs once */
    await EmailMessage.create({ to: 'later@example.com', subject: '111111 is your code', template: 'otp', html: '111111', transport: 'outbox', status: 'sent' })
    await runMigrations()
    expect(await EmailMessage.countDocuments({ subject: /111111/ })).toBe(1)
  })
})
