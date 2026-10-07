import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eye, EyeOff, MailCheck, ShieldCheck } from 'lucide-react'
import { passwordProblem } from '../../../shared/password-policy'
import { api, ApiError } from '../api'
import { SESSION_KEY, useSession, type SessionResponse } from '../session'
import { Button } from '../ui/Button'
import { Callout } from '../ui/bits'
import { Checkbox, Field, FormError, Input } from '../ui/Field'
import { FullPageSpinner } from '../ui/Spinner'
import { AuthLayout } from './AuthLayout'
import { MfaSetup, RecoveryCodes, type Enabled } from './MfaSetup'
import { can } from '../../../shared/access'

/* Staff sign-in, forgotten password, and the invite / reset link. One sign-in
   for both staff portals: it lands on whichever the person's role opens, or
   on `next` if they were sent here from a page.

   Signing in can take a second step (server/lib/mfa.ts): after the password
   the server may answer { mfa: 'challenge' } — enter the code from your
   authenticator app, or a recovery code — or { mfa: 'enrol' } for a role
   that must use one and hasn't set it up, which walks through the setup and
   shows the recovery codes before anything opens. A reset or invite link can
   answer the same way, and hands over to this page at that step. */

const QUOTE = { text: 'The best of people are those who are most beneficial to people.', cite: 'Hadith, reported by al-Tabarani' }

function landingFor(s: NonNullable<SessionResponse['staff']>, next: string | null) {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  if (can(s.user.role, 'dashboard.view')) return '/admin'
  if (can(s.user.role, 'compliance.read')) return '/compliance'
  return '/admin/gifts'
}

function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false)
  return (
    <Input
      {...props}
      type={show ? 'text' : 'password'}
      trailing={
        <button type="button" onClick={() => setShow((v) => !v)} className="grid size-8 place-items-center rounded-md text-text-3 hover:text-text" aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  )
}

type StaffSession = NonNullable<SessionResponse['staff']>
type SignInReply = StaffSession | { mfa: 'challenge' | 'enrol' }
type Stage = 'password' | 'challenge' | 'enrol' | 'codes'

