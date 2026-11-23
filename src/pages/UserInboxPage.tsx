import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  Building2,
  Check,
  CheckCheck,
  Clock,
  Copy,
  Download,
  ExternalLink,
  HelpCircle,
  Inbox,
  Mail,
  MailOpen,
  MapPin,
  MessageSquare,
  Moon,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  SlidersHorizontal,
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
  NotificationChannel,
  NotificationType,
  SystemUser,
  UserPreferenceMatrix,
  WorkspaceRole,
} from '../types';
import {
  formatDhakaDateTime,
  formatDhakaTimeOnly,
  getPriorityWeight,
  isAnnouncementVisibleToRole,
} from '../utils/formatters';

interface UserInboxPageProps {
  activeRole: WorkspaceRole;
  activeUser: SystemUser;
  announcements: Announcement[];
  preferences: UserPreferenceMatrix;
  onUpdatePreferences: (next: UserPreferenceMatrix) => void;
  onResetPreferences: () => void;
  onToggleRead: (
    announcementId: string,
    role: WorkspaceRole,
    nextRead: boolean
  ) => void;
  onMarkAllRead: (role: WorkspaceRole) => void;
  onTrackClick: (announcementId: string, attachmentId?: string) => void;
}

type InboxFilterPill =
  | 'all'
  | 'unread'
  | 'emergency'
  | 'schedule-rooms'
  | 'competitions';

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

