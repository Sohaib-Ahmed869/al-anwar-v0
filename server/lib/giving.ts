import type { Request } from 'express'
import { randomInt } from 'node:crypto'
import type { Types } from 'mongoose'
import { BANK_REF_PREFIX, FREQUENCIES, fyOf, type Designation, type Frequency, type Method } from '../../shared/domain'
import { formatMoney } from '../../shared/money'
import { receiptEmail } from '../emails/templates'
import {
  Appeal, Donor, Fundraiser, Gift, getSettings, nextDonorNumber, nextGiftNumber, nextSeq,
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
--------------------------------------------------------------------------- */

export const fullName = (d: { firstName: string; lastName?: string | null }) => `${d.firstName} ${d.lastName ?? ''}`.trim()

/** Find a donor by any email they have used, following merges, or make one. */
export async function findOrCreateDonor(input: {
  email: string
  firstName: string
  lastName?: string
  phone?: string
  source?: 'web' | 'import' | 'offline' | 'bank' | 'fundraiser'
}): Promise<{ donor: DonorDoc; created: boolean }> {
  const email = input.email.trim().toLowerCase()
  let donor = await Donor.findOne({ $or: [{ email }, { altEmails: email }] })
  while (donor?.status === 'merged' && donor.mergedInto) donor = await Donor.findById(donor.mergedInto)
  if (donor) return { donor, created: false }
  donor = await Donor.create({
    number: await nextDonorNumber(),
    firstName: input.firstName.trim() || 'Friend',
    lastName: (input.lastName ?? '').trim(),
    email,
    phone: input.phone,
    source: input.source ?? 'web',
  })
  return { donor, created: true }
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
  /** email the receipt now. Default: yes, for a succeeded gift */
  sendReceipt?: boolean
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
    await issueReceipt(gift, { email: input.sendReceipt !== false })
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
 *  reissued) and, unless told not to, email it. */
export async function issueReceipt(gift: GiftDoc, opts: { email: boolean; resend?: boolean } = { email: true }) {
  const s = await getSettings()
  if (!gift.receipt?.number) {
    const fy = fyOf(gift.date)
    const seq = await nextSeq(`receipt-${fy}`)
    gift.set('receipt', { number: `${s.receipts.prefix}-${fy}-${String(seq).padStart(6, '0')}`, issuedAt: new Date(), resent: 0 })
    await gift.save()
  }
  if (!opts.email) return
  const donor = await Donor.findById(gift.donor)
  if (!donor) return
  const r = await sendEmail(
    donor.email,
    receiptEmail(
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
    ),
    { donor: donor._id },
  )
  if (r.ok) {
    gift.set('receipt.emailedAt', new Date())
    if (opts.resend) gift.set('receipt.resent', (gift.receipt?.resent ?? 0) + 1)
    await gift.save()
  }
}
