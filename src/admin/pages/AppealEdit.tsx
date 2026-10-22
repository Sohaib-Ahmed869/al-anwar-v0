import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Save, X } from 'lucide-react'
import { COUNTRIES } from '../../../shared/domain'
import type { Appeal } from '../../../shared/types'
import { api, ApiError, errorMessage } from '../../portal/api'
import { formatMoney, formatRelative, parseMoney, toInputDate } from '../../portal/format'
import {
  Button, Card, CardBody, CardHeader, Field, FormError, Input, MoneyInput, PageHeader, Select, Skeleton, StatusBadge, Switch,
  Textarea, cn, toast, useDocumentTitle, useHotkey,
} from '../../portal/ui'
import { StickySaveBar, useUnsavedGuard } from '../components/AppealUnsavedGuard'
import { AppealSuggestedEditor, newSuggestedRow, type SuggestedRow } from '../components/AppealSuggestedEditor'
import { AppealImage } from '../components/AppealImage'
import {
  AppealFundraisersCard, AppealLinksCard, AppealPerformanceCard, AppealStatusCard, AppealUpdatesCard, type AppealDetail,
} from '../components/AppealPanels'

/* ---------------------------------------------------------------------------
   The appeal editor, /admin/appeals/:id (and /admin/appeals/new).

   Left: the words and numbers, in the order a person writes an appeal —
   the story, the money, where, and when. It is one form with one Save
   (⌘S works), and money is typed in dollars and sent as cents.

   Right: things that act at once — the photo, the status, the links, the
   updates — plus how the appeal is doing. On a phone the columns stack and
   Save is pinned above the tab bar whenever there is something to save.

   Leaving with unsaved changes asks first (useUnsavedGuard).
--------------------------------------------------------------------------- */

type Form = {
  title: string
  slug: string
  summary: string
  story: string
  country: string
  where: string
  causes: string[]
  zakatEligible: boolean
  featured: boolean
  target: string
  opensAt: string
  closesAt: string
  suggested: SuggestedRow[]
  unitOn: boolean
  unit: { name: string; plural: string; price: string }
}

const dollars = (c?: number | null) => (c ? String(c / 100) : '')

function toForm(a?: Appeal): Form {
  return {
    title: a?.title ?? '',
    slug: a?.slug ?? '',
    summary: a?.summary ?? '',
    story: a?.story ?? '',
    country: a?.country ?? '',
    where: a?.where ?? '',
    causes: a?.causes ?? [],
    zakatEligible: a?.zakatEligible ?? false,
    featured: a?.featured ?? false,
    target: dollars(a?.target),
    opensAt: toInputDate(a?.opensAt),
    closesAt: toInputDate(a?.closesAt),
    suggested: (a?.suggested ?? []).map((s) => newSuggestedRow(dollars(s.amount), s.label ?? '')),
    unitOn: Boolean(a?.unit?.name),
    unit: { name: a?.unit?.name ?? '', plural: a?.unit?.plural ?? '', price: dollars(a?.unit?.price) },
  }
}

/** The comparable part of a form: row keys are UI-only. */
const snapshot = (f: Form) => JSON.stringify({ ...f, suggested: f.suggested.map(({ amount, label }) => ({ amount, label })) })

const COMMON_CAUSES = ['food', 'water', 'emergency', 'education', 'orphans', 'health', 'masjid', 'shelter', 'qurbani', 'ramadan']

function toPayload(f: Form, isNew: boolean): { body: Record<string, unknown>; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  if (f.title.trim().length < 3) errors.title = 'Give the appeal a title'
  if (!f.country) errors.country = 'Choose a country'
  const target = f.target.trim() ? parseMoney(f.target) : 0
  if (Number.isNaN(target)) errors.target = 'That is not an amount'
  const suggested = f.suggested
    .filter((s) => s.amount.trim() || s.label.trim())
    .map((s, i) => {
      const amount = parseMoney(s.amount)
      if (!Number.isFinite(amount) || amount <= 0) errors[`suggested.${i}.amount`] = 'Enter an amount in dollars'
      return { amount, label: s.label.trim() || undefined }
    })
  let unit: Record<string, unknown> | null = null
  if (f.unitOn) {
    const price = parseMoney(f.unit.price)
    if (!f.unit.name.trim()) errors['unit.name'] = 'Name the unit'
    if (!f.unit.plural.trim()) errors['unit.plural'] = 'And its plural'
    if (!Number.isFinite(price) || price <= 0) errors['unit.price'] = 'What one costs'
    unit = { name: f.unit.name.trim(), plural: f.unit.plural.trim(), price }
  }
  if (f.opensAt && f.closesAt && f.closesAt <= f.opensAt) errors.closesAt = 'Must be after the opening date'
  const body: Record<string, unknown> = {
    title: f.title.trim(),
    summary: f.summary.trim(),
    story: f.story,
    country: f.country,
    where: f.where.trim() || null,
    causes: f.causes,
    zakatEligible: f.zakatEligible,
    featured: f.featured,
    target,
    opensAt: f.opensAt || null,
    closesAt: f.closesAt || null,
    suggested,
    unit,
  }
  if (f.slug.trim() || !isNew) body.slug = f.slug.trim() || undefined
  return { body, errors }
}

