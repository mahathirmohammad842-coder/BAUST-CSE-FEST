import { createClient } from '@supabase/supabase-js';
import type {
  ActivityLogEntry,
  Announcement,
  AnnouncementAuditAction,
  AnnouncementAuditLog,
  ApprovalLog,
  ApprovalLogAction,
  ApprovalStatus,
  Attachment,
  EnterpriseNotificationPreferences,
  EventInfoRequest,
  IncidentReport,
  IncidentSeverity,
  IncidentStatus,
  InfoRequestStatus,
  NotificationChannel,
  NotificationDelivery,
  NotificationDeliveryLogStatus,
  OrganizerContact,
  OrganizerMessageReply,
  OrganizerMessageThread,
  PresenceStatus,
  ProfileNotificationPreferences,
  ProfilePersonalInfo,
  ProfileSocialLinks,
  RegistrableRole,
  RetryHistoryEntry,
  RoleChangeLog,
  RolePermissionEntry,
  RoomRecord,
  StaffNotificationAlert,
  UserDeletionAuditAction,
  UserDeletionAuditLog,
  UserProfile,
  UserRole,
  VerificationLog,
  VerificationStatus,
  WorkspaceRole,
} from '../types';
import {
  isEmailLikeValue,
  sanitizeProfileTextField,
} from '../utils/profileStore';
import { normalizeEnterpriseNotificationPreferences } from './notificationSound';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

const WORKSPACE_ROLES: WorkspaceRole[] = [
  'Organizer',
  'Participant',
  'Volunteer',
  'Judge',
  'Guest',
  'Sponsor',
  'Mentor',
  'Super Admin',
];
const REGISTRABLE_ROLES: RegistrableRole[] = [
  'Participant',
  'Volunteer',
  'Judge',
  'Guest',
  'Sponsor',
  'Mentor',
];
const VERIFICATION_STATUSES: VerificationStatus[] = [
  'Pending',
  'Verified',
  'Rejected',
];
const APPROVAL_STATUSES: ApprovalStatus[] = ['Pending', 'Approved', 'Rejected'];
const ATTACHMENT_BUCKET = 'notice-attachments';

function normalizeWorkspaceRole(raw: unknown): WorkspaceRole {
  if (raw === 'Admin') return 'Organizer';
  if (typeof raw === 'string' && WORKSPACE_ROLES.includes(raw as WorkspaceRole)) {
    return raw as WorkspaceRole;
  }
  return 'Participant';
}

export interface CloudProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: WorkspaceRole | 'Admin';
  assigned_role?: WorkspaceRole | 'Admin';
  department: string;
  institution: string;
  address?: string;
  personal_info?: Partial<ProfilePersonalInfo>;
  biography: string;
  photo_url: string;
  social_links: ProfileSocialLinks;
  notification_preferences: ProfileNotificationPreferences;
  account_status: UserProfile['accountStatus'];
  approval_status?: ApprovalStatus;
  verified: boolean;
  verification_status?: VerificationStatus;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
  requested_role: string;
  can_manage_approvals?: boolean;
  recommended_action?: 'Approve' | 'Reject' | null;
  recommended_role?: WorkspaceRole | 'Admin' | null;
  recommended_by?: string | null;
  recommended_by_name?: string | null;
  recommendation_notes?: string | null;
  recommended_at?: string | null;
  trashed_at: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_by_name?: string | null;
  is_archived?: boolean;
  archived_at?: string | null;
  archived_by?: string | null;
  archived_by_name?: string | null;
  restored_at?: string | null;
  restored_by?: string | null;
  restored_by_name?: string | null;
  presence_status?: PresenceStatus | null;
  last_seen_at?: string | null;
}

export interface ConnectivityCheckItem {
  id: string;
  label: string;
  status: 'ok' | 'warning' | 'error';
  latencyMs: number | null;
  detail: string;
}

export interface SupabaseDiagnosticsReport {
  checkedAt: string;
  projectUrl: string | null;
  configured: boolean;
  items: ConnectivityCheckItem[];
}

export function mapCloudProfile(row: CloudProfile): UserProfile {
  const role = normalizeWorkspaceRole(row.role);
  const assignedRole = row.assigned_role
    ? normalizeWorkspaceRole(row.assigned_role)
    : role;
  const requestedRole = REGISTRABLE_ROLES.includes(
    row.requested_role as RegistrableRole
  )
    ? (row.requested_role as RegistrableRole)
    : 'Participant';
  const verificationStatus: VerificationStatus = VERIFICATION_STATUSES.includes(
    row.verification_status as VerificationStatus
  )
    ? (row.verification_status as VerificationStatus)
    : row.verified
      ? 'Verified'
      : row.account_status === 'Rejected'
        ? 'Rejected'
        : 'Pending';

  const isDeleted =
    Boolean(row.is_deleted) || row.account_status === 'Deleted';
  const isArchived =
    !isDeleted &&
    (Boolean(row.is_archived) || row.account_status === 'Archived');

  const accountStatus: UserProfile['accountStatus'] = isDeleted
    ? 'Deleted'
    : isArchived
      ? 'Archived'
      : row.account_status === 'Pending Approval'
        ? 'Active'
        : row.account_status === 'Suspended' || row.account_status === 'Rejected'
          ? row.account_status
          : 'Active';

  const approvalStatus: ApprovalStatus = APPROVAL_STATUSES.includes(
    row.approval_status as ApprovalStatus
  )
    ? (row.approval_status as ApprovalStatus)
    : row.account_status === 'Pending Approval'
      ? 'Pending'
      : row.account_status === 'Rejected'
        ? 'Rejected'
        : 'Approved';

  const info = row.personal_info ?? {};

  return {
    userId: row.id,
    role,
    assignedRole,
    requestedRole,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone ?? '',
    department: sanitizeProfileTextField(row.department),
    institution: sanitizeProfileTextField(row.institution),
    address: row.address ?? '',
    personalInfo: {
      studentId: typeof info.studentId === 'string' ? info.studentId : '',
      batch: typeof info.batch === 'string' ? info.batch : '',
      tshirtSize: typeof info.tshirtSize === 'string' ? info.tshirtSize : '',
      emergencyContact:
        typeof info.emergencyContact === 'string' ? info.emergencyContact : '',
      dietaryNotes:
        typeof info.dietaryNotes === 'string' ? info.dietaryNotes : '',
    },
    biography: row.biography ?? '',
    photoDataUrl: row.photo_url ?? '',
    socialLinks: row.social_links ?? { website: '', linkedIn: '', github: '' },
    notificationPreferences: row.notification_preferences ?? {
      email: true,
      push: true,
      inApp: true,
      securityAlerts: true,
    },
    accountStatus,
    approvalStatus,
    verified: verificationStatus === 'Verified' || row.verified,
    verificationStatus,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at ?? null,
    canManageApprovals: Boolean(row.can_manage_approvals),
    recommendedAction: row.recommended_action ?? null,
    recommendedRole: row.recommended_role
      ? normalizeWorkspaceRole(row.recommended_role)
      : null,
    recommendedById: row.recommended_by ?? null,
    recommendedByName: row.recommended_by_name ?? null,
    recommendationNotes: row.recommendation_notes ?? null,
    recommendedAt: row.recommended_at ?? null,
    trashedAt: row.trashed_at ?? undefined,
    isDeleted,
    deletedAt: row.deleted_at ?? null,
    deletedBy: row.deleted_by ?? null,
    deletedByName: row.deleted_by_name ?? '',
    isArchived,
    archivedAt: row.archived_at ?? null,
    archivedBy: row.archived_by ?? null,
    archivedByName: row.archived_by_name ?? '',
    restoredAt: row.restored_at ?? null,
    restoredBy: row.restored_by ?? null,
    restoredByName: row.restored_by_name ?? '',
    presenceStatus:
      row.presence_status === 'Online' || row.presence_status === 'Away'
        ? row.presence_status
        : 'Offline',
    lastSeenAt: row.last_seen_at ?? null,
  };
}

