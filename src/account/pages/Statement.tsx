import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DESIGNATIONS, METHODS, type Designation, type Method } from '../../../shared/domain'
import { api, errorMessage } from '../../portal/api'
import { formatDate, formatDateLong, formatMoney } from '../../portal/format'
import { Callout } from '../../portal/ui'
import { keys, useTitle, type StatementDoc } from '../components/data'
import { AddressBlock, DgrStatement, DocumentFrame, Letterhead } from '../components/Document'

/* ---------------------------------------------------------------------------
   /account/statement/:fy — the whole financial year as one tax statement.

   Laid out like the paper an accountant expects: letterhead with ABN, who it
   is for, every gift with its date and receipt number, a total per
   designation (zakat, sadaqah…) and a grand total, and the DGR wording. A
   year still in progress says so at the top, so nobody files a half-year by
   mistake. Fees a donor chose to cover are shown in their own column and
   included in the total, because that money was given too.

   /account/statement/range?from=YYYY-MM-DD&to=YYYY-MM-DD is the same
   document for any dates the donor picked on My giving or Receipts & tax
   (last 12 months, a calendar year, everything): titled "Giving statement"
   rather than "Annual tax statement", since it need not match a tax year.
--------------------------------------------------------------------------- */

export default function Statement() {
  const fyParam = useParams().fy
  const [sp] = useSearchParams()
  const range = fyParam ? null : { from: sp.get('from') ?? '', to: sp.get('to') ?? '' }
  const fy = Number(fyParam)
  const q = useQuery({
    queryKey: range ? keys.rangeStatement(range.from, range.to) : keys.statement(fy),
    queryFn: () => (range ? api.get<StatementDoc>('/me/gifts/statement/range', range) : api.get<StatementDoc>(`/me/gifts/statement/${fy}`)),
    retry: false,
  })
  const s = q.data
  const isFy = s?.fy != null
  const docTitle = range ? 'Giving statement' : 'Tax statement'
  useTitle(s ? `${docTitle} ${s.label}` : docTitle)
  const fees = (s?.totals.fees ?? 0) > 0

  return (
    <DocumentFrame back="/account/receipts" backLabel="Receipts & tax" title={s ? `${docTitle} ${s.label}` : docTitle} loading={q.isLoading}>
      {q.error ? (
        <Callout tone="red">{errorMessage(q.error)}</Callout>
      ) : s ? (
        <div className="space-y-8">
          <Letterhead
            org={s.org}
            title={isFy ? 'Annual tax statement' : 'Giving statement'}
            facts={[
              ...(isFy ? [['Financial year', s.label] as [string, string]] : []),
              ['Period', `${formatDate(s.period.from)} – ${formatDate(s.period.to)}`],
              ['Issued', formatDate(s.issuedAt)],
            ]}
          />

          {!s.complete && (
            <p className="rounded-lg bg-[#fbf1dc] px-4 py-3 text-[12.5px] text-[#6d4700] ring-1 ring-[#ecd6a6]">
              {isFy ? (
                <>
                  <strong className="font-semibold">This financial year is still in progress.</strong> The statement shows donations received up to {formatDateLong(s.issuedAt)}. The final one is ready after 30 June {s.fy}.
                </>
              ) : (
                <>
                  <strong className="font-semibold">These dates run past today.</strong> The statement shows donations received up to {formatDateLong(s.issuedAt)}.
                </>
              )}
            </p>
          )}

          <div className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
            <AddressBlock label="Prepared for" name={s.donor.name} address={s.donor.address} extra={<p className="mt-1 text-[12px] text-[#6b7371]">Supporter number {s.donor.number}</p>} />
            <div className="sm:text-right print:text-right">
              <p className="text-[10.5px] font-semibold tracking-[.08em] text-[#6b7371] uppercase">Total tax-deductible donations</p>
              <p className="nums mt-1 font-serif text-[36px] leading-none text-[#1d4a3e]">{formatMoney(s.totals.total, { exact: true })}</p>
              <p className="mt-1.5 text-[12.5px] text-[#4d5553]">
                {s.totals.count} {s.totals.count === 1 ? 'donation' : 'donations'} between {formatDateLong(s.period.from)} and {formatDateLong(s.period.to)}
              </p>
            </div>
          </div>

          {s.gifts.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-[#6b7371]">No donations were received {isFy ? 'in this financial year' : 'between these dates'}.</p>
          ) : (
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-[#1b1f1e] text-left text-[10.5px] tracking-[.06em] text-[#4d5553] uppercase">
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="hidden py-2 pr-3 font-semibold sm:table-cell print:table-cell">Receipt no.</th>
                  <th className="py-2 pr-3 font-semibold">Donation</th>
                  <th className="hidden py-2 pr-3 font-semibold sm:table-cell print:table-cell">Given as</th>
                  {fees && <th className="hidden py-2 pr-3 text-right font-semibold sm:table-cell print:table-cell">Operating costs</th>}
                  <th className="py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {s.gifts.map((g) => (
                  <tr key={g.id} className="border-b border-[#e3e4e0] align-top break-inside-avoid">
                    <td className="nums py-2 pr-3 whitespace-nowrap">{formatDate(g.date)}</td>
                    <td className="nums hidden py-2 pr-3 whitespace-nowrap sm:table-cell print:table-cell">{g.receiptNumber}</td>
                    <td className="py-2 pr-3">
                      {g.appealTitle ?? 'Where most needed'}
                      {g.fundraiserTitle && <span className="text-[#6b7371]"> · via {g.fundraiserTitle}</span>}
                      <span className="block text-[11px] text-[#6b7371]">
                        <span className="sm:hidden print:hidden">
                          {g.receiptNumber} · {DESIGNATIONS[g.designation as Designation]?.short} ·{' '}
                        </span>
                        {METHODS[g.method as Method]?.label}
                      </span>
                    </td>
                    <td className="hidden py-2 pr-3 sm:table-cell print:table-cell">{DESIGNATIONS[g.designation as Designation]?.label}</td>
                    {fees && <td className="nums hidden py-2 pr-3 text-right sm:table-cell print:table-cell">{g.fee ? formatMoney(g.fee, { exact: true }) : '—'}</td>}
                    <td className="nums py-2 text-right whitespace-nowrap">{formatMoney(g.amount + g.fee, { exact: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {s.gifts.length > 0 && (
            <div className="ml-auto w-full max-w-[340px] break-inside-avoid">
              <p className="mb-2 text-[10.5px] font-semibold tracking-[.08em] text-[#6b7371] uppercase">By designation</p>
              <dl className="text-[12.5px]">
                {s.byDesignation.map((d) => (
                  <div key={d.designation} className="flex justify-between gap-4 border-b border-[#e3e4e0] py-1.5">
                    <dt>
                      {d.label} <span className="text-[#6b7371]">({d.count})</span>
                    </dt>
                    <dd className="nums">{formatMoney(d.total, { exact: true })}</dd>
                  </div>
                ))}
                {fees && (
                  <div className="flex justify-between gap-4 py-1.5 text-[#6b7371]">
                    <dt>of which operating costs contributions</dt>
                    <dd className="nums">{formatMoney(s.totals.fees, { exact: true })}</dd>
                  </div>
                )}
                <div className="mt-1 flex justify-between gap-4 border-t-2 border-[#1b1f1e] pt-2 text-[14px] font-semibold">
                  <dt>Total</dt>
                  <dd className="nums">{formatMoney(s.totals.total, { exact: true })}</dd>
                </div>
              </dl>
            </div>
          )}

          <div className="space-y-4 break-inside-avoid">
            <DgrStatement org={s.org} footer={s.receipts.footer.replace(/this (gift|donation)/, 'these donations')} />
            <p className="text-[11.5px] leading-relaxed text-[#6b7371]">
              This statement brings together the individual receipts already issued to you {isFy ? 'for this financial year' : 'between these dates'}; each receipt number above can be matched to its original. Please keep it with your tax records.
              It is a record of your donations, not tax advice.
            </p>
            <div className="pt-2">
              <p className="font-serif text-[15px]">{s.receipts.signatory}</p>
              <p className="text-[11.5px] text-[#6b7371]">{s.receipts.signatoryTitle}</p>
            </div>
          </div>
        </div>
      ) : null}
    </DocumentFrame>
  )
}
