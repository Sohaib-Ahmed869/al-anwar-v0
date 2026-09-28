import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Close, HandHeart } from './icons'
import { agoOf, RECENT_GIFTS } from './recent-gifts-data'

/* ---------------------------------------------------------------------------
   The "Amina from Lakemba donated $50 to Gaza cannot wait · 3 min ago" toast,
   bottom left of the public site. Mounted once in Layout, so the portals,
   which sit outside Layout, never see it.

   One fetch per page load; the server caches for a minute. The toast then
   cycles: up for visibleMs, gone for gapMs, next one. With nothing to show it
   renders nothing at all, and a failed fetch is silent: it is a nicety, not
   something a visitor should ever see an error for.

   CLOSING IT MEANS FOR THE VISIT. The ✕ writes to sessionStorage, wrapped in
   try/catch because private windows can refuse it. It is an aside, not a
   landmark: role="status" with aria-live="polite" would read every donation
   aloud every ten seconds, so it is aria-live="off" and simply labelled.

   ON PHONES it sits above the fixed give bars that /appeals/:slug and the
   zakat calculator show (AppealGiveBox, ZakatCalc) rather than over them,
   and it is not shown on /give or /thank-you at all. On a phone it also waits
   until the reader has scrolled past the first screen, because the home
   hero's donate box sits exactly where the toast would. Reduced motion is
   handled by index.css, which flattens the rise to a fade.
--------------------------------------------------------------------------- */

type Item = { name: string | null; place: string | null; amount: number; cause: string; on: string }

/** Pages whose phone layout has a fixed bar at the bottom to keep clear of. */
export const BAR_PAGES = [/^\/appeals\/[^/]+/, /^\/zakat\/calculator/, /^\/give/]
export const hasBottomBar = (path: string) => BAR_PAGES.some((re) => re.test(path))

const dollars = (cents: number) =>
  '$' + (cents / 100).toLocaleString('en-AU', { maximumFractionDigits: cents % 100 ? 2 : 0 })

const wasDismissed = () => {
  try {
    return sessionStorage.getItem(RECENT_GIFTS.dismissKey) === '1'
  } catch {
    return false
  }
}

export default function RecentGifts() {
  const { pathname } = useLocation()
  const [items, setItems] = useState<Item[]>([])
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState(false)
  const [dismissed, setDismissed] = useState(wasDismissed)

  const [pastFold, setPastFold] = useState(false)

  /* phones only: nothing until the first screen has gone by */
  useEffect(() => {
    const check = () => setPastFold(window.innerWidth >= 640 || window.scrollY > window.innerHeight * 0.8)
    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => {
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [])

  const hidden = dismissed || !pastFold || RECENT_GIFTS.hiddenOn.some((p) => pathname.startsWith(p))

  useEffect(() => {
    if (dismissed) return
    let live = true
    fetch(RECENT_GIFTS.endpoint)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { items?: Item[] } | null) => {
        if (live && body?.items?.length) setItems(body.items)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [dismissed])

  /* the cycle: wait, show, hide, advance */
  useEffect(() => {
    if (hidden || !items.length) return
    let t = window.setTimeout(function up() {
      setShown(true)
      t = window.setTimeout(() => {
        setShown(false)
        t = window.setTimeout(() => {
          setIndex((i) => (i + 1) % items.length)
          up()
        }, RECENT_GIFTS.gapMs)
      }, RECENT_GIFTS.visibleMs)
    }, RECENT_GIFTS.firstDelayMs)
    return () => {
      window.clearTimeout(t)
      setShown(false)
    }
  }, [hidden, items])

  if (hidden || !items.length) return null
  const g = items[index % items.length]
  const who = g.name ?? RECENT_GIFTS.someone

  const dismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(RECENT_GIFTS.dismissKey, '1')
    } catch {
      /* the toast still goes for this page; it may come back on the next */
    }
  }

  return (
    <aside
      aria-label={RECENT_GIFTS.label}
      aria-live="off"
      aria-hidden={!shown}
      className={`fixed left-3 z-[60] w-[min(340px,calc(100vw-96px))] transition-[opacity,transform] duration-500 ease-brand sm:left-5 sm:w-[340px] ${
        hasBottomBar(pathname) ? 'bottom-[96px] lg:bottom-5' : 'bottom-3 sm:bottom-5'
      } ${shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
    >
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-paper p-3 pr-2 shadow-pop">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green-pale text-green">
          <HandHeart className="h-[18px] w-[18px]" />
        </span>
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-text-2">
          <span className="font-semibold text-text">{who}</span>
          {g.place && (
            <>
              {' '}
              {RECENT_GIFTS.from} {g.place}
            </>
          )}{' '}
          {RECENT_GIFTS.gave} <span className="nums font-semibold text-text">{dollars(g.amount)}</span>{' '}
          {RECENT_GIFTS.to} <span className="text-text">{g.cause}</span>
          <span className="mt-0.5 block text-[12px] text-text-3">{agoOf(g.on)}</span>
        </p>
        <button
          type="button"
          onClick={dismiss}
          tabIndex={shown ? 0 : -1}
          aria-label={RECENT_GIFTS.close}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-3 transition-colors hover:bg-paper-2 hover:text-text"
        >
          <Close className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  )
}
