/* ---------------------------------------------------------------------------
   THE CHARITY'S CLOCK. Before anything else: this process keeps time in
   Australia/Sydney, whatever the machine says.

   Al-Anwaar's financial year runs 1 July to 30 June in Sydney, a tax receipt
   carries the date the gift was given in Sydney, and "the 1st of the month"
   for a regular donation is the 1st in Sydney. The server code does that
   arithmetic with local-time Date methods and date-fns, which use the
   process's zone — and Render's machines run in UTC. There, a gift at 9am on
   1 July was filed in the previous financial year, staff could not enter
   "today" before 10am, and receipts showed yesterday's date. Setting TZ here,
   in the first module every entry point imports and before any date is made,
   makes every one of those calculations Sydney's, everywhere at once.
   render.yaml sets TZ as well, so the logs agree.

   (Code that also runs in the browser — shared/domain.ts — does not rely on
   this; it names the zone explicitly, because a donor's browser can be
   anywhere.)
--------------------------------------------------------------------------- */
process.env.TZ = 'Australia/Sydney'

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

/* Reads .env if there is one (Node's own loader, no dotenv), and says in one
   place what the server is running against. Everything has a development
   default.

   PRODUCTION REFUSES TO START HALF-CONFIGURED. Without a payment provider the
   platform simulates payments — and a simulated payment used to issue a real
   DGR receipt for money that never moved. Without SMTP, receipts and sign-in
   codes were "sent" to an outbox nobody reads. So with NODE_ENV=production
   the server stops at start-up, listing everything missing, unless it has:

     JWT_SECRET, APP_URL
     STRIPE_SECRET_KEY        a live key (sk_live_…), not a test one
     STRIPE_WEBHOOK_SECRET    without it card gifts stay pending for ever
     SMTP_HOST                where email actually goes
     PAYPAL_API               the live endpoint, if PayPal keys are set
     PAYPAL_WEBHOOK_ID        likewise: refunds and held payments arrive by it

   A staging deploy that is meant to simulate sets ALLOW_SIMULATED_PAYMENTS=1:
   the payment and email checks are waived (JWT_SECRET and APP_URL are not),
   and a banner says so in the log on every start. */

if (existsSync('.env')) process.loadEnvFile('.env')

const e = process.env
const isProd = e.NODE_ENV === 'production'
const allowSimulated = e.ALLOW_SIMULATED_PAYMENTS === '1'
const PAYPAL_LIVE = 'https://api-m.paypal.com'
const PAYPAL_SANDBOX = 'https://api-m.sandbox.paypal.com'

/** A live Stripe secret: a full key (sk_live_) or a restricted one (rk_live_),
 *  which is the least-privilege option Stripe recommends. */
export const isLiveStripeKey = (key: string | undefined) => /^(sk|rk)_live_/.test(key ?? '')

export function productionProblems(v: NodeJS.ProcessEnv = e): string[] {
  const out: string[] = []
  if (!v.JWT_SECRET) out.push('JWT_SECRET must be set')
  if (!v.APP_URL) out.push('APP_URL must be set (the public site address, used in emailed links)')
  /* demo data — invented donors and six staff logins with a published
     password — belongs only on a deploy that is also declared staging, so
     going live (dropping ALLOW_SIMULATED_PAYMENTS) cannot keep it (finding C1) */
  if (v.SEED_DEMO === '1' && v.ALLOW_SIMULATED_PAYMENTS !== '1') {
    out.push('SEED_DEMO=1 is only allowed on a staging deploy (ALLOW_SIMULATED_PAYMENTS=1); set SEED_DEMO=0 for production')
  }
  if (v.ALLOW_SIMULATED_PAYMENTS === '1') return out
  if (!v.STRIPE_SECRET_KEY) out.push('STRIPE_SECRET_KEY must be set')
  else if (!isLiveStripeKey(v.STRIPE_SECRET_KEY)) out.push('STRIPE_SECRET_KEY must be a live key (sk_live_… or a restricted rk_live_…)')
  if (!v.STRIPE_WEBHOOK_SECRET) out.push('STRIPE_WEBHOOK_SECRET must be set')
  if (!v.SMTP_HOST) out.push('SMTP_HOST must be set')
  if (v.PAYPAL_CLIENT_ID && v.PAYPAL_CLIENT_SECRET && (v.PAYPAL_API || PAYPAL_LIVE) !== PAYPAL_LIVE) {
    out.push(`PAYPAL_API must be ${PAYPAL_LIVE} (the live endpoint)`)
  }
  /* without its webhook a PayPal refund or reversal never reaches the books */
  if (v.PAYPAL_CLIENT_ID && v.PAYPAL_CLIENT_SECRET && !v.PAYPAL_WEBHOOK_ID) out.push('PAYPAL_WEBHOOK_ID must be set when PayPal is connected')
  return out
}

