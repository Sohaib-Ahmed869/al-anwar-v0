import { Router, type Request } from 'express'
import { randomBytes } from 'node:crypto'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import {
  DESIGNATION_KEYS, ENQUIRY_TYPES, FREQUENCIES, type Designation, type EnquiryType, type Frequency,
} from '../../shared/domain'
import { formatMoney } from '../../shared/money'
import { bankTransferEmail } from '../emails/templates'
import { button, esc, layout, muted, p, url } from '../emails/layout'
import { env, paymentsSimulated } from '../env'
import { audit } from '../lib/audit'
import { sendEmail } from '../lib/email'
import { findOrCreateDonor, fullName, newBankReference, recordGift } from '../lib/giving'
import { badRequest, clientIp, HttpError, isId, notFound, parse, zEmail } from '../lib/http'
import { checkoutSession, paypalCapture, paypalOrder } from '../lib/payments'
import { newKey, putFile } from '../lib/storage'
import { startPlan } from '../jobs/recurring'
import { Appeal, Donor, Enquiry, Fundraiser, Gift, Plan, getSettings, type DonorDoc } from '../models'
import { afterOnlineGiftPaid, markOnlineGiftPaid } from './webhooks'
import { getQuickGive } from '../models/QuickGive'

/* ---------------------------------------------------------------------------
   /api/public — everything the public website asks the server for. No
   session, no permissions; what a stranger may see and do is decided here.

     GET  /config                 bank details, fee rate, payment mode, nisab
     GET  /quick-give             the home page's quick-donate list, in order
     GET  /appeals, /appeals/:slug
     GET  /fundraisers, /fundraisers/:slug
     POST /fundraisers            one started on /fundraisers/start → approval queue
     POST /checkout               a gift from /give → a payment page, or bank
                                  details, or (simulated) a finished gift
     GET  /paypal/return          PayPal sends the donor back here to capture
     GET  /gifts/:id/status       what the thank-you page shows
     POST /enquiries              contact, volunteer, partner… → admin inbox
     POST /letter                 the footer's monthly-letter sign-up
     GET  /unsubscribe?t=…        the link at the foot of every campaign

   These replace the old Vercel-style handlers in api/*.ts, which are left in
   the repo untouched; the Express app serves these paths now.

   ONE SET OF GIVING RULES. validateGift() in src/services/give.ts is what the
   form runs before it posts, and it is what runs here, so a hand-built POST
   gets exactly the answer the form would have given. It is loaded by path at
   runtime rather than imported: an import would pull the site's React
   components into the server's type-check (give-data.ts types its funds
   against GiveModule.tsx). tsx runs the server in production too, so the .ts
   path resolves the same way everywhere.

   Every write is rate-limited per IP. The CSRF header (X-Requested-With) is
   enforced for all of /api by lib/auth.ts, so the site's fetches send it.
--------------------------------------------------------------------------- */

const r = Router()

/* ---------- the site's own giving rules, shared with the browser ---------- */

type SiteGift = {
  fund: string
  frequency: 'once' | 'monthly'
  appeal?: string
  amount: number
  coverFee: boolean
  provider: 'stripe' | 'paypal'
  first: string
  last: string
  email: string
  behalfName: string
  updates: boolean
}
type SiteGive = { validateGift: (p: SiteGift) => Record<string, string> }
type SiteFunds = { CAUSES: { id: string; label: string }[] }

const GIVE_SERVICE: string = '../../src/services/give.ts'
const GIVE_DATA: string = '../../src/components/give-data.ts'
const siteGive = () => import(GIVE_SERVICE) as Promise<SiteGive>
const siteFunds = () => import(GIVE_DATA) as Promise<SiteFunds>

/** The site's nine funds, as the designation every gift carries. The four
 *  obligations keep their own; the causes (water, food, education,
 *  emergency) are voluntary charity, so sadaqah unless the caller says. */
