import { forwardRef, useImperativeHandle, useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, FileSpreadsheet, FileText, Sparkles, UploadCloud } from 'lucide-react'
import type { BankImport } from '../../../shared/types'
import { ApiError, download } from '../../portal/api'
import { plural } from '../../portal/format'
import { Button, Progress, cn, toast } from '../../portal/ui'
import { BANK_STEPS } from './BankBits'
import { BankMappingDialog, type MappingRequest, type ColumnMapping } from './BankMappingDialog'

/* ---------------------------------------------------------------------------
   The statement upload: a big drop zone, the four steps explained beside it,
   and "try it with a sample statement" for anyone who wants to see it work
   before trusting it with a real statement.

   Uploads go through XMLHttpRequest rather than fetch because only XHR
   reports upload progress, and a bar that moves is the difference between
   "it's working" and "did it freeze?". The server matches as part of the same
   request, so after the bytes are sent the bar turns into "Matching…".

   A 422 with `needsMapping` means the server could not tell the columns apart;
   the file stays in memory and the mapping dialog posts it again with the
   person's choices.
--------------------------------------------------------------------------- */

type Phase = { kind: 'idle' } | { kind: 'uploading'; pct: number } | { kind: 'matching' } | { kind: 'error'; message: string }

export type BankUploadHandle = { focus: () => void }

