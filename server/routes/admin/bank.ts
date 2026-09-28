import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import Papa from 'papaparse'
import { createHash } from 'node:crypto'
import { format } from 'date-fns'
import type { Types } from 'mongoose'
import { z } from 'zod'
import { DESIGNATION_KEYS, type BankLineStatus, type Designation } from '../../../shared/domain'
import { formatMoney } from '../../../shared/money'
import type { BankImport as BankImportDTO, BankLine as BankLineDTO } from '../../../shared/types'
import { Appeal, BankImport, Donor, Gift, nextDonorNumber, nextSeq, type BankImportDoc, type DonorDoc } from '../../models'
import { audit } from '../../lib/audit'
import { requireStaff } from '../../lib/auth'
import { fullName, issueReceipt, recordGift } from '../../lib/giving'
import { HttpError, badRequest, isId, notFound, out, paging, parse, zId } from '../../lib/http'
import { findReference, matchLines, normalise, payerName, type LineIn } from '../../lib/matching'
import { refreshForGift } from '../../lib/stats'

/* ---------------------------------------------------------------------------
   /api/admin/bank — bank statement import.

   Upload → match → check → confirm. Uploading reads the file and proposes a
   donor, appeal and designation for every money-in line; NOTHING is saved as
   a gift until someone presses confirm, and confirm only ever saves lines in
   "matched" — a line the office has not looked at ("needs a look",
   "unmatched") is never turned into a gift by default. The system never
   guesses quietly.

   Reading the file: the big four Australian banks' exports are recognised by
   shape (CommBank and ANZ have no heading row; Westpac and NAB do), and any
   file with sensible headings (date / amount or credit / description) works.
   When the columns cannot be told apart for certain, the route answers 422
   with the first rows, the screen asks the person which column is which, and
   the file is posted again with that mapping.

   Duplicates: every line is hashed (date + amount + description) and a line
   already in an earlier import is marked "already imported" instead of being
   matched, because statement exports overlap — last week's file and this
   week's both have Friday in them.
--------------------------------------------------------------------------- */

const r = Router()
r.use(requireStaff('bank.import'))

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } })
const takeFile = (req: Request, res: Response, next: NextFunction) =>
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(new HttpError(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, err.code === 'LIMIT_FILE_SIZE' ? 'That file is over 5 MB. A bank statement CSV is usually far smaller — is it the right file?' : 'The file could not be read.'))
    } else next(err as Error | undefined)
  })

/* ======================= reading a statement file ======================= */

type DateFormat = 'dmy' | 'mdy' | 'ymd'
type Mapping = {
  date: number
  amount?: number
  credit?: number
  debit?: number
  description: number
  reference?: number
  dateFormat: DateFormat
  hasHeader: boolean
}

const MONTHS: Record<string, number> = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 }

function parseDate(raw: string, fmt: DateFormat): Date | null {
  const s = raw.trim().replace(/\s+\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?$/i, '')
  let m = /^(\d{1,2})[\s/.-]([A-Za-z]{3})[A-Za-z]*[\s/.-](\d{2,4})$/.exec(s)
  if (m) {
    const mon = MONTHS[m[2]!.toUpperCase()]
    if (mon === undefined) return null
    return make(Number(m[3]), mon, Number(m[1]))
  }
  m = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(s)
  if (m) return make(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s)
  if (m) {
    const [a, b, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
    return fmt === 'mdy' ? make(y, a - 1, b) : make(y, b - 1, a)
  }
  return null
  function make(y: number, mon: number, d: number) {
    const year = y < 100 ? 2000 + y : y
    const dt = new Date(year, mon, d, 12)
    return dt.getMonth() === mon && dt.getDate() === d && year > 1990 && year < 2100 ? dt : null
  }
}

const looksLikeDate = (s: string) => parseDate(s, 'dmy') !== null || parseDate(s, 'mdy') !== null

/** "$1,234.50", "+180.00", "(50.00)", "50.00 CR" → cents, or NaN. */
function parseAmount(raw: string | undefined): number {
  if (raw == null) return NaN
  let s = raw.trim().replace(/[$\s,]/g, '').replace(/^AUD/i, '')
  if (!s) return NaN
  let sign = 1
  if (/^\(.*\)$/.test(s)) {
    sign = -1
    s = s.slice(1, -1)
  }
  if (/DR$/i.test(s)) {
    sign = -1
    s = s.slice(0, -2)
  } else if (/CR$/i.test(s)) s = s.slice(0, -2)
  if (!/^[+-]?\d+(\.\d{1,2})?$/.test(s)) return NaN
  return sign * Math.round(Number(s) * 100)
}

/** Australian banks write day first. Only a value that cannot be day-first
 *  (13/01, 25/12 read as month 25) or an ISO date changes that. */
function guessDateFormat(values: string[]): DateFormat {
  if (values.some((v) => /^\d{4}[/.-]/.test(v.trim()))) return 'ymd'
  let dayFirst = false
  let monthFirst = false
  for (const v of values) {
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-]/.exec(v.trim())
    if (!m) continue
    if (Number(m[1]) > 12) dayFirst = true
    if (Number(m[2]) > 12) monthFirst = true
  }
  return monthFirst && !dayFirst ? 'mdy' : 'dmy'
}

