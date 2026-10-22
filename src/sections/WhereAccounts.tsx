import Reveal, { useInView } from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { ACCOUNTS, LATEST, money, share } from '../components/where-data'

/* ---------------------------------------------------------------------------
   Where it goes, section 2 of 5: every year we have filed.

   Rebuilt 17 September 2026 at the user's request. The six-column table and
   its three paragraphs became one row per year: the year, what came in, and a
   bar split into what was sent overseas (teal) and everything else (pale
   gold), drawn to the same scale across the years so the years compare. The
   figures are unchanged and all filed (see ACCOUNTS in where-data.ts).

   Two things are still said in words, because a chart alone would mislead:
   2021 sent nothing (the charity was months old), and the latest year spent
   more than it raised. And one line under the chart says the figures are our
   own, not audited, because a small charity is not required to lodge an
   audited report. The word "audited" must not be used of these figures.
--------------------------------------------------------------------------- */

export default function WhereAccounts() {
  const [ref, shown] = useInView<HTMLOListElement>()
  const max = Math.max(...ACCOUNTS.map((y) => Math.max(y.total, y.income)))
  const years = [...ACCOUNTS].reverse()

  return (
    <section id="accounts" aria-labelledby="accounts-head" className={`scroll-mt-[calc(var(--header-h)+24px)] ${SECTION_Y}`}>
      <div className="gutter mx-auto max-w-page">
        <SectionHead
          id="accounts-head"
          eyebrow="The accounts"
          title="Every year we have filed."
          lede={`As lodged with the ACNC. In the year to 30 June ${LATEST.fy}, ${share(LATEST)}% of what we spent was sent overseas.`}
        />

        <Reveal variant="clip" className={`mt-s4 block lg:mt-s5 ${BREAKOUT}`}>
          <div className="rounded-2xl border border-line bg-paper p-s3 sm:p-s4 lg:p-[clamp(32px,3.2vw,52px)]">
            {/* the key */}
            <div className="flex flex-wrap items-center gap-x-s3 gap-y-2 text-[13.5px] text-text-2">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="h-2.5 w-5 rounded-full bg-teal" />
                Sent overseas
              </span>
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="h-2.5 w-5 rounded-full bg-gold-pale" />
                Everything else
              </span>
              <span className="nums ml-auto text-text-3">Wages: $0 every year</span>
            </div>

            <ol ref={ref} className="mt-s3">
              {years.map((y, i) => {
                const sent = y.overseas > 0
                return (
                  <li
                    key={y.fy}
                    className="grid gap-x-s3 gap-y-2 border-t border-line py-s3 sm:grid-cols-[minmax(0,2fr)_minmax(0,7fr)_minmax(0,3fr)] sm:items-center"
                  >
                    <div>
                      <p className="nums font-display text-[clamp(24px,2.2vw,30px)] leading-none tracking-[-0.02em]">
                        {y.fy}
                      </p>
                      <p className="nums mt-1 text-[13px] text-text-3">Income {money(y.income)}</p>
                    </div>

                    <div>
                      <div
                        className="flex h-3.5 overflow-hidden rounded-full bg-line-2"
                        role="img"
                        aria-label={`${money(y.overseas)} sent overseas and ${money(y.other)} on everything else, of ${money(y.total)} spent`}
                      >
                        <span
                          className="h-full bg-teal transition-[width] duration-[1200ms] ease-brand"
                          style={{ width: shown ? `${(y.overseas / max) * 100}%` : '0%', transitionDelay: `${i * 150}ms` }}
                        />
                        <span
                          className="h-full bg-gold-pale transition-[width] duration-[1200ms] ease-brand"
                          style={{ width: shown ? `${(y.other / max) * 100}%` : '0%', transitionDelay: `${i * 150 + 200}ms` }}
                        />
                      </div>
                      <p className="nums mt-2 text-[13.5px] text-text-2">
                        {sent ? (
                          <>
                            <span className="font-semibold text-teal">{money(y.overseas)}</span> sent overseas,{' '}
                            {money(y.other)} everything else
                          </>
                        ) : (
                          <>Founding year: nothing sent yet, {money(y.other)} to set up</>
                        )}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <p className="nums font-display text-[clamp(22px,2vw,28px)] leading-none tracking-[-0.02em] text-teal">
                        {sent ? `${share(y)}%` : 'n/a'}
                      </p>
                      <p className="mt-1 text-[12.5px] text-text-3">
                        {!sent ? 'Founding year' : y.total > y.income ? 'Spent more than raised' : 'Sent overseas'}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>

            <p className="border-t border-line pt-s3 text-[13px] leading-relaxed text-text-3">
              Figures are from the Annual Information Statement we lodge with the ACNC each year. As a
              small charity we are not required to lodge an audited report, so these are our own
              figures, prepared on a cash basis.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
