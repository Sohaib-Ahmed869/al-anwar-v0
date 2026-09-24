import { DESIGNATIONS, FREQUENCIES, METHODS, fyLabel, type Designation, type Frequency, type Method } from '../../shared/domain'
import { formatMoney } from '../../shared/money'
import type { Settings } from '../../shared/types'
import { button, callout, esc, facts, layout, muted, p, renderLightMarkdown, url } from './layout'

/* ---------------------------------------------------------------------------
   Every email the platform sends, one function each. Each returns
   { subject, html, preheader } and nothing else — sending, logging and the
   outbox are lib/email.ts's job.

   The receipt is the one with rules: it must carry the organisation's name,
   ABN, the DGR statement, the amount, the date and a unique number, and say
   that nothing was given in return. The wording is checked in week five
   before the first live donation.
--------------------------------------------------------------------------- */

export type Email = { subject: string; html: string; template: string }

const day = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

type ReceiptGift = {
  number: string
  amount: number
  fee: number
  designation: Designation
  method: Method
  date: Date | string
  appealTitle?: string | null
  fundraiserTitle?: string | null
  receipt?: { number?: string | null } | null
}

export function receiptEmail(g: ReceiptGift, firstName: string, s: Settings, opts: { resend?: boolean } = {}): Email {
  const total = g.amount + (g.fee || 0)
  const rows: [string, string][] = [
    ['Receipt number', esc(g.receipt?.number ?? '')],
    ['Date received', day(g.date)],
    ['Given to', esc(g.fundraiserTitle ? `${g.appealTitle} · via ${g.fundraiserTitle}` : g.appealTitle ?? 'Where most needed')],
    ['Given as', esc(DESIGNATIONS[g.designation].label)],
    ['Paid by', esc(METHODS[g.method].label)],
  ]
  if (g.fee) rows.push(['Fees you covered', formatMoney(g.fee, { exact: true })])
  return {
    template: 'receipt',
    subject: `${opts.resend ? 'Your receipt, again' : 'Thank you'} — receipt ${g.receipt?.number ?? ''}`,
    html: layout({
      preheader: `${formatMoney(total, { exact: true })} received. Your tax receipt is inside.`,
      heading: opts.resend ? 'Your receipt' : `Thank you, ${firstName}`,
      body: [
        opts.resend ? '' : p('Your gift has arrived. May Allah accept it from you and put barakah in what remains.'),
        facts(rows, ['Total', formatMoney(total, { exact: true })]),
        callout(
          `<strong>Tax receipt.</strong> ${esc(s.org.name)}, ABN ${esc(s.org.abn)}. ${esc(s.org.dgrNote)} ${esc(s.receipts.footer)}`,
        ),
        muted(`Every gift you give is in your account, with every receipt and your end-of-year tax statement.`),
        button('See your giving', url('/account/giving')),
      ].join(''),
      footerNote: `Keep this email for your tax records. ${esc(s.receipts.signatoryTitle)}.`,
    }),
  }
}

export function otpEmail(code: string): Email {
  return {
    template: 'otp',
    subject: `${code} is your Al-Anwaar sign-in code`,
    html: layout({
      preheader: `Your code is ${code}. It works for 10 minutes.`,
      heading: 'Your sign-in code',
      body: [
        p('Enter this code to open your account. It works for the next 10 minutes.'),
        `<div style="margin:6px 0 22px;font:600 34px/1 'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:.3em;color:#191C1B;">${esc(code)}</div>`,
        muted('If you did not ask for this, you can ignore it — nobody can get in without the code.'),
      ].join(''),
    }),
  }
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
    subject: `Your ${FREQUENCIES[pl.frequency].label.toLowerCase()} gift of ${formatMoney(pl.amount)} goes out on ${when}`,
    html: layout({
      preheader: `A heads-up, so nothing is a surprise.`,
      heading: `A heads-up, ${firstName}`,
      body: [
        p(`Your ${FREQUENCIES[pl.frequency].label.toLowerCase()} gift to <strong>${esc(pl.appealTitle ?? 'Al-Anwaar')}</strong> will be taken on <strong>${when}</strong>.`),
        facts([
          ['Amount', formatMoney(pl.amount, { exact: true })],
          ['From', cardLine(pl)],
          ...(pl.kind === 'instalment' && pl.instalments?.total
            ? ([['Payment', `${(pl.instalments.paid ?? 0) + 1} of ${pl.instalments.total}`]] as [string, string][])
            : []),
        ]),
        muted('Want to change the amount, pause for a while or use another card? You can do it yourself, any time.'),
        button('Manage this gift', url('/account/plans')),
      ].join(''),
    }),
  }
}

