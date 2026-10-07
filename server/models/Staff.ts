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
    /** bumped to sign a person out everywhere (role change, deactivation,
     *  password change, signing out) */
    sessionVersion: { type: Number, default: 0 },
    /* wrong passwords within an hour; ten lock the login for fifteen minutes
       (routes/auth.ts). Counted with $inc so parallel guesses all count. */
    failedLogins: { type: Number, default: 0, select: false },
    /* when the current run of wrong passwords began: a run older than an hour
       starts again from one, so a few typos a week never add up to a lock */
    failedLoginsAt: { type: Date, select: false },
    lockedUntil: { type: Date, select: false },
    /* two-step sign-in (lib/mfa.ts). The TOTP secret is encrypted with a key
       derived from JWT_SECRET, so a copy of the database alone cannot mint
       codes; a secret being set up lives in totpPending until a first code
       proves the authenticator app has it. Recovery codes are hashed and
       each works once. totpLastStep refuses a code that was already used. */
    totpEnabled: { type: Boolean, default: false },
    totpSecret: { type: String, select: false },
    totpPending: { type: String, select: false },
    totpLastStep: { type: Number, select: false },
    recoveryCodes: { type: [String], default: undefined, select: false },
    totpEnabledAt: Date,
  },
  { timestamps: true },
)

export type StaffDoc = HydratedDocument<InferSchemaType<typeof StaffSchema>>
export const Staff = mongoose.model('Staff', StaffSchema)
