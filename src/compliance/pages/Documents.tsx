import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Archive, BookOpenCheck, FileText, SearchX, Upload } from 'lucide-react'
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '../../../shared/domain'
import type { Page } from '../../../shared/types'
import { api } from '../../portal/api'
import { useCan } from '../../portal/session'
import {
  Badge, Button, Card, Checkbox, cn, EmptyState, PageHeader, Progress, SearchInput, Segmented, Skeleton, Toolbar, useDebounced,
  useDocumentTitle, useUrlState,
} from '../../portal/ui'
import { formatDay } from '../../portal/format'
import { Disclaimer, FileIcon } from '../components/bits'
import { UploadDialog } from '../components/UploadDialog'
import type { DocSummary } from '../components/types'

/* ---------------------------------------------------------------------------
   /compliance/documents — the document library.

   Documents that ask to be read and that I have not read yet come first, in
   their own row, because that is the one thing on this page that is mine to
   do. Every card says how many people have read the current version, so an
   out-of-date policy that nobody has confirmed is visible from here.

   ?upload=1 opens the upload dialog (the command palette links to it);
   ?category= is what the overview's standards map links to.
--------------------------------------------------------------------------- */

export default function Documents() {
  useDocumentTitle('Documents', 'Compliance')
  const canWrite = useCan('compliance.write')
  const nav = useNavigate()
  const [s, set] = useUrlState({ category: '', q: '', archived: '', upload: '' })
  const dq = useDebounced(s.q)
  const list = useQuery({
    queryKey: ['compliance', 'documents', { category: s.category, q: dq, archived: s.archived }],
    queryFn: () => api.get<Page<DocSummary>>('/compliance/documents', { category: s.category, q: dq, archived: s.archived }),
    placeholderData: (p) => p,
  })
  const docs = list.data?.items
  const toRead = docs?.filter((d) => d.toRead) ?? []
  const filtered = Boolean(s.q || s.category)
  const rest = docs && toRead.length && !filtered && !s.archived ? docs.filter((d) => !d.toRead) : docs

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Compliance', to: '/compliance' }, { label: 'Records' }]}
        title="Documents"
        description="The constitution, policies, partner agreements, lodgements and the auditor's report — every version kept, and who has read which."
        actions={
          canWrite && (
            <Button variant="primary" icon={<Upload />} onClick={() => set({ upload: '1' })}>
              Upload a document
            </Button>
          )
        }
      />

      {toRead.length > 0 && !filtered && !s.archived && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-text">
            <BookOpenCheck className="size-[18px] text-teal" />
            For you to read
            <span className="nums rounded-full bg-teal-pale px-1.5 text-[11px] font-medium text-teal">{toRead.length}</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {toRead.map((d) => (
              <DocCard key={d.id} d={d} />
            ))}
          </div>
        </section>
      )}

      <Toolbar className="mb-4">
        <Segmented
          aria-label="Category"
          className="w-full sm:w-auto"
          value={(s.category || 'all') as DocumentCategory | 'all'}
          onChange={(v) => set({ category: v === 'all' ? '' : v })}
          options={[{ value: 'all' as const, label: 'All' }, ...Object.entries(DOCUMENT_CATEGORIES).map(([value, label]) => ({ value: value as DocumentCategory, label }))]}
        />
        <SearchInput value={s.q} onChange={(q) => set({ q })} placeholder="Search documents" className="w-full sm:w-60" />
        <div className="sm:ml-auto">
          <Checkbox checked={s.archived === '1'} onChange={(v) => set({ archived: v ? '1' : '' })} label={<span className="text-[13px] font-normal text-text-2">Archived only</span>} />
        </div>
      </Toolbar>

      {!rest ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : rest.length ? (
        <div className={cn('grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3', list.isFetching && 'opacity-70')}>
          {rest.map((d) => (
            <DocCard key={d.id} d={d} />
          ))}
        </div>
      ) : (
        <Card>
          {filtered || s.archived ? (
            <EmptyState
              icon={s.archived ? <Archive /> : <SearchX />}
              title={s.archived ? 'Nothing archived' : 'No documents match'}
              action={<Button variant="secondary" onClick={() => set({ q: '', category: '', archived: '' })}>Show the whole library</Button>}
            >
              {s.archived ? 'Archived documents appear here, with all their versions.' : 'Try another word or category.'}
            </EmptyState>
          ) : docs && docs.length ? (
            <EmptyState compact icon={<BookOpenCheck />} title="That is everything">
              The only documents in the library are the ones for you to read, above.
            </EmptyState>
          ) : (
            <EmptyState icon={<FileText />} title="The library is empty" action={canWrite && <Button variant="primary" icon={<Upload />} onClick={() => set({ upload: '1' })}>Upload the first document</Button>}>
              Start with the constitution and the policies the board has adopted.
            </EmptyState>
          )}
        </Card>
      )}

      <Disclaimer />
      <UploadDialog open={s.upload === '1'} onClose={() => set({ upload: '' })} onDone={(id) => nav(`/compliance/documents/${id}`)} />
    </>
  )
}

function DocCard({ d }: { d: DocSummary }) {
  const n = d.latest?.n ?? 1
  return (
    <Link
      to={`/compliance/documents/${d.id}`}
      className={cn(
        'group relative flex min-w-0 flex-col rounded-2xl bg-paper p-5 ring-1 shadow-soft transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/60',
        d.toRead ? 'ring-teal/35' : 'ring-line/80',
      )}
    >
      {d.toRead && (
        <span className="absolute top-0 right-5 rounded-b-lg bg-teal px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white">To read</span>
      )}
      <div className="flex items-start gap-3">
        <FileIcon name={d.latest?.fileName} mime={d.latest?.mime} />
        <div className="min-w-0 flex-1 pr-12">
          <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold text-text group-hover:text-green">{d.title}</h3>
          <p className="mt-0.5 text-[12.5px] text-text-3">
            {DOCUMENT_CATEGORIES[d.category]} · v{n} · {formatDay(d.latest?.uploadedAt ?? d.updatedAt)}
          </p>
        </div>
      </div>
      {d.description && <p className="mt-3 line-clamp-2 text-[13px] leading-snug text-text-2">{d.description}</p>}
      <div className="mt-auto pt-4">
        {d.requiresAck ? (
          <>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-[12.5px]">
              <span className="text-text-2">
                <span className="nums font-medium text-text">{d.ackCount}</span> of <span className="nums">{d.staffCount}</span> have read v{n}
              </span>
              {d.ackedByMe && (
                <Badge tone="teal" size="sm">
                  You have
                </Badge>
              )}
            </div>
            <Progress value={d.ackCount} max={d.staffCount} tone="teal" size="sm" label={`${d.ackCount} of ${d.staffCount} have read it`} />
          </>
        ) : (
          <p className="text-[12.5px] text-text-3">For reference — no reading confirmation asked for</p>
        )}
      </div>
    </Link>
  )
}
