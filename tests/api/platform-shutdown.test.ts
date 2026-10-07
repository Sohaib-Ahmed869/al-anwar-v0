import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/* ---------------------------------------------------------------------------
   The real server process, started and stopped the way Render does it
   (SECURITY FINDING M8): `node --import tsx server/index.ts`, against a
   throwaway MongoDB, with the background jobs on.

     - one process holds the jobs lease; a second instance against the same
       database serves requests but does not run the jobs;
     - SIGTERM shuts down cleanly: exit code 0, the lease given up so the next
       process needn't wait for it to run out, and a request arriving during
       shutdown doesn't crash anything;
     - when the holder goes, the other instance takes the jobs over.

   SIGTERM tests are skipped on Windows: Node there has no SIGTERM handler —
   killing a child ends it outright, so there is nothing graceful to test.
   CI runs on Linux, where they run.

   The children get every variable set explicitly, even to '': the repo may
   hold a developer's real .env, which server/env.ts loads and which would
   otherwise fill in a real database or mail server.
--------------------------------------------------------------------------- */

const onWindows = process.platform === 'win32'

const BLANK = [
  'MONGODB_URI', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_API',
  'S3_BUCKET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET',
  'SEED_RESET', 'SEED_DEMO', 'ORIGIN_SECRET', 'API_ORIGIN', 'STRICT_LIMITS', 'ALLOW_SIMULATED_PAYMENTS',
  'REQUIRE_STAFF_MFA', 'TRUST_PROXY',
]

let mongo: MongoMemoryServer
let uri: string
let db: mongoose.Connection
const children: ChildProcess[] = []

beforeAll(async () => {
  mongo = await MongoMemoryServer.create()
  uri = mongo.getUri('aa-shutdown')
  db = await mongoose.createConnection(uri).asPromise()
})

afterAll(async () => {
  for (const c of children) if (c.exitCode === null && c.signalCode === null) c.kill('SIGKILL')
  await db?.close()
  await mongo?.stop()
})

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.once('error', reject)
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as { port: number }).port
      s.close(() => resolve(port))
    })
  })
}

type Instance = { child: ChildProcess; url: string; output: () => string; exited: Promise<number | null> }

async function startInstance(): Promise<Instance> {
  const port = await freePort()
  const env: NodeJS.ProcessEnv = { ...process.env }
  for (const k of BLANK) env[k] = ''
  Object.assign(env, {
    NODE_ENV: 'test',
    MONGODB_URI: uri,
    PORT: String(port),
    DATA_DIR: mkdtempSync(join(tmpdir(), 'aa-shutdown-')),
    JWT_SECRET: 'test-secret-0123456789abcdef0123456789abcdef',
    APP_URL: `http://127.0.0.1:${port}`,
    RUN_JOBS: '1',
  })
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  children.push(child)
  let out = ''
  child.stdout!.on('data', (d) => (out += d))
  child.stderr!.on('data', (d) => (out += d))
  const exited = new Promise<number | null>((r) => child.once('exit', (code) => r(code)))
  const url = `http://127.0.0.1:${port}`

  /* up when /api/health answers 200 (database reachable); the first instance
     also runs the migrations and seeds the empty database, which takes a few
     seconds */
  const deadline = Date.now() + 90_000
  for (;;) {
    if (child.exitCode !== null) throw new Error(`server exited early (${child.exitCode}):\n${out}`)
    try {
      const r = await fetch(`${url}/api/health`)
      if (r.status === 200) break
    } catch {
      /* not listening yet */
    }
    if (Date.now() > deadline) throw new Error(`server did not come up:\n${out}`)
    await new Promise((r) => setTimeout(r, 300))
  }
  return { child, url, output: () => out, exited }
}

const health = async (i: Instance) => (await (await fetch(`${i.url}/api/health`)).json()) as { jobs: { enabled: boolean; leader: boolean } }
const lease = () => db.collection('jobleases').findOne({ _id: 'jobs' as unknown as never }) as Promise<{ owner: string; until: Date } | null>

/** waits for `check` to hold, polling, up to `ms` */
async function eventually(check: () => Promise<boolean>, ms: number) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await check()) return true
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

describe('two instances against one database (M8)', () => {
  let a: Instance
  let b: Instance

  beforeAll(async () => {
    a = await startInstance()
    b = await startInstance()
  }, 200_000)

  it('exactly one runs the jobs, and the lease names it', async () => {
    const [ha, hb] = await Promise.all([health(a), health(b)])
    expect(ha.jobs.enabled && hb.jobs.enabled).toBe(true)
    expect(ha.jobs.leader).toBe(true)
    expect(hb.jobs.leader).toBe(false)
    const l = await lease()
    /* the lease owner is host:pid:random (server/jobs/scheduler.ts ME) */
    expect(l?.owner.split(':')[1]).toBe(String(a.child.pid))
    expect(l!.until.getTime()).toBeGreaterThan(Date.now())
  })

  it.skipIf(onWindows)(
    'SIGTERM: exits 0, gives the lease up, and survives a request arriving mid-shutdown',
    async () => {
      a.child.kill('SIGTERM')
      /* a request racing the shutdown: refused or answered, never a crash */
      const during = await fetch(`${a.url}/api/health`).then((r) => r.status, () => 'refused')
      expect([200, 503, 'refused']).toContain(during)

      const code = await Promise.race([a.exited, new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 20_000))])
      expect(code).toBe(0)
      expect(a.output()).toContain('SIGTERM: shutting down')
      /* given up, not left to run out: either gone, or already taken by b */
      const l = await lease()
      expect(l === null || l.owner.split(':')[1] === String(b.child.pid)).toBe(true)
    },
    30_000,
  )

  it.skipIf(onWindows)(
    'the other instance takes the jobs over (within one renewal, 30 s)',
    async () => {
      const took = await eventually(async () => (await health(b)).jobs.leader, 45_000)
      expect(took).toBe(true)
      expect((await lease())?.owner.split(':')[1]).toBe(String(b.child.pid))

      b.child.kill('SIGTERM')
      const code = await Promise.race([b.exited, new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 20_000))])
      expect(code).toBe(0)
      expect(await lease()).toBeNull()
    },
    75_000,
  )
})