export default function AppealEdit() {
  const { id = 'new' } = useParams()
  const isNew = id === 'new'
  const nav = useNavigate()
  const qc = useQueryClient()

  const detail = useQuery({
    queryKey: ['admin', 'appeal', id],
    queryFn: () => api.get<AppealDetail>(`/admin/appeals/${id}`),
    enabled: !isNew,
  })
  const appeal = detail.data?.appeal
  useDocumentTitle(isNew ? 'New appeal' : appeal?.title, 'Admin')

  const [form, setForm] = useState<Form>(() => toForm())
  const [base, setBase] = useState(() => snapshot(toForm()))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const loadedFor = useMemo(() => ({ id: '' }), [])

  /* load the record into the form once per appeal (not on every refetch,
     which would wipe what the person is typing) */
  useEffect(() => {
    if (appeal && loadedFor.id !== appeal.id) {
      loadedFor.id = appeal.id
      const f = toForm(appeal)
      setForm(f)
      setBase(snapshot(f))
    }
  }, [appeal, loadedFor])

  const dirty = snapshot(form) !== base
  useUnsavedGuard(dirty, 'Your edits to this appeal have not been saved yet.')
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => (isNew ? api.post<Appeal>('/admin/appeals', body) : api.patch<Appeal>(`/admin/appeals/${id}`, body)),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ['admin', 'appeals'] })
      qc.invalidateQueries({ queryKey: ['appeal-options'] })
      const f = toForm(a)
      setForm(f)
      setBase(snapshot(f))
      setErrors({})
      setFormError(null)
      if (isNew) {
        toast.success('Appeal saved as a draft. Add its photo, then open it when it is ready.')
        loadedFor.id = a.id
        nav(`/admin/appeals/${a.id}`, { replace: true })
      } else {
        qc.setQueryData<AppealDetail>(['admin', 'appeal', id], (d) => (d ? { ...d, appeal: { ...d.appeal, ...a } } : d))
        toast.success('Appeal saved')
      }
    },
    onError: (e) => {
      setErrors(e instanceof ApiError ? e.fields : {})
      setFormError(errorMessage(e))
    },
  })

  const submit = () => {
    const { body, errors: errs } = toPayload(form, isNew)
    if (Object.keys(errs).length) {
      setErrors(errs)
      setFormError('Some details need another look.')
      return
    }
    save.mutate(body)
  }
  useHotkey('s', () => (dirty || isNew) && submit())

  if (!isNew && detail.isLoading) return <EditorSkeleton />
  if (!isNew && detail.isError) {
    return (
      <>
        <PageHeader title="Appeal" crumbs={[{ label: 'Appeals', to: '/admin/appeals' }]} />
        <FormError message={errorMessage(detail.error)} />
      </>
    )
  }

  const saveButton = (cls?: string) => (
    <Button variant="primary" icon={<Save />} loading={save.isPending} disabled={!dirty && !isNew} onClick={submit} className={cls}>
      {isNew ? 'Save draft' : dirty ? 'Save changes' : 'Saved'}
    </Button>
  )

  return (
    <div className={cn(dirty && 'pb-20 lg:pb-0')}>
      <PageHeader
        crumbs={[{ label: 'Appeals', to: '/admin/appeals' }, { label: isNew ? 'New appeal' : (appeal?.title ?? 'Appeal') }]}
        title={form.title.trim() || (isNew ? 'New appeal' : appeal?.title)}
        meta={
          appeal ? (
            <>
              <StatusBadge kind="appeal" value={appeal.status} />
              <span className="text-[13px] text-text-3">Edited {formatRelative(appeal.updatedAt)}</span>
              {dirty && <span className="text-[13px] font-medium text-amber">Unsaved changes</span>}
            </>
          ) : undefined
        }
        actions={
          <>
            {appeal && appeal.status !== 'draft' && (
              <a href={`/appeals/${appeal.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-[10px] px-3 text-sm font-medium text-text-2 hover:bg-ink/5 hover:text-text">
                <ExternalLink className="size-4" /> View on the website
              </a>
            )}
            <span className="hidden lg:inline-flex">{saveButton()}</span>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        {/* ---------- the form ---------- */}
        <form
          className="min-w-0 space-y-6"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <FormError message={formError} />

          <Section title="The story" description="What donors read. Lead with the people, then what the money does.">
            <Field label="Title" error={errors.title}>
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Food packs in Tripoli" maxLength={120} autoFocus={isNew} />
            </Field>
            <Field
              label="Web address"
              optional={isNew}
              error={errors.slug}
              help={isNew ? 'Made from the title if you leave it blank.' : 'Changing it breaks links already shared. Only change it before the appeal opens.'}
            >
              <Input
                value={form.slug}
                onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                leading={<span className="text-[13px] whitespace-nowrap">/appeals/</span>}
                className="pl-[74px]"
                placeholder={isNew ? 'made-from-the-title' : ''}
              />
            </Field>
            <Field label="Summary" error={errors.summary} help={`One or two sentences for the appeal card and link previews. ${form.summary.length}/400`}>
              <Textarea rows={2} value={form.summary} maxLength={400} onChange={(e) => set('summary', e.target.value)} />
            </Field>
            <Field
              label="Story"
              error={errors.story}
              help={
                <>
                  A blank line starts a new paragraph. <code className="text-text-2">**bold**</code>, <code className="text-text-2">[a link](https://…)</code> and lines starting{' '}
                  <code className="text-text-2">- </code> for a list.
                </>
              }
            >
              <Textarea rows={12} value={form.story} onChange={(e) => set('story', e.target.value)} className="text-[15px] leading-relaxed sm:text-[14.5px]" />
            </Field>
          </Section>

          <Section title="The money" description="The target people see, and the amounts offered on the give box.">
            <Field label="Target" error={errors.target} help={form.target && !Number.isNaN(parseMoney(form.target)) ? `Shown as ${formatMoney(parseMoney(form.target))}.` : 'Leave blank for no target bar.'}>
              <MoneyInput value={form.target} onChange={(e) => set('target', e.target.value)} placeholder="40,000" className="sm:max-w-[220px]" />
            </Field>
            <Field label="Suggested amounts" error={errors.suggested}>
              <AppealSuggestedEditor rows={form.suggested} onChange={(v) => set('suggested', v)} errors={errors} unitName={form.unitOn ? form.unit.name : undefined} />
            </Field>
            <div className="rounded-xl bg-paper-2 p-4">
              <Switch
                checked={form.unitOn}
                onChange={(v) => set('unitOn', v)}
                label="Count it in units"
                description="For appeals with a price per thing — “$50 buys one food pack”. The give box then says how many a donation pays for."
              />
              {form.unitOn && (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Field label="One is a…" error={errors['unit.name']}>
                    <Input value={form.unit.name} onChange={(e) => set('unit', { ...form.unit, name: e.target.value })} placeholder="food pack" />
                  </Field>
                  <Field label="Several are…" error={errors['unit.plural']}>
                    <Input value={form.unit.plural} onChange={(e) => set('unit', { ...form.unit, plural: e.target.value })} placeholder="food packs" />
                  </Field>
                  <Field label="Each costs" error={errors['unit.price']}>
                    <MoneyInput value={form.unit.price} onChange={(e) => set('unit', { ...form.unit, price: e.target.value })} placeholder="50" />
                  </Field>
                </div>
              )}
            </div>
          </Section>

          <Section title="Where and what for">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Country" error={errors.country}>
                <Select value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="Choose a country">
                  {Object.entries(COUNTRIES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Where exactly" optional error={errors.where}>
                <Input value={form.where} onChange={(e) => set('where', e.target.value)} placeholder="e.g. Tripoli, northern Lebanon" />
              </Field>
            </div>
            <Field label="Causes" help="Used to group appeals on the website. Press Enter after each one.">
              <CausesInput value={form.causes} onChange={(v) => set('causes', v)} />
            </Field>
            <div className="space-y-4 rounded-xl bg-paper-2 p-4">
              <Switch
                checked={form.zakatEligible}
                onChange={(v) => set('zakatEligible', v)}
                label="Zakat eligible"
                description="Only switch this on once the imam has confirmed the appeal meets the conditions for zakat. Donors can then give their zakat to it, and it is reported as zakat."
              />
              <Switch checked={form.featured} onChange={(v) => set('featured', v)} label="Feature it" description="Shown first on the appeals page and on the home page." />
            </div>
          </Section>

          <Section title="Timing" description="Dates are shown on the appeal page. Opening and closing still happen when you press the button on the right.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Opens" optional error={errors.opensAt}>
                <Input type="date" value={form.opensAt} onChange={(e) => set('opensAt', e.target.value)} />
              </Field>
              <Field label="Closes" optional error={errors.closesAt} help="Blank runs until you close it.">
                <Input type="date" value={form.closesAt} min={form.opensAt || undefined} onChange={(e) => set('closesAt', e.target.value)} />
              </Field>
            </div>
          </Section>
          <button type="submit" hidden />
        </form>

        {/* ---------- the side ---------- */}
        <aside className="min-w-0 space-y-6 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-48px)] lg:self-start lg:overflow-y-auto lg:rounded-2xl lg:pb-1 lg:[scrollbar-width:thin]">
          <AppealImage
            appealId={appeal?.id}
            image={appeal?.image}
            onUploaded={(a) => {
              qc.setQueryData<AppealDetail>(['admin', 'appeal', id], (d) => (d ? { ...d, appeal: { ...d.appeal, image: a.image } } : d))
              qc.invalidateQueries({ queryKey: ['admin', 'appeals'] })
            }}
          />
          {appeal && detail.data ? (
            <>
              <AppealStatusCard appeal={appeal} dirty={dirty} />
              <AppealPerformanceCard d={detail.data} />
              <AppealLinksCard appeal={appeal} />
              <AppealUpdatesCard appeal={appeal} />
              <AppealFundraisersCard rows={detail.data.fundraisers} />
            </>
          ) : (
            <Card>
              <CardBody className="pt-5 text-[13px] leading-relaxed text-text-2">
                A new appeal is saved as a <strong className="font-medium text-text">draft</strong>: only the team can see it. Once it is saved you can add the photo, post updates and open it
                for donations.
              </CardBody>
            </Card>
          )}
        </aside>
      </div>

      <StickySaveBar show={dirty || isNew}>
        <span className="min-w-0 flex-1 truncate text-[13px] text-text-2">{isNew ? 'A new draft' : 'Unsaved changes'}</span>
        {saveButton('shrink-0')}
      </StickySaveBar>
    </div>
  )
}

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody className="space-y-5">{children}</CardBody>
    </Card>
  )
}

function CausesInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState('')
  const add = (raw: string) => {
    const c = raw.trim().toLowerCase()
    if (c && !value.includes(c) && value.length < 12) onChange([...value, c])
    setText('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(text)
    } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
  }
  const suggestions = COMMON_CAUSES.filter((c) => !value.includes(c))
  return (
    <div>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-[10px] bg-paper px-2 py-1.5 ring-1 ring-line ring-inset focus-within:ring-2 focus-within:ring-green/70">
        {value.map((c) => (
          <span key={c} className="inline-flex h-7 items-center gap-1 rounded-lg bg-green-50 pr-1 pl-2.5 text-[13px] text-green">
            {c}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== c))} className="grid size-5 place-items-center rounded hover:bg-green-pale" aria-label={`Remove ${c}`}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => text && add(text)}
          placeholder={value.length ? '' : 'e.g. food'}
          aria-label="Add a cause"
          className="h-7 min-w-24 flex-1 bg-transparent px-1 text-[16px] outline-none sm:text-sm"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.slice(0, 8).map((c) => (
            <button key={c} type="button" onClick={() => add(c)} className="h-7 rounded-lg px-2 text-[12.5px] text-text-2 ring-1 ring-line ring-inset hover:text-text hover:ring-[#dccdb2]">
              + {c}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function EditorSkeleton() {
  return (
    <div aria-busy="true">
      <Skeleton className="mb-3 h-3.5 w-40" />
      <Skeleton className="mb-8 h-8 w-80 max-w-full" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <div className="space-y-6">
          {[0, 1].map((i) => (
            <Card key={i} className="space-y-4 p-6">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
            </Card>
          ))}
        </div>
        <div className="space-y-6">
          <Card className="p-6">
            <Skeleton className="aspect-[16/9] w-full" />
          </Card>
          <Card className="space-y-3 p-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-2 w-full" />
          </Card>
        </div>
      </div>
    </div>
  )
}
