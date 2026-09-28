import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Inbox, Mail } from 'lucide-react'
import type { EmailMessage, Page } from '../../../shared/types'
import { api, errorMessage } from '../../portal/api'
import { formatDateTime, formatDay } from '../../portal/format'
import {
  Badge, Callout, Card, DataTable, DescriptionList, EmptyState, FormError, PageHeader, Pagination, SearchInput, Segmented, Select,
  Sheet, Skeleton, Toolbar, useDebounced, useDocumentTitle, useUrlState, type Column,
} from '../../portal/ui'

/* ---------------------------------------------------------------------------
   The email log — every email the platform has sent, so "did they get their
   receipt?" has an answer. Opening one shows it rendered, in a sandboxed
   iframe (no scripts, no same-origin), exactly as it was sent.

   In development, and anywhere no mail server is configured, nothing
   actually leaves: lib/email.ts keeps each message here instead, and the
   page says so at the top so nobody wonders why a donor did not get it.
--------------------------------------------------------------------------- */

type ListResponse = Page<Omit<EmailMessage, 'html'>> & { transport: 'smtp' | 'outbox'; templates: string[] }

const TEMPLATE_LABELS: Record<string, string> = {
  receipt: 'Receipt',
  otp: 'Sign-in code',
  campaign: 'Campaign',
  'campaign.test': 'Campaign test',
  'plan.notice': 'Payment heads-up',
  'plan.failed': 'Payment failed',
  'plan.changed': 'Regular donation changed',
  'tax.statement': 'Tax statement',
  'bank.instructions': 'Transfer details',
  'staff.invite': 'Staff invitation',
  'staff.reset': 'Password reset',
  'compliance.reminder': 'Compliance reminder',
  'fundraiser.live': 'Fundraiser approved',
  'fundraiser.changes': 'Fundraiser changes',
  'fundraiser.rejected': 'Fundraiser declined',
  'enquiry.reply': 'Enquiry reply',
}
const templateLabel = (t: string) => TEMPLATE_LABELS[t] ?? t

const TONE = { sent: 'green', queued: 'amber', failed: 'red' } as const
const STATUS_LABEL = { sent: 'Sent', queued: 'Sending', failed: 'Failed' }

