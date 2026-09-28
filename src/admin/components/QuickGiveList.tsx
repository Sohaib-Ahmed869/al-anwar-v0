import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ChevronDown, HandHeart, Plus, RotateCcw, Trash2 } from 'lucide-react'
import {
  QUICK_GIVE_FUNDS, QUICK_GIVE_FUND_KEYS, QUICK_GIVE_GROUPS, QUICK_GIVE_GROUP_KEYS, type QuickGiveOption,
} from '../../../shared/quickgive'
import { api, ApiError, errorMessage } from '../../portal/api'
import {
  Badge, Button, Card, CardBody, CardFooter, CardHeader, Field, FormError, IconButton, Input, Select, Skeleton, Switch, Textarea, cn, toast,
} from '../../portal/ui'

/* ---------------------------------------------------------------------------
   The home page's quick-donate list, edited in Admin → Appeals (client's
   request, 28 September 2026). See shared/quickgive.ts for what an option is.

   The whole list is one draft with one Save, because its order is the point:
   up and down move an option, the first is what the home page opens on, and
   a half-saved reorder would be a list nobody chose. Each row edits its name,
   heading, fund and on/off in place; the photograph, the words the hero shows
   and the read-more link are behind "More", because most options never need
   them (the fund's own are used when they are empty).

   Server errors come back per field as `items.<i>.<field>`, and are shown on
   the row they belong to.
--------------------------------------------------------------------------- */

type List = { items: QuickGiveOption[] }
const KEY = ['admin', 'quick-give']

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'option'

