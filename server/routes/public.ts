import { Router, type Request } from 'express'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { ENQUIRY_TYPES, FREQUENCIES, type EnquiryType, type Frequency } from '../../shared/domain'
import {
  NAME_LOOKS_RIGHT, OWED_DESIGNATIONS, ZAKAT_DESIGNATIONS, designationOf, fundById, validateGift,
} from '../../shared/giving'
import { formatMoney } from '../../shared/money'
import { OPERATING_COSTS_CENTS, isOperatingCosts } from '../../shared/operating-costs'
import { fundraiserConfirmEmail, fundraiserReceivedEmail, optInConfirmEmail } from '../emails/giving'
import { bankTransferEmail } from '../emails/templates'
import { url } from '../emails/layout'
import { env, paymentsSimulated } from '../env'
import { audit } from '../lib/audit'
import { currentDonor } from '../lib/auth'
import { sendEmail } from '../lib/email'
import { findOrCreateDonor, fullName, newBankReference, recordGift } from '../lib/giving'
import { badRequest, clientIp, HttpError, isId, notFound, parse, zEmail } from '../lib/http'
import { checkoutSession, paypalOrder } from '../lib/payments'
import { settlePaypalOrder } from '../lib/paypal'
import { limiter } from '../lib/ratelimit'
import { newKey, putFile } from '../lib/storage'
import { startPlan } from '../jobs/recurring'
import { Appeal, Donor, Enquiry, Fundraiser, Gift, Plan, getSettings, type DonorDoc, type GiftDoc } from '../models'
import { OptIn } from '../models/OptIn'
import { getQuickGive } from '../models/QuickGive'

/* ---------------------------------------------------------------------------
   /api/public — everything the public website asks the server for. No
   session, no permissions; what a stranger may see and do is decided here.

     GET  /config                 bank details, operating-cost choices, payment mode, nisab
     GET  /quick-give             the home page's quick-donate list, in order
     GET  /appeals, /appeals/:slug
     GET  /fundraisers, /fundraisers/:slug
     POST /fundraisers            one started on /fundraisers/start → approval
                                  queue, after the organiser confirms the email
                                  address unless they were signed in as it
     POST /fundraisers/confirm    the confirmation link's page posts its token here
     POST /checkout               a gift from /give → a payment page, or bank
                                  details, or (simulated) a finished gift
     GET  /paypal/return          PayPal sends the donor back here to capture
     GET  /gifts/:id/status?t=    what the thank-you page shows
     POST /enquiries              contact, volunteer, partner… → admin inbox
     POST /letter                 the footer's monthly-letter sign-up: emails a
                                  link to confirm, and changes nothing else
     POST /letter/confirm         the link's page posts its token here

   (Unsubscribe lives in routes/unsubscribe.ts.)

   ONE SET OF GIVING RULES. validateGift() in shared/giving.ts is what the form
   runs before it posts, and it is what runs here, so a hand-built POST gets
   exactly the answer the form would have given. The designation always
   follows the fund — a client cannot pick one — because the designation
   decides which rules apply: zakat only to an appeal that may take it, and
   nothing owed (zakat, fitr, kaffarah, fidyah) as a standing order (M11).

   A STRANGER'S EMAIL ADDRESS IS NOT CONSENT (finding M10). Anyone can type
   anyone's address into a public form, so:
     - nothing here turns marketing email on. The letter sign-up and the
       "send me updates" tick both email a confirmation link instead, and the
       answer is the same whether or not we know the address;
     - every email sent from here has a fixed subject; what the visitor typed
       appears only in the body, escaped;
     - each address can be sent only a few emails an hour from these forms,
       however many places the requests come from.

   Every write is rate-limited, per IP and per recipient, with the counts in
   Mongo (lib/ratelimit.ts). The CSRF header (X-Requested-With) is enforced for
   all of /api by lib/auth.ts, so the site's fetches send it.
--------------------------------------------------------------------------- */

const r = Router()

/* ---------- limits ---------- */

