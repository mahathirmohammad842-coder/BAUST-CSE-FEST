import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock3,
  History,
  Info,
  ShieldAlert,
  UnlockKeyhole,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import type { RegistrationRequest, WorkspaceRole } from '../types';
import type { UserBlockAuditEvent, UserBlockRecord } from '../utils/registrationStore';

interface BlockedUserIdentity {
  id: string;
  fullName: string;
  email: string;
  role: WorkspaceRole;
}

interface BlockedUsersPageProps {
  users: BlockedUserIdentity[];
  requests: RegistrationRequest[];
  records: UserBlockRecord[];
  events: UserBlockAuditEvent[];
  onUnblock: (blockId: string) => void;
  onUpdateExpiry: (
    blockId: string,
    expiresAt: string,
    action: 'extended' | 'expiry-changed'
  ) => void;
}

type ExpiryAction = 'extended' | 'expiry-changed';
type ExpiryPreset = '15m' | '30m' | '1h' | '6h' | '12h' | '24h' | '3d' | '7d' | 'custom';

const EXPIRY_PRESETS: { value: ExpiryPreset; label: string; milliseconds: number }[] = [
  { value: '15m', label: '15 minutes', milliseconds: 15 * 60_000 },
  { value: '30m', label: '30 minutes', milliseconds: 30 * 60_000 },
  { value: '1h', label: '1 hour', milliseconds: 60 * 60_000 },
  { value: '6h', label: '6 hours', milliseconds: 6 * 60 * 60_000 },
  { value: '12h', label: '12 hours', milliseconds: 12 * 60 * 60_000 },
  { value: '24h', label: '24 hours', milliseconds: 24 * 60 * 60_000 },
  { value: '3d', label: '3 days', milliseconds: 3 * 24 * 60 * 60_000 },
  { value: '7d', label: '7 days', milliseconds: 7 * 24 * 60 * 60_000 },
  { value: 'custom', label: 'Choose a date and time', milliseconds: 0 },
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(date);
}

