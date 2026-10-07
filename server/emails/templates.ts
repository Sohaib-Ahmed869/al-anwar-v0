import { DESIGNATIONS, FREQUENCIES, METHODS, fyLabel, type Designation, type Frequency, type Method } from '../../shared/domain'
import { formatMoney } from '../../shared/money'
import type { Settings } from '../../shared/types'
import { OPERATING_COSTS_LABEL } from '../../shared/operating-costs'
import { EMAIL_COLORS, button, callout, esc, facts, layout, muted, p, renderLightMarkdown, url } from './layout'

/* ---------------------------------------------------------------------------
   Every email the platform sends, one function each. Each returns an Email
   and nothing else — sending, logging and the outbox are lib/email.ts's job.

   SECRETS NEVER REACH THE EMAIL LOG. Admin → Email log and a donor's Emails
   tab show what was sent, to staff who must not be able to sign in as the
   person it was sent to. So an email that carries a secret — a sign-in code,
   a password-reset or invitation link — also carries `logged`: the same
   message with the secret taken out, which is what lib/email.ts stores. The
   real one goes to the mail server and nowhere else. The code is also kept
   out of the subject line, which inbox previews and the log list both show.

   The receipt is the one with rules: it must carry the organisation's name,
   ABN, the DGR statement, the amount, the date and a unique number, and say
   that nothing was given in return. The wording is checked in week five
   before the first live donation.
--------------------------------------------------------------------------- */

export type Email = {
  subject: string
  html: string
  template: string
  /** what the email log stores instead, when the real message carries a
   *  secret (a code, a link with a token in it); see the header above */
  logged?: { subject: string; html: string }
  /** extra mail headers, e.g. List-Unsubscribe on campaigns */
  headers?: Record<string, string>
}

/** shown in the log where a secret was */
export const REDACTED = '••••••'

const day = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

type ReceiptGift = {
  number: string
  amount: number
  /** the operating-costs contribution in cents (a covered card fee on
   *  donations from before 28 September 2026), 0 if none */
  fee: number
  designation: Designation
  method: Method
  date: Date | string
  appealTitle?: string | null
  fundraiserTitle?: string | null
  /** the donor's full name as the gift has it; the first name if absent */
  donorName?: string | null
  receipt?: { number?: string | null } | null
}

/* ---------------------------------------------------------------------------
   THE RECEIPT (redesigned 28 September 2026, client feedback)

   It should look like a receipt, not a letter with a table in it: the logo on
   the deep-green band (layout.ts), the total set large where the eye lands
   first, then the receipt proper — number, date, donor, what it was for, how
   it was paid — and the money broken into the donation, the operating-costs
   contribution when there is one, and the total. The ACNC and DGR badges, the
   $2 fine print and the legal statement follow, and the footer carries the
   ABN and the contact details from Settings.

   Email-safe throughout: nested tables, inline styles, PNG images only, and
   every colour set against its own background, for the reasons in layout.ts.

   THE LETTER FROM THE CEO — AN EMPTY SLOT, OFF BY DEFAULT
   The client means to send a short letter from the CEO to go in every
   receipt. Until the words arrive, RECEIPT_LETTER is null and nothing is
   drawn. To switch it on, fill RECEIPT_LETTER below with the paragraphs as
   plain text (they are escaped) and the name and title to sign it with; a
   caller can also pass `letter` to receiptEmail() to override it, or `null`
   to leave it out. Do not write one on the client's behalf.
--------------------------------------------------------------------------- */

export type ReceiptLetter = {
  /** plain text, one string per paragraph; escaped when drawn */
  paragraphs: string[]
  /** who signs it, e.g. the CEO's name */
  name: string
  /** their title, e.g. "Chief Executive Officer" */
  title: string
}

/** The CEO's letter for every receipt. null until the client sends the text. */
export const RECEIPT_LETTER: ReceiptLetter | null = null

const T = EMAIL_COLORS
const LABEL_STYLE = `font:600 11px/1.3 'Helvetica Neue',Helvetica,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:${T.text3};`

