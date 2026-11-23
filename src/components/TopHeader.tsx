import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  ChevronDown,
  CircleHelp,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Palette,
  Radio,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
} from 'lucide-react';
import { Modal } from './Modal';
import type { SettingsSection, WorkspaceRole } from '../types';

export type WorkspaceMode = 'organizer' | 'inbox';

interface TopHeaderProps {
  mode: WorkspaceMode;
  activeRole: WorkspaceRole;
  unreadCount: number;
  isDark: boolean;
  userName: string;
  onToggleTheme: () => void;
  onChangeMode: (mode: WorkspaceMode) => void;
  onOpenLogin: () => void;
  onOpenMobileMenu: () => void;
  onNavigateProfile: () => void;
  onNavigateSettings: (section: SettingsSection) => void;
}

export function TopHeader({
  mode,
  activeRole,
  unreadCount,
  isDark,
  userName,
  onToggleTheme,
  onChangeMode,
  onOpenLogin,
  onOpenMobileMenu,
  onNavigateProfile,
  onNavigateSettings,
}: TopHeaderProps) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  useEffect(() => {
    if (!accountMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !accountMenuRef.current?.contains(event.target)
      ) {
        setAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [accountMenuOpen]);

  const openProfile = () => {
    setAccountMenuOpen(false);
    onNavigateProfile();
  };
  const openSettings = (section: SettingsSection) => {
    setAccountMenuOpen(false);
    onNavigateSettings(section);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-emerald-900/70 bg-[#042419] text-white transition-colors duration-150 dark:border-emerald-800/50 dark:bg-[#031A12]">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          {mode === 'organizer' && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              aria-label="Open organizer menu"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-800/80 text-emerald-100 hover:bg-emerald-900/50 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}

          <div className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400 text-emerald-950">
              <Radio className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="font-display text-sm font-extrabold tracking-tight text-white sm:text-base">
              BAUST CSE FEST
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <div
            role="group"
            aria-label="Workspace View Toggle"
            className="inline-flex items-center rounded-lg border border-emerald-800/80 bg-[#073626] p-1"
          >
            {activeRole === 'Organizer' && (
              <button
                type="button"
                onClick={() => onChangeMode('organizer')}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3 ${
                  mode === 'organizer'
                    ? 'bg-emerald-400 text-emerald-950'
                    : 'text-emerald-100/80 hover:text-white'
                }`}
              >
                <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Organizer View</span>
                <span className="sm:hidden">Organizer</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onChangeMode('inbox')}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3 ${
                mode === 'inbox'
                  ? 'bg-emerald-400 text-emerald-950'
                  : 'text-emerald-100/80 hover:text-white'
              }`}
            >
              <Inbox className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Attendee Inbox</span>
              <span className="sm:hidden">Inbox</span>
              {unreadCount > 0 && (
                <span
                  className={`rounded px-1.5 py-0.2 font-mono text-[10px] font-bold tabular-nums ${
                    mode === 'inbox'
                      ? 'bg-emerald-950 text-emerald-300'
                      : 'bg-emerald-900 text-emerald-200'
                  }`}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              onClick={() => setAccountMenuOpen((open) => !open)}
              aria-label={`Open account menu for ${userName}`}
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-800/80 bg-[#073626] px-1.5 text-emerald-100 transition-colors hover:border-emerald-400/70 hover:bg-emerald-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-300 text-[10px] font-bold text-emerald-950 ring-2 ring-emerald-100/15">
                {initials}
              </span>
              <span className="hidden max-w-24 truncate text-xs font-semibold text-emerald-100/80 sm:inline">
                {activeRole}
              </span>
              <ChevronDown className="mr-0.5 h-3.5 w-3.5 text-emerald-200/75" aria-hidden="true" />
            </button>

            {accountMenuOpen && (
              <div
                role="menu"
                aria-label="Account menu"
                className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-[0_16px_48px_-16px_rgba(2,44,34,0.38)] dark:border-emerald-800/70 dark:bg-[#061D15] dark:text-emerald-50"
              >
                <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-3 dark:border-emerald-900/70">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-900 dark:bg-emerald-900/70 dark:text-emerald-200">
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{userName}</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-emerald-300/65">
                      {activeRole} account
                    </p>
                  </div>
                </div>
                {activeRole === 'Organizer' && (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={openProfile}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:hover:bg-emerald-900/40"
                    >
                      <UserRound className="h-4 w-4 text-slate-500 dark:text-emerald-300/75" />
                      My Profile
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openSettings('account')}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:hover:bg-emerald-900/40"
                    >
                      <Settings className="h-4 w-4 text-slate-500 dark:text-emerald-300/75" />
                      Account Settings
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openSettings('notifications')}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:hover:bg-emerald-900/40"
                    >
                      <Bell className="h-4 w-4 text-slate-500 dark:text-emerald-300/75" />
                      Notification Preferences
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openSettings('security')}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:hover:bg-emerald-900/40"
                    >
                      <ShieldCheck className="h-4 w-4 text-slate-500 dark:text-emerald-300/75" />
                      Security &amp; Password
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openSettings('appearance')}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:hover:bg-emerald-900/40"
                    >
                      <Palette className="h-4 w-4 text-slate-500 dark:text-emerald-300/75" />
                      Appearance (Light/Dark Mode)
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openSettings('help')}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:hover:bg-emerald-900/40"
                    >
                      <CircleHelp className="h-4 w-4 text-slate-500 dark:text-emerald-300/75" />
                      Help &amp; Support
                    </button>
                    <div className="my-1 border-t border-slate-100 dark:border-emerald-900/70" />
                  </>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setLogoutConfirmOpen(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    onToggleTheme();
                  }}
                  className="mt-1 flex w-full items-center justify-between rounded-lg border-t border-slate-100 px-3 py-2.5 text-left text-xs text-slate-500 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-emerald-900/70 dark:text-emerald-300/70 dark:hover:bg-emerald-900/40"
                >
                  <span className="inline-flex items-center gap-2">
                    {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    Switch to {isDark ? 'light' : 'dark'} mode
                  </span>
                  <span className="font-medium">{isDark ? 'Dark' : 'Light'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <Modal
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        title="Sign out?"
        subtitle="You will need to sign in again to access the fest portal."
        maxWidthClass="max-w-sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setLogoutConfirmOpen(false)}
              className="rounded-lg border border-emerald-200 px-3.5 py-2 text-xs font-semibold text-emerald-900 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-emerald-900/50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setLogoutConfirmOpen(false);
                onOpenLogin();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:bg-red-600 dark:hover:bg-red-500"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Sign Out
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-emerald-900/75 dark:text-emerald-200/80">
          Are you sure you want to sign out of your {activeRole.toLowerCase()}{' '}
          account?
        </p>
      </Modal>
    </header>
  );
}
