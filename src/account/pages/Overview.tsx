import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, ChevronRight, FileText, Globe2, HandHeart, HeartHandshake, Megaphone, Package, Repeat, TriangleAlert } from 'lucide-react'
import { FUNDRAISER_STATUSES, fyLabel } from '../../../shared/domain'
import { formatDay, formatMoney, plural } from '../../portal/format'
import { ButtonLink, Callout, Card, EmptyState, Money, Progress, Skeleton, StatusBadge, buttonClass, cn } from '../../portal/ui'
import { CardChip, InstalmentProgress, SectionHeading, countryName, nextPaymentText, perPeriod } from '../components/bits'
import { giveAgainHref, useOverview, useTitle, type MyGift, type Overview as OverviewData } from '../components/data'
import { GiftSheet } from '../components/GiftSheet'

/* ---------------------------------------------------------------------------
   The donor's home. Read top to bottom on a phone, it answers in order:
     1. Is anything wrong?     a failing card, in red, with the fix one tap away
     2. How much this year?    the financial-year total, and the tax statement
     3. What did it do?        impact in things, not dollars
     4. What happens next?     regular gifts and their next payment
     5. What did I give?       the last five gifts
   On a wide screen 4 and the fundraiser move to a right-hand column.

   The tax statement is the most-asked-for thing in June and July, so in
   those months it becomes the hero's main action; the rest of the year it
   is a quiet link. Gold appears only on "Give again".
--------------------------------------------------------------------------- */

export default function Overview() {
  const { data, isLoading } = useOverview()
  const [gift, setGift] = useState<MyGift | null>(null)
  useTitle('Your account')

  if (isLoading || !data) return <OverviewSkeleton />
  const d = data
  const first = d.donor.firstName

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[13.5px] font-medium text-text-3">{greetingTime()}</p>
        <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-[-0.02em] text-text sm:text-[32px]">Assalamu alaykum, {first}</h1>
        <p className="mt-1.5 text-[14.5px] text-text-2">
          {d.totals.giftCount
            ? `Thank you for everything you have given — ${plural(d.totals.giftCount, 'donation')} to ${plural(d.totals.appealsSupported, 'appeal')}${d.totals.countries.length ? ` in ${listCountries(d.totals.countries)}` : ''}.`
            : 'Welcome. Your donations, receipts and regular giving will all be here.'}
        </p>
      </header>

      {d.failing.map((p) => (
        <Callout
          key={p.id}
          tone="red"
          icon={<TriangleAlert />}
          title={`Your ${perPeriod(p)} donation${p.appealTitle ? ` to ${p.appealTitle}` : ''} did not go through`}
          action={
            <ButtonLink to={`/account/plans?fix=${p.id}`} variant="primary" size="sm" className="bg-red hover:bg-[#8e3017]">
              Update card
            </ButtonLink>
          }
        >
          {p.failure?.lastError ?? 'The bank declined it.'} It usually means the card has expired or been replaced — updating it takes a minute.
        </Callout>
      ))}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="min-w-0 space-y-8">
          <Hero d={d} />
          <LifetimeRow d={d} />
          {/* on a phone, what goes out next comes before the history */}
          <div className="lg:hidden">
            <RegularGifts d={d} />
          </div>
          {d.impact.length > 0 && <Impact d={d} />}
          <RecentGifts gifts={d.recentGifts} onOpen={setGift} />
        </div>
        <aside className="min-w-0 space-y-8">
          <div className="hidden lg:block">
            <RegularGifts d={d} />
          </div>
          <FundraiserCard d={d} />
          <GiveAgain d={d} />
        </aside>
      </div>
      <GiftSheet gift={gift} onClose={() => setGift(null)} />
    </div>
  )
}