type Detected = { layout: string; mapping: Mapping } | { needsMapping: true; hasHeader: boolean }

function detect(rows: string[][]): Detected {
  const first = rows[0] ?? []
  const low = first.map((c) => c.trim().toLowerCase())
  const hasHeader = low.some((c) => /date/.test(c)) && !first.some((c) => looksLikeDate(c))
  const body = rows.slice(hasHeader ? 1 : 0)
  const dateFmt = (col: number) => guessDateFormat(body.map((r) => r[col] ?? ''))

  if (hasHeader) {
    const find = (re: RegExp, not?: RegExp) => {
      const i = low.findIndex((c) => re.test(c) && !(not && not.test(c)))
      return i >= 0 ? i : undefined
    }
    const date = find(/^(transaction |posted |value |effective )?date/) ?? find(/date/)
    const credit = find(/credit|money in|deposit|paid in/)
    const debit = find(/debit|money out|withdrawal|paid out/)
    const amount = find(/^amount|amount$|^value$/, /credit|debit/)
    const description =
      find(/transaction details|narrative|description|details|particulars|memo|payee|transaction$/) ?? find(/type/)
    const reference = find(/^reference|^ref\b|payment reference|lodgement/)
    if (date === undefined || description === undefined || (amount === undefined && credit === undefined)) {
      return { needsMapping: true, hasHeader }
    }
    const layout = low.includes('narrative') && low.some((c) => c.startsWith('credit amount'))
      ? 'Westpac'
      : low.includes('transaction details') && low.includes('transaction type')
        ? 'NAB'
        : 'Spreadsheet with headings'
    return { layout, mapping: { date, amount: credit === undefined ? amount : undefined, credit, debit, description, reference, dateFormat: dateFmt(date), hasHeader } }
  }

  /* no heading row: CommBank (date, amount, description, balance) and ANZ
     (date, amount, description) — recognised by their shape, every row */
  const width = Math.max(...body.slice(0, 50).map((r) => r.length))
  const shaped = body.filter((r) => looksLikeDate(r[0] ?? '') && !Number.isNaN(parseAmount(r[1])) && (r[2] ?? '').trim().length > 0)
  if (body.length && shaped.length / body.length >= 0.9 && (width === 3 || width === 4)) {
    return {
      layout: width === 4 ? 'CommBank' : 'ANZ',
      mapping: { date: 0, amount: 1, description: 2, dateFormat: dateFmt(0), hasHeader: false },
    }
  }
  return { needsMapping: true, hasHeader }
}

type ParsedLine = LineIn & { hash: string }

function readLines(rows: string[][], mp: Mapping) {
  const body = rows.slice(mp.hasHeader ? 1 : 0)
  const lines: ParsedLine[] = []
  let debits = 0
  let unreadable = 0
  for (const row of body) {
    const date = parseDate(row[mp.date] ?? '', mp.dateFormat)
    let amount = NaN
    if (mp.credit !== undefined) {
      const c = parseAmount(row[mp.credit])
      const d = mp.debit !== undefined ? parseAmount(row[mp.debit]) : NaN
      amount = !Number.isNaN(c) && c !== 0 ? Math.abs(c) : !Number.isNaN(d) && d !== 0 ? -Math.abs(d) : NaN
    } else if (mp.amount !== undefined) amount = parseAmount(row[mp.amount])
    const description = (row[mp.description] ?? '').trim().replace(/\s+/g, ' ')
    if (!date || Number.isNaN(amount)) {
      /* opening-balance rows, totals and blank padding have no date or amount */
      if (row.some((c) => c.trim())) unreadable++
      continue
    }
    if (amount <= 0) {
      debits++
      continue
    }
    const reference = mp.reference !== undefined ? (row[mp.reference] ?? '').trim() || undefined : undefined
    const desc = description || reference || 'No description'
    lines.push({
      date,
      amount,
      description: desc.slice(0, 300),
      reference: reference?.slice(0, 80),
      hash: createHash('sha1').update(`${format(date, 'yyyy-MM-dd')}|${amount}|${normalise(desc)}`).digest('hex'),
    })
  }
  return { lines, debits, unreadable }
}

function decode(buf: Buffer) {
  let s = buf.toString('utf8')
  if (s.includes('\uFFFD')) s = buf.toString('latin1')
  return s.replace(/^\uFEFF/, '')
}

const zMapping = z.object({
  date: z.number().int().min(0),
  amount: z.number().int().min(0).optional(),
  credit: z.number().int().min(0).optional(),
  debit: z.number().int().min(0).optional(),
  description: z.number().int().min(0),
  reference: z.number().int().min(0).optional(),
  dateFormat: z.enum(['dmy', 'mdy', 'ymd']),
  hasHeader: z.boolean(),
}).refine((m) => m.amount !== undefined || m.credit !== undefined, { message: 'Choose the amount column, or the money-in column', path: ['amount'] })

/* ======================= presenting an import ======================= */

type Lean = Record<string, unknown> & { _id: Types.ObjectId }

