import mongoose, { Schema } from 'mongoose'
import { DEFAULT_QUICK_GIVE, type QuickGiveOption } from '../../shared/quickgive'

/* ---------------------------------------------------------------------------
   The home page's quick-donate list, as one document (`_id: 'home'`) holding
   the ordered array — see shared/quickgive.ts for what an option is.

   One document rather than a collection of rows because the list is only
   ever read and saved whole, and its order IS the priority: saving the array
   in one write means a reorder can never be half-applied. Until staff first
   save it, the defaults in shared/quickgive.ts are what everyone sees.
--------------------------------------------------------------------------- */

const QuickGiveSchema = new Schema(
  { _id: String, items: { type: Schema.Types.Mixed, default: [] } },
  { minimize: false, timestamps: true },
)
export const QuickGiveModel = mongoose.model('QuickGive', QuickGiveSchema)

export async function getQuickGive(): Promise<QuickGiveOption[]> {
  const row = await QuickGiveModel.findById('home').lean()
  const items = row?.items as QuickGiveOption[] | undefined
  return Array.isArray(items) && items.length ? items : DEFAULT_QUICK_GIVE
}

export async function saveQuickGive(items: QuickGiveOption[]) {
  await QuickGiveModel.updateOne({ _id: 'home' }, { $set: { items } }, { upsert: true })
}