export async function fetchCloudProfile(
  expectedUserId?: string
): Promise<CloudProfile> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.id) {
    throw new Error('Authentication required to load your profile.');
  }
  if (expectedUserId && expectedUserId !== user.id) {
    throw new Error('Profile session mismatch detected. Please sign in again.');
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  if (!data || data.id !== user.id) {
    throw new Error('Authenticated user profile record did not match session ID.');
  }
  return data as CloudProfile;
}

export async function fetchCloudProfiles(): Promise<CloudProfile[]> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CloudProfile[];
}

function isMissingRelationError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  return code === 'PGRST205' || code === 'PGRST202' || code === '42P01' || code === '42883';
}

export async function fetchCloudRoleChangeLogs(): Promise<RoleChangeLog[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('role_change_logs')
    .select('*')
    .order('changed_at', { ascending: false })
    .limit(500);
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    userEmail: String(row.user_email ?? ''),
    userName: String(row.user_name ?? ''),
    previousRole: normalizeWorkspaceRole(row.previous_role),
    newRole: normalizeWorkspaceRole(row.new_role),
    changedById: String(row.changed_by ?? ''),
    changedByName: String(row.changed_by_name ?? 'System'),
    changedAt: String(row.changed_at),
    notes: String(row.notes ?? ''),
  }));
}

export async function fetchCloudApprovalLogs(): Promise<ApprovalLog[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('approval_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    userEmail: String(row.user_email ?? ''),
    userName: String(row.user_name ?? ''),
    action: String(row.action ?? 'status_changed') as ApprovalLogAction,
    requestedRole: String(row.requested_role ?? 'Participant'),
    assignedRole:
      row.assigned_role === 'Admin'
        ? 'Organizer'
        : String(row.assigned_role ?? 'Participant'),
    previousStatus: String(row.previous_status ?? ''),
    newStatus: String(row.new_status ?? ''),
    actorId: String(row.actor_id ?? ''),
    actorName: String(row.actor_name ?? 'System'),
    createdAt: String(row.created_at),
    approvalNotes: String(row.approval_notes ?? ''),
  }));
}

export async function fetchCloudVerificationLogs(): Promise<VerificationLog[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('verification_logs')
    .select('*')
    .order('verified_at', { ascending: false })
    .limit(500);
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    userEmail: String(row.user_email ?? ''),
    userName: String(row.user_name ?? ''),
    previousStatus: (VERIFICATION_STATUSES.includes(row.previous_status)
      ? row.previous_status
      : 'Pending') as VerificationStatus,
    newStatus: (VERIFICATION_STATUSES.includes(row.new_status)
      ? row.new_status
      : 'Pending') as VerificationStatus,
    verifiedById: String(row.verified_by ?? ''),
    verifiedByName: String(row.verified_by_name ?? 'System'),
    verifiedAt: String(row.verified_at),
    verificationNotes: String(row.verification_notes ?? ''),
  }));
}

export async function fetchCloudActivityLogs(): Promise<ActivityLogEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    userEmail: String(row.user_email ?? ''),
    userName: String(row.user_name ?? ''),
    actorId: String(row.actor_id ?? ''),
    actorName: String(row.actor_name ?? 'System'),
    action: String(row.action ?? 'account_event'),
    category: (['auth', 'profile', 'governance', 'security', 'notifications'].includes(
      String(row.category)
    )
      ? row.category
      : 'profile') as ActivityLogEntry['category'],
    details: String(row.details ?? ''),
    createdAt: String(row.created_at),
  }));
}

export async function fetchCloudRolePermissions(): Promise<
  RolePermissionEntry[]
> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('role_permissions')
    .select('*')
    .order('hierarchy_level', { ascending: false });
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => ({
    role: normalizeWorkspaceRole(row.role),
    hierarchyLevel: Number(row.hierarchy_level ?? 0),
    canManageUsers: Boolean(row.can_manage_users),
    canApproveUsers: Boolean(row.can_approve_users),
    canRecommendApprovals: Boolean(row.can_recommend_approvals),
    canVerifyUsers: Boolean(row.can_verify_users),
    canChangeRoles: Boolean(row.can_change_roles),
    canAssignOrganizer: Boolean(row.can_assign_organizer),
    canAssignSuperAdmin: Boolean(row.can_assign_super_admin),
    canPublishAnnouncements: Boolean(row.can_publish_announcements),
    canAccessOrganizerPanel: Boolean(row.can_access_organizer_panel),
    canAccessSuperAdminPanel: Boolean(row.can_access_super_admin_panel),
    canAccessJudgeFeatures: Boolean(row.can_access_judge_features),
    canManageEvents: Boolean(row.can_manage_events),
    canArchiveUsers: Boolean(row.can_archive_users),
    canSoftDeleteUsers: Boolean(row.can_soft_delete_users),
    canRestoreUsers: Boolean(row.can_restore_users),
    canPermanentlyDeleteUsers: Boolean(row.can_permanently_delete_users),
  }));
}

