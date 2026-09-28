import type { ReactNode } from 'react'
import { Check, CheckCircle2, CircleSlash, Link2, MoreHorizontal, Pencil, RotateCcw, Undo2, UserSearch } from 'lucide-react'
import type { BankLine } from '../../../shared/types'
import { formatDay } from '../../portal/format'
import { Button, Checkbox, IconButton, Menu, MenuItem, MenuSeparator, Money, StatusBadge, cn } from '../../portal/ui'
import { BankConfidence, BankDonorChip, BankNarrative } from './BankBits'

/* ---------------------------------------------------------------------------
   One statement line on the review screen: what the bank said, who we think
   it is and why, and the one or two things a person would do next.

   The same data has two layouts — a row in a grid on a wide screen, a card
   on a phone — chosen by the page, so the column widths below line up with
   the header the page draws. The reasons are always visible, not in a
   tooltip: they are what makes the match checkable.
--------------------------------------------------------------------------- */

export type LineActions = {
  onEdit: (l: BankLine) => void
  onAccept: (l: BankLine) => void
  onIgnore: (l: BankLine) => void
  /** back to review / unmatched (from matched or ignored) */
  onUndo: (l: BankLine) => void
  onPick: (l: BankLine, donorId: string) => void
  onNotDuplicate: (l: BankLine) => void
}

export const BANK_GRID = 'lg:grid-cols-[20px_76px_minmax(0,1.25fr)_minmax(0,1fr)_88px_96px_148px]'

const NOT_A_GIFT = /^Looks like /

function Reasons({ line }: { line: BankLine }) {
  const r = line.match.reasons
  if (!r.length) return null
  return (
    <ul className="space-y-0.5 text-[12.5px] leading-snug text-text-2">
      {r.map((x) => {
        const human = /^(Chosen by|Accepted by|New donor .* created by|Marked as not a duplicate by)/.test(x)
        return (
          <li key={x} className={cn('flex gap-1.5', human && 'text-green')}>
            {human ? <Check className="mt-px size-3.5 shrink-0" strokeWidth={2.5} /> : <span className="mt-[7px] size-1 shrink-0 rounded-full bg-text-3/70" />}
            <span className="min-w-0">{x}</span>
          </li>
        )
      })}
    </ul>
  )
}

function Match({ line }: { line: BankLine }) {
  const m = line.match
  return (
    <div className="min-w-0 space-y-1.5">
      {m.donor ? (
        <BankDonorChip id={m.donor} name={m.donorName ?? 'Donor'} number={m.donorNumber} />
      ) : m.candidates?.length ? (
        <p className="text-[13px] font-medium text-amber">{m.candidates.length} donors fit — choose one</p>
      ) : line.status === 'duplicate' || line.status === 'ignored' ? (
        <p className="text-[13px] text-text-3">Not saved</p>
      ) : (
        <p className="text-[13px] text-text-3">No donor yet</p>
      )}
      {(m.donor || m.appealTitle || m.designation !== 'general') && line.status !== 'duplicate' && (
        <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-[12.5px] text-text-2">
          <span className="min-w-0 truncate">{m.appealTitle ?? 'Where most needed'}</span>
          <StatusBadge kind="designation" value={m.designation} size="sm" />
        </p>
      )}
      {line.pledgeInfo && (
        <p className="flex items-center gap-1 text-[12px] text-text-3">
          <Link2 className="size-3.5 shrink-0" />
          <span className="truncate">
            Pays pledge {line.pledgeInfo.number} made {formatDay(line.pledgeInfo.date)}
          </span>
        </p>
      )}
    </div>
  )
}

function Candidates({ line, onPick, disabled }: { line: BankLine; onPick: LineActions['onPick']; disabled?: boolean }) {
  const c = line.match.candidates
  if (!c?.length || line.match.donor || !['review', 'unmatched'].includes(line.status)) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[12.5px] text-text-2">Is it</span>
      {c.map((x) => (
        <button
          key={x.donor}
          type="button"
          disabled={disabled}
          onClick={() => onPick(line, x.donor)}
          className="inline-flex h-7 items-center gap-1.5 rounded-full bg-paper px-2.5 text-[12.5px] font-medium text-text ring-1 ring-line transition-colors ring-inset hover:bg-green-50 hover:text-green hover:ring-green/40 disabled:opacity-50 pointer-coarse:h-9"
        >
          {x.donorName} <span className="nums font-normal text-text-3">{x.number}</span>
        </button>
      ))}
    </div>
  )
}

