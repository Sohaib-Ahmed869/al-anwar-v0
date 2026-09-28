import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { CRISIS, PLACES, appealBySlug } from './appeals-data'
import MobileDrawer from './MobileDrawer'
import { NAV, activeSection, type NavFeature, type NavSection } from './nav-data'
import { ArrowRight, ChevronDown, HandHeart, Menu, User } from './icons'

/* The emergency strip is dismissible for a week, the way the prototype's
   "Dismiss for 7 days" button promises. */
const DISMISSED_KEY = 'alanwaar:emergency-dismissed'
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

/* Hover intent. The first menu waits a beat so the pointer can cross the bar
   without flashing a panel open; once one is showing, the rest swap instantly. */
const OPEN_DELAY = 90
const CLOSE_DELAY = 220
/* Hover intent inside the Appeals panel. The feature photograph only follows a
   link the pointer has rested on this long, so sweeping across the columns on
   the way to the Donate now button does not change what it shows. Keyboard
   focus is deliberate, and swaps it at once. */
const FEATURE_DELAY = 200

/* A box measured against the header's inner wrap, and a horizontal span
   measured against the nav list. These are what the three shared indicators —
   the hover pill, the current-section rule and the panel surface — travel to. */
type Box = { x: number; y: number; w: number; h: number }
type Span = { x: number; w: number }

/** The routes that open on a full-bleed photograph, over which the bar is
 *  transparent until it has something to cover. */
const OVERLAY_ROUTES = ['/', '/privacy', '/terms', '/contact', '/zakat', '/give', '/appeals', '/where-it-goes', '/get-involved', '/ramadan', '/dhul-hijjah', '/fundraisers', '/events', '/gallery', '/volunteer', '/partners', '/become-a-partner']

/* The live crisis, from the one place it is written down. See appeals-data.ts. */
const crisis = appealBySlug(CRISIS?.slug)

