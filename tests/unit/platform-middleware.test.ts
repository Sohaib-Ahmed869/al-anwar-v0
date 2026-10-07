import { afterEach, describe, expect, it } from 'vitest'
import middleware, { DEFAULT_API_ORIGIN, config } from '../../middleware'

/* ---------------------------------------------------------------------------
   The Vercel Routing Middleware (middleware.ts, SECURITY FINDING H4), called
   the way Vercel calls it: a Request in, a Response out. @vercel/functions'
   rewrite() answers with instructions in headers rather than a body:

     x-middleware-rewrite             where the request goes instead
     x-middleware-request-<name>      each header the forwarded request carries
     x-middleware-override-headers    the list of those names (the forwarded
                                      request's headers are replaced by
                                      exactly these)

   So a test can see exactly what Render would receive: the right address,
   path and query, and the secret header set by us, whatever the visitor sent.
--------------------------------------------------------------------------- */

const saved = { API_ORIGIN: process.env.API_ORIGIN, ORIGIN_SECRET: process.env.ORIGIN_SECRET }
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

const forwarded = (res: Response) => {
  const names = (res.headers.get('x-middleware-override-headers') ?? '').split(',').filter(Boolean)
  return Object.fromEntries(names.map((n) => [n, res.headers.get(`x-middleware-request-${n}`)]))
}

describe('Vercel middleware: /api/* to the API, with the origin secret', () => {
  it('rewrites to API_ORIGIN with the same path and query', () => {
    process.env.API_ORIGIN = 'https://api.example.test'
    process.env.ORIGIN_SECRET = 's3cret-value'
    const res = middleware(new Request('https://site.example/api/public/appeals?status=open&page=2'))
    expect(res.headers.get('x-middleware-rewrite')).toBe('https://api.example.test/api/public/appeals?status=open&page=2')
  })

  it('replaces a visitor’s forged X-Origin-Auth with the secret, and keeps their other headers', () => {
    process.env.API_ORIGIN = 'https://api.example.test'
    process.env.ORIGIN_SECRET = 's3cret-value'
    const res = middleware(
      new Request('https://site.example/api/auth/staff/login', {
        method: 'POST',
        headers: { 'x-origin-auth': 'forged', cookie: 'aa_staff=abc', 'x-requested-with': 'aa' },
      }),
    )
    const h = forwarded(res)
    expect(h['x-origin-auth']).toBe('s3cret-value')
    expect(h.cookie).toBe('aa_staff=abc')
    expect(h['x-requested-with']).toBe('aa')
  })

  it('with no secret configured, a forged header is dropped, not passed on', () => {
    process.env.API_ORIGIN = 'https://api.example.test'
    delete process.env.ORIGIN_SECRET
    const res = middleware(new Request('https://site.example/api/health', { headers: { 'x-origin-auth': 'forged' } }))
    expect(res.headers.get('x-middleware-rewrite')).toBe('https://api.example.test/api/health')
    expect(forwarded(res)['x-origin-auth']).toBeUndefined()
  })

  it('falls back to the default API address when API_ORIGIN is unset', () => {
    delete process.env.API_ORIGIN
    const res = middleware(new Request('https://site.example/api/live'))
    expect(res.headers.get('x-middleware-rewrite')).toBe(`${DEFAULT_API_ORIGIN}/api/live`)
  })

  it('leaves the site’s own pages alone', () => {
    process.env.ORIGIN_SECRET = 's3cret-value'
    for (const path of ['/', '/give', '/admin/donors', '/apiary', '/assets/images/logo.png']) {
      const res = middleware(new Request(`https://site.example${path}`))
      expect(res.headers.get('x-middleware-rewrite'), path).toBeNull()
      expect(res.headers.get('x-middleware-next'), path).toBe('1')
      /* and a page never carries the secret anywhere */
      const all: string[] = []
      res.headers.forEach((v, k) => all.push(`${k}: ${v}`))
      expect(all.join('\n')).not.toContain('s3cret-value')
    }
  })

  it('is only invoked for /api/* (Vercel matcher)', () => {
    expect(config.matcher).toBe('/api/:path*')
  })
})
