import { useState, useEffect, useRef, useCallback } from 'react';

export const INACTIVITY_MS = 5 * 60 * 1000;

export function useTouchLock(): { isLocked: boolean; arm: () => void; lock: () => void; idleExpiries: number } {
    const [isLocked, setIsLocked] = useState(false);
    const [idleExpiries, setIdleExpiries] = useState<number>(0);
    const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const armInactivityTimer = useCallback(() => {
        if (inactivityTimerRef.current !== null) clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(function onExpire() {
            setIsLocked(true);
            setIdleExpiries(count => count + 1);
            inactivityTimerRef.current = setTimeout(onExpire, INACTIVITY_MS);
        }, INACTIVITY_MS);
    }, []);

    // Mount-time arm: a fresh page load counts as the "last interaction," so the
    // countdown starts immediately rather than the app defaulting to locked.
    useEffect(() => {
        armInactivityTimer();
        return () => {
            if (inactivityTimerRef.current !== null) clearTimeout(inactivityTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // F20: listeners stay attached while locked, so the inactivity timer keeps
    // running under the lock and each expiry is an idle tick that App's F19
    // view reset re-keys to (activity only postpones the next tick; it never
    // unlocks — only arm() does). `setIsLocked(true)` while already true bails
    // out without a re-render, which is why `idleExpiries` exists: it gives the
    // reset a dependency that changes on every expiry — the same reasoning as
    // useScreenBlank's `rearmTick`.
    useEffect(() => {
        const onActivity = () => armInactivityTimer();
        document.addEventListener('pointerdown', onActivity);
        document.addEventListener('keydown', onActivity);
        return () => {
            document.removeEventListener('pointerdown', onActivity);
            document.removeEventListener('keydown', onActivity);
        };
    }, [armInactivityTimer]);

    const arm = useCallback(() => {
        setIsLocked(false);
        armInactivityTimer();
    }, [armInactivityTimer]);

    // F20: manual lock (the indicator). Engages immediately and restarts the
    // countdown without bumping idleExpiries; the isLocked false→true flip
    // re-runs the F19 reset on its own.
    const lock = useCallback(() => {
        setIsLocked(true);
        armInactivityTimer();
    }, [armInactivityTimer]);

    return { isLocked, arm, lock, idleExpiries };
}
