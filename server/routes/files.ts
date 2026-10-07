import { Router, type Request, type Response } from 'express'
import { extname } from 'node:path'
import { notFound } from '../lib/http'
import { getFile } from '../lib/storage'
import { fileHeaders } from '../lib/filetypes'

/* ---------------------------------------------------------------------------
   /api/files — uploaded photographs, streamed back through the API.

     /images/<file>   appeal and fundraiser photographs. Public, and cached
                      for a year: a key is never reused (lib/storage.ts newKey
                      puts a timestamp and random bytes in it), so a replaced
                      photo is a new URL and nothing goes stale.

   Only the three photo types any upload path can produce are served (appeal
   uploads and fundraiser photos are both checked to be JPEG, PNG or WebP);
   any other name is the same 404 as a missing file. The headers come from
   lib/filetypes.ts, so a photo carries the same sandbox CSP as a document.

   The compliance library is not served here. Its files go out only through
   /api/compliance/documents/:id/file, which checks compliance.read and writes
   every download to the audit trail. (A second, unaudited /documents route
   used to live here; nothing in the portals used it.)

   The file name is checked against a strict pattern before it gets anywhere
   near the disk or S3, and every failure — bad name, no such file, S3 saying
   no — is the same 404, so nothing here tells a stranger which files exist.
--------------------------------------------------------------------------- */

const r = Router()

const PHOTOS = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const SAFE_NAME = /^[\w-]+\.[a-z0-9]{1,10}$/i

async function send(res: Response, folder: string, file: string, cache: string) {
  if (!SAFE_NAME.test(file) || !PHOTOS.has(extname(file).toLowerCase())) throw notFound('That file')
  let body: Buffer
  try {
    body = await getFile(`${folder}/${file}`)
  } catch {
    throw notFound('That file')
  }
  fileHeaders(res, file, body, { cache })
  res.end(body)
}

r.get('/images/:file', async (req: Request<{ file: string }>, res) => {
  await send(res, 'images', req.params.file, 'public, max-age=31536000, immutable')
})

export default r
