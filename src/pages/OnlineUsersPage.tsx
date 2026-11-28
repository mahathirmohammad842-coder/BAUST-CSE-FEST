import { useMemo, useState } from 'react';
import {
  Clock,
  Monitor,
  Radio,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { RoleBadge } from '../components/Badge';
import { StatCard } from '../components/StatCard';
import type {
  PresenceStatus,
  PresenceUserEntry,
  UserProfile,
  WorkspaceRole,
} from '../types';
import { formatDhakaDateTime } from '../utils/formatters';

interface OnlineUsersPageProps {
  profiles: UserProfile[];
  livePresenceMap: Record<string, PresenceUserEntry>;
  isPresenceConnected: boolean;
  currentUserId?: string | null;
}

type StatusFilter = 'All' | PresenceStatus;

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  announcements: 'Announcements',
  inbox: 'Notifications Inbox',
  composer: 'Create Notice',
  'delivery-detail': 'Notice Details',
  'operations-inbox': 'Support & Incidents',
  users: 'Users Directory',
  'user-approvals': 'User Approvals',
  'super-admin-users': 'Role Governance',
  'blocked-users': 'Blocked Users',
  profiles: 'Profile Management',
  profile: 'My Profile',
  analytics: 'Analytics',
  'online-users': 'Online Users',
  'audit-logs': 'Audit Logs',
  'activity-logs': 'Activity Logs',
  'system-settings': 'System Settings',
  settings: 'Settings',
  integrations: 'Integrations',
  'security-settings': 'Security Settings',
  'recycle-bin': 'Recycle Bin',
};

function formatRelativeTime(value?: string | null): string {
  if (!value) return 'Never';
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return 'Never';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return formatDhakaDateTime(value);
}

