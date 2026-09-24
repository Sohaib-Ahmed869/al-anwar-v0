import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { can, type Permission } from '../../shared/access'
import type { Donor, StaffUser } from '../../shared/types'
import { api, onUnauthorised } from './api'
import { FullPageSpinner } from './ui/Spinner'

/* Who is signed in. One request answers for both audiences; the shells ask
   for the one they need and send anyone without it to that portal's sign-in,
   remembering where they were going. */

export type SessionResponse = {
  staff: { user: StaffUser; permissions: Permission[] } | null
  donor: Donor | null
}

export const SESSION_KEY = ['session'] as const

export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: () => api.get<SessionResponse>('/auth/session'),
    staleTime: 60_000,
  })
}

export function useStaff() {
  const { data } = useSession()
  const staff = data?.staff ?? null
  return {
    user: staff?.user ?? null,
    permissions: staff?.permissions ?? [],
    can: (p: Permission) => Boolean(staff && can(staff.user.role, p)),
  }
}

export const useCan = (p: Permission) => useStaff().can(p)

export function useDonor() {
  const { data } = useSession()
  return data?.donor ?? null
}

/** Renders children only for a signed-in staff member (optionally with any
 *  one of the permissions given); otherwise to the staff sign-in, carrying the path back. */
export function RequireStaff({ children, perm }: { children: ReactNode; perm?: Permission | Permission[] }) {
  const { data, isLoading } = useSession()
  const loc = useLocation()
  useSessionExpiry('/admin/login')
  if (isLoading) return <FullPageSpinner />
  if (!data?.staff) return <Navigate to={`/admin/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  const perms = perm ? (Array.isArray(perm) ? perm : [perm]) : []
  if (perms.length && !perms.some((p) => can(data.staff!.user.role, p))) return <Navigate to={can(data.staff.user.role, 'dashboard.view') ? '/admin' : '/admin/gifts'} replace />
  return <>{children}</>
}

export function RequireDonor({ children }: { children: ReactNode }) {
  const { data, isLoading } = useSession()
  const loc = useLocation()
  useSessionExpiry('/account/login')
  if (isLoading) return <FullPageSpinner />
  if (!data?.donor) return <Navigate to={`/account/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  return <>{children}</>
}

/** A 401 mid-session (cookie expired, role changed) refreshes the session and
 *  sends the person to sign in again, back to where they were. */
function useSessionExpiry(loginPath: string) {
  const qc = useQueryClient()
  const nav = useNavigate()
  const loc = useLocation()
  useEffect(
    () =>
      onUnauthorised(() => {
        qc.invalidateQueries({ queryKey: SESSION_KEY })
        if (!loc.pathname.endsWith('/login')) nav(`${loginPath}?next=${encodeURIComponent(loc.pathname + loc.search)}&expired=1`, { replace: true })
      }),
    [qc, nav, loc.pathname, loc.search, loginPath],
  )
}
