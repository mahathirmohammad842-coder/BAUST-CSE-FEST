import { useMemo, useState } from 'react';
import {
  BadgeCheck,
  Ban,
  Building2,
  Download,
  Eye,
  History,
  KeyRound,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { ProfileFieldsEditor } from './UserProfilePage';
import type {
  ProfileAccountStatus,
  ProfileAuditEvent,
  UserProfile,
  WorkspaceRole,
} from '../types';
import { downloadCsv } from '../utils/csvExport';
import type {
  UserBlockReason,
  UserBlockRecord,
} from '../utils/registrationStore';

type BlockDuration = 'permanent' | '15m' | '1h' | '24h' | '7d';
type StatusFilter =
  | 'All'
  | 'Active'
  | 'Pending Approval'
  | 'Suspended'
  | 'Rejected'
  | 'Blocked';
type VerificationFilter = 'All' | 'Verified' | 'Not verified';

interface ProfileManagementPageProps {
  profiles: UserProfile[];
  blocks: UserBlockRecord[];
  events?: ProfileAuditEvent[];
  canManage: boolean;
  canVerify: boolean;
  currentUserRole: WorkspaceRole;
  onSaveProfile: (profile: UserProfile) => void;
  onSetVerified: (userId: string, verified: boolean) => Promise<void> | void;
  onSetStatus: (
    userId: string,
    status: ProfileAccountStatus
  ) => Promise<void> | void;
  onBlock: (
    userId: string,
    expiresAt: string | null,
    reason: UserBlockReason,
    note: string
  ) => Promise<void> | void;
  onUnblock: (blockId: string) => Promise<void> | void;
  onResetPassword: (userId: string) => Promise<string | null>;
  onSendResetEmail?: (email: string) => Promise<string | null>;
  onRefreshProfiles?: () => Promise<string | null>;
  onNotify?: (message: string) => void;
  canPromoteToOrganizer: boolean;
  currentUserId: string;
  onPromoteToOrganizer: (userId: string) => Promise<string | null>;
}

const durationOptions: { value: BlockDuration; label: string; ms: number }[] = [
  { value: 'permanent', label: 'Permanent', ms: 0 },
  { value: '15m', label: '15 minutes', ms: 15 * 60_000 },
  { value: '1h', label: '1 hour', ms: 60 * 60_000 },
  { value: '24h', label: '24 hours', ms: 24 * 60 * 60_000 },
  { value: '7d', label: '7 days', ms: 7 * 24 * 60 * 60_000 },
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeZone: 'Asia/Dhaka',
  }).format(date);
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

function activeBlock(profile: UserProfile, blocks: UserBlockRecord[]) {
  return blocks.find(
    (block) =>
      block.userId === profile.userId &&
      !block.endedAt &&
      (block.expiresAt === null || Date.parse(block.expiresAt) > Date.now())
  );
}

