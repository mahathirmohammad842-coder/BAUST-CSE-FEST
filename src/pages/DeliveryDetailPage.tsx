import { useMemo, useState } from 'react';
import {
  Archive,
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  Eye,
  FileDown,
  FileText,
  History,
  Pin,
  Printer,
  RefreshCw,
  RotateCcw,
  Share2,
  Send,
  Star,
  Trash2,
} from 'lucide-react';
import { PriorityBadge, RoleBadge, StatusBadge } from '../components/Badge';
import { ChannelPill } from '../components/ChannelPill';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import type {
  Announcement,
  NotificationDelivery,
  NotificationDeliveryLogStatus,
  RetryHistoryEntry,
  WorkspaceRole,
} from '../types';
import type {
  NotificationActionName,
  PersonalNotificationState,
} from '../utils/notificationActions';
import {
  formatDhakaDateTime,
  formatPercent,
} from '../utils/formatters';

interface DeliveryDetailPageProps {
  announcements: Announcement[];
  selectedAnnouncement: Announcement;
  deliveries: NotificationDelivery[];
  retryHistory?: RetryHistoryEntry[];
  activeRole?: WorkspaceRole;
  currentUserId?: string | null;
  onSelectAnnouncement: (id: string) => void;
  onBackToList: () => void;
  onEditAnnouncement: (announcement: Announcement) => void;
  onDeleteAnnouncement?: (
    announcementId: string
  ) => Promise<string | null> | string | null | void;
  onRestoreAnnouncement?: (
    announcementId: string
  ) => Promise<string | null> | string | null | void;
  onPermanentDeleteAnnouncement?: (
    announcementId: string
  ) => Promise<string | null> | string | null | void;
  onRetryDelivery: (deliveryId: string) => void | Promise<void>;
  onRetryAllFailedForAnnouncement: (
    announcementId: string
  ) => void | Promise<void>;
  onPublishScheduledNow: (announcementId: string) => void | Promise<void>;
  personalStatus: PersonalNotificationState;
  onToggleRead: (nextRead: boolean) => void;
  onUpdatePersonalStatus: (
    patch: Partial<PersonalNotificationState>,
    action: NotificationActionName
  ) => void;
  onNotify: (message: string) => void;
}

