import { ArrowRight, Facebook, Instagram, WhatsApp, YouTube } from '../components/icons'
import Reveal from '../components/Reveal'
import { CONTACT } from '../components/contact-data'
import { SOCIALS } from '../components/org-data'

/* ---------------------------------------------------------------------------
   Contact, section 3 of 3: the other places we are, and the page's last word.

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

   And every mark takes its own platform's colour as the pointer reaches it —
   WhatsApp green, Instagram's gradient, Facebook blue, YouTube red — over an
   ink disc it returns to the moment the pointer leaves. See the note above
   BRAND for why that is the one place on this site a colour from outside the
   design system is allowed.

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

/* --- the platforms' own colours ------------------------------------------
   Each mark is ink at rest and its own brand colour under a pointer, which is
   the one moment on this site where a colour from outside the design system is
   allowed on screen.

   That is deliberate and it is fenced in: these four values are never tokens,
   never touch anything but the disc behind a logo, and never appear at rest.
   At rest the row is four identical ink discs, which is what keeps it reading
   as one row of ours rather than as a strip of other people's advertising; the
   colour is the answer to a pointer, and it is the platform's own so that the
   mark is recognisable in the half-second somebody is deciding.

   Instagram's is a gradient because Instagram's mark is a gradient — the
   1980s-camera wash its own brand guidelines use. Hard-coded here rather than
   in index.css for the same reason as the rest: these are their colours, not
   ours, and the day one of them rebrands this is the only file to open.

   Written out as whole class strings because Tailwind reads the source for
   them; a class assembled from pieces at runtime is a class that never gets
   generated. -------------------------------------------------------------- */
const BRAND: Record<string, string> = {
  WhatsApp: 'bg-[#25d366]',
  Instagram:
    'bg-[radial-gradient(circle_at_30%_107%,#fdf497_0%,#fdf497_5%,#fd5949_45%,#d6249f_60%,#285aeb_90%)]',
  Facebook: 'bg-[#1877f2]',
  YouTube: 'bg-[#ff0000]',
}

/** The disc behind a mark: ink, with the platform's own colour laid over it on
 *  a fade. It is an overlay rather than a background swap because a
 *  background-image cannot be transitioned — Instagram's gradient would snap in
 *  while the three flat ones eased, and one of the four would look broken. */
function Disc({ label }: { label: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute inset-0 opacity-0 transition-opacity duration-300 ease-brand group-hover:opacity-100 ${
        BRAND[label] ?? 'bg-green'
      }`}
    />
  )
}

/** The lattice tile, as a data URI. `stroke` is passed in because the ground
 *  under it is paper on the band and ink on the banner, and one colour cannot
 *  read on both. */
const lattice = (stroke: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">` +
      `<g fill="none" stroke="${stroke}" stroke-width="1.1">` +
      `<rect x="18" y="18" width="36" height="36"/>` +
      `<rect x="18" y="18" width="36" height="36" transform="rotate(45 36 36)"/>` +
      `</g></svg>`,
  )}")`

