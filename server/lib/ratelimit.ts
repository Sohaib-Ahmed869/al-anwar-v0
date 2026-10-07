import mongoose, { Schema } from 'mongoose'
import { rateLimit, type Options, type Store, type ClientRateLimitInfo } from 'express-rate-limit'
import { env } from '../env'

/* ---------------------------------------------------------------------------
   Rate limits whose counts live in MongoDB.

   express-rate-limit's default store is a Map in the process, so every deploy
   (Render redeploys on every push to main) handed every guesser a fresh
   budget, and a second process would have kept a second set of counts. Here
   each window is one document, counted with a single atomic update, and Mongo
   deletes it when the window ends (a TTL index on resetAt).

   `limiter()` is the one way the routes build a limit, so they all answer a
   refused request in the same shape the forms already show:
   { error: { message } } with status 429.

   Outside production every limit is twenty times looser — one person testing a
   form fifty times is not an attack — unless STRICT_LIMITS=1, which the tests
   that check the limits themselves set.
--------------------------------------------------------------------------- */

const RateWindowSchema = new Schema(
  {
    _id: String,
    hits: { type: Number, default: 0 },
    resetAt: { type: Date, required: true },
  },
  { versionKey: false },
)
RateWindowSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 })
export const RateWindow = mongoose.models.RateWindow ?? mongoose.model('RateWindow', RateWindowSchema)

export class MongoStore implements Store {
  prefix: string
  windowMs = 60_000
  localKeys = false

  constructor(prefix: string) {
    this.prefix = prefix
  }

  init(options: Options) {
    this.windowMs = options.windowMs
  }

  private id(key: string) {
    return `${this.prefix}:${key}`
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const doc = await RateWindow.findById(this.id(key)).lean<{ hits: number; resetAt: Date }>()
    if (!doc || doc.resetAt <= new Date()) return undefined
    return { totalHits: doc.hits, resetTime: doc.resetAt }
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const now = new Date()
    const fresh = new Date(now.getTime() + this.windowMs)
    /* one round trip: a window that has ended (or never existed) starts again
       at 1; a live one counts up. Done as an update pipeline so two requests at
       the same moment can't both read the old count. */
    const update = [
      { $set: { _ended: { $or: [{ $eq: [{ $ifNull: ['$resetAt', null] }, null] }, { $lte: ['$resetAt', now] }] } } },
      {
        $set: {
          hits: { $cond: ['$_ended', 1, { $add: ['$hits', 1] }] },
          resetAt: { $cond: ['$_ended', fresh, '$resetAt'] },
        },
      },
      { $unset: '_ended' },
    ]
    const run = () =>
      RateWindow.findOneAndUpdate({ _id: this.id(key) }, update, { upsert: true, returnDocument: 'after', updatePipeline: true }).lean<{
        hits: number
        resetAt: Date
      }>()
    let doc
    try {
      doc = await run()
    } catch (err) {
      /* two first requests for the same key can race on the insert; the
         second simply counts against the document the first created */
      if ((err as { code?: number }).code !== 11000) throw err
      doc = await run()
    }
    return { totalHits: doc!.hits, resetTime: doc!.resetAt }
  }

  /* Giving a hit back is best-effort: express-rate-limit calls it after the
     response has gone (skipSuccessfulRequests) without waiting for it, so a
     failure here — the database going away at shutdown — must not become an
     unhandled rejection. The worst case is one hit too many in the window. */
  async decrement(key: string) {
    try {
      await RateWindow.updateOne({ _id: this.id(key), hits: { $gt: 0 } }, { $inc: { hits: -1 } })
    } catch (err) {
      console.warn(`[ratelimit] could not give back a hit for ${this.prefix}: ${(err as Error).message}`)
    }
  }

  async resetKey(key: string) {
    await RateWindow.deleteOne({ _id: this.id(key) })
  }
}

const strict = () => env.isProd || process.env.STRICT_LIMITS === '1'

type LimiterOpts = {
  /** unique per limiter: it namespaces the counts in the shared collection */
  name: string
  windowMs: number
  /** the production limit; development allows twenty times as many */
  limit: number
  message?: string
  keyGenerator?: Options['keyGenerator']
  skip?: Options['skip']
  /** count only requests that fail (status 400 and up): a limit on wrong
   *  passwords per account, which signing in successfully mustn't use up */
  skipSuccessfulRequests?: boolean
}

export function limiter({ name, windowMs, limit, message, keyGenerator, skip, skipSuccessfulRequests }: LimiterOpts) {
  return rateLimit({
    windowMs,
    limit: () => (strict() ? limit : limit * 20),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: new MongoStore(name),
    ...(keyGenerator ? { keyGenerator } : {}),
    ...(skip ? { skip } : {}),
    ...(skipSuccessfulRequests ? { skipSuccessfulRequests } : {}),
    /* an IPv6-aware default key is express-rate-limit's own; a custom key (an
       email address, a plan id) is not an IP, so its IP checks don't apply */
    validate: keyGenerator ? { keyGeneratorIpFallback: false } : undefined,
    handler: (_req, res) => {
      res.status(429).json({ error: { message: message ?? 'Too many attempts. Please wait a few minutes and try again.' } })
    },
  })
}
