import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, Eye, Hourglass, Info } from 'lucide-react'
import { COUNTRIES, FUNDRAISER_OCCASIONS, type FundraiserOccasion } from '../../../shared/domain'
import { api, ApiError } from '../../portal/api'
import { useDonor } from '../../portal/session'
import { formatDate, formatMoney, parseMoney, toInputDate } from '../../portal/format'
import {
  Avatar, Button, Callout, Card, ChoiceCards, Field, FormError, Input, MoneyInput, PageHeader, Progress, Skeleton, Textarea, cn, toast,
} from '../../portal/ui'
import { keys, useTitle, type MyFundraiser, type OpenAppeal } from '../components/data'

/* ---------------------------------------------------------------------------
   Start or edit a fundraising page, in three friendly steps:
     1. Appeal & occasion   what it is for, and why now
     2. Story & target      the words people read, and the number
     3. Review              everything once more, and what happens next

   A live preview sits beside the form (below it on a phone) and looks like
   the card on the public site, so nobody has to imagine the result.

   Editing a page that is already live: the title and story are what the team
   approves, so changing them sends the page back into the approval queue.
   The page says so before saving, not after. Target and end date are the
   supporter's own and change straight away. The appeal is fixed once a page
   exists — gifts have already been made to it.
--------------------------------------------------------------------------- */

type Form = { appeal: string; occasion: FundraiserOccasion; title: string; story: string; target: string; endsAt: string }

const STEPS = [
  { long: 'Appeal & occasion', short: 'Appeal' },
  { long: 'Story & target', short: 'Story' },
  { long: 'Review', short: 'Review' },
]

const STORY_PROMPTS = [
  'Why this appeal matters to you',
  'What the money will do — "every $50 feeds a family for a month"',
  'Your deadline, and why',
]

