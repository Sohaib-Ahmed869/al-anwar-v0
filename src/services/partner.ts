import { BECOME, PARTNER_TYPES } from '../components/partners-data'
import { ORG } from '../components/org-data'
import { looksLikeEmail } from './contact'

/* ---------------------------------------------------------------------------
   A partnership enquiry: its fields, its checks, and where it goes. The same
   rules as services/volunteer.ts: ENDPOINT is empty because the site has no
   server, so `submitEnquiry` opens the sender's own email with the enquiry
   written out and the page says so. Never a tick for something unsent.
--------------------------------------------------------------------------- */

/** Fill this in once there is somewhere to post to. */
export const ENDPOINT = ''

export type Enquiry = {
  type: string
  org: string
  name: string
  role: string
  email: string
  phone: string
  website: string
  location: string
  message: string
  consent: boolean
}

export type EnquiryErrors = Partial<Record<keyof Enquiry, string>>

export const emptyEnquiry = (type = ''): Enquiry => ({
  type: PARTNER_TYPES.some((t) => t.id === type) ? type : '',
  org: '',
  name: '',
  role: '',
  email: '',
  phone: '',
  website: '',
  location: '',
  message: '',
  consent: false,
})

export function validateEnquiry(e: Enquiry): EnquiryErrors {
  const m = BECOME.form.errors
  const bad: EnquiryErrors = {}
  if (!PARTNER_TYPES.some((t) => t.id === e.type)) bad.type = m.type
  if (!e.org.trim()) bad.org = m.org
  if (!e.name.trim()) bad.name = m.name
  if (!looksLikeEmail(e.email)) bad.email = m.email
  if (!e.location.trim()) bad.location = m.location
  if (e.message.trim().length < 20) bad.message = m.message
  if (!e.consent) bad.consent = m.consent
  return bad
}

export function enquiryBody(e: Enquiry): string {
  const type = PARTNER_TYPES.find((t) => t.id === e.type)?.title ?? e.type
  return [
    `Partnership: ${type}`,
    `Organisation: ${e.org.trim()}`,
    `Name: ${e.name.trim()}${e.role.trim() ? `, ${e.role.trim()}` : ''}`,
    `Email: ${e.email.trim()}`,
    e.phone.trim() ? `Phone: ${e.phone.trim()}` : null,
    e.website.trim() ? `Website: ${e.website.trim()}` : null,
    `Location: ${e.location.trim()}`,
    '',
    e.message.trim(),
  ]
    .filter((l) => l !== null)
    .join('\n')
}

export async function submitEnquiry(e: Enquiry): Promise<'endpoint' | 'mail' | 'failed'> {
  if (ENDPOINT) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(e),
      })
      return res.ok ? 'endpoint' : 'failed'
    } catch {
      return 'failed'
    }
  }
  window.location.href = `mailto:${ORG.email}?subject=${encodeURIComponent(
    `Partnership enquiry: ${e.org.trim()}`,
  )}&body=${encodeURIComponent(enquiryBody(e))}`
  return 'mail'
}