const FUND_DESIGNATION: Record<string, Designation> = {
  zakat: 'zakat',
  'zakat-fitr': 'zakat_fitr',
  kaffarah: 'kaffarah',
  fidyah: 'fidyah',
  sadaqah: 'sadaqah',
}

/* ---------- limits ---------- */

const MIN = 60_000
const limit = (max: number) =>
  rateLimit({
    windowMs: 10 * MIN,
    /* generous in development, where one person tests the same form fifty times */
    limit: env.isProd ? max : max * 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { message: 'Too many tries from here. Please wait a few minutes and try again.' } })
    },
  })
const checkoutLimit = limit(20)
const formLimit = limit(8)

/* ---------- the home page's quick-donate list (shared/quickgive.ts) ----------
   Only the switched-on options, in the order staff set in Admin → Appeals. */

r.get('/quick-give', async (_req, res) => {
  res.json({ items: (await getQuickGive()).filter((o) => o.enabled) })
})

/* ---------- config ---------- */

r.get('/config', async (_req, res) => {
  const s = await getSettings()
  res.json({
    bank: { accountName: s.bank.accountName, bsb: s.bank.bsb, accountNumber: s.bank.accountNumber, bankName: s.bank.bankName },
    feeRate: s.payments.feeRate,
    payments: paymentsSimulated ? 'simulated' : 'stripe',
    /* in simulated mode PayPal is simulated along with everything else */
    paypal: Boolean(env.paypal) || paymentsSimulated,
    nisab: s.zakat.nisab,
    nisabBasis: s.zakat.nisabBasis,
  })
})

/* ---------- appeals ---------- */

const APPEAL_FIELDS =
  'slug title summary country where causes zakatEligible target raised donorCount status opensAt closesAt image suggested unit featured'

r.get('/appeals', async (_req, res) => {
  const items = await Appeal.find({ status: 'open' }).select(APPEAL_FIELDS).sort({ featured: -1, opensAt: -1 }).lean()
  res.json({ items: items.map(publicAppeal) })
})

/* closed appeals are served too: the page stays up as a record of what was
   raised; only drafts are invisible */
r.get('/appeals/:slug', async (req: Request<{ slug: string }>, res) => {
  const a = await Appeal.findOne({ slug: req.params.slug.toLowerCase(), status: { $in: ['open', 'closed'] } })
    .select(`${APPEAL_FIELDS} story updates`)
    .lean()
  if (!a) throw notFound('That appeal')
  res.json({
    ...publicAppeal(a),
    story: a.story,
    updates: (a.updates ?? [])
      .map((u) => ({ id: String(u._id), date: u.date?.toISOString(), title: u.title, body: u.body }))
      .sort((x, y) => String(y.date).localeCompare(String(x.date))),
  })
})

type LeanAppeal = {
  _id: unknown; slug: string; title: string; summary?: string | null; country: string; where?: string | null
  causes?: string[]; zakatEligible?: boolean | null; target?: number | null; raised?: number | null
  donorCount?: number | null; status?: string | null; opensAt?: Date | null; closesAt?: Date | null; image?: string | null
  suggested?: { amount?: number | null; label?: string | null }[]; unit?: { name?: string | null; plural?: string | null; price?: number | null } | null
  featured?: boolean | null
}
function publicAppeal(a: LeanAppeal) {
  return {
    id: String(a._id),
    slug: a.slug,
    title: a.title,
    summary: a.summary ?? '',
    country: a.country,
    where: a.where ?? undefined,
    causes: a.causes ?? [],
    zakatEligible: Boolean(a.zakatEligible),
    target: a.target ?? 0,
    raised: a.raised ?? 0,
    donorCount: a.donorCount ?? 0,
    status: a.status,
    opensAt: a.opensAt?.toISOString(),
    closesAt: a.closesAt?.toISOString(),
    image: a.image ?? undefined,
    suggested: (a.suggested ?? []).map((s) => ({ amount: s.amount ?? 0, label: s.label ?? undefined })),
    unit: a.unit?.price ? { name: a.unit.name, plural: a.unit.plural, price: a.unit.price } : undefined,
    featured: Boolean(a.featured),
  }
}

