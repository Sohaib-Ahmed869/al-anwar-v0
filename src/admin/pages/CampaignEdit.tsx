import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, format } from 'date-fns'
import { CalendarClock, CalendarX, Copy, FlaskConical, Save, Send, Trash2 } from 'lucide-react'
import type { Segment } from '../../../shared/domain'
import type { Campaign } from '../../../shared/types'
import { api, ApiError, errorMessage } from '../../portal/api'
import { formatDateTime, formatNumber, formatRelative } from '../../portal/format'
import {
  Button, Callout, Card, CardBody, CardHeader, Dialog, Field, FormError, Input, PageHeader, Progress, Skeleton, StatusBadge,
  Textarea, cn, toast, useConfirm, useDocumentTitle, useHotkey,
} from '../../portal/ui'
import { useStaff as useStaffSession } from '../../portal/session'
import { StickySaveBar, useUnsavedGuard } from '../components/AppealUnsavedGuard'
import { CampaignAudience, describeSegment, useAppealOptions, useSegmentCount } from '../components/CampaignAudience'
import { CampaignBodyToolbar, CampaignPreview } from '../components/CampaignPreview'

/* ---------------------------------------------------------------------------
   The campaign composer, /admin/campaigns/:id (and /new).

   Left: the words (name, subject, preheader, body with a small toolbar),
   then the audience with its live count, then what to do with it. Right:
   the email itself, rendered by the server exactly as a donor gets it, at
   desktop or phone width.

   Every send action saves first, so "Send test" and "Send now" always use
   what is on the screen. "Send now" says how many people it will email
   before it does, because it cannot be taken back. Once a campaign is
   sending, the page turns into its progress (polled every few seconds) and
   nothing can be edited.
--------------------------------------------------------------------------- */

type Form = { name: string; subject: string; preheader: string; body: string; segment: Segment }
type Detail = Campaign & { remaining: number }

const toForm = (c?: Campaign): Form => ({
  name: c?.name ?? '',
  subject: c?.subject ?? '',
  preheader: c?.preheader ?? '',
  body: c?.body ?? '',
  segment: c?.segment ?? {},
})
const snap = (f: Form) => JSON.stringify(f)

