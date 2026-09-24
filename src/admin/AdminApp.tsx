import { Route, Routes } from 'react-router-dom'
import {
  Activity as ActivityIcon, Banknote, BarChart3, Building2, FileUp, HandCoins, Inbox, LayoutDashboard, Mail,
  Megaphone, Plus, Repeat, Send, Settings as SettingsIcon, ShieldCheck, Users, UserPlus, Upload,
} from 'lucide-react'
import { PortalRoot } from '../portal/PortalRoot'
import { RequireStaff } from '../portal/session'
import { StaffShell, type NavGroup } from '../portal/shell/StaffShell'
import { StaffForgot, StaffLogin, StaffReset } from '../portal/shell/StaffAuth'
import type { PaletteAction } from '../portal/shell/CommandPalette'
import Dashboard from './pages/Dashboard'
import Donors from './pages/Donors'
import DonorDetail from './pages/DonorDetail'
import Duplicates from './pages/Duplicates'
import Gifts from './pages/Gifts'
import Plans from './pages/Plans'
import Appeals from './pages/Appeals'
import AppealEdit from './pages/AppealEdit'
import Fundraisers from './pages/Fundraisers'
import Campaigns from './pages/Campaigns'
import CampaignEdit from './pages/CampaignEdit'
import Enquiries from './pages/Enquiries'
import BankImports from './pages/BankImports'
import BankImportReview from './pages/BankImportReview'
import Reports from './pages/Reports'
import Staff from './pages/Staff'
import Activity from './pages/Activity'
import Emails from './pages/Emails'
import Settings from './pages/Settings'

/* ---------------------------------------------------------------------------
   The admin portal, /admin/*. Lazy-loaded from App.tsx as its own chunk.

   Each nav item names the permission it needs, and the shell hides what a
   role cannot use; each route is also wrapped, so typing the URL gets the
   same answer. `badge` keys come from GET /api/admin/dashboard/badges.
--------------------------------------------------------------------------- */

export const ADMIN_NAV: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, perm: 'dashboard.view', end: true, primary: true },
    ],
  },
  {
    label: 'Supporters',
    items: [
      { label: 'Donors', to: '/admin/donors', icon: Users, perm: 'donors.read', primary: true, badge: 'duplicates' },
      { label: 'Gifts', to: '/admin/gifts', icon: HandCoins, perm: ['gifts.read', 'gifts.create'], primary: true },
      { label: 'Regular giving', to: '/admin/plans', icon: Repeat, perm: 'plans.manage', badge: 'failedPlans' },
      { label: 'Enquiries', to: '/admin/enquiries', icon: Inbox, perm: 'enquiries.manage', primary: true, badge: 'enquiries' },
    ],
  },
  {
    label: 'Fundraising',
    items: [
      { label: 'Appeals', to: '/admin/appeals', icon: Megaphone, perm: 'appeals.manage' },
      { label: 'Supporter pages', to: '/admin/fundraisers', icon: Building2, perm: 'fundraisers.approve', badge: 'fundraisers' },
      { label: 'Email campaigns', to: '/admin/campaigns', icon: Send, perm: 'campaigns.manage' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Bank import', to: '/admin/bank', icon: Banknote, perm: 'bank.import', badge: 'bank' },
      { label: 'Reports', to: '/admin/reports', icon: BarChart3, perm: 'reports.read' },
    ],
  },
  {
    label: 'Organisation',
    items: [
      { label: 'Staff and access', to: '/admin/staff', icon: ShieldCheck, perm: 'staff.manage' },
      { label: 'Activity log', to: '/admin/activity', icon: ActivityIcon, perm: 'audit.read' },
      { label: 'Email log', to: '/admin/emails', icon: Mail, perm: 'settings.manage' },
      { label: 'Settings', to: '/admin/settings', icon: SettingsIcon, perm: 'settings.manage' },
    ],
  },
]

const ACTIONS: PaletteAction[] = [
  { label: 'Record a cash, cheque or event gift', to: '/admin/gifts?new=1', icon: Plus, perm: 'gifts.create', keywords: 'offline cash cheque event add' },
  { label: 'Import a bank statement', to: '/admin/bank?upload=1', icon: Upload, perm: 'bank.import', keywords: 'csv transfer match' },
  { label: 'Add a donor', to: '/admin/donors?new=1', icon: UserPlus, perm: 'donors.write' },
  { label: 'New appeal', to: '/admin/appeals/new', icon: Megaphone, perm: 'appeals.manage' },
  { label: 'New email campaign', to: '/admin/campaigns/new', icon: Send, perm: 'campaigns.manage' },
  { label: 'Export for Xero', to: '/admin/reports?tab=xero', icon: FileUp, perm: 'reports.export', keywords: 'accounting bookkeeper' },
]

export default function AdminApp() {
  return (
    <PortalRoot>
      <Routes>
        <Route path="login" element={<StaffLogin />} />
        <Route path="forgot" element={<StaffForgot />} />
        <Route path="reset" element={<StaffReset />} />
        <Route
          element={
            <RequireStaff>
              <StaffShell
                portal="admin"
                groups={ADMIN_NAV}
                actions={ACTIONS}
                searchPath="/admin/search"
                badgesQuery={{ key: ['admin', 'badges'], path: '/admin/dashboard/badges' }}
              />
            </RequireStaff>
          }
        >
          <Route index element={<RequireStaff perm="dashboard.view"><Dashboard /></RequireStaff>} />
          <Route path="donors" element={<RequireStaff perm="donors.read"><Donors /></RequireStaff>} />
          <Route path="donors/duplicates" element={<RequireStaff perm="donors.merge"><Duplicates /></RequireStaff>} />
          <Route path="donors/:id" element={<RequireStaff perm="donors.read"><DonorDetail /></RequireStaff>} />
          <Route path="gifts" element={<RequireStaff perm={['gifts.read', 'gifts.create']}><Gifts /></RequireStaff>} />
          <Route path="plans" element={<RequireStaff perm="plans.manage"><Plans /></RequireStaff>} />
          <Route path="appeals" element={<RequireStaff perm="appeals.manage"><Appeals /></RequireStaff>} />
          <Route path="appeals/:id" element={<RequireStaff perm="appeals.manage"><AppealEdit /></RequireStaff>} />
          <Route path="fundraisers" element={<RequireStaff perm="fundraisers.approve"><Fundraisers /></RequireStaff>} />
          <Route path="campaigns" element={<RequireStaff perm="campaigns.manage"><Campaigns /></RequireStaff>} />
          <Route path="campaigns/:id" element={<RequireStaff perm="campaigns.manage"><CampaignEdit /></RequireStaff>} />
          <Route path="enquiries" element={<RequireStaff perm="enquiries.manage"><Enquiries /></RequireStaff>} />
          <Route path="bank" element={<RequireStaff perm="bank.import"><BankImports /></RequireStaff>} />
          <Route path="bank/:id" element={<RequireStaff perm="bank.import"><BankImportReview /></RequireStaff>} />
          <Route path="reports" element={<RequireStaff perm="reports.read"><Reports /></RequireStaff>} />
          <Route path="staff" element={<RequireStaff perm="staff.manage"><Staff /></RequireStaff>} />
          <Route path="activity" element={<RequireStaff perm="audit.read"><Activity /></RequireStaff>} />
          <Route path="emails" element={<RequireStaff perm="settings.manage"><Emails /></RequireStaff>} />
          <Route path="settings" element={<RequireStaff perm="settings.manage"><Settings /></RequireStaff>} />
        </Route>
      </Routes>
    </PortalRoot>
  )
}
