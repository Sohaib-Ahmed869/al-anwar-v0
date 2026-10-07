import { createConnection } from 'node:net'
import { connect, disconnect } from '../db'
import { env } from '../env'
import { processCampaignQueue } from './campaigns'
import { processDuePlans, sendPreChargeNotices } from './recurring'
import { sendObligationReminders } from './reminders'
import { runRetention } from './retention'
import { deleteUnconfirmedFundraisers, endExpiredFundraisers, sweepAbandonedCheckouts, sweepPaidWithoutReceipt } from '../lib/sweeps'
import { acquireLease, releaseLease } from '../models/JobLease'

/* ---------------------------------------------------------------------------
   Development tool: run every background job once, now, and say what it did.

     npx tsx server/jobs/run-once.ts            (waits its turn: see below)
     npx tsx server/jobs/run-once.ts --force    run even if the dev server holds the lease

   It takes the same jobs lease the server's scheduler does (models/JobLease.ts),
   so it won't run alongside a server that is running the jobs itself. With
   --force it runs anyway — safe, because every job claims each item before
   acting on it — which is what you want when you are waiting on a test.

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
  const me = `run-once:${process.pid}`
  const force = process.argv.includes('--force')
  if (!(await acquireLease(me, 10 * 60_000)) && !force) {
    console.log('Another process (the dev server?) holds the jobs lease and is running them. Use --force to run now anyway.')
    await disconnect()
    return
  }
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

  done = t('sweeps')
  const receipts = await sweepPaidWithoutReceipt()
  const abandoned = await sweepAbandonedCheckouts()
  const ended = await endExpiredFundraisers()
  const unconfirmed = await deleteUnconfirmedFundraisers()
  console.log(`${done()}: ${receipts} missing receipts sent, ${abandoned} abandoned checkouts closed, ${ended} fundraisers ended, ${unconfirmed} unconfirmed fundraisers deleted`)

  done = t('retention')
  const r = await runRetention()
  console.log(`${done()}: ${r.emailsTrimmed} email bodies removed, ${r.enquiriesDeleted} enquiries deleted, ${r.donorsPastRetention} donors past retention (not changed)`)

  await releaseLease(me)
  await disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await disconnect().catch(() => {})
  process.exit(1)
})
