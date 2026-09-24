import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiError } from '../api'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Field, FormError, Input } from '../ui/Field'

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const m = useMutation({
    mutationFn: () => api.post('/auth/staff/password', { current, next }),
    onSuccess: () => {
      toast.success('Password changed. Other devices have been signed out.')
      setCurrent('')
      setNext('')
      onOpenChange(false)
    },
  })
  const err = m.error instanceof ApiError ? m.error : null
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change your password"
      description="Changing it signs you out everywhere else."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={m.isPending} onClick={() => m.mutate()} disabled={!current || next.length < 10}>
            Change password
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          m.mutate()
        }}
      >
        <FormError message={err && !Object.keys(err.fields).length ? err.message : null} />
        <Field label="Current password" error={err?.fields.current}>
          <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="New password" help="At least 10 characters. A short sentence is easier to remember than symbols." error={err?.fields.next}>
          <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}
