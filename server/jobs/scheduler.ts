import { processCampaignQueue } from './campaigns'
import { processDuePlans, sendPreChargeNotices } from './recurring'
import { sendObligationReminders } from './reminders'

/* ---------------------------------------------------------------------------
   Background work, on timers inside the API process.

     every 5 min   regular gifts due (and retries, and pauses ending), then
                   the pre-payment heads-up emails
     every minute  the next batch of any email campaign that is sending
     every hour    statutory-calendar reminders

   Plain setInterval rather than a cron library or a queue: there is one API
   process, and every job is idempotent (a plan that was charged has a new
   date; a notice that was sent is remembered on the plan), so a restart in
   the middle of a run simply picks up where it left off on the next tick.
   If the platform ever runs more than one process, only one of them may
   call startJobs() — the charges would otherwise race.

   Each job has a "running" flag, so a slow run (a big campaign batch, a slow
   SMTP server) is never overlapped by the next tick. An error is logged and
   the timer carries on; a job never takes the API down with it.
--------------------------------------------------------------------------- */

type Job = { name: string; every: number; firstAfter: number; run: () => Promise<string | void> }

const MIN = 60_000

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
      return parts.length ? `regular gifts: ${parts.join(', ')}` : undefined
    },
  },
  { name: 'campaigns', every: MIN, firstAfter: 30_000, run: processCampaignQueue },
  { name: 'reminders', every: 60 * MIN, firstAfter: 40_000, run: sendObligationReminders },
]

let timers: NodeJS.Timeout[] = []
const running = new Set<string>()

async function tick(job: Job) {
  if (running.has(job.name)) return
  running.add(job.name)
  const t0 = Date.now()
  try {
    const said = await job.run()
    if (said) console.log(`[jobs] ${said} (${Date.now() - t0}ms)`)
  } catch (err) {
    console.error(`[jobs] ${job.name} failed`, err)
  } finally {
    running.delete(job.name)
  }
}

export function startJobs() {
  stopJobs()
  for (const job of JOBS) {
    timers.push(
      setTimeout(() => {
        void tick(job)
        timers.push(setInterval(() => void tick(job), job.every))
      }, job.firstAfter),
    )
  }
}

export function stopJobs() {
  timers.forEach((t) => {
    clearTimeout(t)
    clearInterval(t)
  })
  timers = []
}
