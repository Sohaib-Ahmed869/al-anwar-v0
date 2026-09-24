import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ImagePlus, Upload } from 'lucide-react'
import type { Appeal } from '../../../shared/types'
import { api, errorMessage } from '../../portal/api'
import { Button, Card, CardBody, CardHeader, cn, toast } from '../../portal/ui'

/* The appeal's photograph: drop a file on it or choose one. Checked here for
   type and size before it is sent (JPG, PNG or WebP, up to 8 MB — the server
   checks the same), shown straight away from the local file while it uploads
   so the person sees their choice, then replaced by the stored copy. */

const TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX = 8 * 1024 * 1024

export function AppealImage({ appealId, image, onUploaded }: { appealId?: string; image?: string; onUploaded: (a: Appeal) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [local, setLocal] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = useMutation({
    mutationFn: (f: File) => {
      const form = new FormData()
      form.append('file', f)
      return api.upload<Appeal>(`/admin/appeals/${appealId}/image`, form)
    },
    onSuccess: (a) => {
      onUploaded(a)
      toast.success('Photo updated')
    },
    onError: (e) => setError(errorMessage(e)),
    onSettled: () => setLocal(null),
  })

  const choose = (f?: File | null) => {
    if (!f) return
    setError(null)
    if (!TYPES.includes(f.type)) return setError('Use a JPG, PNG or WebP photo.')
    if (f.size > MAX) return setError(`That photo is ${(f.size / 1024 / 1024).toFixed(1)} MB. The most is 8 MB.`)
    setLocal(URL.createObjectURL(f))
    upload.mutate(f)
  }

  const src = local ?? image
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Photo" description="Shown at the top of the appeal page and on its card. Landscape, at least 1200 pixels wide." />
      <CardBody>
        {!appealId ? (
          <div className="grid aspect-[16/9] place-items-center rounded-xl bg-paper-2 px-6 text-center text-[13px] text-text-2 ring-1 ring-line ring-inset">
            Save the appeal first, then add its photo.
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(false)
              choose(e.dataTransfer.files?.[0])
            }}
            className={cn('relative overflow-hidden rounded-xl ring-1 ring-line ring-inset transition-shadow', over && 'ring-2 ring-green')}
          >
            {src ? (
              <img src={src} alt="The appeal's photo" className={cn('aspect-[16/9] w-full object-cover', upload.isPending && 'opacity-60')} />
            ) : (
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 bg-paper-2 text-[13px] text-text-2 hover:text-text"
              >
                <ImagePlus className="size-6 text-text-3" />
                Drop a photo here, or choose one
              </button>
            )}
            {upload.isPending && (
              <div className="absolute inset-x-0 bottom-0 bg-ink/70 px-3 py-2 text-[12.5px] text-white">Uploading…</div>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="mt-2 text-[12.5px] text-red">
            {error}
          </p>
        )}
        {appealId && (
          <>
            <input
              ref={input}
              type="file"
              accept={TYPES.join(',')}
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                choose(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <Button size="sm" variant="secondary" icon={<Upload />} className="mt-3 w-full" loading={upload.isPending} onClick={() => input.current?.click()}>
              {src ? 'Replace photo' : 'Choose a photo'}
            </Button>
          </>
        )}
      </CardBody>
    </Card>
  )
}
