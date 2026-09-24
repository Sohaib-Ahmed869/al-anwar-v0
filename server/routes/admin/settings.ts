import { Router } from 'express'
import { z, type ZodType } from 'zod'
import type { Settings } from '../../../shared/types'
import { env, paymentsSimulated } from '../../env'
import { getSettings, saveSettings } from '../../models'
import { audit } from '../../lib/audit'
import { requireStaff } from '../../lib/auth'
import { emailTransport } from '../../lib/email'
import { badRequest, parse } from '../../lib/http'
import { receiptEmail } from '../../emails/templates'

/* ---------------------------------------------------------------------------
   /api/admin/settings — the organisation's details, one section at a time.

   Each section saves on its own (PUT /:section), so the person editing the
   bank details cannot accidentally save a half-typed ABN from another card.
   The audit entry names the fields that changed — the values themselves are
   in `meta`, because "changed the BSB" is what a reader of the log needs.

   `payments.mode` is not a setting: it is whatever the server is actually
   connected to (no Stripe key = simulated; sk_live = live; else test), and
   GET reports that, whatever is stored. Only the fee rate is editable.

   The receipt preview renders the real receiptEmail() with a sample gift,
   either with the saved settings (GET) or with a card's unsaved draft
   (POST), so the Receipts card can show the change before it is saved.
--------------------------------------------------------------------------- */

const r = Router()
r.use(requireStaff('settings.manage'))

const realMode = (): Settings['payments']['mode'] =>
  paymentsSimulated ? 'simulated' : env.stripe?.key.startsWith('sk_live') ? 'live' : 'test'

const str = (max: number, msg?: string) => (msg ? z.string().trim().min(1, msg).max(max) : z.string().trim().max(max))

const SECTIONS = {
  org: z.object({
    name: str(120, 'The organisation’s legal name'),
    abn: z.string().trim().regex(/^\d{2}\s?\d{3}\s?\d{3}\s?\d{3}$/, 'An ABN is 11 digits'),
    dgr: z.boolean(),
    dgrNote: str(400),
    email: z.string().trim().toLowerCase().email('That email address does not look right'),
    phone: str(40),
    address: str(200),
    website: str(120),
  }),
  receipts: z.object({
    prefix: z.string().trim().regex(/^[A-Z0-9]{1,6}$/, 'Up to six capital letters or numbers'),
    signatory: str(80, 'Who signs the receipts'),
    signatoryTitle: str(160),
    footer: str(400, 'Receipts must say that nothing was given in return'),
  }),
  bank: z.object({
    accountName: str(120, 'The account name donors should use'),
    bsb: z.string().trim().regex(/^\d{3}-?\d{3}$/, 'A BSB is six digits, like 062-000'),
    accountNumber: z.string().trim().regex(/^[\d\s]{5,12}$/, 'Account numbers are 5 to 10 digits'),
    bankName: str(80, 'Which bank'),
  }),
  payments: z.object({ feeRate: z.number().min(0, 'Cannot be negative').max(0.1, 'Over 10% is surely a typo') }),
  email: z.object({
    fromName: str(80, 'The name donors see'),
    fromEmail: z.string().trim().toLowerCase().email('That email address does not look right'),
    replyTo: z.string().trim().toLowerCase().email('That email address does not look right'),
  }),
  zakat: z.object({
    nisab: z.number().int('Whole cents').positive('Must be more than zero'),
    nisabBasis: z.enum(['silver', 'gold']),
  }),
} satisfies Record<keyof Settings, ZodType>

type Section = keyof typeof SECTIONS
const LABELS: Record<Section, string> = {
  org: 'organisation details',
  receipts: 'receipt settings',
  bank: 'bank details',
  payments: 'payment settings',
  email: 'email sender',
  zakat: 'zakat nisab',
}

const view = (s: Settings) => ({
  ...s,
  payments: { ...s.payments, mode: realMode() },
  runtime: {
    paymentsMode: realMode(),
    paypal: Boolean(env.paypal),
    emailTransport: emailTransport(),
    storage: env.s3 ? 's3' : 'disk',
  },
})

r.get('/', async (_req, res) => {
  res.json(view(await getSettings()))
})

const sampleGift = (s: Settings) => ({
  number: 'G-104233',
  amount: 15000,
  fee: 390,
  designation: 'zakat' as const,
  method: 'card' as const,
  date: new Date(),
  appealTitle: 'Gaza Emergency Appeal',
  receipt: { number: `${s.receipts.prefix}-2027-000123` },
})

r.get('/receipt-preview', async (_req, res) => {
  const s = await getSettings()
  res.json({ html: receiptEmail(sampleGift(s), 'Amina', s).html })
})

r.post('/receipt-preview', async (req, res) => {
  const draft = parse(z.object({ org: SECTIONS.org.partial().optional(), receipts: SECTIONS.receipts.partial().optional() }), req.body)
  const saved = await getSettings()
  const s: Settings = { ...saved, org: { ...saved.org, ...draft.org }, receipts: { ...saved.receipts, ...draft.receipts } }
  res.json({ html: receiptEmail(sampleGift(s), 'Amina', s).html })
})

r.put('/:section', async (req, res) => {
  const section = String(req.params.section) as Section
  if (!(section in SECTIONS)) throw badRequest('There is no such settings section.')
  const next = parse(SECTIONS[section] as ZodType<Record<string, unknown>>, req.body)
  const current = await getSettings()
  const before = current[section] as Record<string, unknown>
  const changed = Object.keys(next).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(next[k]))
  if (!changed.length) return void res.json(view(current))

  const merged = { ...before, ...next } as Record<string, unknown>
  if (section === 'payments') merged.mode = realMode()
  if (section === 'zakat') merged.updatedAt = new Date().toISOString()
  const all = { ...current, [section]: merged } as Settings
  await saveSettings(all)
  await audit(
    req,
    `settings.${section}`,
    `Changed the ${LABELS[section]}: ${changed.join(', ')}`,
    { type: 'settings', label: LABELS[section] },
    { changed, before: Object.fromEntries(changed.map((k) => [k, before[k]])), after: Object.fromEntries(changed.map((k) => [k, next[k]])) },
  )
  res.json(view(all))
})

export default r
