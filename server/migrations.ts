import mongoose, { Schema, type Model } from 'mongoose'
import { otpEmail, passwordResetEmail, staffInviteEmail } from './emails/templates'
import { alert } from './lib/alert'
import { EmailMessage, Gift, Plan, Staff } from './models'

/* ---------------------------------------------------------------------------
   One-off changes to data already in the database, run once each, at start-up.

   Each migration has a name; the `migrations` collection remembers which have
   FINISHED. Before running one, a process claims it — an insert that only one
   process can win (the name is the _id) — so two processes starting together
   never both run it. A migration that throws gives its claim back and stops
   start-up with the error, so the next start tries it again rather than
   finding it "recorded" and skipping it for ever; a process that dies in the
   middle leaves a claim that another may take over after fifteen minutes.
   Migrations are written to be safe to run again anyway. Run them by hand
   with

     npx tsx server/scripts/migrate.ts            (all that haven't finished)
     npx tsx server/scripts/migrate.ts --again <name>

   Add new ones at the end of MIGRATIONS; never edit one that has shipped.

   After the migrations, every model's indexes are checked: an index Mongo
   would not build (duplicates in data that predates a unique index, or an
   older index of the same name with different options) used to fail in the
   background without a word, leaving the protection it gives missing. Now it
   is an [alert] line at every start until someone fixes the data.
--------------------------------------------------------------------------- */

const MigrationSchema = new Schema({ _id: String, startedAt: Date, finishedAt: Date, result: String }, { versionKey: false })
const Migration = mongoose.models.Migration ?? mongoose.model('Migration', MigrationSchema)

type Step = { name: string; run: () => Promise<string> }

/** a claim older than this belongs to a process that died mid-migration */
const STALE_CLAIM_MS = 15 * 60_000

/* SECURITY FINDING C3. Until October 2026 the email log stored every message
   in full: sign-in codes (in the subject line, even), password reset links
   and staff invitation links, readable by staff who should not be able to
   sign in as the people they were sent to. New messages are stored redacted
   (emails/templates.ts). This replaces the stored subject and body of every
   old one of those three kinds with the redacted version, and — since any
   link still live may already have been read — cancels every outstanding
   reset and invitation link. A staff member mid-invite is sent a fresh invite
   from Admin → Staff. */
async function redactEmailLog() {
  const kinds: [string, { subject: string; html: string }][] = [
    ['otp', otpEmail('000000').logged!],
    ['staff.reset', passwordResetEmail('', '').logged!],
    ['staff.invite', staffInviteEmail('', '', '').logged!],
  ]
  let rows = 0
  for (const [template, logged] of kinds) {
    const r = await EmailMessage.updateMany(
      { template },
      { $set: { subject: logged.subject, html: logged.html, text: 'This message carried a sign-in code or a one-time link, which is not kept in the email log.' } },
    )
    rows += r.modifiedCount
  }
  const tokens = await Staff.updateMany({ tokenExpires: { $gt: new Date() } }, { $unset: { tokenHash: 1, tokenExpires: 1 } })
  return `redacted ${rows} logged emails; cancelled ${tokens.modifiedCount} outstanding reset or invitation links`
}

/** The name Mongo gives an index it was not given a name for. */
const indexName = (fields: Record<string, unknown>) => Object.entries(fields).map(([k, v]) => `${k}_${v}`).join('_')

/** Build a model's indexes, first dropping any existing index of the same name
 *  whose options differ (an old sparse index where the schema now asks for a
 *  unique partial one): createIndex refuses to change an index in place. */
async function rebuildIndexes(model: Model<unknown>) {
  const existing = await model.collection.indexes().catch(() => [])
  for (const [fields, options] of model.schema.indexes()) {
    const name = (options as { name?: string }).name ?? indexName(fields as Record<string, unknown>)
    const was = existing.find((i) => i.name === name)
    if (!was) continue
    const o = options as { unique?: boolean; sparse?: boolean; partialFilterExpression?: unknown }
    const same =
      Boolean(was.unique) === Boolean(o.unique) &&
      Boolean(was.sparse) === Boolean(o.sparse) &&
      JSON.stringify(was.partialFilterExpression ?? null) === JSON.stringify(o.partialFilterExpression ?? null)
    if (!same) await model.collection.dropIndex(name)
  }
  await model.createIndexes()
}

