import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  BellOff,
  Building2,
  Eye,
  Mail,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UserX,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { StatCard } from '../components/StatCard';
import { RejectedTrashPage } from './RejectedTrashPage';
import type {
  Announcement,
  RegistrationRequest,
  UserProfile,
  WorkspaceRole,
} from '../types';
import { formatDhakaDateTime } from '../utils/formatters';

export type RecycleBinTab =
  | 'notifications'
  | 'rejected'
  | 'deleted'
  | 'archived';

interface RecycleBinPageProps {
  initialTab?: RecycleBinTab;
  activeRole: WorkspaceRole;
  announcements: Announcement[];
  requests: RegistrationRequest[];
  deletedProfiles: UserProfile[];
  archivedProfiles: UserProfile[];
  onInspectAnnouncement: (id: string) => void;
  onRestoreAnnouncement: (id: string) => void;
  onPermanentDeleteAnnouncement: (id: string) => void;
  onEmptyAnnouncementTrash: () => void;
  onTrashRejectedUser: (userId: string) => Promise<string | null>;
  onRestoreTrashedRejectedUser: (userId: string) => Promise<string | null>;
  onBulkTrashRejectedUsers?: (userIds: string[]) => Promise<string | null>;
  onBulkRestoreTrashedRejectedUsers?: (
    userIds: string[]
  ) => Promise<string | null>;
  onReapproveRejectedUser?: (userId: string) => Promise<void> | void;
  onRestoreLifecycleUser: (
    userId: string,
    notes?: string
  ) => Promise<string | null>;
  onPermanentDeleteUser: (
    userId: string,
    notes?: string
  ) => Promise<string | null>;
  onMoveArchivedToDeleted?: (
    userId: string,
    notes?: string
  ) => Promise<string | null>;
  onRefreshProfiles?: () => Promise<string | null>;
  onNotify?: (message: string) => void;
}

function formatDhaka(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(parsed);
}

