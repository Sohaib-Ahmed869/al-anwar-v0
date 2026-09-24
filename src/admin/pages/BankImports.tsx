import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Banknote, ChevronRight } from 'lucide-react'
import type { BankImport, Page } from '../../../shared/types'
import { api } from '../../portal/api'
import { formatDateTime, formatDay, plural } from '../../portal/format'
import { Badge, Card, CardHeader, DataTable, EmptyState, Money, PageHeader, Pagination, useDocumentTitle, type Column } from '../../portal/ui'
import { BankCountChips } from '../components/BankBits'
import { BankUploadZone, type BankUploadHandle } from '../components/BankUploadZone'

/* ---------------------------------------------------------------------------
   Admin › Bank import. The upload (the reason anyone opens this page) at the
   top, and every statement imported so far underneath, each with what is
   left to check — so an import someone started on Monday and did not finish
   is impossible to miss on Thursday.

   `?upload=1` (from the command palette, "Import a bank statement") scrolls
   to the drop zone and focuses it.
--------------------------------------------------------------------------- */

type Row = BankImport & { lineCount: number; savedTotal: number }

export default function BankImports() {
  useDocumentTitle('Bank import', 'Al-Anwaar Admin')
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') ?? 1) || 1
  const zone = useRef<BankUploadHandle>(null)
  const [highlight, setHighlight] = useState(false)

  const list = useQuery({
    queryKey: ['bank', 'imports', page],
    queryFn: () => api.get<Page<Row>>('/admin/bank/imports', { page, pageSize: 15 }),
    placeholderData: (prev) => prev,
  })

  useEffect(() => {
    if (params.get('upload') !== '1') return
    const t = setTimeout(() => {
      zone.current?.focus()
      setHighlight(true)
      setTimeout(() => setHighlight(false), 1800)
    }, 150)
    setParams((p) => {
      const n = new URLSearchParams(p)
      n.delete('upload')
      return n
    }, { replace: true })
    return () => clearTimeout(t)
  }, [params, setParams])

  const waiting = list.data?.items.filter((i) => i.status === 'review') ?? []

  const columns: Column<Row>[] = [
    {
      key: 'date',
      header: 'Uploaded',
      width: 150,
      cell: (r) => (
        <span className="block">
          <span className="block text-text">{formatDay(r.createdAt)}</span>
          <span className="block text-[12px] text-text-3">{formatDateTime(r.createdAt).split(', ')[1]}</span>
        </span>
      ),
    },
    {
      key: 'file',
      header: 'Statement',
      cell: (r) => (
        <span className="block min-w-0">
          <span className="block max-w-[320px] truncate font-medium text-text">{r.filename}</span>
          <span className="block text-[12px] text-text-3">
            {r.layout ?? 'CSV'} · by {r.uploadedByName}
          </span>
        </span>
      ),
    },
    {
      key: 'credits',
      header: 'Money in',
      align: 'right',
      cell: (r) => (
        <span className="block">
          <Money cents={r.credits} className="block font-medium text-text" />
          <span className="block text-[12px] text-text-3">{plural(r.lineCount, 'line')}</span>
        </span>
      ),
    },
    { key: 'counts', header: 'Lines', hideBelow: 'lg', cell: (r) => <BankCountChips counts={r.counts} /> },
    { key: 'status', header: 'Status', cell: (r) => <ImportStatus row={r} /> },
    { key: 'go', header: '', width: 40, align: 'right', cell: () => <ChevronRight className="ml-auto size-4 text-text-3 transition-transform group-hover:translate-x-0.5" /> },
  ]

  return (
    <>
      <PageHeader
        title="Bank import"
        description="Match bank transfers to donors and appeals from your statement, check them, and save them as gifts with receipts — in one sitting."
      />

      <BankUploadZone ref={zone} highlight={highlight} />

      <Card className="mt-6 overflow-hidden sm:mt-8">
        <CardHeader
          title="Statements imported"
          description={
            waiting.length
              ? `${plural(waiting.length, 'statement')} still ${waiting.length === 1 ? 'has' : 'have'} lines to check or save.`
              : 'Every statement uploaded, newest first. Open one to see what was saved.'
          }
        />
        <DataTable
          columns={columns}
          rows={list.data?.items}
          loading={list.isLoading || list.isFetching}
          rowKey={(r) => r.id}
          onRowClick={(r) => nav(`/admin/bank/${r.id}`)}
          mobile={(r) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-text">{r.filename}</p>
                <p className="mt-0.5 text-[12.5px] text-text-3">
                  {formatDay(r.createdAt)} · {r.uploadedByName} · {plural(r.lineCount, 'line')}
                </p>
                <BankCountChips className="mt-2" counts={r.counts} />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Money cents={r.credits} className="text-[14px] font-medium text-text" />
                <ImportStatus row={r} />
              </div>
            </div>
          )}
          empty={
            <EmptyState icon={<Banknote />} title="No statements imported yet">
              Upload your first statement above, or try the sample to see how matching works. Nothing is saved until you confirm.
            </EmptyState>
          }
        />
        {list.data && list.data.total > list.data.pageSize && (
          <Pagination
            page={page}
            pageSize={list.data.pageSize}
            total={list.data.total}
            onPage={(p) => setParams((prev) => {
              const n = new URLSearchParams(prev)
              if (p > 1) n.set('page', String(p))
              else n.delete('page')
              return n
            })}
          />
        )}
      </Card>
    </>
  )
}

function ImportStatus({ row }: { row: Row }) {
  if (row.status === 'completed') return <Badge tone="green" dot>Done</Badge>
  const left = (row.counts.matched ?? 0) + (row.counts.review ?? 0) + (row.counts.unmatched ?? 0)
  if (row.counts.confirmed) return <Badge tone="amber" dot>{left} left to do</Badge>
  return <Badge tone="amber" dot>To check</Badge>
}