/* ---------- fundraisers ---------- */

const FUNDRAISER_FIELDS = 'slug title story occasion target raised donorCount image endsAt status ownerName appeal appealTitle createdAt'

/** "Aisha Rahman" → "Aisha R." — a public page names its organiser, not
 *  their full name. */
const organiser = (name: string) => {
  const [first, ...rest] = name.trim().split(/\s+/)
  const last = rest.at(-1)
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first
}

async function publicFundraisers(rows: Awaited<ReturnType<typeof fundraiserRows>>) {
  const slugs = new Map(
    (await Appeal.find({ _id: { $in: rows.map((f) => f.appeal) } }).select('slug').lean()).map((a) => [String(a._id), a.slug]),
  )
  return rows.map((f) => ({
    id: String(f._id),
    slug: f.slug,
    title: f.title,
    story: f.story,
    occasion: f.occasion,
    organiser: organiser(f.ownerName),
    appeal: { slug: slugs.get(String(f.appeal)), title: f.appealTitle },
    target: f.target,
    raised: f.raised ?? 0,
    donorCount: f.donorCount ?? 0,
    image: f.image ?? undefined,
    endsAt: f.endsAt?.toISOString(),
    status: f.status,
    createdAt: f.createdAt?.toISOString(),
  }))
}
const fundraiserRows = (filter: Record<string, unknown>, max = 200) =>
  Fundraiser.find(filter).select(FUNDRAISER_FIELDS).sort({ createdAt: -1 }).limit(max).lean()

r.get('/fundraisers', async (_req, res) => {
  res.json({ items: await publicFundraisers(await fundraiserRows({ status: 'live' })) })
})

r.get('/fundraisers/:slug', async (req: Request<{ slug: string }>, res) => {
  const [f] = await publicFundraisers(await fundraiserRows({ slug: req.params.slug, status: { $in: ['live', 'ended'] } }, 1))
  if (!f) throw notFound('That fundraiser')
  /* the latest supporters, as the page shows them: first names only, and
     anonymous stays anonymous */
  const recent = await Gift.find({ fundraiser: f.id, status: 'succeeded' }).sort({ date: -1 }).limit(8)
    .select('amount date donorName anonymous message').lean()
  res.json({
    ...f,
    recent: recent.map((g) => ({
      name: g.anonymous ? 'Anonymous' : (g.donorName ?? '').split(' ')[0] || 'A supporter',
      amount: g.amount,
      on: g.date?.toISOString(),
      message: g.message || undefined,
    })),
  })
})

/* A fundraiser started on /fundraisers/start. Nobody has to sign in first:
   the organiser is found or made by email, the page starts 'pending' in the
   admin approval queue exactly as one made in the donor portal does, and an
   email tells them where to manage it. It is not public until approved. */
const zStartFundraiser = z.object({
  appeal: z.string().trim().min(1, 'Choose an appeal.').max(160),
  reason: z.string().max(40).optional(),
  title: z.string().trim().min(6, 'Give your fundraiser a title.').max(90, 'Keep the title under 90 characters.'),
  story: z.string().trim().min(40, 'Tell people a little more, at least a couple of sentences.').max(5000),
  /** dollars, as the form asks for them */
  goal: z.number().min(50, 'Set a goal of $50 or more.').max(10_000_000),
  ends: z.coerce.date().refine((d) => d.getTime() > Date.now(), 'Choose a date after today.'),
  /** a JPEG data URL the browser has already shrunk */
  photo: z.string().max(4_000_000).optional(),
  first: z.string().trim().min(1, 'Enter your first name.').max(80),
  last: z.string().trim().min(1, 'Enter your last name.').max(80),
  email: zEmail,
  group: z.string().trim().max(120).optional(),
  company: z.string().optional(),
})

const PHOTO = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/

