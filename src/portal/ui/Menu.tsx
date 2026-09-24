import type { ReactNode } from 'react'
import { DropdownMenu, Popover as RPopover, Tooltip as RTooltip, Tabs as RTabs } from 'radix-ui'
import { NavLink } from 'react-router-dom'
import { cn } from './cn'

/* Menus, popovers, tooltips and tabs — Radix underneath for focus, keyboard
   and screen-reader behaviour, dressed in the portal's surfaces here. */

const surface = 'z-50 rounded-xl bg-paper p-1 shadow-pop outline-none data-[state=open]:animate-[pop-in_140ms_var(--ease-brand)]'

export function Menu({
  trigger,
  children,
  align = 'end',
  width = 220,
}: {
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  width?: number
}) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={align} sideOffset={6} collisionPadding={12} style={{ minWidth: width }} className={surface}>
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function MenuItem({
  children,
  icon,
  onSelect,
  tone,
  disabled,
  shortcut,
}: {
  children: ReactNode
  icon?: ReactNode
  onSelect?: () => void
  tone?: 'danger'
  disabled?: boolean
  shortcut?: ReactNode
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex h-9 cursor-default items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] outline-none select-none',
        'data-[disabled]:opacity-45 data-[highlighted]:bg-ink/[.05] [&_svg]:size-4 [&_svg]:text-text-3',
        tone === 'danger' ? 'text-red data-[highlighted]:bg-red-pale [&_svg]:text-red' : 'text-text',
      )}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-[12px] text-text-3">{shortcut}</span>}
    </DropdownMenu.Item>
  )
}

export const MenuSeparator = () => <DropdownMenu.Separator className="my-1 h-px bg-line-2" />
export const MenuLabel = ({ children }: { children: ReactNode }) => (
  <DropdownMenu.Label className="px-2.5 pt-2 pb-1 text-[11.5px] font-medium tracking-wide text-text-3 uppercase">{children}</DropdownMenu.Label>
)

export function Popover({
  trigger,
  children,
  align = 'start',
  className,
  open,
  onOpenChange,
}: {
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
  open?: boolean
  onOpenChange?: (v: boolean) => void
}) {
  return (
    <RPopover.Root open={open} onOpenChange={onOpenChange}>
      <RPopover.Trigger asChild>{trigger}</RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content align={align} sideOffset={6} collisionPadding={12} className={cn(surface, 'p-3', className)}>
          {children}
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  )
}

export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  if (!content) return <>{children}</>
  return (
    <RTooltip.Provider delayDuration={300}>
      <RTooltip.Root>
        <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
        <RTooltip.Portal>
          <RTooltip.Content
            side={side}
            sideOffset={6}
            className="z-[60] max-w-xs rounded-lg bg-ink px-2.5 py-1.5 text-[12.5px] leading-snug text-text-on-ink shadow-pop data-[state=delayed-open]:animate-[pop-in_120ms_ease-out]"
          >
            {content}
          </RTooltip.Content>
        </RTooltip.Portal>
      </RTooltip.Root>
    </RTooltip.Provider>
  )
}

/* ---------- tabs ---------- */
const tabClass = (on: boolean) =>
  cn(
    'relative inline-flex h-10 shrink-0 items-center gap-2 px-1 text-[13.5px] font-medium whitespace-nowrap transition-colors',
    'after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors',
    on ? 'text-text after:bg-green' : 'text-text-2 after:bg-transparent hover:text-text',
  )

const countClass = (on: boolean) =>
  cn('nums rounded-full px-1.5 py-px text-[11px]', on ? 'bg-green-pale text-green' : 'bg-ink/[.06] text-text-2')

/** Tabs that are routes: each tab is a URL, so a tab can be linked to. */
export function RouteTabs({ tabs, className }: { tabs: { to: string; label: ReactNode; count?: number; end?: boolean }[]; className?: string }) {
  return (
    <nav className={cn('-mx-4 overflow-x-auto border-b border-line px-4 scrollbar-none sm:mx-0 sm:px-0', className)}>
      <div className="flex gap-6">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => tabClass(isActive)}>
            {({ isActive }) => (
              <>
                {t.label}
                {t.count != null && <span className={countClass(isActive)}>{t.count}</span>}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

/** Tabs within a page. */
export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  className,
  children,
}: {
  value: T
  onChange: (v: T) => void
  tabs: { value: T; label: ReactNode; count?: number }[]
  className?: string
  children?: ReactNode
}) {
  return (
    <RTabs.Root value={value} onValueChange={(v) => onChange(v as T)} className={className}>
      <RTabs.List className="-mx-4 flex gap-6 overflow-x-auto border-b border-line px-4 scrollbar-none sm:mx-0 sm:px-0">
        {tabs.map((t) => (
          <RTabs.Trigger key={t.value} value={t.value} className={tabClass(t.value === value)}>
            {t.label}
            {t.count != null && <span className={countClass(t.value === value)}>{t.count}</span>}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {children}
    </RTabs.Root>
  )
}
export const TabPanel = ({ value, children, className }: { value: string; children: ReactNode; className?: string }) => (
  <RTabs.Content value={value} className={cn('outline-none', className)}>
    {children}
  </RTabs.Content>
)
