import { Route, Routes } from 'react-router-dom'
import { PortalRoot } from '../portal/PortalRoot'
import { RequireDonor } from '../portal/session'
import { AccountShell } from '../portal/shell/AccountShell'
import { DonorLogin } from '../portal/shell/DonorLogin'
import Overview from './pages/Overview'
import Giving from './pages/Giving'
import Plans from './pages/Plans'
import Receipts from './pages/Receipts'
import Statement from './pages/Statement'
import ReceiptView from './pages/ReceiptView'
import Fundraisers from './pages/Fundraisers'
import FundraiserEdit from './pages/FundraiserEdit'
import Profile from './pages/Profile'

/* The donor portal, /account/*. The printable statement and receipt sit
   outside the shell: they are documents, laid out for paper and PDF. */
export default function AccountApp() {
  return (
    <PortalRoot>
      <Routes>
        <Route path="login" element={<DonorLogin />} />
        <Route path="statement/range" element={<RequireDonor><Statement /></RequireDonor>} />
        <Route path="statement/:fy" element={<RequireDonor><Statement /></RequireDonor>} />
        <Route path="receipt/:id" element={<RequireDonor><ReceiptView /></RequireDonor>} />
        <Route
          element={
            <RequireDonor>
              <AccountShell />
            </RequireDonor>
          }
        >
          <Route index element={<Overview />} />
          <Route path="giving" element={<Giving />} />
          <Route path="plans" element={<Plans />} />
          <Route path="receipts" element={<Receipts />} />
          <Route path="fundraisers" element={<Fundraisers />} />
          <Route path="fundraisers/:id" element={<FundraiserEdit />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </PortalRoot>
  )
}
