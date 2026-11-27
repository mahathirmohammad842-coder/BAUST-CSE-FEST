import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Ban,
  CheckCircle2,
  Clock3,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  UserX,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { StatCard } from '../components/StatCard';
import type {
  RegistrationRequest,
  RegistrationStatus,
  SystemUser,
  WorkspaceRole,
} from '../types';
import type {
  UserBlockReason,
  UserBlockRecord,
} from '../utils/registrationStore';

type UserStatus = RegistrationStatus | 'Active' | 'Blocked';
type BlockDuration = 'permanent' | '15m' | '30m' | '1h' | '6h' | '12h' | '24h' | '3d' | '7d' | 'custom';

interface ManagedUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: WorkspaceRole;
  affiliation: string;
  status: UserStatus;
  registeredAt?: string;
  block?: UserBlockRecord;
  isAdministrator: boolean;
}

interface UsersPageProps {
  currentUser: SystemUser;
  staffUsers: SystemUser[];
  requests: RegistrationRequest[];
  blocks: UserBlockRecord[];
  onBlockUser: (
    userId: string,
    expiresAt: string | null,
    reason: UserBlockReason,
    note: string
  ) => void;
  onUnblockUser: (blockId: string) => void;
  onDeleteUser: (userId: string) => void;
}

function statusStyle(status: UserStatus) {
  if (status === 'Active' || status === 'Approved') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300';
  }
  if (status === 'Rejected') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/50 dark:text-red-300';
  }
  if (status === 'Blocked') {
    return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
  }
  return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-300';
}

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeZone: 'Asia/Dhaka',
  }).format(date);
}

function formatBlockExpiry(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(date);
}

function getLocalDateTimeValue(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function getLocalDateTimeMinimum() {
  const minimum = new Date(Date.now() + 60_000);
  return getLocalDateTimeValue(minimum.toISOString());
}

function getUserFromRequest(
  request: RegistrationRequest,
  block?: UserBlockRecord
): ManagedUser {
  return {
    id: request.id,
    fullName: request.fullName,
    email: request.email,
    phone: request.phone,
    role: request.role,
    affiliation: request.affiliation,
    status: block && !block.endedAt ? 'Blocked' : request.status,
    registeredAt: request.registeredAt,
    block,
    isAdministrator: false,
  };
}

function getUserFromSystemUser(
  user: SystemUser,
  block?: UserBlockRecord
): ManagedUser {
  const isAdministrator =
    user.role === 'Organizer' ||
    user.role === 'Admin' ||
    user.role === 'Super Admin';
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    affiliation: user.affiliation,
    status: !isAdministrator && block && !block.endedAt ? 'Blocked' : 'Active',
    registeredAt: user.createdAt,
    block: isAdministrator ? undefined : block,
    isAdministrator,
  };
}

