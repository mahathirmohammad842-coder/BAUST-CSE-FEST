import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Check,
  FileText,
  Mail,
  Send,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { PriorityBadge } from '../components/Badge';
import { ChannelPill } from '../components/ChannelPill';
import { Modal } from '../components/Modal';
import {
  ALL_CHANNELS,
  ALL_NOTIFICATION_TYPES,
  BAUST_ROOMS,
  DEMO_ACCESS_ROLES,
} from '../data/mockData';
import type {
  Announcement,
  AnnouncementCategory,
  DeliveryStatus,
  NotificationChannel,
  NotificationPriority,
  NotificationType,
  TargetingCriteria,
  UserRole,
} from '../types';
import { formatDhakaDateTime } from '../utils/formatters';

interface ComposerPageProps {
  editingAnnouncement: Announcement | null;
  onSaveAnnouncement: (
    announcement: Announcement,
    targetStatus: DeliveryStatus
  ) => void;
  onCancel: () => void;
}

const PRIORITIES: NotificationPriority[] = ['Low', 'Normal', 'High', 'Emergency'];

interface QuickTemplate {
  id: string;
  label: string;
  title: string;
  body: string;
  type: NotificationType;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  roles: UserRole[];
  rooms: string[];
  everyoneAttending?: boolean;
}

const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    id: 'tpl-room',
    label: 'Room Change',
    title: 'Room Change: Contest Briefing Moved to CSE Seminar Room',
    body: 'Please note that the pre-round briefing originally scheduled in AB1 Lab 302 has shifted to the CSE Seminar Room. Please arrive 15 minutes early with your team badge.',
    type: 'Schedule / Room Change',
    priority: 'High',
    channels: ['In-App', 'Push Notification', 'SMS'],
    roles: ['Participant', 'Volunteer', 'Judge'],
    rooms: ['CSE Seminar Room', 'Academic Building 1 - Lab 302'],
  },
  {
    id: 'tpl-contest',
    label: 'Contest Update',
    title: 'IUPC Clarifications & Freeze Window Notice',
    body: 'The DOMjudge scoreboard will freeze during the final 60 minutes of the contest. Teams may still submit clarification requests via the judge queue.',
    type: 'Competition Update',
    priority: 'Normal',
    channels: ['In-App', 'Push Notification', 'Web Notification'],
    roles: ['Participant', 'Judge'],
    rooms: ['Academic Building 1 - Lab 302', 'Academic Building 1 - Lab 305'],
  },
  {
    id: 'tpl-food',
    label: 'Food & Break',
    title: 'Afternoon Snacks & Tea Available at BAUST Cafeteria Courtyard',
    body: 'Evening refreshment boxes and hot tea are now open for all fest attendees, volunteers, and mentors at the Cafeteria Courtyard. Present your fest lanyard badge.',
    type: 'Food & Logistics',
    priority: 'Normal',
    channels: ['In-App', 'Push Notification'],
    roles: ['Participant', 'Volunteer', 'Judge', 'Guest', 'Sponsor', 'Mentor'],
    rooms: ['BAUST Cafeteria Courtyard'],
    everyoneAttending: true,
  },
  {
    id: 'tpl-emergency',
    label: 'Emergency Alert',
    title: 'URGENT: Temporary Generator Switchover in Central Auditorium',
    body: 'Campus engineering is completing a 5-minute backup power switchover at Central Auditorium. Please stay seated inside the hall while stage lighting resets.',
    type: 'Emergency Alert',
    priority: 'Emergency',
    channels: ['In-App', 'SMS', 'Push Notification', 'Web Notification'],
    roles: ['Participant', 'Volunteer', 'Judge', 'Guest', 'Organizer'],
    rooms: ['Central Auditorium'],
    everyoneAttending: true,
  },
];

function mapTypeToAnnouncementCategory(
  type: NotificationType
): AnnouncementCategory {
  switch (type) {
    case 'Emergency Alert':
      return 'Safety & Campus';
    case 'Schedule / Room Change':
      return 'Programming Contest';
    case 'Competition Update':
      return 'Robotics Challenge';
    case 'Food & Logistics':
      return 'Logistics & Hospitality';
    case 'Ceremony':
      return 'Ceremony';
    case 'General':
    default:
      return 'Tech Seminar';
  }
}