const DELETION_ACTIONS: UserDeletionAuditAction[] = [
  'soft_deleted',
  'archived',
  'restored',
  'unarchived',
  'permanently_deleted',
];

export async function fetchCloudDeletionAuditLogs(): Promise<
  UserDeletionAuditLog[]
> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('user_deletion_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    targetUserId: String(row.target_user_id),
    targetUserEmail: String(row.target_user_email ?? ''),
    targetUserName: String(row.target_user_name ?? ''),
    targetUserRole:
      row.target_user_role === 'Admin'
        ? 'Organizer'
        : String(row.target_user_role ?? 'Participant'),
    action: (DELETION_ACTIONS.includes(row.action)
      ? row.action
      : 'soft_deleted') as UserDeletionAuditAction,
    actorId: String(row.actor_id ?? ''),
    actorName: String(row.actor_name ?? 'System'),
    notes: String(row.notes ?? ''),
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
    restoredAt: row.restored_at ? String(row.restored_at) : null,
    restoredBy: row.restored_by ? String(row.restored_by) : null,
    restoredByName: row.restored_by_name ? String(row.restored_by_name) : '',
    permanentlyDeletedAt: row.permanently_deleted_at
      ? String(row.permanently_deleted_at)
      : null,
    createdAt: String(row.created_at),
  }));
}

export async function rpcRecordMyLastLogin(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('record_my_last_login');
  if (error && !isMissingRelationError(error)) {
    console.warn('Could not record last_login_at:', error.message);
  }
}

export async function rpcLogUserActivity(
  actionName: string,
  categoryName: ActivityLogEntry['category'],
  detailsText: string
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('log_user_activity', {
    action_name: actionName,
    category_name: categoryName,
    details_text: detailsText,
    metadata_json: {},
  });
  if (error && !isMissingRelationError(error)) {
    console.warn('Could not record activity log:', error.message);
  }
}

export async function rpcRecommendRegistration(
  targetUserId: string,
  recommendation: 'Approve' | 'Reject',
  suggestedRole?: WorkspaceRole | null,
  notes = ''
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('organizer_recommend_registration', {
    target_user_id: targetUserId,
    recommendation,
    suggested_role: suggestedRole ?? null,
    notes,
  });
  if (error) throw error;
}

export async function rpcReviewUserRegistration(
  targetUserId: string,
  approve: boolean,
  assignedRole?: WorkspaceRole | null,
  approvalNotes = '',
  markVerified = false
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('review_user_registration', {
    target_user_id: targetUserId,
    approve,
    assigned_role: assignedRole ?? null,
    approval_notes: approvalNotes,
    mark_verified: markVerified,
  });
  if (error) throw error;
}

export async function rpcSuperAdminAssignRole(
  targetUserId: string,
  newRole: WorkspaceRole,
  roleNotes = ''
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('super_admin_assign_user_role', {
    target_user_id: targetUserId,
    new_role: newRole,
    role_notes: roleNotes,
  });
  if (error) throw error;
}

