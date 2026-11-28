import { createClient } from '@supabase/supabase-js';
import type {
  ActivityLogEntry,
  Announcement,
  ApprovalLog,
  ApprovalLogAction,
  ApprovalStatus,
  Attachment,
  ProfileNotificationPreferences,
  ProfilePersonalInfo,
  ProfileSocialLinks,
  RegistrableRole,
  RoleChangeLog,
  RolePermissionEntry,
  UserDeletionAuditAction,
  UserDeletionAuditLog,
  UserProfile,
  VerificationLog,
  VerificationStatus,
  WorkspaceRole,
} from '../types';
import {
  isEmailLikeValue,
  sanitizeProfileTextField,
} from '../utils/profileStore';

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
  return code === 'PGRST205' || code === '42P01';
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
  if (error) throw error;
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
  if (error) {
    const detail = await extractFunctionsInvokeError(error);
    throw new Error(detail);
  }
  if (data?.error) {
    throw new Error(data.error);
  }
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
      // Fall back to standard message below.
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
    { id: 'db-actions', table: 'personal_notification_actions', label: 'Table: personal_notification_actions (RLS)' },
    { id: 'db-permissions', table: 'role_permissions', label: 'Table: role_permissions (RBAC)' },
    { id: 'db-activity', table: 'activity_logs', label: 'Table: activity_logs (Audit)' },
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

  // 5. Edge Function check (admin-reset-user-password)
  const fnStart = performance.now();
  try {
    const fnResponse = await fetch(
      `${supabaseUrl}/functions/v1/admin-reset-user-password`,
      {
        method: 'OPTIONS',
        headers: { apikey: supabasePublishableKey },
      }
    );
    const fnLatency = Math.round(performance.now() - fnStart);
    items.push({
      id: 'edge-fn',
      label: 'Edge Function: admin-reset-user-password',
      status: fnResponse.ok ? 'ok' : 'warning',
      latencyMs: fnLatency,
      detail: fnResponse.ok
        ? 'Deployed and responding to preflight checks.'
        : `Responded with HTTP ${fnResponse.status}. Deploy the function via Supabase CLI if password reset is needed.`,
    });
  } catch (error) {
    items.push({
      id: 'edge-fn',
      label: 'Edge Function: admin-reset-user-password',
      status: 'warning',
      latencyMs: Math.round(performance.now() - fnStart),
      detail:
        error instanceof Error
          ? `Not reachable (${error.message}). Password recovery remains available.`
          : 'Not reachable.',
    });
  }

  return {
    checkedAt,
    projectUrl: supabaseUrl,
    configured: true,
    items,
  };
}