export function ProfileManagementPage({
  profiles,
  blocks,
  events = [],
  canManage,
  canVerify,
  currentUserRole,
  onSaveProfile,
  onSetVerified,
  onSetStatus,
  onBlock,
  onUnblock,
  onResetPassword,
  onSendResetEmail,
  onRefreshProfiles,
  onNotify,
  canPromoteToOrganizer,
  currentUserId,
  onPromoteToOrganizer,
}: ProfileManagementPageProps) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [verificationFilter, setVerificationFilter] =
    useState<VerificationFilter>('All');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null
  );
  const [blockDuration, setBlockDuration] = useState<BlockDuration>('1h');
  const [blockReason, setBlockReason] =
    useState<UserBlockReason>('Policy Violation');
  const [blockNote, setBlockNote] = useState('');
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserProfile | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetEmailSent, setResetEmailSent] = useState<string | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<UserProfile | null>(null);
  const [promotionError, setPromotionError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null
  );
  const [working, setWorking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const selectedProfile = useMemo(
    () =>
      profiles.find((profile) => profile.userId === selectedProfileId) ?? null,
    [profiles, selectedProfileId]
  );

  const selectedProfileEvents = useMemo(
    () =>
      selectedProfile
        ? events
            .filter((event) => event.userId === selectedProfile.userId)
            .slice(0, 8)
        : [],
    [events, selectedProfile]
  );

  const canUnverify =
    currentUserRole === 'Organizer' || currentUserRole === 'Super Admin';

  const canModifyTarget = (profile: UserProfile) => {
    if (!canManage) return false;
    if (profile.userId === currentUserId) return false;
    if (profile.role === 'Super Admin' && currentUserRole !== 'Super Admin') {
      return false;
    }
    if (profile.role === 'Organizer' && currentUserRole !== 'Super Admin') {
      return false;
    }
    return true;
  };

  const canEditTargetFields = (profile: UserProfile) => {
    if (!canManage) return false;
    if (profile.userId === currentUserId) return true;
    return canModifyTarget(profile);
  };

  const roles = useMemo(
    () => [...new Set(profiles.map((profile) => profile.role))].sort(),
    [profiles]
  );

  const filteredProfiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (roleFilter !== 'All' && profile.role !== roleFilter) return false;
      const isBlocked = Boolean(activeBlock(profile, blocks));
      if (statusFilter === 'Blocked' && !isBlocked) return false;
      const isPendingApproval =
        profile.approvalStatus === 'Pending' ||
        profile.accountStatus === 'Pending Approval';
      if (statusFilter === 'Pending Approval' && (isBlocked || !isPendingApproval)) {
        return false;
      }
      if (
        statusFilter !== 'All' &&
        statusFilter !== 'Blocked' &&
        statusFilter !== 'Pending Approval' &&
        (isBlocked || profile.accountStatus !== statusFilter)
      ) {
        return false;
      }
      if (verificationFilter === 'Verified' && !profile.verified) return false;
      if (verificationFilter === 'Not verified' && profile.verified) {
        return false;
      }
      if (
        needle &&
        ![
          profile.fullName,
          profile.email,
          profile.phone,
          profile.department,
          profile.institution,
        ]
          .join(' ')
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [blocks, profiles, query, roleFilter, statusFilter, verificationFilter]);

  const handleRefresh = async () => {
    if (!onRefreshProfiles || refreshing) return;
    setRefreshing(true);
    try {
      const error = await onRefreshProfiles();
      onNotify?.(error ?? 'Profiles synchronized with Supabase.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportCsv = () => {
    const ok = downloadCsv(
      `baust-profiles-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Full Name',
        'Email',
        'Phone',
        'Role',
        'Department',
        'Institution',
        'Account Status',
        'Verified',
        'Joined At',
      ],
      filteredProfiles.map((p) => [
        p.fullName,
        p.email,
        p.phone,
        p.role,
        p.department,
        p.institution,
        activeBlock(p, blocks) ? 'Blocked' : p.accountStatus,
        p.verified ? 'Verified' : 'Not verified',
        p.createdAt,
      ])
    );
    onNotify?.(
      ok
        ? `Exported ${filteredProfiles.length} profile${filteredProfiles.length === 1 ? '' : 's'} to CSV.`
        : 'Could not export CSV in this browser.'
    );
  };

  const submitBlock = async () => {
    if (!selectedProfile || !canModifyTarget(selectedProfile)) return;
    const option = durationOptions.find((item) => item.value === blockDuration);
    if (!option) return;
    const expiresAt =
      option.value === 'permanent'
        ? null
        : new Date(Date.now() + option.ms).toISOString();
    await onBlock(
      selectedProfile.userId,
      expiresAt,
      blockReason,
      blockNote.trim()
    );
    setConfirmBlock(false);
    setBlockNote('');
  };

  const resetPassword = async () => {
    if (!resetTarget) return;
    setWorking(true);
    setResetError(null);
    try {
      const password = await onResetPassword(resetTarget.userId);
      if (password) {
        setTemporaryPassword(password);
        setResetTarget(null);
      } else {
        setResetError(
          'Could not generate a temporary password. You can send a password reset email below instead.'
        );
      }
    } finally {
      setWorking(false);
    }
  };

  const sendResetEmail = async () => {
    if (!resetTarget || !onSendResetEmail) return;
    setWorking(true);
    setResetError(null);
    setResetEmailSent(null);
    try {
      const error = await onSendResetEmail(resetTarget.email);
      if (error) {
        setResetError(error);
      } else {
        setResetEmailSent(
          `Password reset email sent to ${resetTarget.email}.`
        );
      }
    } finally {
      setWorking(false);
    }
  };

  const copyTemporaryPassword = async () => {
    if (!temporaryPassword) return;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      onNotify?.('Temporary password copied to clipboard.');
    } catch {
      setCopyError(
        'Clipboard access failed. Select and copy the password manually.'
      );
    }
  };

  const promoteUserToOrganizer = async () => {
    if (!promoteTarget) return;
    setWorking(true);
    setPromotionError(null);
    try {
      const error = await onPromoteToOrganizer(promoteTarget.userId);
      if (error) {
        setPromotionError(error);
        return;
      }
      setPromoteTarget(null);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
            Administration
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-emerald-50 sm:text-3xl">
            Profile management
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-emerald-200/65">
            Review account identity, verification, security, role promotions, and audit history.
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
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-200">
            <ShieldCheck className="h-4 w-4" />
            {canManage
              ? `${currentUserRole} · Full administration`
              : 'View and verification only'}
          </span>
        </div>
      </header>

      <section
        className="grid gap-3 sm:grid-cols-3"
        aria-label="Profile statistics"
      >
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-emerald-800/60 dark:bg-[#061D15]">
          <p className="text-xs text-slate-500 dark:text-emerald-300/65">
            Total profiles
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-emerald-50">
            {profiles.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-emerald-800/60 dark:bg-[#061D15]">
          <p className="text-xs text-slate-500 dark:text-emerald-300/65">
            Verified
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            {profiles.filter((profile) => profile.verified).length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-emerald-800/60 dark:bg-[#061D15]">
          <p className="text-xs text-slate-500 dark:text-emerald-300/65">
            Restricted accounts
          </p>
          <p className="mt-2 text-2xl font-bold text-red-700 dark:text-red-300">
            {
              profiles.filter(
                (profile) =>
                  profile.accountStatus === 'Suspended' ||
                  activeBlock(profile, blocks)
              ).length
            }
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-emerald-800/60 dark:bg-[#061D15]">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-emerald-900/60 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
            <div>
              <h2 className="text-sm font-bold text-slate-950 dark:text-emerald-50">
                User directory
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-emerald-300/65">
                {filteredProfiles.length} of {profiles.length} profiles
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_auto_auto_auto]">
            <label className="relative">
              <span className="sr-only">Search profiles</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, phone…"
                className="min-h-10 w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811]"
              />
            </label>
            <label>
              <span className="sr-only">Filter profiles by role</span>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-emerald-800/70 dark:bg-[#041811]"
              >
                <option value="All">All roles</option>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role === 'Guest' ? 'Attendee / Guest' : role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter profiles by status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-emerald-800/70 dark:bg-[#041811]"
              >
                <option value="All">All statuses</option>
                <option value="Active">Active</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Suspended">Suspended</option>
                <option value="Rejected">Rejected</option>
                <option value="Blocked">Blocked</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Filter profiles by verification</span>
              <select
                value={verificationFilter}
                onChange={(event) =>
                  setVerificationFilter(
                    event.target.value as VerificationFilter
                  )
                }
                className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-emerald-800/70 dark:bg-[#041811]"
              >
                <option value="All">All verification</option>
                <option value="Verified">Verified</option>
                <option value="Not verified">Not verified</option>
              </select>
            </label>
          </div>
        </div>
        {filteredProfiles.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <UserRound className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-emerald-100">
              No matching profiles
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-emerald-300/65">
              Try another search or filter combination.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-[#041811] dark:text-emerald-300/65">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Institution</th>
                  <th className="px-4 py-3">Account status</th>
                  <th className="px-4 py-3">Verification</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/60">
                {filteredProfiles.map((profile) => {
                  const block = activeBlock(profile, blocks);
                  const status = block
                    ? block.expiresAt
                      ? 'Temporarily blocked'
                      : 'Permanently blocked'
                    : profile.accountStatus;
                  const protectedFromViewer =
                    profile.role === 'Super Admin' &&
                    currentUserRole !== 'Super Admin';
                  return (
                    <tr
                      key={profile.userId}
                      className="text-xs text-slate-800 dark:text-emerald-100"
                    >
                      <td className="px-4 py-3.5">
                        <p className="font-semibold">
                          {profile.fullName}
                          {profile.userId === currentUserId && (
                            <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200">
                              You
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-emerald-300/65">
                          {profile.email}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        {profile.role === 'Guest'
                          ? 'Attendee / Guest'
                          : profile.role}
                      </td>
                      <td
                        className="max-w-56 truncate px-4 py-3.5"
                        title={profile.institution}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          {profile.institution || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${
                              block || profile.accountStatus === 'Suspended'
                                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-300'
                                : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200'
                            }`}
                          >
                            {status}
                          </span>
                          {(profile.approvalStatus === 'Pending' ||
                            profile.accountStatus === 'Pending Approval') && (
                            <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
                              Role Approval Pending
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            profile.verified
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          <BadgeCheck className="h-3.5 w-3.5" />
                          {profile.verified ? 'Verified' : 'Not verified'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-1.5">
                          {canVerify &&
                            !profile.verified &&
                            !protectedFromViewer && (
                              <button
                                type="button"
                                onClick={() =>
                                  void onSetVerified(profile.userId, true)
                                }
                                aria-label={`Verify ${profile.fullName}`}
                                className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                              >
                                Verify
                              </button>
                            )}
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedProfileId(profile.userId)
                            }
                            aria-label={`View profile for ${profile.fullName}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-slate-50 dark:border-emerald-800/70 dark:hover:bg-emerald-950/40"
                          >
                            <Eye className="h-3 w-3" />
                            View
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

      <Modal
        open={selectedProfile !== null}
        onClose={() => setSelectedProfileId(null)}
        title={selectedProfile?.fullName ?? 'User profile'}
        subtitle={
          selectedProfile
            ? `${selectedProfile.role} · ${selectedProfile.email}`
            : undefined
        }
        maxWidthClass="max-w-3xl"
      >
        {selectedProfile && (
          <div className="space-y-5">
            {canEditTargetFields(selectedProfile) ? (
              <ProfileFieldsEditor
                key={selectedProfile.userId}
                profile={selectedProfile}
                onSave={(profile) => {
                  onSaveProfile(profile);
                }}
                submitLabel="Save profile changes"
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-emerald-300/60">
                    Phone
                  </p>
                  <p className="mt-1 text-sm">
                    {selectedProfile.phone || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-emerald-300/60">
                    Department
                  </p>
                  <p className="mt-1 text-sm">
                    {selectedProfile.department || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-emerald-300/60">
                    Institution
                  </p>
                  <p className="mt-1 text-sm">
                    {selectedProfile.institution || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-emerald-300/60">
                    Biography
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {selectedProfile.biography || '—'}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[11px] text-slate-500 dark:text-emerald-300/60">
                    Joined
                  </p>
                  <p className="mt-1 text-sm">
                    {formatDate(selectedProfile.createdAt)}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-emerald-900/60">
              {canVerify &&
                !(
                  selectedProfile.role === 'Super Admin' &&
                  currentUserRole !== 'Super Admin'
                ) &&
                (!selectedProfile.verified || canUnverify) && (
                  <button
                    type="button"
                    onClick={() =>
                      void onSetVerified(
                        selectedProfile.userId,
                        !selectedProfile.verified
                      )
                    }
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                  >
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {selectedProfile.verified
                      ? 'Remove verification'
                      : 'Verify profile'}
                  </button>
                )}
              {canModifyTarget(selectedProfile) && (
                <>
                  {selectedProfile.accountStatus === 'Suspended' ? (
                    <button
                      type="button"
                      onClick={() =>
                        void onSetStatus(selectedProfile.userId, 'Active')
                      }
                      className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-300"
                    >
                      Reactivate
                    </button>
                  ) : (
                    selectedProfile.accountStatus === 'Active' && (
                      <button
                        type="button"
                        onClick={() =>
                          void onSetStatus(selectedProfile.userId, 'Suspended')
                        }
                        className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 dark:border-amber-800/70 dark:text-amber-300"
                      >
                        Suspend account
                      </button>
                    )
                  )}
                  {activeBlock(selectedProfile, blocks) ? (
                    <button
                      type="button"
                      onClick={() =>
                        void onUnblock(
                          activeBlock(selectedProfile, blocks)!.id
                        )
                      }
                      className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-300"
                    >
                      Unblock user
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmBlock(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/70 dark:text-red-300"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Block user
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setResetError(null);
                      setResetEmailSent(null);
                      setResetTarget(selectedProfile);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-emerald-800/70 dark:text-emerald-100"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Reset password
                  </button>
                </>
              )}
              {canPromoteToOrganizer &&
                selectedProfile.accountStatus === 'Active' &&
                selectedProfile.userId !== currentUserId &&
                !['Organizer', 'Super Admin'].includes(selectedProfile.role) && (
                  <button
                    type="button"
                    onClick={() => {
                      setPromotionError(null);
                      setPromoteTarget(selectedProfile);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-50 dark:border-violet-800/70 dark:text-violet-300 dark:hover:bg-violet-950/30"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Promote to Organizer
                  </button>
                )}
            </div>

            {selectedProfileEvents.length > 0 && (
              <div className="border-t border-slate-100 pt-4 dark:border-emerald-900/60">
                <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-emerald-300/65">
                  <History className="h-3.5 w-3.5" />
                  Recent account audit events
                </div>
                <ul className="space-y-2">
                  {selectedProfileEvents.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-xs dark:border-emerald-900/50"
                    >
                      <span className="text-slate-700 dark:text-emerald-100">
                        <strong>{event.summary}</strong>{' '}
                        <span className="text-slate-500 dark:text-emerald-300/65">
                          by {event.actorName}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-slate-500 dark:text-emerald-300/60">
                        {formatDateTime(event.occurredAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={promoteTarget !== null}
        onClose={() => {
          if (working) return;
          setPromoteTarget(null);
          setPromotionError(null);
        }}
        title="Promote user to Organizer?"
        subtitle="This grants access to event operations and staff tools."
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              disabled={working}
              onClick={() => setPromoteTarget(null)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-60 dark:border-emerald-800/70"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={working}
              onClick={() => void promoteUserToOrganizer()}
              className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-60"
            >
              {working ? 'Promoting…' : 'Confirm promotion'}
            </button>
          </>
        }
      >
        {promoteTarget && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700 dark:text-emerald-100">
              Promote <strong>{promoteTarget.fullName}</strong> (
              {promoteTarget.email}) from {promoteTarget.role} to Organizer?
            </p>
            {promotionError && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
              >
                {promotionError}
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        title="Block user access?"
        subtitle="This immediately prevents sign-in and ends an active app session."
        dangerHeader
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmBlock(false)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-emerald-800/70"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitBlock()}
              className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800"
            >
              Confirm block
            </button>
          </>
        }
      >
        {selectedProfile && (
          <div className="space-y-3">
            <p className="text-sm">
              <strong>{selectedProfile.fullName}</strong> ·{' '}
              {selectedProfile.role}
            </p>
            <label className="block text-xs font-semibold">
              Block duration
              <select
                value={blockDuration}
                onChange={(event) =>
                  setBlockDuration(event.target.value as BlockDuration)
                }
                className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-emerald-800/70 dark:bg-[#041811]"
              >
                {durationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold">
              Reason
              <select
                value={blockReason}
                onChange={(event) =>
                  setBlockReason(event.target.value as UserBlockReason)
                }
                className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-emerald-800/70 dark:bg-[#041811]"
              >
                <option>Spam</option>
                <option>Misconduct</option>
                <option>Fake Registration</option>
                <option>Security Violation</option>
                <option>Policy Violation</option>
                <option>Other</option>
              </select>
            </label>
            <label className="block text-xs font-semibold">
              Staff note (optional)
              <textarea
                rows={3}
                maxLength={500}
                value={blockNote}
                onChange={(event) => setBlockNote(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-emerald-800/70 dark:bg-[#041811]"
              />
            </label>
          </div>
        )}
      </Modal>

      <Modal
        open={resetTarget !== null}
        onClose={() => {
          if (working) return;
          setResetTarget(null);
          setResetError(null);
          setResetEmailSent(null);
        }}
        title="Reset account password?"
        subtitle="Generate a temporary password or email a recovery link to the user."
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              disabled={working}
              onClick={() => setResetTarget(null)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-60 dark:border-emerald-800/70"
            >
              Cancel
            </button>
            {onSendResetEmail && (
              <button
                type="button"
                disabled={working}
                onClick={() => void sendResetEmail()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800/70 dark:text-emerald-200"
              >
                <Mail className="h-3.5 w-3.5" />
                Send Reset Email
              </button>
            )}
            <button
              type="button"
              disabled={working}
              onClick={() => void resetPassword()}
              className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            >
              {working ? 'Resetting…' : 'Generate Temp Password'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-emerald-200/75">
            Reset credentials for <strong>{resetTarget?.fullName}</strong> (
            {resetTarget?.email}). Share any temporary password securely and ask
            the user to change it after signing in.
          </p>
          {resetError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
            >
              {resetError}
            </p>
          )}
          {resetEmailSent && (
            <p
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-200"
            >
              {resetEmailSent}
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={temporaryPassword !== null}
        onClose={() => setTemporaryPassword(null)}
        title="Temporary password generated"
        subtitle="Copy it now. It will not be shown again after closing this dialog."
        maxWidthClass="max-w-md"
      >
        <div className="space-y-3">
          <code className="block break-all rounded-lg bg-slate-100 p-3 text-sm font-semibold text-slate-900 dark:bg-[#041811] dark:text-emerald-100">
            {temporaryPassword}
          </code>
          <button
            type="button"
            onClick={() => void copyTemporaryPassword()}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-emerald-800/70"
          >
            Copy temporary password
          </button>
          {copyError && (
            <p role="alert" className="text-xs text-red-700 dark:text-red-300">
              {copyError}
            </p>
          )}
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Do not share temporary passwords over insecure channels.
          </p>
        </div>
      </Modal>
    </div>
  );
}
