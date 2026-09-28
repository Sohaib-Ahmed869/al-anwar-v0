import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { answerById, CHAT, matchAnswer, type ChatAnswer } from './chat-data'
import { ENDPOINT, looksLikeEmail } from '../services/contact'
import { ArrowRight, Close, Mail, Send, WhatsApp } from './icons'
import { hasBottomBar } from './RecentGifts'

/* ---------------------------------------------------------------------------
   The help chat, bottom right of the public site. Mounted once in Layout, so
   the portals never draw it.

   NOT A CHATBOT. Every answer is written in chat-data.ts; matchAnswer scores
   what was typed against each answer's keywords and either gives the best
   one or says it does not know. When it does not know, it offers a three-
   field form that posts to the contact form's endpoint (/api/public/
   enquiries, subject "Chat question"), so the question lands in Admin →
   Enquiries and the reply goes by email. Email and WhatsApp links sit under
   it for anyone who would rather.

   ACCESSIBILITY. The panel is a non-modal-looking dialog that behaves like a
   modal while open: focus moves to the input, Tab stays inside, Escape closes
   it and focus returns to the launcher. New replies are announced through
   the log's aria-live="polite".

   ON PHONES the launcher is lifted above the fixed give bars on an appeal,
   the zakat calculator and /give (hasBottomBar, shared with RecentGifts), so
   it never covers the give button. The open panel takes the width of the
   screen less a gutter and never the full height, so the page stays visible
   behind it.
--------------------------------------------------------------------------- */

type Msg =
  | { id: number; from: 'me'; text: string }
  | { id: number; from: 'bot'; answer: ChatAnswer; others: ChatAnswer[] }
  | { id: number; from: 'bot'; text: string; ask?: boolean; others?: ChatAnswer[] }

let seq = 0

