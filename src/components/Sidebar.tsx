import {
  BarChart3,
  CircleUserRound,
  LayoutDashboard,
  Megaphone,
  PenSquare,
  ShieldCheck,
  Settings,
  UsersRound,
  X,
} from 'lucide-react';
import type { SettingsSection } from '../types';

export type OrganizerRoute =
  | 'dashboard'
  | 'announcements'
  | 'composer'
  | 'delivery-detail'
  | 'analytics'
  | 'user-approvals'
  | 'users'
  | 'profile'
  | 'settings';

interface SidebarProps {
  activeRoute: OrganizerRoute;
  failedDeliveryCount: number;
  pendingRequestCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onNavigate: (route: OrganizerRoute) => void;
  onNavigateSettings: (section: SettingsSection) => void;
}

export function Sidebar({
  activeRoute,
  failedDeliveryCount,
  pendingRequestCount,
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
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'announcements',
      label: 'Announcements',
      icon: Megaphone,
      badge: failedDeliveryCount > 0 ? failedDeliveryCount : undefined,
    },
    { id: 'composer', label: 'Create Notice', icon: PenSquare },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    {
      id: 'user-approvals',
      label: 'User Approvals',
      icon: ShieldCheck,
      badge: pendingRequestCount > 0 ? pendingRequestCount : undefined,
    },
    { id: 'users', label: 'Users', icon: UsersRound },
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

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-1" aria-label="Organizer Sidebar Navigation">
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
                  <span className="rounded bg-red-600 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white tabular-nums shrink-0">
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
      <aside className="hidden lg:fixed lg:top-14 lg:bottom-0 lg:left-0 lg:z-20 lg:block lg:w-56">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#02160F]/70"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-50 w-64 max-w-[85vw]">{sidebarContent}</aside>
        </div>
      )}
    </>
  );
}
