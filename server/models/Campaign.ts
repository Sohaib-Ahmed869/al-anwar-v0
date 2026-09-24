import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { CAMPAIGN_STATUSES } from '../../shared/domain'

const CampaignSchema = new Schema(
  {
    name: { type: String, required: true },
    subject: { type: String, default: '' },
    preheader: String,
    /** light markdown: paragraphs, **bold**, [links](url), and {{firstName}} */
    body: { type: String, default: '' },
    segment: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: Object.keys(CAMPAIGN_STATUSES), default: 'draft', index: true },
    scheduledAt: Date,
    /** donor ids still to send to, drained in batches by jobs/campaigns.ts */
    queue: { type: [Schema.Types.ObjectId], default: [], select: false },
    stats: {
      recipients: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    sentAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
    createdByName: String,
  },
  { timestamps: true, minimize: false },
)

export type CampaignDoc = HydratedDocument<InferSchemaType<typeof CampaignSchema>>
export const Campaign = mongoose.model('Campaign', CampaignSchema)
