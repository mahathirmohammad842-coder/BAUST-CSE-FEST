import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Archive,
  BellRing,
  Bookmark,
  Building2,
  Check,
  CheckCheck,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  Flag,
  HelpCircle,
  History,
  Inbox,
  Mail,
  MailOpen,
  MapPin,
  MessageSquare,
  Pin,
  Printer,
  Moon,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Send,
  Share2,
  ShieldAlert,
  SlidersHorizontal,
  Star,
  Tag,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { PriorityBadge } from '../components/Badge';
import { ChannelPill } from '../components/ChannelPill';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import {
  ALL_CHANNELS,
  ALL_NOTIFICATION_TYPES,
  BAUST_ROOMS,
  DEMO_USERS,
} from '../data/mockData';
import type {
  Announcement,
  ApprovalStatus,
  NotificationChannel,
  NotificationType,
  SystemUser,
  UserPreferenceMatrix,
  WorkspaceRole,
} from '../types';
import type {
  NotificationActionEvent,
  NotificationActionName,
  PersonalNotificationState,
} from '../utils/notificationActions';
import { createDefaultPersonalNotificationState } from '../utils/notificationActions';
import {
  formatDhakaDateTime,
  formatDhakaTimeOnly,
  getPriorityWeight,
  isAnnouncementVisibleToRole,
} from '../utils/formatters';
import { getAttachmentsForChannel } from '../utils/attachmentUtils';

interface UserInboxPageProps {
  activeRole: WorkspaceRole;
  approvalStatus?: ApprovalStatus;
  activeUser: SystemUser;
  announcements: Announcement[];
  preferences: UserPreferenceMatrix;
  notificationStates: Record<string, PersonalNotificationState>;
  notificationEvents: NotificationActionEvent[];
  onUpdatePreferences: (next: UserPreferenceMatrix) => void;
  onResetPreferences: () => void;
  onToggleRead: (
    announcementId: string,
    role: WorkspaceRole,
    nextRead: boolean
  ) => void;
  onMarkAllRead: (role: WorkspaceRole) => void;
  onUpdateNotificationAction: (
    notificationId: string,
    patch: Partial<PersonalNotificationState>,
    action: NotificationActionName,
    detail?: string
  ) => void;
  onBulkUpdateNotifications: (
    notificationIds: string[],
    patch: Partial<PersonalNotificationState>,
    action: NotificationActionName
  ) => void;
  onRecordNotificationView: (notificationId: string) => void;
  onRecordNotificationReadTime: (
    notificationId: string,
    seconds: number
  ) => void;
  onTrackClick: (
    announcementId: string,
    attachmentId?: string,
    attachmentAction?: 'view' | 'download'
  ) => void;
}

type InboxFilterPill =
  | 'all'
  | 'unread'
  | 'starred'
  | 'saved'
  | 'pinned'
  | 'archived'
  | 'high-priority'
  | 'emergency'
  | 'my-department'
  | 'my-events'
  | 'snoozed'
  | 'recently-viewed'
  | 'frequently-accessed'
  | 'history'
  | 'schedule-rooms'
  | 'competitions'
  | 'trash';

const MAX_RECENT_SEARCHES = 5;

