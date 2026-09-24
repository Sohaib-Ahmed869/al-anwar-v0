import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { APPEAL_STATUSES } from '../../shared/domain'

const AppealSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: '' },
    story: { type: String, default: '' },
    country: { type: String, required: true },
    where: String,
    causes: { type: [String], default: [] },
    zakatEligible: { type: Boolean, default: false },
    /** cents */
    target: { type: Number, default: 0 },
    /* denormalised by lib/stats.ts refreshAppeal() */
    raised: { type: Number, default: 0 },
    donorCount: { type: Number, default: 0 },
    status: { type: String, enum: Object.keys(APPEAL_STATUSES), default: 'draft', index: true },
    opensAt: Date,
    closesAt: Date,
    image: String,
    suggested: { type: [{ amount: Number, label: String, _id: false }], default: [] },
    unit: { name: String, plural: String, price: Number },
    updates: { type: [{ date: Date, title: String, body: String }], default: [] },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true },
)

export type AppealDoc = HydratedDocument<InferSchemaType<typeof AppealSchema>>
export const Appeal = mongoose.model('Appeal', AppealSchema)
