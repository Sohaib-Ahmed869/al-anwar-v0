import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'

/* The three portals are their own chunks: a visitor reading an appeal never
   downloads the admin portal, and the portals bring their own shells, so they
   sit outside the public Layout's header and footer. */
const AccountApp = lazy(() => import('./account/AccountApp'))
const AdminApp = lazy(() => import('./admin/AdminApp'))
const ComplianceApp = lazy(() => import('./compliance/ComplianceApp'))
const portal = (el: React.ReactNode) => <Suspense fallback={<div className="min-h-dvh bg-ground" />}>{el}</Suspense>

import Home from './pages/Home'
import Appeals from './pages/Appeals'
import Appeal from './pages/Appeal'
import Zakat from './pages/Zakat'
import ZakatCalculator from './pages/ZakatCalculator'
import Ramadan from './pages/Ramadan'
import DhulHijjah from './pages/DhulHijjah'
import Give from './pages/Give'
import ThankYou from './pages/ThankYou'
import LetterConfirm from './pages/LetterConfirm'
import FundraiserConfirm from './pages/FundraiserConfirm'
import WhereItGoes from './pages/WhereItGoes'
import GetInvolved from './pages/GetInvolved'
import Events from './pages/Events'
import Gallery from './pages/Gallery'
import Fundraisers from './pages/Fundraisers'
import Volunteer from './pages/Volunteer'
import Partners from './pages/Partners'
import BecomePartner from './pages/BecomePartner'
import FundraiserStart from './pages/FundraiserStart'
import Fundraiser from './pages/Fundraiser'
import About from './pages/About'
import Contact from './pages/Contact'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route path="account/*" element={portal(<AccountApp />)} />
      <Route path="admin/*" element={portal(<AdminApp />)} />
      <Route path="compliance/*" element={portal(<ComplianceApp />)} />

      <Route element={<Layout />}>
        <Route index element={<Home />} />

        <Route path="appeals" element={<Appeals />} />
        <Route path="appeals/:slug" element={<Appeal />} />

        <Route path="zakat" element={<Zakat />} />
        <Route path="zakat/calculator" element={<ZakatCalculator />} />

        {/* The seasonal campaigns, switched on in season-data.ts. */}
        <Route path="ramadan" element={<Ramadan />} />
        <Route path="dhul-hijjah" element={<DhulHijjah />} />

        <Route path="give" element={<Give />} />
        <Route path="thank-you" element={<ThankYou />} />
        <Route path="letter/confirm" element={<LetterConfirm />} />

        <Route path="where-it-goes" element={<WhereItGoes />} />
        <Route path="get-involved" element={<GetInvolved />} />
        <Route path="events" element={<Events />} />
        <Route path="gallery" element={<Gallery />} />

        <Route path="volunteer" element={<Volunteer />} />
        <Route path="partners" element={<Partners />} />
        <Route path="become-a-partner" element={<BecomePartner />} />
        <Route path="fundraisers" element={<Fundraisers />} />
        <Route path="fundraisers/start" element={<FundraiserStart />} />
        <Route path="fundraisers/confirm" element={<FundraiserConfirm />} />
        <Route path="fundraisers/:slug" element={<Fundraiser />} />

        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        {/* The donor portal replaced the old stub; the path is kept for old links. */}
        <Route path="my-giving" element={<Navigate to="/account" replace />} />

        {/* The two the footer's small print points at. */}
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
