import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Check, Copy, ExternalLink, Flag, Hourglass, Megaphone, MessageSquareText, Pencil, Plus, Share2 } from 'lucide-react'
import { useState } from 'react'
import { FUNDRAISER_OCCASIONS, type FundraiserStatus } from '../../../shared/domain'
import { api, errorMessage } from '../../portal/api'
import { formatDate, formatMoney, plural } from '../../portal/format'
import { Button, ButtonLink, Callout, Card, EmptyState, Money, PageHeader, Progress, Skeleton, StatusBadge, cn, toast, useConfirm } from '../../portal/ui'
import { keys, useTitle, type MyFundraiser } from '../components/data'

/* ---------------------------------------------------------------------------
   The donor's own fundraising pages.

   Each status is explained in words next to its badge, because "Awaiting
   approval" on its own reads like something went wrong. The team's note is
   shown when they asked for changes, with Edit right there. A live page gets
   its share link front and centre — that is what a fundraiser is for — using
   the phone's own share sheet where there is one.
--------------------------------------------------------------------------- */

const EXPLAIN: Record<FundraiserStatus, string> = {
  pending: 'Awaiting approval — the team reads every page before it goes public. It usually takes a working day, and we will email you.',
  live: 'Live — anyone with the link can give, and every donation counts towards the appeal.',
  changes: 'The team has asked for a few changes before it goes public. Edit the page and it comes straight back to them.',
  rejected: 'This page was not approved. Our email explains why — reply to it if you would like to talk it through.',
  ended: 'Ended — the page is closed to new donations. Everything it raised has gone to the appeal.',
}

export default function Fundraisers() {
  useTitle('Fundraisers')
  const q = useQuery({ queryKey: keys.fundraisers, queryFn: () => api.get<{ items: MyFundraiser[] }>('/me/fundraisers') })
  const items = q.data?.items ?? []

  return (
    <div>
      <PageHeader
        title="Fundraisers"
        description="Your own pages for a wedding, a birthday, a walk or a Ramadan challenge. Every donation made on them goes to the appeal you chose."
        actions={items.length > 0 && <ButtonLink to="/account/fundraisers/new" variant="primary" icon={<Plus />}>Start a fundraiser</ButtonLink>}
      />
      {q.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <HowItWorks />
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {items.map((f) => (
            <FundraiserCard key={f.id} f={f} />
          ))}
        </div>
      )}
    </div>
  )
}

