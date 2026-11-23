import {
  Bell,
  Globe,
  Mail,
  MessageSquare,
  Smartphone,
} from 'lucide-react';
import type { NotificationChannel } from '../types';

interface ChannelPillProps {
  channel: NotificationChannel;
  compact?: boolean;
}

export function getChannelIcon(channel: NotificationChannel) {
  switch (channel) {
    case 'In-App':
      return Bell;
    case 'Email':
      return Mail;
    case 'SMS':
      return MessageSquare;
    case 'Push Notification':
      return Smartphone;
    case 'Web Notification':
      return Globe;
  }
}

export function ChannelPill({ channel, compact = false }: ChannelPillProps) {
  const Icon = getChannelIcon(channel);
  const label =
    compact && channel === 'Push Notification'
      ? 'Push'
      : compact && channel === 'Web Notification'
        ? 'Web'
        : channel;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200/80 bg-emerald-50/60 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-200 whitespace-nowrap shrink-0">
      <Icon className="h-3 w-3 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
      {label}
    </span>
  );
}
