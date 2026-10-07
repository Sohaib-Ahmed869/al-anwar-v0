import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Mail } from 'lucide-react'
import type { Donor } from '../../../shared/types'
import { api, ApiError } from '../api'
import { SESSION_KEY, useSession, type SessionResponse } from '../session'
import { Button } from '../ui/Button'
import { Callout, Divider } from '../ui/bits'
import { Field, FormError, Input } from '../ui/Field'
import { FullPageSpinner } from '../ui/Spinner'
import { cn } from '../ui/cn'
import { AuthLayout } from './AuthLayout'

/* ---------------------------------------------------------------------------
   Donor sign-in. No password: an email, then a six-digit code sent to it —
   the same thing whether they have an account or not, because the first
   time a donor proves the address is theirs, their giving is already waiting
   under it. Google and Facebook appear only when the server has them on.

   The code boxes take a paste of the whole code, move on as each digit lands,
   go back on Backspace, and submit themselves on the sixth — and they use
   autocomplete="one-time-code" so iOS offers the code from Mail. They clear
   after every wrong code, not just the first.

   Google or Facebook can send a donor here (?link=google&email=…) when the
   address they carry already belongs to a record: the provider is linked
   only once an emailed code proves the mailbox (server/routes/auth.ts), so the
   page says so and starts with that address filled in.

   The server limits codes per address (five an hour) and wrong codes per
   day; those refusals arrive as errors from "Send another code" and are
   shown on the code screen too.
--------------------------------------------------------------------------- */

type Providers = { google: boolean; facebook: boolean; devCodes: boolean }

const PROVIDER_NAME: Record<string, string> = { google: 'Google', facebook: 'Facebook' }

export function DonorLogin() {
  const [params] = useSearchParams()
  const next = params.get('next')
  const target = next && next.startsWith('/account') ? next : '/account'
  const session = useSession()
  const qc = useQueryClient()
  const nav = useNavigate()
  const linking = PROVIDER_NAME[params.get('link') ?? '']
  const [email, setEmail] = useState(() => params.get('email') ?? '')
  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [devCode, setDevCode] = useState<string | undefined>()
  const [cooldown, setCooldown] = useState(0)
  const [wrongCodes, setWrongCodes] = useState(0)
  const providers = useQuery({ queryKey: ['providers'], queryFn: () => api.get<Providers>('/auth/providers'), staleTime: Infinity })

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const send = useMutation({
    mutationFn: () => api.post<{ ok: true; devCode?: string }>('/auth/donor/code', { email }),
    onSuccess: (r) => {
      setDevCode(r.devCode)
      setStage('code')
      setCooldown(30)
    },
  })
  const verify = useMutation({
    mutationFn: (code: string) => api.post<{ donor: Donor; created: boolean }>('/auth/donor/verify', { email, code }),
    onSuccess: (r) => {
      qc.setQueryData<SessionResponse>(SESSION_KEY, (old) => ({ staff: old?.staff ?? null, donor: r.donor }))
      nav(r.created ? '/account/profile?welcome=1' : target, { replace: true })
    },
    onError: () => setWrongCodes((n) => n + 1),
  })

  if (session.isLoading) return <FullPageSpinner />
  if (session.data?.donor && !verify.isPending) return <Navigate to={target} replace />

  const sendErr = send.error instanceof ApiError ? send.error : null
  const verifyErr = verify.error instanceof ApiError ? verify.error : null

  return (
    <AuthLayout image="/assets/images/give-children-1200.jpg" quote={{ text: 'Charity does not decrease wealth.', cite: 'Hadith, reported by Muslim' }}>
      {stage === 'email' ? (
        <>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-text">Your giving, in one place</h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-text-2">
            Every donation and receipt, your regular donations — and your tax statement at the end of June. Enter the email you give with.
          </p>
          {linking && (
            <Callout tone="teal" className="mt-6">
              You already have an account with this email. Enter the code we send to it to sign in, and {linking} will be linked so it works next time.
            </Callout>
          )}
          {params.get('error') === 'oauth' && (
            <Callout tone="amber" className="mt-6">
              That sign-in did not go through. Try again, or use your email.
            </Callout>
          )}
          {params.get('expired') && (
            <Callout tone="amber" className="mt-6">
              You were signed out. Sign in again to carry on.
            </Callout>
          )}
          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              send.mutate()
            }}
          >
            <Field label="Email" error={sendErr?.fields.email ?? (sendErr && !Object.keys(sendErr.fields).length ? sendErr.message : undefined)}>
              <Input type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" leading={<Mail />} />
            </Field>
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={send.isPending} disabled={!email.includes('@')}>
              Email me a code
            </Button>
          </form>
          {(providers.data?.google || providers.data?.facebook) && (
            <>
              <Divider label="or" className="my-6" />
              <div className="space-y-2.5">
                {providers.data.google && (
                  <a href="/api/auth/donor/oauth/google" className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-paper text-[14.5px] font-medium ring-1 ring-line ring-inset transition-colors hover:bg-paper-2">
                    <GoogleMark /> Continue with Google
                  </a>
                )}
                {providers.data.facebook && (
                  <a href="/api/auth/donor/oauth/facebook" className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#1877F2] text-[14.5px] font-medium text-white transition-colors hover:bg-[#166fe0]">
                    <FacebookMark /> Continue with Facebook
                  </a>
                )}
              </div>
            </>
          )}
          <p className="mt-8 text-[12.5px] leading-relaxed text-text-3">
            New here? The same code creates your account, and any donations you have already made with this email appear in it.
          </p>
          {import.meta.env.DEV && (
            <p className="mt-4 rounded-xl bg-paper-2 px-4 py-3 text-[12.5px] text-text-2 ring-1 ring-line">
              <strong className="text-text">Development:</strong> try <code className="rounded bg-paper px-1">amina.rahman@example.com</code> — the code is shown on the next screen.
            </p>
          )}
        </>
      ) : (
        <>
          <button type="button" onClick={() => (setStage('email'), verify.reset(), send.reset())} className="mb-8 inline-flex items-center gap-1.5 text-[13px] font-medium text-text-2 hover:text-text">
            <ArrowLeft className="size-4" /> Use a different email
          </button>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-text">Check your email</h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-text-2">
            We sent a six-digit code to <strong className="text-text">{email}</strong>. It works for 10 minutes.
          </p>
          {devCode && (
            <Callout tone="teal" className="mt-5">
              Development — no email is sent. Your code is <strong className="nums tracking-widest">{devCode}</strong>
            </Callout>
          )}
          <div className="mt-8">
            <CodeInput disabled={verify.isPending} invalid={Boolean(verifyErr)} resetKey={wrongCodes} onComplete={(c) => verify.mutate(c)} />
            <div className="mt-3 min-h-5">
              <FormError message={verifyErr?.message ?? sendErr?.message} />
            </div>
          </div>
          <Button variant="primary" size="lg" className="mt-2 w-full" loading={verify.isPending} disabled>
            {verify.isPending ? 'Signing in' : 'Enter the code above'}
          </Button>
          <p className="mt-6 text-center text-[13px] text-text-2">
            Nothing arrived?{' '}
            <button type="button" disabled={cooldown > 0 || send.isPending} onClick={() => send.mutate()} className="font-medium text-green hover:underline disabled:text-text-3 disabled:no-underline">
              {cooldown > 0 ? `Send again in ${cooldown}s` : 'Send another code'}
            </button>
          </p>
        </>
      )}
    </AuthLayout>
  )
}

