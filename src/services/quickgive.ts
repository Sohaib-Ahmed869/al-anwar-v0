import { useEffect, useState } from 'react'

import { CAUSES, type Cause } from '../components/give-data'
import { DEFAULT_QUICK_GIVE, QUICK_GIVE_GROUPS, type QuickGiveOption } from '../../shared/quickgive'

/* ---------------------------------------------------------------------------
   The home page's quick-donate list, as staff ordered it in Admin → Appeals
   (see shared/quickgive.ts for what an option is and why it names a fund).

   Fetched once per visit. Until it arrives, and for good if it fails, the box
   shows the defaults, so the first screen never waits on the API to offer a
   way to give. Options whose fund the site does not know are dropped rather
   than offered and then refused at the checkout.
--------------------------------------------------------------------------- */

export const QUICK_GIVE_ENDPOINT = '/api/public/quick-give'

/** An option joined to the fund it pays into. */
export type QuickPick = QuickGiveOption & { cause: Cause }

const join = (list: QuickGiveOption[]): QuickPick[] =>
  list.flatMap((o) => {
    const cause = CAUSES.find((c) => c.id === o.fund)
    return cause && o.enabled ? [{ ...o, cause }] : []
  })

export const DEFAULT_PICKS = join(DEFAULT_QUICK_GIVE)

let cached: QuickPick[] | null = null
let loading: Promise<QuickPick[]> | null = null

function load() {
  loading ??= fetch(QUICK_GIVE_ENDPOINT, { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d: { items?: QuickGiveOption[] }) => {
      const picks = join(Array.isArray(d.items) ? d.items : [])
      cached = picks.length ? picks : DEFAULT_PICKS
      return cached
    })
    .catch(() => (cached = DEFAULT_PICKS))
  return loading
}

/** The list, and whether it is the server's (true) or still the defaults. */
export function useQuickGive(): { picks: QuickPick[]; ready: boolean } {
  const [picks, setPicks] = useState<QuickPick[] | null>(cached)
  useEffect(() => {
    if (cached) return
    let live = true
    load().then((p) => live && setPicks(p))
    return () => {
      live = false
    }
  }, [])
  return { picks: picks ?? DEFAULT_PICKS, ready: picks !== null }
}

/** The picks in display sections: each group heading once, groups in the order
 *  their highest-priority option appears, options in priority order within. */
export function groupPicks(picks: QuickPick[]) {
  const order: string[] = []
  const by = new Map<string, QuickPick[]>()
  for (const p of picks) {
    if (!by.has(p.group)) {
      by.set(p.group, [])
      order.push(p.group)
    }
    by.get(p.group)!.push(p)
  }
  return order.map((g) => ({ group: g, heading: QUICK_GIVE_GROUPS[g as keyof typeof QUICK_GIVE_GROUPS] ?? '', items: by.get(g)! }))
}

/** The photograph for a pick: staff's own (a stem or a full URL) or the fund's. */
export function pickPhoto(p: QuickPick): { src: string; srcSet?: string; position: string; alt: string } {
  const own = p.photo.trim()
  if (own && /^(\/|https?:)/.test(own)) return { src: own, position: '50% 50%', alt: '' }
  const stem = own || p.cause.photo
  return {
    src: `/assets/images/${stem}-2400.jpg`,
    srcSet: `/assets/images/${stem}-1200.jpg 1200w, /assets/images/${stem}-2400.jpg 2400w`,
    position: own ? '50% 50%' : p.cause.position,
    alt: own ? '' : p.cause.alt,
  }
}
