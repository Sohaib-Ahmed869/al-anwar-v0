import { useState, type KeyboardEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '../../portal/ui'

/* Tags on a donor: pills with a remove button, and a small input that adds
   one on Enter or comma. Suggestions are the tags already in use, so "Major
   donor" and "major donors" do not both creep in. Tags are lower-case on the
   server; they are shown as typed. */

export function TagEditor({
  value,
  onChange,
  suggestions = [],
  disabled,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  disabled?: boolean
}) {
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const add = (raw: string) => {
    const t = raw.trim().toLowerCase().slice(0, 40)
    if (t && !value.includes(t)) onChange([...value, t])
    setText('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(text)
    } else if (e.key === 'Escape') {
      setText('')
      setAdding(false)
    } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
  }
  const q = text.trim().toLowerCase()
  const offer = suggestions.filter((s) => !value.includes(s) && (!q || s.includes(q))).slice(0, 6)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((t) => (
          <span key={t} className="inline-flex h-7 items-center gap-1 rounded-full bg-green-50 pr-1 pl-2.5 text-[12.5px] font-medium text-green ring-1 ring-green/15">
            {t}
            {!disabled && (
              <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="grid size-5 place-items-center rounded-full hover:bg-green/10" aria-label={`Remove the tag ${t}`}>
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled &&
          (adding ? (
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKey}
              onBlur={() => {
                if (text.trim()) add(text)
                setAdding(false)
              }}
              placeholder="Type a tag, press Enter"
              aria-label="New tag"
              className="h-7 w-44 rounded-full bg-paper px-3 text-[16px] ring-1 ring-line ring-inset focus:ring-2 focus:ring-green/60 focus:outline-none sm:text-[12.5px]"
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-medium text-text-2 ring-1 ring-line ring-inset ring-dashed hover:text-text hover:ring-[#dccdb2]"
            >
              <Plus className="size-3.5" /> Add tag
            </button>
          ))}
        {!value.length && disabled && <span className="text-[13px] text-text-3">No tags</span>}
      </div>
      {adding && offer.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" onMouseDown={(e) => e.preventDefault()}>
          {offer.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className={cn('h-6 rounded-full bg-ink/[.05] px-2.5 text-[12px] text-text-2 hover:bg-ink/[.08] hover:text-text')}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
