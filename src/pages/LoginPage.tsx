import { type FormEvent, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  UserRound,
} from 'lucide-react';
import type { RegistrationInput, RegistrableRole } from '../types';

interface LoginPageProps {
  canRegister: boolean;
  isPasswordRecovery: boolean;
  onSignIn: (identifier: string, password: string) => Promise<string | null>;
  onRegister: (input: RegistrationInput) => Promise<string | null>;
  onRequestPasswordReset: (email: string) => Promise<string | null>;
  onCompletePasswordReset: (password: string) => Promise<string | null>;
}

const PORTAL_HIGHLIGHTS = [
  {
    index: '01',
    title: 'Multi-channel campus dispatch',
    detail: 'Coordinated in-app, email, and push alerts across every venue.',
  },
  {
    index: '02',
    title: 'Room and schedule precision',
    detail: 'Instant updates mapped to BAUST labs, halls, and contest blocks.',
  },
  {
    index: '03',
    title: 'Verified delivery audit trails',
    detail: 'Role-scoped access for organizers, judges, volunteers, and teams.',
  },
];

function BaustFestMark() {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
      className="h-9 w-9 shrink-0"
    >
      <rect
        x="1"
        y="1"
        width="34"
        height="34"
        rx="9"
        className="fill-emerald-400/15 stroke-emerald-300/40"
        strokeWidth="1.25"
      />
      <path
        d="M11 23.5V12.5C11 11.6716 11.6716 11 12.5 11H18.5C20.7091 11 22.5 12.7909 22.5 15C22.5 16.4876 21.688 17.7858 20.483 18.4748C22.212 19.0185 23.5 20.6309 23.5 22.5C23.5 24.7091 21.7091 26.5 19.5 26.5H12.5C11.6716 26.5 11 25.8284 11 25V23.5Z"
        className="stroke-emerald-300"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.75 18.5H18.75"
        className="stroke-emerald-300"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M25.25 11.75C26.4 12.9 27 14.3 27 16"
        className="stroke-emerald-400"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="25.5" cy="11.5" r="1.5" className="fill-emerald-300" />
    </svg>
  );
}

const REGISTRATION_ROLES: RegistrableRole[] = [
  'Participant',
  'Volunteer',
  'Judge',
  'Guest',
  'Sponsor',
  'Mentor',
];

