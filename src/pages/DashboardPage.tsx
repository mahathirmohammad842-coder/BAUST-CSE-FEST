import { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  MousePointerClick,
  PenSquare,
  Send,
  X,
} from 'lucide-react';
import { PriorityBadge, StatusBadge } from '../components/Badge';
import { ChannelPill } from '../components/ChannelPill';
import { StatCard } from '../components/StatCard';
import { ALL_CHANNELS, DAILY_ENGAGEMENT_TREND } from '../data/mockData';
import type {
  ActivityFeedEntry,
  Announcement,
  NotificationChannel,
} from '../types';
import {
  formatDhakaTimeOnly,
  formatPercent,
  summarizeTargeting,
} from '../utils/formatters';

interface DashboardPageProps {
  announcements: Announcement[];
  activityFeed: ActivityFeedEntry[];
  failedCount: number;
  onCreateAnnouncement: () => void;
  onInspectAnnouncement: (announcementId: string) => void;
  onViewAllAnnouncements: () => void;
}

export function DashboardPage({
  announcements,
  activityFeed,
  failedCount,
  onCreateAnnouncement,
  onInspectAnnouncement,
  onViewAllAnnouncements,
}: DashboardPageProps) {
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number>(
    DAILY_ENGAGEMENT_TREND.length - 1
  );
  const [selectedChannel, setSelectedChannel] = useState<
    NotificationChannel | 'All'
  >('All');

  const totals = useMemo(() => {
    const active = announcements.filter(
      (a) => a.status !== 'Draft' && a.status !== 'Scheduled'
    );
    const totalSent = active.reduce((sum, a) => sum + a.totalRecipients, 0);
    const totalDelivered = active.reduce((sum, a) => sum + a.deliveredCount, 0);
    const totalRead = active.reduce((sum, a) => sum + a.readCount, 0);
    const totalClicked = active.reduce((sum, a) => sum + a.clickCount, 0);
    return {
      totalSent,
      totalDelivered,
      totalRead,
      totalClicked,
      deliveredRate: formatPercent(totalDelivered, totalSent),
      readRate: formatPercent(totalRead, totalDelivered),
      ctr: formatPercent(totalClicked, totalDelivered),
    };
  }, [announcements]);

  const firstFailedAnnouncementId = useMemo(() => {
    return announcements.find((a) => a.failedCount > 0)?.id ?? null;
  }, [announcements]);

  const channelStats = useMemo(() => {
    return ALL_CHANNELS.map((channel) => {
      let targeted = 0;
      let delivered = 0;
      let failed = 0;
      let read = 0;
      let clicked = 0;
      for (const ann of announcements) {
        if (ann.status === 'Draft' || ann.status === 'Scheduled') continue;
        const row = ann.channelBreakdown.find((c) => c.channel === channel);
        if (row) {
          targeted += row.targetedCount;
          delivered += row.deliveredCount;
          failed += row.failedCount;
          read += row.readCount;
          clicked += row.clickCount;
        }
      }
      return {
        channel,
        targeted,
        delivered,
        failed,
        read,
        clicked,
        deliveryPct: targeted > 0 ? (delivered / targeted) * 100 : 0,
      };
    });
  }, [announcements]);

  const filteredRecentAnnouncements = useMemo(() => {
    const list =
      selectedChannel === 'All'
        ? announcements
        : announcements.filter((a) => a.channels.includes(selectedChannel));
    return list.slice(0, 5);
  }, [announcements, selectedChannel]);

  const filteredActivityFeed = useMemo(() => {
    if (selectedChannel === 'All') return activityFeed;
    return activityFeed.filter((entry) => entry.channel === selectedChannel);
  }, [activityFeed, selectedChannel]);

  const maxTrendValue = Math.max(
    ...DAILY_ENGAGEMENT_TREND.map((d) => d.sent),
    1
  );
  const svgWidth = 600;
  const svgHeight = 196;
  const padX = 38;
  const padY = 18;
  const chartW = svgWidth - padX * 2;
  const chartH = svgHeight - padY * 2;

  const getCoords = (index: number, value: number) => {
    const x =
      padX +
      (index / Math.max(DAILY_ENGAGEMENT_TREND.length - 1, 1)) * chartW;
    const y = padY + chartH - (value / maxTrendValue) * chartH;
    return { x, y };
  };

  const buildPolyline = (key: 'delivered' | 'opened' | 'clicked') =>
    DAILY_ENGAGEMENT_TREND.map((pt, idx) => {
      const { x, y } = getCoords(idx, pt[key]);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

  const hoveredPoint = DAILY_ENGAGEMENT_TREND[hoveredTrendIdx];
  const colStep = chartW / Math.max(DAILY_ENGAGEMENT_TREND.length - 1, 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-emerald-950 dark:text-emerald-50">
            Organizer Dashboard
          </h1>
          <p className="text-xs text-emerald-900/60 dark:text-emerald-300/65">
            Notification &amp; Announcement Operations · GMT+6
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {failedCount > 0 && firstFailedAnnouncementId && (
            <button
              type="button"
              onClick={() => onInspectAnnouncement(firstFailedAnnouncementId)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-300 dark:hover:bg-red-950 whitespace-nowrap"
            >
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Retry {failedCount} Failed
            </button>
          )}

          <button
            type="button"
            onClick={onCreateAnnouncement}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 whitespace-nowrap shrink-0"
          >
            <PenSquare className="h-3.5 w-3.5" aria-hidden="true" />
            Create Notice
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total Sent"
          value={totals.totalSent.toLocaleString()}
          sublabel="Targeted attendee dispatches"
          icon={Send}
          tone="default"
        />
        <StatCard
          label="Delivered (%)"
          value={totals.deliveredRate}
          sublabel={`${totals.totalDelivered.toLocaleString()} confirmed deliveries`}
          icon={CheckCircle2}
          tone="success"
        />
        <div
          onClick={() => {
            if (failedCount > 0 && firstFailedAnnouncementId) {
              onInspectAnnouncement(firstFailedAnnouncementId);
            }
          }}
          className={
            failedCount > 0 && firstFailedAnnouncementId ? 'cursor-pointer' : ''
          }
          title={
            failedCount > 0
              ? 'Click to inspect failed deliveries and retry'
              : undefined
          }
        >
          <StatCard
            label="Failed Dispatches"
            value={failedCount.toString()}
            sublabel={
              failedCount > 0
                ? 'Click to inspect & retry'
                : 'All retries resolved'
            }
            icon={AlertCircle}
            tone={failedCount > 0 ? 'danger' : 'success'}
          />
        </div>
        <StatCard
          label="Read Rate"
          value={totals.readRate}
          sublabel={`${totals.totalRead.toLocaleString()} opened notices`}
          icon={Eye}
          tone="amber"
        />
        <StatCard
          label="Click-Through Rate"
          value={totals.ctr}
          sublabel={`${totals.totalClicked.toLocaleString()} attachment & link clicks`}
          icon={MousePointerClick}
          tone="default"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="rounded-xl border border-emerald-200/70 bg-white lg:col-span-6 overflow-hidden dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 px-4 py-3 dark:border-emerald-800/60">
            <div>
              <h2 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
                Delivery by Channel
              </h2>
              <p className="text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                Select a channel to filter recent activity
              </p>
            </div>
            {selectedChannel !== 'All' && (
              <button
                type="button"
                onClick={() => setSelectedChannel('All')}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
              >
                <X className="h-3 w-3" aria-hidden="true" />
                Clear ({selectedChannel})
              </button>
            )}
          </div>

          <div className="divide-y divide-emerald-100/80 dark:divide-emerald-800/50">
            {channelStats.map((stat) => {
              const isSelected = selectedChannel === stat.channel;
              const readPct =
                stat.delivered > 0
                  ? ((stat.read / stat.delivered) * 100).toFixed(1)
                  : '0.0';
              return (
                <button
                  key={stat.channel}
                  type="button"
                  onClick={() =>
                    setSelectedChannel(isSelected ? 'All' : stat.channel)
                  }
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    isSelected
                      ? 'bg-emerald-50/75 dark:bg-[#09291E]'
                      : 'bg-white hover:bg-emerald-50/35 dark:bg-[#061D15] dark:hover:bg-[#09291E]/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ChannelPill channel={stat.channel} />
                      {isSelected && (
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          · Filtering
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs tabular-nums">
                      <span className="font-semibold text-emerald-950 dark:text-emerald-50">
                        {stat.deliveryPct.toFixed(1)}% delivered
                      </span>
                      <span className="font-mono text-[11px] text-emerald-900/55 dark:text-emerald-300/65">
                        {stat.delivered.toLocaleString()}/
                        {stat.targeted.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100/70 dark:bg-emerald-950">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isSelected
                          ? 'bg-emerald-500 dark:bg-emerald-400'
                          : 'bg-[#064E3B] dark:bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, stat.deliveryPct)}%` }}
                    />
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-emerald-900/60 dark:text-emerald-300/65 tabular-nums">
                    <span>Read rate: {readPct}%</span>
                    <span>Clicks: {stat.clicked.toLocaleString()}</span>
                    <span
                      className={
                        stat.failed > 0 ? 'font-semibold text-red-600 dark:text-red-400' : ''
                      }
                    >
                      Failed: {stat.failed}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-emerald-200/70 bg-white p-4 lg:col-span-6 flex flex-col justify-between dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
                  Engagement Over Time
                </h2>
                <p className="text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                  Daily delivery, open, and click volume
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="inline-flex items-center gap-1.5 text-emerald-950 dark:text-emerald-100">
                  <span className="h-2 w-2 rounded-sm bg-[#064E3B] dark:bg-emerald-400" />
                  Delivered
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-950 dark:text-emerald-100">
                  <span className="h-2 w-2 rounded-sm bg-[#10B981] dark:bg-emerald-300" />
                  Opened
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-950 dark:text-emerald-100">
                  <span className="h-2 w-2 rounded-sm bg-[#0D9488] dark:bg-teal-400" />
                  Clicked
                </span>
              </div>
            </div>

            <div className="mt-3 pt-1">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="h-44 w-full overflow-visible"
                role="img"
                aria-label="Engagement over time chart"
              >
                {[0.25, 0.5, 0.75, 1].map((fraction) => {
                  const y = padY + chartH - fraction * chartH;
                  const val = Math.round(maxTrendValue * fraction);
                  return (
                    <g key={fraction}>
                      <line
                        x1={padX}
                        y1={y}
                        x2={svgWidth - padX}
                        y2={y}
                        className="stroke-emerald-100 dark:stroke-emerald-900/60"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={padX - 8}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-emerald-900/45 dark:fill-emerald-300/55 font-mono text-[10px]"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                <polyline
                  fill="none"
                  className="stroke-[#064E3B] dark:stroke-emerald-400"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={buildPolyline('delivered')}
                />
                <polyline
                  fill="none"
                  className="stroke-[#10B981] dark:stroke-emerald-300"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={buildPolyline('opened')}
                />
                <polyline
                  fill="none"
                  className="stroke-[#0D9488] dark:stroke-teal-400"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={buildPolyline('clicked')}
                />

                {DAILY_ENGAGEMENT_TREND.map((pt, idx) => {
                  const d = getCoords(idx, pt.delivered);
                  const o = getCoords(idx, pt.opened);
                  const c = getCoords(idx, pt.clicked);
                  const isActive = idx === hoveredTrendIdx;

                  return (
                    <g
                      key={pt.label}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredTrendIdx(idx)}
                      onClick={() => setHoveredTrendIdx(idx)}
                    >
                      <rect
                        x={d.x - colStep / 2}
                        y={padY}
                        width={colStep}
                        height={chartH + 18}
                        fill="transparent"
                      />
                      {isActive && (
                        <line
                          x1={d.x}
                          y1={padY}
                          x2={d.x}
                          y2={padY + chartH}
                          className="stroke-emerald-200 dark:stroke-emerald-700"
                          strokeWidth="1.5"
                        />
                      )}
                      <circle
                        cx={d.x}
                        cy={d.y}
                        r={isActive ? 5 : 3.5}
                        className="fill-[#064E3B] dark:fill-emerald-400 stroke-white dark:stroke-[#061D15]"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx={o.x}
                        cy={o.y}
                        r={isActive ? 5 : 3.5}
                        className="fill-[#10B981] dark:fill-emerald-300 stroke-white dark:stroke-[#061D15]"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx={c.x}
                        cy={c.y}
                        r={isActive ? 5 : 3.5}
                        className="fill-[#0D9488] dark:fill-teal-400 stroke-white dark:stroke-[#061D15]"
                        strokeWidth="1.5"
                      />
                      <text
                        x={d.x}
                        y={svgHeight - 2}
                        textAnchor="middle"
                        className={`font-sans text-[11px] ${
                          isActive
                            ? 'fill-emerald-950 dark:fill-emerald-50 font-semibold'
                            : 'fill-emerald-900/55 dark:fill-emerald-300/60'
                        }`}
                      >
                        {pt.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3 border-t border-emerald-100 pt-3 text-xs dark:border-emerald-800/60 tabular-nums">
            <div>
              <div className="text-emerald-900/60 dark:text-emerald-300/65">{hoveredPoint.label} Delivered</div>
              <div className="mt-0.5 font-display text-base font-bold text-emerald-950 dark:text-emerald-50">
                {hoveredPoint.delivered.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-emerald-900/60 dark:text-emerald-300/65">Opened</div>
              <div className="mt-0.5 font-display text-base font-bold text-emerald-700 dark:text-emerald-400">
                {hoveredPoint.opened.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-emerald-900/60 dark:text-emerald-300/65">Link / File Clicks</div>
              <div className="mt-0.5 font-display text-base font-bold text-teal-700 dark:text-teal-400">
                {hoveredPoint.clicked.toLocaleString()}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <section className="rounded-xl border border-emerald-200/70 bg-white xl:col-span-8 overflow-hidden dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="flex items-center justify-between gap-4 border-b border-emerald-100 px-4 py-3 dark:border-emerald-800/60">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
                Recent Announcements
              </h2>
              {selectedChannel !== 'All' && (
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  · {selectedChannel}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onViewAllAnnouncements}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950 dark:text-emerald-300 dark:hover:text-emerald-100 whitespace-nowrap"
            >
              View All
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-emerald-100 bg-emerald-50/45 text-xs font-semibold text-emerald-900/70 dark:border-emerald-800/60 dark:bg-[#041811] dark:text-emerald-200/80">
                  <th className="px-4 py-2.5">Announcement</th>
                  <th className="px-3 py-2.5">Priority</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Delivered</th>
                  <th className="px-4 py-2.5 text-right">Read</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100/70 dark:divide-emerald-800/50">
                {filteredRecentAnnouncements.map((ann) => (
                  <tr
                    key={ann.id}
                    onClick={() => onInspectAnnouncement(ann.id)}
                    className="cursor-pointer transition-colors hover:bg-emerald-50/40 dark:hover:bg-[#09291E]/70"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-emerald-950 dark:text-emerald-50 line-clamp-1">
                        {ann.title}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-emerald-900/60 dark:text-emerald-300/65">
                        <span>{ann.type}</span>
                        <span aria-hidden="true">·</span>
                        <span>{summarizeTargeting(ann)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[11px]">
                          {formatDhakaTimeOnly(
                            ann.publishedAt || ann.scheduledFor || ann.createdAt
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <PriorityBadge priority={ann.priority} />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <StatusBadge status={ann.status} />
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-emerald-900/80 dark:text-emerald-100 tabular-nums align-middle">
                      {ann.status === 'Draft' || ann.status === 'Scheduled'
                        ? '—'
                        : `${ann.deliveredCount}/${ann.totalRecipients}`}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-emerald-900/80 dark:text-emerald-100 tabular-nums align-middle">
                      {ann.status === 'Draft' || ann.status === 'Scheduled'
                        ? '—'
                        : formatPercent(ann.readCount, ann.deliveredCount)}
                    </td>
                  </tr>
                ))}
                {filteredRecentAnnouncements.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-xs text-emerald-900/60 dark:text-emerald-300/65"
                    >
                      No announcements sent via {selectedChannel} yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-emerald-200/70 bg-white xl:col-span-4 flex flex-col overflow-hidden dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="flex items-center justify-between gap-2 border-b border-emerald-100 px-4 py-3 dark:border-emerald-800/60">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <h2 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
                Dispatch Feed
              </h2>
            </div>
            <span className="font-mono text-[11px] text-emerald-900/55 dark:text-emerald-300/65">GMT+6</span>
          </div>

          <div className="divide-y divide-emerald-100/70 dark:divide-emerald-800/50 overflow-y-auto max-h-[360px]">
            {filteredActivityFeed.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onInspectAnnouncement(entry.announcementId)}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-emerald-50/40 dark:hover:bg-[#09291E]/70"
              >
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={entry.status} />
                  <span className="font-mono text-[11px] text-emerald-900/55 dark:text-emerald-300/65 tabular-nums">
                    {entry.timestamp}
                  </span>
                </div>
                <div className="mt-1 text-xs font-semibold text-emerald-950 dark:text-emerald-50 line-clamp-1">
                  {entry.announcementTitle}
                </div>
                <p className="mt-0.5 text-xs text-emerald-900/65 dark:text-emerald-200/75">
                  {entry.eventDescription}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <ChannelPill channel={entry.channel} compact />
                  <span className="text-[11px] text-emerald-900/60 dark:text-emerald-300/65 tabular-nums">
                    {entry.recipientCount} recipients
                  </span>
                </div>
              </button>
            ))}
            {filteredActivityFeed.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-emerald-900/60 dark:text-emerald-300/65">
                No recent {selectedChannel} dispatch logs.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
