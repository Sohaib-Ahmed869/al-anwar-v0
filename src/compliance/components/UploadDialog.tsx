import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UploadCloud, X } from 'lucide-react'
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '../../../shared/domain'
import { api, ApiError } from '../../portal/api'
import { Button, cn, Dialog, Field, FormError, Input, Select, Switch, Textarea, toast } from '../../portal/ui'
import { FileIcon, formatBytes } from './bits'

/* ---------------------------------------------------------------------------
   Putting a file in the library: a new document, or a new version of one.

   Drag a file onto the box or choose it; the title is suggested from the
   file name so the common case is drop, check, upload. The 20 MB limit and
   the allowed types are checked here for a quick answer and again on the
   server, which is the one that counts.
--------------------------------------------------------------------------- */

const MAX = 20 * 1024 * 1024
const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.odt,.ods,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.md'

const titleFrom = (name: string) =>
  name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase())

export function UploadDialog({
  open,
  onClose,
  version,
  onDone,
}: {
  open: boolean
  onClose: () => void
  /** upload a new version of this document instead of a new document */
  version?: { id: string; title: string; next: number; requiresAck: boolean }
  onDone?: (id: string) => void
}) {
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [drag, setDrag] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<DocumentCategory>('policy')
  const [description, setDescription] = useState('')
  const [requiresAck, setRequiresAck] = useState(false)
  const [note, setNote] = useState('')
  const [fileError, setFileError] = useState('')

  useEffect(() => {
    if (!open) return
    setFile(null)
    setTitle('')
    setDescription('')
    setNote('')
    setRequiresAck(false)
    setFileError('')
  }, [open])

  const pick = (f: File | undefined | null) => {
    if (!f) return
    if (f.size > MAX) {
      setFileError(`${f.name} is ${formatBytes(f.size)}. Files can be up to 20 MB.`)
      return
    }
    setFileError('')
    setFile(f)
    if (!version && !title) setTitle(titleFrom(f.name))
  }

  const up = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('file', file!)
      if (version) {
        if (note.trim()) fd.append('note', note.trim())
        return api.upload<{ n: number }>(`/compliance/documents/${version.id}/versions`, fd).then(() => ({ id: version.id }))
      }
      fd.append('title', title.trim())
      fd.append('category', category)
      if (description.trim()) fd.append('description', description.trim())
      fd.append('requiresAck', String(requiresAck))
      return api.upload<{ id: string }>('/compliance/documents', fd)
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['compliance', 'documents'] })
      qc.invalidateQueries({ queryKey: ['compliance', 'document'] })
      qc.invalidateQueries({ queryKey: ['compliance', 'overview'] })
      qc.invalidateQueries({ queryKey: ['compliance', 'badges'] })
      toast.success(version ? `Version ${version.next} of ${version.title} uploaded` : `${title.trim()} is in the library`)
      onDone?.(r.id)
      onClose()
    },
  })
  const err = up.error instanceof ApiError ? up.error : null
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!file) return setFileError('Choose a file to upload.')
    up.mutate()
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDrag(false)
    pick(e.dataTransfer.files?.[0])
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      dismissible={false}
      title={version ? `Upload version ${version.next}` : 'Upload a document'}
      description={
        version
          ? `The earlier versions stay in the history.${version.requiresAck ? ' Everyone will be asked to read it again.' : ''}`
          : 'Policies, partner agreements, lodgements and reports — kept with every version and a record of who has read them.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="upload-form" loading={up.isPending} disabled={!file || (!version && title.trim().length < 2)}>
            Upload
          </Button>
        </>
      }
    >
      <form id="upload-form" onSubmit={submit} className="space-y-4">
        {err && !Object.keys(err.fields).length && <FormError message={err.message} />}
        {file ? (
          <div className="flex items-center gap-3 rounded-xl bg-paper-2 p-3 ring-1 ring-line-2">
            <FileIcon name={file.name} mime={file.type} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-text">{file.name}</p>
              <p className="text-[12.5px] text-text-3">{formatBytes(file.size)}</p>
            </div>
            <button type="button" onClick={() => setFile(null)} className="grid size-8 place-items-center rounded-lg text-text-3 hover:bg-ink/5 hover:text-text" aria-label="Choose a different file">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => (e.preventDefault(), setDrag(true))}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors',
              drag ? 'border-teal bg-teal-pale/60' : 'border-line bg-paper-2/60',
            )}
          >
            <span className="grid size-11 place-items-center rounded-full bg-teal-pale text-teal">
              <UploadCloud className="size-5" />
            </span>
            <p className="mt-3 text-[14px] font-medium text-text">
              <span className="hidden sm:inline">Drop the file here, or </span>
              <button type="button" onClick={() => input.current?.click()} className="font-semibold text-green underline-offset-2 hover:underline">
                <span className="sm:hidden">Choose a file</span>
                <span className="hidden sm:inline">choose one</span>
              </button>
            </p>
            <p className="mt-1 text-[12.5px] text-text-3">PDF, Word, Excel, PowerPoint, text or images · up to 20 MB</p>
          </div>
        )}
        <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => pick(e.target.files?.[0])} />
        {(fileError || err?.fields.file) && <p className="text-[12.5px] text-red" role="alert">{fileError || err?.fields.file}</p>}

        {version ? (
          <Field label="What changed" optional help="Shown in the version history, e.g. “Re-adopted by the board, 14 October”.">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        ) : (
          <>
            <Field label="Title" error={err?.fields.title}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Conflict of interest policy" />
            </Field>
            <Field label="Category" error={err?.fields.category}>
              <Select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)} className="read-only:bg-paper">
                {Object.entries(DOCUMENT_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Description" optional>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Adopted by the board on 1 August 2026." />
            </Field>
            <div className="rounded-xl bg-paper-2 p-3.5">
              <Switch
                checked={requiresAck}
                onChange={setRequiresAck}
                label="Ask everyone to confirm they have read it"
                description="Staff see it under “To read” until they press “I have read this”, and you can see who has."
              />
            </div>
          </>
        )}
      </form>
    </Dialog>
  )
}