export function ComposerPage({
  editingAnnouncement,
  onSaveAnnouncement,
  onCancel,
}: ComposerPageProps) {
  const [title, setTitle] = useState(editingAnnouncement?.title ?? '');
  const [body, setBody] = useState(editingAnnouncement?.body ?? '');
  const [type, setType] = useState<NotificationType>(
    editingAnnouncement?.type ?? 'General'
  );
  const [priority, setPriority] = useState<NotificationPriority>(
    editingAnnouncement?.priority ?? 'Normal'
  );
  const [channels, setChannels] = useState<NotificationChannel[]>(
    editingAnnouncement?.channels ?? ['In-App', 'Push Notification']
  );
  const [targeting, setTargeting] = useState<TargetingCriteria>(
    editingAnnouncement?.targeting ?? {
      everyoneAttending: false,
      roles: ['Participant', 'Volunteer'],
      audienceGroups: [],
      rooms: ['Academic Building 1 - Lab 302'],
      eventSessions: [],
      competitions: [],
      categories: ['Programming Contest'],
      individualUsers: [],
    }
  );
  const [scheduleEnabled, setScheduleEnabled] = useState<boolean>(
    editingAnnouncement?.status === 'Scheduled'
  );
  const [scheduledDateTime, setScheduledDateTime] = useState<string>(
    editingAnnouncement?.scheduledFor
      ? editingAnnouncement.scheduledFor.slice(0, 16)
      : '2026-11-22T16:30'
  );

  const [previewTab, setPreviewTab] = useState<'in-app' | 'mobile' | 'email'>(
    'in-app'
  );
  const [formError, setFormError] = useState<string | null>(null);

  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [pendingSubmitMode, setPendingSubmitMode] = useState<
    'Delivered' | 'Scheduled'
  >('Delivered');
  const [emergencyAck, setEmergencyAck] = useState(false);

  const estimatedRecipients = useMemo(() => {
    if (targeting.everyoneAttending) return 940;
    let count = 0;
    if (targeting.roles.includes('Participant')) count += 480;
    if (targeting.roles.includes('Volunteer')) count += 95;
    if (targeting.roles.includes('Judge')) count += 36;
    if (targeting.roles.includes('Guest')) count += 45;
    if (targeting.roles.includes('Sponsor')) count += 24;
    if (targeting.roles.includes('Mentor')) count += 18;
    if (targeting.roles.includes('Organizer')) count += 18;
    if (count === 0 && targeting.rooms.length > 0) count = 140;
    return Math.min(940, Math.max(count, 12));
  }, [targeting]);

  const smsSegments = Math.max(1, Math.ceil(Math.max(body.length, 1) / 160));

  const applyTemplate = (tpl: QuickTemplate) => {
    setTitle(tpl.title);
    setBody(tpl.body);
    setType(tpl.type);
    setPriority(tpl.priority);
    setChannels(tpl.channels);
    setTargeting((prev) => ({
      ...prev,
      everyoneAttending: Boolean(tpl.everyoneAttending),
      roles: tpl.roles,
      rooms: tpl.rooms,
    }));
    setFormError(null);
  };

  const toggleChannel = (channel: NotificationChannel) => {
    setChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
  };

  const toggleRole = (role: UserRole) => {
    setTargeting((prev) => ({
      ...prev,
      everyoneAttending: false,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  const toggleRoom = (room: string) => {
    setTargeting((prev) => ({
      ...prev,
      rooms: prev.rooms.includes(room)
        ? prev.rooms.filter((r) => r !== room)
        : [...prev.rooms, room],
    }));
  };

  const validateBeforePublish = (mode: DeliveryStatus): boolean => {
    if (!title.trim()) {
      setFormError('Please enter a notice title.');
      return false;
    }
    if (!body.trim()) {
      setFormError('Please enter a notice message.');
      return false;
    }
    if (mode !== 'Draft' && channels.length === 0) {
      setFormError('Select at least one delivery channel.');
      return false;
    }
    if (
      mode !== 'Draft' &&
      !targeting.everyoneAttending &&
      targeting.roles.length === 0 &&
      targeting.rooms.length === 0
    ) {
      setFormError(
        'Select All Attendees or at least one target role or room.'
      );
      return false;
    }
    setFormError(null);
    return true;
  };

  const commitAnnouncement = (targetStatus: DeliveryStatus) => {
    const nowIso = new Date().toISOString();
    const id =
      editingAnnouncement?.id ?? `ann-${Math.floor(110 + Math.random() * 880)}`;

    const isSent = targetStatus === 'Delivered';
    const simulatedFailed = isSent
      ? Math.max(1, Math.floor(estimatedRecipients * 0.015))
      : 0;
    const simulatedDelivered = isSent
      ? estimatedRecipients - simulatedFailed
      : 0;
    const simulatedRead = isSent ? Math.floor(simulatedDelivered * 0.62) : 0;
    const simulatedClicks = isSent ? Math.floor(simulatedDelivered * 0.28) : 0;

    const channelBreakdown =
      targetStatus === 'Draft'
        ? []
        : channels.map((ch) => {
            const chTargeted =
              ch === 'In-App'
                ? estimatedRecipients
                : Math.floor(estimatedRecipients * 0.88);
            const chFailed =
              isSent && (ch === 'SMS' || ch === 'Push Notification') ? 1 : 0;
            const chDelivered = isSent ? chTargeted - chFailed : 0;
            return {
              channel: ch,
              targetedCount: chTargeted,
              deliveredCount: chDelivered,
              pendingCount: targetStatus === 'Scheduled' ? chTargeted : 0,
              failedCount: chFailed,
              readCount: isSent ? Math.floor(chDelivered * 0.58) : 0,
              clickCount: isSent ? Math.floor(chDelivered * 0.19) : 0,
            };
          });

    const category =
      editingAnnouncement?.category ?? mapTypeToAnnouncementCategory(type);

    const announcement: Announcement = {
      id,
      title: title.trim(),
      body: body.trim(),
      summary:
        body.trim().slice(0, 120) + (body.trim().length > 120 ? '...' : ''),
      type,
      category,
      priority,
      status: targetStatus,
      channels,
      targeting: {
        ...targeting,
        categories: [category],
      },
      senderName: 'Rafiqul Islam Chowdhury',
      senderRole: 'Organizer',
      createdAt: editingAnnouncement?.createdAt ?? nowIso,
      updatedAt: nowIso,
      publishedAt: isSent ? nowIso : undefined,
      scheduledFor:
        targetStatus === 'Scheduled'
          ? `${scheduledDateTime}:00+06:00`
          : undefined,
      timezone: 'Asia/Dhaka',
      attachments: editingAnnouncement?.attachments ?? [],
      totalRecipients: estimatedRecipients,
      deliveredCount: simulatedDelivered,
      failedCount: simulatedFailed,
      pendingCount: targetStatus === 'Scheduled' ? estimatedRecipients : 0,
      readCount: simulatedRead,
      clickCount: simulatedClicks,
      channelBreakdown,
      isReadByCurrentRole: {
        Organizer: true,
        Participant: false,
        Volunteer: false,
        Judge: false,
        Guest: false,
        Sponsor: false,
        Mentor: false,
      },
    };

    onSaveAnnouncement(announcement, targetStatus);
  };

  const handlePrimarySubmit = () => {
    const mode: 'Delivered' | 'Scheduled' = scheduleEnabled
      ? 'Scheduled'
      : 'Delivered';
    if (!validateBeforePublish(mode)) return;
    if (priority === 'Emergency') {
      setPendingSubmitMode(mode);
      setEmergencyAck(false);
      setEmergencyModalOpen(true);
      return;
    }
    commitAnnouncement(mode);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-emerald-950 dark:text-emerald-50">
            {editingAnnouncement ? 'Edit Notice' : 'Create Notice'}
          </h1>
          <p className="text-xs text-emerald-900/60 dark:text-emerald-300/65">
            Compose, target by role or campus room, preview across channels, and dispatch
          </p>
        </div>
        <span className="font-mono text-xs text-emerald-900/60 dark:text-emerald-300/65">
          Timezone: Asia/Dhaka (GMT+6)
        </span>
      </div>

      {!editingAnnouncement && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200/70 bg-white px-4 py-2.5 dark:border-emerald-800/60 dark:bg-[#061D15]">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-900/75 dark:text-emerald-200/80 mr-1">
            <Sparkles className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            Quick Templates:
          </span>
          {QUICK_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className="rounded-md border border-emerald-200/80 bg-emerald-50/60 px-2.5 py-1 text-xs font-medium text-emerald-900 transition-colors hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-200 dark:hover:border-emerald-500 dark:hover:bg-[#09291E] dark:hover:text-emerald-50 whitespace-nowrap"
            >
              {tpl.label}
            </button>
          ))}
        </div>
      )}

      {formError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-800 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-300"
        >
          {formError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
        <div className="rounded-xl border border-emerald-200/70 bg-white p-4 sm:p-5 space-y-4 lg:col-span-7 dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div>
            <label
              htmlFor="notice-title"
              className="block text-xs font-semibold text-emerald-950 dark:text-emerald-100"
            >
              Title
            </label>
            <input
              id="notice-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Room Change: IUPC Mock Contest shifted to AB1 Lab 305"
              className="mt-1 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-sm text-emerald-950 placeholder:text-emerald-900/40 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:placeholder:text-emerald-400/45 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="notice-message"
                className="block text-xs font-semibold text-emerald-950 dark:text-emerald-100"
              >
                Message
              </label>
              <span className="font-mono text-[11px] text-emerald-900/55 dark:text-emerald-300/65 tabular-nums">
                {body.length} chars
                {channels.includes('SMS')
                  ? ` · ${smsSegments} SMS segment${smsSegments > 1 ? 's' : ''}`
                  : ''}
              </span>
            </div>
            <textarea
              id="notice-message"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write clear instructions, room numbers, and timings in GMT+6..."
              className="mt-1 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-sm leading-relaxed text-emerald-950 placeholder:text-emerald-900/40 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:placeholder:text-emerald-400/45 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/20"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="notice-category"
                className="block text-xs font-semibold text-emerald-950 dark:text-emerald-100"
              >
                Category
              </label>
              <select
                id="notice-category"
                value={type}
                onChange={(e) => setType(e.target.value as NotificationType)}
                className="mt-1 w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-xs font-medium text-emerald-950 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/20"
              >
                {ALL_NOTIFICATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                Priority
              </span>
              <div className="mt-1 grid grid-cols-4 gap-1.5">
                {PRIORITIES.map((p) => {
                  const active = priority === p;
                  const isEmergency = p === 'Emergency';
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                        active
                          ? isEmergency
                            ? 'border-red-600 bg-red-600 text-white'
                            : 'border-[#064E3B] bg-[#064E3B] text-white dark:border-emerald-500 dark:bg-emerald-600'
                          : isEmergency
                            ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800/70 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950'
                            : 'border-emerald-200/80 bg-white text-emerald-900 hover:bg-emerald-50/70 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-200 dark:hover:bg-[#09291E]'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-t border-emerald-100 pt-3.5 space-y-3 dark:border-emerald-800/60">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                Target Roles
              </span>
              <button
                type="button"
                onClick={() =>
                  setTargeting((prev) => ({
                    ...prev,
                    everyoneAttending: !prev.everyoneAttending,
                  }))
                }
                className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  targeting.everyoneAttending
                    ? 'border-emerald-700 bg-emerald-700 text-white dark:border-emerald-500 dark:bg-emerald-600'
                    : 'border-emerald-200/80 bg-white text-emerald-800 hover:bg-emerald-50/70 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-200 dark:hover:bg-[#09291E]'
                }`}
              >
                {targeting.everyoneAttending
                  ? 'All Attendees Selected (940)'
                  : 'Select All Attendees'}
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {DEMO_ACCESS_ROLES.map((role) => {
                const selected =
                  targeting.everyoneAttending || targeting.roles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? 'border-[#064E3B] bg-[#064E3B] text-white dark:border-emerald-500 dark:bg-emerald-600'
                        : 'border-emerald-200/80 bg-white text-emerald-900 hover:bg-emerald-50/70 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-200 dark:hover:bg-[#09291E]'
                    }`}
                  >
                    {selected && <Check className="h-3 w-3 text-emerald-300 dark:text-emerald-100" />}
                    {role}
                  </button>
                );
              })}
            </div>

            <div>
              <span className="block text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                Target Rooms
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {BAUST_ROOMS.map((room) => {
                  const selected = targeting.rooms.includes(room);
                  return (
                    <button
                      key={room}
                      type="button"
                      onClick={() => toggleRoom(room)}
                      className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        selected
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold dark:border-emerald-500 dark:bg-emerald-900/60 dark:text-emerald-100'
                          : 'border-emerald-200/70 bg-emerald-50/40 text-emerald-900/75 hover:bg-emerald-50 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-300/75 dark:hover:bg-[#09291E]'
                      }`}
                    >
                      {room}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-t border-emerald-100 pt-3.5 dark:border-emerald-800/60">
            <span className="block text-xs font-semibold text-emerald-950 dark:text-emerald-100">
              Delivery Channels
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ALL_CHANNELS.map((ch) => {
                const active = channels.includes(ch);
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => toggleChannel(ch)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-[#064E3B] bg-[#064E3B] text-white dark:border-emerald-500 dark:bg-emerald-600'
                        : 'border-emerald-200/80 bg-white text-emerald-900/80 hover:bg-emerald-50/70 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-200 dark:hover:bg-[#09291E]'
                    }`}
                  >
                    {active && <Check className="h-3 w-3 text-emerald-300 dark:text-emerald-100" />}
                    {ch}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-emerald-100 pt-3.5 space-y-2.5 dark:border-emerald-800/60">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex items-center gap-2.5 text-xs font-semibold text-emerald-950 dark:text-emerald-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-emerald-300 accent-emerald-700"
                />
                <CalendarClock
                  className="h-4 w-4 text-emerald-700 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <span>Schedule for later (GMT+6)</span>
              </label>

              {scheduleEnabled && (
                <input
                  type="datetime-local"
                  aria-label="Scheduled date and time"
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  className="rounded-lg border border-emerald-200/80 bg-white px-2.5 py-1.5 font-mono text-xs text-emerald-950 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:focus:border-emerald-400"
                />
              )}
            </div>

            {scheduleEnabled && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-emerald-900/60 dark:text-emerald-300/65">Quick times:</span>
                {[
                  { label: '3:00 PM Today', value: '2026-11-22T15:00' },
                  { label: '4:30 PM Today', value: '2026-11-22T16:30' },
                  { label: '6:00 PM Today', value: '2026-11-22T18:00' },
                ].map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setScheduledDateTime(preset.value)}
                    className={`rounded border px-2 py-0.5 font-medium transition-colors ${
                      scheduledDateTime === preset.value
                        ? 'border-[#064E3B] bg-[#064E3B] text-white dark:border-emerald-500 dark:bg-emerald-600'
                        : 'border-emerald-200/80 bg-emerald-50/50 text-emerald-900 hover:bg-emerald-100/70 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-200 dark:hover:bg-[#09291E]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-xl border border-emerald-200/70 bg-white p-4 sm:p-5 space-y-4 lg:sticky lg:top-18 lg:col-span-5 dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
              Live Preview
            </h2>
            <div className="inline-flex rounded-lg bg-emerald-50/80 p-0.5 text-[11px] font-semibold dark:bg-[#041811] dark:border dark:border-emerald-800/50">
              {(
                [
                  { id: 'in-app', label: 'In-App', icon: Bell },
                  { id: 'mobile', label: 'Push', icon: Smartphone },
                  { id: 'email', label: 'Email', icon: Mail },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPreviewTab(tab.id)}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors ${
                      previewTab === tab.id
                        ? 'bg-white text-emerald-950 shadow-sm dark:bg-[#0B2E22] dark:text-emerald-50'
                        : 'text-emerald-900/65 hover:text-emerald-950 dark:text-emerald-300/75 dark:hover:text-emerald-50'
                    }`}
                  >
                    <Icon className="h-3 w-3" aria-hidden="true" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/35 p-4 dark:border-emerald-800/60 dark:bg-[#041811]">
            {previewTab === 'in-app' && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={priority} />
                  <span className="text-xs font-medium text-emerald-900/65 dark:text-emerald-300/70">
                    {type}
                  </span>
                </div>
                <div className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
                  {title.trim() || 'Notice title preview appears here...'}
                </div>
                <p className="text-xs leading-relaxed text-emerald-950/80 dark:text-emerald-100/85 whitespace-pre-line">
                  {body.trim() ||
                    'Your message body will render here as attendees see it in their BAUST CSE Fest inbox.'}
                </p>
                {targeting.rooms.length > 0 && (
                  <div className="pt-1 text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                    Venues: {targeting.rooms.join(', ')}
                  </div>
                )}
              </div>
            )}

            {previewTab === 'mobile' && (
              <div className="mx-auto max-w-xs rounded-xl bg-[#042419] p-3.5 text-white border border-emerald-800/70">
                <div className="flex items-center justify-between text-[10px] text-emerald-200/60">
                  <span className="font-semibold text-emerald-300">
                    BAUST CSE FEST
                  </span>
                  <span>now</span>
                </div>
                <div className="mt-1 text-xs font-bold text-white line-clamp-2">
                  {priority === 'Emergency' ? 'EMERGENCY: ' : ''}
                  {title.trim() || 'Notice headline preview'}
                </div>
                <p className="mt-1 text-[11px] text-emerald-100/80 line-clamp-3">
                  {body.trim() || 'Push alert summary snippet...'}
                </p>
              </div>
            )}

            {previewTab === 'email' && (
              <div className="space-y-2 text-xs">
                <div className="border-b border-emerald-200/70 pb-2 space-y-1 dark:border-emerald-800/60">
                  <div className="text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                    From:{' '}
                    <span className="font-medium text-emerald-950 dark:text-emerald-100">
                      BAUST CSE Fest Dispatch &lt;notices@baust.edu.bd&gt;
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                    Subject:{' '}
                    <span className="font-semibold text-emerald-950 dark:text-emerald-50">
                      [BAUST CSE Fest] {title.trim() || 'Untitled Notice'}
                    </span>
                  </div>
                </div>
                <p className="text-emerald-950/80 dark:text-emerald-100/85 leading-relaxed whitespace-pre-line">
                  {body.trim() || 'Email notice body preview...'}
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-emerald-100 pt-3 space-y-2 text-xs dark:border-emerald-800/60">
            <div className="flex items-center justify-between">
              <span className="text-emerald-900/60 dark:text-emerald-300/65">Estimated Reach</span>
              <span className="font-mono font-bold text-emerald-950 dark:text-emerald-50 tabular-nums">
                {estimatedRecipients.toLocaleString()} recipients
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-emerald-900/60 dark:text-emerald-300/65">Dispatch Mode</span>
              <span className="font-medium text-emerald-950 dark:text-emerald-50 tabular-nums">
                {scheduleEnabled
                  ? formatDhakaDateTime(`${scheduledDateTime}:00+06:00`)
                  : 'Immediate (Simulated)'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1 pt-1">
              {channels.map((ch) => (
                <ChannelPill key={ch} channel={ch} compact />
              ))}
            </div>
          </div>

          <div className="border-t border-emerald-100 pt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-800/60">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50/70 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100 dark:hover:bg-[#09291E]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!validateBeforePublish('Draft')) return;
                  commitAnnouncement('Draft');
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-xs font-semibold text-emerald-950 hover:bg-emerald-50/70 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100 dark:hover:bg-[#09291E]"
              >
                <FileText
                  className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400"
                  aria-hidden="true"
                />
                Save Draft
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrimarySubmit}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 ${
                priority === 'Emergency'
                  ? 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600'
                  : 'bg-emerald-700 text-white hover:bg-emerald-600 focus-visible:ring-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500'
              }`}
            >
              {scheduleEnabled ? (
                <>
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                  Schedule Notice
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  Send Notice Now
                </>
              )}
            </button>
          </div>
        </aside>
      </div>

      <Modal
        open={emergencyModalOpen}
        onClose={() => setEmergencyModalOpen(false)}
        title="Confirm Emergency Alert Dispatch"
        subtitle="Emergency alerts bypass user quiet hours and trigger high-priority banners."
        dangerHeader
        footer={
          <>
            <button
              type="button"
              onClick={() => setEmergencyModalOpen(false)}
              className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-[#061D15] dark:text-emerald-100 dark:hover:bg-[#09291E]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!emergencyAck}
              onClick={() => {
                setEmergencyModalOpen(false);
                commitAnnouncement(pendingSubmitMode);
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-45"
            >
              Confirm &amp; Dispatch Emergency Alert
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs text-emerald-950 dark:text-emerald-50">
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-red-900 dark:border-red-800/70 dark:bg-red-950/50 dark:text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
            <div>
              Targeting <strong>{estimatedRecipients}</strong> recipients across{' '}
              <strong>{channels.join(', ')}</strong>.
            </div>
          </div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={emergencyAck}
              onChange={(e) => setEmergencyAck(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-red-600"
            />
            <span>
              I confirm this notice is an urgent campus, safety, or live contest interruption.
            </span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
