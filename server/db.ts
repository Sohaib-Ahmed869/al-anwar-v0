import mongoose from 'mongoose'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { env } from './env'

/* ---------------------------------------------------------------------------
   The database connection.

   With MONGODB_URI set (Atlas, in production) it connects to that. Without it,
   it starts an embedded MongoDB whose files live in .data/mongo, so a
   developer gets a real database — real queries, real indexes, data that
   survives a restart — without installing anything. mongodb-memory-server is a
   dev dependency and is only imported on this path.
--------------------------------------------------------------------------- */

/* Every document leaves the API with `id` rather than `_id`, and without the
   version key. Set once here, so no model and no route has to remember. */
mongoose.plugin((schema) => {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      if (ret._id != null) ret.id = String(ret._id)
      delete ret._id
      return ret
    },
  })
})
mongoose.set('strictQuery', true)

let stopEmbedded: (() => Promise<unknown>) | null = null

export async function connect() {
  let uri = env.mongoUri
  if (!uri) {
    if (env.isProd) throw new Error('MONGODB_URI must be set in production')
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    const dbPath = resolve(join(env.dataDir, 'mongo'))
    mkdirSync(dbPath, { recursive: true })
    const server = await MongoMemoryServer.create({
      instance: { dbPath, storageEngine: 'wiredTiger', port: 27031 },
    })
    stopEmbedded = () => server.stop({ doCleanup: false })
    uri = server.getUri('alanwaar')
    console.log(`[db] embedded MongoDB at ${uri} (files in ${dbPath})`)
  }
  await mongoose.connect(uri)
  console.log('[db] connected')
}

export async function disconnect() {
  await mongoose.disconnect()
  if (stopEmbedded) await stopEmbedded()
}
