import type { Email } from './templates'
import { callout, esc, layout, muted, p, url } from './layout'

/* ---------------------------------------------------------------------------
   Emails about the account itself, as opposed to giving.

   emailChangedEmail goes to the OLD address when a donor moves their sign-in
   to a new one. It is the only warning the owner of that mailbox gets if the
   change wasn't theirs, so it says plainly what happened and who to tell, and
   it carries nothing that could be used to undo or redo the change — no link
   that signs anyone in, no code.
--------------------------------------------------------------------------- */

const mask = (email: string) => {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 1)}${'•'.repeat(Math.max(2, Math.min(6, local.length - 1)))}@${domain}`
}

export function emailChangedEmail(firstName: string, newEmail: string): Email {
  return {
    template: 'account.email_changed',
    subject: 'Your Al-Anwaar sign-in email was changed',
    html: layout({
      preheader: 'This address no longer signs in to your account.',
      heading: `Your sign-in email was changed, ${firstName}`,
      body: [
        p(`The account that used this address now signs in with <strong>${esc(mask(newEmail))}</strong>. This address no longer opens it, though donations made with it are still recognised as yours.`),
        callout(`If you did not make this change, reply to this email or contact us at <a href="${url('/contact')}">${esc(url('/contact').replace(/^https?:\/\//, ''))}</a> straight away, and we will lock the account while we look into it.`, 'alert'),
        muted('If it was you, there is nothing more to do.'),
      ].join(''),
    }),
  }
}
