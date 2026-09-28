import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { env } from './env'
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

/* ---------------------------------------------------------------------------
   The API, mounted under /api:

     /api/auth         sign-in for donors (email code, Google, Facebook) and staff
     /api/public       what the website needs: appeals, checkout, forms
     /api/webhooks     Stripe, raw body, the one route without the CSRF header
     /api/files        uploaded files, with the permissions of what they belong to
     /api/me           the donor portal — only ever the signed-in donor's own data
     /api/admin        the admin portal, every route behind a permission
     /api/compliance   the compliance portal, likewise

   In production the same process serves the built site from dist/, so the
   whole platform is one deployable on AWS.
--------------------------------------------------------------------------- */

export function createApp() {
  const app = express()
  /* how many proxies stand in front: 1 behind a load balancer, 2 when the
     site's host (Vercel) forwards /api to it as well, so client IPs, and
     with them the rate limits, stay per visitor */
  app.set('trust proxy', env.trustProxy)
  app.disable('x-powered-by')
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))

  /* the webhook needs the raw body to check Stripe's signature, so it is
     mounted before the JSON parser */
  app.use('/api/webhooks', express.raw({ type: 'application/json', limit: '1mb' }), webhookRoutes)

  app.use(express.json({ limit: '2mb' }))
  app.use(cookieParser())

  const api = express.Router()
  api.use(csrfGuard)
  api.get('/health', (_req, res) => {
    res.json({ ok: true })
  })
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
    app.use(express.static(dist, { index: false, maxAge: '1h' }))
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(resolve(dist, 'index.html')))
  }

  app.use(errorHandler)
  return app
}
