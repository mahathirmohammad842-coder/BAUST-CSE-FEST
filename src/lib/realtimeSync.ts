import { QueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { rpcUpdateMyPresenceStatus, supabase } from './supabase';
import type { PresenceStatus, PresenceUserEntry, WorkspaceRole } from '../types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export type WorkspaceSyncDomain =
  | 'profiles'
  | 'announcements'
  | 'notification_actions'
  | 'ops'
  | 'notifications'
  | 'role_promoted'
  | 'all';

interface WorkspaceBroadcastPayload {
  domain: WorkspaceSyncDomain;
  targetUserId?: string;
  actorId?: string;
  sentAt: string;
}

const SYNC_CHANNEL_NAME = 'baust-workspace-realtime-v1';
const PRESENCE_CHANNEL_NAME = 'baust-presence-v1';
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes inactive -> Away

let activeSyncChannel: RealtimeChannel | null = null;

export function broadcastWorkspaceSync(
  domain: WorkspaceSyncDomain,
  options?: { targetUserId?: string; actorId?: string }
): void {
  const payload: WorkspaceBroadcastPayload = {
    domain,
    targetUserId: options?.targetUserId,
    actorId: options?.actorId,
    sentAt: new Date().toISOString(),
  };

  if (domain === 'all' || domain === 'profiles' || domain === 'role_promoted') {
    void queryClient.invalidateQueries({ queryKey: ['baust', 'profiles'] });
  }
  if (domain === 'all' || domain === 'announcements') {
    void queryClient.invalidateQueries({ queryKey: ['baust', 'announcements'] });
  }
  if (domain === 'all' || domain === 'ops') {
    void queryClient.invalidateQueries({ queryKey: ['baust', 'ops'] });
  }
  if (domain === 'all' || domain === 'notifications') {
    void queryClient.invalidateQueries({ queryKey: ['baust', 'notifications'] });
  }

  if (!supabase || !activeSyncChannel) return;
  void activeSyncChannel
    .send({
      type: 'broadcast',
      event: 'workspace:sync',
      payload,
    })
    .catch((err) => {
      console.warn('Workspace sync broadcast error:', err);
    });
}

interface UseRealtimeWorkspaceSyncOptions {
  userId: string | null;
  isStaff: boolean;
  onProfilesChanged: () => void;
  onAnnouncementsChanged: () => void;
  onNotificationActionsChanged: () => void;
  onOpsChanged: () => void;
  onNotificationsChanged: () => void;
  onRolePromoted?: (targetUserId?: string) => void;
}

export function useRealtimeWorkspaceSync({
  userId,
  isStaff,
  onProfilesChanged,
  onAnnouncementsChanged,
  onNotificationActionsChanged,
  onOpsChanged,
  onNotificationsChanged,
  onRolePromoted,
}: UseRealtimeWorkspaceSyncOptions): { isRealtimeConnected: boolean } {
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const callbacksRef = useRef({
    onProfilesChanged,
    onAnnouncementsChanged,
    onNotificationActionsChanged,
    onOpsChanged,
    onNotificationsChanged,
    onRolePromoted,
  });
  callbacksRef.current = {
    onProfilesChanged,
    onAnnouncementsChanged,
    onNotificationActionsChanged,
    onOpsChanged,
    onNotificationsChanged,
    onRolePromoted,
  };

  useEffect(() => {
    const client = supabase;
    if (!client || !userId) {
      setIsRealtimeConnected(false);
      return;
    }

    const timers: Partial<Record<WorkspaceSyncDomain, number>> = {};

    const triggerDebounced = (domain: WorkspaceSyncDomain, targetUserId?: string) => {
      if (domain === 'role_promoted') {
        void queryClient.invalidateQueries({ queryKey: ['baust', 'profiles'] });
        callbacksRef.current.onProfilesChanged();
        callbacksRef.current.onRolePromoted?.(targetUserId);
        return;
      }

      if (timers[domain]) {
        window.clearTimeout(timers[domain]);
      }
      timers[domain] = window.setTimeout(() => {
        delete timers[domain];
        if (domain === 'profiles' || domain === 'all') {
          void queryClient.invalidateQueries({ queryKey: ['baust', 'profiles'] });
          callbacksRef.current.onProfilesChanged();
        }
        if (domain === 'announcements' || domain === 'all') {
          void queryClient.invalidateQueries({ queryKey: ['baust', 'announcements'] });
          callbacksRef.current.onAnnouncementsChanged();
        }
        if (domain === 'notification_actions' || domain === 'all') {
          void queryClient.invalidateQueries({
            queryKey: ['baust', 'notification_actions'],
          });
          callbacksRef.current.onNotificationActionsChanged();
        }
        if (domain === 'ops' || domain === 'all') {
          void queryClient.invalidateQueries({ queryKey: ['baust', 'ops'] });
          callbacksRef.current.onOpsChanged();
        }
        if (domain === 'notifications' || domain === 'all') {
          void queryClient.invalidateQueries({
            queryKey: ['baust', 'notifications'],
          });
          callbacksRef.current.onNotificationsChanged();
        }
      }, 120);
    };

    const channel = client
      .channel(SYNC_CHANNEL_NAME, {
        config: {
          broadcast: { self: false },
        },
      })
      .on('broadcast', { event: 'workspace:sync' }, ({ payload }) => {
        const msg = payload as WorkspaceBroadcastPayload | undefined;
        if (!msg?.domain) return;
        triggerDebounced(msg.domain, msg.targetUserId);
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_profiles' },
        (payload) => {
          const newRow = payload.new as Record<string, unknown> | undefined;
          const oldRow = payload.old as Record<string, unknown> | undefined;
          const rowId = String(newRow?.id ?? oldRow?.id ?? '');
          if (rowId === userId) {
            // Instant self-profile & role promotion sync
            const prevRole = oldRow?.assigned_role ?? oldRow?.role;
            const nextRole = newRow?.assigned_role ?? newRow?.role;
            if (prevRole && nextRole && prevRole !== nextRole) {
              triggerDebounced('role_promoted', userId);
              return;
            }
          }
          triggerDebounced('profiles');
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => triggerDebounced('announcements')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcement_audit_logs' },
        () => {
          triggerDebounced('announcements');
          triggerDebounced('profiles');
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'personal_notification_actions' },
        () => triggerDebounced('notification_actions')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => triggerDebounced('notifications')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'organizer_messages' },
        () => triggerDebounced('ops')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'organizer_message_replies' },
        () => triggerDebounced('ops')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incident_reports' },
        () => triggerDebounced('ops')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_info_requests' },
        () => triggerDebounced('ops')
      );

    if (isStaff) {
      const governanceTables = [
        'role_change_logs',
        'approval_logs',
        'verification_logs',
        'activity_logs',
        'user_deletion_audit_logs',
        'role_permissions',
      ];
      for (const table of governanceTables) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          () => triggerDebounced('profiles')
        );
      }
    }

    activeSyncChannel = channel;
    channel.subscribe((status) => {
      setIsRealtimeConnected(status === 'SUBSCRIBED');
    });

    return () => {
      Object.values(timers).forEach((timerId) => {
        if (timerId) window.clearTimeout(timerId);
      });
      if (activeSyncChannel === channel) {
        activeSyncChannel = null;
      }
      setIsRealtimeConnected(false);
      void client.removeChannel(channel);
    };
  }, [userId, isStaff]);

  return { isRealtimeConnected };
}

