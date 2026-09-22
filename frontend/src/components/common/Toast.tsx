import { useEffect } from 'react';
import { X } from 'lucide-react';

/** How long a success toast stays before dismissing itself. Error toasts never auto-dismiss — a kiosk failure must be seen. */
export const SUCCESS_TOAST_MS = 2500;

type ToastProps = {
    tone: 'success' | 'error';
    message: string;
    /** Must be referentially stable (App wraps it in useCallback): it is an effect dependency, and a new identity re-arms the success timer. */
    onDismiss: () => void;
};

export default function Toast({ tone, message, onDismiss }: ToastProps) {
    useEffect(() => {
        if (tone !== 'success') return;
        const timer = setTimeout(onDismiss, SUCCESS_TOAST_MS);
        return () => clearTimeout(timer);
    }, [tone, onDismiss]);

    // F21: the outer frame is a full-width (inset-x-4), click-through
    // (pointer-events-none) fixed strip that centres the pill (flex
    // justify-center). The success pill inherits the click-through so the
    // 2.5 s green pill never swallows a Save/Cancel tap, while the error pill
    // and its ✕ are pointer-events-auto — a tap anywhere on the error pill
    // dismisses it instead of falling through to whatever is beneath (a modal
    // backdrop would otherwise cancel the form). Long messages truncate with an
    // ellipsis at the frame's width (min-w-0 on pill and span — flex items
    // otherwise refuse to shrink below their content). bottom-40 (10 rem) =
    // the deck's ~5 rem footprint + its 4 rem -top-16 frosted overhang, the
    // same number scroll-pb-40 declares on the scroll region (Standing
    // invariant 12). z-[80] keeps it above the z-50 modals but under
    // TouchLockOverlay z-[90] and ScreenBlankOverlay z-[100]. Positioned
    // against the viewport, never inside .overflow-y-auto.
    return (
        <div className="pointer-events-none fixed inset-x-4 bottom-40 z-[80] flex justify-center">
            <div
                role="status"
                aria-live="polite"
                data-testid="toast"
                data-tone={tone}
                onClick={tone === 'error' ? onDismiss : undefined}
                className={`max-w-full min-w-0 flex items-center gap-3 rounded-full px-5 py-3 text-sm text-white shadow-lg ${tone === 'success' ? 'bg-green-600' : 'bg-red-700'} ${tone === 'error' ? 'pointer-events-auto cursor-pointer' : ''}`}
            >
                <span className="min-w-0 truncate">{message}</span>
                {tone === 'error' && (
                    <button
                        type="button"
                        onClick={event => {
                            event.stopPropagation();
                            onDismiss();
                        }}
                        aria-label="Dismiss"
                        className="pointer-events-auto -mr-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full hover:bg-red-800"
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                )}
            </div>
        </div>
    );
}
