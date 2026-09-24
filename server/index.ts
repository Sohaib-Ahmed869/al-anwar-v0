import { env, paymentsSimulated } from './env'
import { connect, disconnect } from './db'
import { createApp } from './app'
import { seedIfEmpty } from './seed/seed'
import { startJobs, stopJobs } from './jobs/scheduler'

async function main() {
  await connect()
  await seedIfEmpty()
  const app = createApp()
  const server = app.listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port}`)
    console.log(`[api] email: ${env.smtp ? 'SMTP' : 'outbox (Admin → Email log)'} · payments: ${paymentsSimulated ? 'SIMULATED' : 'Stripe'}`)
  })
  server.on('error', (err: NodeJS.ErrnoException) => {
    console.error(err.code === 'EADDRINUSE' ? `[api] port ${env.port} is already in use — set PORT in .env` : err)
    process.exit(1)
  })
  startJobs()

  const shutdown = async () => {
    stopJobs()
    server.close()
    await disconnect()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
