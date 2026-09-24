import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LockKeyhole, LockKeyholeOpen } from 'lucide-react';

export const SECOND_TAP_WINDOW_MS = 1500;
export const SECOND_TAP_MAX_DISTANCE_PX = 60;
// Imported by App.tsx, which (F20) keeps this component mounted through its
// 'opening' animation by holding `lockAttempt` for CLOSING_SETTLE_MS after
// onArm(), and paces the fade-out's onDismiss below. It stays numerically in
// sync with this component's CSS transition durations: if this value ever
// changes, the `duration-[400ms]` classes on the root (fade) and on the centered
// padlock must be updated by hand in the same edit.
export const CLOSING_SETTLE_MS = 400;

// F20: the viewport point of a guarded attempt (a blocked tap/swipe on a chore bar),
// which seeds the overlay as the first tap of the unlock double-tap.
export type TapPoint = { x: number; y: number };
type FirstTap = TapPoint & { at: number };

type TouchLockOverlayProps = {
    firstTap: TapPoint;
    onArm: () => void;
    onDismiss: () => void;
};

type Phase = 'awaiting-second-tap' | 'opening' | 'dismissing';

// F20: mounted by App only on a guarded attempt, and the attempt is the first tap
// of the unlock double-tap — so it starts in 'awaiting-second-tap' with no
// entrance animation. With no qualifying tap it fades out ('dismissing') after
// SECOND_TAP_WINDOW_MS and asks App to unmount it via onDismiss.
export default function TouchLockOverlay({ firstTap, onArm, onDismiss }: TouchLockOverlayProps) {
    const [phase, setPhase] = useState<Phase>('awaiting-second-tap');
    const firstTapRef = useRef<FirstTap | null>({ ...firstTap, at: Date.now() });
    const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    const clearPendingPhaseTimer = () => {
        if (phaseTimerRef.current !== null) clearTimeout(phaseTimerRef.current);
    };

    // DD-2: (re)starts the second-tap window. When it elapses the root fades out
    // and stops catching taps, then onDismiss fires CLOSING_SETTLE_MS later. Both
    // timers go through phaseTimerRef, so a single clear cancels whichever is
    // pending.
    const scheduleDismiss = () => {
        clearPendingPhaseTimer();
        phaseTimerRef.current = setTimeout(() => {
            setPhase('dismissing');
            phaseTimerRef.current = setTimeout(onDismiss, CLOSING_SETTLE_MS);
        }, SECOND_TAP_WINDOW_MS);
    };

    // Mount: capture the overlay node and the previously focused element, focus
    // the overlay (keeping the keyboard unlock path), and start the window
    // (DD-2). On unmount, clear the pending timer and hand focus back (DD-6) —
    // but only if focus is still on the overlay or nowhere, so focus the user
    // moved elsewhere meanwhile is never stolen back (DD-15). On a real unmount
    // React has already removed the node (focus sits on body); `active === node`
    // covers StrictMode's simulated cleanup, where the node is still focused.
    useEffect(() => {
        const node = overlayRef.current;
        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        node?.focus({ preventScroll: true });
        scheduleDismiss();
        return () => {
            clearPendingPhaseTimer();
            const active = document.activeElement;
            if ((active === null || active === document.body || active === node) && previouslyFocused?.isConnected) {
                previouslyFocused.focus({ preventScroll: true });
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const registerTap = (tapX: number, tapY: number) => {
        // Once a qualifying second tap has fired, onArm() has already been
        // called and this component's job is done — App.tsx is the only thing
        // that decides when it unmounts. The root stays hit-testable during
        // 'opening' (DD-21), so this early return is what swallows both taps and
        // key presses landing in the CLOSING_SETTLE_MS grace window; otherwise
        // they would regress phase and could re-invoke onArm(). During
        // 'dismissing' the root is pointer-events-none, and keys reaching the
        // still-focused overlay are ignored the same way.
        if (phase === 'opening' || phase === 'dismissing') return;

        const seed = firstTapRef.current;
        const qualifies =
            seed !== null &&
            Date.now() - seed.at <= SECOND_TAP_WINDOW_MS &&
            Math.hypot(tapX - seed.x, tapY - seed.y) <= SECOND_TAP_MAX_DISTANCE_PX;

        if (qualifies) {
            clearPendingPhaseTimer();
            firstTapRef.current = null;
            setPhase('opening');
            // Under F20, App keeps this component mounted through the 'opening'
            // animation by holding `lockAttempt` for CLOSING_SETTLE_MS after
            // onArm() — this component schedules no further phase change,
            // fade or onDismiss of its own after arming.
            onArm();
            return;
        }

        // A far tap becomes the new first tap and restarts the window (DD-1).
        // firstTapRef is never nulled by a timer; a tap at or after
        // SECOND_TAP_WINDOW_MS is ignored because the fade timer has already
        // moved the phase to 'dismissing' (the Date.now() window check above is
        // a belt-and-braces guard).
        firstTapRef.current = { x: tapX, y: tapY, at: Date.now() };
        scheduleDismiss();
    };

    const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
        registerTap(event.clientX, event.clientY);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
            event.preventDefault();
            // Keyboard activation has no meaningful position — using a fixed
            // (0, 0) for both taps means two keyboard activations are always
            // "close enough" to each other (a keyboard-raised attempt is seeded
            // at (0, 0) too).
            registerTap(0, 0);
        }
    };

    const isOpening = phase === 'opening';

    return createPortal(
        <div
            ref={overlayRef}
            className={`fixed inset-0 z-[90] transition-opacity duration-[400ms] ${phase === 'dismissing' ? 'opacity-0 pointer-events-none' : ''}`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="button"
            aria-label="Tap twice to unlock"
            data-testid="touch-lock-overlay"
        >
            <div
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-[400ms] scale-100 opacity-100"
                data-testid="touch-lock-padlock-centered"
            >
                {isOpening ? (
                    <LockKeyholeOpen
                        className="w-16 h-16 text-white"
                        data-testid="touch-lock-icon-open"
                    />
                ) : (
                    <LockKeyhole
                        className="w-16 h-16 text-white"
                        data-testid="touch-lock-icon-closed"
                    />
                )}
            </div>
        </div>,
        document.body,
    );
}
