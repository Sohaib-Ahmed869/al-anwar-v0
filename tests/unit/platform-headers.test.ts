import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SITE_CSP, SITE_HEADERS } from '../../server/security-headers'
import { DEFAULT_API_ORIGIN } from '../../middleware'
import { campaignEmail, plainName } from '../../server/emails/templates'

/* SECURITY FINDINGS M15, H7 and M10.
   - The site's security headers are written twice — vercel.json for the
     Vercel deploy, server/security-headers.ts for the Node process serving
     dist/ — and must say the same thing.
   - Vercel forwards /api to the API from two places, middleware.ts and the
     vercel.json fallback, which must name the same server.
   - A donor's name in a campaign can never become a link or markup. */

const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
  rewrites: { source: string; destination: string }[]
  headers: { source: string; headers: { key: string; value: string }[] }[]
}

describe('site security headers (M15)', () => {
  const site = vercel.headers.find((h) => h.source === '/((?!api/).*)')!
  const sent = Object.fromEntries(site.headers.map((h) => [h.key, h.value]))

  it('vercel.json sends exactly the headers the Node server does', () => {
    expect(sent).toEqual(SITE_HEADERS)
  })

  it('forbids framing, plugins and third-party scripts', () => {
    expect(SITE_CSP).toContain("frame-ancestors 'none'")
    expect(SITE_CSP).toContain("object-src 'none'")
    expect(SITE_CSP).toContain("script-src 'self'")
    expect(SITE_CSP).not.toMatch(/script-src[^;]*unsafe/)
    expect(sent['X-Frame-Options']).toBe('DENY')
    expect(sent['Strict-Transport-Security']).toMatch(/max-age=\d{7,}/)
  })
})

describe('the API address (H7)', () => {
  it('middleware.ts and the vercel.json fallback forward to the same server', () => {
    const api = vercel.rewrites.find((r) => r.source === '/api/:path*')!
    expect(new URL(api.destination).origin).toBe(DEFAULT_API_ORIGIN)
  })
})

describe('campaign merge fields (M10)', () => {
  const body = 'Dear {{firstName}},\n\nThank you. [Our report](https://alanwaar.example/report)'

  it('a name with markdown link syntax stays text', () => {
    const e = campaignEmail(
      { subject: 'For you, {{firstName}}', body },
      { firstName: '[Your receipt](https://evil.example/x)', lastName: '<b>Smith</b>' },
      'https://alanwaar.example/unsub',
    )
    expect(e.html).not.toContain('href="https://evil.example')
    expect(e.html).toContain('[Your receipt](https://evil.example/x)'.replace(/&/g, '&amp;'))
    expect(e.html).toContain('href="https://alanwaar.example/report"')
    expect(e.subject).not.toMatch(/https?:|\[|\]|\(|\)/)
  })

  it('a name with HTML is escaped', () => {
    const e = campaignEmail({ subject: 'Hi', body: 'Dear {{firstName}} {{lastName}}' }, { firstName: '<img src=x onerror=alert(1)>', lastName: 'Ali' }, 'https://x/u')
    expect(e.html).not.toContain('<img src=x')
    expect(e.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('carries the one-click unsubscribe headers when given them', () => {
    const e = campaignEmail({ subject: 'Hi', body: 'Hello there, this is a campaign.' }, { firstName: 'Amina', lastName: 'Rahman' }, {
      pageUrl: 'https://x/api/public/unsubscribe?t=abc',
      headers: { 'List-Unsubscribe': '<https://x/api/public/unsubscribe/one-click?t=abc>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    })
    expect(e.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('plainName keeps real names', () => {
    expect(plainName("Mary-Jane O'Brien")).toBe("Mary-Jane O'Brien")
    expect(plainName('محمد علي')).toBe('محمد علي')
    expect(plainName('Zoë')).toBe('Zoë')
  })
})