r.post('/fundraisers', formLimit, async (req, res) => {
  const b = parse(zStartFundraiser, req.body)
  if (b.company?.trim()) return res.status(201).json({ ok: true, slug: '' })

  const appeal = await Appeal.findOne({ slug: b.appeal })
  if (!appeal || appeal.status !== 'open') throw new HttpError(400, 'That appeal is not taking gifts right now. Choose another.', { appeal: 'Not open' })

  const { donor, created } = await findOrCreateDonor({ email: b.email, firstName: b.first, lastName: b.last, source: 'fundraiser' })

  let image: string | undefined
  const m = b.photo ? PHOTO.exec(b.photo) : null
  if (m) {
    const key = newKey('images', `photo.${m[1] === 'jpeg' ? 'jpg' : m[1]}`)
    await putFile(key, Buffer.from(m[2], 'base64'), `image/${m[1]}`)
    image = `/api/files/${key}`
  }

  const base = b.title.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '')
  const slug = `${base || 'fundraiser'}-${randomBytes(3).toString('hex').slice(0, 5)}`
  const ownerName = b.group || `${b.first} ${b.last}`

  const f = await Fundraiser.create({
    slug,
    owner: donor._id,
    ownerName,
    appeal: appeal._id,
    appealTitle: appeal.title,
    title: b.title,
    story: b.story,
    occasion: b.reason === 'memory' ? 'memory' : 'other',
    target: Math.round(b.goal * 100),
    image,
    endsAt: b.ends,
    status: 'pending',
  })
  await audit(
    req,
    'fundraiser.create',
    `${ownerName} started the fundraiser “${f.title}” for ${appeal.title} from the website (target ${formatMoney(f.target)}${created ? `; new supporter ${donor.number}` : ''}), sent for approval`,
    { type: 'fundraiser', id: f._id, label: f.title },
    { ip: clientIp(req) },
  )
  await sendEmail(
    donor.email,
    {
      template: 'fundraiser-received',
      subject: `We have your fundraiser: ${f.title}`,
      html: layout({
        heading: 'Your fundraiser is with us',
        body: [
          p(`Assalamu alaikum ${esc(b.first)}, thank you for starting <strong>${esc(f.title)}</strong> for ${esc(appeal.title)}.`),
          p('Someone from our team reads every page before it goes public, usually within two working days. We will email you the moment it is live, with the link to share.'),
          p('Until then you can see it, and change the words, the goal or the end date, from your account. Sign in with this email address and we will send you a code.'),
          button('Open my fundraisers', url('/account/fundraisers')),
          muted('If you did not start this fundraiser, reply to this email and we will take it down.'),
        ].join(''),
      }),
    },
    { donor: donor._id },
  )
  res.status(201).json({ ok: true, slug: f.slug })
})

/* ---------- checkout ---------- */

const zCheckout = z.object({
  fund: z.string().max(40),
  frequency: z.enum(['once', 'weekly', 'fortnightly', 'monthly']).default('once'),
  instalments: z.number().int().min(2, 'At least two instalments').max(36, 'At most 36 instalments').optional(),
  /** dollars, as the form asks for them; cents from here on */
  amount: z.number(),
  coverFee: z.boolean().default(false),
  provider: z.enum(['stripe', 'paypal', 'bank']),
  first: z.string().max(80).default(''),
  last: z.string().max(80).default(''),
  email: z.string().max(200).default(''),
  behalfName: z.string().max(120).default(''),
  updates: z.boolean().default(false),
  /** the form's display label for where it is going ("Tarim, Yemen"), or a slug */
  appeal: z.string().max(160).optional(),
  appealSlug: z.string().max(160).optional(),
  fundraiser: z.string().max(160).optional(),
  designation: z.enum(DESIGNATION_KEYS as [Designation, ...Designation[]]).optional(),
  anonymous: z.boolean().optional(),
  message: z.string().max(500).optional(),
})