const countsOf = (lines: { status: string }[]) => {
  const c: Partial<Record<BankLineStatus, number>> = {}
  for (const l of lines) c[l.status as BankLineStatus] = (c[l.status as BankLineStatus] ?? 0) + 1
  return c
}

async function present(imp: BankImportDoc): Promise<BankImportDTO> {
  const obj = imp.toObject() as unknown as Lean & { lines: (Lean & { description: string; match: Record<string, unknown>; gift?: Types.ObjectId })[] }
  const donorIds = new Set<string>()
  const pledgeIds = new Set<string>()
  const giftIds = new Set<string>()
  for (const l of obj.lines) {
    if (l.match?.donor) donorIds.add(String(l.match.donor))
    if (l.match?.pledge) pledgeIds.add(String(l.match.pledge))
    if (l.gift) giftIds.add(String(l.gift))
  }
  const [donors, gifts] = await Promise.all([
    Donor.find({ _id: { $in: [...donorIds] } }).select('number email').lean(),
    Gift.find({ _id: { $in: [...pledgeIds, ...giftIds] } }).select('number amount reference date receipt').lean(),
  ])
  const num = new Map(donors.map((d) => [String(d._id), d.number]))
  const noEmail = new Set(donors.filter((d) => d.email.endsWith('.invalid')).map((d) => String(d._id)))
  const gift = new Map(gifts.map((g) => [String(g._id), g]))
  const base = out<BankImportDTO>(obj)
  base.counts = countsOf(obj.lines as unknown as { status: string }[])
  base.lines = base.lines.map((l: BankLineDTO) => {
    const p = l.match.pledge ? gift.get(l.match.pledge) : undefined
    const g = l.gift ? gift.get(l.gift) : undefined
    return {
      ...l,
      payer: payerName(l.description),
      match: { ...l.match, donorNumber: l.match.donor ? num.get(l.match.donor) : undefined, noEmail: l.match.donor ? noEmail.has(l.match.donor) : undefined },
      pledgeInfo: p ? { number: p.number, amount: p.amount, reference: p.reference ?? undefined, date: p.date.toISOString() } : undefined,
      giftInfo: g ? { number: g.number, receiptNumber: g.receipt?.number ?? undefined, emailed: Boolean(g.receipt?.emailedAt) } : undefined,
    }
  })
  return base
}

async function loadImport(id: string) {
  if (!isId(id)) throw notFound('That import')
  const imp = await BankImport.findById(id)
  if (!imp) throw notFound('That import')
  return imp
}

function lineOf(imp: BankImportDoc, lineId: string) {
  const line = imp.lines.id(lineId)
  if (!line) throw notFound('That line')
  return line
}

const editable = (imp: BankImportDoc) => {
  if (imp.status === 'completed') throw new HttpError(409, 'This import is finished and can no longer be changed.')
}

/* ======================= routes ======================= */

r.get('/imports', async (req, res) => {
  const { page, pageSize, skip } = paging(req.query, { pageSize: 20, max: 100 })
  const [rows, total] = await Promise.all([
    BankImport.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .select('filename uploadedByName createdAt status completedAt credits layout debitsSkipped lines.status lines.amount')
      .lean(),
    BankImport.countDocuments(),
  ])
  res.json({
    items: rows.map((row) => {
      const { lines, ...rest } = row
      return {
        ...out<Omit<BankImportDTO, 'lines' | 'counts'>>(rest),
        lines: [],
        counts: countsOf(lines),
        lineCount: lines.length,
        savedTotal: lines.filter((l) => l.status === 'confirmed').reduce((s, l) => s + l.amount, 0),
      }
    }),
    total,
    page,
    pageSize,
  })
})

