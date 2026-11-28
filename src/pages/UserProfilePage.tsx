import { type FormEvent, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  BadgeCheck,
  Bell,
  CalendarDays,
  Camera,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Fingerprint,
  Github,
  Globe2,
  KeyRound,
  Laptop,
  LockKeyhole,
  Monitor,
  Moon,
  Palette,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
} from 'lucide-react';
import type {
  ActivityLogEntry,
  ApprovalLog,
  ProfileAuditEvent,
  ProfileLoginEvent,
  UserProfile,
  WorkspaceRole,
} from '../types';
import {
  calculateProfileCompletion,
  DEFAULT_PERSONAL_INFO,
  isEmailLikeValue,
  sanitizeProfileTextField,
} from '../utils/profileStore';

interface UserProfilePageProps {
  profile: UserProfile;
  events: ProfileAuditEvent[];
  loginHistory: ProfileLoginEvent[];
  approvalLogs?: ApprovalLog[];
  activityLogs?: ActivityLogEntry[];
  blockedUntil: string | null;
  passwordResetRequired: boolean;
  hasPasswordCredential: boolean;
  onSave: (profile: UserProfile) => void;
  onSaveNotifications: (profile: UserProfile) => void;
  onChangePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<boolean>;
  isDark: boolean;
  onToggleTheme: () => void;
}

interface ProfileFieldsEditorProps {
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
  submitLabel?: string;
}

const fieldClass =
  'mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-[3px] focus:ring-emerald-600/10 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(date);
}

function isValidImage(file: File) {
  return file.type.startsWith('image/') && file.size <= 1_000_000;
}