interface PresenceTrackPayload {
  userId: string;
  sessionId: string;
  fullName: string;
  email: string;
  role: WorkspaceRole;
  avatarUrl?: string;
  department?: string;
  institution?: string;
  status: PresenceStatus;
  lastSeenAt: string;
  lastLoginAt: string | null;
  currentRoute: string;
}

interface UsePresenceTrackerOptions {
  currentUser: {
    userId: string;
    fullName: string;
    email: string;
    role: WorkspaceRole;
    avatarUrl?: string;
    department?: string;
    institution?: string;
    lastLoginAt?: string | null;
  } | null;
  currentRoute: string;
}

export function usePresenceTracker({
  currentUser,
  currentRoute,
}: UsePresenceTrackerOptions): {
  livePresenceMap: Record<string, PresenceUserEntry>;
  isPresenceConnected: boolean;
} {
  const [livePresenceMap, setLivePresenceMap] = useState<
    Record<string, PresenceUserEntry>
  >({});
  const [isPresenceConnected, setIsPresenceConnected] = useState(false);

  const sessionIdRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  );
  const statusRef = useRef<PresenceStatus>('Online');
  const routeRef = useRef(currentRoute);
  routeRef.current = currentRoute;

  const userSnapshotRef = useRef(currentUser);
  userSnapshotRef.current = currentUser;
  const channelRef = useRef<RealtimeChannel | null>(null);

  const userId = currentUser?.userId ?? null;
  const userRole = currentUser?.role ?? null;
  const userName = currentUser?.fullName ?? null;

  // Re-track cleanly when currentRoute or role changes on an active channel
  useEffect(() => {
    const channel = channelRef.current;
    const user = userSnapshotRef.current;
    if (!channel || !user) return;
    const payload: PresenceTrackPayload = {
      userId: user.userId,
      sessionId: sessionIdRef.current,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      department: user.department,
      institution: user.institution,
      status: statusRef.current,
      lastSeenAt: new Date().toISOString(),
      lastLoginAt: user.lastLoginAt ?? null,
      currentRoute,
    };
    void channel.track(payload).catch(() => {});
  }, [currentRoute, userRole, userName]);

  useEffect(() => {
    const client = supabase;
    const user = userSnapshotRef.current;
    if (!client || !userId || !user) {
      setLivePresenceMap({});
      setIsPresenceConnected(false);
      return;
    }

    statusRef.current = 'Online';
    let idleTimerId: number | null = null;
    let lastActivitySyncAt = 0;

    const buildPayload = (status: PresenceStatus): PresenceTrackPayload => {
      const latest = userSnapshotRef.current ?? user;
      return {
        userId: latest.userId,
        sessionId: sessionIdRef.current,
        fullName: latest.fullName,
        email: latest.email,
        role: latest.role,
        avatarUrl: latest.avatarUrl,
        department: latest.department,
        institution: latest.institution,
        status,
        lastSeenAt: new Date().toISOString(),
        lastLoginAt: latest.lastLoginAt ?? null,
        currentRoute: routeRef.current,
      };
    };

    const resetIdleTimer = () => {
      if (idleTimerId !== null) {
        window.clearTimeout(idleTimerId);
      }
      idleTimerId = window.setTimeout(() => {
        if (statusRef.current !== 'Away') {
          statusRef.current = 'Away';
          void channelRef.current?.track(buildPayload('Away')).catch(() => {});
          void rpcUpdateMyPresenceStatus('Away');
        }
      }, IDLE_TIMEOUT_MS);
    };

    const handleUserActivity = () => {
      const now = Date.now();
      const wasAway = statusRef.current !== 'Online';
      if (wasAway) {
        statusRef.current = 'Online';
        lastActivitySyncAt = now;
        void channelRef.current?.track(buildPayload('Online')).catch(() => {});
        void rpcUpdateMyPresenceStatus('Online');
      } else if (now - lastActivitySyncAt > 45_000) {
        lastActivitySyncAt = now;
        void channelRef.current?.track(buildPayload('Online')).catch(() => {});
        void rpcUpdateMyPresenceStatus('Online');
      }
      resetIdleTimer();
    };

    const channel = client.channel(PRESENCE_CHANNEL_NAME, {
      config: {
        presence: {
          key: userId,
        },
      },
    });
    channelRef.current = channel;

    const syncPresenceState = () => {
      const state = channel.presenceState<PresenceTrackPayload>();
      const nextMap: Record<string, PresenceUserEntry> = {};

      for (const [key, presences] of Object.entries(state)) {
        if (!Array.isArray(presences) || presences.length === 0) continue;
        // Prefer 'Online' over 'Away', and most recent lastSeenAt
        const sorted = [...presences].sort((a, b) => {
          if (a.status !== b.status) {
            if (a.status === 'Online') return -1;
            if (b.status === 'Online') return 1;
          }
          return Date.parse(b.lastSeenAt || '') - Date.parse(a.lastSeenAt || '');
        });
        const primary = sorted[0];
        const entryId = primary.userId || key;
        nextMap[entryId] = {
          userId: entryId,
          fullName: primary.fullName,
          email: primary.email,
          role: primary.role,
          avatarUrl: primary.avatarUrl,
          department: primary.department,
          institution: primary.institution,
          status: primary.status,
          lastSeenAt: primary.lastSeenAt,
          lastLoginAt: primary.lastLoginAt,
          currentSessionId: primary.sessionId,
          currentRoute: primary.currentRoute,
          activeSessionsCount: presences.length,
        };
      }

      setLivePresenceMap(nextMap);
    };

    channel
      .on('presence', { event: 'sync' }, syncPresenceState)
      .on('presence', { event: 'join' }, syncPresenceState)
      .on('presence', { event: 'leave' }, syncPresenceState)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsPresenceConnected(true);
          statusRef.current = 'Online';
          await channel.track(buildPayload('Online'));
          void rpcUpdateMyPresenceStatus('Online');
          resetIdleTimer();
        } else {
          setIsPresenceConnected(false);
        }
      });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleUserActivity();
      }
    };

    const handleUnload = () => {
      void channel.untrack().catch(() => {});
      void rpcUpdateMyPresenceStatus('Offline');
    };

    const activityEvents: (keyof WindowEventMap)[] = [
      'pointerdown',
      'keydown',
      'scroll',
      'touchstart',
    ];
    for (const evt of activityEvents) {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      if (idleTimerId !== null) {
        window.clearTimeout(idleTimerId);
      }
      for (const evt of activityEvents) {
        window.removeEventListener(evt, handleUserActivity);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);

      void channel.untrack().catch(() => {});
      void rpcUpdateMyPresenceStatus('Offline');
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
      setIsPresenceConnected(false);
      void client.removeChannel(channel);
    };
  }, [userId]);

  return { livePresenceMap, isPresenceConnected };
}
