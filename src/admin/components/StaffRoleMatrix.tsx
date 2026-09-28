import { useState } from 'react'
import { Check, Minus } from 'lucide-react'
import { PERMISSIONS, ROLES, ROLE_KEYS, type Permission, type Role } from '../../../shared/access'
import { Badge, Card, CardHeader, Select, cn, useIsMobile } from '../../portal/ui'

/* ---------------------------------------------------------------------------
   "What each role can do" — the permission table from shared/access.ts,
   which is the same table the server enforces, so this card cannot drift
   from the rules.

   A 21 × 6 grid of ticks does not fit a phone, so there it becomes one role
   at a time: pick a role, read its list. Permissions are grouped by area
   so the eye can find "exports" or "compliance" without reading every row.
--------------------------------------------------------------------------- */

const GROUPS: { label: string; perms: Permission[] }[] = [
  { label: 'Donors and donations', perms: ['dashboard.view', 'donors.read', 'donors.write', 'donors.merge', 'donors.export', 'gifts.read', 'gifts.create', 'gifts.manage', 'plans.manage'] },
  { label: 'Fundraising', perms: ['appeals.manage', 'fundraisers.approve', 'campaigns.manage', 'enquiries.manage'] },
  { label: 'Finance', perms: ['bank.import', 'reports.read', 'reports.export'] },
  { label: 'Organisation and compliance', perms: ['staff.manage', 'settings.manage', 'audit.read', 'compliance.read', 'compliance.write'] },
]

export const ROLE_TONE: Record<Role, 'violet' | 'teal' | 'green' | 'amber' | 'neutral'> = {
  owner: 'violet',
  admin: 'teal',
  finance: 'green',
  fundraising: 'green',
  compliance: 'amber',
  volunteer: 'neutral',
}

export const RoleBadge = ({ role, size }: { role: Role; size?: 'sm' | 'md' }) => (
  <Badge tone={ROLE_TONE[role]} size={size}>
    {ROLES[role].label}
  </Badge>
)

const has = (role: Role, p: Permission) => (ROLES[role].perms as readonly Permission[]).includes(p)

export function StaffRoleMatrix() {
  const mobile = useIsMobile()
  const [role, setRole] = useState<Role>('fundraising')
  return (
    <Card className="overflow-hidden">
      <CardHeader title="What each role can do" description="The server checks these on every request — hiding a button is only a courtesy." />
      {mobile ? (
        <div className="px-5 pb-5">
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Role">
            {ROLE_KEYS.map((r) => (
              <option key={r} value={r}>
                {ROLES[r].label}
              </option>
            ))}
          </Select>
          <p className="mt-2 text-[13px] text-text-2">{ROLES[role].blurb}</p>
          {GROUPS.map((g) => (
            <div key={g.label} className="mt-4">
              <p className="mb-1 text-[11.5px] font-medium tracking-wide text-text-3 uppercase">{g.label}</p>
              <ul className="divide-y divide-line-2">
                {g.perms.map((p) => {
                  const on = has(role, p)
                  return (
                    <li key={p} className={cn('flex items-center justify-between gap-3 py-2 text-[13.5px]', on ? 'text-text' : 'text-text-3')}>
                      {PERMISSIONS[p]}
                      {on ? <Check className="size-4 shrink-0 text-green" aria-label="Yes" /> : <Minus className="size-4 shrink-0 text-text-3/60" aria-label="No" />}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 border-b border-line bg-paper px-5 py-2.5 text-left font-medium text-text-3">
                  Can…
                </th>
                {ROLE_KEYS.map((r) => (
                  <th key={r} scope="col" className="border-b border-line px-2 py-2.5 text-center font-medium whitespace-nowrap text-text" title={ROLES[r].blurb}>
                    {ROLES[r].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((g) => (
                <GroupRows key={g.label} label={g.label} perms={g.perms} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function GroupRows({ label, perms }: { label: string; perms: Permission[] }) {
  return (
    <>
      <tr>
        <th colSpan={ROLE_KEYS.length + 1} scope="colgroup" className="bg-paper-2/70 px-5 pt-3 pb-1.5 text-left text-[11.5px] font-medium tracking-wide text-text-3 uppercase">
          {label}
        </th>
      </tr>
      {perms.map((p) => (
        <tr key={p} className="hover:bg-paper-2/50">
          <th scope="row" className="border-b border-line-2 px-5 py-2 text-left font-normal text-text">
            {PERMISSIONS[p]}
          </th>
          {ROLE_KEYS.map((r) => (
            <td key={r} className="border-b border-line-2 px-2 py-2 text-center">
              {has(r, p) ? <Check className="mx-auto size-4 text-green" aria-label="Yes" /> : <span className="text-text-3/50" aria-label="No">—</span>}
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
