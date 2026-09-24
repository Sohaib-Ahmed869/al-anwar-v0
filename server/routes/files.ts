import { Router, type Request, type Response } from 'express'
import { extname } from 'node:path'
import { can, type Role } from '../../shared/access'
import { currentStaff } from '../lib/auth'
import { forbidden, HttpError, notFound } from '../lib/http'
import { getFile } from '../lib/storage'
import { LibraryDocument } from '../models'

/* ---------------------------------------------------------------------------
   /api/files — uploaded files, streamed back through the API.

     /images/<file>      appeal and fundraiser photographs. Public, and cached
                         for a year: a key is never reused (lib/storage.ts
                         newKey puts a timestamp and random bytes in it), so a
                         replaced photo is a new URL and nothing goes stale.
     /documents/<file>   the compliance library. Staff with compliance.read
                         only, never cached, because a policy superseded
                         yesterday must not be served from a proxy today.

   The file name is checked against a strict pattern before it gets anywhere
   near the disk or S3, and every failure — bad name, no such file, S3 saying
   no — is the same 404, so nothing here tells a stranger which files exist.
--------------------------------------------------------------------------- */

const r = Router()

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

const SAFE_NAME = /^[\w-]+(\.[a-z0-9]{1,10})?$/i

async function send(res: Response, folder: string, file: string, cache: string, downloadName?: string) {
  if (!SAFE_NAME.test(file)) throw notFound('That file')
  let body: Buffer
  try {
    body = await getFile(`${folder}/${file}`)
  } catch {
    throw notFound('That file')
  }
  const ext = extname(file).toLowerCase()
  res.setHeader('Content-Type', TYPES[ext] ?? 'application/octet-stream')
  res.setHeader('Content-Length', String(body.length))
  res.setHeader('Cache-Control', cache)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (downloadName) {
    const ascii = downloadName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '')
    res.setHeader('Content-Disposition', `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`)
  }
  /* an uploaded SVG is a document that can run script; never let it render
     as a page of this origin */
  if (ext === '.svg') res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'")
  res.end(body)
}

r.get('/images/:file', async (req: Request<{ file: string }>, res) => {
  await send(res, 'images', req.params.file, 'public, max-age=31536000, immutable')
})

r.get('/documents/:file', async (req: Request<{ file: string }>, res) => {
  const staff = await currentStaff(req)
  if (!staff) throw new HttpError(401, 'Please sign in again.')
  if (!can(staff.role as Role, 'compliance.read')) throw forbidden()
  /* the name it was uploaded with, so "Save as" offers "Conflict of
     interest policy v3.pdf" rather than a storage key */
  const key = `documents/${req.params.file}`
  const doc = SAFE_NAME.test(req.params.file)
    ? await LibraryDocument.findOne({ 'versions.fileKey': key }, { versions: 1 }).lean()
    : null
  const name = doc?.versions.find((v) => v.fileKey === key)?.fileName
  await send(res, 'documents', req.params.file, 'private, no-store', name)
})

export default r
