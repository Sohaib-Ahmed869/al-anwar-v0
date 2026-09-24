import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { ENQUIRY_STATUSES, ENQUIRY_TYPES } from '../../shared/domain'

const EnquirySchema = new Schema(
  {
    type: { type: String, enum: Object.keys(ENQUIRY_TYPES), required: true, index: true },
    status: { type: String, enum: Object.keys(ENQUIRY_STATUSES), default: 'new', index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: String,
    subject: String,
    message: { type: String, default: '' },
    donor: { type: Schema.Types.ObjectId, ref: 'Donor', index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'Staff' },
    assignedName: String,
    meta: { type: Map, of: String, default: {} },
    notes: {
      type: [{ by: String, at: Date, body: String, kind: { type: String, enum: ['note', 'reply', 'status'] } }],
      default: [],
    },
  },
  { timestamps: true },
)

export type EnquiryDoc = HydratedDocument<InferSchemaType<typeof EnquirySchema>>
export const Enquiry = mongoose.model('Enquiry', EnquirySchema)