r.post('/imports', takeFile, async (req, res) => {
  const file = req.file
  if (!file) throw badRequest('Choose a CSV file to upload.', { file: 'Choose a CSV file' })
  if (!/\.(csv|txt)$/i.test(file.originalname) && !/csv|text\/plain|excel/.test(file.mimetype)) {
    throw badRequest('That does not look like a CSV file. In your online banking, export the statement as CSV (sometimes called "comma separated").', { file: 'Choose a .csv file' })
  }
  const text = decode(file.buffer)
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' })
  const rows = parsed.data.filter((r) => Array.isArray(r) && r.some((c) => String(c).trim())).map((r) => r.map((c) => String(c ?? '')))
  if (!rows.length) throw badRequest('That file is empty.', { file: 'The file has no rows' })

  let mapping: Mapping
  let layout: string
  if (req.body?.mapping) {
    let raw: unknown
    try {
      raw = JSON.parse(String(req.body.mapping))
    } catch {
      throw badRequest('The column choices could not be read.')
    }
    mapping = parse(zMapping, raw)
    layout = 'Columns chosen by hand'
  } else {
    const d = detect(rows)
    if ('needsMapping' in d) {
      const width = Math.max(...rows.slice(0, 20).map((r) => r.length))
      res.status(422).json({
        error: { message: 'We could not tell which column is which. Choose them below and we will remember nothing else about the file.' },
        needsMapping: true,
        hasHeader: d.hasHeader,
        headers: d.hasHeader ? rows[0]!.map((h, i) => h.trim() || `Column ${i + 1}`) : Array.from({ length: width }, (_, i) => `Column ${i + 1}`),
        sample: rows.slice(d.hasHeader ? 1 : 0, (d.hasHeader ? 1 : 0) + 5),
        dateFormat: guessDateFormat(rows.slice(1, 40).flatMap((r) => r.filter((c) => /^\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}$/.test(c.trim())))),
      })
      return
    }
    mapping = d.mapping
    layout = d.layout
  }

  const width = Math.max(...rows.map((r) => r.length))
  for (const k of ['date', 'amount', 'credit', 'debit', 'description', 'reference'] as const) {
    if (mapping[k] !== undefined && mapping[k]! >= width) throw badRequest('One of the chosen columns is not in the file.')
  }
  const { lines, debits, unreadable } = readLines(rows, mapping)
  if (!lines.length) {
    throw badRequest(
      debits
        ? `The file has ${debits} money-out ${debits === 1 ? 'line' : 'lines'} and no money coming in, so there is nothing to match.`
        : unreadable
          ? 'No line in the file had a date and an amount we could read. Check the file is the CSV export of the statement.'
          : 'There are no lines in the file.',
    )
  }

  /* already imported? */
  const earlier = await BankImport.find({ 'lines.hash': { $in: lines.map((l) => l.hash) } })
    .select('filename createdAt uploadedByName lines.hash')
    .lean()
  const seen = new Map<string, { filename: string; createdAt: Date; by?: string | null }>()
  for (const e of earlier) for (const l of e.lines) if (!seen.has(l.hash)) seen.set(l.hash, { filename: e.filename, createdAt: e.createdAt, by: e.uploadedByName })

  const fresh = lines.filter((l) => !seen.has(l.hash))
  const results = await matchLines(fresh)
  let i = 0
  const docLines = lines.map((l) => {
    const prev = seen.get(l.hash)
    if (prev) {
      return {
        ...l,
        status: 'duplicate' as const,
        match: { designation: 'general', confidence: 0, reasons: [`Already in ${prev.filename}, imported ${format(prev.createdAt, 'd MMM yyyy')}${prev.by ? ` by ${prev.by}` : ''}`] },
      }
    }
    const m = results[i++]!
    return { ...l, status: m.status, match: m.match }
  })
  const credits = lines.reduce((s, l) => s + l.amount, 0)

  const imp = await BankImport.create({
    filename: file.originalname.slice(0, 160),
    uploadedBy: req.staff!._id,
    uploadedByName: req.staff!.name,
    status: 'review',
    credits,
    layout,
    debitsSkipped: debits,
    lines: docLines,
  })
  const c = countsOf(docLines)
  await audit(
    req,
    'bank.import',
    `Imported bank statement ${imp.filename}: ${lines.length} credits totalling ${formatMoney(credits)} (${c.matched ?? 0} matched, ${c.review ?? 0} to check, ${c.unmatched ?? 0} unmatched${c.duplicate ? `, ${c.duplicate} already imported` : ''})`,
    { type: 'bankImport', id: imp._id, label: imp.filename },
  )
  res.status(201).json(await present(imp))
})

r.get('/imports/:id', async (req, res) => {
  res.json(await present(await loadImport(req.params.id)))
})

r.delete('/imports/:id', async (req, res) => {
  const imp = await loadImport(req.params.id)
  if (imp.lines.some((l) => l.status === 'confirmed')) {
    throw new HttpError(409, 'Some donations from this statement are already saved, so it cannot be discarded.')
  }
  await imp.deleteOne()
  await audit(req, 'bank.discard', `Discarded bank statement ${imp.filename} before saving any donations from it`, { type: 'bankImport', id: imp._id, label: imp.filename })
  res.status(204).end()
})

/* ---------- changing one line ---------- */

const zLinePatch = z.object({
  donorId: zId.nullable().optional(),
  appealId: zId.nullable().optional(),
  designation: z.enum(DESIGNATION_KEYS as [Designation, ...Designation[]]).optional(),
  status: z.enum(['ignored', 'matched', 'review', 'unmatched']).optional(),
})

type LineDoc = ReturnType<typeof lineOf>

