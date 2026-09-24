import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { ROLE_KEYS } from '../../shared/access'

const StaffSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ROLE_KEYS, required: true },
    active: { type: Boolean, default: true },
    passwordHash: { type: String, select: false },
    passwordSet: { type: Boolean, default: false },
    /** one-time token for an invite or a password reset, hashed */
    tokenHash: { type: String, select: false },
    tokenExpires: { type: Date, select: false },
    invitedAt: Date,
    lastLoginAt: Date,
    /** bumped to sign a person out everywhere (role change, deactivation) */
    sessionVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
)

export type StaffDoc = HydratedDocument<InferSchemaType<typeof StaffSchema>>
export const Staff = mongoose.model('Staff', StaffSchema)