export async function rpcSuperAdminBulkAssignRoles(
  targetUserIds: string[],
  newRole: WorkspaceRole,
  roleNotes = ''
): Promise<number> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('super_admin_bulk_assign_roles', {
    target_user_ids: targetUserIds,
    new_role: newRole,
    role_notes: roleNotes,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

export async function rpcStaffUpdateVerification(
  targetUserId: string,
  newStatus: VerificationStatus,
  verificationNotes = ''
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('staff_update_verification_status', {
    target_user_id: targetUserId,
    new_status: newStatus,
    verification_notes: verificationNotes,
  });
  if (error) throw error;
}

export async function rpcStaffBulkVerifyUsers(
  targetUserIds: string[],
  newStatus: VerificationStatus,
  verificationNotes = ''
): Promise<number> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('staff_bulk_verify_users', {
    target_user_ids: targetUserIds,
    new_status: newStatus,
    verification_notes: verificationNotes,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

export async function rpcSuperAdminSetOrganizerPermission(
  targetUserId: string,
  granted: boolean,
  permissionNotes = ''
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc(
    'super_admin_set_organizer_approval_permission',
    {
      target_user_id: targetUserId,
      granted,
      permission_notes: permissionNotes,
    }
  );
  if (error) throw error;
}

export async function rpcSuperAdminPromoteToOrganizer(
  targetUserId: string
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc(
    'super_admin_promote_user_to_organizer',
    {
      target_user_id: targetUserId,
    }
  );
  if (error) throw error;
}

export async function rpcStaffArchiveUser(
  targetUserId: string,
  archiveNotes = ''
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('staff_archive_user', {
    target_user_id: targetUserId,
    archive_notes: archiveNotes,
  });
  if (error) throw error;
}

export async function rpcStaffSoftDeleteUser(
  targetUserId: string,
  deleteNotes = '',
  isBlockedAccount = false
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('staff_soft_delete_user', {
    target_user_id: targetUserId,
    delete_notes: deleteNotes,
    is_blocked_account: isBlockedAccount,
  });
  if (error) {
    if (error.code === 'PGRST202' || error.message.includes('Could not find the function')) {
      throw new Error(
        'Database function public.staff_soft_delete_user is missing in Supabase schema cache. Apply migration 20261128000000_realtime_presence_ops_and_fixes.sql (npx supabase db push) and reload schema.'
      );
    }
    throw error;
  }
}

export async function rpcSuperAdminRestoreUser(
  targetUserId: string,
  restoreNotes = ''
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('super_admin_restore_user', {
    target_user_id: targetUserId,
    restore_notes: restoreNotes,
  });
  if (error) throw error;
}

export async function invokeAdminPermanentDeleteUser(
  userId: string,
  notes = ''
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.functions.invoke<{
    deletedUserId?: string;
    error?: string;
  }>('admin-delete-user', {
    body: { userId, notes },
  });

  if (!error) {
    if (data?.error) {
      throw new Error(data.error);
    }
    return;
  }

  const detail = await extractFunctionsInvokeError(error);
  const edgeUnavailable =
    detail.includes('Failed to send a request to the Edge Function') ||
    detail.includes('404') ||
    detail.includes('NOT_FOUND') ||
    detail.includes('FunctionsFetchError');

  if (edgeUnavailable) {
    const { error: rpcError } = await supabase.rpc(
      'super_admin_permanent_delete_user',
      {
        target_user_id: userId,
        delete_notes: notes,
      }
    );
    if (!rpcError) {
      return;
    }
    if (isMissingRelationError(rpcError)) {
      throw new Error(
        'Permanent delete requires deploying the "admin-delete-user" Edge Function or applying database migration 20261128120000.'
      );
    }
    throw new Error(rpcError.message);
  }

  throw new Error(detail);
}

export async function fetchCloudAnnouncements(): Promise<Announcement[]> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('announcements')
    .select('payload')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return Promise.all(
    (data ?? []).map(async (row) => {
      const announcement = row.payload as Announcement;
      const attachments = await Promise.all(
        announcement.attachments.map(async (attachment) => {
          if (!attachment.storagePath) return attachment;
          const { data: signedUrl, error: signedUrlError } = await supabase!
            .storage.from(ATTACHMENT_BUCKET)
            .createSignedUrl(attachment.storagePath, 60 * 60);
          if (signedUrlError) throw signedUrlError;
          return {
            ...attachment,
            dataUrl: undefined,
            mockUrl: signedUrl.signedUrl,
          };
        })
      );
      return { ...announcement, attachments };
    })
  );
}

export async function deleteCloudAnnouncement(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
}

export async function saveCloudAnnouncements(
  announcements: Announcement[],
  userId: string
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  if (announcements.length === 0) return;
  const rows = await Promise.all(
    announcements.map(async (announcement) => {
      const attachments = await Promise.all(
        announcement.attachments.map(async (attachment) => {
          if (attachment.storagePath) {
            return {
              ...attachment,
              dataUrl: undefined,
              mockUrl: `supabase-storage:${attachment.storagePath}`,
            };
          }
          if (!attachment.dataUrl) return attachment;
          const response = await fetch(attachment.dataUrl);
          if (!response.ok) {
            throw new Error(`Could not read attachment ${attachment.fileName}.`);
          }
          const blob = await response.blob();
          const safeName = attachment.fileName.replace(/[^\w.-]/g, '_');
          const storagePath = `${userId}/${announcement.id}/${attachment.id}-${safeName}`;
          const { error: uploadError } = await supabase!.storage
            .from(ATTACHMENT_BUCKET)
            .upload(storagePath, blob, {
              contentType: attachment.mimeType ?? blob.type,
              upsert: true,
            });
          if (uploadError) throw uploadError;
          return {
            ...attachment,
            storagePath,
            mockUrl: `supabase-storage:${storagePath}`,
            dataUrl: undefined,
          } satisfies Attachment;
        })
      );
      return {
        id: announcement.id,
        payload: { ...announcement, attachments },
        updated_by: userId,
        updated_at: new Date().toISOString(),
      };
    })
  );
  const { error } = await supabase.from('announcements').upsert(rows);
  if (error) throw error;
}

export async function saveCloudProfile(profile: UserProfile): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.id) {
    throw new Error('Authentication required to update a profile.');
  }

  const department = profile.department.trim();
  const institution = profile.institution.trim();
  if (isEmailLikeValue(department)) {
    throw new Error('Department must be a text field and cannot contain an email address.');
  }
  if (isEmailLikeValue(institution)) {
    throw new Error('Institution must be a text field and cannot contain an email address.');
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({
      full_name: profile.fullName.trim(),
      phone: profile.phone.trim(),
      department,
      institution,
      address: (profile.address ?? '').trim(),
      personal_info: profile.personalInfo,
      biography: profile.biography.trim(),
      photo_url: profile.photoDataUrl,
      social_links: profile.socialLinks,
      notification_preferences: profile.notificationPreferences,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.userId);
  if (error) throw error;
}

export async function fetchCloudNotificationActions(userId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('personal_notification_actions')
    .select('notification_id, state, events')
    .eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

export async function saveCloudNotificationAction(
  userId: string,
  notificationId: string,
  state: object,
  events: object[]
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('personal_notification_actions').upsert(
    {
      user_id: userId,
      notification_id: notificationId,
      state,
      events,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,notification_id' }
  );
  if (error) throw error;
}

export async function extractFunctionsInvokeError(error: unknown): Promise<string> {
  if (
    typeof error === 'object' &&
    error !== null &&
    'context' in error &&
    error.context instanceof Response
  ) {
    const status = error.context.status;
    try {
      const cloned = error.context.clone();
      const payload: unknown = await cloned.json();
      if (
        typeof payload === 'object' &&
        payload !== null &&
        'error' in payload &&
        typeof payload.error === 'string'
      ) {
        return payload.error;
      }
    } catch {
      if (status === 404) {
        return 'Edge Function returned HTTP 404 (NOT_FOUND).';
      }
    }
  }
  if (error instanceof Error) return error.message;
  return 'Edge function request failed.';
}

export async function runSupabaseConnectivityCheck(): Promise<SupabaseDiagnosticsReport> {
  const checkedAt = new Date().toISOString();
  const items: ConnectivityCheckItem[] = [];

  if (!isSupabaseConfigured || !supabase || !supabaseUrl || !supabasePublishableKey) {
    items.push({
      id: 'config',
      label: 'Environment configuration',
      status: 'error',
      latencyMs: null,
      detail: 'VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is missing.',
    });
    return {
      checkedAt,
      projectUrl: supabaseUrl ?? null,
      configured: false,
      items,
    };
  }

  items.push({
    id: 'config',
    label: 'Environment configuration',
    status: 'ok',
    latencyMs: 0,
    detail: `Connected to ${supabaseUrl}`,
  });

  // 1. Auth endpoint availability (instant signup & login)
  const authStart = performance.now();
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabasePublishableKey },
    });
    const latencyMs = Math.round(performance.now() - authStart);
    items.push({
      id: 'auth',
      label: 'Supabase Auth Service',
      status: response.ok ? 'ok' : 'warning',
      latencyMs,
      detail: response.ok
        ? 'Auth endpoint online for instant registration and password sign-in.'
        : `Auth endpoint responded with HTTP ${response.status}.`,
    });
  } catch (error) {
    items.push({
      id: 'auth',
      label: 'Supabase Auth Service',
      status: 'error',
      latencyMs: Math.round(performance.now() - authStart),
      detail: error instanceof Error ? error.message : 'Network error',
    });
  }

  // 2. Active session
  const sessionStart = performance.now();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const sessionLatency = Math.round(performance.now() - sessionStart);
  items.push({
    id: 'session',
    label: 'Authenticated session',
    status: sessionError ? 'error' : sessionData.session ? 'ok' : 'warning',
    latencyMs: sessionLatency,
    detail: sessionError
      ? sessionError.message
      : sessionData.session
        ? `Active JWT session for ${sessionData.session.user.email ?? sessionData.session.user.id}`
        : 'No active session.',
  });

  // 3. Database tables & RLS
  const tables: { id: string; table: string; label: string }[] = [
    { id: 'db-profiles', table: 'user_profiles', label: 'Table: user_profiles (RLS)' },
    { id: 'db-announcements', table: 'announcements', label: 'Table: announcements (RLS)' },
    { id: 'db-rooms', table: 'rooms', label: 'Table: rooms (Dynamic Venues)' },
    { id: 'db-delivery-logs', table: 'notification_delivery_logs', label: 'Table: notification_delivery_logs (Gateway)' },
    { id: 'db-retry-history', table: 'notification_retry_history', label: 'Table: notification_retry_history (Audit)' },
    { id: 'db-actions', table: 'personal_notification_actions', label: 'Table: personal_notification_actions (RLS)' },
    { id: 'db-permissions', table: 'role_permissions', label: 'Table: role_permissions (RBAC)' },
    { id: 'db-activity', table: 'activity_logs', label: 'Table: activity_logs (Audit)' },
    { id: 'db-messages', table: 'organizer_messages', label: 'Table: organizer_messages (Ops)' },
    { id: 'db-incidents', table: 'incident_reports', label: 'Table: incident_reports (Ops)' },
    { id: 'db-inforeq', table: 'event_info_requests', label: 'Table: event_info_requests (Ops)' },
  ];
  for (const entry of tables) {
    const start = performance.now();
    const { count, error } = await supabase
      .from(entry.table)
      .select('*', { count: 'exact', head: true });
    const latencyMs = Math.round(performance.now() - start);
    items.push({
      id: entry.id,
      label: entry.label,
      status: error ? 'error' : 'ok',
      latencyMs,
      detail: error
        ? error.message
        : `Accessible (${count ?? 0} visible row${count === 1 ? '' : 's'})`,
    });
  }

  // 4. Storage bucket
  const storageStart = performance.now();
  const { data: files, error: storageError } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .list('', { limit: 1 });
  const storageLatency = Math.round(performance.now() - storageStart);
  items.push({
    id: 'storage',
    label: `Storage bucket (${ATTACHMENT_BUCKET})`,
    status: storageError ? 'error' : 'ok',
    latencyMs: storageLatency,
    detail: storageError
      ? storageError.message
      : `Private bucket accessible (${files?.length ?? 0} top-level item sampled)`,
  });

  // 5. Edge Function checks
  const edgeFunctions = [
    {
      id: 'edge-fn-delete',
      name: 'admin-delete-user',
      fallbackNote: 'SQL RPC fallback (super_admin_permanent_delete_user) active when migration is applied.',
    },
    {
      id: 'edge-fn',
      name: 'admin-reset-user-password',
      fallbackNote: 'Password recovery email remains available.',
    },
  ];
  for (const fn of edgeFunctions) {
    const fnStart = performance.now();
    try {
      const fnResponse = await fetch(
        `${supabaseUrl}/functions/v1/${fn.name}`,
        {
          method: 'OPTIONS',
          headers: { apikey: supabasePublishableKey },
        }
      );
      const fnLatency = Math.round(performance.now() - fnStart);
      items.push({
        id: fn.id,
        label: `Edge Function: ${fn.name}`,
        status: fnResponse.ok ? 'ok' : 'warning',
        latencyMs: fnLatency,
        detail: fnResponse.ok
          ? 'Deployed and responding to preflight checks.'
          : `HTTP ${fnResponse.status} (not deployed). ${fn.fallbackNote}`,
      });
    } catch (error) {
      items.push({
        id: fn.id,
        label: `Edge Function: ${fn.name}`,
        status: 'warning',
        latencyMs: Math.round(performance.now() - fnStart),
        detail:
          error instanceof Error
            ? `Not reachable (${error.message}). ${fn.fallbackNote}`
            : `Not reachable. ${fn.fallbackNote}`,
      });
    }
  }

  return {
    checkedAt,
    projectUrl: supabaseUrl,
    configured: true,
    items,
  };
}

// ============================================================================
// PRESENCE, ANNOUNCEMENT AUDIT LOGS & QUICK-ACTION OPERATIONS APIs
// ============================================================================

export async function rpcUpdateMyPresenceStatus(
  status: PresenceStatus
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('update_my_presence_status', {
    new_status: status,
  });
  if (error && !isMissingRelationError(error)) {
    console.warn('Could not update presence status:', error.message);
  }
}

const ANNOUNCEMENT_AUDIT_ACTIONS: AnnouncementAuditAction[] = [
  'created',
  'updated',
  'published',
  'soft_deleted',
  'restored',
  'permanently_deleted',
];

export async function fetchCloudAnnouncementAuditLogs(): Promise<
  AnnouncementAuditLog[]
> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('announcement_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    announcementId: String(row.announcement_id),
    announcementTitle: String(row.announcement_title ?? ''),
    action: (ANNOUNCEMENT_AUDIT_ACTIONS.includes(row.action)
      ? row.action
      : 'updated') as AnnouncementAuditAction,
    actorId: String(row.actor_id ?? ''),
    actorName: String(row.actor_name ?? 'System'),
    actorRole: String(row.actor_role ?? 'Organizer'),
    notes: String(row.notes ?? ''),
    createdAt: String(row.created_at),
  }));
}

