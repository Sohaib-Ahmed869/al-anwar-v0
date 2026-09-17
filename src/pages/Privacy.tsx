import { Link } from 'react-router-dom'

import LegalHero from '../sections/LegalHero'
import LegalBody, { type LegalSection } from '../sections/LegalBody'
import { ORG, LEGAL_UPDATED } from '../components/org-data'

/* ---------------------------------------------------------------------------
   Privacy policy. Hero, the clauses, and the footer the layout already gives
   every page.

   Written against the Australian Privacy Principles under the Privacy Act 1988
   (Cth), in the same plain voice as the rest of the site: what we take, why we
   take it, and how to get it back.

   REWRITTEN 17 SEPTEMBER 2026 against what the site actually runs, at the
   user's request. The first draft was generic and promised things the site
   does not do (analytics, event registration, volunteer sign-ups, postal
   addresses on a gift). Every clause now matches the code:

     giving        GiveForm / GiveModule: first and last name, email, amount,
                   fund, one-time or monthly, the fee tick, an optional name
                   given on behalf of, and the "send me word" tick. Paid on
                   Stripe's or PayPal's hosted page (services/give.ts), monthly
                   by Stripe only. Bank details are on the page for transfers.
     contact       ContactForm: name, email, optional phone, topic, message,
                   consent (services/contact.ts).
     the letter    Letter.tsx in the footer: an email address only.
     browser       one localStorage item, the emergency banner dismissal, kept
                   seven days (Header.tsx). No cookies, no analytics.
     third parties Google Fonts from index.html on every page; the OpenStreetMap
                   preview in the footer, mounted on hover only; Facebook and
                   Instagram embeds on Get involved, mounted on a button press
                   only (social-data.ts).

   If any of those changes, the clause that describes it changes with it.
   Adding analytics, a pixel, a chat widget or a video embed is a change to
   this page before it is a change to the site.

   TODO before launch:
     - have a solicitor read this against the systems we actually run;
     - name the email provider and the host in clause 7 once they are chosen
       (api/contact.ts and api/letter.ts have none yet);
     - consider self-hosting the fonts, which would take Google out of clause 6;
     - set LEGAL_UPDATED in components/org-data.ts to the sign-off date.
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
          It covers this website and everything you can do on it: giving once or monthly, paying by
          bank transfer, writing to us through the contact form, and joining our email letter. It
          also covers what you tell us by email or on the phone. We are bound by the Privacy Act
          1988 (Cth) and the thirteen Australian Privacy Principles, and this is how we meet them.
        </p>
      </>
    ),
  },
  {
    id: 'what-we-collect',
    title: 'What we collect',
    body: (
      <>
        <p>Only what each form needs, and nothing it does not ask for on the screen.</p>
        <ul>
          <li>
            <strong>When you give.</strong> Your first and last name, your email address, the
            amount, the fund or appeal, whether it is one-time or monthly, and whether you chose to
            cover the card fee. If you give on behalf of someone else, the name you type for them.
            If you tick the box for news of the fund, that choice too.
          </li>
          <li>
            <strong>When you write to us.</strong> Your name, your email address, a phone number if
            you add one, the topic you chose and your message. We also record that you agreed to a
            reply.
          </li>
          <li>
            <strong>When you join the letter.</strong> Your email address. Nothing else.
          </li>
          <li>
            <strong>When you pay by bank transfer.</strong> What your bank sends with the money:
            the account name and the reference you typed.
          </li>
          <li>
            <strong>While you browse.</strong> We run no analytics and no tracking. Like every
            website, the server that delivers these pages keeps short technical logs of requests,
            which include your IP address and browser.
          </li>
        </ul>
        <p>
          We never ask for your card number, your date of birth or your postal address on this site.
          One thing is worth naming plainly: choosing a zakat gift says something about your faith,
          and the law treats that as sensitive information. We use it for one purpose only, which is
          applying your gift correctly.
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
          <li>To take your gift, apply it to the fund you chose, and send your tax receipt.</li>
          <li>To run a monthly gift, and to tell you if a payment fails.</li>
          <li>To answer your message, by email or by phone if you gave us a number.</li>
          <li>To send the letter and fund news, only if you asked for them.</li>
          <li>
            To meet obligations we cannot opt out of: records for the ATO, reporting to the ACNC,
            and our annual audit.
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
    id: 'paying',
    title: 'Paying: Stripe, PayPal and bank transfer',
    body: (
      <>
        <p>
          Your card never reaches our site. When you press give, you are taken to a secure payment
          page run by <strong>Stripe</strong> (card, Apple Pay and Google Pay) or by{' '}
          <strong>PayPal</strong>, and you come back to us when it is done. Both are certified to
          the PCI DSS standard. Monthly gifts are held by Stripe, and you can end one at any time by
          writing to us.
        </p>
        <p>
          What comes back to us is a record of the payment: your name, email, the amount, whether it
          went through, and for a card the brand and last four digits, so we can find a gift when you
          ask about it. On their pages Stripe and PayPal handle your details under their own privacy
          policies, at{' '}
          <a href="https://stripe.com/au/privacy" target="_blank" rel="noreferrer">
            stripe.com/au/privacy
          </a>{' '}
          and{' '}
          <a href="https://www.paypal.com/au/legalhub/privacy-full" target="_blank" rel="noreferrer">
            paypal.com
          </a>
          .
        </p>
        <p>
          If you would rather we did not see your account name at all, give by card instead of bank
          transfer.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and your browser',
    body: (
      <>
        <p>
          This site sets <strong>no cookies</strong> of its own, and runs no analytics, advertising
          pixels or trackers.
        </p>
        <p>
          It keeps one small note in your browser&rsquo;s own storage: if you close the emergency
          appeal banner, it remembers that for seven days so the banner stays closed. That note is
          never sent to us, and clearing your browser data removes it.
        </p>
        <p>
          Stripe and PayPal set their own cookies on their payment pages, which they need to process
          a payment safely and to prevent fraud.
        </p>
      </>
    ),
  },
  {
    id: 'other-services',
    title: 'Other services the site loads',
    body: (
      <>
        <p>
          A few parts of the site come from other companies. When your browser fetches them, that
          company sees your IP address, like any site you visit. Here is every one:
        </p>
        <ul>
          <li>
            <strong>Google Fonts.</strong> The typefaces on every page are loaded from Google.
          </li>
          <li>
            <strong>OpenStreetMap.</strong> The small map in the footer loads only when you point at
            our address, not before.
          </li>
          <li>
            <strong>Facebook and Instagram.</strong> The posts on the{' '}
            <Link to="/get-involved">Get involved</Link> page load only after you press the button
            to show them. Once they load, Meta may set its own cookies, under its own policy.
          </li>
          <li>
            <strong>Links out.</strong> Our social accounts and the directions link open on those
            sites, which have their own privacy policies.
          </li>
        </ul>
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
            <strong>Suppliers doing one job for us.</strong> Stripe and PayPal for payments, the
            company that hosts this website, our email provider, our accountant and our auditor.
            Each may use your details for that job and nothing else.
          </li>
          <li>
            <strong>Regulators, where the law requires it.</strong> The ACNC, the ATO, or a court
            order we have to obey.
          </li>
        </ul>
        <p>
          Our partners overseas receive money and instructions. They never receive donor details.
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
          Some of the services above store data outside Australia, mainly in the United States and
          the European Union. Stripe, PayPal, Google and Meta all do. Before we use a supplier we
          check it protects your information to a standard comparable to the Australian Privacy
          Principles, which is what APP 8 asks of us.
        </p>
        <ul>
          <li>
            <strong>Gift and receipt records:</strong> seven years, because tax and charity law
            says seven years.
          </li>
          <li>
            <strong>Messages to us:</strong> two years after the conversation ends.
          </li>
          <li>
            <strong>The letter and fund news:</strong> until you unsubscribe, then removed at the
            next clean-up.
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
    id: 'your-rights',
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
            <strong>Stop the email.</strong> Every letter carries an unsubscribe link, or write to
            us and we will do it by hand.
          </li>
          <li>
            <strong>Delete it.</strong> We delete what we are allowed to. Gift records we must keep
            for seven years, so we can take you off every list but cannot unmake a receipt.
          </li>
          <li>
            <strong>Stay anonymous.</strong> You can give by bank transfer without telling us who you
            are. We cannot send a tax receipt for a gift with no name on it.
          </li>
        </ul>
        <p>
          Ask by email at <a href={`mailto:${ORG.email}`}>{ORG.email}</a>, marked for the Privacy
          Officer, or by post to the address at the end of this page. We may need to check who you
          are before we hand anything over.
        </p>
      </>
    ),
  },
  {
    id: 'if-something-goes-wrong',
    title: 'If something goes wrong',
    body: (
      <p>
        If your information is lost or taken and that is likely to cause you serious harm, the
        Notifiable Data Breaches scheme requires us to tell you and the Office of the Australian
        Information Commissioner. We will tell you what happened, what it means for you and what to
        do about it, as soon as we know.
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
          you an answer in writing within 30 days.
        </p>
        <p>
          If that answer does not satisfy you, take it to the Office of the Australian Information
          Commissioner at{' '}
          <a href="https://www.oaic.gov.au" target="_blank" rel="noreferrer">
            oaic.gov.au
          </a>{' '}
          or on <span className="nums">1300 363 992</span>. You do not need our permission and it
          costs you nothing.
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
          When this policy changes we update the date at the top of this page. If a change alters
          what we do with your details, we will tell you by email rather than hope you re-read the
          page.
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

/** The email in the hero, set for the dark band rather than for the prose. */
const HERO_LINK =
  'underline decoration-paper/35 underline-offset-4 transition-colors duration-200 hover:text-gold-pale hover:decoration-gold-pale'

export default function Privacy() {
  return (
    <div>
      {/* The photograph: a hand writing in a spiral notebook, close and shallow,
          the page itself unreadable. Licence and credit are in LegalHero. */}
      <LegalHero
        eyebrow="Privacy policy"
        title="Your details,"
        titleMark="kept to a minimum."
        summary="What we collect when you give or write to us, who else sees it, and how to get it back. The short version: no trackers, your card never reaches our site, and we have never sold a donor's details."
        image="privacy"
        position="58% 58%"
        facts={[
          { label: 'Last updated', value: LEGAL_UPDATED, nums: true },
          { label: 'Cookies we set', value: 'None' },
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
