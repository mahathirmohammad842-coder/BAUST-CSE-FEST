import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { Sidebar, type OrganizerRoute } from './components/Sidebar';
import { PendingApprovalDashboard } from './components/PendingApprovalDashboard';
import {
  TopHeader,
  type AttendeeRoute,
  type WorkspaceMode,
} from './components/TopHeader';
import {
  createDefaultPreferencesForRole,
  DEMO_ACCESS_ROLES,
  DEMO_USERS,
  INITIAL_ACTIVITY_FEED,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_FAILED_DELIVERIES,
  INITIAL_USER_PREFERENCES,
} from './data/mockData';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { BlockedUsersPage } from './pages/BlockedUsersPage';
import { ComposerPage } from './pages/ComposerPage';
import { DashboardPage } from './pages/DashboardPage';
import { DeliveryDetailPage } from './pages/DeliveryDetailPage';
import { LoginPage } from './pages/LoginPage';
import { ProfileManagementPage } from './pages/ProfileManagementPage';
import { RejectedTrashPage } from './pages/RejectedTrashPage';
import { SettingsPage } from './pages/SettingsPage';
import { SuperAdminUsersPage } from './pages/SuperAdminUsersPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { UserInboxPage } from './pages/UserInboxPage';
import { UserApprovalsPage } from './pages/UserApprovalsPage';
import { UserProfilePage } from './pages/UserProfilePage';
import { UserSettingsPage } from './pages/UserSettingsPage';
import { UsersPage } from './pages/UsersPage';
import type {
  ActivityFeedEntry,
  Announcement,
  ApprovalLog,
  ApprovalStatus,
  DeliveryStatus,
  NotificationDelivery,
  OrganizerProfile,
  OrganizerSettings,
  ProfileAccountStatus,
  ProfileAuditAction,
  ProfileAuditEvent,
  ProfileState,
  RegistrationInput,
  RegistrationRequest,
  RegistrableRole,
  RoleChangeLog,
  SettingsSection,
  SystemUser,
  UserProfile,
  UserPreferenceMatrix,
  VerificationLog,
  VerificationStatus,
  WorkspaceRole,
} from './types';
import {
  formatDhakaTimeOnly,
  isAnnouncementVisibleToRole,
} from './utils/formatters';
import {
  hashRegistrationPassword,
  loadRegistrationRequests,
  loadDeletedDemoUserIds,
  findActiveUserBlock,
  loadUserBlockState,
  REGISTRATION_STORAGE_KEY,
  DELETED_DEMO_USERS_STORAGE_KEY,
  USER_BLOCK_STATE_STORAGE_KEY,
  saveDeletedDemoUserIds,
  saveRegistrationRequests,
  saveUserBlockState,
  type UserBlockAction,
  type UserBlockAuditEvent,
  type UserBlockReason,
  type UserBlockState,
  verifyRegistrationPassword,
} from './utils/registrationStore';
import {
  loadProfileState,
  PROFILE_STORAGE_KEY,
  saveProfileState,
} from './utils/profileStore';
import {
  createDefaultPersonalNotificationState,
  loadNotificationActionStore,
  saveNotificationActionStore,
  type NotificationActionName,
  type NotificationActionEvent,
  type NotificationActionStore,
  type PersonalNotificationState,
} from './utils/notificationActions';
import {
  deleteCloudAnnouncement,
  extractFunctionsInvokeError,
  fetchCloudActivityLogs,
  fetchCloudAnnouncements,
  fetchCloudApprovalLogs,
  fetchCloudNotificationActions,
  fetchCloudProfile,
  fetchCloudProfiles,
  fetchCloudRoleChangeLogs,
  fetchCloudRolePermissions,
  fetchCloudVerificationLogs,
  isSupabaseConfigured,
  mapCloudProfile,
  rpcLogUserActivity,
  rpcRecommendRegistration,
  rpcRecordMyLastLogin,
  rpcReviewUserRegistration,
  rpcStaffBulkVerifyUsers,
  rpcStaffUpdateVerification,
  rpcSuperAdminAssignRole,
  rpcSuperAdminBulkAssignRoles,
  rpcSuperAdminPromoteToOrganizer,
  rpcSuperAdminSetOrganizerPermission,
  saveCloudAnnouncements,
  saveCloudNotificationAction,
  saveCloudProfile,
  supabase,
  type CloudProfile,
} from './lib/supabase';

const DEMO_PASSWORD = 'demo1234';
const ORGANIZER_PROFILE_STORAGE_KEY = 'baust_organizer_profile';
const ACCOUNT_IDENTITY_SWAP_KEY = 'baust_organizer_superadmin_swap_v1';

type AppRoute = OrganizerRoute | AttendeeRoute;

function canAccessOrganizerWorkspace(
  role: WorkspaceRole,
  approvalStatus: ApprovalStatus = 'Approved'
) {
  return (
    (role === 'Organizer' || role === 'Super Admin') &&
    approvalStatus === 'Approved'
  );
}

function createDefaultOrganizerProfile(): OrganizerProfile {
  return {
    fullName: DEMO_USERS.Organizer.fullName,
    organizerId: DEMO_USERS.Organizer.badgeCode,
    department: 'Computer Science & Engineering',
    designation: 'Convener, BAUST CSE Fest 2026',
    email: DEMO_USERS.Organizer.email,
    phone: DEMO_USERS.Organizer.phone,
    accountStatus: 'Active',
    lastLogin: 'Nov 23, 2026 · 9:42 AM',
  };
}

function isOrganizerProfile(value: unknown): value is OrganizerProfile {
  return (
    typeof value === 'object' &&
    value !== null &&
    'fullName' in value &&
    typeof value.fullName === 'string' &&
    'organizerId' in value &&
    typeof value.organizerId === 'string' &&
    'department' in value &&
    typeof value.department === 'string' &&
    'designation' in value &&
    typeof value.designation === 'string' &&
    'email' in value &&
    typeof value.email === 'string' &&
    'phone' in value &&
    typeof value.phone === 'string' &&
    'accountStatus' in value &&
    (value.accountStatus === 'Active' || value.accountStatus === 'Inactive') &&
    'lastLogin' in value &&
    typeof value.lastLogin === 'string'
  );
}

function loadOrganizerProfile(): OrganizerProfile {
  try {
    const storedProfile = window.localStorage.getItem(
      ORGANIZER_PROFILE_STORAGE_KEY
    );
    if (storedProfile) {
      const parsedProfile: unknown = JSON.parse(storedProfile);
      const migrationComplete =
        window.localStorage.getItem(ACCOUNT_IDENTITY_SWAP_KEY) === 'complete';
      if (
        isOrganizerProfile(parsedProfile) &&
        (migrationComplete ||
          parsedProfile.email.toLowerCase() ===
            DEMO_USERS.Organizer.email.toLowerCase())
      ) {
        return parsedProfile;
      }
    }
  } catch {
    // Fall back to the current demo identity if storage is unavailable or invalid.
  }
  return createDefaultOrganizerProfile();
}

function createDefaultUserProfile(
  user: SystemUser,
  accountStatus: ProfileAccountStatus = 'Active',
  createdAt = new Date().toISOString()
): UserProfile {
  const isStaffRole = user.role === 'Organizer' || user.role === 'Super Admin';
  const isMahathir = user.id === DEMO_USERS['Super Admin'].id;
  const normalizedAccountStatus: ProfileAccountStatus =
    accountStatus === 'Pending Approval' ? 'Active' : accountStatus;
  const approvalStatus: ApprovalStatus =
    accountStatus === 'Pending Approval'
      ? 'Pending'
      : accountStatus === 'Rejected'
        ? 'Rejected'
        : 'Approved';
  return {
    userId: user.id,
    role: user.role,
    assignedRole: user.role,
    requestedRole: isStaffRole
      ? 'Participant'
      : (user.role as RegistrableRole),
    approvalStatus,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    department:
      user.role === 'Organizer' || isMahathir
        ? 'Computer Science & Engineering'
        : '',
    institution:
      user.role === 'Organizer' || isMahathir ? 'BAUST' : user.affiliation,
    address: '',
    personalInfo: {
      studentId: '',
      batch: '',
      tshirtSize: '',
      emergencyContact: '',
      dietaryNotes: '',
    },
    biography: '',
    photoDataUrl: '',
    socialLinks: { website: '', linkedIn: '', github: '' },
    notificationPreferences: {
      email: true,
      push: true,
      inApp: true,
      securityAlerts: true,
    },
    accountStatus: normalizedAccountStatus,
    verified: isStaffRole || (normalizedAccountStatus === 'Active' && approvalStatus === 'Approved'),
    verificationStatus:
      isStaffRole || (normalizedAccountStatus === 'Active' && approvalStatus === 'Approved')
        ? 'Verified'
        : 'Pending',
    createdAt,
    lastLoginAt: null,
    canManageApprovals: user.role === 'Super Admin',
  };
}

