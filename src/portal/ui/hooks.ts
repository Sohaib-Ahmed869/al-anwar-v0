import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router-dom'

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Phones and small tablets: dialogs become bottom sheets, tables become cards. */
export const useIsMobile = () => useMediaQuery('(max-width: 767px)')

export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/**
 * State kept in the URL's query string, so a filtered list survives a
 * refresh, the back button and being pasted to a colleague. Defaults are
 * left out of the URL.
 */
export function useUrlState<T extends Record<string, string>>(defaults: T) {
  const [params, setParams] = useSearchParams()
  const state = Object.fromEntries(Object.keys(defaults).map((k) => [k, params.get(k) ?? defaults[k]])) as T
  const set = (patch: Partial<T>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          if (v === undefined || v === '' || v === defaults[k]) next.delete(k)
          else next.set(k, String(v))
        }
        /* any filter change sends the list back to its first page */
        if (!('page' in patch)) next.delete('page')
        return next
      },
      { replace: true },
    )
  return [state, set] as const
}

/** Run `fn` on ⌘/Ctrl + key. */
export function useHotkey(key: string, fn: (e: KeyboardEvent) => void, opts: { meta?: boolean } = { meta: true }) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key.toLowerCase()) return
      if (opts.meta && !(e.metaKey || e.ctrlKey)) return
      if (!opts.meta) {
        const t = e.target as HTMLElement
        if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return
      }
      e.preventDefault()
      ref.current(e)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [key, opts.meta])
}

export function useDocumentTitle(title: string | undefined, suffix: string) {
  useEffect(() => {
    if (title) document.title = `${title} · ${suffix}`
  }, [title, suffix])
}