export function UserInboxPage({
  activeRole,
  activeUser,
  announcements,
  preferences,
  onUpdatePreferences,
  onResetPreferences,
  onToggleRead,
  onMarkAllRead,
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

  useEffect(() => {
    setRecentSearches(loadRecentSearches(activeRole));
    setIsSearchFocused(false);
    setQuickMenuOpen(false);
    setMobileReaderOpen(false);
    setIncidentRoom(activeUser.assignedRoom || BAUST_ROOMS[0]);
  }, [activeRole, activeUser.assignedRoom]);

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

  const roleNotices = useMemo(() => {
    return announcements
      .filter((a) => isAnnouncementVisibleToRole(a, activeRole))
      .sort((a, b) => {
        const pw = getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
        if (pw !== 0) return pw;
        return (b.publishedAt || b.createdAt).localeCompare(
          a.publishedAt || a.createdAt
        );
      });
  }, [announcements, activeRole]);

  const emergencyNotices = useMemo(
    () => roleNotices.filter((n) => n.priority === 'Emergency'),
    [roleNotices]
  );

  const unreadCount = useMemo(
    () =>
      roleNotices.filter(
        (n) => !(n.isReadByCurrentRole?.[activeRole] ?? false)
      ).length,
    [roleNotices, activeRole]
  );

  const filteredNotices = useMemo(() => {
    return roleNotices.filter((n) => {
      const isRead = n.isReadByCurrentRole?.[activeRole] ?? false;
      if (filterPill === 'unread' && isRead) return false;
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

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q) ||
          n.type.toLowerCase().includes(q) ||
          n.targeting.rooms.some((r) => r.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [roleNotices, activeRole, filterPill, searchQuery]);

  const selectedNotice = useMemo(() => {
    if (selectedNoticeId) {
      const found = filteredNotices.find((n) => n.id === selectedNoticeId);
      if (found) return found;
      const inRole = roleNotices.find((n) => n.id === selectedNoticeId);
      if (inRole) return inRole;
    }
    return filteredNotices[0] ?? roleNotices[0] ?? null;
  }, [filteredNotices, roleNotices, selectedNoticeId]);

  const handleOpenNotice = (notice: Announcement) => {
    if (searchQuery.trim()) {
      recordSearchQuery(searchQuery);
    }
    setSelectedNoticeId(notice.id);
    setMobileReaderOpen(true);
    if (!(notice.isReadByCurrentRole?.[activeRole] ?? false)) {
      onToggleRead(notice.id, activeRole, true);
    }
  };

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

  const handleSimulatedAttachmentDownload = (
    noticeId: string,
    attachmentId: string,
    fileName: string
  ) => {
    onTrackClick(noticeId, attachmentId);
    flashFeedback(`Simulated download started: ${fileName}`);
  };

  const handleSimulatedActionLink = (noticeId: string, label: string) => {
    onTrackClick(noticeId);
    flashFeedback(
      `Opened action link "${label}" (click tracked in demo metrics)`
    );
  };

  const handleCopyNoticeSummary = (notice: Announcement) => {
    const text = `${notice.title}\nRooms: ${notice.targeting.rooms.join(', ') || 'Campus Wide'}\nTime: ${formatDhakaDateTime(notice.publishedAt || notice.createdAt)}\n\n${notice.body}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    flashFeedback('Notice details copied to clipboard.');
  };

  const filterPills: { id: InboxFilterPill; label: string }[] = [
    { id: 'all', label: `All (${roleNotices.length})` },
    { id: 'unread', label: `Unread (${unreadCount})` },
    { id: 'emergency', label: 'Emergency' },
    { id: 'schedule-rooms', label: 'Schedule & Rooms' },
    { id: 'competitions', label: 'Competitions' },
  ];

  return (
    <div className="space-y-4">
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

        <div className="flex flex-col gap-3 border-t border-emerald-100 pt-3 lg:flex-row lg:items-center lg:justify-between dark:border-emerald-800/60">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-emerald-50/80 p-1 dark:bg-[#041811] dark:border dark:border-emerald-800/50">
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

          <div ref={searchContainerRef} className="relative">
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

      {feedback && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-200"
        >
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
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
              const isRead = notice.isReadByCurrentRole?.[activeRole] ?? false;
              const isSelected = selectedNotice?.id === notice.id;
              const isEmergency = notice.priority === 'Emergency';

              return (
                <div
                  key={notice.id}
                  onClick={() => handleOpenNotice(notice)}
                  className={`cursor-pointer rounded-xl border p-3.5 transition-colors ${
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
                        notice.attachments.length > 0) && (
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
                          {notice.attachments.length > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Paperclip
                                className="h-3 w-3 text-emerald-700/60 dark:text-emerald-400/70"
                                aria-hidden="true"
                              />
                              {notice.attachments.length} attachment
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
                </div>
              );
            })
          )}
        </div>

        <aside
          className={`rounded-xl border border-emerald-200/70 bg-white p-4 sm:p-5 lg:sticky lg:top-18 lg:col-span-7 dark:border-emerald-800/60 dark:bg-[#061D15] ${
            mobileReaderOpen ? 'block' : 'hidden lg:block'
          }`}
        >
          {selectedNotice ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-emerald-100 pb-3 dark:border-emerald-800/60">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileReaderOpen(false)}
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
                  onClick={() => handleCopyNoticeSummary(selectedNotice)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-50/70 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100 dark:hover:bg-[#09291E] whitespace-nowrap"
                >
                  <Copy className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                  Copy
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

              <div className="mt-4 rounded-lg bg-emerald-50/40 p-4 text-sm leading-relaxed text-emerald-950 dark:bg-[#041811] dark:text-emerald-100 whitespace-pre-line">
                {selectedNotice.body}
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

              {selectedNotice.attachments.length > 0 && (
                <div className="mt-4 border-t border-emerald-100 pt-3 dark:border-emerald-800/60">
                  <div className="text-xs font-semibold text-emerald-950 dark:text-emerald-100 mb-2">
                    Attachments
                  </div>
                  <div className="space-y-1.5">
                    {selectedNotice.attachments.map((att) => (
                      <button
                        key={att.id}
                        type="button"
                        onClick={() =>
                          handleSimulatedAttachmentDownload(
                            selectedNotice.id,
                            att.id,
                            att.fileName
                          )
                        }
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-emerald-200/80 bg-emerald-50/45 px-3 py-2 text-left text-xs hover:bg-emerald-50 dark:border-emerald-800/70 dark:bg-[#041811] dark:hover:bg-[#09291E]"
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
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </span>
                      </button>
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
                      !(selectedNotice.isReadByCurrentRole?.[activeRole] ?? false)
                    )
                  }
                  className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50/70 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100 dark:hover:bg-[#09291E]"
                >
                  {selectedNotice.isReadByCurrentRole?.[activeRole]
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
