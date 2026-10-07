import { Router } from 'express'
import { requireStaffAny } from '../../lib/auth'
import { escapeRegex, searchRegex } from '../../lib/http'
import { limiter } from '../../lib/ratelimit'
import { Donor } from '../../models'

/* ---------------------------------------------------------------------------
   /api/admin/lookup/donors?q= — finding the person in front of you, and
   nothing else.

   A volunteer at an event table needs to put a cash gift on the right record
   and link an enquiry to the person who sent it. They do not need the donor
   list: 200 records a page with phones, addresses, notes and lifetime
   giving, which is what donors.read opens (and why the volunteer role no
   longer has it, shared/access.ts). So this answers a typed search with:

     - at most five matches, and only for three or more characters, so it
       can't be paged through to copy the base;
     - name, donor number and suburb — enough to tell two Mohammed Khans
       apart — and the email masked (a•••@example.com), with a flag for a
       record that has no real address so the receipt switch can say so;
     - no phone, no street, no totals, no notes, no tags.

   An email address finds a donor only when it is typed in full. Matching
   part of one would let the masked address be rebuilt a character at a time
   ("D-10001 a@", "D-10001 am@", …), which is the very thing the mask hides;
   and the route is rate-limited per member of staff, so it can't be walked.

   Roles with donors.read keep using /api/admin/donors for the same picker,
   which shows them the full row.
--------------------------------------------------------------------------- */

const r = Router()
const LIMIT = 5

/* a person at an event table types a few names a minute, not hundreds */
const lookupLimit = limiter({
  name: 'admin-donor-lookup',
  windowMs: 10 * 60_000,
  limit: 60,
  keyGenerator: (req) => `staff:${String(req.staff?._id ?? '')}`,
  message: 'That is a lot of searches in a short time. Please wait a few minutes and try again.',
})

/** "amina.rahman@example.com" → "a•••@example.com" */
export function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  if (!domain) return '•••'
  return `${local.slice(0, 1)}•••@${domain}`
}

r.get('/donors', requireStaffAny('gifts.create', 'enquiries.manage'), lookupLimit, async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 80)
  if (q.length < 3) {
    res.json({ items: [] })
    return
  }
  const and = q
    .split(/\s+/)
    .slice(0, 4)
    .map((w) => {
      /* a word with an @ in it is an address: the whole of it, or nothing */
      if (w.includes('@')) return { email: new RegExp(`^${escapeRegex(w)}$`, 'i') }
      const rx = searchRegex(w)!
      return { $or: [{ firstName: rx }, { lastName: rx }, { number: rx }, { 'address.suburb': rx }] }
    })
  const found = await Donor.find({ status: { $ne: 'merged' }, $and: and })
    .sort({ lastGiftAt: -1, _id: 1 })
    .limit(LIMIT)
    .select('number firstName lastName email address.suburb')
    .lean()
  res.json({
    items: found.map((d) => ({
      id: String(d._id),
      number: d.number,
      firstName: d.firstName,
      lastName: d.lastName,
      emailHint: maskEmail(d.email),
      /* records made for someone who gave no address use a .invalid one */
      noEmail: d.email.toLowerCase().endsWith('.invalid'),
      suburb: d.address?.suburb ?? null,
    })),
  })
})

export default r
