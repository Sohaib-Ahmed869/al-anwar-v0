import type { NextFunction, Request, Response } from 'express'
import mongoose from 'mongoose'
import { z, type ZodType } from 'zod'

/* The few things every route needs: a way to fail with a status, a way to
   validate a body into a typed value, paging, and turning lean documents into
   the shapes in shared/types.ts. Express 5 forwards a rejected promise from an
   async handler to the error handler by itself, so routes just `throw`. */

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message)
  }
}

export const notFound = (what = 'That record') => new HttpError(404, `${what} could not be found.`)
export const forbidden = (msg = 'Your role does not allow that.') => new HttpError(403, msg)
export const badRequest = (msg: string, fields?: Record<string, string>) => new HttpError(400, msg, fields)

/** Parse and validate, or throw a 400 whose `fields` the form can show inline. */
export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input)
  if (r.success) return r.data
  const fields: Record<string, string> = {}
  for (const issue of r.error.issues) {
    const key = issue.path.join('.') || '_'
    if (!fields[key]) fields[key] = issue.message
  }
  throw new HttpError(400, 'Some details need another look.', fields)
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message, fields: err.fields } })
    return
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(404).json({ error: { message: 'That record could not be found.' } })
    return
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const fields: Record<string, string> = {}
    for (const [k, v] of Object.entries(err.errors)) fields[k] = v.message
    res.status(400).json({ error: { message: 'Some details need another look.', fields } })
    return
  }
  if ((err as { code?: number })?.code === 11000) {
    res.status(409).json({ error: { message: 'Something with those details already exists.' } })
    return
  }
  console.error('[api]', err)
  res.status(500).json({ error: { message: 'Something went wrong on our side. Please try again.' } })
}

/* ---------- paging ---------- */
export function paging(q: Request['query'], defaults = { pageSize: 25, max: 200 }) {
  const page = Math.max(1, Number(q.page) || 1)
  const pageSize = Math.min(defaults.max, Math.max(1, Number(q.pageSize) || defaults.pageSize))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

/** "sort=-date" → { date: -1 }, only for whitelisted keys. */
export function sorting(q: Request['query'], allowed: string[], fallback: Record<string, 1 | -1>) {
  const raw = String(q.sort ?? '')
  const key = raw.replace(/^-/, '')
  if (!allowed.includes(key)) return fallback
  return { [key]: raw.startsWith('-') ? -1 : 1 } as Record<string, 1 | -1>
}

/* ---------- lean documents out ---------- */
/** `_id` → `id`, ObjectIds → strings, Dates → ISO, and no `__v`, all the way
 *  down. For `.lean()` results, which skip the toJSON transform. */
export function out<T = unknown>(v: unknown): T {
  return walk(v) as T
}
function walk(v: unknown): unknown {
  if (v == null) return v
  if (v instanceof Date) return v.toISOString()
  if (v instanceof mongoose.Types.ObjectId) return v.toHexString()
  if (Array.isArray(v)) return v.map(walk)
  if (v instanceof Map) return Object.fromEntries([...v.entries()].map(([k, x]) => [k, walk(x)]))
  if (typeof v === 'object') {
    const o: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (k === '__v') continue
      if (k === '_id') {
        if (x != null) o.id = walk(x)
        continue
      }
      o[k] = walk(x)
    }
    return o
  }
  return v
}

/* ---------- small validators ---------- */
export const zId = z.string().regex(/^[a-f\d]{24}$/i, 'Not a valid id')
export const zEmail = z.string().trim().toLowerCase().email('That email address does not look right')
export const zCents = z.number().int('Amounts are in whole cents').positive('Must be more than zero')
export const zDate = z.coerce.date()

export const oid = (s: string) => new mongoose.Types.ObjectId(s)
export const isId = (s: unknown): s is string => typeof s === 'string' && /^[a-f\d]{24}$/i.test(s)

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Split a search box into a case-insensitive regex, or undefined if empty. */
export function searchRegex(q: unknown): RegExp | undefined {
  const s = String(q ?? '').trim()
  return s ? new RegExp(escapeRegex(s), 'i') : undefined
}

export function clientIp(req: Request) {
  return (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.socket.remoteAddress || ''
}
