import type { Request } from 'express'
import type { Types } from 'mongoose'
import { AuditEvent } from '../models'
import { clientIp } from './http'

/* ---------------------------------------------------------------------------
   The action log: every change, with the person and the time.

   `action` is a dotted verb — 'donor.merge', 'gift.create', 'plan.pause',
   'register.update' — so the compliance portal can filter by area. `summary`
   is the sentence a person reads in the log, written in the past tense with
   the names in it ("Merged Aisha Rahman (D-10231) into D-10004"), because an
   auditor reading an export will not have the database to look ids up in.

   A failure to write the log never fails the action it records; it is
   reported instead. The action already happened.
--------------------------------------------------------------------------- */

type Entity = { type: string; id?: Types.ObjectId | string; label?: string }

export async function audit(
  req: Request | null,
  action: string,
  summary: string,
  entity?: Entity,
  meta?: Record<string, unknown>,
) {
  try {
    const actor = req?.staff
      ? { kind: 'staff' as const, id: req.staff._id, name: req.staff.name }
      : req?.donor
        ? { kind: 'donor' as const, id: req.donor._id, name: `${req.donor.firstName} ${req.donor.lastName}`.trim() }
        : { kind: 'system' as const, name: 'System' }
    await AuditEvent.create({
      actor,
      action,
      summary,
      entity,
      meta,
      ip: req ? clientIp(req) : undefined,
    })
  } catch (err) {
    console.error('[audit] could not record', action, err)
  }
}

/** For jobs, which have no request. */
export const auditSystem = (action: string, summary: string, entity?: Entity, meta?: Record<string, unknown>) =>
  audit(null, action, summary, entity, meta)
