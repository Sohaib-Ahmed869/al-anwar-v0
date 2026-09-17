import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { ArrowRight, Mail } from '../components/icons'
import { ORG } from '../components/org-data'

/* ---------------------------------------------------------------------------
   About, section 5 of 5: volunteer with us.

   It used to open on "We are not hiring right now", which was honest and was
   the wrong first sentence. Nobody arrives at the foot of an about page looking
   for a salary; they arrive having read six years of distributions and wanting
   to know how to be part of the next one.

   THREE INVITATIONS, NOT THREE LISTINGS
   An earlier pass gave each card a when/where/what-you-need table, on the
   theory that those are the questions a volunteer asks. They are — but three
   cards carrying three specification tables is the exact shape of a jobs board,
   and a jobs board is the one thing this section must not look like. Every fact
   in those rows was a restatement of the sentence above it anyway, so the rows
   came off and the sentence carries them: a day in Silverwater, a few hours a
   month, a date you set. The cards are now a label, a name and an invitation.

   Two paragraphs also came off at the client's request — the one under the
   headline explaining that everything leaves the warehouse because somebody
   turned up, and the line recording that there are no paid vacancies and when
   that was last checked. The second was the section's only remaining statement
   about paid work, so the page no longer says anything about whether anyone
   here is paid. Nor does AboutTeam, since its pay table came off too. If a
   reader wants to know where their donation stops and a salary starts, there is
   now nowhere on this site to find out.

   17 September 2026: moved onto the home page's pattern (SectionHead, one
   ground, ruled panels with a script label instead of gradient cards and
   chips), and the closing email line is now a teal panel.

   Second pass, 17 September 2026: each card fills with the banner teal from
   the foot under a pointer, its arrow turns gold, and the whole card is the
   link.

   The headline names the three in the order the cards run — an afternoon, a
   skill, a room — so a reader who only reads the heading still knows what is
   being asked of them.
--------------------------------------------------------------------------- */

type Role = {
  /** What kind of thing this is, so three unlike offers do not read as three of a kind. */
  kind: string
  title: string
  body: string
  link: { text: string; to: string }
}

const ROLES: Role[] = [
  {
    kind: 'An afternoon',
    title: 'Packing days and drivers',
    body: 'The unglamorous half of this. Boxes get packed in Silverwater and somebody has to drive them. No experience, no interview, and you can come once and never again.',
    link: { text: 'How volunteering works', to: '/volunteer' },
  },
  {
    kind: 'A skill',
    title: 'Two skills the board is short of',
    body: 'Someone with charity accounting behind them, and someone with Arabic who can sit in on a partner call and hear what is actually being said. Both are unpaid seats, a few hours a month.',
    link: { text: 'Write to the office', to: '/contact' },
  },
  {
    kind: 'A room',
    title: 'Your mosque, school or workplace',
    body: 'A collection box, a speaker at a Friday, a matched-giving scheme at work, or a fundraiser you run yourself. This is where most of what we raise actually comes from.',
    link: { text: 'Partnerships and fundraising', to: '/get-involved#partners' },
  },
]

export default function AboutWork() {
  return (
    <section
      id="work"
      aria-labelledby="work-head"
      /* The mega menu links straight here, so the heading has to clear the
         sticky bar when it lands. */
      className={`scroll-mt-[calc(var(--header-h)+24px)] ${SECTION_Y}`}
    >
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="work-head"
          eyebrow="Volunteer with us"
          title="Give an afternoon, a skill, or a room."
        />

        {/* Ruled panels, as the values above and AppealsNotSure's zakat side
            are: the script label says what kind of offer it is. */}
        <ol className={`mt-s4 grid gap-s2 md:grid-cols-3 lg:mt-s5 ${BREAKOUT}`}>
          {ROLES.map((role, i) => (
            <li key={role.title} className="h-full">
              <Reveal variant="clip" delay={i * 90} className="h-full">
                <article className="group relative isolate flex h-full flex-col overflow-hidden rounded-2xl border border-line p-s3 transition-[border-color,transform,box-shadow] duration-300 ease-brand hover:-translate-y-1 hover:border-teal hover:shadow-card sm:p-s4">
                  {/* Teal rising up from the foot under a pointer, so the card
                      becomes the banner's panel for as long as it is chosen. */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 origin-bottom scale-y-0 bg-teal transition-transform duration-500 ease-brand group-hover:scale-y-100"
                  />
                  <div className="flex items-center justify-between gap-s2">
                    <p className="font-script text-[clamp(24px,2vw,30px)] leading-none text-green transition-colors duration-300 group-hover:text-gold-pale">
                      {role.kind}
                    </p>
                    <span
                      aria-hidden="true"
                      className="flex size-10 items-center justify-center rounded-full border border-line text-teal transition-[border-color,background-color,color,transform] duration-300 ease-brand group-hover:-rotate-45 group-hover:border-gold group-hover:bg-gold group-hover:text-ink"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <h3 className="mt-s3 font-display text-[clamp(20px,1.8vw,24px)] leading-[1.18] font-semibold tracking-[-0.018em] text-balance transition-colors duration-300 group-hover:text-paper">
                    {role.title}
                  </h3>
                  <p className="mt-s2 mb-s3 text-[15px] leading-relaxed text-text-2 transition-colors duration-300 group-hover:text-paper/80">
                    {role.body}
                  </p>

                  {/* The whole card is the link. */}
                  <Link
                    to={role.link.to}
                    className="mt-auto inline-flex items-center gap-1.5 self-start text-[14.5px] font-semibold text-green transition-colors duration-300 after:absolute after:inset-0 group-hover:text-gold-pale"
                  >
                    {role.link.text}
                    <ArrowRight className="h-3 w-3 -translate-x-0.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                  </Link>
                </article>
              </Reveal>
            </li>
          ))}
        </ol>

        {/* The way out for everyone the three did not describe, and the last
            thing before the footer. The home banner's teal, with a paper
            button rather than gold: gold is kept for things that take money. */}
        <Reveal variant="clip" className={`mt-s2 block ${BREAKOUT}`}>
          <div className="flex flex-col gap-s3 rounded-2xl bg-teal p-s3 text-paper sm:p-s4 md:flex-row md:items-center md:justify-between md:gap-s4 lg:p-[clamp(32px,3.2vw,52px)]">
            <div>
              <p className="font-script text-[clamp(24px,2.2vw,32px)] leading-none text-gold-pale">
                Something else in mind?
              </p>
              <h3 className="mt-2 font-display text-[clamp(22px,2.2vw,30px)] leading-[1.15] font-semibold tracking-[-0.02em] text-balance">
                Tell us what you are good at.
              </h3>
              <p className="mt-s1 max-w-[52ch] text-[15px] leading-[1.55] text-paper/80">
                It goes to a person, not a queue, and they answer within a working day.
              </p>
            </div>

            <a
              href={`mailto:${ORG.email}`}
              className="group inline-flex min-h-[50px] shrink-0 items-center gap-2 self-start rounded-[10px] bg-paper px-6 text-[15.5px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-green-pale md:self-auto"
            >
              <Mail className="h-4 w-4" />
              {ORG.email}
              <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