r.post('/checkout', checkoutLimit, async (req, res) => {
  const b = parse(zCheckout, req.body)
  const regular = b.frequency !== 'once'

  /* The site's own rules first, with the two extensions the site does not
     offer yet mapped onto the ones it does: weekly and fortnightly follow the
     monthly rules (voluntary funds, card only), and instalments — a gift the
     donor owes split into payments — follow the one-time rules, since a
     zakat can rightly be paid in parts. Bank is checked as a card gift. */
  const bad = (await siteGive()).validateGift({
    fund: b.fund,
    frequency: regular && !b.instalments ? 'monthly' : 'once',
    appeal: b.appeal,
    amount: b.amount,
    coverFee: b.coverFee,
    provider: b.provider === 'bank' ? 'stripe' : b.provider,
    first: b.first,
    last: b.last,
    email: b.email,
    behalfName: b.behalfName,
    updates: b.updates,
  })
  if (b.instalments && !regular) bad.frequency ??= 'Choose how often the instalments are taken.'
  if (regular && b.provider === 'bank')
    bad.provider ??= 'A regular gift is taken by card. A standing transfer can be set up in your own banking app.'
  if (regular && b.provider === 'paypal') bad.provider ??= 'Regular gifts are by card. PayPal can only take a one-time gift.'
  if (Object.keys(bad).length) throw badRequest('Some details need another look.', bad)

  const payLive = b.provider === 'stripe' ? Boolean(env.stripe) : b.provider === 'paypal' ? Boolean(env.paypal) : true
  if (b.provider === 'paypal' && !payLive && !paymentsSimulated)
    throw badRequest('PayPal is not switched on yet.', { provider: 'PayPal is not switched on yet. Please pay by card.' })

  /* where it is going: a live fundraiser gives to its appeal */
  const fundraiser = b.fundraiser ? await Fundraiser.findOne({ slug: b.fundraiser, status: 'live' }) : null
  const slug = (b.appealSlug ?? (fundraiser ? undefined : b.appeal))?.trim().toLowerCase()
  const appeal = fundraiser
    ? await Appeal.findById(fundraiser.appeal)
    : slug && /^[a-z0-9-]+$/.test(slug)
      ? await Appeal.findOne({ slug, status: { $in: ['open', 'closed'] } })
      : null
  if (appeal?.status === 'closed' && !fundraiser)
    throw badRequest(`${appeal.title} has closed.`, { appeal: `${appeal.title} has closed and is no longer taking gifts. Thank you for thinking of it.` })

  const { CAUSES } = await siteFunds()
  const fundLabel = CAUSES.find((c) => c.id === b.fund)?.label ?? 'Al-Anwaar'
  const designation = b.designation ?? FUND_DESIGNATION[b.fund] ?? 'sadaqah'

  const { donor, created } = await findOrCreateDonor({ email: b.email, firstName: b.first, lastName: b.last, source: 'web' })
  if (created) {
    donor.set('preferences.emailOptIn', b.updates)
    await donor.save()
    await audit(req, 'donor.create', `Added ${fullName(donor)} (${donor.number}) from a gift on the website`, {
      type: 'donor', id: donor._id, label: donor.number,
    })
  } else if (b.updates && !donor.preferences?.emailOptIn) {
    /* ticking "send me updates" turns them on; leaving it unticked never turns
       off something an existing supporter chose */
    donor.set('preferences.emailOptIn', true)
    await donor.save()
  }

  const s = await getSettings()
  const amount = Math.round(b.amount * 100)
  const fee = b.coverFee && b.provider !== 'bank' ? Math.round(amount * s.payments.feeRate) : 0
  const frequency = regular ? (b.frequency as Frequency) : null
  const checkout = { frequency: b.frequency, instalments: b.instalments, coverFee: b.coverFee }
  const label = `${fundLabel}${appeal ? ` — ${appeal.title}` : ''}${frequency ? ` (${FREQUENCIES[frequency].label.toLowerCase()})` : ''}`
  const base = {
    donor,
    amount,
    fee,
    designation,
    appealId: appeal?._id,
    fundraiserId: fundraiser?._id,
    anonymous: b.anonymous,
    message: b.message?.trim() || undefined,
    notes: b.behalfName.trim() ? `Given on behalf of ${b.behalfName.trim()}` : undefined,
    source: 'online' as const,
  }

  /* --- bank transfer: a pledge with a reference, and the details by email --- */
  if (b.provider === 'bank') {
    const reference = await newBankReference()
    const gift = await recordGift({ ...base, method: 'bank', status: 'pending', reference }, req)
    await sendEmail(donor.email, bankTransferEmail({ amount, reference, appealTitle: gift.appealTitle }, donor.firstName, s), {
      donor: donor._id,
    })
    res.json({
      kind: 'bank',
      giftId: gift.id,
      reference,
      bank: { accountName: s.bank.accountName, bsb: s.bank.bsb, accountNumber: s.bank.accountNumber },
      amount,
      url: `/thank-you?gift=${gift.id}`,
    })
    return
  }

  /* --- simulated: no provider connected, so the gift is recorded as paid,
         and says so everywhere ("simulated" chip in the portals, and on the
         thank-you page) --- */
  if (!payLive) {
    const gift = await recordGift({ ...base, method: b.provider === 'paypal' ? 'paypal' : 'card', status: 'succeeded' }, req)
    gift.set('checkout', checkout)
    await gift.save()
    if (frequency) {
      await startPlan(
        {
          donor,
          amount,
          coverFee: b.coverFee,
          designation,
          frequency,
          instalments: b.instalments,
          appeal,
          payment: { method: 'card', brand: 'Visa', last4: '4242', expMonth: 12, expYear: new Date().getFullYear() + 3 },
          firstGift: gift,
        },
        req,
      )
    }
    res.json({ kind: 'redirect', url: `/thank-you?gift=${gift.id}&simulated=1` })
    return
  }

  /* --- a real provider: a pending gift, and the provider's hosted page. The
         webhook (Stripe) or the return route (PayPal) marks it paid. --- */
  const gift = await recordGift({ ...base, method: b.provider === 'paypal' ? 'paypal' : 'card', status: 'pending' }, req)
  gift.set('checkout', checkout)
  await gift.save()

  let to: string | null = null
  try {
    if (b.provider === 'paypal') {
      const order = await paypalOrder({ giftId: gift.id, amount: amount + fee, label })
      if (order?.id) {
        gift.set('external.paypal', order.id)
        await gift.save()
      }
      to = order?.url ?? null
    } else {
      to = await checkoutSession({ giftId: gift.id, amount: amount + fee, label, email: donor.email, recurring: Boolean(frequency) })
    }
  } catch (err) {
    console.error('[checkout]', b.provider, err)
  }
  if (!to) {
    gift.status = 'failed'
    gift.failureReason = 'The payment page could not be opened.'
    await gift.save()
    throw new HttpError(502, `We could not open ${b.provider === 'paypal' ? 'PayPal' : 'the card payment page'}. Nothing has been charged — please try again in a moment.`)
  }
  res.json({ kind: 'redirect', url: to })
})

