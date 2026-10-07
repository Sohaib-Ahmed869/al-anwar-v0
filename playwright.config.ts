import { defineConfig, devices } from '@playwright/test'

/* ---------------------------------------------------------------------------
   Browser tests (tests/e2e), run by `npm run test:e2e`.

   scripts/e2e-server.ts serves the API and the site on one port against a
   fresh, seeded in-memory database. Locally the site comes from Vite in
   development mode; on CI (E2E_MODE=dist) from the production build, which
   the workflow builds first — so CI tests what ships.

   One worker: the tests share one database and some of them change it
   (approving a fundraiser, recording a gift). They are written to be
   independent of order, but one worker keeps a failure's cause readable.
--------------------------------------------------------------------------- */

const PORT = Number(process.env.E2E_PORT || 5191)
const CI = Boolean(process.env.CI)

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    /* the charity's donors and staff are in Sydney; a browser in another zone
       would hide the date bugs that only show in the morning there (H5) */
    timezoneId: 'Australia/Sydney',
    locale: 'en-AU',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx tsx scripts/e2e-server.ts',
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { E2E_PORT: String(PORT), ...(process.env.E2E_MODE ? { E2E_MODE: process.env.E2E_MODE } : {}) },
  },
})
