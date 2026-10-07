import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { DESIGNATION_KEYS, GIFT_STATUSES, METHOD_KEYS } from '../../shared/domain'

const GiftSchema = new Schema(
  {
    number: { type: String, required: true, unique: true },
    donor: { type: Schema.Types.ObjectId, ref: 'Donor', required: true, index: true },
    donorName: { type: String, required: true },
    appeal: { type: Schema.Types.ObjectId, ref: 'Appeal', index: true },
    appealTitle: String,
    country: String,
    fundraiser: { type: Schema.Types.ObjectId, ref: 'Fundraiser', index: true },
    fundraiserTitle: String,
    plan: { type: Schema.Types.ObjectId, ref: 'Plan', index: true },
    /** cents */
    amount: { type: Number, required: true, min: 1 },
    fee: { type: Number, default: 0 },
    designation: { type: String, enum: DESIGNATION_KEYS, default: 'general' },
    method: { type: String, enum: METHOD_KEYS, required: true },
    status: { type: String, enum: Object.keys(GIFT_STATUSES), default: 'succeeded' },
    date: { type: Date, required: true, default: () => new Date() },
    reference: { type: String, index: true },
    receipt: {
      number: String,
      issuedAt: Date,
      emailedAt: Date,
      resent: { type: Number, default: 0 },
      /** when lib/sweeps.ts last tried to finish this receipt, so a gift
       *  whose email keeps failing is tried once, not every run */
      sweptAt: Date,
      /** staff chose not to email this receipt (the switch was off): the
       *  number stands, and the sweep must not send it behind their back */
      suppressed: Boolean,
    },
    anonymous: { type: Boolean, default: false },
    message: String,
    source: { type: String, enum: ['online', 'offline', 'bank', 'recurring'], default: 'online' },
    enteredBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
    enteredByName: String,
    notes: String,
    failureReason: String,
    external: { stripe: String, paypal: String },
    bankImport: { type: Schema.Types.ObjectId, ref: 'BankImport' },
    /** what the donor asked for at checkout, kept so the Stripe webhook can
     *  start the regular gift once the first payment lands. planClaimedAt is
     *  set atomically by whichever webhook delivery starts the plan, so a
     *  redelivery can finish a start that failed half-way without starting a
     *  second one (finding H6). */
    checkout: { frequency: String, instalments: Number, coverFee: Boolean, operatingCosts: Number, planClaimedAt: Date },
    /** taken with no payment provider connected: no money moved. Its receipt
     *  is a test receipt (SIM- numbers, worded as not valid for tax), and in
     *  production (a staging deploy) it stays out of every total (finding C2). */
    simulated: { type: Boolean, default: false },
    /** the random key the thank-you page shows the gift by, so the public
     *  status route cannot be walked with guessed ids (finding L5) */
    publicToken: { type: String, select: false },
    /** Stripe opened a dispute (chargeback) on the payment; outcome once
     *  decided — 'lost' takes the donation out of every total (webhooks.ts) */
    dispute: { at: Date, reason: String, id: String, outcome: String, closedAt: Date },
    /** a PayPal capture that PayPal reported as PENDING (held for review or a
     *  currency conversion): the gift waits for it rather than failing, and
     *  the abandoned-checkout sweep leaves it alone */
    paypalCapture: { id: String, status: String, at: Date },
    /** the bank-statement line this gift was saved from: unique, so saving
     *  a statement again after an error can never record the line twice */
    bankLine: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
)

GiftSchema.index({ status: 1, date: -1 })
/* A receipt number and a provider's payment id each belong to exactly one
   gift. Partial rather than sparse, so gifts without one are not indexed at
   all, and unique, so a race that slipped past the conditional updates in
   lib/giving.ts and lib/plans.ts fails loudly instead of issuing a duplicate
   receipt or recording one charge twice (findings M7, M9, M16). */
GiftSchema.index({ 'receipt.number': 1 }, { unique: true, partialFilterExpression: { 'receipt.number': { $type: 'string' } } })
GiftSchema.index({ 'external.stripe': 1 }, { unique: true, partialFilterExpression: { 'external.stripe': { $type: 'string' } } })
GiftSchema.index({ bankLine: 1 }, { unique: true, partialFilterExpression: { bankLine: { $type: 'objectId' } } })
/* the sweeps (lib/sweeps.ts) look for online gifts by status and age */
GiftSchema.index({ status: 1, source: 1, createdAt: 1 })

export type GiftDoc = HydratedDocument<InferSchemaType<typeof GiftSchema>>
export const Gift = mongoose.model('Gift', GiftSchema)
