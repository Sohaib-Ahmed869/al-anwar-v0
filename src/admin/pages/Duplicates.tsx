import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, Check, CheckCircle2, Copy, GitMerge, UserX } from 'lucide-react'
import type { Address } from '../../../shared/types'
import { api, errorMessage } from '../../portal/api'
import { formatDate, formatDay, formatMoney, formatNumber, plural } from '../../portal/format'
import {
  Avatar, Badge, Button, ButtonLink, Callout, Card, EmptyState, PageHeader, Segmented, Sheet, Skeleton, Spinner, cn, toast,
  useConfirm, useDocumentTitle, useUrlState,
} from '../../portal/ui'
import { donorName, type CompareResponse, type CompareSide, type DuplicatePair } from '../components/donorTypes'

/* ---------------------------------------------------------------------------
   Possible duplicates: the same person on file twice — a second email
   address, a cash gift entered before they gave online — and the merge that
   folds them into one record without losing a cent of history.

   Pairs come scored from the server with the reasons in words ("Same phone
   0412…"), best first. "Likely" pairs share a name and a hard signal (phone,
   address, email); "worth a look" pairs share only a name and a similar
   email, so a person decides.

   Opening a pair shows both records side by side. For each detail that
   differs the person picks which to keep; everything else — every email
   address, tag, bank payer name, gift, regular gift and enquiry — is kept
   from both. The merge is irreversible, so it asks for "MERGE" to be typed.
   "Not the same person" is remembered and the pair never comes back.
--------------------------------------------------------------------------- */

const LIKELY = 0.75

export default function Duplicates() {
  useDocumentTitle('Possible duplicates', 'Al-Anwaar admin')
  const [s, set] = useUrlState({ pair: '', donor: '', show: 'all' })
  const q = useQuery({
    queryKey: ['admin', 'donors', 'duplicates'],
    queryFn: () => api.get<{ items: DuplicatePair[]; total: number }>('/admin/donors/duplicates'),
  })
  const all = q.data?.items ?? []
  const forDonor = s.donor ? all.filter((p) => p.a.id === s.donor || p.b.id === s.donor) : all
  const likely = forDonor.filter((p) => p.score >= LIKELY)
  const maybe = forDonor.filter((p) => p.score < LIKELY)
  const shown = s.show === 'likely' ? likely : s.show === 'maybe' ? maybe : forDonor
  const [a, b] = s.pair ? s.pair.split(':') : []

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Donors', to: '/admin/donors' }, { label: 'Possible duplicates' }]}
        title="Possible duplicates"
        description="People who may be on file twice. Compare the two records, choose what to keep, and merge — every gift, receipt and email moves across."
      />

      {s.donor && q.data && (
        <Callout
          tone="neutral"
          className="mb-4"
          action={
            <Button variant="secondary" size="sm" onClick={() => set({ donor: '' })}>
              Show everyone
            </Button>
          }
        >
          {forDonor.length ? `Showing the ${plural(forDonor.length, 'possible match', 'possible matches')} for one donor.` : 'No likely duplicates were found for this donor.'}
        </Callout>
      )}

      {!q.data ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-2xl" />
          ))}
        </div>
      ) : !all.length ? (
        <Card>
          <EmptyState
            icon={<CheckCircle2 />}
            title="No duplicates to look at"
            action={<ButtonLink to="/admin/donors" variant="secondary">Back to donors</ButtonLink>}
          >
            Every donor looks like one person with one record. New possible matches appear here — and on the Donors badge — as soon as they come in.
          </EmptyState>
        </Card>
      ) : (
        <>
          {forDonor.length > 0 && (
            <Segmented
              className="mb-4"
              aria-label="Which pairs"
              value={s.show as 'all' | 'likely' | 'maybe'}
              onChange={(v) => set({ show: v })}
              options={[
                { value: 'all', label: 'All', count: forDonor.length },
                { value: 'likely', label: 'Likely', count: likely.length },
                { value: 'maybe', label: 'Worth a look', count: maybe.length },
              ]}
            />
          )}
          {shown.length ? (
            <ul className="space-y-3">
              {shown.map((p) => (
                <li key={p.id}>
                  <PairRow pair={p} onOpen={() => set({ pair: `${p.a.id}:${p.b.id}` })} />
                </li>
              ))}
            </ul>
          ) : (
            <Card>
              <EmptyState compact icon={<Check />} title="Nothing in this group">
                Try the other tab.
              </EmptyState>
            </Card>
          )}
        </>
      )}

      <CompareSheet a={a} b={b} onClose={() => set({ pair: '' })} />
    </>
  )
}