export function UsersPage({
  currentUser,
  staffUsers,
  requests,
  blocks,
  onBlockUser,
  onUnblockUser,
  onDeleteUser,
}: UsersPageProps) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<WorkspaceRole | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'All'>('All');
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);
  const [userToBlock, setUserToBlock] = useState<ManagedUser | null>(null);
  const [blockDuration, setBlockDuration] = useState<BlockDuration>('1h');
  const [customExpiry, setCustomExpiry] = useState('');
  const [blockReason, setBlockReason] = useState<UserBlockReason>('Policy Violation');
  const [adminNote, setAdminNote] = useState('');

  const allUsers = useMemo(
    () => {
      const now = Date.now();
      const blocksByUserId = new Map(
        blocks
          .filter(
            (block) =>
              !block.endedAt &&
              (block.expiresAt === null || Date.parse(block.expiresAt) > now)
          )
          .map((block) => [block.userId, block])
      );
      return [
        getUserFromSystemUser(currentUser),
        ...staffUsers
          .filter((user) => user.id !== currentUser.id)
          .map((user) =>
            getUserFromSystemUser(user, blocksByUserId.get(user.id))
          ),
        ...requests.map((request) =>
          getUserFromRequest(request, blocksByUserId.get(request.id))
        ),
      ];
    },
    [blocks, currentUser, requests, staffUsers]
  );
  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return allUsers.filter((user) => {
      const matchesSearch =
        !normalizedQuery ||
        [user.fullName, user.email, user.phone, user.affiliation]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      return (
        matchesSearch &&
        (roleFilter === 'All' || user.role === roleFilter) &&
        (statusFilter === 'All' || user.status === statusFilter)
      );
    });
  }, [allUsers, query, roleFilter, statusFilter]);
  const counts = useMemo(
    () => ({
      total: allUsers.length,
      active: allUsers.filter(
        (user) => user.status === 'Active' || user.status === 'Approved'
      ).length,
      pending: allUsers.filter((user) => user.status === 'Pending Approval')
        .length,
      rejected: allUsers.filter((user) => user.status === 'Rejected').length,
    }),
    [allUsers]
  );

  const confirmDelete = () => {
    if (!userToDelete || userToDelete.isAdministrator) return;
    onDeleteUser(userToDelete.id);
    setUserToDelete(null);
  };

  const confirmBlock = () => {
    if (!userToBlock || userToBlock.isAdministrator) {
      return;
    }
    if (
      blockDuration === 'custom' &&
      (!customExpiry || Number.isNaN(Date.parse(customExpiry)))
    ) {
      return;
    }
    const durationMs: Partial<Record<BlockDuration, number>> = {
      '15m': 15 * 60_000,
      '30m': 30 * 60_000,
      '1h': 60 * 60_000,
      '6h': 6 * 60 * 60_000,
      '12h': 12 * 60 * 60_000,
      '24h': 24 * 60 * 60_000,
      '3d': 3 * 24 * 60 * 60_000,
      '7d': 7 * 24 * 60 * 60_000,
    };
    const expiresAt =
      blockDuration === 'permanent'
        ? null
        : blockDuration === 'custom'
          ? new Date(customExpiry).toISOString()
          : new Date(Date.now() + (durationMs[blockDuration] ?? 0)).toISOString();
    if (expiresAt !== null && Date.parse(expiresAt) <= Date.now()) return;
    onBlockUser(userToBlock.id, expiresAt, blockReason, adminNote.trim());
    setUserToBlock(null);
    setCustomExpiry('');
    setAdminNote('');
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UsersRound className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
            <h1 className="font-display text-xl font-bold text-emerald-950 dark:text-emerald-50">
              Users
            </h1>
          </div>
          <p className="mt-1 text-xs text-emerald-900/60 dark:text-emerald-300/65">
            Manage accounts, review access status, and remove users from the fest portal.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-200">
          <ShieldCheck className="h-3.5 w-3.5" />
          {currentUser.role} administration
        </span>
      </header>

      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="User account statistics"
      >
        <StatCard
          label="Total Users"
          value={counts.total.toLocaleString()}
          sublabel="          Including the current administrator"
          icon={UsersRound}
        />
        <StatCard
          label="Active Users"
          value={counts.active.toLocaleString()}
          sublabel="Active profiles and approved accounts"
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Pending Approval"
          value={counts.pending.toLocaleString()}
          sublabel="Awaiting organizer review"
          icon={Clock3}
          tone="amber"
        />
        <StatCard
          label="Rejected Users"
          value={counts.rejected.toLocaleString()}
          sublabel="Inactive accounts"
          icon={UserX}
          tone="danger"
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-emerald-200/70 bg-white dark:border-emerald-800/60 dark:bg-[#061D15]">
        <div className="flex flex-col gap-3 border-b border-emerald-100 p-4 dark:border-emerald-800/60 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
              User directory
            </h2>
            <p className="mt-0.5 text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
              {filteredUsers.length} of {allUsers.length} accounts
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(14rem,1fr)_auto_auto]">
            <label className="relative block">
              <span className="sr-only">Search users</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-800/45 dark:text-emerald-200/45"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, phone…"
                className="min-h-10 w-full rounded-lg border border-emerald-200 bg-white py-2 pl-9 pr-3 text-xs text-emerald-950 outline-none transition focus:border-emerald-600 focus:ring-[3px] focus:ring-emerald-600/10 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              />
            </label>
            <label>
              <span className="sr-only">Filter by role</span>
              <select
                value={roleFilter}
                onChange={(event) => {
                  const role = event.target.value;
                  if (
                    role === 'All' ||
                    [
                      'Organizer',
                      'Participant',
                      'Volunteer',
                      'Judge',
                      'Guest',
                      'Sponsor',
                      'Mentor',
                      'Admin',
                      'Super Admin',
                    ].includes(role)
                  ) {
                    setRoleFilter(role as WorkspaceRole | 'All');
                  }
                }}
                className="min-h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              >
                <option value="All">All roles</option>
                <option value="Organizer">Organizer</option>
                <option value="Participant">Participant</option>
                <option value="Volunteer">Volunteer</option>
                <option value="Judge">Judge</option>
                <option value="Guest">Guest</option>
                <option value="Sponsor">Sponsor</option>
                <option value="Mentor">Mentor</option>
                <option value="Admin">Admin</option>
                <option value="Super Admin">Super Admin</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by status</span>
              <select
                value={statusFilter}
                onChange={(event) => {
                  const status = event.target.value;
                  if (
                    [
                      'All',
                      'Active',
                      'Pending Approval',
                      'Approved',
                      'Rejected',
                      'Blocked',
                    ].includes(status)
                  ) {
                    setStatusFilter(status as UserStatus | 'All');
                  }
                }}
                className="min-h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              >
                <option value="All">All statuses</option>
                <option value="Active">Active</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Blocked">Blocked</option>
              </select>
            </label>
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <UserRound className="h-5 w-5" />
            </span>
            <h3 className="mt-3 text-sm font-semibold text-emerald-950 dark:text-emerald-50">
              No users match your filters
            </h3>
            <p className="mt-1 text-xs text-emerald-900/60 dark:text-emerald-300/65">
              Try a different name, email, role, or status.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Department / organization</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Registered</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50">
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="text-xs text-emerald-950 dark:text-emerald-50"
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-semibold">{user.fullName}</p>
                      <p className="mt-0.5 text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                        {user.email}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">{user.phone}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5">
                        {user.isAdministrator && (
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                        )}
                        {user.role}
                        {user.isAdministrator && (
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-300">
                            Admin
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="max-w-56 truncate px-4 py-3.5" title={user.affiliation}>
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-emerald-800/45 dark:text-emerald-200/45" />
                        <span className="truncate">{user.affiliation}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${
                            user.status === 'Blocked'
                              ? user.block?.expiresAt
                                ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
                                : 'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200'
                              : statusStyle(user.status)
                          }`}
                        >
                          {user.status === 'Blocked'
                            ? user.block?.expiresAt
                              ? 'Temporarily Blocked'
                              : 'Permanently Blocked'
                            : user.status}
                        </span>
                        {user.block && !user.block.endedAt && (
                          <span className="whitespace-nowrap text-[10px] text-slate-500 dark:text-slate-400">
                            {user.block.expiresAt
                              ? `Until ${formatBlockExpiry(user.block.expiresAt)}`
                              : 'No expiry'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-emerald-900/65 dark:text-emerald-300/70">
                      {formatDate(user.registeredAt)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {user.isAdministrator ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 px-2.5 py-1.5 text-[11px] font-medium text-emerald-800/65 dark:border-emerald-800/60 dark:text-emerald-200/65">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Protected
                        </span>
                      ) : (
                        <div className="inline-flex items-center gap-2 whitespace-nowrap">
                          {user.status === 'Blocked' && user.block ? (
                            <button
                              type="button"
                              onClick={() => onUnblockUser(user.block!.id)}
                              aria-label={`Unblock ${user.fullName}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-emerald-800/70 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Unblock
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setUserToBlock(user);
                                setBlockDuration('1h');
                                setBlockReason('Policy Violation');
                                setAdminNote('');
                                setCustomExpiry('');
                              }}
                              aria-label={`Block user ${user.fullName}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 dark:border-amber-800/70 dark:text-amber-300 dark:hover:bg-amber-950/40"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Block User
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setUserToDelete(user)}
                            aria-label={`Delete ${user.fullName}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-950/40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={userToDelete !== null}
        onClose={() => setUserToDelete(null)}
        title="Delete user?"
        subtitle="This action cannot be undone."
        dangerHeader
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setUserToDelete(null)}
              className="rounded-lg border border-emerald-200 px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-emerald-900/50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete user
            </button>
          </>
        }
      >
        {userToDelete && (
          <p className="text-sm leading-relaxed text-emerald-900/75 dark:text-emerald-200/80">
            Delete <strong className="text-emerald-950 dark:text-emerald-50">{userToDelete.fullName}</strong>{' '}
            ({userToDelete.email})? Their account and any associated registration request will be removed.
          </p>
        )}
      </Modal>

      <Modal
        open={userToBlock !== null}
        onClose={() => setUserToBlock(null)}
        title="Block user access?"
        subtitle="This action immediately signs out the user and prevents future sign-in until the block is lifted."
        dangerHeader
        maxWidthClass="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setUserToBlock(null)}
              className="rounded-lg border border-emerald-200 px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-emerald-900/50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmBlock}
              disabled={
                blockDuration === 'custom' &&
                (!customExpiry || Date.parse(customExpiry) <= Date.now())
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500"
            >
              <Ban className="h-3.5 w-3.5" />
              {blockDuration === 'permanent'
                ? 'Block permanently'
                : 'Confirm block'}
            </button>
          </>
        }
      >
        {userToBlock && (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs dark:border-emerald-800/60 dark:bg-emerald-950/20 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-300/60">User</p>
                <p className="mt-1 font-semibold text-emerald-950 dark:text-emerald-50">{userToBlock.fullName}</p>
                <p className="mt-0.5 break-all text-emerald-900/65 dark:text-emerald-200/65">{userToBlock.email}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-300/60">Role & current status</p>
                <p className="mt-1 font-semibold text-emerald-950 dark:text-emerald-50">{userToBlock.role}</p>
                <p className="mt-0.5 text-emerald-900/65 dark:text-emerald-200/65">{userToBlock.status}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-emerald-950 dark:text-emerald-50">
                Block duration
                <select
                  value={blockDuration}
                  onChange={(event) => setBlockDuration(event.target.value as BlockDuration)}
                  className="mt-1.5 min-h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-normal text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                >
                  <option value="permanent">Block Permanently</option>
                  <option value="15m">Block for 15 Minutes</option>
                  <option value="30m">Block for 30 Minutes</option>
                  <option value="1h">Block for 1 Hour</option>
                  <option value="6h">Block for 6 Hours</option>
                  <option value="12h">Block for 12 Hours</option>
                  <option value="24h">Block for 24 Hours</option>
                  <option value="3d">Block for 3 Days</option>
                  <option value="7d">Block for 7 Days</option>
                  <option value="custom">Custom date & time</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-emerald-950 dark:text-emerald-50">
                Block reason
                <select
                  value={blockReason}
                  onChange={(event) => setBlockReason(event.target.value as UserBlockReason)}
                  className="mt-1.5 min-h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-normal text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                >
                  <option>Spam</option>
                  <option>Misconduct</option>
                  <option>Fake Registration</option>
                  <option>Security Violation</option>
                  <option>Policy Violation</option>
                  <option>Other</option>
                </select>
              </label>
            </div>

            {blockDuration === 'custom' && (
              <label className="block text-xs font-semibold text-emerald-950 dark:text-emerald-50">
                Block until
                <input
                  type="datetime-local"
                  value={customExpiry}
                  min={getLocalDateTimeMinimum()}
                  onChange={(event) => setCustomExpiry(event.target.value)}
                  className="mt-1.5 min-h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-normal text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                />
              </label>
            )}

            <label className="block text-xs font-semibold text-emerald-950 dark:text-emerald-50">
              Admin note <span className="font-normal text-emerald-900/55 dark:text-emerald-300/55">(optional)</span>
              <textarea
                rows={3}
                maxLength={500}
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                placeholder="Add context for the audit record…"
                className="mt-1.5 w-full resize-y rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-normal text-emerald-950 outline-none placeholder:text-emerald-900/40 focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              />
            </label>

            <div className="flex gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Blocking immediately ends this user’s current app session and prevents sign-in.{' '}
                {blockDuration === 'permanent'
                  ? 'A permanent block stays in effect until an organizer unblocks the account.'
                  : blockDuration === 'custom'
                    ? 'The account remains blocked until the selected date and time.'
                    : `The account will be blocked for ${blockDuration}.`}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
