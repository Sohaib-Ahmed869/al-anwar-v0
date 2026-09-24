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
}

export function layout({ preheader, heading, body, footerNote, unsubscribeUrl }: LayoutOpts) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:${C.ground};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader ?? '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ground};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td style="padding:0 4px 20px;font:600 15px/1 'Helvetica Neue',Arial,sans-serif;color:${C.green};letter-spacing:.02em;">
      <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${C.green};margin-right:8px;vertical-align:1px;"></span>Al-Anwaar
    </td></tr>
    <tr><td style="background:${C.paper};border:1px solid ${C.line};border-radius:16px;padding:36px 32px;">
      <h1 style="margin:0 0 18px;font:600 22px/1.3 'Helvetica Neue',Arial,sans-serif;color:${C.text};letter-spacing:-.01em;">${esc(heading)}</h1>
      <div style="font:400 15px/1.65 'Helvetica Neue',Arial,sans-serif;color:${C.text};">${body}</div>
    </td></tr>
    <tr><td style="padding:22px 8px 0;font:400 12px/1.6 'Helvetica Neue',Arial,sans-serif;color:${C.text3};">
      ${footerNote ? `<p style="margin:0 0 8px;">${footerNote}</p>` : ''}
      <p style="margin:0;">Al-Anwaar Charity Group Ltd · ABN 16 643 085 152 · Registered with the ACNC</p>
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
