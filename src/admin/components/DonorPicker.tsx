import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, UserPlus, X } from 'lucide-react'
import type { Appeal, Donor, Page } from '../../../shared/types'
import { api } from '../../portal/api'
import { formatMoney } from '../../portal/format'
import { useCan } from '../../portal/session'
import { Avatar, Popover, Select, Spinner, cn, useDebounced } from '../../portal/ui'

/* ---------------------------------------------------------------------------
   Choosing a donor: type a name, email, phone or donor number and pick from
   the matches. Used wherever a gift or a bank line is attached to a person.

   "New donor" is offered right in the list, pre-filled from what was typed,
   because at an event table the person in front of you is often not in the
   system yet — and sending the volunteer to another screen loses the gift.

   Who sees what depends on the role. Staff who may read the donor list get
   GET /api/admin/donors?q=…&pageSize=8, the full row with lifetime giving. A
   volunteer has no donors.read (shared/access.ts) and gets the narrow
   GET /api/admin/lookup/donors instead: five matches at most, from three
   characters, with the email masked and no totals. Either way the picked
   donor has the same shape; from the lookup, `email` holds the masked hint
   and `noEmail` says whether there is a real address behind it.
--------------------------------------------------------------------------- */

export type PickedDonor = Pick<Donor, 'id' | 'firstName' | 'lastName' | 'email' | 'number'> &
  Partial<Donor> & {
    /** from the lookup: true when the record has no real email address */
    noEmail?: boolean
    /** from the lookup: the suburb, to tell two people of the same name apart */
    suburb?: string | null
  }

type LookupRow = { id: string; number: string; firstName: string; lastName: string; emailHint: string; noEmail: boolean; suburb: string | null }

export function DonorPicker({
  value,
  onChange,
  onCreateNew,
  invalid,
  placeholder = 'Search by name, email, phone or donor number',
}: {
  value: PickedDonor | null
  onChange: (d: PickedDonor | null) => void
  /** called with what was typed, when the person asks for a new donor */
  onCreateNew?: (typed: string) => void
  invalid?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const dq = useDebounced(q.trim(), 200)
  const full = useCan('donors.read')
  const minLength = full ? 2 : 3
  const results = useQuery({
    queryKey: ['donor-picker', full, dq],
    queryFn: async (): Promise<{ items: PickedDonor[] }> =>
      full
        ? api.get<Page<Donor>>('/admin/donors', { q: dq, pageSize: 8 })
        : api.get<{ items: LookupRow[] }>('/admin/lookup/donors', { q: dq }).then((r) => ({
            items: r.items.map(({ emailHint, ...d }) => ({ ...d, email: emailHint })),
          })),
    enabled: open && dq.length >= minLength,
    staleTime: 15_000,
  })

  if (value) {
    const name = `${value.firstName} ${value.lastName}`.trim()
    return (
      <div className="flex items-center gap-3 rounded-[10px] bg-paper px-3 py-2 ring-1 ring-line ring-inset">
        <Avatar name={name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text">{name}</p>
          <p className="truncate text-[12.5px] text-text-3">
            {value.number} · {value.noEmail ? 'No email on file' : value.email}
          </p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="grid size-8 place-items-center rounded-lg text-text-3 hover:bg-ink/5 hover:text-text" aria-label="Choose a different donor">
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <Popover
      open={open && q.trim().length >= minLength}
      onOpenChange={setOpen}
      keepFocus
      className="w-[var(--radix-popover-trigger-width)] p-1"
      trigger={
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-3" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            aria-invalid={invalid || undefined}
            className={cn(
              'h-10 w-full rounded-[10px] bg-paper pr-9 pl-9 text-[16px] ring-1 ring-line ring-inset placeholder:text-text-3 focus:ring-2 focus:ring-green/70 focus:outline-none sm:text-sm pointer-coarse:h-11',
              invalid && 'ring-red/60',
            )}
          />
          {results.isFetching && <Spinner className="absolute top-1/2 right-3 -translate-y-1/2 text-text-3" />}
        </div>
      }
    >
      <div className="max-h-80 overflow-y-auto" onMouseDown={(e) => e.preventDefault()}>
        {results.data?.items.map((d) => {
          const name = `${d.firstName} ${d.lastName}`.trim()
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                onChange(d)
                setQ('')
                setOpen(false)
              }}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-ink/[.05]"
            >
              <Avatar name={name} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-text">{name}</span>
                <span className="block truncate text-[12.5px] text-text-3">
                  {[d.number, d.noEmail ? 'No email' : d.email, d.suburb].filter(Boolean).join(' · ')}
                </span>
              </span>
              {d.totalGiven !== undefined && <span className="nums shrink-0 text-[12.5px] text-text-2">{formatMoney(d.totalGiven, { whole: true })}</span>}
            </button>
          )
        })}
        {results.data && !results.data.items.length && <p className="px-3 py-4 text-center text-[13px] text-text-2">No donor matches “{q.trim()}”.</p>}
        {onCreateNew && (
          <button
            type="button"
            onClick={() => {
              onCreateNew(q.trim())
              setOpen(false)
            }}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg border-t border-line-2 px-2.5 py-2.5 text-left text-[13.5px] font-medium text-green hover:bg-green-50"
          >
            <UserPlus className="size-4" /> New donor{q.trim() ? `: “${q.trim()}”` : ''}
          </button>
        )}
      </div>
    </Popover>
  )
}

/** Open appeals as a native select. `includeClosed` for reports and edits. */
export function AppealSelect({
  value,
  onChange,
  includeClosed,
  placeholder = 'Where most needed',
  invalid,
}: {
  value: string
  onChange: (id: string, appeal?: Appeal) => void
  includeClosed?: boolean
  placeholder?: string
  invalid?: boolean
}) {
  const q = useQuery({
    queryKey: ['appeal-options', includeClosed],
    queryFn: () => api.get<Page<Appeal>>('/admin/appeals', { status: includeClosed ? undefined : 'open', pageSize: 200 }),
    staleTime: 60_000,
  })
  return (
    <Select value={value} invalid={invalid} onChange={(e) => onChange(e.target.value, q.data?.items.find((a) => a.id === e.target.value))} placeholder={placeholder}>
      {q.data?.items.map((a) => (
        <option key={a.id} value={a.id}>
          {a.title}
          {a.status !== 'open' ? ` (${a.status})` : ''}
        </option>
      ))}
    </Select>
  )
}

