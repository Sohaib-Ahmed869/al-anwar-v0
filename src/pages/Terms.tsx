import { Link } from 'react-router-dom'
import LegalHero from '../sections/LegalHero'
import LegalBody, { type LegalSection } from '../sections/LegalBody'
import { ORG, LEGAL_UPDATED } from '../components/org-data'

/* ---------------------------------------------------------------------------
   Terms and conditions. Hero, the clauses, and the footer the layout already
   gives every page.

   The clauses that matter most to a donor come first (what happens to the
   money, when we will refund it, what a receipt is worth) and the boilerplate
   sits at the bottom where boilerplate belongs.

   REVISED 17 SEPTEMBER 2026 with the privacy policy, at the user's request,
   against what the site actually runs:
     - the events clause and every mention of event registration are gone
       (/events came off the site on 16 September);
     - a Paying clause names Stripe, PayPal and bank transfer;
     - monthly giving says what GiveForm and the give FAQ say: voluntary funds
       only, by card through Stripe, stopped by writing to us (/my-giving is
       not built, so nothing here may send people to it);
     - zakat matches the give FAQ: none of it pays for running the charity;
     - fundraising in our name matches Get involved, which invites it;
     - the other services are named, and point at the privacy policy.
   The hero is the shared LegalHero, on the Contact pattern.

   TODO before launch:
     - have a solicitor read this, in particular clauses 8 (surplus), 10
       (refunds) and 14 (liability);
     - confirm clause 7 against the board's actual zakat policy;
     - confirm the refund window in clause 10 and the notice period in
       clause 6 with whoever answers the email;
     - set LEGAL_UPDATED in components/org-data.ts to the sign-off date.
--------------------------------------------------------------------------- */

