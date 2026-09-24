import mongoose, { Schema } from 'mongoose'

/* One row of any compliance register. Which fields it has is decided by the
   register's definition in shared/registers.ts, not here. */
const RegisterEntrySchema = new Schema(
  {
    register: { type: String, required: true, index: true },
    fields: { type: Schema.Types.Mixed, default: {} },
    archived: { type: Boolean, default: false },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
    updatedByName: String,
  },
  { timestamps: true, minimize: false },
)

export const RegisterEntry = mongoose.model('RegisterEntry', RegisterEntrySchema)
