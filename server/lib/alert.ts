/* ---------------------------------------------------------------------------
   Alerts: things that went wrong where nobody is watching.

   A failed background job, a Stripe webhook that answered 5xx, an email that
   could not be sent — none of them has a person on the other end of the
   request to see the error. They are written to the log as one line with a
   fixed "[alert]" prefix and a kind, so a log drain or a saved search in
   Render (`[alert]`) catches every one of them, and an error tracker can be
   wired in here, in one place, later.
--------------------------------------------------------------------------- */

export type AlertKind = 'job' | 'webhook' | 'email' | 'startup' | 'retention' | 'auth'

export function alert(kind: AlertKind, message: string, err?: unknown) {
  const detail = err instanceof Error ? ` — ${err.message}` : err ? ` — ${String(err)}` : ''
  console.error(`[alert] ${kind}: ${message}${detail}`)
  if (err instanceof Error && err.stack) console.error(err.stack)
}
