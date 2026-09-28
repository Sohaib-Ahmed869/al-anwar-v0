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
     *  start the regular gift once the first payment lands */
    checkout: { frequency: String, instalments: Number, coverFee: Boolean, operatingCosts: Number },
  },
  { timestamps: true },
)

GiftSchema.index({ status: 1, date: -1 })
GiftSchema.index({ 'receipt.number': 1 }, { sparse: true })

export type GiftDoc = HydratedDocument<InferSchemaType<typeof GiftSchema>>
export const Gift = mongoose.model('Gift', GiftSchema)
