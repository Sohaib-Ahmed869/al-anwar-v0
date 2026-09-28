import { useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Command } from 'cmdk'
import { Dialog as RDialog } from 'radix-ui'
import { ArrowLeftRight, CornerDownLeft, Search } from 'lucide-react'
import type { Permission } from '../../../shared/access'
import { api } from '../api'
import { Spinner } from '../ui/Spinner'
import { useDebounced } from '../ui/hooks'

/* ⌘K. Pages and actions are filtered locally as you type; records (donors,
   gifts, appeals…) come from the portal's search endpoint, which answers in
   the shape below. */

export type SearchResponse = {
  groups: { label: string; items: { id: string; title: string; subtitle?: string; to: string }[] }[]
}

export type PaletteAction = {
  label: string
  to: string
  icon: ComponentType<{ className?: string }>
  perm?: Permission
  keywords?: string
}

type Page = { label: string; to: string; icon: ComponentType<{ className?: string }> }

export function CommandPalette({
  open,
  onOpenChange,
  pages,
  actions,
  searchPath,
  switchTo,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  pages: Page[]
  actions: PaletteAction[]
  searchPath?: string
  switchTo?: { label: string; to: string }
}) {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const dq = useDebounced(q.trim(), 180)
  const search = useQuery({
    queryKey: ['palette', searchPath, dq],
    queryFn: () => api.get<SearchResponse>(searchPath!, { q: dq }),
    enabled: Boolean(searchPath && dq.length >= 2 && open),
    staleTime: 10_000,
  })
  const go = (to: string) => {
    onOpenChange(false)
    setQ('')
    nav(to)
  }

  const item =
    'flex min-h-11 cursor-default items-center gap-3 rounded-[10px] px-3 py-2 text-[14px] text-text outline-none data-[selected=true]:bg-green-50 data-[selected=true]:text-green [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:text-text-3 data-[selected=true]:[&_svg]:text-green'
  const heading = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-text-3 [&_[cmdk-group-heading]]:uppercase'

  return (
    <RDialog.Root open={open} onOpenChange={(v) => (onOpenChange(v), !v && setQ(''))}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-ink/35 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <RDialog.Content className="fixed top-[max(12px,12vh)] left-1/2 z-50 w-[calc(100vw-24px)] max-w-[620px] -translate-x-1/2 overflow-hidden rounded-2xl bg-paper shadow-pop outline-none data-[state=open]:animate-[pop-in_160ms_var(--ease-brand)]">
          <RDialog.Title className="sr-only">Search</RDialog.Title>
          <RDialog.Description className="sr-only">Search records, jump to a page or start an action</RDialog.Description>
          <Command shouldFilter label="Command palette" className="flex max-h-[min(70vh,560px)] flex-col">
            <div className="flex items-center gap-3 border-b border-line-2 px-4">
              <Search className="size-[18px] shrink-0 text-text-3" />
              <Command.Input
                value={q}
                onValueChange={setQ}
                autoFocus
                placeholder={searchPath ? 'Search donors, donations, appeals… or jump to a page' : 'Jump to a page'}
                className="h-14 flex-1 bg-transparent text-[16px] text-text outline-none placeholder:text-text-3"
              />
              {search.isFetching && <Spinner className="text-text-3" />}
            </div>
            <Command.List className="min-h-0 flex-1 overflow-y-auto p-2">
              <Command.Empty className="px-3 py-10 text-center text-[14px] text-text-2">
                {dq.length >= 2 && search.isFetching ? 'Searching…' : 'Nothing matches that.'}
              </Command.Empty>

              {search.data?.groups.map((g) =>
                g.items.length ? (
                  <Command.Group key={g.label} heading={g.label} className={heading}>
                    {g.items.map((r) => (
                      <Command.Item key={`${g.label}-${r.id}`} value={`${g.label} ${r.title} ${r.subtitle ?? ''} ${r.id}`} onSelect={() => go(r.to)} className={item}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{r.title}</span>
                          {r.subtitle && <span className="block truncate text-[12.5px] text-text-3">{r.subtitle}</span>}
                        </span>
                        <CornerDownLeft className="opacity-0 [[data-selected=true]_&]:opacity-100" />
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null,
              )}

              {actions.length > 0 && (
                <Command.Group heading="Actions" className={heading}>
                  {actions.map((a) => (
                    <Command.Item key={a.to} value={`${a.label} ${a.keywords ?? ''}`} onSelect={() => go(a.to)} className={item}>
                      <a.icon />
                      {a.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              <Command.Group heading="Go to" className={heading}>
                {pages.map((p) => (
                  <Command.Item key={p.to} value={`go ${p.label}`} onSelect={() => go(p.to)} className={item}>
                    <p.icon />
                    {p.label}
                  </Command.Item>
                ))}
                {switchTo && (
                  <Command.Item value={switchTo.label} onSelect={() => go(switchTo.to)} className={item}>
                    <ArrowLeftRight />
                    {switchTo.label}
                  </Command.Item>
                )}
              </Command.Group>
            </Command.List>
            <div className="hidden items-center gap-4 border-t border-line-2 px-4 py-2.5 text-[12px] text-text-3 sm:flex">
              <span>↑↓ to move</span>
              <span>↵ to open</span>
              <span>esc to close</span>
            </div>
          </Command>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}
