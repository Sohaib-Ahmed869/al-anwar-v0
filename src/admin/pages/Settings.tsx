import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Building2, CreditCard, Landmark, Mail, ReceiptText, Scale } from 'lucide-react'
import { api } from '../../portal/api'
import { formatDate, formatMoney, parseMoney } from '../../portal/format'
import {
  Badge, Callout, ChoiceCards, Field, Input, MoneyInput, PageHeader, Skeleton, Switch, Textarea, useDebounced, useDocumentTitle,
} from '../../portal/ui'
import { SettingsCard, useSettingsSection, type SettingsView } from '../components/SettingsSection'

/* ---------------------------------------------------------------------------
   Settings — the organisation's details, in the cards they are edited in.
   Each card saves on its own (see SettingsSection.tsx).

   Receipts shows the real receipt email, re-rendered by the server with the
   card's unsaved wording a moment after typing stops, because the receipt
   is the one email with legal requirements and nobody should have to save
   to see what it will say. Payments shows what the server is actually
   connected to; only the fee rate is a setting.
--------------------------------------------------------------------------- */

const SECTIONS = [
  { id: 'org', label: 'Organisation', icon: Building2 },
  { id: 'receipts', label: 'Receipts', icon: ReceiptText },
  { id: 'bank', label: 'Bank details', icon: Landmark },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'email', label: 'Email sender', icon: Mail },
  { id: 'zakat', label: 'Zakat nisab', icon: Scale },
]

const MODE = {
  live: { label: 'Live', tone: 'green' as const, text: 'Connected to Stripe with a live key. Card payments are real money.' },
  test: { label: 'Test mode', tone: 'violet' as const, text: 'Connected to Stripe with a test key. Use Stripe’s test cards; no money moves.' },
  simulated: { label: 'Simulated', tone: 'amber' as const, text: 'No payment provider is connected. Payments are simulated so the platform can be tried end to end — no money moves.' },
}

