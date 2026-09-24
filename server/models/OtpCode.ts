import mongoose, { Schema } from 'mongoose'

/* A donor's one-time sign-in code. Stored hashed, expires on its own (TTL
   index), and allows five guesses before it is burnt. */
const OtpCodeSchema = new Schema({
  email: { type: String, required: true, index: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
})
OtpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const OtpCode = mongoose.model('OtpCode', OtpCodeSchema)