const MIN = 60_000
const perIp = (name: string, max: number) =>
  limiter({ name, windowMs: 10 * MIN, limit: max, message: 'Too many tries from here. Please wait a few minutes and try again.' })
const checkoutLimit = perIp('checkout', 20)
const formLimit = perIp('forms', 8)
const statusLimit = perIp('gift-status', 60)

/** the address a form is about to email, as a limit key */
const recipient = (req: Request) => `to:${String((req.body as { email?: unknown })?.email ?? '').trim().toLowerCase()}`
const perRecipient = (name: string, max: number, hours = 1) =>
  limiter({
    name,
    windowMs: hours * 60 * MIN,
    limit: max,
    keyGenerator: recipient,
    message: 'We have already sent several emails to that address in the last little while. Please try again later, or get in touch.',
  })
const checkoutRecipientLimit = perRecipient('checkout-recipient', 10)
const fundraiserRecipientLimit = perRecipient('fundraiser-recipient', 3)
const letterRecipientLimit = perRecipient('letter-recipient', 3, 24)

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
/** constant-time string comparison, for tokens */
const sameToken = (a: string, b: string) => timingSafeEqual(Buffer.from(sha256(a)), Buffer.from(sha256(b)))

/** Where the thank-you page shows a website gift: by id AND its random token. */
const thankYou = (g: Pick<GiftDoc, 'id' | 'publicToken'>, extra = '') =>
  `/thank-you?gift=${g.id}&t=${encodeURIComponent(g.publicToken ?? '')}${extra}`

/** Ask an address to confirm it wants our emails (the double opt-in). The
 *  token goes out in the link only; we keep its hash. */
async function sendOptIn(email: string, source: 'letter' | 'checkout', topics: string[], donor?: DonorDoc | null) {
  const token = randomBytes(24).toString('base64url')
  await OptIn.create({ email, tokenHash: sha256(token), topics, source, expiresAt: new Date(Date.now() + 7 * 24 * 60 * MIN) })
  await sendEmail(email, optInConfirmEmail(url(`/letter/confirm?t=${token}`), source), { donor: donor?._id })
}

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
    operatingCosts: OPERATING_COSTS_CENTS,
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

/* A fundraiser started on /fundraisers/start. Nobody has to sign in first,
   but nobody's address is taken on trust either (finding M10):

     - signed in to the donor portal as the address given: the session already
       proves it, so the page goes straight to 'pending' in the approval queue,
       as one made in the portal does;
     - otherwise it starts 'unverified'. The address gets one email of our own
       words with a confirmation link; only when that link is used does the
       page reach the approval queue and the organiser get the "we have your
       fundraiser" email with their title in it. Until then no one else sees
       it, and the sweeps delete it after 7 days.

   Either way it is not public until a person here approves it. */
const name = (label: string) =>
  z.string().trim().min(1, `Enter your ${label}.`).max(80).refine((s) => NAME_LOOKS_RIGHT.test(s), 'Use letters only in your name.')

