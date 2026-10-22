import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import type { Address, Settings } from '../../../shared/types'
import { Button, Skeleton, cn } from '../../portal/ui'
import { BADGES, BADGE_FINE_PRINT } from '../../components/badges-data'
import { Logo } from '../../components/Brand'

/* ---------------------------------------------------------------------------
   The frame for the printable tax statement and receipt.

   On screen it is a sheet of A4 on the portal's ground, with a toolbar above
   it (back, print). On paper the toolbar and the ground disappear
   (print:hidden, and an @page rule for the margins) and what is left is the
   document itself, so "Print or save as PDF" in the browser produces a clean
   PDF with no app chrome — no server-side PDF library needed.

   The page scales down on a phone without ever scrolling sideways: the
   paper-only columns tuck under the line they belong to.
--------------------------------------------------------------------------- */

export function DocumentFrame({ back, backLabel, title, children, loading }: { back: string; backLabel: string; title: string; children: ReactNode; loading?: boolean }) {
  return (
    <div className="min-h-dvh bg-ground print:min-h-0 print:bg-white">
      <style>{`@page { size: A4; margin: 14mm 12mm; } @media print { html, body { background: #fff !important; } }`}</style>
      <div className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur-md print:hidden">
        <div className="mx-auto flex h-14 max-w-[900px] items-center justify-between gap-3 px-4">
          <Link to={back} className="inline-flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13.5px] font-medium text-text-2 hover:bg-ink/5 hover:text-text">
            <ArrowLeft className="size-4 shrink-0" />
            <span className="truncate">{backLabel}</span>
          </Link>
          <Button variant="primary" icon={<Printer />} onClick={() => window.print()} disabled={loading}>
            <span className="sm:hidden">Print / PDF</span>
            <span className="hidden sm:inline">Print or save as PDF</span>
          </Button>
        </div>
      </div>
      <main className="px-3 py-5 sm:px-6 sm:py-10 print:p-0">
        <article
          aria-label={title}
          className={cn(
            'mx-auto w-full max-w-[210mm] bg-white text-[#08262a] shadow-[0_1px_3px_rgba(8,38,42,.08),0_20px_50px_-24px_rgba(8,38,42,.25)] ring-1 ring-line/70',
            'px-5 py-7 sm:min-h-[297mm] sm:px-[16mm] sm:py-[15mm]',
            'print:max-w-none print:min-h-0 print:p-0 print:shadow-none print:ring-0',
          )}
        >
          {loading ? <DocSkeleton /> : children}
        </article>
        <p className="mx-auto mt-4 max-w-[210mm] text-center text-[12px] text-text-3 print:hidden">
          Tip: in the print window choose &ldquo;Save as PDF&rdquo; to keep a copy.
        </p>
      </main>
    </div>
  )
}

/** Organisation letterhead, left; the document's own title and facts, right. */
export function Letterhead({ org, title, facts }: { org: Settings['org']; title: string; facts: [string, ReactNode][] }) {
  return (
    <header className="relative flex flex-col gap-6 border-b-2 border-[#006770] pb-6 sm:flex-row sm:items-start sm:justify-between print:flex-row">
      {/* the rule is teal with a saffron lead-in, as the guide's pages carry
          one highlight colour against the teal */}
      <span aria-hidden className="absolute -bottom-[2px] left-0 h-[2px] w-16 bg-[#f2c14a]" />
      <div className="min-w-0">
        <Logo alt="" className="h-14 w-auto" />
        <p className="mt-3 text-[13px] font-semibold">{org.name}</p>
        <p className="text-[12px] leading-relaxed text-[#3f5b5d]">
          ABN {org.abn}
          <br />
          {org.address}
          <br />
          {[org.email, org.phone, org.website].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="sm:text-right print:text-right">
        <h1 className="font-display text-[26px] leading-tight text-[#006770]">{title}</h1>
        <dl className="mt-2 space-y-0.5 text-[12px]">
          {facts.map(([k, v]) => (
            <div key={k} className="flex gap-2 sm:justify-end print:justify-end">
              <dt className="text-[#3f5b5d]">{k}</dt>
              <dd className="nums font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  )
}

export function AddressBlock({ label, name, address, extra }: { label: string; name: string; address: Address | null; extra?: ReactNode }) {
  const lines = address
    ? [address.line1, address.line2, [address.suburb, address.state, address.postcode].filter(Boolean).join(' '), address.country && address.country !== 'Australia' ? address.country : '']
        .filter(Boolean)
    : []
  return (
    <div>
      <p className="text-[10.5px] font-semibold tracking-[.08em] text-[#3f5b5d] uppercase">{label}</p>
      <p className="mt-1.5 text-[14px] font-semibold">{name}</p>
      {lines.map((l) => (
        <p key={l} className="text-[12.5px] leading-relaxed text-[#3f5b5d]">
          {l}
        </p>
      ))}
      {extra}
    </div>
  )
}

/** The DGR and "nothing in return" wording every receipt must carry, under the
    ACNC and DGR badges the site shows at checkout, so the paper matches. */
export function DgrStatement({ org, footer }: { org: Settings['org']; footer: string }) {
  return (
    <div className="rounded-lg bg-[#eef6f4] px-4 py-3.5 text-[12px] leading-relaxed text-[#0d3337] ring-1 ring-[#cfe3e0] print:bg-transparent">
      <div className="mb-3 flex items-center gap-3">
        {BADGES.map((b) => (
          <img key={b.src} src={b.src} alt={b.alt} width={64} height={64} className="block size-16 shrink-0" />
        ))}
        <p className="max-w-[26ch] font-medium text-[#00454b]">{BADGE_FINE_PRINT}</p>
      </div>
      <p>
        <strong className="font-semibold">{org.name}</strong> (ABN {org.abn}). {org.dgr ? org.dgrNote : ''}
      </p>
      <p className="mt-1">{footer}</p>
    </div>
  )
}

function DocSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex justify-between">
        <Skeleton className="h-16 w-48" />
        <Skeleton className="h-10 w-40" />
      </div>
      <Skeleton className="h-20 w-64" />
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  )
}