export async function rpcSoftDeleteAnnouncement(
  announcementId: string,
  notes = ''
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('staff_soft_delete_announcement', {
    target_announcement_id: announcementId,
    delete_notes: notes,
  });
  if (error) throw error;
}

export async function rpcRestoreAnnouncement(
  announcementId: string,
  notes = ''
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('staff_restore_announcement', {
    target_announcement_id: announcementId,
    restore_notes: notes,
  });
  if (error) throw error;
}

export async function rpcPermanentDeleteAnnouncement(
  announcementId: string,
  notes = ''
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('staff_permanent_delete_announcement', {
    target_announcement_id: announcementId,
    delete_notes: notes,
  });
  if (error) throw error;
}

export async function rpcLogAnnouncementAudit(
  announcementId: string,
  title: string,
  action: AnnouncementAuditAction,
  notes = ''
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('log_announcement_audit', {
    target_announcement_id: announcementId,
    target_title: title,
    audit_action: action,
    audit_notes: notes,
  });
  if (error && !isMissingRelationError(error)) {
    console.warn('Could not log announcement audit:', error.message);
  }
}

export async function fetchActiveOrganizerContacts(): Promise<
  OrganizerContact[]
> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_active_organizer_contacts');
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return (Array.isArray(data) ? data : []).map((row) => ({
    id: String(row.id),
    fullName: String(row.full_name ?? ''),
    email: String(row.email ?? ''),
    phone: String(row.phone ?? ''),
    role: normalizeWorkspaceRole(row.role),
    department: sanitizeProfileTextField(row.department),
    institution: sanitizeProfileTextField(row.institution),
    photoUrl: String(row.photo_url ?? ''),
    presenceStatus: (row.presence_status === 'Online' || row.presence_status === 'Away'
      ? row.presence_status
      : 'Offline') as PresenceStatus,
    lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
  }));
}

