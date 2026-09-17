import { useEffect, useState } from 'react'

import { CONTACT } from './contact-data'
import { PHONE } from './nav-data'

/* --- is anybody there? ---------------------------------------------------
   Office hours as arithmetic, so the panel can say "open now" rather than
   leaving somebody in another timezone to work it out from "9 to 5 AEST".

   Everything is read through Intl in Australia/Sydney, which is what makes it
   right from anywhere: the device supplies the instant, the timezone database
   supplies the offset, and daylight saving is somebody else's problem. What it
   cannot know is a public holiday, or a day the office is shut for its own
   reasons — so the copy says the desk is open, never that a particular person
   is sitting at it, and the promise of a reply stays in the form's own intro
   where it can be kept.

   OPENS and SHUTS are the same hours as PHONE.hours in nav-data.ts, which is
   the sentence this is the arithmetic behind. If one moves, both move.
--------------------------------------------------------------------------- */
const SYDNEY = 'Australia/Sydney'
const OPENS = 9
const SHUTS = 17

const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

const sydney = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-AU', { timeZone: SYDNEY, ...options })

/** Monday to Friday. */
const working = (day: number) => day > 0 && day < 6

export function deskStatus(now: Date) {
  const d = CONTACT.reach.desk

  const day = DAYS.indexOf(sydney({ weekday: 'long' }).format(now) as (typeof DAYS)[number])
  /* formatToParts rather than format, so what comes back is the number and not
     a string with a locale's own decoration around it. Midnight is 24 in some
     engines and 0 in others. */
  const hour =
    Number(
      sydney({ hour: 'numeric', hour12: false })
        .formatToParts(now)
        .find((part) => part.type === 'hour')?.value ?? '0',
    ) % 24

  const clock = d.clock.replace(
    '{time}',
    sydney({ hour: 'numeric', minute: '2-digit', hour12: true }).format(now),
  )

  /* A weekday name Intl did not hand back in the shape expected. Rather than
     count forward from the wrong day and name the wrong one, say nothing about
     when — the hours are in the row below either way. */
  if (day < 0) return { open: false, clock, line: PHONE.hours }

  if (working(day) && hour >= OPENS && hour < SHUTS) {
    return { open: true, clock, line: d.openBody }
  }

  let when: string
  if (working(day) && hour < OPENS) {
    when = d.soon
  } else {
    /* This evening, the weekend, or a Friday after five: step forward to the
       next day the office opens and name it, unless that day is simply
       tomorrow, which is worth saying as tomorrow. */
    let step = 1
    while (!working((day + step) % 7)) step += 1
    when = step === 1 ? d.tomorrow : d.onDay.replace('{day}', DAYS[(day + step) % 7])
  }

  return { open: false, clock, line: d.closedBody.replace('{when}', when) }
}

/** The desk's status, re-read every thirty seconds, which is twice as often as
 *  the minute it shows. Used by the contact hero and the panel beside the form. */
export function useDesk() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(tick)
  }, [])

  return deskStatus(now)
}
