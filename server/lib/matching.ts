import { format } from 'date-fns'
import type { Types } from 'mongoose'
import { BANK_REF_PATTERN, DESIGNATIONS, type BankLineStatus, type Designation } from '../../shared/domain'
import { formatMoney } from '../../shared/money'
import { Appeal, Donor, Gift } from '../models'

/* ---------------------------------------------------------------------------
   Matching bank statement lines to donors, pledges and appeals.

   This replaces the hour or two a week someone spent with a statement in one
   window and the donor list in the other, so it is written to be the careful
   colleague rather than the clever one:

     1. A reference the website gave a donor (AA-7K3F9Q) that belongs to a
        pending pledge          → matched, 0.99 — unless the amount differs.
        A reference an earlier gift used (people set up a standing transfer
        with the reference they were first given) → matched, 0.9.
     2. The payer text is one the office already confirmed for a donor (a
        learnt bank alias)      → matched, 0.95 — unless another donor now
        has that same name, in which case it needs a look.
     3. The full name matches exactly one donor → "needs a look", 0.85, and
        matched only if that donor also has a pending pledge of exactly this
        amount. A name alone is not enough to issue a tax receipt unseen:
        "Confirm all" would otherwise receipt the one Mohammed Ali we know
        for a transfer from a Mohammed Ali we don't, and then learn the alias
        so every later transfer went to him too. Several donors with that
        name                    → "needs a look", with the people named.
     4. Close to a name (a typo, or surname + first initial, the way banks
        shorten names)          → "needs a look", 0.6, never matched.
     5. Nothing                 → unmatched.

   Every decision carries its reasons in words, because the person checking
   the screen has to be able to disagree with it. Nothing is ever "matched"
   without a donor, and nothing here saves anything: the office confirms.

   Everything the matcher needs — pending pledges, every donor's name and
   aliases, the open appeals — is loaded once per statement, not per line.
--------------------------------------------------------------------------- */

export type LineIn = { date: Date; amount: number; description: string; reference?: string }

type Oid = Types.ObjectId
export type Candidate = { donor: Oid; donorName: string; number: string }
export type MatchOut = {
  status: BankLineStatus
  match: {
    donor?: Oid
    donorName?: string
    appeal?: Oid
    appealTitle?: string
    designation: Designation
    confidence: number
    reasons: string[]
    pledge?: Oid
    candidates?: Candidate[]
    via?: MatchVia
  }
}

/** How a line's donor was found. A name on its own is never enough to save a
 *  line unseen, and only a reference, a pledge or a person's choice teaches
 *  the matcher a new alias (routes/admin/bank.ts). */
export type MatchVia = 'pledge' | 'usedRef' | 'alias' | 'name' | 'fuzzy' | 'manual'

/* ---------- reading a bank narrative ---------- */

