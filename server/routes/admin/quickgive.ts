import { Router } from 'express'
import { z } from 'zod'
import {
  DEFAULT_QUICK_GIVE, QUICK_GIVE_FUND_KEYS, QUICK_GIVE_GROUP_KEYS, type QuickGiveFund, type QuickGiveGroup, type QuickGiveOption,
} from '../../../shared/quickgive'
import { getQuickGive, saveQuickGive } from '../../models/QuickGive'
import { audit } from '../../lib/audit'
import { requireStaff } from '../../lib/auth'
import { badRequest, parse } from '../../lib/http'

/* ---------------------------------------------------------------------------
   /api/admin/quick-give — the home page's quick-donate list (Admin → Appeals).

     GET  /         the list as it stands, in priority order
     PUT  /         the whole list, replaced in one write
     POST /reset    back to the defaults in shared/quickgive.ts

   Gated by appeals.manage: the list is what the site asks people to give to,
   which is the appeals team's call, not an organisation setting.

   The whole list is sent on every save because its order is its meaning, and
   the audit sentence says what actually changed (added, removed, renamed,
   switched off, moved) so the log reads like the edit rather than "saved".
--------------------------------------------------------------------------- */

const r = Router()
r.use(requireStaff('appeals.manage'))

const zOption = z.object({
  id: z.string().trim().regex(/^[a-z0-9-]{1,40}$/, 'Lower-case letters, numbers and dashes'),
  label: z.string().trim().min(1, 'Every option needs a name').max(60),
  group: z.enum(QUICK_GIVE_GROUP_KEYS as [QuickGiveGroup, ...QuickGiveGroup[]]),
  fund: z.enum(QUICK_GIVE_FUND_KEYS as [QuickGiveFund, ...QuickGiveFund[]]),
  enabled: z.boolean(),
  photo: z.string().trim().max(400).default(''),
  title: z.string().trim().max(120).default(''),
  body: z.string().trim().max(400).default(''),
  link: z.string().trim().max(300).regex(/^(|\/[^\s]*|https?:\/\/\S+)$/, 'A path like /appeals/tarim-school, or a full address').default(''),
})
const zList = z.object({ items: z.array(zOption).min(1, 'Keep at least one option').max(40) })

function describe(before: QuickGiveOption[], after: QuickGiveOption[]) {
  const was = new Map(before.map((o) => [o.id, o]))
  const now = new Map(after.map((o) => [o.id, o]))
  const bits: string[] = []
  for (const o of after) {
    const b = was.get(o.id)
    if (!b) bits.push(`added “${o.label}”`)
    else {
      if (b.label !== o.label) bits.push(`renamed “${b.label}” to “${o.label}”`)
      if (b.enabled !== o.enabled) bits.push(`${o.enabled ? 'switched on' : 'switched off'} “${o.label}”`)
      if (b.group !== o.group || b.fund !== o.fund || b.photo !== o.photo || b.title !== o.title || b.body !== o.body || b.link !== o.link)
        bits.push(`edited “${o.label}”`)
    }
  }
  for (const b of before) if (!now.has(b.id)) bits.push(`removed “${b.label}”`)
  const order = (l: QuickGiveOption[]) => l.filter((o) => was.has(o.id) && now.has(o.id)).map((o) => o.id).join(',')
  if (order(before) !== order(after)) bits.push(`reordered it (first is now “${after[0].label}”)`)
  return bits
}

r.get('/', async (_req, res) => {
  res.json({ items: await getQuickGive() })
})

r.put('/', async (req, res) => {
  const { items } = parse(zList, req.body)
  const ids = new Set<string>()
  for (const [i, o] of items.entries()) {
    if (ids.has(o.id)) throw badRequest('Two options share an id.', { [`items.${i}.id`]: 'Already used by another option' })
    ids.add(o.id)
  }
  if (!items.some((o) => o.enabled)) throw badRequest('Keep at least one option switched on, or the box has nothing to offer.')
  const before = await getQuickGive()
  const bits = describe(before, items)
  if (!bits.length) return void res.json({ items: before })
  await saveQuickGive(items)
  await audit(req, 'quickgive.update', `Changed the home page quick-donate list: ${bits.join('; ')}`, { type: 'settings', label: 'quick-donate list' }, { before, after: items })
  res.json({ items })
})

r.post('/reset', async (req, res) => {
  await saveQuickGive(DEFAULT_QUICK_GIVE)
  await audit(req, 'quickgive.reset', 'Reset the home page quick-donate list to its defaults', { type: 'settings', label: 'quick-donate list' })
  res.json({ items: DEFAULT_QUICK_GIVE })
})

export default r
