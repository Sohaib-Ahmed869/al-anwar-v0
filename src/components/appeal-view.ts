import { CAUSE_FILTERS, type Appeal } from './appeals-data'
import { APPEAL_DETAIL } from './appeal-detail-data'
import { CAUSES } from './give-data'

/* ---------------------------------------------------------------------------
   An appeal as the big photographic layouts draw it: the home banner
   (HomeAppeals), and the /appeals hero and tiles (16 September 2026, when
   /appeals was rebuilt on the home page's pattern). Worked out here once so
   the two pages always quote the same "from" price and the same frame.

   THE PHOTOGRAPH is the appeal page's band (appeal-detail-data.ts): 2400px
   frames, where the cards' field photographs are 720–878px squares. All but
   the masjid are licensed stock, so nothing drawn over one names it as our
   work: the words say what the appeal is, never what is in the picture.

   THE "FROM" PRICE is the first rung of the appeal's give fund (give-data.ts),
   the smallest amount the give form offers for it, or, where the fund has a
   real costed unit and the appeal is that unit, the unit's price with what it
   buys. Lebanon is on the food fund but has no published unit of its own, so
   it says "Give from", not "feed a family".
--------------------------------------------------------------------------- */

/* Lines over the price, where the appeal is exactly its fund's costed unit. */
const UNIT_LINE: Record<string, string> = {
  'yemen-food-relief': 'Feed a family for a month from',
  'water-stations-yemen': 'Build a water station from',
}

export const appealView = (a: Appeal) => {
  const band = APPEAL_DETAIL[a.slug]?.band
  const stem = band && !band.startsWith('/') ? band : null
  const fund = CAUSES.find((c) => c.id === a.fund)
  const unitLine = UNIT_LINE[a.slug]
  return {
    ...a,
    cause: CAUSE_FILTERS[a.causes[0]],
    fromLine: unitLine ?? 'Give from',
    from: unitLine && fund?.unit ? fund.unit.price : (fund?.amounts[0]?.value ?? 25),
    src: stem ? `/assets/images/${stem}-2400.jpg` : (band ?? a.image),
    srcSet: stem
      ? `/assets/images/${stem}-1200.jpg 1200w, /assets/images/${stem}-2400.jpg 2400w`
      : undefined,
    position: APPEAL_DETAIL[a.slug]?.bandPosition ?? '50% 50%',
  }
}

export type AppealView = ReturnType<typeof appealView>

export const money = (v: number) => '$' + Math.round(v).toLocaleString('en-AU')
