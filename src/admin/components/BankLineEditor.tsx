import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { UserPlus, X } from 'lucide-react'
import { DESIGNATIONS, DESIGNATION_KEYS, type Designation } from '../../../shared/domain'
import type { BankImport, BankLine } from '../../../shared/types'
import { ApiError, api } from '../../portal/api'
import { formatDate } from '../../portal/format'
import { Button, Dialog, Field, FormError, Input, Money, Select, cn, toast } from '../../portal/ui'
import { AppealSelect, DonorPicker, type PickedDonor } from './DonorPicker'
import { BankDonorChip, BankNarrative } from './BankBits'

/* ---------------------------------------------------------------------------
   "Check this line": who sent it and what it is for, in one dialog (a bottom
   sheet on a phone). Saving here accepts the line — choosing the donor by
   hand is the check — so it moves to Matched with the person's name on it.

   When the payer is nobody we know, "New donor from this line" opens a small
   form already filled from what the bank printed ("T NGUYEN" → T / Nguyen),
   because retyping a name you are looking at is where typos come from.
--------------------------------------------------------------------------- */

const title = (s: string) => s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a, c) => a + c.toUpperCase())

function splitName(text: string) {
  const words = title(text.trim()).split(/\s+/).filter(Boolean)
  if (!words.length) return { firstName: '', lastName: '' }
  if (words.length === 1) return { firstName: words[0]!, lastName: '' }
  /* banks often print SURNAME INITIAL: "HASSAN M" */
  if (words.length === 2 && words[1]!.length === 1) return { firstName: words[1]!, lastName: words[0]! }
  return { firstName: words[0]!, lastName: words.slice(1).join(' ') }
}

