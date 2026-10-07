import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose'

/* ---------------------------------------------------------------------------
   A request to join the mailing list, waiting for its owner to say yes.

   Signing someone up from a public form proves nothing about who typed the
   address, so nothing is switched on until the address itself confirms it:
   the letter sign-up in the footer, and the "send me updates" tick on the
   give form for a supporter we have never met, both create one of these and
   email a link (finding M10; the Spam Act wants consent we can show).
   The link carries a random token; only its SHA-256 is kept here, and Mongo
   deletes the row when it expires (a TTL index on expiresAt).
--------------------------------------------------------------------------- */

const OptInSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    /** what they asked to hear about, applied when they confirm */
    topics: { type: [String], default: [] },
    /** where it came from, for the action log */
    source: { type: String, enum: ['letter', 'checkout'], required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
)
OptInSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type OptInDoc = HydratedDocument<InferSchemaType<typeof OptInSchema>>
export const OptIn = mongoose.model('OptIn', OptInSchema)
