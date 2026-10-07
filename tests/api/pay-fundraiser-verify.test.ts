import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startApi, type Api } from '../helpers/server'
import { DONOR, OPEN_APPEAL, STAFF_BY_ROLE, freshEmail } from '../helpers/fixtures'
import { checkoutBody } from '../helpers/giving'

/* ---------------------------------------------------------------------------
   A fundraiser started from the public form is checked against its
   organiser's inbox before anyone here sees it (finding M10).

   Signed out, it starts 'unverified': not public, not in the approval queue,
   not on the donor's admin record, and the only email is one of our own
   words whose link token never reaches the email log. The link's page posts
   the token back; that moves it to 'pending' once, and a second use says it
   is already done. Signed in as the address given, it goes straight to
   'pending'. The sweeps delete unconfirmed pages after 7 days, and nothing else.

   The real token only ever leaves the server inside the email, so the tests
   that confirm a page plant a token of their own: they write its hash where
   the server keeps the real one.
--------------------------------------------------------------------------- */

let api: Api
let models: typeof import('../../server/models')
let sweeps: typeof import('../../server/lib/sweeps')
let fundraising: Awaited<ReturnType<Api['staff']>>

beforeAll(async () => {
  api = await startApi({ seed: 'demo' })
  models = await import('../../server/models')
  sweeps = await import('../../server/lib/sweeps')
  fundraising = await api.staff(STAFF_BY_ROLE.fundraising)
})
afterAll(() => api?.stop())

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const inAWeek = () => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)

const start = (over: Record<string, unknown> = {}) => ({
  appeal: OPEN_APPEAL,
  reason: 'food',
  title: 'Walking for Gaza this spring',
  story: 'I am walking every morning this month to raise money for families in Gaza. Please give what you can.',
  goal: 500,
  ends: inAWeek(),
  first: 'Hana',
  last: 'Ibrahim',
  email: freshEmail('fr'),
  ...over,
})

/** what an approver sees: every page in the admin list, by title */
async function queueTitles() {
  const res = await fundraising.get('/api/admin/fundraisers?pageSize=200')
  expect(res.status).toBe(200)
  return { titles: (res.body.items as { title: string }[]).map((f) => f.title), counts: res.body.counts as Record<string, number> }
}

/** give an unverified page a token we know, as if we had read the email */
async function plantToken(title: string, opts: { expiresAt?: Date } = {}) {
  const token = `test-token-${Math.random().toString(36).slice(2)}-${Date.now()}`
  await models.Fundraiser.updateOne(
    { title },
    { $set: { 'verify.tokenHash': sha256(token), 'verify.expiresAt': opts.expiresAt ?? new Date(Date.now() + 3_600_000) } },
  )
  return token
}

