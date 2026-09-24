import { useQuery } from '@tanstack/react-query'
import { MapPin, RotateCcw, UserMinus, UserPlus, Users } from 'lucide-react'
import { api } from '../../portal/api'
import { BarList } from '../../portal/charts'
import { formatMoney, formatNumber } from '../../portal/format'
import { Card, CardBody, CardHeader, Stat, type DateRange } from '../../portal/ui'
import { ReportCountChart, ReportLoading } from './ReportBits'

/* ---------------------------------------------------------------------------
   Reports › Donors: are we keeping the people who give? New, returning and
   reactivated donors per month, and the lapsed — those whose last gift was a
   year ago and who have not given since. Lapsed sits beside the others
   rather than stacked on them, because it is people lost, not people giving.

   Where donors live comes from their address, by state, for the gifts in the
   range — useful for deciding where to hold the next event.
--------------------------------------------------------------------------- */

type Donors = {
  active: number
  totals: { new: number; returning: number; reactivated: number; lapsed: number }
  months: { month: string; label: string; new: number; returning: number; reactivated: number; lapsed: number }[]
  byState: { key: string; label: string; donors: number; amount: number }[]
}

export function ReportDonors({ range }: { range: DateRange }) {
  const q = useQuery({
    queryKey: ['reports', 'donors', range],
    queryFn: () => api.get<Donors>('/admin/reports/donors', { ...range }),
    placeholderData: (prev) => prev,
  })
  const d = q.data
  if (!d) return <ReportLoading tiles={5} />
  return (
    <div className={q.isFetching ? 'space-y-5 opacity-70 transition-opacity' : 'space-y-5 transition-opacity'}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat icon={<Users />} label="Gave in this period" value={formatNumber(d.active)} hint="different donors" />
        <Stat icon={<UserPlus />} label="New" value={formatNumber(d.totals.new)} hint="first gift ever" />
        <Stat icon={<Users />} label="Returning" value={formatNumber(d.totals.returning)} hint="donor-months" />
        <Stat icon={<RotateCcw />} label="Came back" value={formatNumber(d.totals.reactivated)} hint="after a year or more" />
        <Stat icon={<UserMinus />} label="Lapsed" value={formatNumber(d.totals.lapsed)} hint="no gift for 12 months" />
      </div>

      <Card>
        <CardHeader
          title="New, returning and lapsed, month by month"
          description="Each donor counts once in a month. Lapsed: their last gift was twelve months before and nothing since."
        />
        <CardBody>
          <ReportCountChart
            data={d.months}
            xKey="label"
            series={[
              { key: 'new', label: 'New' },
              { key: 'returning', label: 'Returning' },
              { key: 'reactivated', label: 'Came back' },
              { key: 'lapsed', label: 'Lapsed', color: '#c94f2c' },
            ]}
            height={260}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon={<MapPin />} title="Where donors live" description="Donors who gave in this period, by the state on their address" />
        <CardBody>
          {d.byState.length ? (
            <BarList rows={d.byState.map((s) => ({ key: s.key, label: s.label, value: s.amount, sub: `· ${formatNumber(s.donors)} ${s.donors === 1 ? 'donor' : 'donors'}` }))} format={(v) => formatMoney(v, { whole: true })} />
          ) : (
            <p className="text-[13.5px] text-text-2">No gifts in these dates.</p>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