export async function fetchOrganizerMessages(): Promise<
  OrganizerMessageThread[]
> {
  if (!supabase) return [];
  const [threadsRes, repliesRes] = await Promise.all([
    supabase
      .from('organizer_messages')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(300),
    supabase
      .from('organizer_message_replies')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1000),
  ]);
  if (threadsRes.error) {
    if (isMissingRelationError(threadsRes.error)) return [];
    throw threadsRes.error;
  }
  if (repliesRes.error && !isMissingRelationError(repliesRes.error)) {
    throw repliesRes.error;
  }
  const repliesByThread = new Map<string, OrganizerMessageReply[]>();
  for (const row of repliesRes.data ?? []) {
    const tId = String(row.thread_id);
    const list = repliesByThread.get(tId) ?? [];
    list.push({
      id: String(row.id),
      threadId: tId,
      authorId: String(row.author_id),
      authorName: String(row.author_name ?? ''),
      authorRole: normalizeWorkspaceRole(row.author_role),
      body: String(row.body ?? ''),
      isStaffReply: Boolean(row.is_staff_reply),
      deliveryStatus: (row.delivery_status === 'Read' ||
      row.delivery_status === 'Sent'
        ? row.delivery_status
        : 'Delivered') as OrganizerMessageReply['deliveryStatus'],
      readAt: row.read_at ? String(row.read_at) : null,
      createdAt: String(row.created_at),
    });
    repliesByThread.set(tId, list);
  }
  return (threadsRes.data ?? []).map((row) => ({
    id: String(row.id),
    senderId: String(row.sender_id),
    senderName: String(row.sender_name ?? ''),
    senderEmail: String(row.sender_email ?? ''),
    senderRole: normalizeWorkspaceRole(row.sender_role),
    recipientOrganizerId: row.recipient_organizer_id
      ? String(row.recipient_organizer_id)
      : null,
    recipientOrganizerName: String(
      row.recipient_organizer_name ?? 'Executive Organizing Committee'
    ),
    subject: String(row.subject ?? ''),
    body: String(row.body ?? ''),
    status: (['Sent', 'Delivered', 'Read', 'Replied'].includes(row.status)
      ? row.status
      : 'Delivered') as OrganizerMessageThread['status'],
    readAt: row.read_at ? String(row.read_at) : null,
    repliedAt: row.replied_at ? String(row.replied_at) : null,
    replyCount: Number(row.reply_count ?? 0),
    lastMessageAt: String(row.last_message_at ?? row.created_at),
    createdAt: String(row.created_at),
    replies: repliesByThread.get(String(row.id)) ?? [],
  }));
}

export async function rpcSubmitOrganizerMessage(
  recipientId: string | null,
  subject: string,
  body: string
): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('submit_organizer_message', {
    recipient_id: recipientId,
    subject_text: subject,
    body_text: body,
  });
  if (error) throw error;
  return String(data);
}

export async function rpcReplyOrganizerMessage(
  threadId: string,
  replyBody: string
): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('reply_organizer_message', {
    target_thread_id: threadId,
    reply_body: replyBody,
  });
  if (error) throw error;
  return String(data);
}

export async function rpcMarkOrganizerThreadRead(
  threadId: string
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('mark_organizer_thread_read', {
    target_thread_id: threadId,
  });
  if (error && !isMissingRelationError(error)) {
    console.warn('Could not mark thread read:', error.message);
  }
}