function send(file: File, mapping: ColumnMapping | null, onProgress: (pct: number) => void) {
  return new Promise<BankImport>((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    if (mapping) form.append('mapping', JSON.stringify(mapping))
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/admin/bank/imports')
    xhr.withCredentials = true
    xhr.setRequestHeader('X-Requested-With', 'aa')
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
    xhr.upload.onload = () => onProgress(100)
    xhr.onerror = () => reject(new ApiError(0, 'The upload did not reach the server. Check your connection and try again.'))
    xhr.onload = () => {
      let data: unknown = null
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        /* not JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data as BankImport)
      const body = data as { error?: { message?: string; fields?: Record<string, string> }; needsMapping?: boolean } | null
      const err = new ApiError(xhr.status, body?.error?.message ?? `The upload failed (${xhr.status}).`, body?.error?.fields ?? {})
      ;(err as ApiError & { body?: unknown }).body = body
      reject(err)
    }
    xhr.send(form)
  })
}

const sizeLabel = (n: number) => (n < 1024 ? `${n} bytes` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)

export const BankUploadZone = forwardRef<BankUploadHandle, { highlight?: boolean }>(function BankUploadZone({ highlight }, ref) {
  const nav = useNavigate()
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const zone = useRef<HTMLButtonElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [dragging, setDragging] = useState(false)
  const [mapping, setMapping] = useState<MappingRequest | null>(null)
  const [sampleBusy, setSampleBusy] = useState(false)
  const busy = phase.kind === 'uploading' || phase.kind === 'matching'

  useImperativeHandle(ref, () => ({
    focus: () => {
      zone.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      zone.current?.focus({ preventScroll: true })
    },
  }))

  async function upload(f: File, map: ColumnMapping | null = null) {
    setFile(f)
    if (!/\.(csv|txt)$/i.test(f.name) && f.type && !/csv|text|excel/.test(f.type)) {
      setPhase({ kind: 'error', message: 'That is not a CSV file. In your online banking, export the statement as CSV (sometimes called “comma separated”).' })
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      setPhase({ kind: 'error', message: 'That file is over 5 MB. A statement CSV is usually far smaller — is it the right file?' })
      return
    }
    setPhase({ kind: 'uploading', pct: 0 })
    try {
      const imp = await send(f, map, (pct) => setPhase(pct >= 100 ? { kind: 'matching' } : { kind: 'uploading', pct }))
      setMapping(null)
      qc.invalidateQueries({ queryKey: ['bank'] })
      qc.invalidateQueries({ queryKey: ['admin', 'badges'] })
      const c = imp.counts
      const lines = imp.lines.length
      toast.success(`Read ${plural(lines, 'line')} from ${imp.filename}`, {
        description: [c.matched && `${c.matched} matched`, c.review && `${c.review} to check`, c.unmatched && `${c.unmatched} unmatched`, c.duplicate && `${c.duplicate} already imported`].filter(Boolean).join(' · '),
      })
      nav(`/admin/bank/${imp.id}`)
    } catch (e) {
      const body = (e as ApiError & { body?: MappingRequest & { needsMapping?: boolean } }).body
      if (e instanceof ApiError && e.status === 422 && body?.needsMapping) {
        setPhase({ kind: 'idle' })
        setMapping({ ...body, message: undefined })
        return
      }
      if (map) {
        /* keep the dialog open, with the reason, so the choices are not lost */
        setMapping((m) => (m ? { ...m, message: e instanceof Error ? e.message : 'The file could not be read.' } : m))
        setPhase({ kind: 'idle' })
        return
      }
      setPhase({ kind: 'error', message: e instanceof Error ? e.message : 'The file could not be read.' })
    }
  }

  async function trySample() {
    setSampleBusy(true)
    try {
      const res = await fetch('/api/admin/bank/sample', { credentials: 'same-origin' })
      if (!res.ok) throw new Error('The sample statement could not be made.')
      const blob = await res.blob()
      await upload(new File([blob], 'commbank-statement-sample.csv', { type: 'text/csv' }))
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof Error ? e.message : 'The sample statement could not be made.' })
    } finally {
      setSampleBusy(false)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f && !busy) upload(f)
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl bg-paper ring-1 ring-line/80 shadow-soft transition-shadow',
        highlight && 'ring-2 ring-green/50 shadow-lift',
      )}
    >
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* ---------- what happens ---------- */}
        <div className="relative border-t border-line-2 bg-gradient-to-br from-green-50 via-paper to-paper px-5 py-6 sm:px-7 sm:py-7 lg:border-t-0 lg:border-r">
          <p className="text-[12px] font-semibold tracking-[0.08em] text-green uppercase">Bank transfers</p>
          <h2 className="mt-1.5 text-[21px] leading-snug font-semibold tracking-[-0.015em] text-text sm:text-[23px]">
            Turn this week's statement into saved donations
          </h2>
          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-text-2">
            Upload the statement and every transfer is matched to its donor and appeal by name and reference. You check it on screen; nothing is saved until you confirm.
          </p>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {BANK_STEPS.map((s, i) => (
              <li key={s.key} className="flex items-start gap-3">
                <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-paper text-green ring-1 ring-green/15 shadow-soft">
                  <s.icon className="size-[17px]" />
                  <span className="nums absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-green text-[10px] font-semibold text-white">{i + 1}</span>
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className="block text-[13.5px] font-semibold text-text">{s.label}</span>
                  <span className="block text-[12.5px] leading-snug text-text-2">{s.hint}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* ---------- the drop zone ---------- */}
        <div className="order-first flex flex-col gap-3 p-4 sm:p-6 lg:order-none">
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv,.txt"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload(f)
              e.target.value = ''
            }}
          />
          <button
            ref={zone}
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              if (!busy) setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            aria-describedby="bank-upload-help"
            className={cn(
              'group relative flex min-h-[220px] flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-8 text-center transition-all duration-200',
              'focus-visible:border-green focus-visible:outline-none',
              dragging ? 'scale-[1.01] border-green bg-green-50' : 'border-line bg-paper-2/60 hover:border-green/50 hover:bg-green-50/50',
              busy && 'cursor-default',
            )}
          >
            {phase.kind === 'uploading' || phase.kind === 'matching' ? (
              <div className="w-full max-w-xs">
                <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-paper text-green ring-1 ring-green/15 shadow-soft">
                  {phase.kind === 'matching' ? <Sparkles className="size-5 animate-pulse" /> : <FileText className="size-5" />}
                </div>
                <p className="truncate text-[14px] font-medium text-text">{file?.name}</p>
                <p className="nums mt-0.5 text-[12.5px] text-text-3">{file && sizeLabel(file.size)}</p>
                <Progress className="mt-4" value={phase.kind === 'matching' ? 100 : phase.pct} max={100} label="Upload progress" />
                <p className="mt-2.5 text-[13px] text-text-2" aria-live="polite">
                  {phase.kind === 'matching' ? 'Matching each line to donors, pledges and appeals…' : `Uploading… ${phase.pct}%`}
                </p>
              </div>
            ) : (
              <>
                <div className={cn('mb-4 grid size-14 place-items-center rounded-2xl bg-paper text-green ring-1 ring-green/15 shadow-soft transition-transform duration-200', dragging ? '-translate-y-1' : 'group-hover:-translate-y-0.5')}>
                  <UploadCloud className="size-6" />
                </div>
                <p className="text-[16px] font-semibold text-text">{dragging ? 'Drop it here' : 'Drop your statement here'}</p>
                <p className="mt-1 text-[13.5px] text-text-2">
                  or <span className="font-medium text-green underline decoration-green/30 underline-offset-2">choose a CSV file</span>
                </p>
                <p id="bank-upload-help" className="mt-3 max-w-xs text-[12.5px] leading-relaxed text-text-3">
                  CommBank, Westpac, NAB, ANZ or any bank's CSV export, up to 5 MB. Money going out is left out automatically.
                </p>
              </>
            )}
          </button>

          {phase.kind === 'error' && (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-red-pale px-3.5 py-3 text-[13.5px] leading-snug text-red">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0">
                {file && <p className="truncate font-medium">{file.name}</p>}
                <p>{phase.message}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col items-stretch gap-2 rounded-xl bg-paper-2/70 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2.5">
              <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-text-3" />
              <p className="text-[13px] leading-snug text-text-2">
                No statement to hand? Try it with a sample made from this week's pledges and donors.{' '}
                <button
                  type="button"
                  className="font-medium text-text underline decoration-line underline-offset-2 hover:decoration-text-3"
                  onClick={() => download('/admin/bank/sample', undefined, 'commbank-statement-sample.csv').catch((e) => toast.error(e.message))}
                >
                  Download it
                </button>{' '}
                to look first.
              </p>
            </div>
            <Button variant="secondary" size="sm" icon={<Sparkles />} loading={sampleBusy} disabled={busy} onClick={trySample}>
              Try it with a sample statement
            </Button>
          </div>
        </div>
      </div>

      <BankMappingDialog
        request={mapping}
        fileName={file?.name}
        busy={busy}
        onCancel={() => setMapping(null)}
        onSubmit={(m) => file && upload(file, m)}
      />
    </div>
  )
})
