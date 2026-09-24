import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { DESIGNATION_KEYS, FREQUENCY_KEYS, PLAN_STATUSES } from '../../shared/domain'

const PlanSchema = new Schema(
  {
    number: { type: String, required: true, unique: true },
    donor: { type: Schema.Types.ObjectId, ref: 'Donor', required: true, index: true },
    donorName: { type: String, required: true },
    appeal: { type: Schema.Types.ObjectId, ref: 'Appeal' },
    appealTitle: String,
    designation: { type: String, enum: DESIGNATION_KEYS, default: 'sadaqah' },
    /** cents, per payment */
    amount: { type: Number, required: true, min: 100 },
    coverFee: { type: Boolean, default: false },
    frequency: { type: String, enum: FREQUENCY_KEYS, required: true },
    kind: { type: String, enum: ['recurring', 'instalment'], default: 'recurring' },
    instalments: { total: Number, paid: Number },
    status: { type: String, enum: Object.keys(PLAN_STATUSES), default: 'active', index: true },
    startDate: { type: Date, required: true },
    nextChargeAt: { type: Date, index: true },
    lastChargeAt: Date,
    pausedUntil: Date,
    failure: {
      count: { type: Number, default: 0 },
      lastError: String,
      firstFailedAt: Date,
      nextRetryAt: Date,
    },
    payment: {
      method: { type: String, enum: ['card', 'paypal'], default: 'card' },
      brand: String,
      last4: String,
      expMonth: Number,
      expYear: Number,
      stripeCustomer: String,
      stripePaymentMethod: String,
    },
    /** the charge date the pre-payment email was last sent for */
    noticeSentFor: Date,
    cancelledAt: Date,
    cancelReason: String,
    collected: { type: Number, default: 0 },
  },
  { timestamps: true },
)

export type PlanDoc = HydratedDocument<InferSchemaType<typeof PlanSchema>>
export const Plan = mongoose.model('Plan', PlanSchema)
