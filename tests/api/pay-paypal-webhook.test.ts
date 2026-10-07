import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startApi, type Api } from '../helpers/server'
import { checkoutBody } from '../helpers/giving'

/* ---------------------------------------------------------------------------
   POST /api/webhooks/paypal (finding M6), against a fake PayPal: nothing
   reaches the network.

     - an event PayPal doesn't vouch for (verify-webhook-signature says
       FAILURE) is refused; with no PAYPAL_WEBHOOK_ID the route isn't there
     - CAPTURE.COMPLETED pays the gift once, with a receipt, however many
       times it arrives — and only for what PayPal's own copy of the order
       says, not the event's figures
     - CAPTURE.PENDING holds it; CAPTURE.DENIED fails it
     - CAPTURE.REFUNDED in full un-gives it like the admin's Refund; a partial
       refund is logged and left for a person
     - CAPTURE.REVERSED stops it counting without a refund email
--------------------------------------------------------------------------- */

const PAYPAL = 'https://paypal.webhook.test'
const WEBHOOK_ID = 'WH-TEST-1'

type Capture = { id: string; status: string; value: string; currency: string; orderId: string }
const orders = new Map<string, { id: string; value: string; capture: Capture | null }>()
const captures = new Map<string, Capture>()
let next = 1
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function fakePaypal(url: URL, init?: RequestInit): Promise<Response> {
  if (url.pathname === '/v1/oauth2/token') return json({ access_token: 't' })
  if (url.pathname === '/v1/notifications/verify-webhook-signature') {
    const b = JSON.parse(String(init?.body))
    const ok = b.webhook_id === WEBHOOK_ID && b.transmission_sig !== 'forged'
    return json({ verification_status: ok ? 'SUCCESS' : 'FAILURE' })
  }
  if (url.pathname === '/v2/checkout/orders' && init?.method === 'POST') {
    const unit = JSON.parse(String(init.body)).purchase_units[0]
    const o = { id: `PPW-${next++}`, value: unit.amount.value, capture: null }
    orders.set(o.id, o)
    return json({ id: o.id, links: [{ rel: 'approve', href: `${PAYPAL}/approve?token=${o.id}` }] }, 201)
  }
  const ord = /^\/v2\/checkout\/orders\/([^/]+)$/.exec(url.pathname)
  if (ord) {
    const o = orders.get(decodeURIComponent(ord[1]))
    if (!o) return json({ name: 'RESOURCE_NOT_FOUND' }, 404)
    if (!o.capture) return json({ id: o.id, status: 'APPROVED' })
    const c = o.capture
    return json({
      id: o.id,
      status: 'COMPLETED',
      purchase_units: [{ payments: { captures: [{ id: c.id, status: c.status, amount: { currency_code: c.currency, value: c.value } }] } }],
    })
  }
  const cap = /^\/v2\/payments\/captures\/([^/]+)$/.exec(url.pathname)
  if (cap) {
    const c = captures.get(decodeURIComponent(cap[1]))
    if (!c) return json({ name: 'RESOURCE_NOT_FOUND' }, 404)
    return json({ id: c.id, status: c.status, amount: { currency_code: c.currency, value: c.value }, supplementary_data: { related_ids: { order_id: c.orderId } } })
  }
  return json({ name: 'NOT_FOUND' }, 404)
}

let api: Api
let models: typeof import('../../server/models')
let env: (typeof import('../../server/env'))['env']
const realFetch = globalThis.fetch

