import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  DoorOpen,
  FileText,
  RotateCcw,
  Search,
  Send,
  Settings2,
  Users,
  X,
} from 'lucide-react';
import { PriorityBadge } from '../components/Badge';
import { ChannelPill } from '../components/ChannelPill';
import { Modal } from '../components/Modal';
import { AttachmentManager } from '../components/AttachmentManager';
import {
  ALL_CHANNELS,
  ALL_NOTIFICATION_TYPES,
  DEMO_ACCESS_ROLES,
} from '../data/mockData';
import type {
  Announcement,
  AnnouncementCategory,
  Attachment,
  AttachmentDeliveryOptions,
  DeliveryStatus,
  NotificationChannel,
  NotificationPriority,
  NotificationRetrySettings,
  NotificationType,
  RoomRecord,
  TargetingCriteria,
  UserProfile,
  UserRole,
  WorkspaceRole,
} from '../types';
import { formatDhakaDateTime } from '../utils/formatters';

interface ComposerPageProps {
  editingAnnouncement: Announcement | null;
  senderId?: string | null;
  senderName?: string;
  senderRole?: WorkspaceRole;
  profiles?: UserProfile[];
  rooms?: RoomRecord[];
  onNavigateRooms?: () => void;
  onSaveAnnouncement: (
    announcement: Announcement,
    targetStatus: DeliveryStatus
  ) => void | Promise<void>;
  onCancel: () => void;
}

type AudienceMode =
  | 'everyone'
  | 'Participant'
  | 'Volunteer'
  | 'Judge'
  | 'Mentor'
  | 'Sponsor'
  | 'Guest'
  | 'Organizer'
  | 'selected-users';

const PRIORITIES: NotificationPriority[] = ['Low', 'Normal', 'High', 'Emergency'];

function mapTypeToAnnouncementCategory(
  type: NotificationType
): AnnouncementCategory {
  switch (type) {
    case 'Emergency Alert':
      return 'Safety & Campus';
    case 'Schedule / Room Change':
      return 'Programming Contest';
    case 'Competition Update':
      return 'Hackathon';
    case 'Food & Logistics':
      return 'Logistics & Hospitality';
    case 'Ceremony':
      return 'Ceremony';
    default:
      return 'Tech Seminar';
  }
}

function getDefaultAudienceMode(editing: Announcement | null): AudienceMode {
  if (!editing) return 'everyone';
  if ((editing.targeting.targetUserIds?.length ?? 0) > 0) {
    return 'selected-users';
  }
  if (editing.targeting.everyoneAttending) return 'everyone';
  const firstRole = editing.targeting.roles[0];
  if (
    firstRole === 'Participant' ||
    firstRole === 'Volunteer' ||
    firstRole === 'Judge' ||
    firstRole === 'Mentor' ||
    firstRole === 'Sponsor' ||
    firstRole === 'Guest' ||
    firstRole === 'Organizer'
  ) {
    return firstRole;
  }
  return 'everyone';
}

function toDhakaDateInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dhaka = new Date(d.getTime() + 6 * 60 * 60 * 1000);
  return dhaka.toISOString().slice(0, 10);
}

function toDhakaTimeInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dhaka = new Date(d.getTime() + 6 * 60 * 60 * 1000);
  return dhaka.toISOString().slice(11, 16);
}