export default function Emails() {
  useDocumentTitle('Email log', 'Admin')
  const [s, set] = useUrlState({ q: '', template: '', status: '', page: '1', open: '' })
  const q = useDebounced(s.q, 250)
  const list = useQuery({
    queryKey: ['admin', 'emails', { ...s, q, open: undefined }],
    queryFn: () => api.get<ListResponse>('/admin/emails', { q, template: s.template, status: s.status, page: s.page }),
    placeholderData: keepPreviousData,
  })

  const columns: Column<ListResponse['items'][number]>[] = [
    {
      key: 'to',
      header: 'To',
      width: '28%',
      cell: (m) => <span className="block max-w-[260px] truncate text-text">{m.to}</span>,
    },
    { key: 'subject', header: 'Subject', cell: (m) => <span className="line-clamp-1 text-text">{m.subject}</span> },
    { key: 'template', header: 'Kind', width: 170, hideBelow: 'lg', cell: (m) => <Badge size="sm">{templateLabel(m.template)}</Badge> },
    {
      key: 'status',
      header: 'Status',
      width: 100,
      cell: (m) => (
        <Badge tone={TONE[m.status]} dot size="sm">
          {STATUS_LABEL[m.status]}
        </Badge>
      ),
    },
    { key: 'at', header: 'When', align: 'right', width: 150, cell: (m) => <span className="text-[13px] whitespace-nowrap text-text-2" title={formatDateTime(m.createdAt)}>{formatDay(m.createdAt)}, {formatDateTime(m.createdAt).split(', ')[1]}</span> },
  ]

  return (
    <>
      <PageHeader title="Email log" description="Every email the platform has sent — receipts, sign-in codes, reminders and campaigns — and whether it went." />

      {list.data?.transport === 'outbox' && (
        <Callout tone="amber" icon={<Inbox />} title="No mail server is configured — emails are kept here instead of being sent" className="mb-5">
          Nothing leaves this machine until SMTP details are set on the server. Open any email below to read it exactly as the donor would.
        </Callout>
      )}

      <Toolbar className="mb-4">
        <SearchInput value={s.q} onChange={(v) => set({ q: v })} placeholder="Search by address or subject" className="w-full sm:w-72" />
        <div className="w-full sm:w-52">
          <Select value={s.template} onChange={(e) => set({ template: e.target.value })} aria-label="Kind of email">
            <option value="">Every kind</option>
            {list.data?.templates.map((t) => (
              <option key={t} value={t}>
                {templateLabel(t)}
              </option>
            ))}
          </Select>
        </div>
        <Segmented
          aria-label="Status"
          value={s.status}
          onChange={(v) => set({ status: v })}
          options={[
            { value: '', label: 'All' },
            { value: 'sent', label: 'Sent' },
            { value: 'failed', label: 'Failed' },
          ]}
        />
      </Toolbar>

      <Card className="overflow-hidden">
        <DataTable
          columns={columns}
          rows={list.data?.items}
          loading={list.isFetching && !list.data}
          rowKey={(m) => m.id}
          onRowClick={(m) => set({ open: m.id })}
          mobile={(m) => (
            <div>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate text-[14px] font-medium text-text">{m.subject}</p>
                <Badge tone={TONE[m.status]} dot size="sm">
                  {STATUS_LABEL[m.status]}
                </Badge>
              </div>
              <p className="mt-0.5 truncate text-[13px] text-text-2">{m.to}</p>
              <p className="mt-1 text-[12px] text-text-3">
                {templateLabel(m.template)} · {formatDay(m.createdAt)}
              </p>
            </div>
          )}
          empty={
            <EmptyState icon={<Mail />} title={s.q || s.template || s.status ? 'No emails match' : 'No emails yet'}>
              {s.q || s.template || s.status ? 'Try the whole address, or another kind.' : 'Receipts, sign-in codes and campaigns appear here as they are sent.'}
            </EmptyState>
          }
        />
        {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={(p) => set({ page: String(p) })} />}
      </Card>

      <EmailSheet id={s.open} onClose={() => set({ open: '' })} />
    </>
  )
}

function EmailSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const m = useQuery({ queryKey: ['admin', 'email', id], queryFn: () => api.get<EmailMessage>(`/admin/emails/${id}`), enabled: Boolean(id) })
  const e = m.data
  return (
    <Sheet open={Boolean(id)} onOpenChange={(v) => !v && onClose()} width={680} title={e?.subject ?? 'Email'} description={e ? `To ${e.to}` : undefined}>
      {m.isError ? (
        <FormError message={errorMessage(m.error)} />
      ) : !e ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-[420px] w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-5">
          <DescriptionList
            items={[
              { label: 'Kind', value: templateLabel(e.template) },
              {
                label: 'Status',
                value: (
                  <Badge tone={TONE[e.status]} dot size="sm">
                    {STATUS_LABEL[e.status]}
                    {e.transport === 'outbox' ? ' (kept here, not delivered)' : ''}
                  </Badge>
                ),
              },
              { label: 'Created', value: formatDateTime(e.createdAt) },
              { label: 'Sent', value: formatDateTime(e.sentAt), hidden: !e.sentAt },
              { label: 'Donor record', value: <Link to={`/admin/donors/${e.donor}`} className="font-medium text-green hover:underline">Open</Link>, hidden: !e.donor },
              { label: 'Campaign', value: <Link to={`/admin/campaigns/${e.campaign}`} className="font-medium text-green hover:underline">Open</Link>, hidden: !e.campaign },
            ]}
          />
          {e.error && <Callout tone="red" title="Why it failed">{e.error}</Callout>}
          <iframe title="The email as sent" sandbox="" srcDoc={e.html} className="h-[560px] w-full rounded-xl bg-[#F5F5F2] ring-1 ring-line" />
        </div>
      )}
    </Sheet>
  )
}
