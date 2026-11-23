import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
  dangerHeader?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidthClass = 'max-w-lg',
  dangerHeader = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#02160F]/65 p-4 backdrop-blur-[2px] dark:bg-black/75"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidthClass} rounded-xl border border-emerald-200/80 bg-white shadow-xl overflow-hidden dark:border-emerald-800/70 dark:bg-[#061D15]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-start justify-between gap-4 border-b px-6 py-4 ${
            dangerHeader
              ? 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/50'
              : 'border-emerald-100 bg-white dark:border-emerald-800/60 dark:bg-[#061D15]'
          }`}
        >
          <div className="min-w-0">
            <h2
              id="modal-title"
              className={`font-display text-lg font-bold ${
                dangerHeader ? 'text-red-900 dark:text-red-200' : 'text-emerald-950 dark:text-emerald-50'
              }`}
            >
              {title}
            </h2>
            {subtitle && (
              <p
                className={`mt-1 text-xs ${
                  dangerHeader ? 'text-red-700 dark:text-red-300' : 'text-emerald-900/65 dark:text-emerald-200/75'
                }`}
              >
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-emerald-800/60 hover:bg-emerald-50 hover:text-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-emerald-300/70 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-50 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 text-emerald-950 dark:text-emerald-50">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-emerald-100 bg-emerald-50/40 px-6 py-3.5 dark:border-emerald-800/60 dark:bg-[#041811]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
