import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  BadgeCheck,
  Ban,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  Edit3,
  Eye,
  KeyRound,
  Mail,
  MoreVertical,
  PauseCircle,
  Phone,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserRound,
  UsersRound,
  UserX,
  X,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { StatCard } from '../components/StatCard';
import { ProfileFieldsEditor } from './UserProfilePage';
import type {
  ApprovalStatus,
  ProfileAccountStatus,
  RegistrationRequest,
  RegistrationStatus,
  SystemUser,
  UserProfile,
  VerificationStatus,
  WorkspaceRole,
} from '../types';
import { downloadCsv } from '../utils/csvExport';
import type {
  UserBlockReason,
  UserBlockRecord,
} from '../utils/registrationStore';

type UserStatus = RegistrationStatus | 'Active' | 'Suspended' | 'Blocked';
type BlockDuration =
  | 'permanent'
  | '15m'
  | '30m'
  | '1h'
  | '6h'
  | '12h'
  | '24h'
  | '3d'
  | '7d'
  | 'custom';

interface ManagedUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: WorkspaceRole;
  requestedRole: string;
  affiliation: string;
  status: UserStatus;
  accountStatus: ProfileAccountStatus;
  approvalStatus: ApprovalStatus;
  verificationStatus: VerificationStatus;
  verified: boolean;
  registeredAt?: string;
  lastLoginAt?: string | null;
  block?: UserBlockRecord;
  profile?: UserProfile;
  isAdministrator: boolean;
  isRequest: boolean;
}

interface UsersPageProps {
  currentUser: SystemUser;
  staffUsers: SystemUser[];
  profiles: UserProfile[];
  requests: RegistrationRequest[];
  blocks: UserBlockRecord[];
  canChangeApprovalStatus?: boolean;
  isSupabaseConfigured: boolean;
  onBlockUser: (
    userId: string,
    expiresAt: string | null,
    reason: UserBlockReason,
    note: string
  ) => Promise<void> | void;
  onUnblockUser: (blockId: string) => Promise<void> | void;
  onSaveProfile: (profile: UserProfile) => void;
  onUpdateVerification: (
    userId: string,
    status: VerificationStatus,
    notes?: string
  ) => Promise<string | null> | Promise<void> | void;
  onAssignRole?: (
    userId: string,
    newRole: WorkspaceRole,
    notes?: string
  ) => Promise<string | null>;
  onResetPassword?: (userId: string) => Promise<string | null>;
  onSendResetEmail?: (email: string) => Promise<string | null>;
  onArchiveUser: (userId: string, notes?: string) => Promise<string | null>;
  onSoftDeleteUser: (
    userId: string,
    notes?: string,
    isBlockedAccount?: boolean
  ) => Promise<string | null>;
  onSetProfileStatus: (
    userId: string,
    status: 'Active' | 'Suspended'
  ) => Promise<void> | void;
  onUpdateRegistrationStatus: (
    requestId: string,
    status: 'Approved' | 'Rejected'
  ) => Promise<void> | void;
  onRefreshProfiles?: () => Promise<string | null>;
  onBulkUpdateRegistrationStatus?: (
    requestIds: string[],
    status: 'Approved' | 'Rejected'
  ) => Promise<void>;
  onBulkSetProfileStatus?: (
    userIds: string[],
    status: 'Active' | 'Suspended'
  ) => Promise<void>;
  onNotify?: (message: string) => void;
}

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

function statusStyle(status: UserStatus) {
  if (status === 'Active' || status === 'Approved') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300';
  }
  if (status === 'Rejected') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/50 dark:text-red-300';
  }
  if (status === 'Suspended') {
    return 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800/70 dark:bg-orange-950/50 dark:text-orange-300';
  }
  if (status === 'Blocked') {
    return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
  }
  return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-300';
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeZone: 'Asia/Dhaka',
  }).format(date);
}

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

