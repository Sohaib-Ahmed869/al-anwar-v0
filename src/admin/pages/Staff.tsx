import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MailPlus, MoreHorizontal, Power, PowerOff, Send, ShieldCheck, UserPlus } from 'lucide-react'
import type { Role } from '../../../shared/access'
import type { StaffUser } from '../../../shared/types'
import { api, errorMessage } from '../../portal/api'
import { useStaff } from '../../portal/session'
import { formatRelative } from '../../portal/format'
import {
  Avatar, Badge, Button, Card, DataTable, IconButton, Menu, MenuItem, MenuSeparator, PageHeader, toast, useConfirm,
  useDocumentTitle, type Column,
} from '../../portal/ui'
import { RoleBadge, StaffRoleMatrix } from '../components/StaffRoleMatrix'
import { StaffInviteDialog, StaffRoleDialog } from '../components/StaffDialogs'

/* ---------------------------------------------------------------------------
   Staff and access — who can sign in to the admin and compliance portals.

   A person is "invited" until they set a password, "active" after, and
   "off" once switched off (their history stays; they just cannot sign in).
   The row menu offers only what the server would allow: nothing on your own
   row, and nothing on an owner's row unless you are an owner.
--------------------------------------------------------------------------- */

type Row = StaffUser & { updatedAt?: string }
type ListResponse = { items: Row[] }

const statusOf = (s: StaffUser) => (!s.active ? 'off' : s.passwordSet ? 'active' : 'invited')
const STATUS = {
  active: { label: 'Active', tone: 'green' as const },
  invited: { label: 'Invited', tone: 'amber' as const },
  off: { label: 'Switched off', tone: 'neutral' as const },
}

export default function Staff() {
  useDocumentTitle('Staff and access', 'Admin')
  const me = useStaff().user
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [roleFor, setRoleFor] = useState<StaffUser | null>(null)
  const list = useQuery({ queryKey: ['admin', 'staff'], queryFn: () => api.get<ListResponse>('/admin/staff') })

  const act = useMutation({
    mutationFn: ({ s, action }: { s: StaffUser; action: 'deactivate' | 'reactivate' | 'resend-invite' }) => api.post<StaffUser>(`/admin/staff/${s.id}/${action}`),
    onSuccess: (s, { action }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'staff'] })
      toast.success(
        action === 'deactivate' ? `${s.name} can no longer sign in, and has been signed out` : action === 'reactivate' ? `${s.name} can sign in again` : `A fresh invitation is on its way to ${s.email}`,
      )
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const canTouch = (s: StaffUser) => s.id !== me?.id && (me?.role === 'owner' || s.role !== 'owner')
  const activeCount = list.data?.items.filter((s) => s.active).length ?? 0

  const menu = (s: StaffUser) =>
    canTouch(s) ? (
      <div onClick={(e) => e.stopPropagation()}>
        <Menu
          trigger={
            <IconButton label={`Actions for ${s.name}`} size="sm">
              <MoreHorizontal />
            </IconButton>
          }
        >
          {s.active && (
            <MenuItem icon={<ShieldCheck />} onSelect={() => setRoleFor(s)}>
              Change role
            </MenuItem>
          )}
          {s.active && !s.passwordSet && (
            <MenuItem icon={<Send />} onSelect={() => act.mutate({ s, action: 'resend-invite' })}>
              Send the invitation again
            </MenuItem>
          )}
          <MenuSeparator />
          {s.active ? (
            <MenuItem
              icon={<PowerOff />}
              tone="danger"
              onSelect={async () => {
                if (
                  await confirm({
                    title: `Switch off ${s.name}’s login?`,
                    body: 'They are signed out at once and cannot sign in again. Everything they did stays in the action log with their name. You can switch them back on later.',
                    confirmLabel: 'Switch off',
                    tone: 'danger',
                  })
                )
                  act.mutate({ s, action: 'deactivate' })
              }}
            >
              Switch off login
            </MenuItem>
          ) : (
            <MenuItem icon={<Power />} onSelect={() => act.mutate({ s, action: 'reactivate' })}>
              Switch login back on
            </MenuItem>
          )}
        </Menu>
      </div>
    ) : null

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Person',
      cell: (s) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={s.name} size="sm" className={s.active ? '' : 'opacity-50'} />
          <div className="min-w-0">
            <p className="truncate font-medium text-text">
              {s.name}
              {s.id === me?.id && <span className="ml-1.5 text-[12px] font-normal text-text-3">(you)</span>}
            </p>
            <p className="truncate text-[12.5px] text-text-2">{s.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', cell: (s) => <RoleBadge role={s.role as Role} size="sm" />, width: 150 },
    {
      key: 'status',
      header: 'Status',
      width: 140,
      cell: (s) => {
        const st = STATUS[statusOf(s)]
        return (
          <Badge tone={st.tone} dot size="sm">
            {st.label}
          </Badge>
        )
      },
    },
    {
      key: 'last',
      header: 'Last signed in',
      width: 170,
      hideBelow: 'lg',
      cell: (s) => (
        <span className="text-[13px] text-text-2">
          {s.lastLoginAt ? formatRelative(s.lastLoginAt) : s.invitedAt ? <span className="text-text-3">Invited {formatRelative(s.invitedAt)}</span> : <span className="text-text-3">Never</span>}
        </span>
      ),
    },
    { key: 'menu', header: <span className="sr-only">Actions</span>, align: 'right', width: 56, cell: menu },
  ]

  return (
    <>
      <PageHeader
        title="Staff and access"
        description="Everyone who can sign in to the admin and compliance portals, and what their role lets them do. Every action anyone takes is in the activity log with their name."
        actions={
          <Button variant="primary" icon={<UserPlus />} onClick={() => setInviteOpen(true)}>
            Invite someone
          </Button>
        }
      />
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line-2 px-5 py-3.5 text-[13px] text-text-2">
            <span className="nums">
              {list.data ? `${activeCount} with access · ${list.data.items.length - activeCount} switched off` : 'Loading…'}
            </span>
            <button type="button" onClick={() => setInviteOpen(true)} className="inline-flex items-center gap-1.5 font-medium text-green hover:underline sm:hidden">
              <MailPlus className="size-4" /> Invite
            </button>
          </div>
          <DataTable
            columns={columns}
            rows={list.data?.items}
            loading={list.isLoading}
            rowKey={(s) => s.id}
            rowClassName={(s) => (s.active ? undefined : 'opacity-70')}
            mobile={(s) => {
              const st = STATUS[statusOf(s)]
              return (
                <div className="flex items-center gap-3">
                  <Avatar name={s.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text">
                      {s.name}
                      {s.id === me?.id && <span className="ml-1 text-[12px] font-normal text-text-3">(you)</span>}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <RoleBadge role={s.role as Role} size="sm" />
                      <Badge tone={st.tone} dot size="sm">
                        {st.label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[12px] text-text-3">{s.lastLoginAt ? `Signed in ${formatRelative(s.lastLoginAt)}` : 'Not signed in yet'}</p>
                  </div>
                  {menu(s)}
                </div>
              )
            }}
          />
        </Card>
        <StaffRoleMatrix />
      </div>
      <StaffInviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <StaffRoleDialog person={roleFor} onOpenChange={(v) => !v && setRoleFor(null)} />
    </>
  )
}
