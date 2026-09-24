import { Router } from 'express'
import { can, type Role } from '../../../shared/access'
import { ENQUIRY_TYPES, type EnquiryType } from '../../../shared/domain'
import { formatMoney } from '../../../shared/money'
import { escapeRegex, searchRegex } from '../../lib/http'
import { Appeal, Donor, Enquiry, Gift } from '../../models'

/* ---------------------------------------------------------------------------
   /api/admin/search?q= — what ⌘K finds. Answers in the CommandPalette's
   SearchResponse shape: a few groups of at most five records, each with the
   link that opens it.

   Only groups the role may open are searched at all, so a volunteer's search
   never touches appeals and a compliance officer's never touches donors.
   Gift numbers, receipt numbers and bank references are matched from the
   start of the string: people type them from a piece of paper, left to right.
--------------------------------------------------------------------------- */

const r = Router()
const LIMIT = 5

type Item = { id: string; title: string; subtitle?: string; to: string }

r.get('/', async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 80)
  if (q.length < 2) {
    res.json({ groups: [] })
    return
  }
  const role = req.staff!.role as Role
  const rx = searchRegex(q)!
  const prefix = new RegExp(`^${escapeRegex(q.replace(/\s+/g, ''))}`, 'i')
  const words = q.split(/\s+/).slice(0, 4)
  const digits = q.replace(/\D/g, '')

  const groups: Promise<{ label: string; items: Item[] }>[] = []

  if (can(role, 'donors.read')) {
    groups.push(
      (async () => {
        const and = words.map((w) => {
          const wr = searchRegex(w)!
          const ors: Record<string, unknown>[] = [{ firstName: wr }, { lastName: wr }, { email: wr }, { altEmails: wr }, { number: wr }]
          const d = w.replace(/\D/g, '')
          if (d.length >= 3) ors.push({ phone: new RegExp(d.split('').join('\\D*')) })
          return { $or: ors }
        })
        const found = await Donor.find({ status: { $ne: 'merged' }, $and: and })
          .sort({ totalGiven: -1 })
          .limit(LIMIT)
          .select('number firstName lastName email totalGiven')
          .lean()
        return {
          label: 'Donors',
          items: found.map((d) => ({
            id: String(d._id),
            title: `${d.firstName} ${d.lastName}`.trim(),
            subtitle: `${d.number} · ${d.email}${d.totalGiven ? ` · ${formatMoney(d.totalGiven, { whole: true })} given` : ''}`,
            to: `/admin/donors/${d._id}`,
          })),
        }
      })(),
    )
  }

  if (can(role, 'gifts.read')) {
    groups.push(
      (async () => {
        const ors: Record<string, unknown>[] = [{ number: prefix }, { 'receipt.number': prefix }, { reference: prefix }]
        /* "7K3F9Q" finds "AA-7K3F9Q" */
        if (/^[a-z0-9]{4,}$/i.test(q)) ors.push({ reference: new RegExp(`${escapeRegex(q)}`, 'i') })
        if (digits.length >= 4 && digits.length === q.replace(/[\s-]/g, '').length) ors.push({ number: new RegExp(`${digits}`) })
        const found = await Gift.find({ $or: ors })
          .sort({ date: -1 })
          .limit(LIMIT)
          .select('number donorName amount date receipt.number reference appealTitle')
          .lean()
        return {
          label: 'Gifts',
          items: found.map((g) => ({
            id: String(g._id),
            title: `${g.number} · ${formatMoney(g.amount)} from ${g.donorName}`,
            subtitle: [g.receipt?.number && `Receipt ${g.receipt.number}`, g.reference, g.appealTitle, g.date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })]
              .filter(Boolean)
              .join(' · '),
            to: `/admin/gifts?gift=${g._id}`,
          })),
        }
      })(),
    )
  }

  if (can(role, 'appeals.manage')) {
    groups.push(
      (async () => {
        const found = await Appeal.find({ $or: [{ title: rx }, { slug: rx }, { where: rx }] })
          .sort({ status: -1, updatedAt: -1 })
          .limit(LIMIT)
          .select('title status raised target')
          .lean()
        return {
          label: 'Appeals',
          items: found.map((a) => ({
            id: String(a._id),
            title: a.title,
            subtitle: `${a.status[0]!.toUpperCase()}${a.status.slice(1)} · ${formatMoney(a.raised ?? 0, { whole: true })} of ${formatMoney(a.target ?? 0, { whole: true })}`,
            to: `/admin/appeals/${a._id}`,
          })),
        }
      })(),
    )
  }

  if (can(role, 'enquiries.manage')) {
    groups.push(
      (async () => {
        const found = await Enquiry.find({ $or: [{ name: rx }, { email: rx }, { subject: rx }] })
          .sort({ createdAt: -1 })
          .limit(LIMIT)
          .select('name email subject type status')
          .lean()
        return {
          label: 'Enquiries',
          items: found.map((e) => ({
            id: String(e._id),
            title: e.subject ? `${e.name}: ${e.subject}` : e.name,
            subtitle: `${ENQUIRY_TYPES[e.type as EnquiryType]?.label ?? e.type} · ${e.email}`,
            to: `/admin/enquiries?id=${e._id}`,
          })),
        }
      })(),
    )
  }

  const all = await Promise.all(groups)
  res.json({ groups: all.filter((g) => g.items.length) })
})

export default r
