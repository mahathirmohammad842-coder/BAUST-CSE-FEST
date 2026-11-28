import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  ChevronDown,
  CircleUserRound,
  DoorOpen,
  FileSearch,
  History,
  LayoutDashboard,
  LifeBuoy,
  LockKeyhole,
  Megaphone,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PenSquare,
  Plug,
  Radio,
  Search,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
  UserRound,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import type { SettingsSection, WorkspaceRole } from '../types';

export type OrganizerRoute =
  | 'dashboard'
  | 'announcements'
  | 'inbox'
  | 'composer'
  | 'operations-inbox'
  | 'delivery-detail'
  | 'analytics'
  | 'online-users'
  | 'audit-logs'
  | 'activity-logs'
  | 'user-approvals'
  | 'super-admin-users'
  | 'blocked-users'
  | 'users'
  | 'profiles'
  | 'profile'
  | 'rooms'
  | 'settings'
  | 'system-settings'
  | 'integrations'
  | 'security-settings'
  | 'recycle-bin'
  | 'notification-trash'
  | 'rejected-trash'
  | 'system-health';

type NavGroupId =
  | 'communication'
  | 'users-roles'
  | 'profile'
  | 'monitoring'
  | 'system';

interface NavItemConfig {
  id: OrganizerRoute;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
  badgeTitle?: string;
  badgeTone?: 'danger' | 'amber' | 'subtle';
  keywords?: string[];
  settingsSection?: SettingsSection;
  matchRoutes?: OrganizerRoute[];
}

interface NavGroupConfig {
  id: NavGroupId;
  label: string;
  icon: typeof LayoutDashboard;
  items: NavItemConfig[];
}

interface SidebarProps {
  activeRole: WorkspaceRole;
  activeRoute: OrganizerRoute;
  failedDeliveryCount: number;
  unreadNotificationCount: number;
  pendingRequestCount: number;
  blockedUserCount: number;
  trashItemCount: number;
  onlineUserCount?: number;
  openOpsCount?: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onNavigate: (route: OrganizerRoute) => void;
  onNavigateSettings: (section: SettingsSection) => void;
}

const SIDEBAR_MINIMIZED_KEY = 'baust_sidebar_minimized_v1';

