import mongoose, { Types } from 'mongoose'
import bcrypt from 'bcryptjs'
import { APPEAL_LIST } from '../../src/components/appeals-data'
import { fyOf, type Designation, type Frequency, type Method } from '../../shared/domain'
import { env } from '../env'
import {
  Appeal, AuditEvent, Campaign, Counter, Donor, EmailMessage, Enquiry, Fundraiser, Gift, LibraryDocument,
  Obligation, Plan, RegisterEntry, SettingsModel, Staff, DEFAULT_SETTINGS,
} from '../models'
import { putFile } from '../lib/storage'
import { advance } from '../lib/giving'

/* ---------------------------------------------------------------------------
   DEVELOPMENT DATA. Every person, gift and figure below is invented.

   It exists so the three portals can be built, demoed and tested against
   something that behaves like the real charity: two years of giving with the
   Ramadan and end-of-financial-year peaks, regular gifts (a few of them
   failing), duplicate donors waiting to be merged, pending bank transfers the
   sample statement will match, and registers and a calendar with something
   overdue in them.

   It is deterministic — a seeded random — so a bug seen on one machine is
   the same bug on another. It runs only when the database has no staff, only
   outside production, and SEED_RESET=1 wipes and re-runs it.

   Every staff login's password is DEMO_PASSWORD. Printed on start.
--------------------------------------------------------------------------- */

export const DEMO_PASSWORD = 'alanwaar-demo'

/* ---------- a seeded random ---------- */
let seed = 20260924
function rand() {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rand() * a.length)]
const chance = (p: number) => rand() < p
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1))
function weighted<T extends string>(w: Record<T, number>): T {
  const total = Object.values<number>(w).reduce((a, b) => a + b, 0)
  let x = rand() * total
  for (const [k, v] of Object.entries<number>(w)) {
    x -= v
    if (x <= 0) return k as T
  }
  return Object.keys(w)[0] as T
}
const daysAgo = (n: number, from = NOW) => new Date(from.getTime() - n * 86_400_000)
const round5 = (dollars: number) => Math.max(5, Math.round(dollars / 5) * 5) * 100

const NOW = new Date()
const DAY = 86_400_000

/* ---------- people ---------- */
const FIRST = [
  'Ahmed', 'Mohammed', 'Omar', 'Yusuf', 'Ibrahim', 'Bilal', 'Hamza', 'Khalid', 'Tariq', 'Zaid', 'Hassan', 'Hussein',
  'Mustafa', 'Adam', 'Idris', 'Samir', 'Karim', 'Faisal', 'Imran', 'Rashid', 'Anas', 'Ismail', 'Harun', 'Nabil',
  'Fatima', 'Aisha', 'Maryam', 'Khadija', 'Zainab', 'Amina', 'Sara', 'Layla', 'Noor', 'Huda', 'Rania', 'Samira',
  'Hana', 'Yasmin', 'Leila', 'Asma', 'Mariam', 'Safiya', 'Ruqayya', 'Sumayya', 'Hafsa', 'Nadia', 'Iman', 'Salma',
  'Daniel', 'Sarah', 'Jacob', 'Emily', 'Michael', 'Hannah', 'Luke', 'Grace',
]
const LAST = [
  'Rahman', 'Hassan', 'Ali', 'Khan', 'Ahmed', 'Hussain', 'Haddad', 'Nasser', 'Saleh', 'Mansour', 'Karim', 'Siddiqui',
  'Qureshi', 'Malik', 'Chowdhury', 'Uddin', 'Islam', 'Hossain', 'El-Masri', 'Abdullah', 'Yousef', 'Darwish', 'Farah',
  'Osman', 'Mahmoud', 'Aziz', 'Sultani', 'Hamdan', 'Bakri', 'Jaber', 'Nouri', 'Sayed', 'Zaman', 'Rashidi', 'Amin',
  'Kassem', 'Chami', 'Dib', 'Taleb', 'Sheikh', 'Omari', 'Ghanem', 'Barakat', 'Fakhoury', 'Hamid', 'Iqbal', 'Patel',
  'Mirza', 'Baig', 'Ansari', 'Smith', 'Nguyen', 'Brown', 'Wilson',
]
const PLACES = [
  ['Lakemba', 'NSW', '2195'], ['Auburn', 'NSW', '2144'], ['Bankstown', 'NSW', '2200'], ['Granville', 'NSW', '2142'],
  ['Parramatta', 'NSW', '2150'], ['Liverpool', 'NSW', '2170'], ['Guildford', 'NSW', '2161'], ['Greenacre', 'NSW', '2190'],
  ['Punchbowl', 'NSW', '2196'], ['Merrylands', 'NSW', '2160'], ['Blacktown', 'NSW', '2148'], ['Rooty Hill', 'NSW', '2766'],
  ['Coburg', 'VIC', '3058'], ['Broadmeadows', 'VIC', '3047'], ['Dandenong', 'VIC', '3175'], ['Kuraby', 'QLD', '4112'],
  ['Logan Central', 'QLD', '4114'], ['Mirrabooka', 'WA', '6061'], ['Woodville', 'SA', '5011'], ['Gungahlin', 'ACT', '2912'],
] as const
const STREETS = ['Haldon St', 'Railway Pde', 'Canterbury Rd', 'Station St', 'Park Rd', 'Church St', 'Queen St', 'Victoria Rd', 'Wattle Ave', 'Rose St']
const DOMAINS = ['example.com', 'example.net', 'example.org', 'mail.example.com']

type SeedDonor = {
  _id: Types.ObjectId
  number: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  address?: Record<string, string>
  createdAt: Date
  /** how generous and how often, so a donor's history hangs together */
  tier: number
  loyal: boolean
}

