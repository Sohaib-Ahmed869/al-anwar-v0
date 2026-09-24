import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Check, Copy, ExternalLink, Link2, Lock, Plus, Rocket, RotateCcw, Trash2, Undo2 } from 'lucide-react'
import { FREQUENCIES, type AppealStatus, type FundraiserStatus } from '../../../shared/domain'
import type { Appeal } from '../../../shared/types'
import { MoneyColumnChart } from '../../portal/charts'
import { api, errorMessage } from '../../portal/api'
import { formatDate, formatDay, formatMoney, formatNumber, parseMoney, toInputDate } from '../../portal/format'
import {
  Button, Card, CardBody, CardHeader, Dialog, EmptyState, Field, FormError, IconButton, Input, MoneyInput, Money, Progress,
  Select, StatusBadge, Textarea, toast, useConfirm,
} from '../../portal/ui'

/* ---------------------------------------------------------------------------
   The right-hand column of the appeal editor: where it stands (status), how
   it is doing (performance), how people get to it (links), what donors have
   been told since (updates), and the supporter pages raising for it.

   Each panel saves on its own — changing the status or posting an update
   does not need the form on the left to be saved first, and never saves it
   by accident either.
--------------------------------------------------------------------------- */

export type AppealDetail = {
  appeal: Appeal & { raisedLast30: number }
  daily: { date: string; total: number; count: number }[]
  giftsLast30: number
  recentGifts: { id: string; number: string; donor: string; donorName: string; amount: number; designation: string; date: string; anonymous: boolean; fundraiserTitle?: string }[]
  designations: { designation: string; label: string; total: number; count: number }[]
  fundraisers: { id: string; title: string; slug: string; ownerName: string; status: FundraiserStatus; raised: number; target: number; donorCount: number }[]
}

const siteUrl = (path: string) => `${window.location.origin}${path}`

function useAppealAction(id: string) {
  const qc = useQueryClient()
  return (a: Appeal) => {
    qc.setQueryData<AppealDetail>(['admin', 'appeal', id], (d) => (d ? { ...d, appeal: { ...d.appeal, ...a } } : d))
    qc.invalidateQueries({ queryKey: ['admin', 'appeals'] })
    qc.invalidateQueries({ queryKey: ['appeal-options'] })
  }
}

/* ---------- status ---------- */
const STATUS_COPY: Record<AppealStatus, string> = {
  draft: 'Only the team can see it. Nobody can give to it yet.',
  open: 'On the website and taking gifts.',
  closed: 'No new gifts. The page stays up with its total and updates, and every gift stays in the reports.',
}

