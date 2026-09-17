import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import FundraiserCard, { fundraiserGiveHref } from '../components/FundraiserCard'
import Reveal from '../components/Reveal'
import SectionHead, { BREAKOUT, SECTION_Y } from '../components/SectionHead'
import { MasjidMark } from '../components/Ornament'
import { LOCAL_NOTICE, type Fundraiser } from '../components/fundraiser-data'
import { PLACES, type Appeal } from '../components/appeals-data'
import { money } from '../components/appeal-view'
import { ORG } from '../components/org-data'
import { ArrowRight, Check, Copy, Facebook, Mail, WhatsApp } from '../components/icons'
import { allFundraisers } from '../services/fundraisers'

/* ---------------------------------------------------------------------------
   A single fundraiser, sections 2 and 3: the story, and more fundraisers.

   Left, the organiser's own words. Right, two panels: where the money goes
   (the appeal, in the logo teal, the thing that makes this genuine) and the
   latest supporters. Under the story, share buttons: a copy of the link, and
   plain share links to WhatsApp, Facebook and email. They are links, not
   embeds, so nothing from Meta loads on this page.

   A fundraiser started in this browser (f.local) opens with LOCAL_NOTICE: it
   is not published, and "Send it to us" drafts an email with everything in
   it so the office can set it up.
--------------------------------------------------------------------------- */

const fmtDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

function sendToUs(f: Fundraiser, appeal: Appeal) {
  const body = [
    `Title: ${f.title}`,
    `Organiser: ${f.organiser}`,
    `Appeal: ${appeal.title} (${PLACES[appeal.country]})`,
    `Goal: ${money(f.goal)}`,
    `Ends: ${f.ends}`,
    '',
    ...f.story,
  ].join('\n')
  return `mailto:${ORG.email}?subject=${encodeURIComponent(`New fundraiser: ${f.title}`)}&body=${encodeURIComponent(body)}`
}