/* PayPal returns the donor here with the order approved but NOT yet paid;
   capturing it is what takes the money. */
r.get('/paypal/return', async (req, res) => {
  const giftId = String(req.query.gift ?? '')
  const token = String(req.query.token ?? '')
  if (!isId(giftId)) return res.redirect('/give?cancelled=1')
  const gift = await Gift.findById(giftId)
  if (!gift) return res.redirect('/give?cancelled=1')
  const back = `/thank-you?gift=${gift.id}`
  if (gift.status !== 'pending' || gift.method !== 'paypal' || !token || gift.external?.paypal !== token) return res.redirect(back)

  const cap = await paypalCapture(token).catch((err: unknown) => ({ ok: false as const, error: String(err) }))
  if (cap.ok) {
    const paid = await markOnlineGiftPaid(gift.id, { paypal: token })
    if (paid) await afterOnlineGiftPaid(paid, 'PayPal')
  } else {
    gift.status = 'failed'
    gift.failureReason = cap.error
    await gift.save()
    await audit(req, 'gift.failed', `PayPal did not complete ${formatMoney(gift.amount)} gift ${gift.number} from ${gift.donorName}: ${cap.error}`, {
      type: 'gift', id: gift._id, label: gift.number,
    })
  }
  res.redirect(back)
})