const GREEN_LATTICE = { backgroundImage: lattice('#2f6b5a'), backgroundSize: '72px 72px' }
const PAPER_LATTICE = { backgroundImage: lattice('#f2f2ee'), backgroundSize: '72px 72px' }

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

  const FeatureIcon = ICONS[feature.label]
  const handle = handleOf(feature.href)

  const who = handle || CONTACT.social.featureFallback.replace('{label}', feature.label)

  return (
    <section className="relative isolate overflow-hidden bg-sand py-s5">
      {/* Sand with a green wash off the top-left corner: the ground the Zakat
          band and the give band on the home page stand on, and "The mission in
          practice" on About before either of them. AboutMission.tsx is the
          original and this is its numbers verbatim — a tenth, quiet enough to
          sit under type and weak enough that the dark banner on top keeps its
          own edge. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(85%_70%_at_10%_0%,rgba(47,107,90,0.1)_0%,transparent_62%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-[0.035]"
        style={GREEN_LATTICE}
      />

      <div className="gutter relative mx-auto max-w-page">
        {/* ---------- the heading, down the middle ---------- */}
        <Reveal className="mx-auto max-w-[660px] text-center">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-green uppercase">
            {CONTACT.social.eyebrow}
          </p>

          <h2 className="mt-s2 font-display text-[clamp(28px,3.4vw,42px)] leading-tight [text-wrap:balance]">
            {CONTACT.social.title}
          </h2>
          <p className="mt-s2 text-[15.5px] leading-relaxed text-text-2 [text-wrap:pretty]">
            {CONTACT.social.intro}
          </p>
        </Reveal>

        {/* ---------- the banner ----------
            One object and one target: the whole thing is the link, and the pill
            inside it is a span that looks like the button rather than a second
            thing to click. */}
        <Reveal delay={90}>
          <a
            href={feature.href}
            target="_blank"
            /* noopener because target=_blank hands the new tab a reference back
               to this one otherwise. */
            rel="noreferrer noopener"
            aria-label={`Al-Anwaar on ${feature.label}`}
            className="group relative isolate mt-s4 block overflow-hidden rounded-2xl bg-ink transition-[transform,box-shadow] duration-300 ease-brand hover:-translate-y-1 hover:shadow-[0_28px_60px_-32px_rgba(21,26,24,0.7)]"
          >
            {/* The bar down the leading edge. It is the one place on this band
                that is solid brand green, and it widens under a pointer. */}
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1.5 bg-green transition-[width] duration-300 ease-brand group-hover:w-2.5"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035]"
              style={PAPER_LATTICE}
            />
            {/* The wash that lifts under a pointer, off the corner the button
                is in, so the banner brightens towards the thing to press. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(90%_150%_at_88%_50%,rgba(47,107,90,0.30)_0%,transparent_66%)] opacity-60 transition-opacity duration-500 ease-brand group-hover:opacity-100"
            />

            <div className="flex flex-col gap-s3 py-s3 pr-s3 pl-s4 sm:flex-row sm:items-center sm:gap-s3 sm:py-s4 sm:pr-s4">
              {FeatureIcon && (
                <span
                  aria-hidden="true"
                  className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-green/25 text-green-pale transition-transform duration-300 ease-brand group-hover:scale-105"
                >
                  <Disc label={feature.label} />
                  <FeatureIcon className="relative h-7 w-7 transition-colors duration-300 ease-brand group-hover:text-paper" />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold tracking-[0.2em] text-green-pale/75 uppercase">
                  {feature.label}
                </p>
                <p className="mt-1 font-display text-[clamp(22px,2.4vw,30px)] leading-snug break-words text-paper">
                  {CONTACT.social.featureTitle.replace('{who}', who)}
                </p>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-paper/65">
                  {CONTACT.social.featureBody}
                </p>
              </div>

              <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-paper px-s3 py-3 text-[12.5px] font-semibold tracking-[0.12em] text-ink uppercase transition-colors duration-200 ease-brand group-hover:bg-green group-hover:text-paper sm:self-auto">
                {CONTACT.social.featureAction.replace('{label}', feature.label)}
                <ArrowRight className="h-3.5 w-3.5 -rotate-45 transition-transform duration-300 ease-brand group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </div>
          </a>
        </Reveal>

        {/* ---------- everything the banner did not take ---------- */}
        {rest.length > 0 && (
          <Reveal delay={150} className="mt-s4">
            <p className="flex items-center justify-center gap-s2 text-[11px] font-semibold tracking-[0.2em] text-text-3 uppercase">
              <span aria-hidden="true" className="h-px w-10 bg-line sm:w-16" />
              {CONTACT.social.also}
              <span aria-hidden="true" className="h-px w-10 bg-line sm:w-16" />
            </p>

            <ul className="mt-s3 flex list-none flex-wrap justify-center gap-s2">
              {rest.map(({ label, href }) => {
                const Icon = ICONS[label]
                if (!Icon) return null

                return (
                  <li
                      key={label}
                      className="w-full sm:w-[calc(50%_-_0.5rem)] lg:w-[calc(33.333%_-_0.667rem)]"
                    >
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`Al-Anwaar on ${label}`}
                      className="group flex items-center gap-s2 rounded-xl bg-paper p-s2 shadow-[0_1px_2px_rgba(21,26,24,0.05)] transition-[transform,box-shadow] duration-300 ease-brand hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-26px_rgba(21,26,24,0.5)]"
                    >
                      <span
                        aria-hidden="true"
                        className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink text-paper"
                      >
                        <Disc label={label} />
                        <Icon className="relative h-5 w-5" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] font-medium text-text">{label}</span>
                        {BLURBS[label] && (
                          <span className="block text-[13.5px] text-text-2">{BLURBS[label]}</span>
                        )}
                      </span>

                      <ArrowRight
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 -rotate-45 text-text-3 transition-[transform,color] duration-300 ease-brand group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-green"
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