export default function FundraiserBody({ fundraiser: f, appeal }: { fundraiser: Fundraiser; appeal: Appeal }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window === 'undefined' ? '' : window.location.href
  const share = `${f.title}: ${url}`

  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 2200)
    return () => window.clearTimeout(t)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      /* no clipboard: the address bar still has it */
    }
  }

  const more = allFundraisers()
    .filter((x) => x.slug !== f.slug)
    .slice(0, 3)

  const shareLink =
    'inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border border-line px-4 text-[14px] font-semibold text-text transition-colors duration-200 ease-brand hover:border-teal hover:text-teal'

  return (
    <>
      <section aria-labelledby="story-head" className={SECTION_Y}>
        <div className="gutter mx-auto max-w-page">
          {f.local && (
            <div
              className={`mb-s4 flex flex-col gap-s2 rounded-2xl bg-gold-pale/40 p-s3 ring-1 ring-gold/30 sm:flex-row sm:items-center sm:justify-between ${BREAKOUT}`}
            >
              <div>
                <p className="font-semibold">{LOCAL_NOTICE.title}</p>
                <p className="mt-1 max-w-[70ch] text-[14.5px] leading-relaxed text-text-2">{LOCAL_NOTICE.body}</p>
              </div>
              <a
                href={sendToUs(f, appeal)}
                className="inline-flex min-h-[46px] shrink-0 items-center gap-2 self-start rounded-[10px] bg-teal px-5 text-[14.5px] font-semibold text-paper transition-colors duration-200 ease-brand hover:bg-ink sm:self-auto"
              >
                <Mail className="h-4 w-4" />
                {LOCAL_NOTICE.action}
              </a>
            </div>
          )}

          <div className={`grid gap-s5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] ${BREAKOUT}`}>
            {/* --- the story --- */}
            <div>
              <Reveal variant="soft">
                <p className="font-script text-[clamp(21px,1.9vw,27px)] leading-none text-green">
                  In their own words
                </p>
                <h2
                  id="story-head"
                  className="mt-s2 font-display text-[clamp(28px,3vw,40px)] leading-[1.08] font-semibold tracking-[-0.022em]"
                >
                  Why this matters
                </h2>
              </Reveal>
              <Reveal delay={100}>
                <div className="mt-s3 space-y-s2">
                  {f.story.map((p) => (
                    <p key={p} className="max-w-[62ch] text-[17px] leading-[1.7] text-text-2">
                      {p}
                    </p>
                  ))}
                </div>
              </Reveal>

              <div className="mt-s4 border-t border-line pt-s3">
                <p className="text-[13px] font-semibold text-text-3">Share this fundraiser</p>
                <div className="mt-s2 flex flex-wrap gap-2">
                  <button type="button" onClick={copy} className={shareLink}>
                    {copied ? <Check className="h-4 w-4 text-teal" /> : <Copy className="h-4 w-4" />}
                    <span aria-live="polite">{copied ? 'Link copied' : 'Copy link'}</span>
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(share)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={shareLink}
                  >
                    <WhatsApp className="h-4 w-4" />
                    WhatsApp
                  </a>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={shareLink}
                  >
                    <Facebook className="h-4 w-4" />
                    Facebook
                  </a>
                  <a
                    href={`mailto:?subject=${encodeURIComponent(f.title)}&body=${encodeURIComponent(share)}`}
                    className={shareLink}
                  >
                    <Mail className="h-4 w-4" />
                    Email
                  </a>
                </div>
              </div>
            </div>

            {/* --- where it goes, and who has given --- */}
            <div className="flex flex-col gap-s2">
              <Reveal variant="clip">
                <div className="relative isolate overflow-hidden rounded-2xl bg-teal p-s3 text-paper sm:p-s4">
                  <MasjidMark className="pointer-events-none absolute -right-[8%] -bottom-[16%] -z-10 size-[200px] text-paper/[0.07]" />
                  <p className="font-script text-[clamp(22px,2vw,28px)] leading-none text-gold-pale">
                    Where your gift goes
                  </p>
                  <h3 className="mt-2 font-display text-[clamp(22px,2vw,28px)] leading-[1.15] font-semibold tracking-[-0.02em]">
                    {appeal.title}
                  </h3>
                  <p className="mt-s2 text-[15px] leading-[1.55] text-paper/85">{appeal.blurb}</p>
                  <Link
                    to={`/appeals/${appeal.slug}`}
                    className="group mt-s3 inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-gold-pale underline decoration-gold-pale/35 underline-offset-4 hover:decoration-gold-pale"
                  >
                    See the appeal
                    <ArrowRight className="h-3 w-3 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </Reveal>

              <Reveal variant="clip" delay={90}>
                <div className="rounded-2xl border border-line bg-paper p-s3 sm:p-s4">
                  <div className="flex items-center justify-between gap-s2">
                    <h3 className="font-display text-[20px] font-semibold tracking-[-0.016em]">
                      Latest supporters
                    </h3>
                    <span className="nums text-[13.5px] text-text-3">{f.supporters} in total</span>
                  </div>
                  {f.recent.length ? (
                    <ul className="mt-s2 divide-y divide-line">
                      {f.recent.map((s) => (
                        <li key={`${s.name}-${s.on}-${s.amount}`} className="flex gap-s2 py-s2">
                          <span
                            aria-hidden="true"
                            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal/10 font-display text-[15px] font-semibold text-teal"
                          >
                            {s.name.charAt(0)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap justify-between gap-x-s2 text-[15px]">
                              <span className="font-semibold">{s.name}</span>
                              <span className="nums font-semibold text-teal">{money(s.amount)}</span>
                            </p>
                            <p className="text-[12.5px] text-text-3">{fmtDate(s.on)}</p>
                            {s.message && (
                              <p className="mt-1 text-[14px] leading-snug text-text-2">“{s.message}”</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-s2 text-[14.5px] text-text-2">No gifts yet. Be the first to give.</p>
                  )}
                  <Link
                    to={fundraiserGiveHref(f)}
                    className="group mt-s2 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[10px] bg-gold px-6 text-[15.5px] font-semibold text-ink transition-colors duration-200 ease-brand hover:bg-gold-dark hover:text-paper"
                  >
                    Donate to this fundraiser
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 ease-brand group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {more.length > 0 && (
        <section aria-labelledby="more-head" className={`pt-0 ${SECTION_Y.replace('py-', 'pb-')}`}>
          <div className="gutter mx-auto max-w-page">
            <SectionHead
              id="more-head"
              eyebrow="Keep giving"
              title="More fundraisers"
              action={
                <Link
                  to="/fundraisers"
                  className="group inline-flex min-h-[50px] items-center gap-2 rounded-[10px] border border-ink/15 px-6 text-[15.5px] font-semibold text-text transition-colors duration-200 ease-brand hover:border-ink"
                >
                  See them all
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 ease-brand group-hover:translate-x-0.5" />
                </Link>
              }
            />
            <ul className={`mt-s4 grid gap-s2 sm:grid-cols-2 lg:grid-cols-3 ${BREAKOUT}`}>
              {more.map((x, i) => (
                <li key={x.slug} className="h-full">
                  <Reveal variant="clip" delay={i * 70} className="h-full">
                    <FundraiserCard fundraiser={x} />
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  )
}
