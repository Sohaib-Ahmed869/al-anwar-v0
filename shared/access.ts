/* ---------------------------------------------------------------------------
   Staff roles and what each one may do.

   The server enforces this on every route (server/lib/auth.ts requireStaff),
   and the portals read the same table to decide what to show — so a button a
   role cannot use is not drawn, and a hand-built request for it is refused.
   The UI hiding something is courtesy; the server refusing it is the rule.

   The proposal's example is the one to keep in mind: a volunteer entering cash
   gifts at an event must not be able to export the donor list or open the
   compliance registers.
--------------------------------------------------------------------------- */

export const PERMISSIONS = {
  'dashboard.view': 'See the dashboard',
  'donors.read': 'Look up donors',
  'donors.write': 'Edit donor details',
  'donors.merge': 'Merge duplicate donors',
  'donors.export': 'Export the donor list',
  'gifts.read': 'See donations',
  'gifts.create': 'Enter cash, cheque and event donations',
  'gifts.manage': 'Refund, void and edit donations',
  'plans.manage': 'Manage regular donations',
  'appeals.manage': 'Create and edit appeals',
  'fundraisers.approve': 'Approve supporter fundraising pages',
  'campaigns.manage': 'Write and send email campaigns',
  'enquiries.manage': 'Handle enquiries and sign-ups',
  'bank.import': 'Import bank statements',
  'reports.read': 'Run income reports',
  'reports.export': 'Export reports and the Xero file',
  'staff.manage': 'Add staff and change roles',
  'settings.manage': 'Change organisation settings',
  'audit.read': 'Read the action log',
  'compliance.read': 'Open the compliance portal',
  'compliance.write': 'Edit registers, the calendar and documents',
} as const
export type Permission = keyof typeof PERMISSIONS
export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Permission[]

const ALL = PERMISSION_KEYS

export const ROLES = {
  owner: {
    label: 'Owner',
    blurb: 'Everything, including staff access and settings.',
    perms: ALL,
  },
  admin: {
    label: 'Administrator',
    blurb: 'Runs the platform day to day. Everything except changing the owner.',
    perms: ALL,
  },
  finance: {
    label: 'Finance',
    blurb: 'Donations, bank imports, reports and the Xero export.',
    perms: [
      'dashboard.view', 'donors.read', 'donors.write', 'donors.export',
      'gifts.read', 'gifts.create', 'gifts.manage', 'plans.manage',
      'bank.import', 'reports.read', 'reports.export', 'audit.read', 'compliance.read',
    ],
  },
  fundraising: {
    label: 'Fundraising',
    blurb: 'Donors, appeals, supporter pages, campaigns and enquiries.',
    perms: [
      'dashboard.view', 'donors.read', 'donors.write', 'donors.merge',
      'gifts.read', 'gifts.create', 'plans.manage', 'appeals.manage',
      'fundraisers.approve', 'campaigns.manage', 'enquiries.manage', 'reports.read',
    ],
  },
  compliance: {
    label: 'Compliance',
    blurb: 'Registers, statutory calendar, documents and the action log.',
    perms: ['dashboard.view', 'reports.read', 'audit.read', 'compliance.read', 'compliance.write'],
  },
  volunteer: {
    label: 'Volunteer',
    blurb: 'Enters donations taken at events. Sees no exports and no compliance.',
    perms: ['donors.read', 'gifts.create', 'enquiries.manage'],
  },
} as const satisfies Record<string, { label: string; blurb: string; perms: readonly Permission[] }>

export type Role = keyof typeof ROLES
export const ROLE_KEYS = Object.keys(ROLES) as Role[]

export function can(role: Role | undefined | null, perm: Permission): boolean {
  if (!role) return false
  return (ROLES[role].perms as readonly Permission[]).includes(perm)
}
