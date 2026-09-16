import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Facebook, Instagram, Mail, MapPin } from './icons'
import { FACEBOOK, INSTAGRAM } from './social-data'
import Letter from './Letter'

/* ---------------------------------------------------------------------------
   The footer, on every page. The ask first — components/Letter.tsx, which is
   rendered in here rather than by Layout so that it shares this ground — then
   four things and nothing else: who we are (logo, one line, socials), every
   page on the site in three columns, how to reach us, and the small print.

   Ported from ../../al-anwaar-prototype-v2.html, but the bank transfer block,
   the registration line and its badges, and every phone number are gone: the
   numbers live on the contact page and the registration on Where it goes, both
   one click away from the columns below.

   No gold anywhere in this band. Gold is the give action and the focus ring
   and nothing else (DESIGN-NOTES.md).
--------------------------------------------------------------------------- */

/** Every page on the site, in the three groups the prototype uses. */
const COLUMNS = [
  {
    title: 'Give',
    links: [
      { label: 'All appeals', to: '/appeals' },
      { label: 'Zakat', to: '/zakat' },
      { label: 'Zakat calculator', to: '/zakat#calculator' },
      { label: 'Your giving', to: '/my-giving' },
    ],
  },
  {
    title: 'Trust',
    links: [
      { label: 'Where it goes', to: '/where-it-goes' },
      { label: 'Reports & financials', to: '/where-it-goes#reports' },
      { label: 'Our field partners', to: '/where-it-goes#partners' },
      { label: 'ACNC, ABN & DGR', to: '/where-it-goes#registration' },
    ],
  },
  {
    title: 'Join',
    links: [
      { label: 'Get involved', to: '/get-involved' },
      { label: 'Volunteer with us', to: '/get-involved#volunteer' },
      { label: 'About us', to: '/about' },
      { label: 'Contact us', to: '/contact' },
    ],
  },
]

/* The two accounts, read from the one place their URLs are written down —
   this file used to carry its own copies and they were both placeholders. They
   are real now: facebook.com/alanwaarorgau and instagram.com/alanwaarcharity,
   given by the client and checked on 16 September 2026. See social-data.ts,
   and note the two handles do not match each other. */
const SOCIALS = [
  { ...FACEBOOK, Icon: Facebook },
  { ...INSTAGRAM, Icon: Instagram },
]

const EMAIL = 'info@alanwaar.group'

const ADDRESS = {
  street: '11 Egerton St',
  suburb: 'Silverwater NSW 2128',
  /** Straight into the directions pane, so the walk-up is one tap on a phone. */
  directions:
    'https://www.google.com/maps/dir/?api=1&destination=' +
    encodeURIComponent('11 Egerton St, Silverwater NSW 2128'),
  /** The hover preview. OpenStreetMap's own embed, so the map costs no API key
   *  and nothing loads until someone actually points at the address. Bounds are
   *  Egerton St, Silverwater, geocoded from Nominatim. */
  map:
    'https://www.openstreetmap.org/export/embed.html' +
    '?bbox=151.0408%2C-33.8369%2C151.0498%2C-33.8325&layer=mapnik&marker=-33.8347%2C151.0453',
}

/* The column heading, and the link with the rule that draws itself in from the
   left as the label steps sideways. */
const HEADING = 'mb-s2 text-xs font-bold uppercase tracking-[0.11em] text-text-on-ink'

const LINK =
  'relative inline-block py-1 text-text-on-ink-2 transition duration-200 ease-brand ' +
  'hover:translate-x-[3px] hover:text-text-on-ink ' +
  'after:absolute after:inset-x-0 after:bottom-0.5 after:h-px after:origin-right ' +
  'after:scale-x-0 after:bg-current after:transition-transform after:duration-300 ' +
  'after:ease-brand hover:after:origin-left hover:after:scale-x-100'

/** A contact row: the icon lights up with the text it sits beside. */
const CONTACT_ROW =
  'group flex gap-s1 text-text-on-ink-2 transition-colors duration-200 hover:text-text-on-ink'

const CONTACT_ICON =
  'mt-0.5 h-4 w-4 shrink-0 text-text-3 transition-colors duration-200 group-hover:text-text-on-ink'

