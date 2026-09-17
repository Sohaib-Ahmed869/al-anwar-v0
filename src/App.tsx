import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'

import Home from './pages/Home'
import Appeals from './pages/Appeals'
import Appeal from './pages/Appeal'
import Zakat from './pages/Zakat'
import ZakatCalculator from './pages/ZakatCalculator'
import Ramadan from './pages/Ramadan'
import DhulHijjah from './pages/DhulHijjah'
import Give from './pages/Give'
import ThankYou from './pages/ThankYou'
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
import MyGiving from './pages/MyGiving'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
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

        <Route path="where-it-goes" element={<WhereItGoes />} />
        <Route path="get-involved" element={<GetInvolved />} />
        <Route path="events" element={<Events />} />
        <Route path="gallery" element={<Gallery />} />

        <Route path="volunteer" element={<Volunteer />} />
        <Route path="partners" element={<Partners />} />
        <Route path="become-a-partner" element={<BecomePartner />} />
        <Route path="fundraisers" element={<Fundraisers />} />
        <Route path="fundraisers/start" element={<FundraiserStart />} />
        <Route path="fundraisers/:slug" element={<Fundraiser />} />

        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="my-giving" element={<MyGiving />} />

        {/* The two the footer's small print points at. */}
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