const SECTIONS: LegalSection[] = [
  {
    id: 'these-terms',
    title: 'These terms',
    body: (
      <p>
        By using this site or giving through it, you accept these terms. If you do not accept them,
        please do not use the site. Read them with our <Link to="/privacy">privacy policy</Link>,
        which covers what we do with your details.
      </p>
    ),
  },
  {
    id: 'who-we-are',
    title: 'Who we are',
    body: (
      <>
        <p>
          <strong>{ORG.name}</strong>, ABN <span className="nums">{ORG.abn}</span>, a charity
          registered with the Australian Charities and Not-for-profits Commission and endorsed as a
          deductible gift recipient, item 1.
        </p>
        <p>
          {ORG.street}, {ORG.suburb}
          <br />
          <a href={`mailto:${ORG.email}`}>{ORG.email}</a>
        </p>
      </>
    ),
  },
  {
    id: 'using-this-site',
    title: 'Using this site',
    body: (
      <>
        <p>
          Use it for what it is for. Do not try to break it, overload it, scrape it, get into a part
          of it that is not yours, or use it to send anything unlawful, misleading or abusive. Do
          not impersonate a donor or a member of our team. We can block anyone doing any of that.
        </p>
        <p>
          We work to keep the site up, accurate and current, but we do not promise it will never be
          down or never be wrong. Appeal totals and delivery figures are the best numbers we have on
          the day they are published, and they move.
        </p>
      </>
    ),
  },
  {
    id: 'donations',
    title: 'Donations',
    body: (
      <>
        <ul>
          <li>
            All amounts are in <strong>Australian dollars</strong>. Donations are not subject to
            GST.
          </li>
          <li>
            By giving, you confirm the money is yours to give and that you are allowed to use the
            payment method.
          </li>
          <li>
            A donation is given freely. You get nothing in return for it, which is what makes it tax
            deductible.
          </li>
          <li>
            The smallest donation that can carry a deductible receipt is{' '}
            <span className="nums">$2</span>.
          </li>
          <li>
            We can decline or return a donation. We do that rarely, and only where accepting it
            would put the charity or its work at risk.
          </li>
        </ul>
        <p>
          Your donation goes to the fund or appeal you chose, minus the card or PayPal fee unless you
          ticked the box to cover it. What happens after that is set out on{' '}
          <Link to="/where-it-goes">Where it goes</Link>.
        </p>
      </>
    ),
  },
  {
    id: 'paying',
    title: 'Paying',
    body: (
      <>
        <p>
          You pay on a secure page run by <strong>Stripe</strong> (card, Apple Pay and Google Pay)
          or by <strong>PayPal</strong>, not on this site, and their own terms apply to that step.
          Your card details never reach us.
        </p>
        <p>
          You can also give by bank transfer to the account shown on the{' '}
          <Link to="/give">Give</Link> page. Put your name and the fund in the reference so we can
          match the donation and send your receipt.
        </p>
      </>
    ),
  },
  {
    id: 'monthly-giving',
    title: 'Monthly giving',
    body: (
      <>
        <p>
          Monthly donations are taken by card through Stripe, and only for the voluntary funds:
          sadaqah, education, water, food and the emergency fund. Zakat, zakat ul fitr, kaffarah and
          fidyah are given once, because each is owed once. A monthly donation is charged on the same
          date each month until you stop it.
        </p>
        <p>
          To stop or change it, email us, at least three business days before the next charge so
          the change is made in time. There is no minimum number of months and no fee for stopping.
        </p>
        <p>
          If a payment fails, Stripe tries again over the following days. If it still fails, the
          donation stops and we email you rather than keep charging a card that is not working.
        </p>
      </>
    ),
  },
  {
    id: 'zakat-and-restricted-gifts',
    title: 'Zakat and restricted donations',
    body: (
      <>
        <p>
          Zakat is recorded in a ledger of its own, separate from our general donations. It is
          spent only on people eligible under the categories named in Qur&rsquo;an 9:60, and none of
          it pays for running the charity. We aim to distribute the zakat we receive within the
          financial year we receive it.
        </p>
        <p>
          If you give to a specific appeal, that is where the money goes. The next clause applies
          only when circumstances make that impossible: a border closes, a partner cannot operate,
          or the need is already met.
        </p>
      </>
    ),
  },
  {
    id: 'appeal-targets-and-surplus',
    title: 'Appeal targets and surplus',
    body: (
      <p>
        An appeal target is what we believe the work needs, not a cap. Where an appeal raises more
        than the work can absorb, or the work cannot go ahead at all, our board may direct the
        surplus to the closest comparable work we are doing. We say so on the appeal page when it
        happens, and it is reported in our annual accounts. This is standard practice for Australian
        charities, and it stops donated money sitting idle in a closed appeal.
      </p>
    ),
  },
  {
    id: 'tax-receipts',
    title: 'Tax receipts',
    body: (
      <>
        <p>
          Donations of <span className="nums">$2</span> and over to Al-Anwaar are tax deductible in
          Australia. Donations through Stripe or PayPal are receipted by email as soon as the payment
          goes through. Bank transfers are receipted within five business days of the money reaching
          us and being matched to your reference.
        </p>
        <p>
          Lost a receipt? Email us and we will send it again. We are not tax advisers, and what a
          deduction is worth to you depends on your own circumstances.
        </p>
      </>
    ),
  },
  {
    id: 'refunds',
    title: 'Refunds',
    body: (
      <>
        <p>
          A donation is normally final, because we commit it to the field quickly. But if something went
          wrong we will fix it. Tell us within 30 days if:
        </p>
        <ul>
          <li>you were charged the wrong amount, or charged twice;</li>
          <li>you meant to give once and set up a monthly donation by mistake;</li>
          <li>your card was used without your permission.</li>
        </ul>
        <p>
          We refund to the card or PayPal account you paid with, usually within ten business days.
          The tax receipt for a refunded donation is cancelled, so do not claim it. If the money has
          already been sent to the field we may not be able to recover it, and we will tell you so
          plainly.
        </p>
      </>
    ),
  },
  {
    id: 'our-content',
    title: 'Our name, and fundraising for us',
    body: (
      <>
        <p>
          The text and design on this site are ours. Some photographs are our own and some are
          licensed stock images, used under their licences. You are welcome to quote us and share
          our pages, with credit and a link.
        </p>
        <p>
          We are glad when people raise money for our work, and the{' '}
          <Link to="/get-involved">Get involved</Link> page explains how.{' '}
          <strong>
            Talk to us first, and do not use our name or logo to collect money without our written
            agreement.
          </strong>{' '}
          Fundraising in a charity&rsquo;s name is the most common way donors get defrauded, and we
          will act on it. If someone is collecting in our name and you are unsure, email us before
          you give.
        </p>
      </>
    ),
  },
  {
    id: 'what-you-send-us',
    title: 'What you send us',
    body: (
      <p>
        If you send us a message, a photograph or a review, it stays yours, but you give us
        permission to use it in our updates and reports, with your name unless you ask us not to.
        Only send us material that is yours to send.
      </p>
    ),
  },
  {
    id: 'other-services',
    title: 'Other services we rely on',
    body: (
      <>
        <p>
          Some parts of this site come from other companies, and their own terms apply to the part
          they handle: Stripe and PayPal for payments, Google for the fonts, OpenStreetMap for the
          map in the footer, and Meta for the Facebook and Instagram posts on Get involved. Our{' '}
          <Link to="/privacy">privacy policy</Link> explains when each one loads.
        </p>
        <p>
          Where we link to another organisation&rsquo;s site, we link because it is useful, not
          because we control or endorse everything on it.
        </p>
      </>
    ),
  },
  {
    id: 'liability',
    title: 'Liability',
    body: (
      <>
        <p>
          Nothing in these terms takes away a right you have under the Australian Consumer Law or
          any other law that cannot be excluded.
        </p>
        <p>
          Beyond that, and to the extent the law allows: we are not liable for indirect or
          consequential loss arising from your use of this site, and our total liability for
          anything connected with a donation is limited to the amount of that donation.
        </p>
      </>
    ),
  },
  {
    id: 'changes-and-law',
    title: 'Changes, and the law that applies',
    body: (
      <>
        <p>
          We update these terms from time to time, and the date at the top of the page changes with
          them. The terms that apply to a donation are the ones published on the day you made it.
        </p>
        <p>
          These terms are governed by the law of {ORG.jurisdiction}, Australia, and the courts of{' '}
          {ORG.jurisdiction} hear any dispute about them.
        </p>
      </>
    ),
  },
  {
    id: 'contact',
    title: 'Talk to us first',
    body: (
      <p>
        If something here is unclear, or something has gone wrong with a donation, email{' '}
        <a href={`mailto:${ORG.email}`}>{ORG.email}</a>, use the form on our{' '}
        <Link to="/contact">contact page</Link>, or write to us at {ORG.street}, {ORG.suburb}.
        Almost everything is quicker to fix than it is to argue about.
      </p>
    ),
  },
]

/** The email in the hero, set for the dark band rather than for the prose. */
const HERO_LINK =
  'underline decoration-paper/35 underline-offset-4 transition-colors duration-200 hover:text-gold-pale hover:decoration-gold-pale'

export default function Terms() {
  return (
    <div>
      {/* The photograph: a pen signing a document on a wooden table. Credit and
          licence are in LegalHero, with the other photograph. */}
      <LegalHero
        eyebrow="Terms & conditions"
        title="Plain rules"
        titleMark="for giving with us."
        summary="The rules for using this site and giving through it: where your donation goes, when we refund it, what a receipt is worth, and what we are responsible for."
        image="terms"
        position="55% 52%"
        facts={[
          { label: 'Last updated', value: LEGAL_UPDATED, nums: true },
          { label: 'Governed by', value: `The law of ${ORG.jurisdiction}` },
          {
            label: 'Questions',
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
