import Reveal from '../components/Reveal'
import { PARTNERS, PLACES, ROUTINE } from '../components/where-data'

/* ---------------------------------------------------------------------------
   Where it goes, section 5 of 8: who delivers it.

   THE COUNT IS THE HONEST PART
   Every charity website has a partners section and most of them are a row of
   logos under the words "our trusted local partners", which tells a reader
   nothing and cannot be checked. This one opens by saying how many of the five
   places we can name a partner for and how many we cannot. Both numbers are
   derived — PARTNERS.length against PLACES.length — so neither can drift when
   a name is added, and adding the four missing names is the only edit needed
   to make the sentence read well.

   A PRACTICE WITH ONE NAMED EXAMPLE IS WORTH MORE THAN FIVE UNNAMED LOGOS
   So the weight of the section is on ROUTINE: how the work is done wherever it
   is done. All three lines were established on the About page off the first
   distribution in Tarim, and the third one — photographed at the handover — is
   the rule the log in the section above is built on, which is why it is worth
   restating here rather than assuming it carried.

   Sand, and the only sand band on the page apart from the ask at the foot.
--------------------------------------------------------------------------- */

export default function WherePartners() {
  const named = PARTNERS.length
  const unnamed = PLACES.length - named

  return (
    <section
      id="partners"
      aria-labelledby="partners-head"
      className="scroll-mt-[calc(var(--header-h)+24px)] bg-sand py-s5 lg:py-s6"
    >
      <div className="gutter mx-auto max-w-page">
        <div className="grid gap-s4 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-s5">
          <div>
            <p className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.16em] text-green uppercase">
              <span aria-hidden="true" className="h-px w-6 bg-green/40" />
              Who delivers it
            </p>
            <h2
              id="partners-head"
              className="mt-s1 max-w-[15ch] font-display text-[clamp(26px,3vw,38px)] leading-snug"
            >
              We do not deliver anonymously
            </h2>
            <p className="mt-s2 max-w-measure text-[15.5px] leading-relaxed text-text-2">
              Of the <span className="nums">{PLACES.length}</span> places we work in, we can name
              the organisation that delivers in <span className="nums">{named}</span>. The other{' '}
              <span className="nums">{unnamed}</span> are delivered by people we have not yet been
              given names for, and until we have them this section will go on saying so.
            </p>
          </div>

          <div>
            {/* The one we can name, given the space a named thing deserves. */}
            {PARTNERS.map((partner) => (
              <Reveal key={partner.id}>
                <article className="border-t border-line pt-s3">
                  <p className="text-[11px] font-semibold tracking-[0.13em] text-text-3 uppercase">
                    {partner.place}
                  </p>
                  <h3 className="mt-1.5 font-display text-[clamp(20px,1.9vw,25px)] leading-tight tracking-[-0.018em]">
                    {partner.name}
                  </h3>
                  <p className="mt-s2 max-w-measure text-[15px] leading-relaxed text-text-2">
                    {partner.body}
                  </p>
                </article>
              </Reveal>
            ))}

            {/* How it is done everywhere, named partner or not. */}
            <div className="mt-s4 grid gap-s3 border-t border-line pt-s3 sm:grid-cols-3 sm:gap-s3">
              {ROUTINE.map((rule, i) => (
                <Reveal key={rule.title} delay={i * 70}>
                  <h3 className="font-display text-[17px] leading-snug tracking-[-0.01em]">
                    {rule.title}
                  </h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-text-2">{rule.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
