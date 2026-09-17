import { REASONS, SAMPLE_FUNDRAISERS, type Fundraiser, type Reason } from '../components/fundraiser-data'
import { APPEAL_LIST, appealBySlug } from '../components/appeals-data'

/* ---------------------------------------------------------------------------
   Where fundraisers come from, and where a new one goes.

   FUNDRAISER_ENDPOINT is empty because the site has no server, the same
   situation as CHECKOUT_ENDPOINT in services/give.ts. Until it is set, a
   fundraiser started on /fundraisers/start is saved to this browser's
   localStorage and nowhere else, and every page that shows it says so
   (LOCAL_NOTICE). It must never look published when it is not: the person
   who made it would share a link nobody else can open.

   TO SWITCH IT ON: an endpoint that takes the payload below, stores it for
   review, and returns { slug }; a list endpoint the pages read instead of
   SAMPLE_FUNDRAISERS; and the Stripe webhook in api/checkout.ts adding each
   paid gift to the fundraiser named in the gift's metadata.
--------------------------------------------------------------------------- */

/** Set once a server stores fundraisers. */
export const FUNDRAISER_ENDPOINT = ''

const KEY = 'al-anwaar:fundraisers'

export function localFundraisers(): Fundraiser[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as Fundraiser[]) : []
    return Array.isArray(list) ? list.filter((f) => appealBySlug(f.appeal)) : []
  } catch {
    return []
  }
}

/** Returns false when the browser refused (private mode, or the photo was too
 *  big for storage). */
export function saveLocal(f: Fundraiser): boolean {
  try {
    const rest = localFundraisers().filter((x) => x.slug !== f.slug)
    window.localStorage.setItem(KEY, JSON.stringify([{ ...f, local: true }, ...rest]))
    return true
  } catch {
    return false
  }
}

/** Newest first: this browser's own, then the listed ones. */
export const allFundraisers = (): Fundraiser[] => [...localFundraisers(), ...SAMPLE_FUNDRAISERS]

export const fundraiserBySlug = (slug: string | null | undefined) =>
  slug ? allFundraisers().find((f) => f.slug === slug) : undefined

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
  const taken = new Set(allFundraisers().map((f) => f.slug))
  let slug = base
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`
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
    local: true,
  }
}

/** Shrinks a chosen photo to at most 1400px wide as a JPEG data URL, so it fits
 *  in localStorage. Rejects anything that is not an image. */
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