export function paymentFailedEmail(pl: PlanLike, firstName: string, reason: string, finalAttempt: boolean, planId: string): Email {
  return {
    template: 'plan.failed',
    subject: finalAttempt ? 'Your regular gift has stopped' : 'Your regular gift did not go through',
    html: layout({
      preheader: 'It only takes a minute to fix.',
      heading: finalAttempt ? `Your regular gift has stopped, ${firstName}` : `We could not take your gift, ${firstName}`,
      body: [
        p(
          finalAttempt
            ? `We tried a few times to take your ${formatMoney(pl.amount)} gift to <strong>${esc(pl.appealTitle ?? 'Al-Anwaar')}</strong> from ${cardLine(pl)}, and each attempt was declined, so we have paused it rather than keep trying.`
            : `Your ${formatMoney(pl.amount)} gift to <strong>${esc(pl.appealTitle ?? 'Al-Anwaar')}</strong> was declined by your bank. We will try again in a few days.`,
        ),
        callout(`The bank said: ${esc(reason)}`, 'alert'),
        p('Most of the time a card has simply expired or been replaced. Updating it takes a minute, and the gift carries on from there.'),
        button('Update my card', url(`/account/plans?fix=${planId}`), 'gold'),
      ].join(''),
    }),
  }
}

export function planChangedEmail(pl: PlanLike, firstName: string, what: string): Email {
  return {
    template: 'plan.changed',
    subject: `Your regular gift: ${what.toLowerCase()}`,
    html: layout({
      preheader: what,
      heading: `${what}`,
      body: [
        p(`Assalamu alaykum ${esc(firstName)}, this confirms the change you just made to your gift to <strong>${esc(pl.appealTitle ?? 'Al-Anwaar')}</strong>.`),
        facts([
          ['Amount', `${formatMoney(pl.amount, { exact: true })} ${FREQUENCIES[pl.frequency].per}`],
          ['Next payment', pl.nextChargeAt ? day(pl.nextChargeAt) : '—'],
          ['Paying with', cardLine(pl)],
        ]),
        muted('If this was not you, reply to this email and we will look into it straight away.'),
        button('See your regular gifts', url('/account/plans')),
      ].join(''),
    }),
  }
}

export function taxStatementEmail(firstName: string, fy: number, total: number, count: number): Email {
  return {
    template: 'tax.statement',
    subject: `Your ${fyLabel(fy)} tax statement`,
    html: layout({
      preheader: `${formatMoney(total, { exact: true })} across ${count} gifts.`,
      heading: `Your ${fyLabel(fy)} tax statement`,
      body: [
        p(`Assalamu alaykum ${esc(firstName)}. Here is everything you gave between 1 July ${fy - 1} and 30 June ${fy}, in one place for your tax return.`),
        facts([['Gifts', String(count)]], ['Tax deductible total', formatMoney(total, { exact: true })]),
        button('Open your statement', url(`/account/statement/${fy}`)),
        muted('The statement lists every gift with its receipt number. Print it or save it as a PDF from the page.'),
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
      preheader: `Use ${g.reference} as the reference so we can find your gift.`,
      heading: `Thank you, ${firstName}`,
      body: [
        p(`Here are the details for your ${formatMoney(g.amount)} gift to <strong>${esc(g.appealTitle ?? 'Al-Anwaar')}</strong>. Please use the reference exactly — it is how we match the money to you.`),
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

export function staffInviteEmail(name: string, inviter: string, link: string): Email {
  return {
    template: 'staff.invite',
    subject: `${inviter} added you to the Al-Anwaar admin portal`,
    html: layout({
      preheader: 'Set a password to get started.',
      heading: `Welcome, ${name}`,
      body: [
        p(`${esc(inviter)} has given you a login to the Al-Anwaar admin portal. Choose a password to finish setting it up.`),
        button('Set my password', link),
        muted('The link works for 7 days. If you were not expecting this, you can ignore it.'),
      ].join(''),
    }),
  }
}

export function passwordResetEmail(name: string, link: string): Email {
  return {
    template: 'staff.reset',
    subject: 'Reset your Al-Anwaar password',
    html: layout({
      preheader: 'The link works for one hour.',
      heading: `Reset your password, ${name}`,
      body: [
        p('Someone — hopefully you — asked to reset the password for this account.'),
        button('Choose a new password', link),
        muted('The link works for one hour. If you did not ask for this, your password has not changed.'),
      ].join(''),
    }),
  }
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
    subject: `${heading}: ${f.title}`,
    html: layout({
      heading: status === 'live' ? `It is live, ${firstName}` : heading,
      body: [
        status === 'live'
          ? p(`<strong>${esc(f.title)}</strong> has been approved and is now public. Share the link with everyone you know — every gift through it counts towards the appeal.`)
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

export function enquiryReplyEmail(name: string, subject: string, body: string, staffName: string): Email {
  return {
    template: 'enquiry.reply',
    subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
    html: layout({
      heading: `Hello ${name}`,
      body: renderLightMarkdown(body) + muted(`— ${esc(staffName)}, Al-Anwaar`),
    }),
  }
}

export function campaignEmail(
  c: { subject: string; preheader?: string | null; body: string },
  donor: { firstName: string; lastName: string },
  unsubscribeUrl: string,
): Email {
  const merged = c.body.replace(/\{\{\s*firstName\s*\}\}/g, donor.firstName).replace(/\{\{\s*lastName\s*\}\}/g, donor.lastName)
  const subject = c.subject.replace(/\{\{\s*firstName\s*\}\}/g, donor.firstName)
  return {
    template: 'campaign',
    subject,
    html: layout({
      preheader: c.preheader ?? undefined,
      heading: subject,
      body: renderLightMarkdown(merged),
      unsubscribeUrl,
    }),
  }
}
