import { Router, type Request } from 'express'
import { COUNTRIES, DESIGNATIONS, DOCUMENT_CATEGORIES, fyLabel, fyOf, fyRange } from '../../../shared/domain'
import { REGISTERS } from '../../../shared/registers'
import { AuditEvent, getSettings, Gift, LibraryDocument, Obligation, RegisterEntry } from '../../models'
import { entryTitle, entryView } from './registers'
import { obligationView } from './obligations'

/* ---------------------------------------------------------------------------
   /api/compliance/reports — the reports an auditor or the board asks for,
   one Australian financial year (July–June) at a time, plus the year-end
   evidence pack that puts all of it in one printable document.

   Figures are aggregated here, never in the browser. Two sums on purpose:
     - receipts report the RECEIPTED value, the gift plus any fee the donor
       chose to cover, because that is the figure printed on the receipt;
     - income and countries report the GIFT (amount), because that is what
       went to the appeal and the designation.
   Months are bucketed in Sydney time, where the charity is, so a gift at
   11pm on 30 June belongs to the year it was given in.
--------------------------------------------------------------------------- */

const r = Router()
const TZ = 'Australia/Sydney'

function fyFrom(req: Request) {
  const now = fyOf(new Date())
  const fy = Number(req.query.fy)
  return Number.isInteger(fy) && fy > 2000 && fy <= now + 1 ? fy : now
}

