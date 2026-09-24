import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useConfirm } from '../../portal/ui'

/* ---------------------------------------------------------------------------
   Two things every long editor in the admin portal needs (the appeal editor
   and the campaign composer use both).

   useUnsavedGuard(dirty) — asks before a person walks away from changes.
   The app runs on a plain <BrowserRouter>, which has no navigation blocker,
   so this catches the two ways out that matter: closing or reloading the tab
   (beforeunload) and clicking any in-app link (a capture-phase listener that
   runs before React Router's own click handler, and navigates itself once
   the person says yes). The browser's back button is not intercepted.

   <StickySaveBar> — the Save button pinned above the phone's bottom tab bar.
   Portalled to <body>, because the page wrapper animates in with a transform,
   and a transformed ancestor would make `position: fixed` relative to it.
--------------------------------------------------------------------------- */

export function useUnsavedGuard(dirty: boolean, message = 'Your changes on this page have not been saved yet.') {
  const confirm = useConfirm()
  const nav = useNavigate()
  const asking = useRef(false)
  useEffect(() => {
    if (!dirty) return
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    const onClick = async (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement | null)?.closest?.('a')
      if (!a || !a.href || a.target === '_blank' || a.hasAttribute('download')) return
      const to = new URL(a.href, window.location.href)
      if (to.origin !== window.location.origin) return
      if (to.pathname === window.location.pathname && to.search === window.location.search) return
      e.preventDefault()
      e.stopPropagation()
      if (asking.current) return
      asking.current = true
      const leave = await confirm({ title: 'Leave without saving?', body: message, confirmLabel: 'Leave', cancelLabel: 'Stay and save', tone: 'danger' })
      asking.current = false
      if (leave) nav(to.pathname + to.search + to.hash)
    }
    window.addEventListener('beforeunload', onUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty, confirm, nav, message])
}

export function StickySaveBar({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show || typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-40 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur-md animate-[portal-in_220ms_var(--ease-reveal)] lg:hidden">
      <div className="mx-auto flex max-w-xl items-center gap-2">{children}</div>
    </div>,
    document.body,
  )
}
