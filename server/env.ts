import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

/* Reads .env if there is one (Node's own loader, no dotenv), and says in one
   place what the server is running against. Everything has a development
   default except JWT_SECRET in production, which refuses to start without. */

if (existsSync('.env')) process.loadEnvFile('.env')

const e = process.env
const isProd = e.NODE_ENV === 'production'

if (isProd && !e.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production')
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
  smtp: e.SMTP_HOST
    ? { host: e.SMTP_HOST, port: Number(e.SMTP_PORT || 587), user: e.SMTP_USER || '', pass: e.SMTP_PASS || '' }
    : null,
  stripe: e.STRIPE_SECRET_KEY ? { key: e.STRIPE_SECRET_KEY, webhookSecret: e.STRIPE_WEBHOOK_SECRET || '' } : null,
  paypal: e.PAYPAL_CLIENT_ID && e.PAYPAL_CLIENT_SECRET
    ? { id: e.PAYPAL_CLIENT_ID, secret: e.PAYPAL_CLIENT_SECRET, api: e.PAYPAL_API || 'https://api-m.sandbox.paypal.com' }
    : null,
  s3: e.S3_BUCKET ? { bucket: e.S3_BUCKET, region: e.S3_REGION || 'ap-southeast-2' } : null,
  google: e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET ? { id: e.GOOGLE_CLIENT_ID, secret: e.GOOGLE_CLIENT_SECRET } : null,
  facebook: e.FACEBOOK_APP_ID && e.FACEBOOK_APP_SECRET ? { id: e.FACEBOOK_APP_ID, secret: e.FACEBOOK_APP_SECRET } : null,
  dataDir: e.DATA_DIR || '.data',
  trustProxy: Number(e.TRUST_PROXY || 1),
}

/** True when payments are not connected to a real provider. The portals show
 *  a "simulated" chip whenever this is on, so nobody mistakes it for money. */
export const paymentsSimulated = !env.stripe
