import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Copy, Download } from 'lucide-react'
import { api, ApiError } from '../api'
import { Button } from '../ui/Button'
import { Checkbox, Field, FormError, Input } from '../ui/Field'
import { Spinner } from '../ui/Spinner'
import type { SessionResponse } from '../session'

/* ---------------------------------------------------------------------------
   Setting up two-step sign-in, and the recovery codes that come with it.

   Used in two places: part-way through signing in, for a role that must have
   it (StaffAuth.tsx), and from the account menu by anyone who wants it
   (ChangePasswordDialog.tsx). The server works out which: a pending sign-in
   cookie or a session. From a session it first asks for the current password,
   so the dialog does that step itself and hands the result in as `setup`.

   The QR code is the authenticator app's way in; the same secret is printed
   underneath, in groups of four, for an app that can't scan. Nothing is
   switched on until a code from the app proves it has the secret.

   The secret is asked for once per open (React Query, never refetched), so
   React's double render in development can't swap it for a second one after
   the person has scanned the first.
--------------------------------------------------------------------------- */

export type Setup = { secret: string; otpauth: string; qr: string }
export type Enabled = { recoveryCodes: string[] } & Partial<NonNullable<SessionResponse['staff']>>

export function MfaSetup({
  onEnabled,
  onTimeout,
  setup: given,
}: {
  onEnabled: (r: Enabled) => void
  onTimeout?: () => void
  /** already started (after the password, from a session); otherwise this asks */
  setup?: Setup
}) {
  const [nonce] = useState(() => Math.random())
  const [code, setCode] = useState('')
  const asked = useQuery({
    queryKey: ['mfa-setup', nonce],
    queryFn: () => api.post<Setup>('/auth/staff/mfa/setup'),
    enabled: !given,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const setup = given ? { data: given, isLoading: false, error: null } : asked
  const enable = useMutation({
    mutationFn: () => api.post<Enabled>('/auth/staff/mfa/enable', { code }),
    onSuccess: onEnabled,
    onError: (e) => {
      if (e instanceof ApiError && e.fields.session) onTimeout?.()
      setCode('')
    },
  })
  const setupErr = setup.error instanceof ApiError ? setup.error : null
  const err = enable.error instanceof ApiError ? enable.error : null

  if (setup.isLoading) return <div className="grid h-48 place-items-center"><Spinner /></div>
  if (setupErr || !setup.data) {
    return (
      <div className="space-y-4">
        <FormError message={setupErr?.message ?? 'The setup could not start. Try again.'} />
        {setupErr?.fields.session && onTimeout && (
          <Button variant="secondary" onClick={onTimeout}>Back to sign in</Button>
        )}
      </div>
    )
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        enable.mutate()
      }}
    >
      <ol className="space-y-1.5 text-[13.5px] leading-relaxed text-text-2">
        <li>1. Open an authenticator app — Google Authenticator, Microsoft Authenticator, 1Password or similar.</li>
        <li>2. Scan this code with it, or type the key below.</li>
        <li>3. Enter the six-digit code the app shows.</li>
      </ol>
      <div className="flex flex-col items-center gap-3 rounded-xl bg-paper-2 p-4 ring-1 ring-line">
        <img src={setup.data.qr} alt="QR code for your authenticator app" width={180} height={180} className="rounded-lg bg-white p-1" />
        <code className="nums text-center text-[13px] tracking-wider break-all text-text select-all">
          {setup.data.secret.match(/.{1,4}/g)?.join(' ')}
        </code>
      </div>
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
      <FormError message={err && !err.fields.code ? err.message : null} />
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={enable.isPending} disabled={code.length !== 6}>
        Turn on two-step sign-in
      </Button>
    </form>
  )
}

/** The ten recovery codes, shown once. The person must say they've kept them. */
export function RecoveryCodes({ codes, onDone, doneLabel = 'Continue' }: { codes: string[]; onDone: () => void; doneLabel?: string }) {
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const text = `Al-Anwaar recovery codes\nEach code works once, if you lose your authenticator app.\n\n${codes.join('\n')}\n`
  return (
    <div className="space-y-5">
      <p className="text-[13.5px] leading-relaxed text-text-2">
        If you lose your phone, each of these codes signs you in once instead of the app. Keep them somewhere safe — a password manager is ideal.
        This is the only time they are shown.
      </p>
      <ul className="nums grid grid-cols-2 gap-2 rounded-xl bg-paper-2 p-4 font-mono text-[14px] text-text ring-1 ring-line">
        {codes.map((c) => <li key={c} className="text-center">{c}</li>)}
      </ul>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          icon={copied ? <Check /> : <Copy />}
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => setCopied(true))
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button
          variant="secondary"
          icon={<Download />}
          onClick={() => {
            const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
            const a = Object.assign(document.createElement('a'), { href: url, download: 'al-anwaar-recovery-codes.txt' })
            document.body.appendChild(a)
            a.click()
            a.remove()
            setTimeout(() => URL.revokeObjectURL(url), 2000)
          }}
        >
          Download
        </Button>
      </div>
      <Checkbox checked={saved} onChange={setSaved} label="I have saved these codes" />
      <Button variant="primary" size="lg" className="w-full" disabled={!saved} onClick={onDone}>
        {doneLabel}
      </Button>
    </div>
  )
}