function Confidence({ score }: { score: number }) {
  return score >= LIKELY ? (
    <Badge tone="red" dot>
      Likely the same
    </Badge>
  ) : (
    <Badge tone="amber" dot>
      Worth a look
    </Badge>
  )
}

function PairRow({ pair, onOpen }: { pair: DuplicatePair; onOpen: () => void }) {
  const side = (d: DuplicatePair['a']) => (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar name={donorName(d)} size="md" />
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium text-text">
          {donorName(d)} <span className="text-[12px] font-normal text-text-3">{d.number}</span>
        </p>
        <p className="truncate text-[12.5px] text-text-3">{d.email}</p>
        <p className="nums truncate text-[12.5px] text-text-3">
          {d.giftCount ? `${plural(d.giftCount, 'gift')} · ${formatMoney(d.totalGiven, { whole: true })}` : 'No gifts'}
          {d.lastGiftAt && ` · last ${formatDay(d.lastGiftAt)}`}
        </p>
      </div>
    </div>
  )
  return (
    <Card className="group transition-shadow hover:shadow-lift">
      <button type="button" onClick={onOpen} className="block w-full rounded-2xl p-4 text-left focus-visible:ring-2 focus-visible:ring-green/60 focus-visible:outline-none sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            {side(pair.a)}
            <ArrowLeftRight className="hidden size-4 shrink-0 text-text-3 sm:block" aria-hidden />
            {side(pair.b)}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 lg:w-[300px] lg:justify-end">
            <Confidence score={pair.score} />
            {pair.reasons.map((r) => (
              <Badge key={r} size="sm">
                {r}
              </Badge>
            ))}
          </div>
          <span className="hidden shrink-0 text-[13px] font-medium text-green lg:block">Compare →</span>
        </div>
      </button>
    </Card>
  )
}

/* ---------- the comparison ---------- */

type FieldKey = 'firstName' | 'lastName' | 'phone' | 'address'
type Pick = 'a' | 'b'

