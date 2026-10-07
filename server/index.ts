import { env, paymentsSimulated } from './env'
import { connect, disconnect } from './db'
import { createApp } from './app'
import { runMigrations } from './migrations'
import { demoLoginsLeft, seedIfEmpty } from './seed/seed'
import { startJobs, stopJobs } from './jobs/scheduler'

/* ---------------------------------------------------------------------------
   Start-up, and shutting down cleanly.

   Start: connect, run any one-off data migrations (server/migrations.ts),
   seed an empty development database, listen, start the jobs.

   Stop (SIGTERM on every deploy, SIGINT on Ctrl-C): stop taking new
   connections and let the requests in flight finish; let a running job reach
   the end of the item it is on (a charge half-taken must be recorded before
   the process goes); give up the jobs lease; then disconnect. Each step has a
   deadline, and the whole thing stays inside Render's 30-second grace period
   (render.yaml maxShutdownDelaySeconds), after which the process is killed
   anyway. A second signal during shutdown is ignored rather than starting
   a second, overlapping shutdown.
--------------------------------------------------------------------------- */

async function main() {
  await connect()
  await runMigrations()
  await seedIfEmpty()
  /* a live deploy must not open with the published demo password, even after
     SEED_DEMO is switched off: the seeded accounts outlive the flag (C1) */
  if (env.isProd && !env.seedDemo) {
    const left = await demoLoginsLeft()
    if (left.length) {
      throw new Error(
        `Refusing to start: ${left.length} staff login(s) still use the published demo password (${left.join(', ')}). ` +
          'Go live on a fresh database, or change or deactivate these accounts.',
      )
    }
  }
  const app = createApp()
  const server = app.listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port}`)
    console.log(`[api] email: ${env.smtp ? 'SMTP' : 'outbox (Admin → Email log)'} · payments: ${paymentsSimulated ? 'SIMULATED' : 'Stripe'} · time zone: ${process.env.TZ}`)
  })
  server.on('error', (err: NodeJS.ErrnoException) => {
    console.error(err.code === 'EADDRINUSE' ? `[api] port ${env.port} is already in use — set PORT in .env` : err)
    process.exit(1)
  })
  await startJobs()

  let stopping = false
  const shutdown = async (signal: string) => {
    if (stopping) return
    stopping = true
    console.log(`[api] ${signal}: shutting down`)
    const deadline = (ms: number) => new Promise<void>((r) => setTimeout(r, ms).unref())

    const closed = new Promise<void>((r) => server.close(() => r()))
    server.closeIdleConnections()
    await Promise.race([closed, deadline(8_000)])
    server.closeAllConnections()

    await stopJobs(15_000)
    try {
      await disconnect()
    } catch (err) {
      console.error('[api] disconnect failed', err)
    }
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
