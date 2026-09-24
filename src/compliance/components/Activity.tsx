import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Bot } from 'lucide-react'
import { Avatar, cn, Tooltip } from '../../portal/ui'
import { formatDateTime, formatRelative } from '../../portal/format'
import type { Change, EventView } from './types'

/* One line of the action log — who, what, when, and a link to the thing —
   used by the overview's recent activity, a register entry's history and the
   audit trail. A register change also lists each field that moved, from and
   to, because "updated the risk" alone tells an auditor nothing. */

export function ActorAvatar({ e, size = 'sm' }: { e: EventView; size?: 'xs' | 'sm' | 'md' }) {
  if (e.actor.kind === 'system')
    return (
      <span aria-hidden className={cn('grid shrink-0 place-items-center rounded-full bg-teal-pale text-teal', size === 'xs' ? 'size-6 [&_svg]:size-3.5' : 'size-8 [&_svg]:size-4')}>
        <Bot />
      </span>
    )
  return <Avatar name={e.actor.name} size={size} />
}

export function ChangeList({ changes, className }: { changes: Change[]; className?: string }) {
  if (!changes.length) return null
  return (
    <ul className={cn('mt-2 space-y-1 rounded-lg bg-paper-2 px-3 py-2 text-[12.5px]', className)}>
      {changes.map((c) => (
        <li key={c.field} className="flex flex-wrap items-baseline gap-x-1.5 text-text-2">
          <span className="font-medium text-text">{c.label}</span>
          <span className="text-text-3 line-through decoration-text-3/50">{c.from || 'empty'}</span>
          <ArrowRight className="size-3 translate-y-0.5 self-center text-text-3" />
          <span className="text-text [overflow-wrap:anywhere]">{c.to || 'empty'}</span>
        </li>
      ))}
    </ul>
  )
}

export function ActivityItem({ e, showLink = true, compact, aside }: { e: EventView; showLink?: boolean; compact?: boolean; aside?: ReactNode }) {
  const changes = e.changes ?? e.meta?.changes ?? []
  return (
    <li className="flex gap-3">
      <ActorAvatar e={e} size={compact ? 'xs' : 'sm'} />
      <div className="min-w-0 flex-1">
        <p className={cn('leading-snug text-text [overflow-wrap:anywhere]', compact ? 'text-[13px]' : 'text-[13.5px]')}>
          {/* some summaries already open with the person's name ("Omar Siddiqui signed in") */}
          {e.summary.startsWith(e.actor.name) ? (
            <>
              <span className="font-medium">{e.actor.name}</span>
              <span className="text-text-2">{e.summary.slice(e.actor.name.length)}</span>
            </>
          ) : (
            <>
              <span className="font-medium">{e.actor.name}</span> <span className="text-text-2">{lowerFirst(e.summary)}</span>
            </>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-text-3">
          <Tooltip content={formatDateTime(e.at)}>
            <time dateTime={e.at}>{formatRelative(e.at)}</time>
          </Tooltip>
          {showLink && e.href && e.entity?.label && (
            <>
              <span aria-hidden>·</span>
              <Link to={e.href} className="truncate font-medium text-green hover:underline">
                {e.entity.label}
              </Link>
            </>
          )}
        </p>
        {!compact && <ChangeList changes={changes} />}
      </div>
      {aside}
    </li>
  )
}

/* "Added Test risk…" reads naturally after a name as "Khalid added Test risk…" */
function lowerFirst(s: string) {
  return /^[A-Z][a-z]/.test(s) && !/^(I |ACNC|AIS|ATO|NSW)/.test(s) ? s[0]!.toLowerCase() + s.slice(1) : s
}