export function BankLineEditor({
  importId,
  line,
  onClose,
  onSaved,
}: {
  importId: string
  line: BankLine | null
  onClose: () => void
  onSaved: (imp: BankImport, message: string) => void
}) {
  const [donor, setDonor] = useState<PickedDonor | null>(null)
  const [appeal, setAppeal] = useState('')
  const [designation, setDesignation] = useState<Designation>('general')
  const [creating, setCreating] = useState<{ firstName: string; lastName: string; email: string } | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    if (!line) return
    const m = line.match
    setDonor(m.donor ? { id: m.donor, firstName: m.donorName ?? '', lastName: '', email: '', number: m.donorNumber ?? '' } : null)
    setAppeal(m.appeal ?? '')
    setDesignation(m.designation)
    setCreating(null)
    setError(null)
  }, [line])

  const save = useMutation({
    mutationFn: async () => {
      if (!line) throw new Error('No line')
      const base = `/admin/bank/imports/${importId}/lines/${line.id}`
      let imp: BankImport
      let who = donor ? `${donor.firstName} ${donor.lastName}`.trim() : ''
      if (creating) {
        const r = await api.post<{ donor: { name: string; existed: boolean }; import: BankImport }>(`${base}/new-donor`, creating)
        who = r.donor.name
        imp = await api.patch<BankImport>(base, { appealId: appeal || null, designation })
        return { imp, message: r.donor.existed ? `Matched to ${who}, who was already a donor` : `Added ${who} as a donor and matched the line` }
      }
      imp = await api.patch<BankImport>(base, {
        ...(donor && donor.id !== line.match.donor ? { donorId: donor.id } : {}),
        appealId: appeal || null,
        designation,
        status: 'matched',
      })
      return { imp, message: `Matched to ${who || 'the donor'}` }
    },
    onSuccess: ({ imp, message }) => onSaved(imp, message),
    onError: (e) => setError(e instanceof ApiError ? e : new ApiError(0, (e as Error).message)),
  })

  const ignore = useMutation({
    mutationFn: () => api.patch<BankImport>(`/admin/bank/imports/${importId}/lines/${line!.id}`, { status: 'ignored' }),
    onSuccess: (imp) => onSaved(imp, 'Line ignored — it will not be saved as a gift'),
    onError: (e) => toast.error((e as Error).message),
  })

  const m = line?.match
  const canSave = Boolean(donor || (creating && creating.firstName.trim()))

  return (
    <Dialog
      open={Boolean(line)}
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title="Check this line"
      description="Choose who sent it and what it is for. Saving accepts the line; it becomes a gift only when you save the statement."
      footer={
        <>
          <Button variant="ghost" className="sm:mr-auto" onClick={() => ignore.mutate()} loading={ignore.isPending} disabled={save.isPending}>
            Not a gift — ignore it
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canSave} loading={save.isPending} onClick={() => save.mutate()}>
            {creating ? 'Add donor and accept' : 'Save and accept'}
          </Button>
        </>
      }
    >
      {line && m && (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSave) save.mutate()
          }}
        >
          <div className="rounded-xl bg-paper-2/70 p-3.5 ring-1 ring-line-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-text-2">{formatDate(line.date)}</span>
              <Money cents={line.amount} className="text-[17px] font-semibold text-text" />
            </div>
            <BankNarrative className="mt-2">{line.description}</BankNarrative>
            {m.reasons.length > 0 && (
              <ul className="mt-2.5 space-y-1 text-[12.5px] leading-snug text-text-2">
                {m.reasons.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="mt-[7px] size-1 shrink-0 rounded-full bg-text-3" />
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <FormError message={error && !Object.keys(error.fields).length ? error.message : undefined} />

          <section>
            <h3 className="mb-2 text-[13.5px] font-semibold text-text">Who sent it</h3>
            {m.candidates && m.candidates.length > 0 && !creating && (
              <div className="mb-3">
                <p className="mb-1.5 text-[12.5px] text-text-2">The name fits more than one donor. Is it:</p>
                <div className="flex flex-wrap gap-2">
                  {m.candidates.map((c) => {
                    const on = donor?.id === c.donor
                    return (
                      <button
                        key={c.donor}
                        type="button"
                        onClick={() => setDonor({ id: c.donor, firstName: c.donorName, lastName: '', email: '', number: c.number })}
                        className={cn(
                          'rounded-xl px-2.5 py-1.5 text-left ring-1 ring-inset transition-colors',
                          on ? 'bg-green-50 ring-2 ring-green' : 'bg-paper ring-line hover:ring-[#c9c9c2]',
                        )}
                      >
                        <BankDonorChip name={c.donorName} number={c.number} size="xs" link={false} />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {creating ? (
              <div className="rounded-xl p-3.5 ring-1 ring-green/25 bg-green-50/40">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-[13.5px] font-medium text-green">
                    <UserPlus className="size-4" /> New donor from this line
                  </p>
                  <button type="button" onClick={() => setCreating(null)} className="grid size-8 place-items-center rounded-lg text-text-3 hover:bg-ink/5 hover:text-text" aria-label="Back to choosing a donor">
                    <X className="size-4" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="First name" error={error?.fields.firstName}>
                    <Input autoFocus value={creating.firstName} onChange={(e) => setCreating({ ...creating, firstName: e.target.value })} />
                  </Field>
                  <Field label="Last name" error={error?.fields.lastName}>
                    <Input value={creating.lastName} onChange={(e) => setCreating({ ...creating, lastName: e.target.value })} />
                  </Field>
                  <Field
                    className="sm:col-span-2"
                    label="Email"
                    optional
                    error={error?.fields.email}
                    help="Without one, the gift is saved and receipted but the receipt cannot be emailed. If the address belongs to an existing donor, the line goes to them instead."
                  >
                    <Input type="email" inputMode="email" autoComplete="off" value={creating.email} onChange={(e) => setCreating({ ...creating, email: e.target.value })} />
                  </Field>
                </div>
              </div>
            ) : donor ? (
              <div className="flex items-center gap-3 rounded-[10px] bg-paper px-3 py-2 ring-1 ring-line ring-inset">
                <div className="min-w-0 flex-1">
                  <BankDonorChip name={`${donor.firstName} ${donor.lastName}`.trim()} number={donor.number} link={false} />
                </div>
                <Button size="sm" variant="ghost" onClick={() => setDonor(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <DonorPicker
                  value={null}
                  onChange={setDonor}
                  onCreateNew={(typed) => setCreating({ ...splitName(typed || line.payer || ''), email: '' })}
                  placeholder="Search donors by name, email or number"
                />
                <button
                  type="button"
                  onClick={() => setCreating({ ...splitName(line.payer ?? ''), email: '' })}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-[13px] font-medium text-green hover:underline"
                >
                  <UserPlus className="size-4" /> New donor from this line{line.payer ? `: “${title(line.payer)}”` : ''}
                </button>
              </>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-[13.5px] font-semibold text-text">What it is for</h3>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <Field label="Appeal">
                <AppealSelect value={appeal} onChange={(id) => setAppeal(id)} />
              </Field>
              <Field label="Designation" help={designation === 'zakat' ? 'Kept apart in reports and the Xero file.' : undefined}>
                <Select value={designation} onChange={(e) => setDesignation(e.target.value as Designation)}>
                  {DESIGNATION_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {DESIGNATIONS[k].label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {line.pledgeInfo && (
              <p className="mt-2 text-[12.5px] text-text-2">
                This line pays pledge {line.pledgeInfo.number} (<Money cents={line.pledgeInfo.amount} /> on {formatDate(line.pledgeInfo.date)}). Choosing a different donor detaches it.
              </p>
            )}
          </section>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      )}
    </Dialog>
  )
}
