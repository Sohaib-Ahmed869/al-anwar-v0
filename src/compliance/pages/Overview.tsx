import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight, BookOpenCheck, CalendarCheck2, CalendarClock, CheckCircle2, ClipboardCheck, FileText, History, Info, ShieldCheck,
} from 'lucide-react'
import { OBLIGATION_CATEGORIES, type ObligationCategory } from '../../../shared/domain'
import { riskBand } from '../../../shared/registers'
import { api } from '../../portal/api'
import { useStaff } from '../../portal/session'
import { Badge, Card, CardHeader, cn, EmptyState, PageHeader, Popover, Skeleton, useDocumentTitle } from '../../portal/ui'
import { formatDate, formatDay, formatRelative, plural } from '../../portal/format'
import { ActivityItem } from '../components/Activity'
import { BAND_META, DaysPill, Disclaimer, STANDARD_META, StandardChip } from '../components/bits'
import type { OverviewData } from '../components/types'

/* ---------------------------------------------------------------------------
   /compliance — the front page. Its job is to answer "are we in order?" in
   one glance, and to make the answer calm when it is yes.

   Reading order: the health line (what is overdue, what is coming), the
   deadlines, the risk picture, then the ACNC standards map — each standard
   with the evidence the platform holds for it — and finally what is waiting
   for me personally (documents to read) and what has changed lately.

   The score is the server's (routes/compliance/overview.ts documents the
   formula); "How is this worked out?" shows its workings, because a number
   nobody can explain is not one a board should trust.
--------------------------------------------------------------------------- */

export const CATEGORY_DOT: Record<ObligationCategory, string> = {
  acnc: 'bg-teal',
  ato: 'bg-violet',
  fundraising: 'bg-[#c98a0b]',
  governance: 'bg-green',
  insurance: 'bg-[#7a8a99]',
  other: 'bg-text-3',
}

