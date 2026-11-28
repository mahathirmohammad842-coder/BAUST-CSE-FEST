import { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  FileSpreadsheet,
  History,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserCog,
  UserRound,
  X,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { StatCard } from '../components/StatCard';
import type {
  ActivityLogEntry,
  ApprovalLog,
  ProfileAccountStatus,
  RegistrableRole,
  RoleChangeLog,
  RolePermissionEntry,
  UserProfile,
  VerificationLog,
  VerificationStatus,
  WorkspaceRole,
} from '../types';
import { downloadCsv } from '../utils/csvExport';

type PanelTab = 'directory' | 'approval-queue' | 'verification-queue' | 'audit-reports';
type AuditSubTab = 'role-changes' | 'approvals' | 'verifications' | 'activities' | 'permissions';
type SortField =
  | 'fullName'
  | 'requestedRole'
  | 'role'
  | 'verificationStatus'
  | 'accountStatus'
  | 'createdAt'
  | 'lastLoginAt';

interface SuperAdminUsersPageProps {
  profiles: UserProfile[];
  currentUserId: string;
  roleChangeLogs: RoleChangeLog[];
  approvalLogs: ApprovalLog[];
  verificationLogs: VerificationLog[];
  activityLogs?: ActivityLogEntry[];
  rolePermissions?: RolePermissionEntry[];
  onAssignRole: (
    userId: string,
    newRole: WorkspaceRole,
    notes: string
  ) => Promise<string | null>;
  onBulkAssignRoles: (
    userIds: string[],
    newRole: WorkspaceRole,
    notes: string
  ) => Promise<string | null>;
  onReviewRegistration: (
    userId: string,
    approve: boolean,
    assignedRole?: WorkspaceRole,
    notes?: string,
    markVerified?: boolean
  ) => Promise<string | null>;
  onBulkReviewRegistrations: (
    userIds: string[],
    approve: boolean,
    notes?: string
  ) => Promise<string | null>;
  onUpdateVerification: (
    userId: string,
    newStatus: VerificationStatus,
    notes: string
  ) => Promise<string | null>;
  onBulkVerifyUsers: (
    userIds: string[],
    newStatus: VerificationStatus,
    notes: string
  ) => Promise<string | null>;
  onSetOrganizerPermission: (
    userId: string,
    granted: boolean,
    notes?: string
  ) => Promise<string | null>;
  onSetAccountStatus: (
    userId: string,
    status: ProfileAccountStatus
  ) => Promise<void> | void;
  onRefreshData?: () => Promise<string | null>;
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

const ASSIGNABLE_ROLES: WorkspaceRole[] = [
  'Participant',
  'Volunteer',
  'Judge',
  'Guest',
  'Sponsor',
  'Mentor',
  'Organizer',
  'Super Admin',
];

const VERIFICATION_STATUSES: VerificationStatus[] = [
  'Pending',
  'Verified',
  'Rejected',
];

function formatDateTime(value?: string | null) {
  if (!value) return 'Never';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(parsed);
}

function getVerificationBadgeClass(status: VerificationStatus) {
  if (status === 'Verified') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300';
  }
  if (status === 'Rejected') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/50 dark:text-red-300';
  }
  return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-300';
}

function getAccountStatusBadgeClass(status: ProfileAccountStatus, trashed?: string) {
  if (trashed) {
    return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
  if (status === 'Active') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300';
  }
  if (status === 'Suspended' || status === 'Rejected') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/50 dark:text-red-300';
  }
  return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-300';
}

function getRoleBadgeClass(role: WorkspaceRole) {
  if (role === 'Super Admin') {
    return 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800/70 dark:bg-violet-950/50 dark:text-violet-300';
  }
  if (role === 'Organizer') {
    return 'border-emerald-300 bg-emerald-100/80 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200';
  }
  return 'border-slate-200 bg-slate-50 text-slate-800 dark:border-emerald-800/60 dark:bg-[#041811] dark:text-emerald-100';
}

function isPendingApprovalProfile(profile: UserProfile): boolean {
  return (
    profile.approvalStatus === 'Pending' ||
    profile.accountStatus === 'Pending Approval'
  );
}

