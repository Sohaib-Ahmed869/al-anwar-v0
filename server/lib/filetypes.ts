import type { Response } from 'express'
import { extname } from 'node:path'

/* ---------------------------------------------------------------------------
   What an uploaded file is, decided by the server, and how it is sent back.

   The browser's word for a file's type (multer's `mimetype`) is whatever the
   uploader's machine — or an attacker's script — chose to say. A "policy.pdf"
   sent as text/html and served back as text/html on the site's own origin is
   a page that runs with a signed-in owner's cookies. So:

     - the type comes from the extension alone, from the table below, and the
       first bytes must agree with it (a PDF starts %PDF-, a PNG with its
       signature, a .docx is a zip, a .doc an OLE file, a .txt has no NULs);
     - the type is worked out again when the file is served, from the stored
       file name, so a row saved before this check is served safely too;
     - only PDFs, photographs and plain text open in the browser; everything
       else downloads;
     - every file response carries a CSP with `sandbox`, so even a file that
       slipped through would open as an opaque origin with no script, no
       cookies and no access to the API. Chromium's PDF viewer still renders
       under it (checked by hand with Playwright, October 2026).
--------------------------------------------------------------------------- */

export const FILE_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.rtf': 'application/rtf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
}

/** the only types a browser is allowed to open in place */
const INLINE = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.txt', '.md'])

export const FILE_CSP = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox"

/** ".pdf" or "Policy v3.pdf" → ".pdf". (Node's extname reads a bare ".pdf"
 *  as a hidden file with no extension.) */
const extOf = (nameOrExt: string) =>
  (nameOrExt.startsWith('.') && nameOrExt.lastIndexOf('.') === 0 ? nameOrExt : extname(nameOrExt)).toLowerCase()

export const typeOf = (fileName: string) => FILE_TYPES[extOf(fileName)] ?? 'application/octet-stream'

const starts = (b: Buffer, ...bytes: number[]) => bytes.every((x, i) => b[i] === x)
const ZIP = (b: Buffer) => starts(b, 0x50, 0x4b, 0x03, 0x04)
const OLE = (b: Buffer) => starts(b, 0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)
/* text: no NUL bytes in the first 8 KB is the usual test, and good enough to
   keep a binary out of a .txt; what the text says doesn't matter, because it
   is served as text/plain under the sandbox CSP */
const TEXT = (b: Buffer) => !b.subarray(0, 8192).includes(0)

const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  /* the spec lets the header sit anywhere in the first kilobyte */
  '.pdf': (b) => b.subarray(0, 1024).includes('%PDF-'),
  '.png': (b) => starts(b, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
  '.jpg': (b) => starts(b, 0xff, 0xd8, 0xff),
  '.jpeg': (b) => starts(b, 0xff, 0xd8, 0xff),
  '.webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  '.rtf': (b) => b.subarray(0, 5).toString('latin1') === '{\\rtf',
  '.docx': ZIP, '.xlsx': ZIP, '.pptx': ZIP, '.odt': ZIP, '.ods': ZIP,
  '.doc': OLE, '.xls': OLE, '.ppt': OLE,
  '.txt': TEXT, '.md': TEXT, '.csv': TEXT,
}

/** Whether the bytes are what the extension says. Unknown extensions fail. */
export function looksLike(fileName: string, body: Buffer) {
  const check = SIGNATURES[extOf(fileName)]
  return Boolean(check && body.length > 0 && check(body))
}

/** A photograph's real type from its first bytes, or null for anything that
 *  isn't a JPEG, PNG or WebP. Photo uploads take their extension (and so the
 *  type they are served with) from this, not from what the browser claimed. */
export function photoType(body: Buffer): { ext: '.jpg' | '.png' | '.webp'; mime: string } | null {
  if (SIGNATURES['.jpg'](body)) return { ext: '.jpg', mime: 'image/jpeg' }
  if (SIGNATURES['.png'](body)) return { ext: '.png', mime: 'image/png' }
  if (SIGNATURES['.webp'](body)) return { ext: '.webp', mime: 'image/webp' }
  return null
}

/** Headers for sending a stored file back: the server's type, inline only for
 *  the safe few, and the sandbox CSP on everything. */
export function fileHeaders(
  res: Response,
  fileName: string,
  body: Buffer,
  opts: { cache: string; download?: boolean; downloadName?: string },
) {
  const inline = INLINE.has(extOf(fileName)) && !opts.download
  res.setHeader('Content-Type', typeOf(fileName))
  res.setHeader('Content-Length', String(body.length))
  res.setHeader('Cache-Control', opts.cache)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Security-Policy', FILE_CSP)
  const name = opts.downloadName ?? fileName
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, "'")
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`)
}
