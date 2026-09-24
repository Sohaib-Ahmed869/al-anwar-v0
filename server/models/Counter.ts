import mongoose, { Schema } from 'mongoose'

/* Sequential human-facing numbers: donor D-10001, gift G-100001, receipt
   AA-2026-000123. Atomic ($inc with upsert), so two gifts arriving in the same
   millisecond can never share a receipt number. */
const CounterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } })
export const Counter = mongoose.model('Counter', CounterSchema)

export async function nextSeq(key: string, start = 1): Promise<number> {
  const c = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  )
  return c!.seq + start - 1
}

export const nextDonorNumber = async () => `D-${await nextSeq('donor', 10001)}`
export const nextGiftNumber = async () => `G-${await nextSeq('gift', 100001)}`
export const nextPlanNumber = async () => `P-${await nextSeq('plan', 5001)}`
