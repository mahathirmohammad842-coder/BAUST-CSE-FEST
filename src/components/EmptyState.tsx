import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-emerald-200 bg-white px-6 py-14 text-center dark:border-emerald-800/70 dark:bg-[#061D15]">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="mt-4 font-display text-base font-semibold text-emerald-950 dark:text-emerald-50">
        {title}
      </h3>
      <p className="mt-1.5 max-w-md text-sm text-emerald-900/65 dark:text-emerald-200/75">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 whitespace-nowrap"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
