import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { passwordProblem } from '../../../shared/password-policy'
import { api, ApiError } from '../api'
import { useStaff } from '../session'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Field, FormError, Input } from '../ui/Field'
import { MfaSetup, RecoveryCodes, type Setup } from './MfaSetup'

/* ---------------------------------------------------------------------------
   The account menu's "Change password": the password, and under it the
   person's two-step sign-in — on or off, set it up, move it to a new phone,
   new recovery codes, or turn it off. Nothing here can be done with the
   session alone, so one left open on someone's desk can't quietly change it:
   setting up or moving to a new phone asks for the current password, turning
   it off needs a code from the app, and new recovery codes take either (the
   password is how someone who signed in with a recovery code, phone lost,
   gets a fresh set). Roles that must use it (owner, admin, finance, in
   production) can't turn it off; the server refuses as well.

   The password rules are shared/password-policy.ts, the same function the
   server applies; here it only decides when the button can be pressed.
--------------------------------------------------------------------------- */

type MfaStatus = { enabled: boolean; required: boolean; enabledAt?: string; recoveryCodesLeft: number }
const MFA_KEY = ['staff-mfa'] as const

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useStaff()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [mfaOpen, setMfaOpen] = useState(false)
  const mfa = useQuery({ queryKey: MFA_KEY, queryFn: () => api.get<MfaStatus>('/auth/staff/mfa'), enabled: open })
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
  const problem = next ? passwordProblem(next, user?.email) : null
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title="Password and sign-in"
        description="Changing your password signs you out everywhere else."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={m.isPending} onClick={() => m.mutate()} disabled={!current || !next || Boolean(problem)}>
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
          <Field
            label="New password"
            help={next.length >= 10 && problem ? problem : 'At least 10 characters. A short sentence is easier to remember than symbols.'}
            error={err?.fields.next}
          >
            <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <button type="submit" hidden />
        </form>
        <div className="mt-6 flex items-center gap-3 rounded-xl px-4 py-3 ring-1 ring-line">
          <ShieldCheck className="size-5 shrink-0 text-green" />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium text-text">Two-step sign-in</p>
            <p className="text-[12.5px] text-text-3">
              {mfa.data?.enabled ? `${mfa.data.recoveryCodesLeft} recovery codes left` : 'A code from your phone as well as your password'}
            </p>
          </div>
          {mfa.data && (mfa.data.enabled ? <Badge tone="green">On</Badge> : <Badge tone="neutral">Off</Badge>)}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onOpenChange(false)
              setMfaOpen(true)
            }}
          >
            {mfa.data?.enabled ? 'Manage' : 'Set up'}
          </Button>
        </div>
      </Dialog>
      <MfaDialog open={mfaOpen} onOpenChange={setMfaOpen} status={mfa.data} />
    </>
  )
}

type Mode = 'menu' | 'confirm' | 'setup' | 'codes' | 'off' | 'renew'