const addr = (x?: Address) => [x?.line1, [x?.suburb, x?.state, x?.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')

const FIELDS: { key: FieldKey; label: string; value: (d: CompareSide['donor']) => string }[] = [
  { key: 'firstName', label: 'First name', value: (d) => d.firstName },
  { key: 'lastName', label: 'Last name', value: (d) => d.lastName },
  { key: 'phone', label: 'Phone', value: (d) => d.phone ?? '' },
  { key: 'address', label: 'Address', value: (d) => addr(d.address) },
]

function CompareSheet({ a, b, onClose }: { a?: string; b?: string; onClose: () => void }) {
  const qc = useQueryClient()
  const nav = useNavigate()
  const confirm = useConfirm()
  const open = Boolean(a && b)
  const q = useQuery({
    queryKey: ['admin', 'donors', 'compare', a, b],
    queryFn: () => api.get<CompareResponse>('/admin/donors/duplicates/compare', { a, b }),
    enabled: open,
  })
  const [survivor, setSurvivor] = useState<Pick>('a')
  const [choice, setChoice] = useState<Record<FieldKey, Pick>>({ firstName: 'a', lastName: 'a', phone: 'a', address: 'a' })

  /* sensible defaults: the survivor's details, except where it has none and the other does */
  useEffect(() => {
    if (!q.data) return
    const next = {} as Record<FieldKey, Pick>
    for (const f of FIELDS) next[f.key] = f.value(q.data.a.donor) ? 'a' : f.value(q.data.b.donor) ? 'b' : 'a'
    setChoice(next)
    setSurvivor('a')
  }, [q.data])

  const done = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'donors'] })
    qc.invalidateQueries({ queryKey: ['admin', 'badges'] })
    qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
    onClose()
  }

  const merge = useMutation({
    mutationFn: (body: object) => api.post<{ id: string; moved: Record<string, number> }>('/admin/donors/merge', body),
    onSuccess: (r) => {
      const who = q.data ? donorName((survivor === 'a' ? q.data.a : q.data.b).donor) : 'the record'
      toast.success(`Merged. ${who} now has ${plural(r.moved.gifts, 'more gift')} on one record.`, {
        action: { label: 'Open', onClick: () => nav(`/admin/donors/${r.id}`) },
      })
      done()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const dismiss = useMutation({
    mutationFn: () => api.post('/admin/donors/duplicates/dismiss', { a, b }),
    onSuccess: () => {
      toast.success('Got it — this pair will not be suggested again')
      done()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const data = q.data
  const P = data ? (survivor === 'a' ? data.a : data.b) : null
  const S = data ? (survivor === 'a' ? data.b : data.a) : null
  const differing = useMemo(() => (data ? FIELDS.filter((f) => f.value(data.a.donor).trim().toLowerCase() !== f.value(data.b.donor).trim().toLowerCase()) : []), [data])

  const doMerge = async () => {
    if (!data || !P || !S) return
    const pName = donorName(P.donor)
    const sName = donorName(S.donor)
    const c = S.counts
    const moving = [
      c.gifts && plural(c.gifts, 'gift'),
      c.plans && plural(c.plans, 'regular gift'),
      c.enquiries && plural(c.enquiries, 'enquiry', 'enquiries'),
      c.fundraisers && plural(c.fundraisers, 'supporter page'),
      c.emails && plural(c.emails, 'email'),
    ].filter(Boolean)
    const ok = await confirm({
      title: `Merge into ${pName}?`,
      body: (
        <div className="space-y-2">
          <p>
            {sName} ({S.donor.number}) will be closed and {moving.length ? moving.join(', ') : 'their details'} moved to {pName} ({P.donor.number}). Receipts keep
            their numbers; {S.donor.email} is kept as another email address.
          </p>
          <p className="font-medium text-text">This cannot be undone.</p>
        </div>
      ),
      confirmLabel: 'Merge records',
      tone: 'danger',
      typeToConfirm: 'MERGE',
    })
    if (!ok) return
    const fields: Partial<Record<FieldKey, 'primary' | 'secondary'>> = {}
    for (const f of differing) fields[f.key] = choice[f.key] === survivor ? 'primary' : 'secondary'
    merge.mutate({ primary: P.donor.id, secondary: S.donor.id, fields })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => !v && onClose()}
      width={880}
      title="Compare and merge"
      description={data ? (data.reasons.length ? data.reasons.join(' · ') : 'Two records chosen by hand') : 'Loading both records…'}
      footer={
        data && P ? (
          <>
            <Button variant="ghost" icon={<UserX />} loading={dismiss.isPending} onClick={() => dismiss.mutate()} className="sm:mr-auto">
              Not the same person
            </Button>
            <Button variant="primary" icon={<GitMerge />} loading={merge.isPending} onClick={doMerge}>
              Merge into {donorName(P.donor)}
            </Button>
          </>
        ) : undefined
      }
    >
      {!data ? (
        <div className="grid h-64 place-items-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-5">
          {/* which record survives */}
          <div>
            <p className="mb-2 text-[13px] font-medium text-text">Which record should stay?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['a', 'b'] as Pick[]).map((k) => (
                <SideCard key={k} side={data[k]} selected={survivor === k} onSelect={() => setSurvivor(k)} />
              ))}
            </div>
            <p className="mt-2 text-[12.5px] text-text-3">The other record is closed and points here, so old links and sign-ins still work.</p>
          </div>

          {/* field by field */}
          <div>
            <p className="mb-2 text-[13px] font-medium text-text">Details</p>
            <div className="overflow-hidden rounded-xl ring-1 ring-line">
              {FIELDS.map((f) => {
                const va = f.value(data.a.donor)
                const vb = f.value(data.b.donor)
                const same = !differing.includes(f)
                return (
                  <div key={f.key} className="grid grid-cols-1 border-b border-line-2 last:border-0 sm:grid-cols-[120px_1fr_1fr]">
                    <div className="bg-paper-2 px-4 pt-3 pb-1 text-[12.5px] font-medium text-text-2 sm:py-3">{f.label}</div>
                    {same ? (
                      <div className="flex items-center gap-2 px-4 py-3 text-[13.5px] text-text sm:col-span-2">
                        {va || <span className="text-text-3">Neither has one</span>}
                        {va && <span className="text-[12px] text-text-3">· same on both</span>}
                      </div>
                    ) : (
                      (['a', 'b'] as Pick[]).map((k) => (
                        <ChoiceCell
                          key={k}
                          name={f.key}
                          value={k === 'a' ? va : vb}
                          selected={choice[f.key] === k}
                          onSelect={() => setChoice((c) => ({ ...c, [f.key]: k }))}
                        />
                      ))
                    )}
                  </div>
                )
              })}
              <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr]">
                <div className="bg-paper-2 px-4 pt-3 pb-1 text-[12.5px] font-medium text-text-2 sm:py-3">Emails</div>
                <div className="px-4 py-3 text-[13.5px] text-text">
                  <p className="[overflow-wrap:anywhere]">
                    {[...new Set([data.a.donor.email, ...data.a.donor.altEmails, data.b.donor.email, ...data.b.donor.altEmails])].join(', ')}
                  </p>
                  <p className="mt-0.5 text-[12px] text-text-3">All kept. Receipts go to {P!.donor.email}.</p>
                </div>
              </div>
            </div>
          </div>

          {/* what comes across */}
          <Callout tone="teal" icon={<Copy />} title="Kept from both records">
            Every gift and receipt, regular gifts, enquiries, supporter pages, emails sent, tags and bank payer names.
            {(data.a.donor.preferences.emailOptIn === false || data.b.donor.preferences.emailOptIn === false) &&
              ' One record had opted out of appeal emails, so the merged record stays opted out.'}
          </Callout>
        </div>
      )}
    </Sheet>
  )
}

function SideCard({ side, selected, onSelect }: { side: CompareSide; selected: boolean; onSelect: () => void }) {
  const d = side.donor
  const c = side.counts
  const stat = (label: string, value: ReactNode) => (
    <div>
      <dt className="text-[11.5px] text-text-3">{label}</dt>
      <dd className="nums text-[13.5px] font-medium text-text">{value}</dd>
    </div>
  )
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex flex-col rounded-xl p-4 text-left ring-1 ring-inset transition-all',
        selected ? 'bg-green-50 ring-2 ring-green' : 'bg-paper ring-line hover:ring-[#c9c9c2]',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={donorName(d)} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-text">{donorName(d)}</p>
          <p className="truncate text-[12.5px] text-text-3">
            <Link to={`/admin/donors/${d.id}`} target="_blank" onClick={(e) => e.stopPropagation()} className="hover:text-green hover:underline">
              {d.number}
            </Link>{' '}
            · since {formatDate(d.createdAt)}
          </p>
          <p className="truncate text-[12.5px] text-text-3">{d.email}</p>
        </div>
        <span className={cn('grid size-5 shrink-0 place-items-center rounded-full ring-1 ring-inset', selected ? 'bg-green text-white ring-green' : 'ring-[#c9c9c2]')}>
          {selected && <Check className="size-3" strokeWidth={3} />}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line-2 pt-3">
        {stat('Lifetime', formatMoney(c.lifetime, { whole: true }))}
        {stat('Gifts', formatNumber(c.gifts))}
        {stat('Regular', c.activePlans ? `${c.activePlans} active` : c.plans ? `${c.plans} ended` : 'None')}
      </dl>
      {side.recentGifts.length > 0 && (
        <p className="mt-2 truncate text-[12px] text-text-3">
          Last: {formatMoney(side.recentGifts[0]!.amount)} to {side.recentGifts[0]!.appealTitle ?? 'where most needed'}, {formatDay(side.recentGifts[0]!.date)}
        </p>
      )}
      {selected && <p className="mt-2 text-[12px] font-medium text-green">This record stays</p>}
    </button>
  )
}

function ChoiceCell({ name, value, selected, onSelect }: { name: string; value: string; selected: boolean; onSelect: () => void }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2.5 px-4 py-3 text-[13.5px] transition-colors',
        selected ? 'bg-green-50/70' : 'hover:bg-ink/[.02]',
      )}
    >
      <input type="radio" name={name} checked={selected} onChange={onSelect} className="mt-0.5 size-4 accent-[#2f6b5a]" />
      <span className={cn('min-w-0 [overflow-wrap:anywhere]', value ? 'text-text' : 'text-text-3')}>{value || 'None'}</span>
    </label>
  )
}