export default function HelpChat() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const panel = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const launcher = useRef<HTMLButtonElement>(null)
  const log = useRef<HTMLDivElement>(null)
  const uid = useId()
  const lifted = hasBottomBar(pathname)

  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  /* keep the newest message in view */
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight })
  }, [msgs])

  /* a link inside an answer navigates: close so the new page is seen */
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const close = () => {
    setOpen(false)
    launcher.current?.focus()
  }

  const ask = (text: string, chosen?: ChatAnswer) => {
    const q = text.trim()
    if (!q) return
    const me: Msg = { id: ++seq, from: 'me', text: q }
    if (chosen) {
      setMsgs((m) => [...m, me, { id: ++seq, from: 'bot', answer: chosen, others: [] }])
      return
    }
    const { best, others } = matchAnswer(q)
    const reply: Msg = best
      ? { id: ++seq, from: 'bot', answer: best, others }
      : { id: ++seq, from: 'bot', text: CHAT.noMatch, ask: true, others }
    setMsgs((m) => [...m, me, reply])
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    ask(draft)
    setDraft('')
  }

  /* the focus trap: Tab and Shift+Tab wrap inside the panel */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close()
      return
    }
    if (e.key !== 'Tab' || !panel.current) return
    const els = panel.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])',
    )
    if (!els.length) return
    const first = els[0]
    const last = els[els.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const chips = CHAT.suggested.map(answerById).filter((a): a is ChatAnswer => Boolean(a))
  const offset = lifted ? 'bottom-[96px] lg:bottom-5' : 'bottom-3 sm:bottom-5'

  return (
    <>
      <button
        ref={launcher}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`${uid}-panel`}
        aria-label={CHAT.launch}
        className={`fixed right-3 z-[60] grid h-14 w-14 place-items-center rounded-full bg-green text-paper shadow-lift transition-[transform,background-color] duration-300 ease-brand hover:bg-green-600 sm:right-6 ${offset} ${
          open ? 'scale-90' : ''
        }`}
      >
        {open ? <Close className="h-5 w-5" /> : <MessageCircle className="h-6 w-6" aria-hidden="true" />}
      </button>

      {open && (
        <div
          ref={panel}
          id={`${uid}-panel`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${uid}-title`}
          onKeyDown={onKeyDown}
          style={{ animation: 'hero-rise 320ms var(--ease-brand) both' }}
          className={`fixed right-3 left-3 z-[61] flex max-h-[min(600px,calc(100dvh-120px))] flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-pop sm:left-auto sm:w-[380px] sm:right-6 ${
            lifted ? 'bottom-[164px] lg:bottom-[92px]' : 'bottom-[80px] sm:bottom-[92px]'
          }`}
        >
          <header className="flex items-center justify-between gap-2 bg-teal px-4 py-3 text-paper">
            <h2 id={`${uid}-title`} className="text-[15px] font-semibold">
              {CHAT.title}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={CHAT.close}
              className="grid h-8 w-8 place-items-center rounded-full text-paper/80 transition-colors hover:bg-paper/10 hover:text-paper"
            >
              <Close className="h-4 w-4" />
            </button>
          </header>

          <div ref={log} role="log" aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <Bubble>{CHAT.greeting}</Bubble>
            <div>
              <p className="mb-2 text-[12px] font-medium tracking-wide text-text-3 uppercase">{CHAT.suggestedHead}</p>
              <Chips list={chips} onPick={(a) => ask(a.q, a)} />
            </div>

            {msgs.map((m) =>
              m.from === 'me' ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-green px-3 py-2 text-[14px] text-paper">
                    {m.text}
                  </p>
                </div>
              ) : 'answer' in m ? (
                <div key={m.id} className="space-y-2">
                  <Bubble>
                    <strong className="mb-1 block font-semibold text-text">{m.answer.q}</strong>
                    {m.answer.a}
                    {m.answer.link && (
                      <Link
                        to={m.answer.link.href}
                        className="mt-2 flex items-center gap-1 font-semibold text-teal underline-offset-2 hover:underline"
                      >
                        {m.answer.link.label}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </Bubble>
                  {m.others.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[12px] text-text-3">{CHAT.related}</p>
                      <Chips list={m.others} onPick={(a) => ask(a.q, a)} />
                    </div>
                  )}
                </div>
              ) : (
                <div key={m.id} className="space-y-2">
                  <Bubble>{m.text}</Bubble>
                  {m.others && m.others.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[12px] text-text-3">{CHAT.related}</p>
                      <Chips list={m.others} onPick={(a) => ask(a.q, a)} />
                    </div>
                  )}
                  {m.ask && <AskTeam question={[...msgs].reverse().find((x) => x.from === 'me' && x.id < m.id)} page={pathname} />}
                </div>
              ),
            )}
          </div>

          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-line bg-paper-2/60 p-2.5">
            <label htmlFor={`${uid}-q`} className="sr-only">
              {CHAT.placeholder}
            </label>
            <input
              ref={input}
              id={`${uid}-q`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={CHAT.placeholder}
              autoComplete="off"
              maxLength={300}
              className="min-w-0 flex-1 rounded-full border border-line bg-paper px-4 py-2.5 text-[16px] text-text placeholder:text-text-3 focus:border-teal focus:outline-none sm:text-[14px]"
            />
            <button
              type="submit"
              aria-label={CHAT.send}
              disabled={!draft.trim()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal text-paper transition-opacity disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}

function Bubble({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-paper-2 px-3 py-2.5 text-[14px] leading-relaxed text-text-2">
      {children}
    </div>
  )
}

function Chips({ list, onPick }: { list: ChatAnswer[]; onPick: (a: ChatAnswer) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onPick(a)}
          className="rounded-full border border-teal/30 bg-teal-pale px-3 py-1.5 text-left text-[13px] text-teal transition-colors hover:border-teal hover:bg-paper"
        >
          {a.q}
        </button>
      ))}
    </div>
  )
}

/* The fallback: three fields, posted to the enquiries inbox. */
function AskTeam({ question, page }: { question?: Msg; page: string }) {
  const f = CHAT.askForm
  const uid = useId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [text, setText] = useState(question && 'text' in question ? question.text : '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'failed'>('idle')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const bad: Record<string, string> = {}
    if (!name.trim()) bad.name = f.needName
    if (!looksLikeEmail(email)) bad.email = f.needEmail
    if (!text.trim()) bad.message = f.needQuestion
    setErrors(bad)
    if (Object.keys(bad).length) return
    setState('busy')
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'aa' },
        body: JSON.stringify({
          type: 'contact',
          name: name.trim(),
          email: email.trim(),
          subject: f.subject,
          message: text.trim(),
          meta: { source: 'Help chat', page },
        }),
      })
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: { fields?: Record<string, string> } }
        | null
      if (res.ok && body?.ok) setState('sent')
      else {
        if (body?.error?.fields) setErrors(body.error.fields)
        setState('failed')
      }
    } catch {
      setState('failed')
    }
  }

  if (state === 'sent') return <Bubble>{f.sent}</Bubble>

  const field =
    'w-full rounded-lg border border-line bg-paper px-3 py-2 text-[16px] text-text focus:border-teal focus:outline-none sm:text-[14px]'
  const err = (k: string) =>
    errors[k] && (
      <span id={`${uid}-${k}-err`} className="mt-1 block text-[12px] text-alert">
        {errors[k]}
      </span>
    )

  return (
    <form onSubmit={submit} noValidate className="space-y-2.5 rounded-2xl border border-line p-3">
      <p className="text-[13px] font-semibold text-text">{f.head}</p>
      <label className="block text-[12px] text-text-2">
        {f.name}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? `${uid}-name-err` : undefined}
          className={`mt-1 ${field}`}
        />
        {err('name')}
      </label>
      <label className="block text-[12px] text-text-2">
        {f.email}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? `${uid}-email-err` : undefined}
          className={`mt-1 ${field}`}
        />
        {err('email')}
      </label>
      <label className="block text-[12px] text-text-2">
        {f.question}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={2000}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? `${uid}-message-err` : undefined}
          className={`mt-1 resize-none ${field}`}
        />
        {err('message')}
      </label>
      {state === 'failed' && <p className="text-[12px] text-alert">{f.failed}</p>}
      <button
        type="submit"
        disabled={state === 'busy'}
        className="w-full rounded-full bg-green px-4 py-2.5 text-[14px] font-semibold text-paper transition-colors hover:bg-green-600 disabled:opacity-60"
      >
        {state === 'busy' ? f.sending : f.submit}
      </button>
      <div className="pt-1 text-[12px] text-text-3">
        {CHAT.orReach}
        <div className="mt-1.5 flex flex-wrap gap-2">
          <a
            href={`mailto:${CHAT.email}?subject=${encodeURIComponent(f.subject)}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-text-2 hover:border-teal hover:text-teal"
          >
            <Mail className="h-3.5 w-3.5" />
            {CHAT.email}
          </a>
          {CHAT.whatsapp && (
            <a
              href={CHAT.whatsapp}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-text-2 hover:border-teal hover:text-teal"
            >
              <WhatsApp className="h-3.5 w-3.5" />
              WhatsApp
            </a>
          )}
        </div>
      </div>
    </form>
  )
}
