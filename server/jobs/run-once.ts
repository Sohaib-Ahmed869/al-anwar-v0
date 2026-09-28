import { createConnection } from 'node:net'
import { connect, disconnect } from '../db'
import { env } from '../env'
import { processCampaignQueue } from './campaigns'
import { processDuePlans, sendPreChargeNotices } from './recurring'
import { sendObligationReminders } from './reminders'

/* ---------------------------------------------------------------------------
   Development tool: run every background job once, now, and say what it did.

     npx tsx server/jobs/run-once.ts

   Uses the same database as the dev server. With MONGODB_URI unset, the
   embedded MongoDB can only be opened by one process, so if `npm run dev` is
   running its instance (port 27031) is used directly; otherwise this starts
   the embedded one itself.
--------------------------------------------------------------------------- */

const EMBEDDED = { host: '127.0.0.1', port: 27031 }

const listening = () =>
  new Promise<boolean>((resolve) => {
    const s = createConnection(EMBEDDED)
    s.once('connect', () => (s.destroy(), resolve(true)))
    s.once('error', () => resolve(false))
  })

async function main() {
  if (!env.mongoUri && (await listening())) env.mongoUri = `mongodb://${EMBEDDED.host}:${EMBEDDED.port}/alanwaar`
  await connect()
  const t = (label: string) => {
    const t0 = Date.now()
    return () => `${label} (${Date.now() - t0}ms)`
  }

  let done = t('regular donations')
  const plans = await processDuePlans()
  console.log(`${done()}: ${plans.charged} charged, ${plans.failed} declined, ${plans.resumed} resumed, ${plans.errors} errors`)

  done = t('pre-payment notices')
  console.log(`${done()}: ${await sendPreChargeNotices()} sent`)

  done = t('campaign queue')
  await processCampaignQueue()
  console.log(`${done()}: ran`)

  done = t('obligation reminders')
  await sendObligationReminders()
  console.log(`${done()}: ran`)

  await disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await disconnect().catch(() => {})
  process.exit(1)
})