export default function QuickGiveList({ id = 'quick-give' }: { id?: string }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: KEY, queryFn: () => api.get<List>('/admin/quick-give') })
  const [draft, setDraft] = useState<QuickGiveOption[] | null>(null)
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (q.data && draft === null) setDraft(q.data.items)
  }, [q.data, draft])

  const done = (d: List) => {
    qc.setQueryData(KEY, d)
    setDraft(d.items)
    setErrors({})
    setFormError(null)
  }
  const fail = (e: unknown) => {
    setErrors(e instanceof ApiError ? e.fields : {})
    setFormError(errorMessage(e))
  }
  const save = useMutation({
    mutationFn: (items: QuickGiveOption[]) => api.put<List>('/admin/quick-give', { items }),
    onSuccess: (d) => {
      done(d)
      toast.success('Saved. The home page shows the new list.')
    },
    onError: fail,
  })
  const reset = useMutation({
    mutationFn: () => api.post<List>('/admin/quick-give/reset'),
    onSuccess: (d) => {
      done(d)
      toast.success('Back to the default list')
    },
    onError: fail,
  })

  const dirty = draft !== null && q.data !== undefined && JSON.stringify(draft) !== JSON.stringify(q.data.items)

  const patch = (i: number, p: Partial<QuickGiveOption>) =>
    setDraft((d) => (d ? d.map((o, j) => (j === i ? { ...o, ...p } : o)) : d))
  const move = (i: number, by: -1 | 1) =>
    setDraft((d) => {
      if (!d || i + by < 0 || i + by >= d.length) return d
      const next = [...d]
      ;[next[i], next[i + by]] = [next[i + by], next[i]]
      return next
    })
  const remove = (i: number) => setDraft((d) => (d ? d.filter((_, j) => j !== i) : d))
  const add = () =>
    setDraft((d) => {
      if (!d) return d
      const taken = new Set(d.map((o) => o.id))
      let n = 1
      while (taken.has(`new-option-${n}`)) n++
      const o: QuickGiveOption = {
        id: `new-option-${n}`, label: '', group: 'projects', fund: 'sadaqah', enabled: true, photo: '', title: '', body: '', link: '',
      }
      setOpenRow(o.id)
      return [...d, o]
    })

  const err = (i: number, f: keyof QuickGiveOption) => errors[`items.${i}.${f}`]

  return (
    <Card id={id} className="scroll-mt-6">
      <CardHeader
        icon={<HandHeart />}
        title="Home page quick-donate list"
        description="What the “Donate now” box on the home page offers, in this order. The first switched-on option is the one it opens on. Each option pays into one of the funds, which sets its amounts."
      />
      <CardBody className="space-y-2">
        {!draft ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <ol className="space-y-2">
            {draft.map((o, i) => {
              const more = openRow === o.id
              return (
                <li key={i} className={cn('rounded-xl ring-1 ring-line/80', o.enabled ? 'bg-paper' : 'bg-paper-2')}>
                  <div className="flex flex-wrap items-center gap-2 p-2.5 sm:flex-nowrap">
                    <div className="flex shrink-0 items-center">
                      <span className="nums w-6 text-center text-[12.5px] font-semibold text-text-3">{i + 1}</span>
                      <IconButton label={`Move ${o.label || 'this option'} up`} size="sm" disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp />
                      </IconButton>
                      <IconButton label={`Move ${o.label || 'this option'} down`} size="sm" disabled={i === draft.length - 1} onClick={() => move(i, 1)}>
                        <ArrowDown />
                      </IconButton>
                    </div>
                    <div className="min-w-0 flex-1 basis-40">
                      <Input
                        aria-label="Name shown in the list"
                        placeholder="e.g. Gaza Winter Project"
                        value={o.label}
                        invalid={Boolean(err(i, 'label'))}
                        onChange={(e) => patch(i, { label: e.target.value })}
                      />
                    </div>
                    <div className="w-[calc(50%-4px)] sm:w-44">
                      <Select aria-label="Heading" value={o.group} onChange={(e) => patch(i, { group: e.target.value as QuickGiveOption['group'] })}>
                        {QUICK_GIVE_GROUP_KEYS.map((g) => (
                          <option key={g} value={g}>
                            {QUICK_GIVE_GROUPS[g] || 'No heading (top)'}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="w-[calc(50%-4px)] sm:w-44">
                      <Select aria-label="Pays into fund" value={o.fund} onChange={(e) => patch(i, { fund: e.target.value as QuickGiveOption['fund'] })}>
                        {QUICK_GIVE_FUND_KEYS.map((f) => (
                          <option key={f} value={f}>
                            Fund: {QUICK_GIVE_FUNDS[f]}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 sm:ml-1">
                      <label htmlFor={`qg-on-${i}`} className="sr-only">
                        Show {o.label || 'this option'} on the home page
                      </label>
                      <Switch id={`qg-on-${i}`} checked={o.enabled} onChange={(v) => patch(i, { enabled: v })} />
                      <IconButton label={more ? 'Fewer details' : 'More details'} size="sm" onClick={() => setOpenRow(more ? null : o.id)}>
                        <ChevronDown className={cn('transition-transform', more && 'rotate-180')} />
                      </IconButton>
                      <IconButton label={`Remove ${o.label || 'this option'}`} size="sm" onClick={() => remove(i)}>
                        <Trash2 />
                      </IconButton>
                    </div>
                  </div>
                  {(err(i, 'label') || err(i, 'id')) && (
                    <p className="px-3 pb-2 text-[12.5px] text-red">{err(i, 'label') ?? err(i, 'id')}</p>
                  )}
                  {more && (
                    <div className="grid gap-3 border-t border-line-2 p-3 sm:grid-cols-2">
                      <Field label="Id" help="Used in links. Lower-case letters, numbers and dashes." error={err(i, 'id')}>
                        <div className="flex gap-2">
                          <Input value={o.id} onChange={(e) => patch(i, { id: e.target.value })} />
                          <Button size="sm" onClick={() => patch(i, { id: slug(o.label) })} disabled={!o.label}>
                            From name
                          </Button>
                        </div>
                      </Field>
                      <Field label="Read-more link" optional help="A page on the site, like /appeals/tarim-school" error={err(i, 'link')}>
                        <Input value={o.link} onChange={(e) => patch(i, { link: e.target.value })} />
                      </Field>
                      <Field label="Photograph" optional help="A file name under /assets/images (without -1200.jpg) or a full address. Empty uses the fund’s." error={err(i, 'photo')}>
                        <Input value={o.photo} onChange={(e) => patch(i, { photo: e.target.value })} />
                      </Field>
                      <Field label="Headline on the home page" optional help="Empty uses the fund’s." error={err(i, 'title')}>
                        <Input value={o.title} onChange={(e) => patch(i, { title: e.target.value })} />
                      </Field>
                      <Field label="Words under the headline" optional error={err(i, 'body')} className="sm:col-span-2">
                        <Textarea rows={2} value={o.body} onChange={(e) => patch(i, { body: e.target.value })} />
                      </Field>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        )}
        <Button icon={<Plus />} onClick={add} disabled={!draft}>
          Add an option
        </Button>
        <FormError message={formError} />
      </CardBody>
      <CardFooter className="flex-wrap">
        {dirty && <Badge tone="amber" dot className="mr-auto">Unsaved changes</Badge>}
        <Button variant="ghost" icon={<RotateCcw />} loading={reset.isPending} onClick={() => reset.mutate()}>
          Reset to defaults
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={() => q.data && (setDraft(q.data.items), setErrors({}), setFormError(null))}>
            Discard
          </Button>
        )}
        <Button variant="primary" loading={save.isPending} disabled={!dirty} onClick={() => draft && save.mutate(draft)}>
          Save list
        </Button>
      </CardFooter>
    </Card>
  )
}