const zStartFundraiser = z.object({
  appeal: z.string().trim().min(1, 'Choose an appeal.').max(160),
  reason: z.string().max(40).optional(),
  title: z.string().trim().min(6, 'Give your fundraiser a title.').max(90, 'Keep the title under 90 characters.'),
  story: z.string().trim().min(40, 'Tell people a little more, at least a couple of sentences.').max(5000),
  /** dollars, as the form asks for them */
  goal: z.number().min(50, 'Set a goal of $50 or more.').max(10_000_000),
  ends: z.coerce.date().refine((d) => d.getTime() > Date.now(), 'Choose a date after today.'),
  /** a JPEG data URL the browser has already shrunk; under the 2 MB body
   *  limit with room to spare, so a big one is refused here with a reason
   *  rather than by the JSON parser */
  photo: z.string().max(2_000_000, 'That photo is too large. Choose one under 1.5 MB.').optional(),
  first: name('first name'),
  last: name('last name'),
  email: zEmail,
  group: z.string().trim().max(120).refine((s) => !s || /^[\p{L}\p{M}\p{N}' .,&()\-’]+$/u.test(s), 'Use letters and numbers only.').optional(),
  company: z.string().optional(),
})

/** how long a public fundraiser's confirmation link works */
const FUNDRAISER_CONFIRM_MS = 48 * 60 * MIN

const PHOTO = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/
const MAX_PHOTO_BYTES = 1_500_000

/** The photo's bytes, if they really are the image the data URL says: the
 *  label is the browser's word, the first bytes are the file's. */
function photoOf(dataUrl: string): { ext: string; type: string; bytes: Buffer } | null {
  const m = PHOTO.exec(dataUrl)
  if (!m) return null
  const bytes = Buffer.from(m[2], 'base64')
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) return null
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const isWebp = bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  const ok = m[1] === 'jpeg' ? isJpeg : m[1] === 'png' ? isPng : isWebp
  return ok ? { ext: m[1] === 'jpeg' ? 'jpg' : m[1], type: `image/${m[1]}`, bytes } : null
}

r.post('/fundraisers', formLimit, fundraiserRecipientLimit, async (req, res) => {
  const b = parse(zStartFundraiser, req.body)
  if (b.company?.trim()) return res.status(201).json({ ok: true, slug: '' })

  const appeal = await Appeal.findOne({ slug: b.appeal })
  if (!appeal || appeal.status !== 'open') throw new HttpError(400, 'That appeal is not taking donations right now. Choose another.', { appeal: 'Not open' })

  const photo = b.photo ? photoOf(b.photo) : null
  if (b.photo && !photo) throw new HttpError(400, 'That photo could not be used.', { photo: 'Choose a JPEG, PNG or WebP photo under 1.5 MB.' })

  /* the donor portal's session proves the address only if it is the one given */
  const signedIn = await currentDonor(req)
  const proven = Boolean(signedIn && [signedIn.email, ...(signedIn.altEmails ?? [])].includes(b.email))
  const { donor, created } = proven
    ? { donor: signedIn!, created: false }
    : await findOrCreateDonor({ email: b.email, firstName: b.first, lastName: b.last, source: 'fundraiser' })

  let image: string | undefined
  if (photo) {
    const key = newKey('images', `photo.${photo.ext}`)
    await putFile(key, photo.bytes, photo.type)
    image = `/api/files/${key}`
  }

  const base = b.title.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '')
  const slug = `${base || 'fundraiser'}-${randomBytes(3).toString('hex').slice(0, 5)}`
  const ownerName = b.group || `${b.first} ${b.last}`
  /* the link's token goes out in the email only; the page keeps its hash */
  const token = randomBytes(24).toString('base64url')

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
    status: proven ? 'pending' : 'unverified',
    ...(proven ? {} : { verify: { tokenHash: sha256(token), expiresAt: new Date(Date.now() + FUNDRAISER_CONFIRM_MS), createdDonor: created } }),
  })
  await audit(
    req,
    'fundraiser.create',
    `${ownerName} started the fundraiser “${f.title}” for ${appeal.title} from the website (target ${formatMoney(f.target)}${created ? `; new supporter ${donor.number}` : ''}); ${
      proven ? 'signed in as the organiser, so sent for approval' : 'waiting for the organiser to confirm their email address'
    }`,
    { type: 'fundraiser', id: f._id, label: f.title },
    { ip: clientIp(req) },
  )
  if (proven) await sendEmail(donor.email, fundraiserReceivedEmail(b.first, f.title, appeal.title), { donor: donor._id })
  else await sendEmail(b.email, fundraiserConfirmEmail(url(`/fundraisers/confirm?t=${token}`)), { donor: donor._id })
  /* the slug only when the page is the organiser's for certain: an
     unverified one is nobody's to link to yet */
  res.status(201).json({ ok: true, slug: proven ? f.slug : '', confirm: !proven })
})

/* The confirmation link's page posts its token here (a POST, because mail
   scanners follow every GET link in a message). The first use moves the page
   into the approval queue and sends the organiser the email with their title
   in it; a second use of the same link says it is already done. */