/* The ACNC "Registered Charity" and "DGR – Tax deductible" badges above the
   receipt's legal lines (28 September 2026, client feedback): two round
   seals of the same size, the official ACNC logo and our own DGR seal. PNG,
   not SVG, because Gmail and Outlook do not show SVG; see
   src/components/badges-data.ts for where the artwork comes from. They load from APP_URL, so in development they only show when the
   outbox is viewed from the same machine. The fine print sits under them as
   the site's checkout has it. */
function badges() {
  const img = (file: string, alt: string) =>
    `<img src="${url(`/assets/badges/${file}`)}" alt="${esc(alt)}" width="84" height="84" style="display:inline-block;border:0;height:84px;width:84px;margin:0 12px 10px 0;vertical-align:middle;color:${T.text2};font-size:12px;">`
  return (
    `<div style="margin:0 0 6px;">${img('acnc-registered.png', 'ACNC Registered Charity')}${img('dgr-tax-deductible.png', 'DGR – Tax deductible')}</div>` +
    muted('Donations of $2 or more are tax deductible in Australia.')
  )
}

/** One line of the receipt: the label on the left, the value on the right. */
const line = (label: string, value: string, opts: { strong?: boolean; rule?: 'total' } = {}) => {
  const border = opts.rule === 'total' ? `border-top:2px solid ${T.deep};` : `border-top:1px solid ${T.line};`
  const pad = opts.rule === 'total' ? 'padding:12px 0 2px;' : 'padding:9px 0;'
  const weight = opts.strong ? `font-weight:600;color:${T.text};` : `color:${T.text2};`
  return `<tr>
<td valign="${opts.strong ? 'middle' : 'top'}" style="${pad}${border}font-size:14px;line-height:1.45;${weight}">${esc(label)}</td>
<td valign="${opts.strong ? 'middle' : 'top'}" align="right" style="${pad}${border}padding-left:16px;font-size:${opts.strong ? 17 : 14}px;line-height:1.45;color:${T.text};${opts.strong ? 'font-weight:600;' : ''}font-variant-numeric:tabular-nums;word-break:break-word;">${value}</td>
</tr>`
}