export const MIGRATIONS: Step[] = [
  { name: '2026-10-redact-email-log', run: redactEmailLog },
  {
    /* The same again, on the deploy after: during a rolling deploy the
       instances of the old version kept writing unredacted codes and links
       for a few minutes after the first run. Idempotent: a redacted row is
       written the same again. */
    name: '2026-10-redact-email-log-2',
    run: redactEmailLog,
  },
  {
    /* SECURITY REVIEW, payments #11. Before October 2026 a simulated regular
       payment's id was "sim_pi_" plus the last twelve characters of its key —
       the date and attempt — so every plan charged on the same day shared one.
       On a database with such gifts the unique index on external.stripe could
       not build, and Mongo said nothing: the double-charge protection
       (finding M7) was simply missing. This gives each duplicate its own id,
       then builds the payment and receipt indexes (replacing older ones of the
       same name whose options changed). Simulated ids only; a real Stripe id
       is never rewritten. */
    name: '2026-10-unique-simulated-charge-ids',
    run: async () => {
      const dupes = await Gift.aggregate<{ _id: string; ids: mongoose.Types.ObjectId[] }>([
        { $match: { 'external.stripe': { $regex: '^sim_pi_' } } },
        { $group: { _id: '$external.stripe', ids: { $push: '$_id' }, n: { $sum: 1 } } },
        { $match: { n: { $gt: 1 } } },
      ])
      let rewritten = 0
      for (const d of dupes) {
        for (const id of d.ids.slice(1)) {
          await Gift.updateOne({ _id: id }, { $set: { 'external.stripe': `${d._id}-${String(id)}` } })
          rewritten++
        }
      }
      await rebuildIndexes(Gift as unknown as Model<unknown>)
      await rebuildIndexes(Plan as unknown as Model<unknown>)
      return `gave ${rewritten} simulated payment${rewritten === 1 ? '' : 's'} their own id; rebuilt the gift and plan indexes`
    },
  },
]

/** Claim a migration to run it: a fresh one, or one whose last claim was
 *  abandoned. False when it has finished, or another process is on it now. */
async function claim(name: string): Promise<boolean> {
  const now = new Date()
  try {
    await Migration.create({ _id: name, startedAt: now })
    return true
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err
  }
  const taken = await Migration.updateOne(
    { _id: name, finishedAt: null, startedAt: { $lt: new Date(now.getTime() - STALE_CLAIM_MS) } },
    { $set: { startedAt: now } },
  )
  return taken.modifiedCount === 1
}

export async function runMigrations(opts: { again?: string } = {}) {
  for (const m of MIGRATIONS) {
    if (opts.again === m.name) await Migration.deleteOne({ _id: m.name })
    if (!(await claim(m.name))) continue
    let result: string
    try {
      result = await m.run()
    } catch (err) {
      /* give the claim back, so the next start runs it again; and stop this
         start, loudly, rather than running on half-migrated data */
      await Migration.deleteOne({ _id: m.name, finishedAt: null }).catch(() => {})
      alert('startup', `migration ${m.name} failed; it will run again at the next start`, err)
      throw err
    }
    await Migration.updateOne({ _id: m.name }, { $set: { finishedAt: new Date(), result } })
    console.log(`[migrate] ${m.name}: ${result}`)
  }
  await checkIndexes()
}

/** Every model's indexes, built or reported: Mongoose builds them in the
 *  background and keeps any failure to itself (Model.init()). */
export async function checkIndexes() {
  const models = Object.values(mongoose.models)
  const results = await Promise.allSettled(models.map((model) => model.init()))
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      alert('startup', `the indexes of ${models[i].modelName} could not be built, so the protection they give is missing until the data is fixed`, r.reason)
    }
  })
}
