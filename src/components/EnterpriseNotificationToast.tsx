import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Megaphone,
  MessageSquare,
  ShieldAlert,
  UserCheck,
  UserX,
  Volume2,
  X,
} from 'lucide-react';
import type {
  EnterpriseNotificationToast,
  NotificationSoundEventType,
} from '../types';
import { unlockNotificationAudio } from '../lib/notificationSound';

interface EnterpriseNotificationToastStackProps {
  toasts: EnterpriseNotificationToast[];
  onDismiss: (id: string) => void;
  onOpenToast?: (toast: EnterpriseNotificationToast) => void;
  onAudioUnlocked?: () => void;
}

const EVENT_VISUALS: Record<
  NotificationSoundEventType,
  {
    label: string;
    accentBar: string;
    iconBg: string;
    iconColor: string;
    icon: typeof Bell;
  }
> = {
  general: {
    label: 'Notification',
    accentBar: 'bg-emerald-600 dark:bg-emerald-400',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/70',
    iconColor: 'text-emerald-700 dark:text-emerald-300',
    icon: Bell,
  },
  announcement: {
    label: 'Announcement',
    accentBar: 'bg-emerald-600 dark:bg-emerald-400',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/70',
    iconColor: 'text-emerald-700 dark:text-emerald-300',
    icon: Megaphone,
  },
  new_message: {
    label: 'New Message',
    accentBar: 'bg-sky-600 dark:bg-sky-400',
    iconBg: 'bg-sky-50 dark:bg-sky-950/60',
    iconColor: 'text-sky-700 dark:text-sky-300',
    icon: MessageSquare,
  },
  approval_request: {
    label: 'Approval Request',
    accentBar: 'bg-amber-500 dark:bg-amber-400',
    iconBg: 'bg-amber-50 dark:bg-amber-950/60',
    iconColor: 'text-amber-700 dark:text-amber-300',
    icon: UserCheck,
  },
  approval_granted: {
    label: 'Approval Granted',
    accentBar: 'bg-emerald-600 dark:bg-emerald-400',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/70',
    iconColor: 'text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
  },
  approval_rejected: {
    label: 'Approval Rejected',
    accentBar: 'bg-rose-600 dark:bg-rose-400',
    iconBg: 'bg-rose-50 dark:bg-rose-950/60',
    iconColor: 'text-rose-700 dark:text-rose-300',
    icon: UserX,
  },
  system_alert: {
    label: 'System Alert',
    accentBar: 'bg-amber-600 dark:bg-amber-400',
    iconBg: 'bg-amber-50 dark:bg-amber-950/60',
    iconColor: 'text-amber-700 dark:text-amber-300',
    icon: ShieldAlert,
  },
  high_priority: {
    label: 'High Priority Alert',
    accentBar: 'bg-rose-600 dark:bg-rose-400',
    iconBg: 'bg-rose-50 dark:bg-rose-950/70',
    iconColor: 'text-rose-700 dark:text-rose-300',
    icon: AlertTriangle,
  },
};

function formatToastTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 'Just now';
  return new Intl.DateTimeFormat('en-BD', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dhaka',
  }).format(new Date(ts));
}

function ToastItem({
  toast,
  onDismiss,
  onOpenToast,
  onAudioUnlocked,
}: {
  toast: EnterpriseNotificationToast;
  onDismiss: (id: string) => void;
  onOpenToast?: (toast: EnterpriseNotificationToast) => void;
  onAudioUnlocked?: () => void;
}) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const durationMs =
      toast.eventType === 'high_priority' || toast.eventType === 'system_alert'
        ? 10000
        : 6500;
    const timer = window.setTimeout(() => {
      onDismiss(toast.id);
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [onDismiss, paused, toast.eventType, toast.id]);

  const visual = EVENT_VISUALS[toast.eventType] ?? EVENT_VISUALS.general;
  const Icon = visual.icon;

  return (
    <div
      role={toast.eventType === 'high_priority' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="toast-enter pointer-events-auto relative flex w-full overflow-hidden rounded-xl border border-slate-200/90 bg-white/95 shadow-[0_18px_40px_-14px_rgba(2,44,34,0.28)] backdrop-blur-md transition-all dark:border-emerald-800/70 dark:bg-[#062118]/95 dark:shadow-[0_20px_48px_-14px_rgba(0,0,0,0.65)]"
    >
      <div className={`w-1 shrink-0 ${visual.accentBar}`} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 items-start gap-3 p-3.5">
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${visual.iconBg} ${visual.iconColor}`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-emerald-300/70">
              {visual.label}
            </span>
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-400 dark:text-emerald-300/50">
              {formatToastTime(toast.receivedAt)}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs font-semibold text-slate-950 dark:text-emerald-50">
            {toast.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-600 dark:text-emerald-200/75">
            {toast.message}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {onOpenToast && (
              <button
                type="button"
                onClick={() => {
                  onOpenToast(toast);
                  onDismiss(toast.id);
                }}
                className="inline-flex min-h-7 items-center rounded-md bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-emerald-400 dark:text-[#022017] dark:hover:bg-emerald-300"
              >
                {toast.actionLabel ?? 'View'}
              </button>
            )}
            {toast.audioLocked && (
              <button
                type="button"
                onClick={() => {
                  void unlockNotificationAudio().then((state) => {
                    if (state === 'unlocked') {
                      onAudioUnlocked?.();
                    }
                  });
                }}
                className="inline-flex min-h-7 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-emerald-800/70 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
              >
                <Volume2 className="h-3 w-3" />
                Enable Sound
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification alert"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-emerald-300/60 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function EnterpriseNotificationToastStack({
  toasts,
  onDismiss,
  onOpenToast,
  onAudioUnlocked,
}: EnterpriseNotificationToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Live notifications"
      className="pointer-events-none fixed inset-x-3 top-[4.25rem] z-50 flex flex-col gap-2.5 sm:inset-x-auto sm:right-5 sm:w-[23rem]"
    >
      {toasts.slice(0, 3).map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          onOpenToast={onOpenToast}
          onAudioUnlocked={onAudioUnlocked}
        />
      ))}
    </div>
  );
}
