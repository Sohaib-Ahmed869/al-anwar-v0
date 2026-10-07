import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startApi, type Api } from '../helpers/server'
import { checkoutBody } from '../helpers/giving'

/* ---------------------------------------------------------------------------
   PayPal, end to end through the real routes (SECURITY FINDING M6), against a
   fake PayPal: the global fetch is wrapped so that calls to PAYPAL_API are
   answered here, and everything else (the test client's own requests) goes
   through to the real network stack. Nothing reaches PayPal.

     POST /api/public/checkout (provider paypal)   a pending gift and PayPal's
                                                   approval link
     GET  /api/public/paypal/return                captures, and then:
       - captured                                  paid, with a real receipt
       - the return loaded twice at once           paid once, stays paid
                                                   (ORDER_ALREADY_CAPTURED)
       - captured for a different amount/currency  NOT paid; logged for staff
       - the capture call dies, the order is paid  paid (it asks PayPal)
       - declined                                  failed, and the thank-you
                                                   page says so in our words,
                                                   not PayPal's
--------------------------------------------------------------------------- */

const PAYPAL = 'https://paypal.test'

type Behaviour = 'complete' | 'mismatch-amount' | 'mismatch-currency' | 'throw-but-captured' | 'declined'
type Order = { id: string; value: string; currency: string; behaviour: Behaviour; captured: boolean; captures: number }

const orders = new Map<string, Order>()
let next = 1
/** the behaviour the next order created will have */
let upcoming: Behaviour = 'complete'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const capturedBody = (o: Order, value = o.value, currency = o.currency) => ({
  id: o.id,
  status: 'COMPLETED',
  purchase_units: [{ payments: { captures: [{ id: `CAP-${o.id}`, status: 'COMPLETED', amount: { currency_code: currency, value } }] } }],
})

async function fakePaypal(url: URL, init?: RequestInit): Promise<Response> {
  const path = url.pathname
  if (path === '/v1/oauth2/token') return json({ access_token: 'test-token', expires_in: 3600 })

  if (path === '/v2/checkout/orders' && init?.method === 'POST') {
    const body = JSON.parse(String(init.body))
    const unit = body.purchase_units[0]
    const o: Order = { id: `ORDER-${next++}`, value: unit.amount.value, currency: unit.amount.currency_code, behaviour: upcoming, captured: false, captures: 0 }
    orders.set(o.id, o)
    return json({ id: o.id, status: 'CREATED', links: [{ rel: 'approve', href: `${PAYPAL}/checkoutnow?token=${o.id}` }] }, 201)
  }

  const m = /^\/v2\/checkout\/orders\/([^/]+)(\/capture)?$/.exec(path)
  const o = m && orders.get(decodeURIComponent(m[1]))
  if (!o) return json({ name: 'RESOURCE_NOT_FOUND' }, 404)

  if (m![2]) {
    o.captures++
    /* PayPal takes a moment, so two loads of the return URL overlap */
    await new Promise((r) => setTimeout(r, 150))
    if (o.captured) return json({ name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'ORDER_ALREADY_CAPTURED' }], message: 'Order already captured.' }, 422)
    switch (o.behaviour) {
      case 'declined':
        return json({ name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'INSTRUMENT_DECLINED' }], message: 'The instrument presented was either declined by the processor or bank.' }, 422)
      case 'throw-but-captured':
        o.captured = true
        throw new TypeError('fetch failed: socket hang up')
      case 'mismatch-amount':
        o.captured = true
        return json(capturedBody(o, '1.00'), 201)
      case 'mismatch-currency':
        o.captured = true
        return json(capturedBody(o, o.value, 'USD'), 201)
      default:
        o.captured = true
        return json(capturedBody(o), 201)
    }
  }
  /* GET the order: what PayPal holds now */
  return json(o.captured ? capturedBody(o) : { id: o.id, status: 'APPROVED' })
}

let api: Api
let models: typeof import('../../server/models')
const realFetch = globalThis.fetch

beforeAll(async () => {
  api = await startApi({ seed: 'demo' })
  const { env } = await import('../../server/env')
  env.paypal = { id: 'client-id', secret: 'client-secret', api: PAYPAL, webhookId: '' }
  models = await import('../../server/models')
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (url.origin === PAYPAL) return fakePaypal(url, init)
    return realFetch(input, init)
  }) as typeof fetch
})

afterAll(async () => {
  globalThis.fetch = realFetch
  await api?.stop()
})

/** a PayPal checkout from the site; returns the gift, its order and the approval link */
async function startPaypal(behaviour: Behaviour, amount = 50) {
  upcoming = behaviour
  const res = await api.client().post('/api/public/checkout', checkoutBody({ provider: 'paypal', amount }))
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  expect(res.body.kind).toBe('redirect')
  const approve = new URL(res.body.url)
  const orderId = approve.searchParams.get('token')!
  const gift = (await models.Gift.findOne({ 'external.paypal': orderId }).select('+publicToken'))!
  return { gift, orderId, approve }
}

