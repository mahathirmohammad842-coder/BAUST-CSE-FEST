import { type FormEvent, useState } from 'react';
import {
  Bell,
  CircleHelp,
  KeyRound,
  Palette,
  ShieldCheck,
  Sun,
  Moon,
  UserRound,
} from 'lucide-react';
import type { SettingsSection, UserProfile } from '../types';
import { ProfileFieldsEditor } from './UserProfilePage';

interface UserSettingsPageProps {
  profile: UserProfile;
  section: SettingsSection;
  isDark: boolean;
  hasPasswordCredential: boolean;
  onSaveProfile: (profile: UserProfile) => void;
  onSaveNotifications: (profile: UserProfile) => void;
  onChangePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<boolean>;
  onChangeSection: (section: SettingsSection) => void;
  onToggleTheme: () => void;
}

const settingsSections: {
  id: SettingsSection;
  label: string;
  description: string;
  icon: typeof UserRound;
}[] = [
  { id: 'account', label: 'Profile information', description: 'Name and contact details', icon: UserRound },
  { id: 'notifications', label: 'Notifications', description: 'Choose what reaches you', icon: Bell },
  { id: 'security', label: 'Security', description: 'Password and account protection', icon: ShieldCheck },
  { id: 'appearance', label: 'Appearance', description: 'Theme and display preferences', icon: Palette },
  { id: 'help', label: 'Help & support', description: 'Get assistance with your account', icon: CircleHelp },
];

const fieldClass =
  'mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-[3px] focus:ring-emerald-600/10 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50';

function NotificationSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="flex w-full items-center justify-between gap-4 border-b border-slate-100 py-4 text-left last:border-0 dark:border-emerald-900/60"
    >
      <span className="text-sm font-medium text-slate-800 dark:text-emerald-100">{label}</span>
      <span
        className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition-colors ${
          checked ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-slate-300 dark:bg-emerald-900'
        }`}
      >
        <span className={`h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );
}

export function UserSettingsPage({
  profile,
  section,
  isDark,
  hasPasswordCredential,
  onSaveProfile,
  onSaveNotifications,
  onChangePassword,
  onChangeSection,
  onToggleTheme,
}: UserSettingsPageProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const selectedSection = settingsSections.find((item) => item.id === section) ?? settingsSections[0];

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage(null);
    if (newPassword.length < 8) {
      setPasswordMessage('Use at least 8 characters for your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage('The new passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const saved = await onChangePassword(currentPassword, newPassword);
      if (!saved) {
        setPasswordMessage('The current password is incorrect.');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage('Your password has been updated.');
    } finally {
      setSavingPassword(false);
    }
  };

  const content = (() => {
    switch (section) {
      case 'account':
        return (
          <ProfileFieldsEditor
            key={profile.userId}
            profile={profile}
            onSave={onSaveProfile}
            submitLabel="Save profile changes"
          />
        );
      case 'notifications':
        return (
          <div>
            {([
              ['email', 'Email notifications'],
              ['push', 'Push notifications'],
              ['inApp', 'In-app announcements'],
              ['securityAlerts', 'Security alerts'],
            ] as const).map(([key, label]) => (
              <NotificationSwitch
                key={key}
                label={label}
                checked={profile.notificationPreferences[key]}
                onChange={() =>
                  onSaveNotifications({
                    ...profile,
                    notificationPreferences: {
                      ...profile.notificationPreferences,
                      [key]: !profile.notificationPreferences[key],
                    },
                  })
                }
              />
            ))}
          </div>
        );
      case 'security':
        return (
          <div className="space-y-5">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/25">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                <ShieldCheck className="h-4 w-4" />
                Account status: {profile.accountStatus}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-900/70 dark:text-emerald-200/65">
                {hasPasswordCredential
                  ? 'A password is configured for this account.'
                  : 'This account does not have a personal password set yet.'}
              </p>
            </div>
            <form onSubmit={submitPassword} className="max-w-xl space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-emerald-50">Change password</h3>
              <label className="block text-xs font-semibold text-slate-700 dark:text-emerald-100">
                Current password
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  className={fieldClass}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700 dark:text-emerald-100">
                New password
                <input
                  required
                  minLength={8}
                  type="password"
                  autoComplete="new-password"
                  className={fieldClass}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700 dark:text-emerald-100">
                Confirm new password
                <input
                  required
                  minLength={8}
                  type="password"
                  autoComplete="new-password"
                  className={fieldClass}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              {passwordMessage && (
                <p role="status" className="text-xs text-emerald-800 dark:text-emerald-300">
                  {passwordMessage}
                </p>
              )}
              <button
                type="submit"
                disabled={savingPassword}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#064E3B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#053D2E] disabled:opacity-60 dark:bg-emerald-400 dark:text-[#022017]"
              >
                <KeyRound className="h-4 w-4" />
                {savingPassword ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </div>
        );
      case 'appearance':
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { dark: false, label: 'Light', icon: Sun },
              { dark: true, label: 'Dark', icon: Moon },
            ].map(({ dark, label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                aria-pressed={isDark === dark}
                onClick={() => {
                  if (isDark !== dark) onToggleTheme();
                }}
                className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  isDark === dark
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-100'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-emerald-900/70 dark:text-emerald-100 dark:hover:bg-emerald-950/30'
                }`}
              >
                <span className="inline-flex items-center gap-2"><Icon className="h-4 w-4" />{label} mode</span>
                <span className="text-xs">{isDark === dark ? 'Selected' : 'Use theme'}</span>
              </button>
            ))}
          </div>
        );
      case 'help':
        return (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-emerald-900/60 dark:bg-[#041811]">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-emerald-50">
              <CircleHelp className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
              Need help with your account?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-emerald-200/65">
              For access, profile, or notification issues, contact your event organizer or system administrator. Include your registered name and account role, but never share your password or verification codes.
            </p>
          </div>
        );
    }
  })();

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-emerald-700 dark:text-emerald-300">Account center</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-emerald-50 sm:text-3xl">Account settings</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-emerald-200/65">
          Manage settings for {profile.fullName}&apos;s {profile.role.toLowerCase()} account.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav
          aria-label="Account settings sections"
          className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm dark:border-emerald-900/70 dark:bg-[#071D16] lg:flex-col lg:overflow-visible"
        >
          {settingsSections.map(({ id, label, description, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={section === id ? 'page' : undefined}
              onClick={() => onChangeSection(id)}
              className={`flex min-w-max items-center gap-3 rounded-xl px-3 py-2.5 text-left transition lg:min-w-0 ${
                section === id
                  ? 'bg-emerald-50 text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-100'
                  : 'text-slate-700 hover:bg-slate-50 dark:text-emerald-100 dark:hover:bg-emerald-950/30'
              }`}
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm dark:bg-[#041811] dark:text-emerald-300">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{label}</span>
                <span className="mt-0.5 hidden text-[10px] text-slate-500 dark:text-emerald-200/55 lg:block">{description}</span>
              </span>
            </button>
          ))}
        </nav>

        <section
          aria-labelledby="settings-section-title"
          className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-emerald-900/70 dark:bg-[#071D16] sm:p-6"
        >
          <div className="mb-5 border-b border-slate-100 pb-4 dark:border-emerald-900/60">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Settings</p>
            <h2 id="settings-section-title" className="mt-1 text-lg font-bold text-slate-950 dark:text-emerald-50">
              {selectedSection.label}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-emerald-200/60">{selectedSection.description}</p>
          </div>
          {content}
        </section>
      </div>
    </div>
  );
}
