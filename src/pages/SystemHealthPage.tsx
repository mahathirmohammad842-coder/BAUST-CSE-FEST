import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  RefreshCw,
  Server,
  ShieldCheck,
  Wifi,
  XCircle,
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import {
  runSupabaseConnectivityCheck,
  type SupabaseDiagnosticsReport,
} from '../lib/supabase';
import type { ProfileAuditEvent, UserProfile, WorkspaceRole } from '../types';
import type { UserBlockAuditEvent } from '../utils/registrationStore';
import { downloadCsv } from '../utils/csvExport';

interface SystemHealthPageProps {
  activeRole: WorkspaceRole;
  profiles: UserProfile[];
  profileEvents: ProfileAuditEvent[];
  blockEvents: UserBlockAuditEvent[];
  onRefreshProfiles: () => Promise<string | null>;
  onNotify: (message: string) => void;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(date);
}

const ROLE_CAPABILITIES: {
  role: WorkspaceRole;
  scope: string;
  capabilities: string[];
}[] = [
  {
    role: 'Super Admin',
    scope: 'Full Platform Governance',
    capabilities: [
      'Promote active users to Admin',
      'Trash & restore rejected registrations',
      'Manage all profiles, blocks & suspensions',
      'Publish announcements & inspect diagnostics',
    ],
  },
  {
    role: 'Organizer',
    scope: 'Event Operations & Staff Control',
    capabilities: [
      'Approve / reject registrations',
      'Create, schedule & dispatch notices',
      'Manage attendee profiles & blocks',
      'Cannot modify or reset Super Admin',
    ],
  },
  {
    role: 'Admin',
    scope: 'Directory Verification',
    capabilities: [
      'View user profiles in directory',
      'Verify participant & guest profiles',
      'Access Attendee Inbox & personal profile',
    ],
  },
  {
    role: 'Participant',
    scope: 'Attendee Portal',
    capabilities: [
      'Receive multi-channel fest announcements',
      'Manage own profile & notification preferences',
    ],
  },
];

