import { useMemo, useState } from 'react';
import {
  Activity,
  Download,
  FileSearch,
  History,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import type {
  ActivityLogEntry,
  AnnouncementAuditLog,
  ApprovalLog,
  ProfileAuditEvent,
  RoleChangeLog,
  UserDeletionAuditLog,
  UserProfile,
  VerificationLog,
} from '../types';
import type { UserBlockAuditEvent } from '../utils/registrationStore';
import { downloadCsv } from '../utils/csvExport';

interface MonitoringLogsPageProps {
  view: 'audit' | 'activity';
  profiles: UserProfile[];
  deletionAuditLogs: UserDeletionAuditLog[];
  announcementAuditLogs?: AnnouncementAuditLog[];
  roleChangeLogs: RoleChangeLog[];
  approvalLogs: ApprovalLog[];
  verificationLogs: VerificationLog[];
  activityLogs: ActivityLogEntry[];
  profileEvents: ProfileAuditEvent[];
  blockEvents: UserBlockAuditEvent[];
  onRefreshData?: () => Promise<string | null>;
  onNotify?: (message: string) => void;
}

type AuditCategoryFilter =
  | 'All'
  | 'Deletion & Restore'
  | 'Announcement Trash'
  | 'Role Change'
  | 'Approval'
  | 'Verification'
  | 'Access Block'
  | 'Profile & Security';

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(date);
}

