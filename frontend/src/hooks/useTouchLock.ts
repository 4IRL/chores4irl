import { useState, useEffect, useRef, useCallback } from 'react';

export const INACTIVITY_MS = 5 * 60 * 1000;

export function useTouchLock(): { isLocked: boolean; arm: () => void } {
    const [isLocked, setIsLocked] = useState(false);
    const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const armInactivityTimer = useCallback(() => {
        if (inactivityTimerRef.current !== null) clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(() => setIsLocked(true), INACTIVITY_MS);
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

    useEffect(() => {
        if (isLocked) return;
        const onActivity = () => armInactivityTimer();
        document.addEventListener('pointerdown', onActivity);
        document.addEventListener('keydown', onActivity);
        return () => {
            document.removeEventListener('pointerdown', onActivity);
            document.removeEventListener('keydown', onActivity);
        };
    }, [isLocked, armInactivityTimer]);

    const arm = useCallback(() => {
        setIsLocked(false);
        armInactivityTimer();
    }, [armInactivityTimer]);

    return { isLocked, arm };
}
