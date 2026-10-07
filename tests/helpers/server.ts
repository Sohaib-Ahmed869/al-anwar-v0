import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

/* ---------------------------------------------------------------------------
   A real API for a test file: the Express app from server/app.ts, on a random
   port, against its own in-memory MongoDB that is thrown away afterwards.

     const api = await startApi({ seed: 'demo' })
     afterAll(() => api.stop())
     const owner = await api.staff('yusuf@alanwaar.group')
     const res = await owner.get('/api/admin/donors')

   `seed: 'demo'` loads the same invented data as `npm run dev` (staff with
   the demo password, donors, gifts, plans, appeals); `seed: 'none'` leaves
   the database empty for tests that build exactly what they need. The
   background jobs are never started — tests call the job functions directly.

   server/db.ts is imported before anything that compiles a model, because it
   registers the global toJSON plugin (`id` rather than `_id`), and Mongoose
   only applies global plugins to models compiled after it.
--------------------------------------------------------------------------- */

import { Client } from './client'

export const DEMO_PASSWORD = 'alanwaar-demo'

export type Api = {
  url: string
  /** a signed-out client */
  client: () => Client
  /** a client signed in to the admin portal as this staff member; pass the
   *  TOTP secret for someone with two-step sign-in on */
  staff: (email: string, password?: string, opts?: { totpSecret?: string }) => Promise<Client>
  /** a client signed in to the donor portal (the dev code comes back in the response) */
  donor: (email: string) => Promise<Client>
  stop: () => Promise<void>
}

export async function startApi(opts: { seed?: 'demo' | 'none' } = {}): Promise<Api> {
  const mongo = await MongoMemoryServer.create()
  const uri = mongo.getUri('aa-test')

  await import('../../server/db')
  const { env } = await import('../../server/env')
  env.mongoUri = uri
  await mongoose.connect(uri)

  if ((opts.seed ?? 'demo') === 'demo') {
    const { seedAll } = await import('../../server/seed/seed')
    await seedAll()
  }
  /* indexes are built in the background by Mongoose; tests that rely on a
     unique index must not race its creation */
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()))

  const { createApp } = await import('../../server/app')
  const app = createApp()
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  const client = () => new Client(url)

  return {
    url,
    client,
    async staff(email, password = DEMO_PASSWORD, opts = {}) {
      const c = client()
      let res = await c.post('/api/auth/staff/login', { email, password, remember: true })
      if (res.status === 200 && res.body?.mfa === 'challenge' && opts.totpSecret) {
        const { authenticator } = await import('otplib')
        res = await c.post('/api/auth/staff/mfa', { code: authenticator.generate(opts.totpSecret) })
      }
      if (res.status !== 200 || res.body?.mfa) throw new Error(`staff sign-in as ${email} failed: ${res.status} ${JSON.stringify(res.body)}`)
      return c
    },
    async donor(email) {
      const c = client()
      const sent = await c.post('/api/auth/donor/code', { email })
      const code = (sent.body as { devCode?: string }).devCode
      if (!code) throw new Error(`no dev code for ${email}: ${sent.status} ${JSON.stringify(sent.body)}`)
      const res = await c.post('/api/auth/donor/verify', { email, code })
      if (res.status !== 200) throw new Error(`donor sign-in as ${email} failed: ${res.status} ${JSON.stringify(res.body)}`)
      return c
    },
    async stop() {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await mongoose.disconnect()
      await mongo.stop()
    },
  }
}
