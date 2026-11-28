export interface PersonalNotificationState {
  read: boolean;
  starred: boolean;
  saved: boolean;
  pinned: boolean;
  archived: boolean;
  deleted: boolean;
  snoozedUntil: string | null;
  reminderNotifiedAt: string | null;
  followUp: boolean;
  dueAt: string | null;
  labels: string[];
  draftResponse: string;
  viewCount: number;
  lastOpenedAt: string | null;
  readTimeSeconds: number;
}

export type NotificationActionName =
  | 'read'
  | 'unread'
  | 'starred'
  | 'unstarred'
  | 'saved'
  | 'unsaved'
  | 'pinned'
  | 'unpinned'
  | 'archived'
  | 'unarchived'
  | 'deleted'
  | 'restored'
  | 'snoozed'
  | 'unsnoozed'
  | 'follow-up-set'
  | 'follow-up-cleared'
  | 'label-added'
  | 'label-removed'
  | 'response-draft-saved'
  | 'viewed'
  | 'read-time'
  | 'reminder-triggered'
  | 'shared'
  | 'copied'
  | 'printed'
  | 'exported';

export interface NotificationActionEvent {
  id: string;
  userId: string;
  notificationId: string;
  action: NotificationActionName;
  occurredAt: string;
  detail?: string;
}

export interface NotificationActionStore {
  byUserId: Record<string, Record<string, PersonalNotificationState>>;
  events: NotificationActionEvent[];
}

export const NOTIFICATION_ACTION_STORAGE_KEY =
  'baust_personal_notification_actions_v1';

export function createDefaultPersonalNotificationState(): PersonalNotificationState {
  return {
    read: false,
    starred: false,
    saved: false,
    pinned: false,
    archived: false,
    deleted: false,
    snoozedUntil: null,
    reminderNotifiedAt: null,
    followUp: false,
    dueAt: null,
    labels: [],
    draftResponse: '',
    viewCount: 0,
    lastOpenedAt: null,
    readTimeSeconds: 0,
  };
}

export function loadNotificationActionStore(): NotificationActionStore {
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_ACTION_STORAGE_KEY);
    if (!raw) return { byUserId: {}, events: [] };

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { byUserId: {}, events: [] };
    }

    const value = parsed as Partial<NotificationActionStore>;
    const byUserId =
      value.byUserId && typeof value.byUserId === 'object'
        ? value.byUserId
        : {};
    const users: NotificationActionStore['byUserId'] = {};

    for (const [userId, notifications] of Object.entries(byUserId)) {
      if (!notifications || typeof notifications !== 'object') continue;
      users[userId] = {};
      for (const [notificationId, state] of Object.entries(notifications)) {
        if (!state || typeof state !== 'object') continue;
        const defaults = createDefaultPersonalNotificationState();
        const candidate = state as Partial<PersonalNotificationState>;
        users[userId][notificationId] = {
          ...defaults,
          ...candidate,
          snoozedUntil:
            typeof candidate.snoozedUntil === 'string'
              ? candidate.snoozedUntil
              : null,
          reminderNotifiedAt:
            typeof candidate.reminderNotifiedAt === 'string'
              ? candidate.reminderNotifiedAt
              : null,
          dueAt: typeof candidate.dueAt === 'string' ? candidate.dueAt : null,
          labels: Array.isArray(candidate.labels)
            ? candidate.labels.filter(
                (label): label is string => typeof label === 'string'
              )
            : [],
          draftResponse:
            typeof candidate.draftResponse === 'string'
              ? candidate.draftResponse
              : '',
          viewCount:
            typeof candidate.viewCount === 'number' &&
            Number.isFinite(candidate.viewCount)
              ? Math.max(0, candidate.viewCount)
              : 0,
          readTimeSeconds:
            typeof candidate.readTimeSeconds === 'number' &&
            Number.isFinite(candidate.readTimeSeconds)
              ? Math.max(0, candidate.readTimeSeconds)
              : 0,
          lastOpenedAt:
            typeof candidate.lastOpenedAt === 'string'
              ? candidate.lastOpenedAt
              : null,
        };
      }
    }

    return {
      byUserId: users,
      events: Array.isArray(value.events)
        ? value.events.slice(0, 5000).filter(
            (event): event is NotificationActionEvent =>
              Boolean(event) &&
              typeof event === 'object' &&
              typeof (event as NotificationActionEvent).id === 'string' &&
              typeof (event as NotificationActionEvent).userId === 'string' &&
              typeof (event as NotificationActionEvent).notificationId ===
                'string' &&
              typeof (event as NotificationActionEvent).action === 'string' &&
              typeof (event as NotificationActionEvent).occurredAt === 'string'
          )
        : [],
    };
  } catch {
    return { byUserId: {}, events: [] };
  }
}

export function saveNotificationActionStore(
  store: NotificationActionStore
): void {
  window.localStorage.setItem(
    NOTIFICATION_ACTION_STORAGE_KEY,
    JSON.stringify(store)
  );
}