function MfaDialog({ open, onOpenChange, status }: { open: boolean; onOpenChange: (v: boolean) => void; status?: MfaStatus }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<Mode>('menu')
  const [codes, setCodes] = useState<string[]>([])
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  /* renewing codes with the password instead of the app (phone lost) */
  const [byPassword, setByPassword] = useState(false)
  const [setupData, setSetupData] = useState<Setup | null>(null)
  const close = (v: boolean) => {
    onOpenChange(v)
    if (!v) {
      setMode('menu')
      setCode('')
      setPassword('')
      setByPassword(false)
      setSetupData(null)
      setCodes([])
      action.reset()
      start.reset()
    }
  }
  /* the password step before an app is set up or replaced */
  const start = useMutation({
    mutationFn: () => api.post<Setup>(status?.enabled ? '/auth/staff/mfa/replace' : '/auth/staff/mfa/setup', { password }),
    onSuccess: (s) => {
      setPassword('')
      setSetupData(s)
      setMode('setup')
    },
  })
  const startErr = start.error instanceof ApiError ? start.error : null
  const action = useMutation({
    mutationFn: (what: 'off' | 'renew') =>
      api.post<{ ok?: true; recoveryCodes?: string[] }>(
        what === 'off' ? '/auth/staff/mfa/disable' : '/auth/staff/mfa/recovery-codes',
        what === 'renew' && byPassword ? { password } : { code },
      ),
    onSuccess: (r, what) => {
      qc.invalidateQueries({ queryKey: MFA_KEY })
      setCode('')
      if (what === 'off') {
        toast.success('Two-step sign-in is off.')
        close(false)
      } else {
        setCodes(r.recoveryCodes ?? [])
        setMode('codes')
      }
      setPassword('')
    },
    onError: () => {
      setCode('')
      setPassword('')
    },
  })
  const err = action.error instanceof ApiError ? action.error : null
  const enabled = status?.enabled
  const effective: Mode = mode === 'menu' && !enabled ? 'confirm' : mode

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      size="sm"
      dismissible={effective !== 'codes'}
      title={
        effective === 'codes'
          ? 'Save your recovery codes'
          : effective === 'setup' || effective === 'confirm'
            ? enabled
              ? 'Move to a new phone'
              : 'Set up two-step sign-in'
            : 'Two-step sign-in'
      }
    >
      {effective === 'confirm' && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            start.mutate()
          }}
        >
          <p className="text-[13.5px] leading-relaxed text-text-2">
            {enabled
              ? 'Set up the app on your new phone. Your old phone, and your old recovery codes, stop working once the new app is confirmed. First, your current password.'
              : 'First, your current password — so nobody can set this up from a computer you left signed in.'}
          </p>
          <Field label="Current password" error={startErr?.fields.password ? startErr.message : undefined}>
            <Input type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <FormError message={startErr && !startErr.fields.password ? startErr.message : null} />
          <div className="flex gap-2">
            {enabled && (
              <Button variant="secondary" className="flex-1" onClick={() => setMode('menu')}>
                Back
              </Button>
            )}
            <Button type="submit" variant="primary" className="flex-1" loading={start.isPending} disabled={!password}>
              Continue
            </Button>
          </div>
        </form>
      )}
      {effective === 'setup' && setupData && (
        <MfaSetup
          setup={setupData}
          onEnabled={(r) => {
            qc.invalidateQueries({ queryKey: MFA_KEY })
            setCodes(r.recoveryCodes)
            setMode('codes')
          }}
        />
      )}
      {effective === 'codes' && <RecoveryCodes codes={codes} doneLabel="Done" onDone={() => close(false)} />}
      {effective === 'menu' && (
        <div className="space-y-3">
          <p className="text-[13.5px] leading-relaxed text-text-2">
            Signing in asks for a code from your authenticator app. You have {status?.recoveryCodesLeft ?? 0} recovery codes left for a lost phone.
          </p>
          <Button variant="secondary" className="w-full" onClick={() => setMode('renew')}>
            Make new recovery codes
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => setMode('confirm')}>
            Move to a new phone
          </Button>
          {status?.required ? (
            <p className="text-[12.5px] text-text-3">Your role must use two-step sign-in, so it can't be turned off.</p>
          ) : (
            <Button variant="ghost" className="w-full text-red" onClick={() => setMode('off')}>
              Turn off two-step sign-in
            </Button>
          )}
        </div>
      )}
      {(effective === 'off' || effective === 'renew') && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            action.mutate(effective)
          }}
        >
          <p className="text-[13.5px] leading-relaxed text-text-2">
            {effective === 'off'
              ? 'Enter a code from your app to turn two-step sign-in off.'
              : byPassword
                ? 'Enter your current password. Your old recovery codes stop working as soon as the new ones are made.'
                : 'Enter a code from your app. Your old recovery codes stop working as soon as the new ones are made.'}
          </p>
          {effective === 'renew' && byPassword ? (
            <Field label="Current password" error={err?.fields.password ? err.message : undefined}>
              <Input type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          ) : (
            <Field label="Code from the app" error={err?.fields.code ? err.message : undefined}>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                className="nums text-center text-[20px] tracking-[.4em]"
                placeholder="••••••"
              />
            </Field>
          )}
          <FormError message={err && !err.fields.code && !err.fields.password ? err.message : null} />
          {effective === 'renew' && (
            <button
              type="button"
              onClick={() => {
                setByPassword((v) => !v)
                setCode('')
                setPassword('')
                action.reset()
              }}
              className="text-[13px] font-medium text-green hover:underline"
            >
              {byPassword ? 'Use a code from my app instead' : 'Lost your phone? Use your password instead'}
            </button>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setMode('menu')}>
              Back
            </Button>
            <Button type="submit" variant={effective === 'off' ? 'danger' : 'primary'} className="flex-1" loading={action.isPending} disabled={effective === 'renew' && byPassword ? !password : code.length !== 6}>
              {effective === 'off' ? 'Turn off' : 'Make new codes'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