export async function fetchIncidentReports(): Promise<IncidentReport[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('incident_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    referenceCode: String(row.reference_code ?? ''),
    reporterId: String(row.reporter_id),
    reporterName: String(row.reporter_name ?? ''),
    reporterEmail: String(row.reporter_email ?? ''),
    reporterRole: normalizeWorkspaceRole(row.reporter_role),
    category: String(row.category ?? ''),
    location: String(row.location ?? ''),
    severity: (['Low', 'Medium', 'High', 'Critical'].includes(row.severity)
      ? row.severity
      : 'Medium') as IncidentSeverity,
    description: String(row.description ?? ''),
    status: (['Open', 'Investigating', 'Resolved', 'Closed'].includes(row.status)
      ? row.status
      : 'Open') as IncidentStatus,
    assignedToId: row.assigned_to ? String(row.assigned_to) : null,
    assignedToName: String(row.assigned_to_name ?? ''),
    resolutionNotes: String(row.resolution_notes ?? ''),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    resolvedByName: String(row.resolved_by_name ?? ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
  }));
}

export async function rpcSubmitIncidentReport(
  category: string,
  location: string,
  severity: IncidentSeverity,
  description: string
): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('submit_incident_report', {
    category_text: category,
    location_text: location,
    severity_text: severity,
    description_text: description,
  });
  if (error) throw error;
  return String(data);
}

export async function rpcStaffUpdateIncidentReport(
  incidentId: string,
  status: IncidentStatus,
  resolutionNotes = ''
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('staff_update_incident_report', {
    target_incident_id: incidentId,
    new_status: status,
    resolution_text: resolutionNotes,
  });
  if (error) throw error;
}

export async function fetchEventInfoRequests(): Promise<EventInfoRequest[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('event_info_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    referenceCode: String(row.reference_code ?? ''),
    requesterId: String(row.requester_id),
    requesterName: String(row.requester_name ?? ''),
    requesterEmail: String(row.requester_email ?? ''),
    requesterRole: normalizeWorkspaceRole(row.requester_role),
    topic: String(row.topic ?? ''),
    question: String(row.question ?? ''),
    status: (['Pending', 'Answered', 'Closed'].includes(row.status)
      ? row.status
      : 'Pending') as InfoRequestStatus,
    responseText: String(row.response_text ?? ''),
    respondedById: row.responded_by ? String(row.responded_by) : null,
    respondedByName: String(row.responded_by_name ?? ''),
    respondedAt: row.responded_at ? String(row.responded_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
  }));
}

export async function rpcSubmitEventInfoRequest(
  topic: string,
  question: string
): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('submit_event_info_request', {
    topic_text: topic,
    question_text: question,
  });
  if (error) throw error;
  return String(data);
}

export async function rpcStaffRespondEventInfoRequest(
  requestId: string,
  responseText: string,
  status: InfoRequestStatus = 'Answered'
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('staff_respond_event_info_request', {
    target_request_id: requestId,
    response_body: responseText,
    new_status: status,
  });
  if (error) throw error;
}

export async function fetchStaffNotificationAlerts(
  userId: string
): Promise<StaffNotificationAlert[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    announcementId: String(row.announcement_id ?? ''),
    title: String(row.title ?? ''),
    body: String(row.body ?? ''),
    channel: String(row.channel ?? 'In-App'),
    priority: String(row.priority ?? 'Normal'),
    isRead: Boolean(row.is_read),
    readAt: row.read_at ? String(row.read_at) : null,
    createdAt: String(row.created_at),
  }));
}

export async function markStaffNotificationAlertRead(
  alertId: string
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', alertId);
  if (error && !isMissingRelationError(error)) {
    console.warn('Could not mark alert read:', error.message);
  }
}

// ============================================================================
// DYNAMIC ROOMS, REAL DELIVERY LOGS, RETRY HISTORY & ACTIVE SESSIONS
// ============================================================================

export async function fetchCloudRooms(): Promise<RoomRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .order('name', { ascending: true });
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    building: String(row.building ?? ''),
    capacity:
      typeof row.capacity === 'number'
        ? row.capacity
        : row.capacity !== null && row.capacity !== undefined
          ? Number(row.capacity)
          : null,
    isActive: row.is_active !== false,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? row.created_at ?? ''),
  }));
}

export async function rpcSuperAdminUpsertRoom(params: {
  id?: string | null;
  name: string;
  building: string;
  capacity: number | null;
  isActive: boolean;
}): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('super_admin_upsert_room', {
    room_id: params.id ?? null,
    room_name: params.name,
    building_name: params.building,
    room_capacity: params.capacity,
    room_is_active: params.isActive,
  });
  if (error) throw error;
  return String(data);
}

export async function rpcSuperAdminToggleRoomActive(
  roomId: string,
  isActive: boolean
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('super_admin_toggle_room_active', {
    room_id: roomId,
    active_state: isActive,
  });
  if (error) throw error;
}

export async function rpcSuperAdminDeleteRoom(roomId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('super_admin_delete_room', {
    room_id: roomId,
  });
  if (error) throw error;
}

const DELIVERY_LOG_STATUSES: NotificationDeliveryLogStatus[] = [
  'Delivered',
  'Pending',
  'Failed',
  'Gateway Not Configured',
  'Skipped',
];

function normalizeChannelName(raw: unknown): NotificationChannel {
  const val = String(raw ?? 'In-App');
  if (
    val === 'In-App' ||
    val === 'Email' ||
    val === 'SMS' ||
    val === 'Push Notification' ||
    val === 'Web Notification'
  ) {
    return val;
  }
  return 'In-App';
}

export async function fetchCloudDeliveryLogs(
  announcementId?: string
): Promise<NotificationDelivery[]> {
  if (!supabase) return [];
  let query = supabase
    .from('notification_delivery_logs')
    .select('*')
    .order('last_attempt_at', { ascending: false })
    .limit(1000);
  if (announcementId) {
    query = query.eq('announcement_id', announcementId);
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => {
    const channel = normalizeChannelName(row.channel);
    const email = String(row.recipient_email ?? '');
    const phone = String(row.recipient_phone ?? '');
    const contact =
      channel === 'SMS'
        ? phone || email || 'No phone on file'
        : channel === 'Email'
          ? email || 'No email on file'
          : email || phone || String(row.recipient_id ?? 'In-App session');
    const rawStatus = String(row.status ?? 'Pending');
    const status = (
      DELIVERY_LOG_STATUSES.includes(rawStatus as NotificationDeliveryLogStatus)
        ? rawStatus
        : 'Pending'
    ) as NotificationDeliveryLogStatus;
    return {
      id: String(row.id),
      announcementId: String(row.announcement_id),
      recipientId: row.recipient_id ? String(row.recipient_id) : '',
      recipientName: String(row.recipient_name ?? 'Unknown Recipient'),
      recipientRole: normalizeWorkspaceRole(row.recipient_role) as UserRole,
      recipientContact: contact,
      recipientEmail: email,
      recipientPhone: phone,
      channel,
      status,
      gatewayProvider: row.gateway_provider ? String(row.gateway_provider) : undefined,
      errorCode: row.error_code ? String(row.error_code) : undefined,
      errorMessage: row.error_message ? String(row.error_message) : undefined,
      attemptCount: Number(row.attempt_count ?? 1),
      lastAttemptAt: String(row.last_attempt_at ?? row.created_at),
      deliveredAt: row.delivered_at ? String(row.delivered_at) : undefined,
      createdAt: String(row.created_at ?? row.last_attempt_at),
    };
  });
}