function getLocalDateTimeValue(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function getLocalDateTimeMinimum() {
  const minimum = new Date(Date.now() + 60_000);
  return getLocalDateTimeValue(minimum.toISOString());
}

function isProfileInactiveLifecycle(profile?: UserProfile) {
  return Boolean(
    profile?.isDeleted ||
      profile?.isArchived ||
      profile?.accountStatus === 'Deleted' ||
      profile?.accountStatus === 'Archived'
  );
}

function getUserFromRequest(
  request: RegistrationRequest,
  profile?: UserProfile,
  block?: UserBlockRecord
): ManagedUser {
  const approvalStatus: ApprovalStatus =
    profile?.approvalStatus ??
    request.approvalStatus ??
    (request.status === 'Approved'
      ? 'Approved'
      : request.status === 'Rejected'
        ? 'Rejected'
        : 'Pending');
  const isPendingApproval = approvalStatus === 'Pending';
  const accountStatus: ProfileAccountStatus =
    profile?.accountStatus === 'Suspended'
      ? 'Suspended'
      : isPendingApproval
        ? 'Pending Approval'
        : approvalStatus === 'Approved'
          ? 'Active'
          : 'Rejected';
  const status: UserStatus =
    block && !block.endedAt
      ? 'Blocked'
      : accountStatus === 'Suspended'
        ? 'Suspended'
        : isPendingApproval
          ? 'Pending Approval'
          : approvalStatus === 'Approved'
            ? 'Approved'
            : 'Rejected';
  const verificationStatus: VerificationStatus =
    profile?.verificationStatus ??
    request.verificationStatus ??
    (profile?.verified ? 'Verified' : 'Pending');

  return {
    id: request.id,
    fullName: profile?.fullName ?? request.fullName,
    email: profile?.email ?? request.email,
    phone: profile?.phone ?? request.phone,
    role: profile?.role ?? request.assignedRole ?? request.role,
    requestedRole: profile?.requestedRole ?? request.role,
    affiliation:
      [profile?.department, profile?.institution].filter(Boolean).join(' · ') ||
      request.affiliation,
    status,
    accountStatus,
    approvalStatus,
    verificationStatus,
    verified: verificationStatus === 'Verified',
    registeredAt: request.registeredAt,
    lastLoginAt: profile?.lastLoginAt ?? request.lastLoginAt ?? null,
    block,
    profile,
    isAdministrator:
      (profile?.role ?? request.assignedRole) === 'Organizer' ||
      (profile?.role ?? request.assignedRole) === 'Super Admin',
    isRequest: true,
  };
}

function getUserFromSystemUser(
  user: SystemUser,
  profile?: UserProfile,
  block?: UserBlockRecord
): ManagedUser {
  const role = profile?.role ?? user.role;
  const isAdministrator = role === 'Organizer' || role === 'Super Admin';
  const accountStatus: ProfileAccountStatus =
    profile?.accountStatus === 'Suspended' ? 'Suspended' : 'Active';
  const status: UserStatus =
    block && !block.endedAt
      ? 'Blocked'
      : accountStatus === 'Suspended'
        ? 'Suspended'
        : 'Active';
  const verificationStatus: VerificationStatus =
    profile?.verificationStatus ?? (profile?.verified ? 'Verified' : 'Pending');

  return {
    id: user.id,
    fullName: profile?.fullName ?? user.fullName,
    email: profile?.email ?? user.email,
    phone: profile?.phone ?? user.phone,
    role,
    requestedRole: profile?.requestedRole ?? role,
    affiliation:
      [profile?.department, profile?.institution].filter(Boolean).join(' · ') ||
      user.affiliation,
    status,
    accountStatus,
    approvalStatus: profile?.approvalStatus ?? 'Approved',
    verificationStatus,
    verified: verificationStatus === 'Verified',
    registeredAt: profile?.createdAt ?? user.createdAt,
    lastLoginAt: profile?.lastLoginAt ?? null,
    block,
    profile,
    isAdministrator,
    isRequest: false,
  };
}

export function UsersPage({
  currentUser,
  staffUsers,
  profiles,
  requests,
  blocks,
  canChangeApprovalStatus = true,
  isSupabaseConfigured,
  onBlockUser,
  onUnblockUser,
  onSaveProfile,
  onUpdateVerification,
  onAssignRole,
  onResetPassword,
  onSendResetEmail,
  onArchiveUser,
  onSoftDeleteUser,
  onSetProfileStatus,
  onUpdateRegistrationStatus,
  onRefreshProfiles,
  onBulkUpdateRegistrationStatus,
  onBulkSetProfileStatus,
  onNotify,
}: UsersPageProps) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<WorkspaceRole | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'All'>('All');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  // Three-dots dropdown menu state
  const [menuState, setMenuState] = useState<{
    user: ManagedUser;
    top: number;
    left: number;
  } | null>(null);

  // Action Modals
  const [viewUser, setViewUser] = useState<ManagedUser | null>(null);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [roleTarget, setRoleTarget] = useState<ManagedUser | null>(null);
  const [nextRole, setNextRole] = useState<WorkspaceRole>('Participant');
  const [roleChangeNotes, setRoleChangeNotes] = useState('');

  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [resetWorking, setResetWorking] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<ManagedUser | null>(null);
  const [archiveNotes, setArchiveNotes] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);
  const [deleteReasonNote, setDeleteReasonNote] = useState('');

  const [userToBlock, setUserToBlock] = useState<ManagedUser | null>(null);
  const [blockDuration, setBlockDuration] = useState<BlockDuration>('1h');
  const [customExpiry, setCustomExpiry] = useState('');
  const [blockReason, setBlockReason] =
    useState<UserBlockReason>('Policy Violation');
  const [adminNote, setAdminNote] = useState('');

  const isSuperAdmin = currentUser.role === 'Super Admin';

  useEffect(() => {
    if (!menuState) return;
    const close = () => setMenuState(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuState(null);
    };
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuState]);

  const profileByUserId = useMemo(
    () => new Map(profiles.map((profile) => [profile.userId, profile])),
    [profiles]
  );

  const allUsers = useMemo(() => {
    const now = Date.now();
    const blocksByUserId = new Map(
      blocks
        .filter(
          (block) =>
            !block.endedAt &&
            (block.expiresAt === null || Date.parse(block.expiresAt) > now)
        )
        .map((block) => [block.userId, block])
    );

    const seenIds = new Set<string>();
    const list: ManagedUser[] = [];

    const currentProfile = profileByUserId.get(currentUser.id);
    if (!isProfileInactiveLifecycle(currentProfile)) {
      seenIds.add(currentUser.id);
      list.push(
        getUserFromSystemUser(
          currentUser,
          currentProfile,
          blocksByUserId.get(currentUser.id)
        )
      );
    }

    for (const user of staffUsers) {
      if (seenIds.has(user.id)) continue;
      const p = profileByUserId.get(user.id);
      if (isProfileInactiveLifecycle(p)) continue;
      seenIds.add(user.id);
      list.push(getUserFromSystemUser(user, p, blocksByUserId.get(user.id)));
    }

    for (const request of requests) {
      if (request.trashedAt || seenIds.has(request.id)) continue;
      const p = profileByUserId.get(request.id);
      if (isProfileInactiveLifecycle(p)) continue;
      seenIds.add(request.id);
      list.push(getUserFromRequest(request, p, blocksByUserId.get(request.id)));
    }

    for (const p of profiles) {
      if (seenIds.has(p.userId) || isProfileInactiveLifecycle(p) || p.trashedAt) {
        continue;
      }
      seenIds.add(p.userId);
      list.push(
        getUserFromSystemUser(
          {
            id: p.userId,
            fullName: p.fullName,
            email: p.email,
            phone: p.phone,
            role: p.role,
            affiliation: p.institution || p.department,
            badgeCode: p.userId,
            createdAt: p.createdAt,
          },
          p,
          blocksByUserId.get(p.userId)
        )
      );
    }

    return list;
  }, [blocks, currentUser, profileByUserId, profiles, requests, staffUsers]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return allUsers.filter((user) => {
      const matchesSearch =
        !normalizedQuery ||
        [
          user.fullName,
          user.email,
          user.phone,
          user.affiliation,
          user.role,
          user.requestedRole,
        ]
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
      restricted: allUsers.filter(
        (user) =>
          user.status === 'Rejected' ||
          user.status === 'Suspended' ||
          user.status === 'Blocked'
      ).length,
    }),
    [allUsers]
  );

  const canActOnUser = (user: ManagedUser) => {
    if (user.id === currentUser.id) return false;
    if (user.role === 'Super Admin') return false;
    if (user.role === 'Organizer' && !isSuperAdmin) return false;
    return true;
  };

  const canDeleteUser = (user: ManagedUser) => {
    if (!canActOnUser(user)) return false;
    const isBlockedOrSuspended =
      user.status === 'Blocked' || user.accountStatus === 'Suspended';
    if (!isSuperAdmin && isBlockedOrSuspended) return false;
    return true;
  };

  const canEditUser = (user: ManagedUser) => {
    if (!user.profile) return false;
    if (user.id === currentUser.id) return true;
    if (user.role === 'Super Admin' && !isSuperAdmin) return false;
    return true;
  };

  const selectableUsers = useMemo(
    () => filteredUsers.filter(canActOnUser),
    [filteredUsers, currentUser.id, isSuperAdmin]
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedUsers = useMemo(
    () => allUsers.filter((user) => selectedSet.has(user.id) && canActOnUser(user)),
    [allUsers, selectedSet, currentUser.id, isSuperAdmin]
  );

  const allVisibleSelected =
    selectableUsers.length > 0 &&
    selectableUsers.every((user) => selectedSet.has(user.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(selectableUsers.map((user) => user.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      const merged = new Set([
        ...selectedIds,
        ...selectableUsers.map((user) => user.id),
      ]);
      setSelectedIds([...merged]);
    }
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleRefresh = async () => {
    if (!onRefreshProfiles || refreshing) return;
    setRefreshing(true);
    try {
      const error = await onRefreshProfiles();
      onNotify?.(error ?? 'User directory synchronized.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportCsv = () => {
    const ok = downloadCsv(
      `baust-users-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Full Name',
        'Email',
        'Mobile',
        'Requested Role',
        'Assigned Role',
        'Verification Status',
        'Department / Organization',
        'Status',
        'Registered At',
        'Last Login',
      ],
      filteredUsers.map((user) => [
        user.fullName,
        user.email,
        user.phone,
        user.requestedRole,
        user.role,
        user.verificationStatus,
        user.affiliation,
        user.status,
        user.registeredAt ?? '',
        user.lastLoginAt ?? '',
      ])
    );
    onNotify?.(
      ok
        ? `Exported ${filteredUsers.length} user record${filteredUsers.length === 1 ? '' : 's'} to CSV.`
        : 'Could not export CSV in this browser.'
    );
  };

  const runUserAction = async (
    userId: string,
    fn: () => Promise<unknown> | unknown
  ) => {
    setBusyUserId(userId);
    try {
      await fn();
    } finally {
      setBusyUserId(null);
    }
  };

  const runBulkApprove = async (approve: boolean) => {
    const targets = selectedUsers.filter((user) =>
      approve
        ? user.isRequest &&
          (user.status === 'Pending Approval' || user.status === 'Rejected')
        : user.isRequest && user.status === 'Pending Approval'
    );
    if (targets.length === 0) return;
    setBulkBusy(true);
    try {
      if (onBulkUpdateRegistrationStatus) {
        await onBulkUpdateRegistrationStatus(
          targets.map((user) => user.id),
          approve ? 'Approved' : 'Rejected'
        );
      } else {
        for (const target of targets) {
          await onUpdateRegistrationStatus(
            target.id,
            approve ? 'Approved' : 'Rejected'
          );
        }
      }
      setSelectedIds([]);
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkStatus = async (nextStatus: 'Active' | 'Suspended') => {
    const targets = selectedUsers.filter((user) =>
      nextStatus === 'Suspended'
        ? user.accountStatus === 'Active'
        : user.accountStatus === 'Suspended'
    );
    if (targets.length === 0) return;
    setBulkBusy(true);
    try {
      if (onBulkSetProfileStatus) {
        await onBulkSetProfileStatus(
          targets.map((user) => user.id),
          nextStatus
        );
      } else {
        for (const target of targets) {
          await onSetProfileStatus(target.id, nextStatus);
        }
      }
      setSelectedIds([]);
    } finally {
      setBulkBusy(false);
    }
  };

  const openActionMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    user: ManagedUser
  ) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 220;
    const estimatedHeight = 360;
    const openUpward = rect.bottom + estimatedHeight > window.innerHeight;
    const top = openUpward
      ? Math.max(12, rect.top - estimatedHeight)
      : Math.min(window.innerHeight - 40, rect.bottom + 6);
    const left = Math.max(
      12,
      Math.min(window.innerWidth - menuWidth - 12, rect.right - menuWidth)
    );
    setMenuState((prev) =>
      prev?.user.id === user.id ? null : { user, top, left }
    );
  };

  const confirmArchive = async () => {
    if (!archiveTarget || !canActOnUser(archiveTarget)) return;
    await runUserAction(archiveTarget.id, async () => {
      const err = await onArchiveUser(archiveTarget.id, archiveNotes.trim());
      if (err) {
        onNotify?.(err);
      } else {
        setArchiveTarget(null);
        setArchiveNotes('');
      }
    });
  };

  const confirmSoftDelete = async () => {
    if (!deleteTarget || !canDeleteUser(deleteTarget) || !deleteConfirmChecked) {
      return;
    }
    const isBlockedAccount =
      deleteTarget.status === 'Blocked' ||
      deleteTarget.accountStatus === 'Suspended';
    await runUserAction(deleteTarget.id, async () => {
      const err = await onSoftDeleteUser(
        deleteTarget.id,
        deleteReasonNote.trim(),
        isBlockedAccount
      );
      if (err) {
        onNotify?.(err);
      } else {
        setDeleteTarget(null);
        setDeleteStep(1);
        setDeleteConfirmChecked(false);
        setDeleteReasonNote('');
      }
    });
  };

  const confirmRoleChange = async () => {
    if (
      !roleTarget ||
      !onAssignRole ||
      !isSuperAdmin ||
      roleTarget.id === currentUser.id
    ) {
      return;
    }
    await runUserAction(roleTarget.id, async () => {
      const err = await onAssignRole(
        roleTarget.id,
        nextRole,
        roleChangeNotes.trim()
      );
      if (err) {
        onNotify?.(err);
      } else {
        setRoleTarget(null);
        setRoleChangeNotes('');
      }
    });
  };

  const confirmBlock = async () => {
    if (!userToBlock || !canActOnUser(userToBlock)) {
      return;
    }
    if (
      blockDuration === 'custom' &&
      (!customExpiry || Number.isNaN(Date.parse(customExpiry)))
    ) {
      return;
    }
    const durationMs: Partial<Record<BlockDuration, number>> = {
      '15m': 15 * 60_000,
      '30m': 30 * 60_000,
      '1h': 60 * 60_000,
      '6h': 6 * 60 * 60_000,
      '12h': 12 * 60 * 60_000,
      '24h': 24 * 60 * 60_000,
      '3d': 3 * 24 * 60 * 60_000,
      '7d': 7 * 24 * 60 * 60_000,
    };
    const expiresAt =
      blockDuration === 'permanent'
        ? null
        : blockDuration === 'custom'
          ? new Date(customExpiry).toISOString()
          : new Date(
              Date.now() + (durationMs[blockDuration] ?? 0)
            ).toISOString();
    if (expiresAt !== null && Date.parse(expiresAt) <= Date.now()) return;
    await onBlockUser(userToBlock.id, expiresAt, blockReason, adminNote.trim());
    setUserToBlock(null);
    setCustomExpiry('');
    setAdminNote('');
  };

  const pendingSelectedCount = selectedUsers.filter(
    (user) => user.isRequest && user.status === 'Pending Approval'
  ).length;
  const activeSelectedCount = selectedUsers.filter(
    (user) => user.accountStatus === 'Active'
  ).length;
  const suspendedSelectedCount = selectedUsers.filter(
    (user) => user.accountStatus === 'Suspended'
  ).length;

  return (
    <div className="space-y-5 pb-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UsersRound className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
            <h1 className="font-display text-xl font-bold text-emerald-950 dark:text-emerald-50">
              Users
            </h1>
          </div>
          <p className="mt-1 text-xs text-emerald-900/60 dark:text-emerald-300/65">
            Enterprise account directory for viewing, editing, verifying, approving, suspending, blocking, archiving, and soft-deleting users.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSupabaseConfigured && onRefreshProfiles && (
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
            {currentUser.role}
          </span>
        </div>
      </header>

      <section
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="User account statistics"
      >
        <StatCard
          label="Total Active Directory"
          value={counts.total.toLocaleString()}
          sublabel="Excludes deleted & archived accounts"
          icon={UsersRound}
        />
        <StatCard
          label="Active Users"
          value={counts.active.toLocaleString()}
          sublabel="Active profiles & approved roles"
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Pending Approval"
          value={counts.pending.toLocaleString()}
          sublabel="Awaiting approval review"
          icon={Clock3}
          tone="amber"
        />
        <StatCard
          label="Restricted / Rejected"
          value={counts.restricted.toLocaleString()}
          sublabel="Suspended, blocked, or rejected"
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
            <p className="mt-0.5 text-[11px] text-emerald-900/60 dark:text-emerald-300/65 tabular-nums">
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
                placeholder="Search name, email, phone, role…"
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
                    ASSIGNABLE_ROLES.includes(role as WorkspaceRole)
                  ) {
                    setRoleFilter(role as WorkspaceRole | 'All');
                  }
                }}
                className="min-h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              >
                <option value="All">All roles</option>
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
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
                      'Suspended',
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
                <option value="Suspended">Suspended</option>
                <option value="Rejected">Rejected</option>
                <option value="Blocked">Blocked</option>
              </select>
            </label>
          </div>
        </div>

        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50/80 px-4 py-2.5 text-xs dark:border-emerald-800/60 dark:bg-emerald-950/35">
            <span className="font-semibold text-emerald-950 dark:text-emerald-100 tabular-nums">
              {selectedUsers.length} account{selectedUsers.length === 1 ? '' : 's'} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {pendingSelectedCount > 0 && canChangeApprovalStatus && (
                <>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => void runBulkApprove(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Approve ({pendingSelectedCount})
                  </button>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => void runBulkApprove(false)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800/70 dark:bg-[#061D15] dark:text-red-300"
                  >
                    <X className="h-3.5 w-3.5" />
                    Reject ({pendingSelectedCount})
                  </button>
                </>
              )}
              {activeSelectedCount > 0 && (
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => void runBulkStatus('Suspended')}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-60 dark:border-amber-800/70 dark:bg-[#061D15] dark:text-amber-300"
                >
                  <PauseCircle className="h-3.5 w-3.5" />
                  Suspend ({activeSelectedCount})
                </button>
              )}
              {suspendedSelectedCount > 0 && (
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => void runBulkStatus('Active')}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-300"
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  Reactivate ({suspendedSelectedCount})
                </button>
              )}
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
            <table className="w-full min-w-[1060px] text-left">
              <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all manageable users"
                      checked={allVisibleSelected}
                      disabled={selectableUsers.length === 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-600"
                    />
                  </th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">Assigned / Requested</th>
                  <th className="px-4 py-3">Department / Org</th>
                  <th className="px-4 py-3">Verification &amp; Status</th>
                  <th className="px-4 py-3">Registered</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50">
                {filteredUsers.map((user) => {
                  const manageable = canActOnUser(user);
                  const rowBusy = busyUserId === user.id || bulkBusy;
                  const menuOpen = menuState?.user.id === user.id;

                  return (
                    <tr
                      key={user.id}
                      className="text-xs text-emerald-950 hover:bg-emerald-50/30 dark:text-emerald-50 dark:hover:bg-[#09291E]/40"
                    >
                      <td className="px-4 py-3.5">
                        <input
                          type="checkbox"
                          aria-label={`Select ${user.fullName}`}
                          disabled={!manageable}
                          checked={manageable && selectedSet.has(user.id)}
                          onChange={() => toggleSelectUser(user.id)}
                          className="h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-600 disabled:opacity-40"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold">
                          {user.fullName}
                          {user.id === currentUser.id && (
                            <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200">
                              You
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                          {user.email}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] tabular-nums">
                        {user.phone || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          {user.isAdministrator && (
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                          )}
                          {user.role}
                        </span>
                        {user.requestedRole !== user.role && (
                          <span className="mt-0.5 block text-[10px] text-emerald-900/55 dark:text-emerald-300/60">
                            Requested: {user.requestedRole}
                          </span>
                        )}
                      </td>
                      <td
                        className="max-w-52 truncate px-4 py-3.5"
                        title={user.affiliation}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-emerald-800/45 dark:text-emerald-200/45" />
                          <span className="truncate">
                            {user.affiliation || '—'}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold ${
                              user.status === 'Blocked'
                                ? user.block?.expiresAt
                                  ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
                                  : 'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200'
                                : statusStyle(user.status)
                            }`}
                          >
                            {user.status === 'Blocked'
                              ? user.block?.expiresAt
                                ? 'Temp Blocked'
                                : 'Perm Blocked'
                              : user.status}
                          </span>
                          <span className="text-[10px] text-emerald-900/60 dark:text-emerald-300/65">
                            Verification: {user.verificationStatus}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-emerald-900/65 dark:text-emerald-300/70">
                        {formatDate(user.registeredAt)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setViewUser(user)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-emerald-950/50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>
                          <button
                            type="button"
                            disabled={rowBusy}
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            aria-label={`Actions for ${user.fullName}`}
                            onClick={(e) => openActionMenu(e, user)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-900 transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100 dark:hover:bg-emerald-950/60"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
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

      {/* Fixed Viewport-Safe Three-Dots Actions Menu */}
      {menuState && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{ top: `${menuState.top}px`, left: `${menuState.left}px` }}
          className="fixed z-50 w-56 rounded-xl border border-emerald-200 bg-white p-1.5 shadow-xl dark:border-emerald-800/80 dark:bg-[#052017]"
        >
          {(() => {
            const target = menuState.user;
            const manageable = canActOnUser(target);
            const editable = canEditUser(target);
            const deletable = canDeleteUser(target);
            const closeMenu = () => setMenuState(null);

            return (
              <div className="space-y-0.5 text-xs">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setViewUser(target);
                    closeMenu();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-emerald-950 hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-emerald-900/50"
                >
                  <Eye className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                  View User
                </button>

                {editable && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setEditUser(target);
                      closeMenu();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-emerald-950 hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-emerald-900/50"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                    Edit User
                  </button>
                )}

                {manageable && (
                  <>
                    <div className="my-1 border-t border-emerald-100 dark:border-emerald-800/60" />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        const nextVer: VerificationStatus =
                          target.verificationStatus === 'Verified'
                            ? 'Pending'
                            : 'Verified';
                        closeMenu();
                        void runUserAction(target.id, () =>
                          onUpdateVerification(
                            target.id,
                            nextVer,
                            nextVer === 'Verified'
                              ? 'Verified from Users directory'
                              : 'Verification reset to Pending'
                          )
                        );
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-emerald-950 hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-emerald-900/50"
                    >
                      <BadgeCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                      {target.verificationStatus === 'Verified'
                        ? 'Mark Unverified'
                        : 'Verify User'}
                    </button>

                    {canChangeApprovalStatus &&
                      target.isRequest &&
                      (target.approvalStatus === 'Pending' ||
                        target.approvalStatus === 'Rejected') && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            closeMenu();
                            void runUserAction(target.id, () =>
                              onUpdateRegistrationStatus(target.id, 'Approved')
                            );
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {target.approvalStatus === 'Rejected'
                            ? 'Re-approve User'
                            : 'Approve User'}
                        </button>
                      )}

                    {canChangeApprovalStatus &&
                      target.isRequest &&
                      target.approvalStatus === 'Pending' && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            closeMenu();
                            void runUserAction(target.id, () =>
                              onUpdateRegistrationStatus(target.id, 'Rejected')
                            );
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/50"
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject User
                        </button>
                      )}

                    {isSuperAdmin && onAssignRole && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setRoleTarget(target);
                          setNextRole(target.role);
                          setRoleChangeNotes('');
                          closeMenu();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-emerald-950 hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-emerald-900/50"
                      >
                        <UserCog className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                        Change Role
                      </button>
                    )}

                    {onResetPassword && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setResetTarget(target);
                          setTempPassword(null);
                          closeMenu();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-emerald-950 hover:bg-emerald-50 dark:text-emerald-100 dark:hover:bg-emerald-900/50"
                      >
                        <KeyRound className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                        Reset Password
                      </button>
                    )}

                    <div className="my-1 border-t border-emerald-100 dark:border-emerald-800/60" />

                    {target.status !== 'Blocked' && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          const nextStatus =
                            target.accountStatus === 'Suspended'
                              ? 'Active'
                              : 'Suspended';
                          closeMenu();
                          void runUserAction(target.id, () =>
                            onSetProfileStatus(target.id, nextStatus)
                          );
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-orange-800 hover:bg-orange-50 dark:text-orange-300 dark:hover:bg-orange-950/40"
                      >
                        {target.accountStatus === 'Suspended' ? (
                          <>
                            <PlayCircle className="h-3.5 w-3.5" />
                            Reactivate User
                          </>
                        ) : (
                          <>
                            <PauseCircle className="h-3.5 w-3.5" />
                            Suspend User
                          </>
                        )}
                      </button>
                    )}

                    {target.status === 'Blocked' && target.block ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          closeMenu();
                          void runUserAction(target.id, () =>
                            onUnblockUser(target.block!.id)
                          );
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Unblock User
                      </button>
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserToBlock(target);
                          setBlockDuration('1h');
                          setBlockReason('Policy Violation');
                          setAdminNote('');
                          setCustomExpiry('');
                          closeMenu();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-amber-800 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Block User
                      </button>
                    )}

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setArchiveTarget(target);
                        setArchiveNotes('');
                        closeMenu();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/60"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      Archive User
                    </button>

                    {deletable ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setDeleteTarget(target);
                          setDeleteStep(1);
                          setDeleteConfirmChecked(false);
                          setDeleteReasonNote('');
                          closeMenu();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-semibold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete User
                      </button>
                    ) : (
                      <div className="px-2.5 py-1.5 text-[10px] text-emerald-900/55 dark:text-emerald-300/55">
                        Super Admin required to delete blocked/staff accounts
                      </div>
                    )}
                  </>
                )}

                {!manageable && (
                  <div className="mt-1 border-t border-emerald-100 px-2.5 py-1.5 text-[10px] text-emerald-900/55 dark:border-emerald-800/60 dark:text-emerald-300/55">
                    {target.id === currentUser.id
                      ? 'Self-modification of role/status is disabled'
                      : 'Protected role'}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* View User Modal */}
      <Modal
        open={viewUser !== null}
        onClose={() => setViewUser(null)}
        title="User Account Details"
        subtitle={
          viewUser ? `${viewUser.role} · ${viewUser.status}` : undefined
        }
        maxWidthClass="max-w-xl"
      >
        {viewUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/40">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                <UserRound className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-emerald-950 dark:text-emerald-50">
                  {viewUser.fullName}
                </p>
                <p className="mt-0.5 text-xs text-emerald-900/65 dark:text-emerald-200/70">
                  Assigned: {viewUser.role} · Requested: {viewUser.requestedRole}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-100 p-3 dark:border-emerald-800/60">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-200/60">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </div>
                <p className="mt-1.5 break-all text-xs font-medium text-emerald-950 dark:text-emerald-50">
                  {viewUser.email}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-100 p-3 dark:border-emerald-800/60">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-200/60">
                  <Phone className="h-3.5 w-3.5" />
                  Phone
                </div>
                <p className="mt-1.5 font-mono text-xs font-medium text-emerald-950 dark:text-emerald-50">
                  {viewUser.phone || '—'}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-100 p-3 dark:border-emerald-800/60">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-200/60">
                  Verification &amp; Approval
                </div>
                <p className="mt-1.5 text-xs font-medium text-emerald-950 dark:text-emerald-50">
                  {viewUser.verificationStatus} · {viewUser.approvalStatus}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-100 p-3 dark:border-emerald-800/60">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-200/60">
                  Department / Institution
                </div>
                <p className="mt-1.5 text-xs font-medium text-emerald-950 dark:text-emerald-50">
                  {viewUser.affiliation || '—'}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-100 p-3 dark:border-emerald-800/60">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-200/60">
                  Registered Date
                </div>
                <p className="mt-1.5 text-xs font-medium tabular-nums text-emerald-950 dark:text-emerald-50">
                  {formatDateTime(viewUser.registeredAt)}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-100 p-3 dark:border-emerald-800/60">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-200/60">
                  Last Login
                </div>
                <p className="mt-1.5 text-xs font-medium tabular-nums text-emerald-950 dark:text-emerald-50">
                  {formatDateTime(viewUser.lastLoginAt)}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={editUser !== null}
        onClose={() => setEditUser(null)}
        title={`Edit ${editUser?.fullName ?? 'User'}`}
        subtitle={editUser?.email}
        maxWidthClass="max-w-3xl"
      >
        {editUser?.profile && (
          <ProfileFieldsEditor
            key={editUser.id}
            profile={editUser.profile}
            onSave={(updated) => {
              onSaveProfile(updated);
              setEditUser(null);
            }}
            submitLabel="Save User Changes"
          />
        )}
      </Modal>

      {/* Change Role Modal (Super Admin Only) */}
      <Modal
        open={roleTarget !== null}
        onClose={() => setRoleTarget(null)}
        title="Change Assigned Role"
        subtitle={
          roleTarget ? `${roleTarget.fullName} (${roleTarget.email})` : undefined
        }
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setRoleTarget(null)}
              className="rounded-lg border border-emerald-200 px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!roleTarget || busyUserId === roleTarget.id}
              onClick={() => void confirmRoleChange()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              <UserCog className="h-3.5 w-3.5" />
              Save Role Assignment
            </button>
          </>
        }
      >
        {roleTarget && (
          <div className="space-y-4 text-xs">
            <label className="block font-semibold text-emerald-950 dark:text-emerald-50">
              Assigned Role
              <select
                value={nextRole}
                onChange={(e) => setNextRole(e.target.value as WorkspaceRole)}
                className="mt-1.5 h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 text-xs text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              >
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="block font-semibold text-emerald-950 dark:text-emerald-50">
              Governance Note (optional)
              <input
                type="text"
                value={roleChangeNotes}
                onChange={(e) => setRoleChangeNotes(e.target.value)}
                placeholder="Reason for promotion, demotion, or override…"
                className="mt-1.5 h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 text-xs text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              />
            </label>
          </div>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        open={resetTarget !== null}
        onClose={() => {
          setResetTarget(null);
          setTempPassword(null);
        }}
        title="Reset User Password"
        subtitle={
          resetTarget ? `${resetTarget.fullName} (${resetTarget.email})` : undefined
        }
        maxWidthClass="max-w-md"
        footer={
          resetTarget && !tempPassword ? (
            <>
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="rounded-lg border border-emerald-200 px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100"
              >
                Cancel
              </button>
              {isSupabaseConfigured && onSendResetEmail && (
                <button
                  type="button"
                  disabled={resetWorking}
                  onClick={() => {
                    setResetWorking(true);
                    void onSendResetEmail(resetTarget.email).finally(() =>
                      setResetWorking(false)
                    );
                  }}
                  className="rounded-lg border border-emerald-200 px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100"
                >
                  Send Recovery Email
                </button>
              )}
              {onResetPassword && (
                <button
                  type="button"
                  disabled={resetWorking}
                  onClick={() => {
                    setResetWorking(true);
                    void onResetPassword(resetTarget.id)
                      .then((pw) => {
                        if (pw) setTempPassword(pw);
                      })
                      .finally(() => setResetWorking(false));
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  {resetWorking ? 'Generating…' : 'Generate Temp Password'}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setResetTarget(null);
                setTempPassword(null);
              }}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
            >
              Done
            </button>
          )
        }
      >
        {tempPassword ? (
          <div className="space-y-3 text-xs">
            <p className="text-emerald-900/80 dark:text-emerald-200/80">
              Share this one-time temporary password securely with the user:
            </p>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-800/70 dark:bg-emerald-950/50">
              <code className="font-mono text-xs font-bold text-emerald-950 dark:text-emerald-100">
                {tempPassword}
              </code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(tempPassword);
                  onNotify?.('Temporary password copied to clipboard.');
                }}
                className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-[#041811] dark:text-emerald-200"
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">
            Resetting the password replaces the user’s current sign-in credential with a generated temporary password or sends a password recovery email.
          </p>
        )}
      </Modal>

      {/* Archive User Modal */}
      <Modal
        open={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        title="Archive user account?"
        subtitle={
          archiveTarget
            ? `${archiveTarget.fullName} (${archiveTarget.email})`
            : undefined
        }
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setArchiveTarget(null)}
              className="rounded-lg border border-emerald-200 px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!archiveTarget || busyUserId === archiveTarget.id}
              onClick={() => void confirmArchive()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              <Archive className="h-3.5 w-3.5" />
              Archive to Recycle Bin
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <p className="leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">
            Archiving moves this user out of the active directory into{' '}
            <strong>Recycle Bin → Archived Items</strong> and pauses portal sign-in until restored by a Super Admin.
          </p>
          <label className="block font-semibold text-emerald-950 dark:text-emerald-50">
            Archive Note (optional)
            <input
              type="text"
              value={archiveNotes}
              onChange={(e) => setArchiveNotes(e.target.value)}
              placeholder="Reason for archiving…"
              className="mt-1.5 h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 text-xs text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
            />
          </label>
        </div>
      </Modal>

      {/* Two-Step Delete User Modal (Soft-Delete by Default) */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteStep(1);
          setDeleteConfirmChecked(false);
        }}
        title={
          deleteStep === 1
            ? 'Delete User — Step 1: Review Warning'
            : 'Delete User — Step 2: Confirm Deletion'
        }
        subtitle={
          deleteTarget
            ? `${deleteTarget.fullName} (${deleteTarget.email})`
            : undefined
        }
        dangerHeader
        maxWidthClass="max-w-lg"
        footer={
          deleteStep === 1 ? (
            <>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-emerald-200 px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setDeleteStep(2)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                Continue to Confirmation
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setDeleteStep(1)}
                className="rounded-lg border border-emerald-200 px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100"
              >
                Back
              </button>
              <button
                type="button"
                disabled={
                  !deleteConfirmChecked ||
                  !deleteTarget ||
                  busyUserId === deleteTarget.id
                }
                onClick={() => void confirmSoftDelete()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {busyUserId === deleteTarget?.id
                  ? 'Deleting…'
                  : 'Soft-Delete User to Recycle Bin'}
              </button>
            </>
          )
        }
      >
        {deleteTarget && (
          <div className="space-y-4 text-xs">
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-red-900 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <p className="font-semibold leading-relaxed">
                This action will permanently remove the user's account, profile, role assignments, approval history, and authentication record.
              </p>
            </div>

            {deleteStep === 1 ? (
              <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/60 p-3 leading-relaxed text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                By default, deleting a user moves the account to{' '}
                <strong>Recycle Bin → Deleted Items</strong> (soft delete) with{' '}
                <code className="font-mono">account_status = Deleted</code>. Only a Super Admin can permanently purge or restore deleted accounts from the Recycle Bin.
              </div>
            ) : (
              <div className="space-y-3">
                <label className="flex items-start gap-2.5 rounded-lg border border-emerald-200/80 p-3 dark:border-emerald-800/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteConfirmChecked}
                    onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="leading-relaxed text-emerald-950 dark:text-emerald-100">
                    I confirm soft-deleting{' '}
                    <strong>{deleteTarget.fullName}</strong> (
                    {deleteTarget.email}) and logging this action in the audit trail.
                  </span>
                </label>

                <label className="block font-semibold text-emerald-950 dark:text-emerald-50">
                  Deletion Reason (optional)
                  <input
                    type="text"
                    value={deleteReasonNote}
                    onChange={(e) => setDeleteReasonNote(e.target.value)}
                    placeholder="Reason for deleting user…"
                    className="mt-1.5 h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 text-xs text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                  />
                </label>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Block User Modal */}
      <Modal
        open={userToBlock !== null}
        onClose={() => setUserToBlock(null)}
        title="Block user access?"
        subtitle="This action immediately signs out the user and prevents future sign-in until the block is lifted."
        dangerHeader
        maxWidthClass="max-w-xl"
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
              onClick={() => void confirmBlock()}
              disabled={
                blockDuration === 'custom' &&
                (!customExpiry || Date.parse(customExpiry) <= Date.now())
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500"
            >
              <Ban className="h-3.5 w-3.5" />
              {blockDuration === 'permanent'
                ? 'Block permanently'
                : 'Confirm block'}
            </button>
          </>
        }
      >
        {userToBlock && (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs dark:border-emerald-800/60 dark:bg-emerald-950/20 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-300/60">
                  User
                </p>
                <p className="mt-1 font-semibold text-emerald-950 dark:text-emerald-50">
                  {userToBlock.fullName}
                </p>
                <p className="mt-0.5 break-all text-emerald-900/65 dark:text-emerald-200/65">
                  {userToBlock.email}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-300/60">
                  Role &amp; current status
                </p>
                <p className="mt-1 font-semibold text-emerald-950 dark:text-emerald-50">
                  {userToBlock.role}
                </p>
                <p className="mt-0.5 text-emerald-900/65 dark:text-emerald-200/65">
                  {userToBlock.status}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-emerald-950 dark:text-emerald-50">
                Block duration
                <select
                  value={blockDuration}
                  onChange={(event) =>
                    setBlockDuration(event.target.value as BlockDuration)
                  }
                  className="mt-1.5 min-h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-normal text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                >
                  <option value="permanent">Block Permanently</option>
                  <option value="15m">Block for 15 Minutes</option>
                  <option value="30m">Block for 30 Minutes</option>
                  <option value="1h">Block for 1 Hour</option>
                  <option value="6h">Block for 6 Hours</option>
                  <option value="12h">Block for 12 Hours</option>
                  <option value="24h">Block for 24 Hours</option>
                  <option value="3d">Block for 3 Days</option>
                  <option value="7d">Block for 7 Days</option>
                  <option value="custom">Custom date &amp; time</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-emerald-950 dark:text-emerald-50">
                Block reason
                <select
                  value={blockReason}
                  onChange={(event) =>
                    setBlockReason(event.target.value as UserBlockReason)
                  }
                  className="mt-1.5 min-h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-normal text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                >
                  <option>Spam</option>
                  <option>Misconduct</option>
                  <option>Fake Registration</option>
                  <option>Security Violation</option>
                  <option>Policy Violation</option>
                  <option>Other</option>
                </select>
              </label>
            </div>

            {blockDuration === 'custom' && (
              <label className="block text-xs font-semibold text-emerald-950 dark:text-emerald-50">
                Block until
                <input
                  type="datetime-local"
                  value={customExpiry}
                  min={getLocalDateTimeMinimum()}
                  onChange={(event) => setCustomExpiry(event.target.value)}
                  className="mt-1.5 min-h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-normal text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                />
              </label>
            )}

            <label className="block text-xs font-semibold text-emerald-950 dark:text-emerald-50">
              Organizer note{' '}
              <span className="font-normal text-emerald-900/55 dark:text-emerald-300/55">
                (optional)
              </span>
              <textarea
                rows={3}
                maxLength={500}
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                placeholder="Add context for the audit record…"
                className="mt-1.5 w-full resize-y rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-normal text-emerald-950 outline-none placeholder:text-emerald-900/40 focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
              />
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