r.post('/fundraisers/confirm', formLimit, async (req, res) => {
  const { t } = parse(z.object({ t: z.string().trim().min(16).max(200) }), req.body)
  const f = await Fundraiser.findOne({ 'verify.tokenHash': sha256(t) })
  const expired = (f?.verify?.expiresAt?.getTime() ?? 0) <= Date.now()
  if (!f || (f.status === 'unverified' && expired)) {
    throw new HttpError(400, 'That link has expired or is not one of ours. You can start the fundraiser again.')
  }
  const now = new Date()
  const moved = await Fundraiser.updateOne({ _id: f._id, status: 'unverified' }, { $set: { status: 'pending', 'verify.confirmedAt': now } })
  if (!moved.modifiedCount) return void res.json({ ok: true, already: true })

  const owner = await Donor.findById(f.owner).select('firstName email number').lean()
  await audit(
    req,
    'fundraiser.confirm',
    `The organiser confirmed their email address for the fundraiser “${f.title}”${owner ? ` (${owner.number})` : ''}, so it was sent for approval`,
    { type: 'fundraiser', id: f._id, label: f.title },
    { ip: clientIp(req) },
  )
  if (owner?.email) await sendEmail(owner.email, fundraiserReceivedEmail(owner.firstName, f.title, f.appealTitle), { donor: owner._id })
  res.json({ ok: true, already: false })
})

/* ---------- checkout ---------- */

const zCheckout = z.object({
  fund: z.string().max(40),
  frequency: z.enum(['once', 'weekly', 'fortnightly', 'monthly']).default('once'),
  instalments: z.number().int().min(2, 'At least two instalments').max(36, 'At most 36 instalments').optional(),
  /** dollars, as the form asks for them; cents from here on */
  amount: z.number(),
  /** dollars too: 0, 2, 5 or 10 (shared/operating-costs.ts); cents from here on */
  operatingCosts: z.number().default(0),
  provider: z.enum(['stripe', 'paypal', 'bank']),
  first: z.string().max(80).default(''),
  last: z.string().max(80).default(''),
  email: zEmail,
  behalfName: z.string().max(120).default(''),
  updates: z.boolean().default(false),
  /** the form's display label for where it is going ("Tarim, Yemen"), or a slug */
  appeal: z.string().max(160).optional(),
  appealSlug: z.string().max(160).optional(),
  fundraiser: z.string().max(160).optional(),
  /** accepted only when it is the fund's own designation (see the header) */
  designation: z.string().max(40).optional(),
  anonymous: z.boolean().optional(),
  message: z.string().max(500).optional(),
})