function greetingTime() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function listCountries(cs: string[]) {
  const names = cs.map(countryName)
  if (names.length <= 2) return names.join(' and ')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/* ---------- this financial year ---------- */
function Hero({ d }: { d: OverviewData }) {
  const month = new Date().getMonth() // 0 = January
  const thisYear = d.statements.find((s) => s.fy === d.fy)
  const lastYear = d.statements.find((s) => s.fy === d.fy - 1)
  /* June: the year is about to close. July: last year's statement is the thing. */
  const june = month === 5
  const july = month === 6
  const statementFy = july ? d.fy - 1 : june ? d.fy : lastYear ? d.fy - 1 : d.fy
  const statementYear = d.statements.find((s) => s.fy === statementFy)
  const prominent = (june || july) && Boolean(statementYear)
  const change = d.totals.lastFy > 0 ? d.totals.thisFy / d.totals.lastFy : null

  return (
    <Card className="relative isolate overflow-hidden bg-grad-deep-x text-white ring-0 shadow-card">
      {/* the donor's year, on the brand's deep gradient (styleguide p. 15) */}
      <div className="relative px-5 py-6 sm:px-8 sm:py-8">
        <p className="text-[12px] font-medium tracking-[0.2em] text-gold uppercase">This financial year · {fyLabel(d.fy)}</p>
        <p className="nums mt-2 font-display text-[40px] leading-none sm:text-[56px]">{formatMoney(d.totals.thisFy)}</p>
        <p className="mt-3 text-[14px] text-white/80">
          {thisYear ? `${plural(thisYear.count, 'donation')} since 1 July ${d.fy - 1}` : `Nothing yet since 1 July ${d.fy - 1}`}
          {d.totals.lastFy > 0 && (
            <>
              {' · '}
              <span className="nums">{formatMoney(d.totals.lastFy)}</span> in {fyLabel(d.fy - 1)}
              {change != null && change >= 1 && thisYear && <span className="text-white/60"> — already more</span>}
            </>
          )}
        </p>

        {prominent && statementYear ? (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-white/[.08] p-4 ring-1 ring-white/15 sm:flex-row sm:items-center">
            <FileText className="hidden size-5 shrink-0 text-white/80 sm:block" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{july ? `Your ${fyLabel(statementFy)} tax statement is ready` : `The financial year closes on 30 June`}</p>
              <p className="text-[13px] text-white/75">
                {july
                  ? `${formatMoney(statementYear.total)} across ${plural(statementYear.count, 'donation')}, with every receipt number — ready for your tax return.`
                  : 'Donations made by 30 June count towards this year’s tax return. Your statement so far is ready to check.'}
              </p>
            </div>
            <Link to={`/account/statement/${statementFy}`} className={buttonClass('secondary', 'md', 'shrink-0 bg-white text-[#00454b] ring-0 hover:bg-white/90')}>
              Open my statement
            </Link>
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap gap-2">
            {statementYear && (
              <Link to={`/account/statement/${statementFy}`} className={buttonClass('secondary', 'md', 'bg-white text-[#00454b] ring-0 hover:bg-white/90')}>
                <FileText /> {fyLabel(statementFy)} tax statement
              </Link>
            )}
            <Link to="/account/receipts" className={buttonClass('ghost', 'md', 'text-white/85 hover:bg-white/10 hover:text-white')}>
              All receipts <ArrowRight />
            </Link>
          </div>
        )}
      </div>
    </Card>
  )
}

function LifetimeRow({ d }: { d: OverviewData }) {
  const items = [
    { label: 'Given in total', value: <Money cents={d.totals.lifetime} /> },
    { label: 'Donations', value: d.totals.giftCount.toLocaleString('en-AU') },
    { label: 'Appeals', value: d.totals.appealsSupported },
    { label: 'Countries', value: d.totals.countries.length },
  ]
  return (
    <Card className="grid grid-cols-2 gap-px overflow-hidden bg-line-2 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="bg-paper px-5 py-4">
          <p className="text-[12.5px] text-text-2">{i.label}</p>
          <p className="nums mt-1 text-[22px] leading-tight font-semibold tracking-[-0.02em] text-text">{i.value}</p>
        </div>
      ))}
    </Card>
  )
}

