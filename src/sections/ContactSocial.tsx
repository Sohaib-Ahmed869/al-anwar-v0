import { ArrowRight, Facebook, Instagram, WhatsApp, YouTube } from '../components/icons'
import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { CONTACT } from '../components/contact-data'
import { SOCIALS } from '../components/org-data'

/* ---------------------------------------------------------------------------
   Contact, section 3 of 3: the other places we are, and the page's last word.

   17 SEPTEMBER 2026, on the About page's pattern: no sand ground and no
   lattice, the shared SectionHead left aligned, the banner in the logo teal
   with the masjid faint in its corner (the About mission panel), and the
   other accounts as ruled cards that lift. Much of the note below describes
   the centred sand version it replaced.

   Centred, on the site's sand ground with a girih lattice worked very faintly
   into it, and built in three steps down the middle of the page: the heading,
   one wide dark banner for the account worth featuring, and a rule-flanked
   label over cards for the rest.

   It has been three things now — a deep green band with two rows on it, then
   the About page's pale panel with two cards beside the heading. Both put the
   accounts in a column off to one side, which is where a reader's eye goes
   last on a page they have just finished writing on. Centred, the section has
   one axis and three beats down it, and the banner is unmissable because it is
   the only wide dark object between the form and the footer.

   The ground is sand rather than a mint of its own, so that this band is the
   same light band the home and About pages already pace themselves with. It is
   also the warm end of the palette against the cool paper-2 the form sits on,
   which is what makes the change of section read at a glance.

   ── The pattern ────────────────────────────────────────────────────────
   Two squares, one turned forty-five degrees: the eight-point star that Islamic
   geometry builds its lattices from, tiled and left at about five percent. It
   is drawn in the stylesheet as an SVG data URI rather than fetched, so it
   costs no request, cannot arrive late and cannot be a broken image. It is the
   first pattern anywhere on this site — if a second section wants one, this
   function is what it should share rather than a new tile.

   ── Which account gets the banner ──────────────────────────────────────
   CONTACT.social.feature names it and everything else falls into the row below,
   in the order SOCIALS lists them. The channel has the banner because it is the
   only one of the four that reaches somebody without their going to look for
   it; the other three are a line of cards under it.

   The row is a wrapping, centred flex sized in thirds rather than a grid, so it
   holds three cards on a wide screen, two from sm, and one per line on a phone
   — and so that adding or dropping an account stays a one-line change in
   org-data.ts rather than a layout change here.

   READ THIS BEFORE LAUNCH: all four accounts in SOCIALS are placeholders and
   not one of the links goes anywhere real. See the note above SOCIALS itself.

   ── What moves ─────────────────────────────────────────────────────────
   The banner lifts and its wash brightens under a pointer, its button goes from
   paper to green with the arrow travelling up and to the right, and each card
   lifts. The diagonal on both arrows is deliberate: these are the only links on
   the page that leave the site, and an arrow that goes up and out says so
   before the label is read.

   Every account shows its real logo in one colour at rest, and in its own
   colours under a pointer. See the note above Logo.

   Every word here is in components/contact-data.ts. The handles are not: they
   are read off the end of each account's own URL, so they cannot disagree with
   the link under them and they follow the real accounts in on their own when
   SOCIALS stops being placeholders.
--------------------------------------------------------------------------- */

const ICONS: Record<string, (p: { className?: string }) => React.ReactElement> = {
  WhatsApp,
  Instagram,
  Facebook,
  YouTube,
}

/** Typed loosely on purpose: the keys are account labels, and an account with
 *  no line written for it is a missing sentence rather than a bug. */
const BLURBS: Record<string, string | undefined> = CONTACT.social.blurbs

/* --- the platforms' own logos ------------------------------------------
   Each account shows its real logo shape at rest in one colour (ink on the
   cards, paper on the teal banner), and fades into its own brand colours
   under a pointer (user's call, 17 Sep 2026). Drawn the way each platform
   draws itself:

     Instagram  the gradient tile with the camera in white
     WhatsApp   the green tile with the bubble in white
     Facebook   the blue circle, which is the mark itself
     YouTube    the red play button, which is the mark itself

   The colour is a layer faded in over the resting tile, because a gradient
   background cannot be transitioned. These colours are the platforms', not
   ours, so they are never tokens. ------------------------------------------ */
