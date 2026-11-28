import type {
  ActivityLogEntry,
  ApprovalLog,
  ApprovalStatus,
  ProfileAuditEvent,
  ProfileCredential,
  ProfileLoginEvent,
  ProfilePersonalInfo,
  ProfileState,
  RoleChangeLog,
  UserProfile,
  VerificationLog,
} from '../types';

export const PROFILE_STORAGE_KEY = 'baust_user_profiles';

const PROFILE_ROLES = [
  'Organizer',
  'Participant',
  'Volunteer',
  'Judge',
  'Guest',
  'Sponsor',
  'Mentor',
  'Super Admin',
] as const;

const PROFILE_STATUSES = [
  'Active',
  'Pending Approval',
  'Rejected',
  'Suspended',
] as const;

const APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected'] as const;

const PROFILE_ACTIONS = [
  'profile-updated',
  'profile-verified',
  'profile-unverified',
  'account-suspended',
  'account-reactivated',
  'password-changed',
  'password-reset',
  'notifications-updated',
] as const;

export const DEFAULT_PERSONAL_INFO: ProfilePersonalInfo = {
  studentId: '',
  batch: '',
  tshirtSize: '',
  emergencyContact: '',
  dietaryNotes: '',
};

const EMPTY_PROFILE_STATE: ProfileState = {
  profiles: [],
  events: [],
  loginHistory: [],
  credentials: {},
  passwordResetRequired: [],
  roleChangeLogs: [],
  approvalLogs: [],
  verificationLogs: [],
  activityLogs: [],
  rolePermissions: [],
};

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function normalizeStoredProfile(value: unknown): UserProfile | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Omit<Partial<UserProfile>, 'role' | 'assignedRole'> & {
    role?: string;
    assignedRole?: string;
  };
  const rawRole = raw.role === 'Admin' ? 'Organizer' : raw.role;
  const links = raw.socialLinks;
  const preferences = raw.notificationPreferences;
  if (
    typeof raw.userId !== 'string' ||
    !PROFILE_ROLES.includes(rawRole as (typeof PROFILE_ROLES)[number]) ||
    typeof raw.fullName !== 'string' ||
    typeof raw.email !== 'string' ||
    typeof raw.phone !== 'string' ||
    typeof raw.department !== 'string' ||
    typeof raw.institution !== 'string' ||
    typeof raw.biography !== 'string' ||
    typeof raw.photoDataUrl !== 'string' ||
    typeof links !== 'object' ||
    links === null ||
    typeof links.website !== 'string' ||
    typeof links.linkedIn !== 'string' ||
    typeof links.github !== 'string' ||
    typeof preferences !== 'object' ||
    preferences === null ||
    typeof preferences.email !== 'boolean' ||
    typeof preferences.push !== 'boolean' ||
    typeof preferences.inApp !== 'boolean' ||
    typeof preferences.securityAlerts !== 'boolean' ||
    !PROFILE_STATUSES.includes(
      raw.accountStatus as (typeof PROFILE_STATUSES)[number]
    ) ||
    typeof raw.verified !== 'boolean' ||
    !isValidDate(raw.createdAt)
  ) {
    return null;
  }

  const normalizedAccountStatus =
    raw.accountStatus === 'Pending Approval' ? 'Active' : raw.accountStatus!;
  const normalizedApprovalStatus: ApprovalStatus = APPROVAL_STATUSES.includes(
    raw.approvalStatus as ApprovalStatus
  )
    ? (raw.approvalStatus as ApprovalStatus)
    : raw.accountStatus === 'Pending Approval'
      ? 'Pending'
      : raw.accountStatus === 'Rejected'
        ? 'Rejected'
        : 'Approved';

  const info =
    typeof raw.personalInfo === 'object' && raw.personalInfo !== null
      ? raw.personalInfo
      : DEFAULT_PERSONAL_INFO;

  return {
    ...(raw as UserProfile),
    role: rawRole as UserProfile['role'],
    assignedRole:
      raw.assignedRole &&
      PROFILE_ROLES.includes(
        (raw.assignedRole === 'Admin'
          ? 'Organizer'
          : raw.assignedRole) as (typeof PROFILE_ROLES)[number]
      )
        ? ((raw.assignedRole === 'Admin'
            ? 'Organizer'
            : raw.assignedRole) as UserProfile['role'])
        : (rawRole as UserProfile['role']),
    accountStatus: normalizedAccountStatus,
    approvalStatus: normalizedApprovalStatus,
    address: typeof raw.address === 'string' ? raw.address : '',
    personalInfo: {
      studentId: typeof info.studentId === 'string' ? info.studentId : '',
      batch: typeof info.batch === 'string' ? info.batch : '',
      tshirtSize: typeof info.tshirtSize === 'string' ? info.tshirtSize : '',
      emergencyContact:
        typeof info.emergencyContact === 'string' ? info.emergencyContact : '',
      dietaryNotes: typeof info.dietaryNotes === 'string' ? info.dietaryNotes : '',
    },
  };
}

function isProfileAuditEvent(value: unknown): value is ProfileAuditEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Partial<ProfileAuditEvent>;
  return (
    typeof event.id === 'string' &&
    typeof event.userId === 'string' &&
    typeof event.actorId === 'string' &&
    typeof event.actorName === 'string' &&
    PROFILE_ACTIONS.includes(
      event.action as (typeof PROFILE_ACTIONS)[number]
    ) &&
    isValidDate(event.occurredAt) &&
    typeof event.summary === 'string'
  );
}

