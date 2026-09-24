import { Router } from 'express'
import { EmailMessage } from '../../models'
import { requireStaff } from '../../lib/auth'
import { emailTransport } from '../../lib/email'
import { notFound, out, paging, searchRegex } from '../../lib/http'

/* ---------------------------------------------------------------------------
   /api/admin/emails — every email the platform has sent (lib/email.ts
   records each one), for "did the donor actually get their receipt?".

   The list leaves out the rendered HTML — it is the heavy part — and the
   detail route returns it for the sandboxed preview. The list also says
   which transport is live, so the page can explain that in development
   nothing leaves the machine.
--------------------------------------------------------------------------- */

const r = Router()
r.use(requireStaff('settings.manage'))

r.get('/', async (req, res) => {
  const { page, pageSize, skip } = paging(req.query)
  const f: Record<string, unknown> = {}
  const rx = searchRegex(req.query.q)
  if (rx) f.$or = [{ to: rx }, { subject: rx }]
  const template = String(req.query.template ?? '')
  if (template) f.template = template.endsWith('.') ? { $regex: `^${template.replace(/[^a-z_.]/g, '')}` } : template
  const status = String(req.query.status ?? '')
  if (['queued', 'sent', 'failed'].includes(status)) f.status = status
  const [items, total, templates] = await Promise.all([
    EmailMessage.find(f).sort({ createdAt: -1 }).skip(skip).limit(pageSize).select('-html -text').lean(),
    EmailMessage.countDocuments(f),
    EmailMessage.distinct('template'),
  ])
  res.json({ items: out(items), total, page, pageSize, transport: emailTransport(), templates: templates.sort() })
})

r.get('/:id', async (req, res) => {
  const m = await EmailMessage.findById(req.params.id).lean()
  if (!m) throw notFound('That email')
  res.json(out(m))
})

export default r
