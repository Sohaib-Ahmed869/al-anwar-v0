import { Link } from 'react-router-dom'

import Reveal from '../components/Reveal'
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
    link: { text: 'How volunteering works', to: '/get-involved#volunteer' },
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

/* Green at the shoulder, fading to paper by the time it reaches the words. The
   gradient is what stops three cards on a white page from reading as three
   empty boxes — it gives each one a top and a bottom without drawing a single
   extra line. Under a pointer the card lifts and a second, stronger wash comes
   up over the first. */
const CARD =
  'group relative isolate flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-[linear-gradient(165deg,var(--color-green-pale)_0%,var(--color-paper-2)_58%)] p-s3 transition-[transform,border-color,box-shadow] duration-300 ease-brand hover:-translate-y-1 hover:border-green/40 hover:shadow-[0_22px_48px_-28px_rgba(21,26,24,0.45)] sm:p-s4'

/* Paper at rest, because a pale green chip on a pale green shoulder is not a
   chip. It fills to solid green under a pointer. */
const CHIP =
  'inline-flex items-center rounded-full bg-paper px-3 py-1 text-[10.5px] font-semibold tracking-[0.12em] text-green uppercase shadow-[0_1px_2px_rgba(21,26,24,0.06)] transition-colors duration-300 ease-brand group-hover:bg-green group-hover:text-paper'

export default function AboutWork() {
  return (
    <section
      id="work"
      /* The mega menu links straight here, so the heading has to clear the
         sticky bar when it lands. */
      className="scroll-mt-[calc(var(--header-h)+24px)] border-t border-line-2 py-s5"
    >
      <div className="gutter mx-auto max-w-page">
        {/* The headline carries the section on its own now that the paragraph
            beside it has gone, so it is set at display size rather than at the
            size of a heading with an explanation to lean on. */}
        <Reveal>
          <p className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.16em] text-green uppercase">
            <span aria-hidden="true" className="h-px w-6 bg-green/40" />
            Volunteer with us
          </p>

          <h2 className="mt-s2 max-w-[17ch] font-display text-[clamp(30px,4.4vw,54px)] leading-[1.04] tracking-[-0.02em] [text-wrap:balance]">
            Give an afternoon, a skill, or a room
          </h2>
        </Reveal>

        <ol className="mt-s5 grid gap-s3 md:grid-cols-3">
          {ROLES.map((role, i) => (
            <li key={role.title} className="h-full">
              <Reveal delay={i * 90} className="h-full">
                <article className={CARD}>
                  {/* The second wash, over the resting one. */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(165deg,rgba(47,107,90,0.17)_0%,transparent_60%)] opacity-0 transition-opacity duration-500 ease-brand group-hover:opacity-100"
                  />

                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-green transition-transform duration-500 ease-brand group-hover:scale-x-100"
                  />

                  <p>
                    <span className={CHIP}>{role.kind}</span>
                  </p>

                  {/* Two lines' worth of room while the columns are narrow
                      enough for a title to take them, so the three bodies
                      start level. Above xl the floor is dropped rather than
                      left reserving blank. */}
                  <h3 className="mt-s2 font-display text-[clamp(19px,1.9vw,23px)] leading-snug tracking-[-0.01em] md:min-h-[2.6em] xl:min-h-0">
                    {role.title}
                  </h3>

                  <p className="mt-s2 text-[15px] leading-relaxed text-text-2">{role.body}</p>

                  <Link
                    to={role.link.to}
                    className="mt-auto inline-flex items-center gap-1.5 self-start pt-s3 text-[14.5px] font-semibold text-green transition-colors duration-200 ease-brand hover:text-ink"
                  >
                    {role.link.text}
                    <ArrowRight className="h-3 w-3 -translate-x-0.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                  </Link>
                </article>
              </Reveal>
            </li>
          ))}
        </ol>

        {/* The way out for everyone the three cards did not describe, and the
            last thing on the page before the footer's dark band. It is lit
            rather than outlined — a green wash running off one corner and a
            filled button on it — because a grey box here would have been the
            page's final word, and the page's final word should be an
            invitation. Light rather than deep green: the footer under it is
            already ink, and two dark bands in a row close the page on a mood
            instead of an offer. */}
        <Reveal>
          <div className="relative isolate mt-s4 overflow-hidden rounded-2xl bg-[linear-gradient(115deg,var(--color-green-pale)_0%,#f1f5f2_44%,var(--color-sand)_100%)] p-s3 sm:p-s4">
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 bg-[radial-gradient(70%_120%_at_88%_18%,rgba(47,107,90,0.16)_0%,transparent_66%)]"
            />

            <div className="flex flex-col gap-s3 sm:flex-row sm:items-center sm:justify-between sm:gap-s4">
              <div>
                <h3 className="font-display text-[clamp(20px,2.2vw,26px)] leading-snug">
                  None of those three, and still want to help?
                </h3>
                <p className="mt-s1 max-w-[52ch] text-[14.5px] leading-relaxed text-text-2">
                  Write and say what you are good at. It goes to a person, not a queue, and they
                  answer within a working day.
                </p>
              </div>

              <a
                href={`mailto:${ORG.email}`}
                className="group inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-green px-s3 py-2.5 text-[14.5px] font-semibold text-paper transition-[background-color,transform] duration-200 ease-brand hover:-translate-y-0.5 hover:bg-ink sm:self-auto"
              >
                <Mail className="h-4 w-4" />
                {ORG.email}
                <ArrowRight className="h-3 w-3 -translate-x-0.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
