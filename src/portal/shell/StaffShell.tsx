import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Drawer } from 'vaul'
import {
  ArrowLeftRight, ChevronsUpDown, ExternalLink, KeyRound, LogOut, Menu as MenuIcon, MoreHorizontal, PanelLeftClose,
  PanelLeftOpen, Search, X,
} from 'lucide-react'
import type { Permission } from '../../../shared/access'
import { ROLES } from '../../../shared/access'
import { api } from '../api'
import { useStaff } from '../session'
import { Avatar, Kbd } from '../ui/bits'
import { cn } from '../ui/cn'
import { Menu, MenuItem, MenuLabel, MenuSeparator, Tooltip } from '../ui/Menu'
import { useHotkey } from '../ui/hooks'
import { CommandPalette, type PaletteAction } from './CommandPalette'
import { ChangePasswordDialog } from './ChangePasswordDialog'

/* ---------------------------------------------------------------------------
   The frame around the admin and compliance portals.

   Desktop (≥1024px): a fixed sidebar on paper, the page on the paper-2 ground.
   Phone and tablet: a slim top bar, the four most-used places as a bottom tab
   bar within reach of a thumb, and everything else one tap away in "More",
   which opens the full navigation as a sheet.

   ⌘K (Ctrl+K) opens the command palette anywhere: jump to a page, find a
   donor by name, email or number, or start a common action.

   A staff member with access to both portals switches between them from the
   name at the foot of the sidebar; the session is the same.

   The desktop sidebar collapses to a rail of icons (the button at its top, or
   the [ key outside a text field) for more room on wide tables. Collapsed,
   each item names itself in a tooltip and a waiting count becomes a dot. The
   choice is remembered in this browser, for both portals.
--------------------------------------------------------------------------- */

const COLLAPSED_KEY = 'aa:sidebar-collapsed'
function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export type NavItem = {
  label: string
  to: string
  icon: ComponentType<{ className?: string }>
  /** any one of these */
  perm?: Permission | Permission[]
  end?: boolean
  /** a key in the badges response: a count of things waiting */
  badge?: string
  /** one of the four on the phone's bottom bar */
  primary?: boolean
}
export type NavGroup = { label?: string; items: NavItem[] }

type Props = {
  portal: 'admin' | 'compliance'
  groups: NavGroup[]
  /** counts shown against nav items: { enquiries: 3 } */
  badgesQuery?: { key: readonly unknown[]; path: string }
  actions?: PaletteAction[]
  searchPath?: string
}

const PORTALS = {
  admin: { name: 'Admin', home: '/admin', perm: 'dashboard.view' as Permission, blurb: 'Donors, giving and appeals' },
  compliance: { name: 'Compliance', home: '/compliance', perm: 'compliance.read' as Permission, blurb: 'Registers, calendar and records' },
}