export function ComposerPage({
  editingAnnouncement,
  senderId,
  senderName,
  senderRole = 'Organizer',
  profiles = [],
  rooms = [],
  onNavigateRooms,
  onSaveAnnouncement,
  onCancel,
}: ComposerPageProps) {
  const activeRooms = useMemo(
    () => rooms.filter((room) => room.isActive),
    [rooms]
  );

  const eligibleUsers = useMemo(
    () =>
      profiles.filter(
        (p) =>
          !p.isDeleted &&
          !p.isArchived &&
          p.accountStatus === 'Active' &&
          p.approvalStatus !== 'Rejected'
      ),
    [profiles]
  );

  const [title, setTitle] = useState(editingAnnouncement?.title ?? '');
  const [body, setBody] = useState(editingAnnouncement?.body ?? '');
  const [audienceMode, setAudienceMode] = useState<AudienceMode>(() =>
    getDefaultAudienceMode(editingAnnouncement)
  );
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    editingAnnouncement?.targeting.targetUserIds ?? []
  );
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [priority, setPriority] = useState<NotificationPriority>(
    editingAnnouncement?.priority ?? 'Normal'
  );

  // Collapsed by default: Advanced Settings
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [type, setType] = useState<NotificationType>(
    editingAnnouncement?.type ?? 'General'
  );
  const [channels, setChannels] = useState<NotificationChannel[]>(
    editingAnnouncement?.channels.length
      ? editingAnnouncement.channels
      : ['In-App']
  );
  const [selectedRooms, setSelectedRooms] = useState<string[]>(
    editingAnnouncement?.targeting.rooms ?? []
  );
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>(
    editingAnnouncement?.status === 'Scheduled' ? 'later' : 'now'
  );
  const [scheduleDate, setScheduleDate] = useState(() =>
    toDhakaDateInput(editingAnnouncement?.scheduledFor)
  );
  const [scheduleTime, setScheduleTime] = useState(() =>
    toDhakaTimeInput(editingAnnouncement?.scheduledFor)
  );
  const [expiresDate, setExpiresDate] = useState(() =>
    toDhakaDateInput(editingAnnouncement?.expiresAt)
  );
  const [expiresTime, setExpiresTime] = useState(() =>
    toDhakaTimeInput(editingAnnouncement?.expiresAt)
  );
  const [retrySettings, setRetrySettings] = useState<NotificationRetrySettings>(
    editingAnnouncement?.retrySettings ?? {
      autoRetry: false,
      maxRetries: 2,
    }
  );
  const [actionLabel, setActionLabel] = useState(
    editingAnnouncement?.actionLabel ?? ''
  );
  const [actionUrl, setActionUrl] = useState(
    editingAnnouncement?.actionUrl ?? ''
  );
  const [attachments, setAttachments] = useState<Attachment[]>(
    editingAnnouncement?.attachments ?? []
  );
  const [attachmentDelivery, setAttachmentDelivery] =
    useState<AttachmentDeliveryOptions>(
      editingAnnouncement?.attachmentDelivery ?? {
        inApp: true,
        email: false,
        push: false,
      }
    );

  const [formError, setFormError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const draftAnnouncementId = editingAnnouncement?.id ?? 'ann-draft-preview';

  const resolvedRoles = useMemo<UserRole[]>(() => {
    if (audienceMode === 'everyone') {
      return [...DEMO_ACCESS_ROLES];
    }
    if (audienceMode === 'selected-users') {
      return [];
    }
    return [audienceMode];
  }, [audienceMode]);

  const filteredEligibleUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    return eligibleUsers.filter((u) => {
      if (!q) return true;
      return `${u.fullName} ${u.email} ${u.assignedRole ?? u.role} ${u.department}`
        .toLowerCase()
        .includes(q);
    });
  }, [eligibleUsers, userSearchQuery]);

  const estimatedRecipients = useMemo(() => {
    if (audienceMode === 'selected-users') {
      return selectedUserIds.length;
    }
    if (audienceMode === 'everyone') {
      return eligibleUsers.length;
    }
    return eligibleUsers.filter((u) => {
      const role = u.assignedRole ?? u.role;
      if (u.approvalStatus === 'Pending') {
        return audienceMode === 'Participant';
      }
      return role === audienceMode;
    }).length;
  }, [audienceMode, eligibleUsers, selectedUserIds.length]);

  const audienceLabel = useMemo(() => {
    if (audienceMode === 'everyone') return 'Everyone (All active fest accounts)';
    if (audienceMode === 'selected-users') {
      return `${selectedUserIds.length} Selected User${selectedUserIds.length === 1 ? '' : 's'}`;
    }
    return `${audienceMode}s`;
  }, [audienceMode, selectedUserIds.length]);

  const toggleChannel = (channel: NotificationChannel) => {
    setChannels((prev) => {
      if (prev.includes(channel)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== channel);
      }
      return [...prev, channel];
    });
  };

  const toggleRoom = (roomName: string) => {
    setSelectedRooms((prev) =>
      prev.includes(roomName)
        ? prev.filter((item) => item !== roomName)
        : [...prev, roomName]
    );
  };

  const toggleSelectedUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const buildPayload = (targetStatus: DeliveryStatus): Announcement => {
    const nowIso = new Date().toISOString();
    const id = editingAnnouncement?.id ?? `ann-${Date.now()}`;
    const cleanBody = body.trim();
    const autoSummary =
      cleanBody.length <= 160 ? cleanBody : `${cleanBody.slice(0, 157)}...`;

    const targeting: TargetingCriteria = {
      everyoneAttending: audienceMode === 'everyone',
      roles: resolvedRoles,
      audienceGroups: [],
      rooms: selectedRooms,
      eventSessions: [],
      competitions: [],
      categories: [],
      individualUsers:
        audienceMode === 'selected-users'
          ? selectedUserIds
              .map(
                (uid) =>
                  eligibleUsers.find((u) => u.userId === uid)?.fullName ?? uid
              )
          : [],
      targetUserIds:
        audienceMode === 'selected-users' ? selectedUserIds : [],
    };

    const scheduledIso =
      scheduleMode === 'later' && scheduleDate && scheduleTime
        ? `${scheduleDate}T${scheduleTime}:00+06:00`
        : undefined;

    const expiresIso =
      expiresDate && expiresTime
        ? `${expiresDate}T${expiresTime}:00+06:00`
        : undefined;

    return {
      id,
      title: title.trim(),
      body: cleanBody,
      summary: autoSummary,
      type,
      category: mapTypeToAnnouncementCategory(type),
      priority,
      status: targetStatus,
      channels: channels.length > 0 ? channels : ['In-App'],
      targeting,
      retrySettings,
      senderId: editingAnnouncement?.senderId ?? senderId ?? undefined,
      senderName:
        editingAnnouncement?.senderName ?? (senderName || 'Organizer'),
      senderRole: editingAnnouncement?.senderRole ?? senderRole,
      createdAt: editingAnnouncement?.createdAt ?? nowIso,
      updatedAt: nowIso,
      publishedAt:
        targetStatus === 'Delivered'
          ? editingAnnouncement?.publishedAt ?? nowIso
          : undefined,
      scheduledFor: targetStatus === 'Scheduled' ? scheduledIso : undefined,
      expiresAt: expiresIso,
      timezone: 'Asia/Dhaka',
      attachments: attachments.map((att) => ({ ...att, announcementId: id })),
      attachmentDelivery,
      actionLabel: actionLabel.trim() || undefined,
      actionUrl: actionUrl.trim() || undefined,
      totalRecipients: estimatedRecipients,
      deliveredCount:
        editingAnnouncement?.deliveredCount ?? 0,
      failedCount: editingAnnouncement?.failedCount ?? 0,
      pendingCount:
        targetStatus === 'Delivered'
          ? 0
          : editingAnnouncement?.pendingCount ?? 0,
      readCount: editingAnnouncement?.readCount ?? 0,
      clickCount: editingAnnouncement?.clickCount ?? 0,
      channelBreakdown:
        editingAnnouncement?.channelBreakdown ??
        channels.map((ch) => ({
          channel: ch,
          targetedCount: estimatedRecipients,
          deliveredCount: 0,
          pendingCount: 0,
          failedCount: 0,
          readCount: 0,
          clickCount: 0,
        })),
      isReadByCurrentRole: editingAnnouncement?.isReadByCurrentRole ?? {},
    };
  };

  const validateBeforeSubmit = (asDraft: boolean): string | null => {
    if (!title.trim()) return 'Notice title is required.';
    if (!body.trim()) return 'Notice message cannot be empty.';
    if (!asDraft && audienceMode === 'selected-users' && selectedUserIds.length === 0) {
      return 'Select at least one recipient user or choose a broader audience.';
    }
    if (!asDraft && scheduleMode === 'later') {
      if (!scheduleDate || !scheduleTime) {
        return 'Select both a schedule date and time in Advanced Settings.';
      }
    }
    return null;
  };

  const handleRequestDispatch = () => {
    const err = validateBeforeSubmit(false);
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    setConfirmOpen(true);
  };

  const handleSaveDraft = async () => {
    const err = validateBeforeSubmit(true);
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    setIsSubmitting(true);
    try {
      await onSaveAnnouncement(buildPayload('Draft'), 'Draft');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSend = async () => {
    const targetStatus: DeliveryStatus =
      scheduleMode === 'later' ? 'Scheduled' : 'Delivered';
    setIsSubmitting(true);
    try {
      setConfirmOpen(false);
      await onSaveAnnouncement(buildPayload(targetStatus), targetStatus);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-emerald-950 dark:text-emerald-50">
            {editingAnnouncement ? 'Edit Notice' : 'Create Notice'}
          </h1>
          <p className="mt-1 text-sm text-emerald-900/65 dark:text-emerald-200/70">
            Compose and dispatch announcements with live audience targeting and real delivery tracking.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center rounded-lg border border-emerald-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-100 dark:hover:bg-[#09291E]"
        >
          Back to Notices
        </button>
      </div>

      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{formError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Primary Clean Notice Composer */}
        <div className="space-y-5 lg:col-span-7">
          <section className="rounded-xl border border-emerald-200/80 bg-white p-5 shadow-sm sm:p-6 dark:border-emerald-800/60 dark:bg-[#061D15]">
            <div className="space-y-5">
              <div>
                <label
                  htmlFor="notice-title"
                  className="block text-xs font-semibold uppercase tracking-wider text-emerald-900/70 dark:text-emerald-200/75"
                >
                  Title
                </label>
                <input
                  id="notice-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter a clear, concise announcement title..."
                  className="mt-1.5 w-full rounded-lg border border-emerald-200/80 bg-white px-3.5 py-2.5 text-sm font-medium text-emerald-950 placeholder:text-emerald-900/40 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:placeholder:text-emerald-400/45"
                />
              </div>

              <div>
                <label
                  htmlFor="notice-message"
                  className="block text-xs font-semibold uppercase tracking-wider text-emerald-900/70 dark:text-emerald-200/75"
                >
                  Message
                </label>
                <textarea
                  id="notice-message"
                  rows={5}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your announcement details, timing, instructions, or venue updates..."
                  className="mt-1.5 w-full rounded-lg border border-emerald-200/80 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-emerald-950 placeholder:text-emerald-900/40 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:placeholder:text-emerald-400/45"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="notice-audience"
                    className="block text-xs font-semibold uppercase tracking-wider text-emerald-900/70 dark:text-emerald-200/75"
                  >
                    Audience
                  </label>
                  <select
                    id="notice-audience"
                    value={audienceMode}
                    onChange={(e) =>
                      setAudienceMode(e.target.value as AudienceMode)
                    }
                    className="mt-1.5 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2.5 text-sm font-medium text-emerald-950 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                  >
                    <option value="everyone">Everyone (All Active Users)</option>
                    <option value="Participant">Participants</option>
                    <option value="Volunteer">Volunteers</option>
                    <option value="Judge">Judges</option>
                    <option value="Mentor">Mentors</option>
                    <option value="Sponsor">Sponsors</option>
                    <option value="Guest">Guests</option>
                    <option value="Organizer">Organizers</option>
                    <option value="selected-users">Selected Users…</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="notice-priority"
                    className="block text-xs font-semibold uppercase tracking-wider text-emerald-900/70 dark:text-emerald-200/75"
                  >
                    Priority
                  </label>
                  <select
                    id="notice-priority"
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as NotificationPriority)
                    }
                    className="mt-1.5 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2.5 text-sm font-medium text-emerald-950 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                  >
                    {PRIORITIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selected Users Picker */}
              {audienceMode === 'selected-users' && (
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 dark:border-emerald-800/60 dark:bg-[#041811]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                      <Users className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                      Select Recipients ({selectedUserIds.length} chosen)
                    </span>
                    {selectedUserIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedUserIds([])}
                        className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="relative mt-2.5">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-700/50 dark:text-emerald-300/50"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      placeholder="Search active users by name, email, or role..."
                      className="w-full rounded-lg border border-emerald-200/80 bg-white py-2 pl-8 pr-3 text-xs text-emerald-950 placeholder:text-emerald-900/40 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-50"
                    />
                  </div>

                  <div className="mt-2.5 max-h-48 space-y-1 overflow-y-auto pr-1">
                    {filteredEligibleUsers.length === 0 ? (
                      <p className="py-3 text-center text-xs text-emerald-900/60 dark:text-emerald-200/60">
                        No matching active users available.
                      </p>
                    ) : (
                      filteredEligibleUsers.map((user) => {
                        const checked = selectedUserIds.includes(user.userId);
                        return (
                          <label
                            key={user.userId}
                            className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                              checked
                                ? 'border-emerald-600 bg-emerald-100/70 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-900/50 dark:text-emerald-50'
                                : 'border-emerald-200/60 bg-white text-emerald-900 hover:bg-emerald-50/70 dark:border-emerald-800/60 dark:bg-[#061D15] dark:text-emerald-100'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSelectedUser(user.userId)}
                                className="h-3.5 w-3.5 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-600"
                              />
                              <span className="truncate font-semibold">
                                {user.fullName || user.email}
                              </span>
                              <span className="hidden truncate text-emerald-900/60 sm:inline dark:text-emerald-200/60">
                                ({user.email})
                              </span>
                            </span>
                            <span className="shrink-0 rounded bg-emerald-900/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900 dark:bg-emerald-800/60 dark:text-emerald-200">
                              {user.assignedRole ?? user.role}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Attachments */}
              <div>
                <AttachmentManager
                  announcementId={draftAnnouncementId}
                  attachments={attachments}
                  deliveryOptions={attachmentDelivery}
                  channels={channels}
                  onChange={setAttachments}
                  onDeliveryOptionsChange={setAttachmentDelivery}
                  onProcessingChange={() => {}}
                />
              </div>
            </div>
          </section>

          {/* Collapsed-by-default Advanced Settings */}
          <section className="rounded-xl border border-emerald-200/80 bg-white shadow-sm dark:border-emerald-800/60 dark:bg-[#061D15]">
            <button
              type="button"
              aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen((prev) => !prev)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Settings2
                  className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-50">
                    Advanced Settings
                  </p>
                  <p className="truncate text-xs text-emerald-900/60 dark:text-emerald-200/60">
                    {channels.join(', ')} ·{' '}
                    {scheduleMode === 'later' && scheduleDate && scheduleTime
                      ? `Scheduled ${scheduleDate} ${scheduleTime}`
                      : 'Send immediately'}{' '}
                    · {selectedRooms.length} room{selectedRooms.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              {advancedOpen ? (
                <ChevronUp className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
              )}
            </button>

            {advancedOpen && (
              <div className="space-y-5 border-t border-emerald-100 px-5 py-5 sm:px-6 dark:border-emerald-800/60">
                {/* Category & Action Link */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="adv-type"
                      className="block text-xs font-semibold text-emerald-950 dark:text-emerald-100"
                    >
                      Category / Type
                    </label>
                    <select
                      id="adv-type"
                      value={type}
                      onChange={(e) => setType(e.target.value as NotificationType)}
                      className="mt-1.5 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-sm text-emerald-950 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                    >
                      {ALL_NOTIFICATION_TYPES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="adv-action-label"
                      className="block text-xs font-semibold text-emerald-950 dark:text-emerald-100"
                    >
                      Action Button Label (Optional)
                    </label>
                    <input
                      id="adv-action-label"
                      type="text"
                      value={actionLabel}
                      onChange={(e) => setActionLabel(e.target.value)}
                      placeholder="e.g., View Contest Rules"
                      className="mt-1.5 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-sm text-emerald-950 placeholder:text-emerald-900/40 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                    />
                  </div>
                </div>

                {actionLabel.trim() && (
                  <div>
                    <label
                      htmlFor="adv-action-url"
                      className="block text-xs font-semibold text-emerald-950 dark:text-emerald-100"
                    >
                      Action Link URL
                    </label>
                    <input
                      id="adv-action-url"
                      type="url"
                      value={actionUrl}
                      onChange={(e) => setActionUrl(e.target.value)}
                      placeholder="https://..."
                      className="mt-1.5 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-sm text-emerald-950 placeholder:text-emerald-900/40 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                    />
                  </div>
                )}

                {/* Delivery Channels */}
                <div>
                  <p className="text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                    Delivery Channels
                  </p>
                  <p className="mt-0.5 text-[11px] text-emerald-900/60 dark:text-emerald-200/60">
                    In-App is active and logged in real time. External gateways record gateway readiness per recipient.
                  </p>
                  <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {ALL_CHANNELS.map((ch) => {
                      const active = channels.includes(ch);
                      return (
                        <label
                          key={ch}
                          className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                            active
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-900/40 dark:text-emerald-50'
                              : 'border-emerald-200/80 bg-white text-emerald-900/75 hover:bg-emerald-50/50 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-200/80'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={active}
                              onChange={() => toggleChannel(ch)}
                              className="h-3.5 w-3.5 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-600"
                            />
                            {ch}
                          </span>
                          {ch === 'In-App' && (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200">
                              Live
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Dynamic Rooms from Supabase */}
                <div>
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                      <DoorOpen className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                      Target Rooms / Venues
                    </p>
                    {senderRole === 'Super Admin' && onNavigateRooms && (
                      <button
                        type="button"
                        onClick={onNavigateRooms}
                        className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        Manage Rooms
                      </button>
                    )}
                  </div>
                  {activeRooms.length === 0 ? (
                    <p className="mt-2 rounded-lg border border-dashed border-emerald-200 px-3 py-2.5 text-xs text-emerald-900/60 dark:border-emerald-800/70 dark:text-emerald-200/60">
                      No active rooms configured yet.
                    </p>
                  ) : (
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {activeRooms.map((room) => {
                        const checked = selectedRooms.includes(room.name);
                        return (
                          <label
                            key={room.id}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                              checked
                                ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-950 dark:border-emerald-500 dark:bg-emerald-900/40 dark:text-emerald-50'
                                : 'border-emerald-200/80 bg-white text-emerald-900/80 hover:bg-emerald-50/50 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-200/80'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRoom(room.name)}
                              className="h-3.5 w-3.5 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-600"
                            />
                            <span className="truncate">{room.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Schedule */}
                <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/35 p-3.5 dark:border-emerald-800/60 dark:bg-[#041811]">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                    <CalendarClock className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                    Schedule (Asia/Dhaka · GMT+6)
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setScheduleMode('now')}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        scheduleMode === 'now'
                          ? 'bg-[#064E3B] text-white dark:bg-emerald-600'
                          : 'border border-emerald-200 bg-white text-emerald-900 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-100'
                      }`}
                    >
                      Send Immediately
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleMode('later')}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        scheduleMode === 'later'
                          ? 'bg-[#064E3B] text-white dark:bg-emerald-600'
                          : 'border border-emerald-200 bg-white text-emerald-900 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-100'
                      }`}
                    >
                      Schedule Date &amp; Time
                    </button>
                  </div>
                  {scheduleMode === 'later' && (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="adv-sched-date"
                          className="block text-[11px] font-semibold text-emerald-900/70 dark:text-emerald-200/70"
                        >
                          Publish Date
                        </label>
                        <input
                          id="adv-sched-date"
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-1.5 text-xs text-emerald-950 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-50"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="adv-sched-time"
                          className="block text-[11px] font-semibold text-emerald-900/70 dark:text-emerald-200/70"
                        >
                          Publish Time (BST)
                        </label>
                        <input
                          id="adv-sched-time"
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-1.5 text-xs text-emerald-950 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-50"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Retry & Expiry */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/35 p-3.5 dark:border-emerald-800/60 dark:bg-[#041811]">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                      <RotateCcw className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                      Retry Policy
                    </p>
                    <label className="mt-2.5 flex items-center gap-2 text-xs text-emerald-900 dark:text-emerald-100">
                      <input
                        type="checkbox"
                        checked={retrySettings.autoRetry}
                        onChange={(e) =>
                          setRetrySettings((prev) => ({
                            ...prev,
                            autoRetry: e.target.checked,
                          }))
                        }
                        className="h-3.5 w-3.5 rounded border-emerald-300 text-emerald-700"
                      />
                      Enable automatic retry flagging
                    </label>
                    <div className="mt-2 flex items-center gap-2">
                      <label
                        htmlFor="adv-max-retries"
                        className="text-[11px] font-semibold text-emerald-900/70 dark:text-emerald-200/70"
                      >
                        Max Retries:
                      </label>
                      <input
                        id="adv-max-retries"
                        type="number"
                        min={0}
                        max={5}
                        value={retrySettings.maxRetries}
                        onChange={(e) =>
                          setRetrySettings((prev) => ({
                            ...prev,
                            maxRetries: Math.min(
                              5,
                              Math.max(0, Number(e.target.value) || 0)
                            ),
                          }))
                        }
                        className="w-16 rounded border border-emerald-200/80 bg-white px-2 py-1 text-xs text-emerald-950 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-50"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/35 p-3.5 dark:border-emerald-800/60 dark:bg-[#041811]">
                    <p className="text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                      Expiry Window (Optional)
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        aria-label="Expiry date"
                        value={expiresDate}
                        onChange={(e) => setExpiresDate(e.target.value)}
                        className="w-full rounded border border-emerald-200/80 bg-white px-2 py-1 text-xs text-emerald-950 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-50"
                      />
                      <input
                        type="time"
                        aria-label="Expiry time"
                        value={expiresTime}
                        onChange={(e) => setExpiresTime(e.target.value)}
                        className="w-full rounded border border-emerald-200/80 bg-white px-2 py-1 text-xs text-emerald-950 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-50"
                      />
                    </div>
                    {expiresDate && (
                      <button
                        type="button"
                        onClick={() => {
                          setExpiresDate('');
                          setExpiresTime('');
                        }}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        <X className="h-3 w-3" /> Clear expiry
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Primary Action Bar */}
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onCancel}
              className="rounded-lg border border-emerald-200/80 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-100 dark:hover:bg-[#09291E]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleSaveDraft()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-700 dark:bg-[#041811] dark:text-emerald-100 dark:hover:bg-[#09291E]"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Save Draft
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleRequestDispatch}
              className="inline-flex items-center gap-2 rounded-lg bg-[#064E3B] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#053D2E] disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {scheduleMode === 'later' ? 'Schedule Notice' : 'Send Notice'}
            </button>
          </div>
        </div>

        {/* Live Notice Preview & Recipient Estimate */}
        <aside className="space-y-4 lg:col-span-5">
          <div className="sticky top-6 rounded-xl border border-emerald-200/80 bg-white p-5 shadow-sm dark:border-emerald-800/60 dark:bg-[#061D15]">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3 dark:border-emerald-800/60">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-900/70 dark:text-emerald-200/75">
                <Bell className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                Live Delivery Preview
              </span>
              <PriorityBadge priority={priority} />
            </div>

            <div className="mt-4 rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-4 dark:border-emerald-800/60 dark:bg-[#041811]">
              <h3 className="text-base font-bold text-emerald-950 dark:text-emerald-50">
                {title.trim() || 'Notice title will appear here'}
              </h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-emerald-900/80 dark:text-emerald-100/80">
                {body.trim() || 'Compose your notice message on the left to preview how attendees will read it.'}
              </p>

              {selectedRooms.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedRooms.map((roomName) => (
                    <span
                      key={roomName}
                      className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200"
                    >
                      {roomName}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {channels.map((ch) => (
                  <ChannelPill key={ch} channel={ch} />
                ))}
              </div>
            </div>

            <dl className="mt-4 space-y-2.5 border-t border-emerald-100 pt-4 text-xs dark:border-emerald-800/60">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-emerald-900/65 dark:text-emerald-200/65">
                  Target Audience
                </dt>
                <dd className="font-semibold text-emerald-950 dark:text-emerald-50">
                  {audienceLabel}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-emerald-900/65 dark:text-emerald-200/65">
                  Matched Active Recipients
                </dt>
                <dd className="font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {estimatedRecipients}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-emerald-900/65 dark:text-emerald-200/65">
                  Dispatch Timing
                </dt>
                <dd className="font-semibold text-emerald-950 dark:text-emerald-50">
                  {scheduleMode === 'later' && scheduleDate && scheduleTime
                    ? formatDhakaDateTime(`${scheduleDate}T${scheduleTime}:00+06:00`)
                    : 'Immediate upon Send'}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => !isSubmitting && setConfirmOpen(false)}
        title={
          scheduleMode === 'later'
            ? 'Confirm Scheduled Notice'
            : 'Confirm Notice Dispatch'
        }
        subtitle={`Targeting ${audienceLabel} (${estimatedRecipients} matched active account${estimatedRecipients === 1 ? '' : 's'}).`}
        maxWidthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setConfirmOpen(false)}
              className="rounded-lg border border-emerald-200 px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleConfirmSend()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#064E3B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#053D2E] disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              {scheduleMode === 'later' ? 'Confirm Schedule' : 'Send Now'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-emerald-900/80 dark:text-emerald-100/80">
          {priority === 'Emergency' && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Emergency Priority selected. Recipients will receive immediate high-priority alerts.
              </span>
            </div>
          )}
          <p>
            Ready to {scheduleMode === 'later' ? 'schedule' : 'publish'}{' '}
            <strong className="text-emerald-950 dark:text-emerald-50">
              {title.trim()}
            </strong>{' '}
            across{' '}
            <strong className="text-emerald-950 dark:text-emerald-50">
              {channels.join(', ')}
            </strong>
            ?
          </p>
        </div>
      </Modal>
    </div>
  );
}