/* ---------- impact ---------- */
function Impact({ d }: { d: OverviewData }) {
  return (
    <section>
      <SectionHeading title="What your giving has done">Counted from what you gave to each appeal.</SectionHeading>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {d.impact.map((i) => (
          <a key={i.appealSlug} href={`/appeals/${i.appealSlug}`} className="group rounded-2xl bg-paper p-4 ring-1 ring-line/80 shadow-soft transition-shadow hover:shadow-lift">
            <span className="grid size-9 place-items-center rounded-xl bg-green-50 text-green">
              {/water|well|station/i.test(i.label) ? <Globe2 className="size-[18px]" /> : <Package className="size-[18px]" />}
            </span>
            <p className="nums mt-3 text-[26px] leading-none font-semibold tracking-[-0.02em] text-text">{i.count.toLocaleString('en-AU')}</p>
            <p className="mt-1 text-[13.5px] font-medium text-text">{i.label.replace(/^[\d,]+\s/, '')}</p>
            <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-text-3 group-hover:text-text-2">{i.appealTitle}</p>
          </a>
        ))}
      </div>
    </section>
  )
}

/* ---------- recent gifts ---------- */
function RecentGifts({ gifts, onOpen }: { gifts: MyGift[]; onOpen: (g: MyGift) => void }) {
  return (
    <section>
      <SectionHeading
        title="Recent donations"
        action={
          <Link to="/account/giving" className="inline-flex items-center gap-1 text-[13.5px] font-medium text-green hover:underline">
            See all <ChevronRight className="size-4" />
          </Link>
        }
      />
      <Card className="overflow-hidden">
        {gifts.length === 0 ? (
          <EmptyState compact icon={<HandHeart />} title="No donations yet" action={<a href="/give" className={buttonClass('give', 'md')}>Make your first donation</a>}>
            When you give, it appears here with its receipt.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line-2">
            {gifts.map((g) => (
              <li key={g.id}>
                <button type="button" onClick={() => onOpen(g)} className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-paper-2/70 focus-visible:bg-paper-2 focus-visible:outline-none">
                  <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', g.status === 'succeeded' ? 'bg-green-50 text-green' : g.status === 'failed' ? 'bg-red-pale text-red' : 'bg-amber-pale text-amber')}>
                    {g.plan ? <Repeat className="size-[18px]" /> : <HeartHandshake className="size-[18px]" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-text">{g.appealTitle ?? 'Where most needed'}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-text-2">
                      {formatDay(g.date)}
                      <StatusBadge kind="designation" value={g.designation} size="sm" />
                      {g.status !== 'succeeded' && <StatusBadge kind="gift" value={g.status} size="sm" />}
                    </span>
                  </span>
                  <Money cents={g.amount + (g.fee ?? 0)} className={cn('shrink-0 text-[15px] font-semibold', g.status === 'failed' ? 'text-text-3 line-through' : 'text-text')} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  )
}

/* ---------- regular gifts ---------- */
function RegularGifts({ d }: { d: OverviewData }) {
  const order = { past_due: 0, active: 1, paused: 2 } as Record<string, number>
  const plans = [...d.plans].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))
  return (
    <section>
      <SectionHeading
        title="Regular donations"
        action={
          plans.length > 0 && (
            <Link to="/account/plans" className="inline-flex items-center gap-1 text-[13.5px] font-medium text-green hover:underline">
              Manage <ChevronRight className="size-4" />
            </Link>
          )
        }
      />
      {plans.length === 0 ? (
        <Card>
          <EmptyState compact icon={<Repeat />} title="No regular donations" action={<a href="/give" className={buttonClass('give', 'md')}>Set up a monthly donation</a>}>
            A small monthly donation is steady support an appeal can plan around. Pause or stop any time.
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => (
            <Link key={p.id} to={p.status === 'past_due' ? `/account/plans?fix=${p.id}` : '/account/plans'} className={cn('block rounded-2xl bg-paper p-4 ring-1 shadow-soft transition-shadow hover:shadow-lift', p.status === 'past_due' ? 'ring-red/30' : 'ring-line/80')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="nums text-[17px] font-semibold tracking-[-0.01em] text-text">{perPeriod(p)}</p>
                  <p className="mt-0.5 truncate text-[13px] text-text-2">{p.appealTitle ?? 'Where most needed'}</p>
                </div>
                {p.status !== 'active' && <StatusBadge kind="plan" value={p.status} size="sm" />}
              </div>
              {p.kind === 'instalment' && <InstalmentProgress plan={p} className="mt-3" />}
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-line-2 pt-3">
                <span className={cn('inline-flex items-center gap-1.5 text-[12.5px]', p.status === 'past_due' ? 'font-medium text-red' : 'text-text-2')}>
                  <CalendarClock className="size-3.5" />
                  {p.status === 'active' ? <>Next: {nextPaymentText(p)}</> : nextPaymentText(p)}
                </span>
                <CardChip payment={p.payment} className="text-[12px]" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

/* ---------- fundraiser ---------- */
function FundraiserCard({ d }: { d: OverviewData }) {
  const f = d.fundraisers.featured
  if (!f) {
    return (
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-pale text-violet">
            <Megaphone className="size-[18px]" />
          </span>
          <div>
            <p className="font-semibold text-text">Raise money for an appeal</p>
            <p className="mt-1 text-[13px] leading-relaxed text-text-2">A wedding, a birthday, a walk or a Ramadan challenge — make a page, share it, and every donation counts towards the appeal you choose.</p>
            <Link to="/account/fundraisers/new" className="mt-3 inline-flex items-center gap-1 text-[13.5px] font-medium text-green hover:underline">
              Start a fundraiser <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </Card>
    )
  }
  const tone = FUNDRAISER_STATUSES[f.status]
  return (
    <section>
      <SectionHeading
        title="Your fundraiser"
        action={
          <Link to="/account/fundraisers" className="inline-flex items-center gap-1 text-[13.5px] font-medium text-green hover:underline">
            {d.fundraisers.count > 1 ? `All ${d.fundraisers.count}` : 'Open'} <ChevronRight className="size-4" />
          </Link>
        }
      />
      <Link to={`/account/fundraisers`} className="block rounded-2xl bg-paper p-5 ring-1 ring-line/80 shadow-soft transition-shadow hover:shadow-lift">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 font-semibold leading-snug text-text">{f.title}</p>
          {tone && f.status !== 'live' && <StatusBadge kind="fundraiser" value={f.status} size="sm" />}
        </div>
        <p className="mt-1 text-[12.5px] text-text-2">For {f.appealTitle}</p>
        <div className="mt-4 flex items-baseline justify-between gap-2">
          <Money cents={f.raised} className="text-[22px] font-semibold tracking-[-0.02em] text-text" />
          <span className="nums text-[12.5px] text-text-3">of {formatMoney(f.target)}</span>
        </div>
        <Progress value={f.raised} max={f.target} className="mt-2" label="Raised so far" />
        <p className="mt-2 text-[12.5px] text-text-2">{plural(f.donorCount, 'supporter')}</p>
      </Link>
    </section>
  )
}

/* ---------- give again ---------- */
function GiveAgain({ d }: { d: OverviewData }) {
  const last = d.recentGifts.find((g) => g.status === 'succeeded' && g.appealSlug && g.appealOpen && !g.plan) ?? d.recentGifts.find((g) => g.status === 'succeeded' && g.appealSlug && g.appealOpen)
  return (
    <div className="rounded-2xl bg-gold-50 p-5 ring-1 ring-gold/20">
      <p className="font-semibold text-text">{last ? 'Give again' : 'Give today'}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-text-2">
        {last ? (
          <>
            Your last donation was to <strong className="font-medium text-text">{last.appealTitle}</strong>. The appeal is still open.
          </>
        ) : (
          'Every appeal is open to donations of any size. Zakat is passed on in full.'
        )}
      </p>
      <a href={last ? giveAgainHref({ appealSlug: last.appealSlug, designation: last.designation, amount: last.amount }) : '/give'} className={buttonClass('give', 'md', 'mt-4 w-full')}>
        {last ? `Give ${formatMoney(last.amount)} again` : 'Give now'}
      </a>
      {last && (
        <a href="/appeals" className="mt-2.5 block text-center text-[12.5px] font-medium text-text-2 hover:text-text">
          Or see every appeal
        </a>
      )}
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading your account">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="space-y-6">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
