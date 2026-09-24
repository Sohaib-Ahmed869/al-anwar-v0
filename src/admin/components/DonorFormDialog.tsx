import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Donor } from '../../../shared/types'
import { ApiError, api } from '../../portal/api'
import { Button, Dialog, Field, FormError, Input, Select, Sheet, Switch, toast } from '../../portal/ui'

/* ---------------------------------------------------------------------------
   A donor's contact details, as a form. Two uses:

   - "Add donor" (a Dialog): a person who gave at a stall, rang in, or needs a
     record before their cheque is entered. The server refuses an email that
     is already on file and says whose it is — the answer offers the existing
     record instead of making a second one, because that is how duplicates are
     born.
   - "Edit contact details" on a donor record (a Sheet, so the record stays
     visible behind it).
--------------------------------------------------------------------------- */

export const AU_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']

type Form = {
  firstName: string
  lastName: string
  email: string
  phone: string
  line1: string
  line2: string
  suburb: string
  state: string
  postcode: string
  country: string
  emailOptIn: boolean
}

const blank: Form = { firstName: '', lastName: '', email: '', phone: '', line1: '', line2: '', suburb: '', state: '', postcode: '', country: 'Australia', emailOptIn: false }

function fromDonor(d: Donor): Form {
  return {
    firstName: d.firstName,
    lastName: d.lastName,
    email: d.email,
    phone: d.phone ?? '',
    line1: d.address?.line1 ?? '',
    line2: d.address?.line2 ?? '',
    suburb: d.address?.suburb ?? '',
    state: d.address?.state ?? '',
    postcode: d.address?.postcode ?? '',
    country: d.address?.country ?? 'Australia',
    emailOptIn: d.preferences.emailOptIn,
  }
}

/** Split "Amina Rahman" or "amina@x.com" typed into a search box into a head start. */
export function guessFromTyped(typed: string): Partial<Form> {
  const t = typed.trim()
  if (!t) return {}
  if (t.includes('@')) return { email: t }
  if (/^[\d\s+()-]{6,}$/.test(t)) return { phone: t }
  const [first, ...rest] = t.split(/\s+/)
  return { firstName: first ?? '', lastName: rest.join(' ') }
}

export function DonorFormDialog({
  open,
  onOpenChange,
  donor,
  initial,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** edit this donor; without it, create one */
  donor?: Donor
  initial?: Partial<Form>
  onSaved?: (d: Donor) => void
}) {
  const qc = useQueryClient()
  const [f, setF] = useState<Form>(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [existingId, setExistingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setF(donor ? fromDonor(donor) : { ...blank, ...initial })
    setErrors({})
    setFormError(null)
    setExistingId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, donor?.id])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((x) => ({ ...x, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }))
  }

  const save = useMutation({
    mutationFn: () => {
      const address = { line1: f.line1, line2: f.line2, suburb: f.suburb, state: f.state, postcode: f.postcode, country: f.country }
      const body = { firstName: f.firstName, lastName: f.lastName, email: f.email, phone: f.phone, address }
      return donor
        ? api.patch<Donor>(`/admin/donors/${donor.id}`, body)
        : api.post<Donor>('/admin/donors', { ...body, preferences: { emailOptIn: f.emailOptIn } })
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['admin', 'donors'] })
      qc.invalidateQueries({ queryKey: ['admin', 'donor', d.id] })
      toast.success(donor ? 'Contact details saved' : `${d.firstName} ${d.lastName} added as ${d.number}`)
      onOpenChange(false)
      onSaved?.(d)
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        const { existingId: ex, ...fields } = e.fields
        setErrors(fields)
        setExistingId(ex ?? null)
        setFormError(Object.keys(fields).length ? null : e.message)
      } else setFormError('Something went wrong. Please try again.')
    },
  })

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const errs: Record<string, string> = {}
    if (!f.firstName.trim()) errs.firstName = 'Add a first name'
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) errs.email = 'Add an email address — receipts go there'
    setErrors(errs)
    if (Object.keys(errs).length) return
    save.mutate()
  }

  const fields = (
    <form id="donor-form" onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" error={errors.firstName}>
          <Input value={f.firstName} onChange={(e) => set('firstName', e.target.value)} autoComplete="off" autoFocus={!donor} />
        </Field>
        <Field label="Last name" error={errors.lastName} optional>
          <Input value={f.lastName} onChange={(e) => set('lastName', e.target.value)} autoComplete="off" />
        </Field>
      </div>
      <Field
        label="Email"
        error={errors.email}
        help={
          existingId ? undefined : donor ? 'Receipts and statements go here. The old address stays on file as another email.' : 'Receipts go here. One record per email address.'
        }
      >
        <Input type="email" inputMode="email" value={f.email} onChange={(e) => set('email', e.target.value)} autoComplete="off" />
      </Field>
      {existingId && (
        <p className="-mt-2 text-[13px]">
          <Link to={`/admin/donors/${existingId}`} onClick={() => onOpenChange(false)} className="font-medium text-green underline underline-offset-2">
            Open their record instead
          </Link>
        </p>
      )}
      <Field label="Phone" error={errors.phone} optional>
        <Input type="tel" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="0412 345 678" autoComplete="off" />
      </Field>
      <fieldset className="space-y-3">
        <legend className="mb-1.5 text-[13px] font-medium text-text">
          Address <span className="font-normal text-text-3">optional</span>
        </legend>
        <Input aria-label="Street address" value={f.line1} onChange={(e) => set('line1', e.target.value)} placeholder="Street address" autoComplete="off" />
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-4 sm:col-span-2">
            <Input aria-label="Suburb" value={f.suburb} onChange={(e) => set('suburb', e.target.value)} placeholder="Suburb" autoComplete="off" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Select aria-label="State" value={f.state} onChange={(e) => set('state', e.target.value)} placeholder="State" className="px-2.5">
              {AU_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Input aria-label="Postcode" inputMode="numeric" value={f.postcode} onChange={(e) => set('postcode', e.target.value)} placeholder="Postcode" autoComplete="off" />
          </div>
        </div>
      </fieldset>
      {!donor && (
        <div className="rounded-xl bg-paper-2 p-3.5">
          <Switch
            checked={f.emailOptIn}
            onChange={(v) => set('emailOptIn', v)}
            label="They’re happy to hear about appeals"
            description="Only switch this on if they said yes. Receipts are sent either way."
          />
        </div>
      )}
      <FormError message={formError} />
      <button type="submit" hidden />
    </form>
  )

  const footer = (
    <>
      <Button variant="secondary" onClick={() => onOpenChange(false)}>
        Cancel
      </Button>
      <Button variant="primary" type="submit" form="donor-form" loading={save.isPending}>
        {donor ? 'Save details' : 'Add donor'}
      </Button>
    </>
  )

  return donor ? (
    <Sheet open={open} onOpenChange={onOpenChange} title="Contact details" description={`${donor.firstName} ${donor.lastName} · ${donor.number}`} footer={footer} width={480}>
      {fields}
    </Sheet>
  ) : (
    <Dialog open={open} onOpenChange={onOpenChange} title="Add a donor" description="For someone who gave in person, rang in, or needs a record before their gift is entered." footer={footer} dismissible={false}>
      {fields}
    </Dialog>
  )
}