export function RecycleBinPage({
  initialTab = 'deleted',
  activeRole,
  announcements,
  requests,
  deletedProfiles,
  archivedProfiles,
  onInspectAnnouncement,
  onRestoreAnnouncement,
  onPermanentDeleteAnnouncement,
  onEmptyAnnouncementTrash,
  onTrashRejectedUser,
  onRestoreTrashedRejectedUser,
  onBulkTrashRejectedUsers,
  onBulkRestoreTrashedRejectedUsers,
  onReapproveRejectedUser,
  onRestoreLifecycleUser,
  onPermanentDeleteUser,
  onMoveArchivedToDeleted,
  onRefreshProfiles,
  onNotify,
}: RecycleBinPageProps) {
  const [activeTab, setActiveTab] = useState<RecycleBinTab>(initialTab);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [detailProfile, setDetailProfile] = useState<UserProfile | null>(null);
  const [permanentTarget, setPermanentTarget] = useState<UserProfile | null>(
    null
  );
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [confirmEmailInput, setConfirmEmailInput] = useState('');
  const [deleteReasonNote, setDeleteReasonNote] = useState('');
  const [noticePermanentTarget, setNoticePermanentTarget] =
    useState<Announcement | null>(null);
  const [emptyNoticeTrashOpen, setEmptyNoticeTrashOpen] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const isSuperAdmin = activeRole === 'Super Admin';

  const trashedNotices = useMemo(
    () => announcements.filter((item) => Boolean(item.trashedAt)),
    [announcements]
  );

  const trashedRejectedCount = useMemo(
    () => requests.filter((item) => Boolean(item.trashedAt)).length,
    [requests]
  );

  const filteredNotices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trashedNotices;
    return trashedNotices.filter((item) =>
      [item.title, item.summary, item.category, item.senderName]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [query, trashedNotices]);

  const filteredDeletedProfiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...deletedProfiles].sort(
      (a, b) =>
        Date.parse(b.deletedAt ?? b.createdAt) -
        Date.parse(a.deletedAt ?? a.createdAt)
    );
    if (!q) return sorted;
    return sorted.filter((p) =>
      [p.fullName, p.email, p.phone, p.role, p.deletedByName ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [deletedProfiles, query]);

  const filteredArchivedProfiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...archivedProfiles].sort(
      (a, b) =>
        Date.parse(b.archivedAt ?? b.createdAt) -
        Date.parse(a.archivedAt ?? a.createdAt)
    );
    if (!q) return sorted;
    return sorted.filter((p) =>
      [p.fullName, p.email, p.phone, p.role, p.archivedByName ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [archivedProfiles, query]);

  const handleRefresh = async () => {
    if (!onRefreshProfiles || refreshing) return;
    setRefreshing(true);
    try {
      const err = await onRefreshProfiles();
      onNotify?.(err ?? 'Recycle Bin records synchronized.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleRestoreUser = async (profile: UserProfile) => {
    if (!isSuperAdmin) {
      onNotify?.('Only a Super Admin can restore deleted or archived users.');
      return;
    }
    setBusyId(profile.userId);
    try {
      const err = await onRestoreLifecycleUser(
        profile.userId,
        `Restored from Recycle Bin (${profile.accountStatus})`
      );
      if (err) {
        onNotify?.(err);
      } else if (detailProfile?.userId === profile.userId) {
        setDetailProfile(null);
      }
    } finally {
      setBusyId(null);
    }
  };

  const openPermanentDeleteModal = (profile: UserProfile) => {
    setPermanentTarget(profile);
    setConfirmChecked(false);
    setConfirmEmailInput('');
    setDeleteReasonNote('');
  };

  const handleConfirmPermanentDelete = async () => {
    if (!permanentTarget || !isSuperAdmin) return;
    const expected = permanentTarget.email.trim().toLowerCase();
    if (!confirmChecked || confirmEmailInput.trim().toLowerCase() !== expected) {
      return;
    }
    setBusyId(permanentTarget.userId);
    try {
      const err = await onPermanentDeleteUser(
        permanentTarget.userId,
        deleteReasonNote.trim()
      );
      if (err) {
        onNotify?.(err);
        return;
      }
      if (detailProfile?.userId === permanentTarget.userId) {
        setDetailProfile(null);
      }
      setPermanentTarget(null);
      setConfirmChecked(false);
      setConfirmEmailInput('');
      setDeleteReasonNote('');
    } finally {
      setBusyId(null);
    }
  };

  const totalItems =
    trashedNotices.length +
    trashedRejectedCount +
    deletedProfiles.length +
    archivedProfiles.length;

  return (
    <div className="space-y-5 pb-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-700 dark:text-red-400" />
            <h1 className="font-display text-xl font-bold text-emerald-950 dark:text-emerald-50">
              Recycle Bin
            </h1>
            <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-200 tabular-nums">
              {totalItems} total items
            </span>
          </div>
          <p className="mt-1 text-xs text-emerald-900/60 dark:text-emerald-300/65">
            Centralized recovery vault for trashed notifications, rejected registrations, soft-deleted accounts, and archived users.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onRefreshProfiles && (
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void handleRefresh()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-100 dark:hover:bg-emerald-950/50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
              />
              Sync Vault
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            {isSuperAdmin ? 'Full Restore & Purge Access' : 'Organizer Read / Soft-Delete View'}
          </span>
        </div>
      </header>

      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Recycle bin summary"
      >
        <StatCard
          label="Deleted Users"
          value={deletedProfiles.length.toLocaleString()}
          sublabel="Soft-deleted awaiting restore or purge"
          icon={UserX}
          tone="danger"
        />
        <StatCard
          label="Archived Users"
          value={archivedProfiles.length.toLocaleString()}
          sublabel="Inactive archived accounts"
          icon={Archive}
          tone="amber"
        />
        <StatCard
          label="Rejected Trash"
          value={trashedRejectedCount.toLocaleString()}
          sublabel="Isolated rejected registrations"
          icon={Trash2}
        />
        <StatCard
          label="Trashed Notices"
          value={trashedNotices.length.toLocaleString()}
          sublabel="Announcements in notice trash"
          icon={BellOff}
        />
      </section>

      {/* Unified Tabs */}
      <div
        role="tablist"
        aria-label="Recycle Bin categories"
        className="flex flex-wrap gap-1.5 rounded-xl border border-emerald-200/70 bg-white p-1.5 dark:border-emerald-800/60 dark:bg-[#061D15]"
      >
        {[
          {
            id: 'notifications' as const,
            label: 'Notifications',
            count: trashedNotices.length,
          },
          {
            id: 'rejected' as const,
            label: 'Rejected Applications',
            count: trashedRejectedCount,
          },
          {
            id: 'deleted' as const,
            label: 'Deleted Items',
            count: deletedProfiles.length,
          },
          {
            id: 'archived' as const,
            label: 'Archived Items',
            count: archivedProfiles.length,
          },
        ].map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setActiveTab(tab.id);
                setQuery('');
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap tabular-nums ${
                selected
                  ? 'bg-[#042419] text-white dark:bg-emerald-700'
                  : 'text-emerald-900/75 hover:bg-emerald-50 hover:text-emerald-950 dark:text-emerald-200/75 dark:hover:bg-emerald-950/50 dark:hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                  selected
                    ? 'bg-emerald-800/80 text-emerald-100'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Notifications Trash */}
      {activeTab === 'notifications' && (
        <section className="overflow-hidden rounded-xl border border-emerald-200/70 bg-white dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="flex flex-col gap-3 border-b border-emerald-100 p-4 dark:border-emerald-800/60 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
                Trashed Notifications &amp; Announcements
              </h2>
              <p className="mt-0.5 text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                {filteredNotices.length} of {trashedNotices.length} notice
                {trashedNotices.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative block">
                <span className="sr-only">Search trashed notifications</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-800/45 dark:text-emerald-200/45" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search trashed notices…"
                  className="h-9 rounded-lg border border-emerald-200 bg-white pl-8 pr-3 text-xs text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                />
              </label>
              {trashedNotices.length > 0 && (
                <button
                  type="button"
                  onClick={() => setEmptyNoticeTrashOpen(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Empty Notice Trash
                </button>
              )}
            </div>
          </div>

          {filteredNotices.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <BellOff className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-emerald-950 dark:text-emerald-50">
                No trashed notifications
              </h3>
              <p className="mt-1 text-xs text-emerald-900/60 dark:text-emerald-300/65">
                Deleted announcements appear here for restoration or permanent removal.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left">
                <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
                  <tr>
                    <th className="px-4 py-3">Announcement</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Sender</th>
                    <th className="px-4 py-3">Trashed At</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50">
                  {filteredNotices.map((notice) => (
                    <tr
                      key={notice.id}
                      className="text-xs text-emerald-950 dark:text-emerald-50"
                    >
                      <td className="px-4 py-3.5">
                        <p className="font-semibold">{notice.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                          {notice.summary}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">{notice.category}</td>
                      <td className="px-4 py-3.5">{notice.senderName}</td>
                      <td className="px-4 py-3.5 tabular-nums text-emerald-900/70 dark:text-emerald-300/70">
                        {formatDhakaDateTime(notice.trashedAt ?? notice.updatedAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onInspectAnnouncement(notice.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Inspect
                          </button>
                          <button
                            type="button"
                            onClick={() => onRestoreAnnouncement(notice.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-600"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Restore
                          </button>
                          <button
                            type="button"
                            onClick={() => setNoticePermanentTarget(notice)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 font-semibold text-red-700 hover:bg-red-50 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-950/40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete Forever
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab 2: Rejected Applications */}
      {activeTab === 'rejected' &&
        (isSuperAdmin ? (
          <RejectedTrashPage
            requests={requests}
            onTrashRejectedUser={onTrashRejectedUser}
            onRestoreTrashedUser={onRestoreTrashedRejectedUser}
            onBulkTrashRejectedUsers={onBulkTrashRejectedUsers}
            onBulkRestoreTrashedUsers={onBulkRestoreTrashedRejectedUsers}
            onReapproveRejectedUser={onReapproveRejectedUser}
            onRefreshProfiles={onRefreshProfiles}
            onNotify={onNotify}
          />
        ) : (
          <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-6 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <h2 className="font-display text-sm font-bold">
                  Super Admin Governance Required
                </h2>
                <p className="mt-1 leading-relaxed">
                  Rejected applications trash isolation and restoration are restricted strictly to Super Admins. Contact a Super Admin to restore or purge declined applicant records.
                </p>
              </div>
            </div>
          </section>
        ))}

      {/* Tab 3: Deleted Items (Soft-Deleted Users) */}
      {activeTab === 'deleted' && (
        <section className="overflow-hidden rounded-xl border border-emerald-200/70 bg-white dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="flex flex-col gap-3 border-b border-emerald-100 p-4 dark:border-emerald-800/60 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
                Soft-Deleted Users (Recycle Bin → Users)
              </h2>
              <p className="mt-0.5 text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                {isSuperAdmin
                  ? 'Restore soft-deleted users back to active status or permanently delete their account and authentication record.'
                  : 'Only Super Admins can restore or permanently delete soft-deleted user accounts.'}
              </p>
            </div>
            <label className="relative block">
              <span className="sr-only">Search deleted users</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-800/45 dark:text-emerald-200/45" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search deleted users…"
                className="h-9 w-full sm:w-64 rounded-lg border border-emerald-200 bg-white pl-8 pr-3 text-xs text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              />
            </label>
          </div>

          {filteredDeletedProfiles.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <UserX className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-emerald-950 dark:text-emerald-50">
                No soft-deleted users
              </h3>
              <p className="mt-1 text-xs text-emerald-900/60 dark:text-emerald-300/65">
                Soft-deleted accounts are retained here with full audit history until restored or permanently deleted.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left">
                <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
                  <tr>
                    <th className="px-4 py-3">Deleted User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Deleted By</th>
                    <th className="px-4 py-3">Deletion Time</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50">
                  {filteredDeletedProfiles.map((profile) => {
                    const rowBusy = busyId === profile.userId;
                    return (
                      <tr
                        key={profile.userId}
                        className="text-xs text-emerald-950 dark:text-emerald-50"
                      >
                        <td className="px-4 py-3.5">
                          <p className="font-semibold">{profile.fullName}</p>
                          <p className="mt-0.5 text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                            {profile.email}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">{profile.role}</td>
                        <td className="px-4 py-3.5">
                          {profile.deletedByName || 'Administrator'}
                        </td>
                        <td className="px-4 py-3.5 tabular-nums text-emerald-900/70 dark:text-emerald-300/70">
                          {formatDhaka(profile.deletedAt)}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex justify-end gap-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setDetailProfile(profile)}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </button>
                            {isSuperAdmin && (
                              <>
                                <button
                                  type="button"
                                  disabled={rowBusy}
                                  onClick={() => void handleRestoreUser(profile)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Restore User
                                </button>
                                <button
                                  type="button"
                                  disabled={rowBusy}
                                  onClick={() =>
                                    openPermanentDeleteModal(profile)
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-950/40"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Permanently Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab 4: Archived Items */}
      {activeTab === 'archived' && (
        <section className="overflow-hidden rounded-xl border border-emerald-200/70 bg-white dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="flex flex-col gap-3 border-b border-emerald-100 p-4 dark:border-emerald-800/60 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
                Archived User Accounts
              </h2>
              <p className="mt-0.5 text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                {filteredArchivedProfiles.length} archived account
                {filteredArchivedProfiles.length === 1 ? '' : 's'}
              </p>
            </div>
            <label className="relative block">
              <span className="sr-only">Search archived users</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-800/45 dark:text-emerald-200/45" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search archived users…"
                className="h-9 w-full sm:w-64 rounded-lg border border-emerald-200 bg-white pl-8 pr-3 text-xs text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              />
            </label>
          </div>

          {filteredArchivedProfiles.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Archive className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-emerald-950 dark:text-emerald-50">
                No archived users
              </h3>
              <p className="mt-1 text-xs text-emerald-900/60 dark:text-emerald-300/65">
                Archived user accounts are removed from active rosters while keeping historical records intact.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left">
                <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
                  <tr>
                    <th className="px-4 py-3">Archived User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Archived By</th>
                    <th className="px-4 py-3">Archived Time</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50">
                  {filteredArchivedProfiles.map((profile) => {
                    const rowBusy = busyId === profile.userId;
                    const organizerCanSoftDelete =
                      isSuperAdmin || profile.role !== 'Organizer';
                    return (
                      <tr
                        key={profile.userId}
                        className="text-xs text-emerald-950 dark:text-emerald-50"
                      >
                        <td className="px-4 py-3.5">
                          <p className="font-semibold">{profile.fullName}</p>
                          <p className="mt-0.5 text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                            {profile.email}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">{profile.role}</td>
                        <td className="px-4 py-3.5">
                          {profile.archivedByName || 'Administrator'}
                        </td>
                        <td className="px-4 py-3.5 tabular-nums text-emerald-900/70 dark:text-emerald-300/70">
                          {formatDhaka(profile.archivedAt)}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex justify-end gap-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setDetailProfile(profile)}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </button>
                            {isSuperAdmin && (
                              <button
                                type="button"
                                disabled={rowBusy}
                                onClick={() => void handleRestoreUser(profile)}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Restore User
                              </button>
                            )}
                            {onMoveArchivedToDeleted &&
                              organizerCanSoftDelete && (
                                <button
                                  type="button"
                                  disabled={rowBusy}
                                  onClick={() => {
                                    setBusyId(profile.userId);
                                    void onMoveArchivedToDeleted(
                                      profile.userId,
                                      'Moved from Archived Items to Deleted Items'
                                    ).finally(() => setBusyId(null));
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-950/40"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Soft Delete
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* User Detail Modal */}
      <Modal
        open={detailProfile !== null}
        onClose={() => setDetailProfile(null)}
        title="Account Lifecycle Record"
        subtitle={
          detailProfile?.isDeleted
            ? 'Soft-deleted account in Recycle Bin'
            : 'Archived account in Recycle Bin'
        }
        footer={
          detailProfile && isSuperAdmin ? (
            <>
              <button
                type="button"
                disabled={busyId === detailProfile.userId}
                onClick={() => void handleRestoreUser(detailProfile)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore User
              </button>
              {detailProfile.isDeleted && (
                <button
                  type="button"
                  disabled={busyId === detailProfile.userId}
                  onClick={() => openPermanentDeleteModal(detailProfile)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Permanently Delete
                </button>
              )}
            </>
          ) : undefined
        }
      >
        {detailProfile && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/40">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                <UserRound className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-emerald-950 dark:text-emerald-50">
                  {detailProfile.fullName}
                </p>
                <p className="mt-0.5 text-xs text-emerald-900/65 dark:text-emerald-200/70">
                  {detailProfile.role} · {detailProfile.accountStatus}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-100 p-3 dark:border-emerald-800/60">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-200/60">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </div>
                <p className="mt-1.5 break-words text-xs font-medium text-emerald-950 dark:text-emerald-50">
                  {detailProfile.email}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-100 p-3 dark:border-emerald-800/60">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-200/60">
                  <Phone className="h-3.5 w-3.5" />
                  Mobile
                </div>
                <p className="mt-1.5 font-mono text-xs font-medium text-emerald-950 dark:text-emerald-50">
                  {detailProfile.phone || '—'}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-100 p-3 dark:border-emerald-800/60">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-200/60">
                  <Building2 className="h-3.5 w-3.5" />
                  Department / Institution
                </div>
                <p className="mt-1.5 text-xs font-medium text-emerald-950 dark:text-emerald-50">
                  {[detailProfile.department, detailProfile.institution]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-100 p-3 dark:border-emerald-800/60">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-200/60">
                  {detailProfile.isDeleted ? 'Deleted By / Time' : 'Archived By / Time'}
                </div>
                <p className="mt-1.5 text-xs font-medium text-emerald-950 dark:text-emerald-50">
                  {detailProfile.isDeleted
                    ? `${detailProfile.deletedByName || 'Admin'} · ${formatDhaka(detailProfile.deletedAt)}`
                    : `${detailProfile.archivedByName || 'Admin'} · ${formatDhaka(detailProfile.archivedAt)}`}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Permanent Hard-Delete Two-Step Confirmation Modal (Super Admin Only) */}
      <Modal
        open={permanentTarget !== null}
        onClose={() => setPermanentTarget(null)}
        title="Permanently delete user?"
        subtitle={
          permanentTarget
            ? `${permanentTarget.fullName} (${permanentTarget.email})`
            : undefined
        }
        dangerHeader
        maxWidthClass="max-w-lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPermanentTarget(null)}
              className="rounded-lg border border-emerald-200 px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-emerald-950/50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                !permanentTarget ||
                !confirmChecked ||
                confirmEmailInput.trim().toLowerCase() !==
                  permanentTarget.email.trim().toLowerCase() ||
                busyId === permanentTarget.userId
              }
              onClick={() => void handleConfirmPermanentDelete()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {busyId === permanentTarget?.userId
                ? 'Deleting Permanently…'
                : 'Confirm Permanent Delete'}
            </button>
          </>
        }
      >
        {permanentTarget && (
          <div className="space-y-4 text-xs">
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-red-900 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <p className="font-medium leading-relaxed">
                This action will permanently remove the user's account, profile, role assignments, approval history, and authentication record.
              </p>
            </div>

            <label className="flex items-start gap-2.5 rounded-lg border border-emerald-200/80 p-3 dark:border-emerald-800/60 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-emerald-950 dark:text-emerald-100 leading-relaxed">
                I understand that permanent deletion cannot be undone and will erase the authentication record from Supabase Auth.
              </span>
            </label>

            <label className="block font-semibold text-emerald-950 dark:text-emerald-100">
              Type <span className="font-mono text-red-600 dark:text-red-400">{permanentTarget.email}</span> to confirm
              <input
                type="text"
                value={confirmEmailInput}
                onChange={(e) => setConfirmEmailInput(e.target.value)}
                placeholder={permanentTarget.email}
                className="mt-1.5 h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 text-xs text-emerald-950 outline-none focus:border-red-500 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              />
            </label>

            <label className="block font-semibold text-emerald-950 dark:text-emerald-100">
              Audit Reason (optional)
              <input
                type="text"
                value={deleteReasonNote}
                onChange={(e) => setDeleteReasonNote(e.target.value)}
                placeholder="Reason for permanent deletion…"
                className="mt-1.5 h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 text-xs text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              />
            </label>
          </div>
        )}
      </Modal>

      {/* Notice permanent delete confirmation */}
      <Modal
        open={noticePermanentTarget !== null}
        onClose={() => setNoticePermanentTarget(null)}
        title="Delete announcement permanently?"
        subtitle={noticePermanentTarget?.title}
        dangerHeader
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setNoticePermanentTarget(null)}
              className="rounded-lg border border-emerald-200 px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (noticePermanentTarget) {
                  onPermanentDeleteAnnouncement(noticePermanentTarget.id);
                  setNoticePermanentTarget(null);
                }
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
            >
              Delete Permanently
            </button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">
          This announcement and its delivery summary will be removed permanently and cannot be restored.
        </p>
      </Modal>

      {/* Empty Notice Trash modal */}
      <Modal
        open={emptyNoticeTrashOpen}
        onClose={() => setEmptyNoticeTrashOpen(false)}
        title="Empty notification trash?"
        subtitle={`Permanently delete ${trashedNotices.length} trashed announcement${trashedNotices.length === 1 ? '' : 's'}.`}
        dangerHeader
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setEmptyNoticeTrashOpen(false)}
              className="rounded-lg border border-emerald-200 px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onEmptyAnnouncementTrash();
                setEmptyNoticeTrashOpen(false);
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
            >
              Empty Notice Trash
            </button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">
          All announcements currently in Notice Trash will be permanently erased.
        </p>
      </Modal>
    </div>
  );
}