/** The twelve months of a financial year as yyyy-mm, July first. */
function fyMonths(fy: number) {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(fy - 1, 6 + i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

/** Every financial year with gifts in it, newest first — for the year picker. */
async function yearsAvailable() {
  const first = await Gift.findOne({}, { date: 1 }).sort({ date: 1 }).lean()
  const now = fyOf(new Date())
  const start = first ? fyOf(first.date) : now
  return Array.from({ length: now - start + 1 }, (_, i) => now - i).map((fy) => ({ fy, label: fyLabel(fy) }))
}

const paid = (fy: number) => {
  const { from, to } = fyRange(fy)
  return { status: 'succeeded', date: { $gte: from, $lt: to } }
}

/* ---------- the reports ---------- */
async function receipts(fy: number) {
  const { from, to } = fyRange(fy)
  const rows = await Gift.aggregate<{ _id: string; count: number; amount: number; resent: number }>([
    { $match: { 'receipt.number': { $exists: true, $ne: null }, 'receipt.issuedAt': { $gte: from, $lt: to } } },
    {
      $group: {
        _id: { $dateToString: { date: '$receipt.issuedAt', format: '%Y-%m', timezone: TZ } },
        count: { $sum: 1 },
        amount: { $sum: { $add: ['$amount', { $ifNull: ['$fee', 0] }] } },
        resent: { $sum: { $ifNull: ['$receipt.resent', 0] } },
      },
    },
  ])
  const months = fyMonths(fy).map((m) => {
    const x = rows.find((r) => r._id === m)
    return { month: m, count: x?.count ?? 0, amount: x?.amount ?? 0, resent: x?.resent ?? 0 }
  })
  const total = months.reduce((s, m) => ({ count: s.count + m.count, amount: s.amount + m.amount, resent: s.resent + m.resent }), { count: 0, amount: 0, resent: 0 })
  return { fy, months, total }
}

async function income(fy: number) {
  const match = paid(fy)
  const [byAppeal, byDesignation, byMonth] = await Promise.all([
    Gift.aggregate<{ _id: unknown; title: string | null; country: string | null; amount: number; count: number; donors: unknown[] }>([
      { $match: match },
      { $group: { _id: '$appeal', title: { $first: '$appealTitle' }, country: { $first: '$country' }, amount: { $sum: '$amount' }, count: { $sum: 1 }, donors: { $addToSet: '$donor' } } },
      { $sort: { amount: -1 } },
    ]),
    Gift.aggregate<{ _id: string; amount: number; count: number }>([
      { $match: match },
      { $group: { _id: '$designation', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { amount: -1 } },
    ]),
    Gift.aggregate<{ _id: string; amount: number; count: number }>([
      { $match: match },
      { $group: { _id: { $dateToString: { date: '$date', format: '%Y-%m', timezone: TZ } }, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ])
  const total = byDesignation.reduce((s, d) => ({ amount: s.amount + d.amount, count: s.count + d.count }), { amount: 0, count: 0 })
  return {
    fy,
    total,
    byAppeal: byAppeal.map((a) => ({
      appeal: a._id ? String(a._id) : null,
      title: a.title ?? 'Where most needed',
      country: a.country ?? null,
      amount: a.amount,
      count: a.count,
      donors: a.donors.length,
    })),
    byDesignation: byDesignation.map((d) => ({
      designation: d._id,
      label: DESIGNATIONS[d._id as keyof typeof DESIGNATIONS]?.label ?? d._id,
      amount: d.amount,
      count: d.count,
    })),
    byMonth: fyMonths(fy).map((m) => {
      const x = byMonth.find((b) => b._id === m)
      return { month: m, amount: x?.amount ?? 0, count: x?.count ?? 0 }
    }),
  }
}

async function countries(fy: number) {
  const [rows, partners] = await Promise.all([
    Gift.aggregate<{ _id: string | null; amount: number; count: number; appeals: (string | null)[] }>([
      { $match: paid(fy) },
      { $group: { _id: '$country', amount: { $sum: '$amount' }, count: { $sum: 1 }, appeals: { $addToSet: '$appealTitle' } } },
      { $sort: { amount: -1 } },
    ]),
    RegisterEntry.find({ register: 'overseas-partners', archived: { $ne: true } }).lean(),
  ])
  const keys = [...new Set([...rows.map((r) => r._id ?? 'unspecified'), ...partners.map((p) => String((p.fields as Record<string, unknown>).country ?? ''))])].filter(Boolean)
  const list = keys.map((k) => {
    const x = rows.find((r) => (r._id ?? 'unspecified') === k)
    return {
      country: k,
      label: k === 'unspecified' ? 'Not tied to a country' : (COUNTRIES[k] ?? k),
      amount: x?.amount ?? 0,
      count: x?.count ?? 0,
      appeals: (x?.appeals ?? []).filter(Boolean).sort() as string[],
      partners: partners
        .filter((p) => (p.fields as Record<string, unknown>).country === k)
        .map((p) => {
          const f = p.fields as Record<string, string | null>
          return { id: String(p._id), name: f.name ?? '', lastReport: f.lastReport ?? null, risk: f.risk ?? null, agreementSigned: f.agreementSigned ?? null }
        }),
    }
  })
  list.sort((a, b) => b.amount - a.amount)
  return { fy, countries: list, total: list.reduce((s, c) => ({ amount: s.amount + c.amount, count: s.count + c.count }), { amount: 0, count: 0 }) }
}

async function actions(fy: number) {
  const { from, to } = fyRange(fy)
  const match = { at: { $gte: from, $lt: to } }
  const area = { $arrayElemAt: [{ $split: ['$action', '.'] }, 0] }
  const [byArea, byPerson, byMonth] = await Promise.all([
    AuditEvent.aggregate<{ _id: string; count: number }>([{ $match: match }, { $group: { _id: area, count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    AuditEvent.aggregate<{ _id: { id: unknown; kind: string }; name: string; count: number; areas: string[]; last: Date }>([
      { $match: match },
      { $group: { _id: { id: { $cond: [{ $eq: ['$actor.kind', 'donor'] }, null, '$actor.id'] }, kind: '$actor.kind' }, name: { $last: '$actor.name' }, count: { $sum: 1 }, areas: { $addToSet: area }, last: { $max: '$at' } } },
      { $sort: { count: -1 } },
      { $limit: 100 },
    ]),
    AuditEvent.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: { $dateToString: { date: '$at', format: '%Y-%m', timezone: TZ } }, count: { $sum: 1 } } },
    ]),
  ])
  return {
    fy,
    total: byArea.reduce((s, a) => s + a.count, 0),
    byArea: byArea.map((a) => ({ area: a._id, count: a.count })),
    byPerson: byPerson.map((p) => ({
      id: p._id.id ? String(p._id.id) : null,
      kind: p._id.kind,
      name: p._id.kind === 'donor' ? 'Donors (their own changes)' : p.name,
      count: p.count,
      areas: p.areas.sort(),
      last: p.last,
    })),
    byMonth: fyMonths(fy).map((m) => ({ month: m, count: byMonth.find((b) => b._id === m)?.count ?? 0 })),
  }
}

r.get('/years', async (_req, res) => {
  res.json(await yearsAvailable())
})
r.get('/receipts', async (req, res) => {
  res.json(await receipts(fyFrom(req)))
})
r.get('/income', async (req, res) => {
  res.json(await income(fyFrom(req)))
})
r.get('/countries', async (req, res) => {
  res.json(await countries(fyFrom(req)))
})
r.get('/actions', async (req, res) => {
  res.json(await actions(fyFrom(req)))
})

/* ---------- the year-end evidence pack ---------- */
r.get('/pack', async (req, res) => {
  const fy = fyFrom(req)
  const { from, to } = fyRange(fy)
  const [settings, entries, obligations, docs, inc, rec, ctry] = await Promise.all([
    getSettings(),
    RegisterEntry.find({ archived: { $ne: true } }).lean(),
    Obligation.find({ dueDate: { $gte: from, $lt: to } }).sort({ dueDate: 1 }).lean(),
    LibraryDocument.find({ archived: { $ne: true } }).sort({ category: 1, title: 1 }).lean(),
    income(fy),
    receipts(fy),
    countries(fy),
  ])
  const registers = REGISTERS.map((def) => {
    const mine = entries.filter((e) => e.register === def.key)
    const items = mine
      .map((e) => entryView(def, e as never) as unknown as Record<string, unknown> & { fields: Record<string, unknown> })
      .sort((a, b) => entryTitle(def, a.fields as never).localeCompare(entryTitle(def, b.fields as never)))
    return { key: def.key, label: def.label, blurb: def.blurb, standards: def.standards, items }
  })
  res.json({
    fy,
    label: fyLabel(fy),
    period: { from, to: new Date(to.getTime() - 1) },
    generatedAt: new Date(),
    generatedBy: req.staff!.name,
    org: settings.org,
    registers,
    obligations: obligations.map((o) => obligationView(o as never)),
    documents: docs.map((d) => ({
      id: String(d._id),
      title: d.title,
      category: d.category,
      categoryLabel: DOCUMENT_CATEGORIES[d.category as keyof typeof DOCUMENT_CATEGORIES] ?? d.category,
      requiresAck: d.requiresAck,
      versions: d.versions.map((v) => ({ n: v.n, fileName: v.fileName, uploadedAt: v.uploadedAt, uploadedByName: v.uploadedByName, note: v.note })),
      latestAcks: d.acks.filter((a) => a.version === d.versions[d.versions.length - 1]?.n).length,
    })),
    income: { total: inc.total, byDesignation: inc.byDesignation, byAppeal: inc.byAppeal },
    receipts: rec.total,
    countries: ctry.countries.map(({ country, label, amount, count, partners }) => ({ country, label, amount, count, partners: partners.map((p) => p.name) })),
  })
})

export default r