if (isProd) {
  const problems = productionProblems()
  if (problems.length) {
    throw new Error(
      `Refusing to start in production:\n  - ${problems.join('\n  - ')}\n` +
        'Set them, or for a staging deploy that should simulate payments, set ALLOW_SIMULATED_PAYMENTS=1.',
    )
  }
  if (allowSimulated) {
    console.warn(
      [
        '[env] ************************************************************',
        '[env] ALLOW_SIMULATED_PAYMENTS=1 — THIS IS A STAGING DEPLOY.',
        '[env] Payments may be simulated and email may not be sent.',
        '[env] Simulated gifts are marked and are never real tax receipts.',
        '[env] Remove it before real donors use this site.',
        '[env] ************************************************************',
      ].join('\n'),
    )
  }
}

function devSecret() {
  const dir = e.DATA_DIR || '.data'
  const file = `${dir}/dev-jwt-secret`
  if (existsSync(file)) return readFileSync(file, 'utf8').trim()
  mkdirSync(dir, { recursive: true })
  const s = randomBytes(32).toString('hex')
  writeFileSync(file, s)
  return s
}

export const env = {
  isProd,
  port: Number(e.PORT || 4600),
  appUrl: (e.APP_URL || 'http://localhost:5190').replace(/\/$/, ''),
  /* in development, a secret generated once and kept in .data/ so a restart
     (tsx watch restarts on every save) does not sign everyone out; production
     refuses to start without JWT_SECRET, above */
  jwtSecret: e.JWT_SECRET || devSecret(),
  mongoUri: e.MONGODB_URI || '',
  seedReset: e.SEED_RESET === '1',
  /** seed the invented demo data into an empty production database (staging only) */
  seedDemo: e.SEED_DEMO === '1',
  /** a staging deploy that may simulate payments and keep email in the outbox */
  allowSimulated: isProd && allowSimulated,
  smtp: e.SMTP_HOST
    ? { host: e.SMTP_HOST, port: Number(e.SMTP_PORT || 587), user: e.SMTP_USER || '', pass: e.SMTP_PASS || '' }
    : null,
  stripe: e.STRIPE_SECRET_KEY ? { key: e.STRIPE_SECRET_KEY, webhookSecret: e.STRIPE_WEBHOOK_SECRET || '' } : null,
  paypal: e.PAYPAL_CLIENT_ID && e.PAYPAL_CLIENT_SECRET
    ? { id: e.PAYPAL_CLIENT_ID, secret: e.PAYPAL_CLIENT_SECRET, api: e.PAYPAL_API || (isProd && !allowSimulated ? PAYPAL_LIVE : PAYPAL_SANDBOX), webhookId: e.PAYPAL_WEBHOOK_ID || '' }
    : null,
  s3: e.S3_BUCKET ? { bucket: e.S3_BUCKET, region: e.S3_REGION || 'ap-southeast-2' } : null,
  google: e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET ? { id: e.GOOGLE_CLIENT_ID, secret: e.GOOGLE_CLIENT_SECRET } : null,
  facebook: e.FACEBOOK_APP_ID && e.FACEBOOK_APP_SECRET ? { id: e.FACEBOOK_APP_ID, secret: e.FACEBOOK_APP_SECRET } : null,
  dataDir: e.DATA_DIR || '.data',
  trustProxy: Number(e.TRUST_PROXY || 1),
  /** shared with the site's host (Vercel); when set, /api answers only
   *  requests that carry it in X-Origin-Auth — see server/app.ts */
  originSecret: e.ORIGIN_SECRET || '',
  /** RUN_JOBS=0 keeps the background jobs off in this process */
  runJobs: e.RUN_JOBS !== '0',
}

/** True when payments are not connected to a real provider. The portals show
 *  a "simulated" chip whenever this is on, so nobody mistakes it for money. */
export const paymentsSimulated = !env.stripe