describe('a fundraiser started on the public site while signed out', () => {
  const title = 'Walking for Gaza: not yet confirmed'
  let email: string

  beforeAll(async () => {
    email = freshEmail('fr')
    const res = await api.client().post('/api/public/fundraisers', start({ title, email }))
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ ok: true, confirm: true, slug: '' })
  })

  it('starts unverified, keeping only the token’s hash', async () => {
    const f = await models.Fundraiser.findOne({ title }).select('+verify.tokenHash').lean()
    expect(f?.status).toBe('unverified')
    expect(f?.verify?.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(f?.verify?.expiresAt?.getTime()).toBeGreaterThan(Date.now() + 47 * 3_600_000)
  })

  it('is not public, not in the approval queue, not on the donor’s admin record', async () => {
    const pub = await api.client().get('/api/public/fundraisers')
    expect((pub.body.items as { title: string }[]).some((f) => f.title === title)).toBe(false)
    const f = await models.Fundraiser.findOne({ title }).lean()
    expect((await api.client().get(`/api/public/fundraisers/${f!.slug}`)).status).toBe(404)

    const q = await queueTitles()
    expect(q.titles).not.toContain(title)
    expect(q.counts.unverified).toBeUndefined()
    expect((await fundraising.get(`/api/admin/fundraisers/${f!._id}`)).status).toBe(404)
    expect((await fundraising.get('/api/admin/fundraisers?status=unverified')).body.items.some((x: { title: string }) => x.title === title)).toBe(false)

    const owner = await api.staff(STAFF_BY_ROLE.owner)
    const donor = await owner.get(`/api/admin/donors/${f!.owner}`)
    expect(JSON.stringify(donor.body)).not.toContain(title)
  })

  it('emails only our own words, and the log keeps no token', async () => {
    const rows = await models.EmailMessage.find({ to: email }).lean()
    expect(rows.map((r) => r.template)).toEqual(['fundraiser.confirm'])
    const [row] = rows
    expect(row.subject).toBe('Please confirm your fundraiser')
    /* none of what the visitor typed went to that inbox */
    expect(row.html).not.toContain('Walking for Gaza')
    expect(row.html).not.toContain('Hana')
    /* the link in the log is the redacted one */
    expect(row.html).toContain('/fundraisers/confirm?t=••••••')
    expect(row.html).not.toMatch(/confirm\?t=[A-Za-z0-9_-]{16,}/)
  })

  it('refuses a token that is wrong, or one that has expired', async () => {
    const wrong = await api.client().post('/api/public/fundraisers/confirm', { t: 'not-the-right-token-at-all' })
    expect(wrong.status).toBe(400)
    const stale = await plantToken(title, { expiresAt: new Date(Date.now() - 1000) })
    const old = await api.client().post('/api/public/fundraisers/confirm', { t: stale })
    expect(old.status).toBe(400)
    expect((await models.Fundraiser.findOne({ title }).lean())?.status).toBe('unverified')
  })

  it('needs the CSRF header like every other write', async () => {
    const token = await plantToken(title)
    const res = await api.client().post('/api/public/fundraisers/confirm', { t: token }, { csrf: false })
    expect(res.status).toBe(403)
    expect((await models.Fundraiser.findOne({ title }).lean())?.status).toBe('unverified')
  })

  it('confirms once: pending, in the queue, audited, and then the email with their title', async () => {
    const token = await plantToken(title)
    const first = await api.client().post('/api/public/fundraisers/confirm', { t: token })
    expect(first.status).toBe(200)
    expect(first.body).toEqual({ ok: true, already: false })

    const f = await models.Fundraiser.findOne({ title }).lean()
    expect(f?.status).toBe('pending')
    expect(f?.verify?.confirmedAt).toBeInstanceOf(Date)
    expect((await queueTitles()).titles).toContain(title)

    const audit = await models.AuditEvent.findOne({ action: 'fundraiser.confirm', 'entity.id': f!._id }).lean()
    expect(audit?.summary).toMatch(/confirmed their email address/)

    const received = await models.EmailMessage.findOne({ to: email, template: 'fundraiser-received' }).lean()
    expect(received?.subject).toBe('We have your fundraiser')

    /* a second press, or a scanner replaying the POST, changes nothing */
    const again = await api.client().post('/api/public/fundraisers/confirm', { t: token })
    expect(again.status).toBe(200)
    expect(again.body).toEqual({ ok: true, already: true })
    expect(await models.EmailMessage.countDocuments({ to: email, template: 'fundraiser-received' })).toBe(1)
    expect(await models.AuditEvent.countDocuments({ action: 'fundraiser.confirm', 'entity.id': f!._id })).toBe(1)
  })
})

describe('a fundraiser started on the public site while signed in', () => {
  it('goes straight to the approval queue when the address is the signed-in donor’s', async () => {
    const donor = await api.donor(DONOR)
    const title = 'Amina’s Ramadan challenge'
    const res = await donor.post('/api/public/fundraisers', start({ title, email: DONOR, first: 'Amina', last: 'Rahman' }))
    expect(res.status).toBe(201)
    expect(res.body.confirm).toBe(false)
    expect(res.body.slug).toBeTruthy()
    const f = await models.Fundraiser.findOne({ title }).select('+verify.tokenHash').lean()
    expect(f?.status).toBe('pending')
    expect(f?.verify?.tokenHash).toBeUndefined()
    expect((await queueTitles()).titles).toContain(title)
  })

  it('still asks for confirmation when the address given is someone else’s', async () => {
    const donor = await api.donor(DONOR)
    const title = 'A page in a friend’s name'
    const res = await donor.post('/api/public/fundraisers', start({ title, email: freshEmail('friend') }))
    expect(res.status).toBe(201)
    expect(res.body.confirm).toBe(true)
    expect((await models.Fundraiser.findOne({ title }).lean())?.status).toBe('unverified')
  })
})

describe('the organiser, signed in to the donor portal', () => {
  it('sees an unconfirmed page and can send it for approval from there', async () => {
    const title = 'Started signed out, confirmed by signing in'
    const res = await api.client().post('/api/public/fundraisers', start({ title, email: DONOR, first: 'Amina', last: 'Rahman' }))
    expect(res.body.confirm).toBe(true)

    const donor = await api.donor(DONOR)
    const mine = await donor.get('/api/me/fundraisers')
    const row = (mine.body.items as { id: string; title: string; status: string; verify?: unknown }[]).find((f) => f.title === title)
    expect(row?.status).toBe('unverified')
    expect(JSON.stringify(row)).not.toMatch(/tokenHash/)

    const sent = await donor.post(`/api/me/fundraisers/${row!.id}/confirm`)
    expect(sent.status).toBe(200)
    expect(sent.body.fundraiser.status).toBe('pending')
    expect((await queueTitles()).titles).toContain(title)
  })
})

