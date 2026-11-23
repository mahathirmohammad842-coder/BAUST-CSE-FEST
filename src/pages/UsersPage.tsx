import { useMemo, useState } from 'react';
import {
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
import type { TemporaryUserBlock } from '../utils/registrationStore';

type UserStatus = RegistrationStatus | 'Active' | 'Blocked';

interface ManagedUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: WorkspaceRole;
  affiliation: string;
  status: UserStatus;
  registeredAt?: string;
  blockExpiresAt?: string;
  isAdministrator: boolean;
}

interface UsersPageProps {
  organizer: SystemUser;
  demoUsers: SystemUser[];
  requests: RegistrationRequest[];
  blocks: TemporaryUserBlock[];
  onBlockUser: (userId: string) => void;
  onUnblockUser: (userId: string) => void;
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
  if (!value) return 'Demo account';
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

function getUserFromRequest(
  request: RegistrationRequest,
  block?: TemporaryUserBlock
): ManagedUser {
  return {
    id: request.id,
    fullName: request.fullName,
    email: request.email,
    phone: request.phone,
    role: request.role,
    affiliation: request.affiliation,
    status: request.status === 'Approved' && block ? 'Blocked' : request.status,
    registeredAt: request.registeredAt,
    blockExpiresAt: request.status === 'Approved' ? block?.expiresAt : undefined,
    isAdministrator: false,
  };
}

function getUserFromSystemUser(
  user: SystemUser,
  block?: TemporaryUserBlock
): ManagedUser {
  const isAdministrator = user.role === 'Organizer' || user.role === 'Admin';
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role === 'Admin' ? 'Organizer' : user.role,
    affiliation: user.affiliation,
    status: !isAdministrator && block ? 'Blocked' : 'Active',
    blockExpiresAt: isAdministrator ? undefined : block?.expiresAt,
    isAdministrator,
  };
}

export function UsersPage({
  organizer,
  demoUsers,
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

  const allUsers = useMemo(
    () => {
      const blocksByUserId = new Map(blocks.map((block) => [block.userId, block]));
      return [
        getUserFromSystemUser(organizer),
        ...demoUsers
          .filter((user) => user.role !== 'Organizer')
          .map((user) =>
            getUserFromSystemUser(user, blocksByUserId.get(user.id))
          ),
        ...requests.map((request) =>
          getUserFromRequest(request, blocksByUserId.get(request.id))
        ),
      ];
    },
    [blocks, demoUsers, organizer, requests]
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
    if (
      !userToBlock ||
      userToBlock.isAdministrator ||
      !['Active', 'Approved'].includes(userToBlock.status)
    ) {
      return;
    }
    onBlockUser(userToBlock.id);
    setUserToBlock(null);
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
          Organizer administration
        </span>
      </header>

      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="User account statistics"
      >
        <StatCard
          label="Total Users"
          value={counts.total.toLocaleString()}
          sublabel="Including the organizer administrator"
          icon={UsersRound}
        />
        <StatCard
          label="Active Users"
          value={counts.active.toLocaleString()}
          sublabel="Eligible demo and approved accounts"
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
                          className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${statusStyle(user.status)}`}
                        >
                          {user.status}
                        </span>
                        {user.blockExpiresAt && (
                          <span className="whitespace-nowrap text-[10px] text-slate-500 dark:text-slate-400">
                            Until {formatBlockExpiry(user.blockExpiresAt)}
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
                          {user.status === 'Blocked' ? (
                            <button
                              type="button"
                              onClick={() => onUnblockUser(user.id)}
                              aria-label={`Unblock ${user.fullName}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-emerald-800/70 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Unblock
                            </button>
                          ) : ['Active', 'Approved'].includes(user.status) ? (
                            <button
                              type="button"
                              onClick={() => setUserToBlock(user)}
                              aria-label={`Block ${user.fullName} for 1 hour`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 dark:border-amber-800/70 dark:text-amber-300 dark:hover:bg-amber-950/40"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Block
                            </button>
                          ) : null}
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
        title="Temporarily block user?"
        subtitle="They will be signed out immediately and blocked from signing in for 1 hour."
        dangerHeader
        maxWidthClass="max-w-md"
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500"
            >
              <Ban className="h-3.5 w-3.5" />
              Block for 1 hour
            </button>
          </>
        }
      >
        {userToBlock && (
          <p className="text-sm leading-relaxed text-emerald-900/75 dark:text-emerald-200/80">
            Block <strong className="text-emerald-950 dark:text-emerald-50">{userToBlock.fullName}</strong>{' '}
            ({userToBlock.email})? Access will be restored automatically after
            one hour, or you can unblock them sooner.
          </p>
        )}
      </Modal>
    </div>
  );
}
