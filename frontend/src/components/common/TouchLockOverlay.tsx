import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LockKeyhole, LockKeyholeOpen } from 'lucide-react';

export const SECOND_TAP_WINDOW_MS = 1500;
export const SECOND_TAP_MAX_DISTANCE_PX = 60;
// Imported by App.tsx (Step 4) so its own isClosing unmount-delay timer stays
// numerically in sync with this component's 'opening'-phase CSS transition
// duration below. If this value ever changes, the `duration-[400ms]` class on
// the centered padlock must be updated by hand in the same edit.
export const CLOSING_SETTLE_MS = 400;

type TouchLockOverlayProps = {
    onArm: () => void;
    justRelocked?: boolean;
};

type Phase = 'just-relocked' | 'idle' | 'awaiting-second-tap' | 'opening';

type FirstTap = { x: number; y: number; at: number };

export default function TouchLockOverlay({ onArm, justRelocked = false }: TouchLockOverlayProps) {
    const [phase, setPhase] = useState<Phase>(justRelocked ? 'just-relocked' : 'idle');
    const firstTapRef = useRef<FirstTap | null>(null);
    const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearPendingPhaseTimer = () => {
        if (phaseTimerRef.current !== null) clearTimeout(phaseTimerRef.current);
    };

    // Entrance animation hand-off: mask the one-commit gap before App.tsx's
    // isLocked-driven dialog-close effect runs by briefly showing a centered
    // closed padlock + backdrop, then settling to 'idle'. Also clears the
    // timer on unmount.
    useEffect(() => {
        if (justRelocked) {
            phaseTimerRef.current = setTimeout(() => {
                setPhase('idle');
            }, 600);
        }
        return clearPendingPhaseTimer;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const registerTap = (tapX: number, tapY: number) => {
        // Once a qualifying second tap has fired, onArm() has already been
        // called and this component's job is done — App.tsx (Step 4) is the
        // only thing that decides when it unmounts. Ignore further taps/key
        // presses that land during the CLOSING_SETTLE_MS grace window so
        // pointer-events-none's effect can't be circumvented via keyboard,
        // which would otherwise regress phase and could re-invoke onArm().
        if (phase === 'opening') return;

        const firstTap = firstTapRef.current;
        const qualifies =
            firstTap !== null &&
            Date.now() - firstTap.at <= SECOND_TAP_WINDOW_MS &&
            Math.hypot(tapX - firstTap.x, tapY - firstTap.y) <= SECOND_TAP_MAX_DISTANCE_PX;

        if (qualifies) {
            clearPendingPhaseTimer();
            firstTapRef.current = null;
            setPhase('opening');
            // App.tsx (Step 4) owns keeping this component mounted long enough
            // for the 'opening' phase's shrink transition to finish via its own
            // isClosing state — this component does not schedule any further
            // phase change or unmount timing of its own after calling onArm().
            onArm();
            return;
        }

        firstTapRef.current = { x: tapX, y: tapY, at: Date.now() };
        setPhase('awaiting-second-tap');
        clearPendingPhaseTimer();
        // This shrink-back timeout only reverts the visual phase — it must NOT
        // also null firstTapRef.current. Staleness has a single source of
        // truth: the elapsed-time check inside registerTap itself. Nulling the
        // ref here would race with (and defeat) a tap arriving at exactly
        // SECOND_TAP_WINDOW_MS later, since fake-timer advances fire timers
        // due at or before the advanced time inclusively.
        phaseTimerRef.current = setTimeout(() => {
            setPhase('idle');
        }, SECOND_TAP_WINDOW_MS);
    };

    const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
        registerTap(event.clientX, event.clientY);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
            event.preventDefault();
            // Keyboard activation has no meaningful position — using a fixed
            // (0, 0) for both taps means two keyboard activations are always
            // "close enough" to each other.
            registerTap(0, 0);
        }
    };

    const showCenteredPadlock = phase !== 'idle';
    const isOpening = phase === 'opening';

    return createPortal(
        <div
            className={`fixed inset-0 z-[90] ${isOpening ? 'pointer-events-none' : ''}`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="button"
            aria-label="Tap twice to unlock"
            data-testid="touch-lock-overlay"
        >
            {phase === 'just-relocked' && (
                <div
                    className="fixed inset-0 bg-black/40 transition-opacity duration-300"
                    data-testid="touch-lock-backdrop"
                />
            )}
            {showCenteredPadlock && (
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
            )}
        </div>,
        document.body,
    );
}
