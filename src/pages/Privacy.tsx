import LegalHero from '../sections/LegalHero'
import LegalBody, { type LegalSection } from '../sections/LegalBody'
import { ORG, LEGAL_UPDATED } from '../components/org-data'

/* ---------------------------------------------------------------------------
   Privacy policy. Hero, the clauses, and the footer the layout already gives
   every page.

   Written against the Australian Privacy Principles under the Privacy Act 1988
   (Cth), in the same plain voice as the rest of the site: what we take, why we
   take it, and how to get it back.

   TODO before launch, all four:
     - have a solicitor read this against the systems we actually run;
     - name the payment provider in clause 4 and the email provider in clause 6;
     - set LEGAL_UPDATED in components/org-data.ts to the sign-off date;
     - the ABN is still a placeholder, here and everywhere else on the site.
--------------------------------------------------------------------------- */

const SECTIONS: LegalSection[] = [
  {
    id: 'who-this-covers',
    title: 'Who this covers',
    body: (
      <>
        <p>
          This policy is <strong>{ORG.name}</strong> (ABN <span className="nums">{ORG.abn}</span>),
          a charity registered with the Australian Charities and Not-for-profits Commission. Where
          this page says <strong>we</strong> or <strong>us</strong>, that is who it means.
        </p>
        <p>
          It covers everything we do with personal information: this website, online donations,
          monthly giving, bank transfers, event registrations, volunteer sign-ups and our email
          updates. We are bound by the Privacy Act 1988 (Cth) and the thirteen Australian Privacy
          Principles, and this is how we meet them.
        </p>
      </>
    ),
  },
  {
    id: 'what-we-collect',
    title: 'What we collect',
    body: (
      <>
        <p>Only what the job needs. In practice that is:</p>
        <ul>
          <li>
            <strong>When you give.</strong> Your name, your email address, and the amount, date,
            frequency and appeal of your gift. A postal address and phone number if you give them
            to us. We ask for those so a receipt can be re-sent and a question can be answered
            by a person.
          </li>
          <li>
            <strong>When you volunteer or come to an event.</strong> Your contact details, an
            emergency contact, any dietary or access needs you tell us about, and, for the roles
            that legally require it, a Working with Children Check number.
          </li>
          <li>
            <strong>When you pay by card.</strong> The card brand, the last four digits, and a
            token from our payment provider. Never the full number, never the security code. Clause
            4 explains why.
          </li>
          <li>
            <strong>When you write to us.</strong> Whatever is in the message, and our reply.
          </li>
          <li>
            <strong>While you browse.</strong> Your IP address and the rough location it implies,
            your browser and device, the pages you looked at, and the site you arrived from.
          </li>
        </ul>
        <p>
          We do not ask for sensitive information. One thing is worth naming plainly: choosing a
          zakat gift tells us something about your faith, and the law treats that as sensitive
          information. We use it for exactly one purpose, which is applying your gift correctly,
          and clause 6 lists everyone who can see it.
        </p>
      </>
    ),
  },
  {
    id: 'why-we-collect-it',
    title: 'Why we collect it',
    body: (
      <>
        <ul>
          <li>To take your donation, apply it to the appeal you chose, and issue your receipt.</li>
          <li>To run a monthly gift, and to tell you when a payment fails.</li>
          <li>To send you what you asked for: field reports, appeal updates, event details.</li>
          <li>
            To meet obligations we cannot opt out of: records for the ATO, reporting to the ACNC,
            and our annual audit.
          </li>
          <li>
            To see which appeals people respond to, so we stop spending donated money asking the
            wrong people for the wrong thing.
          </li>
        </ul>
        <p>
          We do not make automated decisions about you, and we do not build a profile of you to
          score, rank or sell.
        </p>
      </>
    ),
  },
  {
    id: 'card-and-bank-details',
    title: 'Card and bank details',
    body: (
      <>
        <p>
          Card details go from your browser straight to our payment provider over an encrypted
          connection. They do not pass through our servers and nobody here can see them. The
          provider is certified to the PCI-DSS standard and is the one holding your card for a
          monthly gift; what we hold is a token that lets us charge it and is worthless anywhere
          else.
        </p>
        <p>
          If you pay by bank transfer, we see what your bank sends with the money: the account name
          and whatever reference you typed. If you would rather we did not hold your account name,
          give by card.
        </p>
      </>
    ),
  },
  {
    id: 'cookies-and-analytics',
    title: 'Cookies and analytics',
    body: (
      <>
        <p>
          Some storage is what makes the site work at all: keeping your place in a donation, and
          remembering that you closed the emergency banner so it stays closed for a week. That last
          one lives in your own browser and is never sent to us.
        </p>
        <p>
          Past that, we measure how the site is used, counting pages, referrers and devices as
          totals rather than as people. We do not run advertising trackers, we do not sell audience data, and
          nothing we set follows you to another site. Refuse the non-essential cookies and
          everything here still works; your browser can block or clear the lot.
        </p>
      </>
    ),
  },
  {
    id: 'who-sees-it',
    title: 'Who sees it',
    body: (
      <>
        <p>A short list, and it is the whole list.</p>
        <ul>
          <li>
            <strong>The people who run the charity.</strong> Staff and volunteers, and only where
            the work actually requires it.
          </li>
          <li>
            <strong>Suppliers doing one job for us.</strong> Our payment provider, our email
            provider, our hosting, our accountant and our auditor. Each is bound by contract to use
            your details for that job and nothing else.
          </li>
          <li>
            <strong>Regulators, where the law requires it.</strong> The ACNC, the ATO, or a court
            order we have to obey.
          </li>
        </ul>
        <p>
          Our field partners overseas receive money and instructions. They do not receive donor
          lists.
        </p>
        <p>
          <strong>
            We have never sold, rented or traded a donor&rsquo;s details and we will not start. We
            do not swap donor lists with other charities.
          </strong>
        </p>
      </>
    ),
  },
  {
    id: 'where-it-lives',
    title: 'Where it lives, and for how long',
    body: (
      <>
        <p>
          We keep your details in Australia where we can. Some suppliers store data overseas,
          usually in the United States or the European Union; before we use one, we check it is
          bound to protections comparable to the Australian Privacy Principles, which is what APP 8
          requires of us.
        </p>
        <ul>
          <li>
            <strong>Donation and receipt records:</strong> seven years, because tax and charity law
            says seven years.
          </li>
          <li>
            <strong>Email subscriptions:</strong> until you unsubscribe, then removed at the next
            clean-up.
          </li>
          <li>
            <strong>Volunteer and event records:</strong> two years after your last involvement,
            unless the role requires longer.
          </li>
        </ul>
        <p>
          After that it is deleted, or stripped of everything that identifies you and kept only as a
          number inside a total.
        </p>
      </>
    ),
  },
  {
    id: 'what-you-can-ask-us',
    title: 'What you can ask us to do',
    body: (
      <>
        <ul>
          <li>
            <strong>See it.</strong> Ask for a copy of what we hold on you. It is free, and we
            answer within 30 days.
          </li>
          <li>
            <strong>Fix it.</strong> Tell us what is wrong and we correct it.
          </li>
          <li>
            <strong>Stop the email.</strong> Every email we send carries an unsubscribe link, or
            write to us and we will do it by hand.
          </li>
          <li>
            <strong>Delete it.</strong> We delete what we are allowed to delete. Donation records we
            must keep for seven years. We can take you out of every mailing, but we cannot unmake
            a receipt.
          </li>
          <li>
            <strong>Stay anonymous.</strong> You can give without telling us who you are. We cannot
            issue a tax receipt for a gift with no name on it, and that is the whole of the trade.
          </li>
        </ul>
        <p>
          Ask by email at <a href={`mailto:${ORG.email}`}>{ORG.email}</a>, marked for the Privacy
          Officer, or by post to the address in clause 11. We may need to check who you are before
          we hand anything over.
        </p>
      </>
    ),
  },
  {
    id: 'if-something-goes-wrong',
    title: 'If something goes wrong',
    body: (
      <p>
        If your information is lost or taken and we think that is likely to cause you serious harm,
        the Notifiable Data Breaches scheme requires us to tell you and the Office of the Australian
        Information Commissioner. We will tell you what happened, what it means for you, and what to
        do about it, as soon as we know rather than once the story is tidy.
      </p>
    ),
  },
  {
    id: 'complaints',
    title: 'If you are not happy with us',
    body: (
      <>
        <p>
          Write to <a href={`mailto:${ORG.email}`}>{ORG.email}</a> with &ldquo;Privacy
          complaint&rdquo; in the subject line. We acknowledge it within five business days and give
          you an answer within 30 days, in writing.
        </p>
        <p>
          If that answer does not satisfy you, take it to the Office of the Australian Information
          Commissioner, at{' '}
          <a href="https://www.oaic.gov.au" target="_blank" rel="noreferrer">
            oaic.gov.au
          </a>{' '}
          or <span className="nums">1300 363 992</span>. You do not need our permission and it costs
          you nothing.
        </p>
      </>
    ),
  },
  {
    id: 'contact',
    title: 'Changes, and how to reach us',
    body: (
      <>
        <p>
          When this policy changes we update the date at the top of this page. If a change actually
          alters what we do with your details, we will say so in an email rather than hope you
          re-read the page.
        </p>
        <p>
          Privacy Officer, {ORG.name}
          <br />
          {ORG.street}, {ORG.suburb}
          <br />
          <a href={`mailto:${ORG.email}`}>{ORG.email}</a>
        </p>
      </>
    ),
  },
]

/** The email in the hero, set for the photograph rather than for the prose. */
const HERO_LINK =
  'underline decoration-paper/30 underline-offset-4 transition-colors duration-200 hover:text-paper hover:decoration-current'

export default function Privacy() {
  return (
    <div>
      {/* The photograph: a hand writing in a spiral notebook, close and shallow,
          the page itself unreadable. Licence and credit are in LegalHero. */}
      <LegalHero
        eyebrow="Legal"
        title="Privacy policy"
        summary="What we collect when you give, why we collect it, and how to get it back. The short version: we ask for as little as we can, we never see your card number, and we have never sold a donor's details to anyone."
        image="privacy"
        position="58% 58%"
        facts={[
          { label: 'Last updated', value: LEGAL_UPDATED, nums: true },
          { label: 'Applies to', value: 'This site, and every gift made through it' },
          {
            label: 'Privacy Officer',
            value: (
              <a href={`mailto:${ORG.email}`} className={HERO_LINK}>
                {ORG.email}
              </a>
            ),
          },
        ]}
      />
      <LegalBody sections={SECTIONS} />
    </div>
  )
}