export function AppealStatusCard({ appeal, dirty }: { appeal: Appeal; dirty: boolean }) {
  const confirm = useConfirm()
  const apply = useAppealAction(appeal.id)
  const m = useMutation({
    mutationFn: (status: AppealStatus) => api.post<Appeal>(`/admin/appeals/${appeal.id}/status`, { status }),
    onSuccess: (a) => {
      apply(a)
      toast.success(a.status === 'open' ? 'The appeal is open for gifts' : a.status === 'closed' ? 'Appeal closed. Its page and history stay.' : 'Back to draft')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const go = async (status: AppealStatus) => {
    if (status === 'closed') {
      const ok = await confirm({
        title: `Close “${appeal.title}”?`,
        body: 'No new gifts can be made to it from the moment you close it. Its page stays on the website with the total raised and its updates, and every gift already given stays against it in the reports. You can reopen it later.',
        confirmLabel: 'Close the appeal',
      })
      if (!ok) return
    }
    if (status === 'open' && appeal.status === 'draft') {
      const ok = await confirm({
        title: 'Open this appeal?',
        body: `“${appeal.title}” will appear on the website and start taking gifts straight away.${dirty ? ' Your unsaved edits on the left are not included — save them first if they should go live too.' : ''}`,
        confirmLabel: 'Open it',
      })
      if (!ok) return
    }
    m.mutate(status)
  }
  return (
    <Card>
      <CardHeader title="Status" action={<StatusBadge kind="appeal" value={appeal.status} />} />
      <CardBody className="space-y-3">
        <p className="text-[13px] leading-relaxed text-text-2">{STATUS_COPY[appeal.status]}</p>
        {appeal.status === 'draft' && (
          <Button variant="primary" className="w-full" icon={<Rocket />} loading={m.isPending} onClick={() => go('open')}>
            Open the appeal
          </Button>
        )}
        {appeal.status === 'open' && (
          <Button variant="secondary" className="w-full" icon={<Lock />} loading={m.isPending} onClick={() => go('closed')}>
            Close the appeal
          </Button>
        )}
        {appeal.status === 'closed' && (
          <Button variant="secondary" className="w-full" icon={<RotateCcw />} loading={m.isPending} onClick={() => go('open')}>
            Reopen it
          </Button>
        )}
        {appeal.status === 'open' && appeal.raised === 0 && (
          <button type="button" onClick={() => go('draft')} className="inline-flex items-center gap-1.5 text-[12.5px] text-text-2 hover:text-text">
            <Undo2 className="size-3.5" /> Take it back to draft
          </button>
        )}
      </CardBody>
    </Card>
  )
}

/* ---------- performance ---------- */
export function AppealPerformanceCard({ d }: { d: AppealDetail }) {
  const a = d.appeal
  const weeks = useMemo(() => {
    const out: { week: string; total: number }[] = []
    for (let i = d.daily.length % 7; i < d.daily.length; i += 7) {
      const slice = d.daily.slice(i, i + 7)
      out.push({ week: slice[0]!.date, total: slice.reduce((s, x) => s + x.total, 0) })
    }
    return out
  }, [d.daily])
  const pct = a.target ? Math.round((a.raised / a.target) * 100) : null
  return (
    <Card>
      <CardHeader title="How it is doing" description="Paid gifts only. Pending transfers count once they arrive." />
      <CardBody>
        <div className="flex items-baseline justify-between gap-3">
          <Money cents={a.raised} className="text-[26px] font-semibold tracking-[-0.02em] text-text" />
          <span className="nums text-[13px] text-text-2">{a.target ? `of ${formatMoney(a.target)} · ${pct}%` : 'no target set'}</span>
        </div>
        {a.target > 0 && <Progress value={a.raised} max={a.target} className="mt-2.5" label="Raised against target" />}
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-paper-2 px-3 py-2.5">
            <dt className="text-[12px] text-text-2">Donors</dt>
            <dd className="nums mt-0.5 text-[16px] font-semibold text-text">{formatNumber(a.donorCount)}</dd>
          </div>
          <div className="rounded-xl bg-paper-2 px-3 py-2.5">
            <dt className="text-[12px] text-text-2">Last 30 days</dt>
            <dd className="nums mt-0.5 text-[16px] font-semibold text-text">
              {formatMoney(a.raisedLast30, { whole: true })}
              <span className="ml-1 text-[12px] font-normal text-text-3">· {d.giftsLast30} gifts</span>
            </dd>
          </div>
        </dl>
        <p className="mt-5 mb-1 text-[12.5px] font-medium text-text-2">Raised each week, last 13 weeks</p>
        <MoneyColumnChart data={weeks} xKey="week" series={[{ key: 'total', label: 'Raised' }]} height={150} formatX={(v) => format(new Date(v), 'd MMM')} />
        {d.designations.length > 0 && (
          <>
            <p className="mt-5 mb-2 text-[12.5px] font-medium text-text-2">Given as</p>
            <ul className="space-y-1.5">
              {d.designations.slice(0, 5).map((x) => (
                <li key={x.designation} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="flex items-center gap-2">
                    <StatusBadge kind="designation" value={x.designation} size="sm" />
                    <span className="nums text-text-3">{formatNumber(x.count)} gifts</span>
                  </span>
                  <Money cents={x.total} className="text-text" />
                </li>
              ))}
            </ul>
          </>
        )}
        {d.recentGifts.length > 0 && (
          <>
            <p className="mt-5 mb-1 text-[12.5px] font-medium text-text-2">Latest gifts</p>
            <ul className="divide-y divide-line-2">
              {d.recentGifts.slice(0, 5).map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <Link to={`/admin/donors/${g.donor}`} className="min-w-0 truncate text-text hover:text-green">
                    {g.donorName}
                    {g.anonymous && <span className="ml-1 text-text-3">(anonymous)</span>}
                  </Link>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-[12px] text-text-3">{formatDay(g.date)}</span>
                    <Money cents={g.amount} className="font-medium" />
                  </span>
                </li>
              ))}
            </ul>
            <Link to={`/admin/gifts?appeal=${a.id}`} className="mt-2 inline-block text-[13px] font-medium text-green hover:underline">
              All gifts to this appeal
            </Link>
          </>
        )}
      </CardBody>
    </Card>
  )
}

/* ---------- links ---------- */
export function AppealLinksCard({ appeal }: { appeal: Appeal }) {
  const [amount, setAmount] = useState(appeal.suggested[0] ? String(appeal.suggested[0].amount / 100) : '')
  const [freq, setFreq] = useState<'once' | keyof typeof FREQUENCIES>('once')
  const [copied, setCopied] = useState<string | null>(null)
  const pageUrl = siteUrl(`/appeals/${appeal.slug}`)
  const cents = parseMoney(amount)
  const params = new URLSearchParams({ appeal: appeal.slug })
  if (amount && Number.isFinite(cents) && cents > 0) params.set('amount', String(cents / 100))
  if (freq !== 'once') params.set('frequency', freq)
  const giveUrl = siteUrl(`/give?${params.toString()}`)
  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1600)
    } catch {
      toast.error('Your browser would not copy it. Select the link and copy it by hand.')
    }
  }
  return (
    <Card>
      <CardHeader title="Links" description="For emails, social posts and QR codes." icon={<Link2 />} />
      <CardBody className="space-y-4">
        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-text-2">The appeal page</p>
          <div className="flex items-center gap-1.5">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-paper-2 px-2.5 py-2 text-[12.5px] text-text">{pageUrl}</code>
            <IconButton label="Copy the page link" size="sm" onClick={() => copy(pageUrl, 'page')}>
              {copied === 'page' ? <Check className="text-green" /> : <Copy />}
            </IconButton>
            {appeal.status !== 'draft' && (
              <a href={pageUrl} target="_blank" rel="noreferrer" className="grid size-8 place-items-center rounded-lg text-text-2 hover:bg-ink/5 hover:text-text" aria-label="Open the appeal page">
                <ExternalLink className="size-4" />
              </a>
            )}
          </div>
          {appeal.status === 'draft' && <p className="mt-1 text-[12px] text-text-3">Live once the appeal is open.</p>}
        </div>
        <div className="border-t border-line-2 pt-4">
          <p className="text-[12.5px] font-medium text-text-2">A campaign link straight to the give form</p>
          <p className="mb-2.5 text-[12px] text-text-3">The amount and frequency arrive filled in; the donor can still change them.</p>
          <div className="grid grid-cols-2 gap-2">
            <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Any" aria-label="Amount" />
            <Select value={freq} onChange={(e) => setFreq(e.target.value as typeof freq)} aria-label="Frequency">
              <option value="once">One-off</option>
              {Object.entries(FREQUENCIES).map(([k, f]) => (
                <option key={k} value={k}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <code className="min-w-0 flex-1 rounded-lg bg-paper-2 px-2.5 py-2 text-[12.5px] break-all text-text">{giveUrl}</code>
            <IconButton label="Copy the campaign link" size="sm" onClick={() => copy(giveUrl, 'give')}>
              {copied === 'give' ? <Check className="text-green" /> : <Copy />}
            </IconButton>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

/* ---------- updates ---------- */
export function AppealUpdatesCard({ appeal }: { appeal: Appeal }) {
  const confirm = useConfirm()
  const apply = useAppealAction(appeal.id)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', date: toInputDate(new Date()) })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const post = useMutation({
    mutationFn: () => api.post<Appeal>(`/admin/appeals/${appeal.id}/updates`, form),
    onSuccess: (a) => {
      apply(a)
      setOpen(false)
      setForm({ title: '', body: '', date: toInputDate(new Date()) })
      toast.success('Update posted on the appeal page')
    },
    onError: (e) => {
      setErrors((e as { fields?: Record<string, string> }).fields ?? {})
      setFormError(errorMessage(e))
    },
  })
  const remove = useMutation({
    mutationFn: (uid: string) => api.del<Appeal>(`/admin/appeals/${appeal.id}/updates/${uid}`),
    onSuccess: (a) => {
      apply(a)
      toast.success('Update removed')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <Card>
      <CardHeader
        title="Updates"
        description="News for donors, shown on the appeal page, newest first."
        action={
          <Button size="sm" variant="secondary" icon={<Plus />} onClick={() => (setErrors({}), setFormError(null), setOpen(true))}>
            Post an update
          </Button>
        }
      />
      <CardBody>
        {appeal.updates.length === 0 ? (
          <EmptyState compact title="No updates yet">
            Tell donors what their money has done — a delivery, a photo, a number. Appeals with updates keep raising.
          </EmptyState>
        ) : (
          <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-line">
            {appeal.updates.map((u) => (
              <li key={u.id} className="relative pl-6">
                <span className="absolute top-1.5 left-0 size-[11px] rounded-full bg-paper ring-2 ring-green" aria-hidden />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] text-text-3">{formatDate(u.date)}</p>
                    <p className="mt-0.5 text-[14px] font-medium text-text">{u.title}</p>
                  </div>
                  <IconButton
                    label="Remove this update"
                    size="xs"
                    loading={remove.isPending && remove.variables === u.id}
                    onClick={async () => {
                      if (await confirm({ title: 'Remove this update?', body: `“${u.title}” comes off the appeal page. This cannot be undone.`, confirmLabel: 'Remove', tone: 'danger' })) remove.mutate(u.id)
                    }}
                  >
                    <Trash2 />
                  </IconButton>
                </div>
                <p className="mt-1 line-clamp-4 text-[13px] leading-relaxed whitespace-pre-line text-text-2">{u.body}</p>
              </li>
            ))}
          </ol>
        )}
      </CardBody>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Post an update"
        description={`It appears on the “${appeal.title}” page for everyone to read.`}
        dismissible={!post.isPending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={post.isPending} disabled={!form.title.trim() || !form.body.trim()} onClick={() => post.mutate()}>
              Post update
            </Button>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            post.mutate()
          }}
        >
          <FormError message={Object.keys(errors).length ? null : formError} />
          <Field label="Headline" error={errors.title}>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. 400 food packs delivered in Tripoli" autoFocus maxLength={120} />
          </Field>
          <Field label="Date" help="Usually today. Back-date it if it records something that already happened.">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="sm:w-48" />
          </Field>
          <Field label="What happened" error={errors.body}>
            <Textarea rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Plain words, a few sentences. What was done, where, and for how many people." />
          </Field>
          <button type="submit" hidden />
        </form>
      </Dialog>
    </Card>
  )
}

/* ---------- supporter pages ---------- */
export function AppealFundraisersCard({ rows }: { rows: AppealDetail['fundraisers'] }) {
  if (!rows.length) return null
  return (
    <Card>
      <CardHeader title="Supporter pages" description="Raising for this appeal. Their gifts are in the total above." />
      <CardBody>
        <ul className="divide-y divide-line-2">
          {rows.map((f) => (
            <li key={f.id} className="py-2.5">
              <Link to={`/admin/fundraisers?open=${f.id}`} className="group block">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-[13.5px] font-medium text-text group-hover:text-green">{f.title}</span>
                  <StatusBadge kind="fundraiser" value={f.status} size="sm" />
                </div>
                <p className="nums mt-0.5 text-[12.5px] text-text-2">
                  {f.ownerName} · {formatMoney(f.raised)} of {formatMoney(f.target)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}
