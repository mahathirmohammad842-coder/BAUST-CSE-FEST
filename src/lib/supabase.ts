import { createClient } from '@supabase/supabase-js';
import type {
  Announcement,
  ApprovalLog,
  ApprovalLogAction,
  Attachment,
  ProfileNotificationPreferences,
  ProfileSocialLinks,
  RegistrableRole,
  RoleChangeLog,
  UserProfile,
  VerificationLog,
  VerificationStatus,
  WorkspaceRole,
} from '../types';

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
  'Admin',
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
const ATTACHMENT_BUCKET = 'notice-attachments';

export interface CloudProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: WorkspaceRole;
  department: string;
  institution: string;
  biography: string;
  photo_url: string;
  social_links: ProfileSocialLinks;
  notification_preferences: ProfileNotificationPreferences;
  account_status: UserProfile['accountStatus'];
  verified: boolean;
  verification_status?: VerificationStatus;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
  requested_role: string;
  can_manage_approvals?: boolean;
  recommended_action?: 'Approve' | 'Reject' | null;
  recommended_role?: WorkspaceRole | null;
  recommended_by?: string | null;
  recommended_by_name?: string | null;
  recommendation_notes?: string | null;
  recommended_at?: string | null;
  trashed_at: string | null;
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
  emailAutoConfirm: boolean | null;
  emailProviderEnabled: boolean | null;
  items: ConnectivityCheckItem[];
}

export function mapCloudProfile(row: CloudProfile): UserProfile {
  const role = WORKSPACE_ROLES.includes(row.role) ? row.role : 'Participant';
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

  return {
    userId: row.id,
    role,
    requestedRole,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone ?? '',
    department: row.department ?? '',
    institution: row.institution ?? '',
    biography: row.biography ?? '',
    photoDataUrl: row.photo_url ?? '',
    socialLinks: row.social_links ?? { website: '', linkedIn: '', github: '' },
    notificationPreferences: row.notification_preferences ?? {
      email: true,
      push: true,
      inApp: true,
      securityAlerts: true,
    },
    accountStatus: row.account_status,
    verified: verificationStatus === 'Verified' || row.verified,
    verificationStatus,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at ?? null,
    canManageApprovals: Boolean(row.can_manage_approvals),
    recommendedAction: row.recommended_action ?? null,
    recommendedRole:
      row.recommended_role && WORKSPACE_ROLES.includes(row.recommended_role)
        ? row.recommended_role
        : null,
    recommendedById: row.recommended_by ?? null,
    recommendedByName: row.recommended_by_name ?? null,
    recommendationNotes: row.recommendation_notes ?? null,
    recommendedAt: row.recommended_at ?? null,
    trashedAt: row.trashed_at ?? undefined,
  };
}

export async function fetchCloudProfile(userId: string): Promise<CloudProfile> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
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
    previousRole: (WORKSPACE_ROLES.includes(row.previous_role)
      ? row.previous_role
      : 'Participant') as WorkspaceRole,
    newRole: (WORKSPACE_ROLES.includes(row.new_role)
      ? row.new_role
      : 'Participant') as WorkspaceRole,
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
    assignedRole: String(row.assigned_role ?? 'Participant'),
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

export async function rpcRecordMyLastLogin(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('record_my_last_login');
  if (error && !isMissingRelationError(error)) {
    // Non-fatal if migration hasn't been applied yet
    console.warn('Could not record last_login_at:', error.message);
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
  const { error } = await supabase
    .from('user_profiles')
    .update({
      full_name: profile.fullName,
      phone: profile.phone,
      department: profile.department,
      institution: profile.institution,
      biography: profile.biography,
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

export async function fetchAuthHealthSettings(): Promise<{
  emailEnabled: boolean | null;
  mailerAutoconfirm: boolean | null;
  latencyMs: number;
  error?: string;
}> {
  if (!supabaseUrl || !supabasePublishableKey) {
    return {
      emailEnabled: null,
      mailerAutoconfirm: null,
      latencyMs: 0,
      error: 'Supabase environment variables are not configured.',
    };
  }
  const startedAt = performance.now();
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabasePublishableKey },
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    if (!response.ok) {
      return {
        emailEnabled: null,
        mailerAutoconfirm: null,
        latencyMs,
        error: `HTTP ${response.status}`,
      };
    }
    const payload = (await response.json()) as {
      external?: { email?: boolean };
      mailer_autoconfirm?: boolean;
    };
    return {
      emailEnabled: payload.external?.email ?? null,
      mailerAutoconfirm: payload.mailer_autoconfirm ?? null,
      latencyMs,
    };
  } catch (error) {
    return {
      emailEnabled: null,
      mailerAutoconfirm: null,
      latencyMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
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
      emailAutoConfirm: null,
      emailProviderEnabled: null,
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

  // 1. Auth settings & SMTP/confirmation status
  const authHealth = await fetchAuthHealthSettings();
  if (authHealth.error) {
    items.push({
      id: 'auth',
      label: 'Supabase Auth service',
      status: 'error',
      latencyMs: authHealth.latencyMs,
      detail: `Auth endpoint unreachable: ${authHealth.error}`,
    });
  } else if (authHealth.mailerAutoconfirm === false) {
    items.push({
      id: 'auth',
      label: 'Supabase Auth & Signup Email Policy',
      status: 'warning',
      latencyMs: authHealth.latencyMs,
      detail:
        'Auth is reachable, but Confirm Email is ON. Supabase built-in SMTP caps at 2 emails/hour; configure Custom SMTP or enable Auto-Confirm so registrations are not rate-limited.',
    });
  } else {
    items.push({
      id: 'auth',
      label: 'Supabase Auth & Signup Email Policy',
      status: 'ok',
      latencyMs: authHealth.latencyMs,
      detail: 'Auth service online with email auto-confirm enabled.',
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
    {
      id: 'db-actions',
      table: 'personal_notification_actions',
      label: 'Table: personal_notification_actions (RLS)',
    },
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
          ? `Not reachable (${error.message}). Email-based password recovery remains available.`
          : 'Not reachable.',
    });
  }

  return {
    checkedAt,
    projectUrl: supabaseUrl,
    configured: true,
    emailAutoConfirm: authHealth.mailerAutoconfirm,
    emailProviderEnabled: authHealth.emailEnabled,
    items,
  };
}
