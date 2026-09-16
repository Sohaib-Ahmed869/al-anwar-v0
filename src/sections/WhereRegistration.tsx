import { FACTS, REGISTER_SEARCH } from '../components/where-data'

/* ---------------------------------------------------------------------------
   Where it goes, section 7 of 8: registration.

   Written out as facts a donor can check, not as a wall of badges — the two
   marks sit at the end, after the sentences. The footer's "ACNC, ABN & DGR"
   link and the header menu's both land on #registration.

   The line under the list is new with the split: the section claims every fact
   in it can be checked against the register, and until now it did not hand
   over the register. It does.
--------------------------------------------------------------------------- */

export default function WhereRegistration() {
  return (
    <section
      id="registration"
      aria-labelledby="registration-head"
      className="scroll-mt-[calc(var(--header-h)+24px)] bg-paper-2 py-s5"
    >
      <div className="gutter mx-auto grid max-w-page gap-s4 lg:grid-cols-[minmax(0,3fr)_minmax(0,9fr)] lg:gap-s5">
        <div>
          <h2 id="registration-head" className="font-display text-2xl">
            Registration
          </h2>
          <p className="mt-s1 max-w-[22em] text-sm leading-relaxed text-text-2">
            Written out, not just stamped. Every line here can be checked against the ACNC
            register.
          </p>
        </div>

        <div>
          <dl className="grid max-w-[720px] gap-x-s4 sm:grid-cols-2">
            {FACTS.map((fact) => (
              <div key={fact.label} className="border-b border-line py-s1">
                <dt className="text-[13px] text-text-2">{fact.label}</dt>
                <dd className={`text-[15.5px] ${fact.nums ? 'nums' : ''}`}>{fact.value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-s2 max-w-measure text-[13px] leading-relaxed text-text-3">
            Look us up on the{' '}
            <a
              href={REGISTER_SEARCH}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-line underline-offset-4 transition-colors duration-200 ease-brand hover:text-green hover:decoration-green"
            >
              ACNC charity register
            </a>{' '}
            and check them yourself. You do not have to take any of it from us.
          </p>

          <div className="mt-s3 flex items-center gap-s2">
            <img
              src="/assets/images/Registered-ACNC.png"
              alt="Registered charity with the ACNC"
              className="h-16 w-auto"
            />
            <img
              src="/assets/images/100-Tax-Deductible.png"
              alt="Donations are 100% tax deductible"
              className="h-16 w-auto"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
