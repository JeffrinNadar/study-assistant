import { useEffect, useRef, useCallback } from 'react';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Focus the cancel button when dialog opens
  useEffect(() => {
    cancelBtnRef.current?.focus();
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Trap focus within the dialog
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
      ref={dialogRef}
    >
      <div
        className="bg-cream border border-ruled rounded-lg shadow-xl max-w-sm w-full mx-4 p-6 rotate-[0.5deg] dark:bg-chalk-bg dark:border-chalk-muted"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="font-hand text-xl text-charcoal dark:text-chalk-text mb-2">{title}</h2>
        <p id="confirm-dialog-message" className="text-sm text-charcoal-light dark:text-chalk-muted mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelBtnRef}
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-md border border-ruled text-charcoal hover:bg-kraft dark:border-chalk-muted dark:text-chalk-text dark:hover:bg-chalk-bg-light"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