export function SystemHealthPage({
  activeRole,
  profiles,
  profileEvents,
  blockEvents,
  onRefreshProfiles,
  onNotify,
}: SystemHealthPageProps) {
  const [report, setReport] = useState<SupabaseDiagnosticsReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [refreshingDirectory, setRefreshingDirectory] = useState(false);
  const [auditFilter, setAuditFilter] = useState('');

  const runCheck = async () => {
    setChecking(true);
    try {
      const next = await runSupabaseConnectivityCheck();
      setReport(next);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void runCheck();
  }, []);

  const refreshDirectory = async () => {
    setRefreshingDirectory(true);
    try {
      const error = await onRefreshProfiles();
      if (error) {
        onNotify(error);
      } else {
        onNotify('Supabase directory synchronized.');
      }
    } finally {
      setRefreshingDirectory(false);
    }
  };

  const combinedAuditTrail = useMemo(() => {
    const profileNames = new Map(profiles.map((p) => [p.userId, p.fullName]));
    const items = [
      ...profileEvents.map((event) => ({
        id: event.id,
        category: 'Profile & Role',
        action: event.action,
        actor: event.actorName,
        target: profileNames.get(event.userId) ?? event.userId,
        summary: event.summary,
        occurredAt: event.occurredAt,
      })),
      ...blockEvents.map((event) => ({
        id: event.id,
        category: 'Access Block',
        action: event.action,
        actor: event.actorName,
        target: profileNames.get(event.userId) ?? event.userId,
        summary: `${event.reason}${event.note ? ` — ${event.note}` : ''}`,
        occurredAt: event.occurredAt,
      })),
    ].sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    );

    const needle = auditFilter.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      [item.category, item.action, item.actor, item.target, item.summary]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [auditFilter, blockEvents, profileEvents, profiles]);

  const okCount = report?.items.filter((i) => i.status === 'ok').length ?? 0;
  const warningCount =
    report?.items.filter((i) => i.status === 'warning').length ?? 0;
  const errorCount =
    report?.items.filter((i) => i.status === 'error').length ?? 0;

  const exportAuditCsv = () => {
    const ok = downloadCsv(
      `baust-audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Timestamp', 'Category', 'Action', 'Actor', 'Target User', 'Summary'],
      combinedAuditTrail.map((item) => [
        item.occurredAt,
        item.category,
        item.action,
        item.actor,
        item.target,
        item.summary,
      ])
    );
    onNotify(
      ok
        ? 'Audit trail exported to CSV.'
        : 'Could not export the audit log in this browser.'
    );
  };

  return (
    <div className="space-y-5 pb-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
            <h1 className="font-display text-xl font-bold text-emerald-950 dark:text-emerald-50">
              System &amp; Supabase Connectivity
            </h1>
          </div>
          <p className="mt-1 text-xs text-emerald-900/60 dark:text-emerald-300/65">
            Live database diagnostics, authentication policy status, RBAC governance, and enterprise audit logs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={refreshingDirectory}
            onClick={() => void refreshDirectory()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-100 dark:hover:bg-emerald-950/50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshingDirectory ? 'animate-spin' : ''}`}
            />
            Sync Directory
          </button>
          <button
            type="button"
            disabled={checking}
            onClick={() => void runCheck()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <Wifi className={`h-3.5 w-3.5 ${checking ? 'animate-pulse' : ''}`} />
            {checking ? 'Testing Supabase…' : 'Run Connectivity Check'}
          </button>
        </div>
      </header>

      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="System connectivity summary"
      >
        <StatCard
          label="Cloud Mode"
          value={report?.configured ? 'Supabase Live' : 'Local Demo'}
          sublabel={report?.projectUrl ?? 'No Supabase URL configured'}
          icon={Database}
          tone={report?.configured ? 'success' : 'amber'}
        />
        <StatCard
          label="Checks Passed"
          value={`${okCount}/${report?.items.length ?? 0}`}
          sublabel={
            report
              ? `Last checked ${formatDateTime(report.checkedAt)}`
              : 'Running checks…'
          }
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Warnings"
          value={warningCount.toString()}
          sublabel={
            report?.emailAutoConfirm === false
              ? 'Email confirmation ON (2/hr SMTP limit)'
              : 'Optional or policy notices'
          }
          icon={AlertTriangle}
          tone={warningCount > 0 ? 'amber' : 'success'}
        />
        <StatCard
          label="Active Role"
          value={activeRole}
          sublabel={`${profiles.length} total accounts in directory`}
          icon={ShieldCheck}
          tone={errorCount > 0 ? 'danger' : 'default'}
        />
      </section>

      {report?.emailAutoConfirm === false && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-xs leading-relaxed text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/35 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <div>
            <p className="font-semibold">
              Supabase Signup Email Confirmation is currently ON
            </p>
            <p className="mt-1 opacity-90">
              Because new accounts already require organizer/Super Admin approval in{' '}
              <strong>User Approvals</strong>, Supabase&apos;s built-in confirmation email
              hits the free 2 emails/hour rate limit during bursts. In your Supabase Dashboard
              under <strong>Authentication → Providers → Email</strong>, turn{' '}
              <strong>Confirm email OFF</strong> (or configure a Custom SMTP provider under{' '}
              <strong>Authentication → SMTP Settings</strong>) for uninterrupted registrations.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="overflow-hidden rounded-xl border border-emerald-200/70 bg-white dark:border-emerald-800/60 dark:bg-[#061D15] lg:col-span-7">
          <div className="flex items-center justify-between border-b border-emerald-100 px-4 py-3.5 dark:border-emerald-800/60">
            <div>
              <h2 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
                Supabase Service Probes
              </h2>
              <p className="mt-0.5 text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                Verifies Auth, Postgres RLS tables, Storage bucket, and Edge Functions.
              </p>
            </div>
            <span className="font-mono text-[11px] text-emerald-800/70 dark:text-emerald-300/70">
              {checking ? 'Probing…' : 'Live'}
            </span>
          </div>
          <ul className="divide-y divide-emerald-100 dark:divide-emerald-900/50">
            {(report?.items ?? []).map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 px-4 py-3.5 text-xs"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  {item.status === 'ok' ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : item.status === 'warning' ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-emerald-950 dark:text-emerald-50">
                      {item.label}
                    </p>
                    <p className="mt-0.5 leading-relaxed text-emerald-900/70 dark:text-emerald-200/70">
                      {item.detail}
                    </p>
                  </div>
                </div>
                {item.latencyMs !== null && (
                  <span className="shrink-0 rounded border border-emerald-200/80 bg-emerald-50/70 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-800 tabular-nums dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300">
                    {item.latencyMs} ms
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="overflow-hidden rounded-xl border border-emerald-200/70 bg-white dark:border-emerald-800/60 dark:bg-[#061D15] lg:col-span-5">
          <div className="border-b border-emerald-100 px-4 py-3.5 dark:border-emerald-800/60">
            <h2 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
              Enterprise Role Hierarchy (RBAC)
            </h2>
            <p className="mt-0.5 text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
              Server-enforced privileges in PostgreSQL RLS &amp; RPC functions.
            </p>
          </div>
          <div className="divide-y divide-emerald-100 dark:divide-emerald-900/50">
            {ROLE_CAPABILITIES.map((entry) => (
              <div key={entry.role} className="px-4 py-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-emerald-950 dark:text-emerald-50">
                    {entry.role}
                  </span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {entry.scope}
                  </span>
                </div>
                <ul className="mt-1.5 space-y-1 text-[11px] text-emerald-900/70 dark:text-emerald-200/70">
                  {entry.capabilities.map((cap) => (
                    <li key={cap}>• {cap}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-emerald-200/70 bg-white dark:border-emerald-800/60 dark:bg-[#061D15]">
        <div className="flex flex-col gap-3 border-b border-emerald-100 p-4 dark:border-emerald-800/60 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
            <div>
              <h2 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
                Governance &amp; Security Audit Log
              </h2>
              <p className="mt-0.5 text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                {combinedAuditTrail.length} recorded administrative events
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={auditFilter}
              onChange={(event) => setAuditFilter(event.target.value)}
              placeholder="Filter actor, user, or action…"
              className="min-h-9 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
            />
            <button
              type="button"
              onClick={exportAuditCsv}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-emerald-950/40"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {combinedAuditTrail.length === 0 ? (
          <div className="px-6 py-12 text-center text-xs text-emerald-900/60 dark:text-emerald-300/65">
            No administrative audit events recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left">
              <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
                <tr>
                  <th className="px-4 py-3">Time (GMT+6)</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50">
                {combinedAuditTrail.slice(0, 50).map((item) => (
                  <tr
                    key={item.id}
                    className="text-xs text-emerald-950 dark:text-emerald-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-emerald-900/70 dark:text-emerald-300/70">
                      {formatDateTime(item.occurredAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{item.actor}</td>
                    <td className="px-4 py-3 font-medium">{item.target}</td>
                    <td className="px-4 py-3 text-emerald-900/75 dark:text-emerald-200/75">
                      {item.summary}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
