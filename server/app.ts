import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { timingSafeEqual } from 'node:crypto'
import mongoose from 'mongoose'
import { env } from './env'
import { jobHealth } from './jobs/scheduler'
import { API_CSP, SITE_HEADERS } from './security-headers'
import { csrfGuard } from './lib/auth'
import { errorHandler, HttpError } from './lib/http'

import authRoutes from './routes/auth'
import publicRoutes from './routes/public'
import recentGiftRoutes from './routes/recent-gifts'
import webhookRoutes from './routes/webhooks'
import fileRoutes from './routes/files'
import donorRoutes from './routes/donor'
import adminRoutes from './routes/admin'
import complianceRoutes from './routes/compliance'
import unsubscribeRoutes from './routes/unsubscribe'

/* ---------------------------------------------------------------------------
   The API, mounted under /api:

     /api/health       is the database answering, and are the jobs running
     /api/live         is the process up (no database check)
     /api/auth         sign-in for donors (email code, Google, Facebook) and staff
     /api/public       what the website needs: appeals, checkout, forms
     /api/public/unsubscribe   campaign unsubscribe; token-only, no CSRF header
     /api/webhooks     Stripe and PayPal, raw body, without the CSRF header
     /api/files        uploaded files, with the permissions of what they belong to
     /api/me           the donor portal — only ever the signed-in donor's own data
     /api/admin        the admin portal, every route behind a permission
     /api/compliance   the compliance portal, likewise

   In production the same process can also serve the built site from dist/,
   so the whole platform can be one deployable; the hosting in use (Vercel for
   the site, Render for this) is described in CLAUDE.md.

   ONLY THROUGH THE FRONT DOOR (ORIGIN_SECRET). The site's host forwards /api
   to this server, and adds a secret header on the way (middleware.ts at the
   repo root). Without a check, the API could also be called directly at its
   own address, skipping the host — and then X-Forwarded-For is whatever the
   caller writes, so every rate limit keyed on the visitor's IP could be reset
   at will. With ORIGIN_SECRET set, /api answers only requests carrying it.
   Exempt: the health checks (Render calls them directly) and the Stripe and
   PayPal webhooks (each provider's requests are verified on their own, and
   may be pointed at either address).
--------------------------------------------------------------------------- */

export function createApp() {
  const app = express()
  /* how many proxies stand in front: 1 behind a load balancer, 2 when the
     site's host (Vercel) forwards /api to it as well, so client IPs, and
     with them the rate limits, stay per visitor */
  app.set('trust proxy', env.trustProxy)
  app.disable('x-powered-by')
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))
  /* the API allows nothing; the site's own policy is set where it is served,
     below. A route that sends something else (a file, the unsubscribe page)
     sets its own. */
  app.use('/api', (_req, res, next) => {
    res.setHeader('Content-Security-Policy', API_CSP)
    next()
  })

  /* the webhooks need the raw body (Stripe's signature is over the exact
     bytes), so they are mounted before the JSON parser — and before the
     origin check */
  app.use('/api/webhooks', express.raw({ type: 'application/json', limit: '1mb' }), webhookRoutes)

  /* the health checks answer whoever asks, and need no body or cookies */
  app.get('/api/live', (_req, res) => {
    res.json({ ok: true })
  })
  app.get('/api/health', async (_req, res) => {
    const h = await health()
    res.status(h.ok ? 200 : 503).json(h)
  })

  if (env.originSecret) app.use('/api', originGate(env.originSecret))

  /* unsubscribing is answered for mail apps and link-less browsers alike, so
     it sits ahead of the CSRF check (see routes/unsubscribe.ts) */
  app.use('/api/public/unsubscribe', unsubscribeRoutes)

  app.use(express.json({ limit: '2mb' }))
  app.use(cookieParser())

  const api = express.Router()
  api.use(csrfGuard)
  api.use('/auth', authRoutes)
  api.use('/public', recentGiftRoutes)
  api.use('/public', publicRoutes)
  api.use('/files', fileRoutes)
  api.use('/me', donorRoutes)
  api.use('/admin', adminRoutes)
  api.use('/compliance', complianceRoutes)
  api.use(() => {
    throw new HttpError(404, 'No such endpoint.')
  })
  app.use('/api', api)

  const dist = resolve('dist')
  if (env.isProd && existsSync(dist)) {
    const site = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
      for (const [k, v] of Object.entries(SITE_HEADERS)) res.setHeader(k, v)
      next()
    }
    app.use(site, express.static(dist, { index: false, maxAge: '1h' }))
    app.get(/^(?!\/api\/).*/, site, (_req, res) => res.sendFile(resolve(dist, 'index.html')))
  }

  app.use(errorHandler)
  return app
}

function originGate(secret: string) {
  const want = Buffer.from(secret)
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const got = Buffer.from(String(req.get('x-origin-auth') ?? ''))
    if (got.length === want.length && timingSafeEqual(got, want)) return next()
    res.status(403).json({ error: { message: 'Use the site address, not the API server directly.' } })
  }
}

/** The database must answer a ping within two seconds, or the check fails (503)
 *  and Render restarts the instance. The jobs are reported but never fail it:
 *  a job that has stopped succeeding is an [alert], not a reason to restart. */
async function health() {
  const db = mongoose.connection.readyState === 1
    ? await Promise.race([
        mongoose.connection.db!.admin().ping().then(() => true, () => false),
        new Promise<false>((r) => setTimeout(() => r(false), 2000).unref()),
      ])
    : false
  const jobs = jobHealth()
  const plansOk = jobs.jobs.plans?.lastOkAt
  /* the plans job runs every five minutes; three missed runs is worth a look */
  const stale = jobs.enabled && jobs.leader && (!plansOk || Date.now() - Date.parse(plansOk) > 15 * 60_000)
  /* the endpoint is public (Render and the uptime monitor call it without the
     origin secret), so it says when each job last worked or failed, never
     why: an error message can carry data — a duplicate-key error names the
     value. The reason is in the [alert] log line. */
  const when = Object.fromEntries(
    Object.entries(jobs.jobs).map(([name, s]) => [name, { lastOkAt: s.lastOkAt, lastErrorAt: s.lastErrorAt }]),
  )
  return {
    ok: db,
    db: db ? 'up' : 'down',
    jobs: { enabled: jobs.enabled, leader: jobs.leader, jobs: when, degraded: Boolean(stale && process.uptime() > 15 * 60) },
  }
}
