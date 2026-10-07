import type { Request } from 'express'
import { randomBytes, randomInt } from 'node:crypto'
import type { Types } from 'mongoose'
import { BANK_REF_PREFIX, FREQUENCIES, fyOf, type Designation, type Frequency, type Method } from '../../shared/domain'
import { formatMoney } from '../../shared/money'
import { markTestReceipt, refundEmail } from '../emails/giving'
import { receiptEmail } from '../emails/templates'
import {
  Appeal, Donor, Fundraiser, Gift, Plan, getSettings, nextDonorNumber, nextGiftNumber, nextSeq,
  type DonorDoc, type GiftDoc,
} from '../models'
import { audit } from './audit'
import { sendEmail } from './email'
import { notFound } from './http'
import { refreshForGift } from './stats'

/* ---------------------------------------------------------------------------
   The one road a gift takes into the database.

   A card gift from the website, a monthly payment taken by the scheduler, a
   bank line confirmed in the import, and a cash gift typed in at an event all
   come through recordGift(). That is what makes "one donor record, one
   receipt trail" true: there is no second way in that could skip the receipt,
   the appeal total or the action log.

   RECEIPT NUMBERS ARE ISSUED ONCE. issueReceipt() takes the next number from
   the financial year's counter and writes it with a conditional update that
   only succeeds while the gift has none, so two callers racing on the same
   gift (a double-clicked "Received", a webhook redelivered while the bank
   import confirms) end with one number between them. A unique index on
   receipt.number backs that up (models/Gift.ts).

   SIMULATED GIFTS (no payment provider connected) get their receipt from a
   separate SIM- series, and the email and every view of it say it is a test
   and not a tax receipt, so a staging deploy can never put a real DGR number
   on money that never moved (finding C2).
--------------------------------------------------------------------------- */

export const fullName = (d: { firstName: string; lastName?: string | null }) => `${d.firstName} ${d.lastName ?? ''}`.trim()

/** Find a donor by any email they have used, following merges, or make one.
 *  A donor made here starts with marketing email OFF: an address typed into a
 *  public form, or entered by staff, is not consent to campaigns. It is
 *  switched on only by a confirmed opt-in (the link in optInConfirmEmail) or by
 *  the donor in their own account (finding M10). */
export async function findOrCreateDonor(input: {
  email: string
  firstName: string
  lastName?: string
  phone?: string
  source?: 'web' | 'import' | 'offline' | 'bank' | 'fundraiser'
}): Promise<{ donor: DonorDoc; created: boolean }> {
  const email = input.email.trim().toLowerCase()
  const find = async () => {
    let d = await Donor.findOne({ $or: [{ email }, { altEmails: email }] })
    while (d?.status === 'merged' && d.mergedInto) d = await Donor.findById(d.mergedInto)
    return d
  }
  const found = await find()
  if (found) return { donor: found, created: false }
  try {
    const donor = await Donor.create({
      number: await nextDonorNumber(),
      firstName: input.firstName.trim() || 'Friend',
      lastName: (input.lastName ?? '').trim(),
      email,
      phone: input.phone,
      source: input.source ?? 'web',
      preferences: { emailOptIn: false },
    })
    return { donor, created: true }
  } catch (err) {
    /* Two first-time gifts from the same address at the same moment both
       miss the lookup above; the unique index on an active donor's email
       (models/Donor.ts) lets only one create through, and the other takes the
       record it made (finding M16). */
    if ((err as { code?: number }).code !== 11000) throw err
    const donor = await find()
    if (!donor) throw err
    return { donor, created: false }
  }
}

/** AA-7K3F9Q. No 0/O or 1/I, so it survives being read out over the phone and
 *  typed into a banking app. Checked for uniqueness against pending pledges. */
export async function newBankReference(): Promise<string> {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (;;) {
    let s = ''
    for (let i = 0; i < 6; i++) s += alphabet[randomInt(alphabet.length)]
    const ref = `${BANK_REF_PREFIX}-${s}`
    if (!(await Gift.exists({ reference: ref }))) return ref
  }
}

/** The next date a regular gift falls due. Monthly keeps the day of the
 *  month, clamped to the month's length (31 Jan → 28 Feb → 31 Mar). */
export function advance(from: Date, frequency: Frequency, anchorDay?: number): Date {
  const d = new Date(from)
  if (frequency !== 'monthly') {
    d.setDate(d.getDate() + FREQUENCIES[frequency].days)
    return d
  }
  const day = anchorDay ?? d.getDate()
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const last = new Date(y, m + 1, 0).getDate()
  return new Date(y, m, Math.min(day, last), d.getHours(), d.getMinutes())
}