export function StaffLogin() {
  const [params] = useSearchParams()
  const next = params.get('next')
  const loc = useLocation()
  const handedOver = (loc.state as { mfa?: 'challenge' | 'enrol' } | null)?.mfa
  const session = useSession()
  const qc = useQueryClient()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [stage, setStage] = useState<Stage>(handedOver ?? 'password')
  const [timedOut, setTimedOut] = useState(false)
  const [enabled, setEnabled] = useState<Enabled | null>(null)

  const finish = (staff: StaffSession) => {
    qc.setQueryData<SessionResponse>(SESSION_KEY, (old) => ({ donor: old?.donor ?? null, staff }))
    nav(landingFor(staff, next), { replace: true })
  }
  /* back to the password. The router state a reset link handed over (the
     stage it reached) is dropped too, or a reload would land on the second
     step again with a pending sign-in that is no longer there. */
  const back = () => {
    nav(`${loc.pathname}${loc.search}`, { replace: true, state: null })
    setStage('password')
    setPassword('')
  }
  const restart = () => {
    back()
    setTimedOut(true)
  }
  const login = useMutation({
    mutationFn: () => api.post<SignInReply>('/auth/staff/login', { email, password, remember }),
    onSuccess: (r) => {
      setTimedOut(false)
      if ('mfa' in r) setStage(r.mfa)
      else finish(r)
    },
  })
  if (session.isLoading) return <FullPageSpinner />
  if (session.data?.staff && !login.isPending && stage !== 'codes') return <Navigate to={landingFor(session.data.staff, next)} replace />
  const err = login.error instanceof ApiError ? login.error : null

  if (stage === 'challenge') {
    return (
      <AuthLayout tag="Staff" quote={QUOTE}>
        <SecondStep onDone={finish} onTimeout={restart} onBack={back} />
      </AuthLayout>
    )
  }
  if (stage === 'enrol') {
    return (
      <AuthLayout tag="Staff" quote={QUOTE}>
        <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-green-50 text-green">
          <ShieldCheck className="size-6" />
        </div>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Set up two-step sign-in</h1>
        <p className="mt-2 mb-6 text-[14.5px] leading-relaxed text-text-2">
          Your role can move money and see every donor, so signing in takes a code from an app on your phone as well as your password.
        </p>
        <MfaSetup
          onTimeout={restart}
          onEnabled={(r) => {
            setEnabled(r)
            setStage('codes')
          }}
        />
      </AuthLayout>
    )
  }
  if (stage === 'codes' && enabled) {
    return (
      <AuthLayout tag="Staff" quote={QUOTE}>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Save your recovery codes</h1>
        <div className="mt-4">
          <RecoveryCodes codes={enabled.recoveryCodes} onDone={() => enabled.user && finish({ user: enabled.user, permissions: enabled.permissions ?? [] })} />
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout tag="Staff" quote={QUOTE}>
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-text">Welcome back</h1>
      <p className="mt-2 text-[14.5px] text-text-2">Sign in to the Al-Anwaar admin and compliance portals.</p>
      {params.get('expired') && !timedOut && (
        <Callout tone="amber" className="mt-6">
          Your session ended. Sign in again to carry on where you were.
        </Callout>
      )}
      {timedOut && (
        <Callout tone="amber" className="mt-6">
          That sign-in timed out. Enter your password again.
        </Callout>
      )}
      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          login.mutate()
        }}
      >
        <FormError message={err && !Object.keys(err.fields).length ? err.message : null} />
        <Field label="Email" error={err?.fields.email}>
          <Input type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@alanwaar.group" />
        </Field>
        <Field
          label="Password"
          error={err?.fields.password}
          action={
            <Link to="/admin/forgot" className="text-[12.5px] font-medium text-green hover:underline">
              Forgotten it?
            </Link>
          }
        >
          <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Checkbox checked={remember} onChange={setRemember} label="Keep me signed in on this device" />
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={login.isPending}>
          Sign in
        </Button>
      </form>
      {import.meta.env.DEV && (
        <p className="mt-6 rounded-xl bg-paper-2 px-4 py-3 text-[12.5px] leading-relaxed text-text-2 ring-1 ring-line">
          <strong className="text-text">Development:</strong> every seeded login uses the password <code className="rounded bg-paper px-1">alanwaar-demo</code> —
          yusuf@ (owner), omar@ (finance), fatima@ (fundraising), khalid@ (compliance), bilal@ (volunteer) @alanwaar.group.
        </p>
      )}
    </AuthLayout>
  )
}

/** The code from the authenticator app, or a recovery code instead. */
function SecondStep({ onDone, onTimeout, onBack }: { onDone: (s: StaffSession) => void; onTimeout: () => void; onBack: () => void }) {
  const [useRecovery, setUseRecovery] = useState(false)
  const [code, setCode] = useState('')
  const m = useMutation({
    mutationFn: () => api.post<StaffSession>('/auth/staff/mfa', useRecovery ? { recoveryCode: code } : { code }),
    onSuccess: onDone,
    onError: (e) => {
      if (e instanceof ApiError && e.fields.session) onTimeout()
      setCode('')
    },
  })
  const err = m.error instanceof ApiError ? m.error : null
  const fieldErr = err?.fields.code || err?.fields.recoveryCode ? err.message : undefined
  return (
    <>
      <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-green-50 text-green">
        <ShieldCheck className="size-6" />
      </div>
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Two-step sign-in</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-text-2">
        {useRecovery ? 'Enter one of the recovery codes you saved when you set this up. Each works once.' : 'Enter the six-digit code from your authenticator app.'}
      </p>
      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          m.mutate()
        }}
      >
        <Field label={useRecovery ? 'Recovery code' : 'Code'} error={fieldErr}>
          {useRecovery ? (
            <Input key="rc" value={code} onChange={(e) => setCode(e.target.value.slice(0, 20))} autoFocus autoComplete="off" placeholder="xxxx-xxxx" className="nums text-center tracking-widest" />
          ) : (
            <Input
              key="totp"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              className="nums text-center text-[20px] tracking-[.4em]"
              placeholder="••••••"
            />
          )}
        </Field>
        <FormError message={err && !fieldErr ? err.message : null} />
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={m.isPending} disabled={useRecovery ? code.trim().length < 8 : code.length !== 6}>
          Sign in
        </Button>
      </form>
      <button
        type="button"
        onClick={() => {
          setUseRecovery((v) => !v)
          setCode('')
          m.reset()
        }}
        className="mt-6 text-[13px] font-medium text-green hover:underline"
      >
        {useRecovery ? 'Use the code from my app' : 'Lost your phone? Use a recovery code'}
      </button>
      <button type="button" onClick={onBack} className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-text-2 hover:text-text">
        <ArrowLeft className="size-4" /> Back to sign in
      </button>
    </>
  )
}

