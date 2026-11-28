import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Lock,
  Mail,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserRound,
} from 'lucide-react';
import { PUBLIC_EVENT_SCHEDULE } from '../data/mockData';
import type {
  ActivityLogEntry,
  Announcement,
  ApprovalLog,
  UserProfile,
} from '../types';
import { formatDhakaDateOnly, formatDhakaDateTime } from '../utils/formatters';
import type { PersonalNotificationState } from '../utils/notificationActions';
import { calculateProfileCompletion } from '../utils/profileStore';

interface PendingApprovalDashboardProps {
  profile: UserProfile;
  announcements: Announcement[];
  notificationStates: Record<string, PersonalNotificationState>;
  approvalLogs: ApprovalLog[];
  activityLogs: ActivityLogEntry[];
  onNavigate: (route: 'inbox' | 'profile' | 'settings') => void;
  onOpenNotification?: (announcementId: string) => void;
}

function formatShortDateTime(value?: string | null) {
  if (!value) return 'Not recorded yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(parsed);
}

export function PendingApprovalDashboard({
  profile,
  announcements,
  notificationStates,
  approvalLogs,
  activityLogs,
  onNavigate,
  onOpenNotification,
}: PendingApprovalDashboardProps) {
  const isPending = (profile.approvalStatus ?? 'Pending') === 'Pending';
  const requestedRole = profile.requestedRole ?? 'Participant';
  const assignedRole = profile.assignedRole ?? profile.role;
  const verificationStatus =
    profile.verificationStatus ?? (profile.verified ? 'Verified' : 'Pending');

  const completion = calculateProfileCompletion(profile).percentage;

  // Pending users strictly only see Delivered public ('everyoneAttending') or 'Participant' notices
  const visibleNotices = announcements
    .filter((a) => {
      if (a.trashedAt || a.status !== 'Delivered') return false;
      if (isPending) {
        return (
          a.targeting.everyoneAttending ||
          a.targeting.roles.includes('Participant')
        );
      }
      return (
        a.targeting.everyoneAttending || a.targeting.roles.includes(assignedRole)
      );
    })
    .sort((a, b) =>
      (b.publishedAt || b.createdAt).localeCompare(a.publishedAt || a.createdAt)
    );

  const unreadCount = visibleNotices.filter(
    (a) => !(notificationStates[a.id]?.read ?? false)
  ).length;

  const recentNotices = visibleNotices.slice(0, 4);
  const userApprovalLogs = approvalLogs
    .filter((l) => l.userId === profile.userId)
    .slice(0, 4);
  const userActivityLogs = activityLogs
    .filter((l) => l.userId === profile.userId)
    .slice(0, 4);

  const completionSteps = [
    { label: 'Phone', ok: Boolean(profile.phone?.trim()) },
    { label: 'Department', ok: Boolean(profile.department?.trim()) },
    { label: 'Institution', ok: Boolean(profile.institution?.trim()) },
    { label: 'Address', ok: Boolean(profile.address?.trim()) },
    { label: 'Bio', ok: Boolean(profile.biography?.trim()) },
    { label: 'Photo', ok: Boolean(profile.photoDataUrl?.trim()) },
    {
      label: 'Personal Info',
      ok: Boolean(
        profile.personalInfo?.studentId?.trim() ||
          profile.personalInfo?.batch?.trim() ||
          profile.personalInfo?.emergencyContact?.trim()
      ),
    },
    {
      label: 'Social Links',
      ok: Boolean(
        profile.socialLinks?.website?.trim() ||
          profile.socialLinks?.linkedIn?.trim() ||
          profile.socialLinks?.github?.trim()
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
            BAUST CSE Fest · Member Portal
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-emerald-50 sm:text-3xl">
            Welcome, {profile.fullName}
          </h1>
          <p className="mt-1 text-xs text-slate-600 dark:text-emerald-200/70">
            Manage your profile, follow public event updates, and track your role approval progress.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#064E3B] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#053D2E] dark:bg-emerald-400 dark:text-[#022017] dark:hover:bg-emerald-300"
          >
            <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
            Edit Profile ({completion}%)
          </button>
          <button
            type="button"
            onClick={() => onNavigate('inbox')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-900 transition-colors hover:bg-emerald-50 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-100 dark:hover:bg-emerald-950/60"
          >
            <Bell className="h-3.5 w-3.5" aria-hidden="true" />
            Notifications ({unreadCount} unread)
          </button>
        </div>
      </header>

      {/* Primary Status Card */}
      <section
        aria-label="Account review status"
        className={`rounded-2xl border p-5 sm:p-6 ${
          isPending
            ? 'border-amber-200/90 bg-amber-50/75 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100'
            : 'border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-50'
        }`}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3.5">
            <span
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                isPending
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-300'
              }`}
            >
              {isPending ? (
                <Clock3 className="h-5 w-5" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.12em]">
                <span>
                  {isPending
                    ? 'Account Under Review · Basic Access Active'
                    : 'Account Approved · Full Role Active'}
                </span>
              </div>
              <p className="text-sm leading-relaxed">
                {isPending
                  ? 'Your account is currently under review. You can continue using basic platform features while waiting for Organizer or Super Admin approval.'
                  : `Your account is approved with the ${assignedRole} role. All assigned event features and notifications are active.`}
              </p>
              <p className="text-xs opacity-80">
                Requested Role: <strong>{requestedRole}</strong> · Assigned Role:{' '}
                <strong>{assignedRole}</strong> · Verification:{' '}
                <strong>{verificationStatus}</strong> · Account:{' '}
                <strong>{profile.accountStatus}</strong>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-current/20 bg-white/80 px-3 py-2 text-xs font-semibold transition-colors hover:bg-white dark:bg-[#041811]/80 dark:hover:bg-[#041811]"
            >
              Complete Profile
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* 4 KPI Cards */}
      <section
        aria-label="Account status summary"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <article className="rounded-xl border border-emerald-200/70 bg-white p-4 dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-900/65 dark:text-emerald-300/70">
            <span>Approval Status</span>
            <Clock3 className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-slate-950 dark:text-emerald-50">
            {profile.approvalStatus ?? 'Pending'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-emerald-300/65">
            Account status: {profile.accountStatus}
          </p>
        </article>

        <article className="rounded-xl border border-emerald-200/70 bg-white p-4 dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-900/65 dark:text-emerald-300/70">
            <span>Verification Status</span>
            <UserCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-slate-950 dark:text-emerald-50">
            {verificationStatus}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-emerald-300/65">
            Reviewed by Fest Staff
          </p>
        </article>

        <article className="rounded-xl border border-emerald-200/70 bg-white p-4 dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-900/65 dark:text-emerald-300/70">
            <span>Role Request</span>
            <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-slate-950 dark:text-emerald-50">
            {assignedRole}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-emerald-300/65">
            Requested: {requestedRole}
          </p>
        </article>

        <article className="rounded-xl border border-emerald-200/70 bg-white p-4 dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-900/65 dark:text-emerald-300/70">
            <span>Profile Completion</span>
            <Sparkles className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-950 dark:text-emerald-50">
            {completion}%
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-emerald-950">
            <div
              className="h-full rounded-full bg-emerald-600 transition-[width] duration-300 dark:bg-emerald-400"
              style={{ width: `${completion}%` }}
            />
          </div>
        </article>
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Recent Public Notifications & Announcements */}
        <section className="overflow-hidden rounded-xl border border-emerald-200/70 bg-white dark:border-emerald-800/60 dark:bg-[#061D15] lg:col-span-7">
          <div className="flex items-center justify-between border-b border-emerald-100 px-5 py-4 dark:border-emerald-800/60">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-950 dark:text-emerald-50">
                Recent Public Notifications &amp; Announcements
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-emerald-300/65">
                {visibleNotices.length} public announcement{visibleNotices.length === 1 ? '' : 's'} available
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inbox')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-300"
            >
              Open Inbox
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {recentNotices.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-slate-500 dark:text-emerald-300/65">
              No public announcements published yet. Check back soon for BAUST CSE Fest updates.
            </div>
          ) : (
            <ul className="divide-y divide-emerald-100 dark:divide-emerald-900/50">
              {recentNotices.map((notice) => {
                const isRead = notificationStates[notice.id]?.read ?? false;
                return (
                  <li key={notice.id}>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenNotification
                          ? onOpenNotification(notice.id)
                          : onNavigate('inbox')
                      }
                      className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-emerald-50/40 dark:hover:bg-[#09291E]/50"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-emerald-300/65">
                          <span>{notice.type}</span>
                          <span>·</span>
                          <span>{notice.priority}</span>
                          <span>·</span>
                          <span className="tabular-nums">
                            {formatDhakaDateTime(notice.publishedAt || notice.createdAt)}
                          </span>
                        </div>
                        <p
                          className={`text-sm ${
                            isRead
                              ? 'font-medium text-slate-800 dark:text-emerald-100'
                              : 'font-bold text-slate-950 dark:text-white'
                          }`}
                        >
                          {notice.title}
                        </p>
                        <p className="line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-emerald-200/75">
                          {notice.body}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[11px] font-semibold ${
                          isRead
                            ? 'text-slate-400 dark:text-emerald-300/50'
                            : 'text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {isRead ? 'Read' : 'Unread'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Account Summary, Timeline & Feature Access */}
        <div className="space-y-6 lg:col-span-5">
          {/* Account Information */}
          <section className="rounded-xl border border-emerald-200/70 bg-white p-5 dark:border-emerald-800/60 dark:bg-[#061D15]">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-slate-950 dark:text-emerald-50">
                Account Information
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className="text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-300"
              >
                Update Details
              </button>
            </div>
            <dl className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 dark:border-emerald-900/50">
                <dt className="text-slate-500 dark:text-emerald-300/65">Email</dt>
                <dd className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-emerald-50">
                  <Mail className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                  <span className="truncate">{profile.email}</span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 dark:border-emerald-900/50">
                <dt className="text-slate-500 dark:text-emerald-300/65">Institution / Dept</dt>
                <dd className="font-medium text-slate-900 dark:text-emerald-50">
                  {[profile.department, profile.institution].filter(Boolean).join(' · ') || 'Not specified'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 dark:border-emerald-900/50">
                <dt className="text-slate-500 dark:text-emerald-300/65">Registered</dt>
                <dd className="font-mono text-[11px] tabular-nums text-slate-800 dark:text-emerald-100">
                  {formatDhakaDateOnly(profile.createdAt)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-emerald-300/65">Last Login</dt>
                <dd className="font-mono text-[11px] tabular-nums text-slate-800 dark:text-emerald-100">
                  {formatShortDateTime(profile.lastLoginAt)}
                </dd>
              </div>
            </dl>

            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-emerald-900/50">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-emerald-300/65">
                Profile Checklist ({completion}%)
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                {completionSteps.map((step) => (
                  <div
                    key={step.label}
                    className={`flex items-center gap-1.5 ${
                      step.ok
                        ? 'font-medium text-emerald-700 dark:text-emerald-300'
                        : 'text-slate-500 dark:text-emerald-300/55'
                    }`}
                  >
                    <CheckCircle2
                      className={`h-3.5 w-3.5 shrink-0 ${
                        step.ok ? 'opacity-100' : 'opacity-30'
                      }`}
                      aria-hidden="true"
                    />
                    <span>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Approval Timeline & Restricted Notice */}
          <section className="rounded-xl border border-emerald-200/70 bg-white p-5 dark:border-emerald-800/60 dark:bg-[#061D15]">
            <h2 className="font-display text-sm font-bold text-slate-950 dark:text-emerald-50">
              Approval Timeline &amp; Access Scope
            </h2>
            <ol className="mt-4 space-y-3 text-xs">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-emerald-50">
                    1. Account Created &amp; Active
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-emerald-300/65">
                    Assigned Role: Participant · Requested: {requestedRole}
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock3
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    verificationStatus === 'Verified'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-emerald-50">
                    2. Staff Information Verification ({verificationStatus})
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-emerald-300/65">
                    Organizers and Super Admins verify your profile &amp; department details.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                {isPending ? (
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-emerald-300/50" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                )}
                <div>
                  <p className="font-semibold text-slate-900 dark:text-emerald-50">
                    3. Role Approval ({profile.approvalStatus ?? 'Pending'})
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-emerald-300/65">
                    Privileged organizer, judge, and event management controls activate after approval.
                  </p>
                </div>
              </li>
            </ol>

            {(userApprovalLogs.length > 0 || userActivityLogs.length > 0) && (
              <div className="mt-4 border-t border-slate-100 pt-3 dark:border-emerald-900/50">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-emerald-300/65">
                  Recent Audit &amp; Activity Updates
                </p>
                <ul className="mt-2 space-y-1.5 text-[11px] text-slate-600 dark:text-emerald-200/75">
                  {userApprovalLogs.map((log) => (
                    <li key={log.id} className="flex justify-between gap-2">
                      <span>
                        {log.action.replace(/_/g, ' ')}: {log.newStatus} ({log.assignedRole})
                      </span>
                      <span className="shrink-0 font-mono opacity-75">
                        {formatDhakaDateOnly(log.createdAt)}
                      </span>
                    </li>
                  ))}
                  {userActivityLogs.map((log) => (
                    <li key={log.id} className="flex justify-between gap-2">
                      <span>{log.details || log.action.replace(/_/g, ' ')}</span>
                      <span className="shrink-0 font-mono opacity-75">
                        {formatDhakaDateOnly(log.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Public Event Information & Schedule */}
      <section className="overflow-hidden rounded-xl border border-emerald-200/70 bg-white dark:border-emerald-800/60 dark:bg-[#061D15]">
        <div className="flex flex-col gap-2 border-b border-emerald-100 px-5 py-4 dark:border-emerald-800/60 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
            <div>
              <h2 className="font-display text-sm font-bold text-slate-950 dark:text-emerald-50">
                Public Event Information &amp; Schedule
              </h2>
              <p className="text-xs text-slate-500 dark:text-emerald-300/65">
                BAUST CSE Fest 2026 · Saidpur Campus · All times in Asia/Dhaka (GMT+6)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-300"
          >
            Notification Settings
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
              <tr>
                <th className="px-5 py-3">Time Window (GMT+6)</th>
                <th className="px-5 py-3">Segment</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Venue</th>
                <th className="px-5 py-3">Audience</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-100 text-xs dark:divide-emerald-900/50">
              {PUBLIC_EVENT_SCHEDULE.map((item) => (
                <tr
                  key={item.id}
                  className="text-slate-800 hover:bg-emerald-50/30 dark:text-emerald-100 dark:hover:bg-[#09291E]/50"
                >
                  <td className="whitespace-nowrap px-5 py-3.5 font-mono text-[11px] tabular-nums text-emerald-900/75 dark:text-emerald-300/80">
                    {item.timeWindow}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-slate-950 dark:text-white">
                    {item.session}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 dark:text-emerald-200/80">
                    {item.category}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-emerald-100">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                      {item.venue}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 dark:text-emerald-200/75">
                    {item.audience}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
