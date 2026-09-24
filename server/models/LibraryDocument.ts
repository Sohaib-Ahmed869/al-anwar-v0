import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { DOCUMENT_CATEGORIES } from '../../shared/domain'

const VersionSchema = new Schema(
  {
    n: { type: Number, required: true },
    fileKey: { type: String, required: true },
    fileName: { type: String, required: true },
    size: Number,
    mime: String,
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
    uploadedByName: String,
    uploadedAt: { type: Date, default: () => new Date() },
    note: String,
  },
  { _id: false },
)

const LibraryDocumentSchema = new Schema(
  {
    title: { type: String, required: true },
    category: { type: String, enum: Object.keys(DOCUMENT_CATEGORIES), default: 'other', index: true },
    description: String,
    versions: { type: [VersionSchema], default: [] },
    requiresAck: { type: Boolean, default: false },
    acks: {
      type: [{ staff: { type: Schema.Types.ObjectId, ref: 'Staff' }, name: String, version: Number, at: Date, _id: false }],
      default: [],
    },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
)

export type LibraryDocumentDoc = HydratedDocument<InferSchemaType<typeof LibraryDocumentSchema>>
export const LibraryDocument = mongoose.model('LibraryDocument', LibraryDocumentSchema)
