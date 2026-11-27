import {
  BarChart3,
  CircleUserRound,
  LayoutDashboard,
  Megaphone,
  PenSquare,
  Server,
  ShieldAlert,
  ShieldCheck,
  Settings,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import type { SettingsSection, WorkspaceRole } from '../types';

export type OrganizerRoute =
  | 'dashboard'
  | 'announcements'
  | 'composer'
  | 'delivery-detail'
  | 'analytics'
  | 'user-approvals'
  | 'rejected-trash'
  | 'blocked-users'
  | 'users'
  | 'profiles'
  | 'system-health'
  | 'profile'
  | 'settings';

interface SidebarProps {
  activeRole: WorkspaceRole;
  activeRoute: OrganizerRoute;
  failedDeliveryCount: number;
  pendingRequestCount: number;
  blockedUserCount: number;
  trashedRejectedCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onNavigate: (route: OrganizerRoute) => void;
  onNavigateSettings: (section: SettingsSection) => void;
}

export function Sidebar({
  activeRole,
  activeRoute,
  failedDeliveryCount,
  pendingRequestCount,
  blockedUserCount,
  trashedRejectedCount,
  mobileOpen,
  onCloseMobile,
  onNavigate,
  onNavigateSettings,
}: SidebarProps) {
  const links: {
    id: OrganizerRoute;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number;
    badgeTitle?: string;
    badgeTone?: 'danger' | 'subtle';
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'announcements',
      label: 'Announcements',
      icon: Megaphone,
      badge: failedDeliveryCount > 0 ? failedDeliveryCount : undefined,
      badgeTitle:
        failedDeliveryCount > 0
          ? `${failedDeliveryCount} failed delivery dispatch${failedDeliveryCount === 1 ? '' : 'es'}`
          : undefined,
    },
    { id: 'composer', label: 'Create Notice', icon: PenSquare },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    {
      id: 'user-approvals',
      label: 'User Approvals',
      icon: ShieldCheck,
      badge: pendingRequestCount > 0 ? pendingRequestCount : undefined,
      badgeTitle:
        pendingRequestCount > 0
          ? `${pendingRequestCount} pending registration${pendingRequestCount === 1 ? '' : 's'}`
          : undefined,
    },
    ...(activeRole === 'Super Admin'
      ? [
          {
            id: 'rejected-trash' as const,
            label: 'Rejected Trash',
            icon: Trash2,
            badge: trashedRejectedCount > 0 ? trashedRejectedCount : undefined,
            badgeTitle:
              trashedRejectedCount > 0
                ? `${trashedRejectedCount} trashed rejected user${trashedRejectedCount === 1 ? '' : 's'}`
                : undefined,
            badgeTone: 'subtle' as const,
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
    },
    { id: 'users', label: 'Users', icon: UsersRound },
    { id: 'profiles', label: 'Profile Management', icon: CircleUserRound },
    { id: 'system-health', label: 'System & Connectivity', icon: Server },
  ];

  const handleSelect = (route: OrganizerRoute) => {
    onNavigate(route);
    onCloseMobile();
  };

  const handleSettingsSelect = () => {
    onNavigateSettings('account');
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#042419] dark:bg-[#031A12] text-emerald-100 border-r border-emerald-900/70 dark:border-emerald-800/50 transition-colors duration-150">
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

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-1" aria-label="Workspace Navigation">
          {links.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeRoute === item.id ||
              (item.id === 'announcements' && activeRoute === 'delivery-detail');

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`flex w-full items-center justify-between gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  isActive
                    ? 'bg-[#073827] dark:bg-[#073223] text-white'
                    : 'text-emerald-100/80 hover:bg-emerald-900/45 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-emerald-300' : 'text-emerald-200/60'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && (
                  <span
                    title={item.badgeTitle}
                    className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums shrink-0 ${
                      item.badgeTone === 'subtle'
                        ? 'bg-emerald-800/80 text-emerald-100'
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="mt-6 border-t border-emerald-900/70 pt-4 dark:border-emerald-800/50">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200/45">
            Account
          </p>
          <button
            type="button"
            onClick={() => handleSelect('profile')}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              activeRoute === 'profile'
                ? 'bg-[#073827] text-white dark:bg-[#073223]'
                : 'text-emerald-100/80 hover:bg-emerald-900/45 hover:text-white'
            }`}
          >
            <CircleUserRound className="h-4 w-4 text-emerald-200/70" aria-hidden="true" />
            My Profile
          </button>
          <button
            type="button"
            onClick={handleSettingsSelect}
            className={`mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              activeRoute === 'settings'
                ? 'bg-[#073827] text-white dark:bg-[#073223]'
                : 'text-emerald-100/80 hover:bg-emerald-900/45 hover:text-white'
            }`}
          >
            <Settings className="h-4 w-4 text-emerald-200/70" aria-hidden="true" />
            Settings
          </button>
        </div>
      </div>

      <div className="border-t border-emerald-900/70 px-4 py-3 text-[11px] text-emerald-200/65">
        Saidpur Campus · GMT+6
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden h-full min-h-0 w-56 shrink-0 lg:block">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-x-0 bottom-0 top-14 z-40 flex lg:hidden">
          <div
            className="fixed inset-x-0 bottom-0 top-14 bg-[#02160F]/70"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="sidebar-enter relative z-50 h-full w-64 max-w-[85vw]">{sidebarContent}</aside>
        </div>
      )}
    </>
  );
}
