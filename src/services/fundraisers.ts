import { useEffect, useState, useSyncExternalStore } from 'react'

import { REASONS, type Fundraiser, type Reason, type Supporter } from '../components/fundraiser-data'
import { APPEAL_LIST, appealBySlug } from '../components/appeals-data'

/* ---------------------------------------------------------------------------
   Where fundraisers come from, and where a new one goes.

   The platform API (server/routes/public.ts) is the only source. The list is
   fetched once per visit into a small store the pages subscribe to
   (useFundraisers); one fundraiser's page fetches its own record, which adds
   the latest supporters (useFundraiser).

   A fundraiser started on /fundraisers/start is POSTed to FUNDRAISER_ENDPOINT.
   It goes into the admin approval queue as 'pending' and is not public until
   the team approves it, so the start form ends on a "sent for approval"
   screen rather than on a page nobody else could open. The organiser is
   emailed a link to manage it from their account (/account/fundraisers).

   Amounts arrive in cents and are dollars from here on, as the pages expect.
--------------------------------------------------------------------------- */

export const FUNDRAISER_ENDPOINT = '/api/public/fundraisers'

type ApiFundraiser = {
  slug: string
  title: string
  story: string
  occasion: string
  organiser: string
  appeal: { slug?: string; title: string }
  target: number
  raised: number
  donorCount: number
  image?: string
  endsAt?: string
  createdAt?: string
  recent?: { name: string; amount: number; on?: string; message?: string }[]
}

/** The reason a page is raising for, read off the appeal it supports. */
function reasonOf(f: ApiFundraiser): Reason {
  if (f.occasion === 'memory') return 'memory'
  const causes = appealBySlug(f.appeal.slug)?.causes ?? []
  return REASONS.find((r) => r.id !== 'memory' && r.causes.some((c) => causes.includes(c)))?.id ?? 'food'
}

const day = (iso?: string) => (iso ? iso.slice(0, 10) : '')

function fromApi(f: ApiFundraiser): Fundraiser {
  const created = day(f.createdAt) || day(new Date().toISOString())
  return {
    slug: f.slug,
    title: f.title,
    organiser: f.organiser,
    reason: reasonOf(f),
    appeal: f.appeal.slug ?? '',
    goal: Math.round(f.target / 100),
    raised: Math.round(f.raised / 100),
    supporters: f.donorCount,
    created,
    /* a page with no end date runs on; show it a year out rather than as over */
    ends: day(f.endsAt) || day(new Date(Date.parse(created) + 365 * 86_400_000).toISOString()),
    story: f.story
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean),
    photo: f.image,
    recent: (f.recent ?? []).map(
      (r): Supporter => ({ name: r.name, amount: Math.round(r.amount / 100), on: day(r.on), message: r.message }),
    ),
  }
}

/* ---------- the list, fetched once and shared ---------- */

type State = { list: Fundraiser[]; ready: boolean }
let state: State = { list: [], ready: false }
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

function load() {
  loading ??= fetch(FUNDRAISER_ENDPOINT)
    .then((res) => (res.ok ? (res.json() as Promise<{ items: ApiFundraiser[] }>) : { items: [] }))
    .then(({ items }) => items.map(fromApi).filter((f) => appealBySlug(f.appeal)))
    /* the pages all cope with an empty list; they never show invented ones */
    .catch(() => [] as Fundraiser[])
    .then((list) => {
      state = { list, ready: true }
      listeners.forEach((l) => l())
    })
  return loading
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  void load()
  return () => listeners.delete(l)
}

/** Every live fundraiser, newest first, and whether the list has arrived. */
export function useFundraisers(): State {
  return useSyncExternalStore(subscribe, () => state, () => state)
}

/** One fundraiser, with its latest supporters. `ready` is false until the
 *  server has answered, so a page can wait rather than flash a 404. */