describe('the confirmation email itself', () => {
  it('sends the working link, and logs only the redacted one', async () => {
    const { fundraiserConfirmEmail } = await import('../../server/emails/giving')
    const link = 'http://localhost:5190/fundraisers/confirm?t=the-real-token-0123456789'
    const e = fundraiserConfirmEmail(link)
    expect(e.html).toContain(link)
    expect(e.logged?.html).not.toContain('the-real-token')
    expect(e.logged?.subject).toBe(e.subject)
  })
})

describe('the sweep', () => {
  it('deletes unconfirmed pages older than 7 days, and nothing else', async () => {
    const old = new Date(Date.now() - 8 * 86_400_000)
    const recent = 'Unconfirmed but recent'
    const stale = 'Unconfirmed for over a week'
    const oldPending = 'Pending for over a week'
    for (const [title] of [[recent], [stale], [oldPending]]) {
      const res = await api.client().post('/api/public/fundraisers', start({ title }))
      expect(res.status).toBe(201)
    }
    await models.Fundraiser.collection.updateOne({ title: stale }, { $set: { createdAt: old } })
    await models.Fundraiser.collection.updateOne({ title: oldPending }, { $set: { createdAt: old, status: 'pending' } })

    const n = await sweeps.deleteUnconfirmedFundraisers()
    expect(n).toBe(1)
    expect(await models.Fundraiser.exists({ title: stale })).toBeNull()
    expect(await models.Fundraiser.exists({ title: recent })).not.toBeNull()
    expect(await models.Fundraiser.exists({ title: oldPending })).not.toBeNull()
    expect(await sweeps.deleteUnconfirmedFundraisers()).toBe(0)
  })

  /* a 1×1 PNG, enough for the photo's byte check */
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  const age = (title: string) =>
    models.Fundraiser.collection.updateOne({ title }, { $set: { createdAt: new Date(Date.now() - 8 * 86_400_000) } })

  it('takes the photo and the never-used supporter record it created with it', async () => {
    const title = 'Unconfirmed, with a photo and a new address'
    const email = freshEmail('frnew')
    expect((await api.client().post('/api/public/fundraisers', start({ title, email, photo: PNG }))).status).toBe(201)
    const f = (await models.Fundraiser.findOne({ title }).lean())!
    expect(f.verify?.createdDonor).toBe(true)
    expect(f.image).toMatch(/^\/api\/files\/images\//)
    const { getFile } = await import('../../server/lib/storage')
    const key = f.image!.slice('/api/files/'.length)
    expect((await getFile(key)).length).toBeGreaterThan(0)

    await age(title)
    expect(await sweeps.deleteUnconfirmedFundraisers()).toBe(1)
    await expect(getFile(key)).rejects.toThrow()
    expect(await models.Donor.exists({ _id: f.owner })).toBeNull()
    /* the confirmation email is still in the log, no longer pointing at a record */
    const sent = await models.EmailMessage.findOne({ to: email }).lean()
    expect(sent).not.toBeNull()
    expect(sent?.donor).toBeFalsy()
  })

  it('leaves an existing donor’s record alone', async () => {
    const title = 'Unconfirmed, by someone we already know'
    expect((await api.client().post('/api/public/fundraisers', start({ title, email: DONOR }))).status).toBe(201)
    const f = (await models.Fundraiser.findOne({ title }).lean())!
    expect(f.verify?.createdDonor).toBe(false)
    await age(title)
    expect(await sweeps.deleteUnconfirmedFundraisers()).toBe(1)
    expect(await models.Donor.exists({ _id: f.owner })).not.toBeNull()
  })

  it('keeps a new record once the person has given since', async () => {
    const title = 'Unconfirmed, but they gave afterwards'
    const email = freshEmail('frgave')
    expect((await api.client().post('/api/public/fundraisers', start({ title, email }))).status).toBe(201)
    const f = (await models.Fundraiser.findOne({ title }).lean())!
    expect(f.verify?.createdDonor).toBe(true)
    const gave = await api.client().post('/api/public/checkout', checkoutBody({ email, provider: 'bank' }))
    expect(gave.status).toBe(200)
    await age(title)
    expect(await sweeps.deleteUnconfirmedFundraisers()).toBe(1)
    expect(await models.Donor.exists({ _id: f.owner })).not.toBeNull()
  })
})
