import type {
  ProfileAuditEvent,
  ProfileCredential,
  ProfileLoginEvent,
  ProfileState,
  UserProfile,
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
  'Admin',
  'Super Admin',
] as const;
const PROFILE_STATUSES = [
  'Active',
  'Pending Approval',
  'Rejected',
  'Suspended',
] as const;
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

const EMPTY_PROFILE_STATE: ProfileState = {
  profiles: [],
  events: [],
  loginHistory: [],
  credentials: {},
  passwordResetRequired: [],
};

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isUserProfile(value: unknown): value is UserProfile {
  if (typeof value !== 'object' || value === null) return false;
  const profile = value as Partial<UserProfile>;
  const links = profile.socialLinks;
  const preferences = profile.notificationPreferences;
  return (
    typeof profile.userId === 'string' &&
    PROFILE_ROLES.includes(profile.role as (typeof PROFILE_ROLES)[number]) &&
    typeof profile.fullName === 'string' &&
    typeof profile.email === 'string' &&
    typeof profile.phone === 'string' &&
    typeof profile.department === 'string' &&
    typeof profile.institution === 'string' &&
    typeof profile.biography === 'string' &&
    typeof profile.photoDataUrl === 'string' &&
    typeof links === 'object' &&
    links !== null &&
    typeof links.website === 'string' &&
    typeof links.linkedIn === 'string' &&
    typeof links.github === 'string' &&
    typeof preferences === 'object' &&
    preferences !== null &&
    typeof preferences.email === 'boolean' &&
    typeof preferences.push === 'boolean' &&
    typeof preferences.inApp === 'boolean' &&
    typeof preferences.securityAlerts === 'boolean' &&
    PROFILE_STATUSES.includes(
      profile.accountStatus as (typeof PROFILE_STATUSES)[number]
    ) &&
    typeof profile.verified === 'boolean' &&
    isValidDate(profile.createdAt)
  );
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
        ? state.profiles.filter(isUserProfile)
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
    };
  } catch {
    return { ...EMPTY_PROFILE_STATE };
  }
}

export function saveProfileState(state: ProfileState) {
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(state));
}