export default function CampaignEdit() {
  const { id = 'new' } = useParams()
  const isNew = id === 'new'
  const nav = useNavigate()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const me = useStaffSession().user
  const appeals = useAppealOptions()

  const d = useQuery({
    queryKey: ['admin', 'campaign', id],
    queryFn: () => api.get<Detail>(`/admin/campaigns/${id}`),
    enabled: !isNew,
    refetchInterval: (q) => (q.state.data?.status === 'sending' ? 2500 : false),
  })
  const c = d.data
  useDocumentTitle(isNew ? 'New campaign' : c?.name, 'Admin')

  const [form, setForm] = useState<Form>(() => ({ ...toForm(), segment: { activeMonths: 24 } }))
  const [base, setBase] = useState(() => snap(toForm()))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const loaded = useRef('')
  useEffect(() => {
    if (c && loaded.current !== c.id) {
      loaded.current = c.id
      const f = toForm(c)
      setForm(f)
      setBase(snap(f))
    }
  }, [c])

  const frozen = c?.status === 'sending' || c?.status === 'sent'
  const dirty = !frozen && snap(form) !== base
  useUnsavedGuard(dirty, 'Your changes to this campaign have not been saved yet.')
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const body = useRef<HTMLTextAreaElement>(null)
  const count = useSegmentCount(form.segment)

  const fail = (e: unknown) => {
    setErrors(e instanceof ApiError ? e.fields : {})
    setFormError(errorMessage(e))
  }
  const refresh = (next?: Campaign) => {
    qc.invalidateQueries({ queryKey: ['admin', 'campaigns'] })
    if (next) qc.setQueryData<Detail>(['admin', 'campaign', next.id], (old) => ({ ...(old ?? { remaining: 0 }), ...next }) as Detail)
  }

  /** Save what is on screen (creating the campaign if it is new); the id. */
  const saveNow = async (quiet = false): Promise<string> => {
    const payload = { ...form, preheader: form.preheader || null }
    if (!form.name.trim()) {
      setErrors({ name: 'Give the campaign a name only the team sees' })
      throw new Error('Give the campaign a name first.')
    }
    const saved = isNew ? await api.post<Campaign>('/admin/campaigns', payload) : dirty ? await api.patch<Campaign>(`/admin/campaigns/${id}`, payload) : c!
    setBase(snap(toForm(saved)))
    setErrors({})
    setFormError(null)
    refresh(saved)
    if (isNew) {
      loaded.current = saved.id
      nav(`/admin/campaigns/${saved.id}`, { replace: true })
    }
    if (!quiet) toast.success(isNew ? 'Draft saved' : 'Saved')
    return saved.id
  }

  const save = useMutation({ mutationFn: () => saveNow(), onError: fail })
  const test = useMutation({
    mutationFn: async () => {
      const cid = await saveNow(true)
      return api.post<{ to: string }>(`/admin/campaigns/${cid}/test`, {})
    },
    onSuccess: (r) => toast.success(`Test sent to ${r.to}. It is marked [Test] and has your name in it.`),
    onError: fail,
  })
  const sendNow = useMutation({
    mutationFn: async () => {
      const cid = await saveNow(true)
      return api.post<Detail>(`/admin/campaigns/${cid}/send`, {})
    },
    onSuccess: (r) => {
      refresh(r)
      toast.success(`Sending to ${formatNumber(r.stats.recipients)} donors now`)
    },
    onError: fail,
  })
  const unschedule = useMutation({
    mutationFn: () => api.post<Campaign>(`/admin/campaigns/${id}/unschedule`),
    onSuccess: (r) => {
      refresh(r)
      toast.success('Taken off the schedule. It is a draft again.')
    },
    onError: fail,
  })
  const remove = useMutation({
    mutationFn: () => api.del(`/admin/campaigns/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'campaigns'] })
      toast.success('Draft deleted')
      setBase(snap(form))
      nav('/admin/campaigns', { replace: true })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const duplicate = useMutation({
    mutationFn: () => api.post<Campaign>(`/admin/campaigns/${id}/duplicate`),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['admin', 'campaigns'] })
      toast.success('Copied into a new draft')
      nav(`/admin/campaigns/${r.id}`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const [scheduleOpen, setScheduleOpen] = useState(false)

  useHotkey('s', () => !frozen && (dirty || isNew) && save.mutate())

  const askSend = async () => {
    const n = count.data?.count
    if (n == null) return
    if (n === 0) return toast.error('Nobody in this audience can be emailed. Widen it first.')
    const ok = await confirm({
      title: `Send “${form.name}” now?`,
      body: (
        <>
          This emails <strong className="text-text">{formatNumber(n)} donors</strong> — {describeSegment(form.segment, appeals.data?.items).toLowerCase()}. It goes out in batches over the next few minutes and it can’t be
          unsent.
        </>
      ),
      confirmLabel: `Send to ${formatNumber(n)} donors`,
    })
    if (ok) sendNow.mutate()
  }

  if (!isNew && d.isLoading) {
    return (
      <div aria-busy="true">
        <Skeleton className="mb-3 h-3.5 w-40" />
        <Skeleton className="mb-8 h-8 w-72" />
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="space-y-4 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-48 w-full" />
          </Card>
          <Card className="h-[520px] p-6">
            <Skeleton className="h-full w-full" />
          </Card>
        </div>
      </div>
    )
  }
  if (!isNew && d.isError) return <FormError message={errorMessage(d.error)} />

  const busy = save.isPending || test.isPending || sendNow.isPending

  return (
    <div className={cn(dirty && 'pb-20 lg:pb-0')}>
      <PageHeader
        crumbs={[{ label: 'Email campaigns', to: '/admin/campaigns' }, { label: isNew ? 'New campaign' : (c?.name ?? 'Campaign') }]}
        title={form.name.trim() || (isNew ? 'New campaign' : c?.name)}
        meta={
          c ? (
            <>
              <StatusBadge kind="campaign" value={c.status} />
              <span className="text-[13px] text-text-3">
                {c.status === 'sent' ? `Sent ${formatDateTime(c.sentAt)}` : c.status === 'scheduled' ? `Goes out ${formatDateTime(c.scheduledAt)}` : `Edited ${formatRelative(c.updatedAt)}`}
                {c.createdByName ? ` · by ${c.createdByName}` : ''}
              </span>
              {dirty && <span className="text-[13px] font-medium text-amber">Unsaved changes</span>}
            </>
          ) : undefined
        }
        actions={
          frozen ? (
            <Button variant="secondary" icon={<Copy />} loading={duplicate.isPending} onClick={() => duplicate.mutate()}>
              Copy into a new draft
            </Button>
          ) : (
            <span className="hidden lg:inline-flex">
              <Button variant="secondary" icon={<Save />} loading={save.isPending} disabled={!dirty && !isNew} onClick={() => save.mutate()}>
                {dirty || isNew ? 'Save draft' : 'Saved'}
              </Button>
            </span>
          )
        }
      />

      {c && frozen && <Progressbar c={c} />}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <FormError message={formError} />
          <Card>
            <CardHeader title="The email" />
            <CardBody className="space-y-5">
              <fieldset disabled={frozen} className="space-y-5">
                <Field label="Campaign name" error={errors.name} help="Only the team sees this.">
                  <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Winter appeal launch — Syria" autoFocus={isNew} />
                </Field>
                <Field
                  label="Subject"
                  error={errors.subject}
                  help={
                    <>
                      Put <code className="text-text-2">{'{{firstName}}'}</code> in to use each donor’s first name. Under 50 characters reads best on a phone ({form.subject.length}).
                    </>
                  }
                >
                  <Input value={form.subject} onChange={(e) => set('subject', e.target.value)} placeholder="e.g. Winter is coming to the camps, {{firstName}}" maxLength={160} />
                </Field>
                <Field label="Preheader" optional help="The grey line after the subject in most inboxes.">
                  <Input value={form.preheader} onChange={(e) => set('preheader', e.target.value)} placeholder="e.g. $60 keeps a family warm until spring." maxLength={200} />
                </Field>
                <Field label="Message" error={errors.body}>
                  <div>
                    {!frozen && <CampaignBodyToolbar target={body} value={form.body} onChange={(v) => set('body', v)} />}
                    <Textarea
                      ref={body}
                      rows={14}
                      value={form.body}
                      onChange={(e) => set('body', e.target.value)}
                      className={cn('font-[450] leading-relaxed', !frozen && 'rounded-t-none')}
                      placeholder={'Assalamu alaykum {{firstName}},\n\nStart with the people, then what a gift does.\n\n[Give now](/give)'}
                    />
                  </div>
                </Field>
                <p className="-mt-2 text-[12.5px] text-text-3">
                  A blank line starts a new paragraph. Links to our own pages can start with a slash: <code>[Give](/give)</code>. An unsubscribe link is added to the bottom of every email.
                </p>
              </fieldset>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Who it goes to" description="Every choice narrows the group. Leave them all off to email everyone who gets email." />
            <CardBody>
              <CampaignAudience value={form.segment} onChange={(v) => set('segment', v)} readOnly={frozen} />
            </CardBody>
          </Card>

          {!frozen && (
            <Card>
              <CardHeader title="Send it" description="Everything saves first, so what goes out is what is on this screen." />
              <CardBody className="space-y-4">
                {c?.status === 'scheduled' && (
                  <Callout
                    tone="teal"
                    icon={<CalendarClock />}
                    title={`Scheduled for ${formatDateTime(c.scheduledAt)}`}
                    action={
                      <Button size="sm" variant="secondary" icon={<CalendarX />} loading={unschedule.isPending} onClick={() => unschedule.mutate()}>
                        Unschedule
                      </Button>
                    }
                  >
                    Edits you save before then go out with it. The audience is worked out at that moment.
                  </Callout>
                )}
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button variant="secondary" icon={<FlaskConical />} loading={test.isPending} disabled={busy} onClick={() => test.mutate()}>
                    Send a test to me
                  </Button>
                  <Button variant="secondary" icon={<CalendarClock />} disabled={busy} onClick={() => setScheduleOpen(true)}>
                    {c?.status === 'scheduled' ? 'Change the time' : 'Schedule'}
                  </Button>
                  <Button variant="primary" icon={<Send />} loading={sendNow.isPending} disabled={busy || count.data?.count === 0} onClick={askSend} className="sm:ml-auto">
                    {count.data ? `Send now to ${formatNumber(count.data.count)}` : 'Send now'}
                  </Button>
                </div>
                <p className="text-[12.5px] text-text-3">The test goes to {me?.email ?? 'you'}.</p>
                {c?.status === 'draft' && (
                  <div className="border-t border-line-2 pt-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-[13px] text-text-2 hover:text-red"
                      onClick={async () => {
                        if (await confirm({ title: 'Delete this draft?', body: `“${c.name}” will be gone for good. Nothing has been sent from it.`, confirmLabel: 'Delete draft', tone: 'danger', typeToConfirm: 'delete' }))
                          remove.mutate()
                      }}
                    >
                      <Trash2 className="size-3.5" /> Delete this draft
                    </button>
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>

        <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
          <CampaignPreview subject={form.subject} preheader={form.preheader} body={form.body} />
        </div>
      </div>

      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        current={c?.scheduledAt}
        count={count.data?.count}
        save={() => saveNow(true)}
        onDone={(r) => {
          refresh(r)
          setScheduleOpen(false)
          toast.success(`Scheduled for ${formatDateTime(r.scheduledAt)}`)
        }}
      />

      {!frozen && (
        <StickySaveBar show={dirty || isNew}>
          <span className="min-w-0 flex-1 truncate text-[13px] text-text-2">{isNew ? 'A new draft' : 'Unsaved changes'}</span>
          <Button variant="primary" icon={<Save />} loading={save.isPending} onClick={() => save.mutate()}>
            Save draft
          </Button>
        </StickySaveBar>
      )}
    </div>
  )
}

function Progressbar({ c }: { c: Detail }) {
  const done = c.stats.sent + c.stats.failed
  return (
    <Card className="mb-6">
      <CardBody className="pt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[13px] text-text-2">{c.status === 'sending' ? 'Sending in batches of 50 a minute…' : 'Delivered'}</p>
            <p className="nums mt-1 text-[24px] font-semibold tracking-[-0.02em] text-text">
              {formatNumber(c.stats.sent)} <span className="text-[15px] font-normal text-text-2">of {formatNumber(c.stats.recipients)} sent</span>
            </p>
          </div>
          {c.stats.failed > 0 && <p className="nums text-[13px] text-red">{formatNumber(c.stats.failed)} could not be delivered</p>}
        </div>
        <Progress value={done} max={c.stats.recipients || 1} tone={c.status === 'sending' ? 'amber' : 'green'} className="mt-3" label="Sending progress" />
        {c.status === 'sent' && <p className="mt-3 text-[12.5px] text-text-3">Each email is on its donor’s record and in the email log. Donors who unsubscribed after it was scheduled were left out.</p>}
      </CardBody>
    </Card>
  )
}

function ScheduleDialog({
  open,
  onOpenChange,
  current,
  count,
  save,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  current?: string
  count?: number
  save: () => Promise<string>
  onDone: (c: Campaign) => void
}) {
  const initial = current ? format(new Date(current), "yyyy-MM-dd'T'HH:mm") : format(addDays(new Date(), 1), "yyyy-MM-dd'T'09:00")
  const [at, setAt] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setAt(initial)
      setError(null)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const m = useMutation({
    mutationFn: async () => {
      const id = await save()
      return api.post<Campaign>(`/admin/campaigns/${id}/schedule`, { at: new Date(at).toISOString() })
    },
    onSuccess: onDone,
    onError: (e) => setError(e instanceof ApiError ? (e.fields.at ?? e.fields.subject ?? e.fields.body ?? e.message) : errorMessage(e)),
  })
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Schedule this campaign"
      description="It starts sending at this time, in batches. You can unschedule it or change it until then."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" icon={<CalendarClock />} loading={m.isPending} disabled={!at} onClick={() => m.mutate()}>
            Schedule
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          m.mutate()
        }}
        className="space-y-3"
      >
        <Field label="Send on" error={error ?? undefined} help={count != null ? `About ${formatNumber(count)} donors today — worked out again when it goes.` : undefined}>
          <Input type="datetime-local" value={at} min={format(new Date(), "yyyy-MM-dd'T'HH:mm")} onChange={(e) => setAt(e.target.value)} />
        </Field>
        <p className="text-[12.5px] text-text-3">Times are your computer’s time zone. Mornings — 8 to 10 — are when most donors open email.</p>
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}
