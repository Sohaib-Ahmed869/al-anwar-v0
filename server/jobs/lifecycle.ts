/* ---------------------------------------------------------------------------
   The process is shutting down.

   Set once, by stopJobs() on SIGTERM (a deploy, a restart). Jobs that work
   through a list — charging plans, sending a campaign batch — check it
   between items and stop there, so the process never exits halfway through
   one charge or one email. What they did not reach is still due, and the
   next process picks it up.
--------------------------------------------------------------------------- */

let stopping = false

export const isStopping = () => stopping

export function setStopping(v = true) {
  stopping = v
}
