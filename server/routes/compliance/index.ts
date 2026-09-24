import { Router } from 'express'
import { requireStaff } from '../../lib/auth'
import overview from './overview'
import registers from './registers'
import obligations from './obligations'
import documents from './documents'
import audit from './audit'
import reports from './reports'

/* /api/compliance — needs compliance.read to enter; writes also need
   compliance.write, asked for route by route. */
const r = Router()
r.use(requireStaff('compliance.read'))
r.use('/overview', overview)
r.use('/registers', registers)
r.use('/obligations', obligations)
r.use('/documents', documents)
r.use('/audit', audit)
r.use('/reports', reports)
export default r
