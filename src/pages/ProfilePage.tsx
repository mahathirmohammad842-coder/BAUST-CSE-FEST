import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import type { OrganizerProfile } from '../types';

interface ProfilePageProps {
  profile: OrganizerProfile;
  onEditProfile: () => void;
}

function ProfileAvatar({ name, large = false }: { name: string; large?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div
      role="img"
      aria-label={`${name} profile picture`}
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 via-emerald-500 to-teal-700 font-display font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_24px_-10px_rgba(5,150,105,0.7)] ring-4 ring-white dark:ring-[#061D15] ${
        large ? 'h-24 w-24 text-2xl' : 'h-12 w-12 text-sm'
      }`}
    >
      {initials}
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-emerald-900/60 dark:bg-[#041811]/70">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm dark:bg-emerald-950/70 dark:text-emerald-300">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-emerald-300/60">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-emerald-50">
          {value}
        </p>
      </div>
    </div>
  );
}

export function ProfilePage({ profile, onEditProfile }: ProfilePageProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
            Account
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-emerald-50 sm:text-3xl">
            My profile
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-emerald-200/65">
            Your organizer identity and contact information.
          </p>
        </div>
        <button
          type="button"
          onClick={onEditProfile}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#064E3B] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#053D2E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-[#022017] dark:hover:bg-emerald-300 dark:focus-visible:ring-offset-[#02120C]"
        >
          Edit profile
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_28px_-20px_rgba(15,23,42,0.3)] dark:border-emerald-800/60 dark:bg-[#061D15]">
        <div className="h-28 bg-[radial-gradient(ellipse_at_82%_15%,rgba(110,231,183,0.38),transparent_35%),linear-gradient(115deg,#064E3B,#0C6B50_55%,#0F766E)] sm:h-36" />
        <div className="space-y-4 px-4 py-5 sm:px-8 sm:py-6">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <ProfileAvatar name={profile.fullName} large />
            <div className="min-w-0 flex-1">
              <h2 className="break-words font-display text-xl font-bold leading-tight tracking-tight text-slate-950 dark:text-emerald-50 sm:text-2xl">
                {profile.fullName}
              </h2>
              <p className="mt-1 break-words text-sm leading-5 text-slate-600 dark:text-emerald-200/70">
                Organizer · {profile.department} · BAUST
              </p>
              <p className="mt-1 break-words text-xs leading-5 text-slate-500 dark:text-emerald-300/65">
                {profile.designation}
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {profile.accountStatus} account
          </span>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.85fr]">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_28px_-20px_rgba(15,23,42,0.3)] dark:border-emerald-800/60 dark:bg-[#061D15] sm:p-6">
          <div className="mb-5">
            <h2 className="font-display text-base font-bold text-slate-950 dark:text-emerald-50">
              Contact &amp; affiliation
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-emerald-300/60">
              Information associated with your organizer account.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail icon={Mail} label="Email address" value={profile.email} />
            <Detail icon={Phone} label="Phone number" value={profile.phone} />
            <Detail icon={Building2} label="Department" value={profile.department} />
            <Detail icon={BadgeCheck} label="Designation" value={profile.designation} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_28px_-20px_rgba(15,23,42,0.3)] dark:border-emerald-800/60 dark:bg-[#061D15] sm:p-6">
          <h2 className="font-display text-base font-bold text-slate-950 dark:text-emerald-50">
            Account details
          </h2>
          <div className="mt-4 divide-y divide-slate-100 dark:divide-emerald-900/60">
            <div className="flex items-center justify-between gap-3 py-3">
              <span className="text-xs text-slate-500 dark:text-emerald-300/60">Organizer ID</span>
              <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                {profile.organizerId}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 py-3">
              <span className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-emerald-300/60">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Account status
              </span>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                {profile.accountStatus}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3 py-3">
              <span className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-emerald-300/60">
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
                Last login
              </span>
              <span className="text-right text-xs font-medium text-slate-800 dark:text-emerald-100">
                {profile.lastLogin}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3 py-3">
              <span className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-emerald-300/60">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                Workspace
              </span>
              <span className="text-right text-xs font-medium text-slate-800 dark:text-emerald-100">
                BAUST · Saidpur Campus
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
