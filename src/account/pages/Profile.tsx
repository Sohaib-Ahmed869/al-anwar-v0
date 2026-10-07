import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AtSign, Check, KeyRound, Mail, MapPin, ShieldCheck, Sparkles, Trash2, UserRound, EyeOff, Bell } from 'lucide-react'
import { EMAIL_TOPICS, type EmailTopic } from '../../../shared/domain'
import type { Address } from '../../../shared/types'
import { api, ApiError, errorMessage } from '../../portal/api'
import { SESSION_KEY } from '../../portal/session'
import {
  Badge, Button, Callout, Card, CardHeader, Dialog, Field, FormError, Input, PageHeader, Select, Skeleton, Switch, Textarea, cn, toast,
} from '../../portal/ui'
import { keys, useTitle, type MeDonor } from '../components/data'

/* ---------------------------------------------------------------------------
   Profile — the donor's own details and how we contact them.

   - Name and address are what the tax statement is made out to, so the page
     says so. A brand-new account (created by the first sign-in code, with a
     placeholder name taken from the email) lands here with ?welcome=1 and a
     note asking for their real name.
   - Email preferences save as they are switched: one switch, one request,
     one toast. Receipts and changes to regular gifts are always sent — that
     is said plainly, so switching "everything" off is not a surprise later.
   - Changing the sign-in email proves the new address with a code first.
   - Deleting the account is a request to a person, with the reason why
     (gift records are kept for seven years).
--------------------------------------------------------------------------- */

type ProfileRes = { donor: MeDonor; providers: { google: boolean; facebook: boolean } }

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']

export default function Profile() {
  useTitle('Profile')
  const q = useQuery({ queryKey: keys.profile, queryFn: () => api.get<ProfileRes>('/me/profile') })
  const [params, setParams] = useSearchParams()
  const welcome = params.get('welcome') === '1'

  if (q.isLoading || !q.data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }
  const { donor, providers } = q.data
  return (
    <div>
      <PageHeader title="Profile" description="Your details, how we keep in touch, and how you sign in." meta={<Badge>Supporter {donor.number}</Badge>} />
      {welcome && (
        <Callout
          tone="green"
          icon={<Sparkles />}
          className="mb-6"
          title="Welcome — your account is ready"
          action={
            <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })}>
              Dismiss
            </Button>
          }
        >
          Please add your name below. It is what your receipts and tax statement are made out to — at the moment we only know your email.
        </Callout>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <Details donor={donor} focus={welcome} />
          <AddressCard donor={donor} />
        </div>
        <div className="min-w-0 space-y-6">
          <Preferences donor={donor} />
          <SignIn donor={donor} providers={providers} />
          <DeleteAccount />
        </div>
      </div>
    </div>
  )
}

/** One PATCH for any part of the profile, refreshing the header's name too. */
function useSaveProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch<{ donor: MeDonor }>('/me/profile', body),
    onSuccess: (r) => {
      qc.setQueryData<ProfileRes>(keys.profile, (old) => (old ? { ...old, donor: r.donor } : old))
      qc.invalidateQueries({ queryKey: SESSION_KEY })
      qc.invalidateQueries({ queryKey: keys.overview })
    },
  })
}

/* ---------- name and phone ---------- */
function Details({ donor, focus }: { donor: MeDonor; focus: boolean }) {
  const [v, setV] = useState({ firstName: donor.firstName, lastName: donor.lastName, phone: donor.phone ?? '' })
  const first = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (focus) first.current?.focus()
  }, [focus])
  const save = useSaveProfile()
  const err = save.error instanceof ApiError ? save.error : null
  const dirty = v.firstName !== donor.firstName || v.lastName !== donor.lastName || v.phone !== (donor.phone ?? '')
  return (
    <Card>
      <CardHeader icon={<UserRound />} title="Your details" description="Your receipts and tax statement are made out to this name." />
      <form
        className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate({ firstName: v.firstName.trim(), lastName: v.lastName.trim(), phone: v.phone.trim() }, { onSuccess: () => toast.success('Your details are saved') })
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" error={err?.fields.firstName}>
            <Input ref={first} value={v.firstName} onChange={(e) => setV({ ...v, firstName: e.target.value })} autoComplete="given-name" />
          </Field>
          <Field label="Last name" error={err?.fields.lastName}>
            <Input value={v.lastName} onChange={(e) => setV({ ...v, lastName: e.target.value })} autoComplete="family-name" />
          </Field>
        </div>
        <Field label="Phone" optional help="Only used if there is a problem with a donation." error={err?.fields.phone}>
          <Input type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} autoComplete="tel" inputMode="tel" />
        </Field>
        <FormError message={err && !Object.keys(err.fields).length ? err.message : undefined} />
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={save.isPending} disabled={!dirty || !v.firstName.trim()}>
            Save details
          </Button>
        </div>
      </form>
    </Card>
  )
}

