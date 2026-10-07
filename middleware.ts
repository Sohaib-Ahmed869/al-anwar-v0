import { next, rewrite } from '@vercel/functions'

/* ---------------------------------------------------------------------------
   Vercel Routing Middleware: forwards /api/* to the API on Render, adding the
   shared secret that tells the API the request came through the site.

   WHY. The API refuses /api requests without X-Origin-Auth when ORIGIN_SECRET
   is set on Render (server/app.ts). That closes the back door: called
   directly at its onrender.com address, the API would believe whatever
   X-Forwarded-For the caller wrote, and every rate limit keyed on the
   visitor's address could be reset at will. vercel.json's rewrites can't add
   a request header; middleware can.

   SET ON VERCEL (Project → Settings → Environment Variables):
     ORIGIN_SECRET   the same long random value as on Render
     API_ORIGIN      the API's address, e.g. https://al-anwaar.onrender.com
                     (optional: without it, DEFAULT_API_ORIGIN below)

   Any X-Origin-Auth a visitor sends is replaced, never passed through.

   FALLBACK. vercel.json still rewrites /api/* to the same address. It is what
   runs if this middleware is ever not deployed — and then, with ORIGIN_SECRET
   set on Render, every API call is refused (403), loudly, rather than the
   check silently going away.

   THE ADDRESS — CONFIRM IT (security finding H7). DEFAULT_API_ORIGIN and the
   destination in vercel.json must both be the Render service's real URL.
   render.yaml names the service al-anwaar-api, and vercel.json has pointed at
   al-anwaar.onrender.com since 25 September; whoever has the Render
   dashboard must confirm which is live and make the three agree.
   tests/unit/platform-headers.test.ts fails if this file and vercel.json
   disagree.
--------------------------------------------------------------------------- */

declare const process: { env: Record<string, string | undefined> }

export const DEFAULT_API_ORIGIN = 'https://al-anwaar.onrender.com'

export const config = { matcher: '/api/:path*' }

export default function middleware(request: Request) {
  const origin = process.env.API_ORIGIN || DEFAULT_API_ORIGIN
  const secret = process.env.ORIGIN_SECRET
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/api/')) return next()
  const headers = new Headers(request.headers)
  headers.delete('x-origin-auth')
  if (secret) headers.set('x-origin-auth', secret)
  return rewrite(new URL(url.pathname + url.search, origin), { request: { headers } })
}