export function Sidebar({
  activeRole,
  activeRoute,
  failedDeliveryCount,
  unreadNotificationCount,
  pendingRequestCount,
  blockedUserCount,
  trashItemCount,
  onlineUserCount = 0,
  openOpsCount = 0,
  mobileOpen,
  onCloseMobile,
  onNavigate,
  onNavigateSettings,
}: SidebarProps) {
  const [navSearch, setNavSearch] = useState('');
  const [minimized, setMinimized] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_MINIMIZED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const groups: NavGroupConfig[] = useMemo(
    () => [
      {
        id: 'communication',
        label: 'Communication',
        icon: MessageSquare,
        items: [
          {
            id: 'announcements',
            label: 'Announcements',
            icon: Megaphone,
            badge: failedDeliveryCount > 0 ? failedDeliveryCount : undefined,
            badgeTitle:
              failedDeliveryCount > 0
                ? `${failedDeliveryCount} failed delivery dispatch${failedDeliveryCount === 1 ? '' : 'es'}`
                : undefined,
            badgeTone: 'danger',
            keywords: ['notices', 'broadcasts', 'delivery'],
            matchRoutes: ['announcements', 'delivery-detail'],
          },
          {
            id: 'inbox',
            label: 'Notifications',
            icon: Bell,
            badge:
              unreadNotificationCount > 0 ? unreadNotificationCount : undefined,
            badgeTitle:
              unreadNotificationCount > 0
                ? `${unreadNotificationCount} unread notification${unreadNotificationCount === 1 ? '' : 's'}`
                : undefined,
            badgeTone: 'amber',
            keywords: ['inbox', 'alerts', 'unread'],
          },
          {
            id: 'composer',
            label: 'Create Notice',
            icon: PenSquare,
            keywords: ['compose', 'send', 'publish', 'schedule'],
          },
          {
            id: 'operations-inbox',
            label: 'Support & Incidents',
            icon: LifeBuoy,
            badge: openOpsCount > 0 ? openOpsCount : undefined,
            badgeTitle:
              openOpsCount > 0
                ? `${openOpsCount} open message, incident, or info request${openOpsCount === 1 ? '' : 's'}`
                : undefined,
            badgeTone: 'amber',
            keywords: ['messages', 'incidents', 'helpdesk', 'info requests'],
          },
        ],
      },
      {
        id: 'users-roles',
        label: 'Users & Roles',
        icon: Users,
        items: [
          {
            id: 'users',
            label: 'Users',
            icon: UsersRound,
            keywords: ['directory', 'accounts', 'delete', 'archive'],
          },
          {
            id: 'user-approvals',
            label: 'User Approvals',
            icon: ShieldCheck,
            badge: pendingRequestCount > 0 ? pendingRequestCount : undefined,
            badgeTitle:
              pendingRequestCount > 0
                ? `${pendingRequestCount} pending approval${pendingRequestCount === 1 ? '' : 's'}`
                : undefined,
            badgeTone: 'danger',
            keywords: ['pending', 'registrations', 'review'],
          },
          ...(activeRole === 'Super Admin'
            ? [
                {
                  id: 'super-admin-users' as const,
                  label: 'Role Governance',
                  icon: UserCog,
                  keywords: ['promote', 'demote', 'permissions', 'super admin'],
                },
              ]
            : []),
          {
            id: 'blocked-users',
            label: 'Blocked Users',
            icon: ShieldAlert,
            badge: blockedUserCount > 0 ? blockedUserCount : undefined,
            badgeTitle:
              blockedUserCount > 0
                ? `${blockedUserCount} active block${blockedUserCount === 1 ? '' : 's'}`
                : undefined,
            badgeTone: 'subtle',
            keywords: ['suspended', 'restrictions'],
          },
        ],
      },
      {
        id: 'profile',
        label: 'Profile',
        icon: UserRound,
        items: [
          {
            id: 'profiles',
            label: 'Profile Management',
            icon: CircleUserRound,
            keywords: ['verification', 'edit', 'directory'],
          },
          {
            id: 'profile',
            label: 'My Profile',
            icon: UserRound,
            keywords: ['personal', 'account', 'bio'],
          },
        ],
      },
      {
        id: 'monitoring',
        label: 'Monitoring',
        icon: Activity,
        items: [
          {
            id: 'online-users',
            label: 'Online Users',
            icon: Radio,
            badge: onlineUserCount > 0 ? onlineUserCount : undefined,
            badgeTitle:
              onlineUserCount > 0
                ? `${onlineUserCount} user${onlineUserCount === 1 ? '' : 's'} online now`
                : undefined,
            badgeTone: 'subtle',
            keywords: ['presence', 'active', 'live', 'sessions'],
          },
          {
            id: 'analytics',
            label: 'Analytics',
            icon: BarChart3,
            keywords: ['metrics', 'engagement', 'delivery rate'],
          },
          ...(activeRole === 'Super Admin'
            ? [
                {
                  id: 'audit-logs' as const,
                  label: 'Audit Logs',
                  icon: FileSearch,
                  keywords: ['deletions', 'restores', 'roles', 'approvals'],
                },
                {
                  id: 'activity-logs' as const,
                  label: 'Activity Logs',
                  icon: History,
                  keywords: ['events', 'logins', 'timeline'],
                },
              ]
            : []),
        ],
      },
      {
        id: 'system',
        label: activeRole === 'Super Admin' ? 'System' : 'Preferences',
        icon: Settings,
        items:
          activeRole === 'Super Admin'
            ? [
                {
                  id: 'rooms',
                  label: 'Rooms & Venues',
                  icon: DoorOpen,
                  keywords: ['venues', 'labs', 'halls', 'capacity'],
                },
                {
                  id: 'system-settings',
                  label: 'System Settings',
                  icon: Settings,
                  settingsSection: 'account',
                  matchRoutes: ['system-settings', 'settings'],
                  keywords: ['preferences', 'appearance', 'notifications'],
                },
                {
                  id: 'integrations',
                  label: 'Integrations',
                  icon: Plug,
                  matchRoutes: ['integrations', 'system-health'],
                  keywords: ['supabase', 'connectivity', 'diagnostics', 'database'],
                },
                {
                  id: 'security-settings',
                  label: 'Security Settings',
                  icon: LockKeyhole,
                  settingsSection: 'security',
                  keywords: ['password', 'rbac', 'session'],
                },
              ]
            : [
                {
                  id: 'settings',
                  label: 'My Settings',
                  icon: Settings,
                  settingsSection: 'account',
                  keywords: ['preferences', 'appearance', 'notifications', 'password'],
                },
              ],
      },
    ],
    [
      activeRole,
      blockedUserCount,
      failedDeliveryCount,
      onlineUserCount,
      openOpsCount,
      pendingRequestCount,
      unreadNotificationCount,
    ]
  );

  const activeGroupId = useMemo<NavGroupId | null>(() => {
    for (const group of groups) {
      const ownsRoute = group.items.some(
        (item) =>
          item.id === activeRoute || item.matchRoutes?.includes(activeRoute)
      );
      if (ownsRoute) return group.id;
    }
    return null;
  }, [activeRoute, groups]);

  const [expandedGroups, setExpandedGroups] = useState<
    Record<NavGroupId, boolean>
  >(() => ({
    communication: activeGroupId === 'communication' || activeGroupId === null,
    'users-roles': activeGroupId === 'users-roles',
    profile: activeGroupId === 'profile',
    monitoring: activeGroupId === 'monitoring',
    system: activeGroupId === 'system',
  }));

  // Auto-expand the group that owns the active route
  useEffect(() => {
    if (!activeGroupId) return;
    setExpandedGroups((prev) =>
      prev[activeGroupId] ? prev : { ...prev, [activeGroupId]: true }
    );
  }, [activeGroupId]);

  const toggleGroup = (id: NavGroupId) => {
    if (minimized) {
      setMinimized(false);
      setExpandedGroups((prev) => ({ ...prev, [id]: true }));
      return;
    }
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleMinimized = () => {
    setMinimized((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_MINIMIZED_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const normalizedQuery = navSearch.trim().toLowerCase();

  const handleSelectItem = (item: NavItemConfig) => {
    if (item.id === 'system-settings') {
      onNavigate('system-settings');
      onCloseMobile();
      return;
    }
    if (item.id === 'security-settings') {
      onNavigate('security-settings');
      onCloseMobile();
      return;
    }
    if (item.settingsSection) {
      onNavigateSettings(item.settingsSection);
      onCloseMobile();
      return;
    }
    onNavigate(item.id);
    onCloseMobile();
  };

  const handleDirectRoute = (route: OrganizerRoute) => {
    onNavigate(route);
    onCloseMobile();
  };

  const isRouteSelected = (item: NavItemConfig) =>
    activeRoute === item.id || Boolean(item.matchRoutes?.includes(activeRoute));

  const isRecycleActive =
    activeRoute === 'recycle-bin' ||
    activeRoute === 'notification-trash' ||
    activeRoute === 'rejected-trash';

  const renderBadge = (
    count: number | undefined,
    tone: 'danger' | 'amber' | 'subtle' = 'danger',
    title?: string
  ) => {
    if (count === undefined || count <= 0) return null;
    const toneClass =
      tone === 'danger'
        ? 'bg-red-600 text-white'
        : tone === 'amber'
          ? 'bg-amber-500 text-[#021A12]'
          : 'bg-emerald-800/90 text-emerald-100';
    return (
      <span
        title={title}
        className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none tabular-nums shrink-0 ${toneClass}`}
      >
        {count}
      </span>
    );
  };

  const renderSidebarBody = (isMobileDrawer: boolean) => {
    const isIconRail = !isMobileDrawer && minimized;

    return (
      <div className="flex h-full flex-col bg-[#042419] text-emerald-100 border-r border-emerald-900/70 dark:bg-[#031A12] dark:border-emerald-800/50 transition-colors duration-150">
        {/* Mobile header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-900/70 dark:border-emerald-800/50 lg:hidden">
          <span className="font-display text-sm font-extrabold tracking-tight text-white">
            BAUST CSE FEST
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-emerald-200/70 hover:bg-emerald-900/50 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search / Collapse Bar */}
        <div
          className={`border-b border-emerald-900/60 px-2.5 py-2.5 ${
            isIconRail ? 'flex flex-col items-center gap-1.5' : 'space-y-2'
          }`}
        >
          {isIconRail ? (
            <>
              <button
                type="button"
                onClick={toggleMinimized}
                title="Expand sidebar"
                aria-label="Expand sidebar"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-emerald-200/80 hover:bg-emerald-900/55 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setMinimized(false);
                }}
                title="Search navigation"
                aria-label="Search navigation"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-emerald-200/70 hover:bg-emerald-900/55 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <Search className="h-4 w-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <label className="relative flex-1 min-w-0">
                <span className="sr-only">Filter navigation menu</span>
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-200/50"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={navSearch}
                  onChange={(e) => setNavSearch(e.target.value)}
                  placeholder="Jump to module…"
                  className="h-8 w-full rounded-lg border border-emerald-800/70 bg-[#031A12] pl-8 pr-2 text-xs text-white placeholder:text-emerald-200/45 outline-none transition focus:border-emerald-500"
                />
              </label>
              {!isMobileDrawer && (
                <button
                  type="button"
                  onClick={toggleMinimized}
                  title="Minimize sidebar"
                  aria-label="Minimize sidebar"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-800/70 text-emerald-200/75 hover:bg-emerald-900/55 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Navigation Sections */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2.5">
          <nav className="space-y-1" aria-label="Workspace Navigation">
            {/* Primary Dashboard entry */}
            {(!normalizedQuery ||
              'dashboard overview home'.includes(normalizedQuery)) && (
              <button
                type="button"
                onClick={() => handleDirectRoute('dashboard')}
                title={isIconRail ? 'Dashboard' : undefined}
                aria-current={activeRoute === 'dashboard' ? 'page' : undefined}
                className={`flex w-full items-center ${
                  isIconRail ? 'justify-center px-2' : 'justify-between px-2.5'
                } gap-2 rounded-lg py-2 text-[13px] font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  activeRoute === 'dashboard'
                    ? 'bg-[#073827] text-white dark:bg-[#073223]'
                    : 'text-emerald-100/85 hover:bg-emerald-900/45 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <LayoutDashboard
                    className={`h-4 w-4 shrink-0 ${
                      activeRoute === 'dashboard'
                        ? 'text-emerald-300'
                        : 'text-emerald-200/65'
                    }`}
                    aria-hidden="true"
                  />
                  {!isIconRail && <span className="truncate">Dashboard</span>}
                </span>
              </button>
            )}

            {/* Collapsible Feature Groups */}
            {groups.map((group) => {
              const GroupIcon = group.icon;
              const matchingItems = normalizedQuery
                ? group.items.filter((item) =>
                    [
                      group.label,
                      item.label,
                      ...(item.keywords ?? []),
                    ]
                      .join(' ')
                      .toLowerCase()
                      .includes(normalizedQuery)
                  )
                : group.items;

              if (normalizedQuery && matchingItems.length === 0) return null;

              const groupBadgeTotal = group.items.reduce(
                (sum, item) => sum + (item.badge ?? 0),
                0
              );
              const groupHasDanger = group.items.some(
                (item) => (item.badge ?? 0) > 0 && item.badgeTone === 'danger'
              );
              const groupHasAmber = group.items.some(
                (item) => (item.badge ?? 0) > 0 && item.badgeTone === 'amber'
              );
              const groupActive = group.items.some((item) =>
                isRouteSelected(item)
              );
              const isOpen =
                Boolean(normalizedQuery) || expandedGroups[group.id];

              if (isIconRail) {
                return (
                  <div
                    key={group.id}
                    className="border-t border-emerald-900/45 pt-1.5 mt-1.5 space-y-1"
                  >
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const selected = isRouteSelected(item);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectItem(item)}
                          title={`${group.label}: ${item.label}${
                            item.badge ? ` (${item.badge})` : ''
                          }`}
                          aria-label={`${item.label}${
                            item.badge ? `, ${item.badge}` : ''
                          }`}
                          aria-current={selected ? 'page' : undefined}
                          className={`relative flex w-full items-center justify-center rounded-lg py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                            selected
                              ? 'bg-[#073827] text-white'
                              : 'text-emerald-100/75 hover:bg-emerald-900/45 hover:text-white'
                          }`}
                        >
                          <ItemIcon
                            className={`h-4 w-4 ${
                              selected
                                ? 'text-emerald-300'
                                : 'text-emerald-200/65'
                            }`}
                            aria-hidden="true"
                          />
                          {item.badge !== undefined && item.badge > 0 && (
                            <span
                              className={`absolute right-1.5 top-1 h-2 w-2 rounded-full ${
                                item.badgeTone === 'danger'
                                  ? 'bg-red-500'
                                  : item.badgeTone === 'amber'
                                    ? 'bg-amber-400'
                                    : 'bg-emerald-400'
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              }

              return (
                <div key={group.id} className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isOpen}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[12px] font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      groupActive && !isOpen
                        ? 'bg-[#062E20] text-white'
                        : 'text-emerald-100/80 hover:bg-emerald-900/35 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <GroupIcon
                        className={`h-3.5 w-3.5 shrink-0 ${
                          groupActive
                            ? 'text-emerald-300'
                            : 'text-emerald-200/55'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{group.label}</span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {!isOpen &&
                        groupBadgeTotal > 0 &&
                        renderBadge(
                          groupBadgeTotal,
                          groupHasDanger
                            ? 'danger'
                            : groupHasAmber
                              ? 'amber'
                              : 'subtle'
                        )}
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-emerald-200/55 transition-transform duration-150 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </span>
                  </button>

                  <div
                    className={`grid transition-[grid-template-rows] duration-150 ease-out ${
                      isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="mt-0.5 ml-3 border-l border-emerald-800/60 pl-2 space-y-0.5 py-0.5">
                        {matchingItems.map((item) => {
                          const ItemIcon = item.icon;
                          const selected = isRouteSelected(item);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSelectItem(item)}
                              aria-current={selected ? 'page' : undefined}
                              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                                selected
                                  ? 'bg-[#073827] text-white dark:bg-[#073223]'
                                  : 'text-emerald-100/75 hover:bg-emerald-900/45 hover:text-white'
                              }`}
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <ItemIcon
                                  className={`h-3.5 w-3.5 shrink-0 ${
                                    selected
                                      ? 'text-emerald-300'
                                      : 'text-emerald-200/55'
                                  }`}
                                  aria-hidden="true"
                                />
                                <span className="truncate">{item.label}</span>
                              </span>
                              {renderBadge(
                                item.badge,
                                item.badgeTone,
                                item.badgeTitle
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Unified Recycle Bin */}
            {(!normalizedQuery ||
              'recycle bin trash notifications rejected deleted archived'.includes(
                normalizedQuery
              )) && (
              <div className="pt-1 mt-1 border-t border-emerald-900/60">
                <button
                  type="button"
                  onClick={() => handleDirectRoute('recycle-bin')}
                  title={
                    isIconRail
                      ? `Recycle Bin${trashItemCount > 0 ? ` (${trashItemCount})` : ''}`
                      : undefined
                  }
                  aria-current={isRecycleActive ? 'page' : undefined}
                  className={`relative flex w-full items-center ${
                    isIconRail
                      ? 'justify-center px-2'
                      : 'justify-between px-2.5'
                  } gap-2 rounded-lg py-2 text-[13px] font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    isRecycleActive
                      ? 'bg-[#073827] text-white dark:bg-[#073223]'
                      : 'text-emerald-100/85 hover:bg-emerald-900/45 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Trash2
                      className={`h-4 w-4 shrink-0 ${
                        isRecycleActive
                          ? 'text-emerald-300'
                          : 'text-emerald-200/65'
                      }`}
                      aria-hidden="true"
                    />
                    {!isIconRail && <span className="truncate">Recycle Bin</span>}
                  </span>
                  {!isIconRail &&
                    renderBadge(
                      trashItemCount > 0 ? trashItemCount : undefined,
                      'subtle',
                      trashItemCount > 0
                        ? `${trashItemCount} item${trashItemCount === 1 ? '' : 's'} in Recycle Bin`
                        : undefined
                    )}
                  {isIconRail && trashItemCount > 0 && (
                    <span className="absolute right-1.5 top-1 h-2 w-2 rounded-full bg-emerald-400" />
                  )}
                </button>
              </div>
            )}
          </nav>
        </div>

        {/* Footer */}
        <div
          className={`border-t border-emerald-900/70 px-3 py-2.5 text-[11px] text-emerald-200/65 ${
            isIconRail ? 'flex items-center justify-center' : 'flex items-center justify-between gap-2'
          }`}
        >
          {isIconRail ? (
            <span title="Saidpur Campus · GMT+6" className="font-mono text-[10px]">
              +6
            </span>
          ) : (
            <>
              <span className="truncate">Saidpur Campus · GMT+6</span>
              <Server className="h-3.5 w-3.5 shrink-0 text-emerald-300/60" aria-hidden="true" />
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <aside
        className={`hidden h-full min-h-0 shrink-0 transition-[width] duration-150 lg:block ${
          minimized ? 'w-[68px]' : 'w-60'
        }`}
      >
        {renderSidebarBody(false)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-x-0 bottom-0 top-14 z-40 flex lg:hidden">
          <div
            className="fixed inset-x-0 bottom-0 top-14 bg-[#02160F]/70"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="sidebar-enter relative z-50 h-full w-64 max-w-[85vw]">
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}
    </>
  );
}
