import { formatMoney } from '../../shared/money'
import { button, callout, esc, layout, muted, p, url } from './layout'
import { REDACTED, type Email } from './templates'

/* ---------------------------------------------------------------------------
   Emails about giving that came with the production hardening (October
   2026). They sit beside templates.ts rather than in it, and follow its rules:
   each returns an Email and nothing else, and one that carries a secret (here,
   the opt-in link) also carries `logged`, the copy the email log keeps.

   NOTHING A STRANGER TYPED GOES IN A SUBJECT. A public form can name any
   address as its own, so whatever it sends must not be a channel for someone
   else's words (finding M10): subjects here are fixed text, and anything the
   visitor wrote appears only in the body, escaped.
--------------------------------------------------------------------------- */

/** A receipt for a gift taken while no payment provider was connected. It
 *  keeps the real layout, so the flow can be checked end to end, and says on
 *  every surface that no money moved and it is not a tax receipt (finding C2):
 *  the subject, a banner above the heading, and the SIM- number itself. */
export function markTestReceipt(email: Email): Email {
  const banner = callout(
    '<strong>Test receipt — no money was taken.</strong> This donation was made while online payments were in test mode. ' +
      'It is not a tax receipt and cannot be used for a tax return.',
    'alert',
  )
  const mark = (html: string) => html.replace('<h1 ', `${banner}<h1 `)
  return {
    ...email,
    template: `${email.template}.test`,
    subject: `TEST, not a tax receipt — ${email.subject}`,
    html: mark(email.html),
    logged: email.logged ? { subject: `TEST — ${email.logged.subject}`, html: mark(email.logged.html) } : undefined,
  }
}

/** The double opt-in: one link, and nothing else changes until it is used. */
export function optInConfirmEmail(link: string, source: 'letter' | 'checkout'): Email {
  const body = (href: string) =>
    [
      p(
        source === 'letter'
          ? 'Someone, we hope you, asked for Al-Anwaar’s monthly letter to come to this address: once a month, what your giving did.'
          : 'When you gave, you asked to hear from Al-Anwaar about the work your donation supports.',
      ),
      p('Please confirm it is your address and you would like these emails. Nothing is sent until you do.'),
      button('Yes, send me the letter', href),
      muted('If this was not you, ignore this email. The link stops working in 7 days and you will not hear from us again.'),
    ].join('')
  const html = (href: string) => layout({ preheader: 'One click to confirm.', heading: 'Confirm your email', body: body(href) })
  return {
    template: 'optin.confirm',
    subject: 'Please confirm your email address',
    html: html(link),
    logged: { subject: 'Please confirm your email address', html: html(`${url('/letter/confirm')}?t=${REDACTED}`) },
  }
}

/** The first email about a fundraiser started from the public form while
 *  signed out: confirm the address before anything else happens. Every word is
 *  ours — not the title, not the name typed — because until the link is used we
 *  do not know the person who typed them owns this inbox, and an email that
 *  carried their words would make the form a way to send charity-branded mail
 *  to anyone (finding M10). The log keeps a copy without the token. */
export function fundraiserConfirmEmail(link: string): Email {
  const html = (href: string) =>
    layout({
      preheader: 'One click, then our team reads it.',
      heading: 'Confirm your fundraiser',
      body: [
        p('Someone, we hope you, started a fundraising page for Al-Anwaar and gave this email address as the organiser’s.'),
        p('Please confirm it is your address. The page then goes to our team, who read every page before it goes public. Nothing happens until you confirm.'),
        button('Yes, this is my fundraiser', href),
        muted('If this was not you, ignore this email: the page is deleted in 7 days and you will not hear from us about it again.'),
      ].join(''),
    })
  return {
    template: 'fundraiser.confirm',
    subject: 'Please confirm your fundraiser',
    html: html(link),
    logged: { subject: 'Please confirm your fundraiser', html: html(`${url('/fundraisers/confirm')}?t=${REDACTED}`) },
  }
}

/** To the organiser of a fundraiser once we know the address is theirs: just
 *  confirmed, or started while signed in. The title they chose is in the body
 *  only, escaped; the subject is fixed. */
export function fundraiserReceivedEmail(firstName: string, title: string, appealTitle: string): Email {
  return {
    template: 'fundraiser-received',
    subject: 'We have your fundraiser',
    html: layout({
      heading: 'Your fundraiser is with us',
      body: [
        p(`Assalamu alaikum ${esc(firstName)}, thank you for starting <strong>${esc(title)}</strong> for ${esc(appealTitle)}.`),
        p('Someone from our team reads every page before it goes public, usually within two working days. We will email you the moment it is live, with the link to share.'),
        p('Until then you can see it, and change the words, the goal or the end date, from your account. Sign in with this email address and we will send you a code.'),
        button('Open my fundraisers', url('/account/fundraisers')),
        muted('If you did not start this fundraiser, reply to this email and we will take it down.'),
      ].join(''),
    }),
  }
}

/** A refund recorded by the office or reported by Stripe (finding L10): the
 *  donor hears it from us, and knows the receipt no longer counts. */
export function refundEmail(
  firstName: string,
  g: { number: string; amount: number; fee?: number | null; receiptNumber?: string | null; planNumber?: string | null },
): Email {
  const total = g.amount + (g.fee ?? 0)
  return {
    template: 'gift.refund',
    subject: 'Your donation has been refunded',
    html: layout({
      heading: `Your refund, ${firstName}`,
      body: [
        p(`We have refunded your donation <strong>${esc(g.number)}</strong> of ${formatMoney(total, { exact: true })}. It goes back to the card or account it came from, usually within 5 to 10 working days.`),
        g.receiptNumber ? p(`Receipt ${esc(g.receiptNumber)} is cancelled and will not appear on your tax statement.`) : '',
        g.planNumber ? muted(`This was one payment on your regular donation ${esc(g.planNumber)}. The regular donation itself carries on unless you have asked us to stop it.`) : '',
        muted('If you did not expect this, reply to this email and we will look into it.'),
        button('See your donations', url('/account/giving')),
      ].join(''),
    }),
  }
}