type LogoSize = 'md' | 'lg'

const TILE = { md: 'h-12 w-12 rounded-[14px]', lg: 'h-16 w-16 rounded-[18px]' }
const GLYPH = { md: 'h-6 w-6', lg: 'h-8 w-8' }
const MARK = { md: 'h-11 w-11', lg: 'h-14 w-14' }

const FILL: Record<string, string> = {
  Instagram:
    'bg-[radial-gradient(circle_at_30%_107%,#fdf497_0%,#fdf497_5%,#fd5949_45%,#d6249f_60%,#285aeb_90%)]',
  WhatsApp: 'bg-[#25d366]',
}

const INK: Record<string, string> = {
  Facebook: 'group-hover:text-[#0866ff]',
  YouTube: 'group-hover:text-[#ff0000]',
}

function Logo({ label, size = 'md', onDark = false }: { label: string; size?: LogoSize; onDark?: boolean }) {
  const Icon = ICONS[label]
  if (!Icon) return null

  const box = 'relative isolate flex shrink-0 items-center justify-center overflow-hidden transition-transform duration-300 ease-brand group-hover:scale-[1.06]'
  const fade = 'transition-[opacity,color] duration-300 ease-brand'

  /* Instagram and WhatsApp: a tile, ink (or paper on teal) at rest, with the
     brand fill fading in over it. */
  if (FILL[label])
    return (
      <span
        aria-hidden="true"
        className={`${box} ${TILE[size]} text-white ${onDark ? 'bg-paper/15' : 'bg-ink'}`}
      >
        <span className={`absolute inset-0 -z-10 opacity-0 group-hover:opacity-100 ${fade} ${FILL[label]}`} />
        <Icon className={GLYPH[size]} />
      </span>
    )

  /* Facebook and YouTube: the glyph is the whole logo, cut-out and all. At rest
     the cut-out shows the ground; under a pointer a white disc comes up behind
     it so the "f" and the play arrow are white, as in the real marks. */
  return (
    <span
      aria-hidden="true"
      className={`${box} ${TILE[size]} ${onDark ? 'text-paper' : 'text-ink'} ${INK[label] ?? 'group-hover:text-teal'} !transition-[transform,color]`}
    >
      <span className={`absolute inset-[24%] -z-10 rounded-full bg-white opacity-0 group-hover:opacity-100 ${fade}`} />
      <Icon className={MARK[size]} />
    </span>
  )
}

/** The last thing in the path, as a handle:
 *
 *      instagram.com/alanwaar          -> @alanwaar
 *      youtube.com/@alanwaar           -> @alanwaar   (the @ is not doubled)
 *      whatsapp.com/channel/alanwaar   -> @alanwaar   (the segment, not the route)
 *
 *  Anything that is not handle-shaped comes back empty and the copy falls back
 *  to naming the platform instead. That is the case that matters in practice: a
 *  real WhatsApp channel invite ends in an opaque id, and "@0029Va8Xk" under a
 *  headline reading Follow is worse than no handle at all. */
function handleOf(href: string): string {
  try {
    const last = new URL(href).pathname.split('/').filter(Boolean).pop() ?? ''
    return /^@?[A-Za-z0-9][A-Za-z0-9._-]{1,29}$/.test(last) ? `@${last.replace(/^@/, '')}` : ''
  } catch {
    return ''
  }
}