function Actions({ line, a, busy, compact }: { line: BankLine; a: LineActions; busy?: boolean; compact?: boolean }) {
  const size = compact ? 'sm' : 'xs'
  const notAGift = line.match.reasons.some((r) => NOT_A_GIFT.test(r))
  let primary: ReactNode = null
  if (line.status === 'review') {
    primary = line.match.donor ? (
      <Button size={size} variant="subtle" icon={<Check />} loading={busy} onClick={() => a.onAccept(line)}>
        Accept
      </Button>
    ) : (
      <Button size={size} variant="secondary" icon={<UserSearch />} disabled={busy} onClick={() => a.onEdit(line)}>
        Choose donor
      </Button>
    )
  } else if (line.status === 'unmatched') {
    primary = notAGift ? (
      <Button size={size} variant="secondary" icon={<CircleSlash />} loading={busy} onClick={() => a.onIgnore(line)}>
        Ignore
      </Button>
    ) : (
      <Button size={size} variant="secondary" icon={<UserSearch />} disabled={busy} onClick={() => a.onEdit(line)}>
        Choose donor
      </Button>
    )
  } else if (line.status === 'ignored') {
    primary = (
      <Button size={size} variant="ghost" icon={<Undo2 />} loading={busy} onClick={() => a.onUndo(line)}>
        Undo
      </Button>
    )
  } else if (line.status === 'duplicate') {
    primary = (
      <Button size={size} variant="ghost" icon={<RotateCcw />} loading={busy} onClick={() => a.onNotDuplicate(line)}>
        Not a duplicate
      </Button>
    )
  } else if (line.status === 'matched') {
    primary = (
      <Button size={size} variant="ghost" icon={<Pencil />} disabled={busy} onClick={() => a.onEdit(line)}>
        Change
      </Button>
    )
  }
  const menu = ['matched', 'review', 'unmatched'].includes(line.status)
  return (
    <div className={cn('flex items-center gap-1', compact ? 'justify-start' : 'justify-end')}>
      {primary}
      {menu && (
        <Menu
          trigger={
            <IconButton size={size} label="More for this line" disabled={busy}>
              <MoreHorizontal />
            </IconButton>
          }
        >
          <MenuItem icon={<Pencil />} onSelect={() => a.onEdit(line)}>
            Change donor or appeal
          </MenuItem>
          {line.status === 'matched' && (
            <MenuItem icon={<Undo2 />} onSelect={() => a.onUndo(line)}>
              Move to “Needs a look”
            </MenuItem>
          )}
          <MenuSeparator />
          {line.status !== 'unmatched' || !notAGift ? (
            <MenuItem icon={<CircleSlash />} onSelect={() => a.onIgnore(line)}>
              Ignore — not a donation
            </MenuItem>
          ) : (
            <MenuItem icon={<UserSearch />} onSelect={() => a.onEdit(line)}>
              It is a donation — choose donor
            </MenuItem>
          )}
        </Menu>
      )}
    </div>
  )
}

function Saved({ line }: { line: BankLine }) {
  if (!line.giftInfo) return null
  return (
    <p className="flex items-center gap-1.5 text-[12.5px] text-teal">
      <CheckCircle2 className="size-3.5 shrink-0" />
      <span className="min-w-0">
        Donation <span className="nums font-medium">{line.giftInfo.number}</span>
        {line.giftInfo.receiptNumber && <> · receipt {line.giftInfo.receiptNumber}</>}
        {line.giftInfo.emailed ? ' emailed' : line.giftInfo.receiptNumber ? ' (not emailed)' : ''}
      </span>
    </p>
  )
}

export function BankLineRow({
  line, actions, readOnly, selected, onSelect, busy,
}: { line: BankLine; actions: LineActions; readOnly?: boolean; selected?: boolean; onSelect?: (v: boolean) => void; busy?: boolean }) {
  const selectable = !readOnly && line.status !== 'confirmed'
  return (
    <li
      className={cn(
        'grid items-start gap-x-4 border-b border-line-2 px-5 py-3.5 transition-colors last:border-0',
        BANK_GRID,
        selected ? 'bg-green-50/70' : 'hover:bg-paper-2/60',
        busy && 'opacity-60',
      )}
    >
      <div className="pt-0.5">
        {selectable && onSelect ? <Checkbox checked={Boolean(selected)} onChange={onSelect} aria-label="Select line" /> : null}
      </div>
      <div className="pt-0.5 text-[13px] text-text-2">{formatDay(line.date)}</div>
      <div className="min-w-0 space-y-2">
        <BankNarrative>{line.description}</BankNarrative>
        <Reasons line={line} />
        <Candidates line={line} onPick={actions.onPick} disabled={busy || readOnly} />
      </div>
      <div className="min-w-0 space-y-1.5">
        <Match line={line} />
        <Saved line={line} />
      </div>
      <div className="pt-1">{line.status === 'duplicate' || line.status === 'ignored' ? null : <BankConfidence value={line.match.confidence} />}</div>
      <div className="pt-0.5 text-right">
        <Money cents={line.amount} className="text-[14px] font-semibold text-text" />
      </div>
      <div className="-mt-0.5">{!readOnly && <Actions line={line} a={actions} busy={busy} />}</div>
    </li>
  )
}

export function BankLineCard({
  line, actions, readOnly, selected, onSelect, busy,
}: { line: BankLine; actions: LineActions; readOnly?: boolean; selected?: boolean; onSelect?: (v: boolean) => void; busy?: boolean }) {
  const selectable = !readOnly && line.status !== 'confirmed'
  return (
    <li className={cn('space-y-2.5 border-b border-line-2 px-4 py-4 last:border-0', selected && 'bg-green-50/70', busy && 'opacity-60')}>
      <div className="flex items-center gap-3">
        {selectable && onSelect && <Checkbox checked={Boolean(selected)} onChange={onSelect} aria-label="Select line" />}
        <span className="text-[13px] text-text-2">{formatDay(line.date)}</span>
        <span className="ml-auto">
          <Money cents={line.amount} className="text-[16px] font-semibold text-text" />
        </span>
      </div>
      <BankNarrative>{line.description}</BankNarrative>
      <div className="flex items-start justify-between gap-3">
        <Match line={line} />
        {line.status !== 'duplicate' && line.status !== 'ignored' && <BankConfidence value={line.match.confidence} className="shrink-0 pt-1" />}
      </div>
      <Reasons line={line} />
      <Candidates line={line} onPick={actions.onPick} disabled={busy || readOnly} />
      <Saved line={line} />
      {!readOnly && line.status !== 'confirmed' && (
        <div className="pt-0.5">
          <Actions line={line} a={actions} busy={busy} compact />
        </div>
      )}
    </li>
  )
}