export function MonitoringLogsPage({
  view,
  profiles,
  deletionAuditLogs,
  announcementAuditLogs = [],
  roleChangeLogs,
  approvalLogs,
  verificationLogs,
  activityLogs,
  profileEvents,
  blockEvents,
  onRefreshData,
  onNotify,
}: MonitoringLogsPageProps) {
  const [query, setQuery] = useState('');
  const [auditCategory, setAuditCategory] =
    useState<AuditCategoryFilter>('All');
  const [activityCategory, setActivityCategory] = useState<string>('All');
  const [refreshing, setRefreshing] = useState(false);

  const profileNameMap = useMemo(
    () => new Map(profiles.map((p) => [p.userId, p.fullName])),
    [profiles]
  );

  const unifiedAuditRows = useMemo(() => {
    const rows = [
      ...deletionAuditLogs.map((log) => ({
        id: `del-${log.id}`,
        category: 'Deletion & Restore' as const,
        action: log.action,
        actor: log.actorName || 'Administrator',
        target: `${log.targetUserName} (${log.targetUserEmail})`,
        summary: [
          log.notes,
          log.deletedAt ? `Deleted: ${formatDateTime(log.deletedAt)}` : '',
          log.restoredAt
            ? `Restored: ${formatDateTime(log.restoredAt)}${log.restoredByName ? ` by ${log.restoredByName}` : ''}`
            : '',
          log.permanentlyDeletedAt
            ? `Permanent Delete: ${formatDateTime(log.permanentlyDeletedAt)}`
            : '',
        ]
          .filter(Boolean)
          .join(' · '),
        occurredAt: log.createdAt,
      })),
      ...roleChangeLogs.map((log) => ({
        id: `role-${log.id}`,
        category: 'Role Change' as const,
        action: `${log.previousRole} -> ${log.newRole}`,
        actor: log.changedByName,
        target: `${log.userName} (${log.userEmail})`,
        summary: log.notes || `Role changed from ${log.previousRole} to ${log.newRole}`,
        occurredAt: log.changedAt,
      })),
      ...approvalLogs.map((log) => ({
        id: `appr-${log.id}`,
        category: 'Approval' as const,
        action: log.action,
        actor: log.actorName,
        target: `${log.userName} (${log.userEmail})`,
        summary: `${log.previousStatus} -> ${log.newStatus}${log.approvalNotes ? ` · ${log.approvalNotes}` : ''}`,
        occurredAt: log.createdAt,
      })),
      ...verificationLogs.map((log) => ({
        id: `ver-${log.id}`,
        category: 'Verification' as const,
        action: `${log.previousStatus} -> ${log.newStatus}`,
        actor: log.verifiedByName,
        target: `${log.userName} (${log.userEmail})`,
        summary: log.verificationNotes || `Verification updated to ${log.newStatus}`,
        occurredAt: log.verifiedAt,
      })),
      ...blockEvents.map((event) => ({
        id: `blk-${event.id}`,
        category: 'Access Block' as const,
        action: event.action,
        actor: event.actorName,
        target: profileNameMap.get(event.userId) ?? event.userId,
        summary: `${event.reason}${event.note ? ` · ${event.note}` : ''}`,
        occurredAt: event.occurredAt,
      })),
      ...announcementAuditLogs.map((log) => ({
        id: `ann-${log.id}`,
        category: 'Announcement Trash' as const,
        action: log.action,
        actor: `${log.actorName} (${log.actorRole})`,
        target: log.announcementTitle || log.announcementId,
        summary: [
          log.action === 'soft_deleted'
            ? `Deleted By ${log.actorName} · Deleted Time: ${formatDateTime(log.createdAt)}`
            : log.action === 'restored'
              ? `Restored By ${log.actorName} · Restored Time: ${formatDateTime(log.createdAt)}`
              : log.action === 'permanently_deleted'
                ? `Permanent Delete By ${log.actorName} · ${formatDateTime(log.createdAt)}`
                : log.action,
          log.notes,
        ]
          .filter(Boolean)
          .join(' · '),
        occurredAt: log.createdAt,
      })),
      ...profileEvents.map((event) => ({
        id: `prof-${event.id}`,
        category: 'Profile & Security' as const,
        action: event.action,
        actor: event.actorName,
        target: profileNameMap.get(event.userId) ?? event.userId,
        summary: event.summary,
        occurredAt: event.occurredAt,
      })),
    ].sort(
      (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)
    );

    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (auditCategory !== 'All' && row.category !== auditCategory) {
        return false;
      }
      if (!q) return true;
      return [row.category, row.action, row.actor, row.target, row.summary]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [
    announcementAuditLogs,
    approvalLogs,
    auditCategory,
    blockEvents,
    deletionAuditLogs,
    profileEvents,
    profileNameMap,
    query,
    roleChangeLogs,
    verificationLogs,
  ]);

  const filteredActivityRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activityLogs.filter((entry) => {
      if (activityCategory !== 'All' && entry.category !== activityCategory) {
        return false;
      }
      if (!q) return true;
      return [
        entry.action,
        entry.category,
        entry.actorName,
        entry.userName,
        entry.userEmail,
        entry.details,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [activityCategory, activityLogs, query]);

  const handleRefresh = async () => {
    if (!onRefreshData || refreshing) return;
    setRefreshing(true);
    try {
      const err = await onRefreshData();
      onNotify?.(err ?? 'Logs synchronized with Supabase.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportCsv = () => {
    if (view === 'audit') {
      const ok = downloadCsv(
        `baust-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
        ['Timestamp', 'Category', 'Action', 'Actor', 'Target User', 'Summary'],
        unifiedAuditRows.map((row) => [
          row.occurredAt,
          row.category,
          row.action,
          row.actor,
          row.target,
          row.summary,
        ])
      );
      onNotify?.(
        ok
          ? `Exported ${unifiedAuditRows.length} audit log records.`
          : 'Could not export CSV in this browser.'
      );
      return;
    }

    const ok = downloadCsv(
      `baust-activity-logs-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Timestamp', 'Category', 'Action', 'Actor', 'User', 'Details'],
      filteredActivityRows.map((row) => [
        row.createdAt,
        row.category,
        row.action,
        row.actorName,
        `${row.userName} (${row.userEmail})`,
        row.details,
      ])
    );
    onNotify?.(
      ok
        ? `Exported ${filteredActivityRows.length} activity log records.`
        : 'Could not export CSV in this browser.'
    );
  };

  return (
    <div className="space-y-5 pb-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {view === 'audit' ? (
              <FileSearch className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
            ) : (
              <History className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
            )}
            <h1 className="font-display text-xl font-bold text-emerald-950 dark:text-emerald-50">
              {view === 'audit' ? 'Governance & Security Audit Logs' : 'Platform Activity Logs'}
            </h1>
          </div>
          <p className="mt-1 text-xs text-emerald-900/60 dark:text-emerald-300/65">
            {view === 'audit'
              ? 'Immutable trail of user deletions, restorations, permanent purges, role overrides, approvals, and blocks.'
              : 'Chronological stream of authentication, profile updates, notifications, and workspace operations.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onRefreshData && (
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void handleRefresh()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-100"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-100"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </header>

      {view === 'audit' ? (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Deletion & Restore Logs"
              value={deletionAuditLogs.length.toLocaleString()}
              sublabel="Soft deletes, archives, restores & purges"
              icon={Trash2}
              tone="danger"
            />
            <StatCard
              label="Role Changes"
              value={roleChangeLogs.length.toLocaleString()}
              sublabel="Promotions, demotions & overrides"
              icon={UserCog}
            />
            <StatCard
              label="Approval Decisions"
              value={approvalLogs.length.toLocaleString()}
              sublabel="Approvals, rejections & recommendations"
              icon={ShieldCheck}
              tone="success"
            />
            <StatCard
              label="Total Audit Entries"
              value={unifiedAuditRows.length.toLocaleString()}
              sublabel="Filtered administrative trail"
              icon={Activity}
            />
          </section>

          <section className="overflow-hidden rounded-xl border border-emerald-200/70 bg-white dark:border-emerald-800/60 dark:bg-[#061D15]">
            <div className="flex flex-col gap-3 border-b border-emerald-100 p-4 dark:border-emerald-800/60 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    'All',
                    'Deletion & Restore',
                    'Announcement Trash',
                    'Role Change',
                    'Approval',
                    'Verification',
                    'Access Block',
                    'Profile & Security',
                  ] as const
                ).map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setAuditCategory(category)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                      auditCategory === category
                        ? 'bg-[#042419] text-white dark:bg-emerald-700'
                        : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <label className="relative block">
                <span className="sr-only">Search audit logs</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-800/45 dark:text-emerald-200/45" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search user, actor, action…"
                  className="h-9 w-full lg:w-64 rounded-lg border border-emerald-200 bg-white pl-8 pr-3 text-xs text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                />
              </label>
            </div>

            {unifiedAuditRows.length === 0 ? (
              <div className="px-6 py-14 text-center text-xs text-emerald-900/60 dark:text-emerald-300/65">
                No audit entries match the current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left">
                  <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
                    <tr>
                      <th className="px-4 py-3">Time (GMT+6)</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Actor</th>
                      <th className="px-4 py-3">Target User</th>
                      <th className="px-4 py-3">Audit Metadata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50">
                    {unifiedAuditRows.slice(0, 150).map((row) => (
                      <tr
                        key={row.id}
                        className="text-xs text-emerald-950 dark:text-emerald-50"
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] tabular-nums text-emerald-900/70 dark:text-emerald-300/70">
                          {formatDateTime(row.occurredAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-semibold">
                          {row.category}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px]">
                          {row.action}
                        </td>
                        <td className="px-4 py-3">{row.actor}</td>
                        <td className="px-4 py-3">{row.target}</td>
                        <td className="px-4 py-3 text-emerald-900/75 dark:text-emerald-200/75">
                          {row.summary}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="overflow-hidden rounded-xl border border-emerald-200/70 bg-white dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="flex flex-col gap-3 border-b border-emerald-100 p-4 dark:border-emerald-800/60 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {['All', 'auth', 'governance', 'security', 'profile', 'notifications'].map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActivityCategory(cat)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold capitalize transition-colors ${
                      activityCategory === cat
                        ? 'bg-[#042419] text-white dark:bg-emerald-700'
                        : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200'
                    }`}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>
            <label className="relative block">
              <span className="sr-only">Search activity logs</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-800/45 dark:text-emerald-200/45" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search actor, email, or details…"
                className="h-9 w-full lg:w-64 rounded-lg border border-emerald-200 bg-white pl-8 pr-3 text-xs text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              />
            </label>
          </div>

          {filteredActivityRows.length === 0 ? (
            <div className="px-6 py-14 text-center text-xs text-emerald-900/60 dark:text-emerald-300/65">
              No activity events match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50">
                  {filteredActivityRows.slice(0, 150).map((entry) => (
                    <tr
                      key={entry.id}
                      className="text-xs text-emerald-950 dark:text-emerald-50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] tabular-nums text-emerald-900/70 dark:text-emerald-300/70">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3 capitalize font-semibold">
                        {entry.category}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px]">
                        {entry.action}
                      </td>
                      <td className="px-4 py-3">{entry.actorName || 'System'}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{entry.userName}</span>
                        {entry.userEmail && (
                          <span className="block text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                            {entry.userEmail}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-emerald-900/75 dark:text-emerald-200/75">
                        {entry.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
