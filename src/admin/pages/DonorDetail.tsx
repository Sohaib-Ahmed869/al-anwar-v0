import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity, ArrowRight, Copy, CreditCard, EyeOff, HandCoins, Inbox, Landmark, Mail, MailX, MapPin, MoreHorizontal, Pencil, Phone,
  Plus, Repeat, Search, Undo2, Users, X,
} from 'lucide-react'
import { DESIGNATIONS, EMAIL_TOPICS, FREQUENCIES, METHODS, fyLabel, type EmailTopic } from '../../../shared/domain'
import type { Donor, Gift, Page, Plan } from '../../../shared/types'
import { ApiError, api, errorMessage } from '../../portal/api'
import { Donut, MoneyColumnChart } from '../../portal/charts'
import { formatDate, formatDateTime, formatDay, formatMoney, formatNumber, formatRelative, plural } from '../../portal/format'
import { useStaff } from '../../portal/session'
import {
  Avatar, Badge, Button, ButtonLink, buttonClass, Callout, Card, CardHeader, Checkbox, DataTable, EmptyState, IconButton, Menu, MenuItem,
  MenuSeparator, Money, PageHeader, Pagination, Sheet, Skeleton, SkeletonRows, Spinner, Stat, StatusBadge, Switch, TabPanel, Tabs,
  Textarea, cn, toast, useDocumentTitle, useUrlState, type Column,
} from '../../portal/ui'
import { DonorFormDialog } from '../components/DonorFormDialog'
import { TagEditor } from '../components/TagEditor'
import { donorName, isMajor, type ActivityRow, type DonorRecord, type EmailRow } from '../components/donorTypes'

/* ---------------------------------------------------------------------------
   One donor, everything about them: the "one record per donor with every
   gift, what it was for, every email sent" the proposal promises.

   Left, the story: four figures, then tabs — an overview (giving by year and
   what it was given as), every gift, regular gifts, every email with the
   exact message as sent, enquiries, and the action log for this person.
   Right, the facts the office edits: contact details (in a Sheet, so the
   record stays in view), preferences, tags, notes and the payer names the
   bank matcher has learnt. Small edits save as they are made; notes save on
   a button, because half a sentence should not be written to the record.
--------------------------------------------------------------------------- */

type Tab = 'overview' | 'gifts' | 'plans' | 'emails' | 'enquiries' | 'activity'

