/* ---------------------------------------------------------------------------
   The home page's quick-donate list: which options the box beside the hero
   offers, in which order, under which heading.

   The client asked (28 September 2026) for staff to set this themselves: the
   most pressing project goes first, new ones can be added, and the zakat-type
   obligations sit together under their own heading. So the list is stored on
   the server (server/models/QuickGive.ts), edited in Admin → Appeals, read by
   the site through GET /api/public/quick-give — and this file is its default,
   used to seed the store and as the site's fallback when the call fails.

   AN OPTION IS A LABEL ON TOP OF A FUND. `fund` is one of the site's funds
   (the ids in src/components/give-data.ts CAUSES), because the checkout only
   takes those and the fund decides the designation, the amount ladder and
   whether monthly is allowed. Staff can therefore add "Gaza Winter Project"
   as a new option paying into the emergency fund without anyone touching the
   giving rules. Array order is the priority: first is shown first, and the
   first enabled option is what the box opens on.

   `photo` is a file stem under /assets/images (with -1200/-2400.jpg beside it)
   or a full URL; empty means "the fund's own photograph". `title` and `body`
   are what the hero says while the option is chosen; empty means the fund's.
--------------------------------------------------------------------------- */

export const QUICK_GIVE_GROUPS = {
  general: '',
  projects: 'Projects',
  obligations: 'Zakat & obligations',
} as const
export type QuickGiveGroup = keyof typeof QUICK_GIVE_GROUPS
export const QUICK_GIVE_GROUP_KEYS = Object.keys(QUICK_GIVE_GROUPS) as QuickGiveGroup[]

/** The funds an option can pay into, with the label staff see in the editor.
 *  Kept in step with CAUSES in give-data.ts by hand; the checkout refuses
 *  anything else anyway. */
export const QUICK_GIVE_FUNDS = {
  sadaqah: 'Sadaqah',
  education: 'Education',
  water: 'Water',
  food: 'Food',
  emergency: 'Emergency',
  zakat: 'Zakat ul Maal',
  'zakat-fitr': 'Zakat ul Fitr',
  kaffarah: 'Kaffarah',
  fidyah: 'Fidyah',
  qurbani: 'Qurbani',
} as const
export type QuickGiveFund = keyof typeof QUICK_GIVE_FUNDS
export const QUICK_GIVE_FUND_KEYS = Object.keys(QUICK_GIVE_FUNDS) as QuickGiveFund[]

export type QuickGiveOption = {
  id: string
  label: string
  group: QuickGiveGroup
  fund: QuickGiveFund
  enabled: boolean
  photo: string
  title: string
  body: string
  /** a page on the site to read more ("/appeals/tarim-school"), or empty */
  link: string
}

const o = (id: string, label: string, group: QuickGiveGroup, fund: QuickGiveFund, link = ''): QuickGiveOption => ({
  id, label, group, fund, enabled: true, photo: '', title: '', body: '', link,
})

export const DEFAULT_QUICK_GIVE: QuickGiveOption[] = [
  {
    ...o('where-needed', 'Where needed most', 'general', 'sadaqah'),
    title: 'Where the need is greatest.',
    body: 'General sadaqah, allocated by our team to whichever work needs it most right now.',
  },
  o('water', 'Water Project', 'projects', 'water', '/appeals/water-stations-yemen'),
  o('food', 'Food Project', 'projects', 'food', '/appeals/yemen-food-relief'),
  o('education', 'Education Project', 'projects', 'education', '/appeals/tarim-school'),
  o('emergency', 'Emergency Project', 'projects', 'emergency'),
  o('zakat', 'Zakat ul Maal', 'obligations', 'zakat', '/zakat'),
  o('zakat-fitr', 'Zakat ul Fitr', 'obligations', 'zakat-fitr'),
  o('qurbani', 'Qurbani', 'obligations', 'qurbani', '/dhul-hijjah'),
  o('kaffarah', 'Kaffarah', 'obligations', 'kaffarah'),
  o('fidyah', 'Fidyah', 'obligations', 'fidyah'),
]
