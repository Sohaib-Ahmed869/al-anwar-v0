import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/* ---------------------------------------------------------------------------
   Runs before every test file (vitest `setupFiles`), before any server module
   is imported, so server/env.ts reads a clean, known environment:

     - no SMTP, Stripe, PayPal, S3 or OAuth keys, whatever a developer's own
       .env says: email goes to the outbox and payments are simulated;
     - a fixed JWT secret and a throwaway DATA_DIR, so a test never touches
       .data/ and never reuses the dev database on port 27031;
     - NODE_ENV=test, which the server treats like development.

   The process clock is left in UTC on purpose — that is what Render runs — so
   any date code that quietly relies on the machine's time zone shows up here.
--------------------------------------------------------------------------- */

const blank = [
  'MONGODB_URI', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID',
  'S3_BUCKET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET',
  'SEED_RESET', 'SEED_DEMO', 'ORIGIN_SECRET', 'STRICT_LIMITS',
]
for (const k of blank) process.env[k] = ''

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-0123456789abcdef0123456789abcdef'
process.env.APP_URL = 'http://localhost:5190'
process.env.DATA_DIR ||= mkdtempSync(join(tmpdir(), 'aa-test-'))
