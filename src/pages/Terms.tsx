import { Link } from 'react-router-dom'
import LegalHero from '../sections/LegalHero'
import LegalBody, { type LegalSection } from '../sections/LegalBody'
import { ORG, LEGAL_UPDATED } from '../components/org-data'

/* ---------------------------------------------------------------------------
   Terms and conditions. Hero, the clauses, and the footer the layout already
   gives every page.

   The clauses that matter most to a donor come first — what happens to the
   money, when we will refund it, what a receipt is worth — and the boilerplate
   sits at the bottom where boilerplate belongs.

   TODO before launch:
     - have a solicitor read this, in particular clauses 7 (surplus), 9
       (refunds) and 14 (liability);
     - confirm clause 6 against the board's actual zakat policy, including how
       administration is funded on a zakat gift;
     - confirm the refund window in clause 9 with whoever answers the email.
--------------------------------------------------------------------------- */

const SECTIONS: LegalSection[] = [
  {
    id: 'these-terms',
    title: 'These terms',
    body: (
      <p>
        By using this site, giving through it, or registering for one of our events, you accept
        these terms. If you do not accept them, please do not use the site. Read them with our{' '}
        <Link to="/privacy">privacy policy</Link>, which covers what we do with your details.
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
          not impersonate a donor or a member of our staff. We can suspend access to anyone doing
          any of that.
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
            By giving, you confirm the money is yours to give and that you are authorised to use the
            payment method.
          </li>
          <li>
            A donation is a gift. You get nothing in return for it, which is precisely what makes
            it tax deductible.
          </li>
          <li>
            The minimum gift that can carry a deductible receipt is <span className="nums">$2</span>
            .
          </li>
          <li>
            We can decline or return a donation. We do that rarely, and only where accepting it
            would put the charity or its work at risk.
          </li>
        </ul>
        <p>
          Your gift is applied to the appeal you chose, minus the payment provider&rsquo;s
          transaction fee unless you chose to cover it. What happens to the rest is set out on{' '}
          <Link to="/where-it-goes">Where it goes</Link>.
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
          A monthly gift is charged to the same card on the same date each month until you stop it.
          You can stop or change it at any time from <Link to="/my-giving">Your giving</Link>, or by
          emailing us. Give us three business days before the next charge so it clears our
          system in time.
        </p>
        <p>
          If a payment fails we try once more a few days later. If that fails too we pause the gift
          and email you rather than keep retrying a card that is not working.
        </p>
      </>
    ),
  },
  {
    id: 'zakat-and-restricted-gifts',
    title: 'Zakat and restricted gifts',
    body: (
      <>
        <p>
          Zakat is recorded in a separate ledger from our general donations and is distributed only
          to recipients eligible under the categories named in Qur&rsquo;an 9:60. We aim to
          distribute the zakat we receive within the financial year we receive it.
        </p>
        <p>
          If you give to a specific appeal, that is where the money goes. Clause 7 applies when
          circumstances make that impossible: a border closes, a partner cannot operate, or the
          need is already met.
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
        than the work can absorb, or the work cannot proceed at all, our board may direct the
        surplus to the closest comparable work we are doing. We say so on the appeal page when it
        happens, and it is reported in our annual accounts. This is standard practice for
        Australian charities and it is what stops donated money sitting idle in a closed appeal.
      </p>
    ),
  },
  {
    id: 'tax-receipts',
    title: 'Tax receipts',
    body: (
      <>
        <p>
          Gifts of <span className="nums">$2</span> and over to Al-Anwaar are tax deductible in
          Australia. Card donations are receipted by email straight away; bank transfers are
          receipted within five business days of the money reaching us and being matched to your
          reference. Monthly donors also get one summary of the year in July.
        </p>
        <p>
          Lost a receipt? Email us and we will re-send it. We are not tax advisers, and what a
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
          A gift is normally final, because we commit it to the field quickly. But if something went
          wrong we will fix it. Tell us within 30 days if:
        </p>
        <ul>
          <li>you were charged the wrong amount, or charged twice;</li>
          <li>you meant to give once and set up a monthly gift by mistake;</li>
          <li>your card was used without your permission.</li>
        </ul>
        <p>
          We refund to the original payment method, usually within ten business days. The tax
          receipt for a refunded gift is cancelled, so do not claim it. If the money has already
          been sent to the field we may not be able to recover it, and we will tell you that
          honestly rather than quietly.
        </p>
      </>
    ),
  },
  {
    id: 'events',
    title: 'Events',
    body: (
      <>
        <p>
          Event places are limited and are held in the name you register under. Tell us at least 48
          hours before if you cannot come, so the place can go to somebody else. Paid tickets are
          refundable up to seven days before the event; after that the payment is treated as a
          donation.
        </p>
        <p>
          We may photograph or film at our events for our reports and this site. Tell a member of
          staff on the day if you would rather not appear, and we will keep you out of the frame.
        </p>
      </>
    ),
  },
  {
    id: 'our-content',
    title: 'Our name, our photographs',
    body: (
      <>
        <p>
          The text, photographs, film and design on this site are ours or used with permission. You
          are welcome to quote us and share our pages, with credit and a link.
        </p>
        <p>
          <strong>
            You may not use our name, our logo or our photographs to raise money, in any way, without
            our written permission.
          </strong>{' '}
          Fundraising in a charity&rsquo;s name is the most common way donors get defrauded, and we
          will pursue it. If someone is collecting in our name and you are unsure, email us and ask
          before you give.
        </p>
      </>
    ),
  },
  {
    id: 'what-you-send-us',
    title: 'What you send us',
    body: (
      <p>
        If you send us a message, a photograph or a review, you keep it, but you give us
        permission to use it in our updates and reports, with your name unless you ask us not to. Only send us
        material that is yours to send.
      </p>
    ),
  },
  {
    id: 'other-services',
    title: 'Other services we rely on',
    body: (
      <p>
        Payments, email and maps on this site are handled by other companies, and their own terms
        apply to the part they handle. Where we link out to another organisation&rsquo;s site, we
        link because it is useful, not because we control or endorse everything on it.
      </p>
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
          We update these terms from time to time and the date at the top of the page changes with
          them. The terms that apply to a gift are the ones published on the day you made it.
        </p>
        <p>
          These terms are governed by the law of {ORG.jurisdiction}, Australia, and the courts of{' '}
          {ORG.jurisdiction} have jurisdiction over any dispute about them.
        </p>
      </>
    ),
  },
  {
    id: 'contact',
    title: 'Talk to us first',
    body: (
      <p>
        If something here is unclear, or something has gone wrong with a gift, email{' '}
        <a href={`mailto:${ORG.email}`}>{ORG.email}</a> or write to us at {ORG.street}, {ORG.suburb}.
        Almost everything is quicker to fix than it is to argue about. Our contact page is{' '}
        <Link to="/contact">here</Link>.
      </p>
    ),
  },
]

/** The email in the hero, set for the photograph rather than for the prose. */
const HERO_LINK =
  'underline decoration-paper/30 underline-offset-4 transition-colors duration-200 hover:text-paper hover:decoration-current'

export default function Terms() {
  return (
    <div>
      {/* The photograph: a pen signing a document on a wooden table. Credit and
          licence are in LegalHero, with the two other photographs. */}
      <LegalHero
        eyebrow="Legal"
        title="Terms & conditions"
        summary="The rules for using this site and for giving through it: what happens to your donation, when we will refund it, what a receipt is worth, and what we are responsible for."
        image="terms"
        position="55% 52%"
        facts={[
          { label: 'Last updated', value: LEGAL_UPDATED, nums: true },
          { label: 'Applies to', value: 'This site, donations, and event registrations' },
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
