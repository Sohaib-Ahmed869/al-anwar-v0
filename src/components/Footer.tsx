import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ArrowRight, ArrowUp, Facebook, HandHeart, Instagram, Mail, MapPin } from './icons'
import { MasjidMark } from './Ornament'
import { FACEBOOK, INSTAGRAM } from './social-data'
import { ORG } from './org-data'
import Letter from './Letter'

/* ---------------------------------------------------------------------------
   The footer, on every page.

   REDESIGNED 17 September 2026 at the user's request:
     - the newsletter (Letter.tsx) is a teal card sitting across the join
       between the page and the footer: the top OVERHANG of the footer is
       painted the page's ground, so the card's upper part rests on the page
       and its lower part on the ink
     - under it, on ink, four columns: who we are (logo, one line, a Donate
       button in gold, since that is the give action, and the socials), Give,
       Trust and Join, each link with an arrow that slides in on hover
     - "Find us" as a faint panel with the email and the warehouse address,
       whose map preview still loads only when the address is pointed at
     - one flat ink ground: the teal glow was taken out the same day so the
       card and the columns blend; the masjid watermark came back at the user's
       request, bottom right, with the Find us panel made solid over it
     - the small print row: copyright and ABN, the legal pages, back to top

   Phone numbers and bank details stay off the footer; they are on /contact
   and /give.
--------------------------------------------------------------------------- */

const COLUMNS = [
  {
    title: 'Give',
    links: [
      { label: 'All appeals', to: '/appeals' },
      { label: 'Zakat', to: '/zakat' },
      { label: 'Zakat calculator', to: '/zakat#calculator' },
      { label: 'Community fundraisers', to: '/fundraisers' },
      { label: 'Your giving', to: '/my-giving' },
    ],
  },
  {
    title: 'Trust',
    links: [
      { label: 'Where it goes', to: '/where-it-goes' },
      { label: 'Photo gallery', to: '/gallery' },
      { label: 'Our field partners', to: '/partners#field' },
      { label: 'About us', to: '/about' },
    ],
  },
  {
    title: 'Join',
    links: [
      { label: 'Get involved', to: '/get-involved' },
      { label: 'Volunteer with us', to: '/volunteer' },
      { label: 'Become a partner', to: '/become-a-partner' },
      { label: 'Events', to: '/events' },
      { label: 'Contact us', to: '/contact' },
    ],
  },
]

const SOCIALS = [
  { ...FACEBOOK, Icon: Facebook },
  { ...INSTAGRAM, Icon: Instagram },
]

const ADDRESS = {
  street: '11 Egerton St',
  suburb: 'Silverwater NSW 2128',
  directions:
    'https://www.google.com/maps/dir/?api=1&destination=' +
    encodeURIComponent('11 Egerton St, Silverwater NSW 2128'),
  /** OpenStreetMap's own embed: no API key, and nothing loads until someone
   *  points at the address. */
  map:
    'https://www.openstreetmap.org/export/embed.html' +
    '?bbox=151.0408%2C-33.8369%2C151.0498%2C-33.8325&layer=mapnik&marker=-33.8347%2C151.0453',
}

/** How far the letter card hangs above the footer's ink. */
const OVERHANG = 'clamp(56px,6vw,84px)'

/** Air between the page's last section and the top of the letter card. */
const LEAD = 'clamp(40px,5vw,72px)'

const HEADING = 'relative pb-s1 text-[15px] font-semibold text-paper after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-6 after:rounded-full after:bg-gold-pale'

const LINK =
  'group inline-flex items-center gap-1.5 py-1.5 text-[14.5px] text-text-on-ink-2 transition-colors duration-200 ease-brand hover:text-paper'