export async function fetchCloudRetryHistory(
  announcementId?: string
): Promise<RetryHistoryEntry[]> {
  if (!supabase) return [];
  let query = supabase
    .from('notification_retry_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (announcementId) {
    query = query.eq('announcement_id', announcementId);
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    deliveryLogId: String(row.delivery_log_id),
    announcementId: String(row.announcement_id),
    channel: normalizeChannelName(row.channel),
    attemptNumber: Number(row.attempt_number ?? 1),
    previousStatus: (DELIVERY_LOG_STATUSES.includes(row.previous_status)
      ? row.previous_status
      : 'Pending') as NotificationDeliveryLogStatus,
    newStatus: (DELIVERY_LOG_STATUSES.includes(row.new_status)
      ? row.new_status
      : 'Pending') as NotificationDeliveryLogStatus,
    errorCode: row.error_code ? String(row.error_code) : undefined,
    errorMessage: row.error_message ? String(row.error_message) : undefined,
    retriedBy: row.retried_by ? String(row.retried_by) : null,
    retriedByName: String(row.retried_by_name ?? 'System'),
    createdAt: String(row.created_at),
  }));
}

export async function rpcDispatchAnnouncementDeliveries(
  announcementId: string
): Promise<Announcement | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc(
    'dispatch_announcement_deliveries',
    {
      target_announcement_id: announcementId,
    }
  );
  if (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }
  return data && typeof data === 'object' ? (data as Announcement) : null;
}

export interface RetryDispatchSummary {
  retriedCount: number;
  deliveredCount: number;
  remainingCount: number;
  notConfiguredCount: number;
}

export async function rpcRetryFailedDeliveries(
  announcementId: string,
  deliveryId?: string
): Promise<RetryDispatchSummary> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('retry_failed_deliveries', {
    target_announcement_id: announcementId,
    target_delivery_id: deliveryId ?? null,
  });
  if (error) throw error;
  const result = (data ?? {}) as Record<string, unknown>;
  return {
    retriedCount: Number(result.retriedCount ?? 0),
    deliveredCount: Number(result.deliveredCount ?? 0),
    remainingCount: Number(result.remainingCount ?? 0),
    notConfiguredCount: Number(result.notConfiguredCount ?? 0),
  };
}

export async function rpcUpsertMyActiveSession(
  sessionId: string,
  status: PresenceStatus,
  route = ''
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('upsert_my_active_session', {
    p_session_id: sessionId,
    p_status: status,
    p_route: route,
  });
  if (error && !isMissingRelationError(error)) {
    // Fall back silently to legacy presence rpc if new migration hasn't run yet
    await rpcUpdateMyPresenceStatus(status);
  }
}

export async function rpcEndMyActiveSession(sessionId?: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('end_my_active_session', {
    p_session_id: sessionId ?? null,
  });
  if (error && !isMissingRelationError(error)) {
    await rpcUpdateMyPresenceStatus('Offline');
  }
}

export function keepaliveEndActiveSession(
  sessionId: string,
  accessToken: string | null
): void {
  if (!supabaseUrl || !supabasePublishableKey || !accessToken) return;
  try {
    void fetch(`${supabaseUrl}/rest/v1/rpc/end_my_active_session`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ p_session_id: sessionId }),
    });
  } catch {
    // Ignore pagehide network errors
  }
}

export async function fetchCloudNotificationPreferences(
  userId: string,
  fallbackChannels?: Partial<ProfileNotificationPreferences>
): Promise<EnterpriseNotificationPreferences> {
  if (!supabase || !userId) {
    return normalizeEnterpriseNotificationPreferences(null, fallbackChannels);
  }
  const { data, error } = await supabase
    .from('user_notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      return normalizeEnterpriseNotificationPreferences(null, fallbackChannels);
    }
    throw error;
  }

  if (!data) {
    return normalizeEnterpriseNotificationPreferences(null, fallbackChannels);
  }

  return normalizeEnterpriseNotificationPreferences(data, fallbackChannels);
}

export async function saveCloudNotificationPreferences(
  userId: string,
  preferences: EnterpriseNotificationPreferences
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user?.id || user.id !== userId) {
    throw new Error('Authenticated user mismatch when saving preferences.');
  }

  const normalized = normalizeEnterpriseNotificationPreferences(preferences);
  const { error } = await supabase.rpc('upsert_my_notification_preferences', {
    p_email_enabled: normalized.email,
    p_push_enabled: normalized.push,
    p_in_app_enabled: normalized.inApp,
    p_security_alerts_enabled: normalized.securityAlerts,
    p_sound_enabled: normalized.soundEnabled,
    p_mute_all: normalized.muteAll,
    p_dnd_enabled: normalized.dndEnabled,
    p_volume: normalized.volume,
    p_per_type_settings: normalized.perType,
  });

  if (error) {
    if (isMissingRelationError(error)) {
      // Graceful fallback if the sound preferences migration hasn't run yet
      const { error: legacyErr } = await supabase
        .from('user_profiles')
        .update({
          notification_preferences: {
            email: normalized.email,
            push: normalized.push,
            inApp: normalized.inApp,
            securityAlerts: normalized.securityAlerts,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (legacyErr) throw legacyErr;
      return;
    }
    throw error;
  }
}