async function applyPatch(req: Request, line: LineDoc, body: z.infer<typeof zLinePatch>) {
  if (line.status === 'confirmed') throw new HttpError(409, 'That line is already saved as a donation.')
  const who = req.staff!.name
  const m = line.match!

  if (body.donorId !== undefined) {
    if (body.donorId === null) {
      m.donor = undefined
      m.donorName = undefined
      m.pledge = undefined
      m.confidence = 0
      line.status = 'unmatched'
    } else {
      let donor = await Donor.findById(body.donorId)
      while (donor?.status === 'merged' && donor.mergedInto) donor = await Donor.findById(donor.mergedInto)
      if (!donor) throw notFound('That donor')
      /* a pledge belongs to its donor: choosing someone else detaches it */
      if (m.pledge) {
        const p = await Gift.findById(m.pledge).select('donor')
        if (!p || String(p.donor) !== String(donor._id)) m.pledge = undefined
      }
      m.donor = donor._id
      m.donorName = fullName(donor)
      m.candidates = undefined
      m.confidence = 1
      /* the matcher's doubts about who it was no longer apply; what the line
         said it was for still does */
      m.reasons = [`Chosen by ${who}`, ...m.reasons.filter((x) => !/^(Chosen by|Accepted by|New donor)|choose the right one|^No donor called|^No name on the line|could be \d+ donors|^Name is close to|^Name matches|^Paid from this account/.test(x))]
      line.status = 'matched'
    }
  }
  if (body.appealId !== undefined) {
    if (body.appealId === null) {
      m.appeal = undefined
      m.appealTitle = undefined
    } else {
      const a = await Appeal.findById(body.appealId).select('title')
      if (!a) throw notFound('That appeal')
      m.appeal = a._id
      m.appealTitle = a.title
    }
  }
  if (body.designation) m.designation = body.designation
  if (body.status) {
    if (body.status === 'matched') {
      if (!m.donor) throw badRequest('Choose a donor for this line first.', { donorId: 'Choose a donor' })
      if (line.status !== 'matched') {
        m.confidence = Math.max(m.confidence ?? 0, 1)
        m.reasons = [`Accepted by ${who}`, ...m.reasons.filter((x) => !x.startsWith('Accepted by'))]
      }
      line.status = 'matched'
    } else if (line.status === 'duplicate') {
      /* "not a duplicate after all": match it now, as the upload would have */
      const [res] = await matchLines([{ date: line.date, amount: line.amount, description: line.description, reference: line.reference ?? undefined }])
      line.set('match', { ...res!.match, reasons: [`Marked as not a duplicate by ${who}`, ...res!.match.reasons] })
      line.status = res!.status === 'matched' ? 'review' : res!.status
    } else if (body.status === 'review' || body.status === 'unmatched') {
      line.status = m.donor || m.candidates?.length ? 'review' : 'unmatched'
      m.reasons = m.reasons.filter((x) => !x.startsWith('Accepted by'))
    } else {
      line.status = 'ignored'
    }
  }
}

r.patch('/imports/:id/lines/:lineId', async (req, res) => {
  const imp = await loadImport(req.params.id)
  editable(imp)
  const body = parse(zLinePatch, req.body)
  const line = lineOf(imp, req.params.lineId)
  const before = line.status
  await applyPatch(req, line, body)
  await imp.save()
  const what = body.donorId ? `matched to ${line.match!.donorName}` : body.status === 'ignored' ? 'ignored' : body.status ? `moved to ${line.status}` : 'updated'
  await audit(
    req,
    'bank.line',
    `Bank line ${formatMoney(line.amount)} “${line.description.slice(0, 60)}” ${what}${before !== line.status && !body.status && !body.donorId ? ` (was ${before})` : ''}`,
    { type: 'bankImport', id: imp._id, label: imp.filename },
  )
  res.json(await present(imp))
})

r.post('/imports/:id/lines/bulk', async (req, res) => {
  const imp = await loadImport(req.params.id)
  editable(imp)
  const body = parse(z.object({ lineIds: z.array(zId).min(1).max(1000), status: z.enum(['ignored', 'matched', 'review']) }), req.body)
  let changed = 0
  let skipped = 0
  for (const id of body.lineIds) {
    const line = imp.lines.id(id)
    if (!line || line.status === 'confirmed') continue
    if (body.status === 'matched' && !line.match?.donor) {
      skipped++
      continue
    }
    await applyPatch(req, line, { status: body.status })
    changed++
  }
  await imp.save()
  await audit(req, 'bank.line', `${body.status === 'ignored' ? 'Ignored' : body.status === 'matched' ? 'Accepted' : 'Moved back to review'} ${changed} lines in ${imp.filename}`, { type: 'bankImport', id: imp._id, label: imp.filename })
  res.json({ changed, skipped, import: await present(imp) })
})

r.post('/imports/:id/lines/:lineId/new-donor', async (req, res) => {
  const imp = await loadImport(req.params.id)
  editable(imp)
  const line = lineOf(imp, req.params.lineId)
  const body = parse(
    z.object({
      firstName: z.string().trim().min(1, 'Enter a first name').max(80),
      lastName: z.string().trim().max(80).default(''),
      email: z.union([z.literal(''), z.string().trim().toLowerCase().email('That email address does not look right')]).optional(),
    }),
    req.body,
  )
  let donor: DonorDoc | null = null
  let existed = false
  if (body.email) {
    donor = await Donor.findOne({ $or: [{ email: body.email }, { altEmails: body.email }] })
    while (donor?.status === 'merged' && donor.mergedInto) donor = await Donor.findById(donor.mergedInto)
    existed = Boolean(donor)
  }
  if (!donor) {
    const email = body.email || `noemail+${await nextSeq('noemail-donor')}@donors.alanwaar.invalid`
    donor = await Donor.create({
      number: await nextDonorNumber(),
      firstName: body.firstName,
      lastName: body.lastName,
      email,
      source: 'bank',
      preferences: { emailOptIn: Boolean(body.email), topics: ['appeals', 'reports'], anonymous: false },
      notes: `Added from a bank statement line: “${line.description}”`,
    })
    await audit(req, 'donor.create', `Added donor ${fullName(donor)} (${donor.number}) from a bank statement line`, { type: 'donor', id: donor._id, label: donor.number })
  }
  await applyPatch(req, line, { donorId: String(donor._id) })
  if (!existed) line.match!.reasons = [`New donor ${donor.number} created by ${req.staff!.name}`, ...line.match!.reasons.filter((x) => !x.startsWith('Chosen by'))]
  await imp.save()
  res.status(201).json({ donor: { id: String(donor._id), number: donor.number, name: fullName(donor), existed }, import: await present(imp) })
})

