import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LockKeyhole, LockKeyholeOpen } from 'lucide-react';

export const SECOND_TAP_WINDOW_MS = 1500;
export const SECOND_TAP_MAX_DISTANCE_PX = 60;
// Imported by App.tsx, which (F20) keeps this component mounted through its
// 'opening' animation by holding `lockAttempt` for CLOSING_SETTLE_MS after
// onArm(), and paces the fade-out's onDismiss below. It stays numerically in
// sync with this component's CSS transition durations: if this value ever
// changes, the `duration-[400ms]` classes on the root (fade) and on the hit
// circle (ring colour) must be updated by hand in the same edit.
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

// F20 (post-PR amendment 2026-09-24): the hit circle's radius is the qualifying
// distance itself, so "inside the circle" and "close enough" are the same test.
const HIT_RADIUS_PX = SECOND_TAP_MAX_DISTANCE_PX;

// Keeps the whole circle (and the padlock centred in it) on-screen. A pointer
// seed is always on-screen, so this only moves the circle when the tap was
// within HIT_RADIUS_PX of an edge; a keyboard seed is (0, 0), so its circle sits
// in the top-left corner (under the raised z-[95] indicator, which still wins
// the overlap — DD-22). On a viewport narrower or shorter than 2 × HIT_RADIUS_PX
// (120 px) the centre pins to HIT_RADIUS_PX and the circle overflows that axis.
const clampToViewport = (value: number, viewportSize: number) =>
    Math.min(Math.max(value, HIT_RADIUS_PX), Math.max(HIT_RADIUS_PX, viewportSize - HIT_RADIUS_PX));

