import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Edit3,
  FileText,
  RefreshCw,
  Send,
} from 'lucide-react';
import { PriorityBadge, RoleBadge, StatusBadge } from '../components/Badge';
import { ChannelPill } from '../components/ChannelPill';
import { EmptyState } from '../components/EmptyState';
import type { Announcement, NotificationDelivery } from '../types';
import {
  formatDhakaDateTime,
  formatPercent,
} from '../utils/formatters';

interface DeliveryDetailPageProps {
  announcements: Announcement[];
  selectedAnnouncement: Announcement;
  deliveries: NotificationDelivery[];
  onSelectAnnouncement: (id: string) => void;
  onBackToList: () => void;
  onEditAnnouncement: (announcement: Announcement) => void;
  onRetryDelivery: (deliveryId: string) => void;
  onRetryAllFailedForAnnouncement: (announcementId: string) => void;
  onPublishScheduledNow: (announcementId: string) => void;
}

export function DeliveryDetailPage({
  announcements,
  selectedAnnouncement,
  deliveries,
  onSelectAnnouncement,
  onBackToList,
  onEditAnnouncement,
  onRetryDelivery,
  onRetryAllFailedForAnnouncement,
  onPublishScheduledNow,
}: DeliveryDetailPageProps) {
  const announcementDeliveries = deliveries.filter(
    (d) => d.announcementId === selectedAnnouncement.id
  );
  const failedDeliveries = announcementDeliveries.filter(
    (d) => d.status === 'Failed'
  );
  const retriedDeliveries = announcementDeliveries.filter(
    (d) => d.status === 'Delivered' && d.attemptCount > 1
  );

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
          {(selectedAnnouncement.status === 'Scheduled' ||
            selectedAnnouncement.status === 'Draft') && (
            <button
              type="button"
              onClick={() => onPublishScheduledNow(selectedAnnouncement.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 whitespace-nowrap"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              Dispatch Now (Simulated)
            </button>
          )}
          <button
            type="button"
            onClick={() => onEditAnnouncement(selectedAnnouncement)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-100 dark:hover:bg-[#09291E] whitespace-nowrap"
          >
            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
            Edit Notice
          </button>
        </div>
      </div>

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
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-800 dark:text-emerald-300 tabular-nums">
                  <Download className="h-3 w-3" aria-hidden="true" />
                  {att.downloadCount}
                </span>
              </span>
            ))}
          </div>
        )}
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
            This notice has not been dispatched yet ({selectedAnnouncement.status}). Breakdown metrics will populate immediately upon simulated send.
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
                  failedDeliveries.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}
                aria-hidden="true"
              />
              <h3 className="font-display text-base font-bold text-emerald-950 dark:text-emerald-50">
                Failed Deliveries &amp; Gateway Retry Queue
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-emerald-900/60 dark:text-emerald-300/65">
              Retry failed SMS, Push, or Email dispatches in real time.
            </p>
          </div>

          {failedDeliveries.length > 0 && (
            <button
              type="button"
              onClick={() =>
                onRetryAllFailedForAnnouncement(selectedAnnouncement.id)
              }
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 whitespace-nowrap shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry All Failed ({failedDeliveries.length})
            </button>
          )}
        </div>

        {failedDeliveries.length === 0 && retriedDeliveries.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={CheckCircle2}
              title="Zero failed deliveries for this announcement"
              description="All targeted recipients for this notice were reached cleanly without gateway errors."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-emerald-100 bg-emerald-50/45 text-xs font-semibold text-emerald-900/70 dark:border-emerald-800/60 dark:bg-[#041811] dark:text-emerald-200/80">
                  <th className="px-5 py-3">Recipient</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Gateway Error Code</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100/70 dark:divide-emerald-800/50">
                {[...failedDeliveries, ...retriedDeliveries].map((del) => (
                  <tr key={del.id} className="hover:bg-emerald-50/35 dark:hover:bg-[#09291E]/70">
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
                          <span className="inline-flex rounded bg-red-50 px-2 py-0.5 font-mono text-xs font-semibold text-red-700 dark:bg-red-950/70 dark:text-red-300">
                            {del.errorCode}
                          </span>
                          <div className="mt-1 text-xs text-emerald-900/65 dark:text-emerald-200/75 max-w-xs">
                            {del.errorMessage}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                          Resolved on attempt #{del.attemptCount}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {del.status === 'Failed' ? (
                        <StatusBadge status="Failed" />
                      ) : (
                        <StatusBadge status="Retried" />
                      )}
                      <div className="mt-1 font-mono text-[11px] text-emerald-900/50 dark:text-emerald-300/55 tabular-nums">
                        Attempts: {del.attemptCount}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      {del.status === 'Failed' ? (
                        <button
                          type="button"
                          onClick={() => onRetryDelivery(del.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-50 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100 dark:hover:bg-[#09291E]"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                          Retry Failed
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          Delivered
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