export default function Footer() {
  const [mapWanted, setMapWanted] = useState(false)
  const year = new Date().getFullYear()

  const toTop = () =>
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })

  return (
    <footer
      className="relative isolate overflow-hidden text-sm text-text-on-ink-2"
      style={{ paddingTop: LEAD }}
    >
      {/* The ink starts under the middle of the letter card; above it the
          footer is transparent, so the page's own ground runs on with no seam. */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 bg-ink" style={{ top: `calc(${LEAD} + ${OVERHANG})` }} />

      {/* The masjid watermark, low on the right (user's call). The Find us
          panel over it is solid, not translucent, so the mark cannot show
          through it as a lighter patch. */}
      <MasjidMark className="pointer-events-none absolute -right-[3%] -bottom-[8%] -z-10 size-[clamp(260px,30vw,460px)] text-paper/[0.035]" />

      <Letter />

      <div className="gutter mx-auto max-w-page pt-[clamp(56px,6vw,88px)] pb-s4">
        <div className="grid gap-s5 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.35fr] lg:gap-s4">
          {/* ---- who we are ---- */}
          <div className="max-w-[340px]">
            <Link to="/" className="inline-block">
              <img
                src="/assets/images/Al-Anwaar-Logo-White.png"
                alt="Al-Anwaar"
                className="h-11 w-auto transition-opacity duration-200 hover:opacity-80"
              />
            </Link>
            <p className="mt-s3 text-[14.5px] leading-relaxed">
              Food, water and schools in Gaza, Yemen, Lebanon, Syria and The Gambia, delivered by
              partners on the ground.
            </p>

            <div className="mt-s3 flex flex-wrap items-center gap-2">
              <Link
                to="/give"
                className="group inline-flex min-h-[44px] items-center gap-2 rounded-[10px] bg-gold px-4 text-[14.5px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-gold-dark hover:text-paper"
              >
                <HandHeart className="h-4 w-4" />
                Donate
              </Link>
              <h2 className="sr-only">Follow Al-Anwaar</h2>
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Al-Anwaar on ${label}`}
                  title={label}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-paper/[0.06] text-text-on-ink-2 ring-1 ring-paper/10 transition duration-200 ease-brand hover:-translate-y-0.5 hover:bg-teal hover:text-paper hover:ring-teal"
                >
                  <Icon className="h-[18px] w-[18px]" />
                </a>
              ))}
            </div>
          </div>

          {/* ---- every page ---- */}
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className={HEADING}>{col.title}</h2>
              <ul className="mt-s2">
                {col.links.map((link) => (
                  <li key={link.to + link.label}>
                    <Link to={link.to} className={LINK}>
                      <ArrowRight className="-ml-4 h-2.5 w-2.5 opacity-0 transition-[margin,opacity] duration-200 ease-brand group-hover:ml-0 group-hover:opacity-100" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {/* ---- find us ---- */}
          <div className="rounded-2xl bg-[#1e2321] p-s3 ring-1 ring-paper/10 sm:col-span-2 lg:col-span-1">
            <h2 className={HEADING}>Find us</h2>
            <ul className="mt-s3 space-y-s3">
              <li>
                <a
                  href={`mailto:${ORG.email}`}
                  className="group flex items-start gap-s2 transition-colors duration-200 hover:text-paper"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal/40 text-gold-pale">
                    <Mail className="h-4 w-4" />
                  </span>
                  <span className="pt-2 break-all">{ORG.email}</span>
                </a>
              </li>

              <li className="group/map relative">
                <a
                  href={ADDRESS.directions}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start gap-s2 transition-colors duration-200 hover:text-paper"
                  onMouseEnter={() => setMapWanted(true)}
                  onFocus={() => setMapWanted(true)}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal/40 text-gold-pale">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <span className="pt-1.5">
                    <span className="block text-paper">{ADDRESS.street}</span>
                    <span className="block">{ADDRESS.suburb}</span>
                    <span className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-gold-pale">
                      Get directions
                      <ArrowRight className="h-2.5 w-2.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </a>

                {/* The map preview: invisible until the address is hovered or
                    focused, and pointer-transparent so the click still belongs
                    to the link underneath. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none invisible absolute right-0 bottom-full z-20 mb-s1 w-[280px] translate-y-1 opacity-0 transition duration-200 ease-brand group-focus-within/map:visible group-focus-within/map:translate-y-0 group-focus-within/map:opacity-100 group-hover/map:visible group-hover/map:translate-y-0 group-hover/map:opacity-100"
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

        {/* ---- the small print ---- */}
        <div className="mt-s5 flex flex-col gap-s2 border-t border-paper/10 pt-s3 text-[13px] sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} Al-Anwaar Charity Group Ltd <span className="text-paper/30">·</span>{' '}
            <span className="nums">ABN {ORG.abn}</span>
          </p>
          <div className="flex flex-wrap items-center gap-x-s3 gap-y-s1">
            <nav aria-label="Legal" className="flex flex-wrap gap-x-s3 gap-y-s1">
              <Link to="/privacy" className="transition-colors duration-200 hover:text-paper">
                Privacy policy
              </Link>
              <Link to="/terms" className="transition-colors duration-200 hover:text-paper">
                Terms &amp; conditions
              </Link>
            </nav>
            <button
              type="button"
              onClick={toTop}
              className="group inline-flex items-center gap-2 text-paper/80 transition-colors duration-200 hover:text-paper"
            >
              Back to top
              <span className="flex size-8 items-center justify-center rounded-full ring-1 ring-paper/20 transition-[background-color,box-shadow] duration-200 group-hover:bg-teal group-hover:ring-teal">
                <ArrowUp className="h-3 w-3" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