function loadRecentSearches(role: WorkspaceRole): string[] {
  try {
    const raw = window.localStorage.getItem(
      `baust_inbox_recent_searches_${role}`
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .filter((item): item is string => typeof item === 'string')
          .slice(0, MAX_RECENT_SEARCHES)
      : [];
  } catch {
    return [];
  }
}

function saveRecentSearches(role: WorkspaceRole, queries: string[]) {
  try {
    window.localStorage.setItem(
      `baust_inbox_recent_searches_${role}`,
      JSON.stringify(queries.slice(0, MAX_RECENT_SEARCHES))
    );
  } catch {
    // Ignore storage errors
  }
}

function toLocalDateTimeValue(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function UserInboxPage({
  activeRole,
  approvalStatus = 'Approved',
  activeUser,
  announcements,
  preferences,
  notificationStates,
  notificationEvents,
  onUpdatePreferences,
  onResetPreferences,
  onToggleRead,
  onMarkAllRead,
  onUpdateNotificationAction,
  onBulkUpdateNotifications,
  onRecordNotificationView,
  onRecordNotificationReadTime,
  onTrackClick,
}: UserInboxPageProps) {
  const [filterPill, setFilterPill] = useState<InboxFilterPill>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    loadRecentSearches(activeRole)
  );
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [mobileReaderOpen, setMobileReaderOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [labelDraft, setLabelDraft] = useState('');
  const [draftResponse, setDraftResponse] = useState('');
  const [snoozeChoice, setSnoozeChoice] = useState('1h');
  const [customSnooze, setCustomSnooze] = useState('');
  const [followUpDueAt, setFollowUpDueAt] = useState('');
  const [reminderTime, setReminderTime] = useState(Date.now());
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [prefsSavedBanner, setPrefsSavedBanner] = useState(false);

  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [activeQuickModal, setActiveQuickModal] = useState<
    'incident' | 'info' | 'organizer' | null
  >(null);
  const quickMenuRef = useRef<HTMLDivElement>(null);

  const [incidentType, setIncidentType] = useState('Lab / Hardware Issue');
  const [incidentRoom, setIncidentRoom] = useState(
    activeUser.assignedRoom || BAUST_ROOMS[0]
  );
  const [incidentDetails, setIncidentDetails] = useState('');
  const [infoTopic, setInfoTopic] = useState('Competition Rules & Timing');
  const [infoQuestion, setInfoQuestion] = useState('');
  const [organizerSubject, setOrganizerSubject] = useState('');
  const [organizerMessage, setOrganizerMessage] = useState('');
  const readSessionRef = useRef<{ notificationId: string; startedAt: number } | null>(null);
  const onReadTimeRef = useRef(onRecordNotificationReadTime);
  onReadTimeRef.current = onRecordNotificationReadTime;
  const onUpdateActionRef = useRef(onUpdateNotificationAction);
  onUpdateActionRef.current = onUpdateNotificationAction;
  const touchStartXRef = useRef<number | null>(null);
  const suppressNextClickRef = useRef(false);

  useEffect(() => {
    setRecentSearches(loadRecentSearches(activeRole));
    setIsSearchFocused(false);
    setQuickMenuOpen(false);
    setMobileReaderOpen(false);
    setIncidentRoom(activeUser.assignedRoom || BAUST_ROOMS[0]);
    setSelectedNotificationIds([]);
    setFilterPill('all');
    setLabelFilter('');
  }, [activeRole, activeUser.assignedRoom]);

  useEffect(() => {
    const timer = window.setInterval(() => setReminderTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const dueReminders = Object.entries(notificationStates).filter(
      ([, state]) =>
        state.snoozedUntil !== null &&
        Date.parse(state.snoozedUntil) <= reminderTime &&
        state.reminderNotifiedAt === null
    );
    if (dueReminders.length === 0) return;

    const notifiedAt = new Date(reminderTime).toISOString();
    dueReminders.forEach(([notificationId]) => {
      onUpdateActionRef.current(
        notificationId,
        { reminderNotifiedAt: notifiedAt },
        'reminder-triggered'
      );
    });
    flashFeedback(
      dueReminders.length === 1
        ? 'A snoozed notification is ready for follow-up.'
        : `${dueReminders.length} snoozed notifications are ready for follow-up.`
    );
  }, [notificationStates, reminderTime]);

  useEffect(() => () => {
    const session = readSessionRef.current;
    if (!session) return;
    const seconds = Math.round((Date.now() - session.startedAt) / 1000);
    if (seconds > 0) {
      onReadTimeRef.current(session.notificationId, seconds);
    }
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchFocused(false);
      }
      if (
        quickMenuRef.current &&
        !quickMenuRef.current.contains(event.target as Node)
      ) {
        setQuickMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setQuickMenuOpen(false);
        setPreferencesOpen(false);
      } else if (
        event.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const recordSearchQuery = (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = [
        trimmed,
        ...prev.filter((q) => q.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, MAX_RECENT_SEARCHES);
      saveRecentSearches(activeRole, next);
      return next;
    });
  };

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) return;
    const timer = window.setTimeout(() => {
      recordSearchQuery(trimmed);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [searchQuery, activeRole]);

  const notificationStateFor = (notice: Announcement) => {
    const stored = notificationStates[notice.id];
    if (stored) return stored;
    return {
      ...createDefaultPersonalNotificationState(),
      read:
        notice.isReadByUserId?.[activeUser.id] ??
        notice.isReadByCurrentRole?.[activeRole] ??
        false,
    };
  };

  const isNotificationRead = (notice: Announcement) =>
    notificationStateFor(notice).read;

  const finishReadSession = () => {
    const session = readSessionRef.current;
    if (!session) return;
    readSessionRef.current = null;
    const seconds = Math.round((Date.now() - session.startedAt) / 1000);
    if (seconds > 0) {
      onRecordNotificationReadTime(session.notificationId, seconds);
    }
  };

  const roleNotices = useMemo(() => {
    return announcements
      .filter((a) => {
        if (approvalStatus === 'Pending') {
          return (
            isAnnouncementVisibleToRole(a, 'Participant') &&
            (a.targeting.everyoneAttending ||
              a.targeting.roles.includes('Participant'))
          );
        }
        return isAnnouncementVisibleToRole(a, activeRole);
      })
      .sort((a, b) => {
        const pinnedDifference =
          Number(notificationStates[b.id]?.pinned ?? false) -
          Number(notificationStates[a.id]?.pinned ?? false);
        if (pinnedDifference !== 0) return pinnedDifference;
        const pw = getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
        if (pw !== 0) return pw;
        return (b.publishedAt || b.createdAt).localeCompare(
          a.publishedAt || a.createdAt
        );
      });
  }, [announcements, activeRole, approvalStatus, notificationStates]);

  const emergencyNotices = useMemo(
    () =>
      roleNotices.filter(
        (notice) =>
          notice.priority === 'Emergency' &&
          !notificationStateFor(notice).archived &&
          !notificationStateFor(notice).deleted
      ),
    [roleNotices, notificationStates]
  );

  const unreadCount = useMemo(
    () =>
      roleNotices.filter(
        (notice) =>
          !notificationStateFor(notice).read &&
          !notificationStateFor(notice).archived &&
          !notificationStateFor(notice).deleted
      ).length,
    [roleNotices, activeRole, notificationStates, activeUser.id]
  );

  const trashedCount = useMemo(
    () =>
      roleNotices.filter((notice) => notificationStateFor(notice).deleted)
        .length,
    [roleNotices, notificationStates, activeRole, activeUser.id]
  );

  const activeInboxCount = useMemo(
    () =>
      roleNotices.filter((notice) => !notificationStateFor(notice).deleted)
        .length,
    [roleNotices, notificationStates, activeRole, activeUser.id]
  );

  const filteredNotices = useMemo(() => {
    return roleNotices.filter((n) => {
      const state = notificationStateFor(n);
      const isRead = state.read;
      const isSnoozed =
        state.snoozedUntil !== null &&
        Date.parse(state.snoozedUntil) > reminderTime;

      if (filterPill === 'trash') {
        if (!state.deleted) return false;
      } else {
        if (state.deleted) return false;
        if (filterPill === 'archived' ? !state.archived : state.archived) return false;
        if (
          filterPill === 'snoozed'
            ? !isSnoozed
            : isSnoozed
        ) return false;
      }
      if (filterPill === 'unread' && isRead) return false;
      if (filterPill === 'starred' && !state.starred) return false;
      if (filterPill === 'saved' && !state.saved) return false;
      if (filterPill === 'pinned' && !state.pinned) return false;
      if (filterPill === 'high-priority' && !['High', 'Emergency'].includes(n.priority)) return false;
      if (
        filterPill === 'emergency' &&
        n.priority !== 'Emergency' &&
        n.type !== 'Emergency Alert'
      ) {
        return false;
      }
      if (
        filterPill === 'schedule-rooms' &&
        n.type !== 'Schedule / Room Change'
      ) {
        return false;
      }
      if (
        filterPill === 'competitions' &&
        n.type !== 'Competition Update'
      ) {
        return false;
      }
      if (
        filterPill === 'my-department' &&
        !n.targeting.rooms.includes(activeUser.assignedRoom || '') &&
        !(activeUser.affiliation && `${n.title} ${n.body} ${n.category}`.toLowerCase().includes(activeUser.affiliation.toLowerCase()))
      ) return false;
      if (
        filterPill === 'my-events' &&
        n.targeting.competitions.length === 0 &&
        !['Competition Update', 'Ceremony'].includes(n.type)
      ) return false;
      if (filterPill === 'recently-viewed' && !state.lastOpenedAt) return false;
      if (filterPill === 'frequently-accessed' && state.viewCount < 3) return false;
      if (filterPill === 'history') return false;
      if (labelFilter && !state.labels.includes(labelFilter)) return false;

      const noticeDate = new Date(n.publishedAt || n.createdAt);
      if (dateFrom && noticeDate < new Date(`${dateFrom}T00:00:00`)) return false;
      if (dateTo && noticeDate > new Date(`${dateTo}T23:59:59.999`)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q) ||
          n.type.toLowerCase().includes(q) ||
          n.category.toLowerCase().includes(q) ||
          n.senderName.toLowerCase().includes(q) ||
          n.targeting.rooms.some((r) => r.toLowerCase().includes(q)) ||
          n.targeting.competitions.some((competition) => competition.toLowerCase().includes(q)) ||
          state.labels.some((label) => label.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [
    roleNotices,
    activeRole,
    activeUser,
    dateFrom,
    dateTo,
    filterPill,
    labelFilter,
    notificationStates,
    reminderTime,
    searchQuery,
  ]);

  const selectedNotice = useMemo(() => {
    const allowDeleted = filterPill === 'trash';
    if (selectedNoticeId) {
      const found = filteredNotices.find((n) => n.id === selectedNoticeId);
      if (found) return allowDeleted || !notificationStateFor(found).deleted ? found : null;
      const inRole = roleNotices.find((n) => n.id === selectedNoticeId);
      if (inRole) return allowDeleted || !notificationStateFor(inRole).deleted ? inRole : null;
    }
    const first = filteredNotices[0] ?? (allowDeleted ? null : roleNotices.find((n) => !notificationStateFor(n).deleted) ?? null);
    return first && (allowDeleted || !notificationStateFor(first).deleted) ? first : null;
  }, [filteredNotices, filterPill, roleNotices, selectedNoticeId, notificationStates]);

  const handleOpenNotice = (notice: Announcement) => {
    if (searchQuery.trim()) {
      recordSearchQuery(searchQuery);
    }
    finishReadSession();
    setSelectedNoticeId(notice.id);
    setMobileReaderOpen(true);
    const state = notificationStateFor(notice);
    setDraftResponse(state.draftResponse);
    setFollowUpDueAt(toLocalDateTimeValue(state.dueAt));
    onRecordNotificationView(notice.id);
    readSessionRef.current = {
      notificationId: notice.id,
      startedAt: Date.now(),
    };
    window.history.replaceState(
      null,
      '',
      `#notification=${encodeURIComponent(notice.id)}`
    );
    if (!isNotificationRead(notice)) {
      onToggleRead(notice.id, activeRole, true);
    }
  };

  useEffect(() => {
    const sharedId = new URLSearchParams(
      window.location.hash.replace(/^#/, '')
    ).get('notification');
    const sharedNotice = roleNotices.find((notice) => notice.id === sharedId);
    if (sharedNotice) handleOpenNotice(sharedNotice);
  }, []);

  const handleSelectRecentSearch = (query: string) => {
    setSearchQuery(query);
    recordSearchQuery(query);
    setIsSearchFocused(false);
    searchInputRef.current?.blur();
  };

  const handleRemoveRecentSearch = (queryToRemove: string) => {
    setRecentSearches((prev) => {
      const next = prev.filter((q) => q !== queryToRemove);
      saveRecentSearches(activeRole, next);
      return next;
    });
  };

  const handleClearRecentSearches = () => {
    setRecentSearches([]);
    saveRecentSearches(activeRole, []);
  };

  const flashFeedback = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => {
      setFeedback((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const flashPrefsSaved = () => {
    setPrefsSavedBanner(true);
    window.setTimeout(() => setPrefsSavedBanner(false), 2000);
  };

  const handleSnooze = (notice: Announcement) => {
    const now = new Date();
    let until: Date;
    if (customSnooze) {
      until = new Date(customSnooze);
    } else {
      switch (snoozeChoice) {
        case '1h':
          until = new Date(now.getTime() + 60 * 60 * 1000);
          break;
        case '3h':
          until = new Date(now.getTime() + 3 * 60 * 60 * 1000);
          break;
        case 'tomorrow':
          until = new Date(now);
          until.setDate(until.getDate() + 1);
          until.setHours(9, 0, 0, 0);
          break;
        case 'next-week':
          until = new Date(now);
          until.setDate(until.getDate() + 7);
          until.setHours(9, 0, 0, 0);
          break;
        default:
          flashFeedback('Choose a snooze duration.');
          return;
      }
    }
    if (Number.isNaN(until.getTime()) || until <= now) {
      flashFeedback('Choose a future reminder time.');
      return;
    }
    onUpdateNotificationAction(
      notice.id,
      { snoozedUntil: until.toISOString(), reminderNotifiedAt: null },
      'snoozed',
      until.toISOString()
    );
    setCustomSnooze('');
    flashFeedback(`Reminder set for ${formatDhakaDateTime(until.toISOString())}.`);
  };

  const handleCopyText = async (
    text: string,
    successMessage: string,
    noticeId?: string
  ) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard access is unavailable in this browser.');
      }
      await navigator.clipboard.writeText(text);
      if (noticeId) {
        onUpdateNotificationAction(noticeId, {}, 'copied');
      }
      flashFeedback(successMessage);
    } catch {
      flashFeedback('Could not access the clipboard. Check browser permissions.');
    }
  };

  const noticeContent = (notice: Announcement) =>
    `${notice.title}\n${notice.type} · ${notice.category}\nFrom: ${notice.senderName}\n${formatDhakaDateTime(notice.publishedAt || notice.createdAt)}\n\n${notice.body}`;

  const toggleMatrixCell = (
    type: NotificationType,
    channel: NotificationChannel
  ) => {
    const current = preferences.channelsByType[type]?.[channel] ?? false;
    onUpdatePreferences({
      ...preferences,
      channelsByType: {
        ...preferences.channelsByType,
        [type]: {
          ...preferences.channelsByType[type],
          [channel]: !current,
        },
      },
    });
    flashPrefsSaved();
  };

  const handleAttachmentDownload = (
    noticeId: string,
    attachment: Announcement['attachments'][number]
  ) => {
    onTrackClick(noticeId, attachment.id, 'download');
    if (!attachment.dataUrl) {
      flashFeedback(`Sample attachment download: ${attachment.fileName}`);
      return;
    }

    const link = document.createElement('a');
    link.href = attachment.dataUrl;
    link.download = attachment.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    flashFeedback(`Download started: ${attachment.fileName}`);
  };

  const handleAttachmentView = (
    noticeId: string,
    attachmentId: string,
    fileName: string
  ) => {
    onTrackClick(noticeId, attachmentId, 'view');
    flashFeedback(`Opened attachment: ${fileName}`);
  };

  const handleSimulatedActionLink = (noticeId: string, label: string) => {
    onTrackClick(noticeId);
    flashFeedback(
      `Opened action link "${label}" (click tracked in demo metrics)`
    );
  };

  const availableLabels = Array.from(
    new Set(Object.values(notificationStates).flatMap((state) => state.labels))
  ).sort((left, right) => left.localeCompare(right));
  const filterPills: { id: InboxFilterPill; label: string }[] = [
    { id: 'all', label: `All (${activeInboxCount})` },
    { id: 'unread', label: `Unread (${unreadCount})` },
    { id: 'starred', label: 'Starred' },
    { id: 'saved', label: 'Saved' },
    { id: 'pinned', label: 'Pinned' },
    { id: 'archived', label: 'Archived' },
    { id: 'snoozed', label: 'Snoozed' },
    { id: 'high-priority', label: 'High priority' },
    { id: 'emergency', label: 'Emergency alerts' },
    { id: 'my-department', label: 'My department' },
    { id: 'my-events', label: 'My events' },
    { id: 'recently-viewed', label: 'Recently viewed' },
    { id: 'frequently-accessed', label: 'Frequently accessed' },
    { id: 'schedule-rooms', label: 'Schedule & Rooms' },
    { id: 'competitions', label: 'Competitions' },
    { id: 'trash', label: `Trash (${trashedCount})` },
    { id: 'history', label: 'History' },
  ];

  const applyBulkAction = (
    patch: Partial<PersonalNotificationState>,
    action: NotificationActionName
  ) => {
    if (selectedNotificationIds.length === 0) return;
    onBulkUpdateNotifications(selectedNotificationIds, patch, action);
    setSelectedNotificationIds([]);
    flashFeedback(`Updated ${selectedNotificationIds.length} notifications.`);
  };

  const exportSelected = () => {
    const records = roleNotices
      .filter((notice) => selectedNotificationIds.includes(notice.id))
      .map((notice) => ({
        notice,
        personalStatus: notificationStateFor(notice),
      }));
    try {
      const file = new Blob([JSON.stringify(records, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'baust-notifications-export.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      onBulkUpdateNotifications(selectedNotificationIds, {}, 'exported');
      setSelectedNotificationIds([]);
      flashFeedback('Selected notifications exported.');
    } catch {
      flashFeedback('The notification export could not be created.');
    }
  };

  const toggleSelection = (notificationId: string) => {
    setSelectedNotificationIds((selected) =>
      selected.includes(notificationId)
        ? selected.filter((id) => id !== notificationId)
        : [...selected, notificationId]
    );
  };

  const handleAddLabel = (notice: Announcement) => {
    const label = labelDraft.trim().slice(0, 32);
    if (!label) return;
    const labels = notificationStateFor(notice).labels;
    if (labels.some((existing) => existing.toLowerCase() === label.toLowerCase())) {
      flashFeedback('That label is already assigned.');
      return;
    }
    onUpdateNotificationAction(
      notice.id,
      { labels: [...labels, label] },
      'label-added',
      label
    );
    setLabelDraft('');
  };

  const handleRemoveLabel = (notice: Announcement, label: string) => {
    onUpdateNotificationAction(
      notice.id,
      {
        labels: notificationStateFor(notice).labels.filter(
          (existing) => existing !== label
        ),
      },
      'label-removed',
      label
    );
  };

  const handleCopyNoticeContent = (notice: Announcement) =>
    handleCopyText(noticeContent(notice), 'Notice content copied.', notice.id);

  const handleCopyNoticeLink = (notice: Announcement) => {
    const link = `${window.location.origin}${window.location.pathname}#notification=${encodeURIComponent(notice.id)}`;
    void handleCopyText(link, 'Notification link copied.', notice.id);
  };

  const handleShareNotice = async (notice: Announcement) => {
    const text = noticeContent(notice);
    const url = `${window.location.origin}${window.location.pathname}#notification=${encodeURIComponent(notice.id)}`;
    try {
      if (!navigator.share) {
        await handleCopyText(`${text}\n\n${url}`, 'Notice details copied for sharing.', notice.id);
        return;
      }
      await navigator.share({ title: notice.title, text, url });
      onUpdateNotificationAction(notice.id, {}, 'shared');
      flashFeedback('Notice shared.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      flashFeedback('Could not share this notice from the current browser.');
    }
  };

  const handlePrintNotice = (notice: Announcement) => {
    onUpdateNotificationAction(notice.id, {}, 'printed');
    flashFeedback('Choose “Save as PDF” in the print dialog to download a PDF.');
    window.print();
  };

  const saveDraftResponse = (notice: Announcement) => {
    onUpdateNotificationAction(
      notice.id,
      { draftResponse },
      'response-draft-saved'
    );
    flashFeedback('Response draft saved on this device.');
  };

  const selectedNotificationState = selectedNotice
    ? notificationStateFor(selectedNotice)
    : null;

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #notification-print-content,
          #notification-print-content * { visibility: visible !important; }
          #notification-print-content {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 24px !important;
            border: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
            color: #111 !important;
          }
        }
      `}</style>
      {emergencyNotices.length > 0 && (
        <div
          role="region"
          aria-label="Active Emergency Alerts"
          className="rounded-xl border border-red-300 bg-red-600 p-3.5 text-white dark:border-red-700/80 dark:bg-red-700"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 shrink-0">
                <AlertTriangle
                  className="h-4 w-4 text-white"
                  aria-hidden="true"
                />
              </span>
              <div>
                <div className="text-[11px] font-bold tracking-wider text-red-100">
                  ACTIVE EMERGENCY ALERT ·{' '}
                  {emergencyNotices[0].targeting.rooms.join(', ') ||
                    'CAMPUS WIDE'}
                </div>
                <div className="mt-0.5 font-display text-sm font-bold text-white">
                  {emergencyNotices[0].title}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleOpenNotice(emergencyNotices[0])}
              className="inline-flex items-center justify-center rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 dark:bg-[#061D15] dark:text-red-200 dark:hover:bg-[#09291E] whitespace-nowrap shrink-0"
            >
              Read Protocol
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-emerald-200/70 bg-white p-4 dark:border-emerald-800/60 dark:bg-[#061D15]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-lg font-bold text-emerald-950 dark:text-emerald-50">
              {activeUser.fullName} · {activeRole} Inbox
            </h1>
            <p className="text-xs text-emerald-900/60 dark:text-emerald-300/65">
              {activeUser.affiliation} · Venue: {activeUser.assignedRoom}
              {approvalStatus === 'Pending'
                ? ' · Approval pending (showing public & participant notices)'
                : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={unreadCount === 0}
              onClick={() => onMarkAllRead(activeRole)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50/70 disabled:cursor-not-allowed disabled:opacity-45 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100 dark:hover:bg-[#09291E] whitespace-nowrap"
            >
              <CheckCheck
                className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              Mark all read ({unreadCount})
            </button>

            <button
              type="button"
              onClick={() => setPreferencesOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 whitespace-nowrap"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Preferences
            </button>
          </div>
        </div>

        <div className="space-y-3 border-t border-emerald-100 pt-3 dark:border-emerald-800/60">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-emerald-50/80 p-1 dark:border dark:border-emerald-800/50 dark:bg-[#041811]">
            {filterPills.map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setFilterPill(pill.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  filterPill === pill.id
                    ? 'bg-white text-emerald-950 shadow-sm dark:bg-[#0B2E22] dark:text-emerald-50'
                    : 'text-emerald-900/65 hover:text-emerald-950 dark:text-emerald-300/75 dark:hover:text-emerald-50'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="notification-date-from">From date</label>
          <input
            id="notification-date-from"
            type="date"
            aria-label="Filter from date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="min-h-9 rounded-lg border border-emerald-200/80 bg-white px-2 text-xs text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
          />
          <label className="sr-only" htmlFor="notification-date-to">To date</label>
          <input
            id="notification-date-to"
            type="date"
            aria-label="Filter to date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="min-h-9 rounded-lg border border-emerald-200/80 bg-white px-2 text-xs text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
          />
          {availableLabels.length > 0 && (
            <select
              aria-label="Filter by custom label"
              value={labelFilter}
              onChange={(event) => setLabelFilter(event.target.value)}
              className="min-h-9 max-w-36 rounded-lg border border-emerald-200/80 bg-white px-2 text-xs text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
            >
              <option value="">All labels</option>
              {availableLabels.map((label) => <option key={label} value={label}>{label}</option>)}
            </select>
          )}
          <div ref={searchContainerRef} className="relative min-w-0 flex-1 sm:flex-none">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-700/60 dark:text-emerald-400/60"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="text"
              role="combobox"
              aria-expanded={isSearchFocused}
              aria-controls="inbox-recent-searches"
              aria-autocomplete="list"
              value={searchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  recordSearchQuery(searchQuery);
                  setIsSearchFocused(false);
                } else if (e.key === 'Escape') {
                  setIsSearchFocused(false);
                  searchInputRef.current?.blur();
                }
              }}
              placeholder="Search notices or rooms (press /)"
              className={`w-full sm:w-72 rounded-lg border border-emerald-200/80 bg-emerald-50/35 py-1.5 pl-8 text-xs text-emerald-950 placeholder:text-emerald-900/45 focus:border-emerald-700 focus:bg-white focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:placeholder:text-emerald-400/45 dark:focus:border-emerald-400 dark:focus:bg-[#041811] ${
                searchQuery ? 'pr-7' : 'pr-3'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search query"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-emerald-700/60 hover:text-emerald-950 dark:text-emerald-400/70 dark:hover:text-emerald-50"
              >
                <X className="h-3 w-3" />
              </button>
            )}

            {isSearchFocused && (
              <div
                id="inbox-recent-searches"
                role="listbox"
                aria-label="Recent searches"
                className="absolute left-0 right-0 sm:left-auto sm:right-0 sm:w-72 top-full z-30 mt-1.5 rounded-xl border border-emerald-200 bg-white shadow-lg overflow-hidden dark:border-emerald-800/70 dark:bg-[#061D15]"
              >
                <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50/60 px-3 py-2 dark:border-emerald-800/60 dark:bg-[#041811]">
                  <span className="text-[11px] font-semibold text-emerald-900/75 dark:text-emerald-200/80">
                    Recent Searches
                  </span>
                  {recentSearches.length > 0 && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleClearRecentSearches}
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-950 dark:text-emerald-400 dark:hover:text-emerald-200"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {recentSearches.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-emerald-900/60 dark:text-emerald-300/65">
                    No recent searches yet. Type a keyword or press Enter to save.
                  </div>
                ) : (
                  <ul className="divide-y divide-emerald-100 py-1 dark:divide-emerald-800/50">
                    {recentSearches.map((query) => (
                      <li
                        key={query}
                        className="flex items-center justify-between gap-2 px-2 py-1 hover:bg-emerald-50/50 dark:hover:bg-[#09291E]"
                      >
                        <button
                          type="button"
                          role="option"
                          aria-selected={
                            searchQuery.toLowerCase() === query.toLowerCase()
                          }
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelectRecentSearch(query)}
                          className="flex flex-1 items-center gap-2 rounded px-1.5 py-1 text-left text-xs text-emerald-950 dark:text-emerald-50 min-w-0"
                        >
                          <Clock
                            className="h-3.5 w-3.5 text-emerald-700/60 dark:text-emerald-400/60 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="truncate font-medium">{query}</span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove "${query}" from recent searches`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleRemoveRecentSearch(query)}
                          className="rounded p-1 text-emerald-700/60 hover:bg-emerald-100 hover:text-emerald-950 dark:text-emerald-400/70 dark:hover:bg-emerald-900/60 dark:hover:text-emerald-50 shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          </div>
        </div>

        {selectedNotificationIds.length > 0 && (
          <div
            role="toolbar"
            aria-label="Bulk notification actions"
            className="flex flex-wrap items-center gap-2 border-t border-emerald-100 pt-3 dark:border-emerald-800/60"
          >
            <span className="mr-1 text-xs font-semibold text-emerald-950 dark:text-emerald-100">
              {selectedNotificationIds.length} selected
            </span>
            <button type="button" onClick={() => applyBulkAction({ read: false }, 'unread')} className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-100">Mark unread</button>
            <button type="button" onClick={() => applyBulkAction({ starred: true }, 'starred')} className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-100">Star selected</button>
            <button type="button" onClick={() => applyBulkAction({ saved: true }, 'saved')} className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-100">Save selected</button>
            {filterPill === 'trash' ? (
              <button
                type="button"
                onClick={() => applyBulkAction({ deleted: false }, 'restored')}
                className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-200"
              >
                Restore selected
              </button>
            ) : (
              <>
                <button type="button" onClick={() => applyBulkAction({ archived: true }, 'archived')} className="rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-100">Archive selected</button>
                <button type="button" onClick={() => applyBulkAction({ deleted: true }, 'deleted')} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/70 dark:text-red-300">Move to Trash</button>
              </>
            )}
            <button type="button" onClick={exportSelected} className="rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 dark:bg-emerald-600">Export selected</button>
            <button type="button" onClick={() => setSelectedNotificationIds([])} className="ml-auto rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:text-emerald-300 dark:hover:bg-emerald-950/50">Clear</button>
          </div>
        )}
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-200"
        >
          {feedback}
        </div>
      )}

      {filterPill === 'history' && (
        <section className="rounded-xl border border-emerald-200/70 bg-white p-4 dark:border-emerald-800/60 dark:bg-[#061D15]">
          <h2 className="flex items-center gap-2 font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
            <History className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            Notification history
          </h2>
          {notificationEvents.length ? (
            <ol className="mt-3 divide-y divide-emerald-100 dark:divide-emerald-900/60">
              {notificationEvents.slice(0, 100).map((event) => {
                const notice = roleNotices.find((item) => item.id === event.notificationId);
                return (
                  <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
                    <span className="font-medium text-emerald-950 dark:text-emerald-100">
                      {notice?.title ?? event.notificationId}
                      <span className="ml-2 text-emerald-700 dark:text-emerald-300">{event.action.replace(/-/g, ' ')}</span>
                      {event.detail && <span className="ml-2 text-slate-500 dark:text-emerald-200/60">{event.detail}</span>}
                    </span>
                    <time className="text-slate-500 dark:text-emerald-200/60">{formatDhakaDateTime(event.occurredAt)}</time>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-3 text-xs text-slate-500 dark:text-emerald-200/60">Your notification actions will appear here.</p>
          )}
        </section>
      )}

      <div className={`grid grid-cols-1 items-start gap-5 lg:grid-cols-12 ${filterPill === 'history' ? 'hidden' : ''}`}>
        <div
          className={`space-y-2.5 lg:col-span-5 ${
            mobileReaderOpen ? 'hidden lg:block' : 'block'
          }`}
        >
          {filteredNotices.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No notices in this view"
              description="Try switching category pills or clearing your search query."
              actionLabel="Reset Filters"
              onAction={() => {
                setFilterPill('all');
                setSearchQuery('');
              }}
            />
          ) : (
            filteredNotices.map((notice) => {
              const status = notificationStateFor(notice);
              const isRead = status.read;
              const isSelected = selectedNotice?.id === notice.id;
              const isEmergency = notice.priority === 'Emergency';

              return (
                <div
                  key={notice.id}
                  onClick={() => {
                    if (suppressNextClickRef.current) {
                      suppressNextClickRef.current = false;
                      return;
                    }
                    handleOpenNotice(notice);
                  }}
                  onTouchStart={(event) => {
                    touchStartXRef.current =
                      event.changedTouches[0]?.clientX ?? null;
                  }}
                  onTouchEnd={(event) => {
                    const startX = touchStartXRef.current;
                    const endX = event.changedTouches[0]?.clientX;
                    touchStartXRef.current = null;
                    if (startX === null || endX === undefined) return;
                    const delta = endX - startX;
                    if (Math.abs(delta) < 70) return;
                    suppressNextClickRef.current = true;
                    window.setTimeout(() => {
                      suppressNextClickRef.current = false;
                    }, 500);
                    if (delta > 0) {
                      onUpdateNotificationAction(
                        notice.id,
                        { saved: true },
                        'saved'
                      );
                      flashFeedback('Notification saved for later.');
                    } else if (delta < -170) {
                      onUpdateNotificationAction(
                        notice.id,
                        { deleted: true },
                        'deleted'
                      );
                      flashFeedback('Notification deleted.');
                    } else if (delta < -115) {
                      onUpdateNotificationAction(
                        notice.id,
                        { archived: true },
                        'archived'
                      );
                      flashFeedback('Notification archived.');
                    } else {
                      onToggleRead(notice.id, activeRole, !isRead);
                    }
                  }}
                  className={`group cursor-pointer rounded-xl border p-3.5 transition-colors ${
                    isSelected
                      ? 'border-emerald-700 bg-emerald-50/45 dark:border-emerald-400 dark:bg-[#0B2E22]'
                      : isEmergency
                        ? 'border-red-300 bg-red-50/70 hover:bg-red-50 dark:border-red-800/70 dark:bg-red-950/35 dark:hover:bg-red-950/50'
                        : !isRead
                          ? 'border-emerald-400 bg-white hover:bg-emerald-50/25 dark:border-emerald-600/80 dark:bg-[#061D15] dark:hover:bg-[#09291E]'
                          : 'border-emerald-200/70 bg-white hover:bg-emerald-50/35 dark:border-emerald-800/60 dark:bg-[#061D15] dark:hover:bg-[#09291E]/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <PriorityBadge priority={notice.priority} />
                        {status.starred && (
                          <span className="font-semibold text-amber-700 dark:text-amber-300">Starred</span>
                        )}
                        {status.saved && (
                          <span className="font-semibold text-sky-700 dark:text-sky-300">Saved</span>
                        )}
                        {status.pinned && (
                          <span className="font-semibold text-violet-700 dark:text-violet-300">Pinned</span>
                        )}
                        {status.followUp && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">Action required</span>
                        )}
                        {!isRead && (
                          <>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              Unread
                            </span>
                            <span className="text-emerald-300 dark:text-emerald-700" aria-hidden="true">
                              ·
                            </span>
                          </>
                        )}
                        <span className="text-emerald-900/65 dark:text-emerald-200/75">{notice.type}</span>
                        <span className="text-emerald-300 dark:text-emerald-700" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-mono text-[11px] text-emerald-900/60 dark:text-emerald-300/65 tabular-nums">
                          {formatDhakaTimeOnly(
                            notice.publishedAt || notice.createdAt
                          )}
                        </span>
                      </div>

                      <h2
                        className={`mt-1.5 font-display text-sm leading-snug ${
                          !isRead
                            ? 'font-bold text-emerald-950 dark:text-emerald-50'
                            : 'font-semibold text-emerald-950/85 dark:text-emerald-100/90'
                        }`}
                      >
                        {notice.title}
                      </h2>

                      <p className="mt-1 text-xs text-emerald-900/65 dark:text-emerald-200/70 line-clamp-2">
                        {notice.summary}
                      </p>

                      {(notice.targeting.rooms.length > 0 ||
                        getAttachmentsForChannel(notice, 'In-App').length > 0) && (
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                          {notice.targeting.rooms.length > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin
                                className="h-3 w-3 text-emerald-700/60 dark:text-emerald-400/70"
                                aria-hidden="true"
                              />
                              {notice.targeting.rooms[0]}
                            </span>
                          )}
                          {getAttachmentsForChannel(notice, 'In-App').length > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Paperclip
                                className="h-3 w-3 text-emerald-700/60 dark:text-emerald-400/70"
                                aria-hidden="true"
                              />
                              {getAttachmentsForChannel(notice, 'In-App').length} attachment
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleRead(notice.id, activeRole, !isRead);
                      }}
                      title={isRead ? 'Mark as unread' : 'Mark as read'}
                      aria-label={
                        isRead
                          ? `Mark "${notice.title}" as unread`
                          : `Mark "${notice.title}" as read`
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200/80 bg-white text-emerald-900/70 hover:bg-emerald-50 hover:text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-300/75 dark:hover:bg-[#09291E] dark:hover:text-emerald-50 shrink-0"
                    >
                      {isRead ? (
                        <MailOpen className="h-3.5 w-3.5" />
                      ) : (
                        <Mail className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-emerald-100/80 pt-2 dark:border-emerald-900/60">
                    <label
                      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:text-emerald-200/70 dark:hover:bg-emerald-950/50"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedNotificationIds.includes(notice.id)}
                        onChange={() => toggleSelection(notice.id)}
                        aria-label={`Select ${notice.title}`}
                        className="accent-emerald-700"
                      />
                      Select
                    </label>
                    <button
                      type="button"
                      aria-label={status.starred ? `Unstar ${notice.title}` : `Star ${notice.title}`}
                      aria-pressed={status.starred}
                      title={status.starred ? 'Unstar' : 'Star'}
                      onClick={(event) => {
                        event.stopPropagation();
                        const next = !status.starred;
                        onUpdateNotificationAction(
                          notice.id,
                          { starred: next },
                          next ? 'starred' : 'unstarred'
                        );
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
                    >
                      <Star className={`h-4 w-4 ${status.starred ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      type="button"
                      aria-label={status.saved ? `Remove ${notice.title} from saved` : `Save ${notice.title} for later`}
                      aria-pressed={status.saved}
                      title={status.saved ? 'Remove from saved' : 'Save for later'}
                      onClick={(event) => {
                        event.stopPropagation();
                        const next = !status.saved;
                        onUpdateNotificationAction(
                          notice.id,
                          { saved: next },
                          next ? 'saved' : 'unsaved'
                        );
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/40"
                    >
                      <Bookmark className={`h-4 w-4 ${status.saved ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      type="button"
                      aria-label={status.pinned ? `Unpin ${notice.title}` : `Pin ${notice.title}`}
                      aria-pressed={status.pinned}
                      title={status.pinned ? 'Unpin' : 'Pin'}
                      onClick={(event) => {
                        event.stopPropagation();
                        const next = !status.pinned;
                        onUpdateNotificationAction(
                          notice.id,
                          { pinned: next },
                          next ? 'pinned' : 'unpinned'
                        );
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40"
                    >
                      <Pin className={`h-4 w-4 ${status.pinned ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      type="button"
                      aria-label={status.archived ? `Restore ${notice.title} from archive` : `Archive ${notice.title}`}
                      title={status.archived ? 'Restore from archive' : 'Archive'}
                      onClick={(event) => {
                        event.stopPropagation();
                        const next = !status.archived;
                        onUpdateNotificationAction(
                          notice.id,
                          { archived: next },
                          next ? 'archived' : 'unarchived'
                        );
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                    {status.deleted ? (
                      <button
                        type="button"
                        aria-label={`Restore ${notice.title} from trash`}
                        title="Restore from Trash"
                        onClick={(event) => {
                          event.stopPropagation();
                          onUpdateNotificationAction(
                            notice.id,
                            { deleted: false },
                            'restored'
                          );
                          flashFeedback('Notification restored to inbox.');
                        }}
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Move ${notice.title} to trash`}
                        title="Move to Trash"
                        onClick={(event) => {
                          event.stopPropagation();
                          onUpdateNotificationAction(
                            notice.id,
                            { deleted: true },
                            'deleted'
                          );
                          flashFeedback('Notification moved to trash.');
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={`Snooze ${notice.title} for one hour`}
                      title="Snooze for 1 hour"
                      onClick={(event) => {
                        event.stopPropagation();
                        const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
                        onUpdateNotificationAction(
                          notice.id,
                          { snoozedUntil: until, reminderNotifiedAt: null },
                          'snoozed',
                          until
                        );
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
                    >
                      <Clock className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <aside
          id="notification-print-content"
          className={`rounded-xl border border-emerald-200/70 bg-white p-4 sm:p-5 lg:sticky lg:top-4 lg:col-span-7 dark:border-emerald-800/60 dark:bg-[#061D15] ${
            mobileReaderOpen ? 'block' : 'hidden lg:block'
          }`}
        >
          {selectedNotice ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-emerald-100 pb-3 dark:border-emerald-800/60">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      finishReadSession();
                      setMobileReaderOpen(false);
                      window.history.replaceState(
                        null,
                        '',
                        `${window.location.pathname}${window.location.search}`
                      );
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-[#09291E] lg:hidden"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    Back
                  </button>
                  <PriorityBadge priority={selectedNotice.priority} />
                  <span className="text-xs font-medium text-emerald-900/65 dark:text-emerald-200/75">
                    {selectedNotice.type}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => void handleCopyNoticeContent(selectedNotice)}
                  aria-label="Copy notice content"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-50/70 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100 dark:hover:bg-[#09291E] whitespace-nowrap"
                >
                  <Copy className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                  Copy content
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-b border-emerald-100 pb-3 dark:border-emerald-800/60">
                <button
                  type="button"
                  aria-label={selectedNotificationState?.starred ? 'Unstar notification' : 'Star notification'}
                  aria-pressed={selectedNotificationState?.starred}
                  onClick={() => {
                    if (!selectedNotificationState) return;
                    const next = !selectedNotificationState.starred;
                    onUpdateNotificationAction(
                      selectedNotice.id,
                      { starred: next },
                      next ? 'starred' : 'unstarred'
                    );
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 px-2.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 dark:border-amber-900/70 dark:text-amber-200 dark:hover:bg-amber-950/40"
                >
                  <Star className={`h-3.5 w-3.5 ${selectedNotificationState?.starred ? 'fill-current' : ''}`} />
                  {selectedNotificationState?.starred ? 'Starred' : 'Star'}
                </button>
                <button
                  type="button"
                  aria-label={selectedNotificationState?.saved ? 'Unsave notification' : 'Save notification for later'}
                  aria-pressed={selectedNotificationState?.saved}
                  onClick={() => {
                    if (!selectedNotificationState) return;
                    const next = !selectedNotificationState.saved;
                    onUpdateNotificationAction(
                      selectedNotice.id,
                      { saved: next },
                      next ? 'saved' : 'unsaved'
                    );
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-sky-200 px-2.5 text-xs font-semibold text-sky-800 hover:bg-sky-50 dark:border-sky-900/70 dark:text-sky-200 dark:hover:bg-sky-950/40"
                >
                  <Bookmark className={`h-3.5 w-3.5 ${selectedNotificationState?.saved ? 'fill-current' : ''}`} />
                  {selectedNotificationState?.saved ? 'Saved' : 'Save'}
                </button>
                <button
                  type="button"
                  aria-label={selectedNotificationState?.pinned ? 'Unpin notification' : 'Pin notification'}
                  aria-pressed={selectedNotificationState?.pinned}
                  onClick={() => {
                    if (!selectedNotificationState) return;
                    const next = !selectedNotificationState.pinned;
                    onUpdateNotificationAction(
                      selectedNotice.id,
                      { pinned: next },
                      next ? 'pinned' : 'unpinned'
                    );
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet-200 px-2.5 text-xs font-semibold text-violet-800 hover:bg-violet-50 dark:border-violet-900/70 dark:text-violet-200 dark:hover:bg-violet-950/40"
                >
                  <Pin className="h-3.5 w-3.5" />
                  {selectedNotificationState?.pinned ? 'Pinned' : 'Pin'}
                </button>
                <button
                  type="button"
                  aria-label={selectedNotificationState?.archived ? 'Restore notification from archive' : 'Archive notification'}
                  onClick={() => {
                    if (!selectedNotificationState) return;
                    const next = !selectedNotificationState.archived;
                    onUpdateNotificationAction(
                      selectedNotice.id,
                      { archived: next },
                      next ? 'archived' : 'unarchived'
                    );
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 px-2.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-emerald-950/40"
                >
                  <Archive className="h-3.5 w-3.5" />
                  {selectedNotificationState?.archived ? 'Restore' : 'Archive'}
                </button>
                {selectedNotificationState?.deleted ? (
                  <button
                    type="button"
                    aria-label="Restore notification from trash"
                    onClick={() => {
                      onUpdateNotificationAction(
                        selectedNotice.id,
                        { deleted: false },
                        'restored'
                      );
                      flashFeedback('Notification restored to inbox.');
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore to Inbox
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="Move notification to trash"
                    onClick={() => {
                      onUpdateNotificationAction(
                        selectedNotice.id,
                        { deleted: true },
                        'deleted'
                      );
                      flashFeedback('Notification moved to trash.');
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/70 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Trash
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Copy notification link"
                  onClick={() => handleCopyNoticeLink(selectedNotice)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-emerald-900/70 dark:text-emerald-100 dark:hover:bg-emerald-950/40"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy link
                </button>
                <button
                  type="button"
                  aria-label="Share notification"
                  onClick={() => void handleShareNotice(selectedNotice)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-emerald-900/70 dark:text-emerald-100 dark:hover:bg-emerald-950/40"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </button>
                <button
                  type="button"
                  aria-label="Print or save notification as PDF"
                  onClick={() => handlePrintNotice(selectedNotice)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-emerald-900/70 dark:text-emerald-100 dark:hover:bg-emerald-950/40"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print
                </button>
                <button
                  type="button"
                  aria-label="Download notification as PDF"
                  onClick={() => handlePrintNotice(selectedNotice)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-emerald-900/70 dark:text-emerald-100 dark:hover:bg-emerald-950/40"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Save as PDF
                </button>
              </div>

              <h3 className="mt-3 font-display text-lg font-bold text-emerald-950 dark:text-emerald-50 leading-snug">
                {selectedNotice.title}
              </h3>

              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-emerald-900/60 dark:text-emerald-300/65">
                <span>
                  From{' '}
                  <strong className="text-emerald-950 dark:text-emerald-100">
                    {selectedNotice.senderName}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {formatDhakaDateTime(
                    selectedNotice.publishedAt || selectedNotice.createdAt
                  )}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-emerald-200/60">
                <span>Views: {selectedNotificationState?.viewCount ?? 0}</span>
                <span>Read time: {selectedNotificationState?.readTimeSeconds ?? 0}s</span>
                <span>
                  Last opened:{' '}
                  {selectedNotificationState?.lastOpenedAt
                    ? formatDhakaDateTime(selectedNotificationState.lastOpenedAt)
                    : 'Not viewed'}
                </span>
              </div>

              <div className="mt-4 rounded-lg bg-emerald-50/40 p-4 text-sm leading-relaxed text-emerald-950 dark:bg-[#041811] dark:text-emerald-100 whitespace-pre-line">
                {selectedNotice.body}
              </div>

              <div className="mt-4 rounded-lg border border-emerald-100 p-3 dark:border-emerald-900/60">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                  <Tag className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                  Personal labels
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {selectedNotificationState?.labels.map((label) => (
                    <span key={label} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100">
                      {label}
                      <button
                        type="button"
                        aria-label={`Remove label ${label}`}
                        onClick={() => handleRemoveLabel(selectedNotice, label)}
                        className="rounded-full text-emerald-700 hover:text-red-700 dark:text-emerald-300 dark:hover:text-red-300"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <form
                    className="flex min-w-0 flex-1 items-center gap-1.5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleAddLabel(selectedNotice);
                    }}
                  >
                    <input
                      value={labelDraft}
                      onChange={(event) => setLabelDraft(event.target.value)}
                      maxLength={32}
                      aria-label="Add custom notification label"
                      placeholder="Add a label"
                      className="min-h-8 min-w-0 flex-1 rounded-md border border-emerald-200 px-2 text-xs dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                    />
                    <button type="submit" className="rounded-md bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 dark:bg-emerald-600">Add</button>
                  </form>
                </div>
              </div>

              <div className="mt-3 grid gap-3 rounded-lg border border-emerald-100 p-3 sm:grid-cols-2 dark:border-emerald-900/60">
                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedNotificationState?.followUp)}
                      onChange={(event) => {
                        const followUp = event.target.checked;
                        onUpdateNotificationAction(
                          selectedNotice.id,
                          {
                            followUp,
                            dueAt: followUp ? (followUpDueAt ? new Date(followUpDueAt).toISOString() : null) : null,
                          },
                          followUp ? 'follow-up-set' : 'follow-up-cleared'
                        );
                      }}
                      className="accent-emerald-700"
                    />
                    Flag for follow-up
                  </label>
                  <label className="mt-2 block text-[11px] font-medium text-slate-600 dark:text-emerald-200/65">
                    Due date
                    <input
                      type="datetime-local"
                      value={followUpDueAt}
                      onChange={(event) => setFollowUpDueAt(event.target.value)}
                      onBlur={() => {
                        if (!selectedNotificationState?.followUp || !followUpDueAt) return;
                        onUpdateNotificationAction(
                          selectedNotice.id,
                          { dueAt: new Date(followUpDueAt).toISOString() },
                          'follow-up-set',
                          followUpDueAt
                        );
                      }}
                      className="mt-1 block min-h-8 w-full rounded-md border border-emerald-200 px-2 text-xs dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                    />
                  </label>
                  {selectedNotificationState?.dueAt && (
                    <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
                      Due {formatDhakaDateTime(selectedNotificationState.dueAt)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                    Snooze reminder
                    <select
                      value={snoozeChoice}
                      onChange={(event) => setSnoozeChoice(event.target.value)}
                      className="mt-1 block min-h-8 w-full rounded-md border border-emerald-200 px-2 text-xs font-normal dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                    >
                      <option value="1h">1 hour</option>
                      <option value="3h">3 hours</option>
                      <option value="tomorrow">Tomorrow at 9:00 AM</option>
                      <option value="next-week">Next week</option>
                      <option value="custom">Custom date &amp; time</option>
                    </select>
                  </label>
                  {snoozeChoice === 'custom' && (
                    <input
                      type="datetime-local"
                      aria-label="Custom snooze date and time"
                      value={customSnooze}
                      onChange={(event) => setCustomSnooze(event.target.value)}
                      className="mt-2 block min-h-8 w-full rounded-md border border-emerald-200 px-2 text-xs dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                    />
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => handleSnooze(selectedNotice)} className="rounded-md bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 dark:bg-emerald-600">Set reminder</button>
                    {selectedNotificationState?.snoozedUntil && (
                      <>
                        <span className="text-[10px] text-slate-500 dark:text-emerald-200/60">
                          Until {formatDhakaDateTime(selectedNotificationState.snoozedUntil)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateNotificationAction(
                            selectedNotice.id,
                            { snoozedUntil: null, reminderNotifiedAt: null },
                            'unsnoozed'
                          )}
                          className="text-xs font-semibold text-red-700 dark:text-red-300"
                        >
                          Clear
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-emerald-100 p-3 dark:border-emerald-900/60">
                <label className="block text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                  Draft response
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={draftResponse}
                    onChange={(event) => setDraftResponse(event.target.value)}
                    placeholder="Keep a private response draft for this notice."
                    className="mt-1.5 block w-full resize-y rounded-md border border-emerald-200 bg-white p-2 text-xs font-normal dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                  />
                </label>
                <button type="button" onClick={() => saveDraftResponse(selectedNotice)} className="mt-2 rounded-md border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-emerald-950/40">Save draft</button>
              </div>

              <div className="mt-4 space-y-2 text-xs">
                {selectedNotice.targeting.rooms.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Building2 className="mt-0.5 h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <div>
                      <span className="font-semibold text-emerald-950 dark:text-emerald-100">
                        Rooms:{' '}
                      </span>
                      <span className="text-emerald-900/70 dark:text-emerald-200/80">
                        {selectedNotice.targeting.rooms.join(', ')}
                      </span>
                    </div>
                  </div>
                )}

                {selectedNotice.targeting.competitions.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Trophy className="mt-0.5 h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <div>
                      <span className="font-semibold text-emerald-950 dark:text-emerald-100">
                        Competitions:{' '}
                      </span>
                      <span className="text-emerald-900/70 dark:text-emerald-200/80">
                        {selectedNotice.targeting.competitions.join(', ')}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="font-semibold text-emerald-950 dark:text-emerald-100 mr-1">
                    Channels:
                  </span>
                  {selectedNotice.channels.map((ch) => (
                    <ChannelPill key={ch} channel={ch} compact />
                  ))}
                </div>
              </div>

              {getAttachmentsForChannel(selectedNotice, 'In-App').length > 0 && (
                <div className="mt-4 border-t border-emerald-100 pt-3 dark:border-emerald-800/60">
                  <div className="text-xs font-semibold text-emerald-950 dark:text-emerald-100 mb-2">
                    Attachments
                  </div>
                  <div className="space-y-1.5">
                    {getAttachmentsForChannel(selectedNotice, 'In-App').map((att) => (
                      <div
                        key={att.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200/80 bg-emerald-50/45 px-3 py-2 text-xs dark:border-emerald-800/70 dark:bg-[#041811]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Paperclip className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                          <span className="font-semibold text-emerald-950 dark:text-emerald-50 truncate">
                            {att.fileName}
                          </span>
                          <span className="text-emerald-900/60 dark:text-emerald-300/65 shrink-0">
                            {att.fileSizeLabel}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {att.dataUrl && (
                            <a
                              href={att.dataUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => handleAttachmentView(selectedNotice.id, att.id, att.fileName)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleAttachmentDownload(selectedNotice.id, att)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-100 pt-3 dark:border-emerald-800/60">
                <button
                  type="button"
                  onClick={() =>
                    onToggleRead(
                      selectedNotice.id,
                      activeRole,
                      !isNotificationRead(selectedNotice)
                    )
                  }
                  className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50/70 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100 dark:hover:bg-[#09291E]"
                >
                  {isNotificationRead(selectedNotice)
                    ? 'Mark as Unread'
                    : 'Mark as Read'}
                </button>

                {selectedNotice.actionLabel && (
                  <button
                    type="button"
                    onClick={() =>
                      handleSimulatedActionLink(
                        selectedNotice.id,
                        selectedNotice.actionLabel || 'Open'
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#064E3B] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#053D2E] dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  >
                    {selectedNotice.actionLabel}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>

              {notificationEvents.some(
                (event) => event.notificationId === selectedNotice.id
              ) && (
                <section className="mt-4 border-t border-emerald-100 pt-3 dark:border-emerald-800/60">
                  <h4 className="flex items-center gap-2 text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                    <History className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                    Interaction history
                  </h4>
                  <ol className="mt-2 space-y-1.5">
                    {notificationEvents
                      .filter((event) => event.notificationId === selectedNotice.id)
                      .sort(
                        (a, b) =>
                          Date.parse(b.occurredAt) - Date.parse(a.occurredAt)
                      )
                      .slice(0, 5)
                      .map((event) => (
                        <li key={event.id} className="flex flex-wrap justify-between gap-2 text-[10px] text-slate-500 dark:text-emerald-200/60">
                          <span className="capitalize">{event.action.replace(/-/g, ' ')}{event.detail ? ` · ${event.detail}` : ''}</span>
                          <time className="font-mono tabular-nums">{formatDhakaDateTime(event.occurredAt)}</time>
                        </li>
                      ))}
                  </ol>
                </section>
              )}
            </>
          ) : (
            <EmptyState
              icon={Inbox}
              title="No notice selected"
              description="Select any announcement on the left to read full instructions, room context, and attachments."
            />
          )}
        </aside>
      </div>

      {/* Slide-over Preferences Drawer */}
      {preferencesOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-[#02160F]/55 dark:bg-black/70"
            onClick={() => setPreferencesOpen(false)}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Notification Preferences Drawer"
            className="relative z-10 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-[#061D15] dark:border-l dark:border-emerald-800/60"
          >
            <div className="flex items-center justify-between border-b border-emerald-900/60 bg-[#042419] px-5 py-4 text-white dark:bg-[#031A12] dark:border-emerald-800/60">
              <div>
                <h2 className="font-display text-base font-bold">
                  Notification Preferences ({activeRole})
                </h2>
                <p className="text-[11px] text-emerald-100/75">
                  {activeUser.fullName} · {activeUser.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreferencesOpen(false)}
                aria-label="Close preferences drawer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-emerald-100/75 hover:bg-emerald-900/50 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="flex items-center justify-between gap-2">
                {prefsSavedBanner ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <Check className="h-3.5 w-3.5" />
                    Preferences saved
                  </span>
                ) : (
                  <span className="text-xs text-emerald-900/60 dark:text-emerald-300/65">
                    Changes take effect immediately
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onResetPreferences();
                    flashPrefsSaved();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50/70 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100 dark:hover:bg-[#09291E]"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  Reset Defaults
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-200/70 p-4 dark:border-emerald-800/60 dark:bg-[#041811]">
                  <div className="flex items-start gap-3">
                    <BellRing className="mt-0.5 h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-emerald-950 dark:text-emerald-50">
                        Browser &amp; Device Push Alerts
                      </div>
                      <p className="text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                        Instant room updates, competition countdowns, and lunch alerts.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={preferences.browserPushEnabled}
                    onClick={() => {
                      onUpdatePreferences({
                        ...preferences,
                        browserPushEnabled: !preferences.browserPushEnabled,
                      });
                      flashPrefsSaved();
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      preferences.browserPushEnabled
                        ? 'bg-emerald-700 dark:bg-emerald-500'
                        : 'bg-emerald-200 dark:bg-emerald-900'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        preferences.browserPushEnabled
                          ? 'translate-x-5'
                          : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="rounded-xl border border-emerald-200/70 p-4 space-y-3 dark:border-emerald-800/60 dark:bg-[#041811]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Moon className="mt-0.5 h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-emerald-950 dark:text-emerald-50">
                          Quiet Hours (GMT+6)
                        </div>
                        <p className="text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                          Mute non-urgent SMS/Push overnight. Emergency Alerts always bypass.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={preferences.quietHoursEnabled}
                      onClick={() => {
                        onUpdatePreferences({
                          ...preferences,
                          quietHoursEnabled: !preferences.quietHoursEnabled,
                        });
                        flashPrefsSaved();
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        preferences.quietHoursEnabled
                          ? 'bg-emerald-700 dark:bg-emerald-500'
                          : 'bg-emerald-200 dark:bg-emerald-900'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          preferences.quietHoursEnabled
                            ? 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5 text-emerald-900/75 dark:text-emerald-200/80">
                      From
                      <input
                        type="time"
                        disabled={!preferences.quietHoursEnabled}
                        value={preferences.quietHoursStart}
                        onChange={(e) => {
                          onUpdatePreferences({
                            ...preferences,
                            quietHoursStart: e.target.value,
                          });
                          flashPrefsSaved();
                        }}
                        className="rounded border border-emerald-200 px-2 py-1 font-mono text-xs text-emerald-950 focus:border-emerald-700 focus:outline-none disabled:opacity-50 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-50 dark:focus:border-emerald-400"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-emerald-900/75 dark:text-emerald-200/80">
                      To
                      <input
                        type="time"
                        disabled={!preferences.quietHoursEnabled}
                        value={preferences.quietHoursEnd}
                        onChange={(e) => {
                          onUpdatePreferences({
                            ...preferences,
                            quietHoursEnd: e.target.value,
                          });
                          flashPrefsSaved();
                        }}
                        className="rounded border border-emerald-200 px-2 py-1 font-mono text-xs text-emerald-950 focus:border-emerald-700 focus:outline-none disabled:opacity-50 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-50 dark:focus:border-emerald-400"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200/70 overflow-hidden dark:border-emerald-800/60">
                <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50/50 px-4 py-3 dark:border-emerald-800/60 dark:bg-[#041811]">
                  <span className="text-xs font-bold text-emerald-950 dark:text-emerald-50">
                    Channel Matrix by Category
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 dark:text-red-400">
                    <ShieldAlert className="h-3 w-3" />
                    Emergency locked
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-emerald-100 bg-white text-[11px] font-semibold text-emerald-900/65 dark:border-emerald-800/60 dark:bg-[#061D15] dark:text-emerald-300/75">
                        <th className="px-3 py-2.5">Category</th>
                        {ALL_CHANNELS.map((ch) => (
                          <th key={ch} className="px-2 py-2.5 text-center">
                            {ch === 'Push Notification'
                              ? 'Push'
                              : ch === 'Web Notification'
                                ? 'Web'
                                : ch}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100 dark:divide-emerald-800/50">
                      {ALL_NOTIFICATION_TYPES.map((type) => {
                        const isEmergency = type === 'Emergency Alert';
                        return (
                          <tr key={type} className="hover:bg-emerald-50/40 dark:hover:bg-[#09291E]/70">
                            <td className="px-3 py-2.5 font-semibold text-emerald-950 dark:text-emerald-100 whitespace-nowrap">
                              {type}
                            </td>
                            {ALL_CHANNELS.map((ch) => {
                              const checked =
                                preferences.channelsByType[type]?.[ch] ?? false;
                              const locked =
                                isEmergency && (ch === 'In-App' || ch === 'SMS');
                              return (
                                <td key={ch} className="px-2 py-2.5 text-center">
                                  <input
                                    type="checkbox"
                                    aria-label={`${type} via ${ch}`}
                                    checked={locked ? true : checked}
                                    disabled={locked}
                                    onChange={() => toggleMatrixCell(type, ch)}
                                    className="h-4 w-4 cursor-pointer accent-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Quick Actions Floating Menu */}
      <div
        ref={quickMenuRef}
        className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2.5"
      >
        {quickMenuOpen && (
          <div
            role="menu"
            aria-label="Quick Actions Menu"
            className="w-56 rounded-xl border border-emerald-200 bg-white p-1.5 shadow-xl dark:border-emerald-800/70 dark:bg-[#061D15]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setQuickMenuOpen(false);
                setActiveQuickModal('incident');
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-emerald-950 hover:bg-red-50 hover:text-red-800 dark:text-emerald-100 dark:hover:bg-red-950/60 dark:hover:text-red-200"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-red-50 text-red-600 dark:bg-red-950/70 dark:text-red-400 shrink-0">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span>Report Incident</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setQuickMenuOpen(false);
                setActiveQuickModal('info');
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-emerald-950 hover:bg-emerald-50/70 dark:text-emerald-100 dark:hover:bg-[#09291E]"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 shrink-0">
                <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span>Request Event Info</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setQuickMenuOpen(false);
                setActiveQuickModal('organizer');
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-emerald-950 hover:bg-emerald-50/70 dark:text-emerald-100 dark:hover:bg-[#09291E]"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950/80 dark:text-teal-400 shrink-0">
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span>Contact Organizer</span>
            </button>
          </div>
        )}

        <button
          type="button"
          aria-expanded={quickMenuOpen}
          aria-haspopup="menu"
          onClick={() => setQuickMenuOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-full bg-[#064E3B] px-4 py-2.5 text-xs font-bold text-white shadow-lg transition-colors hover:bg-[#053D2E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 whitespace-nowrap"
        >
          {quickMenuOpen ? (
            <X className="h-4 w-4 text-emerald-300 dark:text-emerald-100" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4 text-emerald-300 dark:text-emerald-100" aria-hidden="true" />
          )}
          <span>Quick Actions</span>
        </button>
      </div>

      <Modal
        open={activeQuickModal === 'incident'}
        onClose={() => setActiveQuickModal(null)}
        title="Report Incident"
        subtitle="Route an urgent issue directly to Floor Volunteers and Operations."
        footer={
          <>
            <button
              type="button"
              onClick={() => setActiveQuickModal(null)}
              className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-[#061D15] dark:text-emerald-100 dark:hover:bg-[#09291E]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!incidentDetails.trim()}
              onClick={() => {
                const ref = `INC-${Math.floor(1000 + Math.random() * 8999)}`;
                setActiveQuickModal(null);
                setIncidentDetails('');
                flashFeedback(
                  `Simulated incident ${ref} logged for ${incidentRoom} (${incidentType}).`
                );
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-45"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Submit Incident
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label
              htmlFor="incident-type"
              className="block font-semibold text-emerald-950 dark:text-emerald-100"
            >
              Incident Category
            </label>
            <select
              id="incident-type"
              value={incidentType}
              onChange={(e) => setIncidentType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-sm text-emerald-950 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:focus:border-emerald-400"
            >
              <option>Lab / Hardware Issue</option>
              <option>Power / Network Outage</option>
              <option>Medical / Safety Assistance</option>
              <option>Lost Badge or Equipment</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="incident-room"
              className="block font-semibold text-emerald-950 dark:text-emerald-100"
            >
              Location
            </label>
            <select
              id="incident-room"
              value={incidentRoom}
              onChange={(e) => setIncidentRoom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-sm text-emerald-950 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:focus:border-emerald-400"
            >
              {BAUST_ROOMS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="incident-details"
              className="block font-semibold text-emerald-950 dark:text-emerald-100"
            >
              Description
            </label>
            <textarea
              id="incident-details"
              rows={3}
              value={incidentDetails}
              onChange={(e) => setIncidentDetails(e.target.value)}
              placeholder="Describe the terminal, team, or issue..."
              className="mt-1 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-sm text-emerald-950 placeholder:text-emerald-900/40 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:placeholder:text-emerald-400/45 dark:focus:border-emerald-400"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={activeQuickModal === 'info'}
        onClose={() => setActiveQuickModal(null)}
        title="Request Event Information"
        subtitle="Ask the BAUST CSE Fest Helpdesk about schedules, rules, or meals."
        footer={
          <>
            <button
              type="button"
              onClick={() => setActiveQuickModal(null)}
              className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-[#061D15] dark:text-emerald-100 dark:hover:bg-[#09291E]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!infoQuestion.trim()}
              onClick={() => {
                const ref = `REQ-${Math.floor(1000 + Math.random() * 8999)}`;
                setActiveQuickModal(null);
                setInfoQuestion('');
                flashFeedback(
                  `Simulated info request ${ref} sent to Fest Helpdesk (${infoTopic}).`
                );
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-45 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              <Send className="h-3.5 w-3.5 text-emerald-200" />
              Send Request
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label
              htmlFor="info-topic"
              className="block font-semibold text-emerald-950 dark:text-emerald-100"
            >
              Topic
            </label>
            <select
              id="info-topic"
              value={infoTopic}
              onChange={(e) => setInfoTopic(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-sm text-emerald-950 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:focus:border-emerald-400"
            >
              <option>Competition Rules &amp; Timing</option>
              <option>Room / Floor Directions</option>
              <option>Cafeteria &amp; Meal Tokens</option>
              <option>Shuttle Bus &amp; Accommodation</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="info-question"
              className="block font-semibold text-emerald-950 dark:text-emerald-100"
            >
              Question
            </label>
            <textarea
              id="info-question"
              rows={3}
              value={infoQuestion}
              onChange={(e) => setInfoQuestion(e.target.value)}
              placeholder="What would you like clarified?"
              className="mt-1 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-sm text-emerald-950 placeholder:text-emerald-900/40 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:placeholder:text-emerald-400/45 dark:focus:border-emerald-400"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={activeQuickModal === 'organizer'}
        onClose={() => setActiveQuickModal(null)}
        title="Contact Organizer"
        subtitle="Reach the BAUST CSE Fest Executive Committee."
        footer={
          <>
            <button
              type="button"
              onClick={() => setActiveQuickModal(null)}
              className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-[#061D15] dark:text-emerald-100 dark:hover:bg-[#09291E]"
            >
              Close
            </button>
            <button
              type="button"
              disabled={!organizerSubject.trim() || !organizerMessage.trim()}
              onClick={() => {
                setActiveQuickModal(null);
                setOrganizerSubject('');
                setOrganizerMessage('');
                flashFeedback(
                  `Simulated message dispatched to ${DEMO_USERS.Organizer.fullName}.`
                );
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-45 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              <Send className="h-3.5 w-3.5 text-emerald-200" />
              Send Message
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-800/70 dark:bg-[#041811]">
            <div className="font-semibold text-emerald-950 dark:text-emerald-50">
              {DEMO_USERS.Organizer.fullName}
            </div>
            <div className="mt-0.5 text-emerald-900/70 dark:text-emerald-200/80">
              {DEMO_USERS.Organizer.email} · {DEMO_USERS.Organizer.phone}
            </div>
          </div>
          <div>
            <label
              htmlFor="org-subject"
              className="block font-semibold text-emerald-950 dark:text-emerald-100"
            >
              Subject
            </label>
            <input
              id="org-subject"
              type="text"
              value={organizerSubject}
              onChange={(e) => setOrganizerSubject(e.target.value)}
              placeholder="e.g., Team substitution or schedule inquiry"
              className="mt-1 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-sm text-emerald-950 placeholder:text-emerald-900/40 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:placeholder:text-emerald-400/45 dark:focus:border-emerald-400"
            />
          </div>
          <div>
            <label
              htmlFor="org-message"
              className="block font-semibold text-emerald-950 dark:text-emerald-100"
            >
              Message
            </label>
            <textarea
              id="org-message"
              rows={3}
              value={organizerMessage}
              onChange={(e) => setOrganizerMessage(e.target.value)}
              placeholder={`Sending as ${activeUser.fullName} (${activeRole})...`}
              className="mt-1 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-sm text-emerald-950 placeholder:text-emerald-900/40 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:placeholder:text-emerald-400/45 dark:focus:border-emerald-400"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
