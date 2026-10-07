import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join, resolve, extname } from 'node:path'
import { randomBytes } from 'node:crypto'
import { env } from '../env'

/* ---------------------------------------------------------------------------
   Files: appeal photographs and the compliance document library.

   Amazon S3 when S3_BUCKET is set (credentials from the usual AWS chain —
   instance role in production), and a folder on disk under .data/uploads
   otherwise. Callers only ever see a `key`; files are streamed back through
   the API so the document library's permissions apply to downloads too.
--------------------------------------------------------------------------- */

const localRoot = () => resolve(join(env.dataDir, 'uploads'))

type S3Mod = typeof import('@aws-sdk/client-s3')
let s3mod: S3Mod | null = null
let s3client: InstanceType<S3Mod['S3Client']> | null = null
async function s3() {
  s3mod ??= await import('@aws-sdk/client-s3')
  s3client ??= new s3mod.S3Client({ region: env.s3!.region })
  return { mod: s3mod, client: s3client }
}

export function newKey(folder: string, fileName: string) {
  const ext = extname(fileName).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10)
  return `${folder}/${Date.now().toString(36)}-${randomBytes(6).toString('hex')}${ext}`
}

export async function putFile(key: string, body: Buffer, mime: string) {
  if (env.s3) {
    const { mod, client } = await s3()
    await client.send(new mod.PutObjectCommand({ Bucket: env.s3.bucket, Key: key, Body: body, ContentType: mime }))
    return
  }
  const path = join(localRoot(), key)
  await mkdir(resolve(path, '..'), { recursive: true })
  await writeFile(path, body)
}

const KEY = /^[\w-]+\/[\w.-]+$/

export async function getFile(key: string): Promise<Buffer> {
  if (!KEY.test(key)) throw new Error('bad key')
  if (env.s3) {
    const { mod, client } = await s3()
    const r = await client.send(new mod.GetObjectCommand({ Bucket: env.s3.bucket, Key: key }))
    return Buffer.from(await r.Body!.transformToByteArray())
  }
  return readFile(join(localRoot(), key))
}

/** Remove a stored file. One that is already gone is not an error. */
export async function deleteFile(key: string): Promise<void> {
  if (!KEY.test(key)) throw new Error('bad key')
  if (env.s3) {
    const { mod, client } = await s3()
    await client.send(new mod.DeleteObjectCommand({ Bucket: env.s3.bucket, Key: key }))
    return
  }
  await unlink(join(localRoot(), key)).catch((err: NodeJS.ErrnoException) => {
    if (err.code !== 'ENOENT') throw err
  })
}