export default function ContactSocial() {
  /* The featured account, and everything else. A `feature` that names nothing
     in SOCIALS falls back to the first account rather than leaving the banner
     empty — the copy is wrong at that point, but the section still works. */
  const feature = SOCIALS.find((s) => s.label === CONTACT.social.feature) ?? SOCIALS[0]
  const rest = SOCIALS.filter((s) => s !== feature)

  if (!feature) return null

  const handle = handleOf(feature.href)

  const who = handle || CONTACT.social.featureFallback.replace('{label}', feature.label)

  return (
    <section
      id="social"
      aria-labelledby="social-head"
      className={`scroll-mt-[calc(var(--header-h)+24px)] ${SECTION_Y}`}
    >
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="social-head"
          eyebrow={CONTACT.social.eyebrow}
          title={CONTACT.social.title}
          lede={CONTACT.social.intro}
        />

        {/* ---------- the banner ----------
            One object and one target: the whole thing is the link, and the pill
            inside it is a span that looks like the button rather than a second
            thing to click. */}
        <Reveal variant="clip" className={`mt-s4 block lg:mt-s5 ${BREAKOUT}`}>
          <a
            href={feature.href}
            target="_blank"
            /* noopener because target=_blank hands the new tab a reference back
               to this one otherwise. */
            rel="noreferrer noopener"
            aria-label={`Al-Anwaar on ${feature.label}`}
            className="group relative isolate block overflow-hidden rounded-2xl bg-grad-lagoon-x transition-[transform,box-shadow] duration-300 ease-brand hover:-translate-y-1 hover:shadow-[0_28px_60px_-32px_rgba(0,103,112,0.8)]"
          >

            <div className="flex flex-col gap-s3 p-s3 sm:flex-row sm:items-center sm:gap-s4 sm:p-s4 lg:p-[clamp(32px,3.2vw,52px)]">
              <Logo label={feature.label} size="lg" onDark />

              <div className="min-w-0 flex-1">
                <p className="font-script text-[clamp(24px,2.2vw,32px)] leading-none text-gold-pale">
                  {feature.label}
                </p>
                <p className="mt-2 font-display text-[clamp(22px,2.2vw,30px)] leading-[1.15] tracking-[-0.02em] break-words text-paper">
                  {CONTACT.social.featureTitle.replace('{who}', who)}
                </p>
                <p className="mt-s1 text-[15px] leading-[1.55] text-paper/80">
                  {CONTACT.social.featureBody}
                </p>
              </div>

              <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-[10px] bg-paper px-6 py-3.5 text-[15.5px] font-semibold text-ink transition-colors duration-200 ease-brand group-hover:bg-ink group-hover:text-paper sm:self-auto">
                {CONTACT.social.featureAction.replace('{label}', feature.label)}
                <ArrowRight className="h-3.5 w-3.5 -rotate-45 transition-transform duration-300 ease-brand group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </div>
          </a>
        </Reveal>

        {/* ---------- everything the banner did not take ---------- */}
        {rest.length > 0 && (
          <Reveal variant="soft" delay={150} className={`mt-s4 block ${BREAKOUT}`}>
            <p className="flex items-center gap-s2 text-[11px] font-semibold tracking-[0.2em] text-text-3 uppercase">
              {CONTACT.social.also}
              <span aria-hidden="true" className="h-px flex-1 bg-line" />
            </p>

            <ul className="mt-s3 grid list-none gap-s2 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map(({ label, href }) => {
                if (!ICONS[label]) return null

                return (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`Al-Anwaar on ${label}`}
                      className="group flex h-full items-center gap-s2 rounded-2xl border border-line bg-paper/40 p-s3 transition-[border-color,background-color,box-shadow,transform] duration-300 ease-brand hover:-translate-y-1 hover:border-teal/30 hover:bg-paper hover:shadow-card"
                    >
                      <Logo label={label} />

                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-[18px] leading-tight tracking-[-0.01em] text-text">{label}</span>
                        {BLURBS[label] && (
                          <span className="block text-[13.5px] text-text-2">{BLURBS[label]}</span>
                        )}
                      </span>

                      <ArrowRight
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 -rotate-45 text-text-3 transition-[transform,color] duration-300 ease-brand group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-teal"
                      />
                    </a>
                  </li>
                )
              })}
            </ul>
          </Reveal>
        )}
      </div>
    </section>
  )
}