function CodeInput({ onComplete, disabled, invalid, resetKey }: { onComplete: (c: string) => void; disabled?: boolean; invalid?: boolean; resetKey: number }) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const refs = useRef<(HTMLInputElement | null)[]>([])
  useEffect(() => {
    refs.current[0]?.focus()
  }, [])
  /* every wrong code clears the boxes, including a second one in a row */
  useEffect(() => {
    if (resetKey > 0) {
      setDigits(Array(6).fill(''))
      refs.current[0]?.focus()
    }
  }, [resetKey])

  const set = (i: number, v: string) => {
    const clean = v.replace(/\D/g, '')
    if (clean.length > 1) {
      const next = clean.slice(0, 6).split('')
      const full = [...next, ...Array(6 - next.length).fill('')]
      setDigits(full)
      refs.current[Math.min(5, next.length)]?.focus()
      if (next.length === 6) onComplete(next.join(''))
      return
    }
    const d = [...digits]
    d[i] = clean
    setDigits(d)
    if (clean && i < 5) refs.current[i + 1]?.focus()
    if (d.every(Boolean)) onComplete(d.join(''))
  }
  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Six-digit code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1}`}
          maxLength={i === 0 ? 6 : 1}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus()
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
            if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus()
          }}
          onFocus={(e) => e.target.select()}
          className={cn(
            'nums h-14 w-full min-w-0 rounded-xl bg-paper text-center text-[24px] font-semibold text-text ring-1 ring-inset transition-all sm:h-16',
            'focus:ring-2 focus:ring-green focus:outline-none disabled:opacity-60',
            invalid ? 'ring-red/60' : d ? 'ring-green/40' : 'ring-line',
          )}
        />
      ))}
    </div>
  )
}

const GoogleMark = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" />
    <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
    <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
    <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
  </svg>
)
const FacebookMark = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
    <path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" />
  </svg>
)