/* What the thank-you page shows. Deliberately small: a first name, the sum,
   where it went, and the receipt or transfer reference — nothing that would
   matter if a gift id were guessed. Only website gifts from the last 30 days
   answer at all; an old or offline gift is simply "not found". */
r.get('/gifts/:id/status', async (req: Request<{ id: string }>, res) => {
  if (!isId(req.params.id)) throw notFound('That gift')
  const g = await Gift.findById(req.params.id).lean()
  if (!g || g.source !== 'online' || Date.now() - new Date(g.createdAt).getTime() > 30 * 86_400_000) throw notFound('That gift')
  const [donor, plan, s] = await Promise.all([
    Donor.findById(g.donor).select('firstName').lean(),
    g.plan ? Plan.findById(g.plan).select('frequency kind instalments nextChargeAt').lean() : null,
    getSettings(),
  ])
  const bankPending = g.status === 'pending' && g.method === 'bank'
  res.json({
    id: String(g._id),
    number: g.number,
    status: g.status,
    amount: g.amount,
    fee: g.fee ?? 0,
    designation: g.designation,
    method: g.method,
    appealTitle: g.appealTitle ?? null,
    fundraiserTitle: g.fundraiserTitle ?? null,
    date: g.date.toISOString(),
    receiptNumber: g.receipt?.number ?? null,
    receiptEmailed: Boolean(g.receipt?.emailedAt),
    reference: g.reference ?? null,
    firstName: donor?.firstName ?? null,
    frequency: plan?.frequency ?? (g.checkout?.frequency && g.checkout.frequency !== 'once' ? g.checkout.frequency : 'once'),
    instalments: plan?.instalments?.total ?? g.checkout?.instalments ?? null,
    nextChargeAt: plan?.nextChargeAt?.toISOString() ?? null,
    bank: bankPending ? { accountName: s.bank.accountName, bsb: s.bank.bsb, accountNumber: s.bank.accountNumber } : null,
    failureReason: g.status === 'failed' ? (g.failureReason ?? null) : null,
    simulated: paymentsSimulated && g.method !== 'bank',
  })
})

/* ---------- enquiries ---------- */

const zEnquiry = z.object({
  type: z.enum(Object.keys(ENQUIRY_TYPES) as [EnquiryType, ...EnquiryType[]]),
  name: z.string().trim().min(1, 'We would like to know who to reply to.').max(120),
  email: zEmail,
  phone: z.string().trim().max(40).optional(),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().max(5000).default(''),
  meta: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional(),
  /** the honeypot the site's forms carry */
  company: z.string().optional(),
})

async function donorByEmail(email: string): Promise<DonorDoc | null> {
  let d = await Donor.findOne({ $or: [{ email }, { altEmails: email }] })
  while (d?.status === 'merged' && d.mergedInto) d = await Donor.findById(d.mergedInto)
  return d
}

