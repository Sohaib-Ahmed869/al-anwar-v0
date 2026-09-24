import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { HandHeart, Home, LogOut, Megaphone, Receipt, Repeat, UserRound, ExternalLink } from 'lucide-react'
import { api } from '../api'
import { useDonor } from '../session'
import { Avatar } from '../ui/bits'
import { buttonClass } from '../ui/Button'
import { cn } from '../ui/cn'
import { Menu, MenuItem, MenuSeparator } from '../ui/Menu'

/* ---------------------------------------------------------------------------
   The donor portal's frame. Deliberately not the staff sidebar: a donor comes
   here a few times a year to find a receipt or change a monthly gift, so it
   reads like the website they gave on — the logo, a handful of places, and
   the gold Give button in the same corner it sits on every public page.

   On a phone the places move to a bottom tab bar, and the header keeps only
   the logo, Give and the person.
--------------------------------------------------------------------------- */

const NAV = [
  { to: '/account', label: 'Overview', short: 'Home', icon: Home, end: true },
  { to: '/account/giving', label: 'My giving', short: 'Giving', icon: HandHeart },
  { to: '/account/plans', label: 'Regular gifts', short: 'Regular', icon: Repeat },
  { to: '/account/receipts', label: 'Receipts & tax', short: 'Receipts', icon: Receipt },
  { to: '/account/fundraisers', label: 'Fundraisers', short: 'Fundraise', icon: Megaphone },
  { to: '/account/profile', label: 'Profile', short: 'Profile', icon: UserRound },
]
const MOBILE = ['/account', '/account/giving', '/account/plans', '/account/receipts', '/account/profile']

export function AccountShell() {
  const donor = useDonor()
  const loc = useLocation()
  const nav = useNavigate()
  const qc = useQueryClient()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])
  if (!donor) return null
  const name = `${donor.firstName} ${donor.lastName}`.trim()

  const signOut = async () => {
    await api.post('/auth/donor/logout')
    qc.clear()
    nav('/account/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-ground">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-6 px-4 sm:px-6">
          <Link to="/" className="shrink-0" aria-label="Al-Anwaar home">
            <img src="/assets/images/Al-Anwaar-Logo-600x136.png" alt="Al-Anwaar" className="h-7 w-auto sm:h-8" />
          </Link>
          <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Your account">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn('rounded-[10px] px-3 py-2 text-[13.5px] font-medium transition-colors', isActive ? 'bg-green-50 text-green' : 'text-text-2 hover:bg-ink/[.04] hover:text-text')
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/give" className={buttonClass('give', 'md', 'px-4 sm:px-5')}>
              Give
            </Link>
            <Menu
              width={240}
              trigger={
                <button type="button" className="rounded-full ring-offset-2 transition-shadow hover:ring-2 hover:ring-line" aria-label="Your account menu">
                  <Avatar name={name} size="md" />
                </button>
              }
            >
              <div className="px-2.5 pt-2 pb-2.5">
                <p className="truncate text-[13.5px] font-semibold">{name}</p>
                <p className="truncate text-[12.5px] text-text-3">{donor.email}</p>
              </div>
              <MenuSeparator />
              <MenuItem icon={<UserRound />} onSelect={() => nav('/account/profile')}>
                Profile and preferences
              </MenuItem>
              <MenuItem icon={<Megaphone />} onSelect={() => nav('/account/fundraisers')}>
                My fundraisers
              </MenuItem>
              <MenuItem icon={<ExternalLink />} onSelect={() => nav('/')}>
                Back to the website
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<LogOut />} onSelect={signOut}>
                Sign out
              </MenuItem>
            </Menu>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1180px] px-4 pt-6 pb-28 sm:px-6 sm:pt-10 lg:pb-20">
        <div key={loc.pathname} className="animate-portal-in">
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur-md pb-safe lg:hidden" aria-label="Your account">
        <ul className="mx-auto flex max-w-md">
          {NAV.filter((n) => MOBILE.includes(n.to)).map((n) => (
            <li key={n.to} className="flex-1">
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) => cn('flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium', isActive ? 'text-green' : 'text-text-3')}
              >
                <n.icon className="size-[22px]" />
                {n.short}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
