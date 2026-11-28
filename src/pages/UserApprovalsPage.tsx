import { useMemo, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  Mail,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
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
  VerificationStatus,
  WorkspaceRole,
} from '../types';
import { downloadCsv } from '../utils/csvExport';

type RequestFilter = 'All' | RegistrationStatus | 'Trash';

interface UserApprovalsPageProps {
  requests: RegistrationRequest[];
  existingAccountCount: number;
  canManageTrash: boolean;
  currentUserRole: WorkspaceRole;
  canChangeApprovalStatus: boolean;
  currentUserId?: string;
  onUpdateStatus: (
    requestId: string,
    status: 'Approved' | 'Rejected',
    options?: {
      assignedRole?: WorkspaceRole;
      approvalNotes?: string;
      markVerified?: boolean;
    }
  ) => Promise<void> | void;
  onBulkUpdateStatus?: (
    requestIds: string[],
    status: 'Approved' | 'Rejected'
  ) => Promise<void>;
  onRecommendRegistration?: (
    requestId: string,
    recommendation: 'Approve' | 'Reject',
    suggestedRole?: RegistrableRole,
    notes?: string
  ) => Promise<string | null>;
  onUpdateVerification?: (
    userId: string,
    newStatus: VerificationStatus,
    notes: string
  ) => Promise<string | null>;
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

const SUPER_ADMIN_APPROVAL_ROLES: WorkspaceRole[] = [
  ...REGISTRABLE_ROLES,
  'Organizer',
  'Admin',
];

function formatRegistrationDate(value?: string) {
  if (!value) return 'Never';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(parsed);
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

function verificationStyle(status?: VerificationStatus) {
  if (status === 'Verified') {
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
  currentUserRole,
  canChangeApprovalStatus,
  currentUserId,
  onUpdateStatus,
  onBulkUpdateStatus,
  onRecommendRegistration,
  onUpdateVerification,
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

  const [approvalRoleDraft, setApprovalRoleDraft] =
    useState<WorkspaceRole>('Participant');
  const [approvalNotesDraft, setApprovalNotesDraft] = useState('');
  const [markVerifiedDraft, setMarkVerifiedDraft] = useState(true);
  const [verificationNotesDraft, setVerificationNotesDraft] = useState('');
  const [recommendActionDraft, setRecommendActionDraft] = useState<
    'Approve' | 'Reject'
  >('Approve');
  const [recommendRoleDraft, setRecommendRoleDraft] =
    useState<RegistrableRole>('Participant');
  const [recommendNotesDraft, setRecommendNotesDraft] = useState('');

  const selectedRequest = useMemo(
    () => requests.find((item) => item.id === selectedRequestId) ?? null,
    [requests, selectedRequestId]
  );

  const openDetails = (request: RegistrationRequest) => {
    setSelectedRequestId(request.id);
    setActionError(null);
    setApprovalRoleDraft(
      request.recommendedRole && currentUserRole === 'Super Admin'
        ? request.recommendedRole
        : request.role
    );
    setApprovalNotesDraft('');
    setMarkVerifiedDraft(request.verificationStatus !== 'Verified');
    setVerificationNotesDraft('');
    setRecommendActionDraft(request.recommendedAction ?? 'Approve');
    setRecommendRoleDraft(
      (request.recommendedRole &&
      REGISTRABLE_ROLES.includes(request.recommendedRole as RegistrableRole)
        ? (request.recommendedRole as RegistrableRole)
        : request.role)
    );
    setRecommendNotesDraft(request.recommendationNotes ?? '');
  };

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
          ![
            request.fullName,
            request.email,
            request.phone,
            request.affiliation,
            request.role,
            request.assignedRole ?? 'Participant',
          ]
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
        (request) =>
          !request.trashedAt &&
          request.status === 'Pending Approval' &&
          request.id !== currentUserId
      ),
    [currentUserId, visibleRequests]
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
    status: 'Approved' | 'Rejected',
    options?: {
      assignedRole?: WorkspaceRole;
      approvalNotes?: string;
      markVerified?: boolean;
    }
  ) => {
    if (!canChangeApprovalStatus || request.id === currentUserId) return;
    setWorkingRequestId(request.id);
    setActionError(null);
    try {
      await onUpdateStatus(request.id, status, options);
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
    if (!canChangeApprovalStatus || selectedPendingIds.length === 0) return;
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

  const handleRecommend = async (request: RegistrationRequest) => {
    if (!onRecommendRegistration || request.id === currentUserId) return;
    setWorkingRequestId(request.id);
    setActionError(null);
    try {
      const error = await onRecommendRegistration(
        request.id,
        recommendActionDraft,
        recommendRoleDraft,
        recommendNotesDraft
      );
      if (error) {
        setActionError(error);
      } else {
        setSelectedRequestId(null);
      }
    } finally {
      setWorkingRequestId(null);
    }
  };

  const handleVerification = async (
    request: RegistrationRequest,
    status: VerificationStatus
  ) => {
    if (!onUpdateVerification || request.id === currentUserId) return;
    setWorkingRequestId(request.id);
    setActionError(null);
    try {
      const error = await onUpdateVerification(
        request.id,
        status,
        verificationNotesDraft || `Verification marked ${status} during registration review`
      );
      if (error) {
        setActionError(error);
      }
    } finally {
      setWorkingRequestId(null);
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
        'Assigned Role',
        'Verification Status',
        'Affiliation',
        'Account Status',
        'Recommended Action',
        'Registered At',
        'Last Login',
        'Reviewed At',
      ],
      visibleRequests.map((r) => [
        r.fullName,
        r.email,
        r.phone,
        r.role,
        r.assignedRole ?? 'Participant',
        r.verificationStatus ?? 'Pending',
        r.affiliation,
        r.trashedAt ? 'Trash' : r.status,
        r.recommendedAction ? `${r.recommendedAction} (${r.recommendedRole ?? r.role})` : '',
        r.registeredAt,
        r.lastLoginAt ?? '',
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

  const assignableModalRoles =
    currentUserRole === 'Super Admin'
      ? SUPER_ADMIN_APPROVAL_ROLES
      : REGISTRABLE_ROLES;

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
            All new registrations start with Assigned Role = Participant under Pending Approval until verified and approved.
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
          <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            {currentUserRole === 'Super Admin'
              ? 'Super Admin Full Approval'
              : canChangeApprovalStatus
                ? 'Delegated Organizer Approval'
                : 'Organizer Review & Recommend'}
          </span>
        </div>
      </header>

      {!canChangeApprovalStatus && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/35 dark:text-amber-200">
          Your Organizer account is configured for <strong>Verification &amp; Recommendation</strong> only. Open any request to verify applicant details and submit an approval or rejection recommendation for the Super Admin, or request delegated approval permission.
        </div>
      )}

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
          sublabel="Awaiting review"
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
                Registration &amp; Role Requests
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
                placeholder="Search applicant name, email, mobile, affiliation, role…"
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

        {canChangeApprovalStatus && selectedPendingIds.length > 0 && (
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
              New account requests will appear here with their requested role, assigned role, and verification state.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1160px] text-left">
              <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
                <tr>
                  <th className="w-10 px-4 py-3">
                    {canChangeApprovalStatus && (
                      <input
                        type="checkbox"
                        aria-label="Select all pending registration requests"
                        checked={allPendingSelected}
                        disabled={selectablePending.length === 0}
                        onChange={toggleSelectAllPending}
                        className="h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-600"
                      />
                    )}
                  </th>
                  <th className="px-4 py-3">Applicant</th>
                  <th className="px-4 py-3">Contact &amp; Affiliation</th>
                  <th className="px-4 py-3">Requested → Assigned</th>
                  <th className="px-4 py-3">Verification</th>
                  <th className="px-4 py-3">Recommendation</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50">
                {visibleRequests.map((request) => {
                  const isPending =
                    !request.trashedAt &&
                    request.status === 'Pending Approval' &&
                    request.id !== currentUserId;
                  const rowBusy = workingRequestId === request.id || bulkBusy;
                  const assignedRole = request.assignedRole ?? 'Participant';
                  const vStatus = request.verificationStatus ?? 'Pending';
                  return (
                    <tr
                      key={request.id}
                      className="text-xs text-emerald-950 dark:text-emerald-50"
                    >
                      <td className="px-4 py-3.5">
                        {canChangeApprovalStatus && (
                          <input
                            type="checkbox"
                            aria-label={`Select ${request.fullName}`}
                            disabled={!isPending}
                            checked={isPending && selectedSet.has(request.id)}
                            onChange={() => toggleSelectOne(request.id)}
                            className="h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-600 disabled:opacity-40"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold">{request.fullName}</div>
                        <div className="text-[11px] text-emerald-900/65 dark:text-emerald-300/70">
                          {request.email}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div>{request.phone || '—'}</div>
                        <div className="text-[11px] text-emerald-900/65 dark:text-emerald-300/70">
                          {request.affiliation || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded border border-emerald-200 bg-emerald-50/70 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                            Req: {request.role}
                          </span>
                          <span className="text-emerald-900/40 dark:text-emerald-300/40">
                            →
                          </span>
                          <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-800 dark:border-emerald-800 dark:bg-[#041811] dark:text-emerald-100">
                            Assigned: {assignedRole}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${verificationStyle(vStatus)}`}
                        >
                          {vStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {request.recommendedAction ? (
                          <div className="space-y-0.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                                request.recommendedAction === 'Approve'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                                  : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300'
                              }`}
                            >
                              <Sparkles className="h-3 w-3" />
                              {request.recommendedAction} ({request.recommendedRole ?? request.role})
                            </span>
                            {request.recommendedByName && (
                              <div className="text-[10px] text-emerald-900/55 dark:text-emerald-300/60">
                                by {request.recommendedByName}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-emerald-900/45 dark:text-emerald-300/45">
                            None
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-emerald-900/65 dark:text-emerald-300/70">
                        <div>Reg: {formatRegistrationDate(request.registeredAt)}</div>
                        <div className="text-[10px] text-emerald-900/50 dark:text-emerald-300/55">
                          Login: {formatRegistrationDate(request.lastLoginAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold ${statusStyle(request.status)}`}
                        >
                          {request.trashedAt ? 'Trash' : request.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openDetails(request)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Review
                          </button>
                          {canChangeApprovalStatus &&
                            request.id !== currentUserId &&
                            request.status === 'Pending Approval' && (
                              <>
                                <button
                                  type="button"
                                  disabled={rowBusy}
                                  onClick={() =>
                                    void review(request, 'Approved', {
                                      assignedRole:
                                        request.recommendedRole ?? request.role,
                                      markVerified: true,
                                    })
                                  }
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
                          {canChangeApprovalStatus &&
                            request.id !== currentUserId &&
                            request.status === 'Rejected' &&
                            !request.trashedAt && (
                              <button
                                type="button"
                                disabled={rowBusy}
                                onClick={() =>
                                  void review(request, 'Approved', {
                                    assignedRole: request.role,
                                  })
                                }
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
                                  : 'Trash'}
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
        title="Review Role & Registration Request"
        subtitle="Verify submitted details, record a staff recommendation, or finalize account approval."
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
            selectedRequest.id !== currentUserId &&
            (selectedRequest.status === 'Pending Approval' ||
              selectedRequest.status === 'Rejected') ? (
            canChangeApprovalStatus ? (
              <>
                {selectedRequest.status === 'Pending Approval' && (
                  <button
                    type="button"
                    disabled={workingRequestId === selectedRequest.id}
                    onClick={() =>
                      void review(selectedRequest, 'Rejected', {
                        approvalNotes: approvalNotesDraft,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    <X className="h-3.5 w-3.5" />
                    Reject Request
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
                  onClick={() =>
                    void review(selectedRequest, 'Approved', {
                      assignedRole: approvalRoleDraft,
                      approvalNotes: approvalNotesDraft,
                      markVerified: markVerifiedDraft,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60 dark:bg-emerald-600"
                >
                  <Check className="h-3.5 w-3.5" />
                  {selectedRequest.status === 'Rejected'
                    ? `Re-approve as ${approvalRoleDraft}`
                    : `Approve & Assign ${approvalRoleDraft}`}
                </button>
              </>
            ) : onRecommendRegistration ? (
              <button
                type="button"
                disabled={workingRequestId === selectedRequest.id}
                onClick={() => void handleRecommend(selectedRequest)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60 dark:bg-emerald-600"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Submit Recommendation
              </button>
            ) : undefined
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
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/40">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                  <UserRound className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold">{selectedRequest.fullName}</p>
                  <p className="mt-0.5 text-xs text-emerald-900/65 dark:text-emerald-200/70">
                    Requested: <strong>{selectedRequest.role}</strong> · Assigned:{' '}
                    <strong>{selectedRequest.assignedRole ?? 'Participant'}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold ${verificationStyle(selectedRequest.verificationStatus)}`}
                >
                  {selectedRequest.verificationStatus ?? 'Pending'} Verification
                </span>
                <span
                  className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold ${statusStyle(selectedRequest.status)}`}
                >
                  {selectedRequest.trashedAt ? 'Trash' : selectedRequest.status}
                </span>
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
                label="Registration & Last Login"
                value={`Reg: ${formatRegistrationDate(selectedRequest.registeredAt)} · Login: ${formatRegistrationDate(selectedRequest.lastLoginAt)}`}
              />
            </div>

            {selectedRequest.recommendedAction && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs dark:border-emerald-800/60 dark:bg-emerald-950/35">
                <div className="font-semibold text-emerald-950 dark:text-emerald-100">
                  Organizer Recommendation: {selectedRequest.recommendedAction}{' '}
                  ({selectedRequest.recommendedRole ?? selectedRequest.role})
                </div>
                <div className="mt-0.5 text-[11px] text-emerald-900/70 dark:text-emerald-300/75">
                  By {selectedRequest.recommendedByName || 'Organizer'}
                  {selectedRequest.recommendedAt
                    ? ` · ${formatRegistrationDate(selectedRequest.recommendedAt)}`
                    : ''}
                </div>
                {selectedRequest.recommendationNotes && (
                  <p className="mt-1 text-emerald-900/80 dark:text-emerald-200/80">
                    “{selectedRequest.recommendationNotes}”
                  </p>
                )}
              </div>
            )}

            {onUpdateVerification && selectedRequest.id !== currentUserId && (
              <div className="rounded-lg border border-emerald-100 p-3 space-y-2 dark:border-emerald-800/60">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                  <ClipboardCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                  Information Verification
                </div>
                <input
                  type="text"
                  value={verificationNotesDraft}
                  onChange={(e) => setVerificationNotesDraft(e.target.value)}
                  placeholder="Optional verification notes (e.g., ID & department confirmed)…"
                  className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                />
                <div className="flex flex-wrap gap-2">
                  {(['Verified', 'Pending', 'Rejected'] as VerificationStatus[]).map(
                    (vStatus) => (
                      <button
                        key={vStatus}
                        type="button"
                        disabled={workingRequestId === selectedRequest.id}
                        onClick={() => void handleVerification(selectedRequest, vStatus)}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60 ${
                          (selectedRequest.verificationStatus ?? 'Pending') === vStatus
                            ? 'border-emerald-700 bg-emerald-700 text-white'
                            : 'border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-[#041811] dark:text-emerald-100'
                        }`}
                      >
                        Mark {vStatus}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {selectedRequest.id !== currentUserId &&
              (selectedRequest.status === 'Pending Approval' ||
                selectedRequest.status === 'Rejected') &&
              (canChangeApprovalStatus ? (
                <div className="rounded-lg border border-emerald-100 p-3 space-y-2.5 dark:border-emerald-800/60">
                  <div className="text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                    Approval Decision &amp; Role Assignment
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block text-[11px] font-medium text-emerald-900/75 dark:text-emerald-200/75">
                      Role to Assign on Approval
                      <select
                        value={approvalRoleDraft}
                        onChange={(e) =>
                          setApprovalRoleDraft(e.target.value as WorkspaceRole)
                        }
                        className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                      >
                        {assignableModalRoles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                            {r === selectedRequest.role ? ' (Requested)' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 self-end pb-1.5 text-xs font-medium text-emerald-900 dark:text-emerald-100">
                      <input
                        type="checkbox"
                        checked={markVerifiedDraft}
                        onChange={(e) => setMarkVerifiedDraft(e.target.checked)}
                        className="h-4 w-4 rounded border-emerald-300 text-emerald-700"
                      />
                      Also mark information Verified
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    value={approvalNotesDraft}
                    onChange={(e) => setApprovalNotesDraft(e.target.value)}
                    placeholder="Approval or rejection audit notes…"
                    className="w-full rounded-lg border border-emerald-200 bg-white p-2 text-xs text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                  />
                </div>
              ) : (
                onRecommendRegistration && (
                  <div className="rounded-lg border border-emerald-100 p-3 space-y-2.5 dark:border-emerald-800/60">
                    <div className="text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                      Organizer Recommendation
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block text-[11px] font-medium text-emerald-900/75 dark:text-emerald-200/75">
                        Recommendation
                        <select
                          value={recommendActionDraft}
                          onChange={(e) =>
                            setRecommendActionDraft(
                              e.target.value as 'Approve' | 'Reject'
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                        >
                          <option value="Approve">Recommend Approval</option>
                          <option value="Reject">Recommend Rejection</option>
                        </select>
                      </label>
                      <label className="block text-[11px] font-medium text-emerald-900/75 dark:text-emerald-200/75">
                        Suggested Role
                        <select
                          value={recommendRoleDraft}
                          onChange={(e) =>
                            setRecommendRoleDraft(
                              e.target.value as RegistrableRole
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                        >
                          {REGISTRABLE_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <textarea
                      rows={2}
                      value={recommendNotesDraft}
                      onChange={(e) => setRecommendNotesDraft(e.target.value)}
                      placeholder="Reviewer notes for Super Admin decision…"
                      className="w-full rounded-lg border border-emerald-200 bg-white p-2 text-xs text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                    />
                  </div>
                )
              ))}

            {selectedRequest.reviewedAt && (
              <p className="text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                Last reviewed {formatRegistrationDate(selectedRequest.reviewedAt)}.
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
