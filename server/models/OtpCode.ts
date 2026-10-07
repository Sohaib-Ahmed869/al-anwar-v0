import mongoose, { Schema } from 'mongoose'

/* A donor's one-time sign-in code (or email-change code). Stored as an HMAC,
   expires on its own (TTL index), and allows five guesses before it is
   burnt. Guesses are counted with an atomic $inc in lib/otp.ts, so parallel
   requests can't all slip under the limit; lib/otp.ts also caps codes sent
   and wrong guesses per address, across codes. */
const OtpCodeSchema = new Schema({
  email: { type: String, required: true, index: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
})
OtpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const OtpCode = mongoose.model('OtpCode', OtpCodeSchema)