// F20: mounted by App only on a guarded attempt, and the attempt is the first tap
// of the unlock double-tap — so it starts in 'awaiting-second-tap' with no
// entrance animation. With no qualifying tap it fades out ('dismissing') after
// SECOND_TAP_WINDOW_MS and asks App to unmount it via onDismiss.
//
// Non-blocking (post-PR amendment 2026-09-24, superseding DD-1): the full-viewport
// root is pointer-events-none in every phase, so the board stays usable while the
// padlock shows — scrolling (incl. touch-drag), room tabs, day arrows, search and
// Add Task all work, and a tap on another chore bar is simply a new guarded
// attempt (App re-keys this overlay). The only hit-testable element is a
// HIT_RADIUS_PX circle around the seed with the padlock drawn in it, so the user
// sees where the second tap goes. The root still takes keyboard focus
// (pointer-events never affects keys), keeping the Enter/Space unlock path.
export default function TouchLockOverlay({ firstTap, onArm, onDismiss }: TouchLockOverlayProps) {
    const [phase, setPhase] = useState<Phase>('awaiting-second-tap');
    const firstTapRef = useRef<FirstTap | null>({ ...firstTap, at: Date.now() });
    const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    // F20 (push review 3): the clamp reads the viewport size from state, not at
    // render time, so a resize (e.g. a kiosk rotation) while the padlock shows
    // re-renders the circle and re-clamps it on-screen.
    const [viewportSize, setViewportSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));

    const clearPendingPhaseTimer = () => {
        if (phaseTimerRef.current !== null) clearTimeout(phaseTimerRef.current);
    };

    // Mount: capture the overlay node and the previously focused element, focus
    // the overlay (keeping the keyboard unlock path), and start the second-tap
    // window (DD-2): when it elapses the overlay fades out and its hit circle
    // stops catching taps, then onDismiss fires CLOSING_SETTLE_MS later. Both
    // timers go through phaseTimerRef, so a single clear cancels whichever is
    // pending. On unmount, clear the pending timer and hand focus back (DD-6) —
    // but only if focus is still on the overlay or nowhere, so focus the user
    // moved elsewhere meanwhile (e.g. by tapping the search box or a room tab
    // through the non-blocking root) is never stolen back (DD-15). On a real
    // unmount React has already removed the node (focus sits on body);
    // `active === node` covers StrictMode's simulated cleanup, where the node is
    // still focused.
    useEffect(() => {
        const node = overlayRef.current;
        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        node?.focus({ preventScroll: true });
        phaseTimerRef.current = setTimeout(() => {
            setPhase('dismissing');
            phaseTimerRef.current = setTimeout(onDismiss, CLOSING_SETTLE_MS);
        }, SECOND_TAP_WINDOW_MS);
        return () => {
            clearPendingPhaseTimer();
            const active = document.activeElement;
            if ((active === null || active === document.body || active === node) && previouslyFocused?.isConnected) {
                previouslyFocused.focus({ preventScroll: true });
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const handleResize = () => setViewportSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const hitCenter: TapPoint = {
        x: clampToViewport(firstTap.x, viewportSize.width),
        y: clampToViewport(firstTap.y, viewportSize.height),
    };

    // `anchor` is what the tap is measured against: the hit circle's centre for a
    // pointer tap (so this check agrees with the circle's own geometry even when
    // clamping moved it off the seed), the raw seed for a keyboard press (so a
    // keyboard-raised (0, 0) attempt qualifies and a pointer-raised one does not).
    const registerTap = (tapX: number, tapY: number, anchor: TapPoint) => {
        // Once a qualifying second tap has fired, onArm() has already been
        // called and this component's job is done — App.tsx is the only thing
        // that decides when it unmounts. The hit circle stays hit-testable during
        // 'opening' (DD-21), so this early return is what swallows both taps and
        // key presses landing in the CLOSING_SETTLE_MS grace window; otherwise
        // they could re-invoke onArm(). During 'dismissing' the circle is
        // pointer-events-none, and keys reaching the still-focused overlay are
        // ignored the same way.
        if (phase === 'opening' || phase === 'dismissing') return;

        // Belt-and-braces: a click can only reach the circle within
        // HIT_RADIUS_PX of its centre and before the fade timer moved the phase
        // to 'dismissing', but the distance/time check is kept explicit.
        const seed = firstTapRef.current;
        const qualifies =
            seed !== null &&
            Date.now() - seed.at <= SECOND_TAP_WINDOW_MS &&
            Math.hypot(tapX - anchor.x, tapY - anchor.y) <= SECOND_TAP_MAX_DISTANCE_PX;

        // A non-qualifying press is ignored: it neither re-seeds nor restarts
        // the window (the post-PR amendment supersedes DD-1's far-tap re-seed —
        // far pointer taps never reach this component now).
        if (!qualifies) return;

        clearPendingPhaseTimer();
        firstTapRef.current = null;
        setPhase('opening');
        // Under F20, App keeps this component mounted through the 'opening'
        // animation by holding `lockAttempt` for CLOSING_SETTLE_MS after
        // onArm() — this component schedules no further phase change, fade or
        // onDismiss of its own after arming.
        onArm();
    };

    const handleHitAreaClick = (event: React.MouseEvent<HTMLDivElement>) => {
        registerTap(event.clientX, event.clientY, hitCenter);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
            event.preventDefault();
            // Keyboard activation has no meaningful position — registering a
            // fixed (0, 0) against the seed means a keyboard-raised attempt
            // (seeded at (0, 0) too) is always "close enough".
            registerTap(0, 0, firstTap);
        }
    };

    const isOpening = phase === 'opening';
    const isDismissing = phase === 'dismissing';

    return createPortal(
        <div
            ref={overlayRef}
            className={`fixed inset-0 z-[90] pointer-events-none transition-opacity duration-[400ms] ${isDismissing ? 'opacity-0' : ''}`}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="button"
            aria-label="Tap twice to unlock"
            data-testid="touch-lock-overlay"
        >
            {/* DD-21: hit-testable in 'awaiting-second-tap' and 'opening' (a rapid
                third tap is swallowed); pointer-events-none while 'dismissing'
                (DD-2), so the fading padlock passes every tap through. */}
            <div
                className={`absolute flex items-center justify-center rounded-full bg-gray-900/60 shadow-lg shadow-black/40 ring-2 transition-shadow duration-[400ms] ${isOpening ? 'ring-green-400/70' : 'ring-white/40'} ${isDismissing ? 'pointer-events-none' : 'pointer-events-auto'}`}
                style={{
                    left: hitCenter.x - HIT_RADIUS_PX,
                    top: hitCenter.y - HIT_RADIUS_PX,
                    width: HIT_RADIUS_PX * 2,
                    height: HIT_RADIUS_PX * 2,
                }}
                onClick={handleHitAreaClick}
                data-testid="touch-lock-hit-area"
            >
                {isOpening ? (
                    <LockKeyholeOpen
                        className="w-12 h-12 text-white"
                        data-testid="touch-lock-icon-open"
                    />
                ) : (
                    <LockKeyhole
                        className="w-12 h-12 text-white"
                        data-testid="touch-lock-icon-closed"
                    />
                )}
            </div>
        </div>,
        document.body,
    );
}
