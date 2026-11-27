import { useMemo, useState } from 'react';
import {
  Copy,
  Edit3,
  Eye,
  Megaphone,
  PenSquare,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { PriorityBadge, StatusBadge } from '../components/Badge';
import { ChannelPill } from '../components/ChannelPill';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import {
  ALL_CHANNELS,
  ALL_NOTIFICATION_TYPES,
  BAUST_ROOMS,
  DEMO_ACCESS_ROLES,
} from '../data/mockData';
import type {
  Announcement,
  DeliveryStatus,
  NotificationChannel,
  NotificationType,
  UserRole,
} from '../types';
import {
  formatDhakaDateOnly,
  formatDhakaTimeOnly,
  formatPercent,
  summarizeTargeting,
} from '../utils/formatters';

interface AnnouncementsPageProps {
  announcements: Announcement[];
  onInspectAnnouncement: (id: string) => void;
  onEditAnnouncement: (announcement: Announcement) => void;
  onDuplicateAnnouncement: (announcement: Announcement) => void;
  onDeleteAnnouncement: (id: string) => void;
  onCreateNew: () => void;
}

const STATUS_TABS: (DeliveryStatus | 'All')[] = [
  'All',
  'Delivered',
  'Scheduled',
  'Failed',
  'Draft',
];

export function AnnouncementsPage({
  announcements,
  onInspectAnnouncement,
  onEditAnnouncement,
  onDuplicateAnnouncement,
  onDeleteAnnouncement,
  onCreateNew,
}: AnnouncementsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'All'>('All');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'All'>('All');
  const [channelFilter, setChannelFilter] = useState<NotificationChannel | 'All'>(
    'All'
  );
  const [audienceFilter, setAudienceFilter] = useState<UserRole | 'All'>('All');
  const [roomFilter, setRoomFilter] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: announcements.length,
      Delivered: 0,
      Scheduled: 0,
      Failed: 0,
      Draft: 0,
    };
    for (const a of announcements) {
      counts[a.status] = (counts[a.status] ?? 0) + 1;
    }
    return counts;
  }, [announcements]);

  const activeAdvancedCount = [
    typeFilter !== 'All',
    channelFilter !== 'All',
    audienceFilter !== 'All',
    roomFilter !== 'All',
    dateFilter !== '',
  ].filter(Boolean).length;

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'All' ||
    activeAdvancedCount > 0;

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setTypeFilter('All');
    setChannelFilter('All');
    setAudienceFilter('All');
    setRoomFilter('All');
    setDateFilter('');
  };

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((ann) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesText =
          ann.title.toLowerCase().includes(q) ||
          ann.body.toLowerCase().includes(q) ||
          ann.senderName.toLowerCase().includes(q) ||
          ann.targeting.rooms.some((r) => r.toLowerCase().includes(q)) ||
          ann.targeting.competitions.some((c) => c.toLowerCase().includes(q));
        if (!matchesText) return false;
      }

      if (statusFilter !== 'All' && ann.status !== statusFilter) return false;
      if (typeFilter !== 'All' && ann.type !== typeFilter) return false;
      if (channelFilter !== 'All' && !ann.channels.includes(channelFilter))
        return false;
      if (
        audienceFilter !== 'All' &&
        !ann.targeting.everyoneAttending &&
        !ann.targeting.roles.includes(audienceFilter)
      ) {
        return false;
      }
      if (roomFilter !== 'All' && !ann.targeting.rooms.includes(roomFilter)) {
        return false;
      }
      if (dateFilter) {
        const refDate = (
          ann.publishedAt ||
          ann.scheduledFor ||
          ann.createdAt
        ).slice(0, 10);
        if (refDate !== dateFilter) return false;
      }
      return true;
    });
  }, [
    announcements,
    searchQuery,
    statusFilter,
    typeFilter,
    channelFilter,
    audienceFilter,
    roomFilter,
    dateFilter,
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-emerald-950 dark:text-emerald-50">
            Announcements
          </h1>
          <p className="text-xs text-emerald-900/60 dark:text-emerald-300/65">
            Select a notice to inspect delivery logs or retry failed dispatches
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateNew}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 whitespace-nowrap shrink-0"
        >
          <PenSquare className="h-3.5 w-3.5" aria-hidden="true" />
          Create Notice
        </button>
      </div>

      <section className="rounded-xl border border-emerald-200/70 bg-white p-3.5 space-y-3 dark:border-emerald-800/60 dark:bg-[#061D15]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="tablist"
            aria-label="Filter by delivery status"
            className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-emerald-50/70 p-1 dark:bg-[#041811] dark:border dark:border-emerald-800/50"
          >
            {STATUS_TABS.map((tab) => {
              const active = statusFilter === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(tab)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-white text-emerald-950 shadow-sm dark:bg-[#0B2E22] dark:text-emerald-50'
                      : 'text-emerald-900/70 hover:text-emerald-950 dark:text-emerald-300/75 dark:hover:text-emerald-50'
                  }`}
                >
                  <span>{tab}</span>
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      active
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-emerald-900/45 dark:text-emerald-400/55'
                    }`}
                  >
                    {statusCounts[tab] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-1 lg:justify-end">
            <div className="relative flex-1 min-w-[210px] lg:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-700/60 dark:text-emerald-400/60"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, room, or sender..."
                className="w-full rounded-lg border border-emerald-200/80 bg-emerald-50/35 py-1.5 pl-8 pr-8 text-xs text-emerald-950 placeholder:text-slate-400 focus:border-emerald-700 focus:bg-white focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:placeholder:text-emerald-400/45 dark:focus:border-emerald-400 dark:focus:bg-[#041811]"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-700/60 hover:text-emerald-950 dark:text-emerald-400/70 dark:hover:text-emerald-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
              aria-expanded={showAdvancedFilters}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                showAdvancedFilters || activeAdvancedCount > 0
                  ? 'border-[#064E3B] bg-[#064E3B] text-white dark:border-emerald-500 dark:bg-emerald-600'
                  : 'border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100 dark:hover:bg-[#09291E]'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Filters
              {activeAdvancedCount > 0 && (
                <span className="font-mono text-[11px] text-emerald-300 dark:text-emerald-100 tabular-nums">
                  ({activeAdvancedCount})
                </span>
              )}
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-100 dark:hover:bg-[#09291E] whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Reset
              </button>
            )}
          </div>
        </div>

        {showAdvancedFilters && (
          <div className="grid grid-cols-1 gap-2.5 border-t border-emerald-100 pt-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 dark:border-emerald-800/60">
            <select
              aria-label="Filter by category"
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as NotificationType | 'All')
              }
              className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-950 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:focus:border-emerald-400"
            >
              <option value="All">Category: All</option>
              {ALL_NOTIFICATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by channel"
              value={channelFilter}
              onChange={(e) =>
                setChannelFilter(
                  e.target.value as NotificationChannel | 'All'
                )
              }
              className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-950 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:focus:border-emerald-400"
            >
              <option value="All">Channel: All</option>
              {ALL_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by audience role"
              value={audienceFilter}
              onChange={(e) =>
                setAudienceFilter(e.target.value as UserRole | 'All')
              }
              className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-950 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:focus:border-emerald-400"
            >
              <option value="All">Role: All</option>
              {DEMO_ACCESS_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by campus room"
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-950 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:focus:border-emerald-400"
            >
              <option value="All">Room: All</option>
              {BAUST_ROOMS.map((room) => (
                <option key={room} value={room}>
                  {room}
                </option>
              ))}
            </select>

            <input
              type="date"
              aria-label="Filter by date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-950 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:focus:border-emerald-400"
            />
          </div>
        )}
      </section>

      {filteredAnnouncements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No matching announcements found"
          description="Try clearing one or more filters, or compose a new announcement for BAUST CSE Fest attendees."
          actionLabel={hasActiveFilters ? 'Clear All Filters' : 'Create Notice'}
          onAction={hasActiveFilters ? resetFilters : onCreateNew}
        />
      ) : (
        <div className="rounded-xl border border-emerald-200/70 bg-white overflow-hidden dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-emerald-100 bg-emerald-50/45 text-xs font-semibold text-emerald-900/70 dark:border-emerald-800/60 dark:bg-[#041811] dark:text-emerald-200/80">
                  <th className="px-4 py-3">Notice &amp; Targeting</th>
                  <th className="px-3 py-3">Channels</th>
                  <th className="px-3 py-3">Priority &amp; Status</th>
                  <th className="px-3 py-3">Time (GMT+6)</th>
                  <th className="px-3 py-3 text-right">Engagement</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100/70 dark:divide-emerald-800/50">
                {filteredAnnouncements.map((ann) => {
                  const refTime =
                    ann.publishedAt || ann.scheduledFor || ann.createdAt;
                  return (
                    <tr
                      key={ann.id}
                      onClick={() => onInspectAnnouncement(ann.id)}
                      className="cursor-pointer transition-colors hover:bg-emerald-50/35 dark:hover:bg-[#09291E]/70"
                    >
                      <td className="px-4 py-3.5 max-w-md">
                        <div className="font-semibold text-emerald-950 dark:text-emerald-50 line-clamp-1">
                          {ann.title}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-emerald-900/60 dark:text-emerald-300/65">
                          <span>{ann.type}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-900/80 dark:text-emerald-200/80">
                            {summarizeTargeting(ann)}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {ann.channels.map((ch) => (
                            <ChannelPill key={ch} channel={ch} compact />
                          ))}
                        </div>
                      </td>

                      <td className="px-3 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <PriorityBadge priority={ann.priority} />
                          <StatusBadge status={ann.status} />
                        </div>
                      </td>

                      <td className="px-3 py-3.5 text-xs text-emerald-900/70 dark:text-emerald-200/80 tabular-nums whitespace-nowrap">
                        <div>{formatDhakaDateOnly(refTime)}</div>
                        <div className="font-mono text-[11px] text-emerald-900/55 dark:text-emerald-300/60">
                          {formatDhakaTimeOnly(refTime)}
                        </div>
                      </td>

                      <td className="px-3 py-3.5 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                        {ann.status === 'Draft' || ann.status === 'Scheduled' ? (
                          <span className="text-emerald-900/45 dark:text-emerald-300/55">
                            {ann.totalRecipients} queued
                          </span>
                        ) : (
                          <div>
                            <div className="font-semibold text-emerald-950 dark:text-emerald-50">
                              {ann.deliveredCount}/{ann.totalRecipients} deliv
                            </div>
                            <div className="text-emerald-900/60 dark:text-emerald-300/65">
                              {formatPercent(ann.readCount, ann.deliveredCount)}{' '}
                              read · {ann.clickCount} clicks
                            </div>
                            {ann.failedCount > 0 && (
                              <div className="font-semibold text-red-600 dark:text-red-400">
                                {ann.failedCount} failed
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td
                        className="px-4 py-3.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Inspect Delivery & Retry Queue"
                            aria-label={`Inspect ${ann.title}`}
                            onClick={() => onInspectAnnouncement(ann.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200/80 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-950 dark:border-emerald-800/70 dark:text-emerald-200 dark:hover:bg-emerald-900/60 dark:hover:text-emerald-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Edit Notice"
                            aria-label={`Edit ${ann.title}`}
                            onClick={() => onEditAnnouncement(ann)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200/80 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-950 dark:border-emerald-800/70 dark:text-emerald-200 dark:hover:bg-emerald-900/60 dark:hover:text-emerald-50"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Duplicate Notice"
                            aria-label={`Duplicate ${ann.title}`}
                            onClick={() => onDuplicateAnnouncement(ann)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200/80 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-950 dark:border-emerald-800/70 dark:text-emerald-200 dark:hover:bg-emerald-900/60 dark:hover:text-emerald-50"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Delete Notice"
                            aria-label={`Delete ${ann.title}`}
                            onClick={() => setDeleteTarget(ann)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200/80 text-red-600 hover:border-red-200 hover:bg-red-50 dark:border-emerald-800/70 dark:text-red-400 dark:hover:border-red-800/70 dark:hover:bg-red-950/60"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Announcement"
        subtitle="Remove this announcement and its delivery logs from the workspace?"
        dangerHeader
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-[#061D15] dark:text-emerald-100 dark:hover:bg-[#09291E]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (deleteTarget) {
                  onDeleteAnnouncement(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
            >
              Delete Notice
            </button>
          </>
        }
      >
        {deleteTarget && (
          <div className="space-y-2 text-xs text-emerald-900/80 dark:text-emerald-200/80">
            <p className="font-semibold text-emerald-950 dark:text-emerald-50">{deleteTarget.title}</p>
            <p className="text-emerald-900/65 dark:text-emerald-300/65">
              This removes the notice and its simulated delivery logs from the current session.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