export default function Footer() {
  /** The map iframe is only mounted once somebody has pointed at the address. */
  const [mapWanted, setMapWanted] = useState(false)

  return (
    /* No top margin. There used to be s6 of it, from when this band began at
       the directory below and needed air between itself and whatever light
       section a page had ended on. The letter is the first block now, and it is
       full-bleed dark with its own padding — so that margin had become a strip
       of white between the page and the band, which reads as a gap rather than
       as breathing room. Every page ends on a light section, so this is the
       same decision on all of them. */
    <footer className="bg-ink text-sm text-text-on-ink-2">
      {/* One hairline, gold into green, to close the page off. */}
      <div
        aria-hidden="true"
        className="h-px bg-[linear-gradient(90deg,transparent,rgba(200,155,44,.5),rgba(47,107,90,.5),transparent)]"
      />

      {/* The ask, on the same ink as the directory under it and separated from
          it by one hairline. It is the first room of the footer rather than a
          band of its own above it — see the note at the top of Letter.tsx. */}
      <Letter />

      <div className="gutter mx-auto max-w-page py-s5">
        <div className="grid gap-s4 sm:grid-cols-2 lg:grid-cols-[1.5fr_0.85fr_0.85fr_0.85fr_1.1fr]">
          {/* Who we are, and the one thing you can do from here: follow. */}
          <div className="max-w-[330px]">
            <Link to="/" className="inline-block">
              <img
                src="/assets/images/Al-Anwaar-Logo-White.png"
                alt="Al-Anwaar"
                className="h-11 w-auto transition-opacity duration-200 hover:opacity-80"
              />
            </Link>

            <p className="mt-s3 leading-relaxed">
              Food, water, medicine and schools in Gaza, Yemen, Lebanon, Syria and The
              Gambia, delivered by partners we know and visit.
            </p>

            <h2 className="sr-only">Follow Al-Anwaar</h2>
            <div className="mt-s3 flex gap-s1">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Al-Anwaar on ${label}`}
                  title={label}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-line-ink text-text-on-ink-2 transition duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10 hover:text-text-on-ink"
                >
                  <Icon className="h-[18px] w-[18px]" />
                </a>
              ))}
            </div>
          </div>

          {/* Every page on the site. */}
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className={HEADING}>{col.title}</h2>
              <ul>
                {col.links.map((link) => (
                  <li key={link.to + link.label}>
                    <Link to={link.to} className={LINK}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {/* Reach a person, and find the warehouse. */}
          <div>
            <h2 className={HEADING}>Find us</h2>
            <ul className="space-y-s2">
              <li>
                <a href={`mailto:${EMAIL}`} className={CONTACT_ROW}>
                  <Mail className={CONTACT_ICON} />
                  <span>{EMAIL}</span>
                </a>
              </li>

              <li className="group/map relative">
                <a
                  href={ADDRESS.directions}
                  target="_blank"
                  rel="noreferrer"
                  className={CONTACT_ROW}
                  onMouseEnter={() => setMapWanted(true)}
                  onFocus={() => setMapWanted(true)}
                >
                  <MapPin className={CONTACT_ICON} />
                  <span>
                    <span className="block text-text-on-ink">{ADDRESS.street}</span>
                    <span className="block">{ADDRESS.suburb}</span>
                    <span className="mt-1 inline-flex items-center gap-1 text-[13px] text-text-on-ink underline decoration-line-ink underline-offset-4 transition-colors duration-200 group-hover:decoration-current">
                      Get directions
                      <span
                        aria-hidden="true"
                        className="transition-transform duration-200 group-hover:translate-x-0.5"
                      >
                        &rarr;
                      </span>
                    </span>
                  </span>
                </a>

                {/* The preview. Invisible until the address is hovered or
                    focused, and pointer-transparent so it can never trap the
                    cursor — the click still belongs to the link underneath. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none invisible absolute bottom-full right-0 z-20 mb-s1 w-[280px] translate-y-1 opacity-0 transition duration-200 ease-brand group-focus-within/map:visible group-focus-within/map:translate-y-0 group-focus-within/map:opacity-100 group-hover/map:visible group-hover/map:translate-y-0 group-hover/map:opacity-100"
                >
                  <div className="overflow-hidden rounded-xl border border-line-ink bg-ink-2 shadow-nav">
                    {mapWanted ? (
                      <iframe
                        title="Map of 11 Egerton St, Silverwater"
                        src={ADDRESS.map}
                        loading="lazy"
                        className="block h-[170px] w-full border-0"
                      />
                    ) : (
                      <div className="h-[170px] w-full" />
                    )}
                    <p className="border-t border-line-ink px-s2 py-1.5 text-[12px] text-text-on-ink-2">
                      {ADDRESS.street}, {ADDRESS.suburb}
                    </p>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* The small print. Us on the left, the legal pages on the right. */}
        <div className="mt-s4 flex flex-wrap items-center gap-x-s3 gap-y-s1 border-t border-line-ink pt-s3 text-[13px]">
          <span>&copy; 2026 Al-Anwaar Charity Group Ltd</span>

          <nav aria-label="Legal" className="ml-auto flex flex-wrap gap-x-s3 gap-y-s1">
            <Link to="/privacy" className={LINK}>
              Privacy policy
            </Link>
            <Link to="/terms" className={LINK}>
              Terms &amp; conditions
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
