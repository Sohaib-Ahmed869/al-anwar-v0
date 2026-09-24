import { useState, type FormEvent } from 'react'
import type { RegisterDef, RegisterField } from '../../../shared/registers'
import { Field, FormError, Input, MoneyInput, Select, Switch, Textarea, cn } from '../../portal/ui'
import { parseMoney } from '../../portal/format'

/* ---------------------------------------------------------------------------
   A register's form, built from its RegisterDef — one component for all five
   registers, so a field added in shared/registers.ts appears here with its
   label, help line and required mark and nothing else changes.

   Half-width fields pair up on a wide screen and stack on a phone. Money is
   typed in dollars and sent in cents. The server validates again and its
   per-field messages land under the right box through `errors`.
--------------------------------------------------------------------------- */

type Values = Record<string, string | number | boolean | null>

function toInput(f: RegisterField, v: unknown): string | boolean {
  if (f.type === 'boolean') return v === true
  if (v === null || v === undefined) return ''
  if (f.type === 'money') return (Number(v) / 100).toFixed(2)
  return String(v)
}

export function RegisterForm({
  def,
  initial,
  formId,
  onSubmit,
  errors = {},
  error,
}: {
  def: RegisterDef
  initial?: Values
  formId: string
  onSubmit: (fields: Values) => void
  errors?: Record<string, string>
  error?: string | null
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(def.fields.map((f) => [f.key, toInput(f, initial?.[f.key])])),
  )
  const [local, setLocal] = useState<Record<string, string>>({})
  const set = (k: string, v: string | boolean) => {
    setValues((s) => ({ ...s, [k]: v }))
    if (local[k]) setLocal((e) => ({ ...e, [k]: '' }))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const out: Values = {}
    const bad: Record<string, string> = {}
    for (const f of def.fields) {
      const v = values[f.key]
      if (f.type === 'boolean') out[f.key] = Boolean(v)
      else if (f.type === 'money') {
        const c = v === '' ? null : parseMoney(String(v))
        if (c !== null && Number.isNaN(c)) bad[f.key] = 'Enter an amount like 250 or 250.00'
        out[f.key] = c
      } else if (f.type === 'number') out[f.key] = v === '' ? null : Number(v)
      else out[f.key] = typeof v === 'string' ? v.trim() || null : null
      if (f.required && (out[f.key] === null || out[f.key] === '')) bad[f.key] = `${f.label} is required.`
    }
    setLocal(bad)
    if (Object.keys(bad).length) return
    onSubmit(out)
  }

  return (
    <form id={formId} onSubmit={submit} noValidate className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
      {error && (
        <div className="sm:col-span-2">
          <FormError message={error} />
        </div>
      )}
      {def.fields.map((f) => {
        const err = local[f.key] || errors[f.key]
        const label = (
          <>
            {f.label}
            {f.required && (
              <span className="ml-0.5 text-red" aria-hidden>
                *
              </span>
            )}
            {f.required && <span className="sr-only"> (required)</span>}
          </>
        )
        const v = values[f.key]
        return (
          <Field key={f.key} label={f.type === 'boolean' ? undefined : label} help={f.help} error={err} className={cn(f.half ? 'sm:col-span-1' : 'sm:col-span-2')}>
            {f.type === 'textarea' ? (
              <Textarea rows={3} value={String(v)} onChange={(e) => set(f.key, e.target.value)} />
            ) : f.type === 'select' ? (
              <Select value={String(v)} onChange={(e) => set(f.key, e.target.value)} placeholder="Choose…" className="read-only:bg-paper">
                {Object.entries(f.options ?? {}).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            ) : f.type === 'boolean' ? (
              <Switch checked={Boolean(v)} onChange={(x) => set(f.key, x)} label={f.label} description={f.help} />
            ) : f.type === 'money' ? (
              <MoneyInput value={String(v)} onChange={(e) => set(f.key, e.target.value)} />
            ) : (
              <Input
                type={f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : f.type === 'number' ? 'number' : 'text'}
                value={String(v)}
                onChange={(e) => set(f.key, e.target.value)}
                autoComplete="off"
              />
            )}
          </Field>
        )
      })}
      {/* Enter in a text box submits the form */}
      <button type="submit" hidden aria-hidden tabIndex={-1} />
    </form>
  )
}
