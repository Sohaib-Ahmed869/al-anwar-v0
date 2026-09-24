import { Router } from 'express'
import { requireDonor } from '../../lib/auth'
import overview from './overview'
import gifts from './gifts'
import plans from './plans'
import fundraisers from './fundraisers'
import profile from './profile'

/* /api/me — the donor portal. Every query below is scoped to req.donor; there
   is no route here that takes a donor id from the request. */
const r = Router()
r.use(requireDonor)
r.use('/overview', overview)
r.use('/gifts', gifts)
r.use('/plans', plans)
r.use('/fundraisers', fundraisers)
r.use('/profile', profile)
export default r
