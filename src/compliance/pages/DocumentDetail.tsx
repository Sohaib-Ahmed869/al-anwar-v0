import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, BookOpenCheck, Check, CheckCircle2, Download, ExternalLink, MoreHorizontal, Pencil, SearchX, Upload } from 'lucide-react'
import { ROLES, type Role } from '../../../shared/access'
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '../../../shared/domain'
import { api, ApiError, download, errorMessage } from '../../portal/api'
import { useCan } from '../../portal/session'
import {
  Avatar, Badge, Button, Callout, Card, CardHeader, cn, DataTable, DescriptionList, Dialog, EmptyState, Field, FormError, IconButton, Input,
  Menu, MenuItem, PageHeader, Progress, Select, Skeleton, Switch, Textarea, toast, useConfirm, useDocumentTitle, type Column,
} from '../../portal/ui'
import { formatDate, formatDateTime } from '../../portal/format'
import { Disclaimer, FileIcon, formatBytes } from '../components/bits'
import { UploadDialog } from '../components/UploadDialog'
import type { DocDetail } from '../components/types'

/* ---------------------------------------------------------------------------
   /compliance/documents/:id — one document: its versions, and who has read
   which.

   "I have read this" confirms the LATEST version only. Uploading a new
   version leaves everyone's earlier confirmations in place as history and
   asks them all again — the "Who has read what" table shows each person as
   current, on an older version, or not yet.

   Files open through the API (/api/compliance/documents/:id/file), which
   checks the session and logs every open.
--------------------------------------------------------------------------- */

const fileUrl = (id: string, v?: number) => `/api/compliance/documents/${id}/file${v ? `?v=${v}` : ''}`

