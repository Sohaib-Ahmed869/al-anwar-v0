import { differenceInCalendarDays } from 'date-fns'
import { auditSystem } from '../lib/audit'
import { sendEmail } from '../lib/email'
import { obligationReminderEmail } from '../emails/templates'
import { Obligation, Staff } from '../models'

/* ---------------------------------------------------------------------------
   Statutory-calendar reminders. Run hourly by the scheduler.

   Each open obligation with an owner has `reminderDays` (say 30, 7 and 1 days
   before) and `remindersSent`, the ones already emailed. On each run, every
   reminder whose moment has come and has not been sent is due; if several
   are due at once (an item added five days before its date is already past
   its 30- and 7-day marks) the owner gets ONE email and all of them are
   recorded, so nobody is sent three emails in the same minute.

   Once the date has passed the owner is emailed once more to say it is
   overdue, recorded as the sentinel -1. Changing the due date or the
   reminders in the portal resets what has been sent (routes/compliance/
   obligations.ts), so a moved deadline gets its reminders again.

   Marking an item done stops everything: only `upcoming` items are read.
--------------------------------------------------------------------------- */

const OVERDUE = -1

export async function sendObligationReminders(): Promise<void> {
  const now = new Date()
  const open = await Obligation.find({ status: 'upcoming', owner: { $ne: null } })
  for (const o of open) {
    const daysLeft = differenceInCalendarDays(o.dueDate, now)
    const sent = new Set(o.remindersSent)
    let due: number[]
    if (daysLeft < 0) due = sent.has(OVERDUE) ? [] : [OVERDUE]
    else due = o.reminderDays.filter((d) => daysLeft <= d && !sent.has(d))
    if (!due.length) continue

    const owner = await Staff.findOne({ _id: o.owner, active: true }).lean()
    if (!owner) continue
    const r = await sendEmail(owner.email, obligationReminderEmail({ title: o.title, dueDate: o.dueDate, description: o.description, id: String(o._id) }, owner.name, daysLeft))
    if (!r.ok) continue // tried again next hour

    o.remindersSent = [...sent, ...due]
    await o.save()
    const when = daysLeft < 0 ? 'is overdue' : daysLeft === 0 ? 'is due today' : `is due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
    await auditSystem('obligation.reminder', `Emailed ${owner.name} that ${o.title} ${when}`, { type: 'obligation', id: o._id, label: o.title })
  }
}
