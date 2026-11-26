import { type FormEvent, useState } from 'react';
import {
  Bell,
  Check,
  CircleHelp,
  KeyRound,
  LockKeyhole,
  Mail,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  UserRound,
} from 'lucide-react';
import type {
  OrganizerProfile,
  OrganizerSettings,
  SettingsSection,
} from '../types';

interface SettingsPageProps {
  profile: OrganizerProfile;
  settings: OrganizerSettings;
  section: SettingsSection;
  isDark: boolean;
  hasPassword: boolean;
  onSaveProfile: (profile: OrganizerProfile) => void;
  onUpdateSettings: (settings: OrganizerSettings) => void;
  onChangeSection: (section: SettingsSection) => void;
  onToggleTheme: () => void;
  onPasswordUpdated: (
    currentPassword: string,
    newPassword: string
  ) => Promise<boolean>;
}

const settingsNavigation: {
  id: SettingsSection;
  label: string;
  description: string;
  icon: typeof UserRound;
}[] = [
  { id: 'account', label: 'Profile information', description: 'Name and contact details', icon: UserRound },
  { id: 'notifications', label: 'Notifications', description: 'Delivery and announcement alerts', icon: Bell },
  { id: 'security', label: 'Security', description: 'Password and sign-in protection', icon: ShieldCheck },
  { id: 'appearance', label: 'Appearance', description: 'Theme and display preferences', icon: Palette },
  { id: 'help', label: 'Help & support', description: 'Get assistance with your account', icon: CircleHelp },
];

