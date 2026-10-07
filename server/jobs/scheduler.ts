import { hostname } from 'node:os'
import { randomBytes } from 'node:crypto'
import { env } from '../env'
import { alert } from '../lib/alert'
import { deleteUnconfirmedFundraisers, endExpiredFundraisers, sweepAbandonedCheckouts, sweepPaidWithoutReceipt } from '../lib/sweeps'
import { acquireLease, releaseLease } from '../models/JobLease'
import { processCampaignQueue } from './campaigns'
import { setStopping } from './lifecycle'
import { processDuePlans, sendPreChargeNotices } from './recurring'
import { sendObligationReminders } from './reminders'
import { runRetention } from './retention'

/* ---------------------------------------------------------------------------
   Background work, on timers inside the API process.

     every 5 min   regular gifts due (and retries, and pauses ending), then
                   the pre-payment heads-up emails
     every minute  the next batch of any email campaign that is sending
     every 15 min  the sweeps: paid gifts whose receipt never went, checkouts
                   abandoned for days, fundraisers past their end date,
                   website fundraisers never confirmed by email
     every hour    statutory-calendar reminders
     every day     retention: old email bodies, old closed enquiries

   ONE RUNNER AT A TIME, BY LEASE. Timers run in every process, but a tick
   only does anything in the process holding the lease (models/JobLease.ts):
   a document in Mongo naming the holder, renewed every 30 seconds and good
   for 90. A deploy that briefly runs the old and new process side by side,
   a second instance, or a developer's run-once.ts against the same database
   all find the lease taken and wait; if the holder dies, the lease runs out
   and another process takes over within two minutes. The jobs also claim each
   item before acting on it (a plan, a notice, a campaign batch, a reminder),
   so even an overlap at the moment the lease changes hands can't do anything
   twice.

   RUN_JOBS=0 turns the timers off entirely (tests, a read-only replica).

   Each job has a "running" flag, so a slow run (a big campaign batch, a slow
   SMTP server) is never overlapped by the next tick. An error is raised as
   an [alert] and the timer carries on; a job never takes the API down.

   STOPPING. stopJobs() — on SIGTERM, from server/index.ts — clears the
   timers, tells the running jobs to stop between items (jobs/lifecycle.ts),
   waits for them up to a deadline, and gives the lease up so the next process
   needn't wait for it to expire.

   HEALTH. Each job's last success and last error are kept, and /api/health
   reports them (app.ts), so a job that has silently stopped succeeding shows.
--------------------------------------------------------------------------- */

type Job = { name: string; every: number; firstAfter: number; run: () => Promise<string | void> }

const MIN = 60_000
const LEASE_TTL = 90_000
const LEASE_RENEW = 30_000

const JOBS: Job[] = [
  {
    name: 'plans',
    every: 5 * MIN,
    firstAfter: 20_000,
    run: async () => {
      const s = await processDuePlans()
      const notices = await sendPreChargeNotices()
      const parts = [
        s.charged && `${s.charged} charged`,
        s.failed && `${s.failed} declined`,
        s.resumed && `${s.resumed} resumed`,
        s.errors && `${s.errors} errors`,
        notices && `${notices} notices sent`,
      ].filter(Boolean)
      if (s.errors) alert('job', `plans: ${s.errors} plans could not be charged or resumed (see the lines above)`)
      return parts.length ? `regular donations: ${parts.join(', ')}` : undefined
    },
  },
  { name: 'campaigns', every: MIN, firstAfter: 30_000, run: processCampaignQueue },
  {
    name: 'sweeps',
    every: 15 * MIN,
    firstAfter: 50_000,
    run: async () => {
      const receipts = await sweepPaidWithoutReceipt()
      const abandoned = await sweepAbandonedCheckouts()
      const ended = await endExpiredFundraisers()
      const unconfirmed = await deleteUnconfirmedFundraisers()
      const parts = [
        receipts && `${receipts} missing receipts sent`,
        abandoned && `${abandoned} abandoned checkouts closed`,
        ended && `${ended} fundraisers ended`,
        unconfirmed && `${unconfirmed} unconfirmed fundraisers deleted`,
      ].filter(Boolean)
      return parts.length ? `sweeps: ${parts.join(', ')}` : undefined
    },
  },
  { name: 'reminders', every: 60 * MIN, firstAfter: 40_000, run: sendObligationReminders },
  {
    name: 'retention',
    every: 24 * 60 * MIN,
    firstAfter: 5 * MIN,
    run: async () => {
      const r = await runRetention()
      const parts = [
        r.emailsTrimmed && `${r.emailsTrimmed} old email bodies removed`,
        r.enquiriesDeleted && `${r.enquiriesDeleted} old enquiries deleted`,
      ].filter(Boolean)
      return parts.length ? `retention: ${parts.join(', ')}` : undefined
    },
  },
]