/** PayPal sending the donor back */
const comeBack = (giftId: string, orderId: string) =>
  api.client().get(`/api/public/paypal/return?gift=${giftId}&token=${encodeURIComponent(orderId)}`)

const reload = (id: unknown) => models.Gift.findById(id).select('+publicToken').lean()

describe('PayPal checkout (M6)', () => {
  it('opens PayPal: a pending PayPal gift and the approval link', async () => {
    const { gift, approve } = await startPaypal('complete')
    expect(approve.origin).toBe(PAYPAL)
    expect(gift.status).toBe('pending')
    expect(gift.method).toBe('paypal')
    expect(gift.receipt?.number).toBeFalsy()
    /* the order asks for exactly the gift, in AUD */
    const o = orders.get(approve.searchParams.get('token')!)!
    expect(o).toMatchObject({ value: '50.00', currency: 'AUD' })
  })

  it('the return captures: paid, a real receipt, and the thank-you page with its token', async () => {
    const { gift, orderId } = await startPaypal('complete')
    const res = await comeBack(gift.id, orderId)
    expect(res.status).toBe(302)
    const to = new URL(res.headers.get('location')!, 'http://x')
    expect(to.pathname).toBe('/thank-you')
    expect(to.searchParams.get('t')).toBe(gift.publicToken)

    const g = await reload(gift._id)
    expect(g!.status).toBe('succeeded')
    expect(g!.external?.paypal).toBe(`CAP-${orderId}`)
    expect(g!.receipt?.number).toMatch(/^AA-\d{4}-\d+$/)
    expect(g!.simulated).toBeFalsy()

    const status = await api.client().get(`/api/public/gifts/${gift.id}/status?t=${gift.publicToken}`)
    expect(status.body).toMatchObject({ status: 'succeeded', receiptNumber: g!.receipt!.number })
  })

  it('the return loaded twice at once: captured once, paid once, and it stays paid', async () => {
    const { gift, orderId } = await startPaypal('complete')
    const [a, b] = await Promise.all([comeBack(gift.id, orderId), comeBack(gift.id, orderId)])
    expect([a.status, b.status]).toEqual([302, 302])
    /* both really reached PayPal: the second was refused as already captured */
    expect(orders.get(orderId)!.captures).toBe(2)

    const g = await reload(gift._id)
    expect(g!.status).toBe('succeeded')
    expect(g!.failureReason).toBeFalsy()
    /* one receipt number, and one receipt email */
    const sent = await models.EmailMessage.countDocuments({ template: 'receipt', subject: new RegExp(g!.receipt!.number!) })
    expect(sent).toBe(1)

    /* and a third load, afterwards, changes nothing */
    await comeBack(gift.id, orderId)
    expect((await reload(gift._id))!.status).toBe('succeeded')
  })

  it.each([
    ['a different amount', 'mismatch-amount'],
    ['a different currency', 'mismatch-currency'],
  ] as const)('captured for %s: not marked paid, and staff are told', async (_what, behaviour) => {
    const { gift, orderId } = await startPaypal(behaviour)
    await comeBack(gift.id, orderId)
    const g = await reload(gift._id)
    expect(g!.status).toBe('pending')
    expect(g!.receipt?.number).toBeFalsy()
    expect(await models.AuditEvent.countDocuments({ action: 'gift.mismatch', 'entity.id': gift._id })).toBe(1)
  })

  it('the capture call dies but PayPal has the money: it asks, and marks the gift paid', async () => {
    const { gift, orderId } = await startPaypal('throw-but-captured')
    await comeBack(gift.id, orderId)
    const g = await reload(gift._id)
    expect(g!.status).toBe('succeeded')
    expect(g!.receipt?.number).toBeTruthy()
  })

  it('declined: failed, and the donor reads our words, not PayPal’s', async () => {
    const { gift, orderId } = await startPaypal('declined')
    await comeBack(gift.id, orderId)
    const g = await reload(gift._id)
    expect(g!.status).toBe('failed')
    expect(g!.receipt?.number).toBeFalsy()

    const status = await api.client().get(`/api/public/gifts/${gift.id}/status?t=${gift.publicToken}`)
    expect(status.body.status).toBe('failed')
    expect(status.body.failureReason).toMatch(/nothing was charged/)
    expect(status.body.failureReason).not.toMatch(/instrument|processor|INSTRUMENT_DECLINED/i)
  })

  it('a return with the wrong order token changes nothing', async () => {
    const { gift, orderId } = await startPaypal('complete')
    await comeBack(gift.id, 'ORDER-not-this-one')
    expect((await reload(gift._id))!.status).toBe('pending')
    expect(orders.get(orderId)!.captures).toBe(0)
  })
})
