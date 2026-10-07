import { Router } from 'express'
import { requireStaff } from '../../lib/auth'
import dashboard from './dashboard'
import search from './search'
import lookup from './lookup'
import donors from './donors'
import gifts from './gifts'
import plans from './plans'
import appeals from './appeals'
import fundraisers from './fundraisers'
import campaigns from './campaigns'
import enquiries from './enquiries'
import bank from './bank'
import reports from './reports'
import staff from './staff'
import settings from './settings'
import activity from './activity'
import emails from './emails'
import quickGive from './quickgive'

/* /api/admin — every route below is behind a signed-in staff session, and
   each sub-router asks for the specific permission its action needs. */
const r = Router()
r.use(requireStaff())
r.use('/dashboard', dashboard)
r.use('/search', search)
r.use('/lookup', lookup)
r.use('/donors', donors)
r.use('/gifts', gifts)
r.use('/plans', plans)
r.use('/appeals', appeals)
r.use('/fundraisers', fundraisers)
r.use('/campaigns', campaigns)
r.use('/enquiries', enquiries)
r.use('/bank', bank)
r.use('/reports', reports)
r.use('/staff', staff)
r.use('/settings', settings)
r.use('/activity', activity)
r.use('/emails', emails)
r.use('/quick-give', quickGive)
export default r