r.post('/enquiries', formLimit, async (req, res) => {
  const b = parse(zEnquiry, req.body)
  /* accepted and dropped: a bot is never told which field gave it away */
  if (b.company?.trim()) return res.json({ ok: true })

  const donor = await donorByEmail(b.email)
  const meta: Record<string, string> = {}
  for (const [k, v] of Object.entries(b.meta ?? {}).slice(0, 20)) {
    const key = k.replace(/[^\w-]/g, '').slice(0, 40)
    if (key) meta[key] = (Array.isArray(v) ? v.join(', ') : String(v)).slice(0, 500)
  }
  const e = await Enquiry.create({
    type: b.type,
    name: b.name,
    email: b.email,
    phone: b.phone || undefined,
    subject: b.subject || undefined,
    message: b.message,
    donor: donor?._id,
    meta,
  })
  await audit(
    req,
    'enquiry.create',
    `Received a ${ENQUIRY_TYPES[b.type].label.toLowerCase()} enquiry from ${b.name}${donor ? ` (${donor.number})` : ''}${b.subject ? `: ${b.subject}` : ''}`,
    { type: 'enquiry', id: e._id, label: b.name },
    { ip: clientIp(req) },
  )
  res.json({ ok: true, id: e.id })
})

/* ---------- the monthly letter ---------- */

const zLetter = z.object({ email: zEmail, company: z.string().optional() })

/** "amina.rahman@…" → "Amina". Only ever a placeholder until they give a
 *  gift or edit their profile; "Friend" when the address has no name in it. */
function nameFromEmail(email: string) {
  const word = email.split('@')[0].split(/[._\-+\d]+/).find((w) => /^[a-z]{2,}$/i.test(w))
  return word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : 'Friend'
}

r.post('/letter', formLimit, async (req, res) => {
  const b = parse(zLetter, req.body)
  if (b.company?.trim()) return res.json({ ok: true, status: 'joined' })

  const { donor, created } = await findOrCreateDonor({ email: b.email, firstName: nameFromEmail(b.email), source: 'web' })
  const already = !created && donor.preferences?.emailOptIn && donor.preferences?.topics?.includes('reports')
  if (!already) {
    donor.set('preferences.emailOptIn', true)
    donor.set('preferences.topics', [...new Set([...(donor.preferences?.topics ?? []), 'reports'])])
  }
  if (!donor.tags.includes('newsletter')) donor.tags.push('newsletter')
  await donor.save()
  if (!already) {
    await audit(
      req,
      'donor.subscribe',
      created
        ? `Added ${fullName(donor)} (${donor.number}) from the website's letter sign-up`
        : `${fullName(donor)} (${donor.number}) joined the monthly letter from the website`,
      { type: 'donor', id: donor._id, label: donor.number },
    )
  }
  /* honest about which it was: new, switched back on, or already on the list */
  res.json({ ok: true, status: created ? 'joined' : already ? 'already' : 'resubscribed' })
})

/* ---------- unsubscribe ---------- */

r.get('/unsubscribe', async (req, res) => {
  const t = String(req.query.t ?? '')
  const donor = /^[\w-]{16,}$/.test(t) ? await Donor.findOne({ unsubscribeToken: t }) : null
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  if (!donor) {
    res.status(404).send(
      layout({
        heading: 'That link has expired',
        body: [
          p('We could not find the subscription this link belongs to. It may be from an old email, or it was copied only in part.'),
          p('You can switch every email off yourself from your account, or reply to any of our emails and we will do it for you.'),
          button('Email preferences', url('/account/profile')),
        ].join(''),
      }),
    )
    return
  }
  if (donor.preferences?.emailOptIn !== false) {
    donor.set('preferences.emailOptIn', false)
    await donor.save()
    await audit(req, 'donor.unsubscribe', `${fullName(donor)} (${donor.number}) unsubscribed from emails using the link in an email`, {
      type: 'donor', id: donor._id, label: donor.number,
    })
  }
  res.send(
    layout({
      heading: `You are unsubscribed, ${donor.firstName}`,
      body: [
        p(`We will not send appeals, updates or letters to <strong>${esc(donor.email)}</strong> any more.`),
        muted('Receipts for any gift you give, and notices about a regular gift you have with us, still come — they are records, not marketing.'),
        p('Changed your mind, or only want to hear about some things? You can choose exactly what arrives.'),
        button('Fine-tune my emails', url('/account/profile')),
      ].join(''),
    }),
  )
})

export default r