export default function FundraiserEdit() {
  const { id = 'new' } = useParams()
  const isNew = id === 'new'
  const nav = useNavigate()
  const qc = useQueryClient()
  const donor = useDonor()
  useTitle(isNew ? 'Start a fundraiser' : 'Edit fundraiser')

  const appeals = useQuery({ queryKey: keys.appeals, queryFn: () => api.get<{ items: OpenAppeal[] }>('/me/fundraisers/appeals'), staleTime: 5 * 60_000 })
  const existing = useQuery({
    queryKey: keys.fundraiser(id),
    queryFn: () => api.get<{ fundraiser: MyFundraiser }>(`/me/fundraisers/${id}`),
    enabled: !isNew,
  })
  const f = existing.data?.fundraiser

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Form>({ appeal: '', occasion: 'birthday', title: '', story: '', target: '1000', endsAt: '' })
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (f) {
      setForm({ appeal: f.appeal, occasion: f.occasion, title: f.title, story: f.story, target: String(f.target / 100), endsAt: toInputDate(f.endsAt) })
      setStep(1)
    }
  }, [f])
  const set = (patch: Partial<Form>) => setForm((x) => ({ ...x, ...patch }))

  const appeal = appeals.data?.items.find((a) => a.id === form.appeal) ?? (f ? { id: f.appeal, title: f.appealTitle, country: '', slug: '', target: 0, raised: 0 } : undefined)
  const cents = parseMoney(form.target)
  const errs = useMemo(() => {
    const e: Partial<Record<keyof Form, string>> = {}
    if (!form.appeal) e.appeal = 'Choose the appeal your page supports'
    if (form.title.trim().length < 6) e.title = 'Give your page a title of at least a few words'
    if (form.story.trim().length < 40) e.story = `A few sentences at least — ${Math.max(0, 40 - form.story.trim().length)} more characters`
    if (!Number.isFinite(cents) || cents < 100_00) e.target = 'Set a target of at least $100'
    if (form.endsAt && new Date(form.endsAt) <= new Date()) e.endsAt = 'Choose a date in the future'
    return e
  }, [form, cents])
  const stepValid = [!errs.appeal, !errs.title && !errs.story && !errs.target && !errs.endsAt, true]

  const wordsChanged = f && (form.title.trim() !== f.title || form.story.trim() !== f.story)
  const willResubmit = Boolean(f && ((f.status === 'live' && wordsChanged) || f.status === 'changes'))

  const save = useMutation({
    mutationFn: () => {
      const body = {
        occasion: form.occasion,
        title: form.title.trim(),
        story: form.story.trim(),
        target: cents,
        endsAt: form.endsAt ? new Date(`${form.endsAt}T23:59:00`).toISOString() : null,
      }
      return isNew
        ? api.post<{ fundraiser: MyFundraiser }>('/me/fundraisers', { ...body, appeal: form.appeal })
        : api.patch<{ fundraiser: MyFundraiser; resubmitted: boolean }>(`/me/fundraisers/${id}`, body)
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: keys.all })
      if (isNew) toast.success('Your page is with the team', { description: 'We read every page before it goes public — usually within a working day. We will email you.' })
      else if ('resubmitted' in r && r.resubmitted) toast.success('Saved and sent for a quick check', { description: 'We will email you as soon as it is live again.' })
      else toast.success('Your fundraiser is updated')
      nav('/account/fundraisers')
    },
  })
  const serverErr = save.error instanceof ApiError ? save.error : null
  const fieldErr = (k: keyof Form) => serverErr?.fields[k] ?? (touched ? errs[k] : undefined)

  const next = () => {
    if (!stepValid[step]) {
      setTouched(true)
      return
    }
    setTouched(false)
    setStep((s) => Math.min(2, s + 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!isNew && existing.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }
  if (f && (f.status === 'ended' || f.status === 'rejected')) {
    return (
      <div>
        <PageHeader title={f.title} crumbs={[{ label: 'Fundraisers', to: '/account/fundraisers' }, { label: 'Edit' }]} />
        <Callout tone="neutral" icon={<Info />}>
          {f.status === 'ended' ? 'This page has ended, so it can no longer be changed.' : 'This page was not approved, so it cannot be edited. You are welcome to start a new one.'}
        </Callout>
      </div>
    )
  }

  const ownerName = donor ? `${donor.firstName} ${donor.lastName}`.trim() : 'You'

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'Fundraisers', to: '/account/fundraisers' }, { label: isNew ? 'New' : 'Edit' }]}
        title={isNew ? 'Start a fundraiser' : 'Edit your fundraiser'}
        description={isNew ? 'Three short steps. Nothing goes public until the team has read it.' : undefined}
      />

      <ol className="mb-6 flex gap-2" aria-label="Steps">
        {STEPS.map((s, i) => {
          const done = i < step
          const on = i === step
          const reachable = i <= step || stepValid.slice(0, i).every(Boolean)
          return (
            <li key={s.long} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => setStep(i)}
                aria-current={on ? 'step' : undefined}
                className="group flex w-full flex-col gap-2 text-left disabled:cursor-default"
              >
                <span className={cn('h-1 rounded-full transition-colors', done || on ? 'bg-green' : 'bg-ink/10')} />
                <span className={cn('flex items-center gap-1.5 truncate text-[12.5px] font-medium', on ? 'text-text' : done ? 'text-green' : 'text-text-3')}>
                  {done && <Check className="size-3.5 shrink-0" />}
                  <span className="hidden sm:inline">
                    {i + 1}. {s.long}
                  </span>
                  <span className="sm:hidden">{s.short}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <Card className="min-w-0 p-5 sm:p-7">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (step < 2) next()
              else save.mutate()
            }}
            className="space-y-6"
          >
            {step === 0 && (
              <>
                {!isNew ? (
                  <p className="text-[13.5px] text-text-2">
                    For <strong className="font-medium text-text">{appeal?.title}</strong> — the appeal cannot change once a page exists, because donations have already been made to it.
                  </p>
                ) : (
                <Field label="Which appeal will your page support?" error={fieldErr('appeal')}>
                  {appeals.isLoading ? (
                    <Skeleton className="h-48 rounded-xl" />
                  ) : (
                    <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                      {appeals.data?.items.map((a) => {
                        const on = form.appeal === a.id
                        return (
                          <button
                            key={a.id}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => set({ appeal: a.id })}
                            className={cn(
                              'flex items-center gap-3 rounded-xl p-2.5 text-left ring-1 ring-inset transition-all',
                              on ? 'bg-green-50 ring-2 ring-green' : 'bg-paper ring-line hover:ring-[#c9c9c2]',
                            )}
                          >
                            {a.image ? (
                              <img src={a.image} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
                            ) : (
                              <span className="size-12 shrink-0 rounded-lg bg-sand" />
                            )}
                            <span className="min-w-0">
                              <span className={cn('block text-[13.5px] leading-snug font-medium', on ? 'text-green' : 'text-text')}>{a.title}</span>
                              <span className="text-[12px] text-text-3">{COUNTRIES[a.country] ?? a.country}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </Field>
                )}
                <Field label="What is the occasion?">
                  <ChoiceCards
                    value={form.occasion}
                    onChange={(occasion) => set({ occasion })}
                    options={(Object.keys(FUNDRAISER_OCCASIONS) as FundraiserOccasion[]).map((o) => ({ value: o, label: FUNDRAISER_OCCASIONS[o] }))}
                  />
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                {willResubmit && (
                  <Callout tone="amber" icon={<Hourglass />} title={f?.status === 'changes' ? 'Saving sends your page back to the team' : 'Changing the title or story needs a quick re-check'}>
                    {f?.status === 'changes'
                      ? 'Once you save, the team reads it again — usually within a working day — and we email you when it is live.'
                      : 'Your page goes back into the approval queue and is off the site until the team has read the new words — usually within a working day. Changes to the target or end date alone go live straight away.'}
                  </Callout>
                )}
                <Field label="Title" error={fieldErr('title')} help="Short and personal works best — “Sara’s 40th: water for Yemen”">
                  <Input value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={90} autoFocus={isNew} />
                </Field>
                <Field
                  label="Your story"
                  error={fieldErr('story')}
                  help={
                    <span className="flex justify-between gap-3">
                      <span>A few honest sentences. People give to people.</span>
                      <span className="nums shrink-0">{form.story.length.toLocaleString('en-AU')} / 5,000</span>
                    </span>
                  }
                >
                  <Textarea value={form.story} onChange={(e) => set({ story: e.target.value })} rows={7} maxLength={5000} placeholder="Tell people why you are doing this…" />
                </Field>
                <div className="-mt-3 flex flex-wrap gap-1.5">
                  <span className="text-[12px] text-text-3">Ideas:</span>
                  {STORY_PROMPTS.map((p) => (
                    <span key={p} className="rounded-full bg-ink/[.04] px-2.5 py-0.5 text-[12px] text-text-2">
                      {p}
                    </span>
                  ))}
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Target" error={fieldErr('target')} help="You can change it later">
                    <MoneyInput value={form.target} onChange={(e) => set({ target: e.target.value })} />
                  </Field>
                  <Field label="End date" optional error={fieldErr('endsAt')} help="Leave empty to keep it open">
                    <Input type="date" value={form.endsAt} min={toInputDate(new Date(Date.now() + 86_400_000))} onChange={(e) => set({ endsAt: e.target.value })} />
                  </Field>
                </div>
                <div className="-mt-2 flex flex-wrap gap-2">
                  {[500, 1000, 2500, 5000].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set({ target: String(v) })}
                      className={cn(
                        'nums h-9 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-inset pointer-coarse:h-10',
                        cents === v * 100 ? 'bg-green-50 text-green ring-green/40' : 'bg-paper text-text-2 ring-line hover:text-text',
                      )}
                    >
                      {formatMoney(v * 100)}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <dl className="divide-y divide-line-2 rounded-xl ring-1 ring-line-2">
                  <ReviewRow label="Appeal" value={appeal?.title} onEdit={isNew ? () => setStep(0) : undefined} />
                  <ReviewRow label="Occasion" value={FUNDRAISER_OCCASIONS[form.occasion]} onEdit={() => setStep(0)} />
                  <ReviewRow label="Title" value={form.title} onEdit={() => setStep(1)} />
                  <ReviewRow label="Target" value={formatMoney(cents)} onEdit={() => setStep(1)} />
                  <ReviewRow label="Ends" value={form.endsAt ? formatDate(form.endsAt) : 'Open until you end it'} onEdit={() => setStep(1)} />
                </dl>
                <div className="rounded-xl bg-paper-2 px-4 py-3.5 text-[13.5px] leading-relaxed text-text-2 ring-1 ring-line-2">
                  <p className="font-medium text-text">What happens next</p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5">
                    {(isNew || willResubmit) && <li>The team reads your page — usually within a working day — and emails you when it is live.</li>}
                    <li>Then share the link. Every donation on it counts towards {appeal?.title ?? 'the appeal'}, and each supporter gets their own tax receipt.</li>
                    <li>You can edit it, or end it, from your account at any time.</li>
                  </ul>
                </div>
                {willResubmit && (
                  <Callout tone="amber" icon={<Hourglass />}>
                    Because the words changed, saving takes the page off the site until the team has approved it again.
                  </Callout>
                )}
              </>
            )}

            <FormError message={serverErr && !Object.keys(serverErr.fields).length ? serverErr.message : serverErr ? 'Some details need another look.' : undefined} />

            <div className="flex flex-col-reverse gap-2 border-t border-line-2 pt-5 sm:flex-row sm:items-center sm:justify-between">
              {step > 0 ? (
                <Button variant="ghost" icon={<ArrowLeft />} onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              ) : (
                <Link to="/account/fundraisers" className="inline-flex h-10 items-center justify-center rounded-[10px] px-3.5 text-sm font-medium text-text-2 hover:bg-ink/5">
                  Cancel
                </Link>
              )}
              {step < 2 ? (
                <Button type="submit" variant="primary" iconRight={<ArrowRight />}>
                  Continue
                </Button>
              ) : (
                <Button type="submit" variant="primary" loading={save.isPending} disabled={!stepValid[0] || !stepValid[1]}>
                  {isNew ? 'Send for approval' : willResubmit ? 'Save and send for approval' : 'Save changes'}
                </Button>
              )}
            </div>
          </form>
        </Card>

        <aside className="min-w-0">
          <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-medium text-text-3">
            <Eye className="size-3.5" /> How it will look
          </p>
          <Preview form={form} appeal={appeal} cents={Number.isFinite(cents) ? cents : 0} raised={f?.raised ?? 0} ownerName={ownerName} />
        </aside>
      </div>
    </div>
  )
}

function ReviewRow({ label, value, onEdit }: { label: string; value: ReactNode; onEdit?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="w-24 shrink-0 text-[13px] text-text-2">{label}</dt>
      <dd className="min-w-0 flex-1 text-[14px] text-text [overflow-wrap:anywhere]">{value || '—'}</dd>
      {onEdit && (
        <button type="button" onClick={onEdit} className="shrink-0 text-[13px] font-medium text-green hover:underline">
          Change
        </button>
      )}
    </div>
  )
}

/** Mirrors the public fundraiser card, so the preview is honest. */
function Preview({ form, appeal, cents, raised, ownerName }: { form: Form; appeal?: { title: string; image?: string }; cents: number; raised: number; ownerName: string }) {
  return (
    <Card className="overflow-hidden lg:sticky lg:top-24">
      <div className="relative aspect-[16/9] bg-sand">
        {appeal?.image && <img src={appeal.image} alt="" className="size-full object-cover" />}
        <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[11.5px] font-medium text-text backdrop-blur">{FUNDRAISER_OCCASIONS[form.occasion]}</span>
      </div>
      <div className="p-5">
        <p className={cn('text-[18px] leading-snug font-semibold tracking-[-0.01em]', form.title ? 'text-text' : 'text-text-3')}>{form.title || 'Your title'}</p>
        <p className="mt-1 text-[12.5px] text-text-2">For {appeal?.title ?? 'the appeal you choose'}</p>
        <div className="mt-3 flex items-center gap-2">
          <Avatar name={ownerName} size="xs" />
          <span className="text-[12.5px] text-text-2">{ownerName}</span>
        </div>
        <p className={cn('mt-3 line-clamp-4 text-[13.5px] leading-relaxed whitespace-pre-line', form.story ? 'text-text-2' : 'text-text-3')}>
          {form.story || 'Your story appears here — why this appeal matters to you.'}
        </p>
        <div className="mt-4 flex items-baseline justify-between">
          <span className="nums text-[17px] font-semibold text-text">{formatMoney(raised)}</span>
          <span className="nums text-[12.5px] text-text-3">of {formatMoney(cents)}</span>
        </div>
        <Progress value={raised} max={cents || 1} className="mt-2" size="sm" />
        <div className="mt-4 h-10 rounded-[10px] bg-gold/90 text-center text-[14px] leading-10 font-medium text-white" aria-hidden>
          Give
        </div>
      </div>
    </Card>
  )
}
