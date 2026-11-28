import { type FormEvent, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  UserPlus,
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

const PORTAL_CAPABILITIES = [
  {
    index: '01',
    title: 'Multi-channel campus dispatch',
    detail:
      'Coordinated in-app, email, push, and SMS broadcasts across every competition venue.',
  },
  {
    index: '02',
    title: 'Venue & schedule precision',
    detail:
      'Live schedule changes mapped directly to BAUST labs, seminar rooms, and contest blocks.',
  },
  {
    index: '03',
    title: 'Approval-gated governance',
    detail:
      'Verified role isolation across participants, volunteers, judges, organizers, and super admins.',
  },
];

const REGISTRATION_ROLES: RegistrableRole[] = [
  'Participant',
  'Volunteer',
  'Judge',
  'Guest',
  'Sponsor',
  'Mentor',
];

function BaustFestMark() {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className="h-10 w-10 shrink-0"
    >
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="10"
        className="fill-emerald-400/15 stroke-emerald-300/40"
        strokeWidth="1.25"
      />
      <path
        d="M12.5 26V14C12.5 13.1716 13.1716 12.5 14 12.5H20.5C22.9853 12.5 25 14.5147 25 17C25 18.6134 24.15 20.0285 22.872 20.8226C24.725 21.4437 26.0625 23.1892 26.0625 25.25C26.0625 27.7353 24.0478 29.75 21.5625 29.75H14C13.1716 29.75 12.5 29.0784 12.5 28.25V26Z"
        className="stroke-emerald-300"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 20.75H21"
        className="stroke-emerald-300"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
      <path
        d="M27.75 13.25C29.05 14.55 29.75 16.15 29.75 18"
        className="stroke-emerald-400"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="28" cy="13" r="1.6" className="fill-emerald-300" />
    </svg>
  );
}