/* ---------- address ---------- */
function AddressCard({ donor }: { donor: MeDonor }) {
  const init: Required<Pick<Address, 'line1' | 'line2' | 'suburb' | 'state' | 'postcode' | 'country'>> = {
    line1: donor.address?.line1 ?? '',
    line2: donor.address?.line2 ?? '',
    suburb: donor.address?.suburb ?? '',
    state: donor.address?.state ?? '',
    postcode: donor.address?.postcode ?? '',
    country: donor.address?.country || 'Australia',
  }
  const [a, setA] = useState(init)
  const save = useSaveProfile()
  const err = save.error instanceof ApiError ? save.error : null
  const dirty = (Object.keys(init) as (keyof typeof init)[]).some((k) => init[k] !== a[k])
  const f = (k: keyof typeof init) => ({ value: a[k], onChange: (e: { target: { value: string } }) => setA({ ...a, [k]: e.target.value }) })
  const australia = a.country.trim().toLowerCase() === 'australia'
  return (
    <Card>
      <CardHeader icon={<MapPin />} title="Address" description="Printed on your tax statement. We do not send post unless you ask." />
      <form
        className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate({ address: Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v.trim()])) }, { onSuccess: () => toast.success('Your address is saved') })
        }}
      >
        <Field label="Street address" error={err?.fields['address.line1']}>
          <Input {...f('line1')} autoComplete="address-line1" />
        </Field>
        <Field label="Unit, building or PO box" optional>
          <Input {...f('line2')} autoComplete="address-line2" />
        </Field>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-[minmax(0,1fr)_110px_110px]">
          <Field label="Suburb" className="col-span-2 sm:col-span-1">
            <Input {...f('suburb')} autoComplete="address-level2" />
          </Field>
          <Field label="State">
            {australia ? (
              <Select {...f('state')} placeholder="—" autoComplete="address-level1">
                {STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            ) : (
              <Input {...f('state')} autoComplete="address-level1" />
            )}
          </Field>
          <Field label="Postcode" error={err?.fields['address.postcode']}>
            <Input {...f('postcode')} autoComplete="postal-code" inputMode={australia ? 'numeric' : 'text'} className="nums" />
          </Field>
        </div>
        <Field label="Country">
          <Input {...f('country')} autoComplete="country-name" />
        </Field>
        <FormError message={err && !Object.keys(err.fields).length ? err.message : undefined} />
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={save.isPending} disabled={!dirty}>
            Save address
          </Button>
        </div>
      </form>
    </Card>
  )
}

