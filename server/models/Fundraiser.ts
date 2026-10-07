import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { FUNDRAISER_OCCASIONS, FUNDRAISER_STATUSES } from '../../shared/domain'

const FundraiserSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    owner: { type: Schema.Types.ObjectId, ref: 'Donor', required: true, index: true },
    ownerName: { type: String, required: true },
    appeal: { type: Schema.Types.ObjectId, ref: 'Appeal', required: true },
    appealTitle: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    story: { type: String, default: '' },
    occasion: { type: String, enum: Object.keys(FUNDRAISER_OCCASIONS), default: 'other' },
    target: { type: Number, required: true },
    raised: { type: Number, default: 0 },
    donorCount: { type: Number, default: 0 },
    image: String,
    endsAt: Date,
    status: { type: String, enum: Object.keys(FUNDRAISER_STATUSES), default: 'pending', index: true },
    review: { by: String, at: Date, note: String },
    /* For a page started from the public form while signed out: the SHA-256
       of the token in the confirmation link (the token itself is only ever in
       the email), and when the link stops working. Kept after use, so a second
       click can be told "already confirmed". Never sent to any client. */
    verify: {
      tokenHash: { type: String, select: false },
      expiresAt: Date,
      confirmedAt: Date,
      /* the start created the organiser's donor record (an address we had
         never seen): if the page is never confirmed, the record goes with it,
         unless the person has done anything else with us since */
      createdDonor: Boolean,
    },
  },
  { timestamps: true },
)
FundraiserSchema.index({ 'verify.tokenHash': 1 }, { unique: true, partialFilterExpression: { 'verify.tokenHash': { $type: 'string' } } })

export type FundraiserDoc = HydratedDocument<InferSchemaType<typeof FundraiserSchema>>
export const Fundraiser = mongoose.model('Fundraiser', FundraiserSchema)