function getDeliveryStatusBadgeStyle(status: NotificationDeliveryLogStatus): string {
  switch (status) {
    case 'Delivered':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300';
    case 'Failed':
      return 'bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300';
    case 'Pending':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
    case 'Gateway Not Configured':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300';
    case 'Skipped':
      return 'bg-emerald-50 text-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-200/70';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export function DeliveryDetailPage({
  announcements,
  selectedAnnouncement,
  deliveries,
  retryHistory = [],
  activeRole = 'Organizer',
  currentUserId,
  onSelectAnnouncement,
  onBackToList,
  onEditAnnouncement,
  onDeleteAnnouncement,
  onRestoreAnnouncement,
  onPermanentDeleteAnnouncement,
  onRetryDelivery,
  onRetryAllFailedForAnnouncement,
  onPublishScheduledNow,
  personalStatus,
  onToggleRead,
  onUpdatePersonalStatus,
  onNotify,
}: DeliveryDetailPageProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmPermanentOpen, setConfirmPermanentOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [retryBusyId, setRetryBusyId] = useState<string | null>(null);
  const [retryAllBusy, setRetryAllBusy] = useState(false);
  const [logFilter, setLogFilter] = useState<
    'all' | 'actionable' | 'delivered' | 'unconfigured'
  >('all');

  const canManageAnnouncement =
    activeRole === 'Super Admin' ||
    (activeRole === 'Organizer' &&
      (!selectedAnnouncement.senderId ||
        !currentUserId ||
        selectedAnnouncement.senderId === currentUserId));
  const canManageAnnouncementDelete = canManageAnnouncement;

  const announcementDeliveries = useMemo(
    () =>
      deliveries.filter(
        (d) => d.announcementId === selectedAnnouncement.id
      ),
    [deliveries, selectedAnnouncement.id]
  );

  const retryableDeliveries = useMemo(
    () =>
      announcementDeliveries.filter(
        (d) =>
          d.status === 'Failed' ||
          d.status === 'Pending' ||
          d.status === 'Gateway Not Configured'
      ),
    [announcementDeliveries]
  );

  const failedDeliveries = useMemo(
    () => announcementDeliveries.filter((d) => d.status === 'Failed'),
    [announcementDeliveries]
  );

  const filteredDeliveries = useMemo(() => {
    switch (logFilter) {
      case 'actionable':
        return retryableDeliveries;
      case 'delivered':
        return announcementDeliveries.filter((d) => d.status === 'Delivered');
      case 'unconfigured':
        return announcementDeliveries.filter(
          (d) =>
            d.status === 'Gateway Not Configured' || d.status === 'Skipped'
        );
      default:
        return announcementDeliveries;
    }
  }, [announcementDeliveries, logFilter, retryableDeliveries]);

  const announcementRetryHistory = useMemo(
    () =>
      retryHistory.filter(
        (entry) => entry.announcementId === selectedAnnouncement.id
      ),
    [retryHistory, selectedAnnouncement.id]
  );

  const copyText = async (text: string, successMessage: string) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard access is unavailable in this browser.');
      }
      await navigator.clipboard.writeText(text);
      onUpdatePersonalStatus({}, 'copied');
      onNotify(successMessage);
    } catch {
      onNotify('Could not access the clipboard. Check browser permissions.');
    }
  };

  const noticeText = `${selectedAnnouncement.title}\n${selectedAnnouncement.type} · ${selectedAnnouncement.category}\nFrom: ${selectedAnnouncement.senderName}\n\n${selectedAnnouncement.body}`;
  const noticeLink = `${window.location.origin}${window.location.pathname}#notification=${encodeURIComponent(selectedAnnouncement.id)}`;
  const shareNotice = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: selectedAnnouncement.title,
          text: noticeText,
          url: noticeLink,
        });
        onUpdatePersonalStatus({}, 'shared');
      } else {
        await copyText(noticeLink, 'Notice link copied to clipboard.');
        onUpdatePersonalStatus({}, 'shared');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      onNotify('Could not share this notice. Check browser permissions.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToList}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-100 dark:hover:bg-[#09291E] whitespace-nowrap"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            All Announcements
          </button>

          <select
            aria-label="Select announcement to inspect"
            value={selectedAnnouncement.id}
            onChange={(e) => onSelectAnnouncement(e.target.value)}
            className="max-w-xs sm:max-w-md rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-950 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:focus:border-emerald-400 truncate"
          >
            {announcements.map((a) => (
              <option key={a.id} value={a.id}>
                [{a.status}] {a.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {canManageAnnouncement &&
            (selectedAnnouncement.status === 'Scheduled' ||
              selectedAnnouncement.status === 'Draft') && (
              <button
                type="button"
                onClick={() => void onPublishScheduledNow(selectedAnnouncement.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 whitespace-nowrap"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                Dispatch Now
              </button>
            )}
          {canManageAnnouncement && (
            <button
              type="button"
              onClick={() => onEditAnnouncement(selectedAnnouncement)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-100 dark:hover:bg-[#09291E] whitespace-nowrap"
            >
              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
              Edit Notice
            </button>
          )}
          {selectedAnnouncement.trashedAt ? (
            <>
              {onRestoreAnnouncement && (
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={async () => {
                    setDeleteBusy(true);
                    setDeleteError(null);
                    try {
                      const err = await onRestoreAnnouncement(selectedAnnouncement.id);
                      if (typeof err === 'string' && err) {
                        setDeleteError(err);
                      }
                    } finally {
                      setDeleteBusy(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-200 whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Restore Notice
                </button>
              )}
              {canManageAnnouncementDelete && onPermanentDeleteAnnouncement && (
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => {
                    setDeleteError(null);
                    setConfirmPermanentOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Delete Forever
                </button>
              )}
            </>
          ) : (
            canManageAnnouncementDelete &&
            onDeleteAnnouncement && (
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => {
                  setDeleteError(null);
                  setConfirmDeleteOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:bg-[#061D15] dark:text-red-300 dark:hover:bg-red-950/30 whitespace-nowrap"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Delete Announcement
              </button>
            )
          )}
        </div>
      </div>

      {deleteError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-800 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-300"
        >
          {deleteError}
        </div>
      )}

      {selectedAnnouncement.trashedAt && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          This announcement is in the Recycle Bin (soft-deleted {formatDhakaDateTime(selectedAnnouncement.trashedAt)}
          {selectedAnnouncement.trashedBy ? ` by ${selectedAnnouncement.trashedBy}` : ''}).
        </div>
      )}

      <section className="rounded-xl border border-emerald-200/70 bg-white p-6 dark:border-emerald-800/60 dark:bg-[#061D15]">
        <div className="flex flex-wrap items-center gap-2.5">
          <PriorityBadge priority={selectedAnnouncement.priority} />
          <StatusBadge status={selectedAnnouncement.status} />
          <span className="text-xs text-emerald-900/35 dark:text-emerald-400/40" aria-hidden="true">
            ·
          </span>
          <span className="text-xs font-medium text-emerald-900/70 dark:text-emerald-200/80">
            {selectedAnnouncement.category} / {selectedAnnouncement.type}
          </span>
          <span className="text-xs text-emerald-900/35 dark:text-emerald-400/40" aria-hidden="true">
            ·
          </span>
          <span className="font-mono text-xs text-emerald-900/55 dark:text-emerald-300/65">
            {selectedAnnouncement.id.toUpperCase()}
          </span>
        </div>

        <h2 className="mt-3 font-display text-xl font-bold text-emerald-950 dark:text-emerald-50">
          {selectedAnnouncement.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-emerald-900/80 dark:text-emerald-100/85">
          {selectedAnnouncement.body}
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-emerald-100 pt-4 text-xs sm:grid-cols-2 lg:grid-cols-4 dark:border-emerald-800/60">
          <div>
            <div className="text-emerald-900/60 dark:text-emerald-300/65">Dispatched / Scheduled (BST)</div>
            <div className="mt-1 font-medium text-emerald-950 dark:text-emerald-50 tabular-nums">
              {formatDhakaDateTime(
                selectedAnnouncement.publishedAt ||
                  selectedAnnouncement.scheduledFor ||
                  selectedAnnouncement.createdAt
              )}
            </div>
          </div>
          <div>
            <div className="text-emerald-900/60 dark:text-emerald-300/65">Sender</div>
            <div className="mt-1 font-medium text-emerald-950 dark:text-emerald-50">
              {selectedAnnouncement.senderName} ({selectedAnnouncement.senderRole})
            </div>
          </div>
          <div>
            <div className="text-emerald-900/60 dark:text-emerald-300/65">Targeted Roles &amp; Venues</div>
            <div className="mt-1 font-medium text-emerald-950 dark:text-emerald-50">
              {selectedAnnouncement.targeting.everyoneAttending
                ? 'Everyone Attending BAUST CSE Fest'
                : [
                    ...selectedAnnouncement.targeting.roles,
                    ...selectedAnnouncement.targeting.rooms,
                  ].join(', ') || 'Custom Segment'}
            </div>
          </div>
          <div>
            <div className="text-emerald-900/60 dark:text-emerald-300/65">Expiration Window</div>
            <div className="mt-1 font-medium text-emerald-950 dark:text-emerald-50 tabular-nums">
              {selectedAnnouncement.expiresAt
                ? formatDhakaDateTime(selectedAnnouncement.expiresAt)
                : 'No expiration set'}
            </div>
          </div>
        </div>

        {selectedAnnouncement.attachments.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-emerald-100 pt-4 dark:border-emerald-800/60">
            <span className="text-xs font-semibold text-emerald-900/75 dark:text-emerald-200/80">
              Attachments:
            </span>
            {selectedAnnouncement.attachments.map((att) => (
              <span
                key={att.id}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/45 px-3 py-1.5 text-xs text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100"
              >
                <FileText className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <span className="font-medium">{att.fileName}</span>
                <span className="text-emerald-900/50 dark:text-emerald-300/60">({att.fileSizeLabel})</span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-800 dark:text-emerald-300 tabular-nums" aria-label={`${att.viewCount ?? 0} views`}>
                  <Eye className="h-3 w-3" aria-hidden="true" />
                  {att.viewCount ?? 0}
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-800 dark:text-emerald-300 tabular-nums" aria-label={`${att.downloadCount} downloads`}>
                  <Download className="h-3 w-3" aria-hidden="true" />
                  {att.downloadCount}
                </span>
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-emerald-100 pt-4 dark:border-emerald-800/60">
          <button
            type="button"
            aria-pressed={personalStatus.starred}
            onClick={() =>
              onUpdatePersonalStatus(
                { starred: !personalStatus.starred },
                personalStatus.starred ? 'unstarred' : 'starred'
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 aria-pressed:bg-amber-50 aria-pressed:text-amber-800 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-[#09291E] dark:aria-pressed:bg-amber-950/30 dark:aria-pressed:text-amber-300"
          >
            <Star className={`h-3.5 w-3.5 ${personalStatus.starred ? 'fill-current' : ''}`} aria-hidden="true" />
            {personalStatus.starred ? 'Unstar' : 'Star'}
          </button>
          <button
            type="button"
            aria-pressed={personalStatus.saved}
            onClick={() =>
              onUpdatePersonalStatus(
                { saved: !personalStatus.saved },
                personalStatus.saved ? 'unsaved' : 'saved'
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-[#09291E]"
          >
            <Bookmark className={`h-3.5 w-3.5 ${personalStatus.saved ? 'fill-current' : ''}`} aria-hidden="true" />
            {personalStatus.saved ? 'Unsave' : 'Save'}
          </button>
          <button
            type="button"
            aria-pressed={personalStatus.read}
            onClick={() => onToggleRead(!personalStatus.read)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-[#09291E]"
          >
            {personalStatus.read ? 'Mark unread' : 'Mark read'}
          </button>
          <button
            type="button"
            aria-pressed={personalStatus.pinned}
            onClick={() =>
              onUpdatePersonalStatus(
                { pinned: !personalStatus.pinned },
                personalStatus.pinned ? 'unpinned' : 'pinned'
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-[#09291E]"
          >
            <Pin className="h-3.5 w-3.5" aria-hidden="true" />
            {personalStatus.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            type="button"
            aria-pressed={personalStatus.archived}
            onClick={() =>
              onUpdatePersonalStatus(
                { archived: !personalStatus.archived },
                personalStatus.archived ? 'unarchived' : 'archived'
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-[#09291E]"
          >
            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            {personalStatus.archived ? 'Unarchive' : 'Archive'}
          </button>
          {selectedAnnouncement.trashedAt ? (
            <>
              {onRestoreAnnouncement && (
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={async () => {
                    setDeleteBusy(true);
                    setDeleteError(null);
                    try {
                      const err = await onRestoreAnnouncement(selectedAnnouncement.id);
                      if (typeof err === 'string' && err) {
                        setDeleteError(err);
                      }
                    } finally {
                      setDeleteBusy(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-200 dark:hover:bg-[#09291E]"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Restore
                </button>
              )}
            </>
          ) : canManageAnnouncementDelete && onDeleteAnnouncement ? (
            <button
              type="button"
              disabled={deleteBusy}
              onClick={() => {
                setDeleteError(null);
                setConfirmDeleteOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete
            </button>
          ) : null}
          <span className="mx-1 hidden h-5 w-px bg-emerald-200 sm:block dark:bg-emerald-800/70" />
          <button
            type="button"
            onClick={() => void copyText(noticeLink, 'Notice link copied to clipboard.')}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-[#09291E]"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            Copy link
          </button>
          <button
            type="button"
            onClick={() => void copyText(noticeText, 'Notice content copied to clipboard.')}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-[#09291E]"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            Copy content
          </button>
          <button
            type="button"
            onClick={() => void shareNotice()}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-[#09291E]"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            Share
          </button>
          <button
            type="button"
            onClick={() => {
              onUpdatePersonalStatus({}, 'printed');
              window.print();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-[#09291E]"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            Print
          </button>
          <button
            type="button"
            onClick={() => {
              onUpdatePersonalStatus({}, 'exported');
              window.print();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-[#09291E]"
          >
            <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
            Save as PDF
          </button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-emerald-200/70 bg-white p-4 dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="text-xs font-medium text-emerald-900/60 dark:text-emerald-300/65">Targeted Audience</div>
          <div className="mt-1.5 font-display text-2xl font-bold text-emerald-950 dark:text-emerald-50 tabular-nums">
            {selectedAnnouncement.totalRecipients.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200/70 bg-white p-4 dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="text-xs font-medium text-emerald-900/60 dark:text-emerald-300/65">Delivered</div>
          <div className="mt-1.5 font-display text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {selectedAnnouncement.deliveredCount.toLocaleString()}
            <span className="ml-2 text-xs font-medium text-emerald-900/55 dark:text-emerald-300/65">
              ({formatPercent(
                selectedAnnouncement.deliveredCount,
                selectedAnnouncement.totalRecipients
              )})
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200/70 bg-white p-4 dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="text-xs font-medium text-emerald-900/60 dark:text-emerald-300/65">Read / Opened</div>
          <div className="mt-1.5 font-display text-2xl font-bold text-emerald-950 dark:text-emerald-50 tabular-nums">
            {selectedAnnouncement.readCount.toLocaleString()}
            <span className="ml-2 text-xs font-medium text-emerald-900/55 dark:text-emerald-300/65">
              ({formatPercent(
                selectedAnnouncement.readCount,
                selectedAnnouncement.deliveredCount
              )})
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200/70 bg-white p-4 dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="text-xs font-medium text-emerald-900/60 dark:text-emerald-300/65">Click-Throughs</div>
          <div className="mt-1.5 font-display text-2xl font-bold text-teal-700 dark:text-teal-400 tabular-nums">
            {selectedAnnouncement.clickCount.toLocaleString()}
            <span className="ml-2 text-xs font-medium text-emerald-900/55 dark:text-emerald-300/65">
              ({formatPercent(
                selectedAnnouncement.clickCount,
                selectedAnnouncement.deliveredCount
              )})
            </span>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-emerald-200/70 bg-white overflow-hidden dark:border-emerald-800/60 dark:bg-[#061D15]">
        <div className="border-b border-emerald-100 px-5 py-4 dark:border-emerald-800/60">
          <h3 className="font-display text-base font-bold text-emerald-950 dark:text-emerald-50">
            Per-Channel Delivery &amp; Click Breakdown
          </h3>
          <p className="text-xs text-emerald-900/60 dark:text-emerald-300/65">
            Dispatch metrics across selected delivery gateways
          </p>
        </div>

        {selectedAnnouncement.channelBreakdown.length === 0 ? (
          <div className="p-6 text-sm text-emerald-900/60 dark:text-emerald-300/65">
            This notice has not been dispatched yet ({selectedAnnouncement.status}). Breakdown metrics populate automatically upon dispatch.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-emerald-100 bg-emerald-50/45 text-xs font-semibold text-emerald-900/70 dark:border-emerald-800/60 dark:bg-[#041811] dark:text-emerald-200/80">
                  <th className="px-5 py-3">Channel</th>
                  <th className="px-4 py-3 text-right">Targeted</th>
                  <th className="px-4 py-3 text-right">Delivered</th>
                  <th className="px-4 py-3 text-right">Pending</th>
                  <th className="px-4 py-3 text-right">Failed</th>
                  <th className="px-4 py-3 text-right">Read Rate</th>
                  <th className="px-5 py-3 text-right">Click Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100/70 dark:divide-emerald-800/50 tabular-nums">
                {selectedAnnouncement.channelBreakdown.map((row) => (
                  <tr key={row.channel} className="hover:bg-emerald-50/35 dark:hover:bg-[#09291E]/70">
                    <td className="px-5 py-3.5">
                      <ChannelPill channel={row.channel} />
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-emerald-900/75 dark:text-emerald-200/80">
                      {row.targetedCount}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      {row.deliveredCount}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-emerald-900/65 dark:text-emerald-300/65">
                      {row.pendingCount}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-red-600 dark:text-red-400">
                      {row.failedCount}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-emerald-900/75 dark:text-emerald-200/80">
                      {formatPercent(row.readCount, row.deliveredCount)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-xs font-semibold text-emerald-950 dark:text-emerald-50">
                      {formatPercent(row.clickCount, row.deliveredCount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-emerald-200/70 bg-white overflow-hidden dark:border-emerald-800/60 dark:bg-[#061D15]">
        <div className="flex flex-col gap-3 border-b border-emerald-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-800/60">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={`h-4 w-4 ${
                  failedDeliveries.length > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
                aria-hidden="true"
              />
              <h3 className="font-display text-base font-bold text-emerald-950 dark:text-emerald-50">
                Delivery Logs &amp; Gateway Retry Queue
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-emerald-900/60 dark:text-emerald-300/65">
              Live per-recipient delivery status across In-App, Email, SMS, Push, and Web channels.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-emerald-200/80 bg-emerald-50/60 p-0.5 dark:border-emerald-800/70 dark:bg-[#041811]">
              {(
                [
                  { id: 'all', label: `All (${announcementDeliveries.length})` },
                  { id: 'actionable', label: `Retryable (${retryableDeliveries.length})` },
                  { id: 'delivered', label: 'Delivered' },
                  { id: 'unconfigured', label: 'Not Configured / Skipped' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLogFilter(tab.id)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    logFilter === tab.id
                      ? 'bg-[#064E3B] text-white dark:bg-emerald-600'
                      : 'text-emerald-900/70 hover:text-emerald-950 dark:text-emerald-200/70'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {canManageAnnouncement && retryableDeliveries.length > 0 && (
              <button
                type="button"
                disabled={retryAllBusy}
                onClick={async () => {
                  setRetryAllBusy(true);
                  try {
                    await onRetryAllFailedForAnnouncement(selectedAnnouncement.id);
                  } finally {
                    setRetryAllBusy(false);
                  }
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${retryAllBusy ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {retryAllBusy
                  ? 'Retrying…'
                  : `Retry All (${retryableDeliveries.length})`}
              </button>
            )}
          </div>
        </div>

        {filteredDeliveries.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={CheckCircle2}
              title={
                announcementDeliveries.length === 0
                  ? 'No delivery log entries recorded yet'
                  : 'No matching delivery logs for this filter'
              }
              description={
                announcementDeliveries.length === 0
                  ? 'Real delivery logs are generated automatically when an announcement is dispatched.'
                  : 'Switch the status tab above to inspect other delivery attempts.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-emerald-100 bg-emerald-50/45 text-xs font-semibold text-emerald-900/70 dark:border-emerald-800/60 dark:bg-[#041811] dark:text-emerald-200/80">
                  <th className="px-5 py-3">Recipient</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Gateway / Details</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100/70 dark:divide-emerald-800/50">
                {filteredDeliveries.map((del) => {
                  const canRetryRow =
                    del.status === 'Failed' ||
                    del.status === 'Pending' ||
                    del.status === 'Gateway Not Configured';
                  return (
                    <tr
                      key={del.id}
                      className="hover:bg-emerald-50/35 dark:hover:bg-[#09291E]/70"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-emerald-950 dark:text-emerald-50">
                            {del.recipientName}
                          </span>
                          <RoleBadge role={del.recipientRole} />
                        </div>
                        <div className="mt-0.5 font-mono text-xs text-emerald-900/60 dark:text-emerald-300/65">
                          {del.recipientContact}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <ChannelPill channel={del.channel} />
                      </td>
                      <td className="px-4 py-3.5">
                        {del.errorCode ? (
                          <div>
                            <span
                              className={`inline-flex rounded px-2 py-0.5 font-mono text-xs font-semibold ${
                                del.status === 'Failed'
                                  ? 'bg-red-50 text-red-700 dark:bg-red-950/70 dark:text-red-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300'
                              }`}
                            >
                              {del.errorCode}
                            </span>
                            {del.errorMessage && (
                              <div className="mt-1 max-w-xs text-xs text-emerald-900/65 dark:text-emerald-200/75">
                                {del.errorMessage}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            {del.gatewayProvider ?? 'supabase-realtime-in-app'}
                            {del.deliveredAt
                              ? ` · ${formatDhakaDateTime(del.deliveredAt)}`
                              : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getDeliveryStatusBadgeStyle(del.status)}`}
                        >
                          {del.status}
                        </span>
                        <div className="mt-1 font-mono text-[11px] tabular-nums text-emerald-900/50 dark:text-emerald-300/55">
                          Attempts: {del.attemptCount}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {canManageAnnouncement && canRetryRow ? (
                          <button
                            type="button"
                            disabled={retryBusyId === del.id}
                            onClick={async () => {
                              setRetryBusyId(del.id);
                              try {
                                await onRetryDelivery(del.id);
                              } finally {
                                setRetryBusyId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100 dark:hover:bg-[#09291E]"
                          >
                            <RefreshCw
                              className={`h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 ${
                                retryBusyId === del.id ? 'animate-spin' : ''
                              }`}
                              aria-hidden="true"
                            />
                            {retryBusyId === del.id ? 'Retrying…' : 'Retry Failed'}
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            {del.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {announcementRetryHistory.length > 0 && (
        <section className="rounded-xl border border-emerald-200/70 bg-white overflow-hidden dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="flex items-center gap-2 border-b border-emerald-100 px-5 py-4 dark:border-emerald-800/60">
            <History className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            <div>
              <h3 className="font-display text-base font-bold text-emerald-950 dark:text-emerald-50">
                Retry Attempt History
              </h3>
              <p className="text-xs text-emerald-900/60 dark:text-emerald-300/65">
                Recorded gateway retry executions for this announcement
              </p>
            </div>
          </div>
          <div className="divide-y divide-emerald-100/70 dark:divide-emerald-800/50">
            {announcementRetryHistory.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 px-5 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <ChannelPill channel={item.channel} />
                  <span className="font-mono font-semibold text-emerald-950 dark:text-emerald-100">
                    Attempt #{item.attemptNumber}
                  </span>
                  <span className="text-emerald-900/65 dark:text-emerald-200/70">
                    {item.previousStatus} →{' '}
                    <strong className="text-emerald-950 dark:text-emerald-50">
                      {item.newStatus}
                    </strong>
                  </span>
                  {item.errorMessage && (
                    <span className="text-emerald-900/60 dark:text-emerald-300/65">
                      ({item.errorMessage})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-emerald-900/60 dark:text-emerald-300/65">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{item.retriedByName}</span>
                  <span>·</span>
                  <span>{formatDhakaDateTime(item.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Modal
        open={confirmDeleteOpen}
        onClose={() => !deleteBusy && setConfirmDeleteOpen(false)}
        title="Move Announcement to Recycle Bin"
        subtitle="Soft-delete removes this notice from active attendee inboxes and records an audit log."
        dangerHeader
        footer={
          <>
            <button
              type="button"
              disabled={deleteBusy}
              onClick={() => setConfirmDeleteOpen(false)}
              className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-[#061D15] dark:text-emerald-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleteBusy}
              onClick={async () => {
                if (!onDeleteAnnouncement) return;
                setDeleteBusy(true);
                setDeleteError(null);
                try {
                  const err = await onDeleteAnnouncement(selectedAnnouncement.id);
                  if (typeof err === 'string' && err) {
                    setDeleteError(err);
                    setConfirmDeleteOpen(false);
                  } else {
                    setConfirmDeleteOpen(false);
                    onBackToList();
                  }
                } finally {
                  setDeleteBusy(false);
                }
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteBusy ? 'Moving to Recycle Bin…' : 'Confirm Soft Delete'}
            </button>
          </>
        }
      >
        <div className="space-y-2 text-xs text-emerald-900/80 dark:text-emerald-200/80">
          <p className="font-semibold text-emerald-950 dark:text-emerald-50">
            {selectedAnnouncement.title}
          </p>
          <p className="text-emerald-900/65 dark:text-emerald-300/65">
            This announcement will be soft-deleted and placed into the Recycle Bin. You can restore it or permanently purge it at any time.
          </p>
        </div>
      </Modal>

      <Modal
        open={confirmPermanentOpen}
        onClose={() => !deleteBusy && setConfirmPermanentOpen(false)}
        title="Permanently Delete Announcement"
        subtitle="This action cannot be undone and purges the notice from the database."
        dangerHeader
        footer={
          <>
            <button
              type="button"
              disabled={deleteBusy}
              onClick={() => setConfirmPermanentOpen(false)}
              className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-[#061D15] dark:text-emerald-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleteBusy}
              onClick={async () => {
                if (!onPermanentDeleteAnnouncement) return;
                setDeleteBusy(true);
                setDeleteError(null);
                try {
                  const err = await onPermanentDeleteAnnouncement(
                    selectedAnnouncement.id
                  );
                  if (typeof err === 'string' && err) {
                    setDeleteError(err);
                    setConfirmPermanentOpen(false);
                  } else {
                    setConfirmPermanentOpen(false);
                    onBackToList();
                  }
                } finally {
                  setDeleteBusy(false);
                }
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteBusy ? 'Deleting Forever…' : 'Permanently Delete'}
            </button>
          </>
        }
      >
        <div className="space-y-2 text-xs text-emerald-900/80 dark:text-emerald-200/80">
          <p className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {selectedAnnouncement.title}
          </p>
          <p className="text-emerald-900/65 dark:text-emerald-300/65">
            An immutable Permanent Delete audit log entry will be recorded before purging.
          </p>
        </div>
      </Modal>
    </div>
  );
}
