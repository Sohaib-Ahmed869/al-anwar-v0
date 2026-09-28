import { env } from '../env'

/* ---------------------------------------------------------------------------
   The frame every email sits in. Table layout and inline styles, because that
   is still what renders the same in Outlook, Gmail and Apple Mail. The colours
   are the site's tokens from src/index.css written out by hand — email clients
   do not read CSS variables.
--------------------------------------------------------------------------- */

const C = {
  ground: '#F5F5F2',
  paper: '#FFFFFF',
  ink: '#151A18',
  text: '#191C1B',
  text2: '#5B6260',
  text3: '#8A908E',
  line: '#E4E4DF',
  green: '#2F6B5A',
  greenPale: '#E7EFEB',
  gold: '#C89B2C',
  goldPale: '#F0CF7E',
  /* the header band: a shade darker than green-600 (#265A4B), so the white
     logo and the gold rule both hold against it */
  deep: '#1D4A3E',
  alert: '#A63A1C',
}
export const EMAIL_COLORS = C

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export const url = (path: string) => `${env.appUrl}${path.startsWith('/') ? path : `/${path}`}`

type LayoutOpts = {
  preheader?: string
  heading: string
  /** already-escaped HTML */
  body: string
  footerNote?: string
  unsubscribeUrl?: string
  /** a word or two set small on the right of the header band, e.g. "Tax receipt" */
  eyebrow?: string
  /** the organisation's own details from Settings, for the footer's contact
   *  line. Without them the footer carries the legal name and ABN alone. */
  org?: { name: string; abn: string; email?: string; phone?: string; address?: string; website?: string }
}

const FONT = `'Helvetica Neue',Helvetica,Arial,sans-serif`

/* THE HEADER BAND (28 September 2026, client feedback on the receipt)
   Every email opens on a band of the logo's deep green with the white logo
   on it and a thin gold rule underneath: the one touch of gold, as on the
   site, where gold is kept for the give action. The white logo rather than
   the colour one (Al-Anwaar-Logo-600x136.png) because the colour one's teal
   disappears on green. It is an absolute URL from APP_URL, like the badges,
   so it only loads where APP_URL is reachable; its alt text is set white on
   the green so a client that blocks images still shows the name.

   Dark mode: the page declares itself light-only, which Apple Mail and
   Outlook honour. Gmail's app inverts anyway; the band is already dark and
   the logo white, so it survives, and every text colour is set explicitly on
   its own background so nothing is left dark-on-dark.

   Phones: one column, max 600px, and a media query (in the head, which Gmail
   and Apple Mail read) that trims the padding under 480px. Outlook ignores
   it and gets the desktop padding, which is fine at its widths. */
