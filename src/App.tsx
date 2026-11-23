import { useEffect, useMemo, useState } from 'react';
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
import { ComposerPage } from './pages/ComposerPage';
import { DashboardPage } from './pages/DashboardPage';
import { DeliveryDetailPage } from './pages/DeliveryDetailPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { UserInboxPage } from './pages/UserInboxPage';
import { UserApprovalsPage } from './pages/UserApprovalsPage';
import type {
  ActivityFeedEntry,
  Announcement,
  DeliveryStatus,
  NotificationDelivery,
  OrganizerProfile,
  OrganizerSettings,
  RegistrationInput,
  RegistrationRequest,
  SettingsSection,
  SystemUser,
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
  REGISTRATION_STORAGE_KEY,
  saveRegistrationRequests,
  verifyRegistrationPassword,
} from './utils/registrationStore';

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
    const storedProfile = window.localStorage.getItem('baust_organizer_profile');
    if (storedProfile) {
      const parsedProfile: unknown = JSON.parse(storedProfile);
      if (isOrganizerProfile(parsedProfile)) return parsedProfile;
    }
  } catch {
    // Use the default profile if local storage is unavailable or invalid.
  }
  return createDefaultOrganizerProfile();
}

export default function App() {
  const [showLoginPage, setShowLoginPage] = useState(false);
  const [mode, setMode] = useState<WorkspaceMode>('organizer');
  const [activeRole, setActiveRole] = useState<WorkspaceRole>('Organizer');
  const [registeredUser, setRegisteredUser] = useState<SystemUser | null>(null);
  const [registrationRequests, setRegistrationRequests] =
    useState<RegistrationRequest[]>(loadRegistrationRequests);
  const [lastAttendeeRole, setLastAttendeeRole] =
    useState<WorkspaceRole>('Participant');
  const [activeRoute, setActiveRoute] = useState<OrganizerRoute>('dashboard');
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

  useEffect(() => {
    const handleRegistrationStorage = (event: StorageEvent) => {
      if (event.key === REGISTRATION_STORAGE_KEY) {
        setRegistrationRequests(loadRegistrationRequests());
      }
    };
    window.addEventListener('storage', handleRegistrationStorage);
    return () =>
      window.removeEventListener('storage', handleRegistrationStorage);
  }, []);

  const handleChangeMode = (nextMode: WorkspaceMode) => {
    setMode(nextMode);
    setMobileMenuOpen(false);
    if (nextMode === 'organizer') {
      setActiveRole('Organizer');
    }
  };

  const handleNavigateProfile = () => {
    setMode('organizer');
    setActiveRole('Organizer');
    setActiveRoute('profile');
    setMobileMenuOpen(false);
  };

  const handleNavigateSettings = (section: SettingsSection) => {
    setMode('organizer');
    setActiveRole('Organizer');
    setSettingsSection(section);
    setActiveRoute('settings');
    setMobileMenuOpen(false);
  };

  const handleSaveOrganizerProfile = (profile: OrganizerProfile) => {
    setOrganizerProfile(profile);
    showToast('Profile information saved.');
  };

  const handlePasswordUpdated = (
    currentPassword: string,
    newPassword: string
  ) => {
    if (organizerPassword !== null && currentPassword !== organizerPassword) {
      return false;
    }

    setOrganizerPassword(newPassword);
    showToast('Password updated for this app session.');
    return true;
  };

  const handleQuickDemoAccess = (
    role: WorkspaceRole,
    account: SystemUser | null = null
  ) => {
    setShowLoginPage(false);
    setMobileMenuOpen(false);
    setRegisteredUser(account);
    setActiveRole(role);
    if (role === 'Organizer') {
      setMode('organizer');
      setActiveRoute('dashboard');
    } else {
      setLastAttendeeRole(role);
      setMode('inbox');
    }
    showToast(`Signed in as ${account?.fullName ?? DEMO_USERS[role].fullName} (${role}).`);
  };

  const handleCredentialSignIn = async (
    identifier: string,
    password: string
  ): Promise<string | null> => {
    const normalized = identifier.toLowerCase();
    const digitsOnly = identifier.replace(/\D/g, '');
    const organizerPhone = organizerProfile.phone.replace(/\D/g, '');
    const matchesOrganizer =
      organizerProfile.email.toLowerCase() === normalized ||
      (digitsOnly.length >= 8 && organizerPhone === digitsOnly);

    if (matchesOrganizer) {
      if (organizerPassword !== null && password !== organizerPassword) {
        return 'Email/phone or password is incorrect.';
      }
      handleQuickDemoAccess('Organizer');
      return null;
    }

    const matchedEntry = Object.entries(DEMO_USERS).find(([role, user]) => {
      if (role === 'Organizer') return false;
      if (user.email.toLowerCase() === normalized) return true;
      if (digitsOnly.length >= 6) {
        const userDigits = user.phone.replace(/\D/g, '');
        return userDigits.endsWith(digitsOnly) || digitsOnly.endsWith(userDigits);
      }
      return false;
    });

    if (matchedEntry) {
      if (matchedEntry[1].role === 'Admin') {
        return 'Email/phone or password is incorrect.';
      }
      const role = matchedEntry[1].role;
      handleQuickDemoAccess(role);
      return null;
    }

    const registration = registrationRequests.find((request) => {
      if (request.email.toLowerCase() === normalized) return true;
      const phoneDigits = request.phone.replace(/\D/g, '');
      return digitsOnly.length >= 8 && phoneDigits === digitsOnly;
    });
    if (!registration) return 'Email/phone or password is incorrect.';
    if (registration.status === 'Pending Approval') {
      return 'Your registration is awaiting organizer approval. You can sign in after your request is approved.';
    }
    if (registration.status === 'Rejected') {
      return 'This registration request was not approved. Please contact the organizer for assistance.';
    }

    try {
      const passwordMatches = await verifyRegistrationPassword(
        password,
        registration.passwordSalt,
        registration.passwordHash
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
    handleQuickDemoAccess(registration.role, account);
    showToast('Your account has been approved. You can now sign in.');
    return null;
  };

  const handleRegisterUser = async (
    input: RegistrationInput
  ): Promise<string | null> => {
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

  const handleUpdateRegistrationStatus = (
    requestId: string,
    status: 'Approved' | 'Rejected'
  ) => {
    if (activeRole !== 'Organizer') return;
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

  const pendingRequestCount = useMemo(
    () =>
      registrationRequests.filter(
        (request) => request.status === 'Pending Approval'
      ).length,
    [registrationRequests]
  );
  const failedDeliveryCount = useMemo(
    () => deliveries.filter((d) => d.status === 'Failed').length,
    [deliveries]
  );

  const inboxRole: WorkspaceRole =
    activeRole === 'Organizer' ? lastAttendeeRole : activeRole;

  const unreadCount = useMemo(() => {
    return announcements.filter((a) => {
      if (!isAnnouncementVisibleToRole(a, inboxRole)) {
        return false;
      }
      const isRead = a.isReadByCurrentRole?.[inboxRole] ?? false;
      return !isRead;
    }).length;
  }, [announcements, inboxRole]);

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
    if (selectedAnnouncementId === id && announcements.length > 1) {
      const next = announcements.find((a) => a.id !== id);
      if (next) setSelectedAnnouncementId(next.id);
    }
    showToast('Announcement removed from local demo state.');
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

  const handleToggleRead = (
    announcementId: string,
    role: WorkspaceRole,
    nextRead: boolean
  ) => {
    setAnnouncements((prev) =>
      prev.map((ann) => {
        if (ann.id !== announcementId) return ann;
        const wasRead = ann.isReadByCurrentRole?.[role] ?? false;
        const delta = nextRead && !wasRead ? 1 : !nextRead && wasRead ? -1 : 0;

        return {
          ...ann,
          readCount: Math.max(0, ann.readCount + delta),
          isReadByCurrentRole: {
            ...(ann.isReadByCurrentRole ?? {}),
            [role]: nextRead,
          },
        };
      })
    );
  };

  const handleMarkAllRead = (role: WorkspaceRole) => {
    setAnnouncements((prev) =>
      prev.map((ann) => {
        if (!isAnnouncementVisibleToRole(ann, role)) return ann;
        const wasRead = ann.isReadByCurrentRole?.[role] ?? false;

        return {
          ...ann,
          readCount: wasRead ? ann.readCount : ann.readCount + 1,
          isReadByCurrentRole: {
            ...(ann.isReadByCurrentRole ?? {}),
            [role]: true,
          },
        };
      })
    );
    showToast(`Marked all notices read for ${role}.`);
  };

  const handleTrackClick = (announcementId: string, attachmentId?: string) => {
    setAnnouncements((prev) =>
      prev.map((ann) => {
        if (ann.id !== announcementId) return ann;
        return {
          ...ann,
          clickCount: ann.clickCount + 1,
          attachments: attachmentId
            ? ann.attachments.map((att) =>
                att.id === attachmentId
                  ? { ...att, downloadCount: att.downloadCount + 1 }
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
      className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-xl border border-emerald-800 bg-[#042419] dark:bg-[#06291D] dark:border-emerald-700/70 px-4 py-2.5 text-xs font-medium text-white shadow-xl whitespace-nowrap"
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

  if (showLoginPage) {
    return (
      <>
        <LoginPage
          demoUsers={DEMO_ACCESS_ROLES.map((role) => DEMO_USERS[role])}
          onSignIn={handleCredentialSignIn}
          onRegister={handleRegisterUser}
        />
        {toastBanner}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F8F6] text-[#052E1F] dark:bg-[#02120C] dark:text-emerald-50 transition-colors duration-150">
      <TopHeader
        mode={mode}
        activeRole={activeRole}
        unreadCount={unreadCount}
        isDark={darkMode}
        userName={
          activeRole === 'Organizer'
            ? organizerProfile.fullName
            : registeredUser?.fullName ?? DEMO_USERS[inboxRole].fullName
        }
        onToggleTheme={() => setDarkMode((prev) => !prev)}
        onChangeMode={handleChangeMode}
        onOpenLogin={() => setShowLoginPage(true)}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onNavigateProfile={handleNavigateProfile}
        onNavigateSettings={handleNavigateSettings}
      />

      {mode === 'organizer' && (
        <Sidebar
          activeRoute={activeRoute}
          failedDeliveryCount={failedDeliveryCount}
          pendingRequestCount={pendingRequestCount}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          onNavigate={(route) => setActiveRoute(route)}
          onNavigateSettings={handleNavigateSettings}
        />
      )}

      <div className={mode === 'organizer' ? 'lg:pl-56' : ''}>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6">
          {mode === 'organizer' ? (
            <>
              {activeRoute === 'dashboard' && (
                <DashboardPage
                  announcements={announcements}
                  activityFeed={activityFeed}
                  failedCount={failedDeliveryCount}
                  onCreateAnnouncement={handleCreateNew}
                  onInspectAnnouncement={handleInspectAnnouncement}
                  onViewAllAnnouncements={() => setActiveRoute('announcements')}
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

              {activeRoute === 'delivery-detail' && selectedAnnouncement && (
                <DeliveryDetailPage
                  announcements={announcements}
                  selectedAnnouncement={selectedAnnouncement}
                  deliveries={deliveries}
                  onSelectAnnouncement={(id) => setSelectedAnnouncementId(id)}
                  onBackToList={() => setActiveRoute('announcements')}
                  onEditAnnouncement={handleEditAnnouncement}
                  onRetryDelivery={handleRetryDelivery}
                  onRetryAllFailedForAnnouncement={
                    handleRetryAllFailedForAnnouncement
                  }
                  onPublishScheduledNow={handlePublishScheduledNow}
                />
              )}

              {activeRoute === 'analytics' && (
                <AnalyticsPage announcements={announcements} />
              )}

              {activeRoute === 'user-approvals' &&
                activeRole === 'Organizer' && (
                  <UserApprovalsPage
                    requests={registrationRequests}
                    demoUserCount={DEMO_ACCESS_ROLES.length}
                    onUpdateStatus={handleUpdateRegistrationStatus}
                  />
                )}

              {activeRoute === 'profile' && (
                <ProfilePage
                  profile={organizerProfile}
                  onEditProfile={() => handleNavigateSettings('account')}
                />
              )}

              {activeRoute === 'settings' && (
                <SettingsPage
                  profile={organizerProfile}
                  settings={organizerSettings}
                  section={settingsSection}
                  isDark={darkMode}
                  hasPassword={organizerPassword !== null}
                  onSaveProfile={handleSaveOrganizerProfile}
                  onUpdateSettings={setOrganizerSettings}
                  onChangeSection={setSettingsSection}
                  onToggleTheme={() => setDarkMode((prev) => !prev)}
                  onPasswordUpdated={handlePasswordUpdated}
                />
              )}
            </>
          ) : (
            <UserInboxPage
              activeRole={inboxRole}
              activeUser={registeredUser ?? DEMO_USERS[inboxRole]}
              announcements={announcements}
              preferences={preferencesByRole[inboxRole]}
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
              onToggleRead={handleToggleRead}
              onMarkAllRead={handleMarkAllRead}
              onTrackClick={handleTrackClick}
            />
          )}
        </main>
      </div>

      {toastBanner}
    </div>
  );
}
