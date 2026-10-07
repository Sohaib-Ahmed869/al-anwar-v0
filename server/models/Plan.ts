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
    /** legacy: the donor covered a percentage card fee (before 28 September
     *  2026). Read only for plans that have no operatingCosts. */
    coverFee: { type: Boolean, default: false },
    /** cents added to every payment towards operating costs: 0, 200, 500 or
     *  1000 (shared/operating-costs.ts). Absent on plans started before it. */
    operatingCosts: Number,
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
    /** set while one caller is taking a payment on this plan. chargePlan()
     *  claims it atomically before it charges, so the scheduler, an admin
     *  retry and a card update can never charge the same plan at once; a
     *  claim older than ten minutes is treated as abandoned (finding M7). */
    chargingAt: Date,
    /** a payment asked for but not yet answered: Stripe could not be reached,
     *  or the payment is still processing. The next run sends the same key so
     *  a payment that did go through is found, not taken again (lib/plans.ts) */
    pendingCharge: { key: String, since: Date, lastError: String },
    /** the gifts already added to `collected` (and to an instalment plan's
     *  count), so a payment settled twice is counted once; the last fifty */
    countedGifts: [{ type: Schema.Types.ObjectId, ref: 'Gift' }],
    /** the website gift that started this plan, when it began at checkout:
     *  unique, so a redelivered webhook can never start a second plan from
     *  the same first payment (finding H6) */
    firstGift: { type: Schema.Types.ObjectId, ref: 'Gift' },
  },
  { timestamps: true },
)

PlanSchema.index({ firstGift: 1 }, { unique: true, partialFilterExpression: { firstGift: { $type: 'objectId' } } })

export type PlanDoc = HydratedDocument<InferSchemaType<typeof PlanSchema>>
export const Plan = mongoose.model('Plan', PlanSchema)
