import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  icon: LucideIcon;
  tone?: 'default' | 'success' | 'amber' | 'danger';
}

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = 'default',
}: StatCardProps) {
  const iconWrapClass = {
    default: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400',
    success: 'bg-emerald-100/70 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
    amber: 'bg-teal-50 text-teal-700 dark:bg-teal-950/70 dark:text-teal-300',
    danger: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400',
  }[tone];

  const valueClass = {
    default: 'text-emerald-950 dark:text-emerald-50',
    success: 'text-emerald-950 dark:text-emerald-50',
    amber: 'text-emerald-950 dark:text-emerald-50',
    danger: 'text-red-700 dark:text-red-400',
  }[tone];

  return (
    <div className="rounded-xl border border-emerald-200/70 bg-white p-4 transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_8px_24px_-16px_rgba(6,78,59,0.42)] motion-reduce:transform-none dark:border-emerald-800/60 dark:bg-[#061D15] dark:hover:border-emerald-700">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-emerald-900/65 dark:text-emerald-200/75 truncate">{label}</span>
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${iconWrapClass}`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
      <div className={`mt-2 font-display text-xl font-bold tracking-tight tabular-nums ${valueClass}`}>
        {value}
      </div>
      {sublabel && (
        <p className="mt-1 text-[11px] text-emerald-900/55 dark:text-emerald-300/65 truncate">{sublabel}</p>
      )}
    </div>
  );
}