export function StaffForgot() {
  const [email, setEmail] = useState('')
  const m = useMutation({ mutationFn: () => api.post('/auth/staff/forgot', { email }) })
  const err = m.error instanceof ApiError ? m.error : null
  return (
    <AuthLayout tag="Staff" quote={QUOTE}>
      <Link to="/admin/login" className="mb-8 inline-flex items-center gap-1.5 text-[13px] font-medium text-text-2 hover:text-text">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
      {m.isSuccess ? (
        <div>
          <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-green-50 text-green">
            <MailCheck className="size-6" />
          </div>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Check your email</h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-text-2">
            If <strong className="text-text">{email}</strong> has a staff login, a link to choose a new password is on its way. It works for one hour.
          </p>
        </div>
      ) : (
        <>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Reset your password</h1>
          <p className="mt-2 text-[14.5px] text-text-2">We will email you a link to choose a new one.</p>
          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              m.mutate()
            }}
          >
            <Field label="Email" error={err?.fields.email ?? (err ? err.message : undefined)}>
              <Input type="email" autoFocus autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={m.isPending}>
              Send the link
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  )
}

export function StaffReset() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const qc = useQueryClient()
  const nav = useNavigate()
  const [password, setPassword] = useState('')
  const check = useQuery({
    queryKey: ['staff-token', token],
    queryFn: () => api.get<{ name: string; email: string; invite: boolean }>(`/auth/staff/token/${encodeURIComponent(token)}`),
    enabled: Boolean(token),
    retry: false,
  })
  const m = useMutation({
    mutationFn: () => api.post<SignInReply>('/auth/staff/reset', { token, password }),
    onSuccess: (r) => {
      /* the password is set; if a second step is due, the sign-in page takes it from here */
      if ('mfa' in r) {
        nav('/admin/login', { replace: true, state: { mfa: r.mfa } })
        return
      }
      qc.setQueryData<SessionResponse>(SESSION_KEY, (old) => ({ donor: old?.donor ?? null, staff: r }))
      nav(landingFor(r, null), { replace: true })
    },
  })
  const err = m.error instanceof ApiError ? m.error : null
  const problem = password ? passwordProblem(password, check.data?.email) : null
  const strength = !password ? 0 : problem ? (password.length >= 10 ? 1 : 0) : password.length >= 16 ? 3 : password.length >= 12 ? 2 : 1

  return (
    <AuthLayout tag="Staff" quote={QUOTE}>
      {check.isLoading ? (
        <FullPageSpinner />
      ) : check.isError || !token ? (
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">This link has expired</h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-text-2">Links work for a limited time. Ask for a new one, or ask an administrator to resend your invite.</p>
          <Link to="/admin/forgot" className="mt-6 inline-block text-[14px] font-medium text-green hover:underline">
            Send me a new link
          </Link>
        </div>
      ) : (
        <>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{check.data!.invite ? `Welcome, ${check.data!.name.split(' ')[0]}` : 'Choose a new password'}</h1>
          <p className="mt-2 text-[14.5px] text-text-2">
            {check.data!.invite ? 'Choose a password to finish setting up your login.' : 'For'} <strong className="text-text">{check.data!.email}</strong>
          </p>
          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              m.mutate()
            }}
          >
            <FormError message={err && !Object.keys(err.fields).length ? err.message : null} />
            <Field label="New password" error={err?.fields.password} help={password.length >= 10 && problem ? problem : 'At least 10 characters. A short sentence works well.'}>
              <PasswordInput autoFocus autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <div className="flex gap-1.5" aria-hidden>
              {[1, 2, 3].map((i) => (
                <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${strength >= i ? (strength === 1 ? 'bg-[#c98a0b]' : 'bg-green') : 'bg-ink/10'}`} />
              ))}
            </div>
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={m.isPending} disabled={Boolean(problem) || !password}>
              {check.data!.invite ? 'Set password and sign in' : 'Save and sign in'}
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
