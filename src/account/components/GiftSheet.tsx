import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Clock, FileText, Mail, TriangleAlert } from 'lucide-react'
import { DESIGNATIONS, METHODS, type Designation, type Method } from '../../../shared/domain'
import { api, errorMessage } from '../../portal/api'
import { formatDateLong, formatDateTime, formatMoney } from '../../portal/format'
import { Button, ButtonLink, Callout, DescriptionList, Money, Sheet, StatusBadge, toast, buttonClass } from '../../portal/ui'
import { countryName } from './bits'
import { giveAgainHref, keys, type MyGift } from './data'
import { useDonor } from '../../portal/session'

/* ---------------------------------------------------------------------------
   One gift, every fact about it. Opened from the giving list, the overview
   and the receipts page, so a donor never has to hunt for the same answer in
   two places.

   The two things a donor usually came for sit at the bottom, big enough for a
   thumb: email the receipt again, and open it to print. A gift still waiting
   for its bank transfer explains how to pay instead, with the reference.
--------------------------------------------------------------------------- */

export function GiftSheet({ gift, onClose }: { gift: MyGift | null; onClose: () => void }) {
  const qc = useQueryClient()
  const donor = useDonor()
  const resend = useMutation({
    mutationFn: (id: string) => api.post<{ to: string }>(`/me/gifts/${id}/resend`),
    onSuccess: (r) => {
      toast.success(`Receipt sent to ${r.to}`, { description: 'It usually arrives within a minute.' })
      qc.invalidateQueries({ queryKey: keys.all })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const g = gift
  const ok = g?.status === 'succeeded'
  const total = g ? g.amount + (g.fee ?? 0) : 0

  return (
    <Sheet
      open={Boolean(g)}
      onOpenChange={(v) => !v && onClose()}
      title={g ? (g.appealTitle ?? 'Where most needed') : ''}
      description={g ? formatDateLong(g.date) : undefined}
      width={480}
      footer={
        g && ok ? (
          <>
            <Button variant="secondary" icon={<Mail />} loading={resend.isPending} onClick={() => resend.mutate(g.id)}>
              Email my receipt again
            </Button>
            <ButtonLink variant="primary" to={`/account/receipt/${g.id}`} icon={<FileText />}>
              View / print receipt
            </ButtonLink>
          </>
        ) : undefined
      }
    >
      {g && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-paper-2 px-5 py-5 ring-1 ring-line-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12.5px] font-medium text-text-2">{ok ? 'You gave' : g.status === 'pending' ? 'You pledged' : 'Attempted'}</p>
                <Money cents={total} exact className="mt-1 block text-[32px] leading-none font-semibold tracking-[-0.02em] text-text" />
              </div>
              <StatusBadge kind="gift" value={g.status} />
            </div>
            {g.fee > 0 && (
              <p className="mt-2.5 text-[12.5px] text-text-2">
                Includes <Money cents={g.fee} exact /> you added towards operating costs, on top of your <Money cents={g.amount} exact /> donation.
              </p>
            )}
          </div>

          {g.status === 'pending' && (
            <Callout tone="amber" icon={<Clock />} title="Waiting for your bank transfer">
              Use the reference <strong className="nums tracking-wide">{g.reference}</strong> so we can match it to you. Your receipt is emailed the day it arrives.
            </Callout>
          )}
          {g.status === 'failed' && (
            <Callout tone="red" icon={<TriangleAlert />} title="This payment did not go through">
              {g.failureReason ?? 'The bank declined it.'} Nothing was taken from your account.
              {g.plan && (
                <>
                  {' '}
                  <Link to={`/account/plans?fix=${g.plan}`} className="font-medium underline underline-offset-2">
                    Update the card on this regular donation
                  </Link>
                </>
              )}
            </Callout>
          )}

          <DescriptionList
            items={[
              { label: 'Receipt number', value: <span className="nums font-medium">{g.receipt?.number}</span>, hidden: !g.receipt?.number },
              { label: 'Given as', value: <StatusBadge kind="designation" value={g.designation} size="sm" /> },
              { label: 'Appeal', value: g.appealTitle ?? 'Where most needed' },
              { label: 'Through', value: g.fundraiserTitle, hidden: !g.fundraiserTitle },
              { label: 'Country', value: countryName(g.country), hidden: !g.country },
              { label: 'Paid by', value: METHODS[g.method as Method]?.label ?? g.method },
              { label: 'Donation amount', value: <Money cents={g.amount} exact /> },
              { label: 'Operating costs contribution', value: <Money cents={g.fee} exact />, hidden: !g.fee },
              { label: 'Bank reference', value: <span className="nums">{g.reference}</span>, hidden: !g.reference },
              { label: 'Part of', value: <Link to="/account/plans" className="text-green hover:underline">A regular donation</Link>, hidden: !g.plan },
              { label: 'Shown publicly as', value: g.anonymous ? 'Anonymous' : 'Your name', hidden: !g.fundraiser },
              { label: 'Donation number', value: <span className="nums text-text-2">{g.number}</span> },
            ]}
          />

          {g.message && (
            <div>
              <p className="mb-1.5 text-[12.5px] font-medium text-text-2">Your message</p>
              <p className="rounded-xl bg-paper-2 px-4 py-3 text-[14px] leading-relaxed text-text italic ring-1 ring-line-2">“{g.message}”</p>
            </div>
          )}

          {ok && g.receipt?.number && (
            <p className="text-[12.5px] leading-relaxed text-text-3">
              Receipt issued {formatDateLong(g.receipt.issuedAt)} for your {DESIGNATIONS[g.designation as Designation]?.label.toLowerCase()} donation
              {g.receipt.emailedAt && <>; last emailed {formatDateTime(g.receipt.emailedAt)}{donor ? ` to ${donor.email}` : ''}</>}.
            </p>
          )}

          {ok && g.appealSlug && g.appealOpen !== false && (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-gold-50 px-4 py-3.5 ring-1 ring-gold/20">
              <p className="text-[13.5px] text-text">Give to this appeal again?</p>
              <a href={giveAgainHref({ appealSlug: g.appealSlug, designation: g.designation, amount: g.amount })} className={buttonClass('give', 'sm')}>
                Give again
              </a>
            </div>
          )}
          {!ok && !g.plan && g.status === 'failed' && (
            <p className="text-[13px] text-text-2">
              Want to try again? <a href={giveAgainHref({ appealSlug: g.appealSlug, designation: g.designation, amount: g.amount })} className="font-medium text-gold-dark hover:underline">Give {formatMoney(g.amount)} now</a>
            </p>
          )}
        </div>
      )}
    </Sheet>
  )
}