export function LoginPage({
  canRegister,
  isPasswordRecovery,
  onSignIn,
  onRegister,
  onRequestPasswordReset,
  onCompletePasswordReset,
}: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isSettingNewPassword, setIsSettingNewPassword] =
    useState(isPasswordRecovery);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);
  const [registration, setRegistration] = useState<RegistrationInput>({
    fullName: '',
    email: '',
    phone: '',
    role: 'Participant',
    affiliation: '',
    password: '',
  });

  useEffect(() => {
    if (rateLimitCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setRateLimitCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [rateLimitCooldown]);

  useEffect(() => {
    if (!isPasswordRecovery) return;
    setIsSettingNewPassword(true);
    setIsForgotPassword(false);
    setIsRegistering(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [isPasswordRecovery]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

    if (!trimmedEmail || !isValidEmail) {
      setErrorMessage('Enter a valid email address.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const error = await onSignIn(trimmedEmail, password);
      if (error) setErrorMessage(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegistrationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || rateLimitCooldown > 0) return;
    setErrorMessage(null);

    const trimmedName = registration.fullName.trim();
    const trimmedEmail = registration.email.trim();
    const trimmedAffiliation = registration.affiliation.trim();
    const digits = registration.phone.replace(/\D/g, '');

    if (trimmedName.length < 2) {
      setErrorMessage('Enter your full name (at least 2 characters).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage('Enter a valid email address.');
      return;
    }
    if (digits.length < 8) {
      setErrorMessage('Enter a valid mobile number (at least 8 digits).');
      return;
    }
    if (trimmedAffiliation.length < 2) {
      setErrorMessage('Enter your department or organization.');
      return;
    }
    if (registration.password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }
    const confirmPassword = new FormData(event.currentTarget).get(
      'confirmPassword'
    );
    if (registration.password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const error = await onRegister({
        ...registration,
        fullName: trimmedName,
        email: trimmedEmail,
        phone: registration.phone.trim(),
        affiliation: trimmedAffiliation,
      });
      if (error) {
        if (/rate.?limit|too many requests|smtp/i.test(error)) {
          setRateLimitCooldown(60);
        }
        setErrorMessage(error);
        return;
      }
      setEmail(trimmedEmail);
      setPassword('');
      setRegistration((previous) => ({
        ...previous,
        password: '',
      }));
      setSuccessMessage(
        'Your registration request has been submitted and is awaiting organizer approval.'
      );
      setIsRegistering(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordResetRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage('Enter the email address linked to your account.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      const error = await onRequestPasswordReset(trimmedEmail);
      if (error) {
        setErrorMessage(error);
        return;
      }
      setSuccessMessage(
        'If an account exists for this email, a password reset link has been sent.'
      );
      setIsForgotPassword(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not send the password reset email. Try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordRecoverySubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      const error = await onCompletePasswordReset(newPassword);
      if (error) {
        setErrorMessage(error);
        return;
      }
      setPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setIsSettingNewPassword(false);
      setSuccessMessage('Password updated. Sign in with your new password.');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not update your password. Try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateRegistration = <K extends keyof RegistrationInput>(
    key: K,
    value: RegistrationInput[K]
  ) => {
    setRegistration((previous) => ({ ...previous, [key]: value }));
    setErrorMessage(null);
  };

  return (
    <main className="page-enter font-inter relative min-h-screen overflow-x-hidden overflow-y-auto bg-[#F5F8F6] px-4 py-6 sm:px-8 sm:py-10 lg:px-12 flex items-center justify-center dark:bg-[#02120C] transition-colors duration-150">
      {/* Subtle architectural canvas depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_15%_10%,rgba(16,185,129,0.10),transparent_55%),radial-gradient(ellipse_70%_55%_at_88%_90%,rgba(6,78,59,0.08),transparent_60%)] dark:bg-[radial-gradient(ellipse_80%_60%_at_15%_10%,rgba(16,185,129,0.14),transparent_55%),radial-gradient(ellipse_70%_55%_at_88%_90%,rgba(4,120,87,0.16),transparent_60%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.18] [background-image:linear-gradient(to_right,rgba(6,78,59,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(6,78,59,0.045)_1px,transparent_1px)] [background-size:48px_48px]"
      />

      <div className="relative z-10 w-full max-w-[1040px]">
        <div className="grid grid-cols-1 md:grid-cols-12 items-stretch overflow-hidden rounded-2xl border border-slate-200/80 bg-white/85 backdrop-blur-xl shadow-[0_28px_72px_-18px_rgba(2,44,34,0.12),0_4px_16px_-4px_rgba(2,44,34,0.05)] dark:border-emerald-800/60 dark:bg-[#061D15]/85 dark:shadow-[0_32px_84px_-16px_rgba(0,0,0,0.68)]">
          {/* Left Panel: Architectural Brand & Context */}
          <section className="relative md:col-span-5 min-w-0 flex flex-col justify-between overflow-hidden bg-gradient-to-b from-[#064E3B] via-[#04382A] to-[#02241B] p-6 sm:p-9 lg:p-11 text-white ring-1 ring-inset ring-white/10">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(52,211,153,0.14),transparent_48%)]"
            />

            <div className="relative">
              {/* Brand Mark */}
              <div className="flex items-center gap-3">
                <BaustFestMark />
                <div className="min-w-0">
                  <span className="block text-sm font-semibold tracking-[-0.01em] text-white whitespace-nowrap">
                    BAUST CSE Fest
                  </span>
                  <span className="block text-xs text-emerald-200/75 whitespace-nowrap">
                    Saidpur Campus
                  </span>
                </div>
              </div>

              {/* Hero Title */}
              <div className="mt-8 md:mt-12 space-y-3.5">
                <p className="text-xs font-medium tracking-wide text-emerald-300/95">
                  Event Operations Portal
                </p>
                <h1 className="text-[1.625rem] sm:text-[1.875rem] font-semibold leading-[1.18] tracking-[-0.025em] text-white text-balance">
                  Notification &amp; Announcement System
                </h1>
                <p className="max-w-sm text-sm leading-relaxed text-emerald-100/80">
                  Real-time schedule updates, room shifts, and verified campus broadcasts in one unified workspace.
                </p>
              </div>

              {/* Quiet Editorial Highlights (collapsed on small mobile so form sits above the fold) */}
              <div className="mt-10 hidden md:block border-t border-white/10 pt-8">
                <ul className="space-y-5">
                  {PORTAL_HIGHLIGHTS.map((item) => (
                    <li key={item.index} className="flex items-start gap-3.5">
                      <span className="font-mono text-[11px] font-medium tabular-nums text-emerald-300/80 pt-0.5 shrink-0">
                        {item.index}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium leading-snug text-white">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-emerald-100/70">
                          {item.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="relative mt-8 hidden md:flex items-center justify-between border-t border-white/10 pt-5 text-xs text-emerald-100/65">
              <span>BAUST Saidpur</span>
              <span className="font-mono tabular-nums">GMT+6</span>
            </div>
          </section>

          {/* Right Panel: Minimalist Enterprise Sign-In Form */}
          <section className="md:col-span-7 min-w-0 bg-white/70 px-6 py-7 sm:p-10 lg:px-14 lg:py-12 flex flex-col justify-between dark:bg-[#061D15]/70">
            <div>
              <div className="mx-auto mt-10 w-full max-w-[380px] sm:mt-12">
                <header className="space-y-2">
                  <h2 className="text-[1.5rem] sm:text-[1.75rem] font-semibold tracking-[-0.025em] text-slate-950 dark:text-emerald-50">
                    {isRegistering
                      ? 'Create your account'
                      : isSettingNewPassword
                        ? 'Set a new password'
                        : isForgotPassword
                          ? 'Reset your password'
                          : 'Sign in'}
                  </h2>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-emerald-200/80">
                    {isRegistering
                      ? 'Submit your details for organizer review. Access is enabled after approval.'
                      : isSettingNewPassword
                        ? 'Choose a new password for your account.'
                        : isForgotPassword
                          ? 'We will email you a secure password reset link.'
                          : 'Enter your credentials to access the fest portal.'}
                  </p>
                </header>

                {successMessage &&
                  !isRegistering &&
                  !isSettingNewPassword &&
                  !isForgotPassword && (
                  <div
                    role="status"
                    className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium leading-relaxed text-emerald-900 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-200"
                  >
                    {successMessage}
                  </div>
                )}

                {isRegistering ? (
                  <form
                    onSubmit={handleRegistrationSubmit}
                    className="form-enter mt-6 space-y-4"
                    noValidate
                  >
                    {errorMessage && (
                      <div
                        role="alert"
                        className="flex items-start gap-2.5 rounded-xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-xs font-medium leading-relaxed text-red-800 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-200"
                      >
                        <AlertTriangle
                          className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
                          aria-hidden="true"
                        />
                        <span>{errorMessage}</span>
                      </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100 sm:col-span-2">
                        Full Name
                        <div className="relative mt-1.5">
                          <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                          <input
                            required
                            autoComplete="name"
                            value={registration.fullName}
                            onChange={(event) => updateRegistration('fullName', event.target.value)}
                            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 pl-10 text-sm outline-none focus:border-emerald-700 focus:ring-[3px] focus:ring-emerald-600/15 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                          />
                        </div>
                      </label>
                      <label className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100">
                        Email Address
                        <div className="relative mt-1.5">
                          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                          <input
                            required
                            type="email"
                            autoComplete="email"
                            value={registration.email}
                            onChange={(event) => updateRegistration('email', event.target.value)}
                            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 pl-10 text-sm outline-none focus:border-emerald-700 focus:ring-[3px] focus:ring-emerald-600/15 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                          />
                        </div>
                      </label>
                      <label className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100">
                        Mobile Number
                        <div className="relative mt-1.5">
                          <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                          <input
                            required
                            type="tel"
                            autoComplete="tel"
                            value={registration.phone}
                            onChange={(event) => updateRegistration('phone', event.target.value)}
                            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 pl-10 text-sm outline-none focus:border-emerald-700 focus:ring-[3px] focus:ring-emerald-600/15 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                          />
                        </div>
                      </label>
                      <label className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100">
                        Role
                        <select
                          required
                          value={registration.role}
                          onChange={(event) => {
                            const role = REGISTRATION_ROLES.find(
                              (candidate) => candidate === event.target.value
                            );
                            if (role) updateRegistration('role', role);
                          }}
                          className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-[3px] focus:ring-emerald-600/15 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                        >
                          {REGISTRATION_ROLES.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100">
                        Department / Organization
                        <div className="mt-1.5">
                          <input
                            required
                            value={registration.affiliation}
                            onChange={(event) => updateRegistration('affiliation', event.target.value)}
                            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-[3px] focus:ring-emerald-600/15 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                          />
                        </div>
                      </label>
                      <label className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100">
                        Password
                        <input
                          required
                          type="password"
                          autoComplete="new-password"
                          minLength={8}
                          value={registration.password}
                          onChange={(event) => updateRegistration('password', event.target.value)}
                          className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-[3px] focus:ring-emerald-600/15 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                        />
                      </label>
                      <label className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100">
                        Confirm Password
                        <input
                          required
                          name="confirmPassword"
                          type="password"
                          autoComplete="new-password"
                          minLength={8}
                          className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-[3px] focus:ring-emerald-600/15 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                        />
                      </label>
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting || rateLimitCooldown > 0}
                      className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl bg-[#064E3B] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#053D2E] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-emerald-400 dark:text-[#022017]"
                    >
                      {rateLimitCooldown > 0
                        ? `Wait ${rateLimitCooldown}s before retrying`
                        : isSubmitting
                          ? 'Submitting request…'
                          : 'Submit for Approval'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegistering(false);
                        setErrorMessage(null);
                      }}
                      className="w-full py-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950 dark:text-emerald-300 dark:hover:text-emerald-100"
                    >
                      Back to Sign In
                    </button>
                  </form>
                ) : isSettingNewPassword ? (
                  <form
                    onSubmit={handlePasswordRecoverySubmit}
                    className="form-enter mt-6 space-y-4"
                    noValidate
                  >
                    {errorMessage && (
                      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-200">
                        {errorMessage}
                      </div>
                    )}
                    <label className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100">
                      New password
                      <input
                        required
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-[3px] focus:ring-emerald-600/15 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                      />
                    </label>
                    <label className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100">
                      Confirm new password
                      <input
                        required
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        value={confirmNewPassword}
                        onChange={(event) =>
                          setConfirmNewPassword(event.target.value)
                        }
                        className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-[3px] focus:ring-emerald-600/15 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl bg-[#064E3B] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#053D2E] disabled:cursor-wait disabled:opacity-70 dark:bg-emerald-400 dark:text-[#022017]"
                    >
                      {isSubmitting ? 'Updating password…' : 'Update password'}
                    </button>
                  </form>
                ) : isForgotPassword ? (
                  <form
                    onSubmit={handlePasswordResetRequest}
                    className="form-enter mt-6 space-y-4"
                    noValidate
                  >
                    {errorMessage && (
                      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-200">
                        {errorMessage}
                      </div>
                    )}
                    <label
                      htmlFor="reset-email"
                      className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100"
                    >
                      Email address
                      <input
                        id="reset-email"
                        required
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="Enter your account email"
                        className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-[3px] focus:ring-emerald-600/15 dark:border-emerald-800/70 dark:bg-[#041811] dark:text-emerald-50"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl bg-[#064E3B] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#053D2E] disabled:cursor-wait disabled:opacity-70 dark:bg-emerald-400 dark:text-[#022017]"
                    >
                      {isSubmitting ? 'Sending link…' : 'Send reset link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(false);
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="w-full py-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950 dark:text-emerald-300 dark:hover:text-emerald-100"
                    >
                      Back to Sign In
                    </button>
                  </form>
                ) : (
                <form onSubmit={handleSubmit} className="form-enter mt-8 space-y-5" noValidate>
                  {errorMessage && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-xs font-medium leading-relaxed text-red-800 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-200"
                    >
                      <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
                        aria-hidden="true"
                      />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div className="space-y-5">
                    <div>
                      <label
                        htmlFor="login-email"
                        className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100"
                      >
                        Email address
                      </label>
                      <div className="relative mt-2">
                        <Mail
                          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors dark:text-emerald-400/70"
                          aria-hidden="true"
                        />
                        <input
                          id="login-email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (errorMessage) setErrorMessage(null);
                          }}
                          placeholder="Enter your email address"
                          className="min-h-[44px] w-full rounded-xl border border-slate-200/90 bg-white/90 py-2.5 pl-10 pr-4 text-sm text-slate-950 placeholder:text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-150 hover:border-slate-300 focus:border-emerald-700 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-emerald-600/15 dark:border-emerald-800/70 dark:bg-[#041811]/90 dark:text-emerald-50 dark:placeholder:text-emerald-300/40 dark:hover:border-emerald-700 dark:focus:border-emerald-400 dark:focus:bg-[#041811] dark:focus:ring-emerald-400/20"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="login-password"
                        className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100"
                      >
                        Password
                      </label>
                      <div className="relative mt-2">
                        <Lock
                          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors dark:text-emerald-400/70"
                          aria-hidden="true"
                        />
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (errorMessage) setErrorMessage(null);
                          }}
                          placeholder="Enter your password"
                          className="min-h-[44px] w-full rounded-xl border border-slate-200/90 bg-white/90 py-2.5 pl-10 pr-12 text-sm text-slate-950 placeholder:text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-150 hover:border-slate-300 focus:border-emerald-700 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-emerald-600/15 dark:border-emerald-800/70 dark:bg-[#041811]/90 dark:text-emerald-50 dark:placeholder:text-emerald-300/40 dark:hover:border-emerald-700 dark:focus:border-emerald-400 dark:focus:bg-[#041811] dark:focus:ring-emerald-400/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          aria-pressed={showPassword}
                          title={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:text-emerald-300/75 dark:hover:bg-emerald-900/60 dark:hover:text-emerald-50"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-0.5">
                    <label className="inline-flex min-h-[36px] items-center gap-2.5 cursor-pointer select-none">
                      <span className="relative flex h-4 w-4 items-center justify-center">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="peer sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className="flex h-4 w-4 items-center justify-center rounded-[5px] border border-slate-300 bg-white transition-all duration-150 peer-hover:border-slate-400 peer-checked:border-emerald-700 peer-checked:bg-emerald-700 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-700 peer-focus-visible:ring-offset-2 dark:border-emerald-700 dark:bg-[#041811] dark:peer-hover:border-emerald-500 dark:peer-checked:border-emerald-400 dark:peer-checked:bg-emerald-400 dark:peer-focus-visible:ring-offset-[#061D15]"
                        >
                          {rememberMe && (
                            <Check className="h-3 w-3 text-white dark:text-[#022017] stroke-[3]" />
                          )}
                        </span>
                      </span>
                      <span className="text-[13px] font-medium text-slate-700 dark:text-emerald-100/85">
                        Remember me
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-300"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group relative inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#064E3B] px-5 py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_2px_6px_-1px_rgba(6,78,59,0.28)] transition-all duration-150 ease-out hover:-translate-y-[1px] hover:bg-[#053D2E] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_10px_24px_-6px_rgba(6,78,59,0.42)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-[#022017] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_8px_-1px_rgba(0,0,0,0.4)] dark:hover:bg-emerald-300 dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_10px_24px_-6px_rgba(52,211,153,0.35)] dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-[#061D15] whitespace-nowrap"
                  >
                    <span>{isSubmitting ? 'Signing in…' : 'Sign In'}</span>
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </button>
                </form>
                )}

                {!isRegistering &&
                  !isForgotPassword &&
                  !isSettingNewPassword &&
                  canRegister && (
                  <div className="mt-5 border-t border-slate-200/70 pt-4 text-center dark:border-emerald-800/50">
                    <span className="text-xs text-slate-600 dark:text-emerald-200/75">
                      New to the fest portal?
                    </span>{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegistering(true);
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-300"
                    >
                      Create Account
                    </button>
                  </div>
                )}
              </div>
            </div>

            <footer className="mx-auto mt-10 sm:mt-12 w-full max-w-[380px] border-t border-slate-200/70 pt-5 text-xs leading-relaxed text-slate-500 dark:border-emerald-800/50 dark:text-emerald-300/65">
              Authorized access for BAUST CSE Fest organizers, judges, volunteers, and participants.
            </footer>
          </section>
        </div>
      </div>
    </main>
  );
}
