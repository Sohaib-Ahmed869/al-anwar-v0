import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eye, EyeOff, MailCheck } from 'lucide-react'
import { api, ApiError } from '../api'
import { SESSION_KEY, useSession, type SessionResponse } from '../session'
import { Button } from '../ui/Button'
import { Callout } from '../ui/bits'
import { Checkbox, Field, FormError, Input } from '../ui/Field'
import { FullPageSpinner } from '../ui/Spinner'
import { AuthLayout } from './AuthLayout'
import { can } from '../../../shared/access'

/* Staff sign-in, forgotten password, and the invite / reset link. One sign-in
   for both staff portals: it lands on whichever the person's role opens, or
   on `next` if they were sent here from a page. */

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

export function StaffLogin() {
  const [params] = useSearchParams()
  const next = params.get('next')
  const session = useSession()
  const qc = useQueryClient()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const login = useMutation({
    mutationFn: () => api.post<NonNullable<SessionResponse['staff']>>('/auth/staff/login', { email, password, remember }),
    onSuccess: (staff) => {
      qc.setQueryData<SessionResponse>(SESSION_KEY, (old) => ({ donor: old?.donor ?? null, staff }))
      nav(landingFor(staff, next), { replace: true })
    },
  })
  if (session.isLoading) return <FullPageSpinner />
  if (session.data?.staff && !login.isPending) return <Navigate to={landingFor(session.data.staff, next)} replace />
  const err = login.error instanceof ApiError ? login.error : null

  return (
    <AuthLayout tag="Staff" quote={QUOTE}>
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-text">Welcome back</h1>
      <p className="mt-2 text-[14.5px] text-text-2">Sign in to the Al-Anwaar admin and compliance portals.</p>
      {params.get('expired') && (
        <Callout tone="amber" className="mt-6">
          Your session ended. Sign in again to carry on where you were.
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
    mutationFn: () => api.post<NonNullable<SessionResponse['staff']>>('/auth/staff/reset', { token, password }),
    onSuccess: (staff) => {
      qc.setQueryData<SessionResponse>(SESSION_KEY, (old) => ({ donor: old?.donor ?? null, staff }))
      nav(landingFor(staff, null), { replace: true })
    },
  })
  const err = m.error instanceof ApiError ? m.error : null
  const strength = password.length >= 16 ? 3 : password.length >= 12 ? 2 : password.length >= 10 ? 1 : 0

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
            <Field label="New password" error={err?.fields.password} help="At least 10 characters. A short sentence works well.">
              <PasswordInput autoFocus autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <div className="flex gap-1.5" aria-hidden>
              {[1, 2, 3].map((i) => (
                <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${strength >= i ? (strength === 1 ? 'bg-[#c98a0b]' : 'bg-green') : 'bg-ink/10'}`} />
              ))}
            </div>
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={m.isPending} disabled={password.length < 10}>
              {check.data!.invite ? 'Set password and sign in' : 'Save and sign in'}
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