function getLocalDateTimeValue(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function getLocalDateTimeMinimum() {
  return getLocalDateTimeValue(new Date(Date.now() + 60_000).toISOString());
}

function getRemainingTime(record: UserBlockRecord, now: number) {
  if (record.endReason === 'expired') return 'Expired';
  if (record.endedAt) return 'Unblocked';
  if (!record.expiresAt) return 'Permanent';

  const remainingMs = Date.parse(record.expiresAt) - now;
  if (remainingMs <= 0) return 'Expired';

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  if (minutes > 0) return `${minutes}m ${seconds}s remaining`;
  return `${seconds}s remaining`;
}

function isActive(record: UserBlockRecord, now: number) {
  return (
    !record.endedAt &&
    (record.expiresAt === null || Date.parse(record.expiresAt) > now)
  );
}

function getStatus(record: UserBlockRecord, now: number) {
  if (record.endReason === 'expired' || (!record.endedAt && record.expiresAt && Date.parse(record.expiresAt) <= now)) {
    return 'Expired';
  }
  if (record.endedAt) return 'Unblocked';
  return record.expiresAt ? 'Temporarily Blocked' : 'Permanently Blocked';
}

function statusStyle(status: string) {
  if (status === 'Permanently Blocked') {
    return 'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200';
  }
  if (status === 'Temporarily Blocked') {
    return 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200';
  }
  if (status === 'Expired') {
    return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
  return 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';
}

function eventLabel(action: UserBlockAuditEvent['action']) {
  switch (action) {
    case 'blocked': return 'Block created';
    case 'unblocked': return 'Unblocked';
    case 'extended': return 'Duration extended';
    case 'expiry-changed': return 'Expiry changed';
    case 'expired': return 'Block expired';
  }
}

export function BlockedUsersPage({
  users,
  requests,
  records,
  events,
  onUnblock,
  onUpdateExpiry,
}: BlockedUsersPageProps) {
  const [now, setNow] = useState(Date.now());
  const [showHistory, setShowHistory] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<UserBlockRecord | null>(null);
  const [expiryTarget, setExpiryTarget] = useState<UserBlockRecord | null>(null);
  const [expiryAction, setExpiryAction] = useState<ExpiryAction>('extended');
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>('1h');
  const [customExpiry, setCustomExpiry] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const identities = useMemo(() => {
    const byId = new Map<string, BlockedUserIdentity>();
    for (const user of users) byId.set(user.id, user);
    for (const request of requests) {
      byId.set(request.id, {
        id: request.id,
        fullName: request.fullName,
        email: request.email,
        role: request.role,
      });
    }
    return byId;
  }, [requests, users]);

  const activeRecords = useMemo(
    () => records.filter((record) => isActive(record, now)),
    [now, records]
  );
  const historyRecords = useMemo(
    () => [...records].sort((a, b) => Date.parse(b.blockedAt) - Date.parse(a.blockedAt)),
    [records]
  );
  const recordEvents = selectedRecord
    ? events
        .filter((event) => event.blockId === selectedRecord.id)
        .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    : [];
  const temporaryCount = activeRecords.filter((record) => record.expiresAt).length;
  const permanentCount = activeRecords.length - temporaryCount;

  const submitExpiryChange = () => {
    if (!expiryTarget) return;
    let expiresAt: Date;
    if (expiryPreset === 'custom') {
      expiresAt = new Date(customExpiry);
    } else {
      const preset = EXPIRY_PRESETS.find((item) => item.value === expiryPreset);
      if (!preset || preset.value === 'custom') return;
      const baseTime =
        expiryAction === 'extended' &&
        expiryTarget.expiresAt &&
        Date.parse(expiryTarget.expiresAt) > Date.now()
          ? Date.parse(expiryTarget.expiresAt)
          : Date.now();
      expiresAt = new Date(baseTime + preset.milliseconds);
    }
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) return;
    onUpdateExpiry(expiryTarget.id, expiresAt.toISOString(), expiryAction);
    setExpiryTarget(null);
    setCustomExpiry('');
  };

  const renderRecordRow = (record: UserBlockRecord) => {
    const user = identities.get(record.userId);
    const status = getStatus(record, now);
    const active = isActive(record, now);
    const remaining = getRemainingTime(record, now);
    return (
      <tr key={record.id} className="text-xs text-emerald-950 dark:text-emerald-50">
        <td className="px-4 py-3.5">
          <p className="font-semibold">{user?.fullName ?? 'Deleted user'}</p>
          <p className="mt-0.5 text-[11px] text-emerald-900/60 dark:text-emerald-300/65">{user?.email ?? record.userId}</p>
        </td>
        <td className="px-4 py-3.5">{user?.role ?? '—'}</td>
        <td className="px-4 py-3.5">
          <span className="font-medium">{record.reason}</span>
          {record.note && (
            <p className="mt-0.5 max-w-48 truncate text-[11px] text-emerald-900/55 dark:text-emerald-300/55" title={record.note}>
              {record.note}
            </p>
          )}
        </td>
        <td className="whitespace-nowrap px-4 py-3.5">{record.blockedByName}</td>
        <td className="whitespace-nowrap px-4 py-3.5">{formatDate(record.blockedAt)}</td>
        <td className="whitespace-nowrap px-4 py-3.5">{record.expiresAt ? formatDate(record.expiresAt) : 'Never'}</td>
        <td className="whitespace-nowrap px-4 py-3.5">
          <span className={`font-semibold ${remaining === 'Expired' ? 'text-slate-500' : active ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
            {remaining}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-3.5">
          <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${statusStyle(status)}`}>
            {status}
          </span>
        </td>
        <td className="px-4 py-3.5">
          <div className="flex flex-wrap justify-end gap-1.5">
            {active && (
              <>
                <button
                  type="button"
                  onClick={() => onUnblock(record.id)}
                  aria-label={`Unblock ${user?.fullName ?? 'user'} immediately`}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                >
                  <UnlockKeyhole className="h-3 w-3" />
                  Unblock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExpiryTarget(record);
                    setExpiryAction('extended');
                    setExpiryPreset('1h');
                    setCustomExpiry('');
                  }}
                  aria-label={`Extend block for ${user?.fullName ?? 'user'}`}
                  className="rounded-lg border border-amber-200 px-2 py-1.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-50 dark:border-amber-800/70 dark:text-amber-300 dark:hover:bg-amber-950/40"
                >
                  Extend
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExpiryTarget(record);
                    setExpiryAction('expiry-changed');
                    setExpiryPreset('custom');
                    setCustomExpiry(
                      record.expiresAt
                        ? getLocalDateTimeValue(record.expiresAt)
                        : ''
                    );
                  }}
                  aria-label={`Change expiry time for ${user?.fullName ?? 'user'}`}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Change expiry
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setSelectedRecord(record)}
              aria-label={`View block history and notes for ${user?.fullName ?? 'user'}`}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
            >
              <History className="h-3 w-3" />
              History & notes
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const table = (list: UserBlockRecord[], emptyTitle: string) =>
    list.length === 0 ? (
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <h3 className="mt-3 text-sm font-semibold text-emerald-950 dark:text-emerald-50">{emptyTitle}</h3>
        <p className="mt-1 text-xs text-emerald-900/60 dark:text-emerald-300/65">Block actions and their audit records will appear here.</p>
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1280px] text-left">
          <thead className="bg-emerald-50/70 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/65 dark:bg-emerald-950/30 dark:text-emerald-200/65">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Block reason</th>
              <th className="px-4 py-3">Blocked by</th>
              <th className="px-4 py-3">Block start time</th>
              <th className="px-4 py-3">Block expiry time</th>
              <th className="px-4 py-3">Remaining time</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Admin actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900/50">
            {list.map(renderRecordRow)}
          </tbody>
        </table>
      </div>
    );

  const expiryIsValid =
    expiryPreset === 'custom'
      ? Boolean(customExpiry) && Date.parse(customExpiry) > Date.now()
      : true;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-700 dark:text-red-300" />
            <h1 className="font-display text-xl font-bold text-emerald-950 dark:text-emerald-50">Blocked Users</h1>
          </div>
          <p className="mt-1 text-xs text-emerald-900/60 dark:text-emerald-300/65">Manage suspensions, expiry timers, and access audit history.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
          <Ban className="h-3.5 w-3.5" />
          {activeRecords.length} active block{activeRecords.length === 1 ? '' : 's'}
        </span>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Blocked user statistics">
        <div className="rounded-xl border border-red-200/70 bg-white p-4 dark:border-red-900/50 dark:bg-[#061D15]">
          <p className="text-xs font-medium text-emerald-900/60 dark:text-emerald-300/65">Active blocks</p>
          <p className="mt-2 text-2xl font-bold text-red-800 dark:text-red-300">{activeRecords.length}</p>
          <p className="mt-1 text-[11px] text-emerald-900/55 dark:text-emerald-300/55">Accounts currently suspended</p>
        </div>
        <div className="rounded-xl border border-amber-200/70 bg-white p-4 dark:border-amber-900/50 dark:bg-[#061D15]">
          <p className="text-xs font-medium text-emerald-900/60 dark:text-emerald-300/65">Temporary</p>
          <p className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-300">{temporaryCount}</p>
          <p className="mt-1 text-[11px] text-emerald-900/55 dark:text-emerald-300/55">Countdown and automatic expiry enabled</p>
        </div>
        <div className="rounded-xl border border-slate-200/70 bg-white p-4 dark:border-slate-800 dark:bg-[#061D15]">
          <p className="text-xs font-medium text-emerald-900/60 dark:text-emerald-300/65">Permanent</p>
          <p className="mt-2 text-2xl font-bold text-slate-800 dark:text-slate-200">{permanentCount}</p>
          <p className="mt-1 text-[11px] text-emerald-900/55 dark:text-emerald-300/55">Remain until manually unblocked</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-emerald-200/70 bg-white dark:border-emerald-800/60 dark:bg-[#061D15]">
        <div className="flex flex-col gap-3 border-b border-emerald-100 p-4 dark:border-emerald-800/60 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-50">
              {showHistory ? 'Block history' : 'Currently blocked users'}
            </h2>
            <p className="mt-0.5 text-[11px] text-emerald-900/60 dark:text-emerald-300/65">
              {showHistory ? `${historyRecords.length} recorded block actions` : 'Live countdowns refresh every second'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowHistory((previous) => !previous)}
            className="inline-flex min-h-9 w-fit items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
          >
            <History className="h-3.5 w-3.5" />
            {showHistory ? 'Show active blocks' : 'View all block history'}
          </button>
        </div>
        {table(showHistory ? historyRecords : activeRecords, showHistory ? 'No block history yet' : 'No users are currently blocked')}
      </section>

      <Modal
        open={expiryTarget !== null}
        onClose={() => setExpiryTarget(null)}
        title={expiryAction === 'extended' ? 'Extend block duration' : 'Change block expiry'}
        subtitle="Choose a new expiry. Blocked access remains in effect until this time."
        maxWidthClass="max-w-md"
        footer={
          <>
            <button type="button" onClick={() => setExpiryTarget(null)} className="rounded-lg border border-emerald-200 px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-emerald-900/50">Cancel</button>
            <button
              type="button"
              disabled={!expiryIsValid}
              onClick={submitExpiryChange}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              <CalendarClock className="h-3.5 w-3.5" />
              Save expiry
            </button>
          </>
        }
      >
        {expiryTarget && (
          <div className="space-y-4">
            <p className="text-sm text-emerald-900/75 dark:text-emerald-200/80">
              Update the block for <strong>{identities.get(expiryTarget.userId)?.fullName ?? 'this user'}</strong>.
            </p>
            {expiryAction === 'extended' ? (
              <label className="block text-xs font-semibold text-emerald-950 dark:text-emerald-50">
                Extend by
                <select
                  value={expiryPreset}
                  onChange={(event) => setExpiryPreset(event.target.value as ExpiryPreset)}
                  className="mt-1.5 min-h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-normal dark:border-emerald-800/70 dark:bg-[#041811]"
                >
                  {EXPIRY_PRESETS.map((preset) => <option key={preset.value} value={preset.value}>{preset.label}</option>)}
                </select>
              </label>
            ) : null}
            {(expiryAction === 'expiry-changed' || expiryPreset === 'custom') && (
              <label className="block text-xs font-semibold text-emerald-950 dark:text-emerald-50">
                New expiry date and time
                <input
                  type="datetime-local"
                  value={customExpiry}
                  min={getLocalDateTimeMinimum()}
                  onChange={(event) => setCustomExpiry(event.target.value)}
                  className="mt-1.5 min-h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-normal dark:border-emerald-800/70 dark:bg-[#041811]"
                />
              </label>
            )}
            <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              A preset extension adds time to the current expiry; for a permanent block, it starts now. Choosing a custom time or changing expiry sets an exact new date and time.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={selectedRecord !== null}
        onClose={() => setSelectedRecord(null)}
        title="Block history & admin notes"
        subtitle={selectedRecord ? `${identities.get(selectedRecord.userId)?.fullName ?? 'Deleted user'} · ${selectedRecord.reason}` : undefined}
        maxWidthClass="max-w-xl"
      >
        {selectedRecord && (
          <div className="space-y-5">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs dark:border-emerald-800/60 dark:bg-emerald-950/20">
              <p className="font-semibold text-emerald-950 dark:text-emerald-50">Admin note</p>
              <p className="mt-1 whitespace-pre-wrap text-emerald-900/70 dark:text-emerald-200/75">{selectedRecord.note || 'No note was added for this block.'}</p>
            </div>
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-900/60 dark:text-emerald-300/65">Audit trail</h3>
              {recordEvents.length === 0 ? (
                <p className="text-xs text-emerald-900/60 dark:text-emerald-300/65">No audit events were recorded.</p>
              ) : (
                <ol className="space-y-3">
                  {recordEvents.map((event) => (
                    <li key={event.id} className="flex gap-3 border-l-2 border-emerald-200 pl-3 dark:border-emerald-800">
                      <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                      <div className="min-w-0 text-xs">
                        <p className="font-semibold text-emerald-950 dark:text-emerald-50">{eventLabel(event.action)}</p>
                        <p className="mt-0.5 text-emerald-900/65 dark:text-emerald-300/70">{event.actorName} · {formatDate(event.occurredAt)}</p>
                        {event.previousExpiresAt !== undefined && (
                          <p className="mt-1 text-emerald-900/60 dark:text-emerald-300/60">
                            {event.previousExpiresAt ? formatDate(event.previousExpiresAt) : 'Permanent'} → {event.expiresAt ? formatDate(event.expiresAt) : 'Permanent'}
                          </p>
                        )}
                        {event.note && <p className="mt-1 whitespace-pre-wrap text-emerald-900/65 dark:text-emerald-300/65">{event.note}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