export default function Settings() {
  useDocumentTitle('Settings', 'Admin')
  const q = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api.get<SettingsView>('/admin/settings') })
  const s = q.data

  const org = useSettingsSection('org', s, (x) => ({ ...x.org }), (d) => d)
  const receipts = useSettingsSection('receipts', s, (x) => ({ ...x.receipts }), (d) => ({ ...d, prefix: d.prefix.toUpperCase() }))
  const bank = useSettingsSection('bank', s, (x) => ({ ...x.bank }), (d) => d)
  const payments = useSettingsSection(
    'payments',
    s,
    (x) => ({ fee: String(+(x.payments.feeRate * 100).toFixed(2)) }),
    (d) => {
      const n = Number(d.fee)
      return Number.isFinite(n) && d.fee.trim() !== '' ? { feeRate: +(n / 100).toFixed(4) } : 'Enter the fee as a percentage, like 2.6'
    },
  )
  const email = useSettingsSection('email', s, (x) => ({ ...x.email }), (d) => d)
  const zakat = useSettingsSection(
    'zakat',
    s,
    (x) => ({ nisab: String(x.zakat.nisab / 100), nisabBasis: x.zakat.nisabBasis as 'silver' | 'gold' }),
    (d) => {
      const c = parseMoney(d.nisab)
      return Number.isFinite(c) && c > 0 ? { nisab: c, nisabBasis: d.nisabBasis } : 'Enter the nisab in dollars'
    },
  )

  const preview = useDebounced(JSON.stringify({ org: org.draft, receipts: receipts.draft }), 500)
  const receiptHtml = useQuery({
    queryKey: ['admin', 'receipt-preview', preview],
    queryFn: () => {
      const p = JSON.parse(preview)
      return api.post<{ html: string }>('/admin/settings/receipt-preview', { org: p.org ?? undefined, receipts: p.receipts ?? undefined })
    },
    enabled: Boolean(org.draft && receipts.draft),
    placeholderData: keepPreviousData,
  })

  if (q.isLoading || !s || !org.draft || !receipts.draft || !bank.draft || !payments.draft || !email.draft || !zakat.draft) {
    return (
      <>
        <PageHeader title="Settings" />
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-4 rounded-2xl bg-paper p-6 ring-1 ring-line/80">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-2/3" />
            </div>
          ))}
        </div>
      </>
    )
  }
  const o = org.draft
  const r = receipts.draft
  const b = bank.draft
  const e = email.draft
  const z = zakat.draft
  const mode = MODE[s.runtime.paymentsMode]

  return (
    <>
      <PageHeader title="Settings" description="The organisation’s details as donors see them on receipts, emails and the website. Each card saves on its own." />
      <div className="grid gap-8 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-6 space-y-0.5">
            {SECTIONS.map((x) => (
              <li key={x.id}>
                <a
                  href={`#${x.id}`}
                  onClick={(ev) => {
                    ev.preventDefault()
                    document.getElementById(x.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] text-text-2 transition-colors hover:bg-ink/[.04] hover:text-text">
                  <x.icon className="size-4 text-text-3" /> {x.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          <SettingsCard id="org" title="Organisation" description="Printed on every receipt and at the foot of every email." icon={<Building2 />} section={org}>
            <Field label="Legal name" error={org.errors.name}>
              <Input value={o.name} onChange={(ev) => org.set('name', ev.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ABN" error={org.errors.abn}>
                <Input value={o.abn} onChange={(ev) => org.set('abn', ev.target.value)} inputMode="numeric" className="nums" />
              </Field>
              <Field label="Website" error={org.errors.website}>
                <Input value={o.website} onChange={(ev) => org.set('website', ev.target.value)} />
              </Field>
              <Field label="Contact email" error={org.errors.email}>
                <Input type="email" value={o.email} onChange={(ev) => org.set('email', ev.target.value)} />
              </Field>
              <Field label="Phone" optional error={org.errors.phone}>
                <Input type="tel" value={o.phone} onChange={(ev) => org.set('phone', ev.target.value)} />
              </Field>
            </div>
            <Field label="Address" error={org.errors.address}>
              <Input value={o.address} onChange={(ev) => org.set('address', ev.target.value)} />
            </Field>
            <div className="rounded-xl bg-paper-2 p-4">
              <Switch checked={o.dgr} onChange={(v) => org.set('dgr', v)} label="Deductible Gift Recipient" description="Endorsed by the ATO, so gifts of $2 or more are tax deductible." />
              <Field label="What receipts say about it" error={org.errors.dgrNote} className="mt-4">
                <Textarea rows={2} value={o.dgrNote} onChange={(ev) => org.set('dgrNote', ev.target.value)} />
              </Field>
            </div>
          </SettingsCard>

          <SettingsCard id="receipts" title="Receipts" description="The tax receipt emailed for every paid gift. The preview updates as you type." icon={<ReceiptText />} section={receipts}>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div className="space-y-4">
                <Field label="Receipt number prefix" error={receipts.errors.prefix} help={`Numbers look like ${r.prefix.toUpperCase() || 'AA'}-2027-000123. Changing it only affects new receipts.`}>
                  <Input value={r.prefix} onChange={(ev) => receipts.set('prefix', ev.target.value.toUpperCase())} maxLength={6} className="nums w-32" />
                </Field>
                <Field label="Signed by" error={receipts.errors.signatory}>
                  <Input value={r.signatory} onChange={(ev) => receipts.set('signatory', ev.target.value)} />
                </Field>
                <Field label="On behalf of" error={receipts.errors.signatoryTitle}>
                  <Input value={r.signatoryTitle} onChange={(ev) => receipts.set('signatoryTitle', ev.target.value)} />
                </Field>
                <Field label="The line every receipt must carry" error={receipts.errors.footer} help="The ATO requires a receipt to say no goods or services were given in return.">
                  <Textarea rows={3} value={r.footer} onChange={(ev) => receipts.set('footer', ev.target.value)} />
                </Field>
              </div>
              <div className="min-w-0">
                <p className="mb-1.5 text-[12.5px] font-medium text-text-2">A sample receipt, as Amina would get it</p>
                {receiptHtml.data ? (
                  <iframe title="Sample receipt" sandbox="" srcDoc={receiptHtml.data.html} className="h-[560px] w-full rounded-xl bg-[#F5F5F2] ring-1 ring-line" />
                ) : (
                  <Skeleton className="h-[560px] w-full rounded-xl" />
                )}
              </div>
            </div>
          </SettingsCard>

          <SettingsCard id="bank" title="Bank details shown to donors" description="On the give page and in the email a donor gets when they choose bank transfer." icon={<Landmark />} section={bank}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Account name" error={bank.errors.accountName} className="sm:col-span-2">
                <Input value={b.accountName} onChange={(ev) => bank.set('accountName', ev.target.value)} />
              </Field>
              <Field label="BSB" error={bank.errors.bsb}>
                <Input value={b.bsb} onChange={(ev) => bank.set('bsb', ev.target.value)} inputMode="numeric" className="nums" />
              </Field>
              <Field label="Account number" error={bank.errors.accountNumber}>
                <Input value={b.accountNumber} onChange={(ev) => bank.set('accountNumber', ev.target.value)} inputMode="numeric" className="nums" />
              </Field>
              <Field label="Bank" error={bank.errors.bankName}>
                <Input value={b.bankName} onChange={(ev) => bank.set('bankName', ev.target.value)} />
              </Field>
            </div>
            <div className="rounded-xl bg-paper-2 p-4 text-[13px]">
              <p className="mb-2 font-medium text-text-2">What the donor sees</p>
              <dl className="nums grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
                <dt className="text-text-3">Account name</dt>
                <dd className="text-text">{b.accountName}</dd>
                <dt className="text-text-3">BSB</dt>
                <dd className="text-text">{b.bsb}</dd>
                <dt className="text-text-3">Account</dt>
                <dd className="text-text">{b.accountNumber}</dd>
                <dt className="text-text-3">Reference</dt>
                <dd className="font-semibold text-text">AA-7KQ2MX</dd>
              </dl>
              <p className="mt-2 text-[12px] text-text-3">Each donor gets their own reference, which is how bank import matches the money to them.</p>
            </div>
          </SettingsCard>

          <SettingsCard
            id="payments"
            title="Payments"
            description="Card and PayPal payments, and the processing fee donors can choose to cover."
            icon={<CreditCard />}
            action={<Badge tone={mode.tone} dot>{mode.label}</Badge>}
            section={payments}
          >
            <Callout tone={s.runtime.paymentsMode === 'live' ? 'green' : 'amber'}>
              {mode.text} {s.runtime.paypal ? 'PayPal is connected.' : 'PayPal is not connected.'} This is set on the server, not here.
            </Callout>
            <Field
              label="Processing fee donors can cover"
              error={payments.errors.feeRate ?? payments.errors.fee}
              help={
                Number.isFinite(Number(payments.draft.fee))
                  ? `On a $100 gift the donor is offered to add ${formatMoney(Math.round(10000 * (Number(payments.draft.fee) / 100)), { exact: true })}.`
                  : 'A percentage, like 2.6'
              }
            >
              <div className="w-32">
              <Input
                value={payments.draft.fee}
                onChange={(ev) => payments.set('fee', ev.target.value)}
                inputMode="decimal"
                trailing={<span className="pr-1 text-[13px]">%</span>}
                className="nums"
              />
              </div>
            </Field>
          </SettingsCard>

          <SettingsCard
            id="email"
            title="Email sender"
            description="Who receipts, codes and campaigns come from."
            icon={<Mail />}
            action={<Badge tone={s.runtime.emailTransport === 'smtp' ? 'green' : 'amber'} dot>{s.runtime.emailTransport === 'smtp' ? 'Sending' : 'Kept in the email log'}</Badge>}
            section={email}
          >
            {s.runtime.emailTransport === 'outbox' && (
              <Callout tone="amber">No mail server is configured, so emails are kept in the email log instead of being sent. These details apply once one is.</Callout>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From name" error={email.errors.fromName}>
                <Input value={e.fromName} onChange={(ev) => email.set('fromName', ev.target.value)} />
              </Field>
              <Field label="From address" error={email.errors.fromEmail} help="Must be a domain the mail service is set up to send for.">
                <Input type="email" value={e.fromEmail} onChange={(ev) => email.set('fromEmail', ev.target.value)} />
              </Field>
              <Field label="Replies go to" error={email.errors.replyTo}>
                <Input type="email" value={e.replyTo} onChange={(ev) => email.set('replyTo', ev.target.value)} />
              </Field>
            </div>
          </SettingsCard>

          <SettingsCard
            id="zakat"
            title="Zakat nisab"
            description={`Used by the zakat calculator on the website. Last updated ${formatDate(s.zakat.updatedAt)}.`}
            icon={<Scale />}
            section={zakat}
          >
            <Field label="Based on the value of" error={zakat.errors.nisabBasis}>
              <ChoiceCards
                columns={2}
                value={z.nisabBasis}
                onChange={(v) => zakat.set('nisabBasis', v)}
                options={[
                  { value: 'silver', label: 'Silver', hint: '612.36 g — the lower threshold, and the more cautious' },
                  { value: 'gold', label: 'Gold', hint: '87.48 g' },
                ]}
              />
            </Field>
            <Field label="Nisab today" error={zakat.errors.nisab} help="Update it when the metal price moves. The calculator says which date it is from.">
              <MoneyInput value={z.nisab} onChange={(ev) => zakat.set('nisab', ev.target.value)} className="w-44" />
            </Field>
            <p className="text-[12.5px] text-text-3">The imam confirms the basis. This is a figure for the calculator, not a ruling.</p>
          </SettingsCard>
        </div>
      </div>
    </>
  )
}