export function layout({ preheader, heading, body, footerNote, unsubscribeUrl, eyebrow, org }: LayoutOpts) {
  const contact = org
    ? [org.address, org.email && `<a href="mailto:${esc(org.email)}" style="color:${C.text3};text-decoration:underline;">${esc(org.email)}</a>`, org.phone, org.website && `<a href="https://${esc(org.website.replace(/^https?:\/\//, ''))}" style="color:${C.text3};text-decoration:underline;">${esc(org.website.replace(/^https?:\/\//, ''))}</a>`]
        .filter(Boolean)
        .map((x) => (x!.startsWith('<a') ? x : esc(x)))
        .join(' · ')
    : ''
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<title>${esc(heading)}</title>
<style>
  :root { color-scheme: light only; }
  @media (max-width: 480px) {
    .aa-outer { padding: 12px 8px !important; }
    .aa-pad { padding: 26px 20px !important; }
    .aa-band { padding: 18px 20px !important; }
    .aa-eyebrow { display: none !important; }
    .aa-logo { width: 150px !important; height: auto !important; }
  }
</style></head>
<body style="margin:0;padding:0;background:${C.ground};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader ?? '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.ground}" style="background:${C.ground};">
<tr><td align="center" class="aa-outer" style="padding:28px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
    <tr><td class="aa-band" bgcolor="${C.deep}" style="background:${C.deep};border-radius:16px 16px 0 0;padding:22px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle" style="font:600 20px/1 ${FONT};color:#FFFFFF;">
          <img class="aa-logo" src="${url('/assets/images/Al-Anwaar-Logo-White.png')}" alt="Al-Anwaar Charity Organisation" width="176" height="40" style="display:block;border:0;width:176px;height:40px;color:#FFFFFF;font:600 18px/40px ${FONT};">
        </td>
        ${eyebrow ? `<td valign="middle" align="right" class="aa-eyebrow" style="font:600 11px/1.2 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${C.goldPale};">${esc(eyebrow)}</td>` : ''}
      </tr></table>
    </td></tr>
    <tr><td height="3" bgcolor="${C.gold}" style="background:${C.gold};height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>
    <tr><td class="aa-pad" bgcolor="${C.paper}" style="background:${C.paper};border:1px solid ${C.line};border-top:0;border-radius:0 0 16px 16px;padding:34px 32px 30px;">
      <h1 style="margin:0 0 16px;font:600 23px/1.3 ${FONT};color:${C.text};letter-spacing:-.01em;">${esc(heading)}</h1>
      <div style="font:400 15px/1.65 ${FONT};color:${C.text};">${body}</div>
    </td></tr>
    <tr><td style="padding:22px 12px 0;font:400 12px/1.6 ${FONT};color:${C.text3};">
      ${footerNote ? `<p style="margin:0 0 8px;">${footerNote}</p>` : ''}
      <p style="margin:0;">${esc(org?.name ?? 'Al-Anwaar Charity Group Ltd')} · ABN ${esc(org?.abn ?? '16 643 085 152')} · Registered with the ACNC</p>
      ${contact ? `<p style="margin:4px 0 0;">${contact}</p>` : ''}
      ${unsubscribeUrl ? `<p style="margin:8px 0 0;"><a href="${unsubscribeUrl}" style="color:${C.text3};">Unsubscribe</a> · <a href="${url('/account/profile')}" style="color:${C.text3};">Email preferences</a></p>` : ''}
    </td></tr>
  </table>
</td></tr></table>
</body></html>`
}

export const p = (html: string, style = '') => `<p style="margin:0 0 14px;${style}">${html}</p>`

export const muted = (html: string) => `<p style="margin:0 0 14px;color:${C.text2};font-size:14px;">${html}</p>`

export function button(label: string, href: string, tone: 'green' | 'gold' = 'green') {
  const bg = tone === 'gold' ? C.gold : C.green
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;"><tr><td style="border-radius:10px;background:${bg};">
<a href="${href}" style="display:inline-block;padding:13px 22px;font:600 15px/1 'Helvetica Neue',Arial,sans-serif;color:#fff;text-decoration:none;border-radius:10px;">${esc(label)}</a>
</td></tr></table>`
}

/** A two-column facts table — the body of a receipt. */
export function facts(rows: [string, string][], total?: [string, string]) {
  const tr = ([k, v]: [string, string]) =>
    `<tr><td style="padding:9px 0;border-bottom:1px solid ${C.line};color:${C.text2};font-size:14px;">${esc(k)}</td>
<td align="right" style="padding:9px 0;border-bottom:1px solid ${C.line};font-size:14px;font-variant-numeric:tabular-nums;">${v}</td></tr>`
  const tot = total
    ? `<tr><td style="padding:14px 0 0;font-weight:600;">${esc(total[0])}</td><td align="right" style="padding:14px 0 0;font-weight:600;font-size:18px;font-variant-numeric:tabular-nums;">${total[1]}</td></tr>`
    : ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;">${rows.map(tr).join('')}${tot}</table>`
}

export function callout(html: string, tone: 'green' | 'alert' = 'green') {
  const bg = tone === 'alert' ? '#FBEDE8' : C.greenPale
  const fg = tone === 'alert' ? C.alert : C.green
  return `<div style="margin:0 0 18px;padding:14px 16px;border-radius:10px;background:${bg};color:${fg};font-size:14px;line-height:1.55;">${html}</div>`
}

/** The campaign editor's light markdown: blank-line paragraphs, **bold**,
 *  _italic_, [text](url), and "- " bullet lists. Escaped first, so a campaign
 *  can never inject markup. */
export function renderLightMarkdown(src: string) {
  const blocks = esc(src).replace(/\r\n/g, '\n').split(/\n{2,}/)
  const inline = (s: string) =>
    s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\W)_(.+?)_(?=\W|$)/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, (_m, t, h) =>
        `<a href="${h.startsWith('/') ? url(h) : h}" style="color:${C.green};">${t}</a>`)
      .replace(/\n/g, '<br>')
  return blocks
    .map((b) => {
      const lines = b.split('\n')
      if (lines.every((l) => /^[-*] /.test(l))) {
        return `<ul style="margin:0 0 14px;padding-left:20px;">${lines.map((l) => `<li style="margin:0 0 6px;">${inline(l.slice(2))}</li>`).join('')}</ul>`
      }
      if (/^#{1,3} /.test(b)) return `<h2 style="margin:22px 0 10px;font-size:17px;">${inline(b.replace(/^#{1,3} /, ''))}</h2>`
      return p(inline(b))
    })
    .join('')
}
