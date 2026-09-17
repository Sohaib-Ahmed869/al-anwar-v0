import { APPLY, ROLES } from '../components/volunteer-data'
import { ORG } from '../components/org-data'
import { looksLikeEmail } from './contact'

/* ---------------------------------------------------------------------------
   A volunteer application: what it is, whether it is filled in, and where it
   goes. Same rules as services/contact.ts: nothing at the top level touches
   `window`, and ENDPOINT is empty because the site has no server, so
   `submitApplication` opens the applicant's own email with the application
   written out, and the page says so. It never shows a tick for something that
   has not arrived.
--------------------------------------------------------------------------- */

/** Fill this in once there is somewhere to post to. */
export const ENDPOINT = ''

export type Application = {
  first: string
  last: string
  email: string
  phone: string
  suburb: string
  roles: string[]
  when: string[]
  note: string
  consent: boolean
}

export type ApplicationErrors = Partial<Record<keyof Application, string>>

export const EMPTY_APPLICATION: Application = {
  first: '',
  last: '',
  email: '',
  phone: '',
  suburb: '',
  roles: [],
  when: [],
  note: '',
  consent: false,
}

export function validateApplication(a: Application): ApplicationErrors {
  const e = APPLY.form.errors
  const bad: ApplicationErrors = {}
  if (!a.first.trim()) bad.first = e.first
  if (!a.last.trim()) bad.last = e.last
  if (!looksLikeEmail(a.email)) bad.email = e.email
  const digits = a.phone.replace(/\D/g, '')
  if (a.phone.trim() && (digits.length < 8 || digits.length > 15)) bad.phone = e.phone
  if (!a.roles.length) bad.roles = e.roles
  if (!a.when.length) bad.when = e.when
  if (!a.consent) bad.consent = e.consent
  return bad
}

export function applicationBody(a: Application): string {
  const roleName = (id: string) => ROLES.items.find((r) => r.id === id)?.title ?? id
  return [
    `Name: ${a.first.trim()} ${a.last.trim()}`,
    `Email: ${a.email.trim()}`,
    a.phone.trim() ? `Mobile: ${a.phone.trim()}` : null,
    a.suburb.trim() ? `Suburb: ${a.suburb.trim()}` : null,
    `Would like to help with: ${a.roles.map(roleName).join(', ')}`,
    `Usually free: ${a.when.join(', ')}`,
    a.note.trim() ? `\n${a.note.trim()}` : null,
  ]
    .filter((l) => l !== null)
    .join('\n')
}

export async function submitApplication(a: Application): Promise<'endpoint' | 'mail' | 'failed'> {
  if (ENDPOINT) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(a),
      })
      return res.ok ? 'endpoint' : 'failed'
    } catch {
      return 'failed'
    }
  }
  window.location.href = `mailto:${ORG.email}?subject=${encodeURIComponent(
    `Volunteer application: ${a.first.trim()} ${a.last.trim()}`,
  )}&body=${encodeURIComponent(applicationBody(a))}`
  return 'mail'
}