r.post('/checkout', checkoutLimit, checkoutRecipientLimit, async (req, res) => {
  const b = parse(zCheckout, req.body)
  const regular = b.frequency !== 'once'

  /* The site's own rules first, with the two extensions the site does not
     offer yet mapped onto the ones it does: weekly and fortnightly follow the
     monthly rules (voluntary funds, card only), and instalments — a gift the
     donor owes split into payments — follow the one-time rules, since a
     zakat can rightly be paid in parts. Bank is checked as a card gift. */
  const bad = validateGift({
    fund: b.fund,
    frequency: regular && !b.instalments ? 'monthly' : 'once',
    appeal: b.appeal,
    amount: b.amount,
    operatingCosts: b.operatingCosts,
    provider: b.provider === 'bank' ? 'stripe' : b.provider,
    first: b.first,
    last: b.last,
    email: b.email,
    behalfName: b.behalfName,
    updates: b.updates,
  })
  const designation = designationOf(b.fund)
  if (b.designation && b.designation !== designation) bad.designation ??= 'A donation is designated by the fund it is given to.'
  if (regular && !b.instalments && OWED_DESIGNATIONS.has(designation)) bad.frequency ??= 'This is owed once, not as a regular donation.'
  if (b.instalments && !regular) bad.frequency ??= 'Choose how often the instalments are taken.'
  if (regular && b.provider === 'bank')
    bad.provider ??= 'A regular donation is taken by card. A standing transfer can be set up in your own banking app.'
  if (regular && b.provider === 'paypal') bad.provider ??= 'Regular donations are by card. PayPal can only take a one-time donation.'
  if (Object.keys(bad).length) throw badRequest('Some details need another look.', bad)

  const payLive = b.provider === 'stripe' ? Boolean(env.stripe) : b.provider === 'paypal' ? Boolean(env.paypal) : true
  if (b.provider === 'paypal' && !payLive && !paymentsSimulated)
    throw badRequest('PayPal is not switched on yet.', { provider: 'PayPal is not switched on yet. Please pay by card.' })

  /* where it is going: a live fundraiser, until its end date, gives to its
     appeal; one that has finished takes nothing more (finding L10) */
  const fundraiser = b.fundraiser
    ? await Fundraiser.findOne({ slug: b.fundraiser, status: 'live', $or: [{ endsAt: null }, { endsAt: { $gt: new Date() } }] })
    : null
  if (b.fundraiser && !fundraiser)
    throw badRequest('That fundraiser has finished.', { fundraiser: 'This fundraiser has finished and is no longer taking donations. You can still give to its appeal.' })
  const slug = (b.appealSlug ?? (fundraiser ? undefined : b.appeal))?.trim().toLowerCase()
  const appeal = fundraiser
    ? await Appeal.findById(fundraiser.appeal)
    : slug && /^[a-z0-9-]+$/.test(slug)
      ? await Appeal.findOne({ slug, status: { $in: ['open', 'closed'] } })
      : null
  if (appeal && appeal.status !== 'open')
    throw badRequest(`${appeal.title} has closed.`, { appeal: `${appeal.title} has closed and is no longer taking donations. Thank you for thinking of it.` })
  /* zakat goes only where it may: to people who qualify, through an appeal
     the charity has marked as able to take it (finding M11) */
  if (appeal && ZAKAT_DESIGNATIONS.has(designation) && !appeal.zakatEligible)
    throw badRequest('Some details need another look.', { fund: `${appeal.title} cannot take zakat. Give it as sadaqah, or give your zakat to the zakat fund.` })

  const fundLabel = fundById(b.fund)?.label ?? 'Al-Anwaar'

  const { donor, created } = await findOrCreateDonor({ email: b.email, firstName: b.first, lastName: b.last, source: 'web' })
  if (created) {
    await audit(req, 'donor.create', `Added ${fullName(donor)} (${donor.number}) from a donation on the website`, {
      type: 'donor', id: donor._id, label: donor.number,
    })
  }
  /* "send me updates" never switches marketing on by itself: the address is
     asked to confirm first, and an existing supporter's own choice is never
     overridden from a public form (finding M10) */
  if (b.updates && !donor.preferences?.emailOptIn) await sendOptIn(donor.email, 'checkout', [], donor)

  const s = await getSettings()
  const amount = Math.round(b.amount * 100)
  /* The optional operating-costs contribution (28 September 2026), which
     replaced the percentage card fee. It rides on the gift's `fee` field, in
     cents, so it stays separate from the donation through recordGift(), the
     receipt, the reports and the Xero export. validateGift() has already
     checked the dollars; this checks the cents against the same shared list,
     so rounding can never let an unlisted figure through. A bank transfer
     pledge is for the donation alone, as the card fee was. */
  const ops = Math.round(b.operatingCosts * 100)
  if (!isOperatingCosts(ops)) throw badRequest('Some details need another look.', { operatingCosts: 'Choose $2, $5, $10 or no contribution to operating costs.' })
  const fee = b.provider === 'bank' ? 0 : ops
  const frequency = regular ? (b.frequency as Frequency) : null
  const checkout = { frequency: b.frequency, instalments: b.instalments, operatingCosts: fee }
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
      url: thankYou(gift),
    })
    return
  }

  /* --- simulated: no provider connected, so the gift is recorded as paid
         and marked simulated, which every view of it shows: a test receipt
         (SIM- number, "not a tax receipt"), the "simulated" chip in the
         portals and on the thank-you page, and in production (staging) no
         effect on any total (finding C2) --- */
  if (!payLive) {
    const gift = await recordGift({ ...base, method: b.provider === 'paypal' ? 'paypal' : 'card', status: 'succeeded', simulated: true }, req)
    await Gift.updateOne({ _id: gift._id }, { $set: { checkout } })
    if (frequency) {
      await startPlan(
        {
          donor,
          amount,
          operatingCosts: fee,
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
    res.json({ kind: 'redirect', url: thankYou(gift, '&simulated=1') })
    return
  }

  /* --- a real provider: a pending gift, and the provider's hosted page. The
         webhook (Stripe) or the return route (PayPal) marks it paid. --- */
  const gift = await recordGift({ ...base, method: b.provider === 'paypal' ? 'paypal' : 'card', status: 'pending' }, req)
  await Gift.updateOne({ _id: gift._id }, { $set: { checkout } })

  let to: string | null = null
  try {
    if (b.provider === 'paypal') {
      const order = await paypalOrder({ giftId: gift.id, amount: amount + fee, label })
      if (order?.id) await Gift.updateOne({ _id: gift._id }, { $set: { 'external.paypal': order.id } })
      to = order?.url ?? null
    } else {
      to = await checkoutSession({ giftId: gift.id, token: gift.publicToken!, amount: amount + fee, label, email: donor.email, recurring: Boolean(frequency) })
    }
  } catch (err) {
    console.error('[checkout]', b.provider, err)
  }
  if (!to) {
    await Gift.updateOne({ _id: gift._id, status: 'pending' }, { $set: { status: 'failed', failureReason: 'The payment page could not be opened.' } })
    throw new HttpError(502, `We could not open ${b.provider === 'paypal' ? 'PayPal' : 'the card payment page'}. Nothing has been charged — please try again in a moment.`)
  }
  res.json({ kind: 'redirect', url: to })
})

/* PayPal returns the donor here with the order approved but NOT yet paid;
   capturing it is what takes the money.

   Loaded twice (a double click, the back button, a slow network retrying),
   the second capture is refused by PayPal as already captured. That must not
   turn a paid gift into a failed one (finding M6), so anything short of a
   clear answer asks PayPal what the order actually holds, only a definite
   decline fails the gift, and a capture PayPal is holding for review leaves
   it pending. A capture is believed only when it is COMPLETED, in AUD, for
   exactly what the gift asked. The rules are lib/paypal.ts, shared with the
   sweep that re-checks held captures. */
r.get('/paypal/return', async (req, res) => {
  const giftId = String(req.query.gift ?? '')
  const token = String(req.query.token ?? '')
  if (!isId(giftId)) return res.redirect('/give?cancelled=1')
  const gift = await Gift.findById(giftId).select('+publicToken')
  if (!gift) return res.redirect('/give?cancelled=1')
  const back = thankYou(gift)
  /* a failed gift may still be paid (the sweep gave up on it too soon);
     PayPal's own answer decides */
  if (!['pending', 'failed'].includes(gift.status) || gift.method !== 'paypal' || !token || gift.external?.paypal !== token) return res.redirect(back)
  await settlePaypalOrder(gift.id, token, { capture: true, req })
  res.redirect(back)
})

/* What the thank-you page shows. Deliberately small: a first name, the sum,
   where it went, and the receipt or transfer reference. It answers only to
   the gift's id together with its random token (finding L5) — the id alone
   is guessable from a neighbouring one — and only for website gifts from the
   last 30 days. An anonymous gift shows no name, and a failure is described
   in our words, never the provider's raw error. */
const FAILURE_WORDS: Record<string, string> = {
  'Checkout abandoned': 'This payment was not completed, so nothing was charged.',
}
const failureForDonor = (reason?: string | null) =>
  (reason && FAILURE_WORDS[reason]) || 'The payment did not go through, so nothing was charged. You can try again, or choose another way to pay.'

r.get('/gifts/:id/status', statusLimit, async (req: Request<{ id: string }>, res) => {
  const t = String(req.query.t ?? '')
  if (!isId(req.params.id) || !t) throw notFound('That donation')
  const g = await Gift.findById(req.params.id).select('+publicToken').lean()
  if (!g || g.source !== 'online' || !g.publicToken || !sameToken(g.publicToken, t)) throw notFound('That donation')
  if (Date.now() - new Date(g.createdAt).getTime() > 30 * 86_400_000) throw notFound('That donation')
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
    firstName: g.anonymous ? null : (donor?.firstName ?? null),
    frequency: plan?.frequency ?? (g.checkout?.frequency && g.checkout.frequency !== 'once' ? g.checkout.frequency : 'once'),
    instalments: plan?.instalments?.total ?? g.checkout?.instalments ?? null,
    nextChargeAt: plan?.nextChargeAt?.toISOString() ?? null,
    bank: bankPending ? { accountName: s.bank.accountName, bsb: s.bank.bsb, accountNumber: s.bank.accountNumber } : null,
    failureReason: g.status === 'failed' ? failureForDonor(g.failureReason) : null,
    simulated: Boolean(g.simulated),
    /* PayPal took the payment but is holding it for review: still pending,
       and the page says so rather than "we have not heard back" */
    held: g.status === 'pending' && g.paypalCapture?.status === 'PENDING',
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

/* ---------- the monthly letter ----------
   The footer's sign-up. It only ever sends a confirmation link (finding M10:
   double opt-in), and it answers { ok: true } whatever the address — new,
   already subscribed, or unsubscribed — so the form cannot be used to find
   out who gives to us. The confirming page (/letter/confirm) posts the token
   back here, and only then is the supporter added or switched on. */

const zLetter = z.object({ email: zEmail, company: z.string().optional() })

/** "amina.rahman@…" → "Amina". Only ever a placeholder until they give a
 *  gift or edit their profile; "Friend" when the address has no name in it. */
function nameFromEmail(email: string) {
  const word = email.split('@')[0].split(/[._\-+\d]+/).find((w) => /^[a-z]{2,}$/i.test(w))
  return word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : 'Friend'
}

r.post('/letter', formLimit, letterRecipientLimit, async (req, res) => {
  const b = parse(zLetter, req.body)
  if (b.company?.trim()) return res.json({ ok: true })
  const donor = await donorByEmail(b.email)
  const already = donor?.preferences?.emailOptIn && donor.preferences?.topics?.includes('reports')
  if (!already) await sendOptIn(b.email, 'letter', ['reports'], donor)
  res.json({ ok: true })
})

r.post('/letter/confirm', formLimit, async (req, res) => {
  const { t } = parse(z.object({ t: z.string().trim().min(16).max(200) }), req.body)
  const row = await OptIn.findOneAndDelete({ tokenHash: sha256(t), expiresAt: { $gt: new Date() } })
  if (!row) throw new HttpError(400, 'That link has expired or has already been used. You can sign up again from the bottom of any page.')

  const { donor, created } = await findOrCreateDonor({ email: row.email, firstName: nameFromEmail(row.email), source: 'web' })
  donor.set('preferences.emailOptIn', true)
  if (row.topics.length) donor.set('preferences.topics', [...new Set([...(donor.preferences?.topics ?? []), ...row.topics])])
  if (row.source === 'letter' && !donor.tags.includes('newsletter')) donor.tags.push('newsletter')
  await donor.save()
  await audit(
    req,
    'donor.subscribe',
    created
      ? `Added ${fullName(donor)} (${donor.number}) from the website's ${row.source === 'letter' ? 'letter sign-up' : 'donation form'}, confirmed by email`
      : `${fullName(donor)} (${donor.number}) confirmed by email that they want ${row.source === 'letter' ? 'the monthly letter' : 'updates'}`,
    { type: 'donor', id: donor._id, label: donor.number },
  )
  res.json({ ok: true })
})

export default r