/** Upper case, accents gone, punctuation to spaces, one space between words. */
export function normalise(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[''`]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

/** Words banks put around the payer's name. Removed wherever they appear. */
const NOISE = new Set(
  (
    'TRANSFER TRANSFERS TFR TRF FROM FAST INTERNET ONLINE DIRECT CREDIT CR OSKO PAYMENT PMT DEPOSIT NPP PAYID PAY ID ' +
    'NETBANK COMMBANK APP MOBILE BANKING BANK IB MB BPAY EFT INWARD RECEIVED REF REFERENCE DONATION DONATIONS DONATE ' +
    'GIFT FOR TO THE VIA ANZ CBA NAB WBC WESTPAC ST GEORGE BENDIGO ING MACQUARIE UP ACC ACCT MR MRS MS MISS DR SR BRO SIS ' +
    'CHARITY GROUP LTD FUND APPEAL'
  ).split(' '),
)

/** Words that say what a gift is for. */
const DESIGNATION_WORDS: [RegExp, Designation][] = [
  [/\bFITR(A|AH|ANA)?\b/, 'zakat_fitr'],
  [/\bZAKA+(T|H)\b/, 'zakat'],
  [/\bSADA(Q|K)A+(H|T)?\b/, 'sadaqah'],
  [/\bLILLAH\b/, 'lillah'],
  [/\bKAF+A+RA+H?\b/, 'kaffarah'],
  [/\bFIDYA+H?\b/, 'fidyah'],
]
const DESIGNATION_TOKENS = /^(FITR|FITRA|FITRAH|FITRANA|ZAKAT|ZAKAAT|ZAKAH|SADAQA|SADAQAH|SADAQAT|SADAKA|SADAKAH|LILLAH|KAFFARAH|KAFFARA|KAFARAH|KAFARA|FIDYAH|FIDYA|ZAKAT_FITR)$/

/** Words that point at an appeal. Matched against each open appeal's title,
 *  slug, country and causes, so a new appeal needs no code change. */
const APPEAL_WORDS = new Set(
  'GAZA YEMEN LEBANON SYRIA GAMBIA BANGLADESH PALESTINE SUDAN WATER WELL FOOD MEALS MEAL SCHOOL MASJID MOSQUE QURBANI UDHIYAH ORPHAN ORPHANS WINTER BLANKETS RAMADAN IFTAR'.split(' '),
)

/** Lines that are money in but not a gift: the office should ignore them. */
const NOT_A_GIFT: [RegExp, string][] = [
  [/\bINTEREST\b/, 'Looks like bank interest, not a donation. You can ignore it.'],
  [/\b(REFUND|REVERSAL|REVERSED|CHARGEBACK)\b/, 'Looks like a refund from a supplier, not a donation. You can ignore it.'],
  [/\bSTRIPE\b/, 'Looks like a Stripe payout. Card donations are already recorded one by one, so ignore this.'],
  [/\bPAYPAL\b/, 'Looks like a PayPal transfer. PayPal donations are already recorded, so ignore this.'],
  [/\b(ATO|AUSTRALIAN TAXATION)\b/, 'Looks like a payment from the ATO, not a donation. You can ignore it.'],
  [/\bDIVIDEND\b/, 'Looks like a dividend, not a donation. You can ignore it.'],
]

export function findReference(...texts: (string | undefined)[]): string | undefined {
  for (const t of texts) {
    const m = t ? BANK_REF_PATTERN.exec(t) : null
    if (m) return `AA-${m[1]!.toUpperCase()}`
  }
  return undefined
}

/** "TRANSFER FROM A RAHMAN AA-7K3F9Q GAZA" → "A RAHMAN". What is left when
 *  the bank's words, numbers, the reference and the purpose words are gone. */
export function payerName(description: string): string {
  const s = normalise(description.replace(new RegExp(BANK_REF_PATTERN.source, 'gi'), ' ').replace(/AL[\s-]*ANWAAR/gi, ' '))
  return s
    .split(' ')
    .filter((w) => w && !/\d/.test(w) && !NOISE.has(w) && !APPEAL_WORDS.has(w) && !DESIGNATION_TOKENS.test(w))
    .join(' ')
}

const sortKey = (s: string) => s.split(' ').filter(Boolean).sort().join(' ')

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]!
}

/** What a line says it is for: a designation and the words that point at an appeal. */
export function purposeOf(description: string) {
  const s = normalise(description)
  let designation: { value: Designation; word: string } | undefined
  for (const [re, d] of DESIGNATION_WORDS) {
    const m = re.exec(s)
    if (m) {
      designation = { value: d, word: m[0] }
      break
    }
  }
  const words = [...new Set(s.split(' ').filter((w) => APPEAL_WORDS.has(w)))]
  const notAGift = NOT_A_GIFT.find(([re]) => re.test(s))?.[1]
  return { designation, words, notAGift }
}

const day = (d: Date) => format(d, 'd MMM')
const cap = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())

/* ---------- the matcher ---------- */

type DonorRow = { _id: Oid; firstName: string; lastName?: string | null; number: string; bankAliases?: string[] | null; lastGiftAt?: Date | null }
type AppealRow = { _id: Oid; title: string; words: Set<string>; titleWords: Set<string>; raised: number; featured: boolean; country: string }

export async function matchLines(lines: LineIn[]): Promise<MatchOut[]> {
  /* everything, once */
  const refsInFile = [...new Set(lines.map((l) => findReference(l.reference, l.description)).filter(Boolean))] as string[]
  const [pledges, usedRefs, donors, appealDocs] = await Promise.all([
    Gift.find({ status: 'pending', method: 'bank' }).select('donor donorName amount reference date appeal appealTitle designation number').lean(),
    refsInFile.length
      ? Gift.find({ reference: { $in: refsInFile }, status: 'succeeded' }).select('donor donorName reference date number amount').sort({ date: -1 }).lean()
      : Promise.resolve([]),
    Donor.find({ status: 'active' }).select('firstName lastName number bankAliases lastGiftAt').lean<DonorRow[]>(),
    Appeal.find({ status: 'open' }).select('title slug country causes where raised featured').lean(),
  ])

  const donorById = new Map(donors.map((d) => [String(d._id), d]))
  const nameOf = (d: DonorRow) => `${d.firstName} ${d.lastName ?? ''}`.trim()
  const byKey = new Map<string, DonorRow[]>()
  const byAlias = new Map<string, DonorRow[]>()
  const bySurname = new Map<string, DonorRow[]>()
  for (const d of donors) {
    const k = sortKey(normalise(nameOf(d)))
    if (k) byKey.set(k, [...(byKey.get(k) ?? []), d])
    for (const a of d.bankAliases ?? []) {
      const ak = sortKey(normalise(a))
      if (ak) byAlias.set(ak, [...(byAlias.get(ak) ?? []), d])
    }
    const sn = normalise(d.lastName ?? '')
    if (sn) bySurname.set(sn, [...(bySurname.get(sn) ?? []), d])
  }
  const allKeys = [...byKey.keys()]

  const pledgeByRef = new Map(pledges.filter((p) => p.reference).map((p) => [p.reference!.toUpperCase(), p]))
  const pledgesByDonor = new Map<string, typeof pledges>()
  for (const p of pledges) pledgesByDonor.set(String(p.donor), [...(pledgesByDonor.get(String(p.donor)) ?? []), p])
  const usedByRef = new Map<string, (typeof usedRefs)[number]>()
  for (const g of usedRefs) if (g.reference && !usedByRef.has(g.reference.toUpperCase())) usedByRef.set(g.reference.toUpperCase(), g)

  const appeals: AppealRow[] = appealDocs.map((a) => ({
    _id: a._id,
    title: a.title,
    raised: a.raised ?? 0,
    featured: Boolean(a.featured),
    country: a.country,
    words: new Set(normalise([a.title, a.slug, a.country, a.where ?? '', ...(a.causes ?? [])].join(' ')).split(' ')),
    titleWords: new Set(normalise(a.title).split(' ')),
  }))
  const appealById = new Map(appeals.map((a) => [String(a._id), a]))

  /* a pledge is paid once, even if two lines carry its reference */
  const claimed = new Set<string>()

  return lines.map((line) => {
    const reasons: string[] = []
    const out: MatchOut = { status: 'unmatched', match: { designation: 'general', confidence: 0, reasons } }
    const m = out.match
    const setDonor = (d: { _id: Oid } & Partial<DonorRow>, name?: string) => {
      m.donor = d._id
      m.donorName = name ?? (d.firstName ? nameOf(d as DonorRow) : undefined)
    }

    const ref = findReference(line.reference, line.description)
    const payer = payerName(line.description)
    const payerKey = sortKey(payer)
    const purpose = purposeOf(`${line.description} ${line.reference ?? ''}`)

    /* ---- 1. the reference ---- */
    const pledge = ref ? pledgeByRef.get(ref) : undefined
    if (pledge && !claimed.has(String(pledge._id))) {
      claimed.add(String(pledge._id))
      const d = donorById.get(String(pledge.donor))
      setDonor(d ?? { _id: pledge.donor as Oid }, d ? nameOf(d) : pledge.donorName)
      m.pledge = pledge._id
      m.via = 'pledge'
      reasons.push(`Reference ${ref} matches ${pledge.donorName}'s pledge of ${formatMoney(pledge.amount)} on ${day(pledge.date)}`)
      if (pledge.amount === line.amount) {
        out.status = 'matched'
        m.confidence = 0.99
      } else {
        out.status = 'review'
        m.confidence = 0.7
        reasons.push(`Amount differs from the pledge (${formatMoney(pledge.amount)} pledged)`)
      }
    } else if (pledge) {
      reasons.push(`Reference ${ref} is ${pledge.donorName}'s pledge, but another line in this statement already pays it`)
      const d = donorById.get(String(pledge.donor))
      if (d) setDonor(d)
      out.status = 'review'
      m.confidence = 0.5
    } else if (ref && usedByRef.has(ref)) {
      const g = usedByRef.get(ref)!
      const d = donorById.get(String(g.donor))
      if (d) {
        setDonor(d)
        out.status = 'matched'
        m.confidence = 0.9
        m.via = 'usedRef'
        reasons.push(`Reference ${ref} was used by ${nameOf(d)} before (donation ${g.number} on ${format(g.date, 'd MMM yyyy')})`)
      }
    }

    /* ---- 2 to 4. the payer's name ---- */
    if (!m.donor && payerKey) {
      const alias = byAlias.get(payerKey)
      const exact = byKey.get(payerKey)
      /* a learnt alias is trusted only while it is unambiguous: if someone
         else with that very name has since joined, the old alias may be the
         wrong one of the two, so a person decides */
      const sameName = (exact ?? []).filter((d) => !alias?.some((a) => String(a._id) === String(d._id)))
      if (alias?.length === 1 && sameName.length) {
        setDonor(alias[0]!)
        out.status = 'review'
        m.confidence = 0.6
        m.via = 'alias'
        m.candidates = [alias[0]!, ...sameName].slice(0, 6).map((d) => ({ donor: d._id, donorName: nameOf(d), number: d.number }))
        reasons.push(
          `Paid from this account before as ${nameOf(alias[0]!)}, but ${sameName.map((d) => `${nameOf(d)} (${d.number})`).join(', ')} has the same name: check which one`,
        )
      } else if (alias?.length === 1) {
        setDonor(alias[0]!)
        out.status = 'matched'
        m.confidence = 0.95
        m.via = 'alias'
        reasons.push(`Paid from this account before: “${payer}” is ${nameOf(alias[0]!)}`)
      } else if (exact?.length === 1) {
        /* a name alone: suggested, never saved unseen (see the header) */
        setDonor(exact[0]!)
        out.status = 'review'
        m.confidence = 0.85
        m.via = 'name'
        reasons.push(`Name matches ${nameOf(exact[0]!)} (${exact[0]!.number}); a name alone is not enough, so check before saving`)
      } else if ((exact?.length ?? 0) > 1 || (alias?.length ?? 0) > 1) {
        const people = exact && exact.length > 1 ? exact : alias!
        out.status = 'review'
        m.confidence = 0.5
        m.candidates = people.slice(0, 6).map((d) => ({ donor: d._id, donorName: nameOf(d), number: d.number }))
        reasons.push(`${people.length} donors are called ${nameOf(people[0]!)} (${people.map((d) => d.number).join(', ')}): choose the right one`)
      } else {
        const close = fuzzy(payer, payerKey)
        if (close.length === 1) {
          setDonor(close[0]!.d)
          out.status = 'review'
          m.confidence = close[0]!.score
          m.via = 'fuzzy'
          reasons.push(`Name is close to ${nameOf(close[0]!.d)} (${close[0]!.d.number}): ${close[0]!.why}`)
        } else if (close.length > 1) {
          out.status = 'review'
          m.confidence = 0.4
          m.candidates = close.slice(0, 6).map((c) => ({ donor: c.d._id, donorName: nameOf(c.d), number: c.d.number }))
          reasons.push(`“${payer}” could be ${close.length} donors: ${close.slice(0, 3).map((c) => nameOf(c.d)).join(', ')}${close.length > 3 ? '…' : ''}`)
        }
      }

      /* the name found them and they have a pledge for exactly this amount:
         the reference was mistyped or left off, and this line pays it */
      if (m.donor && !m.pledge) {
        const theirs = (pledgesByDonor.get(String(m.donor)) ?? []).find((p) => p.amount === line.amount && !claimed.has(String(p._id)))
        if (theirs) {
          claimed.add(String(theirs._id))
          m.pledge = theirs._id
          /* an exact name plus a pending pledge of exactly this amount is a
             second, independent signal: that is enough to save. A fuzzy name
             or a doubted alias stays with a person even so. */
          if (m.via === 'name') {
            out.status = 'matched'
            m.confidence = 0.9
            m.via = 'pledge'
          }
          reasons.push(
            ref
              ? `Reference ${ref} is not one we issued (a typo of ${theirs.reference}?), but the amount is exactly their pledge of ${day(theirs.date)}`
              : `Same amount as their pledge of ${formatMoney(theirs.amount)} on ${day(theirs.date)} (${theirs.reference})`,
          )
        }
      }
    }

    if (!m.donor && !m.candidates) {
      if (ref) reasons.push(`Reference ${ref} does not match any pledge`)
      if (purpose.notAGift) reasons.push(purpose.notAGift)
      else reasons.push(payer ? `No donor called “${cap(payer)}” yet` : 'No name on the line to match')
    }

    /* ---- what it is for ---- */
    const pledgeRow = m.pledge ? pledges.find((p) => String(p._id) === String(m.pledge)) : undefined
    if (pledgeRow) {
      m.designation = (pledgeRow.designation as Designation) ?? 'general'
      if (pledgeRow.appeal) {
        m.appeal = pledgeRow.appeal
        m.appealTitle = pledgeRow.appealTitle ?? appealById.get(String(pledgeRow.appeal))?.title
      }
      if (purpose.designation && purpose.designation.value !== m.designation) {
        reasons.push(`The line says ${purpose.designation.word}, but the pledge was for ${DESIGNATIONS[m.designation].label}; kept the pledge's choice`)
      }
    } else {
      if (purpose.designation) {
        m.designation = purpose.designation.value
        reasons.push(`“${purpose.designation.word}” in the description → ${DESIGNATIONS[purpose.designation.value].label}`)
      }
      if (purpose.words.length) {
        const scored = appeals
          .map((a) => ({ a, n: purpose.words.reduce((n, w) => n + (a.titleWords.has(w) ? 2 : a.words.has(w) ? 1 : 0), 0) }))
          .filter((x) => x.n > 0)
          .sort((x, y) => y.n - x.n || Number(y.a.featured) - Number(x.a.featured) || y.a.raised - x.a.raised)
        const best = scored[0]
        if (best) {
          m.appeal = best.a._id
          m.appealTitle = best.a.title
          /* a word in the title counts double: GAZA → "Gaza cannot wait" before
             another appeal that is merely in Gaza */
          const ties = scored.filter((x) => x.n === best.n).length
          reasons.push(
            `“${purpose.words.join(' ')}” in the description → ${best.a.title}${ties > 1 ? ` (one of ${ties} appeals that fit; change it if needed)` : ''}`,
          )
        }
      }
    }
    return out
  })

  /* close, but not the same: a typo, or the bank's "RAHMAN A" */
  function fuzzy(payer: string, payerKey: string): { d: DonorRow; score: number; why: string }[] {
    const tokens = payer.split(' ').filter(Boolean)
    const initials = tokens.filter((t) => t.length === 1)
    const words = tokens.filter((t) => t.length > 1)
    const found = new Map<string, { d: DonorRow; score: number; why: string }>()
    const add = (d: DonorRow, score: number, why: string) => {
      const prev = found.get(String(d._id))
      if (!prev || prev.score < score) found.set(String(d._id), { d, score, why })
    }
    /* surname and first initial: "A RAHMAN", "RAHMAN A", "HASSAN M" */
    if (initials.length === 1 && words.length >= 1) {
      for (const d of bySurname.get(words.join(' ')) ?? []) {
        if (normalise(d.firstName).startsWith(initials[0]!)) add(d, 0.6, 'surname and first initial match')
      }
    }
    /* a middle initial the donor record does not have: "FATIMA Z NOOR" */
    if (initials.length && words.length >= 2) {
      for (const d of byKey.get(sortKey(words.join(' '))) ?? []) add(d, 0.65, 'name matches apart from an initial')
    }
    /* a typo or two in the whole name */
    if (payerKey.replace(/ /g, '').length >= 6) {
      for (const k of allKeys) {
        if (Math.abs(k.length - payerKey.length) > 2) continue
        const dist = levenshtein(k, payerKey)
        if (dist > 0 && dist <= 2) for (const d of byKey.get(k)!) add(d, dist === 1 ? 0.65 : 0.55, `${dist === 1 ? 'one letter' : 'two letters'} different`)
      }
    }
    /* several close matches: the most recent giver first */
    return [...found.values()].sort((a, b) => b.score - a.score || +(b.d.lastGiftAt ?? 0) - +(a.d.lastGiftAt ?? 0))
  }
}