/* ---------- email preferences ---------- */
function Preferences({ donor }: { donor: MeDonor }) {
  const save = useSaveProfile()
  const p = donor.preferences
  const update = (patch: Partial<typeof p>, msg: string) =>
    save.mutate({ preferences: patch }, { onSuccess: () => toast.success(msg), onError: (e) => toast.error(errorMessage(e)) })
  const toggleTopic = (t: EmailTopic, on: boolean) => {
    const topics = on ? [...new Set([...p.topics, t])] : p.topics.filter((x) => x !== t)
    update({ topics }, on ? `You will hear about ${EMAIL_TOPICS[t].toLowerCase()}` : `No more emails about ${EMAIL_TOPICS[t].toLowerCase()}`)
  }
  return (
    <Card>
      <CardHeader icon={<Bell />} title="Emails from us" description="Changes save as you switch them." />
      <div className="space-y-5 px-5 pb-5 sm:px-6 sm:pb-6">
        <Switch
          checked={p.emailOptIn}
          disabled={save.isPending}
          onChange={(v) => update({ emailOptIn: v }, v ? 'You will hear from us now and then' : 'You will not get news or appeals by email')}
          label="News and appeals"
          description="A few emails a month at most. Unsubscribe any time from any email."
        />
        <div className={cn('space-y-4 rounded-xl bg-paper-2 px-4 py-4 ring-1 ring-line-2 transition-opacity', !p.emailOptIn && 'opacity-50')}>
          <p className="text-[12.5px] font-medium text-text-2">What would you like to hear about?</p>
          {(Object.keys(EMAIL_TOPICS) as EmailTopic[]).map((t) => (
            <Switch key={t} checked={p.emailOptIn && p.topics.includes(t)} disabled={!p.emailOptIn || save.isPending} onChange={(v) => toggleTopic(t, v)} label={EMAIL_TOPICS[t]} />
          ))}
        </div>
        <p className="flex gap-2 text-[12.5px] leading-relaxed text-text-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          Receipts, your tax statement and anything about your regular donations are always sent, whatever you choose here.
        </p>
        <div className="border-t border-line-2 pt-5">
          <Switch
            checked={p.anonymous}
            disabled={save.isPending}
            onChange={(v) => update({ anonymous: v }, v ? 'Your donations will show as anonymous' : 'Your first name can show with your donations')}
            label={
              <span className="inline-flex items-center gap-1.5">
                <EyeOff className="size-4 text-text-3" /> Give anonymously by default
              </span>
            }
            description="Your name is kept off public supporter lists and fundraising pages. Your receipt still carries your name, as the tax office needs."
          />
        </div>
      </div>
    </Card>
  )
}

/* ---------- sign-in ---------- */
function SignIn({ donor, providers }: { donor: MeDonor; providers: { google: boolean; facebook: boolean } }) {
  const [open, setOpen] = useState(false)
  const methods: { label: string; icon: ReactNode; state: ReactNode }[] = [
    { label: `Email code to ${donor.email}`, icon: <Mail />, state: <Badge tone="green" size="sm">On</Badge> },
  ]
  if (providers.google || donor.linked.google) methods.push({ label: 'Google', icon: <AtSign />, state: donor.linked.google ? <Badge tone="green" size="sm">Linked</Badge> : <span className="text-[12.5px] text-text-3">Sign in with Google once to link it</span> })
  if (providers.facebook || donor.linked.facebook) methods.push({ label: 'Facebook', icon: <AtSign />, state: donor.linked.facebook ? <Badge tone="green" size="sm">Linked</Badge> : <span className="text-[12.5px] text-text-3">Sign in with Facebook once to link it</span> })
  return (
    <Card>
      <CardHeader
        icon={<KeyRound />}
        title="Email and sign-in"
        description="There is no password to remember: we email you a code each time."
      />
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <ul className="divide-y divide-line-2 rounded-xl ring-1 ring-line-2">
          {methods.map((m) => (
            <li key={m.label} className="flex items-center gap-3 px-4 py-3">
              <span className="text-text-3 [&_svg]:size-4">{m.icon}</span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-text">{m.label}</span>
              {m.state}
            </li>
          ))}
        </ul>
        {donor.altEmails.length > 0 && (
          <p className="mt-3 text-[12.5px] leading-relaxed text-text-3">
            Donations made with {donor.altEmails.join(', ')} are also recognised as yours.
          </p>
        )}
        <Button variant="secondary" icon={<Mail />} className="mt-4" onClick={() => setOpen(true)}>
          Change my email
        </Button>
      </div>
      <ChangeEmailDialog open={open} onClose={() => setOpen(false)} current={donor.email} />
    </Card>
  )
}

