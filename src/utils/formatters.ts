import type { Announcement, NotificationPriority, UserRole } from '../types';

export function formatDhakaDateTime(isoString?: string): string {
  if (!isoString) return 'Not scheduled';
  try {
    const date = new Date(isoString);
    return (
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dhaka',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(date) + ' BST'
    );
  } catch {
    return isoString;
  }
}

export function formatDhakaTimeOnly(isoString?: string): string {
  if (!isoString) return '--:--';
  try {
    const date = new Date(isoString);
    return (
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dhaka',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(date) + ' BST'
    );
  } catch {
    return isoString;
  }
}

export function formatDhakaDateOnly(isoString?: string): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatPercent(part: number, total: number): string {
  if (total <= 0) return '0.0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

export function isAnnouncementVisibleToRole(
  announcement: Announcement,
  role: UserRole
): boolean {
  if (announcement.trashedAt || announcement.status !== 'Delivered') {
    return false;
  }
  if (announcement.targeting.everyoneAttending) {
    return true;
  }
  if (announcement.targeting.roles.includes(role)) {
    return true;
  }
  if (
    role === 'Super Admin' &&
    announcement.targeting.roles.includes('Organizer')
  ) {
    return true;
  }
  return false;
}

export function isAnnouncementVisibleToRbacRoles(
  announcement: Announcement,
  rbacRoles: UserRole[]
): boolean {
  if (announcement.trashedAt || announcement.status !== 'Delivered') {
    return false;
  }
  if (announcement.targeting.everyoneAttending) {
    return true;
  }
  return rbacRoles.some(
    (r) =>
      announcement.targeting.roles.includes(r) ||
      (r === 'Super Admin' && announcement.targeting.roles.includes('Organizer'))
  );
}

export function getPriorityWeight(priority: NotificationPriority): number {
  switch (priority) {
    case 'Emergency':
      return 4;
    case 'High':
      return 3;
    case 'Normal':
      return 2;
    case 'Low':
      return 1;
  }
}

export function summarizeTargeting(announcement: Announcement): string {
  const { targeting } = announcement;
  if (targeting.everyoneAttending) {
    return 'All Fest Attendees';
  }
  const parts: string[] = [];
  if (targeting.roles.length > 0) {
    parts.push(
      targeting.roles.length <= 2
        ? targeting.roles.join(', ')
        : `${targeting.roles.slice(0, 2).join(', ')} +${targeting.roles.length - 2}`
    );
  }
  if (targeting.rooms.length > 0) {
    parts.push(targeting.rooms[0] + (targeting.rooms.length > 1 ? ` +${targeting.rooms.length - 1}` : ''));
  }
  if (targeting.competitions.length > 0) {
    parts.push(targeting.competitions[0]);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Custom Cohort';
}
