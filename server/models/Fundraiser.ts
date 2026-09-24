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
  },
  { timestamps: true },
)

export type FundraiserDoc = HydratedDocument<InferSchemaType<typeof FundraiserSchema>>
export const Fundraiser = mongoose.model('Fundraiser', FundraiserSchema)
