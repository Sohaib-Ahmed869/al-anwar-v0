import { Router, type Request } from 'express'
import { z } from 'zod'
import { PERMISSIONS, ROLE_KEYS, ROLES, type Role } from '../../../shared/access'
import { env } from '../../env'
import { Staff, type StaffDoc } from '../../models'
import { audit } from '../../lib/audit'
import { newToken, requireStaff, sha256 } from '../../lib/auth'
import { sendEmail } from '../../lib/email'
import { badRequest, forbidden, HttpError, notFound, out, parse, zEmail } from '../../lib/http'
import { staffInviteEmail } from '../../emails/templates'

/* ---------------------------------------------------------------------------
   /api/admin/staff — who can sign in to the portals, and as what.

   The rules the server holds whatever the screen shows:
     - nobody changes their own role or switches themselves off (a slip would
       lock them out with nobody to let them back in);
     - the last active owner cannot be demoted or switched off;
     - only an owner can make, edit or remove an owner — an administrator has
       everything else, which is what ROLES.admin's blurb promises.

   A role change or a deactivation bumps `sessionVersion`, which lib/auth.ts
   checks on every request, so it takes effect at once rather than when that
   person's cookie expires. An invite is a hashed one-time token, valid for a
   week, that lands on the same /admin/reset page as a password reset.
--------------------------------------------------------------------------- */

const r = Router()
r.use(requireStaff('staff.manage'))

const INVITE_DAYS = 7
const zRole = z.enum(ROLE_KEYS as [Role, ...Role[]])

const shape = (s: StaffDoc | Record<string, unknown>) => {
  const o = out<Record<string, unknown>>('toObject' in s && typeof s.toObject === 'function' ? s.toObject() : s)
  delete o.passwordHash
  delete o.tokenHash
  delete o.tokenExpires
  delete o.sessionVersion
  return o
}

function guardOwner(req: Request, target: { role?: string | null }, nextRole?: Role) {
  const me = req.staff!
  if (me.role !== 'owner' && (target.role === 'owner' || nextRole === 'owner')) throw forbidden('Only an owner can add, change or remove an owner.')
}

async function guardLastOwner(target: StaffDoc) {
  if (target.role !== 'owner' || !target.active) return
  const others = await Staff.countDocuments({ role: 'owner', active: true, _id: { $ne: target._id } })
  if (!others) throw badRequest('This is the only active owner. Make someone else an owner first.')
}

async function load(id: string) {
  const s = await Staff.findById(id)
  if (!s) throw notFound('That staff member')
  return s
}

async function sendInvite(req: Request, s: StaffDoc) {
  const token = newToken()
  s.set({ tokenHash: sha256(token), tokenExpires: new Date(Date.now() + INVITE_DAYS * 86_400_000), invitedAt: new Date() })
  await s.save()
  return sendEmail(s.email, staffInviteEmail(s.name.split(/\s+/)[0] ?? s.name, req.staff!.name, `${env.appUrl}/admin/reset?token=${token}`))
}

r.get('/', async (_req, res) => {
  const items = await Staff.find().sort({ active: -1, name: 1 }).lean()
  res.json({
    items: items.map(shape),
    roles: ROLE_KEYS.map((k) => ({ key: k, label: ROLES[k].label, blurb: ROLES[k].blurb, perms: ROLES[k].perms })),
    permissions: Object.entries(PERMISSIONS).map(([key, label]) => ({ key, label })),
  })
})

r.post('/invite', async (req, res) => {
  const body = parse(z.object({ name: z.string().trim().min(2, 'Their full name, please').max(80), email: zEmail, role: zRole }), req.body)
  guardOwner(req, {}, body.role)
  if (await Staff.exists({ email: body.email })) throw badRequest('Someone with that email already has a login.', { email: 'Already on the team' })
  const s = new Staff({ name: body.name, email: body.email, role: body.role, active: true, passwordSet: false })
  const sent = await sendInvite(req, s)
  await audit(req, 'staff.invite', `Invited ${s.name} (${s.email}) as ${ROLES[body.role].label}`, { type: 'staff', id: s._id, label: s.name })
  res.status(201).json({ ...shape(s), emailed: sent.ok })
})

r.post('/:id/resend-invite', async (req, res) => {
  const s = await load(String(req.params.id))
  if (s.passwordSet) throw badRequest(`${s.name} has already set a password. They can use “Forgot password” if they need a new one.`)
  if (!s.active) throw badRequest('Switch this login back on before sending an invitation.')
  guardOwner(req, s)
  await sendInvite(req, s)
  await audit(req, 'staff.invite', `Sent ${s.name} a fresh invitation`, { type: 'staff', id: s._id, label: s.name })
  res.json(shape(s))
})

r.patch('/:id', async (req, res) => {
  const { role } = parse(z.object({ role: zRole }), req.body)
  const s = await load(String(req.params.id))
  if (s.id === req.staff!.id) throw badRequest('You cannot change your own role. Ask another owner or administrator.')
  guardOwner(req, s, role)
  if (s.role === role) return void res.json(shape(s))
  if (role !== 'owner') await guardLastOwner(s)
  const was = s.role as Role
  s.role = role
  s.sessionVersion = (s.sessionVersion ?? 0) + 1
  await s.save()
  await audit(req, 'staff.role', `Changed ${s.name}'s role from ${ROLES[was].label} to ${ROLES[role].label}`, { type: 'staff', id: s._id, label: s.name }, { from: was, to: role })
  res.json(shape(s))
})

r.post('/:id/deactivate', async (req, res) => {
  const s = await load(String(req.params.id))
  if (s.id === req.staff!.id) throw badRequest('You cannot switch off your own login.')
  guardOwner(req, s)
  await guardLastOwner(s)
  if (!s.active) return void res.json(shape(s))
  s.active = false
  s.sessionVersion = (s.sessionVersion ?? 0) + 1
  s.set({ tokenHash: undefined, tokenExpires: undefined })
  await s.save()
  await audit(req, 'staff.deactivate', `Switched off ${s.name}'s login; they were signed out everywhere`, { type: 'staff', id: s._id, label: s.name })
  res.json(shape(s))
})

r.post('/:id/reactivate', async (req, res) => {
  const s = await load(String(req.params.id))
  if (s.id === req.staff!.id) throw new HttpError(400, 'That is you.')
  guardOwner(req, s)
  if (s.active) return void res.json(shape(s))
  s.active = true
  s.sessionVersion = (s.sessionVersion ?? 0) + 1
  await s.save()
  await audit(req, 'staff.reactivate', `Switched ${s.name}'s login back on`, { type: 'staff', id: s._id, label: s.name })
  res.json(shape(s))
})

export default r