/* ---------- confirm: the only step that saves gifts ---------- */

/* one confirm per import at a time, so a double press cannot save a line twice */
const confirming = new Set<string>()

r.post('/imports/:id/confirm', async (req, res) => {
  const imp = await loadImport(req.params.id)
  editable(imp)
  const body = parse(z.object({ lineIds: z.array(zId).max(2000).optional() }), req.body ?? {})
  const key = String(imp._id)
  if (confirming.has(key)) throw new HttpError(409, 'These donations are already being saved. Give it a moment.')
  confirming.add(key)
  try {
    const want = body.lineIds ? new Set(body.lineIds) : null
    const lines = imp.lines.filter((l) => l.status === 'matched' && l.match?.donor && (!want || want.has(String(l._id))))
    let saved = 0
    let total = 0
    let emailed = 0
    const gifts: { lineId: string; giftId: string; number: string; donorId: string; donorName: string; amount: number; receiptNumber?: string; emailed: boolean }[] = []

    for (const line of lines) {
      const m = line.match!
      let donor = await Donor.findById(m.donor)
      while (donor?.status === 'merged' && donor.mergedInto) donor = await Donor.findById(donor.mergedInto)
      if (!donor) {
        line.status = 'review'
        m.reasons = ['That donor record no longer exists; choose again', ...m.reasons]
        continue
      }
      const canEmail = !donor.email.endsWith('.invalid')
      const pledge = m.pledge ? await Gift.findById(m.pledge) : null
      let giftDoc
      if (pledge && pledge.status === 'pending' && String(pledge.donor) === String(donor._id)) {
        /* the pledge made on the website becomes the gift: one record, its
           reference kept, now paid */
        const oldAppeal = pledge.appeal
        const pledged = pledge.amount
        pledge.status = 'succeeded'
        pledge.date = line.date
        pledge.set('bankImport', imp._id)
        pledge.designation = (m.designation as Designation) ?? pledge.designation
        if (line.amount !== pledged) {
          pledge.amount = line.amount
          pledge.notes = [pledge.notes, `Pledged ${formatMoney(pledged)}; ${formatMoney(line.amount)} arrived by bank transfer.`].filter(Boolean).join('\n')
        }
        if (String(m.appeal ?? '') !== String(pledge.appeal ?? '')) {
          const a = m.appeal ? await Appeal.findById(m.appeal).select('title country') : null
          pledge.set('appeal', a?._id ?? undefined)
          pledge.set('appealTitle', a?.title ?? undefined)
          pledge.set('country', a?.country ?? undefined)
        }
        await pledge.save()
        await issueReceipt(pledge, { email: canEmail })
        await refreshForGift(pledge)
        if (oldAppeal && String(oldAppeal) !== String(pledge.appeal ?? '')) await refreshForGift({ appeal: oldAppeal })
        await audit(
          req,
          'gift.bank',
          `Received ${formatMoney(pledge.amount)} bank transfer from ${pledge.donorName} for pledge ${pledge.number}${pledge.reference ? ` (${pledge.reference})` : ''}${pledge.appealTitle ? ` to ${pledge.appealTitle}` : ''}`,
          { type: 'gift', id: pledge._id, label: pledge.number },
        )
        giftDoc = pledge
      } else {
        giftDoc = await recordGift(
          {
            donor,
            amount: line.amount,
            designation: (m.designation as Designation) ?? 'general',
            method: 'bank',
            source: 'bank',
            date: line.date,
            reference: line.reference || findReference(line.description),
            appealId: m.appeal ?? null,
            bankImport: imp._id,
            notes: `Bank statement: ${line.description}`,
            sendReceipt: canEmail,
          },
          req,
        )
      }

      /* learn how this donor's bank writes their name, for next time */
      /* two words at least: a lone "PERSON" or "SMITH" would claim strangers */
      const alias = payerName(line.description)
      if (alias.split(' ').length >= 2 && alias.replace(/ /g, '').length >= 4) await Donor.updateOne({ _id: donor._id }, { $addToSet: { bankAliases: alias } })

      line.status = 'confirmed'
      line.gift = giftDoc._id
      saved++
      total += line.amount
      const wasEmailed = Boolean(giftDoc.receipt?.emailedAt) && canEmail
      if (wasEmailed) emailed++
      gifts.push({
        lineId: String(line._id),
        giftId: String(giftDoc._id),
        number: giftDoc.number,
        donorId: String(donor._id),
        donorName: fullName(donor),
        amount: line.amount,
        receiptNumber: giftDoc.receipt?.number ?? undefined,
        emailed: wasEmailed,
      })
      /* save as we go: if the process stops halfway, what was saved is marked saved */
      await imp.save()
    }

    const open = imp.lines.some((l) => ['matched', 'review', 'unmatched'].includes(l.status))
    if (!open) {
      imp.status = 'completed'
      imp.completedAt = new Date()
    }
    await imp.save()
    if (saved) {
      await audit(
        req,
        'bank.confirm',
        `Saved ${saved} ${saved === 1 ? 'donation' : 'donations'} totalling ${formatMoney(total)} from bank statement ${imp.filename}; ${emailed} ${emailed === 1 ? 'receipt' : 'receipts'} emailed`,
        { type: 'bankImport', id: imp._id, label: imp.filename },
      )
    }
    res.json({ saved, total, emailed, completed: imp.status === 'completed', gifts, import: await present(imp) })
  } finally {
    confirming.delete(key)
  }
})

