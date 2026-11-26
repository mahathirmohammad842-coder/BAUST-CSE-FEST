import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileEdit,
  XCircle,
} from 'lucide-react';
import type { DeliveryStatus, NotificationPriority, UserRole } from '../types';

interface PriorityBadgeProps {
  priority: NotificationPriority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  switch (priority) {
    case 'Emergency':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-0.5 text-xs font-semibold text-white whitespace-nowrap shrink-0">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          Emergency
        </span>
      );
    case 'High':
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:border-amber-700/70 dark:bg-amber-950/60 dark:text-amber-300 whitespace-nowrap shrink-0">
          High Priority
        </span>
      );
    case 'Normal':
      return (
        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-emerald-800/70 dark:bg-[#09291E] dark:text-emerald-200 whitespace-nowrap shrink-0">
          Normal
        </span>
      );
    case 'Low':
      return (
        <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-500 dark:border-emerald-800/60 dark:bg-[#041811] dark:text-emerald-300/75 whitespace-nowrap shrink-0">
          Low
        </span>
      );
  }
}

interface StatusBadgeProps {
  status: DeliveryStatus | 'Retried';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case 'Delivered':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          Delivered
        </span>
      );
    case 'Retried':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          Retried · Sent
        </span>
      );
    case 'Scheduled':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap shrink-0">
          <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          Scheduled
        </span>
      );
    case 'Pending':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-400 whitespace-nowrap shrink-0">
          <Clock className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          Pending
        </span>
      );
    case 'Failed':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400 whitespace-nowrap shrink-0">
          <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" aria-hidden="true" />
          Failed
        </span>
      );
    case 'Draft':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-emerald-300/75 whitespace-nowrap shrink-0">
          <FileEdit className="h-3.5 w-3.5 text-slate-500 dark:text-emerald-400/70" aria-hidden="true" />
          Draft
        </span>
      );
  }
}

interface RoleBadgeProps {
  role: UserRole;
  inverse?: boolean;
}

export function RoleBadge({ role, inverse = false }: RoleBadgeProps) {
  if (inverse) {
    return (
      <span className="inline-flex items-center rounded-md border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-xs font-medium text-emerald-300 whitespace-nowrap shrink-0">
        {role}
      </span>
    );
  }

  const toneMap: Record<UserRole, string> = {
    Admin: 'border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-100',
    'Super Admin': 'border-violet-300 bg-violet-100 text-violet-950 dark:border-violet-700 dark:bg-violet-900/60 dark:text-violet-100',
    Organizer: 'border-emerald-900 bg-[#064E3B] text-white dark:border-emerald-700 dark:bg-emerald-700 dark:text-white',
    Participant: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-200',
    Volunteer: 'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-800/70 dark:bg-teal-950/60 dark:text-teal-200',
    Judge: 'border-green-200 bg-green-50 text-green-800 dark:border-green-800/70 dark:bg-green-950/60 dark:text-green-200',
    Guest: 'border-emerald-200/80 bg-emerald-50/50 text-emerald-900 dark:border-emerald-800/60 dark:bg-[#09291E] dark:text-emerald-200',
    Sponsor: 'border-lime-200 bg-lime-50 text-lime-900 dark:border-lime-800/70 dark:bg-lime-950/60 dark:text-lime-200',
    Mentor: 'border-teal-200 bg-teal-100/60 text-teal-900 dark:border-teal-800/70 dark:bg-teal-950/50 dark:text-teal-200',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${toneMap[role]}`}
    >
      {role}
    </span>
  );
}

interface GenericBadgeProps {
  children: ReactNode;
  variant?: 'neutral' | 'amber' | 'danger' | 'success';
}

export function Badge({ children, variant = 'neutral' }: GenericBadgeProps) {
  const styles = {
    neutral: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-emerald-800/70 dark:bg-[#09291E] dark:text-emerald-200',
    amber: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700/70 dark:bg-amber-950/60 dark:text-amber-300',
    danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-300',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-300',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${styles[variant]}`}
    >
      {children}
    </span>
  );
}