export function OnlineUsersPage({
  profiles,
  livePresenceMap,
  isPresenceConnected,
  currentUserId,
}: OnlineUsersPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [roleFilter, setRoleFilter] = useState<WorkspaceRole | 'All'>('All');

  const mergedUsers = useMemo<PresenceUserEntry[]>(() => {
    const map = new Map<string, PresenceUserEntry>();

    for (const profile of profiles) {
      if (profile.isDeleted || profile.accountStatus === 'Deleted') continue;
      const live = livePresenceMap[profile.userId];
      const status: PresenceStatus = live
        ? live.status
        : profile.presenceStatus === 'Online' || profile.presenceStatus === 'Away'
          ? profile.presenceStatus
          : 'Offline';
      map.set(profile.userId, {
        userId: profile.userId,
        fullName: profile.fullName,
        email: profile.email,
        role: profile.assignedRole ?? profile.role,
        avatarUrl: profile.photoDataUrl || live?.avatarUrl || '',
        department: profile.department,
        institution: profile.institution,
        status,
        lastSeenAt: live?.lastSeenAt ?? profile.lastSeenAt ?? profile.lastLoginAt ?? null,
        lastLoginAt: profile.lastLoginAt ?? live?.lastLoginAt ?? null,
        currentSessionId: live?.currentSessionId,
        currentRoute: live?.currentRoute,
        activeSessionsCount: live?.activeSessionsCount ?? (status === 'Offline' ? 0 : 1),
      });
    }

    for (const [id, live] of Object.entries(livePresenceMap)) {
      if (!map.has(id)) {
        map.set(id, live);
      }
    }

    const order: Record<PresenceStatus, number> = {
      Online: 0,
      Away: 1,
      Offline: 2,
    };

    return Array.from(map.values()).sort((a, b) => {
      if (order[a.status] !== order[b.status]) {
        return order[a.status] - order[b.status];
      }
      return (
        Date.parse(b.lastSeenAt || b.lastLoginAt || '') -
        Date.parse(a.lastSeenAt || a.lastLoginAt || '')
      );
    });
  }, [livePresenceMap, profiles]);

  const metrics = useMemo(() => {
    const online = mergedUsers.filter((u) => u.status === 'Online');
    const away = mergedUsers.filter((u) => u.status === 'Away');
    const organizersOnline = online.filter(
      (u) => u.role === 'Organizer' || u.role === 'Super Admin'
    );
    const participantsOnline = online.filter(
      (u) => u.role === 'Participant'
    );
    return {
      totalOnline: online.length,
      organizersOnline: organizersOnline.length,
      participantsOnline: participantsOnline.length,
      awayCount: away.length,
    };
  }, [mergedUsers]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mergedUsers.filter((u) => {
      if (statusFilter !== 'All' && u.status !== statusFilter) return false;
      if (roleFilter !== 'All' && u.role !== roleFilter) return false;
      if (!q) return true;
      return [
        u.fullName,
        u.email,
        u.role,
        u.department ?? '',
        u.institution ?? '',
        u.currentRoute ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [mergedUsers, roleFilter, searchQuery, statusFilter]);

  const availableRoles: WorkspaceRole[] = [
    'Super Admin',
    'Organizer',
    'Participant',
    'Volunteer',
    'Judge',
    'Mentor',
    'Sponsor',
    'Guest',
  ];

  return (
    <div className="space-y-5 pb-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Radio
              className={`h-5 w-5 ${
                isPresenceConnected
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
              aria-hidden="true"
            />
            <h1 className="font-display text-xl font-bold text-emerald-950 dark:text-emerald-50">
              Online Users &amp; Live Presence
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                isPresenceConnected
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isPresenceConnected
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-amber-500'
                }`}
              />
              {isPresenceConnected ? 'Realtime Presence Connected' : 'Connecting Presence…'}
            </span>
          </div>
          <p className="mt-1 text-xs text-emerald-900/60 dark:text-emerald-300/65">
            Real-time Supabase Presence tracking (Online on login, Away after 10 minutes idle, Offline on logout or browser close).
          </p>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Users Online Now"
          value={metrics.totalOnline.toLocaleString()}
          sublabel="Active realtime sessions"
          icon={UserCheck}
          tone="success"
        />
        <StatCard
          label="Organizers Online"
          value={metrics.organizersOnline.toLocaleString()}
          sublabel="Organizers & Super Admins active"
          icon={ShieldCheck}
          tone="default"
        />
        <StatCard
          label="Participants Online"
          value={metrics.participantsOnline.toLocaleString()}
          sublabel="Competitors currently active"
          icon={Users}
          tone="default"
        />
        <StatCard
          label="Away (10m+ Idle)"
          value={metrics.awayCount.toLocaleString()}
          sublabel="Inactive for 10+ minutes"
          icon={Clock}
          tone="amber"
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-emerald-200/70 bg-white dark:border-emerald-800/60 dark:bg-[#061D15]">
        <div className="flex flex-col gap-3 border-b border-emerald-100 p-4 lg:flex-row lg:items-center lg:justify-between dark:border-emerald-800/60">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['All', 'Online', 'Away', 'Offline'] as const).map((tab) => {
              const count =
                tab === 'All'
                  ? mergedUsers.length
                  : mergedUsers.filter((u) => u.status === tab).length;
              const active = statusFilter === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[#042419] text-white dark:bg-emerald-700'
                      : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200'
                  }`}
                >
                  {tab === 'Online' && (
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  )}
                  {tab === 'Away' && (
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                  )}
                  {tab === 'Offline' && (
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                  )}
                  <span>{tab}</span>
                  <span className="font-mono text-[11px] opacity-75 tabular-nums">
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) =>
                setRoleFilter(e.target.value as WorkspaceRole | 'All')
              }
              className="h-9 rounded-lg border border-emerald-200 bg-white px-2.5 text-xs font-medium text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
            >
              <option value="All">All Roles</option>
              {availableRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <label className="relative block">
              <span className="sr-only">Search online users</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-800/45 dark:text-emerald-200/45" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, email, role…"
                className="h-9 w-full sm:w-64 rounded-lg border border-emerald-200 bg-white pl-8 pr-3 text-xs text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              />
            </label>
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="px-6 py-14 text-center text-xs text-emerald-900/60 dark:text-emerald-300/65">
            No users match the selected presence filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left">
              <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Seen</th>
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-4 py-3">Current Session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50">
                {filteredUsers.map((entry) => {
                  const initials = entry.fullName
                    .split(' ')
                    .map((p) => p[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();
                  const isYou = entry.userId === currentUserId;
                  const dotClass =
                    entry.status === 'Online'
                      ? 'bg-emerald-500 ring-2 ring-white dark:ring-[#061D15]'
                      : entry.status === 'Away'
                        ? 'bg-amber-400 ring-2 ring-white dark:ring-[#061D15]'
                        : 'bg-slate-400 ring-2 ring-white dark:ring-[#061D15]';

                  return (
                    <tr
                      key={entry.userId}
                      className="text-xs text-emerald-950 hover:bg-emerald-50/35 dark:text-emerald-50 dark:hover:bg-[#09291E]/60"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-9 w-9 shrink-0">
                            {entry.avatarUrl ? (
                              <img
                                src={entry.avatarUrl}
                                alt={entry.fullName}
                                className="h-9 w-9 rounded-full object-cover border border-emerald-200 dark:border-emerald-800"
                              />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-900 text-xs font-bold text-white dark:bg-emerald-800">
                                {initials || 'U'}
                              </div>
                            )}
                            <span
                              title={entry.status}
                              className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ${dotClass}`}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-semibold">
                              <span className="truncate">{entry.fullName}</span>
                              {isYou && (
                                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="truncate text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                              {entry.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <RoleBadge role={entry.role} />
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${
                            entry.status === 'Online'
                              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                              : entry.status === 'Away'
                                ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              entry.status === 'Online'
                                ? 'bg-emerald-500'
                                : entry.status === 'Away'
                                  ? 'bg-amber-400'
                                  : 'bg-slate-400'
                            }`}
                          />
                          {entry.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-emerald-900/75 dark:text-emerald-200/80 tabular-nums">
                        {entry.status === 'Online'
                          ? 'Active now'
                          : formatRelativeTime(entry.lastSeenAt)}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-emerald-900/65 dark:text-emerald-300/65 tabular-nums">
                        {entry.lastLoginAt
                          ? formatDhakaDateTime(entry.lastLoginAt)
                          : '—'}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {entry.status !== 'Offline' ? (
                          <div className="inline-flex items-center gap-2 text-[11px]">
                            <Monitor className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                            <span className="font-medium text-emerald-950 dark:text-emerald-100">
                              {entry.currentRoute
                                ? ROUTE_LABELS[entry.currentRoute] ??
                                  entry.currentRoute
                                : 'Active Workspace'}
                            </span>
                            {entry.currentSessionId && (
                              <span className="font-mono text-[10px] text-emerald-900/55 dark:text-emerald-300/60">
                                #{entry.currentSessionId}
                                {(entry.activeSessionsCount ?? 1) > 1
                                  ? ` (+${(entry.activeSessionsCount ?? 1) - 1})`
                                  : ''}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-emerald-900/45 dark:text-emerald-300/45">
                            No active session
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