export default function Overview() {
  useDocumentTitle('Overview', 'Compliance')
  const { user } = useStaff()
  const q = useQuery({ queryKey: ['compliance', 'overview'], queryFn: () => api.get<OverviewData>('/compliance/overview') })
  const d = q.data
  const first = user?.name.split(' ')[0]

  return (
    <>
      <PageHeader
        banner
        title={first ? `Salaam, ${first}` : 'Compliance'}
        description="The registers, statutory calendar and evidence the ACNC asks a charity to keep — in one place, kept current."
      />

      {!d ? <HeroSkeleton /> : <Hero d={d} />}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            icon={<CalendarClock />}
            title="Upcoming deadlines"
            description="The next items on the statutory calendar."
            action={
              <Link to="/compliance/calendar" className="text-[13px] font-medium text-green hover:underline">
                Calendar
              </Link>
            }
          />
          {!d ? (
            <div className="space-y-3 px-6 pb-6">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : d.upcoming.length ? (
            <ul className="divide-y divide-line-2 border-t border-line-2">
              {d.upcoming.map((o) => (
                <li key={o.id}>
                  <Link to={`/compliance/calendar?item=${o.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-paper-2/70 sm:px-6">
                    <span className={cn('size-2.5 shrink-0 rounded-full', CATEGORY_DOT[o.category])} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-text">{o.title}</span>
                      <span className="block truncate text-[12.5px] text-text-3">
                        {OBLIGATION_CATEGORIES[o.category].label} · {formatDate(o.dueDate)}
                        {o.ownerName ? ` · ${o.ownerName}` : ''}
                      </span>
                    </span>
                    <DaysPill days={o.daysLeft} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={<CalendarCheck2 />} title="Nothing waiting">
              Every item on the calendar is done. Add next year's dates when they are known.
            </EmptyState>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            icon={<ShieldCheck />}
            title="Risk picture"
            description={d ? `${plural(d.openRisks, 'open risk')}, by likelihood and impact.` : 'Open risks, by likelihood and impact.'}
          />
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">{!d ? <Skeleton className="aspect-square w-full" /> : <HeatMap matrix={d.riskMatrix} />}</div>
        </Card>
      </div>

      <section className="mt-8" aria-labelledby="standards">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="standards" className="text-[18px] font-semibold tracking-[-0.01em] text-text">
              ACNC standards
            </h2>
            <p className="mt-0.5 text-[13.5px] text-text-2">Where the evidence for each Governance and External Conduct Standard sits on the platform.</p>
          </div>
          {d && (
            <div className="flex flex-wrap gap-1.5">
              {(['evidenced', 'attention', 'gap'] as const).map((s) => {
                const n = d.standards.filter((x) => x.status === s).length
                return n ? (
                  <Badge key={s} tone={STANDARD_META[s].tone} size="sm">
                    <span className="nums">{n}</span> {STANDARD_META[s].label.toLowerCase()}
                  </Badge>
                ) : null
              })}
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {!d
            ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)
            : d.standards.map((s) => (
                <Card key={s.code} className="flex flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-md bg-teal-pale px-2 py-0.5 text-[12px] font-semibold tracking-wide text-teal">{s.code}</span>
                    <StandardChip status={s.status} size="sm" />
                  </div>
                  <h3 className="mt-3 text-[15px] leading-snug font-semibold text-text">{s.title}</h3>
                  <p className="mt-1 text-[13px] leading-snug text-text-2">{s.ask}</p>
                  <p className={cn('mt-3 text-[12.5px] leading-snug', s.status === 'evidenced' ? 'text-text-3' : s.status === 'gap' ? 'text-red' : 'text-amber')}>{s.reason}</p>
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                    {s.links.map((l) => (
                      <Link
                        key={l.to}
                        to={l.to}
                        title={l.reason}
                        className="inline-flex h-7 items-center gap-1.5 rounded-full bg-paper-2 px-2.5 text-[12px] font-medium text-text-2 ring-1 ring-line-2 transition-colors ring-inset hover:bg-paper hover:text-text hover:ring-line"
                      >
                        <span className={cn('size-1.5 rounded-full', l.status === 'evidenced' ? 'bg-teal' : l.status === 'gap' ? 'bg-red' : 'bg-[#c98a0b]')} aria-hidden />
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </Card>
              ))}
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader icon={<BookOpenCheck />} title="Documents to read" description="Policies you are asked to confirm you have read." />
          {!d ? (
            <div className="px-6 pb-6">
              <Skeleton className="h-14 w-full" />
            </div>
          ) : d.toRead.length ? (
            <ul className="divide-y divide-line-2 border-t border-line-2">
              {d.toRead.map((x) => (
                <li key={x.id}>
                  <Link to={`/compliance/documents/${x.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-paper-2/70 sm:px-6">
                    <FileText className="size-4 shrink-0 text-teal" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-text">{x.title}</span>
                      <span className="block text-[12.5px] text-text-3">Version {x.version} · updated {formatDay(x.updatedAt)}</span>
                    </span>
                    <ArrowRight className="size-4 text-text-3" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={<CheckCircle2 />} title="You are up to date">
              You have read the latest version of every document that asks for it.
            </EmptyState>
          )}
        </Card>

        <Card>
          <CardHeader icon={<ClipboardCheck />} title="Register reviews due" description="Entries whose review date has passed." />
          {!d ? (
            <div className="px-6 pb-6">
              <Skeleton className="h-14 w-full" />
            </div>
          ) : d.reviewsDue.length ? (
            <>
              <ul className="divide-y divide-line-2 border-t border-line-2">
                {d.reviewsDue.slice(0, 5).map((x) => (
                  <li key={x.id}>
                    <Link to={`/compliance/registers/${x.register}?id=${x.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-paper-2/70 sm:px-6">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-text">{x.title}</span>
                        <span className="block text-[12.5px] text-text-3">
                          {x.registerLabel} · due {formatDate(new Date(`${x.date}T00:00:00`))}
                        </span>
                      </span>
                      <ArrowRight className="size-4 text-text-3" />
                    </Link>
                  </li>
                ))}
              </ul>
              {d.health.reviewsDue > 5 && (
                <p className="border-t border-line-2 px-6 py-3 text-[12.5px] text-text-3">
                  And {d.health.reviewsDue - 5} more across the registers — each register lists them at the top.
                </p>
              )}
            </>
          ) : (
            <EmptyState compact icon={<CheckCircle2 />} title="Every register is current">
              No entry is past its review date.
            </EmptyState>
          )}
        </Card>

        <Card>
          <CardHeader
            icon={<History />}
            title="Recent activity"
            description="Changes to the registers, calendar and documents."
            action={
              <Link to="/compliance/audit" className="text-[13px] font-medium text-green hover:underline">
                Audit trail
              </Link>
            }
          />
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            {!d ? (
              <Skeleton className="h-40 w-full" />
            ) : d.recent.length ? (
              <ol className="space-y-4">
                {d.recent.slice(0, 6).map((e) => (
                  <ActivityItem key={e.id} e={e} compact />
                ))}
              </ol>
            ) : (
              <p className="text-[13.5px] text-text-2">Nothing has changed yet.</p>
            )}
          </div>
        </Card>
      </div>

      <Disclaimer />
    </>
  )
}

/* ---------- the health hero ---------- */
function headline(d: OverviewData) {
  const { overdue, dueSoon } = d.health
  if (!overdue && !dueSoon) return 'Everything is in order'
  const parts = []
  if (overdue) parts.push(`${overdue} ${overdue === 1 ? 'thing' : 'things'} overdue`)
  if (dueSoon) parts.push(`${dueSoon} due in the next 30 days`)
  return parts.join(', ')
}

function Hero({ d }: { d: OverviewData }) {
  const nav = useNavigate()
  const h = d.health
  const tiles = [
    { label: 'Overdue', value: h.overdue, tone: h.overdue ? 'text-red' : 'text-text', to: '/compliance/calendar?view=agenda&status=overdue' },
    { label: 'Due in 30 days', value: h.dueSoon, tone: h.dueSoon ? 'text-amber' : 'text-text', to: '/compliance/calendar?view=agenda' },
    { label: 'Reviews due', value: h.reviewsDue, tone: h.reviewsDue ? 'text-amber' : 'text-text', to: d.reviewsDue[0] ? `/compliance/registers/${d.reviewsDue[0].register}?reviewDue=1` : '/compliance/registers' },
    { label: 'For you to read', value: h.docsToRead, tone: h.docsToRead ? 'text-teal' : 'text-text', to: '/compliance/documents' },
  ]
  return (
    <Card className="overflow-hidden">
      <div className="grid lg:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-7 sm:p-7">
          <ScoreRing score={h.score} />
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-[0.06em] text-teal uppercase">Compliance health</p>
            <h2 className="mt-1 text-[22px] leading-tight font-semibold tracking-[-0.015em] text-text sm:text-[24px]">{headline(d)}</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-2">
              {h.reviewsDue ? `${plural(h.reviewsDue, 'register entry', 'register entries')} past the review date` : 'Every register entry is within its review date'}
              {h.docsToRead ? `, and ${plural(h.docsToRead, 'document')} waiting for you to read.` : '.'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-text-3">
              <span>Updated {formatRelative(h.generatedAt)}</span>
              {h.lastActivityAt && (
                <>
                  <span aria-hidden>·</span>
                  <span>Last change {formatRelative(h.lastActivityAt)}</span>
                </>
              )}
              <span aria-hidden>·</span>
              <Popover
                align="start"
                className="w-80"
                trigger={
                  <button type="button" className="inline-flex items-center gap-1 font-medium text-green hover:underline">
                    <Info className="size-3.5" />
                    How is this worked out?
                  </button>
                }
              >
                <p className="text-[13px] font-semibold text-text">The score starts at 100</p>
                <ul className="mt-2 space-y-1.5 text-[13px]">
                  {h.scoreParts.map((p) => (
                    <li key={p.label} className="flex items-baseline justify-between gap-3">
                      <span className="text-text-2">{p.label}</span>
                      <span className={cn('nums shrink-0 font-medium', p.points ? 'text-red' : 'text-text-3')}>{p.points || '0'}</span>
                    </li>
                  ))}
                  <li className="flex items-baseline justify-between gap-3 border-t border-line-2 pt-1.5 font-semibold">
                    <span>Score</span>
                    <span className="nums">{h.score}</span>
                  </li>
                </ul>
                <p className="mt-3 text-[12px] leading-snug text-text-3">
                  A prompt to look, not a rating. Overdue items weigh most; each part has a ceiling so one problem cannot hide the rest.
                </p>
              </Popover>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-line-2 lg:w-[360px] lg:border-t-0 lg:border-l">
          {tiles.map((t, i) => (
            <button
              key={t.label}
              type="button"
              onClick={() => nav(t.to)}
              className={cn(
                'flex flex-col items-start justify-center gap-1 px-5 py-4 text-left transition-colors hover:bg-paper-2/70 sm:px-6',
                i % 2 === 0 && 'border-r border-line-2',
                i < 2 && 'border-b border-line-2',
              )}
            >
              <span className={cn('nums text-[26px] leading-none font-semibold tracking-[-0.02em]', t.tone)}>{t.value}</span>
              <span className="text-[12.5px] text-text-2">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}

function HeroSkeleton() {
  return (
    <Card className="flex items-center gap-6 p-7">
      <Skeleton className="size-28 rounded-full" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </Card>
  )
}

function ScoreRing({ score }: { score: number }) {
  const r = 50
  const c = 2 * Math.PI * r
  const color = score >= 80 ? '#006770' : score >= 50 ? '#c98a0b' : '#a63a1c'
  const word = score >= 80 ? 'In good order' : score >= 50 ? 'A few things to do' : 'Needs attention'
  return (
    <div className="relative size-[112px] shrink-0" role="img" aria-label={`Health score ${score} out of 100: ${word}`}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(8,38,42,.07)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className="transition-[stroke-dashoffset] duration-1000 ease-[var(--ease-reveal)]"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="nums text-[30px] leading-none font-semibold tracking-[-0.03em] text-text">{score}</div>
          <div className="mt-1 text-[10.5px] font-medium text-text-3">of 100</div>
        </div>
      </div>
    </div>
  )
}

/* ---------- the 5×5 heat map ---------- */
function HeatMap({ matrix }: { matrix: number[][] }) {
  const nav = useNavigate()
  const rows = [5, 4, 3, 2, 1]
  return (
    <div className="mx-auto max-w-[380px]">
      <div className="flex gap-2">
        <div className="flex w-5 items-center justify-center">
          <span className="-rotate-90 text-[11.5px] font-medium whitespace-nowrap text-text-3">Likelihood →</span>
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-[16px_repeat(5,1fr)] gap-1.5">
            {rows.map((l) => (
              <Row key={l} l={l} matrix={matrix} onPick={(i) => nav(`/compliance/registers/risks?likelihood=${l}&impact=${i}`)} />
            ))}
            <span />
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="nums text-center text-[11.5px] text-text-3">
                {i}
              </span>
            ))}
          </div>
          <p className="mt-1 text-center text-[11.5px] font-medium text-text-3">Impact →</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
        {(['low', 'medium', 'high', 'extreme'] as const).map((b) => (
          <span key={b} className="flex items-center gap-1.5 text-[12px] text-text-2">
            <span className={cn('size-2.5 rounded-[3px]', BAND_META[b].dot)} />
            {BAND_META[b].label}
          </span>
        ))}
      </div>
    </div>
  )
}

function Row({ l, matrix, onPick }: { l: number; matrix: number[][]; onPick: (impact: number) => void }) {
  return (
    <>
      <span className="nums grid place-items-center text-[11.5px] text-text-3">{l}</span>
      {[1, 2, 3, 4, 5].map((i) => {
        const n = matrix[l - 1]?.[i - 1] ?? 0
        const band = riskBand(l * i)!
        return (
          <button
            key={i}
            type="button"
            disabled={!n}
            onClick={() => onPick(i)}
            aria-label={`${n} risk${n === 1 ? '' : 's'} with likelihood ${l} and impact ${i} (${BAND_META[band].label})`}
            className={cn(
              'nums grid aspect-square place-items-center rounded-lg text-[14px] font-semibold transition-transform',
              BAND_META[band].cell,
              n ? 'shadow-[inset_0_0_0_1.5px_rgba(8,38,42,.12)] hover:scale-[1.06]' : 'opacity-35',
            )}
          >
            {n || ''}
          </button>
        )
      })}
    </>
  )
}