/* ======================= the sample statement =======================
   A CommBank-format file (no heading row, day-first dates, newest first,
   signed amounts and a running balance) made from what is in the database
   right now, so the demo shows every state the review screen has:
   pledges paid by reference (one short, one with the reference mistyped),
   donors found by name and by "surname + initial", names two donors share,
   strangers, bank interest and a supplier refund to ignore, and — once a
   statement has been imported — a line from it again, to show duplicates
   being caught. Seeded by the date, so the same day gives the same file. */

r.get('/sample', async (_req, res) => {
  let seed = Number(format(new Date(), 'yyyyMMdd'))
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const daysAgo = (n: number) => new Date(today.getTime() - n * 86_400_000)
  const U = (s: string) => normalise(s)

  const [pledges, donors, last] = await Promise.all([
    Gift.find({ status: 'pending', method: 'bank', reference: { $exists: true } }).sort({ date: -1 }).limit(12).lean(),
    Donor.find({ status: 'active' }).select('firstName lastName number giftCount').sort({ number: 1 }).lean(),
    BankImport.findOne().sort({ createdAt: -1 }).select('lines.date lines.amount lines.description').lean(),
  ])
  const keyOf = (d: { firstName: string; lastName?: string | null }) => U(`${d.firstName} ${d.lastName ?? ''}`).split(' ').sort().join(' ')
  const nameCount = new Map<string, number>()
  const initialCount = new Map<string, number>()
  for (const d of donors) {
    nameCount.set(keyOf(d), (nameCount.get(keyOf(d)) ?? 0) + 1)
    const ik = `${U(d.firstName)[0]} ${U(d.lastName ?? '')}`
    initialCount.set(ik, (initialCount.get(ik) ?? 0) + 1)
  }
  const pledgeDonors = new Set(pledges.map((p) => String(p.donor)))
  const byId = new Map(donors.map((d) => [String(d._id), d]))

  type Row = { date: Date; amount: number; text: string }
  const rows: Row[] = []
  const kw = ['GAZA', 'ZAKAT', 'SADAQAH', 'WATER', 'YEMEN FOOD', 'MASJID', 'SCHOOL', '', '', '']

  /* pledges: most paid, by their reference */
  const paying = pledges.length > 3 ? pledges.slice(0, pledges.length - 1) : pledges
  const typoAt = paying.findIndex((p, i) => i >= 2 && byId.get(String(p.donor)) && nameCount.get(keyOf(byId.get(String(p.donor))!)) === 1)
  paying.forEach((p, i) => {
    const d = byId.get(String(p.donor))
    const first = U(d?.firstName ?? p.donorName.split(' ')[0] ?? '')
    const lastN = U(d?.lastName ?? p.donorName.split(' ').slice(1).join(' '))
    const ref = p.reference!.toUpperCase()
    const paid = new Date(Math.min(today.getTime(), new Date(p.date).getTime() + (1 + Math.floor(rand() * 3)) * 86_400_000))
    let amount = p.amount
    let text: string
    if (i === 1) {
      /* paid a different amount from the pledge */
      amount = p.amount >= 10000 ? p.amount - 5000 : p.amount + 2000
      text = `TRANSFER FROM ${first[0]} ${lastN} ${ref}`
    } else if (i === typoAt) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      const pos = 3 + Math.floor(rand() * 6)
      let bad = ref
      while (bad === ref) bad = ref.slice(0, pos) + pick(chars.split('')) + ref.slice(pos + 1)
      text = `OSKO PAYMENT ${first} ${lastN} ${bad}`
    } else {
      text = pick([
        `TRANSFER FROM ${first[0]} ${lastN} ${ref} ${pick(kw)}`,
        `OSKO PAYMENT ${first} ${lastN} ${ref}`,
        `DIRECT CREDIT ${100000 + Math.floor(rand() * 899999)} ${lastN} ${first} ${ref}`,
        `FAST TRANSFER FROM ${first} ${lastN} ${ref.replace('-', ' ')}`,
        `${ref} ${first} ${lastN}`,
      ])
    }
    rows.push({ date: paid, amount, text: text.replace(/\s+/g, ' ').trim() })
  })

  /* donors found by name; two by surname and first initial */
  const named = donors.filter(
    (d) => (d.giftCount ?? 0) > 0 && !pledgeDonors.has(String(d._id)) && nameCount.get(keyOf(d)) === 1 && U(d.lastName ?? '').length > 2,
  )
  const initialOk = (d: (typeof donors)[number]) => initialCount.get(`${U(d.firstName)[0]} ${U(d.lastName ?? '')}`) === 1
  const step = Math.max(1, Math.floor(named.length / 7))
  const byName = Array.from({ length: 6 }, (_, i) => named[(i * step + 3) % named.length]!)
  const byInitial = named.filter((d) => initialOk(d) && !byName.includes(d)).filter((_, i) => i % 11 === 5).slice(0, 2)
  const amounts = [5000, 10000, 25000, 2000, 18000, 7500, 50000, 3000]
  byName.forEach((d, i) => {
    const first = U(d.firstName)
    const lastN = U(d.lastName ?? '')
    const text = pick([
      `OSKO PAYMENT ${first} ${lastN} ${pick(['ZAKAT', 'SADAQAH', 'GAZA', ''])}`,
      `TRANSFER FROM NETBANK ${first} ${lastN} ${pick(['GAZA', 'YEMEN WATER', 'SCHOOL', 'LILLAH'])}`,
      `DIRECT CREDIT ${100000 + Math.floor(rand() * 899999)} ${first} ${lastN} ${pick(['DONATION', 'ZAKAT', ''])}`,
      `${first} ${lastN} ${pick(['FOOD', 'GAZA', 'MASJID', 'ZAKAT FITR'])}`,
    ])
    rows.push({ date: daysAgo(Math.floor(rand() * 8)), amount: amounts[i]!, text: text.replace(/\s+/g, ' ').trim() })
  })
  byInitial.forEach((d, i) => {
    const first = U(d.firstName)
    const lastN = U(d.lastName ?? '')
    const text = i === 0 ? `DIRECT CREDIT ${300000 + Math.floor(rand() * 99999)} ${lastN} ${first[0]}` : `TRANSFER FROM ${first[0]} ${lastN} ${pick(['MASJID', 'WATER', 'SADAQAH'])}`
    rows.push({ date: daysAgo(Math.floor(rand() * 8)), amount: amounts[6 + i]!, text })
  })

  /* two names that belong to two donors each */
  const shared = [...nameCount.entries()].filter(([, n]) => n > 1).map(([k]) => k)
  for (const k of shared.slice(0, 2)) {
    const d = donors.find((x) => keyOf(x) === k)!
    rows.push({ date: daysAgo(Math.floor(rand() * 8)), amount: pick([4000, 10000, 15000]), text: `OSKO PAYMENT ${U(d.firstName)} ${U(d.lastName ?? '')} ${pick(['SADAQAH', 'GAZA', ''])}`.trim() })
  }

  /* strangers: checked against the matcher so they really are unknown */
  const strangers = ['ZAINAB AL KATIB', 'T NGUYEN', 'BILQIS OYELARAN', 'SOPHIE MARCHETTI', 'MUSTAFA DEMIRCI', 'RAJ PRAKASH']
  const trial = await matchLines(strangers.map((s) => ({ date: today, amount: 100, description: `TRANSFER FROM ${s}` })))
  strangers
    .filter((_, i) => trial[i]!.status === 'unmatched')
    .slice(0, 3)
    .forEach((s, i) => rows.push({ date: daysAgo(1 + i * 2), amount: [6000, 25000, 1500][i]!, text: [`TRANSFER FROM ${s} WATER`, `DIRECT CREDIT 482913 ${s}`, `OSKO PAYMENT ${s} GAZA`][i]! }))

  /* not gifts */
  rows.push({ date: daysAgo(0), amount: 312, text: 'CREDIT INTEREST' })
  rows.push({ date: daysAgo(4), amount: 4695, text: 'REFUND OFFICEWORKS 0412 SILVERWATER' })
  /* money out, which the import leaves out */
  rows.push({ date: daysAgo(2), amount: -1500000, text: 'TRANSFER TO GAZA COMMUNITY KITCHENS PARTNER GRANT' })
  rows.push({ date: daysAgo(5), amount: -31240, text: 'BPAY ENERGYAUSTRALIA 7788123' })
  rows.push({ date: daysAgo(6), amount: -2850, text: 'MERCHANT FEE' })

  /* a line from the last statement imported, to show duplicates being caught */
  const again = last?.lines.find((l) => l.amount > 0)
  if (again) rows.push({ date: new Date(again.date), amount: again.amount, text: again.description })

  rows.sort((a, b) => b.date.getTime() - a.date.getTime())
  let balance = 4821355 + rows.reduce((s, x) => s + x.amount, 0)
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`
  const money = (c: number) => `${c < 0 ? '-' : '+'}${(Math.abs(c) / 100).toFixed(2)}`
  const lines = rows.map((x) => {
    const line = [format(x.date, 'dd/MM/yyyy'), q(money(x.amount)), q(x.text), q(money(balance))].join(',')
    balance -= x.amount
    return line
  })
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="commbank-statement-sample.csv"')
  res.setHeader('Cache-Control', 'no-store')
  res.send(lines.join('\r\n') + '\r\n')
})

export default r