function ChangeEmailDialog({ open, onClose, current }: { open: boolean; onClose: () => void; current: string }) {
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [devCode, setDevCode] = useState<string | undefined>()
  useEffect(() => {
    if (open) {
      setEmail('')
      setCode('')
      setStage('email')
      setDevCode(undefined)
      send.reset()
      confirm.reset()
    }
  }, [open])
  const send = useMutation({
    mutationFn: () => api.post<{ devCode?: string }>('/me/profile/email', { email }),
    onSuccess: (r) => {
      setDevCode(r.devCode)
      setStage('code')
    },
  })
  const confirm = useMutation({
    mutationFn: () => api.post<{ donor: MeDonor }>('/me/profile/email/confirm', { email, code }),
    onSuccess: (r) => {
      qc.setQueryData<ProfileRes>(keys.profile, (old) => (old ? { ...old, donor: r.donor } : old))
      qc.invalidateQueries({ queryKey: SESSION_KEY })
      toast.success('Your email is changed', { description: `Sign in with ${r.donor.email} from now on.` })
      onClose()
    },
  })
  const sendErr = send.error instanceof ApiError ? send.error : null
  const confirmErr = confirm.error instanceof ApiError ? confirm.error : null
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={stage === 'email' ? 'Change your email' : 'Check your new inbox'}
      description={stage === 'email' ? `You sign in with ${current} at the moment.` : <>We sent a six-digit code to <strong className="text-text">{email}</strong>. It works for 10 minutes.</>}
      footer={
        <>
          <Button variant="secondary" onClick={stage === 'code' ? () => (setStage('email'), send.reset(), confirm.reset()) : onClose}>
            {stage === 'code' ? 'Back' : 'Cancel'}
          </Button>
          {stage === 'email' ? (
            <Button variant="primary" type="submit" form="change-email" loading={send.isPending} disabled={!email.includes('@')}>
              Send a code
            </Button>
          ) : (
            <Button variant="primary" type="submit" form="change-email" loading={confirm.isPending} disabled={!/^\d{6}$/.test(code)}>
              Confirm new email
            </Button>
          )}
        </>
      }
    >
      <form
        id="change-email"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (stage === 'email') send.mutate()
          else confirm.mutate()
        }}
      >
        {stage === 'email' ? (
          <>
            <Field label="New email" error={sendErr?.fields.email ? sendErr.message : sendErr?.message}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="email" leading={<Mail />} />
            </Field>
            <p className="text-[12.5px] leading-relaxed text-text-3">
              Donations made with your old address will still show up here, but it will no longer sign you in. We will email it to say the change was made, and
              you will be signed out on your other devices.
            </p>
          </>
        ) : (
          <>
            {devCode && (
              <Callout tone="teal">
                Development — no email is sent. The code is <strong className="nums tracking-widest">{devCode}</strong>
              </Callout>
            )}
            <Field label="Code" error={confirmErr?.fields.code ? confirmErr.message : undefined}>
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
            <FormError message={confirmErr && !confirmErr.fields.code ? confirmErr.message : sendErr?.message} />
            <button type="button" onClick={() => (confirm.reset(), send.mutate())} disabled={send.isPending} className="text-[13px] font-medium text-green hover:underline">
              Send another code
            </button>
          </>
        )}
      </form>
    </Dialog>
  )
}

/* ---------- deletion ---------- */
function DeleteAccount() {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [sent, setSent] = useState(false)
  const req = useMutation({
    mutationFn: () => api.post('/me/profile/delete-request', { reason: reason.trim() || undefined }),
    onSuccess: () => {
      setSent(true)
      setOpen(false)
      toast.success('Your request is with the team', { description: 'Someone will email you within a few working days.' })
    },
  })
  const err = req.error instanceof ApiError ? req.error : null
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[14.5px] font-semibold text-text">Delete my account</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-text-2">
            {sent || err?.status === 409 ? 'We have your request — someone will be in touch.' : 'Ask us to close your account and remove your details.'}
          </p>
        </div>
        {sent ? (
          <Badge tone="green">
            <Check className="size-3.5" /> Requested
          </Badge>
        ) : (
          <Button variant="secondary" icon={<Trash2 />} onClick={() => setOpen(true)} className="text-red">
            Request deletion
          </Button>
        )}
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Ask us to delete your account?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep my account
            </Button>
            <Button variant="danger" loading={req.isPending} onClick={() => req.mutate()}>
              Send request
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-[14px] leading-relaxed text-text-2">
          <p>A person on the team will close your account, stop any regular donations and remove your details from our mailing lists, then email you to confirm.</p>
          <p>
            Australian tax law asks charities to keep a record of each donation and its receipt for seven years, so those stay — securely, and used for nothing else.
          </p>
          <Field label="Anything we should know?" optional>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </Field>
          <FormError message={err?.message} />
        </div>
      </Dialog>
    </Card>
  )
}
