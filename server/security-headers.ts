/* ---------------------------------------------------------------------------
   The Content-Security-Policy for the site and for the API, in one place.

   vercel.json carries the SITE policy for the Vercel deploy, and server/app.ts
   sends it when the Node process serves the built site itself; a test
   (tests/unit/platform-headers.test.ts) checks the two say the same thing.

   THE SITE. Everything the pages load was inventoried (October 2026):
   scripts, styles, images, video and API calls are all our own origin; the
   only third parties are Google Fonts (a stylesheet and the font files) and
   the OpenStreetMap embed in the footer. Payments leave the site by a full
   page navigation to Stripe's or PayPal's own page, which CSP does not
   govern. Inline style attributes are everywhere (React style={{}}, and the
   UI kit injects styles at runtime), so style-src needs 'unsafe-inline';
   scripts do not, and get no such exception. data: and blob: images are the
   fundraiser photo cropper and preview. frame-ancestors 'none' is the
   clickjacking defence: no other site may put the give form or the admin
   portal in a frame.

   THE API answers JSON (and files, which set their own stricter policy in
   routes/files.ts), so it allows nothing at all.

   Adding a third party — analytics, a chat widget, a video embed — means
   adding it here, in vercel.json, and in the privacy policy.
--------------------------------------------------------------------------- */

export const SITE_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self'",
  "connect-src 'self'",
  "frame-src 'self' https://www.openstreetmap.org",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

export const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"

/** the other headers the site sends alongside its CSP */
export const SITE_HEADERS: Record<string, string> = {
  'Content-Security-Policy': SITE_CSP,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
}
