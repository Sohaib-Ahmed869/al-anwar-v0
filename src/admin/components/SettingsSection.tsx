import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import type { Settings } from '../../../shared/types'
import { api, ApiError, errorMessage } from '../../portal/api'
import { Button, Card, CardFooter, CardHeader, CardBody, FormError, toast } from '../../portal/ui'

/* ---------------------------------------------------------------------------
   One card on the Settings page, with its own draft and its own Save.

   The draft is kept as the form's own strings (money in dollars, the fee
   as a percentage) and `toBody` turns it into what PUT /:section expects,
   so each card only describes its fields. Saving one card never touches
   another card's unsaved edits.
--------------------------------------------------------------------------- */

export type SettingsView = Settings & { runtime: { paymentsMode: Settings['payments']['mode']; paypal: boolean; emailTransport: 'smtp' | 'outbox'; storage: 's3' | 'disk' } }
export type SectionKey = keyof Settings

export function useSettingsSection<D extends Record<string, unknown>>(
  section: SectionKey,
  source: SettingsView | undefined,
  fromSettings: (s: SettingsView) => D,
  toBody: (d: D) => Record<string, unknown> | string,
) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<D | null>(null)
  const [base, setBase] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState(0)

  useEffect(() => {
    if (source && draft === null) {
      const d = fromSettings(source)
      setDraft(d)
      setBase(JSON.stringify(d))
    }
  }, [source]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.put<SettingsView>(`/admin/settings/${section}`, body),
    onSuccess: (s) => {
      qc.setQueryData(['admin', 'settings'], s)
      qc.invalidateQueries({ queryKey: ['admin', 'receipt-preview'] })
      const d = fromSettings(s)
      setDraft(d)
      setBase(JSON.stringify(d))
      setErrors({})
      setFormError(null)
      setSavedAt(Date.now())
      toast.success('Saved')
    },
    onError: (e) => {
      setErrors(e instanceof ApiError ? e.fields : {})
      setFormError(errorMessage(e))
    },
  })

  const submit = () => {
    if (!draft) return
    const body = toBody(draft)
    if (typeof body === 'string') {
      setFormError(body)
      return
    }
    save.mutate(body)
  }

  return {
    draft,
    set: <K extends keyof D>(k: K, v: D[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d)),
    dirty: draft !== null && JSON.stringify(draft) !== base,
    errors,
    formError,
    submit,
    saving: save.isPending,
    justSaved: Date.now() - savedAt < 2500,
    reset: () => source && (setDraft(fromSettings(source)), setErrors({}), setFormError(null)),
  }
}

export function SettingsCard({
  id,
  title,
  description,
  icon,
  action,
  section,
  children,
}: {
  id: string
  title: string
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  /** absent for a card with nothing to save (Payments, since its fee rate was
   *  retired): the card then reads as information, with no Save button */
  section?: Pick<ReturnType<typeof useSettingsSection>, 'dirty' | 'formError' | 'submit' | 'saving' | 'justSaved' | 'reset' | 'errors'>
  children: ReactNode
}) {
  if (!section) {
    return (
      <Card id={id} className="scroll-mt-20 lg:scroll-mt-6">
        <CardHeader title={title} description={description} icon={icon} action={action} />
        <CardBody className="space-y-4">{children}</CardBody>
      </Card>
    )
  }
  return (
    <Card id={id} className="scroll-mt-20 lg:scroll-mt-6">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          section.submit()
        }}
      >
        <CardHeader title={title} description={description} icon={icon} action={action} />
        <CardBody className="space-y-4">
          {!Object.keys(section.errors).length && <FormError message={section.formError} />}
          {children}
        </CardBody>
        <CardFooter>
          {section.dirty ? (
            <>
              <span className="mr-auto text-[12.5px] font-medium text-amber">Unsaved changes</span>
              <Button variant="ghost" size="sm" onClick={section.reset}>
                Undo
              </Button>
            </>
          ) : section.justSaved ? (
            <span className="mr-auto inline-flex items-center gap-1 text-[12.5px] text-green">
              <Check className="size-3.5" /> Saved
            </span>
          ) : null}
          <Button type="submit" variant="primary" size="sm" loading={section.saving} disabled={!section.dirty}>
            Save
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