export function StaffShell({ portal, groups, badgesQuery, actions = [], searchPath }: Props) {
  const { user, can } = useStaff()
  const loc = useLocation()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const toggleCollapsed = () =>
    setCollapsed((v) => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, v ? '0' : '1')
      } catch {
        /* private mode: it still toggles, it just is not remembered */
      }
      return !v
    })
  useHotkey('k', () => setPaletteOpen((v) => !v))
  useHotkey('[', toggleCollapsed, { meta: false })
  useEffect(() => {
    setMoreOpen(false)
  }, [loc.pathname])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])

  const badges = useQuery({
    queryKey: badgesQuery?.key ?? ['no-badges'],
    queryFn: () => api.get<Record<string, number>>(badgesQuery!.path),
    enabled: Boolean(badgesQuery),
    refetchInterval: 60_000,
  })

  const visible = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || (Array.isArray(i.perm) ? i.perm.some(can) : can(i.perm))) }))
    .filter((g) => g.items.length)
  const flat = visible.flatMap((g) => g.items)
  const primary = flat.filter((i) => i.primary).slice(0, 4)
  const otherPortal = portal === 'admin' ? 'compliance' : 'admin'
  const canOther = can(PORTALS[otherPortal].perm)

  if (!user) return null

  /** `rail`: the collapsed desktop sidebar, icons only */
  const nav = (onNavigate?: () => void, rail = false) => (
    <nav className={cn('flex flex-col', rail ? 'gap-3' : 'gap-5')} aria-label={`${PORTALS[portal].name} navigation`}>
      {visible.map((g, gi) => (
        <div key={gi}>
          {rail
            ? gi > 0 && <div aria-hidden className="mx-2 mb-3 border-t border-line" />
            : g.label && <p className="mb-1 px-3 text-[11px] font-semibold tracking-[0.06em] text-text-3 uppercase">{g.label}</p>}
          <ul className="space-y-px">
            {g.items.map((i) => {
              const n = i.badge ? badges.data?.[i.badge] : undefined
              const link = (
                <NavLink
                  to={i.to}
                  end={i.end}
                  onClick={onNavigate}
                  aria-label={rail ? (n ? `${i.label} (${n})` : i.label) : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex h-9 items-center gap-3 rounded-[10px] text-[13.5px] font-medium transition-colors pointer-coarse:h-11',
                      rail ? 'justify-center' : 'px-3',
                      isActive ? 'bg-green-50 text-green' : 'text-text-2 hover:bg-ink/[.04] hover:text-text',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <i.icon className={cn('size-[18px] shrink-0', isActive ? 'text-green' : 'text-text-3 group-hover:text-text-2')} />
                      {rail ? (
                        n ? <span className="absolute top-1.5 right-3 size-2 rounded-full bg-amber ring-2 ring-paper" /> : null
                      ) : (
                        <>
                          <span className="flex-1 truncate">{i.label}</span>
                          {n ? (
                            <span className={cn('nums rounded-full px-1.5 text-[11px] leading-5 font-semibold', isActive ? 'bg-green text-white' : 'bg-amber-pale text-amber')}>
                              {n > 99 ? '99+' : n}
                            </span>
                          ) : null}
                        </>
                      )}
                    </>
                  )}
                </NavLink>
              )
              return (
                <li key={i.to}>
                  {rail ? (
                    /* the tooltip wraps a span: its trigger merges classNames as
                       strings, and NavLink's className is a function */
                    <Tooltip content={n ? `${i.label} · ${n}` : i.label} side="right">
                      <span className="block">{link}</span>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )

  const brand = (
    <Link to={PORTALS[portal].home} className="flex items-center gap-2.5 rounded-lg">
      <img src="/assets/images/Al-Anwaar-Logo-600x136.png" alt="Al-Anwaar" className="h-7 w-auto" />
    </Link>
  )

  const userMenu = (trigger: ReactNode) => (
    <Menu trigger={trigger} align="start" width={248}>
      <div className="px-2.5 pt-2 pb-2.5">
        <p className="truncate text-[13.5px] font-semibold text-text">{user.name}</p>
        <p className="truncate text-[12.5px] text-text-3">{user.email}</p>
        <p className="mt-1.5 inline-flex rounded-full bg-green-50 px-2 py-0.5 text-[11.5px] font-medium text-green">{ROLES[user.role].label}</p>
      </div>
      <MenuSeparator />
      {canOther && (
        <>
          <MenuLabel>Switch portal</MenuLabel>
          <SwitchItem to={PORTALS[otherPortal].home} label={PORTALS[otherPortal].name} blurb={PORTALS[otherPortal].blurb} />
          <MenuSeparator />
        </>
      )}
      <MenuItem icon={<KeyRound />} onSelect={() => setPwOpen(true)}>
        Password and sign-in
      </MenuItem>
      <MenuItem icon={<ExternalLink />} onSelect={() => window.open('/', '_blank')}>
        View the website
      </MenuItem>
      <MenuSeparator />
      <SignOutItem />
    </Menu>
  )

  return (
    <div className="min-h-dvh bg-ground">
      {/* ---------- desktop sidebar ---------- */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-paper transition-[width] duration-200 ease-out lg:flex',
          collapsed ? 'w-[72px]' : 'w-[264px]',
        )}
      >
        {collapsed ? (
          <div className="flex h-16 items-center justify-center">
            <Tooltip content="Expand sidebar  [" side="right">
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label="Expand sidebar"
                aria-expanded={false}
                className="group grid size-10 place-items-center rounded-[10px] transition-colors hover:bg-ink/[.04]"
              >
                {/* the mark is the first 126 of the wordmark's 600 columns */}
                <span className="block h-7 w-[26px] overflow-hidden group-hover:hidden group-focus-visible:hidden">
                  <img src="/assets/images/Al-Anwaar-Logo-600x136.png" alt="" className="h-7 w-auto max-w-none" />
                </span>
                <PanelLeftOpen className="hidden size-[18px] text-text-2 group-hover:block group-focus-visible:block" />
              </button>
            </Tooltip>
          </div>
        ) : (
          <div className="flex h-16 items-center justify-between gap-2 pr-3 pl-5">
            {brand}
            <span className="flex items-center gap-1">
              <span className={cn('rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide uppercase', portal === 'compliance' ? 'bg-teal-pale text-teal' : 'bg-green-50 text-green')}>
                {PORTALS[portal].name}
              </span>
              <Tooltip content="Collapse sidebar  [" side="bottom">
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  aria-label="Collapse sidebar"
                  aria-expanded
                  className="grid size-8 place-items-center rounded-lg text-text-3 transition-colors hover:bg-ink/[.04] hover:text-text-2"
                >
                  <PanelLeftClose className="size-[18px]" />
                </button>
              </Tooltip>
            </span>
          </div>
        )}
        <div className="px-3 pb-3">
          {collapsed ? (
            <Tooltip content="Search or jump to…  ⌘K" side="right">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label="Search or jump to"
                className="grid h-9 w-full place-items-center rounded-[10px] bg-paper-2 text-text-3 ring-1 ring-line ring-inset transition-colors hover:text-text-2 hover:ring-[#cdcdc6]"
              >
                <Search className="size-4" />
              </button>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex h-9 w-full items-center gap-2.5 rounded-[10px] bg-paper-2 px-3 text-[13px] text-text-3 ring-1 ring-line ring-inset transition-colors hover:text-text-2 hover:ring-[#cdcdc6]"
            >
              <Search className="size-4" />
              <span className="flex-1 text-left">Search or jump to…</span>
              <Kbd>⌘K</Kbd>
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pt-2 pb-6">{nav(undefined, collapsed)}</div>
        <div className="border-t border-line p-3">
          {userMenu(
            collapsed ? (
              <button type="button" aria-label={`${user.name}: account menu`} className="grid w-full place-items-center rounded-[10px] p-2 transition-colors hover:bg-ink/[.04]">
                <Avatar name={user.name} size="sm" />
              </button>
            ) : (
              <button type="button" className="flex w-full items-center gap-3 rounded-[10px] p-2 text-left transition-colors hover:bg-ink/[.04]">
                <Avatar name={user.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-text">{user.name}</span>
                  <span className="block truncate text-[12px] text-text-3">{ROLES[user.role].label}</span>
                </span>
                <ChevronsUpDown className="size-4 text-text-3" />
              </button>
            ),
          )}
        </div>
      </aside>

      {/* ---------- phone / tablet top bar ---------- */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-paper/90 px-3 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="grid size-10 place-items-center rounded-[10px] text-text-2 hover:bg-ink/5"
          aria-label="Open navigation"
        >
          <MenuIcon className="size-5" />
        </button>
        <div className="flex flex-1 justify-center">{brand}</div>
        <button type="button" onClick={() => setPaletteOpen(true)} className="grid size-10 place-items-center rounded-[10px] text-text-2 hover:bg-ink/5" aria-label="Search">
          <Search className="size-5" />
        </button>
      </header>

      <main className={cn('transition-[padding] duration-200 ease-out', collapsed ? 'lg:pl-[72px]' : 'lg:pl-[264px]')}>
        <div className="mx-auto w-full max-w-[1320px] px-4 pt-5 pb-28 sm:px-6 sm:pt-8 lg:px-10 lg:pb-16">
          <div key={loc.pathname} className="animate-portal-in">
            <Outlet />
          </div>
        </div>
      </main>

      {/* ---------- phone bottom bar ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur-md pb-safe lg:hidden" aria-label="Quick navigation">
        <ul className="mx-auto flex max-w-md">
          {primary.map((i) => {
            const n = i.badge ? badges.data?.[i.badge] : undefined
            return (
              <li key={i.to} className="flex-1">
                <NavLink to={i.to} end={i.end} className={({ isActive }) => cn('relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium', isActive ? 'text-green' : 'text-text-3')}>
                  <span className="relative">
                    <i.icon className="size-[22px]" />
                    {n ? <span className="absolute -top-1 -right-2 size-2.5 rounded-full bg-gold ring-2 ring-paper" /> : null}
                  </span>
                  {i.label}
                </NavLink>
              </li>
            )
          })}
          <li className="flex-1">
            <button type="button" onClick={() => setMoreOpen(true)} className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-text-3">
              <MoreHorizontal className="size-[22px]" />
              More
            </button>
          </li>
        </ul>
      </nav>

      {/* ---------- the full menu as a sheet on small screens ---------- */}
      <Drawer.Root open={moreOpen} onOpenChange={setMoreOpen} direction="left">
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-ink/40 lg:hidden" />
          <Drawer.Content className="fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[320px] flex-col bg-paper outline-none lg:hidden">
            <Drawer.Title className="sr-only">Navigation</Drawer.Title>
            <Drawer.Description className="sr-only">Every page in the {PORTALS[portal].name} portal</Drawer.Description>
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              {brand}
              <button type="button" onClick={() => setMoreOpen(false)} className="grid size-10 place-items-center rounded-[10px] text-text-2" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">{nav(() => setMoreOpen(false))}</div>
            <div className="border-t border-line p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
              {userMenu(
                <button type="button" className="flex w-full items-center gap-3 rounded-[10px] p-2 text-left">
                  <Avatar name={user.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{user.name}</span>
                    <span className="block text-[12px] text-text-3">{ROLES[user.role].label}</span>
                  </span>
                  <ChevronsUpDown className="size-4 text-text-3" />
                </button>,
              )}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        pages={flat}
        actions={actions.filter((a) => !a.perm || can(a.perm))}
        searchPath={searchPath}
        switchTo={canOther ? { label: `Go to ${PORTALS[otherPortal].name}`, to: PORTALS[otherPortal].home } : undefined}
      />
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </div>
  )
}

function SwitchItem({ to, label, blurb }: { to: string; label: string; blurb: string }) {
  const nav = useNavigate()
  return (
    <MenuItem icon={<ArrowLeftRight />} onSelect={() => nav(to)}>
      <span className="block leading-tight">{label}</span>
      <span className="block text-[11.5px] text-text-3">{blurb}</span>
    </MenuItem>
  )
}

function SignOutItem() {
  const qc = useQueryClient()
  const nav = useNavigate()
  return (
    <MenuItem
      icon={<LogOut />}
      onSelect={async () => {
        await api.post('/auth/staff/logout')
        qc.clear()
        nav('/admin/login', { replace: true })
      }}
    >
      Sign out
    </MenuItem>
  )
}
