import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { EMAIL_TOPICS } from '../../shared/domain'

const AddressSchema = new Schema(
  { line1: String, line2: String, suburb: String, state: String, postcode: String, country: String },
  { _id: false },
)

const DonorSchema = new Schema(
  {
    number: { type: String, required: true, unique: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, default: '', trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    altEmails: { type: [String], default: [] },
    phone: String,
    address: AddressSchema,
    preferences: {
      emailOptIn: { type: Boolean, default: true },
      topics: { type: [String], enum: Object.keys(EMAIL_TOPICS), default: ['appeals', 'reports'] },
      anonymous: { type: Boolean, default: false },
    },
    tags: { type: [String], default: [] },
    source: { type: String, enum: ['web', 'import', 'offline', 'bank', 'fundraiser'], default: 'web' },
    notes: String,
    status: { type: String, enum: ['active', 'merged'], default: 'active' },
    mergedInto: { type: Schema.Types.ObjectId, ref: 'Donor' },
    bankAliases: { type: [String], default: [] },
    /** records staff have said are NOT the same person as this one, so the
     *  duplicate finder stops suggesting the pair */
    notDuplicateOf: { type: [Schema.Types.ObjectId], default: [] },
    /* denormalised, kept current by lib/stats.ts refreshDonor() */
    totalGiven: { type: Number, default: 0 },
    giftCount: { type: Number, default: 0 },
    firstGiftAt: Date,
    lastGiftAt: Date,
    hasActivePlan: { type: Boolean, default: false },
    /* for unsubscribe links, so an email address is never in a URL */
    unsubscribeToken: String,
    /* sign in with Google / Facebook */
    oauth: { google: String, facebook: String },
    lastLoginAt: Date,
    /* bumped to end every session this donor has (signing out, changing the
       sign-in email, or staff signing them out); lib/auth.ts compares it
       with the `v` in the cookie */
    sessionVersion: { type: Number, default: 0 },
    /* addresses this donor used to sign in with and moved away from. They
       stay in altEmails so gifts made with them still land here, but they no
       longer open the account: whoever holds the old mailbox now is not
       necessarily the donor. */
    retiredLogins: { type: [String], default: [] },
  },
  { timestamps: true },
)

DonorSchema.index({ email: 1 })
/* one live record per address. A merged record keeps its old email, so the
   rule covers active records only; two first-time checkouts racing each other
   now get one donor, and lib/giving.ts findOrCreateDonor retries on the
   duplicate-key error. The plain index above stays for lookups that don't
   filter on status. */
DonorSchema.index({ email: 1 }, { name: 'email_active_unique', unique: true, partialFilterExpression: { status: 'active' } })
DonorSchema.index({ altEmails: 1 })
DonorSchema.index({ status: 1, lastGiftAt: -1 })

export type DonorDoc = HydratedDocument<InferSchemaType<typeof DonorSchema>>
export const Donor = mongoose.model('Donor', DonorSchema)
