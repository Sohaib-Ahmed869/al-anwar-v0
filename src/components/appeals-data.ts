import { APPEAL_LIST, type Appeal } from '../../shared/appeals-catalog'

/* ---------------------------------------------------------------------------
   The appeals, as the site shows them. The catalogue itself (every appeal,
   its zakat eligibility and its placeholder figures, with the notes on them)
   is in shared/appeals-catalog.ts, because the server seeds from it too; this
   file adds what only the site needs: the filters, places and seasons the
   menus and cards name, and the helpers that look an appeal up.
--------------------------------------------------------------------------- */

export { APPEAL_LIST, type Appeal }

/** Every filter the Appeals menu links to, including the ones with nothing in
 *  them yet, so a menu link to an empty one can still say what it asked for. */
export const CAUSE_FILTERS: Record<string, string> = {
  food: 'Food',
  water: 'Clean water',
  education: 'Education',
  emergency: 'Emergency',
  jariyah: 'Sadaqah jariyah',
  orphans: 'Orphans & family',
  medical: 'Medical',
}

export const PLACES: Record<string, string> = {
  gaza: 'Gaza',
  yemen: 'Yemen',
  lebanon: 'Lebanon',
  syria: 'Syria',
  gambia: 'The Gambia',
}

export const SEASONS: Record<string, string> = {
  ramadan: 'Ramadan',
  qurbani: 'Qurbani',
  fitr: 'Zakat al-Fitr',
}


export const appealBySlug = (slug: string | null | undefined) =>
  APPEAL_LIST.find((a) => a.slug === slug)

/** "Food · Tripoli, Lebanon" — the line over a card's title. */
export const appealMeta = (a: Appeal) =>
  `${CAUSE_FILTERS[a.causes[0]]} · ${a.where ? `${a.where}, ` : ''}${PLACES[a.country]}`

export const giveHref = (a: Appeal) => `/give?appeal=${a.slug}`

/** The live crisis. The red strip along the top of every page and the featured
 *  card on /appeals both read this, so they cannot show two different
 *  emergencies. Set to null when nothing is live and both disappear. */
export const CRISIS: { slug: string; line: string; cta: string } | null = {
  slug: 'food-pack-lebanon',
  line: 'Our partner in Tripoli is distributing food packs this week.',
  cta: 'Give to the Lebanon response',
}
