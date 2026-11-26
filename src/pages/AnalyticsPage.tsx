import { useMemo, useState } from 'react';
import { BarChart3, Building2, Layers, TrendingUp } from 'lucide-react';
import { ChannelPill } from '../components/ChannelPill';
import type { NotificationActionEvent } from '../utils/notificationActions';
import {
  ALL_CHANNELS,
  ALL_NOTIFICATION_TYPES,
  BAUST_ROOMS,
  DAILY_ENGAGEMENT_TREND,
  MONTHLY_ENGAGEMENT_TREND,
} from '../data/mockData';
import type { Announcement, NotificationType } from '../types';
import { formatDhakaDateTime, formatPercent } from '../utils/formatters';

interface AnalyticsPageProps {
  announcements: Announcement[];
  notificationEvents: NotificationActionEvent[];
}

export function AnalyticsPage({
  announcements,
  notificationEvents,
}: AnalyticsPageProps) {
  const [timeframe, setTimeframe] = useState<'daily' | 'monthly'>('daily');
  const [categoryFilter, setCategoryFilter] = useState<
    NotificationType | 'All'
  >('All');
  const [activeBarIdx, setActiveBarIdx] = useState<number>(
    DAILY_ENGAGEMENT_TREND.length - 1
  );

  const trendSeries =
    timeframe === 'daily' ? DAILY_ENGAGEMENT_TREND : MONTHLY_ENGAGEMENT_TREND;

  const safeBarIdx = Math.min(activeBarIdx, Math.max(trendSeries.length - 1, 0));
  const activePoint = trendSeries[safeBarIdx];

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((a) => {
      if (a.status === 'Draft' || a.status === 'Scheduled') return false;
      if (categoryFilter !== 'All' && a.type !== categoryFilter) return false;
      return true;
    });
  }, [announcements, categoryFilter]);

  const channelSummary = useMemo(() => {
    return ALL_CHANNELS.map((ch) => {
      let targeted = 0;
      let delivered = 0;
      let failed = 0;
      let read = 0;
      let clicked = 0;
      for (const ann of filteredAnnouncements) {
        const entry = ann.channelBreakdown.find((b) => b.channel === ch);
        if (entry) {
          targeted += entry.targetedCount;
          delivered += entry.deliveredCount;
          failed += entry.failedCount;
          read += entry.readCount;
          clicked += entry.clickCount;
        }
      }
      return { ch, targeted, delivered, failed, read, clicked };
    });
  }, [filteredAnnouncements]);

  const categorySummary = useMemo(() => {
    return ALL_NOTIFICATION_TYPES.map((cat) => {
      const items = announcements.filter(
        (a) =>
          a.type === cat && a.status !== 'Draft' && a.status !== 'Scheduled'
      );
      const sent = items.reduce((s, a) => s + a.totalRecipients, 0);
      const delivered = items.reduce((s, a) => s + a.deliveredCount, 0);
      const read = items.reduce((s, a) => s + a.readCount, 0);
      const clicked = items.reduce((s, a) => s + a.clickCount, 0);
      return {
        category: cat,
        count: items.length,
        sent,
        delivered,
        read,
        clicked,
      };
    }).filter((row) => row.count > 0);
  }, [announcements]);

  const roomEngagement = useMemo(() => {
    return BAUST_ROOMS.map((room) => {
      const matching = filteredAnnouncements.filter((a) =>
        a.targeting.rooms.includes(room)
      );
      const sent = matching.reduce((s, a) => s + a.totalRecipients, 0);
      const read = matching.reduce((s, a) => s + a.readCount, 0);
      const clicked = matching.reduce((s, a) => s + a.clickCount, 0);
      const readPct = sent > 0 ? Math.round((read / sent) * 100) : 0;
      return {
        room,
        notices: matching.length,
        sent,
        read,
        clicked,
        readPct,
      };
    }).sort((a, b) => b.sent - a.sent);
  }, [filteredAnnouncements]);

  const maxTrendSent = Math.max(...trendSeries.map((d) => d.sent), 1);
  const notificationActionSummary = useMemo(
    () => ({
      reads: notificationEvents.filter((event) => event.action === 'read').length,
      unread: notificationEvents.filter((event) => event.action === 'unread').length,
      organized: notificationEvents.filter((event) =>
        ['starred', 'unstarred', 'saved', 'unsaved', 'pinned', 'unpinned', 'archived', 'unarchived'].includes(event.action)
      ).length,
      shared: notificationEvents.filter((event) =>
        ['shared', 'copied', 'printed', 'exported'].includes(event.action)
      ).length,
    }),
    [notificationEvents]
  );
  const announcementTitles = useMemo(
    () => new Map(announcements.map((announcement) => [announcement.id, announcement.title])),
    [announcements]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-emerald-950 dark:text-emerald-50">
            Analytics
          </h1>
          <p className="text-xs text-emerald-900/60 dark:text-emerald-300/65">
            Channel reach, category open rates, and room-level engagement
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex rounded-lg bg-emerald-50/80 p-1 border border-emerald-200/70 dark:bg-[#041811] dark:border-emerald-800/60">
            <button
              type="button"
              onClick={() => {
                setTimeframe('daily');
                setActiveBarIdx(DAILY_ENGAGEMENT_TREND.length - 1);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                timeframe === 'daily'
                  ? 'bg-white text-emerald-950 shadow-sm dark:bg-[#0B2E22] dark:text-emerald-50'
                  : 'text-emerald-900/70 hover:text-emerald-950 dark:text-emerald-300/75 dark:hover:text-emerald-50'
              }`}
            >
              Daily (Fest Week)
            </button>
            <button
              type="button"
              onClick={() => {
                setTimeframe('monthly');
                setActiveBarIdx(MONTHLY_ENGAGEMENT_TREND.length - 1);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                timeframe === 'monthly'
                  ? 'bg-white text-emerald-950 shadow-sm dark:bg-[#0B2E22] dark:text-emerald-50'
                  : 'text-emerald-900/70 hover:text-emerald-950 dark:text-emerald-300/75 dark:hover:text-emerald-50'
              }`}
            >
              Monthly Campaign
            </button>
          </div>

          <select
            aria-label="Filter analytics by category"
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as NotificationType | 'All')
            }
            className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-950 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:focus:border-emerald-400"
          >
            <option value="All">All Categories</option>
            {ALL_NOTIFICATION_TYPES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="rounded-xl border border-emerald-200/70 bg-white p-4 sm:p-5 dark:border-emerald-800/60 dark:bg-[#061D15]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <h2 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
              {timeframe === 'daily'
                ? 'Daily Dispatch & Open Volume'
                : 'Monthly Pre-Fest to Fest Volume'}
            </h2>
          </div>
          <div className="flex items-center gap-4 text-xs text-emerald-900/75 dark:text-emerald-200/80">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#064E3B] dark:bg-emerald-400" />
              Delivered
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500 dark:bg-emerald-300" />
              Opened
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-teal-600 dark:bg-teal-400" />
              Clicked
            </span>
          </div>
        </div>

        <div
          className={`mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 ${
            trendSeries.length === 6 ? 'lg:grid-cols-6' : 'lg:grid-cols-4'
          } items-end`}
        >
          {trendSeries.map((pt, idx) => {
            const delPct = Math.round((pt.delivered / maxTrendSent) * 100);
            const openPct = Math.round((pt.opened / maxTrendSent) * 100);
            const clickPct = Math.round((pt.clicked / maxTrendSent) * 100);
            const isSelected = idx === safeBarIdx;

            return (
              <button
                key={pt.label}
                type="button"
                onMouseEnter={() => setActiveBarIdx(idx)}
                onClick={() => setActiveBarIdx(idx)}
                className={`space-y-2 rounded-lg p-2 text-center transition-colors ${
                  isSelected
                    ? 'bg-emerald-50/75 ring-1 ring-emerald-700 dark:bg-[#09291E] dark:ring-emerald-400'
                    : 'hover:bg-emerald-50/40 dark:hover:bg-[#09291E]/60'
                }`}
              >
                <div className="flex h-36 items-end justify-center gap-1.5 px-2 pt-3 pb-1">
                  <div
                    className="w-4 rounded-t bg-[#064E3B] dark:bg-emerald-400 transition-all"
                    style={{ height: `${Math.max(8, delPct)}%` }}
                  />
                  <div
                    className="w-4 rounded-t bg-emerald-500 dark:bg-emerald-300 transition-all"
                    style={{ height: `${Math.max(6, openPct)}%` }}
                  />
                  <div
                    className="w-4 rounded-t bg-teal-600 dark:bg-teal-400 transition-all"
                    style={{ height: `${Math.max(4, clickPct)}%` }}
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-emerald-950 dark:text-emerald-50">
                    {pt.label}
                  </div>
                  <div className="font-mono text-[11px] text-emerald-900/60 dark:text-emerald-300/65 tabular-nums">
                    {pt.delivered.toLocaleString()} deliv
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {activePoint && (
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-emerald-100 pt-3 text-xs sm:grid-cols-4 dark:border-emerald-800/60 tabular-nums">
            <div>
              <div className="text-emerald-900/60 dark:text-emerald-300/65">Selected Period</div>
              <div className="mt-0.5 font-display font-bold text-emerald-950 dark:text-emerald-50">
                {activePoint.label}
              </div>
            </div>
            <div>
              <div className="text-emerald-900/60 dark:text-emerald-300/65">Delivered</div>
              <div className="mt-0.5 font-mono font-bold text-emerald-950 dark:text-emerald-50">
                {activePoint.delivered.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-emerald-900/60 dark:text-emerald-300/65">Opened</div>
              <div className="mt-0.5 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                {activePoint.opened.toLocaleString()} (
                {formatPercent(activePoint.opened, activePoint.delivered)})
              </div>
            </div>
            <div>
              <div className="text-emerald-900/60 dark:text-emerald-300/65">Clicked</div>
              <div className="mt-0.5 font-mono font-bold text-teal-700 dark:text-teal-400">
                {activePoint.clicked.toLocaleString()} (
                {formatPercent(activePoint.clicked, activePoint.delivered)})
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="rounded-xl border border-emerald-200/70 bg-white lg:col-span-6 overflow-hidden dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="flex items-center gap-2 border-b border-emerald-100 px-4 py-3 dark:border-emerald-800/60">
            <BarChart3 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <h3 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
              Channel Performance Summary
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-emerald-100 bg-emerald-50/45 text-xs font-semibold text-emerald-900/70 dark:border-emerald-800/60 dark:bg-[#041811] dark:text-emerald-200/80">
                  <th className="px-4 py-2.5">Channel</th>
                  <th className="px-3 py-2.5 text-right">Delivered</th>
                  <th className="px-3 py-2.5 text-right">Read %</th>
                  <th className="px-4 py-2.5 text-right">CTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100/70 dark:divide-emerald-800/50 tabular-nums">
                {channelSummary.map((row) => (
                  <tr key={row.ch} className="hover:bg-emerald-50/35 dark:hover:bg-[#09291E]/70">
                    <td className="px-4 py-3">
                      <ChannelPill channel={row.ch} />
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-emerald-950 dark:text-emerald-50">
                      {row.delivered.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-emerald-900/80 dark:text-emerald-200/80">
                      {formatPercent(row.read, row.delivered)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-teal-700 dark:text-teal-400">
                      {formatPercent(row.clicked, row.delivered)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-emerald-200/70 bg-white lg:col-span-6 overflow-hidden dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="flex items-center gap-2 border-b border-emerald-100 px-4 py-3 dark:border-emerald-800/60">
            <Layers className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <h3 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
              Category Breakdown
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-emerald-100 bg-emerald-50/45 text-xs font-semibold text-emerald-900/70 dark:border-emerald-800/60 dark:bg-[#041811] dark:text-emerald-200/80">
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-3 py-2.5 text-right">Notices</th>
                  <th className="px-3 py-2.5 text-right">Delivered</th>
                  <th className="px-4 py-2.5 text-right">Read %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100/70 dark:divide-emerald-800/50 tabular-nums">
                {categorySummary.map((row) => (
                  <tr key={row.category} className="hover:bg-emerald-50/35 dark:hover:bg-[#09291E]/70">
                    <td className="px-4 py-3 text-xs font-semibold text-emerald-950 dark:text-emerald-50">
                      {row.category}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-emerald-900/70 dark:text-emerald-200/75">
                      {row.count}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs text-emerald-950 dark:text-emerald-50">
                      {row.delivered.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatPercent(row.read, row.delivered)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-emerald-200/70 bg-white dark:border-emerald-800/60 dark:bg-[#061D15]">
          <div className="border-b border-emerald-100 px-4 py-3 dark:border-emerald-800/60">
            <h3 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
              Personal Notification Activity
            </h3>
            <p className="mt-0.5 text-xs text-emerald-900/60 dark:text-emerald-300/65">
              Recent user actions recorded by this browser
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            {[
              { label: 'Tracked actions', value: notificationEvents.length },
              { label: 'Marked read', value: notificationActionSummary.reads },
              { label: 'Organization actions', value: notificationActionSummary.organized },
              { label: 'Shares & exports', value: notificationActionSummary.shared },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 dark:border-emerald-800/60 dark:bg-[#041811]"
              >
                <div className="text-[11px] font-medium text-emerald-900/60 dark:text-emerald-300/65">
                  {metric.label}
                </div>
                <div className="mt-1 font-mono text-lg font-bold text-emerald-950 dark:text-emerald-50 tabular-nums">
                  {metric.value.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto border-t border-emerald-100 dark:border-emerald-800/60">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="bg-emerald-50/45 font-semibold text-emerald-900/70 dark:bg-[#041811] dark:text-emerald-200/80">
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">Notification</th>
                  <th className="px-4 py-2.5">User ID</th>
                  <th className="px-4 py-2.5">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100/70 dark:divide-emerald-800/50">
                {notificationEvents.slice(0, 12).map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 font-semibold text-emerald-800 dark:text-emerald-300">
                      {event.action.replaceAll('-', ' ')}
                      {event.detail ? <span className="ml-1 font-normal text-emerald-900/55 dark:text-emerald-300/60">· {event.detail}</span> : null}
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-3 text-emerald-950 dark:text-emerald-100">
                      {announcementTitles.get(event.notificationId) ?? event.notificationId}
                    </td>
                    <td className="px-4 py-3 font-mono text-emerald-900/70 dark:text-emerald-200/75">
                      {event.userId}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-emerald-900/65 dark:text-emerald-300/65">
                      {formatDhakaDateTime(event.occurredAt)}
                    </td>
                  </tr>
                ))}
                {notificationEvents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-emerald-900/55 dark:text-emerald-300/60">
                      No user notification actions have been recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-emerald-200/70 bg-white p-4 sm:p-5 dark:border-emerald-800/60 dark:bg-[#061D15]">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          <h3 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
            Room-Wise Engagement Across BAUST Campus Venues
          </h3>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {roomEngagement.map((r) => (
            <div
              key={r.room}
              className="rounded-lg border border-emerald-200/70 bg-emerald-50/35 p-3.5 dark:border-emerald-800/60 dark:bg-[#041811]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-semibold text-emerald-950 dark:text-emerald-50">
                  {r.room}
                </div>
                <span className="font-mono text-xs font-bold text-emerald-950 dark:text-emerald-300 tabular-nums shrink-0">
                  {r.readPct}% read
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950">
                <div
                  className="h-full rounded-full bg-emerald-600 dark:bg-emerald-400"
                  style={{ width: `${r.readPct}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-emerald-900/60 dark:text-emerald-300/65 tabular-nums">
                <span>{r.notices} targeted notices</span>
                <span>{r.sent.toLocaleString()} reached</span>
                <span>{r.clicked.toLocaleString()} clicks</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
