import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { Sidebar, type OrganizerRoute } from './components/Sidebar';
import { TopHeader, type WorkspaceMode } from './components/TopHeader';
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
import { SettingsPage } from './pages/SettingsPage';
import { UserInboxPage } from './pages/UserInboxPage';
import { UserApprovalsPage } from './pages/UserApprovalsPage';
import { UserProfilePage } from './pages/UserProfilePage';
import { UserSettingsPage } from './pages/UserSettingsPage';
import { UsersPage } from './pages/UsersPage';
import type {
  ActivityFeedEntry,
  Announcement,
  DeliveryStatus,
  NotificationDelivery,
  OrganizerProfile,
  OrganizerSettings,
  ProfileAccountStatus,
  ProfileAuditAction,
  ProfileAuditEvent,
  ProfileLoginEvent,
  ProfileState,
  RegistrationInput,
  RegistrationRequest,
  RegistrableRole,
  SettingsSection,
  SystemUser,
  UserProfile,
  UserPreferenceMatrix,
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
  fetchCloudAnnouncements,
  fetchCloudNotificationActions,
  fetchCloudProfile,
  fetchCloudProfiles,
  isSupabaseConfigured,
  mapCloudProfile,
  saveCloudAnnouncements,
  saveCloudNotificationAction,
  saveCloudProfile,
  supabase,
  type CloudProfile,
} from './lib/supabase';

const DEMO_PASSWORD = 'demo1234';
const ORGANIZER_PROFILE_STORAGE_KEY = 'baust_organizer_profile';
const ACCOUNT_IDENTITY_SWAP_KEY = 'baust_organizer_superadmin_swap_v1';

