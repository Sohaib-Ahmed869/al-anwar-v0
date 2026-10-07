import express, { Router, type Request, type Response } from 'express'
import { EMAIL_COLORS, button, esc, layout, muted, p, url } from '../emails/layout'
import { env } from '../env'
import { audit } from '../lib/audit'
import { fullName } from '../lib/giving'
import { Donor } from '../models'

/* ---------------------------------------------------------------------------
   Unsubscribing from campaign email, by the token in the link.

     GET  /api/public/unsubscribe?t=…            a page that ASKS, with a button
     POST /api/public/unsubscribe/one-click?t=…  does it

   WHY THE GET NO LONGER UNSUBSCRIBES
   Mail providers and corporate link scanners open every link in an email
   before the person does. With the GET doing the work, a scanner quietly
   unsubscribed donors who never asked to be. So the link in the email lands on
   a page with one button, and only the POST behind that button changes
   anything.

   THE ONE POST SERVES TWO CALLERS
   - The button on that page: a plain HTML form, no script, so it works in any
     browser and under the page's strict CSP. It answers with a page.
   - Gmail and Yahoo's one-click unsubscribe (RFC 8058): every campaign email
     carries List-Unsubscribe and List-Unsubscribe-Post headers pointing here,
     and the provider POSTs `List-Unsubscribe=One-Click` with no cookies and no
     X-Requested-With header. It gets a plain 200.
   Neither can send the CSRF header, which is why this router is mounted on the
   app ahead of the /api router and its csrfGuard (server/app.ts). It needs no
   such guard: the unguessable token in the URL is the whole authority, and all
   it can ever do is switch marketing email off for the one person it belongs
   to — never on, and nothing else.

   Receipts and regular-donation notices are records, not marketing; they keep
   coming, and both pages say so.
--------------------------------------------------------------------------- */

const r = Router()

const TOKEN = /^[\w-]{16,}$/

/* the page is ours, on our origin: inline styles (the email layout's), our
   own images, a form that posts back here, and nothing else at all */
const PAGE_CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  `img-src 'self' ${new URL(env.appUrl).origin}`,
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join('; ')

function page(res: Response, status: number, html: string) {
  res.status(status)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Security-Policy', PAGE_CSP)
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.send(html)
}

const notFoundPage = () =>
  layout({
    heading: 'That link has expired',
    body: [
      p('We could not find the subscription this link belongs to. It may be from an old email, or it was copied only in part.'),
      p('You can switch every email off yourself from your account, or reply to any of our emails and we will do it for you.'),
      button('Email preferences', url('/account/profile')),
    ].join(''),
  })

const findByToken = (t: string) => (TOKEN.test(t) ? Donor.findOne({ unsubscribeToken: t }) : null)

r.get('/', async (req, res) => {
  const t = String(req.query.t ?? '')
  const donor = await findByToken(t)
  if (!donor) return page(res, 404, notFoundPage())
  const C = EMAIL_COLORS
  page(
    res,
    200,
    layout({
      heading: `Unsubscribe ${donor.firstName}?`,
      body: [
        p(`This stops appeals, updates and letters to <strong>${esc(donor.email)}</strong>.`),
        `<form method="post" action="${esc(`/api/public/unsubscribe/one-click?t=${encodeURIComponent(t)}`)}" style="margin:22px 0;">
<input type="hidden" name="List-Unsubscribe" value="One-Click">
<button type="submit" style="padding:13px 22px;border:0;border-radius:10px;background:${C.green};color:#fff;font:600 15px/1 'Helvetica Neue',Arial,sans-serif;cursor:pointer;">Unsubscribe me</button>
</form>`,
        muted('Receipts for any donation you give, and notices about a regular donation you have with us, still come — they are records, not marketing.'),
        p('Only want to hear about some things? You can choose exactly what arrives.'),
        button('Fine-tune my emails', url('/account/profile')),
      ].join(''),
    }),
  )
})

/* small, url-encoded bodies only: the form above and RFC 8058's one field */
r.post('/one-click', express.urlencoded({ extended: false, limit: '1kb' }), async (req: Request, res) => {
  const t = String(req.query.t ?? '')
  const fromBrowser = (req.get('accept') ?? '').includes('text/html')
  const donor = await findByToken(t)
  if (!donor) {
    if (fromBrowser) return page(res, 404, notFoundPage())
    return res.status(404).json({ error: { message: 'That link has expired.' } })
  }
  if (donor.preferences?.emailOptIn !== false) {
    donor.set('preferences.emailOptIn', false)
    await donor.save()
    await audit(
      req,
      'donor.unsubscribe',
      `${fullName(donor)} (${donor.number}) unsubscribed from emails ${fromBrowser ? 'using the link in an email' : "with their mail app's unsubscribe button"}`,
      { type: 'donor', id: donor._id, label: donor.number },
    )
  }
  if (!fromBrowser) return res.json({ ok: true })
  page(
    res,
    200,
    layout({
      heading: `You are unsubscribed, ${donor.firstName}`,
      body: [
        p(`We will not send appeals, updates or letters to <strong>${esc(donor.email)}</strong> any more.`),
        muted('Receipts for any donation you give, and notices about a regular donation you have with us, still come — they are records, not marketing.'),
        p('Changed your mind, or only want to hear about some things? You can choose exactly what arrives.'),
        button('Fine-tune my emails', url('/account/profile')),
      ].join(''),
    }),
  )
})

/** The links a campaign email carries for this donor: the page in the footer,
 *  and the RFC 8058 headers the mail app's own unsubscribe button uses. */
export function unsubscribeLinks(token: string) {
  const q = `?t=${encodeURIComponent(token)}`
  const pageUrl = `${env.appUrl}/api/public/unsubscribe${q}`
  const oneClick = `${env.appUrl}/api/public/unsubscribe/one-click${q}`
  return {
    pageUrl,
    headers: {
      'List-Unsubscribe': `<${oneClick}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}

export default r
