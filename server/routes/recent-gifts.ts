import { Router } from 'express'
import { DESIGNATIONS, type Designation } from '../../shared/domain'
import { Gift } from '../models'

/* ---------------------------------------------------------------------------
   GET /api/public/recent-gifts — the few lines the website's "someone just
   gave" toast cycles through (src/components/RecentGifts.tsx).

   It is mounted beside routes/public.ts rather than inside it so the feed can
   be switched off, or moved, without touching checkout.

   WHAT A STRANGER MAY SEE, AND NOTHING ELSE. A first name, a suburb and state
   when the donor's address has one, the amount in cents, what it was for, and
   when. Never an email, a surname, a donor number or any id: the rows are
   built field by field below, not spread from the document, so a field added
   to the Gift model later cannot leak through here by accident.

   ANONYMOUS STAYS ANONYMOUS. The gift's own `anonymous` flag decides, which
   checkout sets from the give form's tick box and which recordGift() defaults
   from the donor's preference. An anonymous gift comes back with name and
   place both null, since a first name is not the only thing that identifies
   someone in a small suburb.

   Only succeeded gifts from the website or a regular gift, from the last
   RECENT_DAYS days. Staff-entered cash and bank lines are left out: they were
   not given "just now" in any sense a visitor would recognise. The answer is
   cached for a minute, because every page view of the public site asks.
--------------------------------------------------------------------------- */

const RECENT_DAYS = 30
const MAX = 10

type Row = {
  name: string | null
  place: string | null
  amount: number
  cause: string
  on: string
}

let cache: { at: number; items: Row[] } | null = null

const firstNameOf = (full: string | null | undefined) => {
  const first = (full ?? '').trim().split(/\s+/)[0] ?? ''
  if (!first || first.includes('@')) return null
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
}

const r = Router()

r.get('/recent-gifts', async (_req, res) => {
  if (!cache || Date.now() - cache.at > 60_000) {
    const since = new Date(Date.now() - RECENT_DAYS * 86_400_000)
    const gifts = await Gift.find({
      status: 'succeeded',
      source: { $in: ['online', 'recurring'] },
      date: { $gte: since, $lte: new Date() },
    })
      .sort({ date: -1 })
      .limit(MAX)
      .select('donorName amount designation appealTitle fundraiserTitle anonymous date donor')
      .populate<{ donor: { address?: { suburb?: string; state?: string } } | null }>('donor', 'address.suburb address.state')
      .lean()

    const items: Row[] = gifts.map((g) => {
      const hidden = Boolean(g.anonymous)
      const a = g.donor?.address
      const place = [a?.suburb?.trim(), a?.state?.trim()].filter(Boolean).join(', ')
      return {
        name: hidden ? null : firstNameOf(g.donorName),
        place: hidden || !place ? null : place,
        amount: g.amount,
        cause:
          g.appealTitle || g.fundraiserTitle || DESIGNATIONS[g.designation as Designation]?.label || 'Where needed most',
        on: new Date(g.date).toISOString(),
      }
    })
    cache = { at: Date.now(), items }
  }
  res.setHeader('Cache-Control', 'public, max-age=60')
  res.json({ items: cache.items })
})

export default r