function createProfileAuditEvent(
  userId: string,
  actorId: string,
  actorName: string,
  action: ProfileAuditAction,
  summary: string
): ProfileAuditEvent {
  return {
    id: `profile-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    actorId,
    actorName,
    action,
    occurredAt: new Date().toISOString(),
    summary,
  };
}

function initializeProfileState(): ProfileState {
  const profileState = loadProfileState();

  try {
    if (
      window.localStorage.getItem(ACCOUNT_IDENTITY_SWAP_KEY) === 'complete'
    ) {
      return profileState;
    }

    const storedOrganizerProfile = window.localStorage.getItem(
      ORGANIZER_PROFILE_STORAGE_KEY
    );
    let legacyOrganizerProfile: OrganizerProfile | null = null;
    if (storedOrganizerProfile) {
      const parsed: unknown = JSON.parse(storedOrganizerProfile);
      if (isOrganizerProfile(parsed)) {
        legacyOrganizerProfile = parsed;
      }
    }

    let nextProfileState = profileState;
    if (
      legacyOrganizerProfile &&
      legacyOrganizerProfile.email.toLowerCase() !==
        DEMO_USERS.Organizer.email.toLowerCase()
    ) {
      const userId = DEMO_USERS['Super Admin'].id;
      const existing = profileState.profiles.find(
        (profile) => profile.userId === userId
      );
      const base = createDefaultUserProfile(DEMO_USERS['Super Admin']);
      const transferredProfile: UserProfile = {
        ...base,
        ...existing,
        userId,
        role: 'Super Admin',
        fullName: legacyOrganizerProfile.fullName,
        email: legacyOrganizerProfile.email,
        phone: legacyOrganizerProfile.phone,
        department: legacyOrganizerProfile.department,
        institution: existing?.institution || 'BAUST',
        accountStatus:
          legacyOrganizerProfile.accountStatus === 'Inactive'
            ? 'Suspended'
            : existing?.accountStatus ?? 'Active',
        createdAt: existing?.createdAt ?? base.createdAt,
      };
      nextProfileState = {
        ...profileState,
        profiles: [
          ...profileState.profiles.filter(
            (profile) => profile.userId !== userId
          ),
          transferredProfile,
        ],
      };
      saveProfileState(nextProfileState);
    }

    const newOrganizerData = profileState.profiles.find(
      (profile) => profile.userId === DEMO_USERS.Organizer.id
    );
    const newOrganizerProfile =
      legacyOrganizerProfile?.email.toLowerCase() ===
      DEMO_USERS.Organizer.email.toLowerCase()
        ? legacyOrganizerProfile
        : {
            ...createDefaultOrganizerProfile(),
            ...(newOrganizerData
              ? {
                  fullName: newOrganizerData.fullName,
                  email: newOrganizerData.email,
                  phone: newOrganizerData.phone,
                  department:
                    newOrganizerData.department ||
                    'Computer Science & Engineering',
                  accountStatus:
                    newOrganizerData.accountStatus === 'Suspended'
                      ? ('Inactive' as const)
                      : ('Active' as const),
                }
              : {}),
          };
    window.localStorage.setItem(
      ORGANIZER_PROFILE_STORAGE_KEY,
      JSON.stringify(newOrganizerProfile)
    );
    window.localStorage.setItem(ACCOUNT_IDENTITY_SWAP_KEY, 'complete');
    return nextProfileState;
  } catch (error) {
    console.error('Unable to migrate Organizer and Super Admin profile data.', error);
    return profileState;
  }
}

function getUserBlockMessage(
  blocks: UserBlockState['records'],
  userId: string
): string | null {
  const block = findActiveUserBlock(blocks, userId);
  if (!block) return null;
  if (!block.expiresAt) return 'This account is permanently blocked.';
  const expiresAt = new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(new Date(block.expiresAt));
  return `This account is temporarily blocked until ${expiresAt}.`;
}

function getSupabaseFailureMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return 'Unexpected Supabase error.';
  }

  const message =
    typeof error.message === 'string' ? error.message : 'Supabase request failed.';
  const code =
    'code' in error && typeof error.code === 'string' ? error.code : '';
  if (
    code === 'PGRST205' ||
    code === '42P01' ||
    (message.toLowerCase().includes('user_profiles') &&
      (message.toLowerCase().includes('not find') ||
        message.toLowerCase().includes('does not exist')))
  ) {
    return 'Supabase tables are missing. From the project folder run: npx supabase link --project-ref qnxtsnbpzxxmvhbgbqdm, then npx supabase db push.';
  }

  const details =
    'details' in error && typeof error.details === 'string'
      ? ` ${error.details}`
      : '';
  const hint =
    'hint' in error && typeof error.hint === 'string'
      ? ` Hint: ${error.hint}`
      : '';
  return `${message}${details}${hint}`;
}

function cloudProfilesToRegistrationRequests(
  profiles: CloudProfile[]
): RegistrationRequest[] {
  const registrableRoles: RegistrableRole[] = [
    'Participant',
    'Volunteer',
    'Judge',
    'Guest',
    'Sponsor',
    'Mentor',
  ];
  return profiles.flatMap((profile) => {
    if (profile.role === 'Super Admin') return [];
    const approvalStatus: ApprovalStatus =
      profile.approval_status === 'Pending' ||
      profile.approval_status === 'Approved' ||
      profile.approval_status === 'Rejected'
        ? profile.approval_status
        : profile.account_status === 'Pending Approval'
          ? 'Pending'
          : profile.account_status === 'Rejected'
            ? 'Rejected'
            : 'Approved';

    const isStaffActive =
      profile.role === 'Organizer' &&
      approvalStatus === 'Approved' &&
      profile.account_status === 'Active';
    if (isStaffActive) return [];

    const requestedRole: RegistrableRole = registrableRoles.includes(
      profile.requested_role as RegistrableRole
    )
      ? (profile.requested_role as RegistrableRole)
      : registrableRoles.includes(profile.role as RegistrableRole)
        ? (profile.role as RegistrableRole)
        : 'Participant';

    const verificationStatus: VerificationStatus =
      profile.verification_status === 'Verified' ||
      profile.verification_status === 'Rejected' ||
      profile.verification_status === 'Pending'
        ? profile.verification_status
        : profile.verified
          ? 'Verified'
          : 'Pending';

    return [{
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      phone: profile.phone,
      role: requestedRole,
      assignedRole: profile.role === 'Admin' ? 'Organizer' : profile.role,
      approvalStatus,
      affiliation: profile.institution || profile.department,
      registeredAt: profile.created_at,
      status:
        approvalStatus === 'Rejected' || profile.account_status === 'Rejected'
          ? 'Rejected'
          : approvalStatus === 'Pending' ||
              profile.account_status === 'Pending Approval'
            ? 'Pending Approval'
            : 'Approved',
      verificationStatus,
      lastLoginAt: profile.last_login_at ?? undefined,
      recommendedAction: profile.recommended_action ?? null,
      recommendedRole:
        profile.recommended_role === 'Admin'
          ? 'Organizer'
          : (profile.recommended_role ?? null),
      recommendedById: profile.recommended_by ?? null,
      recommendedByName: profile.recommended_by_name ?? null,
      recommendationNotes: profile.recommendation_notes ?? null,
      recommendedAt: profile.recommended_at ?? null,
      passwordSalt: '',
      passwordHash: '',
      ...(profile.trashed_at ? { trashedAt: profile.trashed_at } : {}),
      ...(profile.updated_at !== profile.created_at
        ? { reviewedAt: profile.updated_at }
        : {}),
    }];
  });
}

export default function App() {
  const [showLoginPage, setShowLoginPage] = useState(true);
  const [cloudAuthReady, setCloudAuthReady] = useState(!isSupabaseConfigured);
  const [cloudUserId, setCloudUserId] = useState<string | null>(null);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);
  const passwordRecoveryRef = useRef(false);
  const authActivationRequestRef = useRef(0);
  const skipNextAnnouncementSyncRef = useRef(false);
  const [cloudAnnouncementsReadyFor, setCloudAnnouncementsReadyFor] =
    useState<string | null>(null);
  const [mode, setMode] = useState<WorkspaceMode>('organizer');
  const [activeRole, setActiveRole] = useState<WorkspaceRole>('Organizer');
  const [registeredUser, setRegisteredUser] = useState<SystemUser | null>(null);
  const [registrationRequests, setRegistrationRequests] =
    useState<RegistrationRequest[]>(loadRegistrationRequests);
  const [deletedDemoUserIds, setDeletedDemoUserIds] = useState<string[]>(
    loadDeletedDemoUserIds
  );
  const [userBlockState, setUserBlockState] =
    useState<UserBlockState>(loadUserBlockState);
  const [profileState, setProfileState] =
    useState<ProfileState>(initializeProfileState);
  const [notificationActionStore, setNotificationActionStore] =
    useState<NotificationActionStore>(loadNotificationActionStore);
  const [lastAttendeeRole, setLastAttendeeRole] =
    useState<WorkspaceRole>('Participant');
  const [activeRoute, setActiveRoute] = useState<AppRoute>('dashboard');
  const mainContentRef = useRef<HTMLElement>(null);
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>('account');
  const [organizerProfile, setOrganizerProfile] =
    useState<OrganizerProfile>(loadOrganizerProfile);
  const [organizerPassword, setOrganizerPassword] = useState<string | null>(null);
  const [organizerSettings, setOrganizerSettings] = useState<OrganizerSettings>({
    emailNotifications: true,
    pushNotifications: true,
    announcementUpdates: true,
    securityAlerts: true,
    twoFactorEnabled: false,
    sessionTimeoutEnabled: true,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useLayoutEffect(() => {
    mainContentRef.current?.scrollTo(0, 0);
  }, [activeRoute, mode]);

  useEffect(() => {
    if (
      (activeRoute === 'rejected-trash' ||
        activeRoute === 'super-admin-users') &&
      activeRole !== 'Super Admin'
    ) {
      setActiveRoute('dashboard');
    }
  }, [activeRole, activeRoute]);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem('baust_theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      window.localStorage.setItem('baust_theme', darkMode ? 'dark' : 'light');
    } catch {
      // Ignore storage errors
    }
  }, [darkMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        'baust_organizer_profile',
        JSON.stringify(organizerProfile)
      );
    } catch {
      // Ignore storage errors; the profile remains available for this session.
    }
  }, [organizerProfile]);

  const [announcements, setAnnouncements] = useState<Announcement[]>(
    INITIAL_ANNOUNCEMENTS
  );
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>(
    INITIAL_FAILED_DELIVERIES
  );
  const [activityFeed, setActivityFeed] = useState<ActivityFeedEntry[]>(
    INITIAL_ACTIVITY_FEED
  );
  const [preferencesByRole, setPreferencesByRole] = useState<
    Record<WorkspaceRole, UserPreferenceMatrix>
  >(INITIAL_USER_PREFERENCES);

  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string>(
    INITIAL_ANNOUNCEMENTS[0].id
  );
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<Announcement | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3600);
  };

  const activateSupabaseUser = async (
    userId: string,
    authEmail: string
  ): Promise<string | null> => {
    const requestId = ++authActivationRequestRef.current;
    const isLatestRequest = () =>
      requestId === authActivationRequestRef.current;
    try {
      const currentRow = await fetchCloudProfile(userId);
      if (!isLatestRequest()) return null;
      if (
        currentRow.account_status === 'Rejected' ||
        currentRow.account_status === 'Suspended' ||
        currentRow.approval_status === 'Rejected'
      ) {
        await supabase?.auth.signOut();
        return currentRow.account_status === 'Rejected' ||
          currentRow.approval_status === 'Rejected'
          ? 'This registration was not approved. Contact the organizer for help.'
          : 'This account is currently suspended. Contact the organizer.';
      }

      void rpcRecordMyLastLogin();
      void rpcLogUserActivity(
        'login',
        'auth',
        'Signed in to BAUST CSE Fest Portal'
      );
      const effectiveApprovalStatus: ApprovalStatus =
        currentRow.approval_status === 'Pending' ||
        currentRow.approval_status === 'Approved' ||
        currentRow.approval_status === 'Rejected'
          ? currentRow.approval_status
          : currentRow.account_status === 'Pending Approval'
            ? 'Pending'
            : 'Approved';
      const isStaff =
        ['Organizer', 'Super Admin'].includes(currentRow.role) &&
        effectiveApprovalStatus === 'Approved';
      const [
        profileRows,
        roleChangeLogs,
        approvalLogs,
        verificationLogs,
        activityLogs,
        rolePermissions,
      ] = await Promise.all([
        isStaff ? fetchCloudProfiles() : Promise.resolve([currentRow]),
        isStaff ? fetchCloudRoleChangeLogs() : Promise.resolve([]),
        fetchCloudApprovalLogs(),
        isStaff ? fetchCloudVerificationLogs() : Promise.resolve([]),
        fetchCloudActivityLogs(),
        fetchCloudRolePermissions(),
      ]);
      if (!isLatestRequest()) return null;
      const currentProfile = mapCloudProfile(currentRow);
      setProfileState((previous) => ({
        ...previous,
        profiles: profileRows.map(mapCloudProfile),
        credentials: {},
        passwordResetRequired: [],
        roleChangeLogs,
        approvalLogs,
        verificationLogs,
        activityLogs,
        rolePermissions,
      }));
      setRegistrationRequests(cloudProfilesToRegistrationRequests(profileRows));
      const authAccount: SystemUser = {
        id: userId,
        fullName: currentProfile.fullName,
        email: authEmail || currentProfile.email,
        phone: currentProfile.phone,
        role: currentProfile.role,
        affiliation: currentProfile.institution || currentProfile.department,
        badgeCode: userId,
      };
      setRegisteredUser(authAccount);
      setActiveRole(currentProfile.role);
      setMode(
        canAccessOrganizerWorkspace(
          currentProfile.role,
          currentProfile.approvalStatus
        )
          ? 'organizer'
          : 'inbox'
      );
      setLastAttendeeRole(currentProfile.role);
      setActiveRoute('dashboard');
      setMobileMenuOpen(false);

      if (currentProfile.role === 'Organizer') {
        setOrganizerProfile((previous) => ({
          ...previous,
          fullName: currentProfile.fullName,
          email: currentProfile.email,
          phone: currentProfile.phone,
          department: currentProfile.department,
          accountStatus: 'Active',
        }));
      }

      const remoteAnnouncements = await fetchCloudAnnouncements();
      if (!isLatestRequest()) return null;
      let finalAnnouncements: Announcement[];
      if (remoteAnnouncements.length === 0 && isStaff) {
        await saveCloudAnnouncements(INITIAL_ANNOUNCEMENTS, userId);
        finalAnnouncements = INITIAL_ANNOUNCEMENTS;
      } else {
        finalAnnouncements = remoteAnnouncements;
      }
      skipNextAnnouncementSyncRef.current = true;
      setAnnouncements(finalAnnouncements);
      const loadedAnnouncementById = new Map(
        finalAnnouncements.map((item) => [item.id, item])
      );
      setDeliveries((prev) =>
        prev.filter((d) => {
          const ann = loadedAnnouncementById.get(d.announcementId);
          return Boolean(
            ann &&
              (d.status !== 'Failed' ||
                ann.failedCount > 0 ||
                ann.status === 'Failed')
          );
        })
      );
      setActivityFeed((prev) =>
        prev.filter((entry) => loadedAnnouncementById.has(entry.announcementId))
      );
      setCloudAnnouncementsReadyFor(userId);

      const remoteActions = await fetchCloudNotificationActions(userId);
      if (!isLatestRequest()) return null;
      const userStates: Record<string, PersonalNotificationState> = {};
      const userEvents: NotificationActionEvent[] = [];
      for (const row of remoteActions) {
        const state = row.state as Partial<PersonalNotificationState>;
        userStates[row.notification_id] = {
          ...createDefaultPersonalNotificationState(),
          ...state,
        };
        if (Array.isArray(row.events)) {
          userEvents.push(
            ...(row.events as NotificationActionEvent[]).filter(
              (event) =>
                event &&
                typeof event.id === 'string' &&
                event.userId === userId &&
                event.notificationId === row.notification_id
            )
          );
        }
      }
      userEvents.sort((left, right) => {
        const diff = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
        return Number.isNaN(diff) ? 0 : diff;
      });
      setNotificationActionStore((previous) => ({
        ...previous,
        byUserId: { ...previous.byUserId, [userId]: userStates },
        events: [
          ...userEvents,
          ...previous.events.filter(
            (event) =>
              event.userId !== userId && !event.userId.startsWith('user-demo-')
          ),
        ]
          .sort((left, right) => {
            const diff =
              Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
            return Number.isNaN(diff) ? 0 : diff;
          })
          .slice(0, 5000),
      }));
      setCloudUserId(userId);
      setShowLoginPage(false);
      showToast(`Signed in as ${currentProfile.fullName} (${currentProfile.role}).`);
      return null;
    } catch (error) {
      if (!isLatestRequest()) return null;
      await supabase?.auth.signOut();
      const message = getSupabaseFailureMessage(error);
      return `Could not load your Supabase account data: ${message}`;
    }
  };

  useEffect(() => {
    if (!supabase) {
      setCloudAuthReady(true);
      return;
    }
    let active = true;
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const hasRecoveryCallback =
      hashParams.get('type') === 'recovery' ||
      new URLSearchParams(window.location.search).get('type') === 'recovery';
    if (hasRecoveryCallback) {
      authActivationRequestRef.current += 1;
      passwordRecoveryRef.current = true;
      setPasswordRecoveryMode(true);
    }
    const callbackError = hashParams.get('error_description');
    if (callbackError) showToast(callbackError);

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && active) {
        authActivationRequestRef.current += 1;
        passwordRecoveryRef.current = true;
        setPasswordRecoveryMode(true);
        setShowLoginPage(true);
      } else if (event === 'SIGNED_OUT' && active) {
        authActivationRequestRef.current += 1;
        passwordRecoveryRef.current = false;
        setPasswordRecoveryMode(false);
        setCloudUserId(null);
        setCloudAnnouncementsReadyFor(null);
        setRegisteredUser(null);
        setShowLoginPage(true);
      }
    });

    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;
      if (error) {
        showToast(`Could not restore the Supabase session: ${error.message}`);
      } else if (data.session?.user) {
        if (passwordRecoveryRef.current) {
          setShowLoginPage(true);
        } else {
          const result = await activateSupabaseUser(
            data.session.user.id,
            data.session.user.email ?? ''
          );
          if (result) showToast(result);
        }
      }
      if (active) setCloudAuthReady(true);
    }).catch((error: unknown) => {
      if (!active) return;
      const message =
        error instanceof Error ? error.message : 'Unexpected Supabase error.';
      showToast(`Could not restore the Supabase session: ${message}`);
      setCloudAuthReady(true);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !cloudUserId || cloudAnnouncementsReadyFor !== cloudUserId) {
      return;
    }
    if (!['Organizer', 'Super Admin'].includes(activeRole) || mode !== 'organizer') {
      return;
    }
    if (skipNextAnnouncementSyncRef.current) {
      skipNextAnnouncementSyncRef.current = false;
      return;
    }
    void saveCloudAnnouncements(announcements, cloudUserId).catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Unexpected Supabase error.';
      showToast(`Could not sync announcements with Supabase: ${message}`);
    });
  }, [activeRole, announcements, cloudAnnouncementsReadyFor, cloudUserId]);

  useEffect(() => {
    const handleRegistrationStorage = (event: StorageEvent) => {
      if (event.key === REGISTRATION_STORAGE_KEY || event.key === null) {
        setRegistrationRequests(loadRegistrationRequests());
      }
      if (
        event.key === DELETED_DEMO_USERS_STORAGE_KEY ||
        event.key === null
      ) {
        setDeletedDemoUserIds(loadDeletedDemoUserIds());
      }
      if (
        event.key === USER_BLOCK_STATE_STORAGE_KEY ||
        event.key === null
      ) {
        setUserBlockState(loadUserBlockState());
      }
      if (event.key === PROFILE_STORAGE_KEY || event.key === null) {
        setProfileState(loadProfileState());
      }
    };
    window.addEventListener('storage', handleRegistrationStorage);
    return () =>
      window.removeEventListener('storage', handleRegistrationStorage);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      const expiredRecords = userBlockState.records.filter(
        (record) =>
          !record.endedAt &&
          record.expiresAt !== null &&
          Date.parse(record.expiresAt) <= now.getTime()
      );
      if (expiredRecords.length === 0) return;

      const endedAt = now.toISOString();
      const expiredIds = new Set(expiredRecords.map((record) => record.id));
      const events: UserBlockAuditEvent[] = expiredRecords.map((record) => ({
        id: `block-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        blockId: record.id,
        userId: record.userId,
        action: 'expired',
        actorId: 'system',
        actorName: 'System',
        occurredAt: endedAt,
        reason: record.reason,
        note: record.note || undefined,
        previousExpiresAt: record.expiresAt,
        expiresAt: record.expiresAt,
      }));
      const updatedState: UserBlockState = {
        records: userBlockState.records.map((record) =>
          expiredIds.has(record.id)
            ? {
                ...record,
                endedAt,
                endedById: 'system',
                endedByName: 'System',
                endReason: 'expired',
              }
            : record
        ),
        events: [...userBlockState.events, ...events],
      };
      try {
        saveUserBlockState(updatedState);
      } catch {
        showToast('Could not save expired block history. Check browser storage.');
      }
      setUserBlockState(updatedState);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [userBlockState]);

  const availableDemoUsers = useMemo(
    () => {
      if (isSupabaseConfigured) {
        return profileState.profiles
          .filter(
            (profile) =>
              !profile.trashedAt &&
              ['Organizer', 'Super Admin'].includes(profile.role) &&
              (profile.approvalStatus ?? 'Approved') === 'Approved'
          )
          .map((profile) => ({
            id: profile.userId,
            fullName: profile.fullName,
            email: profile.email,
            phone: profile.phone,
            role: profile.role,
            affiliation: profile.institution || profile.department,
            badgeCode: profile.userId,
            createdAt: profile.createdAt,
          }));
      }
      return DEMO_ACCESS_ROLES.map((role) => DEMO_USERS[role]).filter(
        (user): user is SystemUser & { role: WorkspaceRole } =>
          !deletedDemoUserIds.includes(user.id)
      );
    },
    [deletedDemoUserIds, profileState.profiles]
  );

  const managedProfiles = useMemo(() => {
    const accounts: {
      user: SystemUser;
      status: ProfileAccountStatus;
      createdAt?: string;
      approved?: boolean;
    }[] = isSupabaseConfigured
      ? profileState.profiles
          .filter((profile) => !profile.trashedAt)
          .map((profile) => ({
            user: {
              id: profile.userId,
              fullName: profile.fullName,
              email: profile.email,
              phone: profile.phone,
              role: profile.role,
              affiliation: profile.institution || profile.department,
              badgeCode: profile.userId,
            },
            status: profile.accountStatus,
            createdAt: profile.createdAt,
            approved: profile.accountStatus === 'Active',
          }))
      : [
      ...availableDemoUsers.map((user) => ({
        user:
          user.role === 'Organizer'
            ? {
                ...user,
                fullName: organizerProfile.fullName,
                email: organizerProfile.email,
                phone: organizerProfile.phone,
                affiliation: organizerProfile.designation,
              }
            : user,
        status: 'Active' as const,
      })),
      ...registrationRequests.map((request) => ({
        user: {
          id: request.id,
          fullName: request.fullName,
          email: request.email,
          phone: request.phone,
          role:
            request.assignedRole ??
            (request.status === 'Approved' ? request.role : 'Participant'),
          affiliation: request.affiliation,
          badgeCode: request.id,
        },
        status:
          request.status === 'Approved'
            ? ('Active' as const)
            : request.status,
        createdAt: request.registeredAt,
        approved: request.status === 'Approved',
      })),
    ];

    return accounts.map(({ user, status, createdAt, approved }) => {
      const base = createDefaultUserProfile(user, status, createdAt);
      const stored = profileState.profiles.find(
        (profile) => profile.userId === user.id
      );
      const request = registrationRequests.find((item) => item.id === user.id);
      const accountStatus =
        stored?.accountStatus === 'Suspended'
          ? 'Suspended'
          : status;
      const verificationStatus: VerificationStatus =
        stored?.verificationStatus ??
        request?.verificationStatus ??
        ((stored?.verified ?? approved ?? base.verified) ? 'Verified' : 'Pending');
      return {
        ...base,
        ...stored,
        userId: user.id,
        role: isSupabaseConfigured ? user.role : stored?.role ?? user.role,
        requestedRole:
          stored?.requestedRole ?? request?.role ?? base.requestedRole,
        fullName: stored?.fullName ?? user.fullName,
        email: stored?.email ?? user.email,
        phone: stored?.phone ?? user.phone,
        accountStatus,
        verified: verificationStatus === 'Verified',
        verificationStatus,
        lastLoginAt: stored?.lastLoginAt ?? request?.lastLoginAt ?? base.lastLoginAt,
        canManageApprovals:
          stored?.canManageApprovals ??
          ((stored?.role ?? user.role) === 'Super Admin'),
        recommendedAction:
          stored?.recommendedAction ?? request?.recommendedAction ?? null,
        recommendedRole:
          stored?.recommendedRole ?? request?.recommendedRole ?? null,
        recommendedById:
          stored?.recommendedById ?? request?.recommendedById ?? null,
        recommendedByName:
          stored?.recommendedByName ?? request?.recommendedByName ?? null,
        recommendationNotes:
          stored?.recommendationNotes ?? request?.recommendationNotes ?? null,
        recommendedAt:
          stored?.recommendedAt ?? request?.recommendedAt ?? null,
        createdAt: createdAt ?? stored?.createdAt ?? base.createdAt,
      };
    });
  }, [
    availableDemoUsers,
    organizerProfile,
    profileState.profiles,
    registrationRequests,
  ]);

  const handleChangeMode = (nextMode: WorkspaceMode) => {
    if (
      nextMode === 'organizer' &&
      !canAccessOrganizerWorkspace(activeRole, activeProfile.approvalStatus)
    ) {
      return;
    }
    setMode(nextMode);
    setMobileMenuOpen(false);
    setActiveRoute('dashboard');
  };

  const handleNavigateProfile = () => {
    setSettingsSection('account');
    setMode(
      canAccessOrganizerWorkspace(activeRole, activeProfile.approvalStatus)
        ? 'organizer'
        : 'inbox'
    );
    setActiveRoute('profile');
    setMobileMenuOpen(false);
  };

  const handleNavigateSettings = (section: SettingsSection) => {
    setSettingsSection(section);
    setMode(
      canAccessOrganizerWorkspace(activeRole, activeProfile.approvalStatus)
        ? 'organizer'
        : 'inbox'
    );
    setActiveRoute('settings');
    setMobileMenuOpen(false);
  };

  const handleNavigateProfileManagement = () => {
    if (!canAccessOrganizerWorkspace(activeRole, activeProfile.approvalStatus)) {
      return;
    }
    setMode('organizer');
    setActiveRoute('profiles');
    setMobileMenuOpen(false);
  };

  const persistProfileState = (nextState: ProfileState, failureMessage: string) => {
    try {
      saveProfileState(nextState);
    } catch {
      showToast(failureMessage);
      return false;
    }
    setProfileState(nextState);
    return true;
  };

  const getProfileActor = () => {
    const actor =
      cloudUserId && registeredUser
        ? registeredUser
        : activeRole === 'Organizer'
        ? DEMO_USERS.Organizer
        : registeredUser ?? DEMO_USERS[activeRole];
    return {
      actorId: actor.id,
      actorName:
        cloudUserId && registeredUser
          ? registeredUser.fullName
          : activeRole === 'Organizer'
            ? organizerProfile.fullName
            : actor.fullName,
    };
  };

  const getCurrentProfileUserId = () =>
    cloudUserId ??
    (activeRole === 'Organizer'
      ? DEMO_USERS.Organizer.id
      : registeredUser?.id ?? DEMO_USERS[activeRole].id);

  const handleRefreshCloudProfiles = async (): Promise<string | null> => {
    if (!isSupabaseConfigured || !supabase) {
      return 'Supabase is not configured.';
    }
    try {
      const [
        cloudProfiles,
        roleChangeLogs,
        approvalLogs,
        verificationLogs,
        activityLogs,
        rolePermissions,
      ] = await Promise.all([
        fetchCloudProfiles(),
        fetchCloudRoleChangeLogs(),
        fetchCloudApprovalLogs(),
        fetchCloudVerificationLogs(),
        fetchCloudActivityLogs(),
        fetchCloudRolePermissions(),
      ]);
      setProfileState((previous) => ({
        ...previous,
        profiles: cloudProfiles.map(mapCloudProfile),
        roleChangeLogs,
        approvalLogs,
        verificationLogs,
        activityLogs,
        rolePermissions,
      }));
      setRegistrationRequests(
        cloudProfilesToRegistrationRequests(cloudProfiles)
      );
      return null;
    } catch (error) {
      return getSupabaseFailureMessage(error);
    }
  };

  const handleSaveUserProfile = (profile: UserProfile) => {
    const isSelf = profile.userId === getCurrentProfileUserId();
    const canEditOtherProfiles = canAccessOrganizerWorkspace(
      activeRole,
      activeProfile.approvalStatus
    );
    if (!isSelf && !canEditOtherProfiles) {
      showToast('You can only edit your own profile.');
      return;
    }
    if (
      !isSelf &&
      profile.role === 'Super Admin' &&
      activeRole !== 'Super Admin'
    ) {
      showToast('Only a Super Admin can edit a Super Admin profile.');
      return;
    }
    const actor = getProfileActor();
    const event = createProfileAuditEvent(
      profile.userId,
      actor.actorId,
      actor.actorName,
      'profile-updated',
      'Profile information updated'
    );
    const nextState: ProfileState = {
      ...profileState,
      profiles: [
        ...profileState.profiles.filter(
          (existing) => existing.userId !== profile.userId
        ),
        profile,
      ],
      events: [event, ...profileState.events].slice(0, 1000),
    };
    if (!persistProfileState(nextState, 'Could not save your profile. Check browser storage.')) {
      return;
    }
    if (isSupabaseConfigured) {
      void saveCloudProfile(profile).catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Unexpected Supabase error.';
        showToast(`Could not sync your profile with Supabase: ${message}`);
      });
      if (isSelf) {
        void rpcLogUserActivity(
          'profile_updated',
          'profile',
          'Updated personal profile details'
        );
      }
    }
    if (profile.userId === DEMO_USERS.Organizer.id) {
      setOrganizerProfile((current) => ({
        ...current,
        fullName: profile.fullName,
        phone: profile.phone,
        department: profile.department,
        email: profile.email,
      }));
    }
    showToast('Profile information saved.');
  };

  const handleSaveProfileNotifications = (profile: UserProfile) => {
    if (profile.userId !== getCurrentProfileUserId()) {
      showToast('You can only update your own notification preferences.');
      return;
    }
    const actor = getProfileActor();
    const event = createProfileAuditEvent(
      profile.userId,
      actor.actorId,
      actor.actorName,
      'notifications-updated',
      'Notification preferences updated'
    );
    const nextState: ProfileState = {
      ...profileState,
      profiles: [
        ...profileState.profiles.filter(
          (existing) => existing.userId !== profile.userId
        ),
        profile,
      ],
      events: [event, ...profileState.events].slice(0, 1000),
    };
    if (persistProfileState(nextState, 'Could not save notification preferences. Check browser storage.')) {
      if (isSupabaseConfigured) {
        void saveCloudProfile(profile).catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : 'Unexpected Supabase error.';
          showToast(
            `Could not sync notification preferences with Supabase: ${message}`
          );
        });
        void rpcLogUserActivity(
          'notifications_updated',
          'notifications',
          'Updated notification preferences'
        );
      }
      showToast('Notification preferences saved.');
    }
  };

  const handleSetProfileVerification = async (userId: string, verified: boolean) => {
    const canVerify = canAccessOrganizerWorkspace(
      activeRole,
      activeProfile.approvalStatus
    );
    if (!canVerify) return;
    const profile = managedProfiles.find((item) => item.userId === userId);
    if (
      !profile ||
      profile.verified === verified ||
      (profile.role === 'Super Admin' && activeRole !== 'Super Admin')
    ) return;
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.rpc('admin_update_profile_flags', {
        target_user_id: userId,
        new_account_status: null,
        new_verified: verified,
      });
      if (error) {
        showToast(`Could not update verification in Supabase: ${error.message}`);
        return;
      }
    }
    const actor = getProfileActor();
    const event = createProfileAuditEvent(
      userId,
      actor.actorId,
      actor.actorName,
      verified ? 'profile-verified' : 'profile-unverified',
      verified ? 'Profile verified' : 'Profile verification removed'
    );
    const nextProfile = { ...profile, verified };
    const nextState: ProfileState = {
      ...profileState,
      profiles: [
        ...profileState.profiles.filter((item) => item.userId !== userId),
        nextProfile,
      ],
      events: [event, ...profileState.events].slice(0, 1000),
    };
    if (persistProfileState(nextState, 'Could not update profile verification. Check browser storage.')) {
      showToast(verified ? 'Profile verified.' : 'Profile verification removed.');
    }
  };

  const handleSetProfileStatus = async (
    userId: string,
    status: ProfileAccountStatus
  ) => {
    if (activeRole !== 'Organizer' && activeRole !== 'Super Admin') return;
    const profile = managedProfiles.find((item) => item.userId === userId);
    if (
      !profile ||
      userId === getCurrentProfileUserId() ||
      profile.role === 'Super Admin' ||
      (profile.role === 'Organizer' && activeRole !== 'Super Admin') ||
      (status !== 'Suspended' && status !== 'Active')
    ) return;
    const request = registrationRequests.find((item) => item.id === userId);
    if (
      status === 'Active' &&
      request &&
      request.status !== 'Approved'
    ) {
      showToast('Only approved accounts can be reactivated.');
      return;
    }
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.rpc('admin_update_profile_flags', {
        target_user_id: userId,
        new_account_status: status,
        new_verified: null,
      });
      if (error) {
        showToast(`Could not update account status in Supabase: ${error.message}`);
        return;
      }
    }
    const actor = getProfileActor();
    const event = createProfileAuditEvent(
      userId,
      actor.actorId,
      actor.actorName,
      status === 'Suspended' ? 'account-suspended' : 'account-reactivated',
      status === 'Suspended' ? 'Account suspended' : 'Account reactivated'
    );
    const nextProfile = { ...profile, accountStatus: status };
    const nextState: ProfileState = {
      ...profileState,
      profiles: [
        ...profileState.profiles.filter((item) => item.userId !== userId),
        nextProfile,
      ],
      events: [event, ...profileState.events].slice(0, 1000),
    };
    if (persistProfileState(nextState, 'Could not update account status. Check browser storage.')) {
      showToast(status === 'Suspended' ? 'Account suspended.' : 'Account reactivated.');
    }
  };

  const handlePromoteUserToOrganizer = async (
    userId: string
  ): Promise<string | null> => {
    if (activeRole !== 'Super Admin' || !isSupabaseConfigured || !supabase) {
      return 'Only a signed-in Super Admin can promote users to Organizer.';
    }
    const profile = managedProfiles.find((item) => item.userId === userId);
    if (
      !profile ||
      profile.accountStatus !== 'Active' ||
      profile.role === 'Super Admin' ||
      userId === cloudUserId
    ) {
      return 'Only another active account that is not a Super Admin can be promoted.';
    }

    try {
      await rpcSuperAdminPromoteToOrganizer(userId);
    } catch (error) {
      return `Could not promote the user in Supabase: ${getSupabaseFailureMessage(error)}`;
    }

    const promotedProfile = {
      ...profile,
      role: 'Organizer' as const,
      assignedRole: 'Organizer' as const,
      approvalStatus: 'Approved' as const,
      verified: true,
      verificationStatus: 'Verified' as const,
    };
    setProfileState((previous) => ({
      ...previous,
      profiles: previous.profiles.map((item) =>
        item.userId === userId ? promotedProfile : item
      ),
    }));

    try {
      const cloudProfiles = await fetchCloudProfiles();
      setProfileState((previous) => ({
        ...previous,
        profiles: cloudProfiles.map(mapCloudProfile),
      }));
      setRegistrationRequests(
        cloudProfilesToRegistrationRequests(cloudProfiles)
      );
    } catch (error) {
      const message = getSupabaseFailureMessage(error);
      showToast(
        `User promoted to Organizer, but the directory refresh failed: ${message}`
      );
      return null;
    }
    showToast(`${profile.fullName} was promoted to Organizer.`);
    return null;
  };

  const verifyAccountPassword = async (
    userId: string,
    password: string,
    registration?: RegistrationRequest
  ) => {
    const storedCredential = profileState.credentials[userId];
    if (storedCredential) {
      return verifyRegistrationPassword(
        password,
        storedCredential.salt,
        storedCredential.hash
      );
    }
    if (registration) {
      return verifyRegistrationPassword(
        password,
        registration.passwordSalt,
        registration.passwordHash
      );
    }
    if (userId === DEMO_USERS.Organizer.id && organizerPassword !== null) {
      return password === organizerPassword;
    }
    return password === DEMO_PASSWORD;
  };

  const handleChangeUserPassword = async (
    userId: string,
    currentPassword: string,
    newPassword: string
  ) => {
    if (userId !== getCurrentProfileUserId()) {
      showToast('You can only change your own password.');
      return false;
    }
    if (isSupabaseConfigured && supabase && registeredUser) {
      try {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: registeredUser.email,
          password: currentPassword,
        });
        if (verifyError) return false;
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (error) {
          showToast(`Could not update your password: ${error.message}`);
          return false;
        }
        const actor = getProfileActor();
        const event = createProfileAuditEvent(
          userId,
          actor.actorId,
          actor.actorName,
          'password-changed',
          'Account password changed'
        );
        persistProfileState(
          { ...profileState, events: [event, ...profileState.events].slice(0, 1000) },
          'Password updated, but local activity history could not be saved.'
        );
        showToast('Password updated.');
        return true;
      } catch {
        showToast('Could not securely update your Supabase password.');
        return false;
      }
    }
    const request = registrationRequests.find((item) => item.id === userId);
    try {
      if (!(await verifyAccountPassword(userId, currentPassword, request))) {
        return false;
      }
      const credential = await hashRegistrationPassword(newPassword);
      const actor = getProfileActor();
      const event = createProfileAuditEvent(
        userId,
        actor.actorId,
        actor.actorName,
        'password-changed',
        'Account password changed'
      );
      const nextState: ProfileState = {
        ...profileState,
        credentials: {
          ...profileState.credentials,
          [userId]: { salt: credential.salt, hash: credential.hash },
        },
        passwordResetRequired: profileState.passwordResetRequired.filter(
          (id) => id !== userId
        ),
        events: [event, ...profileState.events].slice(0, 1000),
      };
      if (!persistProfileState(nextState, 'Could not save your password. Check browser storage.')) {
        return false;
      }
      if (request) {
        const updatedRequests = registrationRequests.map((item) =>
          item.id === userId
            ? {
                ...item,
                passwordSalt: credential.salt,
                passwordHash: credential.hash,
              }
            : item
        );
        try {
          saveRegistrationRequests(updatedRequests);
          setRegistrationRequests(updatedRequests);
        } catch {
          showToast('Password saved, but the registration record could not be synchronized.');
        }
      }
      if (userId === DEMO_USERS.Organizer.id) {
        setOrganizerPassword(newPassword);
      }
      showToast('Password updated.');
      return true;
    } catch {
      showToast('Secure password update is unavailable in this browser.');
      return false;
    }
  };

  const handleResetUserPassword = async (userId: string) => {
    if (activeRole !== 'Organizer' && activeRole !== 'Super Admin') return null;
    const target = managedProfiles.find((profile) => profile.userId === userId);
    if (
      !target ||
      target.userId === getCurrentProfileUserId() ||
      (target.role === 'Super Admin' && activeRole !== 'Super Admin')
    ) {
      return null;
    }
    try {
      const isCloudAuth = Boolean(isSupabaseConfigured && supabase);
      let temporaryPassword: string;
      let credential: Awaited<ReturnType<typeof hashRegistrationPassword>> | null =
        null;
      if (isCloudAuth && supabase) {
        const { data, error } = await supabase.functions.invoke<{
          temporaryPassword?: string;
          error?: string;
        }>('admin-reset-user-password', {
          body: { userId },
        });
        if (error) {
          const detail = await extractFunctionsInvokeError(error);
          showToast(`Could not reset the Supabase password: ${detail}`);
          return null;
        }
        if (!data || typeof data.temporaryPassword !== 'string') {
          showToast(data?.error ?? 'Supabase did not return a temporary password.');
          return null;
        }
        temporaryPassword = data.temporaryPassword;
      } else {
        const randomBytes = window.crypto.getRandomValues(new Uint8Array(8));
        temporaryPassword = `BAUST-${Array.from(randomBytes, (byte) =>
          byte.toString(16).padStart(2, '0')
        ).join('')}`;
        credential = await hashRegistrationPassword(temporaryPassword);
      }

      const actor = getProfileActor();
      const event = createProfileAuditEvent(
        userId,
        actor.actorId,
        actor.actorName,
        'password-reset',
        'Administrator reset the account password'
      );
      const nextState: ProfileState = {
        ...profileState,
        credentials: credential
          ? {
              ...profileState.credentials,
              [userId]: { salt: credential.salt, hash: credential.hash },
            }
          : profileState.credentials,
        passwordResetRequired: credential
          ? [...new Set([...profileState.passwordResetRequired, userId])]
          : profileState.passwordResetRequired,
        events: [event, ...profileState.events].slice(0, 1000),
      };
          const activitySaved = persistProfileState(
            nextState,
            isCloudAuth
              ? 'Password was reset in Supabase, but local activity history could not be saved.'
              : 'Could not reset the password. Check browser storage.'
          );
          if (!activitySaved && !isCloudAuth) return null;
          showToast(
            isCloudAuth
              ? `Temporary password set in Supabase Auth for ${target.fullName}.`
              : `Temporary password created for ${target.fullName}.`
          );
      return temporaryPassword;
    } catch (error) {
          showToast(`Could not reset the password: ${getSupabaseFailureMessage(error)}`);
      return null;
    }
  };

  const handleSaveOrganizerProfile = (profile: OrganizerProfile) => {
    setOrganizerProfile(profile);
    const storedProfile =
      managedProfiles.find(
        (item) => item.userId === getCurrentProfileUserId()
      ) ?? createDefaultUserProfile(DEMO_USERS.Organizer);
    handleSaveUserProfile({
      ...storedProfile,
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      department: profile.department,
      accountStatus: profile.accountStatus === 'Inactive' ? 'Suspended' : 'Active',
    });
  };

  const handlePasswordUpdated = (
    currentPassword: string,
    newPassword: string
  ) =>
    handleChangeUserPassword(
      getCurrentProfileUserId(),
      currentPassword,
      newPassword
    );

  const handleRequestPasswordReset = async (
    email: string
  ): Promise<string | null> => {
    if (!supabase) {
      return 'Supabase authentication is not configured. Contact the system administrator.';
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      return error ? error.message : null;
    } catch (error) {
      return `Could not send the password reset email: ${getSupabaseFailureMessage(error)}`;
    }
  };

  const handleCompletePasswordReset = async (
    password: string
  ): Promise<string | null> => {
    if (!supabase) {
      return 'Supabase authentication is not configured. Contact the system administrator.';
    }
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) return sessionError.message;
      if (!data.session || !passwordRecoveryRef.current) {
        return 'This password reset link is invalid or expired. Request a new link and try again.';
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return error.message;

      passwordRecoveryRef.current = false;
      setPasswordRecoveryMode(false);
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        showToast(
          'Password updated. Sign out manually before signing in with the new password.'
        );
      } else {
        showToast('Password updated. Sign in with your new password.');
      }
      return null;
    } catch (error) {
      return `Could not update the password: ${getSupabaseFailureMessage(error)}`;
    }
  };

  const handleCredentialSignIn = async (
    identifier: string,
    password: string
  ): Promise<string | null> => {
    if (!isSupabaseConfigured || !supabase) {
      return 'Supabase authentication is not configured. Contact the system administrator.';
    }
    if (!identifier.includes('@')) {
      return 'Sign in with the email address linked to your Supabase account.';
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: identifier.trim().toLowerCase(),
      password,
    });
    if (error) return error.message;
    if (!data.user) return 'Supabase did not return an authenticated user.';
    passwordRecoveryRef.current = false;
    setPasswordRecoveryMode(false);
    return activateSupabaseUser(data.user.id, data.user.email ?? identifier);
  };

  const handleRegisterUser = async (
    input: RegistrationInput
  ): Promise<string | null> => {
    if (!isSupabaseConfigured || !supabase) {
      return 'Supabase authentication is not configured. Contact the system administrator.';
    }
    const normalizedEmail = input.email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: input.password,
      options: {
        data: {
          full_name: input.fullName.trim(),
          phone: input.phone.trim(),
          requested_role: input.role,
          department: input.affiliation.trim(),
          institution: input.affiliation.trim(),
        },
      },
    });
    if (error) return error.message;

    if (data.session && data.user) {
      return activateSupabaseUser(
        data.user.id,
        data.user.email ?? normalizedEmail
      );
    }

    if (data.user) {
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: input.password,
      });
      if (signInData.session && signInData.user) {
        return activateSupabaseUser(
          signInData.user.id,
          signInData.user.email ?? normalizedEmail
        );
      }
    }

    showToast('Account created. You can sign in now with your credentials.');
    return null;
  };

  const handleUpdateRegistrationStatus = async (
    requestId: string,
    status: 'Approved' | 'Rejected',
    options?: {
      assignedRole?: WorkspaceRole;
      approvalNotes?: string;
      markVerified?: boolean;
    }
  ) => {
    const canApproveDirectly =
      activeRole === 'Super Admin' ||
      (activeRole === 'Organizer' && Boolean(activeProfile.canManageApprovals));
    if (!canApproveDirectly) {
      showToast(
        'Only Super Admins or Organizers with delegated approval permission can change approval status.'
      );
      return;
    }
    if (requestId === activeProfileUserId) {
      showToast('You cannot approve, reject, or assign roles to your own account.');
      return;
    }
    const requestedAssignedRole = options?.assignedRole;
    if (
      requestedAssignedRole &&
      ['Organizer', 'Super Admin'].includes(requestedAssignedRole) &&
      activeRole !== 'Super Admin'
    ) {
      showToast('Only a Super Admin can assign Organizer or Super Admin roles.');
      return;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await rpcReviewUserRegistration(
          requestId,
          status === 'Approved',
          requestedAssignedRole ?? null,
          options?.approvalNotes ?? '',
          Boolean(options?.markVerified)
        );
      } catch (error) {
        showToast(
          `Could not update registration in Supabase: ${getSupabaseFailureMessage(error)}`
        );
        return;
      }
      const refreshError = await handleRefreshCloudProfiles();
      if (refreshError) {
        showToast(
          `Registration updated, but profiles could not refresh: ${refreshError}`
        );
        return;
      }
      showToast(
        status === 'Approved'
          ? 'User approved in Supabase and can now sign in.'
          : 'Registration rejected in Supabase.'
      );
      return;
    }

    const nowIso = new Date().toISOString();
    const actor = getProfileActor();
    const targetReq = registrationRequests.find((r) => r.id === requestId);
    if (
      !targetReq ||
      targetReq.trashedAt ||
      (targetReq.status !== 'Pending Approval' &&
        !(status === 'Approved' && targetReq.status === 'Rejected'))
    ) {
      return;
    }
    const finalAssignedRole: WorkspaceRole =
      status === 'Approved'
        ? requestedAssignedRole ?? targetReq.role
        : 'Participant';
    const nextVerification: VerificationStatus =
      status === 'Approved' && options?.markVerified
        ? 'Verified'
        : targetReq.verificationStatus ?? 'Pending';

    const updatedRequests = registrationRequests.map((request) =>
      request.id === requestId
        ? {
            ...request,
            status,
            assignedRole: finalAssignedRole,
            verificationStatus: nextVerification,
            reviewedAt: nowIso,
          }
        : request
    );
    try {
      saveRegistrationRequests(updatedRequests);
    } catch {
      showToast('Could not save the approval decision. Check browser storage.');
      return;
    }
    setRegistrationRequests(updatedRequests);

    const existingProfile =
      managedProfiles.find((p) => p.userId === requestId) ??
      createDefaultUserProfile({
        id: targetReq.id,
        fullName: targetReq.fullName,
        email: targetReq.email,
        phone: targetReq.phone,
        role: finalAssignedRole,
        affiliation: targetReq.affiliation,
        badgeCode: targetReq.id,
      });
    const prevRole = existingProfile.role;
    const nextProfile: UserProfile = {
      ...existingProfile,
      role: finalAssignedRole,
      requestedRole: targetReq.role,
      accountStatus: status === 'Approved' ? 'Active' : 'Rejected',
      verificationStatus: nextVerification,
      verified: nextVerification === 'Verified',
    };
    const approvalEntry: ApprovalLog = {
      id: `app-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: requestId,
      userEmail: targetReq.email,
      userName: targetReq.fullName,
      action: status === 'Approved' ? 'approved' : 'rejected',
      requestedRole: targetReq.role,
      assignedRole: finalAssignedRole,
      previousStatus: targetReq.status,
      newStatus: status === 'Approved' ? 'Active' : 'Rejected',
      actorId: actor.actorId,
      actorName: actor.actorName,
      createdAt: nowIso,
      approvalNotes: options?.approvalNotes ?? '',
    };
    const roleLogEntry: RoleChangeLog[] =
      prevRole !== finalAssignedRole
        ? [
            {
              id: `role-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              userId: requestId,
              userEmail: targetReq.email,
              userName: targetReq.fullName,
              previousRole: prevRole,
              newRole: finalAssignedRole,
              changedById: actor.actorId,
              changedByName: actor.actorName,
              changedAt: nowIso,
              notes: options?.approvalNotes || `Assigned on registration ${status.toLowerCase()}`,
            },
          ]
        : [];
    persistProfileState(
      {
        ...profileState,
        profiles: [
          ...profileState.profiles.filter((p) => p.userId !== requestId),
          nextProfile,
        ],
        approvalLogs: [approvalEntry, ...(profileState.approvalLogs ?? [])].slice(0, 500),
        roleChangeLogs: [
          ...roleLogEntry,
          ...(profileState.roleChangeLogs ?? []),
        ].slice(0, 500),
      },
      'Approval decision saved, but audit logs could not be written locally.'
    );
    showToast(
      status === 'Approved'
        ? `${targetReq.fullName} approved as ${finalAssignedRole}.`
        : `${targetReq.fullName} rejected.`
    );
  };

  const handleBulkUpdateRegistrationStatus = async (
    requestIds: string[],
    status: 'Approved' | 'Rejected',
    notes = ''
  ): Promise<string | null> => {
    const canApproveDirectly =
      activeRole === 'Super Admin' ||
      (activeRole === 'Organizer' && Boolean(activeProfile.canManageApprovals));
    if (!canApproveDirectly || requestIds.length === 0) {
      return 'You do not have permission to change approval statuses.';
    }
    const filteredIds = requestIds.filter((id) => id !== activeProfileUserId);
    if (filteredIds.length === 0) {
      return 'Self-approval is not permitted.';
    }
    if (isSupabaseConfigured && supabase) {
      let succeeded = 0;
      let firstError: string | null = null;
      for (const id of filteredIds) {
        try {
          await rpcReviewUserRegistration(
            id,
            status === 'Approved',
            null,
            notes,
            status === 'Approved'
          );
          succeeded += 1;
        } catch (error) {
          if (!firstError) firstError = getSupabaseFailureMessage(error);
        }
      }
      const refreshError = await handleRefreshCloudProfiles();
      if (firstError) {
        const msg = `Processed ${succeeded}/${filteredIds.length} requests. Error: ${firstError}`;
        showToast(msg);
        return msg;
      }
      if (refreshError) {
        showToast(
          `Updated ${succeeded} requests, but directory refresh failed: ${refreshError}`
        );
        return null;
      }
      showToast(
        `${succeeded} registration${succeeded === 1 ? '' : 's'} ${
          status === 'Approved' ? 'approved' : 'rejected'
        } in Supabase.`
      );
      return null;
    }
    for (const id of filteredIds) {
      await handleUpdateRegistrationStatus(id, status, {
        approvalNotes: notes,
        markVerified: status === 'Approved',
      });
    }
    return null;
  };

  const handleAssignUserRole = async (
    userId: string,
    newRole: WorkspaceRole,
    notes: string
  ): Promise<string | null> => {
    if (activeRole !== 'Super Admin') {
      return 'Only Super Admins can assign or change user roles.';
    }
    if (userId === activeProfileUserId) {
      return 'Users cannot change or promote their own role.';
    }
    const target = managedProfiles.find((p) => p.userId === userId);
    if (!target) return 'Target user not found.';

    if (isSupabaseConfigured && supabase) {
      try {
        await rpcSuperAdminAssignRole(userId, newRole, notes);
      } catch (error) {
        return `Could not assign role: ${getSupabaseFailureMessage(error)}`;
      }
      const refreshError = await handleRefreshCloudProfiles();
      if (refreshError) {
        showToast(`Role assigned, but directory refresh failed: ${refreshError}`);
      } else {
        showToast(`${target.fullName} is now ${newRole}.`);
      }
      return null;
    }

    const nowIso = new Date().toISOString();
    const actor = getProfileActor();
    const updatedProfile: UserProfile = {
      ...target,
      role: newRole,
      canManageApprovals:
        newRole === 'Super Admin' ? true : target.canManageApprovals ?? false,
    };
    const roleLog: RoleChangeLog = {
      id: `role-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId,
      userEmail: target.email,
      userName: target.fullName,
      previousRole: target.role,
      newRole,
      changedById: actor.actorId,
      changedByName: actor.actorName,
      changedAt: nowIso,
      notes,
    };
    const updatedRequests = registrationRequests.map((r) =>
      r.id === userId ? { ...r, assignedRole: newRole } : r
    );
    saveRegistrationRequests(updatedRequests);
    setRegistrationRequests(updatedRequests);
    persistProfileState(
      {
        ...profileState,
        profiles: [
          ...profileState.profiles.filter((p) => p.userId !== userId),
          updatedProfile,
        ],
        roleChangeLogs: [roleLog, ...(profileState.roleChangeLogs ?? [])].slice(
          0,
          500
        ),
      },
      'Could not save role change locally.'
    );
    showToast(`${target.fullName} role updated to ${newRole}.`);
    return null;
  };

  const handleBulkAssignUserRoles = async (
    userIds: string[],
    newRole: WorkspaceRole,
    notes: string
  ): Promise<string | null> => {
    if (activeRole !== 'Super Admin') {
      return 'Only Super Admins can bulk assign user roles.';
    }
    const eligibleIds = userIds.filter((id) => id !== activeProfileUserId);
    if (eligibleIds.length === 0) {
      return 'Select at least one other user (self role modification is blocked).';
    }
    if (isSupabaseConfigured && supabase) {
      try {
        const count = await rpcSuperAdminBulkAssignRoles(
          eligibleIds,
          newRole,
          notes
        );
        const refreshError = await handleRefreshCloudProfiles();
        if (refreshError) {
          showToast(
            `Updated ${count} roles, but refresh failed: ${refreshError}`
          );
        } else {
          showToast(`Assigned ${newRole} to ${count} user(s).`);
        }
        return null;
      } catch (error) {
        return `Bulk role assignment failed: ${getSupabaseFailureMessage(error)}`;
      }
    }
    for (const id of eligibleIds) {
      await handleAssignUserRole(id, newRole, notes);
    }
    return null;
  };

  const handleUpdateVerificationStatus = async (
    userId: string,
    newStatus: VerificationStatus,
    notes: string
  ): Promise<string | null> => {
    if (!canAccessOrganizerWorkspace(activeRole, activeProfile.approvalStatus)) {
      return 'Only approved Organizers or Super Admins can verify user information.';
    }
    if (userId === activeProfileUserId) {
      return 'You cannot change your own verification status.';
    }
    const target = managedProfiles.find((p) => p.userId === userId);
    if (!target) return 'User not found.';
    if (target.role === 'Super Admin' && activeRole !== 'Super Admin') {
      return 'Only a Super Admin can modify another Super Admin verification state.';
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await rpcStaffUpdateVerification(userId, newStatus, notes);
      } catch (error) {
        return `Verification update failed: ${getSupabaseFailureMessage(error)}`;
      }
      const refreshError = await handleRefreshCloudProfiles();
      if (refreshError) {
        showToast(
          `Verification saved, but refresh failed: ${refreshError}`
        );
      } else {
        showToast(`${target.fullName} verification set to ${newStatus}.`);
      }
      return null;
    }

    const nowIso = new Date().toISOString();
    const actor = getProfileActor();
    const prevStatus: VerificationStatus = target.verificationStatus ?? 'Pending';
    const updatedProfile: UserProfile = {
      ...target,
      verificationStatus: newStatus,
      verified: newStatus === 'Verified',
    };
    const vLog: VerificationLog = {
      id: `ver-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId,
      userEmail: target.email,
      userName: target.fullName,
      previousStatus: prevStatus,
      newStatus,
      verifiedById: actor.actorId,
      verifiedByName: actor.actorName,
      verifiedAt: nowIso,
      verificationNotes: notes,
    };
    const updatedRequests = registrationRequests.map((r) =>
      r.id === userId ? { ...r, verificationStatus: newStatus } : r
    );
    saveRegistrationRequests(updatedRequests);
    setRegistrationRequests(updatedRequests);
    persistProfileState(
      {
        ...profileState,
        profiles: [
          ...profileState.profiles.filter((p) => p.userId !== userId),
          updatedProfile,
        ],
        verificationLogs: [
          vLog,
          ...(profileState.verificationLogs ?? []),
        ].slice(0, 500),
      },
      'Could not save verification update locally.'
    );
    showToast(`${target.fullName} marked ${newStatus}.`);
    return null;
  };

  const handleBulkVerifyUsers = async (
    userIds: string[],
    newStatus: VerificationStatus,
    notes: string
  ): Promise<string | null> => {
    if (!canAccessOrganizerWorkspace(activeRole, activeProfile.approvalStatus)) {
      return 'Only staff can bulk verify users.';
    }
    const eligibleIds = userIds.filter((id) => id !== activeProfileUserId);
    if (eligibleIds.length === 0) {
      return 'Select at least one other user.';
    }
    if (isSupabaseConfigured && supabase) {
      try {
        const count = await rpcStaffBulkVerifyUsers(
          eligibleIds,
          newStatus,
          notes
        );
        const refreshError = await handleRefreshCloudProfiles();
        if (refreshError) {
          showToast(
            `Verified ${count} users, but refresh failed: ${refreshError}`
          );
        } else {
          showToast(`Updated verification (${newStatus}) for ${count} user(s).`);
        }
        return null;
      } catch (error) {
        return `Bulk verification failed: ${getSupabaseFailureMessage(error)}`;
      }
    }
    for (const id of eligibleIds) {
      await handleUpdateVerificationStatus(id, newStatus, notes);
    }
    return null;
  };

  const handleRecommendRegistration = async (
    requestId: string,
    recommendation: 'Approve' | 'Reject',
    suggestedRole?: RegistrableRole,
    notes = ''
  ): Promise<string | null> => {
    if (!canAccessOrganizerWorkspace(activeRole, activeProfile.approvalStatus)) {
      return 'Only Organizers or Super Admins can submit recommendations.';
    }
    if (requestId === activeProfileUserId) {
      return 'You cannot recommend your own registration.';
    }
    if (isSupabaseConfigured && supabase) {
      try {
        await rpcRecommendRegistration(
          requestId,
          recommendation,
          suggestedRole ?? null,
          notes
        );
      } catch (error) {
        return `Could not save recommendation: ${getSupabaseFailureMessage(error)}`;
      }
      await handleRefreshCloudProfiles();
      showToast(`Recommendation (${recommendation}) saved.`);
      return null;
    }

    const nowIso = new Date().toISOString();
    const actor = getProfileActor();
    const req = registrationRequests.find((r) => r.id === requestId);
    if (!req) return 'Registration request not found.';
    const finalSuggestedRole = suggestedRole ?? req.role;
    const updatedRequests = registrationRequests.map((item) =>
      item.id === requestId
        ? {
            ...item,
            recommendedAction: recommendation,
            recommendedRole: finalSuggestedRole,
            recommendedById: actor.actorId,
            recommendedByName: actor.actorName,
            recommendationNotes: notes,
            recommendedAt: nowIso,
          }
        : item
    );
    saveRegistrationRequests(updatedRequests);
    setRegistrationRequests(updatedRequests);

    const existing = managedProfiles.find((p) => p.userId === requestId);
    const appLog: ApprovalLog = {
      id: `app-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: requestId,
      userEmail: req.email,
      userName: req.fullName,
      action: 'recommended',
      requestedRole: req.role,
      assignedRole: finalSuggestedRole,
      previousStatus: req.status,
      newStatus: `Recommended ${recommendation}`,
      actorId: actor.actorId,
      actorName: actor.actorName,
      createdAt: nowIso,
      approvalNotes: notes,
    };
    persistProfileState(
      {
        ...profileState,
        profiles: existing
          ? [
              ...profileState.profiles.filter((p) => p.userId !== requestId),
              {
                ...existing,
                recommendedAction: recommendation,
                recommendedRole: finalSuggestedRole,
                recommendedById: actor.actorId,
                recommendedByName: actor.actorName,
                recommendationNotes: notes,
                recommendedAt: nowIso,
              },
            ]
          : profileState.profiles,
        approvalLogs: [appLog, ...(profileState.approvalLogs ?? [])].slice(
          0,
          500
        ),
      },
      'Could not save recommendation audit log.'
    );
    showToast(`Recommendation (${recommendation}) recorded for ${req.fullName}.`);
    return null;
  };

  const handleSetOrganizerPermission = async (
    userId: string,
    granted: boolean,
    notes = ''
  ): Promise<string | null> => {
    if (activeRole !== 'Super Admin') {
      return 'Only Super Admins can grant or revoke Organizer approval permissions.';
    }
    if (userId === activeProfileUserId) {
      return 'You cannot change your own permissions.';
    }
    const target = managedProfiles.find((p) => p.userId === userId);
    if (!target || target.role !== 'Organizer') {
      return 'Approval delegation applies only to Organizer accounts.';
    }
    if (isSupabaseConfigured && supabase) {
      try {
        await rpcSuperAdminSetOrganizerPermission(userId, granted, notes);
      } catch (error) {
        return `Could not update permission: ${getSupabaseFailureMessage(error)}`;
      }
      await handleRefreshCloudProfiles();
      showToast(
        granted
          ? `Granted direct approval permission to ${target.fullName}.`
          : `Revoked direct approval permission from ${target.fullName}.`
      );
      return null;
    }

    const nowIso = new Date().toISOString();
    const actor = getProfileActor();
    const appLog: ApprovalLog = {
      id: `app-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId,
      userEmail: target.email,
      userName: target.fullName,
      action: granted ? 'permission_granted' : 'permission_revoked',
      requestedRole: target.requestedRole ?? target.role,
      assignedRole: target.role,
      previousStatus: String(Boolean(target.canManageApprovals)),
      newStatus: String(granted),
      actorId: actor.actorId,
      actorName: actor.actorName,
      createdAt: nowIso,
      approvalNotes: notes,
    };
    persistProfileState(
      {
        ...profileState,
        profiles: [
          ...profileState.profiles.filter((p) => p.userId !== userId),
          { ...target, canManageApprovals: granted },
        ],
        approvalLogs: [appLog, ...(profileState.approvalLogs ?? [])].slice(
          0,
          500
        ),
      },
      'Could not save permission update locally.'
    );
    showToast(
      granted
        ? `Granted direct approval permission to ${target.fullName}.`
        : `Revoked direct approval permission from ${target.fullName}.`
    );
    return null;
  };

  const handleBulkSetProfileStatus = async (
    userIds: string[],
    status: 'Active' | 'Suspended'
  ) => {
    if (!canAccessOrganizerWorkspace(activeRole) || userIds.length === 0) {
      return;
    }
    for (const id of userIds) {
      await handleSetProfileStatus(id, status);
    }
  };

  const handleSendPasswordResetEmail = async (
    email: string
  ): Promise<string | null> => {
    const error = await handleRequestPasswordReset(email);
    if (!error) {
      showToast(`Password reset email sent to ${email}.`);
    }
    return error;
  };

  const handleTrashRejectedUser = async (
    userId: string
  ): Promise<string | null> => {
    if (activeRole !== 'Super Admin') {
      return 'Only a Super Admin can move rejected accounts to Trash.';
    }
    const request = registrationRequests.find((item) => item.id === userId);
    if (!request || request.status !== 'Rejected' || request.trashedAt) {
      return 'Only a rejected account can be moved to Trash.';
    }

    const trashedAt = new Date().toISOString();
    if (!isSupabaseConfigured || !supabase) {
      const updatedRequests = registrationRequests.map((item) =>
        item.id === userId ? { ...item, trashedAt } : item
      );
      try {
        saveRegistrationRequests(updatedRequests);
      } catch {
        return 'Could not save Trash update. Check browser storage.';
      }
      setRegistrationRequests(updatedRequests);
      showToast(`${request.fullName} moved to Trash.`);
      return null;
    }

    try {
      const { error } = await supabase.rpc(
        'super_admin_trash_rejected_user',
        { target_user_id: userId }
      );
      if (error) return `Could not move the account to Trash: ${error.message}`;
      setRegistrationRequests((previous) =>
        previous.map((item) =>
          item.id === userId ? { ...item, trashedAt } : item
        )
      );
      setProfileState((previous) => ({
        ...previous,
        profiles: previous.profiles.map((profile) =>
          profile.userId === userId ? { ...profile, trashedAt } : profile
        ),
      }));
      const profiles = await fetchCloudProfiles();
      setProfileState((previous) => ({
        ...previous,
        profiles: profiles.map(mapCloudProfile),
      }));
      setRegistrationRequests(cloudProfilesToRegistrationRequests(profiles));
      showToast(`${request.fullName} moved to Trash.`);
      return null;
    } catch (error) {
      const message = getSupabaseFailureMessage(error);
      showToast(
        `The account was moved to Trash, but the list could not refresh: ${message}`
      );
      return null;
    }
  };

  const handleRestoreTrashedUser = async (
    userId: string
  ): Promise<string | null> => {
    if (activeRole !== 'Super Admin') {
      return 'Only a Super Admin can restore accounts from Trash.';
    }
    const request = registrationRequests.find((item) => item.id === userId);
    if (!request?.trashedAt) return 'This account is not in Trash.';

    if (!isSupabaseConfigured || !supabase) {
      const updatedRequests = registrationRequests.map((item) =>
        item.id === userId ? { ...item, trashedAt: undefined } : item
      );
      try {
        saveRegistrationRequests(updatedRequests);
      } catch {
        return 'Could not restore account. Check browser storage.';
      }
      setRegistrationRequests(updatedRequests);
      showToast(`${request.fullName} restored to Rejected users.`);
      return null;
    }

    try {
      const { error } = await supabase.rpc(
        'super_admin_restore_rejected_user',
        { target_user_id: userId }
      );
      if (error) return `Could not restore the account: ${error.message}`;
      setRegistrationRequests((previous) =>
        previous.map((item) =>
          item.id === userId ? { ...item, trashedAt: undefined } : item
        )
      );
      setProfileState((previous) => ({
        ...previous,
        profiles: previous.profiles.map((profile) =>
          profile.userId === userId
            ? { ...profile, trashedAt: undefined }
            : profile
        ),
      }));
      const profiles = await fetchCloudProfiles();
      setProfileState((previous) => ({
        ...previous,
        profiles: profiles.map(mapCloudProfile),
      }));
      setRegistrationRequests(cloudProfilesToRegistrationRequests(profiles));
      showToast(`${request.fullName} restored to Rejected users.`);
      return null;
    } catch (error) {
      const message = getSupabaseFailureMessage(error);
      showToast(
        `The account was restored, but the list could not refresh: ${message}`
      );
      return null;
    }
  };

  const handleBulkTrashRejectedUsers = async (
    userIds: string[]
  ): Promise<string | null> => {
    if (activeRole !== 'Super Admin') {
      return 'Only a Super Admin can move rejected accounts to Trash.';
    }
    const targets = userIds.filter((id) => {
      const req = registrationRequests.find((item) => item.id === id);
      return Boolean(req && req.status === 'Rejected' && !req.trashedAt);
    });
    if (targets.length === 0) return null;

    if (!isSupabaseConfigured || !supabase) {
      const trashedAt = new Date().toISOString();
      const targetSet = new Set(targets);
      const updated = registrationRequests.map((item) =>
        targetSet.has(item.id) ? { ...item, trashedAt } : item
      );
      try {
        saveRegistrationRequests(updated);
      } catch {
        return 'Could not save Trash updates. Check browser storage.';
      }
      setRegistrationRequests(updated);
      showToast(
        `${targets.length} rejected account${targets.length === 1 ? '' : 's'} moved to Trash.`
      );
      return null;
    }

    let succeeded = 0;
    let firstError: string | null = null;
    for (const id of targets) {
      const { error } = await supabase.rpc('super_admin_trash_rejected_user', {
        target_user_id: id,
      });
      if (error) {
        if (!firstError) firstError = error.message;
      } else {
        succeeded += 1;
      }
    }
    const refreshError = await handleRefreshCloudProfiles();
    if (firstError) {
      return `Moved ${succeeded}/${targets.length} accounts to Trash. Error: ${firstError}`;
    }
    if (refreshError) {
      showToast(
        `Moved ${succeeded} accounts to Trash, but directory refresh failed: ${refreshError}`
      );
      return null;
    }
    showToast(
      `${succeeded} rejected account${succeeded === 1 ? '' : 's'} moved to Trash.`
    );
    return null;
  };

  const handleBulkRestoreTrashedUsers = async (
    userIds: string[]
  ): Promise<string | null> => {
    if (activeRole !== 'Super Admin') {
      return 'Only a Super Admin can restore accounts from Trash.';
    }
    const targets = userIds.filter((id) => {
      const req = registrationRequests.find((item) => item.id === id);
      return Boolean(req?.trashedAt);
    });
    if (targets.length === 0) return null;

    if (!isSupabaseConfigured || !supabase) {
      const targetSet = new Set(targets);
      const updated = registrationRequests.map((item) =>
        targetSet.has(item.id) ? { ...item, trashedAt: undefined } : item
      );
      try {
        saveRegistrationRequests(updated);
      } catch {
        return 'Could not restore accounts. Check browser storage.';
      }
      setRegistrationRequests(updated);
      showToast(
        `${targets.length} account${targets.length === 1 ? '' : 's'} restored from Trash.`
      );
      return null;
    }

    let succeeded = 0;
    let firstError: string | null = null;
    for (const id of targets) {
      const { error } = await supabase.rpc(
        'super_admin_restore_rejected_user',
        { target_user_id: id }
      );
      if (error) {
        if (!firstError) firstError = error.message;
      } else {
        succeeded += 1;
      }
    }
    const refreshError = await handleRefreshCloudProfiles();
    if (firstError) {
      return `Restored ${succeeded}/${targets.length} accounts. Error: ${firstError}`;
    }
    if (refreshError) {
      showToast(
        `Restored ${succeeded} accounts, but directory refresh failed: ${refreshError}`
      );
      return null;
    }
    showToast(
      `${succeeded} account${succeeded === 1 ? '' : 's'} restored to Rejected users.`
    );
    return null;
  };

  const handleDeleteUser = (userId: string) => {
    if (
      !canAccessOrganizerWorkspace(activeRole, activeProfile.approvalStatus) ||
      userId === DEMO_USERS.Organizer.id ||
      userId === DEMO_USERS['Super Admin'].id
    ) {
      return;
    }

    const registration = registrationRequests.find(
      (request) => request.id === userId
    );
    if (registration) {
      const updatedRequests = registrationRequests.filter(
        (request) => request.id !== userId
      );
      try {
        saveRegistrationRequests(updatedRequests);
      } catch {
        showToast('Could not delete the user. Check browser storage.');
        return;
      }
      setRegistrationRequests(updatedRequests);
      showToast(`${registration.fullName} and their account were deleted.`);
      return;
    }

    const demoUser = availableDemoUsers.find((user) => user.id === userId);
    if (!demoUser || demoUser.role === 'Organizer') return;
    const updatedDeletedIds = [...deletedDemoUserIds, demoUser.id];
    try {
      saveDeletedDemoUserIds(updatedDeletedIds);
    } catch {
      showToast('Could not delete the user. Check browser storage.');
      return;
    }
    setDeletedDemoUserIds(updatedDeletedIds);
    showToast(`${demoUser.fullName} and their account were deleted.`);
  };

  const handleBlockUser = async (
    userId: string,
    expiresAt: string | null,
    reason: UserBlockReason,
    note: string
  ) => {
    const canManageBlocks =
      activeRole === 'Organizer' || activeRole === 'Super Admin';
    const actorInfo = getProfileActor();
    const actor = { id: actorInfo.actorId, name: actorInfo.actorName };
    const targetProfile = managedProfiles.find(
      (profile) => profile.userId === userId
    );
    if (
      !canManageBlocks ||
      userId === actor.id ||
      targetProfile?.role === 'Super Admin' ||
      (targetProfile?.role === 'Organizer' && activeRole !== 'Super Admin')
    ) {
      return;
    }
    if (expiresAt !== null && Date.parse(expiresAt) <= Date.now()) {
      showToast('Choose a future expiry time for this block.');
      return;
    }
    if (findActiveUserBlock(userBlockState.records, userId)) {
      showToast('This user already has an active block.');
      return;
    }
    const registration = registrationRequests.find(
      (request) => request.id === userId
    );
    const demoUser = availableDemoUsers.find((user) => user.id === userId);
    const userName =
      targetProfile?.fullName ?? registration?.fullName ?? demoUser?.fullName;
    if (!userName) return;

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.rpc('admin_update_profile_flags', {
        target_user_id: userId,
        new_account_status: 'Suspended',
        new_verified: null,
      });
      if (error) {
        showToast(`Could not suspend & block user in Supabase: ${error.message}`);
        return;
      }
      setProfileState((previous) => ({
        ...previous,
        profiles: previous.profiles.map((profile) =>
          profile.userId === userId
            ? { ...profile, accountStatus: 'Suspended' }
            : profile
        ),
      }));
    }

    const now = new Date();
    const blockId = `user-block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const block = {
      id: blockId,
      userId,
      blockedAt: now.toISOString(),
      expiresAt,
      reason,
      note,
      blockedById: actor.id,
      blockedByName: actor.name,
    };
    const event: UserBlockAuditEvent = {
      id: `block-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      blockId,
      userId,
      action: 'blocked',
      actorId: actor.id,
      actorName: actor.name,
      occurredAt: now.toISOString(),
      reason,
      note: note || undefined,
      expiresAt,
    };
    const updatedState: UserBlockState = {
      records: [...userBlockState.records, block],
      events: [...userBlockState.events, event],
    };
    try {
      saveUserBlockState(updatedState);
    } catch {
      showToast('Could not block the user. Check browser storage.');
      return;
    }
    setUserBlockState(updatedState);
    showToast(
      expiresAt
        ? `${userName} is blocked until ${new Intl.DateTimeFormat('en-BD', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Dhaka',
          }).format(new Date(expiresAt))}.`
        : `${userName} is permanently blocked.`
    );
  };

  const handleUnblockUser = async (blockId: string) => {
    if (activeRole !== 'Organizer' && activeRole !== 'Super Admin') {
      return;
    }
    const actorInfo = getProfileActor();
    const actor = { id: actorInfo.actorId, name: actorInfo.actorName };
    const target = userBlockState.records.find(
      (record) => record.id === blockId && !record.endedAt
    );
    const targetProfile = target
      ? managedProfiles.find((profile) => profile.userId === target.userId)
      : undefined;
    if (
      !target ||
      (targetProfile?.role === 'Organizer' && activeRole !== 'Super Admin') ||
      targetProfile?.role === 'Super Admin' ||
      target.userId === actor.id
    ) {
      return;
    }

    if (isSupabaseConfigured && supabase) {
      const request = registrationRequests.find(
        (item) => item.id === target.userId
      );
      if (!request || request.status === 'Approved') {
        const { error } = await supabase.rpc('admin_update_profile_flags', {
          target_user_id: target.userId,
          new_account_status: 'Active',
          new_verified: null,
        });
        if (error) {
          showToast(
            `Could not restore user access in Supabase: ${error.message}`
          );
          return;
        }
        setProfileState((previous) => ({
          ...previous,
          profiles: previous.profiles.map((profile) =>
            profile.userId === target.userId
              ? { ...profile, accountStatus: 'Active' }
              : profile
          ),
        }));
      }
    }

    const now = new Date().toISOString();
    const event: UserBlockAuditEvent = {
      id: `block-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      blockId,
      userId: target.userId,
      action: 'unblocked',
      actorId: actor.id,
      actorName: actor.name,
      occurredAt: now,
      reason: target.reason,
      note: target.note || undefined,
      previousExpiresAt: target.expiresAt,
      expiresAt: target.expiresAt,
    };
    const updatedState: UserBlockState = {
      records: userBlockState.records.map((record) =>
        record.id === blockId
          ? {
              ...record,
              endedAt: now,
              endedById: actor.id,
              endedByName: actor.name,
              endReason: 'unblocked',
            }
          : record
      ),
      events: [...userBlockState.events, event],
    };
    try {
      saveUserBlockState(updatedState);
    } catch {
      showToast('Could not unblock the user. Check browser storage.');
      return;
    }
    setUserBlockState(updatedState);
    showToast('User access has been restored.');
  };

  const handleUpdateBlockExpiry = (
    blockId: string,
    expiresAt: string,
    action: Extract<UserBlockAction, 'extended' | 'expiry-changed'>
  ) => {
    if (
      (activeRole !== 'Organizer' && activeRole !== 'Super Admin') ||
      Date.parse(expiresAt) <= Date.now()
    ) {
      showToast('Choose a future expiry time.');
      return;
    }
    const actorInfo = getProfileActor();
    const actor = { id: actorInfo.actorId, name: actorInfo.actorName };
    const target = userBlockState.records.find(
      (record) => record.id === blockId && !record.endedAt
    );
    const targetProfile = target
      ? managedProfiles.find((profile) => profile.userId === target.userId)
      : undefined;
    if (
      !target ||
      (targetProfile?.role === 'Organizer' && activeRole !== 'Super Admin') ||
      targetProfile?.role === 'Super Admin' ||
      target.userId === actor.id
    ) {
      return;
    }
    const now = new Date().toISOString();
    const event: UserBlockAuditEvent = {
      id: `block-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      blockId,
      userId: target.userId,
      action,
      actorId: actor.id,
      actorName: actor.name,
      occurredAt: now,
      reason: target.reason,
      note: target.note || undefined,
      previousExpiresAt: target.expiresAt,
      expiresAt,
    };
    const updatedState: UserBlockState = {
      records: userBlockState.records.map((record) =>
        record.id === blockId ? { ...record, expiresAt } : record
      ),
      events: [...userBlockState.events, event],
    };
    try {
      saveUserBlockState(updatedState);
    } catch {
      showToast('Could not update the block expiry. Check browser storage.');
      return;
    }
    setUserBlockState(updatedState);
    showToast(
      action === 'extended' ? 'Block duration extended.' : 'Block expiry changed.'
    );
  };

  const pendingRequestCount = useMemo(
    () =>
      registrationRequests.filter(
        (request) =>
          !request.trashedAt &&
          (request.approvalStatus === 'Pending' ||
            request.status === 'Pending Approval')
      ).length,
    [registrationRequests]
  );
  const trashedRejectedCount = useMemo(
    () =>
      registrationRequests.filter((request) => Boolean(request.trashedAt))
        .length,
    [registrationRequests]
  );
  const analyticsNotificationEvents = useMemo(() => {
    if (!isSupabaseConfigured || !cloudUserId) {
      return notificationActionStore.events;
    }
    const validUserIds = new Set(managedProfiles.map((p) => p.userId));
    validUserIds.add(cloudUserId);
    return notificationActionStore.events.filter((event) =>
      validUserIds.has(event.userId)
    );
  }, [cloudUserId, managedProfiles, notificationActionStore.events]);
  const blockedUserCount = useMemo(
    () =>
      userBlockState.records
        .filter((record) =>
          findActiveUserBlock(userBlockState.records, record.userId)
        )
        .reduce((userIds, record) => userIds.add(record.userId), new Set<string>())
        .size,
    [userBlockState.records]
  );
  const activeAnnouncements = useMemo(
    () => announcements.filter((item) => !item.trashedAt),
    [announcements]
  );
  const trashedNoticeCount = useMemo(
    () => announcements.filter((item) => Boolean(item.trashedAt)).length,
    [announcements]
  );
  const announcementById = useMemo(
    () => new Map(announcements.map((item) => [item.id, item])),
    [announcements]
  );
  const failedDeliveryCount = useMemo(
    () =>
      deliveries.filter((d) => {
        if (d.status !== 'Failed') return false;
        const ann = announcementById.get(d.announcementId);
        return Boolean(
          ann && !ann.trashedAt && (ann.failedCount > 0 || ann.status === 'Failed')
        );
      }).length,
    [announcementById, deliveries]
  );

  const inboxRole: WorkspaceRole =
    activeRole === 'Organizer' ? lastAttendeeRole : activeRole;

  const activeProfileUserId =
    cloudUserId ??
    (activeRole === 'Organizer'
      ? DEMO_USERS.Organizer.id
      : registeredUser?.id ?? DEMO_USERS[activeRole].id);
  const activeProfile =
    managedProfiles.find((profile) => profile.userId === activeProfileUserId) ??
    createDefaultUserProfile(
      registeredUser ?? DEMO_USERS[activeRole],
      'Active'
    );
  const activeProfileBlock = findActiveUserBlock(
    userBlockState.records,
    activeProfileUserId
  );
  const inboxUserBase = registeredUser ?? DEMO_USERS[inboxRole];
  const inboxUserProfile = managedProfiles.find(
    (profile) => profile.userId === inboxUserBase.id
  );
  const inboxUser: SystemUser = {
    ...inboxUserBase,
    fullName: inboxUserProfile?.fullName ?? inboxUserBase.fullName,
    phone: inboxUserProfile?.phone ?? inboxUserBase.phone,
  };

  useEffect(() => {
    if (canAccessOrganizerWorkspace(activeRole, activeProfile.approvalStatus)) {
      return;
    }
    if (mode !== 'inbox') {
      setMode('inbox');
    }
    if (!['dashboard', 'inbox', 'profile', 'settings'].includes(activeRoute)) {
      setActiveRoute('dashboard');
    }
  }, [activeProfile.approvalStatus, activeRole, activeRoute, mode]);

  useEffect(() => {
    if (isSupabaseConfigured) {
      if (!cloudUserId) return;
      const currentProfile = managedProfiles.find(
        (profile) => profile.userId === cloudUserId
      );
      if (
        currentProfile &&
        currentProfile.accountStatus === 'Active' &&
        currentProfile.approvalStatus !== 'Rejected'
      ) {
        return;
      }

      authActivationRequestRef.current += 1;
      void supabase?.auth.signOut().then(({ error }) => {
        if (error) {
          showToast(`Could not end the unavailable account session: ${error.message}`);
        }
      });
      setCloudUserId(null);
      setCloudAnnouncementsReadyFor(null);
      setShowLoginPage(true);
      setRegisteredUser(null);
      setActiveRole('Organizer');
      setMode('organizer');
      setActiveRoute('dashboard');
      setMobileMenuOpen(false);
      showToast(
        currentProfile?.accountStatus === 'Suspended'
          ? 'Your account has been suspended. You have been signed out.'
          : 'Your account profile is unavailable. You have been signed out.'
      );
      return;
    }

    const userId =
      activeRole === 'Organizer'
        ? DEMO_USERS.Organizer.id
        : registeredUser?.id ?? DEMO_USERS[activeRole].id;
    const blockMessage = getUserBlockMessage(userBlockState.records, userId);
    const currentProfile = managedProfiles.find(
      (profile) => profile.userId === userId
    );
    const accountIsAvailable =
      activeRole === 'Organizer' ||
      (registeredUser
        ? registrationRequests.some(
            (request) =>
              request.id === registeredUser.id &&
              request.status !== 'Rejected'
          )
        : !deletedDemoUserIds.includes(userId));
    const isSuspended = currentProfile?.accountStatus === 'Suspended';
    if (!blockMessage && accountIsAvailable && !isSuspended) return;

    setShowLoginPage(true);
    setRegisteredUser(null);
    setActiveRole('Organizer');
    setMode('organizer');
    setActiveRoute('dashboard');
    setMobileMenuOpen(false);
    showToast(
      blockMessage
        ? `${blockMessage} You have been signed out.`
        : isSuspended
          ? 'Your account has been suspended. You have been signed out.'
          : 'Your account is no longer available. You have been signed out.'
    );
  }, [
    activeRole,
    cloudUserId,
    deletedDemoUserIds,
    managedProfiles,
    registeredUser,
    registrationRequests,
    userBlockState.records,
  ]);

  const unreadCount = useMemo(() => {
    const userNotifications =
      notificationActionStore.byUserId[inboxUser.id] ?? {};
    const isPending = (activeProfile.approvalStatus ?? 'Approved') === 'Pending';
    return activeAnnouncements.filter((a) => {
      if (isPending) {
        if (
          a.status !== 'Delivered' ||
          (!a.targeting.everyoneAttending &&
            !a.targeting.roles.includes('Participant'))
        ) {
          return false;
        }
      } else if (!isAnnouncementVisibleToRole(a, inboxRole)) {
        return false;
      }
      const isRead =
        userNotifications[a.id]?.read ??
        a.isReadByUserId?.[inboxUser.id] ??
        a.isReadByCurrentRole?.[inboxRole] ??
        false;
      return !isRead;
    }).length;
  }, [
    activeAnnouncements,
    activeProfile.approvalStatus,
    inboxRole,
    inboxUser.id,
    notificationActionStore,
  ]);

  const selectedAnnouncement = useMemo(
    () =>
      announcements.find((a) => a.id === selectedAnnouncementId) ??
      activeAnnouncements[0] ??
      announcements[0],
    [activeAnnouncements, announcements, selectedAnnouncementId]
  );

  const handleInspectAnnouncement = (id: string) => {
    setSelectedAnnouncementId(id);
    setActiveRoute('delivery-detail');
  };

  const handleCreateNew = () => {
    if (!canAccessOrganizerWorkspace(activeRole, activeProfile.approvalStatus)) {
      return;
    }
    setEditingAnnouncement(null);
    setActiveRoute('composer');
  };

  const handleEditAnnouncement = (ann: Announcement) => {
    if (!canAccessOrganizerWorkspace(activeRole, activeProfile.approvalStatus)) {
      return;
    }
    setEditingAnnouncement(ann);
    setActiveRoute('composer');
  };

  const handleDuplicateAnnouncement = (ann: Announcement) => {
    if (!canAccessOrganizerWorkspace(activeRole, activeProfile.approvalStatus)) {
      return;
    }
    const duplicate: Announcement = {
      ...ann,
      id: `ann-${Math.floor(200 + Math.random() * 790)}`,
      title: `${ann.title} (Copy)`,
      status: 'Draft',
      publishedAt: undefined,
      totalRecipients: 0,
      deliveredCount: 0,
      failedCount: 0,
      pendingCount: 0,
      readCount: 0,
      clickCount: 0,
      channelBreakdown: [],
      trashedAt: undefined,
      trashedBy: undefined,
    };
    setEditingAnnouncement(duplicate);
    setActiveRoute('composer');
  };

  const handleDeleteAnnouncement = (id: string) => {
    if (!canAccessOrganizerWorkspace(activeRole, activeProfile.approvalStatus)) {
      return;
    }
    const actor = getProfileActor();
    const trashedAt = new Date().toISOString();
    setAnnouncements((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, trashedAt, trashedBy: actor.actorName } : a
      )
    );
    if (selectedAnnouncementId === id) {
      const next = activeAnnouncements.find((a) => a.id !== id);
      if (next) setSelectedAnnouncementId(next.id);
    }
    showToast('Announcement moved to Notification Trash Bin.');
  };

  const handleRestoreAnnouncement = (id: string) => {
    if (!canAccessOrganizerWorkspace(activeRole, activeProfile.approvalStatus)) {
      return;
    }
    setAnnouncements((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, trashedAt: undefined, trashedBy: undefined } : a
      )
    );
    showToast('Announcement restored from Notification Trash Bin.');
  };

  const handlePermanentDeleteAnnouncement = (id: string) => {
    if (!canAccessOrganizerWorkspace(activeRole, activeProfile.approvalStatus)) {
      return;
    }
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    setDeliveries((prev) => prev.filter((d) => d.announcementId !== id));
    setActivityFeed((prev) => prev.filter((entry) => entry.announcementId !== id));
    if (supabase && cloudUserId) {
      void deleteCloudAnnouncement(id).catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Unexpected Supabase error.';
        showToast(`Could not delete the announcement from Supabase: ${message}`);
      });
    }
    if (selectedAnnouncementId === id) {
      const next = activeAnnouncements.find((a) => a.id !== id);
      if (next) setSelectedAnnouncementId(next.id);
    }
    showToast('Announcement permanently deleted.');
  };

  const handleEmptyAnnouncementTrash = () => {
    if (!canAccessOrganizerWorkspace(activeRole, activeProfile.approvalStatus)) {
      return;
    }
    const trashedIds = announcements
      .filter((a) => Boolean(a.trashedAt))
      .map((a) => a.id);
    if (trashedIds.length === 0) return;
    const trashedSet = new Set(trashedIds);
    setAnnouncements((prev) => prev.filter((a) => !trashedSet.has(a.id)));
    setDeliveries((prev) => prev.filter((d) => !trashedSet.has(d.announcementId)));
    setActivityFeed((prev) =>
      prev.filter((entry) => !trashedSet.has(entry.announcementId))
    );
    if (supabase && cloudUserId) {
      for (const id of trashedIds) {
        void deleteCloudAnnouncement(id).catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : 'Unexpected Supabase error.';
          showToast(`Could not purge announcement from Supabase: ${message}`);
        });
      }
    }
    showToast(
      `Permanently deleted ${trashedIds.length} trashed announcement${trashedIds.length === 1 ? '' : 's'}.`
    );
  };

  const handleSaveAnnouncement = (
    saved: Announcement,
    targetStatus: DeliveryStatus
  ) => {
    if (!canAccessOrganizerWorkspace(activeRole, activeProfile.approvalStatus)) {
      return;
    }
    setAnnouncements((prev) => {
      const exists = prev.some((a) => a.id === saved.id);
      if (exists) {
        return prev.map((a) => (a.id === saved.id ? saved : a));
      }
      return [saved, ...prev];
    });

    if (targetStatus === 'Delivered' && saved.failedCount > 0) {
      const simulatedError: NotificationDelivery = {
        id: `del-${Date.now()}`,
        announcementId: saved.id,
        recipientId: 'rec-sim-01',
        recipientName: 'Sadia Afrin (CUET_ByteRunners)',
        recipientRole: saved.targeting.roles[0] ?? 'Participant',
        recipientContact: '+880 1719-882310',
        channel: saved.channels.includes('SMS')
          ? 'SMS'
          : saved.channels[0] ?? 'Push Notification',
        status: 'Failed',
        errorCode: saved.channels.includes('SMS')
          ? 'SMS_GATEWAY_TIMEOUT'
          : 'INVALID_PUSH_TOKEN',
        errorMessage:
          'Simulated transient gateway timeout during broadcast wave',
        attemptCount: 1,
        lastAttemptAt: new Date().toISOString(),
      };
      setDeliveries((prev) => [simulatedError, ...prev]);
    }

    if (targetStatus !== 'Draft') {
      const feedEntry: ActivityFeedEntry = {
        id: `act-${Date.now()}`,
        announcementId: saved.id,
        announcementTitle: saved.title,
        eventDescription:
          targetStatus === 'Scheduled'
            ? `Scheduled in Asia/Dhaka (GMT+6) for ${saved.totalRecipients} recipients`
            : `Simulated broadcast completed (${saved.deliveredCount}/${saved.totalRecipients} delivered)`,
        channel: saved.channels[0] ?? 'In-App',
        status: targetStatus === 'Scheduled' ? 'Scheduled' : 'Delivered',
        timestamp: formatDhakaTimeOnly(new Date().toISOString()),
        recipientCount: saved.totalRecipients,
      };
      setActivityFeed((prev) => [feedEntry, ...prev]);
    }

    setEditingAnnouncement(null);
    setSelectedAnnouncementId(saved.id);
    setActiveRoute(targetStatus === 'Draft' ? 'announcements' : 'delivery-detail');

    const label =
      targetStatus === 'Draft'
        ? 'Saved announcement draft.'
        : targetStatus === 'Scheduled'
          ? 'Announcement scheduled (GMT+6).'
          : 'Simulated broadcast dispatched successfully.';
    showToast(label);
  };

  const handlePublishScheduledNow = (announcementId: string) => {
    const nowIso = new Date().toISOString();
    setAnnouncements((prev) =>
      prev.map((a) => {
        if (a.id !== announcementId) return a;
        const delivered = a.totalRecipients;
        return {
          ...a,
          status: 'Delivered',
          publishedAt: nowIso,
          pendingCount: 0,
          deliveredCount: delivered,
          readCount: Math.floor(delivered * 0.45),
          clickCount: Math.floor(delivered * 0.18),
          channelBreakdown: a.channelBreakdown.map((ch) => ({
            ...ch,
            deliveredCount: ch.targetedCount,
            pendingCount: 0,
            readCount: Math.floor(ch.targetedCount * 0.45),
            clickCount: Math.floor(ch.targetedCount * 0.18),
          })),
        };
      })
    );
    showToast('Simulated immediate dispatch completed.');
  };

  const handleRetryDelivery = (deliveryId: string) => {
    const target = deliveries.find((d) => d.id === deliveryId);
    if (!target || target.status !== 'Failed') return;

    const nowIso = new Date().toISOString();
    setDeliveries((prev) =>
      prev.map((d) =>
        d.id === deliveryId
          ? {
              ...d,
              status: 'Delivered',
              errorCode: undefined,
              errorMessage: undefined,
              attemptCount: d.attemptCount + 1,
              lastAttemptAt: nowIso,
              deliveredAt: nowIso,
            }
          : d
      )
    );

    setAnnouncements((prev) =>
      prev.map((ann) => {
        if (ann.id !== target.announcementId) return ann;
        return {
          ...ann,
          deliveredCount: Math.min(ann.totalRecipients, ann.deliveredCount + 1),
          failedCount: Math.max(0, ann.failedCount - 1),
          channelBreakdown: ann.channelBreakdown.map((ch) =>
            ch.channel === target.channel
              ? {
                  ...ch,
                  deliveredCount: Math.min(
                    ch.targetedCount,
                    ch.deliveredCount + 1
                  ),
                  failedCount: Math.max(0, ch.failedCount - 1),
                }
              : ch
          ),
        };
      })
    );

    setActivityFeed((prev) => [
      {
        id: `act-retry-${Date.now()}`,
        announcementId: target.announcementId,
        announcementTitle: `Retry: ${target.recipientName}`,
        eventDescription: `Simulated ${target.channel} gateway retry succeeded`,
        channel: target.channel,
        status: 'Retried',
        timestamp: formatDhakaTimeOnly(nowIso),
        recipientCount: 1,
      },
      ...prev,
    ]);

    showToast(
      `Retry succeeded for ${target.recipientName} via ${target.channel}.`
    );
  };

  const handleRetryAllFailedForAnnouncement = (announcementId: string) => {
    const targets = deliveries.filter(
      (d) => d.announcementId === announcementId && d.status === 'Failed'
    );
    if (targets.length === 0) return;

    const nowIso = new Date().toISOString();
    const countByChannel: Record<string, number> = {};
    for (const t of targets) {
      countByChannel[t.channel] = (countByChannel[t.channel] ?? 0) + 1;
    }

    setDeliveries((prev) =>
      prev.map((d) =>
        d.announcementId === announcementId && d.status === 'Failed'
          ? {
              ...d,
              status: 'Delivered',
              errorCode: undefined,
              errorMessage: undefined,
              attemptCount: d.attemptCount + 1,
              lastAttemptAt: nowIso,
              deliveredAt: nowIso,
            }
          : d
      )
    );

    setAnnouncements((prev) =>
      prev.map((ann) => {
        if (ann.id !== announcementId) return ann;
        return {
          ...ann,
          deliveredCount: Math.min(
            ann.totalRecipients,
            ann.deliveredCount + targets.length
          ),
          failedCount: Math.max(0, ann.failedCount - targets.length),
          channelBreakdown: ann.channelBreakdown.map((ch) => {
            const recovered = countByChannel[ch.channel] ?? 0;
            if (recovered === 0) return ch;
            return {
              ...ch,
              deliveredCount: Math.min(
                ch.targetedCount,
                ch.deliveredCount + recovered
              ),
              failedCount: Math.max(0, ch.failedCount - recovered),
            };
          }),
        };
      })
    );

    setActivityFeed((prev) => [
      {
        id: `act-retry-all-${Date.now()}`,
        announcementId,
        announcementTitle: `Batch Retry (${targets.length} recipients)`,
        eventDescription: `All ${targets.length} failed dispatches recovered in simulated retry`,
        channel: targets[0].channel,
        status: 'Retried',
        timestamp: formatDhakaTimeOnly(nowIso),
        recipientCount: targets.length,
      },
      ...prev,
    ]);

    showToast(`Retried and delivered ${targets.length} failed dispatches.`);
  };

  const persistCloudNotificationActions = (
    userId: string,
    notificationIds: string[],
    store: NotificationActionStore
  ) => {
    if (!supabase || userId !== cloudUserId) return;
    for (const notificationId of new Set(notificationIds)) {
      const state = store.byUserId[userId]?.[notificationId];
      if (!state) continue;
      const events = store.events.filter(
        (event) =>
          event.userId === userId && event.notificationId === notificationId
      );
      void saveCloudNotificationAction(
        userId,
        notificationId,
        state,
        events
      ).catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Unexpected Supabase error.';
        showToast(`Could not sync notification actions: ${message}`);
      });
    }
  };

  const handleToggleRead = (
    announcementId: string,
    role: WorkspaceRole,
    nextRead: boolean,
    userId: string
  ) => {
    const previousState =
      notificationActionStore.byUserId[userId]?.[announcementId] ??
      createDefaultPersonalNotificationState();
    const nextState = {
      ...notificationActionStore,
      byUserId: {
        ...notificationActionStore.byUserId,
        [userId]: {
          ...notificationActionStore.byUserId[userId],
          [announcementId]: {
            ...previousState,
            read: nextRead,
          },
        },
      },
      events: [
        {
          id: `notification-action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          userId,
          notificationId: announcementId,
          action: nextRead ? 'read' as const : 'unread' as const,
          occurredAt: new Date().toISOString(),
        },
        ...notificationActionStore.events,
      ].slice(0, 5000),
    };
    try {
      saveNotificationActionStore(nextState);
    } catch {
      showToast('Could not save your notification status. Check browser storage.');
      return;
    }
    setNotificationActionStore(nextState);
    persistCloudNotificationActions(userId, [announcementId], nextState);

    setAnnouncements((prev) =>
      prev.map((ann) => {
        if (ann.id !== announcementId) return ann;
        const wasRead =
          ann.isReadByUserId?.[userId] ??
          ann.isReadByCurrentRole?.[role] ??
          false;
        const delta = nextRead && !wasRead ? 1 : !nextRead && wasRead ? -1 : 0;

        return {
          ...ann,
          readCount: Math.max(0, ann.readCount + delta),
          isReadByUserId: {
            ...(ann.isReadByUserId ?? {}),
            [userId]: nextRead,
          },
          isReadByCurrentRole: {
            ...(ann.isReadByCurrentRole ?? {}),
            [role]: nextRead,
          },
        };
      })
    );
  };

  const handleUpdateNotificationAction = (
    userId: string,
    notificationId: string,
    patch: Partial<PersonalNotificationState>,
    action: NotificationActionName,
    detail?: string
  ) => {
    const previous =
      notificationActionStore.byUserId[userId]?.[notificationId] ??
      createDefaultPersonalNotificationState();
    const event = {
      id: `notification-action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      notificationId,
      action,
      occurredAt: new Date().toISOString(),
      detail,
    };
    const nextState: NotificationActionStore = {
      ...notificationActionStore,
      byUserId: {
        ...notificationActionStore.byUserId,
        [userId]: {
          ...notificationActionStore.byUserId[userId],
          [notificationId]: { ...previous, ...patch },
        },
      },
      events: [event, ...notificationActionStore.events].slice(0, 5000),
    };
    try {
      saveNotificationActionStore(nextState);
    } catch {
      showToast('Could not save this notification action. Check browser storage.');
      return;
    }
    setNotificationActionStore(nextState);
    persistCloudNotificationActions(userId, [notificationId], nextState);
  };

  const handleBulkUpdateNotificationActions = (
    userId: string,
    notificationIds: string[],
    patch: Partial<PersonalNotificationState>,
    action: NotificationActionName
  ) => {
    if (notificationIds.length === 0) return;
    const userNotifications = {
      ...notificationActionStore.byUserId[userId],
    };
    const events = [...notificationActionStore.events];
    const changedIds = new Set(notificationIds);
    for (const notificationId of notificationIds) {
      const previous =
        userNotifications[notificationId] ??
        createDefaultPersonalNotificationState();
      userNotifications[notificationId] = { ...previous, ...patch };
      events.unshift({
        id: `notification-action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId,
        notificationId,
        action,
        occurredAt: new Date().toISOString(),
      });
    }

    const nextState: NotificationActionStore = {
      byUserId: {
        ...notificationActionStore.byUserId,
        [userId]: userNotifications,
      },
      events: events.slice(0, 5000),
    };
    try {
      saveNotificationActionStore(nextState);
    } catch {
      showToast('Could not save bulk notification actions. Check browser storage.');
      return;
    }
    setNotificationActionStore(nextState);
    persistCloudNotificationActions(userId, notificationIds, nextState);

    if (typeof patch.read === 'boolean') {
      setAnnouncements((previous) =>
        previous.map((announcement) => {
          if (!changedIds.has(announcement.id)) return announcement;
          const wasRead =
            announcement.isReadByUserId?.[userId] ??
            announcement.isReadByCurrentRole?.[activeRole] ??
            false;
          const delta =
            patch.read && !wasRead ? 1 : !patch.read && wasRead ? -1 : 0;
          return {
            ...announcement,
            readCount: Math.max(0, announcement.readCount + delta),
            isReadByUserId: {
              ...(announcement.isReadByUserId ?? {}),
              [userId]: patch.read,
            },
          };
        })
      );
    }
  };

  const handleRecordNotificationView = (userId: string, notificationId: string) => {
    const previous =
      notificationActionStore.byUserId[userId]?.[notificationId] ??
      createDefaultPersonalNotificationState();
    handleUpdateNotificationAction(
      userId,
      notificationId,
      {
        viewCount: previous.viewCount + 1,
        lastOpenedAt: new Date().toISOString(),
      },
      'viewed'
    );
  };

  const handleRecordNotificationReadTime = (
    userId: string,
    notificationId: string,
    seconds: number
  ) => {
    if (seconds <= 0) return;
    const previous =
      notificationActionStore.byUserId[userId]?.[notificationId] ??
      createDefaultPersonalNotificationState();
    handleUpdateNotificationAction(
      userId,
      notificationId,
      { readTimeSeconds: previous.readTimeSeconds + seconds },
      'read-time',
      `${seconds} seconds`
    );
  };

  const handleMarkAllRead = (role: WorkspaceRole, userId: string) => {
    const now = new Date().toISOString();
    const nextByUser = {
      ...notificationActionStore.byUserId,
      [userId]: { ...notificationActionStore.byUserId[userId] },
    };
    const events = [...notificationActionStore.events];
    const nextAnnouncements = announcements.map((ann) => {
      if (!isAnnouncementVisibleToRole(ann, role)) return ann;
      const previous =
        nextByUser[userId][ann.id] ??
        createDefaultPersonalNotificationState();
      nextByUser[userId][ann.id] = { ...previous, read: true };
      events.unshift({
        id: `notification-action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId,
        notificationId: ann.id,
        action: 'read',
        occurredAt: now,
      });
      const wasRead =
        ann.isReadByUserId?.[userId] ??
        ann.isReadByCurrentRole?.[role] ??
        false;
      return {
        ...ann,
        readCount: wasRead ? ann.readCount : ann.readCount + 1,
        isReadByUserId: {
          ...(ann.isReadByUserId ?? {}),
          [userId]: true,
        },
        isReadByCurrentRole: {
          ...(ann.isReadByCurrentRole ?? {}),
          [role]: true,
        },
      };
    });
    const nextState: NotificationActionStore = {
      byUserId: nextByUser,
      events: events.slice(0, 5000),
    };
    try {
      saveNotificationActionStore(nextState);
    } catch {
      showToast('Could not mark notifications read. Check browser storage.');
      return;
    }
    setNotificationActionStore(nextState);
    persistCloudNotificationActions(
      userId,
      nextAnnouncements
        .filter((announcement) => isAnnouncementVisibleToRole(announcement, role))
        .map((announcement) => announcement.id),
      nextState
    );
    setAnnouncements(nextAnnouncements);
    showToast(`Marked all notices read for ${role}.`);
  };

  const handleTrackClick = (
    announcementId: string,
    attachmentId?: string,
    attachmentAction: 'view' | 'download' = 'download'
  ) => {
    setAnnouncements((prev) =>
      prev.map((ann) => {
        if (ann.id !== announcementId) return ann;
        return {
          ...ann,
          clickCount: ann.clickCount + 1,
          attachments: attachmentId
            ? ann.attachments.map((att) =>
                att.id === attachmentId
                  ? {
                      ...att,
                      viewCount:
                        (att.viewCount ?? 0) +
                        (attachmentAction === 'view' ? 1 : 0),
                      downloadCount:
                        att.downloadCount +
                        (attachmentAction === 'download' ? 1 : 0),
                    }
                  : att
              )
            : ann.attachments,
        };
      })
    );
  };

  const toastBanner = toastMessage ? (
    <div
      role="status"
      className="toast-enter fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-xl border border-emerald-800 bg-[#042419] dark:bg-[#06291D] dark:border-emerald-700/70 px-4 py-2.5 text-xs font-medium text-white shadow-xl whitespace-nowrap"
    >
      <CheckCircle2
        className="h-4 w-4 text-emerald-400 shrink-0"
        aria-hidden="true"
      />
      <span>{toastMessage}</span>
      <button
        type="button"
        onClick={() => setToastMessage(null)}
        aria-label="Dismiss notification"
        className="ml-1 text-emerald-200/70 hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  ) : null;

  const handleSignOut = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        showToast(`Could not sign out of Supabase: ${error.message}`);
        return;
      }
    }
    setCloudUserId(null);
    setCloudAnnouncementsReadyFor(null);
    setRegisteredUser(null);
    setShowLoginPage(true);
  };

  if (!cloudAuthReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F8F6] px-4 text-sm text-emerald-900 dark:bg-[#02120C] dark:text-emerald-100">
        Connecting securely to Supabase…
      </main>
    );
  }

  if (showLoginPage) {
    return (
      <>
        <LoginPage
          canRegister={isSupabaseConfigured}
          isPasswordRecovery={passwordRecoveryMode}
          onSignIn={handleCredentialSignIn}
          onRegister={handleRegisterUser}
          onRequestPasswordReset={handleRequestPasswordReset}
          onCompletePasswordReset={handleCompletePasswordReset}
        />
        {toastBanner}
      </>
    );
  }

  return (
    <div className="app-shell flex min-w-0 flex-col overflow-hidden bg-[#F4F8F6] text-[#052E1F] dark:bg-[#02120C] dark:text-emerald-50 transition-colors duration-150">
      <TopHeader
        mode={mode}
        activeRole={activeRole}
        approvalStatus={activeProfile.approvalStatus ?? 'Approved'}
        activeAttendeeRoute={activeRoute}
        unreadCount={unreadCount}
        isDark={darkMode}
        userName={activeProfile.fullName}
        avatarUrl={activeProfile.photoDataUrl || undefined}
        onToggleTheme={() => setDarkMode((prev) => !prev)}
        onChangeMode={handleChangeMode}
        onNavigateAttendeeRoute={(route) => setActiveRoute(route)}
        onOpenLogin={handleSignOut}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onNavigateProfile={handleNavigateProfile}
        onManageProfiles={handleNavigateProfileManagement}
        onNavigateSettings={handleNavigateSettings}
      />

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {mode === 'organizer' &&
          canAccessOrganizerWorkspace(
            activeRole,
            activeProfile.approvalStatus
          ) && (
            <Sidebar
              activeRole={activeRole}
              activeRoute={activeRoute === 'inbox' ? 'dashboard' : activeRoute}
              failedDeliveryCount={failedDeliveryCount}
              trashedNoticeCount={trashedNoticeCount}
              pendingRequestCount={pendingRequestCount}
              blockedUserCount={blockedUserCount}
              trashedRejectedCount={trashedRejectedCount}
              mobileOpen={mobileMenuOpen}
              onCloseMobile={() => setMobileMenuOpen(false)}
              onNavigate={(route) => setActiveRoute(route)}
              onNavigateSettings={handleNavigateSettings}
            />
          )}

        <main
          ref={mainContentRef}
          className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
        >
          <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6">
            <div key={`${mode}-${activeRoute}`} className="page-enter min-w-0">
              {activeRoute === 'profile' ? (
                <UserProfilePage
                  profile={activeProfile}
                  events={profileState.events}
                  loginHistory={profileState.loginHistory}
                  approvalLogs={profileState.approvalLogs ?? []}
                  activityLogs={profileState.activityLogs ?? []}
                  blockedUntil={
                    activeProfileBlock
                      ? activeProfileBlock.expiresAt
                        ? `Blocked until ${new Intl.DateTimeFormat('en-BD', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                            timeZone: 'Asia/Dhaka',
                          }).format(new Date(activeProfileBlock.expiresAt))}`
                        : 'Permanently blocked'
                      : null
                  }
                  passwordResetRequired={profileState.passwordResetRequired.includes(
                    activeProfile.userId
                  )}
                  hasPasswordCredential={
                    Boolean(profileState.credentials[activeProfile.userId]) ||
                    (activeProfile.role === 'Organizer' &&
                      organizerPassword !== null) ||
                    registrationRequests.some(
                      (request) => request.id === activeProfile.userId
                    )
                  }
                  onSave={handleSaveUserProfile}
                  onSaveNotifications={handleSaveProfileNotifications}
                  onChangePassword={(currentPassword, newPassword) =>
                    handleChangeUserPassword(
                      activeProfile.userId,
                      currentPassword,
                      newPassword
                    )
                  }
                  isDark={darkMode}
                  onToggleTheme={() => setDarkMode((prev) => !prev)}
                />
              ) : activeRoute === 'settings' ? (
                activeRole === 'Organizer' &&
                canAccessOrganizerWorkspace(
                  activeRole,
                  activeProfile.approvalStatus
                ) ? (
                  <SettingsPage
                    profile={organizerProfile}
                    settings={organizerSettings}
                    section={settingsSection}
                    isDark={darkMode}
                    hasPassword={
                      organizerPassword !== null ||
                      Boolean(profileState.credentials[DEMO_USERS.Organizer.id])
                    }
                    onSaveProfile={handleSaveOrganizerProfile}
                    onUpdateSettings={setOrganizerSettings}
                    onChangeSection={setSettingsSection}
                    onToggleTheme={() => setDarkMode((prev) => !prev)}
                    onPasswordUpdated={handlePasswordUpdated}
                  />
                ) : (
                  <UserSettingsPage
                    profile={activeProfile}
                    section={settingsSection}
                    isDark={darkMode}
                    hasPasswordCredential={
                      Boolean(profileState.credentials[activeProfile.userId]) ||
                      registrationRequests.some(
                        (request) => request.id === activeProfile.userId
                      )
                    }
                    onSaveProfile={handleSaveUserProfile}
                    onSaveNotifications={handleSaveProfileNotifications}
                    onChangePassword={(currentPassword, newPassword) =>
                      handleChangeUserPassword(
                        activeProfile.userId,
                        currentPassword,
                        newPassword
                      )
                    }
                    onChangeSection={setSettingsSection}
                    onToggleTheme={() => setDarkMode((prev) => !prev)}
                  />
                )
              ) : mode === 'organizer' &&
                canAccessOrganizerWorkspace(
                  activeRole,
                  activeProfile.approvalStatus
                ) ? (
                <>
                  {activeRoute === 'dashboard' && (
                    <DashboardPage
                      title={
                        activeRole === 'Super Admin'
                          ? 'Super Admin Dashboard'
                          : 'Organizer Dashboard'
                      }
                      announcements={activeAnnouncements}
                      activityFeed={activityFeed}
                      failedCount={failedDeliveryCount}
                      onCreateAnnouncement={handleCreateNew}
                      onInspectAnnouncement={handleInspectAnnouncement}
                      onViewAllAnnouncements={() =>
                        setActiveRoute('announcements')
                      }
                    />
                  )}

                  {(activeRoute === 'announcements' ||
                    activeRoute === 'notification-trash') && (
                    <AnnouncementsPage
                      key={activeRoute}
                      announcements={announcements}
                      initialTab={
                        activeRoute === 'notification-trash' ? 'Trash' : 'All'
                      }
                      onInspectAnnouncement={handleInspectAnnouncement}
                      onEditAnnouncement={handleEditAnnouncement}
                      onDuplicateAnnouncement={handleDuplicateAnnouncement}
                      onDeleteAnnouncement={handleDeleteAnnouncement}
                      onRestoreAnnouncement={handleRestoreAnnouncement}
                      onPermanentDeleteAnnouncement={
                        handlePermanentDeleteAnnouncement
                      }
                      onEmptyAnnouncementTrash={handleEmptyAnnouncementTrash}
                      onCreateNew={handleCreateNew}
                    />
                  )}

                  {activeRoute === 'composer' && (
                    <ComposerPage
                      key={editingAnnouncement?.id ?? 'new-notice'}
                      editingAnnouncement={editingAnnouncement}
                      onSaveAnnouncement={handleSaveAnnouncement}
                      onCancel={() => {
                        setEditingAnnouncement(null);
                        setActiveRoute('announcements');
                      }}
                    />
                  )}

                  {activeRoute === 'delivery-detail' &&
                    selectedAnnouncement && (
                      <DeliveryDetailPage
                        announcements={activeAnnouncements}
                        selectedAnnouncement={selectedAnnouncement}
                        deliveries={deliveries}
                        onSelectAnnouncement={(id) =>
                          setSelectedAnnouncementId(id)
                        }
                        onBackToList={() => setActiveRoute('announcements')}
                        onEditAnnouncement={handleEditAnnouncement}
                        onRetryDelivery={handleRetryDelivery}
                        onRetryAllFailedForAnnouncement={
                          handleRetryAllFailedForAnnouncement
                        }
                        onPublishScheduledNow={handlePublishScheduledNow}
                        personalStatus={{
                          ...createDefaultPersonalNotificationState(),
                          ...notificationActionStore.byUserId[activeProfileUserId]?.[
                            selectedAnnouncement.id
                          ],
                          read:
                            notificationActionStore.byUserId[activeProfileUserId]?.[
                              selectedAnnouncement.id
                            ]?.read ??
                            selectedAnnouncement.isReadByUserId?.[
                              activeProfileUserId
                            ] ??
                            selectedAnnouncement.isReadByCurrentRole?.[
                              activeRole
                            ] ??
                            false,
                        }}
                        onToggleRead={(nextRead) =>
                          handleToggleRead(
                            selectedAnnouncement.id,
                            activeRole,
                            nextRead,
                            activeProfileUserId
                          )
                        }
                        onUpdatePersonalStatus={(patch, action) =>
                          handleUpdateNotificationAction(
                            activeProfileUserId,
                            selectedAnnouncement.id,
                            patch,
                            action
                          )
                        }
                        onNotify={showToast}
                      />
                    )}

                  {activeRoute === 'analytics' && (
                    <AnalyticsPage
                      announcements={activeAnnouncements}
                      notificationEvents={analyticsNotificationEvents}
                      profiles={managedProfiles}
                    />
                  )}

                  {activeRoute === 'user-approvals' &&
                    canAccessOrganizerWorkspace(
                      activeRole,
                      activeProfile.approvalStatus
                    ) && (
                      <UserApprovalsPage
                        requests={registrationRequests}
                        existingAccountCount={availableDemoUsers.length}
                        canManageTrash={activeRole === 'Super Admin'}
                        currentUserRole={activeRole}
                        canChangeApprovalStatus={
                          activeRole === 'Super Admin' ||
                          Boolean(activeProfile.canManageApprovals)
                        }
                        currentUserId={activeProfileUserId}
                        onUpdateStatus={handleUpdateRegistrationStatus}
                        onBulkUpdateStatus={async (ids, status) => {
                          await handleBulkUpdateRegistrationStatus(ids, status);
                        }}
                        onRecommendRegistration={handleRecommendRegistration}
                        onUpdateVerification={handleUpdateVerificationStatus}
                        onTrashRejectedUser={handleTrashRejectedUser}
                        onRestoreTrashedUser={handleRestoreTrashedUser}
                        onRefreshProfiles={
                          isSupabaseConfigured
                            ? handleRefreshCloudProfiles
                            : undefined
                        }
                        onNotify={showToast}
                      />
                    )}

                  {activeRoute === 'super-admin-users' &&
                    activeRole === 'Super Admin' &&
                    activeProfile.approvalStatus === 'Approved' && (
                      <SuperAdminUsersPage
                        profiles={managedProfiles}
                        currentUserId={activeProfileUserId}
                        roleChangeLogs={profileState.roleChangeLogs ?? []}
                        approvalLogs={profileState.approvalLogs ?? []}
                        verificationLogs={profileState.verificationLogs ?? []}
                        activityLogs={profileState.activityLogs ?? []}
                        rolePermissions={profileState.rolePermissions ?? []}
                        onAssignRole={handleAssignUserRole}
                        onBulkAssignRoles={handleBulkAssignUserRoles}
                        onReviewRegistration={async (
                          userId,
                          approve,
                          assignedRole,
                          notes,
                          markVerified
                        ) => {
                          await handleUpdateRegistrationStatus(
                            userId,
                            approve ? 'Approved' : 'Rejected',
                            {
                              assignedRole,
                              approvalNotes: notes,
                              markVerified,
                            }
                          );
                          return null;
                        }}
                        onBulkReviewRegistrations={async (
                          userIds,
                          approve,
                          notes
                        ) =>
                          handleBulkUpdateRegistrationStatus(
                            userIds,
                            approve ? 'Approved' : 'Rejected',
                            notes ?? ''
                          )
                        }
                        onUpdateVerification={handleUpdateVerificationStatus}
                        onBulkVerifyUsers={handleBulkVerifyUsers}
                        onSetOrganizerPermission={handleSetOrganizerPermission}
                        onSetAccountStatus={handleSetProfileStatus}
                        onRefreshData={
                          isSupabaseConfigured
                            ? handleRefreshCloudProfiles
                            : undefined
                        }
                        onNotify={showToast}
                      />
                    )}

                  {activeRoute === 'rejected-trash' &&
                    activeRole === 'Super Admin' && (
                      <RejectedTrashPage
                        requests={registrationRequests}
                        onTrashRejectedUser={handleTrashRejectedUser}
                        onRestoreTrashedUser={handleRestoreTrashedUser}
                        onBulkTrashRejectedUsers={handleBulkTrashRejectedUsers}
                        onBulkRestoreTrashedUsers={handleBulkRestoreTrashedUsers}
                        onReapproveRejectedUser={(userId) =>
                          handleUpdateRegistrationStatus(userId, 'Approved')
                        }
                        onRefreshProfiles={
                          isSupabaseConfigured
                            ? handleRefreshCloudProfiles
                            : undefined
                        }
                        onNotify={showToast}
                      />
                    )}

                  {activeRoute === 'users' &&
                    canAccessOrganizerWorkspace(
                      activeRole,
                      activeProfile.approvalStatus
                    ) && (
                    <UsersPage
                      currentUser={{
                        id: activeProfile.userId,
                        fullName: activeProfile.fullName,
                        email: activeProfile.email,
                        phone: activeProfile.phone,
                        role: activeProfile.role,
                        affiliation:
                          activeProfile.institution || activeProfile.department,
                        badgeCode: activeProfile.userId,
                        createdAt: activeProfile.createdAt,
                      }}
                      staffUsers={availableDemoUsers}
                      profiles={managedProfiles}
                      requests={registrationRequests}
                      blocks={userBlockState.records}
                      isSupabaseConfigured={isSupabaseConfigured}
                      onBlockUser={handleBlockUser}
                      onUnblockUser={handleUnblockUser}
                      onDeleteUser={handleDeleteUser}
                      onSetProfileStatus={handleSetProfileStatus}
                      onUpdateRegistrationStatus={handleUpdateRegistrationStatus}
                      onTrashRejectedUser={handleTrashRejectedUser}
                      onRefreshProfiles={
                        isSupabaseConfigured
                          ? handleRefreshCloudProfiles
                          : undefined
                      }
                      onBulkUpdateRegistrationStatus={async (ids, status) => {
                        await handleBulkUpdateRegistrationStatus(ids, status);
                      }}
                      onBulkSetProfileStatus={handleBulkSetProfileStatus}
                      onNotify={showToast}
                    />
                  )}

                  {activeRoute === 'blocked-users' &&
                    canAccessOrganizerWorkspace(
                      activeRole,
                      activeProfile.approvalStatus
                    ) && (
                      <BlockedUsersPage
                        users={availableDemoUsers}
                        requests={registrationRequests}
                        records={userBlockState.records}
                        events={userBlockState.events}
                        onUnblock={handleUnblockUser}
                        onUpdateExpiry={handleUpdateBlockExpiry}
                      />
                    )}

                  {activeRoute === 'profiles' &&
                    canAccessOrganizerWorkspace(
                      activeRole,
                      activeProfile.approvalStatus
                    ) && (
                    <ProfileManagementPage
                      profiles={managedProfiles}
                      blocks={userBlockState.records}
                      events={profileState.events}
                      canManage={canAccessOrganizerWorkspace(
                        activeRole,
                        activeProfile.approvalStatus
                      )}
                      canVerify
                      currentUserRole={activeRole}
                      onSaveProfile={handleSaveUserProfile}
                      onSetVerified={handleSetProfileVerification}
                      onSetStatus={handleSetProfileStatus}
                      onBlock={handleBlockUser}
                      onUnblock={handleUnblockUser}
                      onResetPassword={handleResetUserPassword}
                      onSendResetEmail={
                        isSupabaseConfigured
                          ? handleSendPasswordResetEmail
                          : undefined
                      }
                      onRefreshProfiles={
                        isSupabaseConfigured
                          ? handleRefreshCloudProfiles
                          : undefined
                      }
                      onNotify={showToast}
                      canPromoteToOrganizer={
                        isSupabaseConfigured && activeRole === 'Super Admin'
                      }
                      currentUserId={activeProfileUserId}
                      onPromoteToOrganizer={handlePromoteUserToOrganizer}
                    />
                  )}

                  {activeRoute === 'system-health' &&
                    canAccessOrganizerWorkspace(
                      activeRole,
                      activeProfile.approvalStatus
                    ) && (
                      <SystemHealthPage
                        activeRole={activeRole}
                        profiles={managedProfiles}
                        profileEvents={profileState.events}
                        blockEvents={userBlockState.events}
                        onRefreshProfiles={handleRefreshCloudProfiles}
                        onNotify={showToast}
                      />
                    )}

                </>
              ) : activeRoute === 'dashboard' ? (
                <PendingApprovalDashboard
                  profile={activeProfile}
                  announcements={activeAnnouncements}
                  notificationStates={
                    notificationActionStore.byUserId[inboxUser.id] ?? {}
                  }
                  approvalLogs={profileState.approvalLogs ?? []}
                  activityLogs={profileState.activityLogs ?? []}
                  onNavigate={(route) => setActiveRoute(route)}
                  onOpenNotification={() => setActiveRoute('inbox')}
                />
              ) : (
                <UserInboxPage
                  activeRole={inboxRole}
                  approvalStatus={activeProfile.approvalStatus ?? 'Approved'}
                  activeUser={inboxUser}
                  announcements={activeAnnouncements}
                  preferences={preferencesByRole[inboxRole]}
                  notificationStates={
                    notificationActionStore.byUserId[inboxUser.id] ?? {}
                  }
                  notificationEvents={notificationActionStore.events.filter(
                    (event) => event.userId === inboxUser.id
                  )}
                  onUpdatePreferences={(next) => {
                    setPreferencesByRole((prev) => ({
                      ...prev,
                      [inboxRole]: next,
                    }));
                  }}
                  onResetPreferences={() => {
                    setPreferencesByRole((prev) => ({
                      ...prev,
                      [inboxRole]: createDefaultPreferencesForRole(inboxRole),
                    }));
                    showToast(`Reset notification preferences for ${inboxRole}.`);
                  }}
                  onToggleRead={(id, role, nextRead) =>
                    handleToggleRead(id, role, nextRead, inboxUser.id)
                  }
                  onMarkAllRead={(role) =>
                    handleMarkAllRead(role, inboxUser.id)
                  }
                  onUpdateNotificationAction={(id, patch, action, detail) =>
                    handleUpdateNotificationAction(
                      inboxUser.id,
                      id,
                      patch,
                      action,
                      detail
                    )
                  }
                  onBulkUpdateNotifications={(ids, patch, action) =>
                    handleBulkUpdateNotificationActions(
                      inboxUser.id,
                      ids,
                      patch,
                      action
                    )
                  }
                  onRecordNotificationView={(id) =>
                    handleRecordNotificationView(inboxUser.id, id)
                  }
                  onRecordNotificationReadTime={(id, seconds) =>
                    handleRecordNotificationReadTime(
                      inboxUser.id,
                      id,
                      seconds
                    )
                  }
                  onTrackClick={handleTrackClick}
                />
              )}
            </div>
          </div>
        </main>
      </div>

      {toastBanner}
    </div>
  );
}
