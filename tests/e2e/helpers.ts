import { expect, type Page } from '@playwright/test'

/* ---------------------------------------------------------------------------
   Shared steps for the browser tests. Signing in through the form is tested
   once per portal (auth.spec.ts); everywhere else these sign in through the
   API with the browser's own request context, which shares its cookies, so a
   test starts where it means to start.
--------------------------------------------------------------------------- */

export const PASSWORD = 'alanwaar-demo'
export const STAFF = {
  owner: 'yusuf@alanwaar.group',
  admin: 'maryam@alanwaar.group',
  finance: 'omar@alanwaar.group',
  fundraising: 'fatima@alanwaar.group',
  compliance: 'khalid@alanwaar.group',
  volunteer: 'bilal@alanwaar.group',
} as const
export const DONOR = 'amina.rahman@example.com'

const headers = { 'X-Requested-With': 'aa' }

export async function signInStaff(page: Page, email: string) {
  const res = await page.request.post('/api/auth/staff/login', { headers, data: { email, password: PASSWORD, remember: true } })
  expect(res.status(), await res.text()).toBe(200)
}

export async function signInDonor(page: Page, email = DONOR) {
  const sent = await page.request.post('/api/auth/donor/code', { headers, data: { email } })
  const { devCode } = await sent.json()
  expect(devCode, 'the dev code comes back without SMTP').toBeTruthy()
  const res = await page.request.post('/api/auth/donor/verify', { headers, data: { email, code: devCode } })
  expect(res.status(), await res.text()).toBe(200)
}

let n = 0
export const freshEmail = (tag = 'e2e') => `${tag}.${Date.now().toString(36)}.${(n++).toString(36)}@example.com`

/* A resource that failed below HTTP — the socket, the network — says something
   about the machine running the tests, not the app: the app's own failures
   come back as an HTTP status, which is still caught. Seen on Windows as an
   occasional ERR_SOCKET_NOT_CONNECTED mid-run. */
const CONNECTIVITY = /^Failed to load resource: net::ERR_(SOCKET_NOT_CONNECTED|NETWORK_CHANGED|INTERNET_DISCONNECTED|CONNECTION_RESET)\b/

/** collects console errors and failed requests, for an assertion at the end */
export function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !CONNECTIVITY.test(m.text())) errors.push(`console: ${m.text()}`)
  })
  return errors
}
