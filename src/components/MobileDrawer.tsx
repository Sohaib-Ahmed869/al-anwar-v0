import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

import { NAV, PHONE } from './nav-data'
import { Close } from './icons'

type Props = {
  open: boolean
  onClose: () => void
}

/* The phone menu. It carries the whole of NAV rather than a shortened copy, so
   a link added to the desktop panels turns up here too. Sections are native
   <details>, which means the open/close behaviour is the browser's. */
export default function MobileDrawer({ open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  /* The page behind must not scroll while the drawer is over it. */
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  /* Escape closes it, and Tab is kept inside it. */
  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), summary',
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  /* Opening moves focus into the drawer; Header hands it back to the burger. */
  useEffect(() => {
    if (open) panelRef.current?.querySelector('button')?.focus()
  }, [open])

  return (
    <div
      id="mobile-drawer"
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      inert={!open}
      className={`gutter fixed inset-0 z-100 overflow-y-auto overscroll-contain bg-paper pb-s4 transition-transform duration-200 ease-brand lg:hidden ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="mb-s1 flex h-16 items-center justify-between border-b border-line">
        <img
          src="/assets/images/Al-Anwaar-Logo-600x136.png"
          alt="Al-Anwaar"
          width={600}
          height={136}
          className="h-8 w-auto"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="-mr-2 rounded-[9px] p-2 transition-colors duration-200 hover:bg-ink/5"
        >
          <Close className="h-6 w-6" />
        </button>
      </div>

      {NAV.map((section) =>
        /* Nothing to expand reads as a row rather than an accordion. Note this
           asks the data, not the layout: Zakat and About are plain links in the
           bar but keep their accordions here, so their sub-pages stay reachable
           on a phone. */
        section.columns.length === 0 ? (
          <Link
            key={section.id}
            to={section.to ?? '/'}
            onClick={onClose}
            className="flex items-center justify-between border-b border-line py-[18px] font-display text-[28px]"
          >
            {section.label}
          </Link>
        ) : (
          <details key={section.id} className="group border-b border-line">
            <summary className="flex cursor-pointer list-none items-center justify-between py-[18px] font-display text-[28px] [&::-webkit-details-marker]:hidden">
              {section.label}
              <span
                aria-hidden="true"
                className="font-sans text-2xl text-text-2 transition-transform duration-200 ease-brand group-open:rotate-45"
              >
                +
              </span>
            </summary>

            <ul className="m-0 list-none p-0 pb-s2">
              {[
                ...section.columns.flatMap((col) => col.links),
                ...(section.feature?.inDrawer ? [section.feature.cta] : []),
              ].map((link) => (
                  <li key={`${section.id}-${link.label}`}>
                    {/* Same split as the desktop panel: an absolute URL has to
                        be a plain <a> or react-router treats it as a path. It
                        still closes the drawer on the way out, so coming back
                        does not land on an open menu. See nav-data.ts. */}
                    {link.external ? (
                      <a
                        href={link.to}
                        target="_blank"
                        rel="noreferrer"
                        onClick={onClose}
                        className="block py-2 text-[17px] text-text"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.to}
                        onClick={onClose}
                        className={`block py-2 text-[17px] ${
                          link.tone === 'alert'
                            ? 'font-semibold text-alert'
                            : link.tone === 'index'
                              ? 'font-semibold text-green'
                              : 'text-text'
                        }`}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
            </ul>
          </details>
        ),
      )}

      {/* The bar's Sign in and the contact details, which only appear above
          this width, land here instead. */}
      <div className="mt-7 grid gap-3 border-t border-line pt-5 text-[15px]">
        <Link to="/give" onClick={onClose} className="font-semibold text-gold-dark">
          Donate
        </Link>
        <a href={PHONE.href} className="nums text-text-2">
          {PHONE.label} &middot; {PHONE.hours}
        </a>
        <Link to="/account" onClick={onClose} className="text-text-2">
          Sign in to your giving
        </Link>
      </div>
    </div>
  )
}