function FundraiserCard({ f }: { f: MyFundraiser }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/fundraisers/${f.slug}`
  const editable = f.status !== 'ended' && f.status !== 'rejected'
  const pct = f.target ? Math.round((f.raised / f.target) * 100) : 0

  const end = useMutation({
    mutationFn: () => api.post(`/me/fundraisers/${f.id}/end`),
    onSuccess: () => {
      toast.success('Your fundraiser has ended', { description: 'Thank you — everything it raised has gone to the appeal.' })
      qc.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const share = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
    if (nav.share && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await nav.share({ title: f.title, text: `I am raising money for ${f.appealTitle}. Would you give?`, url })
        return
      } catch {
        /* dismissed: fall through to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Link copied', { description: 'Paste it into a message, email or post.' })
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Could not copy — select the link and copy it yourself.')
    }
  }

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="px-5 pt-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[12.5px] font-medium text-text-3">{FUNDRAISER_OCCASIONS[f.occasion]}</p>
          <StatusBadge kind="fundraiser" value={f.status} size="sm" />
        </div>
        <h2 className="mt-1 text-[19px] leading-snug font-semibold tracking-[-0.01em] text-text">{f.title}</h2>
        <p className="mt-0.5 text-[13.5px] text-text-2">For {f.appealTitle}</p>

        <div className="mt-5 flex items-baseline justify-between gap-2">
          <p>
            <Money cents={f.raised} className="text-[26px] font-semibold tracking-[-0.02em] text-text" />
            <span className="ml-1.5 text-[13px] text-text-2">of {formatMoney(f.target)}</span>
          </p>
          <span className="nums text-[13px] font-medium text-text-2">{pct}%</span>
        </div>
        <Progress value={f.raised} max={f.target} className="mt-2" label="Raised so far" />
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-text-2">
          <span>{plural(f.donorCount, 'supporter')}</span>
          {(f.pendingAmount ?? 0) > 0 && <span>+ {formatMoney(f.pendingAmount)} on its way by bank transfer</span>}
          {f.endsAt && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" /> {f.status === 'ended' ? 'Ended' : 'Ends'} {formatDate(f.endsAt)}
            </span>
          )}
        </p>
      </div>

      <div className="mx-5 mt-4 sm:mx-6">
        <p className={cn('flex gap-2 text-[13px] leading-relaxed', f.status === 'live' ? 'text-green' : f.status === 'rejected' ? 'text-red' : 'text-text-2')}>
          {f.status === 'pending' ? <Hourglass className="mt-0.5 size-4 shrink-0" /> : f.status === 'live' ? <Megaphone className="mt-0.5 size-4 shrink-0" /> : <Flag className="mt-0.5 size-4 shrink-0" />}
          {EXPLAIN[f.status]}
        </p>
        {f.review?.note && (f.status === 'changes' || f.status === 'rejected') && (
          <Callout tone={f.status === 'changes' ? 'amber' : 'neutral'} icon={<MessageSquareText />} className="mt-3" title={`From ${f.review.by}`}>
            “{f.review.note}”
          </Callout>
        )}
      </div>

      {f.status === 'live' && (
        <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl bg-paper-2 py-1.5 pr-1.5 pl-3 ring-1 ring-line-2 sm:mx-6">
          <span className="min-w-0 flex-1 truncate text-[13px] text-text-2 select-all">{url.replace(/^https?:\/\//, '')}</span>
          <Button size="sm" variant="primary" icon={copied ? <Check /> : 'share' in navigator ? <Share2 /> : <Copy />} onClick={share}>
            {copied ? 'Copied' : 'Share'}
          </Button>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 px-5 py-4 sm:px-6">
        {editable && (
          <ButtonLink to={`/account/fundraisers/${f.id}`} variant={f.status === 'changes' ? 'primary' : 'secondary'} icon={<Pencil />}>
            Edit page
          </ButtonLink>
        )}
        {f.status === 'live' && (
          <a href={`/fundraisers/${f.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-[14px] font-medium text-text-2 hover:bg-ink/5 hover:text-text">
            View page <ExternalLink className="size-4" />
          </a>
        )}
        {(f.status === 'live' || f.status === 'pending' || f.status === 'changes') && (
          <Button
            variant="ghost"
            className="ml-auto text-text-3 hover:text-red"
            loading={end.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: 'End this fundraiser?',
                body: f.raised > 0
                  ? `The page will close to new donations. The ${formatMoney(f.raised)} it raised stays with ${f.appealTitle}, and the page stays in your account.`
                  : 'The page will close and no one will be able to give on it. It stays in your account.',
                confirmLabel: 'End fundraiser',
                tone: 'danger',
              })
              if (ok) end.mutate()
            }}
          >
            End
          </Button>
        )}
      </div>
    </Card>
  )
}

function HowItWorks() {
  const steps = [
    { t: 'Choose an appeal', d: 'Food in Yemen, water, a school — every donation on your page goes to it.' },
    { t: 'Tell your story', d: 'Why it matters to you, and a target. A few honest sentences work best.' },
    { t: 'We check, you share', d: 'The team reads every page before it goes public, then you share the link.' },
  ]
  return (
    <Card>
      <EmptyState
        icon={<Megaphone />}
        title="Raise money with your own page"
        action={<ButtonLink to="/account/fundraisers/new" variant="primary" icon={<Plus />}>Start a fundraiser</ButtonLink>}
      >
        For a wedding, a birthday, a walk or a Ramadan challenge. It takes about five minutes.
      </EmptyState>
      <ol className="grid gap-4 border-t border-line-2 px-5 py-6 sm:grid-cols-3 sm:px-8">
        {steps.map((s, i) => (
          <li key={s.t} className="flex gap-3">
            <span className="nums grid size-7 shrink-0 place-items-center rounded-full bg-green-50 text-[13px] font-semibold text-green">{i + 1}</span>
            <div>
              <p className="text-[14px] font-medium text-text">{s.t}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-text-2">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}
