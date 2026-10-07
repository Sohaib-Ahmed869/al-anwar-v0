import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

/* SECURITY FINDINGS C2 and L9. Production refuses to start half-configured —
   no live Stripe key, no webhook secret, no SMTP, a sandbox PayPal — unless
   ALLOW_SIMULATED_PAYMENTS=1 says this is staging. Each case starts a real
   Node process that loads server/env.ts with NODE_ENV=production, because the
   check runs once, at import. */

const KEYS = [
  'JWT_SECRET', 'APP_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SMTP_HOST',
  'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_API', 'PAYPAL_WEBHOOK_ID', 'ALLOW_SIMULATED_PAYMENTS', 'MONGODB_URI',
]

function boot(vars: Record<string, string>) {
  /* every key set, if only to '' — a developer's own .env is loaded by
     env.ts and would otherwise fill in whatever this leaves unset */
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'production' }
  for (const k of [...KEYS, 'SMTP_USER', 'SMTP_PASS', 'S3_BUCKET', 'ORIGIN_SECRET']) env[k] = ''
  Object.assign(env, vars)
  const r = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', "await import('./server/env.ts'); console.log('STARTED', process.env.TZ)"],
    { env, encoding: 'utf8', timeout: 60_000 },
  )
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` }
}

const BASE = { JWT_SECRET: 'x'.repeat(40), APP_URL: 'https://alanwaar.example' }
const LIVE = { ...BASE, STRIPE_SECRET_KEY: 'sk_live_abc', STRIPE_WEBHOOK_SECRET: 'whsec_abc', SMTP_HOST: 'email-smtp.ap-southeast-2.amazonaws.com' }

describe('production start-up checks', () => {
  it('refuses with nothing configured, and lists what is missing', () => {
    const r = boot({ JWT_SECRET: 'x'.repeat(40) })
    expect(r.code).not.toBe(0)
    expect(r.out).toContain('Refusing to start in production')
    for (const m of ['APP_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SMTP_HOST']) expect(r.out).toContain(m)
  }, 60_000)

  it('refuses a Stripe test key', () => {
    const r = boot({ ...LIVE, STRIPE_SECRET_KEY: 'sk_test_abc' })
    expect(r.code).not.toBe(0)
    expect(r.out).toContain('live key')
  }, 60_000)

  it('refuses a key without its webhook secret', () => {
    const r = boot({ ...LIVE, STRIPE_WEBHOOK_SECRET: '' })
    expect(r.code).not.toBe(0)
    expect(r.out).toContain('STRIPE_WEBHOOK_SECRET')
  }, 60_000)

  it('refuses PayPal keys pointed at the sandbox', () => {
    const r = boot({ ...LIVE, PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'secret', PAYPAL_API: 'https://api-m.sandbox.paypal.com' })
    expect(r.code).not.toBe(0)
    expect(r.out).toContain('PAYPAL_API')
  }, 60_000)

  it('refuses PayPal keys without the webhook id refunds arrive by', () => {
    const r = boot({ ...LIVE, PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'secret' })
    expect(r.code).not.toBe(0)
    expect(r.out).toContain('PAYPAL_WEBHOOK_ID')
  }, 60_000)

  it('starts when everything is live, in Sydney time', () => {
    const r = boot({ ...LIVE, PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'secret', PAYPAL_WEBHOOK_ID: 'WH-1' })
    expect(r.out).toContain('STARTED Australia/Sydney')
    expect(r.code).toBe(0)
  }, 60_000)

  it('starts a staging deploy with ALLOW_SIMULATED_PAYMENTS=1, and says so loudly', () => {
    const r = boot({ ...BASE, ALLOW_SIMULATED_PAYMENTS: '1' })
    expect(r.code).toBe(0)
    expect(r.out).toContain('STARTED')
    expect(r.out).toContain('ALLOW_SIMULATED_PAYMENTS=1')
  }, 60_000)

  it('still needs JWT_SECRET and APP_URL on staging', () => {
    const r = boot({ ALLOW_SIMULATED_PAYMENTS: '1' })
    expect(r.code).not.toBe(0)
    expect(r.out).toContain('JWT_SECRET')
    expect(r.out).toContain('APP_URL')
  }, 60_000)
})
