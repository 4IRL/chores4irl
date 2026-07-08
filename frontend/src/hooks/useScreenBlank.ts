import { useState, useEffect, useRef, useCallback } from 'react';
import { set, addDays, isBefore } from 'date-fns';

const INACTIVITY_MS = 5 * 60 * 1000;

export const BLANK_START_HOUR = 21;
export const BLANK_END_HOUR = 6;

export function isWithinBlankWindow(date: Date): boolean {
    const hour = date.getHours();
    return hour >= BLANK_START_HOUR || hour < BLANK_END_HOUR;
}

export function nextBoundary(date: Date): Date {
    const todayEnd = set(date, { hours: BLANK_END_HOUR, minutes: 0, seconds: 0, milliseconds: 0 });
    const todayStart = set(date, { hours: BLANK_START_HOUR, minutes: 0, seconds: 0, milliseconds: 0 });
    if (isBefore(date, todayEnd)) return todayEnd;
    if (isBefore(date, todayStart)) return todayStart;
    return addDays(todayEnd, 1);
}

export function useScreenBlank(): { isBlanked: boolean; wake: () => void } {
    const [inWindow, setInWindow] = useState<boolean>(() => isWithinBlankWindow(new Date()));
    // `inWindow` only ever takes one of two values, unlike `useMidnightClock`'s
    // always-distinct `Date` — so recomputing it via `setInWindow` doesn't
    // guarantee the boundary-scheduling effect below re-runs (React bails out
    // of an identical `setState`). `rearmTick` is bumped on every recompute so
    // the effect always has a changed dependency to reschedule against.
    const [rearmTick, setRearmTick] = useState<number>(0);
    const [awake, setAwake] = useState<boolean>(false);
    const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const boundary = nextBoundary(new Date());
        const msUntilBoundary = boundary.getTime() - Date.now();
        const timer = setTimeout(() => {
            setInWindow(isWithinBlankWindow(new Date()));
            setRearmTick((tick) => tick + 1);
        }, msUntilBoundary);
        return () => clearTimeout(timer);
    }, [inWindow, rearmTick]);

    const armInactivityTimer = useCallback(() => {
        if (inactivityTimerRef.current !== null) clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(() => setAwake(false), INACTIVITY_MS);
    }, []);

    const wake = useCallback(() => {
        setAwake(true);
        armInactivityTimer();
    }, [armInactivityTimer]);

    useEffect(() => {
        if (inWindow) return;
        setAwake(false);
        if (inactivityTimerRef.current !== null) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
        }
    }, [inWindow]);

    useEffect(() => {
        if (!inWindow || !awake) return;
        const onActivity = () => armInactivityTimer();
        document.addEventListener('pointerdown', onActivity);
        document.addEventListener('keydown', onActivity);
        return () => {
            document.removeEventListener('pointerdown', onActivity);
            document.removeEventListener('keydown', onActivity);
        };
    }, [inWindow, awake, armInactivityTimer]);

    useEffect(() => {
        return () => {
            if (inactivityTimerRef.current !== null) clearTimeout(inactivityTimerRef.current);
        };
    }, []);

    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                setInWindow(isWithinBlankWindow(new Date()));
                setRearmTick((tick) => tick + 1);
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, []);

    const isBlanked = inWindow && !awake;
    return { isBlanked, wake };
}
