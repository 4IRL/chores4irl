import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export type ToastState = { id: number; tone: 'success' | 'error' | 'neutral'; message: string };

type ToastProps = {
  toast: ToastState | null;
  onDismiss: () => void;
};

const toneClasses = {
  success: 'bg-green-900 text-green-100',
  error: 'bg-red-900 text-red-100',
  neutral: 'bg-gray-700 text-gray-100',
};

const AUTO_DISMISS_MS = { success: 4000, neutral: 6000 } as const;

export default function Toast({ toast, onDismiss }: ToastProps) {
  const id = toast?.id;
  const tone = toast?.tone;

  // Latest callback via ref so the timer stays keyed on the toast id only
  // (a new toast restarts it) without calling a stale closure.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (id === undefined || tone === undefined || tone === 'error') return;
    const timer = setTimeout(() => onDismissRef.current(), AUTO_DISMISS_MS[tone]);
    return () => clearTimeout(timer);
  }, [id, tone]);

  const card = toast && (
    <div
      key={toast.id}
      data-testid="feedback-toast"
      data-tone={toast.tone}
      className={`pointer-events-auto animate-toast-in motion-reduce:animate-none flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm shadow-lg ${toneClasses[toast.tone]}`}
    >
      <span>{toast.message}</span>
      {toast.tone === 'error' && (
        <button
          type="button"
          data-testid="feedback-toast-dismiss"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-400"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );

  return createPortal(
    <div className="pointer-events-none fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-sm">
      <div aria-live="polite">{toast && toast.tone !== 'error' ? card : null}</div>
      <div role="alert">{toast && toast.tone === 'error' ? card : null}</div>
    </div>,
    document.body,
  );
}