export default function Header() {
  const location = useLocation()
  const current = activeSection(location.pathname)

  /* --- the bar in the hero, rather than on a shelf above it ---------------
     Some pages open on a full-bleed photograph and the header is meant to sit
     inside it. On those routes the bar starts with no ground under it and light
     type over the picture, and takes its paper back the moment it has something
     to cover: once you are past the top, while a menu panel is open
     — a white sheet hanging off a transparent bar reads as a bug — or while
     the drawer is out. Every other page has no hero to blend into and is solid
     from the first frame.

     Anything added here must pull itself up behind the bar the way HomeHero and
     LegalHero do, or the header will float over nothing. */
  const overlay =
    OVERLAY_ROUTES.includes(location.pathname) ||
    location.pathname.startsWith('/appeals/') ||
    /* a single fundraiser has a photo hero; the start form does not */
    (location.pathname.startsWith('/fundraisers/') && location.pathname !== '/fundraisers/start')

  const [openId, setOpenId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  /* Whether the overlay hero has finished passing under the bar. Always true on
     a page that has no hero to sit in. */
  const [pastHero, setPastHero] = useState(true)
  const [emergency, setEmergency] = useState(isEmergencyLive)

  const stripRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLUListElement>(null)
  const burgerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef(new Map<string, HTMLElement>())
  const panelRefs = useRef(new Map<string, HTMLElement>())
  const openTimer = useRef<number | undefined>(undefined)
  const closeTimer = useRef<number | undefined>(undefined)
  /* Escape closes a panel and puts focus back on its button — without this the
     button's own focus handler would immediately reopen what we just closed. */
  const suppressOpen = useRef(false)

  /* --- the two shared indicators ----------------------------------------
     One pill slides between nav items instead of every item lighting its own
     background, and one surface — the rounded, shadowed sheet the panels are
     drawn on — glides and resizes from menu to menu. Keeping both as single
     elements is what makes the bar read as one object rather than six.

     There is no third. A 2px rule used to sit under the current section; it is
     gone, and the section you are in is now said by the label itself — the
     weight and the accent colour in NavItem, with the pill resting on it. */
  const [pill, setPill] = useState<Span | null>(null)
  const [surface, setSurface] = useState<Box | null>(null)
  /* The surface only travels between two open menus. Opening from closed it
     must arrive already in place, or it flies in from the last menu you used. */
  const [glide, setGlide] = useState(false)
  const lastOpen = useRef<string | null>(null)

  /* An open menu wins over the pointer, the pointer over where you are. */
  const highlight = openId ?? hoverId ?? current

  /* Whether the bar is currently a surface. Everything in it that carries a
     colour reads this one flag rather than testing the route again.

     Opening a menu deliberately does NOT make it one. The panel used to force
     the bar solid so a white sheet had something white to hang off, and the
     result was a white box dropped on the photograph. The sheet is frosted dark
     over the hero instead — see the surface below — so the bar can stay out of
     the way and the whole menu reads as glass laid on the picture. */
  const solid = !overlay || pastHero || drawerOpen

  /* Whether the bar is carrying the page rather than sitting at the top of it:
     an ordinary page once you are past the top, a hero page once the hero has
     gone by. It buys elevation and a slightly denser ground, and nothing else —
     the bar's height and everything in it stay put. See the bar wrap below. */
  const compact = overlay ? pastHero : scrolled

  const closePanels = useCallback(() => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
    setOpenId(null)
  }, [])

  const measure = useCallback(() => {
    /* Everything is measured against the header wrap, and nothing else in the
       bar is allowed to be `relative`: the mega panel spans the content column
       by way of this same containing block, and a positioned <ul> in between
       would collapse it to the width of the nav. */
    const bar = barRef.current
    if (bar) {
      const barBox = bar.getBoundingClientRect()
      const span = (id: string | null): Span | null => {
        const el = id ? itemRefs.current.get(id) : null
        if (!el) return null
        const box = el.getBoundingClientRect()
        return { x: box.left - barBox.left, w: box.width }
      }
      /* Nothing to point at keeps the last box and only fades out — an
         indicator that flew back to zero on the way out reads as a glitch. */
      const next = span(highlight)
      if (next) setPill(next)
    }

    const panel = openId ? panelRefs.current.get(openId) : null
    if (bar && panel) {
      /* The panel keeps its natural, untransformed box at all times — every
         entrance animation lives on its children — so this measurement is
         honest even in the middle of one. */
      const a = panel.getBoundingClientRect()
      const b = bar.getBoundingClientRect()
      setSurface({ x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height })
    }
  }, [highlight, openId])

  /* `current` is in here because the section you are in is set in semibold, so
     moving it changes two items' widths — and `highlight` alone does not catch
     it: click the item you are already hovering and the pill's target never
     changes while the label under it grows. */
  useLayoutEffect(() => {
    setGlide(lastOpen.current !== null && openId !== null)
    measure()
    lastOpen.current = openId
  }, [measure, openId, current])

  /* --- how tall the chrome above the fold is ----------------------------
     The emergency strip is not sticky and it wraps to two lines on a phone, so
     its height is a live number rather than a constant. The home hero takes it
     off 100svh to come out exactly one screen tall; nothing else reads it.
     Before paint, not after: the hero's height is bound to this, and measuring
     it a frame late is a 44px jolt on every first load. */
  useLayoutEffect(() => {
    const root = document.documentElement
    const el = stripRef.current
    if (!el) {
      root.style.setProperty('--strip-h', '0px')
      return
    }
    const write = () => root.style.setProperty('--strip-h', `${el.offsetHeight}px`)
    write()
    const ro = new ResizeObserver(write)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.setProperty('--strip-h', '0px')
    }
  }, [emergency])

  /* Widths move when the window does, and again when the webfonts land. */
  useEffect(() => {
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    document.fonts?.ready.then(measure).catch(() => {})
    return () => window.removeEventListener('resize', onResize)
  }, [measure])

  /* --- where the bar stops being part of the picture --------------------
     Two thresholds rather than one, so a page resting near the line cannot sit
     there switching: it takes 80px to earn the background and a climb back
     under 40 to give it up.

     A hero gets measured instead of guessed. 80px of scroll is nothing against a
     section a whole screen tall, and turning the bar to paper there dropped a
     white shelf over a photograph that was still running behind it. So the bar
     holds its transparency while any part of the hero is still under it, and
     changes exactly when the section's bottom edge passes the bar's own bottom
     edge — the first moment there would otherwise be light page behind light
     type. Sections opt in with data-overlay-hero rather than the header knowing
     their heights. The bar is a fixed height, so that edge is a fixed number and
     the crossing cannot move itself. */
  useEffect(() => {
    let ticking = false
    const read = () => {
      ticking = false
      const y = window.scrollY
      setScrolled((was) => (was ? y > 40 : y > 80))

      const hero = document.querySelector('[data-overlay-hero]')
      const bar = barRef.current
      setPastHero(!hero || hero.getBoundingClientRect().bottom <= (bar?.offsetHeight ?? 0))
    }
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(read)
    }
    /* Re-read on navigation too: arriving on a hero page from a scrolled one
       changes what is behind the bar without anybody scrolling. */
    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [location.key])

  /* --- anything that leaves the nav closes it ----------------------------- */
  useEffect(() => {
    const outside = (e: Event) => {
      const target = e.target as Node | null
      if (target && !navRef.current?.contains(target)) {
        closePanels()
        setHoverId(null)
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
    }
  }, [closePanels])

  /* Navigating always puts the menus away, however you got there. */
  useEffect(() => {
    closePanels()
    setHoverId(null)
    setDrawerOpen(false)
  }, [location.key, closePanels])

  useEffect(
    () => () => {
      window.clearTimeout(openTimer.current)
      window.clearTimeout(closeTimer.current)
    },
    [],
  )

  const openPanel = (id: string) => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
    setOpenId(id)
  }

  const handleEnter = (id: string, hasPanel: boolean) => {
    setHoverId(id)
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
    if (!hasPanel) {
      /* A plain link takes the pill with it but must also send an open panel
         away, or Zakat sits highlighted underneath the Appeals menu. */
      closeTimer.current = window.setTimeout(() => setOpenId(null), CLOSE_DELAY)
      return
    }
    openTimer.current = window.setTimeout(() => setOpenId(id), openId ? 0 : OPEN_DELAY)
  }

  const handleLeave = () => {
    setHoverId(null)
    window.clearTimeout(openTimer.current)
    closeTimer.current = window.setTimeout(() => setOpenId(null), CLOSE_DELAY)
  }

  /* Escape out, arrows down the list — the keyboard contract people expect
     from a menu bar. */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLLIElement>, id: string) => {
    const li = e.currentTarget

    if (e.key === 'Escape') {
      closePanels()
      suppressOpen.current = true
      li.querySelector('button')?.focus()
      window.setTimeout(() => {
        suppressOpen.current = false
      }, 0)
      return
    }

    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    if (openId !== id) {
      openPanel(id)
      return
    }
    const links = Array.from(li.querySelectorAll<HTMLAnchorElement>('[data-panel] a'))
    if (!links.length) return
    const at = links.indexOf(document.activeElement as HTMLAnchorElement)
    if (e.key === 'ArrowDown') (links[at + 1] ?? links[0]).focus()
    else (links[at - 1] ?? li.querySelector('button'))?.focus()
  }

  /* The panel nearest the right edge opens right-aligned, so a 520px-wide one
     hanging off a button late in the bar cannot run off screen at ~1024px.
     Counted over panelled sections only — a plain link has nothing to align. */
  const rightAligned = new Set(
    NAV.filter((s) => s.layout !== 'link')
      .slice(-1)
      .map((s) => s.id),
  )

  const dismissEmergency = () => {
    setEmergency(false)
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    } catch {
      /* private browsing: the strip simply comes back next visit */
    }
  }

  const registerItem = (id: string) => (el: HTMLElement | null) => {
    if (el) itemRefs.current.set(id, el)
    else itemRefs.current.delete(id)
  }

  const registerPanel = (id: string) => (el: HTMLElement | null) => {
    if (el) panelRefs.current.set(id, el)
    else panelRefs.current.delete(id)
  }

  return (
    <>
      <a
        href="#main"
        className="sr-only rounded-lg bg-ink px-s3 py-s2 text-text-on-ink focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200]"
      >
        Skip to content
      </a>

      {/* ---------- emergency strip: whatever crisis is live ---------- */}
      {emergency && crisis && (
        <div
          ref={stripRef}
          className="relative bg-[linear-gradient(90deg,var(--color-alert),#8c2f14)] text-[15px] text-paper"
        >
          <div className="gutter mx-auto flex max-w-page flex-wrap items-center gap-x-4 gap-y-1.5 py-2 pr-11 md:min-h-[44px] md:flex-nowrap md:py-0 md:pr-0">
            <p className="m-0 flex items-start gap-2.5">
              {/* it is happening right now, and says so without a word. Aligned
                  to the first line rather than centred, because on a phone the
                  sentence wraps and a centred dot floats away from it. */}
              <span aria-hidden="true" className="relative mt-[0.52em] flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-paper/80" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-paper" />
              </span>
              <span>
                <strong className="font-semibold">{PLACES[crisis.country]}</strong> {CRISIS?.line}
              </span>
            </p>
            <Link
              to={`/appeals/${crisis.slug}`}
              className="group/strip basis-full whitespace-nowrap md:ml-auto md:basis-auto"
            >
              {/* the rule retracts rather than appears — the link is already
                  underlined, so hovering it has somewhere to go */}
              <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:100%_1px] bg-[position:0_1.15em] bg-no-repeat pb-px transition-[background-size] duration-300 ease-brand group-hover/strip:bg-[length:0%_1px]">
                {CRISIS?.cta}
              </span>
              <ArrowRight className="ml-1.5 inline-block h-3 w-3 -translate-x-0.5 transition-transform duration-300 ease-brand group-hover/strip:translate-x-0.5" />
            </Link>
            <button
              type="button"
              onClick={dismissEmergency}
              aria-label="Dismiss for 7 days"
              className="absolute top-1.5 right-2 rounded-md px-1.5 py-1 text-[22px] leading-none transition-colors duration-200 hover:bg-paper/15 md:static md:top-auto"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* ---------- the header ---------- */}
      <header
        /* The gradient in `before` is the middle state, and it is the whole reason
           the bar can stay out of the picture for a full screen. At rest it is
           off: the hero's own scrim is already dark under the nav. The moment
           the page starts moving, hero content — a 48px headline, the Donate
           button — begins passing behind a bar that has no ground of its own, so
           this fades in and veils whatever is travelling under it. It stops dead
           at the bar's own bottom edge — reaching past it smeared a grey band
           over the white section for the few pixels of scroll between the hero
           leaving and the bar taking its paper — and it sits at z-index -1
           inside the header, which puts it over the page and under the nav. */
        className={`sticky top-0 z-50 transition-[background-color,box-shadow] duration-300 ease-brand before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:bottom-0 before:z-[-1] before:bg-[linear-gradient(180deg,rgba(21,26,24,0.95)_0%,rgba(21,26,24,0.86)_46%,rgba(21,26,24,0.46)_78%,transparent_100%)] before:transition-opacity before:duration-300 before:ease-brand before:content-[''] after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-[linear-gradient(90deg,transparent,var(--color-line-2)_8%,var(--color-line)_50%,var(--color-line-2)_92%,transparent)] after:transition-opacity after:duration-300 after:content-[''] ${
          !solid
            ? /* no paper up here — the picture carries on behind the bar, veiled
                 by the gradient above once anything is moving under it */
              `bg-transparent shadow-none after:opacity-0 ${
                scrolled ? 'before:opacity-100' : 'before:opacity-0'
              }`
            : compact
              ? 'bg-paper/92 shadow-[0_10px_30px_-18px_rgba(20,26,24,0.26)] backdrop-blur-[18px] backdrop-saturate-150 before:opacity-0 after:opacity-100'
              : 'bg-paper/85 shadow-none backdrop-blur-[18px] backdrop-saturate-150 before:opacity-0 after:opacity-100'
        }`}
      >
        {/* One height, always --header-h, and nothing inside it changes size
            either. The bar used to shrink by 16px once you were past the hero,
            and because it sits in normal flow that made the document 16px
            shorter at exactly the moment you were watching the seam: the page
            jumped up under the bar going down and back down coming up. Scrolled
            is now a change of colour and elevation only — no geometry, so
            nothing can move. Anything added here must keep that property. */}
        <div
          ref={barRef}
          className="gutter relative mx-auto flex h-[var(--header-h)] max-w-page items-center gap-3 md:gap-s3 lg:gap-3 xl:gap-s3"
        >
          {/* The one sheet every menu is drawn on. It is painted before the nav
              so the panel contents sit over it, and between two open menus it
              is the only thing that moves. */}
          {surface && (
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute top-0 left-0 rounded-2xl border ease-brand ${
                solid
                  ? 'border-line-2 bg-paper shadow-nav'
                  : /* glass, over the hero: the photograph carries on through it,
                       blurred, and the panel belongs to the picture rather than
                       sitting on top of it */
                    'border-paper/15 bg-ink/70 shadow-[0_28px_70px_-28px_rgba(0,0,0,0.75)] backdrop-blur-2xl backdrop-saturate-150'
              } ${openId ? 'opacity-100' : 'opacity-0'}`}
              style={{
                transform: `translate3d(${surface.x}px, ${surface.y}px, 0)`,
                width: surface.w,
                height: surface.h,
                transitionProperty: glide ? 'transform, width, height, opacity' : 'opacity',
                transitionDuration: glide ? '400ms' : '200ms',
                willChange: 'transform, width, height',
              }}
            />
          )}

          <Link
            to="/"
            aria-label="Al-Anwaar home"
            className="group relative flex shrink-0 items-center transition-transform duration-300 ease-brand hover:-translate-y-px"
          >
            {/* Both marks are in the DOM and cross-fade with the bar's ground,
                so the swap is not a blink of a mark that has not loaded yet.
                The white one is decorative — the dark one carries the name. */}
            <img
              src="/assets/images/Al-Anwaar-Logo-600x136.png"
              alt="Al-Anwaar Charity"
              width={600}
              height={136}
              className={`h-8 w-auto transition-opacity duration-300 ease-brand lg:h-10 ${
                solid ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <img
              src="/assets/images/Al-Anwaar-Logo-White.png"
              alt=""
              aria-hidden="true"
              width={950}
              height={216}
              className={`absolute left-0 h-8 w-auto transition-opacity duration-300 ease-brand lg:h-10 ${
                solid ? 'opacity-0' : 'opacity-100'
              }`}
            />
          </Link>

          {/* The pill follows the pointer, and rests on the section you are in
              when nothing else is asking for it — see `highlight` above. */}
          {pill && (
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute top-1/2 left-0 hidden h-10 rounded-[10px] transition-[transform,width,opacity,background-color] duration-[320ms] ease-brand lg:block ${
                solid ? 'bg-green/[0.075]' : 'bg-paper/[0.14]'
              } ${highlight ? 'opacity-100' : 'opacity-0'}`}
              style={{ transform: `translate3d(${pill.x}px, -50%, 0)`, width: pill.w }}
            />
          )}
          <ul
            ref={navRef}
            className="ml-3 hidden h-full flex-1 items-center gap-0 lg:flex xl:ml-[clamp(10px,2.4vw,36px)] xl:gap-0.5"
          >
            {NAV.map((section) => (
              <NavItem
                key={section.id}
                section={section}
                open={openId === section.id}
                current={current === section.id}
                alignRight={rightAligned.has(section.id)}
                onDark={!solid}
                itemRef={registerItem(section.id)}
                panelRef={registerPanel(section.id)}
                onEnter={() => handleEnter(section.id, section.layout !== 'link')}
                onLeave={handleLeave}
                onToggle={() => (openId === section.id ? closePanels() : openPanel(section.id))}
                onFocus={() => {
                  setHoverId(section.id)
                  if (!suppressOpen.current && section.layout !== 'link') openPanel(section.id)
                }}
                onBlur={() => setHoverId(null)}
                onKeyDown={(e) => handleKeyDown(e, section.id)}
              />
            ))}
          </ul>

          <div className="ml-auto flex shrink-0 items-center gap-1 lg:ml-3.5 lg:gap-2">
            {/* the actions are a different kind of thing from the nav, and the
                hairline says so before you have read either */}
            <span
              aria-hidden="true"
              className={`mr-1.5 hidden h-5 w-px transition-colors duration-300 ease-brand xl:block ${
                solid ? 'bg-line-2' : 'bg-paper/25'
              }`}
            />

            {/* Quiet, so it never competes with the gold beside it. Below lg the
                drawer carries it instead. */}
            <Link
              to="/account"
              aria-label="Sign in"
              className={`group hidden h-10 items-center gap-2 rounded-[10px] px-2.5 text-[15px] font-medium transition-colors duration-200 ease-brand lg:flex xl:px-3 ${
                solid
                  ? `hover:bg-ink/[0.045] hover:text-ink ${
                      location.pathname.startsWith('/account') ? 'text-ink' : 'text-text-2'
                    }`
                  : `hover:bg-paper/10 hover:text-paper ${
                      location.pathname.startsWith('/account') ? 'text-paper' : 'text-text-on-ink-2'
                    }`
              }`}
            >
              <User className="h-4 w-4 shrink-0 opacity-55 transition-opacity duration-200 ease-brand group-hover:opacity-100" />
              {/* between the drawer breakpoint and xl the bar is full; the word
                  goes and the mark carries it, with the name on the element */}
              <span className="hidden xl:inline">Sign in</span>
            </Link>

            {/* Gold is the give action and nothing else. See DESIGN-NOTES.md.
                The sheen is the one flourish in the bar, and it is here because
                this is the button the whole header exists to serve. */}
            <Link
              to="/give"
              className="group relative flex min-h-[46px] items-center gap-2 overflow-hidden rounded-[10px] bg-gold px-4 font-semibold tracking-[-0.006em] text-ink shadow-gold transition-[transform,box-shadow,background-color,color] duration-200 ease-brand hover:-translate-y-[1.5px] hover:bg-gold-dark hover:text-paper hover:shadow-gold-lg active:translate-y-0 sm:px-5 xl:px-6"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 -left-full w-full bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,0.55)_50%,transparent_80%)] transition-transform duration-[750ms] ease-brand group-hover:translate-x-[250%]"
              />
              <HandHeart className="relative h-4 w-4 shrink-0 transition-transform duration-300 ease-brand group-hover:scale-[1.14]" />
              <span className="relative">Donate</span>
            </Link>
          </div>

          <button
            ref={burgerRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            aria-controls="mobile-drawer"
            className={`-mr-1 rounded-[10px] p-2 transition-colors duration-200 lg:hidden ${
              solid ? 'hover:bg-ink/5' : 'text-text-on-ink hover:bg-paper/10'
            }`}
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      <MobileDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          burgerRef.current?.focus()
        }}
      />
    </>
  )
}

/* -------------------------------------------------------------------------- */

function toneClass(tone: 'index' | 'alert' | undefined, onDark: boolean) {
  if (tone === 'index')
    return onDark
      ? 'mt-2.5 border-t border-paper/15 pt-3 font-semibold text-green-pale hover:bg-paper/10'
      : 'mt-2.5 border-t border-line-2 pt-3 font-semibold text-green hover:bg-green/[0.06]'
  if (tone === 'alert')
    return onDark
      ? 'mt-3.5 font-semibold text-alert-pale hover:bg-alert-pale/10'
      : 'mt-3.5 font-semibold text-alert hover:bg-alert/[0.06]'
  return onDark
    ? 'text-text-on-ink hover:bg-paper/10 hover:text-paper'
    : 'text-text hover:bg-green/[0.06] hover:text-green'
}

type NavItemProps = {
  section: NavSection
  open: boolean
  current: boolean
  alignRight: boolean
  /** the bar is transparent over the hero, so the labels have to be light */
  onDark: boolean
  itemRef: (el: HTMLElement | null) => void
  panelRef: (el: HTMLElement | null) => void
  onEnter: () => void
  onLeave: () => void
  onToggle: () => void
  onFocus: () => void
  onBlur: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLLIElement>) => void
}

function NavItem({
  section,
  open,
  current,
  alignRight,
  onDark,
  itemRef,
  panelRef,
  onEnter,
  onLeave,
  onToggle,
  onFocus,
  onBlur,
  onKeyDown,
}: NavItemProps) {
  /* No per-item background: the shared pill in Header does that job, and it
     rests on the current section whenever the pointer is not asking for it
     elsewhere. What is left here is the type itself.

     Three states, and the section you are in has to survive the pill leaving to
     follow a hover, so it is the only one that carries weight as well as colour
     — that is what replaced the rule that used to run under it. An open menu
     takes the accent but not the weight, so it cannot be mistaken for where you
     are. The width does change when `current` moves — Header re-measures the
     pill on it; it only ever happens on a navigation. */
  const label = `relative z-1 flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-[15.5px] tracking-[-0.008em] whitespace-nowrap transition-colors duration-200 ease-brand xl:px-[15px] ${
    current ? 'font-semibold' : 'font-medium'
  } ${
    onDark
      ? open || current
        ? 'text-paper'
        : 'text-text-on-ink hover:text-paper'
      : open || current
        ? 'text-green'
        : 'text-text hover:text-green'
  }`

  /* A section with nothing under it is just a link — no chevron, no panel, and
     none of the keyboard machinery that goes with one. */
  if (section.layout === 'link') {
    return (
      <li
        className="flex h-full list-none items-center"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <Link
          ref={itemRef}
          to={section.to ?? '/'}
          className={label}
          onFocus={onFocus}
          onBlur={onBlur}
        >
          {section.label}
        </Link>
      </li>
    )
  }

  const mega = section.layout === 'mega'

  /* The feature the panel is showing. It starts on the section's own, follows
     links in a `drivesFeature` column after FEATURE_DELAY, and stays on the
     last one when the pointer leaves the columns, so it is still there when
     the pointer reaches its button. Closing the panel puts it back. */
  const [shown, setShown] = useState<NavFeature | undefined>(section.feature)
  const featureTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!open) {
      window.clearTimeout(featureTimer.current)
      setShown(section.feature)
    }
  }, [open, section.feature])
  useEffect(() => () => window.clearTimeout(featureTimer.current), [])
  const intend = (f: NavFeature | undefined) => {
    window.clearTimeout(featureTimer.current)
    if (f) featureTimer.current = window.setTimeout(() => setShown(f), FEATURE_DELAY)
  }
  const cancelIntent = () => window.clearTimeout(featureTimer.current)
  const feature = shown ?? section.feature

  return (
    <li
      /* the mega panel measures itself against the header, not the button, so
         that one li opts out of being a positioning context */
      className={`flex h-full list-none items-center ${mega ? 'static' : 'relative'}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onKeyDown={onKeyDown}
    >
      <button
        ref={itemRef}
        type="button"
        id={`nav-${section.id}`}
        aria-expanded={open}
        aria-controls={`panel-${section.id}`}
        onClick={onToggle}
        onFocus={onFocus}
        onBlur={onBlur}
        className={label}
      >
        {section.label}
        <ChevronDown
          className={`h-[11px] w-[11px] transition-[transform,opacity] duration-300 ease-brand ${
            open ? 'rotate-180 opacity-90' : 'opacity-45'
          }`}
        />
      </button>

      {/* The geometry box. It carries no surface of its own — Header draws the
          one sheet for every menu — and it is never transformed, so it can be
          measured accurately at any point in an animation. */}
      <div
        ref={panelRef}
        id={`panel-${section.id}`}
        data-panel=""
        aria-labelledby={`nav-${section.id}`}
        inert={!open}
        /* Leaving is faster than arriving. The sheet takes 400ms to travel
           between two menus; content that faded at the same rate would be left
           hanging over the page outside it. */
        style={{ transitionDuration: open ? '200ms' : '110ms' }}
        className={`absolute top-[calc(100%+10px)] z-1 transition-opacity ease-brand ${
          /* the ground the sheet is drawn on decides the ink: anything in here
             without a colour of its own inherits from this one place */
          onDark ? 'text-text-on-ink' : ''
        } ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'} ${
          mega
            ? /* four columns and the feature, spaced tighter than the old
                 three so the panel still fits the content column at 1024px */
              'right-[var(--gutter)] left-[var(--gutter)] grid grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.3fr)] gap-5 px-6 py-[28px] xl:gap-[28px] xl:px-[30px]'
            : `px-[30px] py-[26px] ${alignRight ? 'right-0' : 'left-0'} ${
                section.layout !== 'two'
                  ? 'min-w-[290px]'
                  : section.feature
                    ? 'grid min-w-[600px] grid-cols-[minmax(0,1fr)_250px] gap-8'
                    : 'grid min-w-[520px] grid-cols-2 gap-10'
              }`
        }`}
      >
        {/* an invisible bridge, so the pointer can cross the gap to the panel
            without the menu deciding it has been left */}
        <span aria-hidden="true" className="absolute inset-x-0 -top-4 h-4" />

        {section.columns.map((col, i) => (
          <div
            key={col.title ?? i}
            /* the columns arrive left to right, a beat behind the sheet */
            style={{
              transitionDelay: open ? `${70 + i * 45}ms` : '0ms',
              transitionDuration: open ? '300ms' : '110ms',
            }}
            className={`transition-[opacity,transform] ease-brand ${
              open ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0'
            }`}
          >
            {col.title && (
              <p
                className={`mb-3 border-b pb-2.5 text-[11.5px] font-semibold tracking-[0.09em] uppercase ${
                  onDark ? 'border-paper/15 text-paper/45' : 'border-line-2 text-text-3'
                }`}
              >
                {col.title}
              </p>
            )}

            <ul className="m-0 list-none p-0">
              {col.links.map((link) => {
                const drives = col.drivesFeature && link.feature
                /* the link the photograph is currently about, once it is not
                   the default any more */
                const showing = drives && link.feature === feature && feature !== section.feature
                return (
                <li
                  key={link.label}
                  onMouseEnter={drives ? () => intend(link.feature) : undefined}
                  onMouseLeave={drives ? cancelIntent : undefined}
                  onFocus={
                    drives
                      ? () => {
                          cancelIntent()
                          setShown(link.feature)
                        }
                      : undefined
                  }
                >
                  {/* A link that leaves the site is a plain <a>: react-router
                      reads an absolute URL as a path and would route to
                      /https://…. The arrow tips over to point out of the page
                      so the two kinds are told apart without a second icon.
                      See `external` in nav-data.ts. */}
                  {link.external ? (
                    <a
                      href={link.to}
                      target="_blank"
                      rel="noreferrer"
                      className={`group/link -mx-2.5 flex items-center justify-between gap-3 rounded-[8px] px-2.5 py-[7px] text-[15.5px] transition-[background-color,color,transform] duration-150 ease-brand hover:translate-x-[3px] ${toneClass(
                        link.tone
                      , onDark)}`}
                    >
                      <span>{link.label}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 -translate-x-1 -rotate-45 opacity-0 transition-[transform,opacity] duration-200 ease-brand group-hover/link:translate-x-0 group-hover/link:opacity-100" />
                    </a>
                  ) : (
                    <Link
                      to={link.to}
                      className={`group/link -mx-2.5 flex items-center justify-between gap-3 rounded-[8px] px-2.5 py-[7px] text-[15.5px] transition-[background-color,color,transform] duration-150 ease-brand hover:translate-x-[3px] ${toneClass(
                        link.tone
                      , onDark)} ${showing ? (onDark ? 'bg-paper/10 text-paper' : 'bg-green/[0.06] text-green') : ''}`}
                    >
                      <span>
                        {link.label}
                        {link.note && (
                          <span
                            className={`mt-0.5 block text-[13px] leading-snug ${
                              onDark ? 'text-paper/50' : 'text-text-3'
                            }`}
                          >
                            {link.note}
                          </span>
                        )}
                      </span>
                      <ArrowRight className="h-3 w-3 shrink-0 -translate-x-1 opacity-0 transition-[transform,opacity] duration-200 ease-brand group-hover/link:translate-x-0 group-hover/link:opacity-100" />
                    </Link>
                  )}
                </li>
                )
              })}
            </ul>
          </div>
        ))}

        {feature && (
          <div
            style={{
              transitionDelay: open ? `${70 + section.columns.length * 45}ms` : '0ms',
              transitionDuration: open ? '300ms' : '110ms',
            }}
            className={`group flex min-w-0 flex-col border-l pl-5 transition-[opacity,transform] ease-brand xl:pl-[26px] ${
              onDark ? 'border-paper/15' : 'border-line-2'
            } ${open ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0'}`}
          >
            <div className="relative h-[170px] overflow-hidden rounded-[10px] bg-sand">
              {/* keyed on the photograph, so a swap is a new image fading in
                  rather than the old one lingering under the new caption */}
              <img
                key={feature.src}
                src={feature.src}
                alt={feature.alt}
                className="absolute inset-0 h-full w-full animate-[fade-in_240ms_ease-out] object-cover transition-transform duration-500 ease-brand group-hover:scale-[1.045]"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(20,26,24,0.28))] opacity-0 transition-opacity duration-500 ease-brand group-hover:opacity-100"
              />
            </div>
            <p className="mt-3 mb-3 font-display text-[18px] leading-[1.22] tracking-[-0.016em] xl:text-[19px]">
              {feature.caption}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
              {/* Gold, because this is the give action. See CLAUDE.md. */}
              {feature.donate && (
                <Link
                  to={feature.donate.to}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-[10px] bg-gold px-4 text-[14.5px] font-semibold text-ink shadow-gold transition-[transform,background-color,color] duration-200 ease-brand hover:-translate-y-px hover:bg-gold-dark hover:text-paper"
                >
                  <HandHeart className="h-4 w-4 shrink-0" />
                  {feature.donate.label}
                </Link>
              )}
              <Link
                to={feature.cta.to}
                className={`group/cta inline-flex items-center gap-1.5 text-[14.5px] font-semibold ${
                  onDark ? 'text-green-pale' : 'text-green'
                }`}
              >
                <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-[position:0_1.15em] bg-no-repeat transition-[background-size] duration-300 ease-brand group-hover/cta:bg-[length:100%_1px]">
                  {feature.cta.label}
                </span>
                <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover/cta:translate-x-1" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </li>
  )
}

function isEmergencyLive() {
  try {
    const at = localStorage.getItem(DISMISSED_KEY)
    return !at || Date.now() - Number(at) > SEVEN_DAYS
  } catch {
    return true
  }
}