export default function DonorDetail() {
  const { id = '' } = useParams()
  const { can } = useStaff()
  const nav = useNavigate()
  const qc = useQueryClient()
  const [url, setUrl] = useUrlState({ tab: 'overview', edit: '' })
  const tab = url.tab as Tab
  const q = useQuery({
    queryKey: ['admin', 'donor', id],
    queryFn: () => api.get<DonorRecord>(`/admin/donors/${id}`),
    retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2,
  })
  const d = q.data?.donor
  const s = q.data?.summary
  useDocumentTitle(d ? donorName(d) : 'Donor', 'Al-Anwaar admin')

  const patch = useMutation({
    mutationFn: (body: Partial<Donor>) => api.patch<Donor>(`/admin/donors/${id}`, body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ['admin', 'donor', id] })
      const prev = qc.getQueryData<DonorRecord>(['admin', 'donor', id])
      if (prev) qc.setQueryData<DonorRecord>(['admin', 'donor', id], { ...prev, donor: { ...prev.donor, ...body, preferences: { ...prev.donor.preferences, ...body.preferences } } })
      return { prev }
    },
    onError: (e, _b, ctx) => {
      if (ctx?.prev) qc.setQueryData(['admin', 'donor', id], ctx.prev)
      toast.error(errorMessage(e))
    },
    onSuccess: (donor) => {
      qc.setQueryData<DonorRecord>(['admin', 'donor', id], (old) => (old ? { ...old, donor } : old))
      qc.invalidateQueries({ queryKey: ['admin', 'donors'] })
    },
  })

  if (q.isError) {
    return (
      <Card className="mt-6">
        <EmptyState
          icon={<Users />}
          title={q.error instanceof ApiError && q.error.status === 404 ? 'That donor could not be found' : 'This record could not load'}
          action={<ButtonLink to="/admin/donors" variant="secondary">Back to donors</ButtonLink>}
        >
          {q.error instanceof ApiError && q.error.status === 404 ? 'It may have been merged into another record, or the link is wrong.' : errorMessage(q.error)}
        </EmptyState>
      </Card>
    )
  }

  if (!d || !s) return <DetailSkeleton />

  const name = donorName(d)
  const editable = can('donors.write') && d.status !== 'merged'
  const activePlans = s.plans.filter((p) => ['active', 'paused', 'past_due'].includes(p.status))

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Donors', to: '/admin/donors' }, { label: name }]}
        title={
          <span className="flex items-center gap-4">
            <Avatar name={name} size="lg" className="hidden sm:inline-grid" />
            <span className="min-w-0">
              <span className="block truncate">{name}</span>
            </span>
          </span>
        }
        meta={
          <>
            <span className="nums text-[13px] text-text-2">{d.number}</span>
            <span className="text-text-3">·</span>
            <span className="text-[13px] text-text-2">On file since {formatDate(d.createdAt)}</span>
            {d.hasActivePlan && (
              <Badge tone="green">
                <Repeat className="size-3" /> Regular giver
              </Badge>
            )}
            {isMajor(d) && <Badge tone="violet">Major donor</Badge>}
            {d.preferences.anonymous && (
              <Badge>
                <EyeOff className="size-3" /> Gives anonymously
              </Badge>
            )}
            {!d.preferences.emailOptIn && (
              <Badge tone="amber">
                <MailX className="size-3" /> No appeal emails
              </Badge>
            )}
            {d.status === 'merged' && <Badge tone="red">Merged</Badge>}
          </>
        }
        actions={
          <>
            {can('gifts.create') && d.status !== 'merged' && (
              <ButtonLink to={`/admin/gifts?new=1&donor=${d.id}`} variant="primary" icon={<Plus />}>
                Record a donation
              </ButtonLink>
            )}
            <a href={`mailto:${d.email}`} className={buttonClass('secondary', 'md')}>
              <Mail /> Email
            </a>
            {editable && (
              <Button variant="secondary" icon={<Pencil />} onClick={() => setUrl({ edit: '1' })}>
                Edit
              </Button>
            )}
            <Menu
              trigger={
                <IconButton label="More actions" variant="secondary">
                  <MoreHorizontal />
                </IconButton>
              }
            >
              <MenuItem icon={<Copy />} onSelect={() => copy(d.email, 'Email address copied')}>
                Copy email address
              </MenuItem>
              <MenuItem icon={<Copy />} onSelect={() => copy(d.number, 'Donor number copied')}>
                Copy donor number
              </MenuItem>
              {can('gifts.read') && (
                <MenuItem icon={<HandCoins />} onSelect={() => nav(`/admin/gifts?donor=${d.id}`)}>
                  Open in the donations list
                </MenuItem>
              )}
              {can('donors.merge') && (
                <>
                  <MenuSeparator />
                  <MenuItem icon={<Search />} onSelect={() => nav(`/admin/donors/duplicates?donor=${d.id}`)}>
                    Look for duplicates
                  </MenuItem>
                </>
              )}
            </Menu>
          </>
        }
      />

      {d.status === 'merged' && d.mergedInto && (
        <Callout
          tone="amber"
          className="mb-5"
          title="This record was merged"
          action={<ButtonLink to={`/admin/donors/${d.mergedInto}`} variant="secondary" size="sm" iconRight={<ArrowRight />}>Open the surviving record</ButtonLink>}
        >
          Its donations, regular donations and emails now live on the surviving record. This page is kept so old links still lead somewhere.
        </Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* ---------- the story ---------- */}
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Stat label="Lifetime" value={<Money cents={d.totalGiven} />} hint={d.lastGiftAt ? `last donation ${formatDay(d.lastGiftAt)}` : 'no donations yet'} />
            <Stat label={`This year, ${fyLabel(s.thisFy.fy)}`} value={<Money cents={s.thisFy.total} />} hint={plural(s.thisFy.count, 'donation')} />
            <Stat label="Donations" value={formatNumber(d.giftCount)} hint={d.giftCount ? `about ${formatMoney(Math.round(d.totalGiven / d.giftCount), { whole: true })} each` : undefined} />
            <Stat label="First donation" value={d.firstGiftAt ? format(new Date(d.firstGiftAt), 'MMM yyyy') : '—'} hint={d.firstGiftAt ? formatRelative(d.firstGiftAt) : 'not yet'} />
          </div>

          <Tabs
            className="mt-6"
            value={tab}
            onChange={(v) => setUrl({ tab: v })}
            tabs={[
              { value: 'overview', label: 'Overview' },
              { value: 'gifts', label: 'Donations', count: d.giftCount },
              { value: 'plans', label: 'Regular donations', count: s.plans.length },
              { value: 'emails', label: 'Emails', count: s.emailsCount },
              { value: 'enquiries', label: 'Enquiries', count: s.enquiries.length },
              { value: 'activity', label: 'Activity' },
            ]}
          >
            <TabPanel value="overview" className="pt-5">
              <Overview record={q.data!} onTab={(t) => setUrl({ tab: t })} activePlans={activePlans} />
            </TabPanel>
            <TabPanel value="gifts" className="pt-5">
              {tab === 'gifts' && <GiftsTab donorId={d.id} />}
            </TabPanel>
            <TabPanel value="plans" className="pt-5">
              <PlansTab plans={s.plans} />
            </TabPanel>
            <TabPanel value="emails" className="pt-5">
              {tab === 'emails' && <EmailsTab donorId={d.id} />}
            </TabPanel>
            <TabPanel value="enquiries" className="pt-5">
              <EnquiriesTab record={q.data!} />
            </TabPanel>
            <TabPanel value="activity" className="pt-5">
              {tab === 'activity' && <ActivityTab donorId={d.id} />}
            </TabPanel>
          </Tabs>
        </div>

        {/* ---------- the facts ---------- */}
        <aside className="min-w-0 space-y-4">
          <Card>
            <CardHeader
              title="Contact"
              action={
                editable ? (
                  <Button variant="ghost" size="sm" icon={<Pencil />} onClick={() => setUrl({ edit: '1' })}>
                    Edit
                  </Button>
                ) : undefined
              }
            />
            <div className="space-y-3 px-5 pb-5 text-[13.5px] sm:px-6">
              <ContactLine icon={<Mail />}>
                <a href={`mailto:${d.email}`} className="text-text hover:text-green hover:underline [overflow-wrap:anywhere]">
                  {d.email}
                </a>
                {d.altEmails.length > 0 && (
                  <span className="mt-0.5 block text-[12.5px] text-text-3 [overflow-wrap:anywhere]">Also {d.altEmails.join(', ')}</span>
                )}
              </ContactLine>
              <ContactLine icon={<Phone />}>
                {d.phone ? (
                  <a href={`tel:${d.phone.replace(/\s/g, '')}`} className="nums text-text hover:text-green hover:underline">
                    {d.phone}
                  </a>
                ) : (
                  <span className="text-text-3">No phone on file</span>
                )}
              </ContactLine>
              <ContactLine icon={<MapPin />}>
                {d.address?.line1 || d.address?.suburb ? (
                  <span className="text-text">
                    {[d.address.line1, d.address.line2].filter(Boolean).join(', ')}
                    {d.address.line1 && <br />}
                    {[d.address.suburb, d.address.state, d.address.postcode].filter(Boolean).join(' ')}
                  </span>
                ) : (
                  <span className="text-text-3">No address on file</span>
                )}
              </ContactLine>
              <p className="border-t border-line-2 pt-3 text-[12.5px] text-text-3">
                Came to us {SOURCE[d.source] ?? 'online'} · {d.number}
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Preferences" />
            <div className="space-y-4 px-5 pb-5 sm:px-6">
              <Switch
                checked={d.preferences.emailOptIn}
                disabled={!editable}
                onChange={(v) => patch.mutate({ preferences: { ...d.preferences, emailOptIn: v } }, { onSuccess: () => toast.success(v ? 'Appeal emails switched on' : 'Appeal emails switched off') })}
                label="Appeal and news emails"
                description="Receipts and statements are sent regardless."
              />
              {d.preferences.emailOptIn && (
                <div className="space-y-2 rounded-xl bg-paper-2 p-3">
                  {(Object.keys(EMAIL_TOPICS) as EmailTopic[]).map((t) => (
                    <Checkbox
                      key={t}
                      disabled={!editable}
                      checked={d.preferences.topics.includes(t)}
                      onChange={(v) =>
                        patch.mutate({ preferences: { ...d.preferences, topics: v ? [...d.preferences.topics, t] : d.preferences.topics.filter((x) => x !== t) } })
                      }
                      label={<span className="font-normal">{EMAIL_TOPICS[t]}</span>}
                    />
                  ))}
                </div>
              )}
              <Switch
                checked={d.preferences.anonymous}
                disabled={!editable}
                onChange={(v) => patch.mutate({ preferences: { ...d.preferences, anonymous: v } }, { onSuccess: () => toast.success(v ? 'Their name is now kept off public lists' : 'Their name can show on public lists') })}
                label="Give anonymously"
                description="Keeps their name off appeal and supporter pages."
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Tags" description="For lists and campaigns" />
            <div className="px-5 pb-5 sm:px-6">
              <TagEditor value={d.tags} disabled={!editable} onChange={(tags) => patch.mutate({ tags })} suggestions={['major donor', 'volunteer', 'board', 'masjid contact', 'corporate']} />
            </div>
          </Card>

          <NotesCard donor={d} editable={editable} />

          {(d.bankAliases.length > 0 || s.mergedFrom.length > 0) && (
            <Card>
              {d.bankAliases.length > 0 && (
                <>
                  <CardHeader title="Names on bank statements" description="Learnt when a transfer was matched to them" icon={<Landmark />} />
                  <ul className="space-y-1.5 px-5 pb-5 sm:px-6">
                    {d.bankAliases.map((a) => (
                      <li key={a} className="flex items-center justify-between gap-2 rounded-lg bg-paper-2 px-3 py-1.5 text-[12.5px] font-medium text-text-2 uppercase">
                        <span className="truncate font-mono">{a}</span>
                        {editable && (
                          <button
                            type="button"
                            onClick={() => patch.mutate({ bankAliases: d.bankAliases.filter((x) => x !== a) }, { onSuccess: () => toast.success('The matcher will no longer use that name') })}
                            className="grid size-6 place-items-center rounded-md text-text-3 hover:bg-ink/5 hover:text-text"
                            aria-label={`Forget ${a}`}
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {s.mergedFrom.length > 0 && (
                <div className={cn('px-5 pb-5 sm:px-6', !d.bankAliases.length && 'pt-5')}>
                  <p className="mb-2 flex items-center gap-2 text-[13px] font-medium text-text">
                    <Undo2 className="size-4 text-text-3" /> Merged into this record
                  </p>
                  <ul className="space-y-1 text-[12.5px] text-text-2">
                    {s.mergedFrom.map((m) => (
                      <li key={m.id}>
                        <Link to={`/admin/donors/${m.id}`} className="hover:text-green hover:underline">
                          {donorName(m)} · {m.number}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}
        </aside>
      </div>

      <DonorFormDialog open={url.edit === '1' && editable} onOpenChange={(v) => !v && setUrl({ edit: '' })} donor={d} />
    </>
  )
}

const SOURCE: Record<string, string> = {
  web: 'through the website',
  import: 'in a data import',
  offline: 'in person or by phone',
  bank: 'through a bank transfer',
  fundraiser: 'through a supporter page',
}

function copy(text: string, msg: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast.success(msg),
    () => toast.error('Copying is blocked in this browser'),
  )
}

function ContactLine({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-text-3 [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the donor">
      <Skeleton className="mb-3 h-3.5 w-32" />
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="size-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-3.5 w-40" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[108px] rounded-2xl" />
            ))}
          </div>
          <Skeleton className="mt-6 h-10 w-full" />
          <Skeleton className="mt-5 h-72 w-full rounded-2xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}

/* ---------- notes ---------- */

function NotesCard({ donor, editable }: { donor: Donor; editable: boolean }) {
  const qc = useQueryClient()
  const [text, setText] = useState(donor.notes ?? '')
  useEffect(() => setText(donor.notes ?? ''), [donor.id, donor.notes])
  const dirty = text !== (donor.notes ?? '')
  const save = useMutation({
    mutationFn: () => api.patch<Donor>(`/admin/donors/${donor.id}`, { notes: text }),
    onSuccess: (d) => {
      qc.setQueryData<DonorRecord>(['admin', 'donor', donor.id], (old) => (old ? { ...old, donor: d } : old))
      toast.success('Notes saved')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <Card>
      <CardHeader title="Notes" description="Seen by staff only, never by the donor" />
      <div className="px-5 pb-5 sm:px-6">
        {editable ? (
          <>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Prefers a call to an email. Gives zakat each Ramadan."
              aria-label="Notes"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && dirty) save.mutate()
              }}
            />
            {dirty && (
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setText(donor.notes ?? '')}>
                  Discard
                </Button>
                <Button variant="primary" size="sm" loading={save.isPending} onClick={() => save.mutate()}>
                  Save notes
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="text-[13.5px] whitespace-pre-wrap text-text-2">{donor.notes || 'No notes.'}</p>
        )}
      </div>
    </Card>
  )
}

/* ---------- overview ---------- */

function Overview({ record, onTab, activePlans }: { record: DonorRecord; onTab: (t: Tab) => void; activePlans: Plan[] }) {
  const { donor: d, summary: s } = record
  if (!d.giftCount && !s.plans.length) {
    return (
      <Card>
        <EmptyState icon={<HandCoins />} title={`${d.firstName} has not given yet`}>
          They are on file from {SOURCE[d.source] ?? 'the website'}. Their first donation, from any channel, will appear here.
        </EmptyState>
      </Card>
    )
  }
  return (
    <div className="space-y-4">
      {activePlans.map((p) => (
        <Callout
          key={p.id}
          tone={p.status === 'past_due' ? 'red' : p.status === 'paused' ? 'amber' : 'green'}
          icon={<Repeat />}
          title={`${formatMoney(p.amount)} ${FREQUENCIES[p.frequency].per} to ${p.appealTitle ?? 'where most needed'}`}
          action={<Button variant="secondary" size="sm" onClick={() => onTab('plans')}>Details</Button>}
        >
          {p.status === 'past_due'
            ? `The last payment failed${p.failure?.lastError ? ` (${p.failure.lastError})` : ''}. ${p.failure?.nextRetryAt ? `Trying again ${formatDay(p.failure.nextRetryAt)}.` : ''}`
            : p.status === 'paused'
              ? `Paused${p.pausedUntil ? ` until ${formatDate(p.pausedUntil)}` : ''}.`
              : `Next payment ${p.nextChargeAt ? formatDay(p.nextChargeAt) : 'soon'} · ${formatMoney(p.collected)} given this way so far`}
        </Callout>
      ))}
      <div className="grid gap-4">
        <Card className="min-w-0">
          <CardHeader title="Giving by year" description="Financial years, July to June" />
          <div className="px-3 pb-4 sm:px-4">
            <MoneyColumnChart
              data={s.byYear.map((y) => ({ fy: fyLabel(y.fy), total: y.total }))}
              xKey="fy"
              series={[{ key: 'total', label: 'Given' }]}
              height={220}
            />
          </div>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="Given as" description="Every donation, all time" />
          <div className="px-5 pb-5 sm:px-6">
            {s.byDesignation.length ? (
              <Donut size={132} centerLabel="lifetime" rows={s.byDesignation.map((x) => ({ label: DESIGNATIONS[x.designation]?.label ?? x.designation, value: x.total }))} />
            ) : (
              <p className="text-[13px] text-text-3">No paid donations yet.</p>
            )}
          </div>
        </Card>
      </div>
      <Card className="overflow-hidden">
        <CardHeader
          title="Recent donations"
          action={
            <Button variant="ghost" size="sm" iconRight={<ArrowRight />} onClick={() => onTab('gifts')}>
              All {formatNumber(d.giftCount)}
            </Button>
          }
        />
        <GiftList gifts={s.recentGifts} />
        {s.byMethod.length > 0 && (
          <p className="border-t border-line-2 px-5 py-3 text-[12.5px] text-text-3 sm:px-6">
            By {s.byMethod.map((m) => `${METHODS[m.method]?.label.toLowerCase() ?? m.method} ${formatMoney(m.total, { whole: true })}`).join(' · ')}
          </p>
        )}
      </Card>
      {s.fundraisers.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader title="Their supporter pages" description="Pages they set up to raise money from friends and family" />
          <ul className="divide-y divide-line-2 border-t border-line-2">
            {s.fundraisers.map((f) => (
              <li key={f.id}>
                <Link to={`/admin/fundraisers?open=${f.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ink/[.025] sm:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-text">{f.title}</p>
                    <p className="truncate text-[12.5px] text-text-3">
                      For {f.appealTitle} · <Money cents={f.raised} /> of <Money cents={f.target} />
                    </p>
                  </div>
                  <StatusBadge kind="fundraiser" value={f.status} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function GiftList({ gifts }: { gifts: Gift[] }) {
  if (!gifts.length) return <p className="px-5 pb-5 text-[13px] text-text-3 sm:px-6">No donations yet.</p>
  return (
    <ul className="divide-y divide-line-2 border-t border-line-2">
      {gifts.map((g) => (
        <li key={g.id}>
          <Link to={`/admin/gifts?gift=${g.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink/[.025] sm:px-6">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink/[.04] text-text-3">
              {g.plan ? <Repeat className="size-4" /> : g.method === 'bank' ? <Landmark className="size-4" /> : <CreditCard className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium text-text">{g.appealTitle ?? 'Where most needed'}</p>
              <p className="truncate text-[12.5px] text-text-3">
                {formatDate(g.date)} · {METHODS[g.method]?.label} · {g.number}
              </p>
            </div>
            <StatusBadge kind="designation" value={g.designation} size="sm" className="hidden sm:inline-flex" />
            {g.status !== 'succeeded' && <StatusBadge kind="gift" value={g.status} size="sm" />}
            <Money cents={g.amount} className={cn('w-20 shrink-0 text-right text-[13.5px] font-semibold', g.status === 'succeeded' ? 'text-text' : 'text-text-3 line-through decoration-text-3/40')} />
          </Link>
        </li>
      ))}
    </ul>
  )
}

/* ---------- gifts ---------- */

function GiftsTab({ donorId }: { donorId: string }) {
  const nav = useNavigate()
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('-date')
  const q = useQuery({
    queryKey: ['admin', 'donor', donorId, 'gifts', page, sort],
    queryFn: () => api.get<Page<Gift>>(`/admin/donors/${donorId}/gifts`, { page, sort, pageSize: 20 }),
    placeholderData: keepPreviousData,
  })
  const cols: Column<Gift>[] = [
    { key: 'date', header: 'Date', sort: 'date', cell: (g) => <span className="nums whitespace-nowrap">{formatDate(g.date)}</span> },
    {
      key: 'what',
      header: 'For',
      cell: (g) => (
        <div className="min-w-0">
          <p className="truncate text-text">{g.appealTitle ?? 'Where most needed'}</p>
          <p className="truncate text-[12.5px] text-text-3">
            {g.number}
            {g.receipt?.number && ` · Receipt ${g.receipt.number}`}
          </p>
        </div>
      ),
    },
    { key: 'designation', header: 'As', cell: (g) => <StatusBadge kind="designation" value={g.designation} size="sm" /> },
    { key: 'method', header: 'Method', cell: (g) => <span className="text-text-2">{g.plan ? 'Regular' : METHODS[g.method]?.label}</span>, hideBelow: 'xl' },
    { key: 'status', header: 'Status', cell: (g) => <StatusBadge kind="gift" value={g.status} size="sm" />, hideBelow: 'lg' },
    { key: 'amount', header: 'Amount', sort: 'amount', align: 'right', cell: (g) => <Money cents={g.amount} className="font-medium text-text" /> },
  ]
  return (
    <Card className="overflow-hidden">
      <DataTable
        columns={cols}
        rows={q.data?.items}
        rowKey={(g) => g.id}
        loading={q.isFetching}
        sort={sort}
        onSort={(v) => (setSort(v), setPage(1))}
        onRowClick={(g) => nav(`/admin/gifts?gift=${g.id}`)}
        dense
        mobile={(g) => (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-text">{g.appealTitle ?? 'Where most needed'}</p>
              <p className="truncate text-[12.5px] text-text-3">
                {formatDate(g.date)} · {DESIGNATIONS[g.designation]?.short} · {METHODS[g.method]?.label}
              </p>
            </div>
            <div className="text-right">
              <Money cents={g.amount} className="text-[14px] font-semibold text-text" />
              {g.status !== 'succeeded' && <StatusBadge kind="gift" value={g.status} size="sm" className="mt-0.5" />}
            </div>
          </div>
        )}
        empty={<EmptyState compact icon={<HandCoins />} title="No donations yet">Every donation they make, by any method, is listed here.</EmptyState>}
      />
      {q.data && <Pagination page={page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />}
    </Card>
  )
}

/* ---------- regular gifts ---------- */

function PlansTab({ plans }: { plans: Plan[] }) {
  const nav = useNavigate()
  const { can } = useStaff()
  if (!plans.length) {
    return (
      <Card>
        <EmptyState compact icon={<Repeat />} title="No regular donations">
          When they set up a weekly, fortnightly or monthly donation it appears here.
        </EmptyState>
      </Card>
    )
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {plans.map((p) => (
        <Card key={p.id} className={cn('p-5', can('plans.manage') && 'cursor-pointer transition-shadow hover:shadow-lift')} onClick={can('plans.manage') ? () => nav(`/admin/plans?id=${p.id}`) : undefined}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="nums text-[20px] font-semibold tracking-[-0.02em] text-text">
                {formatMoney(p.amount)} <span className="text-[13px] font-normal text-text-2">{FREQUENCIES[p.frequency].per}</span>
              </p>
              <p className="mt-0.5 text-[13px] text-text-2">
                {p.appealTitle ?? 'Where most needed'} · {DESIGNATIONS[p.designation]?.short}
              </p>
            </div>
            <StatusBadge kind="plan" value={p.status} size="sm" />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
            <div>
              <dt className="text-text-3">{p.status === 'active' ? 'Next payment' : p.status === 'cancelled' ? 'Cancelled' : 'Last payment'}</dt>
              <dd className="nums text-text">
                {p.status === 'active' ? formatDate(p.nextChargeAt) : p.status === 'cancelled' ? formatDate(p.cancelledAt) : formatDate(p.lastChargeAt)}
              </dd>
            </div>
            <div>
              <dt className="text-text-3">Given so far</dt>
              <dd className="nums text-text">
                {formatMoney(p.collected)}
                {p.instalments && <span className="text-text-3"> · {p.instalments.paid} of {p.instalments.total}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-text-3">Paying by</dt>
              <dd className="text-text">{p.payment.method === 'paypal' ? 'PayPal' : `${p.payment.brand ?? 'Card'} ····${p.payment.last4 ?? ''}`}</dd>
            </div>
            <div>
              <dt className="text-text-3">Started</dt>
              <dd className="nums text-text">{formatDate(p.startDate)}</dd>
            </div>
          </dl>
          {p.status === 'past_due' && p.failure?.lastError && <p className="mt-3 rounded-lg bg-red-pale px-3 py-2 text-[12.5px] text-red">{p.failure.lastError}</p>}
          {p.cancelReason && <p className="mt-3 text-[12.5px] text-text-3">“{p.cancelReason}”</p>}
        </Card>
      ))}
    </div>
  )
}

/* ---------- emails ---------- */

const TEMPLATE_LABELS: Record<string, string> = {
  receipt: 'Receipt',
  otp: 'Sign-in code',
  campaign: 'Campaign',
  'campaign.test': 'Campaign test',
  'plan.failed': 'Failed payment',
  'plan.notice': 'Upcoming payment',
  'plan.changed': 'Regular donation updated',
  'tax.statement': 'Tax statement',
  'bank.instructions': 'Bank transfer details',
  'enquiry.reply': 'Reply to enquiry',
}

function EmailsTab({ donorId }: { donorId: string }) {
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<EmailRow | null>(null)
  const q = useQuery({
    queryKey: ['admin', 'donor', donorId, 'emails', page],
    queryFn: () => api.get<Page<EmailRow>>(`/admin/donors/${donorId}/emails`, { page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  })
  const full = useQuery({
    queryKey: ['admin', 'donor', donorId, 'email', open?.id],
    queryFn: () => api.get<EmailRow>(`/admin/donors/${donorId}/emails/${open!.id}`),
    enabled: Boolean(open),
  })
  return (
    <>
      <Card className="overflow-hidden">
        {!q.data ? (
          <SkeletonRows className="p-5" rows={5} />
        ) : q.data.items.length ? (
          <ul className={cn('divide-y divide-line-2', q.isFetching && 'opacity-70')}>
            {q.data.items.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => setOpen(m)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-ink/[.025] sm:px-6">
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', m.status === 'failed' ? 'bg-red-pale text-red' : 'bg-ink/[.04] text-text-3')}>
                    <Mail className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-text">{m.subject}</p>
                    <p className="truncate text-[12.5px] text-text-3">
                      {TEMPLATE_LABELS[m.template] ?? m.template} · to {m.to}
                    </p>
                  </div>
                  {m.status !== 'sent' && <Badge tone={m.status === 'failed' ? 'red' : 'amber'} size="sm">{m.status === 'failed' ? 'Failed' : 'Queued'}</Badge>}
                  <span className="nums shrink-0 text-[12.5px] text-text-3">{formatDay(m.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact icon={<Mail />} title="No emails yet">
            Receipts, statements and campaign emails sent to them will be kept here, exactly as they went out.
          </EmptyState>
        )}
        {q.data && <Pagination page={page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />}
      </Card>
      <Sheet
        open={Boolean(open)}
        onOpenChange={(v) => !v && setOpen(null)}
        title={open?.subject ?? 'Email'}
        description={open ? `${TEMPLATE_LABELS[open.template] ?? open.template} · to ${open.to} · ${formatDateTime(open.sentAt ?? open.createdAt)}` : undefined}
        width={680}
      >
        {open?.status === 'failed' && open.error && <p className="mb-3 rounded-lg bg-red-pale px-3 py-2 text-[12.5px] text-red">Not delivered: {open.error}</p>}
        {full.data?.html ? (
          <iframe
            title={`Email: ${open?.subject}`}
            srcDoc={full.data.html}
            sandbox=""
            className="h-[calc(100dvh-190px)] min-h-[420px] w-full rounded-xl bg-white ring-1 ring-line"
          />
        ) : (
          <div className="grid h-60 place-items-center">
            <Spinner />
          </div>
        )}
      </Sheet>
    </>
  )
}

/* ---------- enquiries ---------- */

function EnquiriesTab({ record }: { record: DonorRecord }) {
  const { can } = useStaff()
  const list = record.summary.enquiries
  if (!list.length) {
    return (
      <Card>
        <EmptyState compact icon={<Inbox />} title="No enquiries">
          Messages, volunteer and event sign-ups from {record.donor.firstName} are attached here automatically.
        </EmptyState>
      </Card>
    )
  }
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-line-2">
        {list.map((e) => {
          const inner = (
            <>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <StatusBadge kind="enquiryType" value={e.type} size="sm" />
                  <p className="truncate text-[13.5px] font-medium text-text">{e.subject || e.message.slice(0, 80) || 'No subject'}</p>
                </div>
                {e.message && <p className="mt-1 line-clamp-2 text-[12.5px] text-text-2">{e.message}</p>}
              </div>
              <div className="shrink-0 text-right">
                <StatusBadge kind="enquiry" value={e.status} size="sm" />
                <p className="nums mt-1 text-[12px] text-text-3">{formatDay(e.createdAt)}</p>
              </div>
            </>
          )
          return (
            <li key={e.id}>
              {can('enquiries.manage') ? (
                <Link to={`/admin/enquiries?id=${e.id}`} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-ink/[.025] sm:px-6">
                  {inner}
                </Link>
              ) : (
                <div className="flex items-start gap-3 px-5 py-3.5 sm:px-6">{inner}</div>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/* ---------- activity ---------- */

function ActivityTab({ donorId }: { donorId: string }) {
  const [page, setPage] = useState(1)
  const q = useQuery({
    queryKey: ['admin', 'donor', donorId, 'activity', page],
    queryFn: () => api.get<Page<ActivityRow>>(`/admin/donors/${donorId}/activity`, { page, pageSize: 30 }),
    placeholderData: keepPreviousData,
  })
  return (
    <Card className="overflow-hidden">
      {!q.data ? (
        <SkeletonRows className="p-5" rows={6} />
      ) : q.data.items.length ? (
        <ol className={cn('px-5 py-4 sm:px-6', q.isFetching && 'opacity-70')}>
          {q.data.items.map((e, i) => (
            <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
              {i < q.data.items.length - 1 && <span className="absolute top-8 bottom-0 left-[15px] w-px bg-line-2" aria-hidden />}
              <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-paper-2 text-text-3 ring-1 ring-line-2">
                <ActivityIcon action={e.action} />
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <p className="text-[13.5px] leading-snug text-text">{e.summary}</p>
                <p className="mt-0.5 text-[12px] text-text-3">
                  {e.actor.name} · <time dateTime={e.at}>{formatDateTime(e.at)}</time>
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState compact icon={<Activity />} title="Nothing logged yet">
          Every change to this record and their donations is logged here with who made it and when.
        </EmptyState>
      )}
      {q.data && <Pagination page={page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />}
    </Card>
  )
}

function ActivityIcon({ action }: { action: string }) {
  const c = 'size-4'
  if (action.startsWith('gift')) return <HandCoins className={c} />
  if (action.startsWith('plan')) return <Repeat className={c} />
  if (action.includes('merge')) return <Users className={c} />
  if (action.includes('email') || action.includes('receipt')) return <Mail className={c} />
  return <Pencil className={c} />
}
