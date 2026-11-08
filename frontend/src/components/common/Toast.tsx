import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export type ToastAction = {
  label: 'Undo' | 'Redo';
  testId: 'feedback-toast-undo' | 'feedback-toast-redo';
  onClick: () => void;
};

export type ToastState = {
  id: number;
  tone: 'success' | 'error' | 'neutral';
  message: string;
  action?: ToastAction;
};

type ToastProps = {
  toast: ToastState | null;
  onDismiss: () => void;
  /** A modal is open: freezes the interval and the cap and disables the buttons (action toasts only). */
  paused?: boolean;
  /** An Undo/Redo request is in flight: freezes the interval only (bounded by the cap). */
  holding?: boolean;
};

const toneClasses = {
  success: 'bg-green-900 text-green-100',
  error: 'bg-red-900 text-red-100',
  neutral: 'bg-gray-700 text-gray-100',
};

const actionHoverClasses = {
  success: 'hover:bg-green-800',
  error: 'hover:bg-red-800',
  neutral: 'hover:bg-gray-600',
};

const AUTO_DISMISS_MS = { success: 4000, neutral: 6000 } as const;
const ACTION_DISMISS_MS = 8000;
const ACTION_MAX_VISIBLE_MS = 30000;

const SHORTCUT_HINT = {
  Undo: 'Press Ctrl+Z to undo',
  Redo: 'Press Ctrl+Shift+Z to redo',
} as const;

type Interaction = { epoch: string; hover: boolean; focus: boolean };

function matchesHover(el: HTMLElement | null): boolean {
  try {
    return el?.matches(':hover') ?? false;
  } catch {
    return false;
  }
}

export default function Toast({ toast, onDismiss, paused = false, holding = false }: ToastProps) {
  const id = toast?.id;
  const tone = toast?.tone;
  const hasAction = toast?.action !== undefined;

  const [interaction, setInteraction] = useState<Interaction>({
    epoch: '',
    hover: false,
    focus: false,
  });
  const [hidden, setHidden] = useState(() => document.hidden);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Latest callback via ref so the timers stay keyed on the toast id only
  // (a new toast restarts them) without calling a stale closure.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // A new toast starts unpaused, except a card that appears under a resting pointer
  // (no pointerenter fires then). Checked in an effect because jsdom has no :hover.
  // Hover/focus state is tagged with an epoch (toast id, action present, modal paused), so it
  // is dropped when the toast changes, loses its action, or a modal disables its buttons
  // (a disabled button fires no blur, so focus would otherwise stay "held").
  const epoch = `${id}|${hasAction}|${paused}`;
  useEffect(() => {
    if (id === undefined || !hasAction) return;
    if (matchesHover(cardRef.current)) {
      setInteraction({ epoch, hover: true, focus: false });
    }
    // Runs when the toast (or its action) appears, not on pause changes; epoch is read on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, hasAction]);

  let current = interaction;
  if (interaction.epoch !== epoch) {
    // Reset during render (React's derived-state pattern) so an old epoch can never come back.
    current = { epoch, hover: false, focus: false };
    setInteraction(current);
  }
  const engaged = hasAction && (current.hover || current.focus);
  const frozenAll = hasAction && (paused || hidden);
  const frozenInterval = frozenAll || engaged || (hasAction && holding);

  useEffect(() => {
    if (id === undefined || tone === undefined || tone === 'error') return;
    if (frozenInterval) return;
    const ms = hasAction ? ACTION_DISMISS_MS : AUTO_DISMISS_MS[tone];
    const timer = setTimeout(() => onDismissRef.current(), ms);
    return () => clearTimeout(timer);
  }, [id, tone, hasAction, frozenInterval]);

  useEffect(() => {
    if (id === undefined || tone === undefined || tone === 'error') return;
    if (!hasAction || frozenAll) return;
    const cap = setTimeout(() => onDismissRef.current(), ACTION_MAX_VISIBLE_MS);
    return () => clearTimeout(cap);
  }, [id, tone, hasAction, frozenAll]);

  const action = toast?.action;
  const showDismiss = toast !== null && (toast.tone === 'error' || hasAction);
  const buttonsDisabled = hasAction && paused;

  const card = toast && (
    <div
      key={toast.id}
      ref={cardRef}
      data-testid="feedback-toast"
      data-tone={toast.tone}
      onPointerEnter={() => setInteraction({ ...current, hover: true })}
      onPointerLeave={() => setInteraction({ ...current, hover: false })}
      onFocus={() => setInteraction({ ...current, focus: true })}
      onBlur={(e) => {
        if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
        setInteraction({ ...current, focus: false });
      }}
      className={`pointer-events-auto animate-toast-in motion-reduce:animate-none flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm shadow-lg ${toneClasses[toast.tone]}`}
    >
      <span>{toast.message}</span>
      {action && (
        <>
          <button
            type="button"
            data-testid={action.testId}
            onClick={action.onClick}
            disabled={buttonsDisabled}
            aria-disabled={!buttonsDisabled && holding ? true : undefined}
            className={`ml-auto min-h-[44px] min-w-[44px] shrink-0 rounded-lg px-2 font-semibold underline focus-visible:outline-2 focus-visible:outline-indigo-400 ${actionHoverClasses[toast.tone]}`}
          >
            {action.label}
          </button>
          <span className="sr-only">{SHORTCUT_HINT[action.label]}</span>
        </>
      )}
      {showDismiss && (
        <button
          type="button"
          data-testid="feedback-toast-dismiss"
          aria-label="Dismiss"
          onClick={onDismiss}
          disabled={buttonsDisabled}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-400"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );

  return createPortal(
    <div className="pointer-events-none fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-sm">
      <div aria-live="polite">{toast && toast.tone !== 'error' ? card : null}</div>
      <div role="alert">{toast && toast.tone === 'error' ? card : null}</div>
    </div>,
    document.body,
  );
}