function canAccessOrganizerWorkspace(role: WorkspaceRole) {
  return role === 'Organizer' || role === 'Super Admin';
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
  const isAdministrator =
    user.role === 'Organizer' ||
    user.role === 'Admin' ||
    user.role === 'Super Admin';
  const isMahathir = user.id === DEMO_USERS['Super Admin'].id;
  return {
    userId: user.id,
    role: user.role,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    department:
      user.role === 'Organizer' || isMahathir
        ? 'Computer Science & Engineering'
        : '',
    institution:
      user.role === 'Organizer' || isMahathir ? 'BAUST' : user.affiliation,
    biography: '',
    photoDataUrl: '',
    socialLinks: { website: '', linkedIn: '', github: '' },
    notificationPreferences: {
      email: true,
      push: true,
      inApp: true,
      securityAlerts: true,
    },
    accountStatus,
    verified: isAdministrator || accountStatus === 'Active',
    createdAt,
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
    if (!registrableRoles.includes(profile.role as RegistrableRole)) return [];
    return [{
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      phone: profile.phone,
      role: profile.role as RegistrableRole,
      affiliation: profile.institution || profile.department,
      registeredAt: profile.created_at,
      status:
        profile.account_status === 'Rejected'
          ? 'Rejected'
          : profile.account_status === 'Pending Approval'
            ? 'Pending Approval'
            : 'Approved',
      passwordSalt: '',
      passwordHash: '',
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
  const [activeRoute, setActiveRoute] = useState<OrganizerRoute>('dashboard');
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
    try {
      const currentRow = await fetchCloudProfile(userId);
      if (currentRow.account_status !== 'Active') {
        await supabase?.auth.signOut();
        return currentRow.account_status === 'Pending Approval'
          ? 'Your registration is awaiting organizer approval.'
          : currentRow.account_status === 'Rejected'
            ? 'This registration was not approved. Contact the organizer for help.'
            : 'This account is currently suspended. Contact the organizer.';
      }

      const isStaff = ['Organizer', 'Admin', 'Super Admin'].includes(
        currentRow.role
      );
      const profileRows = isStaff
        ? await fetchCloudProfiles()
        : [currentRow];
      const currentProfile = mapCloudProfile(currentRow);
      setProfileState((previous) => ({
        ...previous,
        profiles: profileRows.map(mapCloudProfile),
        credentials: {},
        passwordResetRequired: [],
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
      setMode(canAccessOrganizerWorkspace(currentProfile.role) ? 'organizer' : 'inbox');
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
      if (remoteAnnouncements.length === 0 && isStaff) {
        await saveCloudAnnouncements(INITIAL_ANNOUNCEMENTS, userId);
        setAnnouncements(INITIAL_ANNOUNCEMENTS);
      } else {
        setAnnouncements(remoteAnnouncements);
      }
      setCloudAnnouncementsReadyFor(userId);

      const remoteActions = await fetchCloudNotificationActions(userId);
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
      setNotificationActionStore((previous) => ({
        ...previous,
        byUserId: { ...previous.byUserId, [userId]: userStates },
        events: [
          ...previous.events.filter((event) => event.userId !== userId),
          ...userEvents,
        ].slice(0, 5000),
      }));
      setCloudUserId(userId);
      setShowLoginPage(false);
      showToast(`Signed in as ${currentProfile.fullName} (${currentProfile.role}).`);
      return null;
    } catch (error) {
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
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && active) {
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
        const result = await activateSupabaseUser(
          data.session.user.id,
          data.session.user.email ?? ''
        );
        if (result) showToast(result);
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
    if (!['Organizer', 'Admin', 'Super Admin'].includes(activeRole)) return;
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
          .filter((profile) =>
            ['Organizer', 'Admin', 'Super Admin'].includes(profile.role)
          )
          .map((profile) => ({
            id: profile.userId,
            fullName: profile.fullName,
            email: profile.email,
            phone: profile.phone,
            role: profile.role,
            affiliation: profile.institution || profile.department,
            badgeCode: profile.userId,
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
      ? profileState.profiles.map((profile) => ({
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
          role: request.role,
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
      const accountStatus =
        stored?.accountStatus === 'Suspended'
          ? 'Suspended'
          : status;
      return {
        ...base,
        ...stored,
        userId: user.id,
        role: user.role,
        fullName: stored?.fullName ?? user.fullName,
        email: stored?.email ?? user.email,
        phone: stored?.phone ?? user.phone,
        accountStatus,
        verified: stored?.verified ?? (approved ?? base.verified),
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
    if (nextMode === 'organizer' && !canAccessOrganizerWorkspace(activeRole)) return;
    setMode(nextMode);
    setMobileMenuOpen(false);
    setActiveRoute('dashboard');
  };

  const handleNavigateProfile = () => {
    setSettingsSection('account');
    setMode(canAccessOrganizerWorkspace(activeRole) ? 'organizer' : 'inbox');
    setActiveRoute('profile');
    setMobileMenuOpen(false);
  };

  const handleNavigateSettings = (section: SettingsSection) => {
    setSettingsSection(section);
    setMode(canAccessOrganizerWorkspace(activeRole) ? 'organizer' : 'inbox');
    setActiveRoute('settings');
    setMobileMenuOpen(false);
  };

  const handleNavigateProfileManagement = () => {
    if (
      activeRole !== 'Organizer' &&
      activeRole !== 'Admin' &&
      activeRole !== 'Super Admin'
    ) return;
    setMode(canAccessOrganizerWorkspace(activeRole) ? 'organizer' : 'inbox');
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

  const handleSaveUserProfile = (profile: UserProfile) => {
    const canEditOtherProfiles =
      activeRole === 'Organizer' ||
      activeRole === 'Super Admin' ||
      (isSupabaseConfigured && activeRole === 'Admin');
    if (!canEditOtherProfiles && profile.userId !== getCurrentProfileUserId()) {
      showToast('You can only edit your own profile.');
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
      showToast('Notification preferences saved.');
    }
  };

  const handleSetProfileVerification = async (userId: string, verified: boolean) => {
    const canVerify =
      activeRole === 'Organizer' ||
      activeRole === 'Admin' ||
      activeRole === 'Super Admin';
    const canUnverify =
      activeRole === 'Organizer' || activeRole === 'Super Admin';
    if (!canVerify || (!verified && !canUnverify)) return;
    const profile = managedProfiles.find((item) => item.userId === userId);
    if (!profile || profile.verified === verified) return;
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
      (status !== 'Suspended' && status !== 'Active')
    ) return;
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
    const request = registrationRequests.find((item) => item.id === userId);
    if (
      status === 'Active' &&
      request &&
      request.status !== 'Approved'
    ) {
      showToast('Only approved accounts can be reactivated.');
      return;
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
    if (!target) return null;
    try {
      const randomBytes = window.crypto.getRandomValues(new Uint8Array(8));
      const temporaryPassword = `BAUST-${Array.from(randomBytes, (byte) =>
        byte.toString(16).padStart(2, '0')
      ).join('')}`;
      const credential = await hashRegistrationPassword(temporaryPassword);
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
        credentials: {
          ...profileState.credentials,
          [userId]: { salt: credential.salt, hash: credential.hash },
        },
        passwordResetRequired: [
          ...new Set([...profileState.passwordResetRequired, userId]),
        ],
        events: [event, ...profileState.events].slice(0, 1000),
      };
      if (
        !persistProfileState(
          nextState,
          'Could not reset the password. Check browser storage.'
        )
      ) return null;
      showToast(`Temporary password created for ${target.fullName}.`);
      return temporaryPassword;
    } catch {
      showToast('Secure password reset is unavailable in this browser.');
      return null;
    }
  };

  const recordProfileLogin = (
    userId: string,
    method: ProfileLoginEvent['method']
  ) => {
    const event: ProfileLoginEvent = {
      id: `profile-login-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      occurredAt: new Date().toISOString(),
      method,
    };
    const nextState: ProfileState = {
      ...profileState,
      loginHistory: [event, ...profileState.loginHistory].slice(0, 500),
    };
    persistProfileState(nextState, 'Sign-in succeeded, but login history could not be saved.');
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

  const handleQuickDemoAccess = (
    role: WorkspaceRole,
    account: SystemUser | null = null,
    method: ProfileLoginEvent['method'] = 'demo'
  ) => {
    const userId = account?.id ?? DEMO_USERS[role].id;
    const passwordChangeRequired =
      profileState.passwordResetRequired.includes(userId);
    setShowLoginPage(false);
    setMobileMenuOpen(false);
    const profile = account
      ? managedProfiles.find((item) => item.userId === account.id)
      : undefined;
    setRegisteredUser(
      account && profile
        ? { ...account, fullName: profile.fullName, phone: profile.phone }
        : account
    );
    setActiveRole(role);
    setActiveRoute(passwordChangeRequired ? 'profile' : 'dashboard');
    if (canAccessOrganizerWorkspace(role)) {
      setMode('organizer');
    } else {
      setLastAttendeeRole(role);
      setMode('inbox');
    }
    recordProfileLogin(userId, method);
    showToast(
      passwordChangeRequired
        ? 'Sign-in successful. Please change your temporary password.'
        : `Signed in as ${profile?.fullName ?? account?.fullName ?? DEMO_USERS[role].fullName} (${role}).`
    );
  };

  const handleCredentialSignIn = async (
    identifier: string,
    password: string
  ): Promise<string | null> => {
    if (isSupabaseConfigured && supabase) {
      if (!identifier.includes('@')) {
        return 'Sign in with the email address linked to your Supabase account. Phone sign-in is not enabled.';
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: identifier.trim().toLowerCase(),
        password,
      });
      if (error) return error.message;
      if (!data.user) return 'Supabase did not return an authenticated user.';
      return activateSupabaseUser(data.user.id, data.user.email ?? identifier);
    }

    const normalized = identifier.toLowerCase();
    const digitsOnly = identifier.replace(/\D/g, '');
    const organizerPhone = organizerProfile.phone.replace(/\D/g, '');
    const matchesOrganizer =
      organizerProfile.email.toLowerCase() === normalized ||
      (digitsOnly.length >= 8 && organizerPhone === digitsOnly);

    if (matchesOrganizer) {
      const organizerProfileRecord = managedProfiles.find(
        (profile) => profile.userId === DEMO_USERS.Organizer.id
      );
      if (organizerProfileRecord?.accountStatus === 'Suspended') {
        return 'This organizer account is suspended.';
      }
      let passwordMatches: boolean;
      try {
        passwordMatches = await verifyAccountPassword(
          DEMO_USERS.Organizer.id,
          password
        );
      } catch {
        return 'Secure password verification is unavailable in this browser.';
      }
      if (!passwordMatches) {
        return 'Email/phone or password is incorrect.';
      }
      handleQuickDemoAccess(
        'Organizer',
        null,
        profileState.credentials[DEMO_USERS.Organizer.id] ||
          organizerPassword !== null
          ? 'password'
          : 'demo'
      );
      return null;
    }

    const matchedProfile = managedProfiles.find((profile) => {
      if (profile.email.toLowerCase() === normalized) return true;
      if (digitsOnly.length >= 6) {
        const userDigits = profile.phone.replace(/\D/g, '');
        return userDigits.endsWith(digitsOnly) || digitsOnly.endsWith(userDigits);
      }
      return false;
    });

    const matchedUser = matchedProfile
      ? availableDemoUsers.find((user) => user.id === matchedProfile.userId)
      : undefined;

    if (matchedUser && matchedProfile) {
      const blockMessage = getUserBlockMessage(
        userBlockState.records,
        matchedUser.id
      );
      if (blockMessage) return blockMessage;
      if (matchedProfile.accountStatus === 'Suspended') {
        return 'This account is suspended. Contact an organizer for assistance.';
      }
      let passwordMatches: boolean;
      try {
        passwordMatches = await verifyAccountPassword(matchedUser.id, password);
      } catch {
        return 'Secure password verification is unavailable in this browser.';
      }
      if (!passwordMatches) return 'Email/phone or password is incorrect.';
      handleQuickDemoAccess(
        matchedUser.role,
        null,
        profileState.credentials[matchedUser.id] ? 'password' : 'demo'
      );
      return null;
    }

    const registration = registrationRequests.find((request) => {
      const profile = managedProfiles.find((item) => item.userId === request.id);
      if ((profile?.email ?? request.email).toLowerCase() === normalized) return true;
      const phoneDigits = (profile?.phone ?? request.phone).replace(/\D/g, '');
      return digitsOnly.length >= 8 && phoneDigits === digitsOnly;
    });
    if (!registration) return 'Email/phone or password is incorrect.';
    const blockMessage = getUserBlockMessage(
      userBlockState.records,
      registration.id
    );
    if (blockMessage) return blockMessage;
    if (registration.status === 'Pending Approval') {
      return 'Your registration is awaiting organizer approval. You can sign in after your request is approved.';
    }
    if (registration.status === 'Rejected') {
      return 'This registration request was not approved. Please contact the organizer for assistance.';
    }
    const registrationProfile = managedProfiles.find(
      (profile) => profile.userId === registration.id
    );
    if (registrationProfile?.accountStatus === 'Suspended') {
      return 'This account is suspended. Contact an organizer for assistance.';
    }

    try {
      const passwordMatches = await verifyAccountPassword(
        registration.id,
        password,
        registration
      );
      if (!passwordMatches) return 'Email/phone or password is incorrect.';
    } catch {
      return 'Secure password verification is unavailable in this browser.';
    }

    const account: SystemUser = {
      id: registration.id,
      fullName: registration.fullName,
      email: registration.email,
      phone: registration.phone,
      role: registration.role,
      affiliation: registration.affiliation,
      badgeCode: registration.id,
    };
    handleQuickDemoAccess(registration.role, account, 'password');
    showToast('Your account has been approved. You can now sign in.');
    return null;
  };

  const handleRegisterUser = async (
    input: RegistrationInput
  ): Promise<string | null> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signUp({
        email: input.email.trim().toLowerCase(),
        password: input.password,
        options: {
          data: {
            full_name: input.fullName.trim(),
            phone: input.phone.trim(),
            requested_role: input.role,
            institution: input.affiliation.trim(),
          },
        },
      });
      if (error) return error.message;
      showToast(
        'Registration submitted to Supabase. An organizer must approve your account before sign-in.'
      );
      return null;
    }

    const normalizedEmail = input.email.toLowerCase();
    const phoneDigits = input.phone.replace(/\D/g, '');
    const emailExists =
      Object.values(DEMO_USERS).some(
        (user) => user.email.toLowerCase() === normalizedEmail
      ) ||
      registrationRequests.some(
        (request) => request.email.toLowerCase() === normalizedEmail
      );
    const phoneExists =
      Object.values(DEMO_USERS).some(
        (user) => user.phone.replace(/\D/g, '') === phoneDigits
      ) ||
      registrationRequests.some(
        (request) => request.phone.replace(/\D/g, '') === phoneDigits
      );
    if (emailExists) return 'An account with this email address already exists.';
    if (phoneExists) return 'An account with this mobile number already exists.';

    let credential: { salt: string; hash: string };
    try {
      credential = await hashRegistrationPassword(input.password);
    } catch {
      return 'Secure password setup is unavailable in this browser. Please use a modern browser and try again.';
    }

    const request: RegistrationRequest = {
      id: `registration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      role: input.role,
      affiliation: input.affiliation,
      registeredAt: new Date().toISOString(),
      status: 'Pending Approval',
      passwordSalt: credential.salt,
      passwordHash: credential.hash,
    };
    const updatedRequests = [...registrationRequests, request];
    try {
      saveRegistrationRequests(updatedRequests);
    } catch {
      return 'The registration could not be saved in this browser. Check storage availability and try again.';
    }
    setRegistrationRequests(updatedRequests);
    showToast('New user registration request received.');
    return null;
  };

  const handleUpdateRegistrationStatus = async (
    requestId: string,
    status: 'Approved' | 'Rejected'
  ) => {
    if (!canAccessOrganizerWorkspace(activeRole)) return;
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.rpc('review_user_registration', {
        target_user_id: requestId,
        approve: status === 'Approved',
      });
      if (error) {
        showToast(`Could not update registration in Supabase: ${error.message}`);
        return;
      }
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
        const message =
          error instanceof Error ? error.message : 'Unexpected Supabase error.';
        showToast(`Registration updated, but profiles could not refresh: ${message}`);
        return;
      }
      showToast(
        status === 'Approved'
          ? 'User approved in Supabase and can now sign in.'
          : 'Registration rejected in Supabase.'
      );
      return;
    }

    const updatedRequests = registrationRequests.map((request) =>
      request.id === requestId && request.status === 'Pending Approval'
        ? { ...request, status, reviewedAt: new Date().toISOString() }
        : request
    );
    try {
      saveRegistrationRequests(updatedRequests);
    } catch {
      showToast('Could not save the approval decision. Check browser storage.');
      return;
    }
    setRegistrationRequests(updatedRequests);
    showToast(
      status === 'Approved'
        ? 'User approved. They can now sign in and will see the approval notification.'
        : 'User rejected. The account remains inactive and the applicant will see the decision when signing in.'
    );
  };

  const handleDeleteUser = (userId: string) => {
    if (
      !canAccessOrganizerWorkspace(activeRole) ||
      userId === DEMO_USERS.Organizer.id ||
      userId === DEMO_USERS['Super Admin'].id ||
      userId === DEMO_USERS.Admin.id
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

  const handleBlockUser = (
    userId: string,
    expiresAt: string | null,
    reason: UserBlockReason,
    note: string
  ) => {
    const canManageBlocks =
      activeRole === 'Organizer' || activeRole === 'Super Admin';
    const actor =
      activeRole === 'Organizer'
        ? {
            id: organizerProfile.organizerId,
            name: organizerProfile.fullName,
          }
        : {
            id: DEMO_USERS['Super Admin'].id,
            name: DEMO_USERS['Super Admin'].fullName,
          };
    if (
      !canManageBlocks ||
      userId === actor.id ||
      (userId === DEMO_USERS.Organizer.id && activeRole !== 'Super Admin')
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
    const registration = registrationRequests.find((request) => request.id === userId);
    const demoUser = availableDemoUsers.find(
      (user) => user.id === userId && user.role !== 'Organizer'
    );
    const userName = registration?.fullName ?? demoUser?.fullName;
    if (!userName) return;

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

  const handleUnblockUser = (blockId: string) => {
    if (activeRole !== 'Organizer' && activeRole !== 'Super Admin') {
      return;
    }
    const actor =
      activeRole === 'Organizer'
        ? { id: organizerProfile.organizerId, name: organizerProfile.fullName }
        : { id: DEMO_USERS['Super Admin'].id, name: DEMO_USERS['Super Admin'].fullName };
    const target = userBlockState.records.find(
      (record) => record.id === blockId && !record.endedAt
    );
    if (
      !target ||
      (target.userId === DEMO_USERS.Organizer.id && activeRole !== 'Super Admin') ||
      target.userId === actor.id
    ) return;
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
    const actor =
      activeRole === 'Organizer'
        ? { id: organizerProfile.organizerId, name: organizerProfile.fullName }
        : { id: DEMO_USERS['Super Admin'].id, name: DEMO_USERS['Super Admin'].fullName };
    const target = userBlockState.records.find(
      (record) => record.id === blockId && !record.endedAt
    );
    if (
      !target ||
      (target.userId === DEMO_USERS.Organizer.id && activeRole !== 'Super Admin') ||
      target.userId === actor.id
    ) return;
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
    showToast(action === 'extended' ? 'Block duration extended.' : 'Block expiry changed.');
  };

  const pendingRequestCount = useMemo(
    () =>
      registrationRequests.filter(
        (request) => request.status === 'Pending Approval'
      ).length,
    [registrationRequests]
  );
  const blockedUserCount = useMemo(
    () =>
      userBlockState.records.filter((record) =>
        findActiveUserBlock(userBlockState.records, record.userId)
      ).reduce((userIds, record) => userIds.add(record.userId), new Set<string>())
        .size,
    [userBlockState.records]
  );
  const failedDeliveryCount = useMemo(
    () => deliveries.filter((d) => d.status === 'Failed').length,
    [deliveries]
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
              request.status === 'Approved'
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
    deletedDemoUserIds,
    managedProfiles,
    registeredUser,
    registrationRequests,
    userBlockState.records,
  ]);

  const unreadCount = useMemo(() => {
    const userNotifications =
      notificationActionStore.byUserId[inboxUser.id] ?? {};
    return announcements.filter((a) => {
      if (!isAnnouncementVisibleToRole(a, inboxRole)) {
        return false;
      }
      const isRead =
        userNotifications[a.id]?.read ??
        a.isReadByUserId?.[inboxUser.id] ??
        a.isReadByCurrentRole?.[inboxRole] ??
        false;
      return !isRead;
    }).length;
  }, [announcements, inboxRole, inboxUser.id, notificationActionStore]);

  const selectedAnnouncement = useMemo(
    () =>
      announcements.find((a) => a.id === selectedAnnouncementId) ??
      announcements[0],
    [announcements, selectedAnnouncementId]
  );

  const handleInspectAnnouncement = (id: string) => {
    setSelectedAnnouncementId(id);
    setActiveRoute('delivery-detail');
  };

  const handleCreateNew = () => {
    setEditingAnnouncement(null);
    setActiveRoute('composer');
  };

  const handleEditAnnouncement = (ann: Announcement) => {
    setEditingAnnouncement(ann);
    setActiveRoute('composer');
  };

  const handleDuplicateAnnouncement = (ann: Announcement) => {
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
    };
    setEditingAnnouncement(duplicate);
    setActiveRoute('composer');
  };

  const handleDeleteAnnouncement = (id: string) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    setDeliveries((prev) => prev.filter((d) => d.announcementId !== id));
    if (supabase && cloudUserId) {
      void deleteCloudAnnouncement(id).catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Unexpected Supabase error.';
        showToast(`Could not delete the announcement from Supabase: ${message}`);
      });
    }
    if (selectedAnnouncementId === id && announcements.length > 1) {
      const next = announcements.find((a) => a.id !== id);
      if (next) setSelectedAnnouncementId(next.id);
    }
    showToast(
      isSupabaseConfigured
        ? 'Announcement removed.'
        : 'Announcement removed from local demo state.'
    );
  };

  const handleSaveAnnouncement = (
    saved: Announcement,
    targetStatus: DeliveryStatus
  ) => {
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
          demoUsers={isSupabaseConfigured ? [] : availableDemoUsers}
          onSignIn={handleCredentialSignIn}
          onRegister={handleRegisterUser}
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
        unreadCount={unreadCount}
        isDark={darkMode}
        userName={activeProfile.fullName}
        avatarUrl={activeProfile.photoDataUrl || undefined}
        onToggleTheme={() => setDarkMode((prev) => !prev)}
        onChangeMode={handleChangeMode}
        onOpenLogin={handleSignOut}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onNavigateProfile={handleNavigateProfile}
        onManageProfiles={handleNavigateProfileManagement}
        onNavigateSettings={handleNavigateSettings}
      />

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {mode === 'organizer' && (
          <Sidebar
            activeRoute={activeRoute}
            failedDeliveryCount={failedDeliveryCount}
            pendingRequestCount={pendingRequestCount}
            blockedUserCount={blockedUserCount}
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
                activeRole === 'Organizer' ? (
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
              ) : mode === 'organizer' ? (
                <>
                  {activeRoute === 'dashboard' && (
                    <DashboardPage
                      title={
                        activeRole === 'Super Admin'
                          ? 'Super Admin Dashboard'
                          : 'Organizer Dashboard'
                      }
                      announcements={announcements}
                      activityFeed={activityFeed}
                      failedCount={failedDeliveryCount}
                      onCreateAnnouncement={handleCreateNew}
                      onInspectAnnouncement={handleInspectAnnouncement}
                      onViewAllAnnouncements={() =>
                        setActiveRoute('announcements')
                      }
                    />
                  )}

                  {activeRoute === 'announcements' && (
                    <AnnouncementsPage
                      announcements={announcements}
                      onInspectAnnouncement={handleInspectAnnouncement}
                      onEditAnnouncement={handleEditAnnouncement}
                      onDuplicateAnnouncement={handleDuplicateAnnouncement}
                      onDeleteAnnouncement={handleDeleteAnnouncement}
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
                        announcements={announcements}
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
                      announcements={announcements}
                      notificationEvents={notificationActionStore.events}
                    />
                  )}

                  {activeRoute === 'user-approvals' &&
                    canAccessOrganizerWorkspace(activeRole) && (
                      <UserApprovalsPage
                        requests={registrationRequests}
                        demoUserCount={availableDemoUsers.length}
                        onUpdateStatus={handleUpdateRegistrationStatus}
                      />
                    )}

                  {activeRoute === 'users' &&
                    canAccessOrganizerWorkspace(activeRole) && (
                    <UsersPage
                      organizer={{
                        ...DEMO_USERS.Organizer,
                        fullName: organizerProfile.fullName,
                        email: organizerProfile.email,
                        phone: organizerProfile.phone,
                      }}
                      demoUsers={availableDemoUsers}
                      requests={registrationRequests}
                      blocks={userBlockState.records}
                      onBlockUser={handleBlockUser}
                      onUnblockUser={handleUnblockUser}
                      onDeleteUser={handleDeleteUser}
                    />
                  )}

                  {activeRoute === 'blocked-users' &&
                    canAccessOrganizerWorkspace(activeRole) && (
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
                    canAccessOrganizerWorkspace(activeRole) && (
                    <ProfileManagementPage
                      profiles={managedProfiles}
                      blocks={userBlockState.records}
                      canManage={canAccessOrganizerWorkspace(activeRole)}
                      canVerify
                      onSaveProfile={handleSaveUserProfile}
                      onSetVerified={handleSetProfileVerification}
                      onSetStatus={handleSetProfileStatus}
                      onBlock={handleBlockUser}
                      onUnblock={handleUnblockUser}
                      onResetPassword={handleResetUserPassword}
                    />
                  )}

                </>
              ) : activeRoute === 'profiles' &&
                (activeRole === 'Admin' || activeRole === 'Super Admin') ? (
                <ProfileManagementPage
                  profiles={managedProfiles}
                  blocks={userBlockState.records}
                  canManage={activeRole === 'Super Admin'}
                  canVerify
                  onSaveProfile={handleSaveUserProfile}
                  onSetVerified={handleSetProfileVerification}
                  onSetStatus={handleSetProfileStatus}
                  onBlock={handleBlockUser}
                  onUnblock={handleUnblockUser}
                  onResetPassword={handleResetUserPassword}
                />
              ) : (
                <UserInboxPage
                  activeRole={inboxRole}
                  activeUser={inboxUser}
                  announcements={announcements}
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
