import { useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { COUNTRIES, DESIGNATIONS, EMAIL_TOPICS, type Designation, type EmailTopic, type Segment } from '../../../shared/domain'
import type { Appeal, Page } from '../../../shared/types'
import { api } from '../../portal/api'
import { formatMoney, formatNumber, parseMoney } from '../../portal/format'
import { FilterChip, Input, MoneyInput, Segmented, Select, Skeleton, Switch, cn, useDebounced } from '../../portal/ui'

/* ---------------------------------------------------------------------------
   Who a campaign goes to: the audience builder, its live count, and the
   one-line description of a segment the campaign list uses.

   Every rule is optional and they AND together (lib/segments.ts on the
   server is the single source of truth). The count underneath is asked of
   the server a moment after the person stops changing things, so what it
   says is exactly who "Send now" would email — including the floor that
   only donors who said yes to email are ever counted.
--------------------------------------------------------------------------- */

export function useAppealOptions() {
  return useQuery({
    queryKey: ['appeal-options', true],
    queryFn: () => api.get<Page<Appeal>>('/admin/appeals', { pageSize: 200 }),
    staleTime: 60_000,
  })
}

export function describeSegment(s: Segment, appeals?: Appeal[]): string {
  const parts: string[] = []
  if (s.regular) parts.push('regular givers')
  if (s.activeMonths) parts.push(`gave in the last ${s.activeMonths} months`)
  if (s.lapsedMonths) parts.push(`no gift for ${s.lapsedMonths}+ months`)
  if (s.countries?.length) parts.push(`gave to ${s.countries.map((c) => COUNTRIES[c] ?? c).join(' or ')}`)
  if (s.appeals?.length) {
    const names = s.appeals.map((id) => appeals?.find((a) => a.id === id)?.title).filter(Boolean)
    parts.push(names.length === s.appeals.length && names.length <= 2 ? `gave to ${names.join(' or ')}` : `gave to ${s.appeals.length} chosen appeals`)
  }
  if (s.designations?.length) parts.push(`gave ${s.designations.map((d) => DESIGNATIONS[d].short.toLowerCase()).join(' or ')}`)
  if (s.minTotal) parts.push(`${formatMoney(s.minTotal)}+ lifetime`)
  if (s.topic) parts.push(`wants “${EMAIL_TOPICS[s.topic].toLowerCase()}”`)
  if (!parts.length) return 'Everyone who gets email'
  const t = parts.join(', ')
  return t[0]!.toUpperCase() + t.slice(1)
}

type Recency = 'any' | 'active' | 'lapsed'

export function CampaignAudience({ value, onChange, readOnly }: { value: Segment; onChange: (s: Segment) => void; readOnly?: boolean }) {
  const appeals = useAppealOptions()
  const recency: Recency = value.lapsedMonths ? 'lapsed' : value.activeMonths ? 'active' : 'any'
  const [minTotal, setMinTotal] = useState(value.minTotal ? String(value.minTotal / 100) : '')
  useEffect(() => setMinTotal(value.minTotal ? String(value.minTotal / 100) : ''), [value.minTotal])

  const patch = (p: Partial<Segment>) => {
    const next = { ...value, ...p }
    for (const k of Object.keys(next) as (keyof Segment)[]) {
      const v = next[k]
      if (v === undefined || v === false || (Array.isArray(v) && !v.length)) delete next[k]
    }
    onChange(next)
  }

  const debounced = useDebounced(JSON.stringify(value), 400)
  const count = useQuery({
    queryKey: ['admin', 'segment-count', debounced],
    queryFn: () => api.post<{ count: number; sample: string[] }>('/admin/campaigns/preview-segment', { segment: JSON.parse(debounced) }),
    staleTime: 30_000,
    placeholderData: (p) => p,
  })

  return (
    <div className="space-y-5">
      <fieldset disabled={readOnly} className="space-y-5 disabled:opacity-70">
        <Switch checked={Boolean(value.regular)} onChange={(v) => patch({ regular: v || undefined })} label="Regular givers only" description="Donors with a weekly, fortnightly or monthly gift running." />

        <Row label="When they last gave">
          <Segmented<Recency>
            value={recency}
            onChange={(r) => patch({ activeMonths: r === 'active' ? value.activeMonths || 12 : undefined, lapsedMonths: r === 'lapsed' ? value.lapsedMonths || 12 : undefined })}
            options={[
              { value: 'any', label: 'Any time' },
              { value: 'active', label: 'Recently' },
              { value: 'lapsed', label: 'Lapsed' },
            ]}
          />
          {recency !== 'any' && (
            <div className="mt-2.5 flex items-center gap-2 text-[13.5px] text-text-2">
              {recency === 'active' ? 'Gave in the last' : 'No gift for more than'}
              <Input
                type="number"
                min={1}
                max={120}
                value={(recency === 'active' ? value.activeMonths : value.lapsedMonths) ?? ''}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(120, Number(e.target.value) || 1))
                  patch(recency === 'active' ? { activeMonths: n } : { lapsedMonths: n })
                }}
                className="nums w-20"
                aria-label="Months"
              />
              months
            </div>
          )}
        </Row>

        <Row label="What they gave to" help="Donors with at least one paid gift matching every choice here.">
          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="Country"
              options={Object.entries(COUNTRIES).map(([k, v]) => ({ value: k, label: v }))}
              value={value.countries ?? []}
              onChange={(v) => patch({ countries: v })}
            />
            <FilterChip
              label="Appeal"
              options={(appeals.data?.items ?? []).map((a) => ({ value: a.id, label: a.title }))}
              value={value.appeals ?? []}
              onChange={(v) => patch({ appeals: v })}
            />
            <FilterChip<Designation>
              label="Given as"
              options={Object.entries(DESIGNATIONS).map(([k, v]) => ({ value: k as Designation, label: v.label }))}
              value={value.designations ?? []}
              onChange={(v) => patch({ designations: v })}
            />
          </div>
        </Row>

        <div className="grid gap-4 sm:grid-cols-2">
          <Row label="Lifetime giving at least">
            <MoneyInput
              value={minTotal}
              onChange={(e) => setMinTotal(e.target.value)}
              onBlur={() => {
                const c = parseMoney(minTotal)
                patch({ minTotal: minTotal.trim() && Number.isFinite(c) && c > 0 ? c : undefined })
              }}
              placeholder="Any amount"
            />
          </Row>
          <Row label="Asked to hear about">
            <Select value={value.topic ?? ''} onChange={(e) => patch({ topic: (e.target.value || undefined) as EmailTopic | undefined })}>
              <option value="">Any topic</option>
              {Object.entries(EMAIL_TOPICS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Row>
        </div>
      </fieldset>

      <div className="rounded-xl bg-green-50 p-4 ring-1 ring-green/10" aria-live="polite">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-paper text-green shadow-soft">
            <Users className="size-5" />
          </div>
          <div className="min-w-0">
            {count.data ? (
              <p className={cn('text-[15px] font-semibold text-text transition-opacity', count.isFetching && 'opacity-50')}>
                <span className="nums">{formatNumber(count.data.count)}</span> {count.data.count === 1 ? 'donor' : 'donors'}
              </p>
            ) : (
              <Skeleton className="h-5 w-24" />
            )}
            <p className="text-[12.5px] text-text-2">{describeSegment(value, appeals.data?.items)}. Only people who said yes to email are counted.</p>
          </div>
        </div>
        {count.data && count.data.sample.length > 0 && (
          <p className="mt-3 text-[12.5px] text-text-2">
            Including {count.data.sample.join(', ')}
            {count.data.count > count.data.sample.length ? ` and ${formatNumber(count.data.count - count.data.sample.length)} more` : ''}.
          </p>
        )}
      </div>
    </div>
  )
}

export function useSegmentCount(segment: Segment) {
  const key = JSON.stringify(segment)
  return useQuery({
    queryKey: ['admin', 'segment-count', key],
    queryFn: () => api.post<{ count: number; sample: string[] }>('/admin/campaigns/preview-segment', { segment }),
    staleTime: 30_000,
  })
}

function Row({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-text">{label}</p>
      {help && <p className="mt-0.5 text-[12.5px] text-text-3">{help}</p>}
      <div className="mt-2">{children}</div>
    </div>
  )
}
