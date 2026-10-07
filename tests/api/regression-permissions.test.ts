import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { can, ROLE_KEYS, type Role } from '../../shared/access'
import type { Permission } from '../../shared/access'
import { startApi, type Api } from '../helpers/server'
import type { Client } from '../helpers/client'
import { NO_SUCH_ID, STAFF_BY_ROLE } from '../helpers/fixtures'

/* ---------------------------------------------------------------------------
   The permissions matrix: every role in shared/access.ts against a
   representative set of admin and compliance routes.

   The expectations are not written out per role. Each route says which
   permissions it needs (as server/routes/admin/* and compliance/* ask for
   them), and the test works out from the live ROLES table whether each role
   should get in. So when a role gains or loses a permission (the volunteer
   losing donors.read, H2), the test follows the table — and what it proves is
   that the server enforces exactly what the table says, the same table the
   portals use to decide what to draw.

   "Allowed" means: not 401, not 403, and no 500. Detail routes are called with
   an id that matches nothing, and writes with an empty body, so an allowed
   call ends in a 404 or a 400 and nothing in the database changes.
--------------------------------------------------------------------------- */

type Need = { all?: Permission[]; any?: Permission[] }
type Route = { method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string; need: Need; body?: unknown }

const X = NO_SUCH_ID
const get = (path: string, need: Need): Route => ({ method: 'GET', path, need })
const write = (method: Route['method'], path: string, need: Need): Route => ({ method, path, need, body: {} })

const ADMIN: Route[] = [
  get('/api/admin/dashboard', { all: ['dashboard.view'] }),
  get('/api/admin/dashboard/badges', {}),
  get('/api/admin/donors', { all: ['donors.read'] }),
  get('/api/admin/donors/counts', { all: ['donors.read'] }),
  get('/api/admin/donors/export', { all: ['donors.export'] }),
  get('/api/admin/donors/duplicates', { all: ['donors.merge'] }),
  get(`/api/admin/donors/${X}`, { all: ['donors.read'] }),
  get(`/api/admin/donors/${X}/gifts`, { all: ['donors.read'] }),
  get(`/api/admin/donors/${X}/emails`, { all: ['donors.read'] }),
  write('POST', '/api/admin/donors', { all: ['donors.write'] }),
  write('PATCH', `/api/admin/donors/${X}`, { all: ['donors.write'] }),
  write('POST', '/api/admin/donors/merge', { all: ['donors.merge'] }),
  get('/api/admin/gifts', { any: ['gifts.read', 'gifts.create'] }),
  get('/api/admin/gifts/export', { all: ['gifts.read', 'reports.export'] }),
  get(`/api/admin/gifts/${X}`, { any: ['gifts.read', 'gifts.create'] }),
  write('POST', '/api/admin/gifts/offline', { all: ['gifts.create'] }),
  write('PATCH', `/api/admin/gifts/${X}`, { all: ['gifts.manage'] }),
  write('POST', `/api/admin/gifts/${X}/refund`, { all: ['gifts.manage'] }),
  write('POST', `/api/admin/gifts/${X}/received`, { all: ['gifts.manage'] }),
  get('/api/admin/plans', { all: ['plans.manage'] }),
  get(`/api/admin/plans/${X}`, { all: ['plans.manage'] }),
  write('POST', `/api/admin/plans/${X}/pause`, { all: ['plans.manage'] }),
  get('/api/admin/appeals', { any: ['appeals.manage', 'gifts.read', 'gifts.create', 'plans.manage', 'bank.import', 'reports.read'] }),
  get(`/api/admin/appeals/${X}`, { all: ['appeals.manage'] }),
  write('POST', '/api/admin/appeals', { all: ['appeals.manage'] }),
  get('/api/admin/quick-give', { all: ['appeals.manage'] }),
  get('/api/admin/fundraisers', { all: ['fundraisers.approve'] }),
  write('POST', `/api/admin/fundraisers/${X}/review`, { all: ['fundraisers.approve'] }),
  get('/api/admin/campaigns', { all: ['campaigns.manage'] }),
  write('POST', '/api/admin/campaigns', { all: ['campaigns.manage'] }),
  get('/api/admin/enquiries', { all: ['enquiries.manage'] }),
  get(`/api/admin/enquiries/${X}`, { all: ['enquiries.manage'] }),
  get('/api/admin/bank/imports', { all: ['bank.import'] }),
  get('/api/admin/reports/income', { all: ['reports.read'] }),
  get('/api/admin/reports/receipts', { all: ['reports.read'] }),
  get('/api/admin/reports/income.csv', { all: ['reports.read', 'reports.export'] }),
  get('/api/admin/reports/xero', { all: ['reports.read', 'reports.export'] }),
  get('/api/admin/staff', { all: ['staff.manage'] }),
  write('POST', '/api/admin/staff/invite', { all: ['staff.manage'] }),
  get('/api/admin/settings', { all: ['settings.manage'] }),
  write('PUT', '/api/admin/settings/org', { all: ['settings.manage'] }),
  get('/api/admin/activity', { all: ['audit.read'] }),
  get('/api/admin/emails', { all: ['settings.manage'] }),
]

/* everything under /api/compliance needs compliance.read to enter */
const C = (need: Need): Need => ({ all: ['compliance.read', ...(need.all ?? [])], any: need.any })
const COMPLIANCE: Route[] = [
  get('/api/compliance/overview', C({})),
  get('/api/compliance/registers', C({})),
  get('/api/compliance/registers/risks', C({})),
  write('POST', '/api/compliance/registers/risks', C({ all: ['compliance.write'] })),
  get('/api/compliance/obligations', C({})),
  write('POST', '/api/compliance/obligations', C({ all: ['compliance.write'] })),
  get('/api/compliance/documents', C({})),
  write('PATCH', `/api/compliance/documents/${X}`, C({ all: ['compliance.write'] })),
  get('/api/compliance/audit', C({ all: ['audit.read'] })),
  get('/api/compliance/reports/years', C({})),
]

const allows = (role: Role, need: Need) =>
  (need.all ?? []).every((p) => can(role, p)) && (!need.any?.length || need.any.some((p) => can(role, p)))

let api: Api
const as = {} as Record<Role, Client>

beforeAll(async () => {
  api = await startApi({ seed: 'demo' })
  for (const role of ROLE_KEYS) as[role] = await api.staff(STAFF_BY_ROLE[role])
})
afterAll(() => api?.stop())

describe.each(ROLE_KEYS)('as %s', (role) => {
  it.each([...ADMIN, ...COMPLIANCE].map((r) => [`${r.method} ${r.path}`, r] as const))('%s', async (_name, route) => {
    const res = await as[role].request(route.method, route.path, route.body)
    if (allows(role, route.need)) {
      expect(res.status, `${role} should be let in (${JSON.stringify(res.body)?.slice(0, 200)})`).not.toBe(401)
      expect(res.status).not.toBe(403)
      expect(res.status, 'an allowed call must not crash').toBeLessThan(500)
    } else {
      expect(res.status, `${role} should be refused`).toBe(403)
    }
  })
})

describe('signed out', () => {
  it.each([...ADMIN, ...COMPLIANCE].map((r) => [`${r.method} ${r.path}`, r] as const))('%s → 401', async (_name, route) => {
    const res = await api.client().request(route.method, route.path, route.body)
    expect(res.status).toBe(401)
  })
})
