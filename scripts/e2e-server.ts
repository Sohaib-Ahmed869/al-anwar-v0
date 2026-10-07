/* ---------------------------------------------------------------------------
   The app for the Playwright tests (playwright.config.ts starts this).

     npx tsx scripts/e2e-server.ts            Vite in development mode
     E2E_MODE=dist npx tsx scripts/e2e-server.ts   the built site in dist/

   One process, one port (E2E_PORT, default 5191): the real Express API from
   server/app.ts on /api, and the site on everything else — either Vite as
   middleware (no build step, what you want locally) or the production bundle
   from `npm run build` (what CI tests, since it is what ships). Serving both
   from one origin is how production works too (Vercel forwards /api), so the
   session cookies behave exactly as they will for real.

   Its own database: a fresh in-memory MongoDB on a random port with the demo
   data seeded, thrown away when the process stops. It never touches .data/,
   never uses the dev ports (4600, 5190, 27031), and never starts the
   background jobs. The environment is the tests' own (tests/helpers/
   setup-env.ts): no SMTP, so sign-in codes are shown on screen, and no payment
   keys, so card payments are simulated.
--------------------------------------------------------------------------- */
import '../tests/helpers/setup-env'
import express from 'express'
import mongoose from 'mongoose'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoMemoryServer } from 'mongodb-memory-server'

process.env.RUN_JOBS = '0'
const PORT = Number(process.env.E2E_PORT || 5191)
const MODE = process.env.E2E_MODE === 'dist' ? 'dist' : 'vite'

