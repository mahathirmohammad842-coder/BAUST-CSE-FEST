import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  Clock3,
  Download,
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
import type { RegistrableRole, RegistrationRequest } from '../types';
import { downloadCsv } from '../utils/csvExport';

type TrashViewTab = 'trashed' | 'rejected';

interface RejectedTrashPageProps {
  requests: RegistrationRequest[];
  onTrashRejectedUser: (userId: string) => Promise<string | null>;
  onRestoreTrashedUser: (userId: string) => Promise<string | null>;
  onBulkTrashRejectedUsers?: (userIds: string[]) => Promise<string | null>;
  onBulkRestoreTrashedUsers?: (userIds: string[]) => Promise<string | null>;
  onReapproveRejectedUser?: (userId: string) => Promise<void> | void;
  onRefreshProfiles?: () => Promise<string | null>;
  onNotify?: (message: string) => void;
}

const REGISTRABLE_ROLES: RegistrableRole[] = [
  'Participant',
  'Volunteer',
  'Judge',
  'Guest',
  'Sponsor',
  'Mentor',
];

function formatDateTime(value?: string) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(parsed);
}

export function RejectedTrashPage({
  requests,
  onTrashRejectedUser,
  onRestoreTrashedUser,
  onBulkTrashRejectedUsers,
  onBulkRestoreTrashedUsers,
  onReapproveRejectedUser,
  onRefreshProfiles,
  onNotify,
}: RejectedTrashPageProps) {
  const [activeTab, setActiveTab] = useState<TrashViewTab>('trashed');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RegistrableRole | 'All'>('All');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const trashedRequests = useMemo(
    () =>
      requests
        .filter((request) => Boolean(request.trashedAt))
        .sort(
          (a, b) =>
            Date.parse(b.trashedAt ?? b.registeredAt) -
            Date.parse(a.trashedAt ?? a.registeredAt)
        ),
    [requests]
  );

  const eligibleRejectedRequests = useMemo(
    () =>
      requests
        .filter(
          (request) => !request.trashedAt && request.status === 'Rejected'
        )
        .sort(
          (a, b) =>
            Date.parse(b.reviewedAt ?? b.registeredAt) -
            Date.parse(a.reviewedAt ?? a.registeredAt)
        ),
    [requests]
  );

  const sourceList =
    activeTab === 'trashed' ? trashedRequests : eligibleRejectedRequests;

  const visibleRequests = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sourceList.filter((request) => {
      if (roleFilter !== 'All' && request.role !== roleFilter) return false;
      if (
        needle &&
        ![
          request.fullName,
          request.email,
          request.phone,
          request.affiliation,
          request.role,
        ]
          .join(' ')
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [query, roleFilter, sourceList]);

  const detailRequest = useMemo(
    () => requests.find((item) => item.id === detailId) ?? null,
    [detailId, requests]
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleSelectedIds = useMemo(
    () =>
      visibleRequests
        .filter((item) => selectedSet.has(item.id))
        .map((item) => item.id),
    [selectedSet, visibleRequests]
  );
  const allVisibleSelected =
    visibleRequests.length > 0 &&
    visibleRequests.every((item) => selectedSet.has(item.id));

  const switchTab = (nextTab: TrashViewTab) => {
    setActiveTab(nextTab);
    setSelectedIds([]);
    setActionError(null);
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(visibleRequests.map((item) => item.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      setSelectedIds([
        ...new Set([...selectedIds, ...visibleRequests.map((item) => item.id)]),
      ]);
    }
  };

  const toggleSelectOne = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSingleRestore = async (request: RegistrationRequest) => {
    setWorkingId(request.id);
    setActionError(null);
    try {
      const error = await onRestoreTrashedUser(request.id);
      if (error) {
        setActionError(error);
      } else {
        setSelectedIds((prev) => prev.filter((id) => id !== request.id));
        if (detailId === request.id) setDetailId(null);
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Could not restore account.'
      );
    } finally {
      setWorkingId(null);
    }
  };

  const handleSingleTrash = async (request: RegistrationRequest) => {
    setWorkingId(request.id);
    setActionError(null);
    try {
      const error = await onTrashRejectedUser(request.id);
      if (error) {
        setActionError(error);
      } else {
        setSelectedIds((prev) => prev.filter((id) => id !== request.id));
        if (detailId === request.id) setDetailId(null);
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Could not move account to Trash.'
      );
    } finally {
      setWorkingId(null);
    }
  };

  const handleReapprove = async (request: RegistrationRequest) => {
    if (!onReapproveRejectedUser) return;
    setWorkingId(request.id);
    setActionError(null);
    try {
      await onReapproveRejectedUser(request.id);
      setSelectedIds((prev) => prev.filter((id) => id !== request.id));
      if (detailId === request.id) setDetailId(null);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Could not re-approve account.'
      );
    } finally {
      setWorkingId(null);
    }
  };

  const handleBulkAction = async () => {
    if (visibleSelectedIds.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    setActionError(null);
    try {
      if (activeTab === 'trashed') {
        if (onBulkRestoreTrashedUsers) {
          const error = await onBulkRestoreTrashedUsers(visibleSelectedIds);
          if (error) {
            setActionError(error);
            return;
          }
        } else {
          for (const id of visibleSelectedIds) {
            const error = await onRestoreTrashedUser(id);
            if (error) {
              setActionError(error);
              return;
            }
          }
        }
      } else {
        if (onBulkTrashRejectedUsers) {
          const error = await onBulkTrashRejectedUsers(visibleSelectedIds);
          if (error) {
            setActionError(error);
            return;
          }
        } else {
          for (const id of visibleSelectedIds) {
            const error = await onTrashRejectedUser(id);
            if (error) {
              setActionError(error);
              return;
            }
          }
        }
      }
      setSelectedIds([]);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Could not complete bulk action.'
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const handleRefresh = async () => {
    if (!onRefreshProfiles || refreshing) return;
    setRefreshing(true);
    setActionError(null);
    try {
      const error = await onRefreshProfiles();
      onNotify?.(error ?? 'Rejected user archive refreshed.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportCsv = () => {
    const ok = downloadCsv(
      `baust-rejected-trash-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Full Name',
        'Email',
        'Mobile',
        'Requested Role',
        'Affiliation',
        'Registered At',
        'Reviewed At',
        'Trashed At',
        'Archive State',
      ],
      visibleRequests.map((item) => [
        item.fullName,
        item.email,
        item.phone,
        item.role,
        item.affiliation,
        item.registeredAt,
        item.reviewedAt ?? '',
        item.trashedAt ?? '',
        item.trashedAt ? 'In Trash' : 'Rejected (Not Trashed)',
      ])
    );
    onNotify?.(
      ok
        ? `Exported ${visibleRequests.length} record${visibleRequests.length === 1 ? '' : 's'} to CSV.`
        : 'Could not export CSV in this browser.'
    );
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-700 dark:text-red-400" />
            <h1 className="font-display text-xl font-bold text-emerald-950 dark:text-emerald-50">
              Rejected Users Trash
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-200">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Super Admin Only
            </span>
          </div>
          <p className="mt-1 text-xs text-emerald-900/60 dark:text-emerald-300/65">
            Isolated governance archive for declined user registrations. Move rejected applicants into Trash or restore them to the approval queue.
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
              Refresh
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-100 dark:hover:bg-emerald-950/50"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </header>

      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        aria-label="Rejected users trash metrics"
      >
        <StatCard
          label="In Trash"
          value={trashedRequests.length.toLocaleString()}
          sublabel="Isolated rejected accounts"
          icon={Trash2}
          tone="danger"
        />
        <StatCard
          label="Eligible Rejected"
          value={eligibleRejectedRequests.length.toLocaleString()}
          sublabel="Declined accounts ready to archive"
          icon={UserX}
          tone="amber"
        />
        <StatCard
          label="Total Rejected Pipeline"
          value={(
            trashedRequests.length + eligibleRejectedRequests.length
          ).toLocaleString()}
          sublabel="Combined trashed & active rejected records"
          icon={ShieldCheck}
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-emerald-200/70 bg-white dark:border-emerald-800/60 dark:bg-[#061D15]">
        <div className="flex flex-col gap-3 border-b border-emerald-100 px-4 py-4 dark:border-emerald-800/60">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
                {activeTab === 'trashed'
                  ? 'Trashed Rejected Accounts'
                  : 'Declined Registrations Eligible for Trash'}
              </h2>
              <p className="mt-0.5 text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                {visibleRequests.length} matching account
                {visibleRequests.length === 1 ? '' : 's'}
              </p>
            </div>
            <div
              className="flex flex-wrap gap-1 rounded-lg bg-emerald-50 p-1 dark:bg-emerald-950/40"
              role="tablist"
              aria-label="Rejected archive views"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'trashed'}
                onClick={() => switchTab('trashed')}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors tabular-nums ${
                  activeTab === 'trashed'
                    ? 'bg-white text-emerald-950 shadow-sm dark:bg-emerald-800 dark:text-white'
                    : 'text-emerald-900/70 hover:text-emerald-950 dark:text-emerald-200/70 dark:hover:text-white'
                }`}
              >
                In Trash ({trashedRequests.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'rejected'}
                onClick={() => switchTab('rejected')}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors tabular-nums ${
                  activeTab === 'rejected'
                    ? 'bg-white text-emerald-950 shadow-sm dark:bg-emerald-800 dark:text-white'
                    : 'text-emerald-900/70 hover:text-emerald-950 dark:text-emerald-200/70 dark:hover:text-white'
                }`}
              >
                Rejected — Not Trashed ({eligibleRejectedRequests.length})
              </button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(14rem,1fr)_auto]">
            <label className="relative block">
              <span className="sr-only">Search rejected accounts</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-800/45 dark:text-emerald-200/45"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, mobile, department…"
                className="min-h-10 w-full rounded-lg border border-emerald-200 bg-white py-2 pl-9 pr-3 text-xs text-emerald-950 outline-none focus:border-emerald-600 focus:ring-[3px] focus:ring-emerald-600/10 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              />
            </label>
            <label>
              <span className="sr-only">Filter by role</span>
              <select
                value={roleFilter}
                onChange={(event) => {
                  const val = event.target.value;
                  if (
                    val === 'All' ||
                    REGISTRABLE_ROLES.includes(val as RegistrableRole)
                  ) {
                    setRoleFilter(val as RegistrableRole | 'All');
                  }
                }}
                className="min-h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              >
                <option value="All">All requested roles</option>
                {REGISTRABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {visibleSelectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50/80 px-4 py-2.5 text-xs dark:border-emerald-800/60 dark:bg-emerald-950/35">
            <span className="font-semibold text-emerald-950 dark:text-emerald-100 tabular-nums">
              {visibleSelectedIds.length} account
              {visibleSelectedIds.length === 1 ? '' : 's'} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => void handleBulkAction()}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-60 ${
                  activeTab === 'trashed'
                    ? 'bg-emerald-700 text-white hover:bg-emerald-600'
                    : 'border border-red-200 bg-white text-red-700 hover:bg-red-50 dark:border-red-800/70 dark:bg-[#061D15] dark:text-red-300 dark:hover:bg-red-950/50'
                }`}
              >
                {activeTab === 'trashed' ? (
                  <RotateCcw className="h-3.5 w-3.5" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {bulkBusy
                  ? 'Processing…'
                  : activeTab === 'trashed'
                    ? `Restore Selected (${visibleSelectedIds.length})`
                    : `Move to Trash (${visibleSelectedIds.length})`}
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="px-2 py-1 text-[11px] font-semibold text-emerald-900/70 hover:text-emerald-950 dark:text-emerald-300/75"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {actionError && (
          <div
            role="alert"
            className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {visibleRequests.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Trash2 className="h-5 w-5" />
            </span>
            <h3 className="mt-3 text-sm font-semibold text-emerald-950 dark:text-emerald-50">
              {activeTab === 'trashed'
                ? 'Trash is empty'
                : 'No unarchived rejected accounts'}
            </h3>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-emerald-900/60 dark:text-emerald-300/65">
              {activeTab === 'trashed'
                ? 'Rejected user accounts moved to Trash by a Super Admin appear here and remain excluded from standard user directories until restored.'
                : 'All currently rejected accounts are either already in Trash or no registrations have been declined.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left">
              <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all visible accounts"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-600"
                    />
                  </th>
                  <th className="px-4 py-3">Applicant</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">Requested role</th>
                  <th className="px-4 py-3">Affiliation</th>
                  <th className="px-4 py-3">
                    {activeTab === 'trashed' ? 'Trashed at' : 'Declined at'}
                  </th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50">
                {visibleRequests.map((request) => {
                  const rowBusy = workingId === request.id || bulkBusy;
                  return (
                    <tr
                      key={request.id}
                      className="text-xs text-emerald-950 hover:bg-emerald-50/30 dark:text-emerald-50 dark:hover:bg-[#09291E]/50"
                    >
                      <td className="px-4 py-3.5">
                        <input
                          type="checkbox"
                          aria-label={`Select ${request.fullName}`}
                          checked={selectedSet.has(request.id)}
                          onChange={() => toggleSelectOne(request.id)}
                          className="h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-600"
                        />
                      </td>
                      <td className="px-4 py-3.5 font-semibold">
                        {request.fullName}
                      </td>
                      <td className="px-4 py-3.5 text-emerald-900/75 dark:text-emerald-200/75">
                        {request.email}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] tabular-nums">
                        {request.phone || '—'}
                      </td>
                      <td className="px-4 py-3.5">{request.role}</td>
                      <td className="px-4 py-3.5">
                        {request.affiliation || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-emerald-900/65 dark:text-emerald-300/70 tabular-nums">
                        {formatDateTime(
                          activeTab === 'trashed'
                            ? request.trashedAt
                            : request.reviewedAt ?? request.registeredAt
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailId(request.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Details
                          </button>
                          {activeTab === 'trashed' ? (
                            <button
                              type="button"
                              disabled={rowBusy}
                              onClick={() => void handleSingleRestore(request)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-600 disabled:opacity-60 dark:bg-emerald-600"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              {workingId === request.id
                                ? 'Restoring…'
                                : 'Restore'}
                            </button>
                          ) : (
                            <>
                              {onReapproveRejectedUser && (
                                <button
                                  type="button"
                                  disabled={rowBusy}
                                  onClick={() => void handleReapprove(request)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-600 disabled:opacity-60 dark:bg-emerald-600"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Re-approve
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={rowBusy}
                                onClick={() => void handleSingleTrash(request)}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-950/40"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {workingId === request.id
                                  ? 'Moving…'
                                  : 'Move to Trash'}
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

      <Modal
        open={detailRequest !== null}
        onClose={() => setDetailId(null)}
        title="Rejected Account Details"
        subtitle="Super Admin isolated archive record"
        footer={
          detailRequest ? (
            detailRequest.trashedAt ? (
              <button
                type="button"
                disabled={workingId === detailRequest.id}
                onClick={() => void handleSingleRestore(detailRequest)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60 dark:bg-emerald-600"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore to Rejected List
              </button>
            ) : (
              <>
                {onReapproveRejectedUser && (
                  <button
                    type="button"
                    disabled={workingId === detailRequest.id}
                    onClick={() => void handleReapprove(detailRequest)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60 dark:bg-emerald-600"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Re-approve Account
                  </button>
                )}
                <button
                  type="button"
                  disabled={workingId === detailRequest.id}
                  onClick={() => void handleSingleTrash(detailRequest)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Move to Trash
                </button>
              </>
            )
          ) : undefined
        }
      >
        {detailRequest && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/40">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                <UserRound className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-emerald-950 dark:text-emerald-50">
                  {detailRequest.fullName}
                </p>
                <p className="mt-0.5 text-xs text-emerald-900/65 dark:text-emerald-200/70">
                  Requested {detailRequest.role} access
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
                  {detailRequest.email}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-100 p-3 dark:border-emerald-800/60">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-200/60">
                  <Phone className="h-3.5 w-3.5" />
                  Mobile number
                </div>
                <p className="mt-1.5 font-mono text-xs font-medium text-emerald-950 dark:text-emerald-50">
                  {detailRequest.phone || '—'}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-100 p-3 dark:border-emerald-800/60">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-200/60">
                  <Building2 className="h-3.5 w-3.5" />
                  Department / Organization
                </div>
                <p className="mt-1.5 break-words text-xs font-medium text-emerald-950 dark:text-emerald-50">
                  {detailRequest.affiliation || '—'}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-100 p-3 dark:border-emerald-800/60">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-200/60">
                  <Clock3 className="h-3.5 w-3.5" />
                  Registered At
                </div>
                <p className="mt-1.5 text-xs font-medium text-emerald-950 dark:text-emerald-50">
                  {formatDateTime(detailRequest.registeredAt)}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-emerald-100 px-3 py-2.5 text-xs dark:border-emerald-800/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-emerald-900/65 dark:text-emerald-300/70">
                  Archive Status
                </span>
                <span className="font-semibold text-red-700 dark:text-red-300">
                  {detailRequest.trashedAt ? 'In Super Admin Trash' : 'Rejected'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-emerald-900/65 dark:text-emerald-300/70">
                  Reviewed At
                </span>
                <span className="font-medium text-emerald-950 dark:text-emerald-50">
                  {formatDateTime(detailRequest.reviewedAt)}
                </span>
              </div>
              {detailRequest.trashedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-emerald-900/65 dark:text-emerald-300/70">
                    Moved to Trash At
                  </span>
                  <span className="font-medium text-emerald-950 dark:text-emerald-50">
                    {formatDateTime(detailRequest.trashedAt)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