beforeAll(async () => {
  api = await startApi({ seed: 'demo' })
  env = (await import('../../server/env')).env
  env.paypal = { id: 'id', secret: 'secret', api: PAYPAL, webhookId: WEBHOOK_ID }
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

/** a PayPal checkout from the site, the donor not yet back: a pending gift and its order */
async function pendingPaypalGift(amount = 50) {
  const res = await api.client().post('/api/public/checkout', checkoutBody({ provider: 'paypal', amount }))
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const orderId = new URL(res.body.url).searchParams.get('token')!
  const gift = (await models.Gift.findOne({ 'external.paypal': orderId }))!
  return { gift, orderId }
}

/** what PayPal now holds for the order (as if captured on PayPal's side) */
function capture(orderId: string, status: string, value?: string, currency = 'AUD') {
  const o = orders.get(orderId)!
  const c: Capture = { id: `CAP-${orderId}`, status, value: value ?? o.value, currency, orderId }
  o.capture = c
  captures.set(c.id, c)
  return c
}

let evN = 0
function deliver(type: string, resource: Record<string, unknown>, sig = 'signed') {
  const event = { id: `WH-EVT-${evN++}`, event_type: type, resource_type: 'capture', resource }
  return api.client().post('/api/webhooks/paypal', undefined, {
    raw: JSON.stringify(event),
    csrf: false,
    headers: {
      'Content-Type': 'application/json',
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': `${PAYPAL}/certs/1`,
      'paypal-transmission-id': `t-${evN}`,
      'paypal-transmission-sig': sig,
      'paypal-transmission-time': new Date().toISOString(),
    },
  })
}
const captureEvent = (c: Capture, value = c.value) => ({
  id: c.id,
  status: c.status,
  amount: { currency_code: c.currency, value },
  supplementary_data: { related_ids: { order_id: c.orderId } },
})
const refundEvent = (c: Capture) => ({ id: `REF-${c.id}`, status: 'COMPLETED', links: [{ rel: 'up', href: `${PAYPAL}/v2/payments/captures/${c.id}` }] })

const reload = (id: unknown) => models.Gift.findById(id).lean()

describe('PayPal webhook: trust', () => {
  it('refuses an event PayPal does not vouch for, and changes nothing', async () => {
    const { gift, orderId } = await pendingPaypalGift()
    const c = capture(orderId, 'COMPLETED')
    const res = await deliver('PAYMENT.CAPTURE.COMPLETED', captureEvent(c), 'forged')
    expect(res.status).toBe(400)
    expect((await reload(gift._id))?.status).toBe('pending')
  })

  it('is not there at all without a webhook id', async () => {
    env.paypal!.webhookId = ''
    try {
      const res = await deliver('PAYMENT.CAPTURE.COMPLETED', { id: 'x' })
      expect(res.status).toBe(404)
    } finally {
      env.paypal!.webhookId = WEBHOOK_ID
    }
  })
})

describe('PayPal webhook: captures', () => {
  it('COMPLETED pays the gift once, with one receipt, however many times it arrives', async () => {
    const { gift, orderId } = await pendingPaypalGift()
    const c = capture(orderId, 'COMPLETED')
    const results = await Promise.all([1, 2, 3].map(() => deliver('PAYMENT.CAPTURE.COMPLETED', captureEvent(c))))
    expect(results.map((r) => r.status)).toEqual([200, 200, 200])
    const after = (await reload(gift._id))!
    expect(after.status).toBe('succeeded')
    expect(after.external?.paypal).toBe(c.id)
    expect(after.receipt?.number).toMatch(/^AA-/)
    expect(await models.EmailMessage.countDocuments({ donor: after.donor, template: 'receipt', createdAt: { $gte: gift.createdAt } })).toBe(1)
  })

  it('believes PayPal’s copy of the order, not the event: a short capture is not paid', async () => {
    const { gift, orderId } = await pendingPaypalGift(50)
    const c = capture(orderId, 'COMPLETED', '1.00')
    /* the event claims the full amount; PayPal's order says $1 */
    await deliver('PAYMENT.CAPTURE.COMPLETED', captureEvent(c, '50.00'))
    expect((await reload(gift._id))?.status).toBe('pending')
    expect(await models.AuditEvent.exists({ action: 'gift.mismatch', 'entity.id': gift._id })).not.toBeNull()
  })

  it('PENDING holds it, and a later COMPLETED pays it', async () => {
    const { gift, orderId } = await pendingPaypalGift()
    const c = capture(orderId, 'PENDING')
    await deliver('PAYMENT.CAPTURE.PENDING', captureEvent(c))
    let after = (await reload(gift._id))!
    expect(after.status).toBe('pending')
    expect(after.paypalCapture?.status).toBe('PENDING')
    c.status = 'COMPLETED'
    await deliver('PAYMENT.CAPTURE.COMPLETED', captureEvent(c))
    after = (await reload(gift._id))!
    expect(after.status).toBe('succeeded')
  })

  it('DENIED fails it', async () => {
    const { gift, orderId } = await pendingPaypalGift()
    const c = capture(orderId, 'DECLINED')
    await deliver('PAYMENT.CAPTURE.DENIED', captureEvent(c))
    expect((await reload(gift._id))?.status).toBe('failed')
  })
})

describe('PayPal webhook: money going back', () => {
  async function paidGift() {
    const { gift, orderId } = await pendingPaypalGift()
    const c = capture(orderId, 'COMPLETED')
    await deliver('PAYMENT.CAPTURE.COMPLETED', captureEvent(c))
    expect((await reload(gift._id))?.status).toBe('succeeded')
    return { gift, c }
  }

  it('a full refund in PayPal un-gives the donation, once', async () => {
    const { gift, c } = await paidGift()
    c.status = 'REFUNDED'
    await deliver('PAYMENT.CAPTURE.REFUNDED', refundEvent(c))
    await deliver('PAYMENT.CAPTURE.REFUNDED', refundEvent(c))
    const after = (await reload(gift._id))!
    expect(after.status).toBe('refunded')
    /* the donor is told once, however many times PayPal says so */
    expect(await models.EmailMessage.countDocuments({ donor: after.donor, template: 'gift.refund', createdAt: { $gte: gift.createdAt } })).toBe(1)
  })

  it('a partial refund is logged and left for a person', async () => {
    const { gift, c } = await paidGift()
    c.status = 'PARTIALLY_REFUNDED'
    await deliver('PAYMENT.CAPTURE.REFUNDED', refundEvent(c))
    expect((await reload(gift._id))?.status).toBe('succeeded')
    expect(await models.AuditEvent.exists({ action: 'gift.refund_partial', 'entity.id': gift._id })).not.toBeNull()
  })

  it('a refund event PayPal’s capture does not bear out changes nothing', async () => {
    const { gift, c } = await paidGift()
    /* the capture is still COMPLETED on PayPal's side */
    await deliver('PAYMENT.CAPTURE.REFUNDED', refundEvent(c))
    expect((await reload(gift._id))?.status).toBe('succeeded')
  })

  it('a reversal stops it counting, without telling the donor they were refunded', async () => {
    const { gift, c } = await paidGift()
    c.status = 'REVERSED'
    await deliver('PAYMENT.CAPTURE.REVERSED', captureEvent(c))
    const after = (await reload(gift._id))!
    expect(after.status).toBe('refunded')
    expect(await models.AuditEvent.exists({ action: 'gift.reversed', 'entity.id': gift._id })).not.toBeNull()
    expect(await models.EmailMessage.countDocuments({ donor: after.donor, template: 'gift.refund', createdAt: { $gte: gift.createdAt } })).toBe(0)
  })
})