async function main() {
  const mongo = await MongoMemoryServer.create()
  await import('../server/db')
  const { env } = await import('../server/env')
  env.mongoUri = mongo.getUri('aa-e2e')
  await mongoose.connect(env.mongoUri)

  const { seedAll } = await import('../server/seed/seed')
  const t0 = Date.now()
  await seedAll()
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()))
  console.log(`[e2e] seeded in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

  const { createApp } = await import('../server/app')
  const app = express()

  /* The real text of the last outbox email to each address, for tests that
     follow a link the email log (rightly) never shows — a fundraiser's
     confirmation link, say. This process only: it is not part of the app. */
  const { tapOutbox } = await import('../server/lib/email')
  const lastMail = new Map<string, { subject: string; html: string }>()
  tapOutbox((to, email) => lastMail.set(to.toLowerCase(), { subject: email.subject, html: email.html }))
  app.get('/__e2e/mail', (req, res) => {
    const mail = lastMail.get(String(req.query.to ?? '').toLowerCase())
    if (!mail) return void res.status(404).json({ error: 'no mail to that address yet' })
    res.json(mail)
  })

  /* The background jobs are off here (RUN_JOBS=0), so a test that needs one
     to happen asks for it: the campaign queue run until it is empty. */
  const { processCampaignQueue } = await import('../server/jobs/campaigns')
  const { Campaign, Donor, Plan } = await import('../server/models')
  app.post('/__e2e/run/campaigns', async (_req, res) => {
    /* "Send now" starts the first batch itself, and the queue skips a run
       while another is going — so keep asking, a moment apart, until nothing
       is sending (or half a minute has passed) */
    const until = Date.now() + 30_000
    while (Date.now() < until && (await Campaign.exists({ status: 'sending' }))) {
      await processCampaignQueue()
      await new Promise((r) => setTimeout(r, 100))
    }
    res.json({ ok: !(await Campaign.exists({ status: 'sending' })) })
  })

  /* A donor's regular donation whose last payment was declined — the state a
     "fix your card" email sends them to. The first live plan of the address. */
  app.post('/__e2e/plan/failing', express.json(), async (req, res) => {
    const donor = await Donor.findOne({ email: String(req.body?.email ?? '').toLowerCase() })
    const plan = donor && (await Plan.findOne({ donor: donor._id, status: { $in: ['active', 'past_due'] } }).sort({ createdAt: 1 }))
    if (!plan) return void res.status(404).json({ error: 'no live plan for that address' })
    await Plan.updateOne(
      { _id: plan._id },
      {
        $set: {
          status: 'past_due',
          'payment.last4': '0002',
          failure: { count: 1, lastError: 'Your card was declined.', firstFailedAt: new Date(), nextRetryAt: new Date(Date.now() + 2 * 86_400_000) },
        },
        $unset: { chargingAt: 1, pendingCharge: 1 },
      },
    )
    res.json({ id: String(plan._id), number: plan.number })
  })

  /* A pretend PayPal on this same server, so the PayPal flow can be followed
     in a browser without a sandbox account. lib/payments.ts calls it over
     HTTP exactly as it calls PayPal (env.paypal.api below); card payments stay
     simulated (there is no Stripe key here). The approval page stands in for
     PayPal's: Approve goes to the order's return URL with token and PayerID
     added, as PayPal does; Cancel to its cancel URL. Both are followed on this
     server's own address (APP_URL is the dev port in tests). What the next
     capture does is set by POST /__e2e/paypal/next. */
  type FakeOrder = { id: string; value: string; returnUrl: string; cancelUrl: string; outcome: 'complete' | 'pending' | 'declined'; captured?: 'COMPLETED' | 'PENDING' }
  const orders = new Map<string, FakeOrder>()
  let nextOutcome: FakeOrder['outcome'] = 'complete'
  let orderN = 1
  const fakeBase = `http://127.0.0.1:${PORT}/__fakepaypal`
  env.paypal = { id: 'e2e-client', secret: 'e2e-secret', api: fakeBase, webhookId: '' }
  const orderBody = (o: FakeOrder) => ({
    id: o.id,
    status: o.captured ? 'COMPLETED' : 'APPROVED',
    purchase_units: [o.captured ? { payments: { captures: [{ id: `CAP-${o.id}`, status: o.captured, amount: { currency_code: 'AUD', value: o.value } }] } } : {}],
  })
  const local = (u: string) => {
    const url = new URL(u)
    return url.pathname + url.search
  }
  app.post('/__e2e/paypal/next', express.json(), (req, res) => {
    const c = String(req.body?.capture ?? '')
    if (c !== 'complete' && c !== 'pending' && c !== 'declined') return void res.status(400).json({ error: 'complete, pending or declined' })
    nextOutcome = c
    res.json({ ok: true })
  })
  app.post('/__fakepaypal/v1/oauth2/token', (_req, res) => void res.json({ access_token: 'e2e-token', expires_in: 3600 }))
  app.post('/__fakepaypal/v2/checkout/orders', express.json(), (req, res) => {
    const unit = req.body?.purchase_units?.[0]
    const ctx = req.body?.application_context ?? {}
    const o: FakeOrder = { id: `E2E-ORDER-${orderN++}`, value: String(unit?.amount?.value ?? '0'), returnUrl: ctx.return_url, cancelUrl: ctx.cancel_url, outcome: nextOutcome }
    nextOutcome = 'complete'
    orders.set(o.id, o)
    res.status(201).json({ id: o.id, status: 'CREATED', links: [{ rel: 'approve', href: `${fakeBase}/approve?token=${o.id}` }] })
  })
  app.get('/__fakepaypal/approve', (req, res) => {
    const o = orders.get(String(req.query.token ?? ''))
    if (!o) return void res.status(404).send('No such order')
    const back = `${local(o.returnUrl)}${o.returnUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(o.id)}&PayerID=E2EPAYER`
    res.type('html').send(
      `<!doctype html><title>Pretend PayPal</title><h1>Pretend PayPal</h1><p>Pay $${o.value} AUD to Al-Anwaar?</p>` +
        `<a id="approve" href="${back}">Approve</a> <a id="cancel" href="${local(o.cancelUrl)}">Cancel and return</a>`,
    )
  })
  app.post('/__fakepaypal/v2/checkout/orders/:id/capture', (req, res) => {
    const o = orders.get(req.params.id)
    if (!o) return void res.status(404).json({ name: 'RESOURCE_NOT_FOUND' })
    if (o.captured) return void res.status(422).json({ name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] })
    if (o.outcome === 'declined') {
      return void res.status(422).json({ name: 'UNPROCESSABLE_ENTITY', message: 'The instrument presented was declined.', details: [{ issue: 'INSTRUMENT_DECLINED' }] })
    }
    o.captured = o.outcome === 'pending' ? 'PENDING' : 'COMPLETED'
    res.status(201).json(orderBody(o))
  })
  app.get('/__fakepaypal/v2/checkout/orders/:id', (req, res) => {
    const o = orders.get(req.params.id)
    if (!o) return void res.status(404).json({ name: 'RESOURCE_NOT_FOUND' })
    res.json(orderBody(o))
  })
  /* the API answers /api/*; anything else falls through to the site */
  app.use(createApp())

  if (MODE === 'dist') {
    const dist = resolve('dist')
    if (!existsSync(resolve(dist, 'index.html'))) throw new Error('E2E_MODE=dist but dist/ has no build — run `npm run build` first')
    app.use(express.static(dist, { index: false }))
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(resolve(dist, 'index.html')))
  } else {
    const { createServer } = await import('vite')
    const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'spa' })
    app.use(vite.middlewares)
  }

  const server = app.listen(PORT, '127.0.0.1', () => console.log(`[e2e] ${MODE} site and API on http://127.0.0.1:${PORT}`))

  const stop = async () => {
    server.close()
    await mongoose.disconnect().catch(() => {})
    await mongo.stop().catch(() => {})
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
