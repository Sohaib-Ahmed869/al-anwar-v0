import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { OBLIGATION_CATEGORIES, RECURRENCES } from '../../shared/domain'

const ObligationSchema = new Schema(
  {
    title: { type: String, required: true },
    category: { type: String, enum: Object.keys(OBLIGATION_CATEGORIES), default: 'other' },
    description: String,
    dueDate: { type: Date, required: true, index: true },
    recurrence: { type: String, enum: Object.keys(RECURRENCES), default: 'none' },
    owner: { type: Schema.Types.ObjectId, ref: 'Staff' },
    ownerName: String,
    reminderDays: { type: [Number], default: [30, 7, 1] },
    remindersSent: { type: [Number], default: [] },
    status: { type: String, enum: ['upcoming', 'done'], default: 'upcoming', index: true },
    completedAt: Date,
    completedByName: String,
    /** what the person wrote when they marked it done */
    completionNote: String,
    evidence: {
      type: [{ document: { type: Schema.Types.ObjectId, ref: 'LibraryDocument' }, title: String, _id: false }],
      default: [],
    },
    notes: String,
  },
  { timestamps: true },
)

export type ObligationDoc = HydratedDocument<InferSchemaType<typeof ObligationSchema>>
export const Obligation = mongoose.model('Obligation', ObligationSchema)