export function SuperAdminUsersPage({
  profiles,
  currentUserId,
  roleChangeLogs,
  approvalLogs,
  verificationLogs,
  activityLogs = [],
  rolePermissions = [],
  onAssignRole,
  onBulkAssignRoles,
  onReviewRegistration,
  onBulkReviewRegistrations,
  onUpdateVerification,
  onBulkVerifyUsers,
  onSetOrganizerPermission,
  onSetAccountStatus,
  onRefreshData,
  onNotify,
}: SuperAdminUsersPageProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('directory');
  const [auditTab, setAuditTab] = useState<AuditSubTab>('role-changes');

  // Search, Filter & Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [requestedRoleFilter, setRequestedRoleFilter] = useState<RegistrableRole | 'All'>('All');
  const [assignedRoleFilter, setAssignedRoleFilter] = useState<WorkspaceRole | 'All'>('All');
  const [verificationFilter, setVerificationFilter] = useState<VerificationStatus | 'All'>('All');
  const [accountStatusFilter, setAccountStatusFilter] = useState<ProfileAccountStatus | 'All'>('All');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortAsc, setSortAsc] = useState(false);

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRole, setBulkRole] = useState<WorkspaceRole>('Volunteer');
  const [bulkRoleNotes, setBulkRoleNotes] = useState('');
  const [bulkVerification, setBulkVerification] = useState<VerificationStatus>('Verified');
  const [bulkVerificationNotes, setBulkVerificationNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals
  const [roleModalUser, setRoleModalUser] = useState<UserProfile | null>(null);
  const [roleModalValue, setRoleModalValue] = useState<WorkspaceRole>('Participant');
  const [roleModalNotes, setRoleModalNotes] = useState('');

  const [verifyModalUser, setVerifyModalUser] = useState<UserProfile | null>(null);
  const [verifyModalValue, setVerifyModalValue] = useState<VerificationStatus>('Verified');
  const [verifyModalNotes, setVerifyModalNotes] = useState('');

  const [approvalModalUser, setApprovalModalUser] = useState<UserProfile | null>(null);
  const [approvalModalApprove, setApprovalModalApprove] = useState(true);
  const [approvalModalRole, setApprovalModalRole] = useState<WorkspaceRole>('Participant');
  const [approvalModalNotes, setApprovalModalNotes] = useState('');
  const [approvalModalMarkVerified, setApprovalModalMarkVerified] = useState(true);

  const [historyUser, setHistoryUser] = useState<UserProfile | null>(null);
  const [auditSearch, setAuditSearch] = useState('');

  const activeDirectoryProfiles = useMemo(
    () => profiles.filter((p) => !p.trashedAt),
    [profiles]
  );

  const metrics = useMemo(() => {
    const pendingApprovals = activeDirectoryProfiles.filter(
      isPendingApprovalProfile
    ).length;
    const pendingVerifications = activeDirectoryProfiles.filter(
      (p) => (p.verificationStatus ?? (p.verified ? 'Verified' : 'Pending')) === 'Pending'
    ).length;
    const staffCount = activeDirectoryProfiles.filter((p) =>
      ['Organizer', 'Super Admin'].includes(p.role)
    ).length;
    const totalAudit =
      roleChangeLogs.length +
      approvalLogs.length +
      verificationLogs.length +
      activityLogs.length;
    return {
      total: activeDirectoryProfiles.length,
      pendingApprovals,
      pendingVerifications,
      staffCount,
      totalAudit,
    };
  }, [
    activeDirectoryProfiles,
    activityLogs.length,
    approvalLogs.length,
    roleChangeLogs.length,
    verificationLogs.length,
  ]);

  const historyCountsByUser = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of roleChangeLogs) {
      map[item.userId] = (map[item.userId] ?? 0) + 1;
    }
    for (const item of approvalLogs) {
      map[item.userId] = (map[item.userId] ?? 0) + 1;
    }
    for (const item of verificationLogs) {
      map[item.userId] = (map[item.userId] ?? 0) + 1;
    }
    return map;
  }, [approvalLogs, roleChangeLogs, verificationLogs]);

  const filteredDirectory = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return activeDirectoryProfiles
      .filter((profile) => {
        if (activeTab === 'approval-queue') {
          if (!isPendingApprovalProfile(profile)) return false;
        }
        if (activeTab === 'verification-queue') {
          const v = profile.verificationStatus ?? (profile.verified ? 'Verified' : 'Pending');
          if (verificationFilter !== 'All' && v !== verificationFilter) return false;
        } else if (verificationFilter !== 'All') {
          const v = profile.verificationStatus ?? (profile.verified ? 'Verified' : 'Pending');
          if (v !== verificationFilter) return false;
        }
        const reqRole = profile.requestedRole ?? 'Participant';
        if (requestedRoleFilter !== 'All' && reqRole !== requestedRoleFilter) {
          return false;
        }
        if (assignedRoleFilter !== 'All' && profile.role !== assignedRoleFilter) {
          return false;
        }
        if (accountStatusFilter !== 'All') {
          if (accountStatusFilter === 'Pending Approval') {
            if (!isPendingApprovalProfile(profile)) return false;
          } else if (profile.accountStatus !== accountStatusFilter) {
            return false;
          }
        }
        if (needle) {
          const haystack = [
            profile.fullName,
            profile.email,
            profile.phone,
            profile.institution,
            profile.department,
            profile.role,
            reqRole,
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      })
      .sort((left, right) => {
        const direction = sortAsc ? 1 : -1;
        const leftReq = left.requestedRole ?? 'Participant';
        const rightReq = right.requestedRole ?? 'Participant';
        const leftVer = left.verificationStatus ?? (left.verified ? 'Verified' : 'Pending');
        const rightVer = right.verificationStatus ?? (right.verified ? 'Verified' : 'Pending');

        let cmp = 0;
        switch (sortField) {
          case 'fullName':
            cmp = left.fullName.localeCompare(right.fullName);
            break;
          case 'requestedRole':
            cmp = leftReq.localeCompare(rightReq);
            break;
          case 'role':
            cmp = left.role.localeCompare(right.role);
            break;
          case 'verificationStatus':
            cmp = leftVer.localeCompare(rightVer);
            break;
          case 'accountStatus':
            cmp = left.accountStatus.localeCompare(right.accountStatus);
            break;
          case 'lastLoginAt':
            cmp =
              (left.lastLoginAt ? Date.parse(left.lastLoginAt) : 0) -
              (right.lastLoginAt ? Date.parse(right.lastLoginAt) : 0);
            break;
          case 'createdAt':
          default:
            cmp = Date.parse(left.createdAt) - Date.parse(right.createdAt);
            break;
        }
        return cmp * direction;
      });
  }, [
    accountStatusFilter,
    activeDirectoryProfiles,
    activeTab,
    assignedRoleFilter,
    requestedRoleFilter,
    searchQuery,
    sortAsc,
    sortField,
    verificationFilter,
  ]);

  const selectableIds = useMemo(
    () =>
      filteredDirectory
        .filter((p) => p.userId !== currentUserId)
        .map((p) => p.userId),
    [currentUserId, filteredDirectory]
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleSelectedIds = useMemo(
    () => selectableIds.filter((id) => selectedSet.has(id)),
    [selectableIds, selectedSet]
  );
  const allSelectableChecked =
    selectableIds.length > 0 && selectableIds.every((id) => selectedSet.has(id));

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(field === 'fullName');
    }
  };

  const toggleSelectAll = () => {
    if (allSelectableChecked) {
      const visibleSet = new Set(selectableIds);
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setSelectedIds([...new Set([...selectedIds, ...selectableIds])]);
    }
  };

  const toggleSelectOne = (userId: string) => {
    if (userId === currentUserId) return;
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleRefresh = async () => {
    if (!onRefreshData || refreshing) return;
    setRefreshing(true);
    setActionError(null);
    try {
      const error = await onRefreshData();
      if (error) setActionError(error);
      else onNotify?.('User directory and audit logs refreshed.');
    } finally {
      setRefreshing(false);
    }
  };

  const openRoleModal = (profile: UserProfile) => {
    setRoleModalUser(profile);
    setRoleModalValue(profile.role);
    setRoleModalNotes('');
    setActionError(null);
  };

  const submitRoleChange = async () => {
    if (!roleModalUser || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const err = await onAssignRole(
        roleModalUser.userId,
        roleModalValue,
        roleModalNotes.trim()
      );
      if (err) {
        setActionError(err);
        return;
      }
      setRoleModalUser(null);
    } finally {
      setBusy(false);
    }
  };

  const openVerifyModal = (profile: UserProfile, initial: VerificationStatus) => {
    setVerifyModalUser(profile);
    setVerifyModalValue(initial);
    setVerifyModalNotes('');
    setActionError(null);
  };

  const submitVerification = async () => {
    if (!verifyModalUser || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const err = await onUpdateVerification(
        verifyModalUser.userId,
        verifyModalValue,
        verifyModalNotes.trim()
      );
      if (err) {
        setActionError(err);
        return;
      }
      setVerifyModalUser(null);
    } finally {
      setBusy(false);
    }
  };

  const openApprovalModal = (profile: UserProfile, approve: boolean) => {
    setApprovalModalUser(profile);
    setApprovalModalApprove(approve);
    setApprovalModalRole(
      profile.recommendedRole ?? profile.requestedRole ?? 'Participant'
    );
    setApprovalModalNotes(profile.recommendationNotes ?? '');
    setApprovalModalMarkVerified(approve);
    setActionError(null);
  };

  const submitApprovalDecision = async () => {
    if (!approvalModalUser || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const err = await onReviewRegistration(
        approvalModalUser.userId,
        approvalModalApprove,
        approvalModalApprove ? approvalModalRole : undefined,
        approvalModalNotes.trim(),
        approvalModalApprove ? approvalModalMarkVerified : false
      );
      if (err) {
        setActionError(err);
        return;
      }
      setApprovalModalUser(null);
    } finally {
      setBusy(false);
    }
  };

  const runBulkRoleAssign = async () => {
    if (visibleSelectedIds.length === 0 || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const err = await onBulkAssignRoles(
        visibleSelectedIds,
        bulkRole,
        bulkRoleNotes.trim()
      );
      if (err) setActionError(err);
      else {
        setSelectedIds([]);
        setBulkRoleNotes('');
      }
    } finally {
      setBusy(false);
    }
  };

  const runBulkVerify = async () => {
    if (visibleSelectedIds.length === 0 || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const err = await onBulkVerifyUsers(
        visibleSelectedIds,
        bulkVerification,
        bulkVerificationNotes.trim()
      );
      if (err) setActionError(err);
      else {
        setSelectedIds([]);
        setBulkVerificationNotes('');
      }
    } finally {
      setBusy(false);
    }
  };

  const runBulkApproval = async (approve: boolean) => {
    if (visibleSelectedIds.length === 0 || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const err = await onBulkReviewRegistrations(visibleSelectedIds, approve);
      if (err) setActionError(err);
      else setSelectedIds([]);
    } finally {
      setBusy(false);
    }
  };

  const filteredRoleLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return roleChangeLogs;
    return roleChangeLogs.filter((l) =>
      [l.userName, l.userEmail, l.previousRole, l.newRole, l.changedByName, l.notes]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [auditSearch, roleChangeLogs]);

  const filteredApprovalLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return approvalLogs;
    return approvalLogs.filter((l) =>
      [
        l.userName,
        l.userEmail,
        l.action,
        l.requestedRole,
        l.assignedRole,
        l.actorName,
        l.approvalNotes,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [approvalLogs, auditSearch]);

  const filteredVerificationLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return verificationLogs;
    return verificationLogs.filter((l) =>
      [
        l.userName,
        l.userEmail,
        l.previousStatus,
        l.newStatus,
        l.verifiedByName,
        l.verificationNotes,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [auditSearch, verificationLogs]);

  const filteredActivityLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return activityLogs;
    return activityLogs.filter((l) =>
      [l.userName, l.userEmail, l.action, l.category, l.details]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [activityLogs, auditSearch]);

  const handleExportDirectoryCsv = () => {
    const ok = downloadCsv(
      `baust-super-admin-users-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Full Name',
        'Email',
        'Phone',
        'Institution',
        'Department',
        'Requested Role',
        'Assigned Role',
        'Verification Status',
        'Account Status',
        'Registration Date',
        'Last Login',
        'Audit Events',
      ],
      filteredDirectory.map((p) => [
        p.fullName,
        p.email,
        p.phone,
        p.institution,
        p.department,
        p.requestedRole ?? 'Participant',
        p.role,
        p.verificationStatus ?? (p.verified ? 'Verified' : 'Pending'),
        p.accountStatus,
        p.createdAt,
        p.lastLoginAt ?? 'Never',
        historyCountsByUser[p.userId] ?? 0,
      ])
    );
    onNotify?.(ok ? 'User management CSV exported.' : 'Could not export CSV.');
  };

  const handleExportAuditCsv = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (auditTab === 'role-changes') {
      downloadCsv(
        `baust-role-change-logs-${today}.csv`,
        ['Timestamp', 'User', 'Email', 'Previous Role', 'New Role', 'Changed By', 'Notes'],
        filteredRoleLogs.map((l) => [
          l.changedAt,
          l.userName,
          l.userEmail,
          l.previousRole,
          l.newRole,
          l.changedByName,
          l.notes,
        ])
      );
    } else if (auditTab === 'approvals') {
      downloadCsv(
        `baust-approval-logs-${today}.csv`,
        [
          'Timestamp',
          'User',
          'Email',
          'Action',
          'Requested Role',
          'Assigned Role',
          'Status Change',
          'Actor',
          'Notes',
        ],
        filteredApprovalLogs.map((l) => [
          l.createdAt,
          l.userName,
          l.userEmail,
          l.action,
          l.requestedRole,
          l.assignedRole,
          `${l.previousStatus} -> ${l.newStatus}`,
          l.actorName,
          l.approvalNotes,
        ])
      );
    } else {
      downloadCsv(
        `baust-verification-logs-${today}.csv`,
        ['Timestamp', 'User', 'Email', 'Previous Status', 'New Status', 'Verified By', 'Notes'],
        filteredVerificationLogs.map((l) => [
          l.verifiedAt,
          l.userName,
          l.userEmail,
          l.previousStatus,
          l.newStatus,
          l.verifiedByName,
          l.verificationNotes,
        ])
      );
    }
    onNotify?.('Audit report exported to CSV.');
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <UserCog className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
            <h1 className="font-display text-xl font-bold text-emerald-950 dark:text-emerald-50">
              Super Admin User &amp; Role Governance
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-200">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Super Admin Control
            </span>
          </div>
          <p className="mt-1 text-xs text-emerald-900/60 dark:text-emerald-300/65">
            Assign or override roles, review Organizer recommendations, verify applicant credentials, and inspect audit logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onRefreshData && (
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void handleRefresh()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-100 dark:hover:bg-emerald-950/50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
          <button
            type="button"
            onClick={
              activeTab === 'audit-reports'
                ? handleExportAuditCsv
                : handleExportDirectoryCsv
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 dark:bg-emerald-600"
          >
            <Download className="h-3.5 w-3.5" />
            {activeTab === 'audit-reports' ? 'Export Audit CSV' : 'Export Users CSV'}
          </button>
        </div>
      </header>

      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="User governance summary"
      >
        <StatCard
          label="Total Accounts"
          value={metrics.total.toLocaleString()}
          sublabel={`${metrics.staffCount} organizer & super admin staff`}
          icon={UserRound}
        />
        <StatCard
          label="Approval Queue"
          value={metrics.pendingApprovals.toLocaleString()}
          sublabel="Start as Participant until approved"
          icon={Clock3}
          tone="amber"
        />
        <StatCard
          label="Verification Queue"
          value={metrics.pendingVerifications.toLocaleString()}
          sublabel="Awaiting credential verification"
          icon={ClipboardCheck}
          tone="success"
        />
        <StatCard
          label="Audit Events"
          value={metrics.totalAudit.toLocaleString()}
          sublabel="Role changes, approvals & verifications"
          icon={History}
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-emerald-200/70 bg-white dark:border-emerald-800/60 dark:bg-[#061D15]">
        <div className="flex flex-col gap-3 border-b border-emerald-100 px-4 py-3.5 dark:border-emerald-800/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Super Admin user management sections"
              className="flex flex-wrap gap-1 rounded-lg bg-emerald-50/80 p-1 dark:bg-[#041811] dark:border dark:border-emerald-800/50"
            >
              {(
                [
                  { id: 'directory', label: `All Users & Roles (${activeDirectoryProfiles.length})` },
                  { id: 'approval-queue', label: `Approval Queue (${metrics.pendingApprovals})` },
                  { id: 'verification-queue', label: `Verification Queue (${metrics.pendingVerifications})` },
                  { id: 'audit-reports', label: `Audit & Activity Reports (${metrics.totalAudit})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSelectedIds([]);
                    setActionError(null);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap tabular-nums ${
                    activeTab === tab.id
                      ? 'bg-white text-emerald-950 shadow-sm dark:bg-[#0B2E22] dark:text-emerald-50'
                      : 'text-emerald-900/70 hover:text-emerald-950 dark:text-emerald-300/75 dark:hover:text-emerald-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-900/65 dark:text-emerald-300/70">
              <ShieldAlert className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
              Self role-assignment &amp; self-promotion blocked
            </span>
          </div>

          {activeTab !== 'audit-reports' ? (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
              <label className="relative block xl:col-span-2">
                <span className="sr-only">Search users</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-800/45 dark:text-emerald-200/45" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, email, phone, institution, dept…"
                  className="min-h-9 w-full rounded-lg border border-emerald-200 bg-white py-1.5 pl-8 pr-3 text-xs text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                />
              </label>

              <select
                aria-label="Filter by requested role"
                value={requestedRoleFilter}
                onChange={(e) =>
                  setRequestedRoleFilter(e.target.value as RegistrableRole | 'All')
                }
                className="min-h-9 rounded-lg border border-emerald-200 bg-white px-2.5 text-xs text-emerald-950 focus:border-emerald-600 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              >
                <option value="All">Requested: All</option>
                {REGISTRABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    Requested: {role}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by assigned role"
                value={assignedRoleFilter}
                onChange={(e) =>
                  setAssignedRoleFilter(e.target.value as WorkspaceRole | 'All')
                }
                className="min-h-9 rounded-lg border border-emerald-200 bg-white px-2.5 text-xs text-emerald-950 focus:border-emerald-600 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              >
                <option value="All">Assigned: All</option>
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    Assigned: {role}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by verification status"
                value={verificationFilter}
                onChange={(e) =>
                  setVerificationFilter(e.target.value as VerificationStatus | 'All')
                }
                className="min-h-9 rounded-lg border border-emerald-200 bg-white px-2.5 text-xs text-emerald-950 focus:border-emerald-600 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              >
                <option value="All">Verification: All</option>
                {VERIFICATION_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    Verification: {status}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by account status"
                value={accountStatusFilter}
                onChange={(e) =>
                  setAccountStatusFilter(e.target.value as ProfileAccountStatus | 'All')
                }
                className="min-h-9 rounded-lg border border-emerald-200 bg-white px-2.5 text-xs text-emerald-950 focus:border-emerald-600 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              >
                <option value="All">Status: All</option>
                <option value="Active">Active</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Rejected">Rejected</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'role-changes', label: `Role Change Logs (${roleChangeLogs.length})` },
                    { id: 'approvals', label: `Approval Logs (${approvalLogs.length})` },
                    { id: 'verifications', label: `Verification Logs (${verificationLogs.length})` },
                    { id: 'activities', label: `Activity Logs (${activityLogs.length})` },
                    { id: 'permissions', label: `Role Permissions (${rolePermissions.length})` },
                  ] as const
                ).map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setAuditTab(sub.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors tabular-nums ${
                      auditTab === sub.id
                        ? 'border-emerald-700 bg-emerald-700 text-white dark:border-emerald-500 dark:bg-emerald-600'
                        : 'border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
              <label className="relative block sm:w-72">
                <span className="sr-only">Search audit logs</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-800/45 dark:text-emerald-200/45" />
                <input
                  type="search"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search user, actor, role, notes…"
                  className="min-h-9 w-full rounded-lg border border-emerald-200 bg-white py-1.5 pl-8 pr-3 text-xs text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                />
              </label>
            </div>
          )}
        </div>

        {visibleSelectedIds.length > 0 && activeTab !== 'audit-reports' && (
          <div className="flex flex-col gap-2.5 border-b border-emerald-100 bg-emerald-50/80 px-4 py-3 text-xs dark:border-emerald-800/60 dark:bg-emerald-950/35 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 font-semibold text-emerald-950 dark:text-emerald-100 tabular-nums">
              <span>{visibleSelectedIds.length} user{visibleSelectedIds.length === 1 ? '' : 's'} selected</span>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-[11px] font-semibold text-emerald-800 underline hover:text-emerald-950 dark:text-emerald-300"
              >
                Clear
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeTab === 'approval-queue' ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runBulkApproval(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Bulk Approve Requested Roles
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runBulkApproval(false)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800/70 dark:bg-[#061D15] dark:text-red-300"
                  >
                    <X className="h-3.5 w-3.5" />
                    Bulk Reject
                  </button>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-white px-2 py-1 dark:border-emerald-800/70 dark:bg-[#041811]">
                    <select
                      aria-label="Bulk assign role"
                      value={bulkRole}
                      onChange={(e) => setBulkRole(e.target.value as WorkspaceRole)}
                      className="bg-transparent text-[11px] font-semibold text-emerald-950 focus:outline-none dark:text-emerald-50"
                    >
                      {ASSIGNABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={bulkRoleNotes}
                      onChange={(e) => setBulkRoleNotes(e.target.value)}
                      placeholder="Role note (optional)"
                      className="w-36 border-l border-emerald-100 pl-2 text-[11px] text-emerald-950 focus:outline-none dark:border-emerald-800/70 dark:bg-transparent dark:text-emerald-50"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runBulkRoleAssign()}
                      className="rounded-md bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                    >
                      Assign Role
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-white px-2 py-1 dark:border-emerald-800/70 dark:bg-[#041811]">
                    <select
                      aria-label="Bulk verification status"
                      value={bulkVerification}
                      onChange={(e) =>
                        setBulkVerification(e.target.value as VerificationStatus)
                      }
                      className="bg-transparent text-[11px] font-semibold text-emerald-950 focus:outline-none dark:text-emerald-50"
                    >
                      {VERIFICATION_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          Verify: {st}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={bulkVerificationNotes}
                      onChange={(e) => setBulkVerificationNotes(e.target.value)}
                      placeholder="Verification note"
                      className="w-32 border-l border-emerald-100 pl-2 text-[11px] text-emerald-950 focus:outline-none dark:border-emerald-800/70 dark:bg-transparent dark:text-emerald-50"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runBulkVerify()}
                      className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-100"
                    >
                      Apply Verification
                    </button>
                  </div>
                </>
              )}
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

        {activeTab === 'audit-reports' ? (
          <div className="overflow-x-auto">
            {auditTab === 'role-changes' && (
              <table className="w-full min-w-[880px] text-left">
                <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
                  <tr>
                    <th className="px-4 py-3">Changed Time</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Previous Role</th>
                    <th className="px-4 py-3">New Role</th>
                    <th className="px-4 py-3">Changed By</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50 text-xs">
                  {filteredRoleLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-emerald-900/60 dark:text-emerald-300/65">
                        No role change logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredRoleLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-emerald-50/30 dark:hover:bg-[#09291E]/50">
                        <td className="px-4 py-3 font-mono text-[11px] tabular-nums text-emerald-900/70 dark:text-emerald-300/70 whitespace-nowrap">
                          {formatDateTime(log.changedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-emerald-950 dark:text-emerald-50">{log.userName || '—'}</div>
                          <div className="text-[11px] text-emerald-900/60 dark:text-emerald-300/65">{log.userEmail}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getRoleBadgeClass(log.previousRole)}`}>
                            {log.previousRole}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getRoleBadgeClass(log.newRole)}`}>
                            {log.newRole}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-emerald-950 dark:text-emerald-100">{log.changedByName}</td>
                        <td className="px-4 py-3 text-emerald-900/75 dark:text-emerald-200/75">{log.notes || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {auditTab === 'approvals' && (
              <table className="w-full min-w-[960px] text-left">
                <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Requested → Assigned</th>
                    <th className="px-4 py-3">Status Change</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Approval Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50 text-xs">
                  {filteredApprovalLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-emerald-900/60 dark:text-emerald-300/65">
                        No approval or recommendation logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredApprovalLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-emerald-50/30 dark:hover:bg-[#09291E]/50">
                        <td className="px-4 py-3 font-mono text-[11px] tabular-nums text-emerald-900/70 dark:text-emerald-300/70 whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-emerald-950 dark:text-emerald-50">{log.userName || '—'}</div>
                          <div className="text-[11px] text-emerald-900/60 dark:text-emerald-300/65">{log.userEmail}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold capitalize text-emerald-900 dark:text-emerald-200">
                          {log.action.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3 text-emerald-950 dark:text-emerald-100">
                          {log.requestedRole} → <strong>{log.assignedRole}</strong>
                        </td>
                        <td className="px-4 py-3 text-emerald-900/75 dark:text-emerald-200/75">
                          {log.previousStatus} → {log.newStatus}
                        </td>
                        <td className="px-4 py-3 font-medium text-emerald-950 dark:text-emerald-100">{log.actorName}</td>
                        <td className="px-4 py-3 text-emerald-900/75 dark:text-emerald-200/75">{log.approvalNotes || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {auditTab === 'verifications' && (
              <table className="w-full min-w-[880px] text-left">
                <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
                  <tr>
                    <th className="px-4 py-3">Verified Time</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Previous Status</th>
                    <th className="px-4 py-3">New Status</th>
                    <th className="px-4 py-3">Verified By</th>
                    <th className="px-4 py-3">Verification Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50 text-xs">
                  {filteredVerificationLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-emerald-900/60 dark:text-emerald-300/65">
                        No verification logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredVerificationLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-emerald-50/30 dark:hover:bg-[#09291E]/50">
                        <td className="px-4 py-3 font-mono text-[11px] tabular-nums text-emerald-900/70 dark:text-emerald-300/70 whitespace-nowrap">
                          {formatDateTime(log.verifiedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-emerald-950 dark:text-emerald-50">{log.userName || '—'}</div>
                          <div className="text-[11px] text-emerald-900/60 dark:text-emerald-300/65">{log.userEmail}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getVerificationBadgeClass(log.previousStatus)}`}>
                            {log.previousStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getVerificationBadgeClass(log.newStatus)}`}>
                            {log.newStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-emerald-950 dark:text-emerald-100">{log.verifiedByName}</td>
                        <td className="px-4 py-3 text-emerald-900/75 dark:text-emerald-200/75">{log.verificationNotes || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {auditTab === 'activities' && (
              <table className="w-full min-w-[820px] text-left">
                <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50 text-xs">
                  {filteredActivityLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-emerald-900/60 dark:text-emerald-300/65">
                        No user activity events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredActivityLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-emerald-50/30 dark:hover:bg-[#09291E]/50">
                        <td className="px-4 py-3 font-mono text-[11px] tabular-nums text-emerald-900/70 dark:text-emerald-300/70 whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-emerald-950 dark:text-emerald-50">{log.userName || '—'}</div>
                          <div className="text-[11px] text-emerald-900/60 dark:text-emerald-300/65">{log.userEmail}</div>
                        </td>
                        <td className="px-4 py-3 capitalize text-emerald-900 dark:text-emerald-200">{log.category}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-emerald-950 dark:text-emerald-100">{log.action}</td>
                        <td className="px-4 py-3 text-emerald-900/75 dark:text-emerald-200/75">{log.details || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {auditTab === 'permissions' && (
              <table className="w-full min-w-[780px] text-left">
                <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
                  <tr>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Manage Users</th>
                    <th className="px-4 py-3">Approve Users</th>
                    <th className="px-4 py-3">Change Roles</th>
                    <th className="px-4 py-3">Publish Notices</th>
                    <th className="px-4 py-3">Organizer Panel</th>
                    <th className="px-4 py-3">Super Admin Panel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50 text-xs">
                  {rolePermissions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-emerald-900/60 dark:text-emerald-300/65">
                        Role permission matrix loads from Supabase when connected.
                      </td>
                    </tr>
                  ) : (
                    rolePermissions.map((perm) => (
                      <tr key={perm.role} className="hover:bg-emerald-50/30 dark:hover:bg-[#09291E]/50">
                        <td className="px-4 py-3 font-semibold text-emerald-950 dark:text-emerald-50">{perm.role}</td>
                        <td className="px-4 py-3">{perm.canManageUsers ? 'Yes' : 'No'}</td>
                        <td className="px-4 py-3">{perm.canApproveUsers ? 'Yes' : 'No'}</td>
                        <td className="px-4 py-3">{perm.canChangeRoles ? 'Yes' : 'No'}</td>
                        <td className="px-4 py-3">{perm.canPublishAnnouncements ? 'Yes' : 'No'}</td>
                        <td className="px-4 py-3">{perm.canAccessOrganizerPanel ? 'Yes' : 'No'}</td>
                        <td className="px-4 py-3">{perm.canAccessSuperAdminPanel ? 'Yes' : 'No'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        ) : filteredDirectory.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <h3 className="mt-3 text-sm font-semibold text-emerald-950 dark:text-emerald-50">
              No matching accounts in this view
            </h3>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-emerald-900/60 dark:text-emerald-300/65">
              Adjust your search or role filters to view user accounts, role requests, or verification statuses.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1440px] text-left">
              <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all selectable users"
                      checked={allSelectableChecked}
                      disabled={selectableIds.length === 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-600"
                    />
                  </th>
                  <th className="px-3 py-3">
                    <button type="button" onClick={() => toggleSort('fullName')} className="inline-flex items-center gap-1 hover:text-emerald-950 dark:hover:text-white">
                      Full Name &amp; Contact
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-3 py-3">Institution / Dept</th>
                  <th className="px-3 py-3">
                    <button type="button" onClick={() => toggleSort('requestedRole')} className="inline-flex items-center gap-1 hover:text-emerald-950 dark:hover:text-white">
                      Requested Role
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-3 py-3">
                    <button type="button" onClick={() => toggleSort('role')} className="inline-flex items-center gap-1 hover:text-emerald-950 dark:hover:text-white">
                      Assigned Role
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-3 py-3">
                    <button type="button" onClick={() => toggleSort('verificationStatus')} className="inline-flex items-center gap-1 hover:text-emerald-950 dark:hover:text-white">
                      Verification
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-3 py-3">
                    <button type="button" onClick={() => toggleSort('accountStatus')} className="inline-flex items-center gap-1 hover:text-emerald-950 dark:hover:text-white">
                      Account Status
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-3 py-3">
                    <button type="button" onClick={() => toggleSort('createdAt')} className="inline-flex items-center gap-1 hover:text-emerald-950 dark:hover:text-white">
                      Registered &amp; Last Login
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-3 py-3">History &amp; Notes</th>
                  <th className="px-3 py-3 text-right">Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50 text-xs">
                {filteredDirectory.map((profile) => {
                  const isSelf = profile.userId === currentUserId;
                  const reqRole = profile.requestedRole ?? 'Participant';
                  const verification =
                    profile.verificationStatus ??
                    (profile.verified ? 'Verified' : 'Pending');
                  const historyCount = historyCountsByUser[profile.userId] ?? 0;
                  const pendingApproval = isPendingApprovalProfile(profile);
                  const roleMismatch =
                    reqRole !== profile.role && pendingApproval;

                  return (
                    <tr
                      key={profile.userId}
                      className="text-emerald-950 hover:bg-emerald-50/30 dark:text-emerald-50 dark:hover:bg-[#09291E]/50"
                    >
                      <td className="px-3 py-3.5 align-top">
                        <input
                          type="checkbox"
                          aria-label={`Select ${profile.fullName}`}
                          disabled={isSelf}
                          checked={selectedSet.has(profile.userId)}
                          onChange={() => toggleSelectOne(profile.userId)}
                          className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-600 disabled:opacity-40"
                        />
                      </td>

                      <td className="px-3 py-3.5 align-top">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <span>{profile.fullName || 'Unnamed user'}</span>
                          {isSelf && (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200">
                              You
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-emerald-900/75 dark:text-emerald-200/75">
                          {profile.email}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] tabular-nums text-emerald-900/60 dark:text-emerald-300/65">
                          {profile.phone || 'No phone'}
                        </div>
                      </td>

                      <td className="px-3 py-3.5 align-top">
                        <div className="font-medium text-emerald-950 dark:text-emerald-100">
                          {profile.institution || '—'}
                        </div>
                        <div className="mt-0.5 text-[11px] text-emerald-900/65 dark:text-emerald-300/65">
                          {profile.department || 'No department'}
                        </div>
                      </td>

                      <td className="px-3 py-3.5 align-top">
                        <span className="inline-flex rounded-md border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-900 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-200">
                          {reqRole}
                        </span>
                        {roleMismatch && (
                          <div className="mt-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                            Requested upgrade
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3.5 align-top">
                        <span
                          className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getRoleBadgeClass(profile.role)}`}
                        >
                          {profile.role}
                        </span>
                        {profile.role === 'Organizer' && !isSelf && (
                          <div className="mt-1.5">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void onSetOrganizerPermission(
                                  profile.userId,
                                  !profile.canManageApprovals
                                )
                              }
                              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                                profile.canManageApprovals
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#041811] dark:text-slate-300'
                              }`}
                            >
                              <Sparkles className="h-2.5 w-2.5" />
                              {profile.canManageApprovals
                                ? 'Can Approve'
                                : 'Recommend Only'}
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3.5 align-top">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getVerificationBadgeClass(verification)}`}
                        >
                          {verification}
                        </span>
                      </td>

                      <td className="px-3 py-3.5 align-top">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getAccountStatusBadgeClass(profile.accountStatus, profile.trashedAt)}`}
                          >
                            {profile.trashedAt ? 'Trash' : profile.accountStatus}
                          </span>
                          {!profile.trashedAt && pendingApproval && (
                            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-300">
                              Approval: Pending
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3.5 align-top text-[11px] tabular-nums">
                        <div className="text-emerald-950 dark:text-emerald-100">
                          Reg: {formatDateTime(profile.createdAt)}
                        </div>
                        <div className="mt-0.5 text-emerald-900/60 dark:text-emerald-300/65">
                          Login: {formatDateTime(profile.lastLoginAt)}
                        </div>
                      </td>

                      <td className="px-3 py-3.5 align-top">
                        <button
                          type="button"
                          onClick={() => setHistoryUser(profile)}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-200 dark:hover:bg-emerald-900/40 tabular-nums"
                        >
                          <History className="h-3 w-3" />
                          {historyCount} event{historyCount === 1 ? '' : 's'}
                        </button>
                        {profile.recommendedAction && (
                          <div className="mt-1 max-w-[180px] text-[10px] text-emerald-900/75 dark:text-emerald-200/75">
                            Rec: <strong>{profile.recommendedAction}</strong>
                            {profile.recommendedRole ? ` (${profile.recommendedRole})` : ''}
                            {profile.recommendedByName ? ` · ${profile.recommendedByName}` : ''}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3.5 align-top text-right whitespace-nowrap">
                        {isSelf ? (
                          <span className="text-[11px] font-medium text-emerald-900/50 dark:text-emerald-300/50">
                            Protected (Self)
                          </span>
                        ) : (
                          <div className="inline-flex flex-wrap justify-end gap-1.5">
                            {pendingApproval && (
                              <>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => openApprovalModal(profile, true)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                                >
                                  <Check className="h-3 w-3" />
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => openApprovalModal(profile, false)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800/70 dark:text-red-300"
                                >
                                  <X className="h-3 w-3" />
                                  Reject
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => openRoleModal(profile)}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100"
                            >
                              <UserCog className="h-3 w-3" />
                              Change Role
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                openVerifyModal(
                                  profile,
                                  verification === 'Verified' ? 'Pending' : 'Verified'
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100"
                            >
                              <UserCheck className="h-3 w-3" />
                              Verify
                            </button>
                            {profile.accountStatus === 'Active' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void onSetAccountStatus(profile.userId, 'Suspended')
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-60 dark:border-amber-800/70 dark:text-amber-300"
                              >
                                Suspend
                              </button>
                            )}
                            {profile.accountStatus === 'Suspended' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void onSetAccountStatus(profile.userId, 'Active')
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-700 dark:text-emerald-300"
                              >
                                Reactivate
                              </button>
                            )}
                          </div>
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

      {/* Change / Override Role Modal */}
      <Modal
        open={roleModalUser !== null}
        onClose={() => setRoleModalUser(null)}
        title="Change Assigned Role"
        subtitle={
          roleModalUser
            ? `Override role for ${roleModalUser.fullName} (Requested: ${roleModalUser.requestedRole ?? 'Participant'})`
            : ''
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setRoleModalUser(null)}
              className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitRoleChange()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Save Role Assignment
            </button>
          </>
        }
      >
        {roleModalUser && (
          <div className="space-y-3 text-xs">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 dark:border-emerald-800/60 dark:bg-[#041811]">
              <div>
                Current Assigned Role: <strong>{roleModalUser.role}</strong>
              </div>
              <div className="mt-1 text-emerald-900/70 dark:text-emerald-300/70">
                Requested Role at Signup: <strong>{roleModalUser.requestedRole ?? 'Participant'}</strong>
              </div>
            </div>
            <label className="block font-semibold text-emerald-950 dark:text-emerald-100">
              New Assigned Role
              <select
                value={roleModalValue}
                onChange={(e) => setRoleModalValue(e.target.value as WorkspaceRole)}
                className="mt-1.5 block min-h-9 w-full rounded-lg border border-emerald-200 bg-white px-3 text-xs text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              >
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="block font-semibold text-emerald-950 dark:text-emerald-100">
              Audit Notes
              <textarea
                rows={3}
                value={roleModalNotes}
                onChange={(e) => setRoleModalNotes(e.target.value)}
                placeholder="Reason for promotion, demotion, or role override..."
                className="mt-1.5 block w-full rounded-lg border border-emerald-200 bg-white p-2.5 text-xs font-normal text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              />
            </label>
          </div>
        )}
      </Modal>

      {/* Verification Status Modal */}
      <Modal
        open={verifyModalUser !== null}
        onClose={() => setVerifyModalUser(null)}
        title="Update Verification Status"
        subtitle={
          verifyModalUser
            ? `Verify submitted identity & affiliation for ${verifyModalUser.fullName}`
            : ''
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setVerifyModalUser(null)}
              className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitVerification()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              <UserCheck className="h-3.5 w-3.5" />
              Save Verification
            </button>
          </>
        }
      >
        {verifyModalUser && (
          <div className="space-y-3 text-xs">
            <label className="block font-semibold text-emerald-950 dark:text-emerald-100">
              Verification Status
              <select
                value={verifyModalValue}
                onChange={(e) =>
                  setVerifyModalValue(e.target.value as VerificationStatus)
                }
                className="mt-1.5 block min-h-9 w-full rounded-lg border border-emerald-200 bg-white px-3 text-xs text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              >
                {VERIFICATION_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </label>
            <label className="block font-semibold text-emerald-950 dark:text-emerald-100">
              Verification Notes
              <textarea
                rows={3}
                value={verifyModalNotes}
                onChange={(e) => setVerifyModalNotes(e.target.value)}
                placeholder="Document check, student/faculty ID reference, or mismatch details..."
                className="mt-1.5 block w-full rounded-lg border border-emerald-200 bg-white p-2.5 text-xs font-normal text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              />
            </label>
          </div>
        )}
      </Modal>

      {/* Registration Approval / Rejection Modal */}
      <Modal
        open={approvalModalUser !== null}
        onClose={() => setApprovalModalUser(null)}
        title={
          approvalModalApprove ? 'Approve Role Request' : 'Reject Role Request'
        }
        subtitle={
          approvalModalUser
            ? `${approvalModalUser.fullName} · Requested Role: ${approvalModalUser.requestedRole ?? 'Participant'}`
            : ''
        }
        dangerHeader={!approvalModalApprove}
        footer={
          <>
            <button
              type="button"
              onClick={() => setApprovalModalUser(null)}
              className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitApprovalDecision()}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 ${
                approvalModalApprove
                  ? 'bg-emerald-700 hover:bg-emerald-600'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {approvalModalApprove ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              {approvalModalApprove ? 'Confirm Approval' : 'Confirm Rejection'}
            </button>
          </>
        }
      >
        {approvalModalUser && (
          <div className="space-y-3 text-xs">
            {approvalModalUser.recommendedAction && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-800/60 dark:bg-emerald-950/40">
                <div className="font-semibold text-emerald-950 dark:text-emerald-100">
                  Organizer Recommendation: {approvalModalUser.recommendedAction}
                  {approvalModalUser.recommendedRole
                    ? ` as ${approvalModalUser.recommendedRole}`
                    : ''}
                </div>
                {approvalModalUser.recommendationNotes && (
                  <p className="mt-1 text-emerald-900/75 dark:text-emerald-200/80">
                    “{approvalModalUser.recommendationNotes}” —{' '}
                    {approvalModalUser.recommendedByName || 'Organizer'}
                  </p>
                )}
              </div>
            )}

            {approvalModalApprove && (
              <>
                <label className="block font-semibold text-emerald-950 dark:text-emerald-100">
                  Assigned Role to Grant
                  <select
                    value={approvalModalRole}
                    onChange={(e) =>
                      setApprovalModalRole(e.target.value as WorkspaceRole)
                    }
                    className="mt-1.5 block min-h-9 w-full rounded-lg border border-emerald-200 bg-white px-3 text-xs text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                  >
                    {ASSIGNABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2 font-medium text-emerald-950 dark:text-emerald-100">
                  <input
                    type="checkbox"
                    checked={approvalModalMarkVerified}
                    onChange={(e) =>
                      setApprovalModalMarkVerified(e.target.checked)
                    }
                    className="h-4 w-4 rounded border-emerald-300 text-emerald-700"
                  />
                  Mark verification status as Verified upon approval
                </label>
              </>
            )}

            <label className="block font-semibold text-emerald-950 dark:text-emerald-100">
              Approval Notes
              <textarea
                rows={3}
                value={approvalModalNotes}
                onChange={(e) => setApprovalModalNotes(e.target.value)}
                placeholder="Decision rationale recorded in approval_logs..."
                className="mt-1.5 block w-full rounded-lg border border-emerald-200 bg-white p-2.5 text-xs font-normal text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              />
            </label>
          </div>
        )}
      </Modal>

      {/* Per-User Approval & Audit History Modal */}
      <Modal
        open={historyUser !== null}
        onClose={() => setHistoryUser(null)}
        title="Approval, Role & Verification History"
        subtitle={
          historyUser
            ? `${historyUser.fullName} · ${historyUser.email}`
            : ''
        }
        maxWidthClass="max-w-2xl"
      >
        {historyUser && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 sm:grid-cols-4 dark:border-emerald-800/60 dark:bg-[#041811]">
              <div>
                <span className="text-[10px] font-semibold uppercase text-emerald-900/55 dark:text-emerald-300/60">
                  Requested
                </span>
                <div className="mt-0.5 font-semibold">{historyUser.requestedRole ?? 'Participant'}</div>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase text-emerald-900/55 dark:text-emerald-300/60">
                  Assigned
                </span>
                <div className="mt-0.5 font-semibold">{historyUser.role}</div>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase text-emerald-900/55 dark:text-emerald-300/60">
                  Verification
                </span>
                <div className="mt-0.5 font-semibold">
                  {historyUser.verificationStatus ?? (historyUser.verified ? 'Verified' : 'Pending')}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase text-emerald-900/55 dark:text-emerald-300/60">
                  Last Login
                </span>
                <div className="mt-0.5 font-mono text-[11px]">{formatDateTime(historyUser.lastLoginAt)}</div>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {[
                ...roleChangeLogs
                  .filter((l) => l.userId === historyUser.userId)
                  .map((l) => ({
                    id: `rc-${l.id}`,
                    time: l.changedAt,
                    kind: 'Role Change',
                    summary: `${l.previousRole} → ${l.newRole}`,
                    actor: l.changedByName,
                    note: l.notes,
                  })),
                ...approvalLogs
                  .filter((l) => l.userId === historyUser.userId)
                  .map((l) => ({
                    id: `ap-${l.id}`,
                    time: l.createdAt,
                    kind: `Approval (${l.action.replace(/_/g, ' ')})`,
                    summary: `${l.previousStatus} → ${l.newStatus} (Assigned: ${l.assignedRole})`,
                    actor: l.actorName,
                    note: l.approvalNotes,
                  })),
                ...verificationLogs
                  .filter((l) => l.userId === historyUser.userId)
                  .map((l) => ({
                    id: `vr-${l.id}`,
                    time: l.verifiedAt,
                    kind: 'Verification',
                    summary: `${l.previousStatus} → ${l.newStatus}`,
                    actor: l.verifiedByName,
                    note: l.verificationNotes,
                  })),
              ]
                .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-emerald-100 p-3 dark:border-emerald-800/60"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-emerald-950 dark:text-emerald-50">
                        {entry.kind}: {entry.summary}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-emerald-900/60 dark:text-emerald-300/65">
                        {formatDateTime(entry.time)}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-emerald-900/70 dark:text-emerald-200/75">
                      By {entry.actor}
                      {entry.note ? ` · “${entry.note}”` : ''}
                    </div>
                  </div>
                ))}
              {historyCountsByUser[historyUser.userId] === undefined && (
                <p className="py-6 text-center text-emerald-900/60 dark:text-emerald-300/65">
                  No role changes, approval decisions, or verification logs recorded for this user yet.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