export type RecordGiftInput = {
  donor: DonorDoc
  amount: number
  fee?: number
  designation: Designation
  method: Method
  status?: 'succeeded' | 'pending' | 'failed'
  date?: Date
  appealId?: string | Types.ObjectId | null
  fundraiserId?: string | Types.ObjectId | null
  planId?: Types.ObjectId | null
  reference?: string
  anonymous?: boolean
  message?: string
  notes?: string
  source: 'online' | 'offline' | 'bank' | 'recurring'
  external?: { stripe?: string; paypal?: string }
  failureReason?: string
  bankImport?: Types.ObjectId
  /** the statement line this gift is saved from (unique: a line is one gift) */
  bankLine?: Types.ObjectId
  /** email the receipt now. Default: yes, for a succeeded gift */
  sendReceipt?: boolean
  /** taken with no payment provider connected: no money moved (finding C2) */
  simulated?: boolean
}

export async function recordGift(input: RecordGiftInput, req?: Request | null): Promise<GiftDoc> {
  const appeal = input.appealId ? await Appeal.findById(input.appealId) : null
  if (input.appealId && !appeal) throw notFound('That appeal')
  const fundraiser = input.fundraiserId ? await Fundraiser.findById(input.fundraiserId) : null

  const gift = await Gift.create({
    number: await nextGiftNumber(),
    donor: input.donor._id,
    donorName: fullName(input.donor),
    appeal: appeal?._id ?? fundraiser?.appeal,
    appealTitle: appeal?.title ?? fundraiser?.appealTitle,
    country: appeal?.country,
    fundraiser: fundraiser?._id,
    fundraiserTitle: fundraiser?.title,
    plan: input.planId ?? undefined,
    amount: input.amount,
    fee: input.fee ?? 0,
    designation: input.designation,
    method: input.method,
    status: input.status ?? 'succeeded',
    date: input.date ?? new Date(),
    reference: input.reference,
    anonymous: input.anonymous ?? input.donor.preferences?.anonymous ?? false,
    message: input.message,
    notes: input.notes,
    source: input.source,
    enteredBy: req?.staff?._id,
    enteredByName: req?.staff?.name,
    external: input.external,
    failureReason: input.failureReason,
    bankImport: input.bankImport,
    bankLine: input.bankLine,
    simulated: input.simulated ?? false,
    /* a website gift is shown on the thank-you page by this, never by its
       database id alone (finding L5) */
    publicToken: input.source === 'online' ? randomBytes(18).toString('base64url') : undefined,
  })
  /* a fundraiser gift with no appeal of its own still lands in its appeal's country */
  if (!gift.country && gift.appeal) {
    const a = await Appeal.findById(gift.appeal).select('country')
    if (a) {
      gift.country = a.country
      await gift.save()
    }
  }

  if (gift.status === 'succeeded') {
    await issueReceipt(gift, { email: input.sendReceipt !== false, suppress: input.sendReceipt === false })
  }
  await refreshForGift(gift)

  const verb = gift.status === 'pending' ? 'Pledged' : gift.status === 'failed' ? 'Failed' : 'Recorded'
  await audit(
    req ?? null,
    `gift.${gift.source === 'offline' ? 'offline' : gift.source}`,
    `${verb} ${formatMoney(gift.amount)} ${gift.method} donation ${gift.number} from ${gift.donorName}${gift.appealTitle ? ` to ${gift.appealTitle}` : ''}`,
    { type: 'gift', id: gift._id, label: gift.number },
  )
  return gift
}

/** Give a succeeded gift its receipt number (once — a number is never
 *  reissued) and, unless told not to, email it. `suppress` records that a
 *  person chose not to email it (a switch left off), so the receipt sweep
 *  (lib/sweeps.ts) never sends it behind their back. */
