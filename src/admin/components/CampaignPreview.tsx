import { useRef, useState, type RefObject } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Bold, Link2, List, Monitor, Smartphone, UserRound } from 'lucide-react'
import { api } from '../../portal/api'
import { Card, Segmented, Skeleton, Tooltip, cn, useDebounced } from '../../portal/ui'

/* ---------------------------------------------------------------------------
   The campaign composer's two helpers.

   <CampaignPreview> renders the email exactly as a donor receives it —
   the server's campaignEmail(), for a sample donor called Amina — into a
   sandboxed iframe (no scripts, no same-origin), at desktop or phone width.
   It asks the server a moment after typing stops, not on every keystroke.

   <CampaignBodyToolbar> inserts the light-markdown the email understands at
   the cursor, so nobody has to remember the syntax: **bold**, [link](url),
   "- " lists and {{firstName}}.
--------------------------------------------------------------------------- */

export function CampaignPreview({ subject, preheader, body }: { subject: string; preheader: string; body: string }) {
  const [width, setWidth] = useState<'desktop' | 'mobile'>('desktop')
  const input = useDebounced({ subject, preheader, body }, 450)
  const q = useQuery({
    queryKey: ['admin', 'campaign-preview', input],
    queryFn: () => api.post<{ html: string; subject: string }>('/admin/campaigns/preview', input),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  })
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line-2 px-4 py-3">
        <p className="text-[13px] font-medium text-text">Preview</p>
        <Segmented
          size="sm"
          aria-label="Preview width"
          value={width}
          onChange={setWidth}
          options={[
            { value: 'desktop', label: <><Monitor className="size-3.5" /> Desktop</> },
            { value: 'mobile', label: <><Smartphone className="size-3.5" /> Phone</> },
          ]}
        />
      </div>
      <div className="border-b border-line-2 bg-paper px-4 py-3 text-[13px]">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-green text-[12px] font-semibold text-white">A</span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-text">{q.data?.subject ?? (subject || 'Your subject line')}</p>
            <p className="truncate text-text-2">
              Al-Anwaar · <span className="text-text-3">{preheader || 'The preheader shows here in most inboxes'}</span>
            </p>
          </div>
        </div>
      </div>
      <div className={cn('bg-[#F5F5F2] transition-[padding]', width === 'mobile' && 'px-4 py-4')}>
        {q.data ? (
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={q.data.html}
            className={cn('mx-auto block h-[640px] bg-[#F5F5F2] transition-[width,opacity] duration-300', width === 'mobile' ? 'w-[375px] max-w-full rounded-[20px] ring-1 ring-line' : 'w-full', q.isFetching && 'opacity-70')}
          />
        ) : (
          <div className="space-y-3 p-8">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        )}
      </div>
      <p className="flex items-center gap-1.5 border-t border-line-2 px-4 py-2.5 text-[12px] text-text-3">
        <UserRound className="size-3.5" /> Shown as it reaches Amina. Each donor sees their own name.
      </p>
    </Card>
  )
}

export function CampaignBodyToolbar({ target, value, onChange }: { target: RefObject<HTMLTextAreaElement | null>; value: string; onChange: (v: string) => void }) {
  const last = useRef<[number, number]>([value.length, value.length])
  const apply = (fn: (sel: string) => { text: string; cursor: [number, number] }) => {
    const el = target.current
    const [a, b] = el ? [el.selectionStart, el.selectionEnd] : last.current
    const { text, cursor } = fn(value.slice(a, b))
    const next = value.slice(0, a) + text + value.slice(b)
    onChange(next)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(a + cursor[0], a + cursor[1])
      last.current = [a + cursor[0], a + cursor[1]]
    })
  }
  const lineStart = () => {
    const el = target.current
    const a = el?.selectionStart ?? value.length
    return a === 0 || value[a - 1] === '\n'
  }
  const tools = [
    { label: 'Bold', icon: <Bold />, run: () => apply((s) => ({ text: `**${s || 'bold words'}**`, cursor: [2, 2 + (s || 'bold words').length] })) },
    {
      label: 'Link',
      icon: <Link2 />,
      run: () => apply((s) => ({ text: `[${s || 'link text'}](https://)`, cursor: s ? [s.length + 3, s.length + 11] : [1, 10] })),
    },
    {
      label: 'List',
      icon: <List />,
      run: () =>
        apply((s) => {
          const lines = (s || 'First point').split('\n').map((l) => `- ${l.replace(/^[-*] /, '')}`)
          const pre = lineStart() ? '' : '\n\n'
          const text = pre + lines.join('\n')
          return { text, cursor: [text.length, text.length] }
        }),
    },
  ]
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-t-[10px] border border-b-0 border-line bg-paper-2 px-1.5 py-1">
      {tools.map((t) => (
        <Tooltip key={t.label} content={t.label}>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={t.run} aria-label={t.label} className="grid size-8 place-items-center rounded-md text-text-2 hover:bg-ink/[.06] hover:text-text [&_svg]:size-4">
            {t.icon}
          </button>
        </Tooltip>
      ))}
      <span className="mx-1 h-5 w-px bg-line" />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => apply(() => ({ text: '{{firstName}}', cursor: [13, 13] }))}
        className="h-8 rounded-md px-2 text-[12.5px] font-medium text-green hover:bg-green-50"
      >
        + First name
      </button>
    </div>
  )
}