function isProfileLoginEvent(value: unknown): value is ProfileLoginEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Partial<ProfileLoginEvent>;
  return (
    typeof event.id === 'string' &&
    typeof event.userId === 'string' &&
    isValidDate(event.occurredAt) &&
    (event.method === 'password' || event.method === 'demo')
  );
}

function isProfileCredential(value: unknown): value is ProfileCredential {
  if (typeof value !== 'object' || value === null) return false;
  const credential = value as Partial<ProfileCredential>;
  return (
    typeof credential.salt === 'string' &&
    typeof credential.hash === 'string'
  );
}

function isRoleChangeLog(value: unknown): value is RoleChangeLog {
  if (typeof value !== 'object' || value === null) return false;
  const log = value as Partial<RoleChangeLog>;
  return (
    typeof log.id === 'string' &&
    typeof log.userId === 'string' &&
    typeof log.previousRole === 'string' &&
    typeof log.newRole === 'string' &&
    isValidDate(log.changedAt)
  );
}

function isApprovalLog(value: unknown): value is ApprovalLog {
  if (typeof value !== 'object' || value === null) return false;
  const log = value as Partial<ApprovalLog>;
  return (
    typeof log.id === 'string' &&
    typeof log.userId === 'string' &&
    typeof log.action === 'string' &&
    isValidDate(log.createdAt)
  );
}

function isVerificationLog(value: unknown): value is VerificationLog {
  if (typeof value !== 'object' || value === null) return false;
  const log = value as Partial<VerificationLog>;
  return (
    typeof log.id === 'string' &&
    typeof log.userId === 'string' &&
    typeof log.previousStatus === 'string' &&
    typeof log.newStatus === 'string' &&
    isValidDate(log.verifiedAt)
  );
}

function isActivityLog(value: unknown): value is ActivityLogEntry {
  if (typeof value !== 'object' || value === null) return false;
  const log = value as Partial<ActivityLogEntry>;
  return (
    typeof log.id === 'string' &&
    typeof log.userId === 'string' &&
    typeof log.action === 'string' &&
    isValidDate(log.createdAt)
  );
}

export function calculateProfileCompletion(profile: UserProfile): {
  percentage: number;
  completedCount: number;
  totalCount: number;
  missingFields: string[];
} {
  const checks: { label: string; filled: boolean }[] = [
    { label: 'Full Name', filled: Boolean(profile.fullName.trim()) },
    { label: 'Phone Number', filled: Boolean(profile.phone.trim()) },
    { label: 'Department', filled: Boolean(profile.department.trim()) },
    { label: 'Institution', filled: Boolean(profile.institution.trim()) },
    { label: 'Address', filled: Boolean(profile.address?.trim()) },
    {
      label: 'Student / Staff ID',
      filled: Boolean(profile.personalInfo?.studentId?.trim()),
    },
    {
      label: 'Emergency Contact',
      filled: Boolean(profile.personalInfo?.emergencyContact?.trim()),
    },
    { label: 'Bio', filled: Boolean(profile.biography.trim()) },
    { label: 'Profile Photo', filled: Boolean(profile.photoDataUrl) },
    {
      label: 'Social / Portfolio Link',
      filled: Boolean(
        profile.socialLinks.website.trim() ||
          profile.socialLinks.linkedIn.trim() ||
          profile.socialLinks.github.trim()
      ),
    },
  ];
  const completedCount = checks.filter((item) => item.filled).length;
  const totalCount = checks.length;
  const percentage = Math.round((completedCount / totalCount) * 100);
  const missingFields = checks
    .filter((item) => !item.filled)
    .map((item) => item.label);
  return { percentage, completedCount, totalCount, missingFields };
}

export function loadProfileState(): ProfileState {
  try {
    const stored = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!stored) return { ...EMPTY_PROFILE_STATE };
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) {
      return { ...EMPTY_PROFILE_STATE };
    }

    const state = parsed as Partial<ProfileState>;
    const credentials: Record<string, ProfileCredential> = {};
    if (
      typeof state.credentials === 'object' &&
      state.credentials !== null &&
      !Array.isArray(state.credentials)
    ) {
      for (const [userId, credential] of Object.entries(state.credentials)) {
        if (isProfileCredential(credential)) credentials[userId] = credential;
      }
    }

    return {
      profiles: Array.isArray(state.profiles)
        ? state.profiles
            .map(normalizeStoredProfile)
            .filter((item): item is UserProfile => item !== null)
        : [],
      events: Array.isArray(state.events)
        ? state.events.filter(isProfileAuditEvent)
        : [],
      loginHistory: Array.isArray(state.loginHistory)
        ? state.loginHistory.filter(isProfileLoginEvent)
        : [],
      credentials,
      passwordResetRequired: Array.isArray(state.passwordResetRequired)
        ? state.passwordResetRequired.filter(
            (userId): userId is string => typeof userId === 'string'
          )
        : [],
      roleChangeLogs: Array.isArray(state.roleChangeLogs)
        ? state.roleChangeLogs.filter(isRoleChangeLog)
        : [],
      approvalLogs: Array.isArray(state.approvalLogs)
        ? state.approvalLogs.filter(isApprovalLog)
        : [],
      verificationLogs: Array.isArray(state.verificationLogs)
        ? state.verificationLogs.filter(isVerificationLog)
        : [],
      activityLogs: Array.isArray(state.activityLogs)
        ? state.activityLogs.filter(isActivityLog)
        : [],
      rolePermissions: [],
    };
  } catch {
    return { ...EMPTY_PROFILE_STATE };
  }
}

export function saveProfileState(state: ProfileState) {
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(state));
}
