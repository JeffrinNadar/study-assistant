interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="bg-cream border border-ruled rounded-lg shadow-xl max-w-sm w-full mx-4 p-6 rotate-[0.5deg] dark:bg-chalk-bg dark:border-chalk-muted"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-hand text-xl text-charcoal dark:text-chalk-text mb-2">{title}</h3>
        <p className="text-sm text-charcoal-light dark:text-chalk-muted mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
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