export async function issueReceipt(gift: GiftDoc, opts: { email: boolean; resend?: boolean; suppress?: boolean } = { email: true }) {
  const s = await getSettings()
  if (!gift.receipt?.number) {
    const fy = fyOf(gift.date)
    const simulated = Boolean(gift.simulated)
    const seq = await nextSeq(simulated ? `receipt-sim-${fy}` : `receipt-${fy}`)
    const n = String(seq).padStart(6, '0')
    const number = simulated ? `SIM-${fy}-${n}` : `${s.receipts.prefix}-${fy}-${n}`
    /* only while the gift still has no number: whoever loses a race reads
       the winner's number back rather than writing a second one (that seq is
       left unused, which is a gap, never a duplicate). Field by field, so
       whatever else the receipt already carries (the sweep's sweptAt) stays. */
    const won = await Gift.updateOne(
      { _id: gift._id, 'receipt.number': null },
      { $set: { 'receipt.number': number, 'receipt.issuedAt': new Date(), 'receipt.resent': 0 } },
    )
    gift.set('receipt', (await Gift.findById(gift._id).select('receipt').lean())?.receipt)
    if (won.modifiedCount !== 1 && !gift.receipt?.number) throw new Error(`receipt for ${gift.number} could not be issued`)
    gift.unmarkModified('receipt')
  }
  if (opts.suppress) {
    await Gift.updateOne({ _id: gift._id }, { $set: { 'receipt.suppressed': true } })
    gift.set('receipt.suppressed', true)
    gift.unmarkModified('receipt')
  }
  if (!opts.email) return
  const donor = await Donor.findById(gift.donor)
  if (!donor) return
  const email = receiptEmail(
    {
      number: gift.number,
      amount: gift.amount,
      fee: gift.fee ?? 0,
      designation: gift.designation as Designation,
      method: gift.method as Method,
      date: gift.date,
      appealTitle: gift.appealTitle,
      fundraiserTitle: gift.fundraiserTitle,
      donorName: gift.donorName,
      receipt: gift.receipt,
    },
    donor.firstName,
    s,
    { resend: opts.resend },
  )
  const r = await sendEmail(donor.email, gift.simulated ? markTestReceipt(email) : email, { donor: donor._id })
  if (r.ok) {
    const at = new Date()
    await Gift.updateOne({ _id: gift._id }, { $set: { 'receipt.emailedAt': at }, ...(opts.resend ? { $inc: { 'receipt.resent': 1 } } : {}) })
    gift.set('receipt.emailedAt', at)
    if (opts.resend) gift.set('receipt.resent', (gift.receipt?.resent ?? 0) + 1)
    gift.unmarkModified('receipt')
  }
}

/** Mark a paid gift refunded, once, and put right everything that counted it:
 *  the totals, the regular donation it was a payment on (its collected sum,
 *  and an instalment plan's count of payments made), and the donor, who is
 *  told. The admin's Refund button and Stripe's charge.refunded both come
 *  here, so a refund recorded twice — a double click, or the office pressing
 *  Refund after doing it in Stripe — changes nothing the second time
 *  (findings M9, L10). Returns null when the gift was not a paid one. */
export async function refundGift(
  giftId: string | Types.ObjectId,
  how: { reason: string; by: string; notify?: boolean },
  req?: Request | null,
): Promise<GiftDoc | null> {
  const line = `Refunded ${new Date().toLocaleDateString('en-AU')} by ${how.by}: ${how.reason}`
  const gift = await Gift.findOneAndUpdate(
    { _id: giftId, status: 'succeeded' },
    [{ $set: { status: 'refunded', notes: { $trim: { input: { $concat: [{ $ifNull: ['$notes', ''] }, String.fromCharCode(10), line] } } } } }],
    { returnDocument: 'after', updatePipeline: true },
  )
  if (!gift) return null
  await refreshForGift(gift)
  let planNumber: string | null = null
  if (gift.plan) {
    const plan = await Plan.findById(gift.plan).select('number kind instalments')
    if (plan) {
      planNumber = plan.number
      const paid = plan.kind === 'instalment' && (plan.instalments?.paid ?? 0) > 0
      await Plan.updateOne({ _id: plan._id }, { $inc: { collected: -gift.amount, ...(paid ? { 'instalments.paid': -1 } : {}) } })
    }
  }
  await audit(
    req ?? null,
    'gift.refund',
    `Refunded ${formatMoney(gift.amount)} donation ${gift.number} from ${gift.donorName}: ${how.reason}${planNumber ? ` (a payment on ${planNumber})` : ''}`,
    { type: 'gift', id: gift._id, label: gift.number },
  )
  if (how.notify !== false) {
    const donor = await Donor.findById(gift.donor).select('email firstName')
    if (donor && !donor.email.endsWith('.invalid')) {
      await sendEmail(
        donor.email,
        refundEmail(donor.firstName, { number: gift.number, amount: gift.amount, fee: gift.fee, receiptNumber: gift.receipt?.number, planNumber }),
        { donor: donor._id },
      )
    }
  }
  return gift
}
