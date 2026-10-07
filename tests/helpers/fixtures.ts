import type { Role } from '../../shared/access'

/* ---------------------------------------------------------------------------
   Names the demo seed (server/seed/seed.ts) is known to create, so tests can
   sign in as each role without repeating the addresses everywhere.
--------------------------------------------------------------------------- */

export const STAFF_BY_ROLE: Record<Role, string> = {
  owner: 'yusuf@alanwaar.group',
  admin: 'maryam@alanwaar.group',
  finance: 'omar@alanwaar.group',
  fundraising: 'fatima@alanwaar.group',
  compliance: 'khalid@alanwaar.group',
  volunteer: 'bilal@alanwaar.group',
}

/** the seeded donor with a full giving history, plans and receipts */
export const DONOR = 'amina.rahman@example.com'

/** an open appeal in the seed (src/components/appeals-data.ts) */
export const OPEN_APPEAL = 'gaza-emergency'

/** a well-formed id that matches nothing */
export const NO_SUCH_ID = '0123456789abcdef01234567'

let n = 0
/** a fresh, unique email address for a test donor */
export const freshEmail = (tag = 'donor') => `${tag}.${Date.now().toString(36)}.${(n++).toString(36)}@example.com`