export function ProfileFieldsEditor({
  profile,
  onSave,
  submitLabel = 'Save profile',
}: ProfileFieldsEditorProps) {
  const [draft, setDraft] = useState<UserProfile>(() => ({
    ...profile,
    department: sanitizeProfileTextField(profile.department),
    institution: sanitizeProfileTextField(profile.institution),
    address: profile.address ?? '',
    personalInfo: {
      ...DEFAULT_PERSONAL_INFO,
      ...(profile.personalInfo ?? {}),
    },
  }));
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const update = <K extends keyof UserProfile>(
    key: K,
    value: UserProfile[K]
  ) => {
    setFieldError(null);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateSocialLink = (
    key: keyof UserProfile['socialLinks'],
    value: string
  ) => setDraft((current) => ({
    ...current,
    socialLinks: { ...current.socialLinks, [key]: value },
  }));

  const updatePersonalInfo = (
    key: keyof NonNullable<UserProfile['personalInfo']>,
    value: string
  ) =>
    setDraft((current) => ({
      ...current,
      personalInfo: {
        ...DEFAULT_PERSONAL_INFO,
        ...(current.personalInfo ?? {}),
        [key]: value,
      },
    }));

  const handlePhoto = (file?: File) => {
    setPhotoError(null);
    if (!file) return;
    if (!isValidImage(file)) {
      setPhotoError('Choose an image file smaller than 1 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        update('photoDataUrl', reader.result);
      } else {
        setPhotoError('The selected image could not be read.');
      }
    };
    reader.onerror = () => setPhotoError('The selected image could not be read.');
    reader.readAsDataURL(file);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldError(null);
    const trimmedDepartment = draft.department.trim();
    const trimmedInstitution = draft.institution.trim();
    if (trimmedDepartment && isEmailLikeValue(trimmedDepartment)) {
      setFieldError(
        'Department must be a text name (e.g., Computer Science & Engineering), not an email address.'
      );
      return;
    }
    if (trimmedInstitution && isEmailLikeValue(trimmedInstitution)) {
      setFieldError(
        'Institution must be a text name (e.g., BAUST), not an email address.'
      );
      return;
    }

    const info = draft.personalInfo ?? DEFAULT_PERSONAL_INFO;
    onSave({
      ...draft,
      fullName: draft.fullName.trim(),
      phone: draft.phone.trim(),
      department: trimmedDepartment,
      institution: trimmedInstitution,
      address: (draft.address ?? '').trim(),
      biography: draft.biography.trim(),
      personalInfo: {
        studentId: info.studentId.trim(),
        batch: info.batch.trim(),
        tshirtSize: info.tshirtSize.trim(),
        emergencyContact: info.emergencyContact.trim(),
        dietaryNotes: info.dietaryNotes.trim(),
      },
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-lg font-bold text-emerald-900 dark:bg-emerald-900/70 dark:text-emerald-100">
          {draft.photoDataUrl ? (
            <img src={draft.photoDataUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(draft.fullName)
          )}
        </div>
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-emerald-950/40">
          <Camera className="h-4 w-4" />
          Update photo
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => handlePhoto(event.target.files?.[0])}
          />
        </label>
        {draft.photoDataUrl && (
          <button
            type="button"
            onClick={() => update('photoDataUrl', '')}
            className="text-xs font-medium text-slate-500 hover:text-red-700 dark:text-emerald-300/70"
          >
            Remove
          </button>
        )}
      </div>
      {photoError && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{photoError}</p>}

      {fieldError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-800/70 dark:bg-red-950/40 dark:text-red-300"
        >
          {fieldError}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-700 dark:text-emerald-100">
          Full name
          <input
            id="profile-full-name"
            name="fullName"
            type="text"
            required
            maxLength={100}
            autoComplete="name"
            className={fieldClass}
            value={draft.fullName}
            onChange={(event) => update('fullName', event.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-slate-700 dark:text-emerald-100">
          Phone number
          <input
            id="profile-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={32}
            className={fieldClass}
            value={draft.phone}
            onChange={(event) => update('phone', event.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-slate-700 dark:text-emerald-100">
          Department
          <input
            id="profile-department"
            name="department"
            type="text"
            autoComplete="organization-title"
            maxLength={100}
            placeholder="e.g., Computer Science & Engineering"
            className={fieldClass}
            value={draft.department}
            onChange={(event) => update('department', event.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-slate-700 dark:text-emerald-100">
          Institution / organization
          <input
            id="profile-institution"
            name="institution"
            type="text"
            autoComplete="organization"
            maxLength={120}
            placeholder="e.g., BAUST"
            className={fieldClass}
            value={draft.institution}
            onChange={(event) => update('institution', event.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-slate-700 dark:text-emerald-100 sm:col-span-2">
          Home / campus address
          <input
            id="profile-address"
            name="address"
            type="text"
            maxLength={200}
            autoComplete="street-address"
            className={fieldClass}
            value={draft.address ?? ''}
            onChange={(event) => update('address', event.target.value)}
            placeholder="e.g., BAUST Residential Hall / Saidpur, Nilphamari"
          />
        </label>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-emerald-900/50 dark:bg-[#041811]/70 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-semibold text-slate-700 dark:text-emerald-100">
          Student / Staff ID
          <input
            maxLength={60}
            className={fieldClass}
            value={draft.personalInfo?.studentId ?? ''}
            onChange={(event) => updatePersonalInfo('studentId', event.target.value)}
            placeholder="e.g., 210101045"
          />
        </label>
        <label className="text-xs font-semibold text-slate-700 dark:text-emerald-100">
          Batch / Year
          <input
            maxLength={40}
            className={fieldClass}
            value={draft.personalInfo?.batch ?? ''}
            onChange={(event) => updatePersonalInfo('batch', event.target.value)}
            placeholder="e.g., 16th Batch"
          />
        </label>
        <label className="text-xs font-semibold text-slate-700 dark:text-emerald-100">
          T-Shirt Size
          <select
            className={fieldClass}
            value={draft.personalInfo?.tshirtSize ?? ''}
            onChange={(event) => updatePersonalInfo('tshirtSize', event.target.value)}
          >
            <option value="">Select size</option>
            <option value="S">S</option>
            <option value="M">M</option>
            <option value="L">L</option>
            <option value="XL">XL</option>
            <option value="XXL">XXL</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-700 dark:text-emerald-100">
          Emergency contact
          <input
            maxLength={100}
            className={fieldClass}
            value={draft.personalInfo?.emergencyContact ?? ''}
            onChange={(event) => updatePersonalInfo('emergencyContact', event.target.value)}
            placeholder="Guardian name & phone"
          />
        </label>
        <label className="text-xs font-semibold text-slate-700 dark:text-emerald-100 sm:col-span-2">
          Dietary / accessibility notes
          <input
            maxLength={160}
            className={fieldClass}
            value={draft.personalInfo?.dietaryNotes ?? ''}
            onChange={(event) => updatePersonalInfo('dietaryNotes', event.target.value)}
            placeholder="Optional fest hospitality preferences"
          />
        </label>
      </div>

      <label className="block text-xs font-semibold text-slate-700 dark:text-emerald-100">
        Biography
        <textarea
          rows={3}
          maxLength={500}
          className={`${fieldClass} resize-y`}
          value={draft.biography}
          onChange={(event) => update('biography', event.target.value)}
          placeholder="Share a short introduction."
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-semibold text-slate-700 dark:text-emerald-100">
          Website
          <span className="relative mt-1.5 block">
            <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="url"
              maxLength={200}
              className={`${fieldClass} pl-9`}
              value={draft.socialLinks.website}
              onChange={(event) => updateSocialLink('website', event.target.value)}
              placeholder="https://"
            />
          </span>
        </label>
        <label className="text-xs font-semibold text-slate-700 dark:text-emerald-100">
          LinkedIn
          <span className="relative mt-1.5 block">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="url"
              maxLength={200}
              className={`${fieldClass} pl-9`}
              value={draft.socialLinks.linkedIn}
              onChange={(event) => updateSocialLink('linkedIn', event.target.value)}
              placeholder="https://linkedin.com/in/…"
            />
          </span>
        </label>
        <label className="text-xs font-semibold text-slate-700 dark:text-emerald-100">
          GitHub
          <span className="relative mt-1.5 block">
            <Github className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="url"
              maxLength={200}
              className={`${fieldClass} pl-9`}
              value={draft.socialLinks.github}
              onChange={(event) => updateSocialLink('github', event.target.value)}
              placeholder="https://github.com/…"
            />
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-emerald-900/60 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500 dark:text-emerald-300/65">
          {draft.email} · {draft.role}
        </p>
        <button
          type="submit"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#064E3B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#053D2E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:bg-emerald-400 dark:text-[#022017]"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

const completionFields = [
  ['Phone number', (profile: UserProfile) => Boolean(profile.phone.trim())],
  ['Department', (profile: UserProfile) => Boolean(profile.department.trim())],
  ['Institution', (profile: UserProfile) => Boolean(profile.institution.trim())],
  ['Address', (profile: UserProfile) => Boolean((profile.address ?? '').trim())],
  [
    'Personal info',
    (profile: UserProfile) =>
      Boolean(
        profile.personalInfo?.studentId?.trim() ||
          profile.personalInfo?.batch?.trim() ||
          profile.personalInfo?.emergencyContact?.trim()
      ),
  ],
  ['Biography', (profile: UserProfile) => Boolean(profile.biography.trim())],
  ['Profile photo', (profile: UserProfile) => Boolean(profile.photoDataUrl)],
  ['Social link', (profile: UserProfile) => Object.values(profile.socialLinks).some(Boolean)],
] as const;

function getProfileCompletion(profile: UserProfile) {
  const missing = completionFields
    .filter(([, isComplete]) => !isComplete(profile))
    .map(([label]) => label);

  return {
    score: calculateProfileCompletion(profile).percentage,
    missing,
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeZone: 'Asia/Dhaka',
  }).format(date);
}

const roleTheme: Record<WorkspaceRole, string> = {
  Organizer: 'border-emerald-300/40 bg-emerald-300/15 text-emerald-100',
  Participant: 'border-sky-300/40 bg-sky-300/15 text-sky-100',
  Volunteer: 'border-teal-300/40 bg-teal-300/15 text-teal-100',
  Judge: 'border-amber-300/40 bg-amber-300/15 text-amber-100',
  Guest: 'border-slate-300/40 bg-slate-300/15 text-slate-100',
  Sponsor: 'border-violet-300/40 bg-violet-300/15 text-violet-100',
  Mentor: 'border-cyan-300/40 bg-cyan-300/15 text-cyan-100',
  'Super Admin': 'border-fuchsia-300/40 bg-fuchsia-300/15 text-fuchsia-100',
};

const metricTheme = {
  emerald: {
    icon: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    bar: 'bg-emerald-500 dark:bg-emerald-400',
  },
  violet: {
    icon: 'bg-violet-50 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
    bar: 'bg-violet-500 dark:bg-violet-400',
  },
  sky: {
    icon: 'bg-sky-50 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
    bar: 'bg-sky-500 dark:bg-sky-400',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    bar: 'bg-amber-500 dark:bg-amber-400',
  },
  slate: {
    icon: 'bg-slate-100 text-slate-700 dark:bg-emerald-900/50 dark:text-emerald-200',
    bar: 'bg-slate-500 dark:bg-emerald-400',
  },
  rose: {
    icon: 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    bar: 'bg-rose-500 dark:bg-rose-400',
  },
} as const;

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  progress,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  tone: keyof typeof metricTheme;
  progress?: number;
}) {
  const theme = metricTheme[tone];

  return (
    <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)] transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-emerald-900/70 dark:bg-[#071D16] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${theme.icon}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        {progress !== undefined && (
          <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-emerald-200/60">
            {progress}%
          </span>
        )}
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-emerald-200/55">
        {label}
      </p>
      <p className="mt-1 truncate font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-emerald-50">
        {value}
      </p>
      {progress !== undefined && (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-emerald-950/80"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className={`h-full rounded-full transition-[width] duration-500 ${theme.bar}`} style={{ width: `${progress}%` }} />
        </div>
      )}
      <p className="mt-2 line-clamp-2 min-h-8 text-xs leading-4 text-slate-500 dark:text-emerald-200/60">
        {detail}
      </p>
    </article>
  );
}

function ActivityEntry({
  title,
  detail,
  icon: Icon,
  tone = 'emerald',
}: {
  title: string;
  detail: string;
  icon: typeof Activity;
  tone?: 'emerald' | 'amber' | 'slate';
}) {
  const iconClass = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    slate: 'bg-slate-100 text-slate-600 dark:bg-emerald-900/50 dark:text-emerald-200',
  }[tone];

  return (
    <li className="flex min-w-0 gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 border-b border-slate-100 pb-3 last:border-0 dark:border-emerald-900/50">
        <p className="break-words text-xs font-semibold leading-5 text-slate-800 dark:text-emerald-100">{title}</p>
        <p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-emerald-200/55">{detail}</p>
      </div>
    </li>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon: typeof Activity;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-300">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-sm font-bold text-slate-950 dark:text-emerald-50">{title}</h2>
        {description && <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-emerald-200/60">{description}</p>}
      </div>
    </div>
  );
}

function PreferenceSwitch({
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
      className="flex w-full items-center justify-between gap-3 border-b border-slate-100 py-3 text-left last:border-0 dark:border-emerald-900/60"
    >
      <span className="text-sm font-medium text-slate-800 dark:text-emerald-100">{label}</span>
      <span className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition-colors ${checked ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-slate-300 dark:bg-emerald-900'}`}>
        <span className={`h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );
}

export function UserProfilePage({
  profile,
  events,
  loginHistory,
  approvalLogs = [],
  activityLogs = [],
  blockedUntil,
  passwordResetRequired,
  hasPasswordCredential,
  onSave,
  onSaveNotifications,
  onChangePassword,
  isDark,
  onToggleTheme,
}: UserProfilePageProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const profileSectionRef = useRef<HTMLElement>(null);
  const securitySectionRef = useRef<HTMLElement>(null);

  const updatePreference = (
    key: keyof UserProfile['notificationPreferences'],
    value: boolean
  ) => {
    onSaveNotifications({
      ...profile,
      notificationPreferences: {
        ...profile.notificationPreferences,
        [key]: value,
      },
    });
  };

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

  const ownEvents = events
    .filter((event) => event.userId === profile.userId)
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
    .slice(0, 8);
  const ownLogins = loginHistory
    .filter((event) => event.userId === profile.userId)
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
    .slice(0, 8);
  const completion = useMemo(() => getProfileCompletion(profile), [profile]);
  const notificationCount = Object.values(profile.notificationPreferences).filter(Boolean).length;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentActivityCount = [...ownEvents, ...ownLogins].filter(
    (event) => new Date(event.occurredAt).getTime() >= cutoff
  ).length;
  const activityScore = Math.min(100, recentActivityCount * 12);
  const engagementScore = Math.round((completion.score + activityScore) / 2);
  const ownApprovalLogs = approvalLogs
    .filter((entry) => entry.userId === profile.userId)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 6);
  const ownActivityLogs = activityLogs
    .filter((entry) => entry.userId === profile.userId)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 8);
  const effectiveApprovalStatus =
    profile.approvalStatus ??
    (profile.accountStatus === 'Pending Approval'
      ? 'Pending'
      : profile.accountStatus === 'Rejected'
        ? 'Rejected'
        : 'Approved');
  const accountHealthScore = blockedUntil
    ? 0
    : profile.accountStatus === 'Active'
      ? effectiveApprovalStatus === 'Approved'
        ? profile.verified
          ? 100
          : 90
        : 75
      : profile.accountStatus === 'Pending Approval'
        ? 75
        : profile.accountStatus === 'Suspended'
          ? 20
          : 35;
  const securityScore = [
    hasPasswordCredential,
    profile.verified,
    !passwordResetRequired,
    !blockedUntil,
    false,
  ].filter(Boolean).length * 20;
  const latestLogin = ownLogins[0];
  const recentSecurityEvents = ownEvents.filter((event) =>
    ['password-changed', 'password-reset', 'account-suspended', 'account-reactivated'].includes(event.action)
  );
  const recommendations = [
    ...(passwordResetRequired ? ['Choose a new password after the organizer or super admin reset.'] : []),
    ...(!hasPasswordCredential ? ['Set a personal password instead of using demo sign-in.'] : []),
    ...(!profile.verified ? ['Complete account verification with your event organizer.'] : []),
    ...(completion.missing.length ? [`Add ${completion.missing.slice(0, 2).join(' and ').toLowerCase()} to improve your profile.`] : []),
    ...(!profile.notificationPreferences.securityAlerts ? ['Enable security alerts to stay informed about account changes.'] : []),
  ];
  const passwordStrength = newPassword
    ? [
        newPassword.length >= 8,
        /[a-z]/.test(newPassword),
        /[A-Z]/.test(newPassword),
        /\d/.test(newPassword),
        /[^a-zA-Z0-9]/.test(newPassword),
      ].filter(Boolean).length
    : 0;
  const passwordStrengthText = ['Not entered', 'Very weak', 'Weak', 'Fair', 'Good', 'Strong'][passwordStrength];

  const scrollTo = (element: HTMLElement | null) => {
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const downloadProfile = () => {
    setDownloadMessage(null);
    try {
      const file = new Blob([JSON.stringify(profile, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      const safeName = profile.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile';
      link.href = url;
      link.download = `${safeName}-profile.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setDownloadMessage('Profile data downloaded as JSON.');
    } catch {
      setDownloadMessage('The profile download could not be created in this browser.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-emerald-700 dark:text-emerald-300">Account center</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-emerald-50 sm:text-3xl">Profile &amp; security</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-emerald-200/65">Your identity, account health, and recent activity in one place.</p>
      </header>
      {passwordResetRequired && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Your password was reset by an organizer or super admin. Update it now to secure your account.</span>
        </div>
      )}

      <section className="relative overflow-hidden rounded-3xl border border-emerald-900/20 bg-[radial-gradient(ellipse_at_88%_10%,rgba(110,231,183,0.2),transparent_34%),linear-gradient(118deg,#071D18_0%,#0B3A2D_52%,#102E35_100%)] p-5 text-white shadow-[0_20px_55px_-35px_rgba(2,44,34,0.7)] sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full border border-white/10 bg-white/[0.03]" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 text-lg font-bold text-white shadow-lg ring-1 ring-white/10 sm:h-[4.75rem] sm:w-[4.75rem]">
              {profile.photoDataUrl ? <img src={profile.photoDataUrl} alt={`${profile.fullName} profile`} className="h-full w-full object-cover" /> : initials(profile.fullName)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="break-words font-display text-xl font-bold tracking-tight sm:text-2xl">{profile.fullName}</h2>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${roleTheme[profile.role]}`}>
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  {profile.role}
                </span>
              </div>
              <p className="mt-1 break-words text-xs text-emerald-50/75 sm:text-sm">
                {[profile.department, profile.institution].filter(Boolean).join(' · ') || 'Add your department and institution'}
              </p>
              <p className="mt-1 break-all text-xs text-emerald-50/65">{profile.email}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-emerald-50/70">
                <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Member since {formatDate(profile.createdAt)}</span>
                <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />Last active {latestLogin ? formatTime(latestLogin.occurredAt) : 'No sign-in recorded'}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 xl:max-w-[27rem] xl:justify-end">
            <button type="button" onClick={() => scrollTo(profileSectionRef.current)} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <UserRound className="h-3.5 w-3.5" />Edit profile
            </button>
            <button type="button" onClick={() => scrollTo(securitySectionRef.current)} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <KeyRound className="h-3.5 w-3.5" />Change password
            </button>
            <button type="button" onClick={() => scrollTo(securitySectionRef.current)} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <ShieldCheck className="h-3.5 w-3.5" />Security center
            </button>
            <button type="button" onClick={downloadProfile} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <ArrowDownToLine className="h-3.5 w-3.5" />Download profile
            </button>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${profile.verified ? 'bg-emerald-300/15 text-emerald-100' : 'bg-amber-300/15 text-amber-100'}`}>
            {profile.verified ? <BadgeCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {profile.verified ? 'Verified account' : 'Verification pending'}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${effectiveApprovalStatus === 'Approved' ? 'bg-emerald-300/15 text-emerald-100' : 'bg-amber-300/15 text-amber-100'}`}>
            <ShieldCheck className="h-3.5 w-3.5" />
            Approval: {effectiveApprovalStatus}
            {profile.requestedRole && profile.requestedRole !== profile.role ? ` (Requested ${profile.requestedRole})` : ''}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${blockedUntil ? 'bg-rose-300/15 text-rose-100' : 'bg-white/10 text-emerald-50'}`}>
            {blockedUntil ? <ShieldAlert className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {blockedUntil ?? profile.accountStatus}
          </span>
          <span className="ml-auto text-[10px] text-emerald-50/55">BAUST CSE Fest account</span>
        </div>
      </section>

      <section aria-label="Account overview" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Profile completion" value={`${completion.score}%`} detail={completion.missing.length ? `${completion.missing.length} details to complete` : 'All profile details are filled'} icon={UserRound} tone="emerald" progress={completion.score} />
        <MetricCard label="Security score" value={`${securityScore}/100`} detail="Local checks only; MFA is not connected" icon={ShieldCheck} tone={securityScore >= 60 ? 'violet' : 'amber'} progress={securityScore} />
        <MetricCard label="Account health" value={`${accountHealthScore}/100`} detail={blockedUntil ?? profile.accountStatus} icon={CheckCircle2} tone={accountHealthScore >= 80 ? 'emerald' : 'amber'} progress={accountHealthScore} />
        <MetricCard label="Activity score" value={`${activityScore}/100`} detail={`${recentActivityCount} recorded sign-ins or updates in 30 days`} icon={Activity} tone="sky" progress={activityScore} />
        <MetricCard label="Notifications" value={`${notificationCount}/4 on`} detail="Email, push, in-app, and security alerts" icon={Bell} tone="slate" progress={Math.round((notificationCount / 4) * 100)} />
        <MetricCard label="Engagement" value={`${engagementScore}/100`} detail="Profile completeness plus recent activity" icon={Sparkles} tone="rose" progress={engagementScore} />
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.75fr)]">
        <section ref={profileSectionRef} className="min-w-0 scroll-mt-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-emerald-900/70 dark:bg-[#071D16] sm:p-6">
          <SectionHeading eyebrow="Your identity" title="Profile information" description="Keep personal details current. Email and role are managed by the organization." icon={UserRound} />
          <ProfileFieldsEditor key={profile.userId} profile={profile} onSave={onSave} submitLabel="Save profile changes" />
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-emerald-900/70 dark:bg-[#071D16]">
            <SectionHeading eyebrow="Profile intelligence" title="Completion analytics" description="Complete more information to strengthen your profile." icon={Sparkles} />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-600 dark:text-emerald-200/65">{completion.missing.length ? `${completion.missing.length} fields need attention` : 'Profile details complete'}</span>
              <span className="font-display text-xl font-bold text-emerald-800 dark:text-emerald-300">{completion.score}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-emerald-950/70" role="progressbar" aria-label="Profile completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion.score}>
              <div className="h-full rounded-full bg-emerald-500 transition-[width] dark:bg-emerald-400" style={{ width: `${completion.score}%` }} />
            </div>
            {completion.missing.length > 0 && <p className="mt-2 text-[11px] leading-5 text-slate-500 dark:text-emerald-200/60">Missing: {completion.missing.join(', ')}</p>}
          </section>

          <section ref={securitySectionRef} className="scroll-mt-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-emerald-900/70 dark:bg-[#071D16]">
            <SectionHeading eyebrow="Security center" title="Account protection" icon={ShieldCheck} />
            <p className="mt-2 text-xs text-slate-500 dark:text-emerald-300/65">
              {blockedUntil ? `Access is currently restricted: ${blockedUntil}` : `Account status: ${profile.accountStatus}`}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-emerald-900/60 dark:bg-[#041811]">
                <p className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-emerald-100"><Monitor className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />Current session</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-emerald-200/60">This app is active in your current browser. Remote session inventory is unavailable.</p>
              </div>
              <div className="rounded-lg border border-amber-200/70 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                <p className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200"><Fingerprint className="h-4 w-4" />Two-step verification</p>
                <p className="mt-1 text-[11px] leading-4 text-amber-900/70 dark:text-amber-200/65">Not configured. An identity provider is needed to enroll and verify another factor.</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-800 dark:text-emerald-100">Security recommendations</p>
              {recommendations.length ? (
                <ul className="mt-2 space-y-2">
                  {recommendations.slice(0, 3).map((recommendation) => (
                    <li key={recommendation} className="flex gap-2 text-[11px] leading-4 text-slate-600 dark:text-emerald-200/65">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
                      {recommendation}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-300">No account actions are currently recommended.</p>
              )}
            </div>
            <form onSubmit={submitPassword} className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-emerald-100">
                Current password
                <input required type="password" autoComplete="current-password" className={fieldClass} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
              </label>
              <label className="block text-xs font-semibold text-slate-700 dark:text-emerald-100">
                New password
                <input required minLength={8} type="password" autoComplete="new-password" className={fieldClass} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
              </label>
              <div aria-live="polite">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-slate-500 dark:text-emerald-200/60">Password strength</span>
                  <span className={`font-semibold ${passwordStrength >= 4 ? 'text-emerald-700 dark:text-emerald-300' : passwordStrength > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-400'}`}>{passwordStrengthText}</span>
                </div>
                <div className="mt-1.5 grid grid-cols-5 gap-1" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, index) => (
                    <span key={index} className={`h-1 rounded-full ${index < passwordStrength ? passwordStrength >= 4 ? 'bg-emerald-500' : 'bg-amber-500' : 'bg-slate-200 dark:bg-emerald-900'}`} />
                  ))}
                </div>
              </div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-emerald-100">
                Confirm new password
                <input required minLength={8} type="password" autoComplete="new-password" className={fieldClass} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              </label>
              {passwordMessage && <p role="status" className="text-xs text-emerald-800 dark:text-emerald-300">{passwordMessage}</p>}
              <button type="submit" disabled={savingPassword} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-emerald-950/40">
                <KeyRound className="h-3.5 w-3.5" />
                {savingPassword ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </section>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-emerald-900/70 dark:bg-[#071D16]">
          <SectionHeading eyebrow="Preferences" title="Notification settings" description={`${notificationCount} of 4 channels enabled.`} icon={Bell} />
          {([
            ['email', 'Email notifications'],
            ['push', 'Push notifications'],
            ['inApp', 'In-app announcements'],
            ['securityAlerts', 'Security alerts'],
          ] as const).map(([key, label]) => (
            <PreferenceSwitch
              key={key}
              label={label}
              checked={profile.notificationPreferences[key]}
              onChange={() => updatePreference(key, !profile.notificationPreferences[key])}
            />
          ))}
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-emerald-900/70 dark:bg-[#071D16]">
          <SectionHeading eyebrow="Account timeline" title="Recent updates &amp; approval history" icon={Activity} />
          {ownApprovalLogs.length > 0 || ownActivityLogs.length > 0 || ownEvents.length > 0 ? (
            <ol className="space-y-3">
              {ownApprovalLogs.slice(0, 3).map((entry) => (
                <ActivityEntry
                  key={`ap-${entry.id}`}
                  title={`Role review (${entry.action.replace(/_/g, ' ')}): ${entry.previousStatus} → ${entry.newStatus}`}
                  detail={`${entry.actorName} · ${formatTime(entry.createdAt)}`}
                  icon={ShieldCheck}
                />
              ))}
              {ownActivityLogs.slice(0, 3).map((entry) => (
                <ActivityEntry
                  key={`act-${entry.id}`}
                  title={entry.details || entry.action.replace(/_/g, ' ')}
                  detail={formatTime(entry.createdAt)}
                  icon={Activity}
                />
              ))}
              {ownEvents.slice(0, 3).map((event) => (
                <ActivityEntry key={event.id} title={event.summary} detail={`${event.actorName} · ${formatTime(event.occurredAt)}`} icon={event.action === 'password-changed' || event.action === 'password-reset' ? KeyRound : Activity} />
              ))}
            </ol>
          ) : <p className="text-xs text-slate-500 dark:text-emerald-300/65">Profile changes, approval history, and organizer actions will appear here.</p>}
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-emerald-900/70 dark:bg-[#071D16]">
          <SectionHeading eyebrow="Sign-in history" title="Login activity" icon={Clock3} />
          {ownLogins.length ? (
            <ol className="space-y-3">
              {ownLogins.slice(0, 5).map((event) => (
                <ActivityEntry key={event.id} title={event.method === 'demo' ? 'Demo account sign-in' : 'Password sign-in'} detail={formatTime(event.occurredAt)} icon={Laptop} />
              ))}
            </ol>
          ) : <p className="text-xs text-slate-500 dark:text-emerald-300/65">Successful sign-ins will appear here.</p>}
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-emerald-900/70 dark:bg-[#071D16]">
          <SectionHeading eyebrow="Security events" title="Security history" icon={LockKeyhole} />
          {recentSecurityEvents.length ? (
            <ol className="space-y-3">
              {recentSecurityEvents.slice(0, 5).map((event) => (
                <ActivityEntry key={event.id} title={event.summary} detail={`${event.actorName} · ${formatTime(event.occurredAt)}`} icon={ShieldAlert} tone="amber" />
              ))}
            </ol>
          ) : <p className="text-xs leading-5 text-slate-500 dark:text-emerald-200/60">No password or account-status events are recorded for this account.</p>}
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-emerald-900/70 dark:bg-[#071D16]">
          <SectionHeading eyebrow="Display" title="Appearance" description="Choose a comfortable theme for this device." icon={Palette} />
          <div className="grid gap-2 sm:grid-cols-2">
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
                className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  isDark === dark
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-100'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-emerald-900/35'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label} mode
                </span>
                {isDark === dark && <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-slate-500 dark:text-emerald-200/60">
            Your appearance preference is saved on this device.
          </p>
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-emerald-900/70 dark:bg-[#071D16]">
          <SectionHeading eyebrow="Account assistance" title="Help & support" icon={CircleHelp} />
          <p className="text-xs leading-5 text-slate-600 dark:text-emerald-200/65">
            For access, profile, or notification issues, contact your event organizer or super admin. Include your registered name and account role, but never share your password or verification codes.
          </p>
          <button
            type="button"
            onClick={() => scrollTo(profileSectionRef.current)}
            className="mt-4 inline-flex min-h-9 items-center justify-center rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-emerald-800/70 dark:text-emerald-100 dark:hover:bg-emerald-950/40"
          >
            Review profile information
          </button>
        </section>
      </div>
      {downloadMessage && <p role="status" className="text-xs text-slate-500 dark:text-emerald-200/60">{downloadMessage}</p>}
    </div>
  );
}
