import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { Button, IconButton, Input, MoneyInput } from '../../portal/ui'

/* The suggested amounts on an appeal's give box: each an amount and an
   optional line saying what it does ("One family, one month"). Order is the
   order donors see them in, so rows move up and down rather than sorting
   themselves. Amounts are dollars here; the editor converts on save. */

export type SuggestedRow = { key: string; amount: string; label: string }

const MAX = 8
let seq = 0
export const newSuggestedRow = (amount = '', label = ''): SuggestedRow => ({ key: `s${++seq}`, amount, label })

export function AppealSuggestedEditor({
  rows,
  onChange,
  errors,
  unitName,
}: {
  rows: SuggestedRow[]
  onChange: (rows: SuggestedRow[]) => void
  errors?: Record<string, string>
  unitName?: string
}) {
  const update = (i: number, patch: Partial<SuggestedRow>) => onChange(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)))
  const move = (i: number, d: -1 | 1) => {
    const next = [...rows]
    const [r] = next.splice(i, 1)
    next.splice(i + d, 0, r!)
    onChange(next)
  }
  return (
    <div>
      {rows.length === 0 ? (
        <p className="rounded-xl bg-paper-2 px-4 py-3 text-[13px] text-text-2">
          No suggested amounts — donors will type their own. Three or four amounts, each with what it does, usually raise more.
        </p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => {
            const err = errors?.[`suggested.${i}.amount`] ?? errors?.[`suggested.${i}.label`]
            return (
              <li key={r.key}>
                <div className="flex items-start gap-2">
                  <span className="nums mt-2.5 w-4 shrink-0 text-center text-[12px] text-text-3">{i + 1}</span>
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[130px_minmax(0,1fr)]">
                    <MoneyInput
                      value={r.amount}
                      onChange={(e) => update(i, { amount: e.target.value })}
                      aria-label={`Amount ${i + 1}`}
                      placeholder="50"
                      invalid={Boolean(errors?.[`suggested.${i}.amount`])}
                    />
                    <Input
                      value={r.label}
                      onChange={(e) => update(i, { label: e.target.value })}
                      aria-label={`What amount ${i + 1} does`}
                      placeholder={unitName ? `e.g. One ${unitName}` : 'What it does, e.g. One family, one month'}
                      maxLength={60}
                    />
                  </div>
                  <div className="flex shrink-0 items-center">
                    <IconButton label="Move up" size="sm" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp />
                    </IconButton>
                    <IconButton label="Move down" size="sm" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="hidden sm:inline-flex">
                      <ArrowDown />
                    </IconButton>
                    <IconButton label="Remove this amount" size="sm" onClick={() => onChange(rows.filter((_, n) => n !== i))}>
                      <X />
                    </IconButton>
                  </div>
                </div>
                {err && <p className="mt-1 ml-6 text-[12.5px] text-red">{err}</p>}
              </li>
            )
          })}
        </ol>
      )}
      <Button
        size="sm"
        variant="subtle"
        icon={<Plus />}
        className="mt-3"
        disabled={rows.length >= MAX}
        onClick={() => onChange([...rows, newSuggestedRow()])}
      >
        {rows.length >= MAX ? 'Eight is the most' : 'Add an amount'}
      </Button>
    </div>
  )
}
