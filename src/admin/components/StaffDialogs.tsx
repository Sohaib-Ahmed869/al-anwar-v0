import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { ROLES, ROLE_KEYS, type Role } from '../../../shared/access'
import type { StaffUser } from '../../../shared/types'
import { api, ApiError, errorMessage } from '../../portal/api'
import { useStaff } from '../../portal/session'
import { Button, Callout, ChoiceCards, Dialog, Field, FormError, Input, toast } from '../../portal/ui'

/* ---------------------------------------------------------------------------
   The two staff dialogs: inviting someone, and changing a person's role.
   Both show each role with its one-line description, because "Finance" or
   "Fundraising" alone does not say whether that person can export the donor
   list. Only an owner is offered the Owner role — the server refuses it for
   anyone else anyway.
--------------------------------------------------------------------------- */

function roleOptions(isOwner: boolean) {
  return ROLE_KEYS.filter((r) => isOwner || r !== 'owner').map((r) => ({ value: r, label: ROLES[r].label, hint: ROLES[r].blurb }))
}

export function StaffInviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient()
  const me = useStaff().user
  const [form, setForm] = useState({ name: '', email: '', role: 'fundraising' as Role })
  const [err, setErr] = useState<{ message?: string; fields: Record<string, string> }>({ fields: {} })
  useEffect(() => {
    if (open) {
      setForm({ name: '', email: '', role: 'fundraising' })
      setErr({ fields: {} })
    }
  }, [open])
  const m = useMutation({
    mutationFn: () => api.post<StaffUser & { emailed: boolean }>('/admin/staff/invite', form),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['admin', 'staff'] })
      toast.success(s.emailed ? `Invitation emailed to ${s.email}. The link works for 7 days.` : `${s.name} was added, but the email did not go. Use “Send the invitation again”.`)
      onOpenChange(false)
    },
    onError: (e) => setErr({ message: errorMessage(e), fields: e instanceof ApiError ? e.fields : {} }),
  })
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Invite someone to the team"
      description="They get an email with a link to choose their password. Nothing is shared until they do."
      size="lg"
      dismissible={!m.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Send />} loading={m.isPending} disabled={!form.name.trim() || !form.email.trim()} onClick={() => m.mutate()}>
            Send invitation
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          m.mutate()
        }}
      >
        {!Object.keys(err.fields).length && <FormError message={err.message} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={err.fields.name}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus autoComplete="off" placeholder="e.g. Hana Yusuf" />
          </Field>
          <Field label="Work email" error={err.fields.email}>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" placeholder="hana@alanwaar.group" />
          </Field>
        </div>
        <Field label="What they can do" error={err.fields.role}>
          <ChoiceCards columns={2} value={form.role} onChange={(role) => setForm({ ...form, role })} options={roleOptions(me?.role === 'owner')} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}

export function StaffRoleDialog({ person, onOpenChange }: { person: StaffUser | null; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient()
  const me = useStaff().user
  const [role, setRole] = useState<Role>('fundraising')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (person) {
      setRole(person.role)
      setError(null)
    }
  }, [person])
  const m = useMutation({
    mutationFn: () => api.patch<StaffUser>(`/admin/staff/${person!.id}`, { role }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['admin', 'staff'] })
      toast.success(`${s.name} is now ${ROLES[s.role].label}. They have been signed out and will see the change when they sign back in.`)
      onOpenChange(false)
    },
    onError: (e) => setError(errorMessage(e)),
  })
  return (
    <Dialog
      open={Boolean(person)}
      onOpenChange={onOpenChange}
      title={person ? `Change ${person.name.split(' ')[0]}’s role` : 'Change role'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={m.isPending} disabled={!person || role === person.role} onClick={() => m.mutate()}>
            Change role
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={error} />
        <ChoiceCards columns={2} value={role} onChange={setRole} options={roleOptions(me?.role === 'owner')} />
        {person && role !== person.role && (
          <Callout tone="neutral">They are signed out everywhere straight away, so the new role applies from their next sign-in.</Callout>
        )}
      </div>
    </Dialog>
  )
}
