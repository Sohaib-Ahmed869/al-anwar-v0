import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Check } from '../components/icons'
import { CONFIRM } from '../components/fundraiser-data'
import { confirmFundraiser } from '../services/fundraisers'

/* ---------------------------------------------------------------------------
   /fundraisers/confirm?t=… — where the link lands that a fundraiser organiser
   is emailed when they started a page on /fundraisers/start without being
   signed in (finding M10). Until it is used the page is 'unverified': nobody
   here sees it, and it is deleted after 7 days.

   One click rather than confirming on arrival, for the same reason as
   /letter/confirm: mail providers and link scanners open every link in an
   email before a person does, and a GET that confirmed would vouch for an
   address whose owner never saw the message. The token is posted back only
   when someone presses the button.

   Words live in fundraiser-data.ts. The button is teal: gold is only for giving.
--------------------------------------------------------------------------- */

type State =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; already: boolean }
  | { kind: 'failed'; message: string }

export default function FundraiserConfirm() {
  const [params] = useSearchParams()
  const token = params.get('t') ?? ''
  const [state, setState] = useState<State>({ kind: 'idle' })
  const c = CONFIRM

  const confirm = async () => {
    setState({ kind: 'busy' })
    const r = await confirmFundraiser(token)
    setState(r.ok ? { kind: 'done', already: r.already } : { kind: 'failed', message: r.message ?? c.failed })
  }

  const done = state.kind === 'done' ? (state.already ? c.already : c.done) : null
  return (
    <div className="gutter mx-auto max-w-page py-s5 sm:py-s6">
      <div className="mx-auto max-w-[680px]">
        <header>
          {done && (
            <span className="mb-s3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-teal text-paper">
              <Check className="h-5 w-5" />
            </span>
          )}
          <p className="text-[11px] font-semibold tracking-[0.13em] text-text-3 uppercase">{c.eyebrow}</p>
          <h1 className="mt-s1 font-display text-[clamp(32px,4.4vw,48px)] leading-[1.08] tracking-[-0.022em] text-ink">
            {done ? done.title : c.title}
          </h1>
          <p role="status" className="mt-s2 max-w-measure text-[16.5px] leading-relaxed text-text-2">
            {done ? done.body : token ? c.body : c.missing}
          </p>
        </header>

        {!done && token && (
          <div className="mt-s4 flex flex-wrap items-center gap-s2">
            <button
              type="button"
              onClick={confirm}
              disabled={state.kind === 'busy'}
              className="inline-flex min-h-[52px] items-center gap-2.5 rounded-[14px] bg-teal px-6 text-[15.5px] font-semibold text-paper transition-[transform,opacity] duration-200 ease-brand hover:-translate-y-[1.5px] disabled:opacity-60"
            >
              {state.kind === 'busy' ? 'Confirming…' : c.button}
            </button>
          </div>
        )}
        {state.kind === 'failed' && (
          <p role="alert" className="mt-s3 text-[15px] leading-relaxed text-red">
            {state.message}
          </p>
        )}

        <p className="mt-s4 text-[15px]">
          <Link to="/fundraisers" className="text-teal underline decoration-teal/30 underline-offset-4 hover:decoration-teal">
            See other fundraisers
          </Link>
        </p>
      </div>
    </div>
  )
}
