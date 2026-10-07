import { connect, disconnect } from '../db'
import { auditSystem } from '../lib/audit'
import { resetStaffMfa } from '../lib/mfa'
import { Staff } from '../models'

/* ---------------------------------------------------------------------------
   Break glass: switch off someone's two-step sign-in from the server.

     npx tsx server/scripts/reset-staff-mfa.ts someone@alanwaar.group

   For the one case the portal can't handle: the only owner has lost their
   phone and their recovery codes (an owner can reset anyone else's, from
   Staff and access, but never their own). It does what that button does —
   clears the authenticator and recovery codes, and signs the person out
   everywhere — and writes it to the audit trail as a system action. Their
   role then walks them through setting up a new app at their next sign-in,
   with their existing password.

   It needs shell access to the API's environment, which is the point: that
   is a stronger proof of who is asking than anything a web page could take.
   Against production, run it in the Render shell (MONGODB_URI set).
--------------------------------------------------------------------------- */

const email = (process.argv[2] ?? '').trim().toLowerCase()
if (!email) {
  console.error('Usage: npx tsx server/scripts/reset-staff-mfa.ts <staff email>')
  process.exit(1)
}

await connect()
try {
  const s = await Staff.findOne({ email })
  if (!s) {
    console.error(`No staff login for ${email}.`)
    process.exitCode = 1
  } else {
    await resetStaffMfa(s._id)
    await auditSystem(
      'staff.mfa_reset',
      `Reset ${s.name}'s two-step sign-in from the server (break-glass script); they were signed out everywhere and will set it up again at their next sign-in`,
      { type: 'staff', id: s._id, label: s.name },
    )
    console.log(`Two-step sign-in reset for ${s.name} (${s.email}). They set up a new app at their next sign-in.`)
  }
} finally {
  await disconnect()
}