export function useFundraiser(slug: string | null | undefined): { fundraiser?: Fundraiser; ready: boolean } {
  const { list } = useFundraisers()
  const [one, setOne] = useState<{ slug: string; fundraiser?: Fundraiser } | null>(null)
  useEffect(() => {
    if (!slug) return
    let live = true
    fetch(`${FUNDRAISER_ENDPOINT}/${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? (res.json() as Promise<ApiFundraiser>) : null))
      .catch(() => null)
      .then((f) => {
        if (live) setOne({ slug, fundraiser: f ? fromApi(f) : undefined })
      })
    return () => {
      live = false
    }
  }, [slug])
  if (!slug) return { ready: true }
  if (one?.slug === slug) return { fundraiser: one.fundraiser, ready: true }
  /* the listed copy (no supporters yet) while the full record is on its way */
  const listed = list.find((f) => f.slug === slug)
  return { fundraiser: listed, ready: false }
}

/** Sends a finished draft to the approval queue. */
export async function submitFundraiser(d: Draft): Promise<{ ok: true } | { ok: false; message: string; fields?: Record<string, string> }> {
  try {
    const res = await fetch(FUNDRAISER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'aa' },
      body: JSON.stringify({
        appeal: d.appeal,
        reason: d.reason,
        title: d.title.trim(),
        story: d.story.trim(),
        goal: parseFloat(d.goal.replace(/[^\d.]/g, '')) || 0,
        ends: d.ends,
        photo: d.photo || undefined,
        first: d.first.trim(),
        last: d.last.trim(),
        email: d.email.trim(),
        group: d.group.trim() || undefined,
      }),
    })
    if (res.ok) return { ok: true }
    const body = (await res.json().catch(() => null)) as { error?: { message?: string; fields?: Record<string, string> } } | null
    return {
      ok: false,
      message: body?.error?.message || 'We could not save your fundraiser. Please try again in a minute.',
      fields: body?.error?.fields,
    }
  } catch {
    return { ok: false, message: 'We could not reach our server. Check your connection and try again.' }
  }
}

/** The appeals a reason can raise for. */
export const appealsFor = (reason: Reason | null) => {
  const causes = REASONS.find((r) => r.id === reason)?.causes ?? []
  return APPEAL_LIST.filter((a) => a.causes.some((c) => causes.includes(c)))
}

export const percentOf = (f: Pick<Fundraiser, 'raised' | 'goal'>) =>
  f.goal > 0 ? Math.min(100, Math.round((f.raised / f.goal) * 100)) : 0

export function daysLeft(ends: string, now = new Date()) {
  const end = new Date(`${ends}T23:59:59`)
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000))
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'fundraiser'

export type Draft = {
  reason: Fundraiser['reason'] | null
  appeal: string | null
  title: string
  story: string
  goal: string
  ends: string
  photo: string
  first: string
  last: string
  email: string
  group: string
  agree: boolean
}

const EMAIL_LOOKS_RIGHT = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** What is wrong with each step, keyed by field. Empty means the step is done. */
export function checkStep(step: number, d: Draft, today = new Date()): Record<string, string> {
  const e: Record<string, string> = {}
  if (step === 0 && !d.reason) e.reason = 'Choose the occasion.'
  if (step === 1 && !appealsFor(d.reason).some((a) => a.slug === d.appeal)) e.appeal = 'Choose an appeal.'
  if (step === 2) {
    if (d.title.trim().length < 6) e.title = 'Give your fundraiser a title.'
    if (d.story.trim().length < 40) e.story = 'Tell people a little more, at least a couple of sentences.'
    const goal = parseFloat(d.goal.replace(/[^\d.]/g, ''))
    if (!(goal >= 50)) e.goal = 'Set a goal of $50 or more.'
    if (!d.ends || daysLeft(d.ends, today) < 1) e.ends = 'Choose a date after today.'
  }
  if (step === 3) {
    if (!d.first.trim()) e.first = 'Enter your first name.'
    if (!d.last.trim()) e.last = 'Enter your last name.'
    if (!EMAIL_LOOKS_RIGHT.test(d.email.trim())) e.email = 'Enter an email we can reach you on.'
    if (!d.agree) e.agree = 'Tick to confirm.'
  }
  return e
}

export function draftToFundraiser(d: Draft, now = new Date()): Fundraiser {
  const organiser = d.group.trim() || `${d.first.trim()} ${d.last.trim().charAt(0).toUpperCase()}.`
  const base = slugify(d.title)
  const slug = base
  return {
    slug,
    title: d.title.trim(),
    organiser,
    reason: d.reason ?? 'food',
    appeal: d.appeal ?? '',
    goal: Math.max(50, Math.round(parseFloat(d.goal.replace(/[^\d.]/g, '')) || 0)),
    raised: 0,
    supporters: 0,
    created: now.toISOString().slice(0, 10),
    ends: d.ends,
    story: d.story
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean),
    photo: d.photo || undefined,
    recent: [],
  }
}

/** Shrinks a chosen photo to at most 1400px wide as a JPEG data URL, so it fits
 *  in the request. Rejects anything that is not an image. */
export function shrinkPhoto(file: File, max = 1400): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('not-image'))
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('unreadable'))
    }
    img.src = url
  })
}
