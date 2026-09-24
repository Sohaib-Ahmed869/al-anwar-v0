import mongoose, { Schema } from 'mongoose'
import type { Settings as SettingsShape } from '../../shared/types'

/* One document, `_id: 'org'`. Read through getSettings(), which fills any
   field a newer release added with its default. */
const SettingsSchema = new Schema({ _id: String, data: { type: Schema.Types.Mixed, default: {} } }, { minimize: false })
export const SettingsModel = mongoose.model('Settings', SettingsSchema)

export const DEFAULT_SETTINGS: SettingsShape = {
  org: {
    name: 'Al-Anwaar Charity Group Ltd',
    abn: '16 643 085 152',
    dgr: true,
    dgrNote: 'Endorsed as a Deductible Gift Recipient. Gifts of $2 or more are tax deductible in Australia.',
    email: 'info@alanwaar.group',
    phone: '',
    address: '11 Egerton St, Silverwater NSW 2128',
    website: 'alanwaar.group',
  },
  receipts: {
    prefix: 'AA',
    signatory: 'Treasurer',
    signatoryTitle: 'For the Board of Al-Anwaar Charity Group Ltd',
    footer: 'No goods or services were provided in return for this gift.',
  },
  bank: {
    accountName: 'Al-Anwaar Charity Group Ltd',
    bsb: '062-000',
    accountNumber: '1234 5678',
    bankName: 'Commonwealth Bank',
  },
  payments: { feeRate: 0.026, mode: 'simulated' },
  email: { fromName: 'Al-Anwaar', fromEmail: 'receipts@alanwaar.group', replyTo: 'info@alanwaar.group' },
  zakat: { nisab: 105000, nisabBasis: 'silver', updatedAt: new Date('2026-09-01').toISOString() },
}

export async function getSettings(): Promise<SettingsShape> {
  const row = await SettingsModel.findById('org').lean()
  const d = (row?.data ?? {}) as Partial<SettingsShape>
  return {
    org: { ...DEFAULT_SETTINGS.org, ...d.org },
    receipts: { ...DEFAULT_SETTINGS.receipts, ...d.receipts },
    bank: { ...DEFAULT_SETTINGS.bank, ...d.bank },
    payments: { ...DEFAULT_SETTINGS.payments, ...d.payments },
    email: { ...DEFAULT_SETTINGS.email, ...d.email },
    zakat: { ...DEFAULT_SETTINGS.zakat, ...d.zakat },
  }
}

export async function saveSettings(next: SettingsShape) {
  await SettingsModel.updateOne({ _id: 'org' }, { $set: { data: next } }, { upsert: true })
}