function PasswordPolicyChecklist({
  password,
  confirmPassword,
}: {
  password: string;
  confirmPassword: string;
}) {
  const hasMinLength = password.length >= 8;
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumberOrSymbol = /[\d\W_]/.test(password);
  const matches =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  const rules = [
    { label: 'At least 8 characters', passed: hasMinLength },
    { label: 'Uppercase & lowercase letters', passed: hasMixedCase },
    { label: 'Number or special symbol', passed: hasNumberOrSymbol },
    { label: 'Confirmation matches', passed: matches },
  ];

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-emerald-800/60 dark:bg-[#041811]/90">
      <p className="text-[11px] font-semibold text-slate-700 dark:text-emerald-200/90">
        Password security checks
      </p>
      <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {rules.map((rule) => (
          <li
            key={rule.label}
            className={`flex items-center gap-1.5 text-[11px] transition-colors ${
              rule.passed
                ? 'font-medium text-emerald-700 dark:text-emerald-300'
                : 'text-slate-500 dark:text-emerald-300/55'
            }`}
          >
            <span
              aria-hidden="true"
              className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                rule.passed
                  ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-[#022017]'
                  : 'border-slate-300 bg-white dark:border-emerald-800 dark:bg-[#061D15]'
              }`}
            >
              {rule.passed && <Check className="h-2.5 w-2.5 stroke-[3]" />}
            </span>
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  const [confirmRegPassword, setConfirmRegPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [showRecoveryConfirmPassword, setShowRecoveryConfirmPassword] =
    useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isSettingNewPassword, setIsSettingNewPassword] =
    useState(isPasswordRecovery);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registration, setRegistration] = useState<RegistrationInput>({
    fullName: '',
    email: '',
    phone: '',
    role: 'Participant',
    affiliation: '',
    password: '',
  });

  useEffect(() => {
    if (!isPasswordRecovery) return;
    setIsSettingNewPassword(true);
    setIsForgotPassword(false);
    setIsRegistering(false);
    setErrorMessage(null);
    setSuccessMessage(null);
    setInvalidField(null);
  }, [isPasswordRecovery]);

  const inputBaseClass =
    'min-h-[44px] w-full rounded-xl border bg-white/95 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-150 focus:outline-none focus:ring-[3px] dark:bg-[#041811]/95 dark:text-emerald-50 dark:placeholder:text-emerald-300/40';

  const getFieldClass = (fieldKey: string, extraPadding = 'px-3.5') =>
    `${inputBaseClass} ${extraPadding} ${
      invalidField === fieldKey
        ? 'border-red-400 focus:border-red-600 focus:ring-red-500/15 dark:border-red-500/80 dark:focus:border-red-400 dark:focus:ring-red-400/20'
        : 'border-slate-200/90 hover:border-slate-300 focus:border-emerald-700 focus:ring-emerald-600/15 dark:border-emerald-800/70 dark:hover:border-emerald-700 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/20'
    }`;

  const switchAuthMode = (mode: 'signin' | 'register' | 'forgot') => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setInvalidField(null);
    setIsSettingNewPassword(false);
    setIsRegistering(mode === 'register');
    setIsForgotPassword(mode === 'forgot');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

    if (!trimmedEmail || !isValidEmail) {
      setInvalidField('login-email');
      setErrorMessage('Enter a valid institutional or personal email address.');
      return;
    }
    if (!password.trim()) {
      setInvalidField('login-password');
      setErrorMessage('Please enter your account password.');
      return;
    }

    setInvalidField(null);
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
    if (isSubmitting) return;
    setErrorMessage(null);
    setInvalidField(null);

    const trimmedName = registration.fullName.trim();
    const trimmedEmail = registration.email.trim();
    const trimmedAffiliation = registration.affiliation.trim();
    const digits = registration.phone.replace(/\D/g, '');

    if (trimmedName.length < 2) {
      setInvalidField('reg-name');
      setErrorMessage('Enter your full name (at least 2 characters).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setInvalidField('reg-email');
      setErrorMessage('Enter a valid email address.');
      return;
    }
    if (digits.length < 8) {
      setInvalidField('reg-phone');
      setErrorMessage('Enter a valid mobile number (at least 8 digits).');
      return;
    }
    if (trimmedAffiliation.length < 2) {
      setInvalidField('reg-affiliation');
      setErrorMessage('Enter your department or organization.');
      return;
    }
    if (registration.password.length < 8) {
      setInvalidField('reg-password');
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }
    if (registration.password !== confirmRegPassword) {
      setInvalidField('reg-confirm-password');
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
        setErrorMessage(error);
        return;
      }
      setEmail(trimmedEmail);
      setPassword('');
      setConfirmRegPassword('');
      setRegistration((previous) => ({
        ...previous,
        password: '',
      }));
      setSuccessMessage(
        'Your account is registered with instant Participant access while your requested role is under Organizer or Super Admin review.'
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
      setInvalidField('reset-email');
      setErrorMessage('Enter the email address linked to your account.');
      return;
    }

    setInvalidField(null);
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
    setInvalidField(null);
    if (newPassword.length < 8) {
      setInvalidField('recovery-password');
      setErrorMessage('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setInvalidField('recovery-confirm-password');
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
    value: RegistrationInput[K],
    fieldKey?: string
  ) => {
    setRegistration((previous) => ({ ...previous, [key]: value }));
    setErrorMessage(null);
    if (fieldKey && invalidField === fieldKey) setInvalidField(null);
  };

  return (
    <main className="page-enter font-inter relative flex min-h-screen items-center justify-center overflow-x-hidden overflow-y-auto bg-[#F4F8F6] px-4 py-6 sm:px-8 sm:py-10 lg:px-12 dark:bg-[#02120C] transition-colors duration-150">
      {/* Subtle architectural canvas depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_15%_10%,rgba(16,185,129,0.10),transparent_55%),radial-gradient(ellipse_70%_55%_at_88%_90%,rgba(6,78,59,0.08),transparent_60%)] dark:bg-[radial-gradient(ellipse_80%_60%_at_15%_10%,rgba(16,185,129,0.14),transparent_55%),radial-gradient(ellipse_70%_55%_at_88%_90%,rgba(4,120,87,0.16),transparent_60%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.18] [background-image:linear-gradient(to_right,rgba(6,78,59,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(6,78,59,0.045)_1px,transparent_1px)] [background-size:48px_48px]"
      />

      <div className="relative z-10 w-full max-w-[1120px]">
        <div className="grid grid-cols-1 items-stretch overflow-hidden rounded-2xl border border-slate-200/85 bg-white/90 backdrop-blur-xl shadow-[0_28px_72px_-18px_rgba(2,44,34,0.13),0_4px_16px_-4px_rgba(2,44,34,0.05)] md:grid-cols-12 dark:border-emerald-800/60 dark:bg-[#061D15]/90 dark:shadow-[0_32px_84px_-16px_rgba(0,0,0,0.7)]">
          {/* Left Panel: Enterprise Institutional Identity & Governance */}
          <section className="relative flex min-w-0 flex-col justify-between overflow-hidden bg-gradient-to-b from-[#064E3B] via-[#04382A] to-[#02241B] p-6 text-white ring-1 ring-inset ring-white/10 sm:p-9 lg:p-11 md:col-span-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_12%,rgba(52,211,153,0.16),transparent_48%),radial-gradient(circle_at_12%_88%,rgba(16,185,129,0.10),transparent_45%)]"
            />

            <div className="relative">
              <div className="flex items-center gap-3.5">
                <BaustFestMark />
                <div className="min-w-0">
                  <span className="block font-display text-sm font-bold tracking-[-0.01em] text-white whitespace-nowrap">
                    BAUST CSE Fest
                  </span>
                  <span className="block text-xs text-emerald-200/75 whitespace-nowrap">
                    Saidpur Campus · Official Event Portal
                  </span>
                </div>
              </div>

              <div className="mt-8 space-y-3 md:mt-11">
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-300/90">
                  Event Operations &amp; Access Control
                </p>
                <h1 className="font-display text-[1.625rem] font-semibold leading-[1.18] tracking-[-0.025em] text-white sm:text-[1.95rem] text-balance">
                  Notification &amp; Announcement System
                </h1>
                <p className="max-w-sm text-sm leading-relaxed text-emerald-100/80">
                  Centralized command for venue broadcasts, participant notifications, delivery diagnostics, and role-governed onboarding.
                </p>
              </div>

              <div className="mt-9 hidden border-t border-white/12 pt-7 md:block">
                <ul className="space-y-5">
                  {PORTAL_CAPABILITIES.map((item) => (
                    <li key={item.index} className="flex items-start gap-3.5">
                      <span className="pt-0.5 font-mono text-[11px] font-medium tabular-nums text-emerald-300/85 shrink-0">
                        {item.index}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold leading-snug text-white">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-emerald-100/72">
                          {item.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="relative mt-8 hidden space-y-4 md:block">
              <div className="rounded-xl border border-white/12 bg-white/[0.06] p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-200">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                  <span>Onboarding &amp; Approval Workflow</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-emerald-100/80">
                  <div className="rounded-lg bg-black/20 px-2.5 py-2">
                    <span className="block font-mono text-[10px] text-emerald-300/80">
                      STEP 1
                    </span>
                    <span className="mt-0.5 block font-medium text-white">
                      Request Access
                    </span>
                  </div>
                  <div className="rounded-lg bg-black/20 px-2.5 py-2">
                    <span className="block font-mono text-[10px] text-emerald-300/80">
                      STEP 2
                    </span>
                    <span className="mt-0.5 block font-medium text-white">
                      Staff Review
                    </span>
                  </div>
                  <div className="rounded-lg bg-black/20 px-2.5 py-2">
                    <span className="block font-mono text-[10px] text-emerald-300/80">
                      STEP 3
                    </span>
                    <span className="mt-0.5 block font-medium text-white">
                      Active Portal
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-emerald-100/65">
                <span>Bangladesh Army University of Science &amp; Technology</span>
                <span className="font-mono tabular-nums">GMT+6</span>
              </div>
            </div>
          </section>

          {/* Right Panel: Enterprise Authentication Workspace */}
          <section className="flex min-w-0 flex-col justify-between bg-white/75 px-6 py-7 sm:p-10 lg:px-14 lg:py-11 md:col-span-7 dark:bg-[#061D15]/75">
            <div className="mx-auto w-full max-w-[440px]">
              {canRegister && !isForgotPassword && !isSettingNewPassword && (
                <div
                  role="tablist"
                  aria-label="Authentication mode"
                  className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200/80 bg-slate-100/80 p-1 dark:border-emerald-800/60 dark:bg-[#041811]"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={!isRegistering}
                    onClick={() => switchAuthMode('signin')}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                      !isRegistering
                        ? 'bg-white text-emerald-950 shadow-sm dark:bg-[#0B2E22] dark:text-emerald-50'
                        : 'text-slate-600 hover:text-slate-950 dark:text-emerald-200/70 dark:hover:text-emerald-50'
                    }`}
                  >
                    <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                    Sign In
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isRegistering}
                    onClick={() => switchAuthMode('register')}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                      isRegistering
                        ? 'bg-white text-emerald-950 shadow-sm dark:bg-[#0B2E22] dark:text-emerald-50'
                        : 'text-slate-600 hover:text-slate-950 dark:text-emerald-200/70 dark:hover:text-emerald-50'
                    }`}
                  >
                    <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                    Request Access
                  </button>
                </div>
              )}

              <header className="mt-7 space-y-2">
                {(isForgotPassword || isSettingNewPassword) && (
                  <button
                    type="button"
                    onClick={() => switchAuthMode('signin')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950 dark:text-emerald-300 dark:hover:text-emerald-100"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    Back to Sign In
                  </button>
                )}
                <h2 className="font-display text-[1.5rem] font-semibold tracking-[-0.025em] text-slate-950 sm:text-[1.75rem] dark:text-emerald-50">
                  {isRegistering
                    ? 'Request portal access'
                    : isSettingNewPassword
                      ? 'Set a new password'
                      : isForgotPassword
                        ? 'Reset your password'
                        : 'Welcome back'}
                </h2>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-emerald-200/80">
                  {isRegistering
                    ? 'Register to enter the portal immediately as a Participant while Organizers or Super Admins review your requested role.'
                    : isSettingNewPassword
                      ? 'Choose a strong password for your BAUST CSE Fest account.'
                      : isForgotPassword
                        ? 'Enter your registered email address to receive a secure password recovery link.'
                        : 'Sign in with your verified BAUST CSE Fest credentials.'}
                </p>
              </header>

              {successMessage &&
                !isRegistering &&
                !isSettingNewPassword &&
                !isForgotPassword && (
                  <div
                    role="status"
                    className="mt-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium leading-relaxed text-emerald-900 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-200"
                  >
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300"
                      aria-hidden="true"
                    />
                    <span>{successMessage}</span>
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
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="reg-name"
                        className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100"
                      >
                        Full Name
                      </label>
                      <div className="relative mt-1.5">
                        <UserRound
                          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-emerald-400/70"
                          aria-hidden="true"
                        />
                        <input
                          id="reg-name"
                          required
                          autoComplete="name"
                          aria-invalid={invalidField === 'reg-name'}
                          placeholder="e.g., Tanvir Rahman"
                          value={registration.fullName}
                          onChange={(event) =>
                            updateRegistration(
                              'fullName',
                              event.target.value,
                              'reg-name'
                            )
                          }
                          className={getFieldClass('reg-name', 'pl-10 pr-3.5')}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="reg-email"
                        className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100"
                      >
                        Email Address
                      </label>
                      <div className="relative mt-1.5">
                        <Mail
                          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-emerald-400/70"
                          aria-hidden="true"
                        />
                        <input
                          id="reg-email"
                          required
                          type="email"
                          autoComplete="email"
                          aria-invalid={invalidField === 'reg-email'}
                          placeholder="name@university.edu"
                          value={registration.email}
                          onChange={(event) =>
                            updateRegistration(
                              'email',
                              event.target.value,
                              'reg-email'
                            )
                          }
                          className={getFieldClass('reg-email', 'pl-10 pr-3.5')}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="reg-phone"
                        className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100"
                      >
                        Mobile Number
                      </label>
                      <div className="relative mt-1.5">
                        <Phone
                          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-emerald-400/70"
                          aria-hidden="true"
                        />
                        <input
                          id="reg-phone"
                          required
                          type="tel"
                          autoComplete="tel"
                          aria-invalid={invalidField === 'reg-phone'}
                          placeholder="+880 17XX-XXXXXX"
                          value={registration.phone}
                          onChange={(event) =>
                            updateRegistration(
                              'phone',
                              event.target.value,
                              'reg-phone'
                            )
                          }
                          className={getFieldClass('reg-phone', 'pl-10 pr-3.5')}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="reg-role"
                        className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100"
                      >
                        Requested Role
                      </label>
                      <div className="mt-1.5">
                        <select
                          id="reg-role"
                          required
                          value={registration.role}
                          onChange={(event) => {
                            const role = REGISTRATION_ROLES.find(
                              (candidate) => candidate === event.target.value
                            );
                            if (role) updateRegistration('role', role);
                          }}
                          className={getFieldClass('reg-role', 'px-3.5')}
                        >
                          {REGISTRATION_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-emerald-300/65">
                        New accounts receive instant Participant access while your requested role is reviewed.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="reg-affiliation"
                        className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100"
                      >
                        Department / Organization
                      </label>
                      <div className="relative mt-1.5">
                        <Building2
                          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-emerald-400/70"
                          aria-hidden="true"
                        />
                        <input
                          id="reg-affiliation"
                          required
                          aria-invalid={invalidField === 'reg-affiliation'}
                          placeholder="e.g., CSE, BAUST"
                          value={registration.affiliation}
                          onChange={(event) =>
                            updateRegistration(
                              'affiliation',
                              event.target.value,
                              'reg-affiliation'
                            )
                          }
                          className={getFieldClass(
                            'reg-affiliation',
                            'pl-10 pr-3.5'
                          )}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="reg-password"
                        className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100"
                      >
                        Password
                      </label>
                      <div className="relative mt-1.5">
                        <Lock
                          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-emerald-400/70"
                          aria-hidden="true"
                        />
                        <input
                          id="reg-password"
                          required
                          type={showRegPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          minLength={8}
                          aria-invalid={invalidField === 'reg-password'}
                          placeholder="Min. 8 characters"
                          value={registration.password}
                          onChange={(event) =>
                            updateRegistration(
                              'password',
                              event.target.value,
                              'reg-password'
                            )
                          }
                          className={getFieldClass(
                            'reg-password',
                            'pl-10 pr-11'
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword((prev) => !prev)}
                          aria-label={
                            showRegPassword ? 'Hide password' : 'Show password'
                          }
                          aria-pressed={showRegPassword}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-emerald-300/75 dark:hover:bg-emerald-900/60 dark:hover:text-emerald-50"
                        >
                          {showRegPassword ? (
                            <EyeOff className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="reg-confirm-password"
                        className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100"
                      >
                        Confirm Password
                      </label>
                      <div className="relative mt-1.5">
                        <Lock
                          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-emerald-400/70"
                          aria-hidden="true"
                        />
                        <input
                          id="reg-confirm-password"
                          required
                          name="confirmPassword"
                          type={showRegConfirmPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          minLength={8}
                          aria-invalid={invalidField === 'reg-confirm-password'}
                          placeholder="Re-enter password"
                          value={confirmRegPassword}
                          onChange={(event) => {
                            setConfirmRegPassword(event.target.value);
                            setErrorMessage(null);
                            if (invalidField === 'reg-confirm-password') {
                              setInvalidField(null);
                            }
                          }}
                          className={getFieldClass(
                            'reg-confirm-password',
                            'pl-10 pr-11'
                          )}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowRegConfirmPassword((prev) => !prev)
                          }
                          aria-label={
                            showRegConfirmPassword
                              ? 'Hide confirm password'
                              : 'Show confirm password'
                          }
                          aria-pressed={showRegConfirmPassword}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-emerald-300/75 dark:hover:bg-emerald-900/60 dark:hover:text-emerald-50"
                        >
                          {showRegConfirmPassword ? (
                            <EyeOff className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <PasswordPolicyChecklist
                    password={registration.password}
                    confirmPassword={confirmRegPassword}
                  />

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#064E3B] px-5 py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_2px_6px_-1px_rgba(6,78,59,0.28)] transition-all duration-150 hover:bg-[#053D2E] disabled:cursor-not-allowed disabled:opacity-65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-[#022017] dark:hover:bg-emerald-300 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-[#061D15]"
                  >
                    <span>
                      {isSubmitting
                        ? 'Creating account…'
                        : 'Create Account & Enter Portal'}
                    </span>
                    {!isSubmitting && (
                      <ArrowRight
                        className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </form>
              ) : isSettingNewPassword ? (
                <form
                  onSubmit={handlePasswordRecoverySubmit}
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

                  <div>
                    <label
                      htmlFor="recovery-password"
                      className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100"
                    >
                      New password
                    </label>
                    <div className="relative mt-1.5">
                      <Lock
                        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-emerald-400/70"
                        aria-hidden="true"
                      />
                      <input
                        id="recovery-password"
                        required
                        type={showRecoveryPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        minLength={8}
                        aria-invalid={invalidField === 'recovery-password'}
                        placeholder="Min. 8 characters"
                        value={newPassword}
                        onChange={(event) => {
                          setNewPassword(event.target.value);
                          setErrorMessage(null);
                          if (invalidField === 'recovery-password') {
                            setInvalidField(null);
                          }
                        }}
                        className={getFieldClass(
                          'recovery-password',
                          'pl-10 pr-11'
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRecoveryPassword((prev) => !prev)}
                        aria-label={
                          showRecoveryPassword
                            ? 'Hide new password'
                            : 'Show new password'
                        }
                        aria-pressed={showRecoveryPassword}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-emerald-300/75 dark:hover:bg-emerald-900/60 dark:hover:text-emerald-50"
                      >
                        {showRecoveryPassword ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="recovery-confirm-password"
                      className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100"
                    >
                      Confirm new password
                    </label>
                    <div className="relative mt-1.5">
                      <Lock
                        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-emerald-400/70"
                        aria-hidden="true"
                      />
                      <input
                        id="recovery-confirm-password"
                        required
                        type={showRecoveryConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        minLength={8}
                        aria-invalid={
                          invalidField === 'recovery-confirm-password'
                        }
                        placeholder="Re-enter new password"
                        value={confirmNewPassword}
                        onChange={(event) => {
                          setConfirmNewPassword(event.target.value);
                          setErrorMessage(null);
                          if (invalidField === 'recovery-confirm-password') {
                            setInvalidField(null);
                          }
                        }}
                        className={getFieldClass(
                          'recovery-confirm-password',
                          'pl-10 pr-11'
                        )}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowRecoveryConfirmPassword((prev) => !prev)
                        }
                        aria-label={
                          showRecoveryConfirmPassword
                            ? 'Hide confirm password'
                            : 'Show confirm password'
                        }
                        aria-pressed={showRecoveryConfirmPassword}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-emerald-300/75 dark:hover:bg-emerald-900/60 dark:hover:text-emerald-50"
                      >
                        {showRecoveryConfirmPassword ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  <PasswordPolicyChecklist
                    password={newPassword}
                    confirmPassword={confirmNewPassword}
                  />

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl bg-[#064E3B] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#053D2E] disabled:cursor-wait disabled:opacity-70 dark:bg-emerald-400 dark:text-[#022017] dark:hover:bg-emerald-300"
                  >
                    {isSubmitting ? 'Updating password…' : 'Update Password'}
                  </button>
                </form>
              ) : isForgotPassword ? (
                <form
                  onSubmit={handlePasswordResetRequest}
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

                  <div>
                    <label
                      htmlFor="reset-email"
                      className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100"
                    >
                      Account Email Address
                    </label>
                    <div className="relative mt-1.5">
                      <Mail
                        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-emerald-400/70"
                        aria-hidden="true"
                      />
                      <input
                        id="reset-email"
                        required
                        type="email"
                        autoComplete="email"
                        aria-invalid={invalidField === 'reset-email'}
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          setErrorMessage(null);
                          if (invalidField === 'reset-email') {
                            setInvalidField(null);
                          }
                        }}
                        placeholder="Enter your registered email"
                        className={getFieldClass('reset-email', 'pl-10 pr-3.5')}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex min-h-[46px] w-full items-center justify-center rounded-xl bg-[#064E3B] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#053D2E] disabled:cursor-not-allowed disabled:opacity-65 dark:bg-emerald-400 dark:text-[#022017] dark:hover:bg-emerald-300"
                  >
                    {isSubmitting
                      ? 'Sending recovery link…'
                      : 'Send Password Reset Link'}
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="form-enter mt-7 space-y-5"
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

                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="login-email"
                        className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100"
                      >
                        Email address
                      </label>
                      <div className="relative mt-1.5">
                        <Mail
                          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors dark:text-emerald-400/70"
                          aria-hidden="true"
                        />
                        <input
                          id="login-email"
                          type="email"
                          autoComplete="email"
                          aria-invalid={invalidField === 'login-email'}
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (errorMessage) setErrorMessage(null);
                            if (invalidField === 'login-email') {
                              setInvalidField(null);
                            }
                          }}
                          placeholder="name@baust.edu.bd"
                          className={getFieldClass('login-email', 'pl-10 pr-4')}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="login-password"
                          className="block text-[13px] font-medium text-slate-800 dark:text-emerald-100"
                        >
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => switchAuthMode('forgot')}
                          className="text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-300"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative mt-1.5">
                        <Lock
                          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors dark:text-emerald-400/70"
                          aria-hidden="true"
                        />
                        <input
                          id="login-password"
                          type={showSignInPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          aria-invalid={invalidField === 'login-password'}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (errorMessage) setErrorMessage(null);
                            if (invalidField === 'login-password') {
                              setInvalidField(null);
                            }
                          }}
                          placeholder="Enter your password"
                          className={getFieldClass(
                            'login-password',
                            'pl-10 pr-12'
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignInPassword((prev) => !prev)}
                          aria-label={
                            showSignInPassword
                              ? 'Hide password'
                              : 'Show password'
                          }
                          aria-pressed={showSignInPassword}
                          title={
                            showSignInPassword
                              ? 'Hide password'
                              : 'Show password'
                          }
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:text-emerald-300/75 dark:hover:bg-emerald-900/60 dark:hover:text-emerald-50"
                        >
                          {showSignInPassword ? (
                            <EyeOff className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-0.5">
                    <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-2.5 select-none">
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
                            <Check className="h-3 w-3 stroke-[3] text-white dark:text-[#022017]" />
                          )}
                        </span>
                      </span>
                      <span className="text-[13px] font-medium text-slate-700 dark:text-emerald-100/85">
                        Keep me signed in on this device
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group relative inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#064E3B] px-5 py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_2px_6px_-1px_rgba(6,78,59,0.28)] transition-all duration-150 ease-out hover:-translate-y-[1px] hover:bg-[#053D2E] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_10px_24px_-6px_rgba(6,78,59,0.42)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 dark:bg-emerald-400 dark:text-[#022017] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_8px_-1px_rgba(0,0,0,0.4)] dark:hover:bg-emerald-300 dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_10px_24px_-6px_rgba(52,211,153,0.35)] dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-[#061D15] whitespace-nowrap"
                  >
                    <span>{isSubmitting ? 'Signing in…' : 'Sign In to Portal'}</span>
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </button>
                </form>
              )}
            </div>

            <footer className="mx-auto mt-10 w-full max-w-[440px] border-t border-slate-200/70 pt-5 text-xs leading-relaxed text-slate-500 sm:mt-12 dark:border-emerald-800/50 dark:text-emerald-300/65">
              Authorized access for BAUST CSE Fest super admins, organizers, judges, volunteers, and registered participants.
            </footer>
          </section>
        </div>
      </div>
    </main>
  );
}
