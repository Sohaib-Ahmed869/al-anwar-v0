import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { COUNTRIES, DESIGNATIONS, METHODS, type Designation, type Method } from '../../../shared/domain'
import { api, errorMessage } from '../../portal/api'
import { formatDate, formatDateLong, formatMoney } from '../../portal/format'
import { Callout } from '../../portal/ui'
import { keys, useTitle, type ReceiptDoc } from '../components/data'
import { AddressBlock, DgrStatement, DocumentFrame, Letterhead } from '../components/Document'

/* ---------------------------------------------------------------------------
   /account/receipt/:id — one gift's tax receipt, as a document.

   It carries what an Australian DGR receipt must: the organisation's name and
   ABN, the donor's name, the amount, the date received, a unique receipt
   number, the DGR statement and "no goods or services were provided". Same
   facts and wording as the emailed receipt (server/emails/templates.ts), so
   a printed copy and the email can never disagree.
--------------------------------------------------------------------------- */

export default function ReceiptView() {
  const { id = '' } = useParams()
  const q = useQuery({ queryKey: keys.receipt(id), queryFn: () => api.get<ReceiptDoc>(`/me/gifts/receipt/${id}`) })
  const r = q.data
  const g = r?.gift
  useTitle(g?.receipt?.number ? `Receipt ${g.receipt.number}` : 'Receipt')
  const total = g ? g.amount + (g.fee ?? 0) : 0

  return (
    <DocumentFrame back="/account/receipts" backLabel="Receipts & tax" title="Tax receipt" loading={q.isLoading}>
      {q.error ? (
        <Callout tone="red">{errorMessage(q.error)}</Callout>
      ) : r && g ? (
        <div className="space-y-8">
          {/* a gift taken while payments were simulated (finding C2): said in
              print as well as on screen, so a printed copy can never pass for a
              tax receipt */}
          {g.simulated && (
            <p role="note" className="rounded-lg border-2 border-[#a63a1c] px-4 py-3 text-[13.5px] leading-relaxed font-semibold text-[#a63a1c]">
              TEST RECEIPT — no money was taken. This donation was made while online payments were in test mode. It is not a tax receipt
              and cannot be used for a tax return.
            </p>
          )}
          <Letterhead
            org={r.org}
            title="Tax receipt"
            facts={[
              ['Receipt no.', g.receipt?.number ?? '—'],
              ['Date received', formatDate(g.date)],
              ['Issued', formatDate(g.receipt?.issuedAt)],
            ]}
          />

          <div className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
            <AddressBlock label="Received with thanks from" name={r.donor.name} address={r.donor.address} extra={<p className="mt-1 text-[12px] text-[#6b7371]">Supporter number {r.donor.number}</p>} />
            <div className="sm:text-right print:text-right">
              <p className="text-[10.5px] font-semibold tracking-[.08em] text-[#6b7371] uppercase">Amount received</p>
              <p className="nums mt-1 font-serif text-[40px] leading-none text-[#1d4a3e]">{formatMoney(total, { exact: true })}</p>
              <p className="mt-1.5 text-[12.5px] text-[#4d5553]">on {formatDateLong(g.date)}</p>
            </div>
          </div>

          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {(
                [
                  ['Given to', g.appealTitle ?? 'Where most needed'],
                  g.fundraiserTitle ? ['Through', g.fundraiserTitle] : null,
                  g.country ? ['Country', COUNTRIES[g.country] ?? g.country] : null,
                  ['Given as', DESIGNATIONS[g.designation as Designation]?.label],
                  ['Paid by', METHODS[g.method as Method]?.label],
                  ['Donation', formatMoney(g.amount, { exact: true })],
                  g.fee ? ['Operating costs contribution', formatMoney(g.fee, { exact: true })] : null,
                  ['Donation reference', g.number],
                ] as ([string, string] | null)[]
              )
                .filter((x): x is [string, string] => Boolean(x))
                .map(([k, v]) => (
                  <tr key={k} className="border-b border-[#e3e4e0]">
                    <th scope="row" className="w-[42%] py-2.5 pr-4 text-left font-normal text-[#4d5553]">
                      {k}
                    </th>
                    <td className="nums py-2.5 text-right">{v}</td>
                  </tr>
                ))}
              <tr>
                <th scope="row" className="pt-3 pr-4 text-left text-[14px] font-semibold">
                  Total tax-deductible donation
                </th>
                <td className="nums border-t-2 border-[#1b1f1e] pt-3 text-right text-[15px] font-semibold">{formatMoney(total, { exact: true })}</td>
              </tr>
            </tbody>
          </table>

          <div className="space-y-5 break-inside-avoid">
            <DgrStatement org={r.org} footer={r.receipts.footer} />
            <p className="font-serif text-[15px] leading-relaxed text-[#2c3432] italic">May Allah accept it from you and put barakah in what remains.</p>
            <div>
              <p className="font-serif text-[15px]">{r.receipts.signatory}</p>
              <p className="text-[11.5px] text-[#6b7371]">{r.receipts.signatoryTitle}</p>
            </div>
            <p className="text-[11px] text-[#8a908e]">Keep this receipt for your tax records. It is a copy of the receipt emailed to {r.donor.email}.</p>
          </div>
        </div>
      ) : null}
    </DocumentFrame>
  )
}
