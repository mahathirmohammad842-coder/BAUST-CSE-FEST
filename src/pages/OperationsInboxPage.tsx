import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react';
import { RoleBadge } from '../components/Badge';
import { StatCard } from '../components/StatCard';
import type {
  EventInfoRequest,
  IncidentReport,
  IncidentStatus,
  InfoRequestStatus,
  OrganizerMessageThread,
} from '../types';
import { formatDhakaDateTime } from '../utils/formatters';

interface OperationsInboxPageProps {
  messageThreads: OrganizerMessageThread[];
  incidentReports: IncidentReport[];
  infoRequests: EventInfoRequest[];
  onReplyMessage: (threadId: string, body: string) => Promise<string | null>;
  onMarkThreadRead: (threadId: string) => Promise<void>;
  onUpdateIncident: (
    incidentId: string,
    status: IncidentStatus,
    resolutionNotes: string
  ) => Promise<string | null>;
  onRespondInfoRequest: (
    requestId: string,
    responseText: string,
    status: InfoRequestStatus
  ) => Promise<string | null>;
  onRefresh?: () => Promise<void>;
  onNotify?: (message: string) => void;
}

type OpsTab = 'messages' | 'incidents' | 'info-requests';

export function OperationsInboxPage({
  messageThreads,
  incidentReports,
  infoRequests,
  onReplyMessage,
  onMarkThreadRead,
  onUpdateIncident,
  onRespondInfoRequest,
  onRefresh,
  onNotify,
}: OperationsInboxPageProps) {
  const [activeTab, setActiveTab] = useState<OpsTab>('messages');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    messageThreads[0]?.id ?? null
  );
  const [replyDraft, setReplyDraft] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const [incidentDrafts, setIncidentDrafts] = useState<
    Record<string, { status: IncidentStatus; notes: string }>
  >({});
  const [savingIncidentId, setSavingIncidentId] = useState<string | null>(null);

  const [infoDrafts, setInfoDrafts] = useState<
    Record<string, { status: InfoRequestStatus; response: string }>
  >({});
  const [savingInfoId, setSavingInfoId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const openMessagesCount = useMemo(
    () =>
      messageThreads.filter(
        (m) => m.status === 'Sent' || m.status === 'Delivered'
      ).length,
    [messageThreads]
  );
  const openIncidentsCount = useMemo(
    () =>
      incidentReports.filter(
        (i) => i.status === 'Open' || i.status === 'Investigating'
      ).length,
    [incidentReports]
  );
  const pendingInfoCount = useMemo(
    () => infoRequests.filter((r) => r.status === 'Pending').length,
    [infoRequests]
  );

  const q = searchQuery.trim().toLowerCase();

  const filteredThreads = useMemo(() => {
    if (!q) return messageThreads;
    return messageThreads.filter((t) =>
      [
        t.subject,
        t.body,
        t.senderName,
        t.senderEmail,
        t.recipientOrganizerName,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [messageThreads, q]);

  const selectedThread = useMemo(
    () =>
      filteredThreads.find((t) => t.id === selectedThreadId) ??
      filteredThreads[0] ??
      null,
    [filteredThreads, selectedThreadId]
  );

  const filteredIncidents = useMemo(() => {
    if (!q) return incidentReports;
    return incidentReports.filter((i) =>
      [
        i.referenceCode,
        i.category,
        i.location,
        i.description,
        i.reporterName,
        i.reporterEmail,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [incidentReports, q]);

  const filteredInfoRequests = useMemo(() => {
    if (!q) return infoRequests;
    return infoRequests.filter((r) =>
      [r.referenceCode, r.topic, r.question, r.requesterName, r.requesterEmail]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [infoRequests, q]);

  const handleSelectThread = (thread: OrganizerMessageThread) => {
    setSelectedThreadId(thread.id);
    if (thread.status !== 'Read' && thread.status !== 'Replied') {
      void onMarkThreadRead(thread.id);
    }
  };

  const handleSendReply = async () => {
    if (!selectedThread || !replyDraft.trim() || submittingReply) return;
    setSubmittingReply(true);
    try {
      const err = await onReplyMessage(selectedThread.id, replyDraft.trim());
      if (err) {
        onNotify?.(err);
      } else {
        setReplyDraft('');
        onNotify?.(`Reply sent to ${selectedThread.senderName}.`);
      }
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-emerald-950 dark:text-emerald-50">
            Support, Incidents &amp; Organizer Inbox
          </h1>
          <p className="mt-1 text-xs text-emerald-900/60 dark:text-emerald-300/65">
            Real-time queue of attendee messages, campus incident reports, and event information requests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void handleRefresh()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-100"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
              />
              Sync Queue
            </button>
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <StatCard
          label="Unread Organizer Messages"
          value={openMessagesCount.toLocaleString()}
          sublabel={`${messageThreads.length} total message thread${messageThreads.length === 1 ? '' : 's'}`}
          icon={MessageSquare}
          tone={openMessagesCount > 0 ? 'amber' : 'success'}
        />
        <StatCard
          label="Active Incident Reports"
          value={openIncidentsCount.toLocaleString()}
          sublabel={`${incidentReports.length} total logged incidents`}
          icon={AlertTriangle}
          tone={openIncidentsCount > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label="Pending Info Requests"
          value={pendingInfoCount.toLocaleString()}
          sublabel={`${infoRequests.length} total helpdesk inquiries`}
          icon={HelpCircle}
          tone={pendingInfoCount > 0 ? 'amber' : 'success'}
        />
      </section>

      <section className="rounded-xl border border-emerald-200/70 bg-white p-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-800/60 dark:bg-[#061D15]">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              {
                id: 'messages',
                label: 'Organizer Messages',
                count: messageThreads.length,
              },
              {
                id: 'incidents',
                label: 'Incident Reports',
                count: incidentReports.length,
              },
              {
                id: 'info-requests',
                label: 'Event Info Requests',
                count: infoRequests.length,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#042419] text-white dark:bg-emerald-700'
                  : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className="font-mono text-[11px] opacity-75 tabular-nums">
                ({tab.count})
              </span>
            </button>
          ))}
        </div>

        <label className="relative block">
          <span className="sr-only">Search operations queue</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-800/45 dark:text-emerald-200/45" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sender, room, reference…"
            className="h-9 w-full sm:w-64 rounded-lg border border-emerald-200 bg-white pl-8 pr-3 text-xs text-emerald-950 outline-none focus:border-emerald-600 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
          />
        </label>
      </section>

      {activeTab === 'messages' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <section className="rounded-xl border border-emerald-200/70 bg-white overflow-hidden lg:col-span-5 dark:border-emerald-800/60 dark:bg-[#061D15]">
            <div className="border-b border-emerald-100 px-4 py-3 text-xs font-bold text-emerald-950 dark:border-emerald-800/60 dark:text-emerald-50">
              Incoming Threads ({filteredThreads.length})
            </div>
            {filteredThreads.length === 0 ? (
              <div className="px-4 py-12 text-center text-xs text-emerald-900/60 dark:text-emerald-300/65">
                No organizer messages received yet.
              </div>
            ) : (
              <div className="divide-y divide-emerald-100 max-h-[540px] overflow-y-auto dark:divide-emerald-800/50">
                {filteredThreads.map((thread) => {
                  const selected = selectedThread?.id === thread.id;
                  return (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => handleSelectThread(thread)}
                      className={`w-full px-4 py-3 text-left transition-colors ${
                        selected
                          ? 'bg-emerald-50/90 dark:bg-[#09291E]'
                          : 'hover:bg-emerald-50/40 dark:hover:bg-[#09291E]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-bold text-emerald-950 dark:text-emerald-50">
                          {thread.subject}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold shrink-0 ${
                            thread.status === 'Replied'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                              : thread.status === 'Read'
                                ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                          }`}
                        >
                          {thread.status}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-900/70 dark:text-emerald-200/75">
                        <span className="font-semibold">{thread.senderName}</span>
                        <span>·</span>
                        <span>{thread.senderRole}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                        {thread.body}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-emerald-900/50 dark:text-emerald-300/55">
                        <span>To: {thread.recipientOrganizerName}</span>
                        <span className="font-mono tabular-nums">
                          {formatDhakaDateTime(thread.lastMessageAt)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-emerald-200/70 bg-white p-5 lg:col-span-7 dark:border-emerald-800/60 dark:bg-[#061D15]">
            {!selectedThread ? (
              <div className="py-16 text-center text-xs text-emerald-900/60 dark:text-emerald-300/65">
                Select a conversation thread to read and reply.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border-b border-emerald-100 pb-3 dark:border-emerald-800/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-display text-base font-bold text-emerald-950 dark:text-emerald-50">
                      {selectedThread.subject}
                    </h2>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                      {selectedThread.status}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-emerald-900/70 dark:text-emerald-200/80">
                    <span className="font-semibold">{selectedThread.senderName}</span>
                    <span>({selectedThread.senderEmail})</span>
                    <RoleBadge role={selectedThread.senderRole} />
                    <span>→</span>
                    <span>{selectedThread.recipientOrganizerName}</span>
                  </div>
                </div>

                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                  <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 text-xs dark:border-emerald-800/70 dark:bg-[#041811]">
                    <div className="flex items-center justify-between text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
                      <span className="font-semibold text-emerald-950 dark:text-emerald-100">
                        {selectedThread.senderName}
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatDhakaDateTime(selectedThread.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-line leading-relaxed text-emerald-950 dark:text-emerald-50">
                      {selectedThread.body}
                    </p>
                  </div>

                  {selectedThread.replies.map((reply) => (
                    <div
                      key={reply.id}
                      className={`rounded-xl border p-3.5 text-xs ${
                        reply.isStaffReply
                          ? 'ml-6 border-emerald-300/80 bg-emerald-50 dark:border-emerald-700/70 dark:bg-emerald-950/50'
                          : 'mr-6 border-emerald-200/80 bg-white dark:border-emerald-800/70 dark:bg-[#041811]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold text-emerald-950 dark:text-emerald-100">
                          {reply.authorName} · {reply.authorRole}
                        </span>
                        <span className="font-mono text-emerald-900/55 dark:text-emerald-300/60 tabular-nums">
                          {formatDhakaDateTime(reply.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1.5 whitespace-pre-line leading-relaxed text-emerald-950 dark:text-emerald-50">
                        {reply.body}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-emerald-100 pt-3 space-y-2 dark:border-emerald-800/60">
                  <label
                    htmlFor="ops-reply-box"
                    className="block text-xs font-semibold text-emerald-950 dark:text-emerald-100"
                  >
                    Official Organizer Reply
                  </label>
                  <textarea
                    id="ops-reply-box"
                    rows={3}
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    placeholder={`Reply directly to ${selectedThread.senderName}...`}
                    className="w-full rounded-lg border border-emerald-200/80 bg-white px-3 py-2 text-sm text-emerald-950 placeholder:text-emerald-900/40 focus:border-emerald-700 focus:outline-none dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!replyDraft.trim() || submittingReply}
                      onClick={() => void handleSendReply()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {submittingReply ? 'Sending…' : 'Send Reply'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'incidents' && (
        <section className="space-y-3">
          {filteredIncidents.length === 0 ? (
            <div className="rounded-xl border border-emerald-200/70 bg-white px-6 py-14 text-center text-xs text-emerald-900/60 dark:border-emerald-800/60 dark:bg-[#061D15] dark:text-emerald-300/65">
              No incident reports recorded yet.
            </div>
          ) : (
            filteredIncidents.map((inc) => {
              const draft = incidentDrafts[inc.id] ?? {
                status: inc.status,
                notes: inc.resolutionNotes,
              };
              return (
                <div
                  key={inc.id}
                  className="rounded-xl border border-emerald-200/70 bg-white p-4 space-y-3 dark:border-emerald-800/60 dark:bg-[#061D15]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          {inc.referenceCode}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            inc.severity === 'Critical' || inc.severity === 'High'
                              ? 'bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {inc.severity}
                        </span>
                        <span className="text-xs font-bold text-emerald-950 dark:text-emerald-50">
                          {inc.category} · {inc.location}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-emerald-900/65 dark:text-emerald-300/65">
                        Reported by <strong>{inc.reporterName}</strong> ({inc.reporterEmail}) ·{' '}
                        {formatDhakaDateTime(inc.createdAt)}
                      </div>
                    </div>
                    <span
                      className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${
                        inc.status === 'Resolved' || inc.status === 'Closed'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                          : inc.status === 'Investigating'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300'
                      }`}
                    >
                      {inc.status}
                    </span>
                  </div>

                  <p className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 text-xs text-emerald-950 dark:border-emerald-800/60 dark:bg-[#041811] dark:text-emerald-100">
                    {inc.description}
                  </p>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 sm:items-end">
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-emerald-950 dark:text-emerald-100">
                        Update Status
                      </label>
                      <select
                        value={draft.status}
                        onChange={(e) =>
                          setIncidentDrafts((prev) => ({
                            ...prev,
                            [inc.id]: {
                              ...draft,
                              status: e.target.value as IncidentStatus,
                            },
                          }))
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-emerald-200 bg-white px-2.5 text-xs font-medium text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                      >
                        <option value="Open">Open</option>
                        <option value="Investigating">Investigating</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                    <div className="sm:col-span-7">
                      <label className="block text-[11px] font-semibold text-emerald-950 dark:text-emerald-100">
                        Resolution / Dispatch Notes
                      </label>
                      <input
                        type="text"
                        value={draft.notes}
                        onChange={(e) =>
                          setIncidentDrafts((prev) => ({
                            ...prev,
                            [inc.id]: {
                              ...draft,
                              notes: e.target.value,
                            },
                          }))
                        }
                        placeholder="Add volunteer dispatch or resolution notes..."
                        className="mt-1 h-9 w-full rounded-lg border border-emerald-200 bg-white px-3 text-xs text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                      />
                    </div>
                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        type="button"
                        disabled={savingIncidentId === inc.id}
                        onClick={async () => {
                          setSavingIncidentId(inc.id);
                          try {
                            const err = await onUpdateIncident(
                              inc.id,
                              draft.status,
                              draft.notes
                            );
                            onNotify?.(
                              err ??
                                `Incident ${inc.referenceCode} updated to ${draft.status}.`
                            );
                          } finally {
                            setSavingIncidentId(null);
                          }
                        }}
                        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50 dark:bg-emerald-600"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {savingIncidentId === inc.id ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      {activeTab === 'info-requests' && (
        <section className="space-y-3">
          {filteredInfoRequests.length === 0 ? (
            <div className="rounded-xl border border-emerald-200/70 bg-white px-6 py-14 text-center text-xs text-emerald-900/60 dark:border-emerald-800/60 dark:bg-[#061D15] dark:text-emerald-300/65">
              No event information requests submitted yet.
            </div>
          ) : (
            filteredInfoRequests.map((req) => {
              const draft = infoDrafts[req.id] ?? {
                status: req.status,
                response: req.responseText,
              };
              return (
                <div
                  key={req.id}
                  className="rounded-xl border border-emerald-200/70 bg-white p-4 space-y-3 dark:border-emerald-800/60 dark:bg-[#061D15]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          {req.referenceCode}
                        </span>
                        <span className="text-xs font-bold text-emerald-950 dark:text-emerald-50">
                          {req.topic}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-emerald-900/65 dark:text-emerald-300/65">
                        Requested by <strong>{req.requesterName}</strong> ({req.requesterEmail}) ·{' '}
                        {formatDhakaDateTime(req.createdAt)}
                      </div>
                    </div>
                    <span
                      className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${
                        req.status === 'Answered'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                          : req.status === 'Closed'
                            ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  <p className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 text-xs text-emerald-950 dark:border-emerald-800/60 dark:bg-[#041811] dark:text-emerald-100">
                    {req.question}
                  </p>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 sm:items-end">
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-emerald-950 dark:text-emerald-100">
                        Status
                      </label>
                      <select
                        value={draft.status}
                        onChange={(e) =>
                          setInfoDrafts((prev) => ({
                            ...prev,
                            [req.id]: {
                              ...draft,
                              status: e.target.value as InfoRequestStatus,
                            },
                          }))
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-emerald-200 bg-white px-2.5 text-xs font-medium text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Answered">Answered</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                    <div className="sm:col-span-7">
                      <label className="block text-[11px] font-semibold text-emerald-950 dark:text-emerald-100">
                        Official Organizer Answer
                      </label>
                      <input
                        type="text"
                        value={draft.response}
                        onChange={(e) =>
                          setInfoDrafts((prev) => ({
                            ...prev,
                            [req.id]: {
                              ...draft,
                              response: e.target.value,
                            },
                          }))
                        }
                        placeholder="Write clear official answer for the requester..."
                        className="mt-1 h-9 w-full rounded-lg border border-emerald-200 bg-white px-3 text-xs text-emerald-950 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                      />
                    </div>
                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        type="button"
                        disabled={savingInfoId === req.id || !draft.response.trim()}
                        onClick={async () => {
                          setSavingInfoId(req.id);
                          try {
                            const nextStatus =
                              draft.status === 'Pending'
                                ? 'Answered'
                                : draft.status;
                            const err = await onRespondInfoRequest(
                              req.id,
                              draft.response.trim(),
                              nextStatus
                            );
                            onNotify?.(
                              err ??
                                `Response published for ${req.referenceCode}.`
                            );
                          } finally {
                            setSavingInfoId(null);
                          }
                        }}
                        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50 dark:bg-emerald-600"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {savingInfoId === req.id ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}
    </div>
  );
}