const fieldClass =
  'mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-600 focus:ring-[3px] focus:ring-emerald-600/10 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50 dark:placeholder:text-emerald-300/40 dark:hover:border-emerald-700 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/15';

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-5 border-b border-slate-100 py-4 last:border-0 dark:border-emerald-900/60">
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-emerald-50">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-emerald-300/60">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#061D15] ${
          checked ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-slate-300 dark:bg-emerald-900'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsPage({
  profile,
  settings,
  section,
  isDark,
  hasPassword,
  onSaveProfile,
  onUpdateSettings,
  onChangeSection,
  onToggleTheme,
  onPasswordUpdated,
}: SettingsPageProps) {
  const [profileDraft, setProfileDraft] = useState(profile);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const updatePreference = (key: keyof OrganizerSettings, value: boolean) => {
    onUpdateSettings({ ...settings, [key]: value });
  };

  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaveProfile(profileDraft);
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ((hasPassword && !currentPassword) || !newPassword || !confirmPassword) {
      setPasswordError('Complete all password fields before continuing.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Use at least 8 characters for your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      if (!(await onPasswordUpdated(currentPassword, newPassword))) {
        setPasswordError('The current password is incorrect.');
        return;
      }
      setPasswordError(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setSavingPassword(false);
    }
  };

  const activeSetting = settingsNavigation.find((item) => item.id === section);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
          Account
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-emerald-50 sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-emerald-200/65">
          Manage your organizer profile, preferences, and account security.
        </p>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <nav
          aria-label="Settings sections"
          className="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-[0_8px_28px_-20px_rgba(15,23,42,0.3)] dark:border-emerald-800/60 dark:bg-[#061D15]"
        >
          {settingsNavigation.map(({ id, label, description, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onChangeSection(id)}
              aria-current={section === id ? 'page' : undefined}
              className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                section === id
                  ? 'bg-emerald-50 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-50'
                  : 'text-slate-700 hover:bg-slate-50 dark:text-emerald-100/80 dark:hover:bg-emerald-900/35'
              }`}
            >
              <Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  section === id ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400 dark:text-emerald-300/55'
                }`}
                aria-hidden="true"
              />
              <span>
                <span className="block text-[13px] font-semibold">{label}</span>
                <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-emerald-300/55">
                  {description}
                </span>
              </span>
            </button>
          ))}
        </nav>

        <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_28px_-20px_rgba(15,23,42,0.3)] dark:border-emerald-800/60 dark:bg-[#061D15] sm:p-6">
          <div className="mb-5 border-b border-slate-100 pb-4 dark:border-emerald-900/60">
            <h2 className="font-display text-base font-bold text-slate-950 dark:text-emerald-50">
              {activeSetting?.label}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-emerald-300/60">
              {activeSetting?.description}
            </p>
          </div>

          {section === 'account' && (
            <form onSubmit={handleProfileSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-emerald-100">
                  Full name
                  <input
                    className={fieldClass}
                    value={profileDraft.fullName}
                    onChange={(event) =>
                      setProfileDraft({ ...profileDraft, fullName: event.target.value })
                    }
                    autoComplete="name"
                    required
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700 dark:text-emerald-100">
                  Email address
                  <input
                    className={fieldClass}
                    type="email"
                    value={profileDraft.email}
                    onChange={(event) =>
                      setProfileDraft({ ...profileDraft, email: event.target.value })
                    }
                    autoComplete="email"
                    required
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700 dark:text-emerald-100">
                  Phone number
                  <input
                    className={fieldClass}
                    type="tel"
                    value={profileDraft.phone}
                    onChange={(event) =>
                      setProfileDraft({ ...profileDraft, phone: event.target.value })
                    }
                    autoComplete="tel"
                    required
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700 dark:text-emerald-100">
                  Department
                  <input
                    className={fieldClass}
                    value={profileDraft.department}
                    onChange={(event) =>
                      setProfileDraft({ ...profileDraft, department: event.target.value })
                    }
                    required
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700 dark:text-emerald-100 sm:col-span-2">
                  Designation
                  <input
                    className={fieldClass}
                    value={profileDraft.designation}
                    onChange={(event) =>
                      setProfileDraft({ ...profileDraft, designation: event.target.value })
                    }
                    required
                  />
                </label>
              </div>
              <div className="flex flex-col-reverse justify-between gap-3 border-t border-slate-100 pt-4 dark:border-emerald-900/60 sm:flex-row sm:items-center">
                <p className="text-[11px] text-slate-500 dark:text-emerald-300/55">
                  Organizer ID · <span className="font-mono">{profile.organizerId}</span>
                </p>
                <button
                  type="submit"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#064E3B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#053D2E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-[#022017] dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-[#061D15]"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Save changes
                </button>
              </div>
            </form>
          )}

          {section === 'notifications' && (
            <div>
              <div className="mb-4 flex items-start gap-3 rounded-xl bg-slate-50 p-4 dark:bg-[#041811]">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                <p className="text-xs leading-relaxed text-slate-600 dark:text-emerald-200/70">
                  Choose which updates reach your organizer account. Critical security alerts stay separate from fest announcements.
                </p>
              </div>
              <ToggleRow
                title="Email notifications"
                description="Receive organizer updates and delivery summaries by email."
                checked={settings.emailNotifications}
                onChange={(value) => updatePreference('emailNotifications', value)}
              />
              <ToggleRow
                title="Push notifications"
                description="Get time-sensitive schedule and event alerts in your browser."
                checked={settings.pushNotifications}
                onChange={(value) => updatePreference('pushNotifications', value)}
              />
              <ToggleRow
                title="Announcement updates"
                description="Be notified when an announcement is published or its delivery changes."
                checked={settings.announcementUpdates}
                onChange={(value) => updatePreference('announcementUpdates', value)}
              />
            </div>
          )}

          {section === 'security' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 p-4 dark:border-emerald-900/60">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-emerald-50">
                      {hasPassword ? 'Change password' : 'Set a password'}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-emerald-300/60">
                      Sign in with {profile.email} or {profile.phone}.{' '}
                      {hasPassword
                        ? 'Your password is stored in this browser prototype and checked at sign-in.'
                        : 'The demo password is demo1234. Set a new password to require it for later sign-ins in this browser.'}{' '}
                      Passwords are not sent to an identity provider.
                    </p>
                  </div>
                </div>
                <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3">
                  {passwordError && (
                    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">
                      {passwordError}
                    </p>
                  )}
                  {hasPassword && (
                    <label className="block text-xs font-semibold text-slate-700 dark:text-emerald-100">
                      Current password
                      <input
                        className={fieldClass}
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        required
                      />
                    </label>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-emerald-100">
                      New password
                      <input
                        className={fieldClass}
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-700 dark:text-emerald-100">
                      Confirm new password
                      <input
                        className={fieldClass}
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-emerald-900/35"
                  >
                    {savingPassword
                      ? 'Saving…'
                      : hasPassword ? 'Update password' : 'Set password'}
                  </button>
                </form>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-emerald-50">
                  Sign-in protection
                </h3>
                <ToggleRow
                  title="Two-factor authentication"
                  description="Require an additional verification step when signing in."
                  checked={settings.twoFactorEnabled}
                  onChange={(value) => updatePreference('twoFactorEnabled', value)}
                />
                <ToggleRow
                  title="Security alerts"
                  description="Notify me about new sign-ins and important account changes."
                  checked={settings.securityAlerts}
                  onChange={(value) => updatePreference('securityAlerts', value)}
                />
                <ToggleRow
                  title="Automatic session timeout"
                  description="Sign out after a period of inactivity on shared devices."
                  checked={settings.sessionTimeoutEnabled}
                  onChange={(value) => updatePreference('sessionTimeoutEnabled', value)}
                />
              </div>
            </div>
          )}

          {section === 'appearance' && (
            <div>
              <p className="mb-4 text-sm text-slate-600 dark:text-emerald-200/70">
                Choose the dashboard theme that works best for your workspace.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { dark: false, label: 'Light', icon: Sun, description: 'Bright, clear surfaces' },
                  { dark: true, label: 'Dark', icon: Moon, description: 'Low-light workspace' },
                ].map(({ dark, label, icon: Icon, description }) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={isDark === dark}
                    onClick={() => {
                      if (isDark !== dark) onToggleTheme();
                    }}
                    className={`rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                      isDark === dark
                        ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600 dark:border-emerald-400 dark:bg-emerald-950/40 dark:ring-emerald-400'
                        : 'border-slate-200 hover:border-slate-300 dark:border-emerald-800/70 dark:hover:border-emerald-700'
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm dark:bg-[#041811] dark:text-emerald-300">
                        <Icon className="h-4 w-4" />
                      </span>
                      {isDark === dark && <Check className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />}
                    </span>
                    <span className="mt-4 block text-sm font-semibold text-slate-900 dark:text-emerald-50">
                      {label} mode
                    </span>
                    <span className="mt-1 block text-xs text-slate-500 dark:text-emerald-300/60">
                      {description}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600 dark:bg-[#041811] dark:text-emerald-200/70">
                <LockKeyhole className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                Your appearance preference is saved on this device.
              </div>
            </div>
          )}

          {section === 'help' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/40">
                <div className="flex items-start gap-3">
                  <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-emerald-50">
                      Organizer workspace support
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-emerald-200/70">
                      For access, profile, or notification issues, contact your BAUST CSE Fest system administrator. Include your organizer ID so they can locate your account.
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onChangeSection('account')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-emerald-900/35"
              >
                Review profile information
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
