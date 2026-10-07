import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { BANK_LINE_STATUSES, DESIGNATION_KEYS } from '../../shared/domain'

const BankLineSchema = new Schema({
  date: { type: Date, required: true },
  description: { type: String, required: true },
  reference: String,
  /** cents, credits only */
  amount: { type: Number, required: true },
  /** date + amount + description, to spot a line already imported */
  hash: { type: String, required: true },
  status: { type: String, enum: Object.keys(BANK_LINE_STATUSES), required: true },
  match: {
    donor: { type: Schema.Types.ObjectId, ref: 'Donor' },
    donorName: String,
    appeal: { type: Schema.Types.ObjectId, ref: 'Appeal' },
    appealTitle: String,
    designation: { type: String, enum: DESIGNATION_KEYS, default: 'general' },
    confidence: { type: Number, default: 0 },
    reasons: { type: [String], default: [] },
    pledge: { type: Schema.Types.ObjectId, ref: 'Gift' },
    /** how the donor was found (lib/matching.ts): only a reference, a pledge or
     *  a person's own choice is strong enough to teach the matcher an alias */
    via: { type: String, enum: ['pledge', 'usedRef', 'alias', 'name', 'fuzzy', 'manual'] },
    /** when a name fits more than one donor: who it could be, for the office to pick */
    candidates: { type: [{ donor: { type: Schema.Types.ObjectId, ref: 'Donor' }, donorName: String, number: String, _id: false }], default: undefined },
  },
  gift: { type: Schema.Types.ObjectId, ref: 'Gift' },
})

const BankImportSchema = new Schema(
  {
    filename: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
    uploadedByName: String,
    status: { type: String, enum: ['review', 'completed'], default: 'review' },
    completedAt: Date,
    credits: { type: Number, default: 0 },
    /** the bank layout the file was read as ("CommBank", "Westpac", "Mapped by hand") */
    layout: String,
    /** money-out lines in the file, left out because only credits can be gifts */
    debitsSkipped: { type: Number, default: 0 },
    lines: { type: [BankLineSchema], default: [] },
    /** set while someone's "Save" is turning lines into gifts, so a second
     *  click, tab or server can't save the same lines twice; it lapses on its
     *  own if the process dies part-way (routes/admin/bank.ts) */
    confirmingUntil: Date,
  },
  { timestamps: true },
)
BankImportSchema.index({ 'lines.hash': 1 })

export type BankImportDoc = HydratedDocument<InferSchemaType<typeof BankImportSchema>>
export const BankImport = mongoose.model('BankImport', BankImportSchema)