export default function DocumentDetail() {
  const { id = '' } = useParams()
  const canWrite = useCan('compliance.write')
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [dialog, setDialog] = useState<'' | 'version' | 'edit'>('')
  const q = useQuery({ queryKey: ['compliance', 'document', id], queryFn: () => api.get<DocDetail>(`/compliance/documents/${id}`) })
  const d = q.data
  useDocumentTitle(d?.title, 'Compliance')
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['compliance', 'document', id] })
    qc.invalidateQueries({ queryKey: ['compliance', 'documents'] })
    qc.invalidateQueries({ queryKey: ['compliance', 'overview'] })
    qc.invalidateQueries({ queryKey: ['compliance', 'badges'] })
  }
  const ack = useMutation({
    mutationFn: () => api.post<{ version: number }>(`/compliance/documents/${id}/ack`),
    onSuccess: (r) => {
      invalidate()
      toast.success(`Thank you — recorded that you have read version ${r.version}`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const archive = useMutation({
    mutationFn: (verb: 'archive' | 'restore') => api.post(`/compliance/documents/${id}/${verb}`),
    onSuccess: (_r, verb) => {
      invalidate()
      toast.success(verb === 'archive' ? 'Archived' : 'Restored to the library')
    },
  })
  const [downloading, setDownloading] = useState<number | null>(null)
  const save = async (v: number) => {
    setDownloading(v)
    try {
      await download(`/compliance/documents/${id}/file`, { v, download: 1 })
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setDownloading(null)
    }
  }

  if (q.isError)
    return (
      <Card>
        <EmptyState icon={<SearchX />} title="This document could not be found">
          It may have been removed from the library.
        </EmptyState>
      </Card>
    )
  if (!d)
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )

  const n = d.latest?.n ?? 1
  const older = d.readers.filter((r) => r.version && !r.current).length

  const readerCols: Column<DocDetail['readers'][number]>[] = [
    {
      key: 'name',
      header: 'Person',
      cell: (r) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={r.name} size="sm" />
          <span>
            <span className="block font-medium text-text">{r.name}</span>
            <span className="block text-[12px] text-text-3">{ROLES[r.role as Role]?.label ?? r.role}</span>
          </span>
        </span>
      ),
    },
    { key: 'status', header: 'Has read', cell: (r) => <ReadStatus r={r} n={n} /> },
    { key: 'at', header: 'When', align: 'right', className: 'whitespace-nowrap text-text-2', cell: (r) => (r.at ? formatDate(r.at) : <span className="text-text-3">—</span>) },
  ]

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Compliance', to: '/compliance' }, { label: 'Documents', to: '/compliance/documents' }, { label: DOCUMENT_CATEGORIES[d.category] }]}
        title={d.title}
        description={d.description}
        meta={
          <>
            <Badge tone="teal">{DOCUMENT_CATEGORIES[d.category]}</Badge>
            <Badge>Version {n}</Badge>
            {d.requiresAck && <Badge tone="violet">Everyone confirms reading</Badge>}
            {d.archived && <Badge tone="amber">Archived</Badge>}
          </>
        }
        actions={
          <>
            <a href={fileUrl(d.id)} target="_blank" rel="noopener" className="inline-flex">
              <Button variant="secondary" icon={<ExternalLink />} tabIndex={-1}>
                Open
              </Button>
            </a>
            <Button variant="secondary" icon={<Download />} loading={downloading === n} onClick={() => save(n)}>
              Download
            </Button>
            {canWrite && (
              <>
                <Button variant="primary" icon={<Upload />} onClick={() => setDialog('version')}>
                  Upload a new version
                </Button>
                <Menu
                  trigger={
                    <IconButton label="More" variant="secondary">
                      <MoreHorizontal />
                    </IconButton>
                  }
                >
                  <MenuItem icon={<Pencil />} onSelect={() => setDialog('edit')}>
                    Edit details
                  </MenuItem>
                  {d.archived ? (
                    <MenuItem icon={<ArchiveRestore />} onSelect={() => archive.mutate('restore')}>
                      Restore to the library
                    </MenuItem>
                  ) : (
                    <MenuItem
                      icon={<Archive />}
                      onSelect={async () => {
                        if (
                          await confirm({
                            title: `Archive ${d.title}?`,
                            body: 'It leaves the library and nobody is asked to read it, but every version and every confirmation is kept. You can restore it at any time.',
                            confirmLabel: 'Archive',
                          })
                        )
                          archive.mutate('archive')
                      }}
                    >
                      Archive
                    </MenuItem>
                  )}
                </Menu>
              </>
            )}
          </>
        }
      />

      {d.requiresAck && !d.archived && (
        d.ackedByMe ? (
          <Callout tone="teal" icon={<CheckCircle2 />} className="mb-6" title={`You have read version ${n}`}>
            Recorded {formatDateTime(d.acks.find((a) => a.version === n && d.readers.some((r) => r.id === a.staff && r.current))?.at)}.
          </Callout>
        ) : (
          <Callout
            tone="teal"
            icon={<BookOpenCheck />}
            className="mb-6"
            title={d.myAckVersion ? `Version ${n} has changed since you read version ${d.myAckVersion}` : 'Please read this document'}
            action={
              <Button variant="primary" icon={<Check />} loading={ack.isPending} onClick={() => ack.mutate()}>
                I have read this
              </Button>
            }
          >
            Open it, read it through, then confirm. Your confirmation is recorded against version {n} with the date.
          </Callout>
        )
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Versions" description="Every file ever uploaded, newest first. Earlier versions are never overwritten." />
            <ol className="relative px-5 pb-5 sm:px-6 sm:pb-6">
              {d.versions.map((v, i) => (
                <li key={v.n} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < d.versions.length - 1 && <span className="absolute top-11 bottom-0 left-5 w-px bg-line" aria-hidden />}
                  <FileIcon name={v.fileName} mime={v.mime} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-text">Version {v.n}</span>
                      {i === 0 && (
                        <Badge tone="teal" size="sm">
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-text-2">{v.fileName}</p>
                    <p className="mt-0.5 text-[12.5px] text-text-3">
                      {v.uploadedByName} · {formatDate(v.uploadedAt)} · {formatBytes(v.size)}
                    </p>
                    {v.note && <p className="mt-2 rounded-lg bg-paper-2 px-3 py-2 text-[13px] text-text-2">{v.note}</p>}
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    <a href={fileUrl(d.id, v.n)} target="_blank" rel="noopener" className="grid size-9 place-items-center rounded-lg text-text-2 hover:bg-ink/5 hover:text-text" aria-label={`Open version ${v.n}`} title="Open">
                      <ExternalLink className="size-4" />
                    </a>
                    <IconButton label={`Download version ${v.n}`} size="sm" loading={downloading === v.n} onClick={() => save(v.n)}>
                      <Download />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Who has read what"
              description={
                d.requiresAck
                  ? `${d.ackCount} of ${d.staffCount} staff have confirmed version ${n}${older ? `; ${older} read an older version` : ''}.`
                  : 'This document does not ask for reading confirmations. Any given are listed.'
              }
            />
            {d.requiresAck && (
              <div className="px-5 pb-4 sm:px-6">
                <Progress value={d.ackCount} max={d.staffCount} tone="teal" label="Read the current version" />
              </div>
            )}
            <DataTable
              columns={readerCols}
              rows={d.readers}
              rowKey={(r) => r.id}
              dense
              mobile={(r) => (
                <div className="flex items-center gap-3">
                  <Avatar name={r.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-text">{r.name}</p>
                    <p className="text-[12px] text-text-3">{r.at ? formatDate(r.at) : ROLES[r.role as Role]?.label}</p>
                  </div>
                  <ReadStatus r={r} n={n} />
                </div>
              )}
              empty={<p className="px-6 pb-6 text-[13.5px] text-text-2">No active staff.</p>}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="About this document" />
            <div className="px-5 pb-4 sm:px-6">
              <DescriptionList
                items={[
                  { label: 'Category', value: DOCUMENT_CATEGORIES[d.category] },
                  { label: 'Current version', value: `v${n}` },
                  { label: 'File', value: d.latest?.fileName ?? '—' },
                  { label: 'Size', value: formatBytes(d.latest?.size) },
                  { label: 'Last uploaded', value: `${formatDate(d.latest?.uploadedAt)}` },
                  { label: 'Uploaded by', value: d.latest?.uploadedByName ?? '—' },
                  { label: 'In the library since', value: formatDate(d.createdAt) },
                  { label: 'Reading confirmation', value: d.requiresAck ? 'Asked of everyone' : 'Not asked' },
                ]}
              />
            </div>
          </Card>
          <Card className="p-5 sm:p-6">
            <p className="text-[13px] leading-relaxed text-text-2">
              Opening or downloading any version is recorded in the audit trail with your name and the time, so the library can always show who
              has had a copy of what.
            </p>
          </Card>
        </div>
      </div>

      <Disclaimer />

      <UploadDialog open={dialog === 'version'} onClose={() => setDialog('')} version={{ id: d.id, title: d.title, next: n + 1, requiresAck: d.requiresAck }} />
      <EditDialog open={dialog === 'edit'} onClose={() => setDialog('')} d={d} onSaved={invalidate} />
    </>
  )
}

function ReadStatus({ r, n }: { r: DocDetail['readers'][number]; n: number }) {
  if (r.current)
    return (
      <Badge tone="teal" className="[&_svg]:size-3.5">
        <Check /> v{n}
      </Badge>
    )
  if (r.version) return <Badge tone="amber">Older version (v{r.version})</Badge>
  return <Badge>Not yet</Badge>
}

function EditDialog({ open, onClose, d, onSaved }: { open: boolean; onClose: () => void; d: DocDetail; onSaved: () => void }) {
  const [f, setF] = useState({ title: d.title, category: d.category, description: d.description ?? '', requiresAck: d.requiresAck })
  useEffect(() => {
    if (open) setF({ title: d.title, category: d.category, description: d.description ?? '', requiresAck: d.requiresAck })
  }, [open, d])
  const save = useMutation({
    mutationFn: () => api.patch(`/compliance/documents/${d.id}`, { ...f, description: f.description || null }),
    onSuccess: () => {
      onSaved()
      toast.success('Details saved')
      onClose()
    },
  })
  const err = save.error instanceof ApiError ? save.error : null
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Edit details"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="doc-edit" loading={save.isPending} disabled={f.title.trim().length < 2}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="doc-edit"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        {err && !Object.keys(err.fields).length && <FormError message={err.message} />}
        <Field label="Title" error={err?.fields.title}>
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="Category">
          <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as DocumentCategory })} className="read-only:bg-paper">
            {Object.entries(DOCUMENT_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description" optional>
          <Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <div className={cn('rounded-xl bg-paper-2 p-3.5')}>
          <Switch
            checked={f.requiresAck}
            onChange={(v) => setF({ ...f, requiresAck: v })}
            label="Ask everyone to confirm they have read it"
            description="Turning this on puts it under “To read” for everyone who has not confirmed the current version."
          />
        </div>
      </form>
    </Dialog>
  )
}
