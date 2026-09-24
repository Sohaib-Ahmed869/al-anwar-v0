import mongoose, { Schema } from 'mongoose'

/* The action log. Append-only: nothing in the codebase updates or deletes a
   row, and there is no route that could. Written by lib/audit.ts. */
const AuditEventSchema = new Schema({
  at: { type: Date, default: () => new Date(), index: true },
  actor: {
    kind: { type: String, enum: ['staff', 'donor', 'system'], required: true },
    id: Schema.Types.ObjectId,
    name: { type: String, required: true },
  },
  action: { type: String, required: true, index: true },
  entity: { type: { type: String }, id: Schema.Types.ObjectId, label: String },
  summary: { type: String, required: true },
  meta: Schema.Types.Mixed,
  ip: String,
})
AuditEventSchema.index({ 'entity.type': 1, 'entity.id': 1, at: -1 })
AuditEventSchema.index({ 'actor.id': 1, at: -1 })

export const AuditEvent = mongoose.model('AuditEvent', AuditEventSchema)
