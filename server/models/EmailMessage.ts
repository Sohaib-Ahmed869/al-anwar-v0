import mongoose, { Schema } from 'mongoose'

/* Every email the platform sends, whether it went over SMTP or — in
   development, with no SMTP configured — was kept here instead. The admin
   portal's Email log reads this, and a donor record shows their slice of it.

   What is stored is never a secret: an email carrying a sign-in code or a
   reset link is stored as its redacted copy (emails/templates.ts). And the
   content is kept 90 days; after that the retention job (jobs/retention.ts)
   replaces the body and sets contentRemovedAt, keeping the rest. */
const EmailMessageSchema = new Schema(
  {
    to: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    template: { type: String, required: true },
    html: { type: String, required: true },
    text: String,
    status: { type: String, enum: ['queued', 'sent', 'failed'], default: 'queued' },
    transport: { type: String, enum: ['smtp', 'outbox'], required: true },
    donor: { type: Schema.Types.ObjectId, ref: 'Donor', index: true },
    campaign: { type: Schema.Types.ObjectId, ref: 'Campaign', index: true },
    error: String,
    sentAt: Date,
    contentRemovedAt: Date,
  },
  { timestamps: true },
)

EmailMessageSchema.index({ createdAt: 1 })

export const EmailMessage = mongoose.model('EmailMessage', EmailMessageSchema)