/** this process, as the lease names it */
export const ME = `${hostname()}:${process.pid}:${randomBytes(3).toString('hex')}`

let timers: NodeJS.Timeout[] = []
let leader = false
const running = new Map<string, Promise<void>>()

export type JobState = { lastOkAt?: string; lastErrorAt?: string; lastError?: string }
const state = new Map<string, JobState>()

/** for /api/health: whether jobs run here, whether this process holds the
 *  lease, and each job's last success and failure */
export function jobHealth() {
  return {
    enabled: env.runJobs,
    leader,
    jobs: Object.fromEntries(JOBS.map((j) => [j.name, state.get(j.name) ?? {}])),
  }
}

async function renewLease() {
  try {
    const was = leader
    leader = await acquireLease(ME, LEASE_TTL)
    if (leader && !was) console.log(`[jobs] this process (${ME}) now runs the background jobs`)
    if (!leader && was) console.log(`[jobs] lost the jobs lease; another process runs them now`)
  } catch (err) {
    /* can't reach the database: stop acting as leader until we can again,
       since another process may take the lease once ours runs out */
    leader = false
    alert('job', 'could not renew the jobs lease', err)
  }
}

async function tick(job: Job) {
  if (!leader || running.has(job.name)) return
  const t0 = Date.now()
  const run = (async () => {
    try {
      const said = await job.run()
      state.set(job.name, { ...state.get(job.name), lastOkAt: new Date().toISOString() })
      if (said) console.log(`[jobs] ${said} (${Date.now() - t0}ms)`)
    } catch (err) {
      state.set(job.name, { ...state.get(job.name), lastErrorAt: new Date().toISOString(), lastError: err instanceof Error ? err.message : String(err) })
      alert('job', `${job.name} failed`, err)
    }
  })()
  running.set(job.name, run)
  try {
    await run
  } finally {
    running.delete(job.name)
  }
}

export async function startJobs() {
  clearTimers()
  setStopping(false)
  if (!env.runJobs) {
    console.log('[jobs] RUN_JOBS=0: background jobs are off in this process')
    return
  }
  await renewLease()
  timers.push(setInterval(() => void renewLease(), LEASE_RENEW))
  for (const job of JOBS) {
    timers.push(
      setTimeout(() => {
        void tick(job)
        timers.push(setInterval(() => void tick(job), job.every))
      }, job.firstAfter),
    )
  }
}

function clearTimers() {
  timers.forEach((t) => {
    clearTimeout(t)
    clearInterval(t)
  })
  timers = []
}

/** Stop starting new work, let running jobs finish the item they are on (up
 *  to `timeoutMs`), and give the lease up. */
export async function stopJobs(timeoutMs = 20_000) {
  clearTimers()
  setStopping(true)
  const inflight = [...running.values()]
  if (inflight.length) {
    console.log(`[jobs] waiting for ${inflight.length} running job(s) to reach a safe point…`)
    const done = await Promise.race([
      Promise.allSettled(inflight).then(() => true),
      new Promise<false>((r) => setTimeout(() => r(false), timeoutMs).unref()),
    ])
    if (!done) alert('job', `jobs still running after ${timeoutMs / 1000}s at shutdown`)
  }
  if (leader) {
    try {
      await releaseLease(ME)
    } catch {
      /* it runs out on its own in 90 seconds */
    }
    leader = false
  }
}