function letterBlock(l: ReceiptLetter) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;"><tr>
<td style="border-left:3px solid ${T.gold};padding:4px 0 4px 16px;">
<p style="margin:0 0 10px;${LABEL_STYLE}">A letter from our CEO</p>
${l.paragraphs.map((x) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:${T.text};">${esc(x)}</p>`).join('')}
<p style="margin:0;font-size:14px;line-height:1.5;color:${T.text};"><strong>${esc(l.name)}</strong><br><span style="color:${T.text2};">${esc(l.title)}</span></p>
</td></tr></table>`
}

export function receiptEmail(
  g: ReceiptGift,
  firstName: string,
  s: Settings,
  opts: { resend?: boolean; letter?: ReceiptLetter | null } = {},
): Email {
  const ops = g.fee || 0
  const total = g.amount + ops
  const number = g.receipt?.number ?? ''
  const to = g.fundraiserTitle ? `${g.appealTitle ?? 'Al-Anwaar'} · via ${g.fundraiserTitle}` : (g.appealTitle ?? 'Where most needed')
  const letter = opts.letter === undefined ? RECEIPT_LETTER : opts.letter

  /* the total, set large, where the eye lands first */
  const hero = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 24px;"><tr>
<td bgcolor="${T.greenPale}" style="background:${T.greenPale};border-radius:12px;padding:18px 20px;">
<p style="margin:0 0 6px;${LABEL_STYLE}color:${T.green};">Total received</p>
<p style="margin:0;font:600 32px/1.1 'Helvetica Neue',Helvetica,Arial,sans-serif;color:${T.deep};letter-spacing:-.02em;font-variant-numeric:tabular-nums;">${formatMoney(total, { exact: true })}</p>
<p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:${T.text2};">${day(g.date)}${number ? ` · Receipt ${esc(number)}` : ''}</p>
</td></tr></table>`

  const details = `<p style="margin:0 0 4px;${LABEL_STYLE}">Receipt details</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
${line('Receipt number', esc(number))}
${line('Date received', day(g.date))}
${line('Donor', esc(g.donorName || firstName))}
${line('Donation to', esc(to))}
${line('Given as', esc(DESIGNATIONS[g.designation].label))}
${line('Payment method', esc(METHODS[g.method].label))}
</table>
<p style="margin:0 0 4px;${LABEL_STYLE}">Amount</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
${line('Donation', formatMoney(g.amount, { exact: true }))}
${ops ? line(OPERATING_COSTS_LABEL, formatMoney(ops, { exact: true })) : ''}
${line('Total', formatMoney(total, { exact: true }), { strong: true, rule: 'total' })}
</table>`

  return {
    template: 'receipt',
    subject: `${opts.resend ? 'Your receipt, again' : 'Thank you for your donation'} — receipt ${number}`,
    html: layout({
      preheader: `${formatMoney(total, { exact: true })} received. Your tax receipt is inside.`,
      heading: opts.resend ? 'Your donation receipt' : `Thank you, ${firstName}`,
      eyebrow: 'Tax receipt',
      org: s.org,
      body: [
        opts.resend ? '' : p('Your donation has arrived. May Allah accept it from you and put barakah in what remains.'),
        hero,
        details,
        letter ? letterBlock(letter) : '',
        badges(),
        callout(
          `<strong>Tax receipt.</strong> ${esc(s.org.name)}, ABN ${esc(s.org.abn)}. ${esc(s.org.dgrNote)} ${esc(s.receipts.footer)}` +
            `<br><span style="font-size:13px;">Issued by the ${esc(s.receipts.signatory)} · ${esc(s.receipts.signatoryTitle)}</span>`,
        ),
        muted('Every donation you make is in your account, with every receipt and your end-of-year tax statement.'),
        button('See your donations', url('/account/giving')),
      ].join(''),
      footerNote: 'Keep this email for your tax records.',
    }),
  }
}

export function otpEmail(code: string): Email {
  const subject = 'Your Al-Anwaar sign-in code'
  const html = (c: string) =>
    layout({
      preheader: 'Your code works for 10 minutes.',
      heading: 'Your sign-in code',
      body: [
        p('Enter this code to open your account. It works for the next 10 minutes.'),
        `<div style="margin:6px 0 22px;font:600 34px/1 'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:.3em;color:#191C1B;">${esc(c)}</div>`,
        muted('If you did not ask for this, you can ignore it — nobody can get in without the code.'),
      ].join(''),
    })
  return { template: 'otp', subject, html: html(code), logged: { subject, html: html(REDACTED) } }
}

type PlanLike = {
  amount: number
  frequency: Frequency
  appealTitle?: string | null
  nextChargeAt?: Date | null
  payment?: { brand?: string | null; last4?: string | null } | null
  kind?: string | null
  instalments?: { total?: number | null; paid?: number | null } | null
}

const cardLine = (pl: PlanLike) =>
  pl.payment?.last4 ? `${esc(pl.payment.brand ?? 'Card')} ending ${esc(pl.payment.last4)}` : 'your saved payment method'

export function preChargeEmail(pl: PlanLike, firstName: string): Email {
  const when = pl.nextChargeAt ? day(pl.nextChargeAt) : 'soon'
  return {
    template: 'plan.notice',
    subject: `Your ${FREQUENCIES[pl.frequency].label.toLowerCase()} donation of ${formatMoney(pl.amount)} goes out on ${when}`,
    html: layout({
      preheader: `A heads-up, so nothing is a surprise.`,
      heading: `A heads-up, ${firstName}`,
      body: [
        p(`Your ${FREQUENCIES[pl.frequency].label.toLowerCase()} donation to <strong>${esc(pl.appealTitle ?? 'Al-Anwaar')}</strong> will be taken on <strong>${when}</strong>.`),
        facts([
          ['Amount', formatMoney(pl.amount, { exact: true })],
          ['From', cardLine(pl)],
          ...(pl.kind === 'instalment' && pl.instalments?.total
            ? ([['Payment', `${(pl.instalments.paid ?? 0) + 1} of ${pl.instalments.total}`]] as [string, string][])
            : []),
        ]),
        muted('Want to change the amount, pause for a while or use another card? You can do it yourself, any time.'),
        button('Manage this donation', url('/account/plans')),
      ].join(''),
    }),
  }
}

export function paymentFailedEmail(pl: PlanLike, firstName: string, reason: string, finalAttempt: boolean, planId: string): Email {
  return {
    template: 'plan.failed',
    subject: finalAttempt ? 'Your regular donation has stopped' : 'Your regular donation did not go through',
    html: layout({
      preheader: 'It only takes a minute to fix.',
      heading: finalAttempt ? `Your regular donation has stopped, ${firstName}` : `We could not take your donation, ${firstName}`,
      body: [
        p(
          finalAttempt
            ? `We tried a few times to take your ${formatMoney(pl.amount)} donation to <strong>${esc(pl.appealTitle ?? 'Al-Anwaar')}</strong> from ${cardLine(pl)}, and each attempt was declined, so we have paused it rather than keep trying.`
            : `Your ${formatMoney(pl.amount)} donation to <strong>${esc(pl.appealTitle ?? 'Al-Anwaar')}</strong> was declined by your bank. We will try again in a few days.`,
        ),
        callout(`The bank said: ${esc(reason)}`, 'alert'),
        p('Most of the time a card has simply expired or been replaced. Updating it takes a minute, and the donation carries on from there.'),
        button('Update my card', url(`/account/plans?fix=${planId}`), 'gold'),
      ].join(''),
    }),
  }
}

export function planChangedEmail(pl: PlanLike, firstName: string, what: string): Email {
  return {
    template: 'plan.changed',
    subject: `Your regular donation: ${what.toLowerCase()}`,
    html: layout({
      preheader: what,
      heading: `${what}`,
      body: [
        p(`Assalamu alaykum ${esc(firstName)}, this confirms the change you just made to your donation to <strong>${esc(pl.appealTitle ?? 'Al-Anwaar')}</strong>.`),
        facts([
          ['Amount', `${formatMoney(pl.amount, { exact: true })} ${FREQUENCIES[pl.frequency].per}`],
          ['Next payment', pl.nextChargeAt ? day(pl.nextChargeAt) : '—'],
          ['Paying with', cardLine(pl)],
        ]),
        muted('If this was not you, reply to this email and we will look into it straight away.'),
        button('See your regular donations', url('/account/plans')),
      ].join(''),
    }),
  }
}

export function taxStatementEmail(firstName: string, fy: number, total: number, count: number): Email {
  return {
    template: 'tax.statement',
    subject: `Your ${fyLabel(fy)} tax statement`,
    html: layout({
      preheader: `${formatMoney(total, { exact: true })} across ${count} donations.`,
      heading: `Your ${fyLabel(fy)} tax statement`,
      body: [
        p(`Assalamu alaykum ${esc(firstName)}. Here is everything you gave between 1 July ${fy - 1} and 30 June ${fy}, in one place for your tax return.`),
        facts([['Donations', String(count)]], ['Tax deductible total', formatMoney(total, { exact: true })]),
        button('Open your statement', url(`/account/statement/${fy}`)),
        muted('The statement lists every donation with its receipt number. Print it or save it as a PDF from the page.'),
      ].join(''),
    }),
  }
}

/** A statement for dates the donor chose; the link carries the same range. */
export function rangeStatementEmail(firstName: string, range: { from: string; to: string }, label: string, total: number, count: number): Email {
  const q = new URLSearchParams(range).toString()
  return {
    template: 'tax.statement',
    subject: `Your giving statement, ${label}`,
    html: layout({
      preheader: `${formatMoney(total, { exact: true })} across ${count} ${count === 1 ? 'donation' : 'donations'}.`,
      heading: 'Your giving statement',
      body: [
        p(`Assalamu alaykum ${esc(firstName)}. Here is everything you gave from ${esc(label)}, in one place, with every receipt number.`),
        facts([['Donations', String(count)]], ['Tax deductible total', formatMoney(total, { exact: true })]),
        button('Open your statement', url(`/account/statement/range?${q}`)),
        muted('Print it or save it as a PDF from the page.'),
      ].join(''),
    }),
  }
}

export function bankTransferEmail(
  g: { amount: number; reference?: string | null; appealTitle?: string | null },
  firstName: string,
  s: Settings,
): Email {
  return {
    template: 'bank.instructions',
    subject: `Your transfer reference: ${g.reference}`,
    html: layout({
      preheader: `Use ${g.reference} as the reference so we can find your donation.`,
      heading: `Thank you, ${firstName}`,
      body: [
        p(`Here are the details for your ${formatMoney(g.amount)} donation to <strong>${esc(g.appealTitle ?? 'Al-Anwaar')}</strong>. Please use the reference exactly — it is how we match the money to you.`),
        facts([
          ['Account name', esc(s.bank.accountName)],
          ['BSB', esc(s.bank.bsb)],
          ['Account', esc(s.bank.accountNumber)],
          ['Reference', `<strong>${esc(g.reference)}</strong>`],
        ]),
        muted('Your receipt is emailed the day the transfer reaches us, usually one to two business days.'),
      ].join(''),
    }),
  }
}

/** the button, or in the logged copy a note where the button was */
const secretButton = (label: string, link: string | null) =>
  link ? button(label, link) : muted(`[${esc(label)} — the link is left out of the email log]`)

export function staffInviteEmail(name: string, inviter: string, link: string): Email {
  const subject = `${inviter} added you to the Al-Anwaar admin portal`
  const html = (l: string | null) =>
    layout({
      preheader: 'Set a password to get started.',
      heading: `Welcome, ${name}`,
      body: [
        p(`${esc(inviter)} has given you a login to the Al-Anwaar admin portal. Choose a password to finish setting it up.`),
        secretButton('Set my password', l),
        muted('The link works for 7 days. If you were not expecting this, you can ignore it.'),
      ].join(''),
    })
  return { template: 'staff.invite', subject, html: html(link), logged: { subject, html: html(null) } }
}

export function passwordResetEmail(name: string, link: string): Email {
  const subject = 'Reset your Al-Anwaar password'
  const html = (l: string | null) =>
    layout({
      preheader: 'The link works for one hour.',
      heading: `Reset your password, ${name}`,
      body: [
        p('Someone — hopefully you — asked to reset the password for this account.'),
        secretButton('Choose a new password', l),
        muted('The link works for one hour. If you did not ask for this, your password has not changed.'),
      ].join(''),
    })
  return { template: 'staff.reset', subject, html: html(link), logged: { subject, html: html(null) } }
}

export function obligationReminderEmail(
  o: { title: string; dueDate: Date; description?: string | null; id: string },
  ownerName: string,
  daysLeft: number,
): Email {
  const when = daysLeft <= 0 ? 'is overdue' : daysLeft === 1 ? 'is due tomorrow' : `is due in ${daysLeft} days`
  return {
    template: 'compliance.reminder',
    subject: `${o.title} ${when}`,
    html: layout({
      preheader: `Due ${day(o.dueDate)}.`,
      heading: `${o.title} ${when}`,
      body: [
        p(`${esc(ownerName)}, this is on the statutory calendar with your name against it, due <strong>${day(o.dueDate)}</strong>.`),
        o.description ? muted(esc(o.description)) : '',
        button('Open it in the compliance portal', url(`/compliance/calendar?item=${o.id}`)),
        muted('Mark it done and attach the proof there, and the reminders stop.'),
      ].join(''),
    }),
  }
}

export function fundraiserReviewedEmail(
  f: { title: string; slug: string },
  firstName: string,
  status: 'live' | 'changes' | 'rejected',
  note?: string,
): Email {
  const heading =
    status === 'live' ? 'Your fundraiser is live' : status === 'changes' ? 'A few changes to your fundraiser' : 'About your fundraiser'
  return {
    template: `fundraiser.${status}`,
    /* the title is the fundraiser's own words; the subject stays ours */
    subject: heading,
    html: layout({
      heading: status === 'live' ? `It is live, ${firstName}` : heading,
      body: [
        status === 'live'
          ? p(`<strong>${esc(f.title)}</strong> has been approved and is now public. Share the link with everyone you know — every donation through it counts towards the appeal.`)
          : status === 'changes'
            ? p(`Thank you for starting <strong>${esc(f.title)}</strong>. Before it goes public, the team has asked for a few changes.`)
            : p(`Thank you for starting <strong>${esc(f.title)}</strong>. We are not able to publish it as it stands.`),
        note ? callout(esc(note)) : '',
        status === 'live'
          ? button('Open my fundraiser', url(`/fundraisers/${f.slug}`), 'gold')
          : button('Edit my fundraiser', url('/account/fundraisers')),
      ].join(''),
    }),
  }
}

export function enquiryReplyEmail(name: string, _subject: string, body: string, staffName: string): Email {
  return {
    template: 'enquiry.reply',
    /* the enquiry's subject was typed by whoever filled in the form, about
       any address; echoing it made the reply a way to put words of their
       choosing in an Al-Anwaar subject line. It stays in the thread. */
    subject: 'Re: your message to Al-Anwaar',
    html: layout({
      heading: `Hello ${name}`,
      body: renderLightMarkdown(body) + muted(`— ${esc(staffName)}, Al-Anwaar`),
    }),
  }
}

/* ---------------------------------------------------------------------------
   CAMPAIGNS: MERGE FIELDS GO IN LAST

   A donor's name is whatever was typed into a checkout or a bank pledge —
   by anyone, about any address. It used to be pasted into the campaign body
   before the markdown was rendered, so a "first name" of
   `[Your receipt](https://evil.example)` came out of the renderer as a real
   link, in a genuine Al-Anwaar email, to a real donor. Now the body is
   rendered with placeholders standing in for the fields, and the escaped
   names are put back afterwards, where they can only ever be text. In the
   subject the names are reduced to plain words (no brackets, no URLs), since
   a subject has no escaping to lean on.
--------------------------------------------------------------------------- */

const FIRST = '\u0000FIRST\u0000'
const LAST = '\u0000LAST\u0000'
const mergeMarkers = (s: string) => s.replace(/\{\{\s*firstName\s*\}\}/g, FIRST).replace(/\{\{\s*lastName\s*\}\}/g, LAST)
/** a name as it may appear in a subject line: letters, marks, spaces and the
 *  punctuation names actually use, nothing that could read as a link */
export const plainName = (s: string) =>
  s.replace(/https?:\/\/\S*/gi, '').replace(/[^\p{L}\p{M}\p{N}' .-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 60)

export function campaignEmail(
  c: { subject: string; preheader?: string | null; body: string },
  donor: { firstName: string; lastName: string },
  unsubscribe: string | { pageUrl: string; headers: Record<string, string> },
): Email {
  const first = plainName(donor.firstName)
  const last = plainName(donor.lastName)
  const subject = mergeMarkers(c.subject).replaceAll(FIRST, first).replaceAll(LAST, last).trim()
  const body = renderLightMarkdown(mergeMarkers(c.body)).replaceAll(FIRST, esc(donor.firstName)).replaceAll(LAST, esc(donor.lastName))
  const links = typeof unsubscribe === 'string' ? { pageUrl: unsubscribe, headers: undefined } : unsubscribe
  return {
    template: 'campaign',
    subject,
    html: layout({
      preheader: c.preheader ?? undefined,
      heading: subject,
      body,
      unsubscribeUrl: links.pageUrl,
    }),
    headers: links.headers,
  }
}
