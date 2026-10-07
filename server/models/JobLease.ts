import mongoose, { Schema } from 'mongoose'

/* ---------------------------------------------------------------------------
   Who runs the background jobs.

   The jobs take payments and send campaigns, so two processes running them at
   once (a deploy where old and new overlap, a second instance, a dev tool
   pointed at the same database) would charge and email twice. One document,
   _id 'jobs', names the process that holds the lease and until when. The
   holder renews it well inside its lifetime; if it dies, the lease simply
   runs out and the next process takes over. Taking it is one atomic update,
   so two processes can never both believe they hold it.
--------------------------------------------------------------------------- */

const JobLeaseSchema = new Schema(
  {
    _id: String,
    owner: { type: String, required: true },
    until: { type: Date, required: true },
  },
  { versionKey: false },
)

export const JobLease = mongoose.models.JobLease ?? mongoose.model('JobLease', JobLeaseSchema)

/** Take the lease, or renew it if we already hold it. True if we hold it now. */
export async function acquireLease(owner: string, ttlMs: number, name = 'jobs'): Promise<boolean> {
  const now = new Date()
  try {
    const doc = await JobLease.findOneAndUpdate(
      { _id: name, $or: [{ owner }, { until: { $lte: now } }] },
      { $set: { owner, until: new Date(now.getTime() + ttlMs) } },
      { upsert: true, returnDocument: 'after' },
    ).lean<{ owner: string }>()
    return doc?.owner === owner
  } catch (err) {
    /* the document exists and someone else's lease is still live: the
       filter didn't match, so the upsert tried to insert a second 'jobs' */
    if ((err as { code?: number }).code === 11000) return false
    throw err
  }
}

/** Give the lease up, if it is ours, so the next process need not wait for it to run out. */
export async function releaseLease(owner: string, name = 'jobs') {
  await JobLease.deleteOne({ _id: name, owner })
}
