import { useMemo, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
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
  X,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { StatCard } from '../components/StatCard';
import type {
  RegistrableRole,
  RegistrationRequest,
  RegistrationStatus,
} from '../types';
import { downloadCsv } from '../utils/csvExport';

type RequestFilter = 'All' | RegistrationStatus | 'Trash';

interface UserApprovalsPageProps {
  requests: RegistrationRequest[];
  existingAccountCount: number;
  canManageTrash: boolean;
  onUpdateStatus: (
    requestId: string,
    status: 'Approved' | 'Rejected'
  ) => Promise<void> | void;
  onBulkUpdateStatus?: (
    requestIds: string[],
    status: 'Approved' | 'Rejected'
  ) => Promise<void>;
  onTrashRejectedUser: (requestId: string) => Promise<string | null>;
  onRestoreTrashedUser: (requestId: string) => Promise<string | null>;
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

function formatRegistrationDate(value: string) {
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(new Date(value));
}

function statusStyle(status: RegistrationStatus) {
  if (status === 'Approved') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300';
  }
  if (status === 'Rejected') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/50 dark:text-red-300';
  }
  return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-300';
}

export function UserApprovalsPage({
  requests,
  existingAccountCount,
  canManageTrash,
  onUpdateStatus,
  onBulkUpdateStatus,
  onTrashRejectedUser,
  onRestoreTrashedUser,
  onRefreshProfiles,
  onNotify,
}: UserApprovalsPageProps) {
  const [filter, setFilter] = useState<RequestFilter>('All');
  const [roleFilter, setRoleFilter] = useState<RegistrableRole | 'All'>('All');
  const [query, setQuery] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [workingRequestId, setWorkingRequestId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedRequest = useMemo(
    () => requests.find((item) => item.id === selectedRequestId) ?? null,
    [requests, selectedRequestId]
  );

  const counts = useMemo(() => {
    const activeRequests = requests.filter((request) => !request.trashedAt);
    return {
      total: existingAccountCount + activeRequests.length,
      pending: activeRequests.filter(
        (request) => request.status === 'Pending Approval'
      ).length,
      approved:
        existingAccountCount +
        activeRequests.filter((request) => request.status === 'Approved')
          .length,
      rejected: activeRequests.filter(
        (request) => request.status === 'Rejected'
      ).length,
    };
  }, [existingAccountCount, requests]);

  const visibleRequests = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return requests
      .filter((request) => {
        const matchesTab =
          filter === 'Trash'
            ? Boolean(request.trashedAt)
            : !request.trashedAt &&
              (filter === 'All' || request.status === filter);
        if (!matchesTab) return false;
        if (roleFilter !== 'All' && request.role !== roleFilter) return false;
        if (
          needle &&
          ![request.fullName, request.email, request.phone, request.affiliation]
            .join(' ')
            .toLowerCase()
            .includes(needle)
        ) {
          return false;
        }
        return true;
      })
      .sort(
        (left, right) =>
          new Date(right.registeredAt).getTime() -
          new Date(left.registeredAt).getTime()
      );
  }, [filter, query, requests, roleFilter]);

  const selectablePending = useMemo(
    () =>
      visibleRequests.filter(
        (request) => !request.trashedAt && request.status === 'Pending Approval'
      ),
    [visibleRequests]
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedPendingIds = useMemo(
    () =>
      selectablePending
        .filter((request) => selectedSet.has(request.id))
        .map((request) => request.id),
    [selectablePending, selectedSet]
  );
  const allPendingSelected =
    selectablePending.length > 0 &&
    selectablePending.every((request) => selectedSet.has(request.id));

  const toggleSelectAllPending = () => {
    if (allPendingSelected) {
      const visiblePendingIds = new Set(selectablePending.map((r) => r.id));
      setSelectedIds((prev) => prev.filter((id) => !visiblePendingIds.has(id)));
    } else {
      setSelectedIds([
        ...new Set([...selectedIds, ...selectablePending.map((r) => r.id)]),
      ]);
    }
  };

  const toggleSelectOne = (requestId: string) => {
    setSelectedIds((prev) =>
      prev.includes(requestId)
        ? prev.filter((id) => id !== requestId)
        : [...prev, requestId]
    );
  };

  const review = async (
    request: RegistrationRequest,
    status: 'Approved' | 'Rejected'
  ) => {
    setWorkingRequestId(request.id);
    setActionError(null);
    try {
      await onUpdateStatus(request.id, status);
      setSelectedRequestId(null);
      setSelectedIds((prev) => prev.filter((id) => id !== request.id));
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Could not update registration status.'
      );
    } finally {
      setWorkingRequestId(null);
    }
  };

  const runBulkReview = async (status: 'Approved' | 'Rejected') => {
    if (selectedPendingIds.length === 0) return;
    setBulkBusy(true);
    setActionError(null);
    try {
      if (onBulkUpdateStatus) {
        await onBulkUpdateStatus(selectedPendingIds, status);
      } else {
        for (const id of selectedPendingIds) {
          await onUpdateStatus(id, status);
        }
      }
      setSelectedIds([]);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Could not complete bulk review.'
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const updateTrashStatus = async (
    request: RegistrationRequest,
    restore: boolean
  ) => {
    setWorkingRequestId(request.id);
    setActionError(null);
    try {
      const error = restore
        ? await onRestoreTrashedUser(request.id)
        : await onTrashRejectedUser(request.id);
      if (error) {
        setActionError(error);
      } else {
        setSelectedRequestId(null);
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Could not update Trash status.'
      );
    } finally {
      setWorkingRequestId(null);
    }
  };

  const handleRefresh = async () => {
    if (!onRefreshProfiles || refreshing) return;
    setRefreshing(true);
    try {
      const error = await onRefreshProfiles();
      onNotify?.(error ?? 'Registration requests refreshed from Supabase.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportCsv = () => {
    const ok = downloadCsv(
      `baust-approvals-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Full Name',
        'Email',
        'Mobile',
        'Requested Role',
        'Affiliation',
        'Status',
        'Registered At',
        'Reviewed At',
      ],
      visibleRequests.map((r) => [
        r.fullName,
        r.email,
        r.phone,
        r.role,
        r.affiliation,
        r.trashedAt ? 'Trash' : r.status,
        r.registeredAt,
        r.reviewedAt ?? '',
      ])
    );
    onNotify?.(
      ok
        ? `Exported ${visibleRequests.length} registration record${visibleRequests.length === 1 ? '' : 's'} to CSV.`
        : 'Could not export CSV in this browser.'
    );
  };

  const filters: RequestFilter[] = [
    'All',
    'Pending Approval',
    'Approved',
    'Rejected',
  ];
  if (canManageTrash) filters.push('Trash');

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
            <h1 className="font-display text-xl font-bold text-emerald-950 dark:text-emerald-50">
              User Approval Requests
            </h1>
          </div>
          <p className="mt-1 text-xs text-emerald-900/60 dark:text-emerald-300/65">
            Review new registrations before granting access to the fest portal.
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
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            Organizer or Super Admin review
          </span>
        </div>
      </header>

      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="User approval statistics"
      >
        <StatCard
          label="Total Users"
          value={counts.total.toLocaleString()}
          sublabel="Existing and registered accounts"
          icon={UserRound}
        />
        <StatCard
          label="Pending Requests"
          value={counts.pending.toLocaleString()}
          sublabel="Awaiting organizer review"
          icon={Clock3}
          tone="amber"
        />
        <StatCard
          label="Approved Users"
          value={counts.approved.toLocaleString()}
          sublabel="Active accounts"
          icon={CheckCircle2}
          tone="success"
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
        <div className="flex flex-col gap-3 border-b border-emerald-100 px-4 py-4 dark:border-emerald-800/60">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
                Registration requests
              </h2>
              <p className="mt-0.5 text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                {visibleRequests.length} matching registration
                {visibleRequests.length === 1 ? '' : 's'}
              </p>
            </div>
            <div
              className="flex flex-wrap gap-1 rounded-lg bg-emerald-50 p-1 dark:bg-emerald-950/40"
              role="group"
              aria-label="Filter registration requests"
            >
              {filters.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  aria-pressed={filter === option}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                    filter === option
                      ? 'bg-white text-emerald-900 shadow-sm dark:bg-emerald-800 dark:text-white'
                      : 'text-emerald-800/70 hover:text-emerald-950 dark:text-emerald-200/70 dark:hover:text-white'
                  }`}
                >
                  {option === 'Pending Approval'
                    ? 'Pending'
                    : option === 'Trash'
                      ? `Trash (${requests.filter((request) => request.trashedAt).length})`
                      : option}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(14rem,1fr)_auto]">
            <label className="relative block">
              <span className="sr-only">Search requests</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-800/45 dark:text-emerald-200/45"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search applicant name, email, mobile, affiliation…"
                className="min-h-10 w-full rounded-lg border border-emerald-200 bg-white py-2 pl-9 pr-3 text-xs text-emerald-950 outline-none focus:border-emerald-600 focus:ring-[3px] focus:ring-emerald-600/10 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              />
            </label>
            <label>
              <span className="sr-only">Filter by requested role</span>
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

        {selectedPendingIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50/80 px-4 py-2.5 text-xs dark:border-emerald-800/60 dark:bg-emerald-950/35">
            <span className="font-semibold text-emerald-950 dark:text-emerald-100">
              {selectedPendingIds.length} pending request
              {selectedPendingIds.length === 1 ? '' : 's'} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => void runBulkReview('Approved')}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
              >
                <Check className="h-3.5 w-3.5" />
                {bulkBusy
                  ? 'Processing…'
                  : `Bulk Approve (${selectedPendingIds.length})`}
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => void runBulkReview('Rejected')}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800/70 dark:bg-[#061D15] dark:text-red-300"
              >
                <X className="h-3.5 w-3.5" />
                Bulk Reject ({selectedPendingIds.length})
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
          <p
            role="alert"
            className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
          >
            {actionError}
          </p>
        )}

        {visibleRequests.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h3 className="mt-3 text-sm font-semibold text-emerald-950 dark:text-emerald-50">
              {filter === 'All' && !query && roleFilter === 'All'
                ? 'No registration requests yet'
                : 'No matching registration requests'}
            </h3>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-emerald-900/60 dark:text-emerald-300/65">
              New account requests will appear here with their requested role and
              registration details.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left">
              <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all pending registration requests"
                      checked={allPendingSelected}
                      disabled={selectablePending.length === 0}
                      onChange={toggleSelectAllPending}
                      className="h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-600"
                    />
                  </th>
                  <th className="px-4 py-3">Full name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Mobile number</th>
                  <th className="px-4 py-3">Requested role</th>
                  <th className="px-4 py-3">Department / organization</th>
                  <th className="px-4 py-3">Registration date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50">
                {visibleRequests.map((request) => {
                  const isPending =
                    !request.trashedAt && request.status === 'Pending Approval';
                  const rowBusy = workingRequestId === request.id || bulkBusy;
                  return (
                    <tr
                      key={request.id}
                      className="text-xs text-emerald-950 dark:text-emerald-50"
                    >
                      <td className="px-4 py-3.5">
                        <input
                          type="checkbox"
                          aria-label={`Select ${request.fullName}`}
                          disabled={!isPending}
                          checked={isPending && selectedSet.has(request.id)}
                          onChange={() => toggleSelectOne(request.id)}
                          className="h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-600 disabled:opacity-40"
                        />
                      </td>
                      <td className="px-4 py-3.5 font-semibold">
                        {request.fullName}
                      </td>
                      <td className="px-4 py-3.5 text-emerald-900/75 dark:text-emerald-200/75">
                        {request.email}
                      </td>
                      <td className="px-4 py-3.5">{request.phone || '—'}</td>
                      <td className="px-4 py-3.5">{request.role}</td>
                      <td className="px-4 py-3.5">
                        {request.affiliation || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-emerald-900/65 dark:text-emerald-300/70">
                        {formatRegistrationDate(request.registeredAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${statusStyle(request.status)}`}
                        >
                          {request.trashedAt ? 'Trash' : request.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedRequestId(request.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View Details
                          </button>
                          {request.status === 'Pending Approval' && (
                            <>
                              <button
                                type="button"
                                disabled={rowBusy}
                                onClick={() => void review(request, 'Approved')}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-600 disabled:opacity-60 dark:bg-emerald-600"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={rowBusy}
                                onClick={() => void review(request, 'Rejected')}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-950/40"
                              >
                                <X className="h-3.5 w-3.5" />
                                Reject
                              </button>
                            </>
                          )}
                          {request.status === 'Rejected' &&
                            !request.trashedAt && (
                              <button
                                type="button"
                                disabled={rowBusy}
                                onClick={() => void review(request, 'Approved')}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-600 disabled:opacity-60 dark:bg-emerald-600"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Re-approve
                              </button>
                            )}
                          {request.status === 'Rejected' &&
                            !request.trashedAt &&
                            canManageTrash && (
                              <button
                                type="button"
                                disabled={rowBusy}
                                onClick={() =>
                                  void updateTrashStatus(request, false)
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {workingRequestId === request.id
                                  ? 'Moving…'
                                  : 'Move to Trash'}
                              </button>
                            )}
                          {request.trashedAt && canManageTrash && (
                            <button
                              type="button"
                              disabled={rowBusy}
                              onClick={() =>
                                void updateTrashStatus(request, true)
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800/70 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              {workingRequestId === request.id
                                ? 'Restoring…'
                                : 'Restore'}
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

      <Modal
        open={selectedRequest !== null}
        onClose={() => setSelectedRequestId(null)}
        title="Registration details"
        subtitle="Review the applicant information and approval status."
        footer={
          selectedRequest?.trashedAt && canManageTrash ? (
            <button
              type="button"
              disabled={workingRequestId === selectedRequest.id}
              onClick={() => void updateTrashStatus(selectedRequest, true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800/70 dark:text-emerald-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore from Trash
            </button>
          ) : selectedRequest &&
            (selectedRequest.status === 'Pending Approval' ||
              selectedRequest.status === 'Rejected') ? (
            <>
              {selectedRequest.status === 'Pending Approval' && (
                <button
                  type="button"
                  disabled={workingRequestId === selectedRequest.id}
                  onClick={() => void review(selectedRequest, 'Rejected')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  <X className="h-3.5 w-3.5" />
                  Reject
                </button>
              )}
              {selectedRequest.status === 'Rejected' && canManageTrash && (
                <button
                  type="button"
                  disabled={workingRequestId === selectedRequest.id}
                  onClick={() => void updateTrashStatus(selectedRequest, false)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Move to Trash
                </button>
              )}
              <button
                type="button"
                disabled={workingRequestId === selectedRequest.id}
                onClick={() => void review(selectedRequest, 'Approved')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60 dark:bg-emerald-600"
              >
                <Check className="h-3.5 w-3.5" />
                {selectedRequest.status === 'Rejected'
                  ? 'Re-approve User'
                  : 'Approve User'}
              </button>
            </>
          ) : undefined
        }
      >
        {selectedRequest && (
          <div className="space-y-4">
            {actionError && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
              >
                {actionError}
              </p>
            )}
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/40">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                <UserRound className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold">{selectedRequest.fullName}</p>
                <p className="mt-0.5 text-xs text-emerald-900/65 dark:text-emerald-200/70">
                  Requested access as {selectedRequest.role}
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail icon={Mail} label="Email" value={selectedRequest.email} />
              <Detail
                icon={Phone}
                label="Mobile number"
                value={selectedRequest.phone || '—'}
              />
              <Detail
                icon={Building2}
                label="Department / organization"
                value={selectedRequest.affiliation || '—'}
              />
              <Detail
                icon={Clock3}
                label="Registration date"
                value={formatRegistrationDate(selectedRequest.registeredAt)}
              />
            </div>
            <div className="flex items-center justify-between border-t border-emerald-100 pt-3 dark:border-emerald-800/60">
              <span className="text-xs font-medium text-emerald-900/65 dark:text-emerald-200/70">
                Account status
              </span>
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusStyle(selectedRequest.status)}`}
              >
                {selectedRequest.trashedAt ? 'Trash' : selectedRequest.status}
              </span>
            </div>
            {selectedRequest.reviewedAt && (
              <p className="text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                Reviewed {formatRegistrationDate(selectedRequest.reviewedAt)}. The
                applicant will see the decision when they next sign in.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-emerald-100 p-3 dark:border-emerald-800/60">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-200/60">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1.5 break-words text-xs font-medium text-emerald-950 dark:text-emerald-50">
        {value}
      </p>
    </div>
  );
}
