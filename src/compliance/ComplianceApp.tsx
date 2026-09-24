import { Navigate, Route, Routes } from 'react-router-dom'
import { AlertTriangle, BarChart3, CalendarClock, FileText, Gauge, Globe2, History, Scale, ShieldCheck, Users } from 'lucide-react'
import { PortalRoot } from '../portal/PortalRoot'
import { RequireStaff } from '../portal/session'
import { StaffShell, type NavGroup } from '../portal/shell/StaffShell'
import type { PaletteAction } from '../portal/shell/CommandPalette'
import Overview from './pages/Overview'
import Register from './pages/Register'
import Calendar from './pages/Calendar'
import Documents from './pages/Documents'
import DocumentDetail from './pages/DocumentDetail'
import AuditTrail from './pages/AuditTrail'
import Reports from './pages/Reports'

/* ---------------------------------------------------------------------------
   The compliance portal, /compliance/*. The ACNC records in one place:
   registers, the statutory calendar, the document library, the audit trail
   and the reports. Needs compliance.read to enter; editing needs
   compliance.write, which the pages check before offering it.

   Signing in happens at /admin/login — one staff login for both portals.
--------------------------------------------------------------------------- */

export const COMPLIANCE_NAV: NavGroup[] = [
  { items: [{ label: 'Overview', to: '/compliance', icon: Gauge, end: true, primary: true }] },
  {
    label: 'Registers',
    items: [
      { label: 'Responsible people', to: '/compliance/registers/responsible-people', icon: Users },
      { label: 'Overseas partners', to: '/compliance/registers/overseas-partners', icon: Globe2 },
      { label: 'Policies', to: '/compliance/registers/policies', icon: ShieldCheck },
      { label: 'Risks', to: '/compliance/registers/risks', icon: AlertTriangle },
      { label: 'Conflicts of interest', to: '/compliance/registers/conflicts', icon: Scale },
    ],
  },
  {
    label: 'Records',
    items: [
      { label: 'Statutory calendar', to: '/compliance/calendar', icon: CalendarClock, primary: true, badge: 'overdue' },
      { label: 'Documents', to: '/compliance/documents', icon: FileText, primary: true, badge: 'toRead' },
      { label: 'Audit trail', to: '/compliance/audit', icon: History, perm: 'audit.read' },
      { label: 'Reports', to: '/compliance/reports', icon: BarChart3, primary: true },
    ],
  },
]

const ACTIONS: PaletteAction[] = [
  { label: 'Add a calendar item', to: '/compliance/calendar?new=1', icon: CalendarClock, perm: 'compliance.write' },
  { label: 'Upload a document', to: '/compliance/documents?upload=1', icon: FileText, perm: 'compliance.write' },
  { label: 'Add a risk', to: '/compliance/registers/risks?new=1', icon: AlertTriangle, perm: 'compliance.write' },
  { label: 'Declare a conflict of interest', to: '/compliance/registers/conflicts?new=1', icon: Scale, perm: 'compliance.write' },
  { label: 'Year-end evidence pack', to: '/compliance/reports?tab=pack', icon: BarChart3 },
]

export default function ComplianceApp() {
  return (
    <PortalRoot>
      <Routes>
        <Route path="login" element={<Navigate to="/admin/login?next=/compliance" replace />} />
        <Route
          element={
            <RequireStaff perm="compliance.read">
              <StaffShell
                portal="compliance"
                groups={COMPLIANCE_NAV}
                actions={ACTIONS}
                searchPath="/compliance/overview/search"
                badgesQuery={{ key: ['compliance', 'badges'], path: '/compliance/overview/badges' }}
              />
            </RequireStaff>
          }
        >
          <Route index element={<Overview />} />
          <Route path="registers" element={<Navigate to="/compliance/registers/responsible-people" replace />} />
          <Route path="registers/:key" element={<Register />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="documents" element={<Documents />} />
          <Route path="documents/:id" element={<DocumentDetail />} />
          <Route path="audit" element={<RequireStaff perm="audit.read"><AuditTrail /></RequireStaff>} />
          <Route path="reports" element={<Reports />} />
        </Route>
      </Routes>
    </PortalRoot>
  )
}