export async function seedIfEmpty() {
  /* production never seeds, unless SEED_DEMO=1 asks for the invented data on
     a staging deploy; SEED_RESET stays a development-only switch */
  if (env.isProd && !env.seedDemo) return
  if (env.seedReset && !env.isProd) {
    console.log('[seed] SEED_RESET=1 — wiping the development database')
    await mongoose.connection.dropDatabase()
  }
  if (await Staff.exists({})) return
  const t0 = Date.now()
  console.log('[seed] empty database — seeding development data…')
  await seedAll()
  console.log(`[seed] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  printLogins()
}

export function printLogins() {
  console.log(`[seed] staff logins (password "${DEMO_PASSWORD}"):`)
  for (const s of STAFF) console.log(`         ${s.role.padEnd(12)} ${s.email}`)
  console.log('[seed] donor portal: sign in as amina.rahman@example.com (the code shows on screen in development)')
}

const STAFF = [
  { name: 'Yusuf Karim', email: 'yusuf@alanwaar.group', role: 'owner' },
  { name: 'Maryam Haddad', email: 'maryam@alanwaar.group', role: 'admin' },
  { name: 'Omar Siddiqui', email: 'omar@alanwaar.group', role: 'finance' },
  { name: 'Fatima Noor', email: 'fatima@alanwaar.group', role: 'fundraising' },
  { name: 'Khalid Mansour', email: 'khalid@alanwaar.group', role: 'compliance' },
  { name: 'Bilal Ahmed', email: 'bilal@alanwaar.group', role: 'volunteer' },
] as const

/* ---------- appeals ---------- */
const SUGGESTED: Record<string, { amounts: [number, string?][]; unit?: { name: string; plural: string; price: number } }> = {
  food: { amounts: [[50, 'One family, one month'], [150, 'Three families'], [300, 'Six families']], unit: { name: 'food pack', plural: 'food packs', price: 5000 } },
  water: { amounts: [[50, 'Towards a station'], [350, 'One water station'], [700, 'Two stations']], unit: { name: 'water station', plural: 'water stations', price: 35000 } },
  emergency: { amounts: [[50], [100], [250], [500]] },
  education: { amounts: [[50], [150], [500]] },
  jariyah: { amounts: [[100], [250], [1000]] },
  qurbani: { amounts: [[250, 'One share'], [500, 'Two shares'], [1250, 'Five shares']], unit: { name: 'Qurbani share', plural: 'Qurbani shares', price: 25000 } },
  ramadan: { amounts: [[30], [100], [300]] },
}

const STORIES: Record<string, string> = {
  'gaza-emergency': 'Homes have been reduced to rubble and families are living in tents with too little food and clean water.\n\nYour gift is spent through our partner on the ground on what families ask for first: food parcels, drinking water, hygiene kits and blankets. Every delivery is logged and reported back here.',
  'gaza-hot-meals': 'Cooked every day in community kitchens and handed out in the camps by people on the ground, to families who have lost their kitchens.\n\n$10 is one hot meal. The kitchens buy locally wherever markets are open, which keeps money moving in the local economy.',
  'food-pack-lebanon': 'Our partner in Tripoli is distributing this week. Every pack is bought in-country, so the money moves faster than the goods would.',
  'yemen-food-relief': 'A $50 pack is flour, rice, oil, lentils and dates — enough to feed one family for a month. Packs are bought in Yemen and handed out by our partner to families on their list.',
  'water-stations-yemen': 'A water station puts clean water in a village so nobody walks two hours for it. $350 builds one, and it serves a street for years.',
  'gambia-masjid': 'A masjid that outlives the giver: built with the community, maintained by it, and a place of prayer and learning for generations.',
  'tarim-school': 'Classrooms for children in Tarim, built and equipped so they can learn close to home.',
}

export async function seedAll() {
  seed = 20260924
  await SettingsModel.updateOne({ _id: 'org' }, { $set: { data: DEFAULT_SETTINGS } }, { upsert: true })

  /* ---------- staff ---------- */
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10)
  const staff = await Staff.insertMany(
    [
      ...STAFF.map((s, i) => ({ ...s, passwordHash: hash, passwordSet: true, lastLoginAt: daysAgo(i * 2 + 0.3), createdAt: daysAgo(400 - i * 20) })),
      { name: 'Sara Yusuf', email: 'sara@alanwaar.group', role: 'volunteer', passwordSet: false, invitedAt: daysAgo(2) },
    ],
  )
  const staffBy = (role: string) => staff.find((s) => s.role === role)!

  /* ---------- appeals ---------- */
  const appealDocs = APPEAL_LIST.map((a) => {
    const key = a.causes.includes('water') ? 'water' : a.causes[0] === 'food' ? 'food' : a.causes.includes('jariyah') ? 'jariyah' : a.causes[0]
    /* hot meals are counted in meals at $10 (give-data.ts), not food packs */
    const sug = a.slug === 'gaza-hot-meals'
      ? { amounts: [[30, 'Three meals'], [100, 'Ten meals'], [300, 'Thirty meals']] as [number, string?][], unit: { name: 'hot meal', plural: 'hot meals', price: 1000 } }
      : (SUGGESTED[key] ?? SUGGESTED.emergency)
    return {
      _id: new Types.ObjectId(),
      slug: a.slug,
      title: a.title,
      summary: a.blurb,
      story: STORIES[a.slug] ?? a.blurb,
      country: a.country,
      where: a.where,
      causes: a.causes,
      zakatEligible: a.zakat,
      target: a.goal * 100,
      status: 'open',
      opensAt: daysAgo(between(200, 700)),
      image: a.image,
      suggested: sug.amounts.map(([amount, label]) => ({ amount: amount * 100, label })),
      unit: sug.unit,
      featured: Boolean(a.home),
      updates: [
        { date: daysAgo(between(3, 20)), title: 'Latest delivery', body: 'Our partner confirmed the most recent distribution. Photos and the tally are with the office and will be posted here once checked.' },
        { date: daysAgo(between(40, 90)), title: 'Appeal opened', body: 'Thank you to everyone who gave in the first week.' },
      ],
      createdAt: daysAgo(700),
    }
  })
  const extraAppeals = [
    {
      _id: new Types.ObjectId(), slug: 'ramadan-2026-last-ten-nights', title: 'Ramadan 2026 — the last ten nights',
      summary: 'Automated giving across the last ten nights, so none of them is missed.', story: 'Closed. Thank you — every night was covered.',
      country: 'yemen', causes: ['food', 'emergency'], zakatEligible: true, target: 12000000, status: 'closed',
      opensAt: new Date('2026-02-17'), closesAt: new Date('2026-03-20'), image: '/assets/images/hero-ramadan-quran-1200.jpg',
      suggested: SUGGESTED.ramadan.amounts.map(([a]) => ({ amount: a * 100 })), featured: false, updates: [], createdAt: new Date('2026-01-20'),
    },
    {
      _id: new Types.ObjectId(), slug: 'qurbani-2026', title: 'Qurbani 2026',
      summary: 'Your Qurbani, carried out on the days of Eid and the meat given to families who would otherwise go without.',
      story: 'Closed for 2026. Shares were carried out in Yemen and Gaza on the days of Eid.',
      country: 'yemen', causes: ['food'], zakatEligible: false, target: 6000000, status: 'closed',
      opensAt: new Date('2026-04-20'), closesAt: new Date('2026-05-29'), image: '/assets/images/hero-qurbani-sheep-1200.jpg',
      suggested: SUGGESTED.qurbani.amounts.map(([a, l]) => ({ amount: a * 100, label: l })), unit: SUGGESTED.qurbani.unit, featured: false, updates: [], createdAt: new Date('2026-04-10'),
    },
    {
      _id: new Types.ObjectId(), slug: 'syria-winter', title: 'Winter blankets in north-west Syria',
      summary: 'Blankets, heaters and fuel for families in the camps before the cold arrives.', story: 'Draft — waiting on the partner costing.',
      country: 'syria', causes: ['emergency'], zakatEligible: true, target: 3000000, status: 'draft',
      image: '/assets/images/hero-lebanon-1200.jpg', suggested: SUGGESTED.emergency.amounts.map(([a]) => ({ amount: a * 100 })), featured: false, updates: [], createdAt: daysAgo(6),
    },
  ]
  await Appeal.insertMany([...appealDocs, ...extraAppeals])
  const open = appealDocs
  const ramadanAppeal = extraAppeals[0]
  const qurbaniAppeal = extraAppeals[1]

  /* ---------- donors ---------- */
  const donors: SeedDonor[] = []
  const usedEmails = new Set<string>()
  const makeDonor = (first: string, last: string, created: Date, email?: string): SeedDonor => {
    let e = email
    while (!e || usedEmails.has(e)) {
      const style = between(0, 3)
      const local = style === 0 ? `${first}.${last}` : style === 1 ? `${first[0]}${last}${between(1, 99)}` : style === 2 ? `${first}${between(70, 99)}` : `${first}.${last[0]}`
      e = `${local.toLowerCase().replace(/[^a-z0-9.]/g, '')}@${pick(DOMAINS)}`
    }
    usedEmails.add(e)
    const place = pick(PLACES)
    const d: SeedDonor = {
      _id: new Types.ObjectId(),
      number: `D-${10001 + donors.length}`,
      firstName: first,
      lastName: last,
      email: e,
      phone: chance(0.7) ? `04${between(10, 99)} ${between(100, 999)} ${between(100, 999)}` : undefined,
      address: chance(0.8)
        ? { line1: `${between(1, 180)} ${pick(STREETS)}`, suburb: place[0], state: place[1], postcode: place[2], country: 'Australia' }
        : undefined,
      createdAt: created,
      tier: rand() < 0.08 ? 3 : rand() < 0.3 ? 2 : 1,
      loyal: chance(0.35),
    }
    donors.push(d)
    return d
  }
  /* the donor whose portal the demo opens */
  const amina = makeDonor('Amina', 'Rahman', daysAgo(690), 'amina.rahman@example.com')
  amina.tier = 2
  amina.loyal = true
  amina.phone = '0412 345 678'
  amina.address = { line1: '14 Haldon St', suburb: 'Lakemba', state: 'NSW', postcode: '2195', country: 'Australia' }

  for (let i = 0; i < 430; i++) makeDonor(pick(FIRST), pick(LAST), daysAgo(Math.floor(Math.pow(rand(), 0.8) * 720)))

  /* planted duplicates: the same person twice, the way it really happens */
  const dupPairs: [SeedDonor, SeedDonor][] = []
  for (let i = 0; i < 7; i++) {
    const a = donors[between(5, donors.length - 1)]
    /* every planted pair shares a second signal besides the name — a phone,
       an address or a near-identical email — because a name alone is not
       evidence (the seed has dozens of different people sharing one) */
    const local = a.email.split('@')[0]
    const b = makeDonor(a.firstName, a.lastName, daysAgo(between(10, 300)), i % 3 === 2 ? `${local}${between(2, 9)}@${pick(DOMAINS)}` : undefined)
    if (i % 3 === 0) b.phone = a.phone
    if (i % 3 === 1) b.address = a.address
    dupPairs.push([a, b])
  }

  /* ---------- gifts ---------- */
  type SeedGift = Record<string, unknown> & { donor: Types.ObjectId; amount: number; date: Date; status: string; appeal?: Types.ObjectId }
  const gifts: SeedGift[] = []
  let giftSeq = 100001
  const receiptSeq: Record<number, number> = {}
  const receiptFor = (date: Date) => {
    const fy = fyOf(date)
    receiptSeq[fy] = (receiptSeq[fy] ?? 0) + 1
    return `AA-${fy}-${String(receiptSeq[fy]).padStart(6, '0')}`
  }
  const ramadan = (d: Date) =>
    (d >= new Date('2025-03-01') && d <= new Date('2025-03-31')) || (d >= new Date('2026-02-18') && d <= new Date('2026-03-20'))
  const lastTen = (d: Date) =>
    (d >= new Date('2025-03-20') && d <= new Date('2025-03-31')) || (d >= new Date('2026-03-09') && d <= new Date('2026-03-20'))
  const dhulHijjah = (d: Date) =>
    (d >= new Date('2025-05-28') && d <= new Date('2025-06-06')) || (d >= new Date('2026-05-18') && d <= new Date('2026-05-27'))
  const eofy = (d: Date) => d.getMonth() === 5 && d.getDate() >= 15

  const addGift = (
    d: SeedDonor,
    date: Date,
    o: Partial<{ amount: number; designation: Designation; method: Method; appeal: (typeof appealDocs)[number]; status: string; plan: Types.ObjectId; source: string; fee: number; fundraiser: { _id: Types.ObjectId; title: string }; reference: string; enteredBy: (typeof staff)[number] }> = {},
  ) => {
    /* times are added to dates above; nothing may land after the seed runs */
    if (date > NOW) date = new Date(NOW.getTime() - between(1, 6) * 3_600_000)
    const inRamadan = ramadan(date)
    const designation: Designation = o.designation ?? weighted<Designation>(
      inRamadan
        ? { sadaqah: 30, zakat: 34, general: 8, lillah: 6, zakat_fitr: 10, kaffarah: 6, fidyah: 6 }
        : { sadaqah: 44, zakat: 22, general: 20, lillah: 10, zakat_fitr: 0, kaffarah: 2, fidyah: 2 },
    )
    const appeal =
      o.appeal ??
      (inRamadan && chance(0.35) ? (ramadanAppeal as unknown as (typeof appealDocs)[number])
        : dhulHijjah(date) && chance(0.6) ? (qurbaniAppeal as unknown as (typeof appealDocs)[number])
        : designation === 'zakat' ? pick(open.filter((a) => a.zakatEligible))
        : pick(open))
    let amount = o.amount
    if (!amount) {
      const base = designation === 'zakat' ? 180 + rand() * 1400 * d.tier : designation === 'zakat_fitr' ? 20 * between(1, 6) : 20 + Math.pow(rand(), 2) * 260 * d.tier
      amount = appeal.slug === 'qurbani-2026' ? 25000 * between(1, 4) : round5(base * (lastTen(date) ? 1.4 : 1) * (eofy(date) ? 1.6 : 1))
      if (designation === 'zakat_fitr') amount = 2000 * between(1, 6)
    }
    const method: Method = o.method ?? weighted<Method>({ card: 62, paypal: 10, bank: 17, cash: 6, event: 3, cheque: 2 })
    const status = o.status ?? 'succeeded'
    const offline = ['cash', 'cheque', 'event'].includes(method)
    const g: SeedGift = {
      _id: new Types.ObjectId(),
      number: `G-${giftSeq++}`,
      donor: d._id,
      donorName: `${d.firstName} ${d.lastName}`,
      appeal: appeal._id,
      appealTitle: appeal.title,
      country: appeal.country,
      plan: o.plan,
      amount,
      fee: o.fee ?? (method === 'card' && chance(0.45) ? Math.round(amount * 0.026) : 0),
      designation,
      method,
      status,
      date,
      anonymous: chance(0.08),
      source: o.source ?? (offline ? 'offline' : method === 'bank' ? 'bank' : 'online'),
      reference: o.reference ?? (method === 'bank' ? `AA-${Math.random().toString(36).slice(2, 8).toUpperCase()}` : undefined),
      enteredBy: offline ? (o.enteredBy ?? pick([staffBy('volunteer'), staffBy('finance')]))._id : undefined,
      enteredByName: offline ? (o.enteredBy ?? staffBy('volunteer')).name : undefined,
      createdAt: date,
      updatedAt: date,
    }
    if (o.fundraiser) {
      g.fundraiser = o.fundraiser._id
      g.fundraiserTitle = o.fundraiser.title
    }
    if (status === 'succeeded') g.receipt = { number: receiptFor(date), issuedAt: date, emailedAt: date, resent: 0 }
    if (status === 'failed') g.failureReason = 'Your card was declined.'
    gifts.push(g)
    return g
  }

  /* one-off giving: each donor gives a handful of times across their life,
     busier in Ramadan and at the end of the financial year */
  for (const d of donors) {
    const lifeDays = Math.max(1, (NOW.getTime() - d.createdAt.getTime()) / DAY)
    const n = Math.max(1, Math.round((d.loyal ? 5 : 1.5) * d.tier * (lifeDays / 365) * (0.5 + rand())))
    const lapsed = !d.loyal && chance(0.25)
    for (let i = 0; i < n; i++) {
      let date = new Date(d.createdAt.getTime() + rand() * lifeDays * DAY)
      if (lapsed && date > daysAgo(420)) date = daysAgo(between(430, 700))
      if (date < d.createdAt) date = new Date(d.createdAt.getTime() + DAY)
      /* pull a share of gifts into the seasons */
      if (chance(0.3)) {
        const y = date.getFullYear() >= 2026 ? 2026 : 2025
        const r = y === 2026 ? new Date(2026, 1, 18 + between(0, 30)) : new Date(2025, 2, 1 + between(0, 30))
        if (r > d.createdAt && r < NOW) date = r
      }
      if (date > NOW) continue
      addGift(d, new Date(date.getTime() + between(8, 21) * 3_600_000))
    }
  }
  /* Amina's history, made to read well in the donor portal */
  for (const [ago, amt, des, ap] of [
    [620, 25000, 'zakat', 3], [540, 5000, 'sadaqah', 0], [400, 150000, 'zakat', 0], [372, 10000, 'kaffarah', 1],
    [360, 2000 * 4, 'zakat_fitr', 3], [300, 35000, 'sadaqah', 4], [210, 5000, 'lillah', 5], [35, 180000, 'zakat', 0], [9, 15000, 'sadaqah', 2],
  ] as [number, number, Designation, number][]) {
    addGift(amina, daysAgo(ago), { amount: amt, designation: des, appeal: open[ap], method: ago === 400 ? 'bank' : 'card' })
  }

  /* ---------- regular gifts ---------- */
  const plans: Record<string, unknown>[] = []
  let planSeq = 5001
  const planDonors = donors.filter((d) => d.loyal || chance(0.12)).slice(0, 150)
  if (!planDonors.includes(amina)) planDonors.unshift(amina)
  planDonors.forEach((d, idx) => {
    const isAmina = d === amina
    const frequency: Frequency = isAmina ? 'monthly' : weighted<Frequency>({ monthly: 78, weekly: 10, fortnightly: 12 })
    const status = isAmina ? 'active' : weighted({ active: 70, paused: 7, past_due: 5, cancelled: 18 })
    const start = isAmina ? daysAgo(530) : new Date(Math.max(d.createdAt.getTime(), daysAgo(between(40, 700)).getTime()))
    const amount = isAmina ? 5000 : frequency === 'monthly' ? round5(15 + rand() * 90 * d.tier) : round5(5 + rand() * 25 * d.tier)
    const appeal = isAmina ? open[3] : pick(open)
    const planId = new Types.ObjectId()
    const last4 = status === 'past_due' ? '0002' : String(between(1000, 9989))
    const brand = pick(['Visa', 'Visa', 'Mastercard', 'Amex'])
    const cancelledAt = status === 'cancelled' ? daysAgo(between(10, 200)) : undefined
    const stopAt = cancelledAt ?? NOW
    let when = new Date(start)
    let collected = 0
    let lastCharge: Date | undefined
    while (when < stopAt) {
      if (status === 'paused' && when > daysAgo(45)) break
      addGift(d, when, { amount, designation: appeal.zakatEligible && chance(0.2) ? 'zakat' : 'sadaqah', appeal, method: 'card', plan: planId, source: 'recurring', fee: idx % 3 === 0 ? Math.round(amount * 0.026) : 0 })
      collected += amount
      lastCharge = when
      when = advance(when, frequency, start.getDate())
    }
    let failure: Record<string, unknown> | undefined
    if (status === 'past_due') {
      /* the failed attempt happened in the last few days, never in the future */
      const failedAt = daysAgo(between(1, 4))
      addGift(d, failedAt, { amount, appeal, method: 'card', plan: planId, source: 'recurring', status: 'failed' })
      failure = { count: between(1, 2), lastError: 'Your card was declined.', firstFailedAt: failedAt, nextRetryAt: new Date(NOW.getTime() + between(1, 3) * DAY) }
    }
    plans.push({
      _id: planId,
      number: `P-${planSeq++}`,
      donor: d._id,
      donorName: `${d.firstName} ${d.lastName}`,
      appeal: appeal._id,
      appealTitle: appeal.title,
      designation: 'sadaqah',
      amount,
      coverFee: idx % 3 === 0,
      frequency,
      kind: 'recurring',
      status,
      startDate: start,
      nextChargeAt: status === 'cancelled' ? undefined : status === 'past_due' ? failure!.nextRetryAt : when,
      lastChargeAt: lastCharge,
      pausedUntil: status === 'paused' ? new Date(NOW.getTime() + between(10, 60) * DAY) : undefined,
      failure: failure ?? { count: 0 },
      payment: { method: 'card', brand, last4, expMonth: between(1, 12), expYear: 2027 + between(0, 3) },
      cancelledAt,
      cancelReason: cancelledAt ? pick(['Money is tight at the moment', 'Giving through my mosque instead', 'Moving overseas', undefined]) : undefined,
      collected,
      createdAt: start,
      updatedAt: NOW,
    })
  })
  /* instalments: larger Ramadan and Qurbani gifts spread out */
  for (let i = 0; i < 9; i++) {
    const d = i === 0 ? amina : pick(donors)
    const total = pick([3, 4, 6, 10])
    const paid = i === 0 ? 2 : between(1, total)
    const amount = round5(100 + rand() * 250)
    const start = daysAgo(paid * 30 + between(1, 20))
    const planId = new Types.ObjectId()
    const appeal = i === 0 ? open[0] : pick(open)
    let when = new Date(start)
    for (let k = 0; k < paid; k++) {
      addGift(d, when, { amount, designation: 'zakat', appeal, method: 'card', plan: planId, source: 'recurring' })
      when = advance(when, 'monthly', start.getDate())
    }
    plans.push({
      _id: planId, number: `P-${planSeq++}`, donor: d._id, donorName: `${d.firstName} ${d.lastName}`,
      appeal: appeal._id, appealTitle: appeal.title, designation: 'zakat', amount, coverFee: false, frequency: 'monthly',
      kind: 'instalment', instalments: { total, paid }, status: paid >= total ? 'completed' : 'active', startDate: start,
      nextChargeAt: paid >= total ? undefined : when, lastChargeAt: daysAgo(10), failure: { count: 0 },
      payment: { method: 'card', brand: 'Visa', last4: String(between(1000, 9989)), expMonth: 8, expYear: 2028 },
      collected: amount * paid, createdAt: start, updatedAt: NOW,
    })
  }

  /* ---------- pending bank transfers: what the sample statement pays ---------- */
  const PLEDGE_REFS: string[] = []
  for (let i = 0; i < 12; i++) {
    const d = i === 0 ? amina : pick(donors)
    const ref = `AA-${'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split('').sort(() => rand() - 0.5).slice(0, 6).join('')}`
    PLEDGE_REFS.push(ref)
    addGift(d, daysAgo(between(1, 9)), { method: 'bank', status: 'pending', reference: ref, amount: round5(40 + rand() * 400), source: 'online' })
  }

  /* ---------- supporter fundraisers ---------- */
  const fundraisers = [
    { owner: amina, title: "Amina's Ramadan challenge for Yemen", occasion: 'ramadan', appeal: open[3], target: 500000, status: 'live', ago: 60 },
    { owner: pick(donors), title: 'Our wedding: water instead of gifts', occasion: 'wedding', appeal: open[4], target: 350000, status: 'live', ago: 30 },
    { owner: pick(donors), title: 'City2Surf for Gaza', occasion: 'walk', appeal: open[0], target: 200000, status: 'live', ago: 45 },
    { owner: pick(donors), title: "Dad's 60th — a classroom in Tarim", occasion: 'birthday', appeal: open[6], target: 600000, status: 'pending', ago: 2 },
    { owner: pick(donors), title: 'Office iftar appeal', occasion: 'workplace', appeal: open[1], target: 250000, status: 'pending', ago: 1 },
    { owner: pick(donors), title: 'In memory of Nana Khadija', occasion: 'memory', appeal: open[5], target: 1000000, status: 'ended', ago: 200 },
  ].map((f, i) => ({
    _id: new Types.ObjectId(),
    slug: `${f.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${i + 1}`,
    owner: f.owner._id,
    ownerName: `${f.owner.firstName} ${f.owner.lastName}`,
    appeal: f.appeal._id,
    appealTitle: f.appeal.title,
    title: f.title,
    story: 'I am raising money for this appeal and would love your support. Every dollar goes to the appeal, and Al-Anwaar sends the receipt directly to you.',
    occasion: f.occasion,
    target: f.target,
    status: f.status,
    endsAt: f.status === 'ended' ? daysAgo(150) : new Date(NOW.getTime() + between(20, 90) * DAY),
    review: f.status === 'live' || f.status === 'ended' ? { by: 'Fatima Noor', at: daysAgo(f.ago - 1) } : undefined,
    createdAt: daysAgo(f.ago),
    updatedAt: daysAgo(f.ago),
  }))
  for (const f of fundraisers.filter((x) => x.status !== 'pending')) {
    for (let k = 0; k < between(6, 18); k++) {
      const age = (NOW.getTime() - f.createdAt.getTime()) / DAY
      addGift(pick(donors), daysAgo(Math.floor(rand() * Math.max(1, age - 1))), {
        appeal: open.find((a) => a._id.equals(f.appeal))!, fundraiser: { _id: f._id, title: f.title }, method: 'card',
      })
    }
  }

  /* ---------- write it all ---------- */
  await Donor.insertMany(
    donors.map((d) => ({
      _id: d._id, number: d.number, firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone,
      address: d.address, source: chance(0.15) ? 'offline' : 'web', createdAt: d.createdAt, updatedAt: NOW,
      preferences: { emailOptIn: chance(0.85), topics: chance(0.5) ? ['appeals', 'reports', 'ramadan'] : ['appeals', 'reports'], anonymous: false },
      tags: d.tier === 3 ? ['major donor'] : [],
      unsubscribeToken: new Types.ObjectId().toHexString(),
    })),
  )
  await Plan.insertMany(plans)
  await Fundraiser.insertMany(fundraisers)
  for (let i = 0; i < gifts.length; i += 2000) await Gift.insertMany(gifts.slice(i, i + 2000), { ordered: false })

  await Counter.insertMany([
    { _id: 'donor', seq: donors.length },
    { _id: 'gift', seq: giftSeq - 100001 },
    { _id: 'plan', seq: planSeq - 5001 },
    ...Object.entries(receiptSeq).map(([fy, n]) => ({ _id: `receipt-${fy}`, seq: n })),
  ])

  await refreshAllStats()

  /* The site's targets are placeholders sized for a smaller year than the
     invented giving above, which left most appeals at several hundred per cent.
     Scale each open appeal's target to what it raised, so progress bars read
     the way a real mix does — most part-way, one just past its target. */
  const ratios = [0.42, 0.58, 0.71, 0.36, 0.83, 1.06, 0.64]
  const raisedNow = await Appeal.find({ status: { $ne: 'draft' } }).select('raised status').lean()
  await Appeal.bulkWrite(
    raisedNow.map((a, i) => ({
      updateOne: {
        filter: { _id: a._id },
        update: { $set: { target: Math.max(500000, Math.round((a.raised / (a.status === 'closed' ? 0.97 : ratios[i % ratios.length])) / 500000) * 500000) } },
      },
    })),
  )

  /* ---------- enquiries ---------- */
  const ENQ: [string, string, string, Record<string, string>][] = [
    ['volunteer', 'Volunteering at the warehouse', 'Salam, I can help on Saturday mornings with packing. I have a car if deliveries need a hand.', { availability: 'Saturday mornings', skills: 'Driving, packing' }],
    ['volunteer', 'Uni student keen to help', 'I study social work and would love to help with events or admin.', { availability: 'Weekday afternoons' }],
    ['partner', 'Mosque partnership — Ramadan collection', 'Our masjid would like to run a Ramadan collection for your Yemen appeal. Who should we speak to?', { organisation: 'Guildford Masjid', role: 'Committee member' }],
    ['partner', 'School fundraiser', 'Our Year 10s want to run a bake sale for Gaza meals. Can you send posters?', { organisation: 'Al-Noor College' }],
    ['contact', 'Receipt for my tax return', 'I gave by bank transfer in June and I have not received a receipt. Can you check?', {}],
    ['contact', 'Change of address', 'Please update my address to 22 Park Rd, Auburn.', {}],
    ['contact', 'Where did my Qurbani go?', 'Could you tell me which country my Qurbani share was carried out in?', {}],
    ['event', 'Community iftar — 4 seats', 'Booking four seats for the community iftar.', { event: 'Community iftar', seats: '4' }],
    ['event', 'Charity dinner', 'Two tickets for the annual dinner please.', { event: 'Annual dinner', seats: '2' }],
    ['fundraising', 'Running the Sydney half marathon', 'I would like to set up a fundraising page for the half marathon in May.', {}],
    ['contact', 'Cancel my monthly gift', 'I cannot log in to cancel my monthly donation. Can you stop it for me?', {}],
    ['contact', 'Zakat question', 'Can my zakat go to the water stations appeal?', {}],
  ]
  const enquiries = []
  for (let i = 0; i < 26; i++) {
    const [type, subject, message, meta] = ENQ[i % ENQ.length]
    const d = chance(0.6) ? pick(donors) : null
    const first = d?.firstName ?? pick(FIRST)
    const last = d?.lastName ?? pick(LAST)
    const status = i < 7 ? 'new' : i < 13 ? 'open' : 'closed'
    const assignee = status === 'new' ? null : pick([staffBy('fundraising'), staffBy('admin')])
    const at = daysAgo(i < 7 ? rand() * 3 : between(3, 120))
    enquiries.push({
      type, status, name: `${first} ${last}`, email: d?.email ?? `${first}.${last}`.toLowerCase() + '@example.com',
      phone: chance(0.5) ? `04${between(10, 99)} ${between(100, 999)} ${between(100, 999)}` : undefined,
      subject, message, meta, donor: d?._id, assignedTo: assignee?._id, assignedName: assignee?.name,
      notes: status === 'closed'
        ? [{ by: assignee!.name, at: new Date(at.getTime() + DAY), body: 'Replied and resolved.', kind: 'note' }]
        : status === 'open' ? [{ by: assignee!.name, at: new Date(at.getTime() + 3_600_000), body: 'Looking into this.', kind: 'note' }] : [],
      createdAt: at, updatedAt: at,
    })
  }
  await Enquiry.insertMany(enquiries)

  /* ---------- campaigns ---------- */
  await Campaign.insertMany([
    { name: 'Ramadan 2026 launch', subject: 'Ramadan is ten days away, {{firstName}}', preheader: 'Set up your last ten nights now.', body: 'Assalamu alaykum {{firstName}},\n\nRamadan is almost here. This year you can set your giving across the **last ten nights** in one go, so none of them is missed.\n\n[Set up my ten nights](/ramadan)\n\nJazakAllahu khairan,\nThe Al-Anwaar team', segment: { activeMonths: 24 }, status: 'sent', stats: { recipients: 344, sent: 341, failed: 3 }, sentAt: new Date('2026-02-08T09:00:00'), createdByName: 'Fatima Noor', createdAt: new Date('2026-02-05') },
    { name: 'Where your Qurbani went', subject: 'Your Qurbani, delivered', body: 'Assalamu alaykum {{firstName}},\n\nEvery Qurbani share given this year was carried out on the days of Eid in Yemen and Gaza.\n\n- 212 shares in Yemen\n- 96 shares in Gaza\n\nThank you for trusting us with it.', segment: { appeals: [String(qurbaniAppeal._id)] }, status: 'sent', stats: { recipients: 118, sent: 118, failed: 0 }, sentAt: new Date('2026-06-12T10:00:00'), createdByName: 'Fatima Noor', createdAt: new Date('2026-06-10') },
    { name: 'EOFY 2026 reminder', subject: 'Two weeks left to give before 30 June', body: 'Gifts of $2 or more are tax deductible. Your tax statement will be in your account on 1 July.', segment: { activeMonths: 18 }, status: 'sent', stats: { recipients: 330, sent: 329, failed: 1 }, sentAt: new Date('2026-06-16T08:30:00'), createdByName: 'Maryam Haddad', createdAt: new Date('2026-06-14') },
    { name: 'We miss you — lapsed donors', subject: 'It has been a while, {{firstName}}', body: 'Assalamu alaykum {{firstName}},\n\nIt has been over a year since your last gift, and we wanted to show you what it did.\n\n[See where the money goes](/where-it-goes)', segment: { lapsedMonths: 12 }, status: 'draft', stats: { recipients: 0, sent: 0, failed: 0 }, createdByName: 'Fatima Noor', createdAt: daysAgo(3) },
    { name: 'Winter appeal — Syria', subject: 'Winter is coming to the camps', body: 'Draft copy — waiting on the partner costing.', segment: { countries: ['syria', 'lebanon'] }, status: 'draft', stats: { recipients: 0, sent: 0, failed: 0 }, createdByName: 'Fatima Noor', createdAt: daysAgo(1) },
  ])

  await seedCompliance(staff)
  await seedEmailsAndAudit(staff, donors, amina)
}

/** Recompute every donor, appeal and fundraiser total in a few aggregations. */
export async function refreshAllStats() {
  const byDonor = await Gift.aggregate<{ _id: Types.ObjectId; total: number; count: number; first: Date; last: Date }>([
    { $match: { status: 'succeeded' } },
    { $group: { _id: '$donor', total: { $sum: '$amount' }, count: { $sum: 1 }, first: { $min: '$date' }, last: { $max: '$date' } } },
  ])
  const withPlans = new Set((await Plan.distinct('donor', { status: { $in: ['active', 'paused', 'past_due'] } })).map(String))
  await Donor.bulkWrite(
    byDonor.map((r) => ({
      updateOne: {
        filter: { _id: r._id },
        update: { $set: { totalGiven: r.total, giftCount: r.count, firstGiftAt: r.first, lastGiftAt: r.last, hasActivePlan: withPlans.has(String(r._id)) } },
      },
    })),
  )
  for (const [field, Model] of [['appeal', Appeal], ['fundraiser', Fundraiser]] as const) {
    const rows = await Gift.aggregate<{ _id: Types.ObjectId; total: number; donors: unknown[] }>([
      { $match: { status: 'succeeded', [field]: { $ne: null } } },
      { $group: { _id: `$${field}`, total: { $sum: '$amount' }, donors: { $addToSet: '$donor' } } },
    ])
    await (Model as typeof Appeal).bulkWrite(
      rows.map((r) => ({ updateOne: { filter: { _id: r._id }, update: { $set: { raised: r.total, donorCount: r.donors.length } } } })),
    )
  }
}

/* ---------- compliance ---------- */
function minimalPdf(title: string, lines: string[]) {
  const text = [title, '', ...lines, '', 'SAMPLE DOCUMENT - development data only']
  const content = `BT /F1 20 Tf 60 760 Td (${text[0].replace(/[()\\]/g, '')}) Tj /F1 11 Tf ${text.slice(1).map((l) => `0 -18 Td (${l.replace(/[()\\]/g, '')}) Tj`).join(' ')} ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf, 'latin1')
}

async function seedCompliance(staff: InstanceType<typeof Staff>[]) {
  const by = (role: string) => staff.find((s) => s.role === role)!
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const entries: { register: string; fields: Record<string, unknown> }[] = []
  const add = (register: string, fields: Record<string, unknown>) => entries.push({ register, fields })

  add('responsible-people', { name: 'Yusuf Karim', position: 'chair', email: 'yusuf@alanwaar.group', appointed: '2020-07-30', acncNotified: '2020-08-10', declarationSigned: '2026-08-01', disqualifiedCheck: '2026-08-01', nextCheck: '2027-08-01' })
  add('responsible-people', { name: 'Maryam Haddad', position: 'secretary', email: 'maryam@alanwaar.group', appointed: '2020-07-30', acncNotified: '2020-08-10', declarationSigned: '2026-08-01', disqualifiedCheck: '2026-08-01', nextCheck: '2027-08-01' })
  add('responsible-people', { name: 'Omar Siddiqui', position: 'treasurer', email: 'omar@alanwaar.group', appointed: '2022-03-14', acncNotified: '2022-03-30', declarationSigned: '2026-08-01', disqualifiedCheck: '2026-08-01', nextCheck: '2027-08-01' })
  add('responsible-people', { name: 'Hana Chami', position: 'director', appointed: '2023-11-02', acncNotified: '2023-11-20', declarationSigned: '2026-08-01', disqualifiedCheck: '2026-08-01', nextCheck: '2027-08-01' })
  add('responsible-people', { name: 'Ibrahim Nouri', position: 'director', appointed: '2021-05-05', ceased: '2025-06-30', acncNotified: '2025-07-15', declarationSigned: '2024-08-01', disqualifiedCheck: '2024-08-01', notes: 'Resigned at the 2025 AGM.' })

  add('overseas-partners', { name: 'Tarim Relief Foundation', country: 'yemen', contact: 'Abdullah Ba-Alawi', activities: 'Food pack procurement and distribution; water station builds; the Tarim school.', agreementSigned: '2024-01-15', dueDiligence: '2025-11-20', sanctionsCheck: '2026-07-01', risk: 'medium', lastReport: '2026-08-30', nextReview: '2026-11-20' })
  add('overseas-partners', { name: 'Gaza Community Kitchens', country: 'gaza', contact: 'On file', activities: 'Hot meals in the camps; emergency food parcels.', agreementSigned: '2024-02-01', dueDiligence: '2025-10-05', sanctionsCheck: '2026-07-01', risk: 'high', lastReport: '2026-09-10', nextReview: '2026-10-05', notes: 'High risk because of access and banking. Monthly reporting and photo evidence required.' })
  add('overseas-partners', { name: 'Tripoli Aid Network', country: 'lebanon', activities: 'In-country food pack purchase and distribution.', agreementSigned: '2025-03-01', dueDiligence: '2025-02-20', sanctionsCheck: '2026-01-10', risk: 'medium', lastReport: '2026-06-15', nextReview: '2026-02-20' })
  add('overseas-partners', { name: 'Banjul Masjid Trust', country: 'gambia', activities: 'Construction and upkeep of the masjid.', agreementSigned: '2023-09-01', dueDiligence: '2025-09-01', sanctionsCheck: '2026-07-01', risk: 'low', lastReport: '2026-05-30', nextReview: '2027-09-01' })

  const policies: [string, string, string, string, string][] = [
    ['Conflict of interest policy', 'Board', '2.0', '2026-08-01', '2027-08-01'],
    ['Overseas aid and partner policy', 'Board', '3.1', '2025-11-01', '2026-11-01'],
    ['Anti-fraud and anti-corruption policy', 'Treasurer', '1.2', '2026-08-01', '2027-08-01'],
    ['Safeguarding children and vulnerable people', 'Secretary', '2.0', '2025-06-01', '2026-06-01'],
    ['Privacy policy', 'Secretary', '1.4', '2026-09-01', '2027-09-01'],
    ['Complaints handling policy', 'Secretary', '1.0', '2024-11-01', '2025-11-01'],
    ['Financial management and delegations', 'Treasurer', '2.2', '2026-08-01', '2027-08-01'],
    ['Zakat collection and distribution policy', 'Board', '1.1', '2026-01-20', '2027-01-20'],
    ['Volunteer policy', 'Secretary', '1.0', '2025-03-01', '2027-03-01'],
    ['Risk management policy', 'Board', '1.3', '2026-08-01', '2027-08-01'],
  ]
  for (const [name, owner, version, approved, nextReview] of policies) add('policies', { name, owner, version, approved, nextReview, summary: '' })

  const risks: [string, string, number, number, string, string][] = [
    ['Funds diverted by an overseas partner', 'overseas', 3, 5, 'treating', 'Written agreements, staged transfers, monthly reporting with photo evidence, annual due diligence.'],
    ['Transfer blocked or delayed by a bank', 'financial', 4, 3, 'open', 'Two banking relationships; documented purpose for every transfer.'],
    ['Donor data breach', 'cyber', 2, 5, 'treating', 'Role-based access, audit log, MFA on email, no card data held.'],
    ['Staff or volunteer misappropriation of cash', 'fraud', 2, 3, 'treating', 'Two people count cash at events; gifts entered the same day; reconciled weekly.'],
    ['Safeguarding incident at a distribution', 'safeguarding', 2, 5, 'treating', 'Partner safeguarding clause; photography consent rules.'],
    ['Reputational damage from a misleading appeal', 'reputational', 2, 4, 'accepted', 'Appeal copy approved by two people; figures sourced.'],
    ['Late AIS lodgement', 'compliance', 2, 3, 'treating', 'Statutory calendar with reminders; treasurer owns it.'],
    ['Loss of key volunteers', 'operational', 3, 2, 'open', 'Documented processes; training session each quarter.'],
    ['Sanctions breach through a partner', 'overseas', 2, 5, 'treating', 'Sanctions checks at onboarding and every six months.'],
    ['Website or payment outage in Ramadan', 'operational', 2, 4, 'treating', 'Hosting monitored; bank transfer always available as a fallback.'],
  ]
  risks.forEach(([title, category, likelihood, impact, status, controls], i) =>
    add('risks', { title, category, likelihood: String(likelihood), impact: String(impact), status, controls, owner: pick(['Treasurer', 'Chair', 'Secretary']), nextReview: iso(new Date(NOW.getTime() + (i === 1 ? -12 : 40 + i * 9) * DAY)) }))

  add('conflicts', { person: 'Omar Siddiqui', declared: '2025-08-01', kind: 'potential', nature: 'His brother-in-law owns a printing business the charity has used for event materials.', action: 'Omar leaves the room for any printing decision; three quotes required.', status: 'managed' })
  add('conflicts', { person: 'Hana Chami', declared: '2023-11-02', kind: 'perceived', nature: 'Volunteer board member of Tripoli Aid Network.', action: 'Does not vote on Lebanon partner decisions.', status: 'managed' })
  add('conflicts', { person: 'Yusuf Karim', declared: '2026-09-02', kind: 'actual', nature: 'Family member applied for the new part-time coordinator role.', action: 'To be considered by the board at the October meeting.', status: 'open' })

  await RegisterEntry.insertMany(entries.map((e) => ({ ...e, updatedBy: by('compliance')._id, updatedByName: by('compliance').name, createdAt: daysAgo(between(30, 300)) })))

  /* the statutory calendar */
  const Y = NOW.getFullYear()
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9)
  const k = by('compliance')
  const t = by('finance')
  await Obligation.insertMany([
    { title: 'Annual Information Statement 2026', category: 'acnc', description: 'Lodged with the ACNC for the year to 30 June 2026. Due within six months of the year end.', dueDate: at(Y, 12, 31), recurrence: 'annual', owner: t._id, ownerName: t.name },
    { title: 'Business Activity Statement — Jul to Sep', category: 'ato', description: 'Quarterly BAS. Confirm the date with the accountant if lodging through a tax agent.', dueDate: at(Y, 10, 28), recurrence: 'quarterly', owner: t._id, ownerName: t.name },
    { title: 'Annual General Meeting', category: 'governance', description: 'Hold the AGM and table the financial statements. Confirm the deadline against the constitution.', dueDate: at(Y, 11, 30), recurrence: 'annual', owner: by('admin')._id, ownerName: by('admin').name },
    { title: 'Board meeting — Q2', category: 'governance', dueDate: at(Y, 10, 14), recurrence: 'quarterly', owner: by('admin')._id, ownerName: by('admin').name },
    { title: 'Annual review of overseas activities (ECS 2)', category: 'acnc', description: 'Review each partner, the controls, and what the money achieved. Minute it at the board.', dueDate: at(Y, 11, 20), recurrence: 'annual', owner: k._id, ownerName: k.name },
    { title: 'NSW charitable fundraising authority — annual return', category: 'fundraising', description: 'Check the authority conditions and any return required by NSW Fair Trading.', dueDate: at(Y, 10, 31), recurrence: 'annual', owner: k._id, ownerName: k.name },
    { title: 'Public liability insurance renewal', category: 'insurance', dueDate: at(Y, 11, 1), recurrence: 'annual', owner: t._id, ownerName: t.name },
    { title: 'Safeguarding policy review', category: 'governance', description: 'Review date passed in June. Board to re-adopt.', dueDate: new Date(NOW.getTime() - 8 * DAY), recurrence: 'annual', owner: k._id, ownerName: k.name },
    { title: 'Sanctions re-check: all overseas partners', category: 'other', dueDate: new Date(NOW.getTime() + 5 * DAY), recurrence: 'none', owner: k._id, ownerName: k.name },
    { title: 'Donor tax statements sent', category: 'ato', description: 'Every donor has their end-of-year statement.', dueDate: at(Y, 7, 14), recurrence: 'annual', status: 'done', completedAt: at(Y, 7, 3), completedByName: t.name, owner: t._id, ownerName: t.name },
    { title: 'Annual Information Statement 2025', category: 'acnc', dueDate: at(Y - 1, 12, 31), recurrence: 'none', status: 'done', completedAt: at(Y - 1, 12, 12), completedByName: t.name, owner: t._id, ownerName: t.name },
    { title: 'Business Activity Statement — Apr to Jun', category: 'ato', dueDate: at(Y, 7, 28), recurrence: 'none', status: 'done', completedAt: at(Y, 7, 22), completedByName: t.name, owner: t._id, ownerName: t.name },
  ])

  /* the document library */
  const docs: [string, string, string, boolean, number][] = [
    ['Constitution', 'governance', 'The company constitution as registered, with the 2023 amendment.', false, 2],
    ['Conflict of interest policy', 'policy', 'Adopted by the board on 1 August 2025.', true, 2],
    ['Overseas aid and partner policy', 'policy', 'Version 3.1.', true, 3],
    ['Safeguarding children and vulnerable people', 'policy', 'Due for review.', true, 1],
    ['Partner agreement — Tarim Relief Foundation', 'agreement', 'Signed January 2024, renewed annually.', false, 1],
    ['Partner agreement — Gaza Community Kitchens', 'agreement', 'Signed February 2024.', false, 1],
    ['AIS 2025 — as lodged', 'acnc', 'The statement as lodged with the ACNC on 12 December 2025.', false, 1],
    ["Auditor's compliance report", 'audit', 'Placeholder until the client supplies the report (due Tue 30 Sep).', false, 1],
  ]
  const readers = staff.filter((s) => s.passwordSet)
  for (const [title, category, description, requiresAck, versions] of docs) {
    const vs = []
    for (let n = 1; n <= versions; n++) {
      const key = `documents/seed-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-v${n}.pdf`
      const body = minimalPdf(title, [`Version ${n}`, description])
      await putFile(key, body, 'application/pdf')
      vs.push({ n, fileKey: key, fileName: `${title}${versions > 1 ? ` v${n}` : ''}.pdf`, size: body.length, mime: 'application/pdf', uploadedBy: k._id, uploadedByName: k.name, uploadedAt: daysAgo(400 - n * 90), note: n > 1 ? 'Updated after board review' : undefined })
    }
    await LibraryDocument.create({
      title, category, description, versions: vs, requiresAck,
      acks: requiresAck ? readers.filter(() => chance(0.6)).map((s) => ({ staff: s._id, name: s.name, version: versions, at: daysAgo(between(1, 60)) })) : [],
      createdAt: daysAgo(400),
    })
  }
}

async function seedEmailsAndAudit(staff: InstanceType<typeof Staff>[], donors: SeedDonor[], amina: SeedDonor) {
  const { receiptEmail, preChargeEmail } = await import('../emails/templates')
  const { getSettings } = await import('../models')
  const s = await getSettings()
  const recent = await Gift.find({ status: 'succeeded' }).sort({ date: -1 }).limit(20).lean()
  for (const g of recent) {
    const d = donors.find((x) => x._id.equals(g.donor))
    if (!d) continue
    const e = receiptEmail({ ...g, designation: g.designation as Designation, method: g.method as Method, fee: g.fee ?? 0 }, d.firstName, s)
    await EmailMessage.create({ to: d.email, ...e, transport: 'outbox', status: 'sent', sentAt: g.date, donor: d._id, createdAt: g.date })
  }
  const aminaPlan = await Plan.findOne({ donor: amina._id, kind: 'recurring' }).lean()
  if (aminaPlan) {
    const e = preChargeEmail({ ...aminaPlan, frequency: aminaPlan.frequency as Frequency }, 'Amina')
    await EmailMessage.create({ to: amina.email, ...e, transport: 'outbox', status: 'sent', sentAt: daysAgo(1), donor: amina._id, createdAt: daysAgo(1) })
  }

  const events = []
  for (let i = 0; i < 160; i++) {
    const who = pick(staff.filter((x) => x.passwordSet))
    const at = daysAgo(rand() * 60)
    const kind = pick(['staff.login', 'gift.offline', 'donor.update', 'enquiry.note', 'register.update', 'appeal.update', 'report.export'])
    const d = pick(donors)
    const summary =
      kind === 'staff.login' ? `${who.name} signed in`
      : kind === 'gift.offline' ? `Recorded $${between(2, 40) * 5} cash gift from ${d.firstName} ${d.lastName}`
      : kind === 'donor.update' ? `Updated contact details for ${d.firstName} ${d.lastName} (${d.number})`
      : kind === 'enquiry.note' ? `Added a note to an enquiry from ${d.firstName} ${d.lastName}`
      : kind === 'register.update' ? `Updated an entry in the Risks register`
      : kind === 'appeal.update' ? `Posted an update on an appeal`
      : `Exported the income report`
    events.push({ at, actor: { kind: 'staff', id: who._id, name: who.name }, action: kind, summary, ip: '203.0.113.' + between(2, 250) })
  }
  await AuditEvent.insertMany(events)
}
