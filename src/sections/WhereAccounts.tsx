import { ACCOUNTS, LATEST, money, share } from '../components/where-data'

/* ---------------------------------------------------------------------------
   Where it goes, section 2 of 8: every year of accounts, as filed.

   The markup that was inline in pages/WhereItGoes.tsx, unchanged. Why these
   figures are allowed to be printed, where they come from, why the word
   "audited" must not appear and why the bad year stays in are all written
   above ACCOUNTS in components/where-data.ts.

   The anchor is what the home page's impact band and the footer both land on.
   pb only: the band above brings its own space, and the section below changes
   ground, which does the separating at that end.
--------------------------------------------------------------------------- */

export default function WhereAccounts() {
  return (
    <section
      id="accounts"
      aria-labelledby="accounts-head"
      className="gutter mx-auto max-w-page scroll-mt-[calc(var(--header-h)+24px)] py-s5"
    >
      <h2 id="accounts-head" className="font-display text-2xl">
        Every year we have filed
      </h2>
      <p className="mt-s1 max-w-measure text-[15.5px] leading-relaxed text-text-2">
        Four financial years, as lodged with the ACNC. The share sent overseas is what is left
        after everything it costs to run the organisation, and in the year to 30 June{' '}
        <span className="nums">{LATEST.fy}</span> that was{' '}
        <span className="nums">{share(LATEST)}%</span>.
      </p>

      <div className="mt-s3 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <caption className="sr-only">
            Income and expenditure for each financial year Al-Anwaar Charity Group Ltd has lodged
            an Annual Information Statement with the ACNC.
          </caption>
          <thead>
            <tr className="border-b border-line text-[11px] font-semibold tracking-[0.13em] text-text-3 uppercase">
              <th scope="col" className="py-s1 pr-s3 font-semibold">
                Year ended 30 June
              </th>
              <th scope="col" className="py-s1 pr-s3 text-right font-semibold">
                Income
              </th>
              <th scope="col" className="py-s1 pr-s3 text-right font-semibold">
                Sent overseas
              </th>
              <th scope="col" className="py-s1 pr-s3 text-right font-semibold">
                Everything else
              </th>
              <th scope="col" className="py-s1 pr-s3 text-right font-semibold">
                Wages
              </th>
              <th scope="col" className="py-s1 text-right font-semibold">
                Share sent
              </th>
            </tr>
          </thead>
          <tbody>
            {ACCOUNTS.map((y) => {
              const latest = y.fy === LATEST.fy
              /* Nothing had been sent anywhere in the founding year, so the
                 two columns that would read "$0" and "0.0%" say so with a
                 dash instead. A zero there looks like a failure; it was a
                 charity that was three months old. */
              const sent = y.overseas > 0
              return (
                <tr
                  key={y.fy}
                  /* the year the headline is about, in full black; the
                     earlier ones step back, so the row being quoted is
                     obvious without a highlight sitting on it */
                  className={`border-b border-line-2 text-[15px] ${
                    latest ? 'font-semibold text-text' : 'text-text-2'
                  }`}
                >
                  {/* A row header is bold by default, which would leave the
                      year out of step with the row it labels. */}
                  <th
                    scope="row"
                    className={`nums py-s2 pr-s3 text-left ${
                      latest ? 'font-semibold' : 'font-normal'
                    }`}
                  >
                    {y.fy}
                  </th>
                  <td className="nums py-s2 pr-s3 text-right">{money(y.income)}</td>
                  <td className="nums py-s2 pr-s3 text-right">{sent ? money(y.overseas) : 'n/a'}</td>
                  <td className="nums py-s2 pr-s3 text-right">{money(y.other)}</td>
                  <td className="nums py-s2 pr-s3 text-right">{money(y.wages)}</td>
                  <td className="nums py-s2 text-right">{sent ? `${share(y)}%` : 'n/a'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* The two rows that need a sentence, said plainly rather than hidden
          behind a superscript. */}
      <div className="mt-s2 grid gap-s1 text-[13px] leading-relaxed text-text-3">
        <p>
          <span className="nums">2021</span> is the founding year. The company was registered on{' '}
          <span className="nums">30 July 2020</span>, and the first distribution came the year
          after, so there is nothing in the overseas column to report.
        </p>
        <p>
          In <span className="nums">{LATEST.fy}</span> we spent more than we raised:{' '}
          <span className="nums">{money(LATEST.total)}</span> went out against{' '}
          <span className="nums">{money(LATEST.income)}</span> in, and the difference came out of
          what was held.
        </p>
      </div>

      <p className="mt-s3 max-w-[92ch] border-t border-line pt-s2 text-[12.5px] leading-relaxed text-text-3">
        Every figure above is taken from the Annual Information Statement we lodge with the
        Australian Charities and Not-for-profits Commission each year, which the ACNC publishes in
        full. Al-Anwaar is a small charity under the ACNC&rsquo;s thresholds, so it is not required
        to lodge an audited financial report and has not lodged one. These are our own
        figures, prepared on a cash basis. If that ever changes, this paragraph changes with it.
      </p>
    </section>
  )
}
